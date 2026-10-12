// Station 4: the compliance checklist. Click a status to cycle it. Saved in this browser; shareable through the URL.
import { $, $$, esc, xlinks, flash, toast } from '../ui.js';
import { CHECKLIST } from '../data/site-data.js';
import { status, cycle, reset, counts, encode, applyCode, differsFrom, subscribe, STATUS_NAME } from '../checklist-store.js';

const EV = { ok: 'FCC-confirmed', gen: 'General guidance', open: 'Open question' };

export function createChecklistView(el, ctx) {
  el.innerHTML = `
  <div class="page">
    <header class="page-head row-between">
      <div>
        <p class="eyebrow">Checklist</p>
        <h1 class="h1" data-role="title" tabindex="-1">US compliance checklist</h1>
        <p class="lede">What a new robot model needs before it can be marketed or sold in the US. Click a status to cycle it: Confirmed, In progress, Open. Statuses are saved in this browser.</p>
        <dl class="legend">
          <div><dt><span class="tag ok">FCC-confirmed</span></dt><dd>matches the FCC FAQ</dd></div>
          <div><dt><span class="tag gen">General guidance</span></dt><dd>standard practice; confirm with counsel or a test lab</dd></div>
          <div><dt><span class="tag open">Open question</span></dt><dd>unsettled</dd></div>
        </dl>
      </div>
      <div class="actions">
        <button type="button" class="btn sm" data-role="share">Copy share link</button>
        <button type="button" class="btn ghost sm" data-role="reset">Reset statuses</button>
      </div>
    </header>
    <div class="progress" aria-label="Checklist progress">
      <div class="meter" data-role="meter"><i class="c"></i><i class="p"></i><i class="o"></i></div>
      <p class="mono" data-role="counts"></p>
    </div>
    <ol class="ck">${CHECKLIST.map((c) => `
      <li id="ck-${c.id}">
        <div class="ck-head"><span class="ck-num mono">${String(c.id).padStart(2, '0')}</span><h3>${esc(c.h)}</h3>
          <button type="button" class="status" data-ck="${c.id}" title="Click to cycle the status"></button></div>
        <div class="tags">${c.ev.map((e) => `<span class="tag ${e}">${EV[e]}</span>`).join('')}</div>
        <div class="ck-body">${c.p.map((t) => `<p>${t}</p>`).join('')}</div>
        ${xlinks(c.links)}
      </li>`).join('')}</ol>
    <p class="disclaimer">The checklist is a planning tool, not a compliance certification. A status you set here records your own progress; it does not change what the rule requires.</p>
  </div>`;

  function paint() {
    for (const c of CHECKLIST) {
      const b = $(`.status[data-ck="${c.id}"]`, el), s = status(c.id);
      b.className = 'status ' + s;
      b.innerHTML = `<i class="sq"></i>${STATUS_NAME[s]}`;
      b.setAttribute('aria-label', `Item ${c.id}: ${STATUS_NAME[s]}. Click to change.`);
    }
    const n = counts(), t = n.total;
    $('.c', el).style.width = (100 * n.c / t) + '%'; $('.p', el).style.width = (100 * n.p / t) + '%'; $('.o', el).style.width = (100 * n.o / t) + '%';
    $('[data-role=counts]', el).textContent = `${n.c} confirmed · ${n.p} in progress · ${n.o} open · of ${t}`;
    const nav = document.getElementById('navCount'); if (nav) nav.textContent = `${n.c}/${t}`;
  }
  const unsub = subscribe(paint);
  paint();

  $$('.status', el).forEach((b) => b.addEventListener('click', () => cycle(+b.dataset.ck)));
  $('[data-role=share]', el).addEventListener('click', () => {
    const url = location.origin + location.pathname + '#checklist?s=' + encode();
    (navigator.clipboard ? navigator.clipboard.writeText(url) : Promise.reject(new Error('no clipboard'))).then(() => toast('Share link copied'), () => { window.prompt('Copy this link', url); });
  });
  $('[data-role=reset]', el).addEventListener('click', () => { if (window.confirm(`Reset all ${CHECKLIST.length} statuses to Open?`)) reset(); });

  return {
    prepare(params) {
      if (params.s && /^[cpo]+$/.test(params.s)) {
        if (params.s.length === CHECKLIST.length && differsFrom(params.s) && window.confirm('This link carries a checklist state. Replace the statuses saved in this browser with it?')) {
          if (applyCode(params.s)) toast('Checklist state loaded from link');
        }
        try { history.replaceState(null, '', '#checklist'); } catch (e) { /* ignore */ }
      }
    },
    enter(params) {
      const t = $('[data-role=title]', el);
      if (params && params.item) flash($('#ck-' + params.item, el));
      else el.scrollTop = 0;
    },
    leave() {},
    refresh() {},
    destroy() { unsub(); },
  };
}
