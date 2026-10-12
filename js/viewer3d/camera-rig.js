// Camera control for the full variant: orbit controls, framing for each class/size, animated view changes,
// keyboard orbiting, and a wheel policy that does not trap page scrolling.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CLASSES } from '../data/classes.js';

const VIEW_DIRS = { reset: [0.42, 0.18, 1], front: [0, 0.06, 1], side: [1, 0.06, 0], back: [0, 0.06, -1] };
const TAU = Math.PI * 2;

/**
 * frame: shared state object read here { W, H, phone, multi, size, active }
 * hooks: { onUserMove(), getBounds() -> THREE.Box3[] (world boxes of the robots on stage, used to fit the lineup) }
 */
export function createRig({ canvas, stage, camera, frame, hooks = {} }) {
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = 0.9;
  controls.maxDistance = 7;
  controls.maxPolarAngle = Math.PI * 0.92;
  controls.autoRotateSpeed = 1.6;
  // OrbitControls registers a capture keydown listener on canvas.getRootNode() (the document) and removes it from whatever
  // getRootNode() returns at disconnect time. If the host detaches our root before calling destroy(), that is the detached
  // subtree, and the listener on the document would stay. Remember where it went so dispose() can always remove it.
  const connectedRoot = canvas.getRootNode();
  controls.enableZoom = true; // wheel zoom is gated per event by the policy below; pinch always works
  // one finger scrolls the page vertically, drags horizontally rotate, two fingers pinch-zoom
  canvas.style.touchAction = 'pan-y';

  const sphA = new THREE.Spherical(), sphB = new THREE.Spherical(), sph = new THREE.Spherical();
  const off = new THREE.Vector3(), tgt = new THREE.Vector3();
  let tween = null, userMoved = false, engaged = false, reduced = false;

  const UP = new THREE.Vector3(0, 1, 0);
  const FIT_PAD = { x: 0.05, top: 0.14, bottom: 0.07 };   // fraction of the half-frame kept free: sides, name tags above, floor below
  /**
   * Smallest camera distance, and the pan that centers the picture, for which every corner of every robot box projects inside
   * the frame with the margins above. The camera looks along -dir at a target that may be panned sideways and up, so moving the
   * camera along its axis changes only the depth of each point and the fit has a closed form (no iteration).
   */
  function fitBounds(d) {
    const boxes = hooks.getBounds && frame.W > 0 && frame.H > 0 ? hooks.getBounds() : null;
    if (!boxes || !boxes.length) return null;
    const tanH = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2), aspect = frame.W / frame.H;
    const dir = new THREE.Vector3(d[0], d[1], d[2]).normalize();
    const fwd = dir.clone().negate();
    const right = new THREE.Vector3().crossVectors(fwd, UP).normalize();
    const up = new THREE.Vector3().crossVectors(right, fwd);
    const union = new THREE.Box3();
    for (const b of boxes) union.union(b);
    const c0 = union.getCenter(new THREE.Vector3());
    const pts = [], v = new THREE.Vector3();
    for (const b of boxes) {
      for (const x of [b.min.x, b.max.x]) for (const y of [b.min.y, b.max.y]) for (const z of [b.min.z, b.max.z]) {
        v.set(x, y, z).sub(c0);
        pts.push([v.dot(right), v.dot(up), v.dot(fwd)]);
      }
    }
    const ax = (1 - FIT_PAD.x) * tanH * aspect, aT = (1 - FIT_PAD.top) * tanH, aB = (1 - FIT_PAD.bottom) * tanH;
    let dist = 0.4;
    for (const p of pts) dist = Math.max(dist, 0.4 - p[2]);
    for (const a of pts) for (const b of pts) {
      dist = Math.max(dist, (a[0] - b[0]) / (2 * ax) - (a[2] + b[2]) / 2, (a[1] - b[1] - aT * a[2] - aB * b[2]) / (aT + aB));
    }
    let sxLo = -Infinity, sxHi = Infinity, syLo = -Infinity, syHi = Infinity;
    for (const p of pts) {
      const depth = dist + p[2];
      sxLo = Math.max(sxLo, p[0] - ax * depth); sxHi = Math.min(sxHi, p[0] + ax * depth);
      syLo = Math.max(syLo, p[1] - aT * depth); syHi = Math.min(syHi, p[1] + aB * depth);
    }
    const sx = (sxLo + sxHi) / 2, sy = (syLo + syHi) / 2;
    const target = c0.clone().addScaledVector(right, sx).addScaledVector(up, sy);
    return { pos: target.clone().addScaledVector(dir, dist), target };
  }

  function framing(which) {
    if (frame.size === 'lineup') { const fit = fitBounds(VIEW_DIRS[which] || VIEW_DIRS.reset); if (fit) return fit; }
    const C = CLASSES[frame.active];
    const h = frame.multi ? 1.8 : C.viewH;
    const aspect = frame.W / frame.H;
    const fov = THREE.MathUtils.degToRad(camera.fov);
    const t = 2 * Math.tan(fov / 2);
    let dist = (h * 1.18) / t;
    // leave room on both sides for the label columns: on narrow stages the robot gets a smaller share of the width
    const wNeed = frame.size === 'lineup' ? (frame.phone ? 3.2 : 2.9) : frame.multi ? 2.2 : C.viewW * (frame.phone ? (C.kind === 'quad' ? 1.9 : 1.7) : 1.25);
    dist = Math.max(dist, wNeed / (t * aspect));
    if (C.kind === 'quad' && !frame.multi) dist *= frame.phone ? 1.0 : 1.25;
    if (frame.phone && !frame.multi) dist *= 0.92;
    const target = new THREE.Vector3(0, h * 0.5, 0);
    const d = VIEW_DIRS[which] || VIEW_DIRS.reset;
    const pos = new THREE.Vector3(d[0], d[1], d[2]).normalize().multiplyScalar(dist).add(target);
    return { pos, target };
  }

  /** Move to a named view, gliding unless animate is false or reduced motion is on. */
  function goTo(which, animate = true) {
    const to = framing(which);
    userMoved = false;
    if (!animate || reduced) {
      tween = null;
      camera.position.copy(to.pos);
      controls.target.copy(to.target);
      controls.update();
      return;
    }
    off.copy(camera.position).sub(controls.target);
    tween = {
      t0: performance.now(), dur: 520,
      from: sphA.setFromVector3(off).clone(), fromT: controls.target.clone(),
      to: sphB.setFromVector3(off.copy(to.pos).sub(to.target)).clone(), toT: to.target,
    };
  }
  /** Advance the glide. Returns true while it is running. */
  function step(now) {
    if (!tween) return false;
    const u = Math.min(1, (now - tween.t0) / tween.dur);
    const e = 1 - Math.pow(1 - u, 3);
    let dTheta = tween.to.theta - tween.from.theta;
    dTheta = ((dTheta + Math.PI) % TAU + TAU) % TAU - Math.PI;
    sph.radius = tween.from.radius + (tween.to.radius - tween.from.radius) * e;
    sph.phi = tween.from.phi + (tween.to.phi - tween.from.phi) * e;
    sph.theta = tween.from.theta + dTheta * e;
    tgt.lerpVectors(tween.fromT, tween.toT, e);
    controls.target.copy(tgt);
    camera.position.copy(tgt).add(off.setFromSpherical(sph));
    if (u >= 1) tween = null;
    return true;
  }
  const cancelTween = () => { tween = null; };

  function orbitBy(dTheta, dPhi, zoom = 1) {
    off.copy(camera.position).sub(controls.target);
    sph.setFromVector3(off);
    sph.theta += dTheta;
    sph.phi = Math.max(0.12, Math.min(controls.maxPolarAngle, sph.phi + dPhi));
    sph.radius = Math.max(controls.minDistance, Math.min(controls.maxDistance, sph.radius * zoom));
    camera.position.copy(controls.target).add(off.setFromSpherical(sph));
    tween = null; userMoved = true;
    if (hooks.onUserMove) hooks.onUserMove();
  }

  // ---- listeners (all removed in dispose)
  const onStart = () => { tween = null; userMoved = true; if (hooks.onUserMove) hooks.onUserMove(); };
  const onPointerDown = () => { engaged = true; controls.enableZoom = true; tween = null; };
  const onLeave = () => { engaged = false; };
  // plain wheel scrolls the page; wheel zooms once the model has been clicked, or with Ctrl/Cmd (also trackpad pinch)
  const onWheelCapture = (e) => { controls.enableZoom = engaged || e.ctrlKey || e.metaKey; };
  const onKey = (e) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    const k = e.key;
    if (k === 'ArrowLeft') orbitBy(0.18, 0);
    else if (k === 'ArrowRight') orbitBy(-0.18, 0);
    else if (k === 'ArrowUp') orbitBy(0, -0.12);
    else if (k === 'ArrowDown') orbitBy(0, 0.12);
    else if (k === '+' || k === '=') orbitBy(0, 0, 0.88);
    else if (k === '-' || k === '_') orbitBy(0, 0, 1.14);
    else return;
    e.preventDefault();
  };
  controls.addEventListener('start', onStart);
  canvas.addEventListener('pointerdown', onPointerDown);
  stage.addEventListener('pointerleave', onLeave);
  stage.addEventListener('wheel', onWheelCapture, { capture: true, passive: true });
  canvas.addEventListener('keydown', onKey);

  return {
    controls, framing, goTo, step, cancelTween, orbitBy,
    get userMoved() { return userMoved; },
    get autoRotate() { return controls.autoRotate; },
    set autoRotate(v) { controls.autoRotate = !!v; },
    setReduced(r) {
      reduced = !!r;
      controls.enableDamping = !reduced;
      if (reduced) controls.autoRotate = false;
    },
    dispose() {
      controls.removeEventListener('start', onStart);
      canvas.removeEventListener('pointerdown', onPointerDown);
      stage.removeEventListener('pointerleave', onLeave);
      stage.removeEventListener('wheel', onWheelCapture, { capture: true });
      canvas.removeEventListener('keydown', onKey);
      controls.dispose();
      for (const node of new Set([connectedRoot, canvas.getRootNode()])) {
        try {
          node.removeEventListener('keydown', controls._interceptControlDown, { capture: true });
          node.removeEventListener('keyup', controls._interceptControlUp, { capture: true });
        } catch (e) { /* not an event target */ }
      }
      tween = null;
    },
  };
}
