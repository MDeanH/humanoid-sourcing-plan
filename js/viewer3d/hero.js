// Hero variant: a transparent canvas that fills `root` with the chosen platform slowly turntabling.
// No labels, no panel, no toolbar, no pointer input. The camera is fixed and the robot group rotates.
import * as THREE from 'three';
import { SUBSYSTEMS, ORIGIN_REC } from '../data/planner-parts.js';
import { CLASSES, ORDER, LINEUP } from '../data/classes.js';
import { createWorld, watchPixelRatio } from './scene.js';
import { applyRobotColors } from './coloring.js';
import { createCssColors } from './css-colors.js';
import { createPlanModel, partFor } from './planner-model.js';

const SIZES = [...ORDER, 'both', 'lineup'];
const MODES = ['sub', 'origin', 'calc'];
const SPEED = 0.32;     // rad/s, about 20 s per revolution
const POSE = 0.55;      // static / starting yaw: a three-quarter view

export function createHeroViewer(root, options = {}) {
  const addedClasses = ['v3d', 'v3d-hero'].filter((c) => !root.classList.contains(c));
  addedClasses.forEach((c) => root.classList.add(c));
  const colors = createCssColors(root);
  const readTokens = () => ({
    us: colors.read('--us', '#22c55e'), fx: colors.read('--cn', '#ef4444'), unk: colors.read('--v3d-unk', '#a855f7'),
    ring: colors.read('--line-strong', '#2f3d5c'),
  });
  const tokens = readTokens();
  const canvas = document.createElement('canvas');
  canvas.className = 'v3d-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  canvas.style.pointerEvents = 'none';
  let world;
  try {
    world = createWorld({ canvas, ringColor: tokens.ring });
  } catch (err) {
    colors.dispose();
    addedClasses.forEach((c) => root.classList.remove(c));
    const e = new Error('WebGL is not available');
    e.code = 'NO_WEBGL'; e.cause = err;
    throw e;
  }
  root.replaceChildren(canvas);

  const model = createPlanModel(options.storagePrefix);
  const palette = { us: tokens.us, fx: tokens.fx, unk: tokens.unk };
  let ringColor = tokens.ring;
  const S = {
    size: 'full', active: 'full', mode: MODES.includes(options.mode) ? options.mode : 'sub', W: 0, H: 0,
    offsetX: Math.max(-0.45, Math.min(0.45, Number(options.offsetX) || 0)),
  };
  const mq = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  let reduced = !!(mq && mq.matches);
  let destroyed = false, inView = true, userPaused = false, rafId = 0, roRaf = 0, lastT = 0, yaw = POSE, dirty = true;

  const modeColor = (p, cls) => (S.mode === 'origin' ? ORIGIN_REC[p.rec].color : S.mode === 'calc' ? palette[model.originOf(p, cls)] : SUBSYSTEMS[p.sub].color);
  const recolor = () => { for (const r of Object.values(world.robots)) applyRobotColors(r, S.mode, (pid) => modeColor(partFor(pid, r.cls), r.cls)); dirty = true; };

  function placeRobots() {
    const lay = LINEUP[S.size];
    for (const c of lay ? Object.keys(lay) : [S.size]) {
      if (!world.robots[c]) { const r = world.ensureRobot(c); r.tag.visible = false; applyRobotColors(r, S.mode, (pid) => modeColor(partFor(pid, c), c)); }
    }
    for (const r of Object.values(world.robots)) {
      const vis = lay ? r.cls in lay : r.cls === S.size;
      r.group.visible = vis;
      r.group.position.x = lay && r.cls in lay ? lay[r.cls] : 0;
      r.group.rotation.y = yaw;
    }
    dirty = true;
  }

  /** Fixed camera framed from the root size; offsetX shifts the picture sideways through the view offset. */
  function frameCamera() {
    const { W, H } = S;
    if (!W || !H) return;
    const cam = world.camera, C = CLASSES[S.active], multi = S.size === 'both' || S.size === 'lineup';
    const h = multi ? 1.8 : C.viewH;
    const t = 2 * Math.tan(THREE.MathUtils.degToRad(cam.fov) / 2);
    const usableAspect = (W * Math.max(0.1, 1 - 2 * Math.abs(S.offsetX))) / H;
    const wNeed = S.size === 'lineup' ? 2.9 : multi ? 2.2 : C.viewW * 1.05;
    let dist = Math.max((h * 1.16) / t, wNeed / (t * usableAspect));
    if (C.kind === 'quad' && !multi) dist *= 1.1;
    cam.aspect = W / H;
    cam.position.set(0, h * 0.5 + dist * 0.12, dist);
    cam.lookAt(0, h * 0.47, 0);
    if (S.offsetX) cam.setViewOffset(W, H, -S.offsetX * W, 0, W, H); else cam.clearViewOffset();
    cam.updateProjectionMatrix();
    dirty = true;
  }

  /** Planner colors and floor rings come from the design tokens: read again at every measurement, which is when a root that was attached late (or re-themed) shows its real values. */
  function syncTokens() {
    const t = readTokens();
    if (t.ring !== ringColor) { ringColor = t.ring; world.setRingColor(t.ring); dirty = true; }
    if (t.us !== palette.us || t.fx !== palette.fx || t.unk !== palette.unk) { palette.us = t.us; palette.fx = t.fx; palette.unk = t.unk; recolor(); }
  }
  function resize() {
    if (destroyed) return;
    const W = root.clientWidth, H = root.clientHeight;
    S.W = W; S.H = H;
    if (!W || !H) { updateRun(); return; }
    syncTokens();
    world.setSize(W, H);
    frameCamera();
    updateRun();
  }
  const canRun = () => !destroyed && inView && !document.hidden && !userPaused && S.W > 0 && S.H > 0;
  function frame(dt) {
    if (!reduced) { yaw += SPEED * dt; for (const r of Object.values(world.robots)) r.group.rotation.y = yaw; dirty = true; }
    if (!dirty) return;
    world.render();
    dirty = false;
    root.dataset.ready = 'true';
  }
  function tick(now) {
    rafId = 0;
    if (!canRun()) return;
    // a reduced-motion hero renders only when something changed, so the loop is skipped entirely
    if (!reduced) rafId = requestAnimationFrame(tick);
    const dt = Math.min(0.1, Math.max(0, (now - lastT) / 1000));
    lastT = now;
    frame(dt);
  }
  function updateRun() {
    if (destroyed) return;
    if (canRun()) {
      if (!rafId) { lastT = performance.now(); dirty = true; rafId = requestAnimationFrame(tick); }
    } else if (rafId) { cancelAnimationFrame(rafId); rafId = 0; }
  }

  const ro = new ResizeObserver(() => { if (!roRaf) roRaf = requestAnimationFrame(() => { roRaf = 0; resize(); }); });
  ro.observe(root);
  let io = null;
  if (typeof IntersectionObserver !== 'undefined') {
    io = new IntersectionObserver((entries) => { inView = entries[entries.length - 1].isIntersecting; updateRun(); });
    io.observe(root);
  }
  const onVis = () => updateRun();
  document.addEventListener('visibilitychange', onVis);
  // moving the window to another monitor changes the pixel density but not the CSS size, so the canvas is resized from here
  const stopDpr = watchPixelRatio(() => {
    if (destroyed || !(S.W > 0 && S.H > 0)) return;
    world.setSize(S.W, S.H);
    dirty = true; updateRun();
  });
  // a lost context wipes the prefiltered environment map: rebuild it or the robot comes back dark and flat
  const onRestored = () => { if (destroyed) return; world.rebuildEnvironment(); dirty = true; updateRun(); };
  canvas.addEventListener('webglcontextrestored', onRestored);
  const onMq = () => {
    reduced = !!mq.matches;
    if (reduced) { yaw = POSE; for (const r of Object.values(world.robots)) r.group.rotation.y = yaw; }
    dirty = true; updateRun();
  };
  if (mq) { if (mq.addEventListener) mq.addEventListener('change', onMq); else if (mq.addListener) mq.addListener(onMq); }

  function setSize(sz) {
    if (!SIZES.includes(sz)) return;
    S.size = sz;
    S.active = ORDER.includes(sz) ? sz : (sz === 'both' ? 'full' : S.active);
    placeRobots(); frameCamera(); updateRun();
  }

  const initSize = SIZES.includes(options.size) ? options.size : (ORDER.includes(options.classId) ? options.classId : 'full');
  if (ORDER.includes(options.classId)) S.active = options.classId;
  S.W = root.clientWidth; S.H = root.clientHeight;
  setSize(initSize);
  if (ORDER.includes(options.classId) && (initSize === 'both' || initSize === 'lineup')) S.active = options.classId;
  resize();
  if (reduced) { dirty = true; }
  updateRun();

  const viewer = {
    root, canvas,
    select() {}, setView() {}, showTab() {},
    setSize(size) { if (!destroyed) setSize(size); },
    setMode(mode) { if (!destroyed && MODES.includes(mode)) { S.mode = mode; recolor(); updateRun(); } },
    getState() {
      const sc = model.score(S.active);
      return { size: S.size, active: S.active, mode: S.mode, selected: null, xray: false, density: 'none', score: { pct: sc.pct, tot: sc.tot, us: sc.us } };
    },
    resize() { if (!destroyed) resize(); },
    pause() { userPaused = true; updateRun(); },
    resume() { userPaused = false; updateRun(); },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      if (rafId) cancelAnimationFrame(rafId);
      if (roRaf) cancelAnimationFrame(roRaf);
      rafId = roRaf = 0;
      ro.disconnect(); if (io) io.disconnect();
      document.removeEventListener('visibilitychange', onVis);
      stopDpr();
      canvas.removeEventListener('webglcontextrestored', onRestored);
      if (mq) { if (mq.removeEventListener) mq.removeEventListener('change', onMq); else if (mq.removeListener) mq.removeListener(onMq); }
      world.dispose();
      colors.dispose();
      root.replaceChildren();
      addedClasses.forEach((c) => root.classList.remove(c));
      delete root.dataset.ready;
      viewer.debug = null;
      viewer.canvas = null;
      world = null;
    },
  };
  if (options.debug) {
    viewer.debug = {
      get renderer() { return world && world.renderer; }, get scene() { return world && world.scene; }, get camera() { return world && world.camera; },
      get robots() { return world && world.robots; }, state: S, model,
      get yaw() { return yaw; },
      renderNow() { dirty = true; frame(0); world.render(); },
    };
  }
  return viewer;
}
