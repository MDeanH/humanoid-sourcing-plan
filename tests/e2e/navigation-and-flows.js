// End-to-end checks run in headless Chromium with Playwright. Run from the repo root: node tests/e2e/navigation-and-flows.js
// Needs: npm i -D playwright (or a global install) and python3 for the static server. Software WebGL is slow, so waits are generous.
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const OUT = require('path').resolve(__dirname, '../../.shots') + '/';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
(async () => {
  const srv = spawn('python3', ['-m', 'http.server', '8881', '--bind', '127.0.0.1'], { cwd: require('path').resolve(__dirname, '../..'), stdio: 'ignore' });
  await new Promise(r => setTimeout(r, 800));
  const b = await chromium.launch(); const errs = [];
  const base = 'http://127.0.0.1:8881/index.html';
  const mk = async (opts = {}) => { const p = await b.newPage(Object.assign({ viewport: { width: 1440, height: 900 } }, opts));
    p.on('pageerror', e => errs.push('pageerror ' + e.message)); p.on('console', m => { if (m.type() === 'error') errs.push('console ' + m.text()); });
    p.on('requestfailed', r => errs.push('reqfail ' + r.url())); p.on('dialog', d => d.accept()); return p; };

  // 1. link audit across all stations
  let p = await mk();
  await p.goto(base + '#robot'); await p.waitForTimeout(3000);
  for (const st of ['robot', 'globe', 'plan', 'checklist', 'timeline', 'planner']) { await p.evaluate((s) => window.__hsp.go(s), st); await p.waitForTimeout(2300); }
  const audit = await p.evaluate(async () => {
    const data = await import('./js/data/site-data.js'); const parts = await import('./js/data/planner-parts.js'); const ui = await import('./js/ui.js');
    const ORDER = window.__hsp.ORDER; const bad = []; const seen = new Set();
    for (const el of document.querySelectorAll('[data-go]')) {
      const g = el.dataset.go; if (seen.has(g)) continue; seen.add(g);
      const [name, q] = g.split('?'); const params = {}; (q || '').split('&').filter(Boolean).forEach(kv => { const [k, v] = kv.split('='); params[k] = decodeURIComponent(v); });
      if (!ORDER.includes(name)) bad.push(g + ' (station)');
      if (params.part && !ui.partFor(params.part, params.cls || 'full')) bad.push(g + ' (part)');
      if (params.group && !data.GROUPS[params.group]) bad.push(g + ' (group)');
      if (params.sup && !data.SUP[params.sup]) bad.push(g + ' (sup)');
      if (params.item && !(+params.item >= 1 && +params.item <= data.CHECKLIST.length)) bad.push(g + ' (item)');
      if (params.m && !data.MILESTONES.some(m => m.id === params.m)) bad.push(g + ' (milestone)');
      if (params.cls && !ui.CLASSES[params.cls]) bad.push(g + ' (cls)');
    }
    return { total: seen.size, bad };
  });
  ok(audit.bad.length === 0, `link audit: ${audit.total} distinct links, bad: ${JSON.stringify(audit.bad)}`);

  // 2. arrival on robot with a part param shows the focus caption, then traces to the globe
  await p.goto(base + '#robot?part=battery&cls=full'); await p.waitForTimeout(3500);
  const cap = await p.evaluate(() => ({ hidden: document.querySelector('[data-role=focus]').hidden, name: document.querySelector('[data-role=focusname]').textContent }));
  ok(!cap.hidden && /battery/i.test(cap.name), 'robot?part=battery shows focus caption: ' + cap.name);
  await p.click('[data-role=focusgo]'); await p.waitForTimeout(2800);
  ok((await p.evaluate(() => location.hash)).startsWith('#globe?part=battery'), 'focus button traces to globe');

  // 3. back button spins back to the robot
  await p.goBack(); await p.waitForTimeout(2800);
  ok(await p.evaluate(() => window.__hsp.ring.active) === 0, 'back button returns to robot station');

  // 4. dock arrows + arrow keys + spam
  await p.evaluate(() => window.__hsp.go('plan')); await p.waitForTimeout(2300);
  await p.click('#dockNext'); await p.waitForTimeout(2300);
  ok(await p.evaluate(() => window.__hsp.ring.active) === 3, 'dock next goes plan -> checklist');
  await p.keyboard.press('ArrowLeft'); await p.waitForTimeout(2300);
  ok(await p.evaluate(() => window.__hsp.ring.active) === 2, 'ArrowLeft goes back to plan');
  for (let i = 0; i < 9; i++) { await p.click('#dockNext', { delay: 10 }).catch(() => {}); await p.waitForTimeout(120); }
  await p.waitForTimeout(6000);
  const st = await p.evaluate(() => ({ spinning: window.__hsp.ring.spinning, a: window.__hsp.ring.active, cls: document.getElementById('scene').className, vis: [...document.querySelectorAll('.station')].filter(s => s.style.visibility !== 'hidden').length, hash: location.hash }));
  ok(!st.spinning && !/spinning/.test(st.cls) && st.vis === 1, 'after 9 rapid clicks the ring is at rest with exactly one visible station: ' + JSON.stringify(st));

  // 5. checklist cycling, persistence, share link
  await p.evaluate(() => window.__hsp.go('checklist')); await p.waitForTimeout(2300);
  await p.click('.status[data-ck="1"]'); await p.click('.status[data-ck="1"]'); await p.click('.status[data-ck="2"]');
  const c1 = await p.textContent('#st-checklist [data-role=counts]');
  ok(/1 confirmed/.test(c1.toLowerCase()) && /1 in progress/.test(c1.toLowerCase()), 'checklist cycles: ' + c1);
  await p.reload(); await p.waitForTimeout(2500);
  ok(/1 confirmed/.test((await p.textContent('#st-checklist [data-role=counts]')).toLowerCase()), 'checklist persists across reload');
  await p.goto(base + '#checklist?s=ccccccccccccccc'); await p.waitForTimeout(2500);
  ok(/15 confirmed/.test((await p.textContent('#st-checklist [data-role=counts]')).toLowerCase()), 'share link code loads all 15 confirmed');
  ok((await p.evaluate(() => location.hash)) === '#checklist', 'share code removed from the URL after loading');
  await p.goto(base + '#overview'); await p.waitForTimeout(2200);
  ok(await p.evaluate(() => window.__hsp.ring.active) === 2, '#overview alias opens the plan');
  await p.close();

  // 6. keyboard path on the hero
  p = await mk(); await p.goto(base + '#robot'); await p.waitForTimeout(3500);
  const reach = await p.evaluate(async () => { const out = []; for (let i = 0; i < 80; i++) { const e = document.activeElement; out.push(e && (e.className || e.tagName)); const ev = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }); document.dispatchEvent(ev); break; } return out; });
  await p.keyboard.press('Tab');
  let hs = null;
  for (let i = 0; i < 60 && !hs; i++) { await p.keyboard.press('Tab'); hs = await p.evaluate(() => { const e = document.activeElement; return e && e.classList.contains('v3d-hs') ? e.getAttribute('aria-label') : null; }); }
  ok(!!hs, 'Tab reaches a robot hotspot: ' + hs);
  if (hs) { await p.keyboard.press('Enter'); await p.waitForTimeout(2800); ok((await p.evaluate(() => location.hash)).startsWith('#globe?part='), 'Enter on a hotspot traces to the globe: ' + await p.evaluate(() => location.hash)); }
  await p.close();

  // 7. reduced motion: instant station change, no animation running
  p = await mk({ reducedMotion: 'reduce' }); await p.goto(base + '#robot'); await p.waitForTimeout(3000);
  await p.evaluate(() => window.__hsp.go('globe')); await p.waitForTimeout(250);
  ok(await p.evaluate(() => window.__hsp.ring.active) === 1 && !(await p.evaluate(() => window.__hsp.ring.spinning)), 'reduced motion: station changes without a spin');
  await p.close();

  // 8. no WebGL: fallback list on the robot station, planner message, trace still works
  p = await mk(); await p.addInitScript(() => { const o = HTMLCanvasElement.prototype.getContext; HTMLCanvasElement.prototype.getContext = function (t, ...a) { if (/webgl/.test(t)) return null; return o.call(this, t, ...a); }; });
  await p.goto(base + '#robot'); await p.waitForTimeout(3000);
  const fb = await p.evaluate(() => document.querySelectorAll('[data-fbpart]').length);
  ok(fb > 20, 'no WebGL: fallback part list shows ' + fb + ' parts');
  await p.click('[data-fbpart="kneeL"]'); await p.waitForTimeout(2800);
  ok((await p.evaluate(() => location.hash)).startsWith('#globe?part=kneeL'), 'no WebGL: fallback part click still traces to the globe');
  await p.evaluate(() => window.__hsp.go('planner')); await p.waitForTimeout(2600);
  ok(/WebGL/.test(await p.textContent('#st-planner .planner-root')), 'no WebGL: planner explains and links to the original');
  await p.close();

  console.log('ERRORS', errs.length); errs.slice(0, 10).forEach(e => console.log(' ', e));
  console.log(fails ? `${fails} FAILED` : 'ALL PASSED');
  await b.close(); srv.kill();
})();
