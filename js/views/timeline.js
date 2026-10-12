// Station 5: the timeline to the January 1, 2028 Conditional Approval deadline.
import { $, esc, xlinks, flash, daysUntil } from '../ui.js';
import { MILESTONES } from '../data/site-data.js';

export function createTimelineView(el) {
  el.innerHTML = `
  <div class="page">
    <header class="page-head">
      <p class="eyebrow">Timeline</p>
      <h1 class="h1" data-role="title" tabindex="-1">Timeline to the Conditional Approval deadline</h1>
      <p class="lede"><span class="tag fixed">Fixed</span> dates come from the rule text or published guidance. <span class="tag proposed">Proposed</span> milestones are this plan’s sequencing, back-planned from January 1, 2028, and can move. Each milestone links to the checklist items and supplier pins it depends on.</p>
    </header>
    <dl class="readouts big">
      <div><dd data-role="days">—</dd><dt>days to Jan 1, 2028, the Conditional Approval application deadline</dt></div>
      <div><dd data-role="quarters">—</dd><dt>quarters left to apply</dt></div>
      <div><dd data-role="days29">—</dd><dt>days until the bar rises to above 75%, Jan 1, 2029</dt></div>
    </dl>
    <ol class="tl" data-role="tl"></ol>
  </div>`;

  function paint() {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const sorted = MILESTONES.slice().sort((a, b) => a.date.localeCompare(b.date));
    let marked = false;
    $('[data-role=tl]', el).innerHTML = sorted.map((m) => {
      const past = new Date(m.date + 'T00:00:00') < today;
      let cls = m.kind + (past ? ' past' : '');
      if (!past && !marked) { cls += ' next'; marked = true; }
      return `<li id="tl-${m.id}" class="${cls}"><div class="when mono">${esc(m.label)} <span class="tag ${m.kind}">${m.kind}</span>${past ? '<span class="tag">done or in effect</span>' : ''}${cls.includes('next') ? '<span class="tag ok">next</span>' : ''}</div>
        <h3>${esc(m.h)}</h3><p>${esc(m.p)}</p>${xlinks(m.links)}</li>`;
    }).join('');
    const days = daysUntil('2028-01-01');
    $('[data-role=days]', el).textContent = days;
    $('[data-role=quarters]', el).textContent = (days / 91.3).toFixed(1);
    $('[data-role=days29]', el).textContent = daysUntil('2029-01-01');
  }
  paint();

  return {
    prepare() {},
    enter(params) {
      const t = $('[data-role=title]', el);
      if (params && params.m) flash($('#tl-' + params.m, el));
      else el.scrollTop = 0;
    },
    leave() {},
    refresh: paint,
    destroy() {},
  };
}
