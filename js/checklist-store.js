// Checklist statuses, saved in this browser only. One key, shared by every view that shows the progress.
import { CHECKLIST } from './data/site-data.js';

const KEY = 'hsp-checklist-v1';
const CYCLE = { c: 'p', p: 'o', o: 'c' };       // Confirmed -> In Progress -> Open -> Confirmed
export const STATUS_NAME = { c: 'Confirmed', p: 'In progress', o: 'Open' };

let state = load();
const listeners = new Set();

function load() {
  try { const s = JSON.parse(localStorage.getItem(KEY)); if (s && typeof s === 'object') return s; } catch (e) { /* storage blocked or corrupt */ }
  return {};
}
function save() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* storage blocked */ } }
function emit() { listeners.forEach((fn) => { try { fn(); } catch (err) { console.error(err); } }); }

export const status = (id) => (CYCLE[state[id]] ? state[id] : 'o');
export function cycle(id) { state[id] = CYCLE[status(id)]; save(); emit(); }
export function reset() { state = {}; save(); emit(); }
export function counts() {
  const n = { c: 0, p: 0, o: 0 };
  for (const item of CHECKLIST) n[status(item.id)]++;
  return Object.assign(n, { total: CHECKLIST.length });
}
/** Share code: one letter per item, in order. */
export const encode = () => CHECKLIST.map((c) => status(c.id)).join('');
export function applyCode(code) {
  if (!new RegExp(`^[cpo]{${CHECKLIST.length}}$`).test(code)) return false;
  const next = {};
  CHECKLIST.forEach((c, i) => { next[c.id] = code[i]; });
  state = next; save(); emit();
  return true;
}
export const differsFrom = (code) => CHECKLIST.some((c, i) => status(c.id) !== code[i]);
export function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }
