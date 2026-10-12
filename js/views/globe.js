// Station 2: the globe. Supplier pins by country, filtered by the part you clicked on the robot.
import { $, $$, esc, partFor, canonPart, xlinks, SUBSYSTEMS, ORIGIN_REC, CLASSES } from '../ui.js';
import { SUPPLIERS, SUP, GROUPS, PART_GROUP, ORIGIN_NAME, ORIGIN_COLOR, STATUS_NAME } from '../data/site-data.js';

const SIZE = 600, RADIUS = 268, C = SIZE / 2;
const WHEN = { us: 'now', foreign: 'later', minor: 'later' };
const FILTER_KEYS = ['origin', 'part', 'cls', 'group', 'status'];

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src; s.onload = resolve; s.onerror = () => reject(new Error('Could not load ' + src));
    document.head.appendChild(s);
  });
}

export function createGlobeView(el, ctx) {
  el.innerHTML = `
  <div class="globe-page">
    <div class="globe-stage" data-role="stage">
      <div class="globe-ctl">
        <div class="seg" data-role="origins" role="group" aria-label="Filter by origin">
          <button type="button" class="seg-btn" data-o="all" aria-pressed="true">All</button>
          <button type="button" class="seg-btn" data-o="us" aria-pressed="false"><i class="dot" style="background:var(--us)"></i>US</button>
          <button type="button" class="seg-btn" data-o="cn" aria-pressed="false"><i class="dot" style="background:var(--cn)"></i>China</button>
          <button type="button" class="seg-btn" data-o="third" aria-pressed="false"><i class="dot" style="background:var(--third)"></i>Third country</button>
        </div>
        <button type="button" class="seg-btn" data-role="spin" aria-pressed="false">Spin</button>
      </div>
      <svg class="globe-svg" data-role="svg" viewBox="0 0 ${SIZE} ${SIZE}" role="img" aria-label="Rotatable globe with supplier pins. Drag to rotate."></svg>
      <p class="globe-foot mono">Drag to rotate · pins sit at HQ or main-plant cities · third-country makers also count as foreign</p>
    </div>
    <aside class="globe-side" data-role="side">
      <button class="btn ghost sm" type="button" data-go="robot">‹ Back to the robot</button>
      <p class="eyebrow">Supplier map</p>
      <h2 class="h2" data-role="title" tabindex="-1">All supplier pins</h2>
      <p class="readout mono" data-role="count"></p>
      <div data-role="context"></div>
      <div class="chips" data-role="groups" aria-label="Filter by part group"></div>
      <ul class="suplist" data-role="list"></ul>
      <div data-role="detail"></div>
    </aside>
  </div>`;

  const svg = $('[data-role=svg]', el);
  const S = { rot: [-95, -28], filter: {}, selected: null, spinning: true, active: false, drag: null, land: null, proj: null, path: null, tween: null, raf: 0, last: 0, ready: false, fallbackGroup: null };

  /* ---------------------------------------------------------------- filtering */
  function exactMatches(partId) { const id = canonPart(partId); return SUPPLIERS.filter((s) => s.parts.includes(id)); }
  function visible(s) {
    const f = S.filter;
    if (f.origin && s.origin !== f.origin) return false;
    if (f.status && s.status !== f.status) return false;
    if (f.group && !s.groups.includes(f.group)) return false;
    if (f.part) {
      const id = canonPart(f.part);
      if (S.fallbackGroup) { if (!s.groups.includes(S.fallbackGroup)) return false; }
      else if (!(s.parts.includes('*') || s.parts.includes(id))) return false;
    }
    return true;
  }
  const shown = () => SUPPLIERS.filter(visible);

  function applyParams(params) {
    S.filter = {};
    for (const k of FILTER_KEYS) if (params[k]) S.filter[k] = params[k];
    if (S.filter.part && !partFor(S.filter.part, S.filter.cls)) delete S.filter.part;
    if (S.filter.group && !GROUPS[S.filter.group]) delete S.filter.group;
    if (S.filter.origin && !ORIGIN_NAME[S.filter.origin]) delete S.filter.origin;
    // a part that no supplier lists exactly falls back to every supplier in its group, and says so
    S.fallbackGroup = null;
    if (S.filter.part && !exactMatches(S.filter.part).length) S.fallbackGroup = PART_GROUP[canonPart(S.filter.part)] || null;
    S.selected = params.sup && SUP[params.sup] ? params.sup : null;
  }
  const query = () => {
    const parts = FILTER_KEYS.filter((k) => S.filter[k]).map((k) => `${k}=${encodeURIComponent(S.filter[k])}`);
    if (S.selected) parts.push('sup=' + encodeURIComponent(S.selected));
    return parts.join('&');
  };
  function syncHash() { try { history.replaceState(null, '', '#globe' + (query() ? '?' + query() : '')); } catch (e) { /* ignore */ } }

  /* ---------------------------------------------------------------- globe drawing */
  async function boot() {
    try {
      await loadScript('./vendor/d3-array.min.js');
      await loadScript('./vendor/d3-geo.min.js');
      await loadScript('./vendor/topojson-client.min.js');
      const topo = await fetch('./data/land-110m.json').then((r) => r.json());
      S.land = window.topojson.feature(topo, topo.objects.land);
      S.proj = window.d3.geoOrthographic().scale(RADIUS).translate([C, C]).clipAngle(90).rotate(S.rot);
      S.path = window.d3.geoPath(S.proj);
      S.grat = window.d3.geoGraticule10();
      build();
      S.ready = true;
      draw();
      if (S.pendingFocus) { const f = S.pendingFocus; S.pendingFocus = null; focusOnVisible(f); }
      loop();
    } catch (err) {
      console.error(err);
      svg.outerHTML = '<p class="globe-error mono">The globe could not load. The supplier list still works.</p>';
    }
  }
  function build() {
    svg.innerHTML = `<circle class="sphere" cx="${C}" cy="${C}" r="${RADIUS}"/><path class="grat" data-r="grat"/><path class="land" data-r="land"/><g data-r="pins">${SUPPLIERS.map((s) => `
      <g class="gpin" data-sup="${s.id}" tabindex="0" role="button" aria-label="${esc(s.name)}, ${esc(s.loc)}"><circle class="halo" r="11" stroke="${ORIGIN_COLOR[s.origin]}"/><circle class="dot" r="5" fill="${ORIGIN_COLOR[s.origin]}"/><text x="10" y="3.5">${esc(s.name)}</text></g>`).join('')}</g>`;
    $$('.gpin', svg).forEach((g) => {
      const pick = (e) => { e.stopPropagation(); select(g.dataset.sup, true); };
      g.addEventListener('click', pick);
      g.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(e); } });
    });
    const pt = (e) => { const r = svg.getBoundingClientRect(); const t = e.touches ? e.touches[0] : e; return [(t.clientX - r.left) * SIZE / r.width, (t.clientY - r.top) * SIZE / r.height]; };
    const start = (e) => { S.spinning = false; setSpinBtn(); S.tween = null; S.drag = { p: pt(e), rot: S.rot.slice() }; svg.classList.add('drag'); };
    const move = (e) => { if (!S.drag) return; const p = pt(e), k = 75 / RADIUS; S.rot = [S.drag.rot[0] + (p[0] - S.drag.p[0]) * k, Math.max(-80, Math.min(80, S.drag.rot[1] - (p[1] - S.drag.p[1]) * k))]; draw(); if (e.cancelable) e.preventDefault(); };
    const end = () => { S.drag = null; svg.classList.remove('drag'); };
    svg.addEventListener('mousedown', start); window.addEventListener('mousemove', move); window.addEventListener('mouseup', end);
    svg.addEventListener('touchstart', start, { passive: true }); svg.addEventListener('touchmove', move, { passive: false }); svg.addEventListener('touchend', end);
    S.cleanup = () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', end); };
  }
  function draw() {
    if (!S.proj) return;
    S.proj.rotate(S.rot);
    $('[data-r=grat]', svg).setAttribute('d', S.path(S.grat));
    $('[data-r=land]', svg).setAttribute('d', S.path(S.land));
    const center = [-S.rot[0], -S.rot[1]];
    const n = shown().length;
    const cands = [];
    $$('.gpin', svg).forEach((g) => {
      const s = SUP[g.dataset.sup];
      const front = window.d3.geoDistance([s.lon, s.lat], center) < Math.PI / 2 - 0.02;
      g.style.display = front ? '' : 'none';
      if (!front) return;
      const [x, y] = S.proj([s.lon, s.lat]);
      g.setAttribute('transform', `translate(${x.toFixed(1)},${y.toFixed(1)})`);
      const vis = visible(s);
      g.classList.toggle('dim', !vis);
      g.classList.toggle('sel', S.selected === s.id);
      g.tabIndex = vis ? 0 : -1;
      const label = g.querySelector('text');
      label.style.display = 'none';
      if (vis && (S.selected === s.id || n <= 12)) cands.push({ label, s, x, y });
    });
    // labels: the selected pin first, then US options, then the rest; skip any label that would sit on one already placed
    cands.sort((a, b) => (S.selected === b.s.id) - (S.selected === a.s.id) || (b.s.origin === 'us') - (a.s.origin === 'us'));
    const placed = [];
    for (const c of cands) {
      const w = c.s.name.length * 6.3 + 16, box = [c.x + 4, c.y - 9, c.x + 4 + w, c.y + 9];
      if (S.selected !== c.s.id && placed.some((b) => box[0] < b[2] && box[2] > b[0] && box[1] < b[3] && box[3] > b[1])) continue;
      placed.push(box);
      c.label.style.display = '';
    }
  }
  function lerpAngle(a, b, t) { let d = ((b - a + 540) % 360) - 180; return a + d * t; }
  /** Rotate the globe to centre on a coordinate over `ms`. */
  function rotateTo(lon, lat, ms = 1300) {
    const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const to = [-lon, Math.max(-60, Math.min(60, -lat))];
    if (reduced || !S.proj) { S.rot = to; draw(); return; }
    S.tween = { from: S.rot.slice(), to, t0: performance.now(), ms };
  }
  /** Pick the pin to show first: a US option when there is one, otherwise the first match. */
  function focusOnVisible() {
    const list = shown();
    if (!list.length) return;
    const target = list.find((s) => s.origin === 'us' && s.status !== 'avoid') || list[0];
    rotateTo(target.lon, target.lat);
  }
  function loop() {
    cancelAnimationFrame(S.raf);
    if (!S.active || !S.ready) return;
    const tick = (now) => {
      S.raf = requestAnimationFrame(tick);
      const dt = Math.min(0.1, (now - (S.last || now)) / 1000); S.last = now;
      if (S.tween) {
        const k = Math.min(1, (now - S.tween.t0) / S.tween.ms), e = 1 - Math.pow(1 - k, 3);
        S.rot = [lerpAngle(S.tween.from[0], S.tween.to[0], e), S.tween.from[1] + (S.tween.to[1] - S.tween.from[1]) * e];
        if (k >= 1) S.tween = null;
        draw();
      } else if (S.spinning && !S.drag) { S.rot[0] += 5 * dt; draw(); }
    };
    S.last = 0; S.raf = requestAnimationFrame(tick);
  }
  function setSpinBtn() { $('[data-role=spin]', el).setAttribute('aria-pressed', String(S.spinning)); }

  /* ---------------------------------------------------------------- side panel */
  function partContext() {
    const f = S.filter;
    if (!f.part) return '';
    const cls = f.cls && CLASSES[f.cls] ? f.cls : 'full';
    const p = partFor(f.part, cls);
    if (!p) return '';
    const when = WHEN[p.rec] || 'later';
    const fb = S.fallbackGroup ? `<p class="note">No supplier is mapped to this exact part, so this shows every ${esc(GROUPS[S.fallbackGroup].name.toLowerCase())} supplier.</p>` : '';
    return `<div class="context">
      <div class="tags"><span class="tag">${esc(SUBSYSTEMS[p.sub].name)}</span><span class="tag ${when === 'now' ? 'ok' : ''}">${when === 'now' ? 'Act now' : 'Later'}</span><span class="tag">${esc(ORIGIN_REC[p.rec].name)}</span><span class="tag">${esc(CLASSES[cls].short)}</span></div>
      <p>${esc(p.what)}</p>
      <dl class="facts">
        <div><dt>Reference spec</dt><dd>${esc(p.spec)}</dd></div>
        <div><dt>Assumed cost share</dt><dd>${esc(p.share)}</dd></div>
        <div><dt>Origin options</dt><dd>${p.origin.map(([k, v]) => `<span class="orow"><b>${esc(k)}</b> ${esc(v)}</span>`).join('')}</dd></div>
        <div><dt>Export status</dt><dd>${esc(p.exportNote)}</dd></div>
        <div><dt>Recommendation</dt><dd>${esc(p.recText)}</dd></div>
      </dl>${fb}
      ${xlinks([[`robot?part=${p.id}&cls=${cls}`, 'See it on the robot'], [`planner?part=${p.id}&cls=${cls}`, 'Open in the planner']])}
    </div>`;
  }
  function renderSide() {
    const f = S.filter, list = shown();
    const cls = f.cls && CLASSES[f.cls] ? f.cls : 'full';
    const p = f.part ? partFor(f.part, cls) : null;
    $('[data-role=title]', el).textContent = p ? p.title : (f.group ? `${GROUPS[f.group].name} suppliers` : (f.status ? STATUS_NAME[f.status] : 'All supplier pins'));
    $('[data-role=count]', el).textContent = `${list.length} of ${SUPPLIERS.length} pins`;
    $('[data-role=context]', el).innerHTML = partContext();
    const active = (k) => (f.group === k ? ' on' : '');
    $('[data-role=groups]', el).innerHTML = `<button type="button" class="chip${!f.group && !f.part && !f.status ? ' on' : ''}" data-clear>All</button>` +
      Object.entries(GROUPS).map(([k, g]) => `<button type="button" class="chip${active(k)}" data-group="${k}">${esc(g.name)}</button>`).join('') +
      `<button type="button" class="chip${f.status === 'inferred' ? ' on' : ''}" data-status="inferred">Unverified names</button>`;
    $('[data-role=list]', el).innerHTML = list.map((s) => `<li><button type="button" class="${S.selected === s.id ? 'sel' : ''}" data-pick="${s.id}"><i class="dot" style="background:${ORIGIN_COLOR[s.origin]}"></i><span>${esc(s.name)}</span><em>${esc(s.loc.split(',').slice(-1)[0].trim())}</em></button></li>`).join('') || '<li class="muted">No pins match this filter.</li>';
    $('[data-role=detail]', el).innerHTML = S.selected ? supplierDetail(SUP[S.selected]) : '';
    $$('[data-o]', el).forEach((b) => b.setAttribute('aria-pressed', String((f.origin || 'all') === b.dataset.o)));
  }
  function supplierDetail(s) {
    const parts = s.parts.includes('*') ? 'Every part (the reference platform).' : s.parts.map((id) => { const p = partFor(id, 'full'); return p ? `<button type="button" class="link" data-go="robot?part=${id}">${esc(p.title)}</button>` : ''; }).filter(Boolean).join(', ');
    return `<div class="sup-detail">
      <h3>${esc(s.name)}</h3><p class="muted">${esc(s.loc)}</p>
      <div class="tags"><span class="tag ${s.origin}">${esc(ORIGIN_NAME[s.origin])}${s.origin === 'us' ? '' : ' · foreign content'}</span><span class="tag">${esc(STATUS_NAME[s.status])}</span><span class="tag ${s.when === 'now' ? 'ok' : ''}">${s.when === 'now' ? 'Act now' : 'Later'}</span></div>
      <dl class="facts">
        <div><dt>Covers</dt><dd>${esc(s.groups.map((g) => GROUPS[g].name).join(', '))}</dd></div>
        <div><dt>Parts on the robot</dt><dd>${parts}</dd></div>
        <div><dt>Notes</dt><dd>${esc(s.note)}</dd></div>
        <div><dt>Does it help the percentage?</dt><dd>${s.origin === 'us' ? (s.status === 'avoid' ? 'Not relevant: this is a what-not-to-buy example.' : 'Only if the specific unit is manufactured in the US. Ask for a written origin statement per part number; a US brand made abroad is foreign.') : 'No. Foreign content counts against the 35% (through 2028) or 25% (from 2029) allowance, whether it comes from China or a third country.'}</dd></div>
      </dl>
      ${xlinks([['checklist?item=9', 'Screening checklist']])}</div>`;
  }
  function select(id, rotate) {
    S.selected = id;
    if (id && rotate) { const s = SUP[id]; S.spinning = false; setSpinBtn(); rotateTo(s.lon, s.lat, 900); }
    renderSide(); draw(); syncHash();
  }

  /* ---------------------------------------------------------------- events */
  $('[data-role=origins]', el).addEventListener('click', (e) => {
    const b = e.target.closest('[data-o]'); if (!b) return;
    if (b.dataset.o === 'all') delete S.filter.origin; else S.filter.origin = b.dataset.o;
    renderSide(); draw(); syncHash();
  });
  $('[data-role=spin]', el).addEventListener('click', () => { S.spinning = !S.spinning; S.tween = null; setSpinBtn(); });
  el.addEventListener('click', (e) => {
    const pickBtn = e.target.closest('[data-pick]');
    if (pickBtn) { select(pickBtn.dataset.pick, true); return; }
    const g = e.target.closest('[data-group]');
    if (g) { S.filter = { group: g.dataset.group }; S.fallbackGroup = null; S.selected = null; renderSide(); draw(); syncHash(); focusOnVisible(); return; }
    const st = e.target.closest('[data-status]');
    if (st) { S.filter = { status: st.dataset.status }; S.fallbackGroup = null; S.selected = null; renderSide(); draw(); syncHash(); return; }
    if (e.target.closest('[data-clear]')) { S.filter = {}; S.fallbackGroup = null; S.selected = null; renderSide(); draw(); syncHash(); }
  });

  boot();

  return {
    prepare(params) {
      applyParams(params);
      S.spinning = !(S.filter.part || S.selected || S.filter.group || S.filter.status);
      setSpinBtn();
      renderSide();
      if (S.selected) { const s = SUP[S.selected]; if (S.ready) rotateTo(s.lon, s.lat, 1200); else S.pendingFocus = true; }
      else if (S.filter.part || S.filter.group || S.filter.origin || S.filter.status) { if (S.ready) focusOnVisible(); else S.pendingFocus = true; }
      draw();
    },
    enter() { S.active = true; loop(); const t = $('[data-role=title]', el); if (t) t.focus({ preventScroll: true }); el.scrollTop = 0; },
    leave() { S.active = false; cancelAnimationFrame(S.raf); },
    refresh() {},
    destroy() { cancelAnimationFrame(S.raf); if (S.cleanup) S.cleanup(); },
  };
}
