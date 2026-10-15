// Stage variant: the main landing-page robot. A transparent full-bleed canvas (like the hero) that is interactive:
// slow turntable that yields to the pointer, drag to rotate with a little inertia, a real <button> hotspot on every part with a
// label on hover / focus / (for key parts) always, click on a hotspot or on the 3D part to report a selection, and a lineup mode.
// The viewer never navigates: it only calls the host callbacks. Everything lives inside `root`; destroy() removes all of it.
import * as THREE from 'three';
import { SUBSYSTEMS, ORIGIN_REC } from '../data/planner-parts.js';
import { CLASSES, ORDER, LINEUP } from '../data/classes.js';
import { createWorld, watchPixelRatio } from './scene.js';
import { applyRobotColors, applyXray, recolorMesh, highlightMesh } from './coloring.js';
import { createCssColors } from './css-colors.js';
import { createPlanModel, partFor, partsFor, hasPart, shortName, keySpec, esc } from './planner-model.js';

const SIZES = [...ORDER, 'lineup'];
const MODES = ['sub', 'origin', 'calc'];
const SPEED = 0.25;           // rad/s turntable, about 25 s per revolution
const POSE = 0.55;            // static / starting yaw: a three-quarter view
const DRAG_PX = 6;            // a press that moves further than this is a drag, never a click
const RAD_PER_PX = 0.0085;    // drag sensitivity: about 740 px per revolution
const INERTIA_TAU = 0.35;     // s, decay of the velocity left by a drag
const MAX_VEL = 6;            // rad/s
const HOVER_RESUME = 1500;    // ms between the pointer leaving and the turntable moving again
const TOUCH_RESUME = 4000;    // ms of touch idle before the turntable moves again
const SPIN_HOLD = 3000;       // ms the turntable stays still after spinTo / spinBy, so the part stays in front
const FACING_HIDE = -0.05;    // anchors facing away from the camera by more than this are hidden
const FACING_FULL = 0.15;     // ... and fade in until here
const OFFSET_MS = 400;
const LBL_GAP = 12;           // px from the dot centre to the label
const LBL_H = 16;             // px, label line box used for the overlap test
const LBL_PAD = 5;            // px of air kept between labels
const KS_GAP = 12;            // px between the name and the key spec
const COMPACT_W = 560;        // narrower stages show the key spec only on hover / focus

const ease = (k) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
const wrapPi = (a) => { a = (a + Math.PI) % (Math.PI * 2); if (a < 0) a += Math.PI * 2; return a - Math.PI; };
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

export function createStageViewer(root, options = {}) {
  const addedClasses = ['v3d', 'v3d-stage'].filter((c) => !root.classList.contains(c));
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
  canvas.style.touchAction = 'pan-y';
  canvas.style.cursor = 'grab';
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
  /** Alpha of a color token (colors.read() resolves to opaque '#rrggbb'): a translucent hairline token must not turn into a solid white floor ring. */
  const tokenAlpha = (name) => {
    let raw = '';
    try { raw = getComputedStyle(root.isConnected ? root : document.documentElement).getPropertyValue(name).trim(); } catch (e) { return 1; }
    let m = /(?:,|\/)\s*([\d.]+)(%?)\s*\)$/.exec(raw);
    if (m) { const v = parseFloat(m[1]); return clamp(m[2] ? v / 100 : v, 0, 1); }
    m = /^#[0-9a-f]{6}([0-9a-f]{2})$/i.exec(raw);
    return m ? parseInt(m[1], 16) / 255 : 1;
  };
  const styleRings = () => {
    const op = 0.85 * tokenAlpha('--line-strong');
    world.floor.traverse((o) => { if (o.isMesh && o.geometry && o.geometry.type === 'RingGeometry') o.material.opacity = op; });
  };
  styleRings();
  const layer = document.createElement('div');
  layer.className = 'v3d-hs-layer';
  layer.setAttribute('role', 'group');
  layer.setAttribute('aria-label', 'Robot parts');
  const probe = document.createElement('span');          // measures the advance of one label character (labels are monospace)
  probe.className = 'v3d-hs-probe';
  probe.setAttribute('aria-hidden', 'true');
  probe.textContent = 'MMMMMMMMMM';
  root.replaceChildren(canvas, layer, probe);

  // ---------------------------------------------------------------- state
  const model = createPlanModel(options.storagePrefix);
  const palette = { us: tokens.us, fx: tokens.fx, unk: tokens.unk };
  let ringColor = tokens.ring;
  const initSize = SIZES.includes(options.size) ? options.size : (ORDER.includes(options.classId) ? options.classId : 'full');
  const S = {
    size: 'full', active: ORDER.includes(options.classId) ? options.classId : (ORDER.includes(initSize) ? initSize : 'full'),
    mode: MODES.includes(options.mode) ? options.mode : 'sub', xray: false, W: 0, H: 0,
    offsetX: clamp(Number(options.offsetX) || 0, -0.45, 0.45),
  };
  const mq = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  let reduced = !!(mq && mq.matches);
  let destroyed = false, inView = true, userPaused = false, interactive = true;
  let rafId = 0, roRaf = 0, lastT = 0;
  let dirty = true, layoutDirty = true, rayDirty = false;
  let yaw = POSE, appliedYaw = NaN, vel = 0, turn = 0, resumeAt = 0;
  let hoverIn = false, dragging = false, touching = false, focusIn = false;
  let simulating = false;                                // debug.advance(): step the motion without drawing
  let tween = null, offAnim = null, drag = null, suppressClick = false, suppressTimer = 0;
  let ptrHover = null, focusHover = null, extHot = null, lineupHover = null, reportedHover = null;
  const ptr = { x: 0, y: 0, type: 'mouse', inside: false, onHs: false };
  const pulse = [];
  const offs = [];
  let items = [], byId = new Map(), captions = [];
  let cw = 7.4;                                          // px advance of one label character
  const fire = (fn, ...a) => { if (typeof fn !== 'function') return; try { fn(...a); } catch (e) { console.error(e); } };
  const on = (t, type, fn, opt) => { t.addEventListener(type, fn, opt); offs.push(() => t.removeEventListener(type, fn, opt)); };
  let simOffset = 0;                                     // ms the debug clock (debug.advance) is ahead of the real one; 0 in production
  const now0 = () => performance.now() + simOffset;

  const modeColor = (p, cls) => (S.mode === 'origin' ? ORIGIN_REC[p.rec].color : S.mode === 'calc' ? palette[model.originOf(p, cls)] : SUBSYSTEMS[p.sub].color);
  const recolor = () => {
    for (const r of Object.values(world.robots)) { applyRobotColors(r, S.mode, (pid) => modeColor(partFor(pid, r.cls), r.cls)); applyXray(r, S.xray); }
    applyPulse(); dirty = true;
  };
  const invalidate = () => { dirty = true; layoutDirty = true; };
  const lineupMode = () => S.size === 'lineup';

  // ---------------------------------------------------------------- robots, camera
  function placeRobots() {
    const lay = LINEUP[S.size];
    for (const c of lay ? Object.keys(lay) : [S.size]) {
      if (!world.robots[c]) {
        const r = world.ensureRobot(c); r.tag.visible = false;
        applyRobotColors(r, S.mode, (pid) => modeColor(partFor(pid, c), c));
        applyXray(r, S.xray);
      }
    }
    for (const r of Object.values(world.robots)) {
      const vis = lay ? r.cls in lay : r.cls === S.size;
      r.group.visible = vis;
      r.group.position.x = lay && r.cls in lay ? lay[r.cls] : 0;
      r.group.rotation.y = yaw;
    }
    appliedYaw = yaw;
    invalidate();
  }

  /** Fixed camera framed from the root size; offsetX shifts the picture sideways through the view offset (same as the hero). */
  function frameCamera() {
    const { W, H } = S;
    if (!W || !H) return;
    const cam = world.camera, C = CLASSES[S.active], multi = lineupMode();
    const h = multi ? 1.8 : C.viewH;
    const t = 2 * Math.tan(THREE.MathUtils.degToRad(cam.fov) / 2);
    const usableAspect = (W * Math.max(0.1, 1 - 2 * Math.abs(S.offsetX))) / H;
    const wNeed = multi ? 2.9 : C.viewW * 1.05;
    let dist = Math.max((h * 1.16) / t, wNeed / (t * usableAspect));
    if (C.kind === 'quad' && !multi) dist *= 1.1;
    cam.aspect = W / H;
    cam.position.set(0, h * 0.5 + dist * 0.12, dist);
    cam.lookAt(0, h * 0.47, 0);
    if (S.offsetX) cam.setViewOffset(W, H, -S.offsetX * W, 0, W, H); else cam.clearViewOffset();
    cam.updateProjectionMatrix();
    cam.updateMatrixWorld();
    invalidate();
  }

  /** Planner colors and floor rings come from the design tokens: read again at every measurement. */
  function syncTokens() {
    const t = readTokens();
    if (t.ring !== ringColor) { ringColor = t.ring; world.setRingColor(t.ring); dirty = true; }
    styleRings();
    if (t.us !== palette.us || t.fx !== palette.fx || t.unk !== palette.unk) { palette.us = t.us; palette.fx = t.fx; palette.unk = t.unk; recolor(); }
  }
  function measureLabel() {
    const w = probe.offsetWidth;
    if (w > 0) cw = w / 10;
  }
  function resize() {
    if (destroyed) return;
    const W = root.clientWidth, H = root.clientHeight;
    S.W = W; S.H = H;
    if (!W || !H) { updateRun(); return; }
    syncTokens();
    world.setSize(W, H);
    root.dataset.compact = String(W < COMPACT_W);
    measureLabel();
    frameCamera();
    updateRun();
  }

  // ---------------------------------------------------------------- hover / pulse
  const pulseLevel = () => (reduced ? 0.4 : 0.25);
  function clearPulse() {
    for (const m of pulse) recolorMesh(m, S.mode, modeColor(partFor(m.userData.partId, m.userData.cls), m.userData.cls));
    pulse.length = 0;
  }
  function applyPulse() {
    clearPulse();
    if (lineupMode()) { dirty = true; return; }
    const r = world.robots[S.active];
    if (!r || !r.group.visible) return;
    for (const id of new Set([hoverId(), extHot])) {
      if (!id) continue;
      for (const m of r.parts[id] || []) { pulse.push(m); highlightMesh(m, pulseLevel()); }
    }
    dirty = true;
  }
  const hoverId = () => (ptrHover !== null ? ptrHover : focusHover);
  function refreshHot() {
    const h = lineupMode() ? null : hoverId();
    for (const it of items) {
      const hot = it.id === h || it.id === extHot;
      if (hot !== it.hot) { it.hot = hot; it.el.classList.toggle('is-hot', hot); layoutDirty = true; }
    }
    for (const c of captions) {
      const hot = c.cls === lineupHover;
      if (hot !== c.hot) { c.hot = hot; c.el.classList.toggle('is-hot', hot); }
    }
    applyPulse();
    if (h !== reportedHover) { reportedHover = h; fire(options.onHover, h, S.active); }
    refreshCursor();
  }
  function refreshCursor() {
    const cur = !interactive ? '' : dragging ? 'grabbing' : (hoverId() && !lineupMode()) || lineupHover ? 'pointer' : 'grab';
    if (canvas.style.cursor !== cur) canvas.style.cursor = cur;
  }

  // ---------------------------------------------------------------- hotspots
  function buildHotspots() {
    layer.replaceChildren();
    items = []; byId = new Map(); captions = [];
    const frag = document.createDocumentFragment();
    if (lineupMode()) {
      for (const cls of Object.keys(LINEUP.lineup)) {
        const C = CLASSES[cls];
        const b = document.createElement('button');
        b.type = 'button'; b.className = 'v3d-cp'; b.dataset.cls = cls;
        b.setAttribute('aria-label', `${C.name}, ${C.short}`);
        b.innerHTML = `<span class="v3d-cp-nm">${esc(C.btn)}</span><span class="v3d-cp-ks">${esc(C.name)} · ${C.heightCm} cm</span>`;
        if (!interactive) { b.tabIndex = -1; }
        frag.appendChild(b);
        captions.push({ cls, el: b, hot: false, x: NaN, y: NaN });
      }
      layer.appendChild(frag);
      return;
    }
    const cls = S.active, r = world.robots[cls];
    if (!r) return;
    // DOM order is top to bottom: the height of an anchor does not change when the robot turns
    const list = partsFor(cls).map((p0) => partFor(p0.id, cls)).filter((p) => r.anchors[p.id])
      .sort((a, b) => r.anchors[b.id].pos.y - r.anchors[a.id].pos.y || r.anchors[a.id].pos.x - r.anchors[b.id].pos.x);
    list.forEach((p, i) => {
      const nm = shortName(p);
      let ks = keySpec(p, cls);
      if (ks && nm.toLowerCase().includes(ks.toLowerCase())) ks = '';      // "Jetson Orin 64 GB" + "64 GB" says it twice
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'v3d-hs' + (p.key ? ' is-key' : '');
      b.dataset.part = p.id;
      b.setAttribute('aria-label', p.title);
      b.style.setProperty('--hs', SUBSYSTEMS[p.sub].color);
      b.style.setProperty('--d', `${-((i * 0.37) % 2.4).toFixed(2)}s`);
      b.innerHTML = `<span class="v3d-hs-ring"></span><span class="v3d-hs-dot"></span><span class="v3d-hs-lbl"><span class="v3d-hs-nm">${esc(nm)}</span>${ks ? `<span class="v3d-hs-ks">${esc(ks)}</span>` : ''}</span>`;
      b.hidden = !!p.inside && !S.xray;
      if (!interactive) b.tabIndex = -1;
      frag.appendChild(b);
      const it = {
        id: p.id, p, el: b, anchor: r.anchors[p.id], key: !!p.key, inside: !!p.inside, hot: false, shown: false, wName: nm.length, wKs: ks.length,
        want: false, side: 0, x: NaN, y: NaN, alpha: -1, cls: '', sx: 0, sy: 0, a: 0, vis: false, pos: '', lx: 0, ly: 0, lw: 0, order: i,
      };
      items.push(it); byId.set(p.id, it);
    });
    layer.appendChild(frag);
    for (const it of items) { it.hot = it.id === extHot; if (it.hot) it.el.classList.add('is-hot'); }
  }

  const vA = new THREE.Vector3(), vB = new THREE.Vector3(), vN = new THREE.Vector3(), camPos = new THREE.Vector3();
  const cand = [], placed = [];
  /** Project every hotspot, decide which labels fit, then write. No DOM reads in here: label widths come from the monospace advance. */
  function layoutHotspots() {
    const W = S.W, H = S.H;
    if (!W || !H) return;
    const cam = world.camera;
    cam.updateMatrixWorld();
    if (lineupMode()) {
      for (const c of captions) {
        const r = world.robots[c.cls]; if (!r) continue;
        vA.set(r.group.position.x, 0, 0.32).project(cam);          // just in front of the feet
        const x = Math.round(((vA.x + 1) / 2 * W) * 10) / 10, y = Math.round(Math.min((1 - vA.y) / 2 * H + 8, H - 48) * 10) / 10;
        if (x !== c.x || y !== c.y) { c.x = x; c.y = y; c.el.style.transform = `translate(${x}px, ${y}px) translateX(-50%)`; }
      }
      return;
    }
    const robot = world.robots[S.active];
    if (!robot) return;
    const C = CLASSES[S.active], compact = W < COMPACT_W;
    robot.group.updateMatrixWorld(true);
    const mw = robot.group.matrixWorld;
    cam.getWorldPosition(camPos);
    vA.set(0, C.centerY / C.scale, 0).applyMatrix4(mw).project(cam);
    const cx = (vA.x + 1) / 2 * W;

    // pass 1: screen position, facing, visibility
    cand.length = 0;
    for (const it of items) {
      it.vis = false;
      if (it.inside && !S.xray) continue;
      const a = it.anchor;
      vA.copy(a.pos).applyMatrix4(mw);
      let facing = null;
      if (a.normal && !it.inside) { vN.copy(a.normal).transformDirection(mw); facing = vN.dot(vB.copy(camPos).sub(vA).normalize()); }
      vB.copy(vA).project(cam);
      it.sx = (vB.x + 1) / 2 * W; it.sy = (1 - vB.y) / 2 * H;
      // an inside part is seen through the see-through shells from every side: it is never treated as back-facing
      it.a = vB.z > 1 || it.sx < -6 || it.sx > W + 6 || it.sy < -6 || it.sy > H + 6 ? 0
        : facing === null ? 1 : clamp((facing - FACING_HIDE) / (FACING_FULL - FACING_HIDE), 0, 1);
      it.vis = it.a > 0;
      if (it.vis && (it.hot || it.key)) cand.push(it);
    }

    // pass 2: greedy label placement. Hot labels first, then the ones that were showing (so labels do not flicker), then the rest.
    cand.sort((p, q) => (q.hot - p.hot) || (q.shown - p.shown) || (p.order - q.order));
    placed.length = 0;
    for (const it of cand) it.want = false;
    for (const it of cand) {
      const w = cw * it.wName + (it.wKs && (!compact || it.hot) ? KS_GAP + cw * it.wKs : 0) + 2;
      const pref = it.sx < cx - 10 ? -1 : it.sx > cx + 10 ? 1 : (it.side || (it.sx < cx ? -1 : 1));
      let side = 0;
      for (const s of [pref, -pref]) {
        const l = s > 0 ? it.sx + LBL_GAP : it.sx - LBL_GAP - w, t = it.sy - LBL_H / 2;
        if (l < 4 || l + w > W - 4 || t < 4 || t + LBL_H > H - 4) continue;
        if (!it.hot && overlaps(l, t, w, LBL_H, it)) continue;
        if (it.hot && overlapsLabels(l, t, w, LBL_H)) continue;
        side = s; it.lx = l; it.ly = t; it.lw = w; break;
      }
      if (!side && it.hot) { side = pref; it.lx = side > 0 ? Math.min(it.sx + LBL_GAP, W - w - 4) : Math.max(it.sx - LBL_GAP - w, 4); it.ly = it.sy - LBL_H / 2; it.lw = w; }
      if (side) { it.want = true; it.side = side; placed.push(it); }
    }

    // pass 3: writes
    for (const it of items) {
      const el = it.el;
      if (!it.vis) {
        if (it.alpha !== 0) { it.alpha = 0; el.style.opacity = '0'; el.classList.add('is-back'); }
        if (it.shown) { it.shown = false; el.classList.remove('is-show'); }
        continue;
      }
      const tx = Math.round(it.sx * 10) / 10, ty = Math.round(it.sy * 10) / 10;
      if (tx !== it.x || ty !== it.y) { it.x = tx; it.y = ty; el.style.transform = `translate3d(${tx}px, ${ty}px, 0)`; }
      const al = Math.round(it.a * 20) / 20;
      if (al !== it.alpha) {
        if (it.alpha === 0) el.classList.remove('is-back');
        it.alpha = al; el.style.opacity = al >= 1 ? '' : String(al);
      }
      const want = it.want && !!it.side;
      if (want !== it.shown) { it.shown = want; el.classList.toggle('is-show', want); }
      if (it.side && it.cls !== (it.side > 0 ? 'r' : 'l')) { it.cls = it.side > 0 ? 'r' : 'l'; el.classList.toggle('is-r', it.side > 0); el.classList.toggle('is-l', it.side < 0); }
    }
  }
  /** Does the label rectangle hit a placed label, or the dot of another visible part? */
  function overlaps(l, t, w, h, self) {
    if (overlapsLabels(l, t, w, h)) return true;
    for (const o of items) {
      if (o === self || !o.vis || o.a < 0.3) continue;
      if (o.sx > l - 8 && o.sx < l + w + 8 && o.sy > t - 6 && o.sy < t + h + 6) return true;
    }
    return false;
  }
  function overlapsLabels(l, t, w, h) {
    for (const o of placed) {
      if (l < o.lx + o.lw + LBL_PAD && l + w + LBL_PAD > o.lx && t < o.ly + LBL_H + 2 && t + h + 2 > o.ly) return true;
    }
    return false;
  }

  // ---------------------------------------------------------------- picking
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  /** userData of the first mesh under a client point that counts as a hit, or null. */
  function hitAt(cx, cy) {
    const rc = canvas.getBoundingClientRect();
    if (!rc.width || !rc.height) return null;
    ndc.set(((cx - rc.left) / rc.width) * 2 - 1, -((cy - rc.top) / rc.height) * 2 + 1);
    world.scene.updateMatrixWorld();
    world.camera.updateMatrixWorld();
    ray.setFromCamera(ndc, world.camera);
    const targets = [];
    for (const r of Object.values(world.robots)) if (r.group.visible) targets.push(r.group);
    const lu = lineupMode();
    const hits = ray.intersectObjects(targets, true).filter((h) => {
      const u = h.object.userData;
      if (lu) return !!u.cls;
      return u.partId && u.cls === S.active && hasPart(u.cls, u.partId) && !(S.xray && u.casing);
    });
    return hits.length ? hits[0].object.userData : null;
  }
  function doRay() {
    if (!ptr.inside || ptr.type === 'touch' || dragging || !interactive) return;
    if (ptr.onHs) {
      // the pointer rests on a hotspot that may since have moved away (inertia) or turned to the back
      const it = ptrHover !== null ? byId.get(ptrHover) : null;
      if (it && it.vis) {
        const rc = canvas.getBoundingClientRect();
        if (Math.abs(rc.left + it.sx - ptr.x) <= 12 && Math.abs(rc.top + it.sy - ptr.y) <= 12) return;
      }
      ptr.onHs = false;
    }
    const u = hitAt(ptr.x, ptr.y);
    if (lineupMode()) {
      const c = u ? u.cls : null;
      if (c !== lineupHover) { lineupHover = c; refreshHot(); }
    } else {
      const id = u ? u.partId : null;
      if (id !== ptrHover) { ptrHover = id; refreshHot(); }
    }
  }
  function pickAt(cx, cy) {
    const u = hitAt(cx, cy);
    if (!u) return;
    if (lineupMode()) fire(options.onClassPick, u.cls);
    else fire(options.onSelect, u.partId, S.active);
  }

  // ---------------------------------------------------------------- input
  function cancelTween() { if (tween) { const r = tween.res; tween = null; r(); } }
  function endHover() {
    ptr.inside = false; ptr.onHs = false;
    if (ptrHover !== null || lineupHover !== null) { ptrHover = null; lineupHover = null; refreshHot(); }
  }
  function track(e) {
    ptr.x = e.clientX; ptr.y = e.clientY; ptr.type = e.pointerType || 'mouse';
  }
  function onPointerEnter(e) {
    if (!interactive || e.pointerType === 'touch') return;
    track(e); ptr.inside = true; hoverIn = true;
  }
  function onPointerLeave(e) {
    if (e.pointerType === 'touch') return;
    if (hoverIn) { hoverIn = false; resumeAt = now0() + HOVER_RESUME; }
    endHover();
  }
  function onPointerMove(e) {
    if (!interactive) return;
    track(e);
    if (e.pointerType !== 'touch') {
      // a pointer that moves over the stage is on it, even if the enter event was missed (the stage was hidden under it)
      if (!hoverIn) { hoverIn = true; }
      ptr.inside = true;
      const hs = !dragging && e.target.closest ? e.target.closest('.v3d-hs:not(.is-back)') : null;
      ptr.onHs = !!hs;
      if (hs) {
        if (ptrHover !== hs.dataset.part) { ptrHover = hs.dataset.part; refreshHot(); }
      } else if (!dragging) {
        const cp = e.target.closest ? e.target.closest('.v3d-cp') : null;
        if (cp) { if (lineupHover !== cp.dataset.cls) { lineupHover = cp.dataset.cls; refreshHot(); } }
        else rayDirty = true;                  // the ray in the next frame resolves what is under the pointer
      }
    }
    if (drag && e.pointerId === drag.id) {
      if (drag.ignore) return;
      if (!drag.moved) {
        const mx = e.clientX - drag.x0, my = e.clientY - drag.y0;
        if (Math.hypot(mx, my) <= DRAG_PX) return;
        // a mostly vertical touch is the page scrolling, not a rotation
        if (drag.type === 'touch' && Math.abs(my) > Math.abs(mx)) { drag.ignore = true; suppressClick = true; return; }
        drag.moved = true; suppressClick = true;
        cancelTween(); vel = 0; dragging = true;
        drag.lx = e.clientX; drag.lt = e.timeStamp; drag.vel = 0;
        try { root.setPointerCapture(e.pointerId); } catch (err) { /* pointer already gone */ }
        root.classList.add('is-dragging');
        if (ptrHover !== null || lineupHover !== null) { ptrHover = null; lineupHover = null; refreshHot(); } else refreshCursor();
        return;
      }
      const dx = e.clientX - drag.lx, dt = (e.timeStamp - drag.lt) / 1000;
      yaw += dx * RAD_PER_PX;
      if (dt > 0.001) drag.vel = drag.vel * 0.5 + (dx * RAD_PER_PX / dt) * 0.5;
      else if (dx) drag.vel *= 0.5;
      drag.lx = e.clientX; drag.lt = e.timeStamp; drag.moveAt = e.timeStamp;
      invalidate();
    }
  }
  function onPointerDown(e) {
    if (!interactive || !e.isPrimary) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    suppressClick = false;
    clearTimeout(suppressTimer);
    track(e);
    if (e.pointerType === 'touch') { touching = true; ptr.inside = false; } else { ptr.inside = true; hoverIn = true; }
    drag = { id: e.pointerId, x0: e.clientX, y0: e.clientY, lx: e.clientX, lt: e.timeStamp, vel: 0, moved: false, moveAt: 0, onHs: !!(e.target.closest && e.target.closest('.v3d-hs, .v3d-cp')), type: e.pointerType };
    vel = 0;                                   // grabbing the robot stops any inertia
  }
  function endDrag(e, cancelled) {
    if (!drag || (e && e.pointerId !== drag.id)) return;
    const d = drag; drag = null;
    if (d.type === 'touch') { touching = false; resumeAt = now0() + TOUCH_RESUME; }
    if (d.moved) {
      dragging = false;
      root.classList.remove('is-dragging');
      try { root.releasePointerCapture(d.id); } catch (err) { /* released already */ }
      const fresh = e && d.moveAt && e.timeStamp - d.moveAt < 90;
      vel = reduced || cancelled || !fresh ? 0 : clamp(d.vel, -MAX_VEL, MAX_VEL);
      // the click that follows a drag is swallowed; keyboard clicks (detail 0) are never affected
      clearTimeout(suppressTimer);
      suppressTimer = setTimeout(() => { suppressClick = false; }, 60);
      refreshCursor();
    } else if (d.ignore) {
      clearTimeout(suppressTimer);
      suppressTimer = setTimeout(() => { suppressClick = false; }, 60);
    } else if (!cancelled && e && !d.onHs && e.target === canvas && e.isPrimary) {
      pickAt(e.clientX, e.clientY);
    }
  }
  const onPointerUp = (e) => endDrag(e, false);
  const onPointerCancel = (e) => endDrag(e, true);
  function onLayerClick(e) {
    const b = e.target.closest && e.target.closest('.v3d-hs, .v3d-cp');
    if (!b || !layer.contains(b) || !interactive) return;
    if (suppressClick && e.detail !== 0) { suppressClick = false; e.preventDefault(); return; }
    if (b.classList.contains('v3d-cp')) fire(options.onClassPick, b.dataset.cls);
    else fire(options.onSelect, b.dataset.part, S.active);
  }
  function onFocusIn(e) {
    const b = e.target.closest && e.target.closest('.v3d-hs, .v3d-cp');
    if (!b || !interactive) return;
    focusIn = true;
    let kb = false;
    try { kb = b.matches(':focus-visible'); } catch (err) { kb = false; }
    if (!kb) return;
    if (b.classList.contains('v3d-cp')) { lineupHover = b.dataset.cls; refreshHot(); return; }
    focusHover = b.dataset.part; refreshHot();
    // a part on the far side is invisible: turn it to the front so the keyboard user can see what has focus
    const it = byId.get(b.dataset.part);
    if (it && it.a <= 0 && !it.inside) spinToPart(it.id, 600);
  }
  function onFocusOut(e) {
    const to = e.relatedTarget;
    if (to && layer.contains(to)) return;
    focusIn = false; resumeAt = now0() + HOVER_RESUME;
    if (focusHover !== null) { focusHover = null; refreshHot(); }
    if (lineupHover !== null && !ptr.inside) { lineupHover = null; refreshHot(); }
  }
  on(root, 'pointerenter', onPointerEnter);
  on(root, 'pointerleave', onPointerLeave);
  on(root, 'pointermove', onPointerMove);
  on(root, 'pointerdown', onPointerDown);
  on(root, 'pointerup', onPointerUp);
  on(root, 'pointercancel', onPointerCancel);
  on(layer, 'click', onLayerClick);
  on(layer, 'focusin', onFocusIn);
  on(layer, 'focusout', onFocusOut);
  on(root, 'dragstart', (e) => e.preventDefault());
  // a lost context wipes the prefiltered environment map: rebuild it or the robot comes back dark and flat
  on(canvas, 'webglcontextrestored', () => { if (destroyed) return; world.rebuildEnvironment(); dirty = true; updateRun(); });

  // ---------------------------------------------------------------- motion
  function startTween(to, dur) {
    cancelTween();
    return new Promise((res) => { tween = { from: yaw, to, t: 0, dur: Math.max(0.05, dur / 1000), res }; vel = 0; turn = 0; });
  }
  function spinTo(to, dur) {
    if (reduced || !canRun()) { cancelTween(); yaw = to; resumeAt = now0() + SPIN_HOLD; applyYaw(); return Promise.resolve(); }
    return startTween(to, dur);
  }
  function spinToPart(partId, dur) {
    const r = world.robots[S.active];
    const a = r && hasPart(S.active, partId) && r.anchors[partId];
    if (!a || lineupMode()) return Promise.resolve();
    const { x: ax, z: az } = a.pos;
    if (Math.hypot(ax, az) < 1e-4) return Promise.resolve();
    // robot yaw t puts local (ax, az) at world x = ax cos t + az sin t, z = -ax sin t + az cos t: x = 0 and z > 0 for t = atan2(-ax, az)
    const target = yaw + wrapPi(Math.atan2(-ax, az) - yaw);
    return spinTo(target, dur);
  }

  function applyYaw() {
    for (const r of Object.values(world.robots)) r.group.rotation.y = yaw;
    appliedYaw = yaw; invalidate();
  }
  function frame(now, dt) {
    if (offAnim) {
      offAnim.t += dt;
      const k = Math.min(1, offAnim.t / (OFFSET_MS / 1000));
      S.offsetX = offAnim.from + (offAnim.to - offAnim.from) * ease(k);
      if (k >= 1) { S.offsetX = offAnim.to; offAnim = null; }
      frameCamera();
    }
    if (tween) {
      tween.t += dt;
      const k = Math.min(1, tween.t / tween.dur);
      yaw = tween.from + (tween.to - tween.from) * ease(k);
      if (k >= 1) { const r = tween.res; tween = null; resumeAt = now + SPIN_HOLD; r(); }
    } else if (!dragging) {
      if (Math.abs(vel) > 0.01) { yaw += vel * dt; vel *= Math.exp(-dt / INERTIA_TAU); } else vel = 0;
      const run = !reduced && !hoverIn && !touching && !focusIn && now >= resumeAt;
      const target = run ? SPEED : 0;
      turn += (target - turn) * (1 - Math.exp(-dt / (target > turn ? 0.35 : 0.08)));
      if (target === 0 && Math.abs(turn) < 1e-4) turn = 0;
      yaw += turn * dt;
    }
    if (yaw !== appliedYaw) { applyYaw(); if (ptr.inside) rayDirty = true; }
    if (rayDirty) { rayDirty = false; doRay(); }
    if (pulse.length && !reduced && !lineupMode()) {
      const k = 0.25 + 0.25 * Math.sin(now / 1000 * 5);
      for (const m of pulse) m.material.emissiveIntensity = k;
      dirty = true;
    }
    if (dirty && !simulating) { world.render(); dirty = false; root.dataset.ready = 'true'; }
    if (layoutDirty && !simulating) { layoutHotspots(); layoutDirty = false; }
  }

  // ---------------------------------------------------------------- loop, visibility, lifecycle
  const canRun = () => !destroyed && inView && !document.hidden && !userPaused && S.W > 0 && S.H > 0;
  function tick(now) {
    rafId = 0;
    if (!canRun()) return;
    rafId = requestAnimationFrame(tick);
    const dt = Math.min(0.1, Math.max(0, (now - lastT) / 1000));
    lastT = now;
    frame(now + simOffset, dt);
  }
  function updateRun() {
    if (destroyed) return;
    const run = canRun();
    root.classList.toggle('is-paused', !run);
    if (run) {
      if (!rafId) { lastT = performance.now(); dirty = true; layoutDirty = true; rafId = requestAnimationFrame(tick); }
    } else if (rafId) { cancelAnimationFrame(rafId); rafId = 0; }
  }
  const ro = new ResizeObserver(() => { if (!roRaf) roRaf = requestAnimationFrame(() => { roRaf = 0; resize(); }); });
  ro.observe(root);
  let io = null;
  if (typeof IntersectionObserver !== 'undefined') {
    io = new IntersectionObserver((entries) => { inView = entries[entries.length - 1].isIntersecting; updateRun(); });
    io.observe(root);
  }
  on(document, 'visibilitychange', () => { if (document.hidden) transientReset(); updateRun(); });
  const stopDpr = watchPixelRatio(() => {
    if (destroyed || !(S.W > 0 && S.H > 0)) return;
    world.setSize(S.W, S.H);
    dirty = true; updateRun();
  });
  // the web font arrives after the first measurement: the label advance is read again
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { if (!destroyed) { measureLabel(); layoutDirty = true; } }).catch(() => {});
  const onMq = () => {
    reduced = !!mq.matches;
    if (reduced) { cancelTween(); yaw = POSE; vel = 0; turn = 0; }
    applyPulse(); invalidate(); updateRun();
  };
  if (mq) { if (mq.addEventListener) mq.addEventListener('change', onMq); else if (mq.addListener) mq.addListener(onMq); }

  /** Forget pointer state that can no longer be true (the stage was hidden under the pointer, the tab was left). */
  function transientReset() {
    hoverIn = touching = focusIn = false;
    if (dragging) { dragging = false; root.classList.remove('is-dragging'); }
    drag = null; vel = 0;
    ptr.inside = false; ptr.onHs = false;
    if (ptrHover !== null || lineupHover !== null || focusHover !== null) { ptrHover = null; lineupHover = null; focusHover = null; refreshHot(); }
  }

  function setSize(sz) {
    if (!SIZES.includes(sz)) return;
    S.size = sz;
    if (ORDER.includes(sz)) S.active = sz;
    root.dataset.size = sz; root.dataset.active = S.active;
    ptrHover = focusHover = lineupHover = null;
    reportedHover = null;                  // setSize tells the host nothing: the old hover is simply dropped
    placeRobots();
    buildHotspots();
    frameCamera();
    refreshHot();
    updateRun();
  }

  S.size = initSize;
  root.dataset.size = S.size; root.dataset.active = S.active; root.dataset.compact = 'false';
  S.W = root.clientWidth; S.H = root.clientHeight;
  if (reduced) yaw = POSE;
  placeRobots();
  buildHotspots();
  resize();
  updateRun();

  // ---------------------------------------------------------------- public API
  const viewer = {
    root, canvas,
    setSize(size) { if (!destroyed) setSize(size); },
    setOffsetX(x) {
      if (destroyed) return;
      const to = clamp(Number(x) || 0, -0.45, 0.45);
      if (reduced || !canRun()) { offAnim = null; S.offsetX = to; frameCamera(); return; }
      offAnim = { from: S.offsetX, to, t: 0 };
    },
    setXray(on) {
      if (destroyed) return;
      S.xray = !!on;
      root.dataset.xray = String(S.xray);
      for (const r of Object.values(world.robots)) applyXray(r, S.xray);
      for (const it of items) if (it.inside) it.el.hidden = !S.xray;
      if (!S.xray && ((focusHover && byId.get(focusHover) && byId.get(focusHover).inside) || (ptrHover && byId.get(ptrHover) && byId.get(ptrHover).inside))) { ptrHover = focusHover = null; refreshHot(); }
      invalidate(); rayDirty = ptr.inside;
    },
    spinTo(partId, opts = {}) {
      if (destroyed) return Promise.resolve();
      const d = Number(opts && opts.duration);
      return spinToPart(partId, Number.isFinite(d) ? d : 700);
    },
    spinBy(radians, opts = {}) {
      if (destroyed || !Number.isFinite(Number(radians))) return Promise.resolve();
      const d = Number(opts && opts.duration);
      return spinTo(yaw + Number(radians), Number.isFinite(d) ? d : 900);
    },
    highlight(partId) {
      if (destroyed) return;
      extHot = partId && hasPart(S.active, partId) ? partId : null;
      refreshHot();
    },
    setInteractive(flag) {
      if (destroyed) return;
      interactive = !!flag;
      root.classList.toggle('is-static', !interactive);
      if (interactive) layer.removeAttribute('aria-hidden'); else layer.setAttribute('aria-hidden', 'true');
      for (const el of layer.children) { if (interactive) el.removeAttribute('tabindex'); else el.tabIndex = -1; }
      if (!interactive) {
        if (document.activeElement && layer.contains(document.activeElement)) document.activeElement.blur();
        endDragForced(); transientReset();
      }
      refreshCursor();
    },
    getState() {
      return { size: S.size, active: S.active, mode: S.mode, xray: S.xray, yaw: wrapPi(yaw), hovered: lineupMode() ? null : hoverId() };
    },
    resize() { if (!destroyed) resize(); },
    pause() { if (destroyed) return; userPaused = true; transientReset(); updateRun(); },
    resume() { if (destroyed) return; userPaused = false; resumeAt = 0; updateRun(); },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      cancelTween();
      if (rafId) cancelAnimationFrame(rafId);
      if (roRaf) cancelAnimationFrame(roRaf);
      rafId = roRaf = 0;
      clearTimeout(suppressTimer);
      ro.disconnect(); if (io) io.disconnect();
      for (const off of offs) off();
      offs.length = 0;
      stopDpr();
      if (mq) { if (mq.removeEventListener) mq.removeEventListener('change', onMq); else if (mq.removeListener) mq.removeListener(onMq); }
      try { if (drag) root.releasePointerCapture(drag.id); } catch (err) { /* gone */ }
      world.dispose();
      colors.dispose();
      root.replaceChildren();
      addedClasses.forEach((c) => root.classList.remove(c));
      root.classList.remove('is-dragging', 'is-paused', 'is-static');
      for (const k of ['size', 'active', 'compact', 'xray', 'ready']) delete root.dataset[k];
      items = []; byId.clear(); captions = []; pulse.length = 0;
      viewer.debug = null;
      viewer.canvas = null;
      world = null;
    },
  };
  function endDragForced() {
    if (!drag) return;
    const d = drag; drag = null;
    if (d.moved) { dragging = false; root.classList.remove('is-dragging'); try { root.releasePointerCapture(d.id); } catch (err) { /* gone */ } }
    touching = false;
  }

  if (options.debug) {
    const proj = (partId) => {
      const r = world.robots[S.active], a = r && r.anchors[partId];
      if (!a) return null;
      r.group.updateMatrixWorld(true); world.camera.updateMatrixWorld();
      const p = a.pos.clone().applyMatrix4(r.group.matrixWorld).project(world.camera);
      const rc = canvas.getBoundingClientRect();
      return { x: rc.left + (p.x + 1) / 2 * rc.width, y: rc.top + (1 - p.y) / 2 * rc.height, z: p.z };
    };
    viewer.debug = {
      get renderer() { return world && world.renderer; }, get scene() { return world && world.scene; }, get camera() { return world && world.camera; },
      get robots() { return world && world.robots; }, state: S, model,
      get yaw() { return yaw; }, get items() { return items; },
      holds: () => ({ hoverIn, dragging, touching, focusIn, tween: !!tween, vel, turn, wait: resumeAt - performance.now(), reduced }),
      project: proj,
      /** Client-pixel centre of a part's first mesh (for click tests). */
      partPoint(partId, cls = S.active) {
        const r = world.robots[cls]; const m = r && r.parts[partId] && r.parts[partId][0];
        if (!m) return null;
        world.scene.updateMatrixWorld();
        const c = new THREE.Box3().setFromObject(m).getCenter(new THREE.Vector3()).project(world.camera);
        const rc = canvas.getBoundingClientRect();
        return { x: rc.left + (c.x + 1) / 2 * rc.width, y: rc.top + (1 - c.y) / 2 * rc.height };
      },
      renderNow() { dirty = true; layoutDirty = true; frame(performance.now(), 0); world.render(); },
      /** Run `sec` seconds of the loop at 60 fps without waiting for animation frames (the clock starts now). */
      advance(sec) { simulating = true; for (let i = 0, n = Math.round(sec * 60); i < n; i++) { simOffset += 1000 / 60; frame(performance.now() + simOffset, 1 / 60); } simulating = false; dirty = layoutDirty = true; },
    };
  }
  return viewer;
}
