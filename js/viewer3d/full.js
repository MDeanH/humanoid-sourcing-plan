// Full variant: toolbar, 3D stage with labels, side panel with details / live planner / parts list.
// Everything is created inside `root` and torn down by destroy(). No module-level state.
import * as THREE from 'three';
import { CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js';
import { SUBSYSTEMS, ORIGIN_REC } from '../data/planner-parts.js';
import { CLASSES, ORDER, LINEUP } from '../data/classes.js';
import { PRESETS } from '../data/bom.js';
import { createWorld } from './scene.js';
import { applyRobotColors, applyXray, recolorMesh, highlightMesh } from './coloring.js';
import { createCssColors } from './css-colors.js';
import { createLabels } from './labels.js';
import { createRig } from './camera-rig.js';
import { createPlanModel, esc, hasPart, partFor, partsFor, shortName, ORIGINS, O_NAME } from './planner-model.js';
import * as panel from './panel.js';
import { skeletonHtml } from './skeleton.js';

const SIZES = [...ORDER, 'both', 'lineup'];
const MODES = ['sub', 'origin', 'calc'];
const TABS = ['details', 'calc', 'parts'];
const VIEWS = ['reset', 'front', 'side', 'back'];
const AUTO_XRAY = ['jetson', 'cpu', 'imu', 'bms'];
const inLayout = (size, cls) => (LINEUP[size] ? cls in LINEUP[size] : cls === size);

export function createFullViewer(root, options = {}) {
  const uid = 'v3d-' + Math.random().toString(36).slice(2, 8);
  const addedClasses = ['v3d', 'v3d-full'].filter((c) => !root.classList.contains(c));
  addedClasses.forEach((c) => root.classList.add(c));
  const colors = createCssColors(root);
  const canvas = document.createElement('canvas');
  canvas.className = 'v3d-canvas';
  let world;
  try {
    world = createWorld({ canvas, ringColor: colors.read('--line-strong', '#2f3d5c') });
  } catch (err) {
    colors.dispose();
    addedClasses.forEach((c) => root.classList.remove(c));
    const e = new Error('WebGL is not available');
    e.code = 'NO_WEBGL'; e.cause = err;
    throw e;
  }

  // ---------------------------------------------------------------- DOM
  root.replaceChildren();
  root.insertAdjacentHTML('beforeend', skeletonHtml(uid));
  const slot = (n) => root.querySelector(`[data-slot="${n}"]`);
  const el = {
    stage: slot('stage'), leaders: slot('leaders'), labels: slot('labels'), loading: slot('loading'), scorebar: slot('scorebar'),
    legend: slot('legend'), active: slot('active'), side: slot('side'), details: slot('details'), result: slot('result'),
    presets: slot('presets'), presetNote: slot('presetNote'), levers: slot('levers'), rows: slot('rows'), total: slot('total'),
    calcClass: slot('calcClass'), search: slot('search'), partlist: slot('partlist'),
    chip: root.querySelector('.v3d-selchip'), toolbar: root.querySelector('.v3d-toolbar'), cue: root.querySelector('.v3d-scrollcue'),
    density: root.querySelector('[data-role="density"]'), rotate: root.querySelector('[data-v3d-act="rotate"]'),
    xray: root.querySelector('[data-v3d-act="xray"]'),
    sizeBtns: [...root.querySelectorAll('[data-size]')], modeBtns: [...root.querySelectorAll('[data-mode]')],
    viewBtns: [...root.querySelectorAll('[data-v3d-act="view"]')], tabs: [...root.querySelectorAll('[data-tab]')],
    panels: [...root.querySelectorAll('[data-panel]')],
  };
  slot('canvas-host').replaceWith(canvas);
  canvas.tabIndex = 0;
  canvas.setAttribute('role', 'img');
  const css2d = new CSS2DRenderer();
  css2d.domElement.className = 'v3d-css2d';
  el.stage.insertBefore(css2d.domElement, el.leaders);

  // ---------------------------------------------------------------- state
  const model = createPlanModel(options.storagePrefix);
  const palette = { us: colors.read('--us', '#22c55e'), fx: colors.read('--cn', '#ef4444'), unk: colors.read('--v3d-unk', '#a855f7') };
  const S = {
    size: 'full', active: 'full', mode: 'sub', selected: null, density: 'all', hidden: new Set(), xray: false,
    W: 0, H: 0, phone: false, stack: false, multi: false, chipH: 0, scoreOpen: false, tab: 'details', view: 'reset',
  };
  const mq = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  let reduced = !!(mq && mq.matches);
  let destroyed = false, userPaused = false, inView = true, rafId = 0, roRaf = 0, lastT = 0;
  let dirty = true, layoutDirty = true, cssDirty = true, firstFrame = true;
  let down = null;
  let lastW = 0, lastH = 0;                            // last measured stage size (S.W / S.H are 0 while hidden)
  let densityInit = false, densityTouched = false;     // label density default follows the first real measurement
  const pulse = [];
  const timers = new Set();
  const offs = [];
  const cbOnSelect = typeof options.onSelect === 'function' ? options.onSelect : null;
  const cbOnClass = typeof options.onClassChange === 'function' ? options.onClassChange : null;
  const on = (t, type, fn, opt) => { t.addEventListener(type, fn, opt); offs.push(() => t.removeEventListener(type, fn, opt)); };
  const later = (fn, ms) => { const id = setTimeout(() => { timers.delete(id); fn(); }, ms); timers.add(id); };
  const fire = (fn, ...a) => { if (!fn) return; try { fn(...a); } catch (e) { console.error(e); } };

  const rig = createRig({
    canvas, stage: el.stage, camera: world.camera, frame: S,
    hooks: {
      onUserMove: () => { S.view = 'reset'; el.viewBtns.forEach((b) => b.setAttribute('aria-pressed', 'false')); invalidate(); },
      /** World-space boxes of the robots on stage: the lineup camera is fitted to them (feet, dock and all). */
      getBounds: () => {
        world.scene.updateMatrixWorld(true);
        const out = [];
        for (const r of Object.values(world.robots)) if (r.group.visible) out.push(new THREE.Box3().setFromObject(r.group));
        return out;
      },
    },
  });
  rig.setReduced(reduced);
  rig.controls.addEventListener('change', () => { layoutDirty = true; });

  const labels = createLabels({ labelsEl: el.labels, svg: el.leaders, onPick: (id) => select(id) });

  const modeColor = (p, cls) => (S.mode === 'origin' ? ORIGIN_REC[p.rec].color : S.mode === 'calc' ? palette[model.originOf(p, cls)] : SUBSYSTEMS[p.sub].color);
  const legendKey = (p, cls) => (S.mode === 'origin' ? 'o:' + p.rec : S.mode === 'calc' ? 'c:' + model.originOf(p, cls) : 's:' + p.sub);
  const invalidate = () => { dirty = true; layoutDirty = true; };
  const activeRobot = () => world.robots[S.active];

  // keep keyboard focus on the equivalent control after a panel re-render
  function keepFocus(fn) {
    const a = document.activeElement;
    let scope = null, sel = null;
    if (a && a !== document.body && root.contains(a) && a.dataset && a.dataset.v3dAct) {
      const d = a.dataset;
      scope = a.closest('.v3d-tabpanel, .v3d-scorebar, .v3d-stagefoot');
      sel = `[data-v3d-act="${d.v3dAct}"]` + (d.k ? `[data-k="${CSS.escape(d.k)}"]` : '') + (d.v ? `[data-v="${d.v}"]` : '')
        + (d.step ? `[data-step="${d.step}"]` : '') + (d.id ? `[data-id="${CSS.escape(d.id)}"]` : '') + (d.i ? `[data-i="${d.i}"]` : '') + (d.cls ? `[data-cls="${d.cls}"]` : '');
    }
    fn();
    if (scope && sel) { const n = scope.querySelector(sel); if (n && n !== document.activeElement) n.focus({ preventScroll: true }); }
  }

  // When the control that had focus is replaced or hidden and keepFocus found no equivalent (Start, a lever that just turned US,
  // a pick in the parts list that switches tabs), put focus on a sensible target instead of letting it drop to <body>.
  const focusedInRoot = () => { const a = document.activeElement; return a && a !== document.body && root.contains(a) ? a : null; };
  function focusLost() {
    const a = document.activeElement;
    return !a || a === document.body || !root.contains(a) || !!a.closest('[hidden]') || !a.isConnected;
  }
  function rescueFocus(had, target) {
    if (!had || !focusLost()) return;
    const n = typeof target === 'function' ? target() : target;
    if (n && n.focus) n.focus({ preventScroll: true });
  }

  // ---------------------------------------------------------------- rendering of panels
  function renderDetails() {
    keepFocus(() => {
      el.details.innerHTML = panel.detailsHtml({ model, cls: S.active, selected: S.selected, modeColor, extraDetail: typeof options.extraDetail === 'function' ? options.extraDetail : null });
    });
  }
  const legendItems = (mode) => {
    if (mode === 'origin') return Object.entries(ORIGIN_REC).map(([k, v]) => ['o:' + k, v.name, v.color]);
    if (mode === 'calc') return ORIGINS.map((o) => ['c:' + o, O_NAME[o], palette[o]]);
    return Object.entries(SUBSYSTEMS).map(([k, v]) => ['s:' + k, v.name, v.color]);
  };
  // The legend of every color mode is laid out in the same grid cell, and only the active one is visible and clickable.
  // The footer is then always as tall as the tallest legend, so the viewer does not change height when the mode changes.
  function renderLegend() {
    const html = MODES.map((m) => {
      const items = legendItems(m);
      if (m !== S.mode) return `<div class="v3d-legend-set is-ghost" aria-hidden="true">${items.map(([, n]) => `<span class="v3d-gi"><span class="v3d-sw"></span>${esc(n)}</span>`).join('')}</div>`;
      return `<div class="v3d-legend-set">${items.map(([k, n, c]) => `<button type="button" data-v3d-act="legend" data-k="${esc(k)}" aria-pressed="${!S.hidden.has(k)}" title="Show or hide these labels"><span class="v3d-sw" style="background:${esc(c)}"></span>${esc(n)}</button>`).join('')}</div>`;
    }).join('');
    keepFocus(() => { el.legend.innerHTML = html; });
  }
  function renderPartList() {
    if (S.tab !== 'parts') return;
    el.partlist.innerHTML = panel.partListHtml({ cls: S.active, selected: S.selected, modeColor }, (el.search.value || '').toLowerCase().trim());
  }
  function renderActive() {
    const lay = LINEUP[S.size];
    el.active.hidden = !lay;
    if (!lay) { el.active.innerHTML = ''; return; }
    keepFocus(() => { el.active.innerHTML = '<span>Inspect</span>' + Object.keys(lay).map((c) => `<button type="button" data-v3d-act="active" data-cls="${c}" aria-pressed="${c === S.active}" title="${esc(CLASSES[c].name)} · ${esc(CLASSES[c].short)}">${esc(CLASSES[c].btn)}</button>`).join(''); });
  }
  function renderScore(sc = model.score(S.active)) {
    const cls = S.active;
    keepFocus(() => {
      el.result.innerHTML = panel.resultHtml(sc);
      el.total.innerHTML = panel.totalHtml(sc);
      el.levers.innerHTML = panel.leversHtml(model, cls, sc);
      el.scorebar.innerHTML = panel.scorebarHtml(model, cls, sc, S.scoreOpen, uid);
    });
  }
  function renderPlanner() {
    const cls = S.active, sc = model.score(cls);
    el.calcClass.textContent = `${CLASSES[cls].name} (${CLASSES[cls].short})`;
    keepFocus(() => {
      el.presets.innerHTML = panel.presetsHtml(model, cls);
      el.presetNote.innerHTML = panel.presetNotesHtml();
      el.rows.innerHTML = panel.rowsHtml(sc);
    });
    renderScore(sc);
  }
  function updateRadios() {
    el.sizeBtns.forEach((b) => { const on = b.dataset.size === S.size; b.setAttribute('aria-checked', String(on)); b.tabIndex = on ? 0 : -1; });
    el.modeBtns.forEach((b) => { const on = b.dataset.mode === S.mode; b.setAttribute('aria-checked', String(on)); b.tabIndex = on ? 0 : -1; });
  }

  // ---------------------------------------------------------------- colors, x-ray, selection highlight
  const pulseLevel = () => (reduced ? 0.4 : 0.25);
  function rePulse() { for (const m of pulse) highlightMesh(m, pulseLevel()); }
  function applyColors() {
    for (const r of Object.values(world.robots)) {
      applyRobotColors(r, S.mode, (pid) => modeColor(partFor(pid, r.cls), r.cls));
      applyXray(r, S.xray);
    }
    rePulse();
  }
  function refreshColors() {
    applyColors();
    labels.refreshMeta(S.active, modeColor, legendKey);
    renderLegend();
    renderPartList();
    invalidate();
  }
  function setXray(on) {
    S.xray = !!on;
    el.xray.setAttribute('aria-pressed', String(S.xray));
    for (const r of Object.values(world.robots)) applyXray(r, S.xray);
    invalidate();
  }
  function clearPulse() {
    for (const m of pulse) recolorMesh(m, S.mode, modeColor(partFor(m.userData.partId, m.userData.cls), m.userData.cls));
    pulse.length = 0;
  }

  // ---------------------------------------------------------------- robots and sizes
  function ensureRobot(cls) {
    const fresh = !world.robots[cls];
    const r = world.ensureRobot(cls);
    if (fresh) {
      applyRobotColors(r, S.mode, (pid) => modeColor(partFor(pid, cls), cls));
      applyXray(r, S.xray);
      // sit the name tag just above the head instead of floating high over it
      r.tag.position.y = CLASSES[cls].viewH / CLASSES[cls].scale + 0.02;
      r.tag.center.set(0.5, 1);
      const te = r.tag.element, C = CLASSES[cls];
      // restructure the tag markup so each size mode can show as much as fits (name, height, stats)
      te.innerHTML = `<b>${esc(C.name)}</b> <span class="v3d-htag-h">${C.heightCm} cm</span><span class="v3d-htag-s"> \u00b7 ~${C.massKg} kg \u00b7 ${C.dof} DOF</span>`;
      te.setAttribute('role', 'button'); te.tabIndex = 0;
      te.title = `Inspect ${CLASSES[cls].name} (${CLASSES[cls].short})`;
      const pick = () => setSize(S.size, cls);
      on(te, 'click', pick);
      on(te, 'keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(); } });
    }
    return r;
  }
  function placeRobots() {
    const lay = LINEUP[S.size];
    for (const c of lay ? Object.keys(lay) : [S.size]) ensureRobot(c);
    for (const r of Object.values(world.robots)) {
      const vis = lay ? r.cls in lay : r.cls === S.size;
      r.group.visible = vis;
      r.group.position.x = lay && r.cls in lay ? lay[r.cls] : 0;
      r.tag.visible = !!lay && vis;
      r.tag.element.classList.toggle('on', r.cls === S.active);
    }
    tagW.clear();
    cssDirty = true;
  }
  function setSize(sz, activeCls, { initial = false } = {}) {
    if (!SIZES.includes(sz)) sz = 'full';
    const prevActive = S.active, prevSize = S.size, prevSel = S.selected;
    S.size = sz;
    S.multi = sz === 'both' || sz === 'lineup';
    S.active = activeCls && inLayout(sz, activeCls) ? activeCls
      : sz === 'both' ? (['full', 'compact'].includes(prevActive) ? prevActive : 'full')
        : sz === 'lineup' ? prevActive : sz;
    if (S.selected && !hasPart(S.active, S.selected)) S.selected = null;
    updateRadios();
    root.dataset.size = sz;
    root.dataset.active = S.active;
    placeRobots();
    labels.refreshText(S.active);
    labels.refreshMeta(S.active, modeColor, legendKey);
    canvas.setAttribute('aria-label', `Rotatable 3D model of the ${CLASSES[S.active].name.toLowerCase()} ${CLASSES[S.active].kind === 'quad' ? 'quadruped' : 'humanoid'} reference robot (${CLASSES[S.active].short})`);
    if (S.W) rig.goTo('reset', false);
    S.view = 'reset';
    el.viewBtns.forEach((b) => b.setAttribute('aria-pressed', 'false'));
    renderPlanner(); renderDetails(); renderPartList(); renderLegend(); renderActive();
    applySelection(S.selected, true);
    invalidate();
    if (!initial) {
      if (S.active !== prevActive || S.size !== prevSize) fire(cbOnClass, S.active, S.size);
      if (S.selected !== prevSel || S.active !== prevActive) fire(cbOnSelect, S.selected, S.active);
    }
  }
  function setMode(m) {
    if (!MODES.includes(m)) return;
    S.mode = m; S.hidden.clear();
    root.dataset.mode = m;
    updateRadios();
    refreshColors();
    renderDetails();
  }

  // ---------------------------------------------------------------- selection
  function applySelection(id, keepTab) {
    clearPulse();
    if (id) {
      for (const r of Object.values(world.robots)) {
        for (const m of r.parts[id] || []) { pulse.push(m); highlightMesh(m, pulseLevel()); }
        if (r.group.visible && partFor(id, r.cls).inside && !S.xray && AUTO_XRAY.includes(id)) setXray(true);
      }
    }
    labels.setSelected(id);
    renderDetails();
    renderPartList();
    if (id && !keepTab) showTab('details');
    if (id) {
      el.chip.hidden = false;
      el.chip.textContent = `${shortName(partFor(id, S.active))} · details`;
      S.chipH = el.chip.offsetHeight || 0;
    } else { el.chip.hidden = true; S.chipH = 0; }
    invalidate();
  }
  /** Internal selection: validates, updates the UI, and notifies the host when something changed. */
  function select(id, opts = {}) {
    if (destroyed) return;
    const prevSel = S.selected, prevCls = S.active;
    if (opts.classId && ORDER.includes(opts.classId) && opts.classId !== S.active) {
      if (inLayout(S.size, opts.classId)) setSize(S.size, opts.classId, { initial: true });
      else setSize(opts.classId, opts.classId, { initial: true });
      if (S.active !== prevCls) fire(cbOnClass, S.active, S.size);
    }
    if (id && !hasPart(S.active, id)) id = null;
    S.selected = id || null;
    applySelection(S.selected, !!opts.noTab);
    if (opts.tab && TABS.includes(opts.tab)) showTab(opts.tab);
    if (S.selected !== prevSel || S.active !== prevCls) fire(cbOnSelect, S.selected, S.active);
  }

  // ---------------------------------------------------------------- tabs and views
  function showTab(t) {
    if (!TABS.includes(t)) return;
    S.tab = t;
    el.tabs.forEach((b) => { const on = b.dataset.tab === t; b.setAttribute('aria-selected', String(on)); b.tabIndex = on ? 0 : -1; });
    el.panels.forEach((p) => { p.hidden = p.dataset.panel !== t; });
    if (t === 'parts') renderPartList();
  }
  function setView(which) {
    if (!VIEWS.includes(which)) which = 'reset';
    rig.autoRotate = false;
    el.rotate.setAttribute('aria-pressed', 'false');
    S.view = which;
    el.viewBtns.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.view === which && which !== 'reset')));
    rig.goTo(which, true);
    invalidate();
  }
  const scrollToSide = () => { if (S.stack || S.phone) el.side.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' }); };
  const openPlanner = () => { showTab('calc'); scrollToSide(); };

  // ---------------------------------------------------------------- plan edits
  function planChanged() {
    if (S.mode !== 'calc') setMode('calc'); else refreshColors();
    renderPlanner(); renderDetails();
  }
  function setOrigin(key, o) { model.setOrigin(S.active, key, o); planChanged(); }
  function downloadCsv() {
    const cls = S.active;
    const url = URL.createObjectURL(new Blob([model.csv(cls, CLASSES[cls])], { type: 'text/csv' }));
    const a = document.createElement('a');
    a.href = url; a.download = `humanoid-build-plan-${cls}.csv`; a.hidden = true;
    root.appendChild(a); a.click();
    later(() => { URL.revokeObjectURL(url); a.remove(); }, 500);
  }
  function onPlanInput(inp) {
    const cls = S.active, row = inp.closest('.v3d-prow');
    const raw = inp.value;
    model.setField(cls, row.dataset.id, inp.dataset.f, raw);
    // show what the model holds: a negative becomes 0, an absurdly large number becomes the maximum
    const held = model.planner[cls][row.dataset.id][inp.dataset.f];
    if (raw !== '' && parseFloat(raw) !== held) inp.value = String(held);
    const sc = model.score(cls);
    el.rows.querySelectorAll('.v3d-prow').forEach((rw) => {
      const r = sc.rows.find((x) => x.l.id === rw.dataset.id);
      rw.querySelector('[data-st]').textContent = r.st.toFixed(1);
      rw.querySelector('[data-sh]').textContent = (sc.tot ? r.st / sc.tot * 100 : 0).toFixed(1) + '%';
    });
    el.presets.querySelectorAll('button').forEach((b) => { b.querySelector('small').textContent = model.score(cls, model.presetOverride(cls, PRESETS[+b.dataset.i].tags)).pct.toFixed(0) + '%'; });
    renderScore(sc); renderDetails();
    labels.refreshMeta(S.active, modeColor, legendKey);
  }

  // ---------------------------------------------------------------- input: delegated clicks, keys, 3D picking
  function onRootClick(e) {
    const tgt = e.target;
    if (!tgt.closest || tgt.closest('.v3d-extra')) return;               // host-owned content: never ours
    const seg = tgt.closest('.v3d-seg button, .v3d-tabs button');
    if (seg && root.contains(seg)) {
      if (seg.dataset.size) setSize(seg.dataset.size);
      else if (seg.dataset.mode) setMode(seg.dataset.mode);
      else if (seg.dataset.tab) showTab(seg.dataset.tab);
      return;
    }
    const t = tgt.closest('[data-v3d-act]');
    if (!t || !root.contains(t)) return;
    const d = t.dataset;
    const had = focusedInRoot();
    const toDetails = () => el.details.querySelector('h2');
    switch (d.v3dAct) {
      case 'rotate': if (reduced) return; rig.autoRotate = !rig.autoRotate; t.setAttribute('aria-pressed', String(rig.autoRotate)); invalidate(); break;
      case 'xray': setXray(!S.xray); break;
      case 'view': setView(d.view); break;
      case 'legend': if (S.hidden.has(d.k)) S.hidden.delete(d.k); else S.hidden.add(d.k); renderLegend(); invalidate(); break;
      case 'active': setSize(S.size, d.cls); break;
      case 'chip': showTab('details'); scrollToSide(); break;
      case 'score': {
        S.scoreOpen = !S.scoreOpen;
        t.setAttribute('aria-expanded', String(S.scoreOpen));
        const more = el.scorebar.querySelector('.v3d-score-more'); if (more) more.hidden = !S.scoreOpen;
        break;
      }
      case 'edit': openPlanner(); break;
      case 'origin': setOrigin(d.k, d.v); break;
      case 'preset': model.applyPreset(S.active, +d.i); planChanged(); break;
      case 'lever': {
        const idx = [...el.levers.querySelectorAll('[data-v3d-act="lever"]')].indexOf(t);
        setOrigin(d.id, 'us');
        rescueFocus(had, () => { const b = el.levers.querySelectorAll('[data-v3d-act="lever"]'); return b[Math.min(idx, b.length - 1)] || el.levers.parentElement.querySelector('h4'); });
        break;
      }
      case 'csv': downloadCsv(); break;
      case 'reset': model.reset(S.active); refreshColors(); renderPlanner(); renderDetails(); break;
      case 'pick': select(d.id); rescueFocus(had, toDetails); break;
      case 'start': select(partsFor(S.active)[0].id); rescueFocus(had, toDetails); break;
      case 'step': {
        const list = partsFor(S.active).map((q) => q.id), i = list.indexOf(S.selected);
        select(list[(i + +d.step + list.length) % list.length]);
        break;
      }
      default: break;
    }
  }
  on(root, 'click', onRootClick);
  on(root, 'input', (e) => {
    const t = e.target;
    if (t.matches && t.matches('.v3d-prow input')) onPlanInput(t);
    else if (t === el.search) renderPartList();
  });
  on(root, 'change', (e) => { if (e.target === el.density) { densityTouched = true; S.density = el.density.value; invalidate(); } });
  // arrow-key navigation inside radio groups and the tab list (roving tabindex)
  on(root, 'keydown', (e) => {
    const t = e.target, role = t.getAttribute && t.getAttribute('role');
    if ((role !== 'radio' && role !== 'tab') || !['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp', 'Home', 'End'].includes(e.key)) return;
    const sibs = [...t.parentElement.querySelectorAll(`[role="${role}"]`)];
    const n = sibs.length, i = sibs.indexOf(t);
    const j = e.key === 'Home' ? 0 : e.key === 'End' ? n - 1 : (i + (e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 1) + n) % n;
    sibs[j].focus(); sibs[j].click(); e.preventDefault();
  });
  on(el.toolbar, 'scroll', () => updateCue(), { passive: true });

  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  function pickAt(cx, cy) {
    const rc = canvas.getBoundingClientRect();
    if (!rc.width || !rc.height) return;
    ndc.set(((cx - rc.left) / rc.width) * 2 - 1, -((cy - rc.top) / rc.height) * 2 + 1);
    world.scene.updateMatrixWorld();
    world.camera.updateMatrixWorld();
    ray.setFromCamera(ndc, world.camera);
    const targets = [];
    for (const r of Object.values(world.robots)) if (r.group.visible) targets.push(r.group);
    const hits = ray.intersectObjects(targets, true).filter((h) => h.object.userData.partId && hasPart(h.object.userData.cls, h.object.userData.partId) && !(S.xray && h.object.userData.shell));
    if (!hits.length) { select(null); return; }
    const h = hits[0].object.userData;
    if (S.multi && h.cls !== S.active) setSize(S.size, h.cls);
    select(h.partId);
  }
  // click-to-select on the model: ignore drags and multi-touch gestures
  on(canvas, 'pointerdown', (e) => { down = e.isPrimary ? { x: e.clientX, y: e.clientY } : null; });
  on(canvas, 'pointercancel', () => { down = null; });
  on(canvas, 'pointerup', (e) => {
    const d0 = down; down = null;
    if (!d0 || !e.isPrimary || Math.hypot(e.clientX - d0.x, e.clientY - d0.y) > 6) return;
    pickAt(e.clientX, e.clientY);
  });
  // a lost context wipes the prefiltered environment map: rebuild it or the robots come back dark and flat
  on(canvas, 'webglcontextrestored', () => { if (destroyed) return; world.rebuildEnvironment(); invalidate(); });

  // ---------------------------------------------------------------- sizing, visibility, loop
  function updateCue() {
    const tb = el.toolbar;
    el.cue.classList.toggle('is-done', tb.scrollWidth - tb.clientWidth - tb.scrollLeft < 6);
  }
  function resize() {
    if (destroyed) return;
    // Hidden or detached (display:none, zero width): there is nothing to measure, so keep the last layout flags instead of
    // reading "0 px wide" as a phone.
    const rw = root.clientWidth;
    if (!rw) { S.W = el.stage.clientWidth; S.H = el.stage.clientHeight; updateRun(); return; }
    // The stacked layout is decided by the root alone and applied first: in the side-by-side layout a narrow root leaves the
    // stage 0 px wide, and it only gets its real size once the grid has collapsed to one column.
    const stack = rw < 900;
    S.stack = stack;
    root.dataset.stack = String(stack);
    const w = el.stage.clientWidth, h = el.stage.clientHeight;
    S.W = w; S.H = h;
    if (!w || !h) { updateRun(); return; }
    const phone = w < 720;
    const changed = w !== lastW || h !== lastH || phone !== S.phone;
    lastW = w; lastH = h;
    S.phone = phone;
    root.dataset.phone = String(phone);
    if (!densityInit) {
      // default label density follows the first real measurement: key labels on phones, all on larger stages
      densityInit = true;
      if (!densityTouched) { S.density = phone ? 'key' : 'all'; el.density.value = S.density; }
    }
    world.setSize(w, h);
    world.camera.aspect = w / h;
    world.camera.updateProjectionMatrix();
    css2d.setSize(w, h);
    el.leaders.setAttribute('viewBox', `0 0 ${w} ${h}`);
    labels.resetWidths();
    tagW.clear();
    if (changed && !rig.userMoved) rig.goTo(S.view, false);
    updateCue();
    invalidate();
    updateRun();
  }
  const canRun = () => !destroyed && inView && !document.hidden && !userPaused && S.W > 0 && S.H > 0;
  function updateRun() {
    if (destroyed) return;
    if (canRun()) { if (!rafId) { lastT = performance.now(); rafId = requestAnimationFrame(tick); invalidate(); } }
    else if (rafId) { cancelAnimationFrame(rafId); rafId = 0; }
  }
  // name tags of neighbouring robots can collide on narrow stages: nudge them apart sideways
  const tv = new THREE.Vector3(), tagList = [];
  const tagW = new Map();       // tag widths only change with the size mode or the layout, not per frame
  function layoutTags() {
    tagList.length = 0;
    for (const r of Object.values(world.robots)) {
      if (!r.group.visible || !r.tag.visible) continue;
      tv.setFromMatrixPosition(r.tag.matrixWorld).project(world.camera);
      const el = r.tag.element;
      let w = tagW.get(el);
      if (w === undefined) { w = el.offsetWidth; tagW.set(el, w); }
      tagList.push({ el, w, x: (tv.x + 1) / 2 * S.W, l: 0, r: 0, dx: 0 });
    }
    tagList.sort((a, b) => a.x - b.x);
    for (const t of tagList) { t.l = t.x - t.w / 2; t.r = t.l + t.w; }
    const push = (t, d) => { t.l += d; t.r += d; t.dx += d; };
    for (let i = 1; i < tagList.length; i++) { const ov = tagList[i - 1].r + 6 - tagList[i].l; if (ov > 0) { push(tagList[i - 1], -ov / 2); push(tagList[i], ov / 2); } }
    for (let i = tagList.length - 1; i > 0; i--) { const ov = tagList[i - 1].r + 6 - tagList[i].l; if (ov > 0) push(tagList[i - 1], -ov); }
    for (const t of tagList) if (t.l < 4) push(t, 4 - t.l);
    for (let i = 1; i < tagList.length; i++) { const ov = tagList[i - 1].r + 6 - tagList[i].l; if (ov > 0) push(tagList[i], ov); }
    for (const t of tagList) {
      if (t.r > S.W - 4) push(t, S.W - 4 - t.r);
      const v = Math.round(t.dx) + 'px';
      if (t.el.style.marginLeft !== v) t.el.style.marginLeft = v;
    }
  }
  function frame(now, dt) {
    const gliding = rig.step(now);
    const moved = rig.controls.update(dt) || gliding;
    const pulsing = pulse.length > 0 && !reduced;
    if (pulsing) { const k = 0.25 + 0.25 * Math.sin(now / 1000 * 5); for (const m of pulse) m.material.emissiveIntensity = k; }
    if (!(moved || layoutDirty || dirty || pulsing)) return;
    world.render();
    if (moved || layoutDirty || cssDirty) {
      if (S.multi || cssDirty) css2d.render(world.scene, world.camera);
      cssDirty = false;
      labels.layout(S, world.camera, activeRobot());
      if (S.multi) layoutTags();
    }
    dirty = layoutDirty = false;
    if (firstFrame) { firstFrame = false; if (el.loading) { el.loading.remove(); el.loading = null; } root.dataset.ready = 'true'; }
  }
  function tick(now) {
    rafId = 0;
    if (!canRun()) return;
    rafId = requestAnimationFrame(tick);
    const dt = Math.min(0.1, Math.max(0, (now - lastT) / 1000));
    lastT = now;
    frame(now, dt);
  }
  const ro = new ResizeObserver(() => { if (!roRaf) roRaf = requestAnimationFrame(() => { roRaf = 0; resize(); }); });
  ro.observe(el.stage); ro.observe(root);
  let io = null;
  if (typeof IntersectionObserver !== 'undefined') {
    io = new IntersectionObserver((entries) => { inView = entries[entries.length - 1].isIntersecting; updateRun(); });
    io.observe(root);
  }
  on(document, 'visibilitychange', updateRun);
  const onMq = () => {
    reduced = !!mq.matches;
    rig.setReduced(reduced);
    el.rotate.disabled = reduced;
    el.rotate.title = reduced ? 'Auto-rotate is off because your system prefers reduced motion' : 'Auto-rotate';
    if (reduced) el.rotate.setAttribute('aria-pressed', 'false');
    rePulse(); invalidate();
  };
  if (mq) { if (mq.addEventListener) mq.addEventListener('change', onMq); else if (mq.addListener) mq.addListener(onMq); }

  // ---------------------------------------------------------------- initial state
  const initSize = SIZES.includes(options.size) ? options.size : (ORDER.includes(options.classId) ? options.classId : 'full');
  const initActive = ORDER.includes(options.classId) ? options.classId : undefined;
  S.mode = MODES.includes(options.mode) ? options.mode : 'sub';
  root.dataset.mode = S.mode;
  root.dataset.stack = 'false';
  root.dataset.phone = 'false';
  resize();
  el.density.value = S.density;
  onMq();
  setSize(initSize, initActive, { initial: true });
  if (options.partId) { S.selected = hasPart(S.active, options.partId) ? options.partId : null; applySelection(S.selected, false); }
  showTab('details');
  updateCue();
  updateRun();

  // ---------------------------------------------------------------- public API
  const viewer = {
    root, canvas,
    select(partId, opts = {}) { select(partId || null, opts || {}); },
    setSize(size, activeClass) { if (!destroyed && SIZES.includes(size)) setSize(size, ORDER.includes(activeClass) ? activeClass : undefined); },
    setMode(mode) { if (!destroyed) setMode(mode); },
    setView(view) { if (!destroyed) setView(view); },
    showTab(tab) { if (!destroyed) showTab(tab); },
    getState() {
      const sc = model.score(S.active);
      return { size: S.size, active: S.active, mode: S.mode, selected: S.selected, xray: S.xray, density: S.density, score: { pct: sc.pct, tot: sc.tot, us: sc.us } };
    },
    resize() { if (!destroyed) { resize(); } },
    pause() { userPaused = true; updateRun(); },
    resume() { userPaused = false; updateRun(); },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      if (rafId) cancelAnimationFrame(rafId);
      if (roRaf) cancelAnimationFrame(roRaf);
      rafId = roRaf = 0;
      for (const id of timers) clearTimeout(id);
      timers.clear();
      ro.disconnect(); if (io) io.disconnect();
      if (mq) { if (mq.removeEventListener) mq.removeEventListener('change', onMq); else if (mq.removeListener) mq.removeListener(onMq); }
      for (const off of offs) off();
      offs.length = 0;
      rig.dispose();
      labels.dispose();
      world.dispose();
      css2d.domElement.remove();
      colors.dispose();
      root.replaceChildren();
      addedClasses.forEach((c) => root.classList.remove(c));
      for (const k of ['size', 'active', 'mode', 'stack', 'phone', 'ready']) delete root.dataset[k];
      pulse.length = 0; S.hidden.clear();
      viewer.debug = null;
      viewer.canvas = null;
      world = null;
    },
  };

  if (options.debug) {
    viewer.debug = {
      get renderer() { return world && world.renderer; }, get scene() { return world && world.scene; }, get camera() { return world && world.camera; },
      get controls() { return rig.controls; }, get robots() { return world && world.robots; },
      state: S, model, labels, rig, hasPart, partsFor,
      renderNow() { frame(performance.now(), 0); world.render(); },
      /** Client-pixel position of the center of a part's first mesh (for click tests). */
      partPoint(partId, cls = S.active) {
        const r = world.robots[cls]; const m = r && r.parts[partId] && r.parts[partId][0];
        if (!m) return null;
        world.scene.updateMatrixWorld();
        const box = new THREE.Box3().setFromObject(m), c = box.getCenter(new THREE.Vector3()).project(world.camera);
        const rc = canvas.getBoundingClientRect();
        return { x: rc.left + (c.x + 1) / 2 * rc.width, y: rc.top + (1 - c.y) / 2 * rc.height };
      },
    };
  }
  return viewer;
}
