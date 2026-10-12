// Small shared helpers for the stations.
import { PARTS, OVERRIDES, KEYSPEC, SUBSYSTEMS, ORIGIN_REC } from './data/planner-parts.js';
import { CLASSES } from './data/classes.js';
import { PART_ALIAS } from './data/site-data.js';

export const $ = (s, root = document) => root.querySelector(s);
export const $$ = (s, root = document) => Array.from(root.querySelectorAll(s));
export const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/** True only for a key the object really has: hash values like 'constructor' or 'toString' must never match inherited members. */
export const has = (obj, key) => obj != null && Object.prototype.hasOwnProperty.call(obj, key);
const PART_BY_ID = Object.assign(Object.create(null), Object.fromEntries(PARTS.map((p) => [p.id, p])));
export const canonPart = (id) => (has(PART_ALIAS, id) ? PART_ALIAS[id] : id);

/** A part with the per-class overrides applied (labels, specs and origin notes differ per platform). */
export function partFor(id, classId = 'full') {
  const base = PART_BY_ID[canonPart(id)];
  if (!base) return null;
  return Object.assign({}, base, (OVERRIDES[classId] || {})[base.id] || {});
}
export const shortName = (p) => String(p.label).split(' · ')[0];
export function keySpec(p, classId) {
  const ks = (KEYSPEC[classId] || {})[p.id];
  if (p.dof) return ks ? `${p.dof} DOF · ${ks}` : `${p.dof} DOF`;
  return ks || '';
}
export const isClass = (id) => has(CLASSES, id);
export const className = (classId) => (isClass(classId) ? CLASSES[classId].short : '');
export { SUBSYSTEMS, ORIGIN_REC, CLASSES };

export function daysUntil(iso) {
  const d = new Date(iso + 'T00:00:00');
  return Math.max(0, Math.ceil((d - new Date()) / 86400000));
}

/** Row of "go" buttons. Links are plain hash targets handled by the app router. */
export function xlinks(links) {
  if (!links || !links.length) return '';
  return '<div class="xlinks">' + links.map(([h, t]) => `<button class="btn sm" type="button" data-go="${esc(h)}">${esc(t)}</button>`).join('') + '</div>';
}

let toastTimer = 0;
export function toast(msg) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg; t.classList.add('on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('on'), 2000);
}

/** Scroll an element into the middle of its station and flash it. */
export function flash(el) {
  if (!el) return;
  const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  el.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'center' });
  el.classList.add('flash');
  setTimeout(() => el.classList.remove('flash'), 1800);
}

/** Hash helpers. Form: #station or #station?key=value&key=value */
export function parseHash(order) {
  const raw = location.hash.replace(/^#/, '');
  const [rawName, q] = raw.split('?');
  const name = (rawName || '').replace(/\/+$/, '').toLowerCase();
  const alias = { overview: 'plan' };
  // an empty hash is the robot; any other name that is not a station (the skip link's #scene, a typo) is ignored by the router
  const known = order.includes(alias[name] || name);
  const station = !name ? 'robot' : (known ? (alias[name] || name) : null);
  // a null-prototype bag, and a decoder that cannot throw: a bad escape such as %ZZ is kept as typed
  const decode = (s) => { try { return decodeURIComponent(s); } catch (e) { return s; } };
  const params = Object.create(null);
  if (q) for (const kv of q.split('&')) { const [k, v] = kv.split('='); if (k) params[decode(k)] = decode(v || ''); }
  return { station, params };
}
