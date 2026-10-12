// Part labels with leader lines. Ported from the original viewer: labels sit in two columns beside the model,
// are sorted by screen height, spread apart so they never overlap, and connected to the part by a polyline.
// The per-frame path avoids allocations: item objects, arrays and SVG nodes are created once and reused.
import * as THREE from 'three';
import { PARTS } from '../data/planner-parts.js';
import { CLASSES } from '../data/classes.js';
import { partFor, hasPart, shortName, keySpec, esc } from './planner-model.js';

const SVGNS = 'http://www.w3.org/2000/svg';
const vA = new THREE.Vector3(), vB = new THREE.Vector3(), camPos = new THREE.Vector3();
const byY = (a, b) => a.sy - b.sy;
const F_BACK = 1, F_SEL = 2, F_INSIDE = 4;

export function createLabels({ labelsEl, svg, onPick }) {
  const items = PARTS.map((p0) => {
    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'v3d-lbl';
    el.dataset.id = p0.id;
    el.hidden = true;
    labelsEl.appendChild(el);
    const line = document.createElementNS(SVGNS, 'polyline');
    line.setAttribute('class', 'v3d-lead'); line.setAttribute('fill', 'none');
    line.style.display = 'none';
    const dot = document.createElementNS(SVGNS, 'circle');
    dot.setAttribute('class', 'v3d-dot'); dot.setAttribute('r', '3');
    dot.style.display = 'none';
    svg.appendChild(line); svg.appendChild(dot);
    return {
      id: p0.id, p0, el, line, dot, p: p0, inClass: false, color: '#888', lkey: '', shown: false, w: 0,
      facing: null, sx: 0, sy: 0, y: 0, back: false, flags: -1, tx: NaN, ty: NaN, pts: '', cx: NaN, cy: NaN, sel: false, h: 0,
    };
  });
  const byId = Object.fromEntries(items.map((it) => [it.id, it]));
  const active = [], left = [], right = [];

  const onClick = (e) => { const b = e.target.closest('.v3d-lbl'); if (b && labelsEl.contains(b)) onPick(b.dataset.id); };
  labelsEl.addEventListener('click', onClick);

  function hide(it) {
    if (!it.shown) return;
    it.shown = false;
    it.el.hidden = true;
    it.line.style.display = 'none';
    it.dot.style.display = 'none';
    it.tx = it.ty = it.cx = it.cy = NaN; it.flags = -1; it.pts = '';
  }
  function show(it) {
    if (it.shown) return;
    it.shown = true;
    it.el.hidden = false;
    it.line.style.display = '';
    it.dot.style.display = '';
  }

  /** Rebuild label text, titles and class-dependent bits when the active platform changes. */
  function refreshText(cls) {
    for (const it of items) {
      const p = partFor(it.id, cls);
      const ks = keySpec(p, cls);
      it.p = p;
      it.inClass = hasPart(cls, it.id);
      it.el.innerHTML = `<span class="v3d-sw"></span><span class="v3d-nm">${esc(shortName(p))}</span>${ks ? `<span class="v3d-ks">· ${esc(ks)}</span>` : ''}`;
      it.el.title = `${p.title} · click for details`;
      it.el.classList.toggle('is-inside', !!p.inside);
      it.w = it.h = 0;
    }
  }
  /** Refresh swatch colors and legend keys after a mode, platform or plan change. */
  function refreshMeta(cls, modeColor, legendKey) {
    for (const it of items) {
      if (!it.inClass) continue;
      it.color = modeColor(it.p, cls);
      it.lkey = legendKey(it.p, cls);
      it.el.firstChild.style.background = it.color;
      it.dot.style.fill = it.color;
    }
  }
  function resetWidths() { for (const it of items) it.w = it.h = 0; }
  function setSelected(id) {
    for (const it of items) {
      const on = it.id === id;
      it.el.classList.toggle('is-sel', on);      // applied now so the width is measured with the selected styling
      if (on) it.el.setAttribute('aria-current', 'true'); else it.el.removeAttribute('aria-current');
      it.w = it.h = 0;
    }
  }
  function hideAll() { for (const it of items) hide(it); }

  const stateVisible = (it, S) => {
    if (S.density === 'none' || S.size === 'lineup' || (S.size === 'both' && S.phone)) return S.selected === it.id;
    if ((S.density === 'key' || (S.density === 'all' && S.size === 'both')) && !it.p.key && S.selected !== it.id) return false;
    return !S.hidden.has(it.lkey);
  };
  // Width and height are measured once per label (and again after a reset). layout() measures every label it will place
  // before it writes any transform, so a rendered frame costs no forced style recalc or layout per label.
  const measure = (it) => {
    if (!it.w) { it.w = it.el.offsetWidth || 120; it.h = it.el.offsetHeight || 22; }
    return it.w;
  };

  /**
   * S: { active, size, selected, density, hidden:Set, W, H, phone, multi, chipH }
   * robot: the active platform's robot (group + anchors)
   */
  function layout(S, camera, robot) {
    if (!robot || !S.W || !S.H) { hideAll(); return; }
    const W = S.W, H = S.H, mob = S.phone, C = CLASSES[S.active];
    robot.group.updateMatrixWorld();
    camera.getWorldPosition(camPos);
    const topPad = 14;
    const botPad = mob && S.chipH ? S.chipH + 18 : 14;
    const gap = mob ? 26 : 25;     // phone chips are 24px tall; keep them from touching

    active.length = 0; left.length = 0; right.length = 0;
    for (const it of items) {
      const a = robot.anchors[it.id];
      if (!a || !it.inClass || !stateVisible(it, S)) { hide(it); continue; }
      vA.copy(a.pos).applyMatrix4(robot.group.matrixWorld);
      it.facing = a.normal ? a.normal.dot(vB.copy(camPos).sub(vA).normalize()) : null;
      vB.copy(vA).project(camera);
      if (vB.z > 1) { hide(it); continue; }
      show(it);
      it.sx = (vB.x + 1) / 2 * W; it.sy = (1 - vB.y) / 2 * H;
      it.sel = S.selected === it.id;
      it.back = it.facing !== null && it.facing < -0.05;
      active.push(it);
    }
    // model screen center and half width
    vA.set(0, C.centerY / C.scale, 0).applyMatrix4(robot.group.matrixWorld).project(camera);
    const cx = (vA.x + 1) / 2 * W;
    let half = 40;
    for (const it of active) half = Math.max(half, Math.abs(it.sx - cx));
    // side by side: one column on the outer side of the active robot, so labels never cover the other robot
    const outer = S.size === 'both' ? (S.active === 'full' ? left : right) : null;
    for (const it of active) (outer || (it.sx < cx ? left : right)).push(it);

    // back-facing labels: hidden on phones, capped per side on desktop
    const backCap = C.kind === 'quad' ? 1 : 2;
    const capBack = (arr) => {
      let n = 0, w = 0;
      for (let i = 0; i < arr.length; i++) {
        const it = arr[i];
        if (it.back && !it.sel) { n++; if (mob || n > backCap) { hide(it); continue; } }
        arr[w++] = it;
      }
      arr.length = w;
    };
    capBack(left); capBack(right);
    const rebalance = (from, to) => {
      while (from.length > to.length + 3) {
        from.sort((a, b) => Math.abs(a.sx - cx) - Math.abs(b.sx - cx));
        to.push(from.shift());
      }
    };
    if (!S.multi) { rebalance(left, right); rebalance(right, left); }

    let maxL = 0, maxR = 0;
    for (const it of left) maxL = Math.max(maxL, measure(it));
    for (const it of right) maxR = Math.max(maxR, measure(it));
    let Lx = cx - half - (mob ? 14 : 34);
    let Rx = cx + half + (mob ? 14 : 34);
    Lx = Math.max(Lx, Math.min(maxL + 8, cx - 20));
    Rx = Math.min(Rx, Math.max(W - maxR - 8, cx + 20));
    if (S.multi) {
      // keep labels between the edges of the viewer and away from the other robot
      if (S.active === 'full') Lx = Math.max(maxL + 8, Lx); else Rx = Math.min(W - maxR - 8, Rx);
    }
    const place = (arr) => {
      arr.sort(byY);
      const n = arr.length; if (!n) return;
      const avail = H - topPad - botPad;
      const g = Math.min(gap, n > 1 ? avail / (n - 1) : gap);
      for (let i = 0; i < n; i++) arr[i].y = Math.max(arr[i].sy, i ? arr[i - 1].y + g : topPad);
      if (arr[n - 1].y > H - botPad) {
        arr[n - 1].y = H - botPad;
        for (let i = n - 2; i >= 0; i--) arr[i].y = Math.min(arr[i].y, arr[i + 1].y - g);
      }
      for (const it of arr) it.y = Math.max(topPad, it.y);
    };
    place(left); place(right);

    const draw = (it, side) => {
      const w = it.w, h = it.h;
      let x = side < 0 ? Lx - w : Rx;
      x = Math.max(4, Math.min(W - w - 4, x));
      const edge = side < 0 ? Lx : Rx;
      const tx = Math.round(x * 10) / 10, ty = Math.round((it.y - h / 2) * 10) / 10;
      if (tx !== it.tx || ty !== it.ty) { it.tx = tx; it.ty = ty; it.el.style.transform = `translate(${tx}px, ${ty}px)`; }
      const flags = (it.back && !it.sel ? F_BACK : 0) | (it.sel ? F_SEL : 0) | (it.facing === null ? F_INSIDE : 0);
      if (flags !== it.flags) {
        it.flags = flags;
        const back = !!(flags & F_BACK), sel = !!(flags & F_SEL), inside = !!(flags & F_INSIDE);
        it.el.classList.toggle('is-back', back); it.el.classList.toggle('is-sel', sel);
        it.line.classList.toggle('is-back', back); it.line.classList.toggle('is-sel', sel); it.line.classList.toggle('is-inside', inside);
        it.dot.classList.toggle('is-sel', sel); it.dot.classList.toggle('is-back', back);
        it.dot.setAttribute('r', sel ? '4.5' : '3');
      }
      const ex = edge + (side < 0 ? 2 : -2), kx = edge + (side < 0 ? 16 : -16);
      const sx = Math.round(it.sx * 10) / 10, sy = Math.round(it.sy * 10) / 10, yy = Math.round(it.y * 10) / 10;
      const pts = sx + ',' + sy + ' ' + (Math.round(kx * 10) / 10) + ',' + yy + ' ' + (Math.round(ex * 10) / 10) + ',' + yy;
      if (pts !== it.pts) { it.pts = pts; it.line.setAttribute('points', pts); }
      if (sx !== it.cx || sy !== it.cy) { it.cx = sx; it.cy = sy; it.dot.setAttribute('cx', sx); it.dot.setAttribute('cy', sy); }
    };
    for (const it of left) draw(it, -1);
    for (const it of right) draw(it, 1);
  }

  return {
    items, byId, refreshText, refreshMeta, resetWidths, setSelected, layout, hideAll,
    dispose() {
      labelsEl.removeEventListener('click', onClick);
      for (const it of items) { it.line.remove(); it.dot.remove(); it.el.remove(); }
      items.length = 0; active.length = 0; left.length = 0; right.length = 0;
    },
  };
}
