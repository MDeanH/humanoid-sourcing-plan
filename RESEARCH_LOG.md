# Research log

## 2026-10-11 — Merge build planner and sourcing plan into one site

- Start: 2026-10-11 20:30 UTC
- End: 2026-10-11 21:20 UTC (approx.)
- Duration: about 50 minutes

### Question
Build the merged five-tab site described in `merge-strategy.md` from the two existing Netlify sites.

### Sources
- https://humanoid-build-planner.netlify.app (index.html, styles.css, app.js, data.js, classes.js, bom.js, robot.js), fetched 2026-10-11.
- https://humanoid-compliance-notes.netlify.app, fetched 2026-10-11.
- https://humanoid-sourcing-plan.netlify.app — HTTP 404 "Not Found" on fetch; Netlify project `a905d604-59ef-40ea-a382-ae74e6680f47` shows an empty `currentDeploy`, and its deploy id returned 404 from the Netlify API.
- GitHub `MDeanH/humanoid-sourcing-plan` — empty repository (no branches, no commits) at session start.
- world-atlas 2.0.2 `land-110m.json` (jsdelivr); d3-geo 3.1.1, d3-array 3.2.4, topojson-client 3.1.0 (jsdelivr).

### Conclusion
The build planner's content was fully recoverable and is the basis of the Overview, Robot, and Checklist tabs. The sourcing-plan site described in the merge strategy (robot SVG with pins, globe with supplier pins, timeline, capital estimates, physical space, events, contacts) has never been deployed and has no source in the repo, so its content could not be recovered. The Robot, Globe, and Timeline tabs were rebuilt from the build planner's per-part origin notes and the compliance notes' component-by-component guide. Supplier pins are candidates or third-party-reported names from those notes, placed at HQ or main-plant cities. Timeline milestones are either fixed regulatory dates from the notes or proposed sequencing back-planned from January 1, 2028. The build planner's 3D viewer (three.js) was not carried over; the merge strategy marks it optional and prefers the SVG.

### Open questions
- Does a copy of the original sourcing-plan site exist locally (capital estimates, physical space, events, contacts tabs)? If so, that content can be merged in; none of it is on Netlify or GitHub.
- Supplier HQ locations and the Allied Motion → Allient rename are from general knowledge and were not verified by web search in this session.
- Should the merged site keep the X2, A3, and D1 classes from the build planner? This build models the A2 Ultra class only. (Answered in the next entry: the 3D viewer carries all four classes.)

## 2026-10-12 — 3D viewer port and SpaceX design-language research

- Start: 2026-10-11 21:05 UTC (approx.)
- End: 2026-10-12 02:50 UTC (approx.)
- Duration: about 5 hours 45 minutes, nearly all of it a background multi-agent workflow (research and port in parallel, then rounds of independent browser QA and fixes). The workflow was stopped by the user's request during fix round 1 to wrap up.

### Question
Add the build planner's 3D robots to the merged site, and improve the site design in the style of spacex.com.

### Sources
- Build planner source (app.js, robot.js, data.js, classes.js, bom.js), re-read in full from the deployed site; a runnable baseline copy was used for visual and behavioral comparison.
- spacex.com: per the research agent, WebFetch returned only the title because the site is an Angular single-page app, so it fetched the HTML shell with curl, then the global stylesheet, the main bundle, and 67 lazy chunks to read the actual tokens, fonts, and component CSS. Third-party "design system" write-ups were used only as corroboration and conflict with the live CSS in places; the agent says several look machine-generated. I have not independently re-checked the agent's reading of spacex.com.
- Google Fonts css2 endpoints, checked by the agent for Barlow, Barlow Semi Condensed, Saira Semi Condensed, Titillium Web, Roboto Mono, JetBrains Mono, and Geist Mono.
- three.js (vendored from the build planner's deploy) and the viewer's own headless-Chromium test suites (about 224 assertions by the author) plus three independent QA lenses (functional, visual, lifecycle) over two rounds.

### Conclusion
- The 3D viewer ported cleanly into a mountable module with a full and a hero variant. Verified in a final smoke test: all four classes plus both and lineup load at 1440 and 390 px with zero console errors and zero failed requests, A2 example plan scores 70.0%, and the hero renders on a transparent background.
- Design language (agent's reading of the live CSS, saved in `docs/design-spec.md`): pure black canvas, one near-white (`#F0F0FA`) used at stepped opacities, D-DIN for UI and headings, Roboto Mono for data, uppercase tracked labels, 1 px hairlines, one 4 px ghost button that inverts on hover, no accent color, no cards or shadows, one viewport-tall scene per message, slow eased motion. Closest free fonts: Barlow family for display, Roboto Mono or JetBrains Mono for data.
- QA round 0 found 4 major and 16 minor issues; 19 were fixed. Round 1 found 4 different major issues (tablet-width layout, a camera NaN when setView runs on a zero-size stage, framing when changed while hidden) plus minors. Fix round 1 was interrupted, so those are listed in `agent/memory/handoff.md` as reported but not re-tested.
- Not done: wiring the viewer into the page, the hero on the Overview, and the redesign itself. The live site is unchanged.

### Open questions
- Is a SpaceX-style monochrome palette acceptable for a compliance tool whose pass, fail, and open states are currently color coded? The design spec suggests shape and label first, with a single desaturated tint as a last resort.
- The origin colors (US green, China red, third-country amber) carry meaning on the globe and in the planner; the redesign needs a decision on whether they stay.
- Should `dev/` and `docs/` be excluded from the public Netlify publish?

## 2026-10-12 — Robot-first turntable site, SpaceX-style redesign, three-way review

- Start: 2026-10-12 03:05 UTC (approx.)
- End: 2026-10-12 04:55 UTC (approx.)
- Duration: about 1 hour 50 minutes of wall-clock time, with a background agent building the interactive robot variant in parallel for most of it and three independent review agents running at the end.

### Question
Make the robot the first and main page, have the pages spin around on a turntable, make clicking a part spin around to the globe, and raise the design quality in the style of spacex.com.

### Sources
- `docs/design-spec.md` (the earlier research: the agent's reading of spacex.com's own stylesheet), applied as the design system. I did not re-check spacex.com this session.
- The existing build planner data and viewer, and the site data carried over from the first merged site.
- Google Fonts css2 endpoints for Barlow (400 to 700) and Roboto Mono (400, 500), checked with a 200 and real font-face blocks.
- Headless Chromium (Playwright) runs: about 60 behaviour checks across three suites, screenshots at six viewport sizes, frozen mid-spin frames captured by pausing the ring's Web Animation, and three independent review agents (visual design against the spec; behaviour and robustness including hostile URLs and failure injection; accessibility and performance with axe-core and timing measurements).

### Conclusion
- Interpretation: "pages spin around on a turntable" was built as six stations on the faces of a CSS 3D drum that spins to the target, with a mid-spin pull-back; the robot also takes a turn of its own as the ring leaves it. "Clicking on parts spins around to the globe" is the robot turning to the part, then the ring spinning to the globe, filtered to that part's suppliers. This reading was my own; the user can redirect.
- The interactive robot (transparent canvas, hotspots, drag, turntable, `spinTo`) was built as a new viewer variant by a background agent against a written contract, and passed its own checks and mine.
- Review outcomes: the visual review found 4 must-fix, 8 should-fix and several polish items (hint and focus-bar collisions, label legibility over the silver body, a Planner that broke the flat language, off-palette bars, off-axis left edges, a leaky mobile menu, dim past milestones). The accessibility review found 7 major issues (skip link, arrow-key collisions, hotspot tab order, menu semantics, tap targets, reduced-motion globe, clipped menu at 360 px) and two performance majors (the full 3D stack downloaded on every cold load; an import waterfall). The behaviour review found 2 majors (a malformed URL escape or a prototype-key value killed the boot; focus lost after every globe filter click) and 9 minors. All were fixed except the items listed below, and each fix has a regression check in `tests/e2e/`.
- Measured: memory is flat over 60 navigations (about 14.4 MB), hidden stations cost 0 animation frames, WebGL contexts stay at two, layout shift is under 0.03 everywhere. The 3D engine no longer loads on a cold load of any station other than the robot or the planner.

### Open questions
- Real-device performance is unmeasured: the test browser renders WebGL in software at about 3 fps.
- Not fixed: hotspots do not test occlusion; the Planner still looks denser than the other stations; fonts are not self-hosted; assets are not fingerprinted for long caching; two WebGL driver warnings per load come from the software renderer.
- Is the muted tint on origin and status (US, China, third country; confirmed, in progress, open) acceptable, or should the site go purely monochrome?
- Should `dev/`, `docs/`, `tests/` and `agent/` be hidden from the public deploy?
