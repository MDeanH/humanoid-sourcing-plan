// Pure planner logic for the 3D viewer: part lookup, per-platform plan state, scoring, persistence, CSV.
// No DOM and no THREE here. All storage access is wrapped in try/catch so the model keeps working when storage throws.
import { PARTS, OVERRIDES, KEYSPEC } from '../data/planner-parts.js';
import { ORDER } from '../data/classes.js';
import { BOM, PRESETS, DEFAULT_PRESET } from '../data/bom.js';

export const O_NAME = { us: 'US-made (domestic)', fx: 'Foreign', unk: 'Unknown origin (counts as foreign)' };
export const O_SHORT = { us: 'US', fx: 'Foreign', unk: 'Unknown' };
export const ORIGINS = ['us', 'fx', 'unk'];

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// ---------------------------------------------------------------- part helpers (static data, memoized)
const PART_BY_ID = Object.fromEntries(PARTS.map((p) => [p.id, p]));
const pfCache = {};
const listCache = {};
const idSetCache = {};
const LINE_BY = Object.fromEntries(ORDER.map((c) => [c, Object.fromEntries(BOM[c].map((l) => [l.id, l]))]));

/** Base part merged with its per-platform override. Memoized: the same object is returned every time. */
export function partFor(id, cls) {
  const c = (pfCache[cls] ||= {});
  return (c[id] ||= Object.assign({}, PART_BY_ID[id], (OVERRIDES[cls] || {})[id] || {}));
}
/** Base part records that exist on this platform (use partFor for the merged record). */
export function partsFor(cls) { return (listCache[cls] ||= PARTS.filter((p) => !p.classes || p.classes.includes(cls))); }
export function hasPart(cls, id) { return (idSetCache[cls] ||= new Set(partsFor(cls).map((p) => p.id))).has(id); }
export function shortName(p) { return p.label.split(' · ')[0]; }
export function keySpec(p, cls) {
  const ks = (KEYSPEC[cls] || {})[p.id];
  if (p.dof) return ks ? `${p.dof} DOF · ${ks}` : `${p.dof} DOF`;
  return ks || '';
}
export function lineById(cls, id) { return LINE_BY[cls][id]; }
export const jointLines = (cls) => BOM[cls].filter((l) => l.tag === 'joints').map((l) => l.id);
export function linesOf(p, cls) { return p.calc === '@joints' ? jointLines(cls) : (LINE_BY[cls][p.calc] ? [p.calc] : ['other']); }
export function totalDof(cls) { return partsFor(cls).reduce((a, p) => a + (p.dof || 0), 0); }

// ---------------------------------------------------------------- numeric hygiene
/** Largest quantity or unit cost accepted. Keeps every subtotal and total finite (1e9 * 1e9 * 20 lines is far below 1e308). */
export const MAX_FIELD = 1e9;
/** Clamp a typed or stored value to a finite number in [0, MAX_FIELD]. NaN and negatives become 0, Infinity becomes the maximum. */
export function clampField(v) {
  v = +v;
  if (!(v > 0)) return 0;
  return v > MAX_FIELD ? MAX_FIELD : v;
}

// The pass/fail rules are strict inequalities on a ratio (share > 65 %, share > 75 %). With binary floats a plan that is
// exactly 65 % in decimal arithmetic (3 x 14.3 against 1 x 23.1) lands on 65.00000000000001 and would pass. Totals are
// therefore summed and compared as exact decimals: each value is read from its shortest round-trip decimal string
// (what the person typed) and kept as a BigInt numerator over a power of ten.
const TEN = 10n;
function toDec(x) {
  const m = /^(\d+)(?:\.(\d+))?(?:e([+-]\d+))?$/.exec(String(x));
  if (!m) return { n: 0n, e: 0 };
  let n = BigInt(m[1] + (m[2] || ''));
  let e = (m[2] ? m[2].length : 0) - (m[3] ? +m[3] : 0);
  if (e < 0) { n *= TEN ** BigInt(-e); e = 0; }
  return { n, e };
}
const decMul = (a, b) => ({ n: a.n * b.n, e: a.e + b.e });
function decAdd(a, b) {
  if (a.e === b.e) return { n: a.n + b.n, e: a.e };
  return a.e > b.e ? { n: a.n + b.n * TEN ** BigInt(a.e - b.e), e: a.e } : { n: b.n + a.n * TEN ** BigInt(b.e - a.e), e: b.e };
}
const decToNum = (a) => Number(`${a.n}e-${a.e}`);
const ZERO = { n: 0n, e: 0 };
const exactCache = new Map();
/** Exact decimal qty x unit for a line (memoized: the same few values are scored over and over while typing). */
function exactSubtotal(qty, unit) {
  const key = qty + '|' + unit;
  let v = exactCache.get(key);
  if (!v) {
    if (exactCache.size > 4000) exactCache.clear();
    v = decMul(toDec(qty), toDec(unit));
    exactCache.set(key, v);
  }
  return v;
}
/** Compare share (us / tot) against a whole-number percentage threshold exactly. Returns 1 above, 0 equal, -1 below. */
function cmpShare(us, tot, threshold) {
  const k = Math.max(us.e, tot.e);
  const u = us.n * TEN ** BigInt(k - us.e), t = tot.n * TEN ** BigInt(k - tot.e);
  const l = u * 100n, r = BigInt(threshold) * t;
  return l > r ? 1 : l === r ? 0 : -1;
}
/** Share of the total as a percentage, from the exact values (an exact 65 % is exactly 65, not 65.00000000000001). */
function exactPct(us, tot) {
  if (tot.n === 0n) return 0;
  const k = Math.max(us.e, tot.e);
  const u = us.n * TEN ** BigInt(k - us.e), t = tot.n * TEN ** BigInt(k - tot.e);
  return Number((u * 100n * 1000000000000n) / t) / 1e12;
}

// ---------------------------------------------------------------- plan state
const subtotal = (e) => clampField(e.qty) * clampField(e.unit);

export function createPlanModel(storagePrefix) {
  const prefix = storagePrefix || 'hsp-plan-v1-';
  const planner = {};
  const edited = new Set(); // platforms whose plan differs from the example (or was saved earlier)

  const fresh = (cls) => {
    const tags = PRESETS[DEFAULT_PRESET].tags;
    return Object.fromEntries(BOM[cls].map((l) => [l.id, { o: tags.includes(l.tag) ? 'us' : 'fx', qty: l.qty, unit: l.unit }]));
  };
  for (const cls of ORDER) {
    planner[cls] = fresh(cls);
    try {
      const raw = localStorage.getItem(prefix + cls);
      if (raw) {
        edited.add(cls);
        const s = JSON.parse(raw);
        if (s && typeof s === 'object') {
          for (const l of BOM[cls]) {
            if (s[l.id] && ORIGINS.includes(s[l.id].o)) planner[cls][l.id] = { o: s[l.id].o, qty: clampField(s[l.id].qty), unit: clampField(s[l.id].unit) };
          }
        }
      }
    } catch (e) { /* storage unavailable or corrupt: keep the example plan */ }
  }

  function save(cls) {
    edited.add(cls);
    try { localStorage.setItem(prefix + cls, JSON.stringify(planner[cls])); } catch (e) { /* ignore */ }
  }

  const model = {
    planner,
    prefix,
    isExample: (cls) => !edited.has(cls),
    save,
    reset(cls) {
      planner[cls] = fresh(cls);
      edited.delete(cls);
      try { localStorage.removeItem(prefix + cls); } catch (e) { /* ignore */ }
    },
    /** Least favorable origin among the lines a part follows (a part inside every joint follows all joint lines). */
    originOf(p, cls) {
      const ids = linesOf(p, cls);
      let r = 'us';
      for (const id of ids) {
        const o = planner[cls][id].o;
        if (o === 'fx') return 'fx';
        if (o === 'unk') r = 'unk';
      }
      return r;
    },
    /**
     * Score a platform's plan. pct is the US share of component cost; p28 / p29 say whether it is strictly above 65 % / 75 %
     * (decided in exact decimal arithmetic, so a tie fails); t28 / t29 flag an exact tie.
     */
    score(cls, override) {
      const pl = planner[cls];
      let totX = ZERO, usX = ZERO;
      const rows = BOM[cls].map((l) => {
        const e = pl[l.id];
        const o = override && override[l.id] ? override[l.id] : e.o;
        const st = subtotal(e);
        const x = exactSubtotal(clampField(e.qty), clampField(e.unit));
        totX = decAdd(totX, x);
        if (o === 'us') usX = decAdd(usX, x);
        return { l, e, o, st };
      });
      const c65 = totX.n > 0n ? cmpShare(usX, totX, 65) : -1, c75 = totX.n > 0n ? cmpShare(usX, totX, 75) : -1;
      return {
        pct: exactPct(usX, totX), tot: decToNum(totX), us: decToNum(usX), rows,
        p28: c65 > 0, p29: c75 > 0, t28: c65 === 0, t29: c75 === 0,
      };
    },
    setOrigin(cls, key, o) {
      const ids = key === '@joints' ? jointLines(cls) : [key];
      for (const id of ids) if (planner[cls][id]) planner[cls][id].o = o;
      save(cls);
    },
    setField(cls, id, field, value) {
      if (!planner[cls][id]) return;
      planner[cls][id][field] = clampField(parseFloat(value));
      save(cls);
    },
    presetOverride(cls, tags) { return Object.fromEntries(BOM[cls].map((l) => [l.id, tags.includes(l.tag) ? 'us' : 'fx'])); },
    applyPreset(cls, i) {
      const ov = model.presetOverride(cls, PRESETS[i].tags);
      for (const l of BOM[cls]) planner[cls][l.id].o = ov[l.id];
      save(cls);
    },
    /** Up to five non-US lines that raise the score the most if switched to US. */
    levers(cls, sc) {
      return sc.rows.filter((r) => r.o !== 'us' && r.st > 0)
        .map((r) => { const s2 = model.score(cls, { [r.l.id]: 'us' }); return { r, pct: s2.pct, p28: s2.p28, p29: s2.p29 }; })
        .sort((a, b) => b.pct - a.pct).slice(0, 5);
    },
    csv(cls, C) {
      const sc = model.score(cls);
      const cell = (v) => { const t = String(v); return /[",\n]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t; };
      const lines = [['platform', 'line', 'covers', 'qty', 'unit_cost_relative', 'subtotal', 'share_pct', 'made_in', 'counts_as'].join(',')];
      for (const r of sc.rows) {
        lines.push([`${C.name} (${C.short})`, r.l.name, r.l.covers, r.e.qty, r.e.unit, r.st.toFixed(2), sc.tot ? (r.st / sc.tot * 100).toFixed(2) : '0', O_SHORT[r.o], r.o === 'us' ? 'domestic' : 'foreign'].map(cell).join(','));
      }
      lines.push(['', 'TOTAL', '', '', '', sc.tot.toFixed(2), '100', '', ''].join(','));
      lines.push(['', `US share ${sc.pct.toFixed(2)}% (must be >65% through 2028 and >75% from 2029). Costs are relative placeholders.`, '', '', '', '', '', '', ''].map(cell).join(','));
      return lines.join('\n');
    },
  };
  return model;
}
