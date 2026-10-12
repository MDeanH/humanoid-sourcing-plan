// HTML builders for the side panel (details, class card, live planner, parts list) and the mini score bar.
// Pure functions of the plan model and the viewer state. Interactions are wired by delegation in full.js
// through data-v3d-act attributes, so nothing here binds listeners.
import { SUBSYSTEMS, ORIGIN_REC } from '../data/planner-parts.js';
import { CLASSES, SOURCES } from '../data/classes.js';
import { PRESETS } from '../data/bom.js';
import { esc, partFor, partsFor, shortName, keySpec, linesOf, lineById, MAX_FIELD, O_NAME, O_SHORT } from './planner-model.js';

export const ORIGIN_TITLES = { us: 'US-made', fx: 'Foreign', unk: 'Unknown origin counts as foreign' };

function exportTag(p) {
  const t = p.exportNote || '';
  if (/^Usually EAR99|^EAR99|^Normally EAR99/.test(t)) return '<span class="v3d-tag is-ear">EAR99 (usually)</span>';
  if (/classification/.test(t)) return '<span class="v3d-tag is-ear">Check ECCN</span>';
  return '<span class="v3d-tag is-ear">Export: see note</span>';
}

const QUAD_NOTE = '<div class="v3d-fccnote"><b>Quadrupeds are covered.</b> The FCC definition of an advanced robotic device names quadrupeds alongside humanoids and autonomous mobile robots. A D1-class robot faces the same &gt;65% (through 2028) / &gt;75% (from 2029) domestic-content test, or needs a Conditional Approval.</div>';

/** Three-way "Made in" switch. key is a planner line id or '@joints'. */
export function originButtons(o, key) {
  const b = (v, label) => `<button type="button" data-v3d-act="origin" data-k="${esc(key)}" data-v="${v}" aria-pressed="${o === v}" title="${ORIGIN_TITLES[v]}">${label}</button>`;
  return `<span class="v3d-tog" role="group" aria-label="Made in">${b('us', 'US')}${b('fx', 'Foreign')}${b('unk', 'Unknown')}</span>`;
}

function srcBadge(k) {
  const S = SOURCES[k]; if (!S) return '';
  return S.url
    ? `<a class="v3d-srcb is-${S.kind}" href="${esc(S.url)}" target="_blank" rel="noopener" title="Source: ${esc(S.name)}">${esc(S.name)}</a>`
    : `<span class="v3d-srcb is-${S.kind}">${esc(S.name)}</span>`;
}

export function classCard(C) {
  const rows = (C.specs || []).map((x) => `<li><b>${esc(x.label)}</b><span>${esc(x.text)}${srcBadge(x.src)}</span></li>`).join('');
  return `<div class="v3d-classcard"><h3>${esc(C.name)} class · ${esc(C.short)}</h3>
    <ul class="v3d-specs">${rows}</ul>
    <div class="v3d-src">Each line is badged by its own source. Green badges are AgiBot's own pages; manufacturer figures take precedence over retailer listings. Likeness for planning only — not an official AgiBot model. No logos.</div></div>`;
}

/**
 * Runs the host's extraDetail hook. A throwing hook or a non-string result must not abort the panel render (and with it the
 * selection that triggered it): errors are logged and the extra block is left out.
 */
function hostExtra(hook, p, cls) {
  if (!hook) return '';
  try {
    const r = hook(p, cls);
    if (r == null || r === false || r === '') return '';
    if (typeof r === 'string') return r;
    console.warn('extraDetail must return an HTML string; ignoring a ' + typeof r + ' result');
  } catch (err) { console.error(err); }
  return '';
}

/**
 * cx: { model, cls, selected, modeColor(p, cls), extraDetail }
 */
export function detailsHtml(cx) {
  const { model, cls, selected } = cx;
  const C = CLASSES[cls];
  const quad = C.kind === 'quad' ? QUAD_NOTE : '';
  const list = partsFor(cls).map((q) => q.id);
  if (!selected || !list.includes(selected)) {
    return `<div class="v3d-empty">
      <h2 tabindex="-1">Pick a part</h2>
      <p>Each label shows the part name and its key spec. Click a label or any part of the robot to see the rest: origin options, export status, cost share, and the US-build recommendation.</p>
      ${classCard(C)}${quad}
      <div class="v3d-kpis"><div><b>${C.dof}</b><span>DOF modeled</span></div><div><b>&gt;65%</b><span>US component cost, 2024–2028</span></div><div><b>&gt;75%</b><span>from 2029</span></div></div>
      <p class="v3d-small">The biggest lever is the joint modules. Open the live parts planner to see which switches move your score most.</p>
      <div class="v3d-pnav"><span>Step through all ${list.length} parts</span><button type="button" class="v3d-nbtn is-next" data-v3d-act="start">Start</button></div></div>`;
  }
  const p = partFor(selected, cls);
  const sc = model.score(cls);
  const ids = linesOf(p, cls);
  const lineSt = sc.rows.filter((r) => ids.includes(r.l.id)).reduce((a, r) => a + r.st, 0);
  const linePct = sc.tot ? lineSt / sc.tot * 100 : 0;
  const o = model.originOf(p, cls);
  const lineName = p.calc === '@joints' ? 'All joint-module lines' : lineById(cls, ids[0]).name;
  let shareLine = `This part is in the planner line <b>${esc(lineName)}</b>, which is ${linePct.toFixed(1)}% of component cost in your current plan.`;
  if (p.dof) {
    const dofInLine = partsFor(cls).filter((q) => q.dof && partFor(q.id, cls).calc === p.calc).reduce((a, q) => a + q.dof, 0) || p.dof;
    shareLine = `This location has ${p.dof} of the ${dofInLine} DOF in <b>${esc(lineName)}</b> (${linePct.toFixed(1)}% of component cost in your plan), so about ${(linePct * p.dof / dofInLine).toFixed(1)}% if split evenly by DOF. Relative placeholder costs, not AgiBot data.`;
  } else if (p.calc === '@joints') {
    shareLine = `Inside every joint module. If you buy the module whole, this part is not counted separately: the module's origin decides. Joint lines are ${linePct.toFixed(1)}% of component cost in your plan.`;
  }
  const idx = list.indexOf(p.id);
  const extra = hostExtra(cx.extraDetail, p, cls);
  return `
    <div class="v3d-pnav"><button type="button" class="v3d-nbtn is-prev" data-v3d-act="step" data-step="-1">Previous</button><span>Part ${idx + 1} of ${list.length}</span><button type="button" class="v3d-nbtn is-next" data-v3d-act="step" data-step="1">Next</button></div>
    <div class="v3d-dhead"><span class="v3d-sw" style="background:${esc(cx.modeColor(p, cls))}"></span><div>
      <h2 tabindex="-1">${esc(p.title)}</h2>
      <div class="v3d-tags"><span class="v3d-tag">${esc(SUBSYSTEMS[p.sub].name)}</span><span class="v3d-tag is-${esc(p.rec)}">${esc(ORIGIN_REC[p.rec].name)}</span>${exportTag(p)}<span class="v3d-tag">${esc(C.name)} · ${esc(C.short)}</span></div>
    </div></div>
    ${quad}
    <div class="v3d-dsec"><h3>What it is</h3><p>${esc(p.what)}</p></div>
    <div class="v3d-dsec"><h3>Reference spec</h3><p>${esc(p.spec)}</p></div>
    <div class="v3d-dsec"><h3>Origin options</h3><div class="v3d-origin">${p.origin.map(([k, v]) => `<div><b>${esc(k)}</b><span>${esc(v)}</span></div>`).join('')}</div></div>
    <div class="v3d-dsec"><h3>Export status</h3><p>${esc(p.exportNote)}</p></div>
    <div class="v3d-dsec"><h3>Cost share in your plan</h3><p>${shareLine}</p></div>
    <div class="v3d-plan-inline"><span>Made in:</span>${originButtons(o, p.calc)}</div>
    <div class="v3d-dsec"><h3>US-compliant build recommendation</h3><div class="v3d-rec is-${esc(p.rec)}"><p>${esc(p.recText)}</p></div></div>
    <p class="v3d-small v3d-legal">Planning aid, not legal advice. Supplier names marked reported/inferred are unverified.</p>
    ${extra ? `<div class="v3d-extra">${extra}</div>` : ''}`;
}

// ---------------------------------------------------------------- planner
export function presetsHtml(model, cls) {
  return PRESETS.map((p, i) => `<button type="button" data-v3d-act="preset" data-i="${i}">${esc(p.name)} <small>${model.score(cls, model.presetOverride(cls, p.tags)).pct.toFixed(0)}%</small></button>`).join('');
}
export function presetNotesHtml() {
  return PRESETS.filter((p) => p.caveat).map((p) => `<div class="v3d-presetnote"><b>${esc(p.name)}:</b> ${esc(p.caveat)}</div>`).join('');
}
export function rowsHtml(sc) {
  return sc.rows.map(({ l, e, o, st }) => `<div class="v3d-prow" data-id="${esc(l.id)}">
      <div class="v3d-pname">${esc(l.name)}<small>${esc(l.covers)}</small></div>
      <div class="v3d-psub"><b data-st>${st.toFixed(1)}</b><small data-sh>${sc.tot ? (st / sc.tot * 100).toFixed(1) : '0.0'}%</small></div>
      <label class="v3d-pin">Qty <input type="number" min="0" max="${MAX_FIELD}" step="1" value="${e.qty}" data-f="qty" aria-label="${esc(l.name)} quantity"></label>
      <label class="v3d-pin">× Unit <input type="number" min="0" max="${MAX_FIELD}" step="0.1" value="${e.unit}" data-f="unit" aria-label="${esc(l.name)} unit cost (relative)"></label>
      ${originButtons(o, l.id)}
    </div>`).join('');
}
export function leversHtml(model, cls, sc) {
  const base = sc.pct;
  const items = model.levers(cls, sc);
  if (!items.length) return '<li class="v3d-none">Every line is already US-made.</li>';
  // "clears" uses the same exact verdicts as the PASS / FAIL badges
  return items.map(({ r, pct, p28, p29 }) => `<li><button type="button" data-v3d-act="lever" data-id="${esc(r.l.id)}" title="Switch this line to US-made"><span>${esc(r.l.name)}${r.o === 'unk' ? ' <i>(unknown)</i>' : ''}</span><b>+${(pct - base).toFixed(1)} pts</b><small>to ${pct.toFixed(1)}%${p28 && !sc.p28 ? ' · clears 65%' : ''}${p29 && !sc.p29 ? ' · clears 75%' : ''}</small></button></li>`).join('');
}
/** PASS / FAIL for both periods. The score already carries the exact strictly-above verdicts. */
export function verdicts(sc) { return { p28: sc.p28, p29: sc.p29 }; }
/** Note for a plan that sits on a threshold: an exact tie, or short of it by less than the displayed precision. Passing plans never get it. */
function thresholdNote(sc) {
  const note = (t) => `<div class="v3d-unkwarn">${t}</div>`;
  for (const [t, pass, tie] of [[65, sc.p28, sc.t28], [75, sc.p29, sc.t29]]) {
    if (pass) continue;
    if (tie) return note('Exactly at a threshold fails: the share must be strictly above it.');
    if (sc.pct < t && t - sc.pct < 0.05) return note(`Rounds to ${t}.0% but is not above it: the share must be strictly above ${t}%.`);
  }
  return '';
}
export function resultHtml(sc) {
  const pct = sc.pct, { p28, p29 } = verdicts(sc);
  const unk = sc.rows.filter((r) => r.o === 'unk' && r.st > 0).reduce((a, r) => a + r.st, 0);
  return `<div class="v3d-small v3d-result-k">US component-cost share (relative placeholder costs)</div>
    <div class="v3d-pct" data-pct>${pct.toFixed(1)}%</div>
    <div class="v3d-bar"><i style="width:${Math.min(100, pct)}%"></i><span class="v3d-mk" style="left:65%"><span>65%</span></span><span class="v3d-mk" style="left:75%"><span>75%</span></span></div>
    <div class="v3d-verdicts"><div>Through 2028 (need &gt;65%)<b class="${p28 ? 'v3d-pass' : 'v3d-fail'}" data-year="2028">${p28 ? 'PASS' : 'FAIL'}</b></div><div>From 2029 (need &gt;75%)<b class="${p29 ? 'v3d-pass' : 'v3d-fail'}" data-year="2029">${p29 ? 'PASS' : 'FAIL'}</b></div></div>
    ${unk > 0 ? `<div class="v3d-unkwarn">${(unk / sc.tot * 100).toFixed(1)}% of cost has unknown origin and counts as foreign.</div>` : ''}
    ${thresholdNote(sc)}`;
}
export function totalHtml(sc) {
  return `Total component cost: <b>${sc.tot.toFixed(1)}</b> relative units · US-made: <b>${sc.us.toFixed(1)}</b>`;
}

/** Inner HTML of the mini score bar. open: whether the explanatory text is expanded. */
export function scorebarHtml(model, cls, sc, open, uid) {
  const C = CLASSES[cls], pct = sc.pct, { p28, p29 } = verdicts(sc), ex = model.isExample(cls);
  return `<button type="button" class="v3d-score-toggle" data-v3d-act="score" aria-expanded="${open}" aria-controls="${uid}-more" title="US-content score. Expand for how it is calculated">
      <span class="v3d-st">US content · ${esc(C.short)}</span><b class="v3d-sv">${pct.toFixed(1)}%</b>
      <span class="v3d-svv"><span class="${p28 ? 'v3d-pass' : 'v3d-fail'}" data-year="2028">2028 ${p28 ? 'Pass' : 'Fail'}</span><span class="${p29 ? 'v3d-pass' : 'v3d-fail'}" data-year="2029">2029 ${p29 ? 'Pass' : 'Fail'}</span></span>
      ${ex ? '<span class="v3d-example">Example plan</span>' : ''}<span class="v3d-chev" aria-hidden="true"></span>
    </button>
    <button type="button" class="v3d-score-edit" data-v3d-act="edit">Edit plan</button>
    <div class="v3d-score-more" id="${uid}-more"${open ? '' : ' hidden'}><p>${ex ? `Example: US-made joints, frame, and harness on the ${esc(C.short)} platform. ` : ''}Share of component cost that is US-made, with relative placeholder costs. Needs &gt;65% for items delivered 2024–2028 and &gt;75% from 2029; exactly 65.0% fails. Unknown origin counts as foreign.</p></div>`;
}

export function partListHtml(cx, q) {
  const { cls } = cx;
  const rows = partsFor(cls).map((p0) => partFor(p0.id, cls))
    .filter((p) => !q || (p.title + ' ' + p.label).toLowerCase().includes(q))
    .map((p) => `<li><button type="button" data-v3d-act="pick" data-id="${esc(p.id)}"${cx.selected === p.id ? ' aria-current="true"' : ''}><span class="v3d-sw" style="background:${esc(cx.modeColor(p, cls))}"></span><span class="v3d-pl-name">${esc(shortName(p))}</span><small>${esc(keySpec(p, cls))}</small></button></li>`);
  return rows.length ? rows.join('') : '<li class="v3d-none">No parts match that filter.</li>';
}

export { O_NAME, O_SHORT };
