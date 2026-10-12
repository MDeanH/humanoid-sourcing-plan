// Reads design-token colors from CSS custom properties at runtime and resolves them to '#rrggbb'
// (any CSS color syntax works, including oklch/color-mix, because the browser does the parsing).
export function createCssColors(root) {
  let cv = document.createElement('canvas');
  cv.width = cv.height = 1;
  let ctx = null;
  try { ctx = cv.getContext('2d', { willReadFrequently: true }); } catch (e) { ctx = null; }
  const cache = new Map();
  const hex2 = (n) => n.toString(16).padStart(2, '0');

  function resolve(css) {
    if (!css) return null;
    if (ctx) {
      try {
        ctx.fillStyle = '#010203';
        ctx.fillStyle = css;          // an unparsable value leaves the sentinel in place
        ctx.clearRect(0, 0, 1, 1);
        ctx.fillRect(0, 0, 1, 1);
        const d = ctx.getImageData(0, 0, 1, 1).data;
        const sentinel = d[0] === 1 && d[1] === 2 && d[2] === 3 && d[3] === 255;
        if (d[3] > 0 && !sentinel) return '#' + hex2(d[0]) + hex2(d[1]) + hex2(d[2]);
        if (sentinel && /^#010203$/i.test(css.trim())) return '#010203';
        return null;
      } catch (e) { /* canvas readback blocked: fall through to the raw value */ }
    }
    return /^#[0-9a-f]{3,8}$|^rgb|^hsl/i.test(css) ? css : null;
  }

  return {
    /** Token value as '#rrggbb', or the fallback when the variable is missing or unparsable. */
    read(name, fallback) {
      const key = name + '|' + fallback;
      if (cache.has(key)) return cache.get(key);
      let raw = '';
      try { raw = getComputedStyle(root).getPropertyValue(name).trim(); } catch (e) { raw = ''; }
      const out = resolve(raw) || resolve(fallback) || fallback;
      cache.set(key, out);
      return out;
    },
    refresh() { cache.clear(); },
    dispose() { cache.clear(); ctx = null; if (cv) { cv.width = cv.height = 0; } cv = null; },
  };
}
