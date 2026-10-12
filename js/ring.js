// Turntable ring. The stations are the faces of a drum seen from outside; "spinning" rotates the drum about its
// vertical axis and brings the target face to the front. At rest only the active station is laid out flat
// (transform: none, so text stays crisp) and the others are hidden and inert. During a spin every station is
// placed on the drum and the drum is animated with the Web Animations API, pulling back a little at the midpoint.

const mod = (a, n) => ((a % n) + n) % n;

export function createRing({ scene, ring, stations, onSpinStart, onSpinEnd }) {
  const N = stations.length;
  const STEP = 360 / N;
  const mq = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  let active = 0, R = 0, spinning = false, queued = null, anim = null, safety = 0, destroyed = false;

  /** Shortest signed step count from station a to station b (3 of 6 goes forward). */
  const steps = (a, b) => { let d = mod(b - a, N); if (d > N / 2) d -= N; return d; };

  function measure() {
    const W = scene.clientWidth || window.innerWidth;
    R = (W / 2) / Math.tan(Math.PI / N);
    scene.style.setProperty('--ring-r', R.toFixed(1) + 'px');
    // the perspective distance must exceed 0.87 x the width or the neighbouring faces would show at rest
    scene.style.setProperty('--persp', Math.round(Math.max(W * 1.9, 2000)) + 'px');
  }

  /** Flat layout: only the active station is visible and interactive. */
  function layoutRest() {
    ring.style.transform = 'none';
    stations.forEach((el, i) => {
      const on = i === active;
      el.style.transform = on ? 'none' : `rotateY(${steps(active, i) * STEP}deg) translateZ(${R}px)`;
      el.style.visibility = on ? 'visible' : 'hidden';
      el.inert = !on;
      el.classList.toggle('is-active', on);
      el.setAttribute('aria-hidden', on ? 'false' : 'true');
    });
  }

  /** Drum layout used while spinning: every face placed on the drum, none interactive. */
  function layoutDrum() {
    stations.forEach((el, i) => {
      el.style.transform = `rotateY(${steps(active, i) * STEP}deg) translateZ(${R}px)`;
      el.style.visibility = 'visible';
      el.inert = true;
    });
  }

  function finish(target) {
    if (destroyed) return;
    clearTimeout(safety);
    const from = active;
    active = target;
    measure();                       // a resize during the spin was skipped: take it now
    layoutRest();
    if (anim) { try { anim.cancel(); } catch (e) { /* already gone */ } anim = null; }
    scene.classList.remove('spinning');
    spinning = false;
    try { onSpinEnd && onSpinEnd(active, from); } catch (err) { console.error(err); }
    if (queued !== null) { const q = queued; queued = null; if (q !== active) spinTo(q); }
  }

  /** Spin to station `target`. Resolves when the drum has stopped. Calls during a spin are queued (last one wins). */
  function spinTo(target, opts = {}) {
    if (destroyed) return Promise.resolve();
    if (spinning) { queued = target; return Promise.resolve(); }
    if (target === active) { layoutRest(); return Promise.resolve(); }
    const d = steps(active, target);
    const delta = d * STEP;                       // positive: the target lies to the right, the drum turns left
    const from = active;
    if (opts.instant || (mq && mq.matches)) {
      active = target; layoutRest();
      try { onSpinEnd && onSpinEnd(active, from); } catch (err) { console.error(err); }
      return Promise.resolve();
    }
    spinning = true;
    scene.classList.add('spinning');
    try { onSpinStart && onSpinStart(from, target, delta); } catch (err) { console.error(err); }
    layoutDrum();
    const duration = Math.round(820 + Math.abs(delta) * 3.2);
    const pull = Math.round(Math.min(380, 140 + Math.abs(delta) * 1.1));
    const base = `translateZ(${-R}px)`;
    return new Promise((resolve) => {
      let done = false;
      const end = () => { if (done) return; done = true; finish(target); resolve(); };
      try {
        anim = ring.animate([
          { transform: `${base} rotateY(0deg)` },
          { transform: `translateZ(${-R - pull}px) rotateY(${-delta / 2}deg)`, offset: 0.5 },
          { transform: `${base} rotateY(${-delta}deg)` },
        ], { duration, easing: 'cubic-bezier(0.65, 0, 0.2, 1)', fill: 'both' });
        anim.onfinish = end;
        anim.oncancel = end;
      } catch (err) { end(); return; }
      safety = setTimeout(end, duration + 400);
    });
  }

  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => { if (!spinning) { measure(); layoutRest(); } }) : null;
  if (ro) ro.observe(scene);
  measure();
  layoutRest();

  return {
    count: N,
    get active() { return active; },
    get spinning() { return spinning; },
    spinTo,
    /** Place station `i` at the front without animation. */
    set(i) { active = i; queued = null; layoutRest(); },
    destroy() { destroyed = true; clearTimeout(safety); if (ro) ro.disconnect(); if (anim) { try { anim.cancel(); } catch (e) { /* ok */ } } },
  };
}
