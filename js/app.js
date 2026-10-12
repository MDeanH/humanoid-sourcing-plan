// Humanoid Sourcing Plan. Six stations on a turntable ring: Robot (the main page), Globe, Plan, Checklist,
// Timeline, Planner. Navigating spins the ring to the target station; clicking a part on the robot spins to the globe.
import { createRing } from './ring.js';
import { parseHash, $, $$ } from './ui.js';
import { counts } from './checklist-store.js';
import { createRobotView } from './views/robot.js';
import { createGlobeView } from './views/globe.js';
import { createPlanView } from './views/plan.js';
import { createChecklistView } from './views/checklist.js';
import { createTimelineView } from './views/timeline.js';
import { createPlannerView } from './views/planner.js';

const ORDER = ['robot', 'globe', 'plan', 'checklist', 'timeline', 'planner'];
const NAMES = { robot: 'Robot', globe: 'Globe', plan: 'Plan', checklist: 'Checklist', timeline: 'Timeline', planner: 'Planner' };
const scene = $('#scene'), ringEl = $('#ring');
const els = Object.fromEntries(ORDER.map((id) => [id, $('#st-' + id)]));

/** Navigate to a hash target such as "globe?part=kneeL". Re-routes even when the hash is unchanged. */
function go(hash) {
  const target = '#' + hash;
  if (location.hash === target) route(); else location.hash = hash;
}
const ctx = { go };

const views = {
  robot: createRobotView(els.robot, ctx),
  globe: createGlobeView(els.globe, ctx),
  plan: createPlanView(els.plan, ctx),
  checklist: createChecklistView(els.checklist, ctx),
  timeline: createTimelineView(els.timeline, ctx),
  planner: createPlannerView(els.planner, ctx),
};

const pending = {};      // latest params per station, read when the ring comes to rest
const ring = createRing({
  scene, ring: ringEl, stations: ORDER.map((id) => els[id]),
  onSpinStart: (from, to, delta) => { const v = views[ORDER[from]]; if (v.spinAway) v.spinAway(delta); },
  onSpinEnd: (idx, from) => {
    const leaving = ORDER[from], arriving = ORDER[idx];
    if (leaving !== arriving) views[leaving].leave();
    views[arriving].enter(pending[arriving] || {});
    paintDock();
  },
});

/* ---------------------------------------------------------------- routing */
function route() {
  const { station, params } = parseHash(ORDER);
  const idx = ORDER.indexOf(station);
  pending[station] = params;
  views[station].prepare(params);
  paintNav(station);
  if (idx === ring.active && !ring.spinning) views[station].enter(params);
  else ring.spinTo(idx, { instant: !booted });
  paintDock(idx);
}
let booted = false;
window.addEventListener('hashchange', route);

/* ---------------------------------------------------------------- nav, menu, dock */
function paintNav(station) {
  $$('[data-station]').forEach((a) => {
    const on = a.dataset.station === station;
    a.classList.toggle('on', on);
    if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });
}
const ticks = $('#dockTicks');
ticks.innerHTML = ORDER.map((id, i) => `<button type="button" class="dock-tick" role="tab" data-tick="${i}" aria-label="${NAMES[id]}"></button>`).join('');
function paintDock(idx) {
  const i = typeof idx === 'number' ? idx : ring.active;
  $$('.dock-tick').forEach((t, k) => { t.classList.toggle('on', k === i); t.setAttribute('aria-selected', String(k === i)); });
  $('#dockLabel').innerHTML = `<span class="dock-num">${String(i + 1).padStart(2, '0')} / ${String(ORDER.length).padStart(2, '0')}</span> <span class="dock-name">${NAMES[ORDER[i]]}</span>`;
}
const step = (d) => { const base = ring.spinning ? ORDER.indexOf(parseHash(ORDER).station) : ring.active; go(ORDER[(base + d + ORDER.length) % ORDER.length]); };
$('#dockPrev').addEventListener('click', () => step(-1));
$('#dockNext').addEventListener('click', () => step(1));
ticks.addEventListener('click', (e) => { const t = e.target.closest('[data-tick]'); if (t) go(ORDER[+t.dataset.tick]); });

const menu = $('#menu'), toggle = $('#navToggle');
function setMenu(open) {
  menu.hidden = !open;
  toggle.setAttribute('aria-expanded', String(open));
  document.body.classList.toggle('menu-open', open);
  $('.nav-toggle-label', toggle).textContent = open ? 'Close' : 'Menu';
}
toggle.addEventListener('click', () => setMenu(menu.hidden));
menu.addEventListener('click', () => setMenu(false));
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !menu.hidden) { setMenu(false); toggle.focus(); return; }
  // arrow keys turn the ring when no field has focus
  const t = e.target;
  if (/^(INPUT|SELECT|TEXTAREA)$/.test(t.tagName) || t.isContentEditable || e.altKey || e.ctrlKey || e.metaKey) return;
  if (e.key === 'ArrowRight') step(1); else if (e.key === 'ArrowLeft') step(-1);
});

/* One delegated handler for every "go" button and station link on the page. */
document.addEventListener('click', (e) => {
  const g = e.target.closest('[data-go]');
  if (g) { e.preventDefault(); go(g.dataset.go); return; }
  const a = e.target.closest('a[data-station]');
  if (a) { e.preventDefault(); go(a.dataset.station); }
});

/* ---------------------------------------------------------------- boot */
(function initCounts() { const c = counts(); const n = $('#navCount'); if (n) n.textContent = `${c.c}/${c.total}`; })();
route();
booted = true;
paintDock();
// keep the countdowns honest if the page stays open past midnight
setInterval(() => Object.values(views).forEach((v) => v.refresh && v.refresh()), 3600 * 1000);
window.__hsp = { ring, views, go, ORDER };
