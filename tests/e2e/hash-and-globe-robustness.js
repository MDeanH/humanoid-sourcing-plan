// End-to-end checks run in headless Chromium with Playwright. Run from the repo root: node tests/e2e/hash-and-globe-robustness.js
// Needs: npm i -D playwright (or a global install) and python3 for the static server. Software WebGL is slow, so waits are generous.
const { chromium } = require('playwright');
const { spawn } = require('child_process');
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
(async () => {
  const srv = spawn('python3', ['-m', 'http.server', '8871', '--bind', '127.0.0.1'], { cwd: require('path').resolve(__dirname, '../..'), stdio: 'ignore' });
  await new Promise(r => setTimeout(r, 800));
  const b = await chromium.launch(); const errs = [];
  const base = 'http://127.0.0.1:8871/index.html';
  const mk = async (opts = {}) => { const p = await b.newPage(Object.assign({ viewport: { width: 1440, height: 900 } }, opts));
    p.on('pageerror', e => errs.push('pageerror ' + e.message)); p.on('console', m => { if (m.type() === 'error') errs.push('console ' + m.text()); }); p.on('dialog', d => d.accept()); return p; };
  const hs = (p) => p.evaluate(() => typeof window.__hsp !== 'undefined');

  // 1. malformed / hostile hashes at boot never kill the page
  for (const h of ['#globe?part=%ZZ', '#robot?part=%ZZ', '#globe?sup=constructor', '#globe?group=constructor', '#globe?status=constructor', '#globe?origin=toString', '#globe?part=constructor&cls=constructor', '#checklist?item=a!b', '#timeline?m=a:b', '#globe?part=__proto__']) {
    const p = await mk(); const before = errs.length;
    await p.goto(base + h); await p.waitForTimeout(2600);
    const st = await p.evaluate(() => ({ hsp: typeof window.__hsp !== 'undefined', title: (document.querySelector('.station.is-active h1') || {}).textContent }));
    ok(st.hsp && errs.length === before, `boot with ${h}: handle=${st.hsp}, title="${(st.title || '').trim().slice(0, 40)}", new errors ${errs.length - before}`);
    await p.close();
  }
  let p = await mk(); await p.goto(base + '#globe?group=constructor'); await p.waitForTimeout(2500);
  ok(/All supplier pins/.test(await p.textContent('#st-globe [data-role=title]')) && /35 of 35/.test(await p.textContent('#st-globe [data-role=count]')), 'prototype-key group ignored: all 35 pins shown');
  await p.evaluate(() => { location.hash = 'GLOBE/'; }); await p.waitForTimeout(500);
  await p.goto(base + '#PLAN/'); await p.waitForTimeout(2500);
  ok(await p.evaluate(() => window.__hsp.ring.active) === 2, '#PLAN/ (case and trailing slash) opens the plan');
  await p.close();

  // 2. keyboard focus survives a filter click and a list pick
  p = await mk(); await p.goto(base + '#globe'); await p.waitForTimeout(3000);
  await p.focus('#st-globe [data-group=battery]'); await p.keyboard.press('Enter'); await p.waitForTimeout(300);
  ok(await p.evaluate(() => document.activeElement.getAttribute('data-group')) === 'battery', 'focus stays on the chip after Enter');
  await p.focus('#st-globe [data-pick]'); await p.keyboard.press('Enter'); await p.waitForTimeout(300);
  ok(await p.evaluate(() => document.activeElement.hasAttribute('data-pick')), 'focus stays in the supplier list after Enter on an item');

  // 3. a selection hidden by a filter is dropped, and chips keep the origin filter
  await p.goto(base + '#globe?sup=estun'); await p.waitForTimeout(2600);
  await p.click('#st-globe [data-o=us]'); await p.waitForTimeout(300);
  ok((await p.evaluate(() => document.querySelector('#st-globe [data-role=detail]').innerHTML.trim())) === '' && !/sup=estun/.test(await p.evaluate(() => location.hash)), 'selecting Estun then filtering to US drops the stale detail panel');
  await p.click('#st-globe [data-group=battery]'); await p.waitForTimeout(300);
  ok(/origin=us/.test(await p.evaluate(() => location.hash)) && /group=battery/.test(await p.evaluate(() => location.hash)), 'a group chip keeps the origin filter: ' + await p.evaluate(() => location.hash));
  ok(/US suppliers|Battery/.test(await p.textContent('#st-globe [data-role=title]')), 'title reflects the filter: ' + await p.textContent('#st-globe [data-role=title]'));
  // focused pin stops the auto-spin
  await p.goto(base + '#globe'); await p.waitForTimeout(2600);
  await p.evaluate(() => { const g = document.querySelector('#st-globe .gpin:not(.dim)'); g.focus(); });
  await p.waitForTimeout(300);
  ok((await p.getAttribute('#st-globe [data-role=spin]', 'aria-pressed')) === 'false', 'focusing a pin pauses the globe spin');
  await p.close();

  // 4. class-restricted parts and copy
  p = await mk(); await p.goto(base + '#globe?part=waist&cls=full'); await p.waitForTimeout(2800);
  ok(/Compact|X2/i.test(await p.textContent('#st-globe .context .tags')), 'waist (X2/A3 only) shows an X2 context, not A2: ' + (await p.textContent('#st-globe .context .tags')).trim().slice(0, 100));
  ok(/every supplier in its group: Joint modules/.test(await p.textContent('#st-globe .context')), 'fallback note reads cleanly');
  await p.close();

  // 5. lineup -> globe -> "See it on the robot" shows the platform and part
  p = await mk(); await p.goto(base + '#robot'); await p.waitForTimeout(3500);
  await p.click('[data-size=lineup]'); await p.waitForTimeout(800);
  await p.goto(base + '#globe?part=kneeL&cls=full'); await p.waitForTimeout(2800);
  await p.click('#st-globe [data-go*="robot?part=kneeL"]'); await p.waitForTimeout(3200);
  const rb = await p.evaluate(() => ({ lineup: document.querySelector('[data-size=lineup]').getAttribute('aria-pressed'), a2: document.querySelector('[data-size=full]').getAttribute('aria-pressed'), hs: document.querySelectorAll('.v3d-hs').length, focus: !document.querySelector('[data-role=focus]').hidden }));
  ok(rb.lineup === 'false' && rb.a2 === 'true' && rb.hs > 5 && rb.focus, 'See it on the robot leaves lineup: ' + JSON.stringify(rb));
  await p.close();

  // 6. checklist share codes: invalid ones say so
  p = await mk(); await p.goto(base + '#checklist?s=cpx'); await p.waitForTimeout(2600);
  ok(/not valid/.test(await p.textContent('#toast')) && (await p.evaluate(() => location.hash)) === '#checklist', 'invalid share code shows a message and cleans the URL');
  await p.close();

  // 7. resize during a spin: the drum is measured at the final size
  p = await mk({ viewport: { width: 1280, height: 800 } }); await p.goto(base + '#plan'); await p.waitForTimeout(2500);
  await p.evaluate(() => { location.hash = 'checklist'; }); await p.waitForTimeout(250);
  await p.setViewportSize({ width: 600, height: 800 }); await p.waitForTimeout(5000);
  const R = await p.evaluate(() => parseFloat(document.getElementById('scene').style.getPropertyValue('--ring-r')));
  ok(Math.abs(R - (600 / 2) / Math.tan(Math.PI / 6)) < 2, `ring radius re-measured after a resize mid-spin: ${R} (expected ${(300 / Math.tan(Math.PI / 6)).toFixed(1)})`);
  await p.close();

  console.log('ERRORS', errs.length); errs.slice(0, 8).forEach(e => console.log(' ', e));
  console.log(fails ? `${fails} FAILED` : 'ALL PASSED');
  await b.close(); srv.kill();
})();
