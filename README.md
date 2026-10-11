# Humanoid Sourcing Plan

One static site that merges the former **humanoid-build-planner** (compliance argument) and **humanoid-sourcing-plan** (supplier map and timeline) into a single tool with shared navigation. Everything runs in the browser. No backend, no auth, no database.

Live: https://humanoid-sourcing-plan.netlify.app

## Tabs

| Tab | What it holds |
|---|---|
| Overview | The 8-step build plan ordered by cost impact, the assumed cost split, the constraints table (FCC Covered List, Buy American valuation, ITAR/EAR, Section 232, OFAC SDN), assumptions, and sources. |
| Robot | A front-view humanoid SVG (A2 Ultra-class planning likeness) with 33 clickable part pins. The detail panel gives the reference spec, assumed cost share, origin options, export status, now-vs-later, and links to that part's suppliers on the globe. |
| Globe | A rotatable orthographic globe with 35 supplier pins by country. Pins are colored US / China / third country and tagged by how sure we are about the name (named in the notes, reported for AgiBot but unverified, candidate, avoid, build site). Filter by part, part group, origin, or status. |
| Checklist | The 15-item US compliance checklist. Each item has a click-to-cycle status (Confirmed, In Progress, Open) saved in `localStorage`, a progress bar, and a share link that encodes the state in the URL hash. |
| Timeline | Fixed regulatory dates and proposed milestones back-planned from the January 1, 2028 Conditional Approval deadline, with a countdown. |

## Cross-links

Every tab reads the same URL hash, so links are plain `data-go` buttons:

- `#robot?part=kneeL` selects a part.
- `#globe?part=harmonic`, `#globe?group=joints`, `#globe?origin=cn`, `#globe?status=inferred`, `#globe?sup=estun` filter or select on the globe.
- `#checklist?item=5` scrolls to and highlights an item. `#checklist?s=cpooo...` (15 characters, c/p/o) loads a shared state after confirmation.
- `#timeline?m=ca-deadline` highlights a milestone.

## Files

- `index.html` — all five tabs, the robot SVG, the globe, the data, and the handlers.
- `vendor/` — d3-array, d3-geo, topojson-client (pinned minified builds) for the orthographic projection and land outlines.
- `data/land-110m.json` — world land outlines from world-atlas 2.0.2 (Natural Earth, public domain).
- `netlify.toml` — publish directory and cache headers.
- `RESEARCH_LOG.md` — findings log, including what could and could not be recovered from the two source sites.

## Deploy

From this folder:

```
netlify deploy --prod
```

or drag the folder onto app.netlify.com/drop while logged in. There is no build step.

## What this is not

Not legal advice. The checklist is a planning tool, not a compliance certification. Supplier names reported for AgiBot (Estun, Leaderdrive, CATL, BYD, Orbbec) are inferred by a third party and unverified; every other pin is a candidate from the compliance notes, not a supplier under contract. Cost shares are relative placeholders. There is no public bill of materials.

Related sites: the 3D hardware map with X2, A3, and D1 classes stays at https://humanoid-build-planner.netlify.app and the long-form notes at https://humanoid-compliance-notes.netlify.app.
