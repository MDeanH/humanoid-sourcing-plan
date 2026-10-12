// Shared three.js world for both variants: renderer, environment, lights, floor, lazily built robots, full disposal.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { buildRobot } from './robot.js';

const MAX_DPR = 2;

export function disposeObject3D(root) {
  root.traverse((o) => {
    if (o.isMesh || o.isLine || o.isPoints) {
      if (o.geometry) o.geometry.dispose();
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of mats) {
        if (!m) continue;
        for (const k of Object.keys(m)) { const v = m[k]; if (v && v.isTexture) v.dispose(); }
        m.dispose();
      }
    }
    if (o.isCSS2DObject && o.element) o.element.remove();
  });
}

/**
 * three.js keeps one DFG lookup texture for the whole page and registers a 'dispose' listener on it for every renderer that
 * uploads it. That listener closes over the renderer, so a destroyed viewer stays in memory until the texture is disposed
 * (about 150 KB of JS heap per create/destroy cycle). Disposing it only drops each live renderer's GPU copy and removes the
 * listeners; three uploads it again on next use, so other viewers on the page are unaffected.
 */
function releaseSharedTextures(renderer, robots) {
  try {
    for (const r of Object.values(robots)) {
      let mat = null;
      r.group.traverse((o) => { if (!mat && o.isMesh && o.material && o.material.isMeshStandardMaterial) mat = o.material; });
      const u = mat && renderer.properties.get(mat).uniforms;
      if (u && u.dfgLUT && u.dfgLUT.value) { u.dfgLUT.value.dispose(); return; }
    }
  } catch (e) { /* internals differ in another three.js version: the leak is then back, nothing else breaks */ }
}

/**
 * Creates the renderer and the scene contents. Throws if WebGL cannot be created.
 * opts: { canvas, ringColor }
 */
export function createWorld({ canvas, ringColor = '#2f3d5c' }) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, MAX_DPR));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.95;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor(0x000000, 0);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;

  const scene = new THREE.Scene();
  // Image-based lighting. The prefiltered environment lives in a render target, which a lost WebGL context wipes, so it is
  // built by a function that is run again after a context restore (see rebuildEnvironment).
  let envTarget = null;
  function buildEnvironment(contextRestored) {
    const pmrem = new THREE.PMREMGenerator(renderer);
    const room = new RoomEnvironment();
    const target = pmrem.fromScene(room, 0.04);
    room.dispose();
    pmrem.dispose();                       // the generator is only needed while rendering the target
    const old = envTarget;
    envTarget = target;
    scene.environment = target.texture;
    // After a restore the old target's GL objects belong to the dead context: deleting them on the new one only logs
    // INVALID_OPERATION warnings, and nothing is left to free, so the stale target is simply dropped.
    if (old && !contextRestored) old.dispose();
  }
  buildEnvironment(false);
  scene.environmentIntensity = 0.85;

  const camera = new THREE.PerspectiveCamera(32, 1, 0.05, 50);

  const lights = [];
  const hemi = new THREE.HemisphereLight(0xe8edf8, 0x1a2140, 0.55);
  const key = new THREE.DirectionalLight(0xffffff, 1.35); key.position.set(2.4, 4.2, 3.2);
  key.castShadow = true; key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.near = 0.5; key.shadow.camera.far = 12;
  key.shadow.camera.left = -2; key.shadow.camera.right = 2; key.shadow.camera.top = 3; key.shadow.camera.bottom = -0.5;
  key.shadow.bias = -0.0004; key.shadow.radius = 3;
  const fill = new THREE.DirectionalLight(0xdde6ff, 0.55); fill.position.set(-2.2, 2.4, 1.6);
  const rim = new THREE.DirectionalLight(0xa8c0ff, 0.85); rim.position.set(-2.8, 2.8, -3.2);
  for (const l of [hemi, key, fill, rim]) { scene.add(l); lights.push(l); }

  // floor: soft contact shadow, shadow-catching disc, and thin rings
  const floor = new THREE.Group();
  floor.name = 'v3d-floor';
  const rings = [];
  {
    const c = document.createElement('canvas'); c.width = c.height = 512;
    const g = c.getContext('2d');
    const grd = g.createRadialGradient(256, 256, 20, 256, 256, 256);
    grd.addColorStop(0, 'rgba(0,0,0,0.62)'); grd.addColorStop(0.45, 'rgba(0,0,0,0.22)'); grd.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grd; g.fillRect(0, 0, 512, 512);
    const sh = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 2.4), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false }));
    sh.rotation.x = -Math.PI / 2; sh.position.y = 0.001; floor.add(sh);
    const ground = new THREE.Mesh(new THREE.CircleGeometry(1.6, 96), new THREE.ShadowMaterial({ opacity: 0.28 }));
    ground.rotation.x = -Math.PI / 2; ground.position.y = 0.0005; ground.receiveShadow = true; floor.add(ground);
    for (const r of [0.55, 0.95, 1.35]) {
      const ring = new THREE.Mesh(new THREE.RingGeometry(r - 0.004, r, 120), new THREE.MeshBasicMaterial({ color: ringColor, transparent: true, opacity: 0.85 }));
      ring.rotation.x = -Math.PI / 2; ring.position.y = 0.002; floor.add(ring); rings.push(ring);
    }
  }
  scene.add(floor);

  const robots = {};
  let disposed = false;

  const world = {
    renderer, scene, camera, floor, robots,
    /** Build (once) and return the robot for a platform. It starts hidden. */
    ensureRobot(cls) {
      if (!robots[cls]) {
        const r = buildRobot(cls);
        r.group.visible = false;
        scene.add(r.group);
        robots[cls] = r;
      }
      return robots[cls];
    },
    setSize(w, h) {
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, MAX_DPR));
      renderer.setSize(w, h, false);
    },
    /** Recolor the floor rings (the token they were drawn from changed, or was not readable yet when the world was built). */
    setRingColor(c) { for (const ring of rings) ring.material.color.set(c); },
    render() { renderer.render(scene, camera); },
    /** Regenerate the environment map. Call after 'webglcontextrestored': the old render target came back empty, which leaves every PBR surface dark and flat. */
    rebuildEnvironment() {
      if (disposed) return;
      buildEnvironment(true);
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      releaseSharedTextures(renderer, robots);
      for (const r of Object.values(robots)) { scene.remove(r.group); disposeObject3D(r.group); }
      disposeObject3D(floor); scene.remove(floor);
      for (const l of lights) { scene.remove(l); if (l.shadow) l.shadow.dispose(); if (l.dispose) l.dispose(); }
      scene.environment = null;
      if (envTarget) envTarget.dispose();
      envTarget = null;
      renderer.dispose();
      try { renderer.forceContextLoss(); } catch (e) { /* already lost */ }
      for (const k of Object.keys(robots)) delete robots[k];
    },
  };
  return world;
}

/**
 * Calls onChange whenever window.devicePixelRatio changes: the window moves to a monitor with another density, or the OS scaling
 * changes. Neither alters the CSS size of the canvas, so a ResizeObserver never hears of it. The query is re-armed for the new
 * ratio each time. Returns the function that stops watching.
 */
export function watchPixelRatio(onChange) {
  if (typeof window.matchMedia !== 'function') return () => {};
  let list = null, handler = null, stopped = false;
  const disarm = () => {
    if (list && handler) { if (list.removeEventListener) list.removeEventListener('change', handler); else if (list.removeListener) list.removeListener(handler); }
    list = handler = null;
  };
  const arm = () => {
    disarm();
    const dpr = window.devicePixelRatio || 1;
    // a window around the current ratio (not an exact match) so it matches however the browser rounds the value
    list = window.matchMedia(`(min-resolution: ${(dpr - 0.001).toFixed(4)}dppx) and (max-resolution: ${(dpr + 0.001).toFixed(4)}dppx)`);
    handler = () => { if (stopped) return; arm(); onChange(); };
    if (list.addEventListener) list.addEventListener('change', handler); else if (list.addListener) list.addListener(handler);
  };
  arm();
  return () => { stopped = true; disarm(); };
}

/** True when a WebGL2 context can be created (three.js r17x+ needs WebGL2). The probe context is released at once. */
export function probeWebGL() {
  try {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl2');
    if (!gl) return false;
    const ext = gl.getExtension('WEBGL_lose_context');
    if (ext) ext.loseContext();
    return true;
  } catch (e) { return false; }
}
