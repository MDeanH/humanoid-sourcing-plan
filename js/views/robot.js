// Station 1: the robot. The main page. A live 3D model; clicking any part turns the robot, then spins the ring to the globe.
import { $, $$, esc, partFor, shortName, keySpec, className, daysUntil, CLASSES, SUBSYSTEMS } from '../ui.js';
import { PARTS } from '../data/planner-parts.js';
import { GROUPS, PART_GROUP } from '../data/site-data.js';

const SIZES = [['full', 'A2'], ['compact', 'X2'], ['a3', 'A3'], ['d1', 'D1'], ['lineup', 'Lineup']];
const short = () => window.matchMedia && window.matchMedia('(pointer: coarse), (max-width: 700px)').matches;
const HINT_TEXT = () => (short() ? 'Tap a node to trace its suppliers' : 'Drag to turn · click any node to trace its suppliers');
const HINT = HINT_TEXT();
const wide = () => window.matchMedia('(min-width: 1000px)').matches;

export function createRobotView(el, ctx) {
  el.innerHTML = `
  <div class="hero">
    <div class="hero-copy">
      <p class="eyebrow"><span data-role="classname">A2 Ultra-class</span> reference · US-compliance hardware map</p>
      <h1 class="display">Humanoid,<br>over 65%<br>US-made</h1>
      <p class="lede">A new robot only gets FCC authorization when US-made parts are more than 65% of component cost, and more than 75% for items delivered from 2029. Click a part to see where to get it.</p>
      <div class="hero-actions">
        <button class="btn" type="button" data-go="globe">Trace the supply chain</button>
        <button class="btn ghost" type="button" data-go="plan">Read the plan</button>
      </div>
    </div>
    <div class="hero-focus" data-role="focus" hidden>
      <span class="mono" data-role="focusname"></span>
      <button class="btn sm" type="button" data-role="focusgo">Trace suppliers</button>
    </div>
    <dl class="readouts">
      <div><dd data-role="days">${daysUntil('2028-01-01')}</dd><dt>days to the Jan 1, 2028 Conditional Approval deadline</dt></div>
      <div><dd>&gt;65%</dd><dt>US component cost, items delivered through 2028</dt></div>
      <div><dd>&gt;75%</dd><dt>from January 1, 2029</dt></div>
    </dl>
    <div class="hero-controls">
      <div class="seg" role="group" aria-label="Platform">
        ${SIZES.map(([k, n], i) => `<button type="button" class="seg-btn" data-size="${k}" aria-pressed="${i === 0}">${n}</button>`).join('')}
      </div>
      <button type="button" class="seg-btn" data-role="xray" aria-pressed="false">X-ray</button>
    </div>
    <p class="hero-hint mono" data-role="hint">${HINT}</p>
    <p class="hero-load mono" data-role="load">Loading 3D model</p>
    <!-- last in the DOM on purpose: the 26 part hotspots come after the buttons and platform tabs in the tab order -->
    <div class="hero-stage" data-role="stage" role="group" aria-label="Interactive 3D model of the reference humanoid. Every part is a button that traces its suppliers."></div>
  </div>`;

  const root = $('[data-role=stage]', el);
  const hint = $('[data-role=hint]', el);
  const loadEl = $('[data-role=load]', el);
  const focusEl = $('[data-role=focus]', el);
  const S = { viewer: null, classId: 'full', size: 'full', xray: false, focusPart: null, picking: false, active: true, failed: false };
  const reduced = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const partTitle = (id, cls) => { const p = partFor(id, cls); return p ? p.title : id; };

  function setHint(text) { hint.textContent = text || HINT; }

  function showFocus(partId, cls) {
    if (!partId || !partFor(partId, cls)) { focusEl.hidden = true; S.focusPart = null; return; }
    S.focusPart = partId;
    $('[data-role=focusname]', el).textContent = partTitle(partId, cls);
    focusEl.hidden = false;
  }

  /** A part was picked (hotspot or the model itself): turn the robot to it and send the ring to the globe. */
  function pick(partId, classId) {
    if (S.picking) return;
    S.picking = true;
    const v = S.viewer;
    if (v) { try { v.highlight(partId); v.spinTo(partId, { duration: 650 }); } catch (e) { console.error(e); } }
    const go = () => { S.picking = false; ctx.go(`globe?part=${encodeURIComponent(partId)}&cls=${encodeURIComponent(classId || S.classId)}`); };
    if (reduced()) go(); else setTimeout(go, 150);
  }

  function setSize(size) {
    S.size = size;
    if (CLASSES[size]) S.classId = size;
    $$('[data-size]', el).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.size === size)));
    $('[data-role=classname]', el).textContent = size === 'lineup' ? 'All four platforms, true scale' : className(S.classId);
    showFocus(null);
    if (S.viewer) S.viewer.setSize(size);
  }
  $$('[data-size]', el).forEach((b) => b.addEventListener('click', () => setSize(b.dataset.size)));
  $('[data-role=xray]', el).addEventListener('click', (e) => {
    S.xray = !S.xray;
    e.currentTarget.setAttribute('aria-pressed', String(S.xray));
    if (S.viewer) S.viewer.setXray(S.xray);
  });
  $('[data-role=focusgo]', el).addEventListener('click', () => { if (S.focusPart) pick(S.focusPart, S.classId); });

  /** No WebGL: the same click-to-trace path as a plain list of parts. */
  function renderFallback(reason) {
    S.failed = true;
    loadEl.hidden = true;
    root.innerHTML = `<div class="hero-fallback"><p class="mono">${esc(reason)}</p>
      ${Object.entries(GROUPS).map(([g, info]) => `<div class="fb-group"><h2 class="mono">${esc(info.name)}</h2><div class="fb-parts">${PARTS.filter((p) => (p.classes || ['full']).includes('full') && PART_GROUP[p.id] === g)
        .map((p) => `<button type="button" class="chip" data-fbpart="${p.id}">${esc(shortName(p))}</button>`).join('')}</div></div>`).join('')}</div>`;
    $$('[data-fbpart]', root).forEach((b) => b.addEventListener('click', () => pick(b.dataset.fbpart, 'full')));
    $$('.hero-controls, .hero-hint', el).forEach((n) => { n.hidden = true; });
  }

  async function load() {
    try {
      const mod = await import('../viewer3d/viewer.js');
      if (!mod.webglAvailable()) { renderFallback('3D needs WebGL, which this browser has turned off. Pick a part from the list.'); return; }
      const viewer = mod.createViewer(root, {
        variant: 'stage', classId: S.classId, size: S.size, offsetX: wide() ? 0.2 : 0, debug: /[?&]debug=1/.test(location.search),
        onSelect: (partId, classId) => pick(partId, classId),
        onHover: (partId, classId) => { if (partId) setHint(`${shortName(partFor(partId, classId) || { label: partId })} · ${keySpec(partFor(partId, classId) || {}, classId) || 'click to trace its suppliers'}`); else setHint(); },
        onClassPick: (classId) => setSize(classId),
      });
      S.viewer = viewer;
      if (!S.active) viewer.pause();
      const ready = () => { loadEl.hidden = true; };
      if (root.dataset.ready === 'true') ready(); else { const t = setInterval(() => { if (root.dataset.ready === 'true') { clearInterval(t); ready(); } }, 120); setTimeout(() => { clearInterval(t); ready(); }, 6000); }
      if (S.pendingPart) { const p = S.pendingPart; S.pendingPart = null; viewer.spinTo(p).catch(() => {}); }
    } catch (err) {
      console.error(err);
      renderFallback('The 3D model could not start. Pick a part from the list.');
    }
  }

  const mqWide = window.matchMedia('(min-width: 1000px)');
  const onWide = () => { if (S.viewer) S.viewer.setOffsetX(mqWide.matches ? 0.2 : 0); };
  if (mqWide.addEventListener) mqWide.addEventListener('change', onWide);

  // three.js is only fetched when this station is shown (first load on the robot, or the first visit to it): the page
  // paints its headline first, then pulls the 3D engine in
  let loadStarted = false;
  const ensureLoaded = () => {
    if (loadStarted) return;
    loadStarted = true;
    (window.requestIdleCallback || ((f) => setTimeout(f, 60)))(load, { timeout: 800 });
  };

  return {
    /** Called before the ring spins here (and on first load). */
    prepare(params) {
      ensureLoaded();
      if (params.cls && CLASSES[params.cls] && params.cls !== S.classId && S.size !== params.cls) setSize(params.cls);
      showFocus(params.part, S.classId);
    },
    enter(params) {
      S.active = true;
      if (S.viewer) {
        S.viewer.resume();
        if (params && params.part) { S.viewer.highlight(params.part); S.viewer.spinTo(params.part, { duration: 800 }).catch(() => {}); }
      } else if (params && params.part) S.pendingPart = params.part;
    },
    leave() { S.active = false; S.picking = false; if (S.viewer) S.viewer.pause(); },
    /** The ring is about to carry this station away: give the robot a turn of its own. */
    spinAway(delta) { if (S.viewer) S.viewer.spinBy(Math.sign(-delta || 1) * Math.PI * 1.2, { duration: 1000 }).catch(() => {}); },
    refresh() { $('[data-role=days]', el).textContent = daysUntil('2028-01-01'); },
    destroy() { if (S.viewer) S.viewer.destroy(); if (mqWide.removeEventListener) mqWide.removeEventListener('change', onWide); },
  };
}
