# Humanoid Sourcing Plan

A single static site for planning a US-compliant humanoid robot build: the FCC domestic-content argument, a supplier map for every part, a compliance checklist, and the schedule to the January 1, 2028 Conditional Approval deadline. It merges the former **humanoid-build-planner** and the sourcing plan. Everything runs in the browser. No backend, no auth, no database.

Live: https://humanoid-sourcing-plan.netlify.app

## How it works

The robot is the main page. A live 3D humanoid turns slowly on its floor rings beside the headline, with the days to the deadline and the 65% and 75% targets. Every part is a clickable hotspot.

The pages sit on a turntable. Six stations are the faces of a drum, and moving between them spins the whole ring to bring the target to the front, pulling back slightly mid-spin. Use the nav, the dock arrows, the left and right arrow keys, or the browser back button.

**Click a part on the robot** and the robot turns to show it, the ring spins to the globe, and the globe rotates to a US option and lists only that part's suppliers, with the part's reference spec, origin options, export status and recommendation beside them.

| Station | What it holds |
|---|---|
| Robot | The main page. A2, X2, A3 and D1 platforms, a true-scale lineup, x-ray, hover and click on every part. |
| Globe | Supplier pins by country, filterable by part, part group, origin and status. Drag to rotate. |
| Plan | The 8-step build plan in order of cost impact, the assumed cost split, the constraints table (FCC Covered List, Buy American valuation, ITAR/EAR, Section 232, OFAC SDN), assumptions and sources. |
| Checklist | 15 compliance items with click-to-cycle status (Confirmed, In progress, Open) saved in the browser, a progress bar and a share link. |
| Timeline | Fixed regulatory dates and proposed milestones back-planned from January 1, 2028, with a countdown. |
| Planner | The full 3D tool: all four platforms with published specs, color modes, and a live parts planner scoring US content against the strict above-65% and above-75% tests. |

## Links and routes

Every station reads the URL hash, so any state can be linked:

- `#robot`, `#robot?part=battery&cls=full` focuses a part on a platform.
- `#globe?part=kneeL&cls=full`, `#globe?group=joints`, `#globe?origin=cn`, `#globe?status=inferred`, `#globe?sup=estun`.
- `#plan`, `#checklist?item=5`, `#checklist?s=<15 letters of c/p/o>` (a shared state, confirmed before it replaces yours), `#timeline?m=ca-deadline`.
- `#planner?part=imu&cls=compact`.

Bad or unknown values are ignored, never an error.

## Files

- `index.html` — the shell: nav, menu, the ring of six stations, the dock.
- `js/app.js` — router, nav, menu, dock, keyboard. `js/ring.js` — the turntable engine. `js/ui.js` — helpers. `js/checklist-store.js` — checklist state.
- `js/views/` — one module per station (`robot`, `globe`, `plan`, `checklist`, `timeline`, `planner`).
- `js/data/` — `site-data.js` (suppliers, steps, checklist, milestones) and the build planner's `planner-parts.js`, `classes.js`, `bom.js`.
- `js/viewer3d/` — the three.js viewer, with three variants: `stage` (the main-page robot), `hero` (a non-interactive turntable) and `full` (the planner). `robot.js` builds the geometry.
- `css/tokens.css` — every color, font and size token; edit this to re-theme. `css/site.css`, `css/viewer3d.css`, `css/viewer3d-stage.css`.
- `vendor/` — three.js with the addons used, d3-geo, d3-array, topojson-client. `data/land-110m.json` — world land outlines (Natural Earth, public domain).
- `dev/viewer-test.html` — standalone viewer harness (`?variant=stage|hero|full&class=full|compact|a3|d1`).
- `docs/design-spec.md` — the design-language reference. `tests/` — browser tests, see `tests/README.md`.
- `netlify.toml` — publish directory and cache headers. `RESEARCH_LOG.md` — findings log. `agent/memory/` — notes for the next working session.

## Design

Black canvas, one near-white at stepped opacities, uppercase tracked labels, a mono face for data, hairline rules instead of cards, outlined buttons that invert on hover. Barlow for display and body, Roboto Mono for data (both from Google Fonts). The look follows the design language read from spacex.com's own stylesheet (see `docs/design-spec.md`); it uses no SpaceX logo, wordmark, imagery or copy.

## Behavior worth knowing

- The 3D engine (about 2 MB of script) loads only when the robot or the planner is shown. A cold load of any other station fetches it quietly a few seconds later.
- Only the visible station runs. Hidden stations are inert and not exposed to screen readers; WebGL contexts stay at two.
- With reduced motion the ring changes stations without spinning and the globe starts still. Without WebGL the robot becomes a plain list of parts that still traces to the globe.

## Deploy

From this folder:

```
netlify deploy --prod
```

or drag the folder onto app.netlify.com/drop while logged in. There is no build step. The publish directory is the repo root, so `dev/`, `docs/`, `tests/` and `agent/` are public too.

## What this is not

Not legal advice. The checklist is a planning tool, not a compliance certification. Supplier names reported for AgiBot (Estun, Leaderdrive, CATL, BYD, Orbbec) are inferred by a third party and unverified; every other pin is a candidate from the compliance notes, not a supplier under contract. Cost shares are relative placeholders. There is no public bill of materials. The robots are planning likenesses, not official AgiBot models.

Related: the long-form notes at https://humanoid-compliance-notes.netlify.app and the original build planner at https://humanoid-build-planner.netlify.app.
