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
- Should the merged site keep the X2, A3, and D1 classes from the build planner? This build models the A2 Ultra class only.
