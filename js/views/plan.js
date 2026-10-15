// Station 3: the plan. The eight build steps in order of cost impact, the assumed cost split, and the constraints table.
import { esc, xlinks, daysUntil } from '../ui.js';
import { STEPS, GROUPS } from '../data/site-data.js';
import { counts, subscribe } from '../checklist-store.js';

const CONSTRAINTS = [
  { rule: 'FCC Covered List', sub: 'DA 26-786, July 28, 2026', restricts: 'New FCC authorization for foreign-produced advanced robotic devices. To count as domestic, the robot must be manufactured in the US, and domestic components must be more than 65% of component cost through 2028 and more than 75% from 2029 (48 CFR 25.101(a)).', not: 'Does not look at software origin or company nationality. Does not ban the components themselves. The COTS end-product waiver does not apply. Sales only to the government are exempt.', impact: ['Gatekeeper', 'Drives every sourcing choice on this site.'], link: ['checklist?item=1', 'Checklist 1'] },
  { rule: 'Buy American valuation', sub: '48 CFR 25.003', restricts: 'How component cost is measured. A component is an article built directly into the end product. Bought parts count at acquisition cost plus freight plus duty. Parts you make count at manufacturing cost plus allocable overhead, with no profit.', not: 'Final assembly labor does not count. A component of unknown origin is not given the benefit of the doubt: it counts as foreign.', impact: ['Method', 'A purchased joint module is wholly domestic or wholly foreign.'], link: ['checklist?item=6', 'Checklist 6'] },
  { rule: 'ITAR / EAR', sub: 'export controls', restricts: 'Exports and releases of controlled items and technology. Possible controls: 2B006.c encoders (machine-tool, about 0.9 arc-second or better), 7A003/7A103 navigation-grade IMUs, ITAR for parts specially designed for defense, and 2B007 robots.', not: 'Typical joint actuators, harmonic drives, commercial torque sensors, and robot-balance IMUs are usually EAR99. For the Jetson Orin, check NVIDIA’s published classification.', impact: ['Watch', 'Sending drawings or firmware to a Chinese supplier can be an export.'], link: ['checklist?item=9', 'Checklist 9'] },
  { rule: 'Section 232', sub: 'robotics & industrial machinery', restricts: 'An investigation into imports of robotics and industrial machinery, opened September 2, 2025.', not: 'There is no final rule yet. It is not a license requirement today.', impact: ['Check status', 'Pending; it could raise the cost of imported parts later. Chinese-origin parts may already carry Section 301 duties.'], link: ['timeline?m=s232', 'Timeline'] },
  { rule: 'Sanctioned parties', sub: 'OFAC SDN list', restricts: 'Do not buy from parties on the SDN list.', not: 'It is not a general ban on Chinese or other foreign suppliers.', impact: ['Screen', 'Screen every supplier before you buy.'], link: ['globe', 'Every pin on the globe'] },
];

export function createPlanView(el) {
  const shareRows = Object.entries(GROUPS).map(([k, g]) => `
    <div class="bar-row"><button type="button" class="link plain" data-go="globe?group=${k}">${esc(g.name)}</button>
      <div class="bar"><i style="width:${g.share}%;background:var(--text);opacity:${(0.35 + (g.share / 60) * 0.65).toFixed(2)}"></i></div><span class="mono">${g.share}%</span></div>`).join('');

  el.innerHTML = `
  <div class="page">
    <header class="page-head">
      <p class="eyebrow">Plan</p>
      <h1 class="h1" data-role="title" tabindex="-1">Build plan, in order of impact</h1>
      <p class="lede">The FCC test counts component cost, not part count. Spend domestic-sourcing effort where the cost is. Each step links to the parts, suppliers, and checklist items it depends on.</p>
    </header>
    <dl class="readouts big">
      <div><dd>&gt;65%</dd><dt>US component cost, items delivered through 2028</dt></div>
      <div><dd>&gt;75%</dd><dt>from January 1, 2029</dt></div>
      <div><dd data-role="days">${daysUntil('2028-01-01')}</dd><dt>days to the Conditional Approval deadline</dt></div>
      <div><dd data-role="prog">0 / 15</dd><dt>checklist items confirmed</dt></div>
    </dl>
    <div class="plan-grid">
      <ol class="steps">${STEPS.map((s) => `<li><h3>${esc(s.h)}</h3><p>${esc(s.p)}</p>${xlinks(s.links)}</li>`).join('')}</ol>
      <aside class="split">
        <h3 class="h3">Where the cost sits</h3>
        <p class="note">An illustration, not AgiBot data. There is no public bill of materials.</p>
        ${shareRows}
        <p class="note">Worked example: US joints alone reach about 60% (short). Add a US frame and harness and the example reaches about 70%, which clears 2028 and fails 2029. Add a US-built pack and carrier (optimistic, the open subassembly question) and it reaches about 82%.</p>
        ${xlinks([['globe?group=joints', 'Joint suppliers'], ['planner', 'Try it in the planner']])}
      </aside>
    </div>
    <section class="block">
      <h3 class="h2">Constraints, side by side</h3>
      <div class="tablewrap"><table class="matrix">
        <thead><tr><th>Rule</th><th>What it restricts</th><th>What it does not do</th><th>Build impact</th></tr></thead>
        <tbody>${CONSTRAINTS.map((c) => `<tr>
          <th scope="row">${esc(c.rule)}<span>${esc(c.sub)}</span></th><td>${esc(c.restricts)}</td><td>${esc(c.not)}</td>
          <td><b class="mono">${esc(c.impact[0])}</b> ${esc(c.impact[1])} <button type="button" class="link" data-go="${esc(c.link[0])}">${esc(c.link[1])}</button></td></tr>`).join('')}</tbody>
      </table></div>
    </section>
    <section class="block two">
      <details open><summary>Assumptions</summary><ul>
        <li>The robots are <b>planning likenesses</b> of the AgiBot A2 Ultra-, X2 Ultra-, A3-, and D1-class forms, built from simple shapes. They are not official models and carry no AgiBot logos or wordmarks.</li>
        <li>A2 figures come from AgiBot’s own pages: 169 cm, about 69 kg, 40 DOF, a 16-core CPU plus Jetson Orin 64 GB, 14.4 Ah, a 54.6 V 8 A charger output, 2 h charge, and a 270 N·m peak knee torque. The arm and leg DOF split is a modeling assumption. X2, A3 and D1 figures are on each platform card in the Planner.</li>
        <li>IMU, encoders, torque sensors, reducers, foot force sensors, BMS, and harness are typical humanoid items. They are not published A2 Ultra line items.</li>
        <li>Cost shares are <b>relative placeholders</b>, not quotes and not AgiBot data. There is no public BOM for any platform.</li>
        <li>Supplier names reported for AgiBot (Estun, Leaderdrive, CATL, BYD, Orbbec) are <b>inferred by a third party and unverified</b>. Every other pin on the globe is a candidate taken from the compliance notes, not a supplier under contract. Pin locations are headquarters or main-plant cities, placed for orientation; the place a specific unit is made decides its origin.</li>
      </ul></details>
      <details open><summary>Sources</summary><ul>
        <li><a href="https://www.fcc.gov/covered-list-faqs-robots-inverters" target="_blank" rel="noopener">FCC FAQ on the Covered List for foreign-produced advanced robotic devices and power inverters</a> (updated October 2, 2026), FCC DA 26-786 (July 28, 2026), and <a href="https://www.fcc.gov/sites/default/files/robots-ca.pdf" target="_blank" rel="noopener">Annex A, Conditional Approval guidance</a> (July 27, 2026).</li>
        <li>48 CFR 25.101 (domestic end product) and 48 CFR 25.003 (definitions; cost of components).</li>
        <li>47 CFR 2.1204(a)(3) and (a)(5); 49 CFR 173.185; 29 CFR 1910.303; 21 CFR 1040.10; Fla. Stat. 934.03.</li>
        <li>Commerce Control List entries 2B006.c, 2B007, 7A003, and 7A103; OFAC SDN list; Section 232 investigation opened September 2, 2025 (pending).</li>
        <li>AgiBot <a href="https://www.agibot.com/products/A2_Ultra" target="_blank" rel="noopener">A2 Ultra spec table</a>, <a href="https://www.agibot.com/products/A2" target="_blank" rel="noopener">A2 page</a>, and <a href="https://store.agibot.com/products/a2-ultra" target="_blank" rel="noopener">store listing</a>. Manufacturer figures take precedence over retailer listings.</li>
        <li>Full notes: <a href="https://humanoid-compliance-notes.netlify.app" target="_blank" rel="noopener">humanoid-compliance-notes.netlify.app</a>.</li>
      </ul></details>
    </section>
    <p class="disclaimer"><b>Not legal advice.</b> This is a planning aid built from public sources. Origin, valuation, and export classification depend on facts. Confirm them with trade and FCC counsel before you make sourcing or certification decisions.</p>
  </div>`;

  const paint = () => { const c = counts(); el.querySelector('[data-role=prog]').textContent = `${c.c} / ${c.total}`; };
  const unsub = subscribe(paint);
  paint();
  return {
    prepare() {},
    enter() { el.scrollTop = 0; },
    leave() {},
    refresh() { el.querySelector('[data-role=days]').textContent = daysUntil('2028-01-01'); },
    destroy() { unsub(); },
  };
}
