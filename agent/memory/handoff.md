# Handoff

## State as of 2026-10-12

**Live site (unchanged this session):** `index.html` is the five-tab site from the first pass: Overview, Robot (2D SVG pins), Globe, Checklist, Timeline. It is deployed at https://humanoid-sourcing-plan.netlify.app. Nothing from this session has been deployed.

**Committed but NOT wired into the page:**
- `js/viewer3d/` is the build planner's three.js viewer ported into a mountable ES module. Public entry: `js/viewer3d/viewer.js`, exports `webglAvailable()` and `createViewer(root, options)`. Two variants:
  - `full`: A2, X2, A3, D1 plus A2+X2 and true-scale lineup, three color modes, labels with leader lines, x-ray, camera views, details panel, live parts planner (strict >65% / >75%), parts list. Planner state persists in localStorage under `hsp-plan-v1-<classId>`.
  - `hero`: transparent canvas, slow turntable, no UI, optional `offsetX` to park the robot beside a headline.
  Options include `extraDetail(part, classId)` (host HTML appended to the details panel, so the host can add "suppliers on the globe" buttons), `onSelect`, `onClassChange`. `createViewer` throws an Error with `code === 'NO_WEBGL'` when WebGL is missing; fall back to the 2D schematic.
- `css/viewer3d.css`: all viewer styles, scoped under `.v3d`, consuming only the variables in `css/tokens.css`. Re-theme by editing the tokens.
- `css/tokens.css`: the token contract. Currently the placeholder dark theme. The redesign should own this file.
- `js/data/` (`planner-parts.js`, `classes.js`, `bom.js`): the planner's data, unchanged copies. `js/viewer3d/robot.js`: geometry builder (import path fixed only).
- `vendor/three/`: three.js plus the addons the viewer imports. The host page must declare:
  `<script type="importmap">{"imports":{"three":"./vendor/three/three.module.js","three/addons/":"./vendor/three/addons/"}}</script>`
  Load the viewer lazily with `await import('./js/viewer3d/viewer.js')` so the ~2 MB of three.js does not block the first paint.
- `dev/viewer-test.html`: standalone harness. Query params: `variant=full|hero`, `class=full|compact|a3|d1`, `size=full|compact|a3|d1|both|lineup`, `mode=sub|origin|calc`, `part=<id>`, `debug=1` (sets `window.__viewer`, the public viewer object). Serve the repo root with any static server, for example `python3 -m http.server 8000`.
- `docs/design-spec.md`: SpaceX design-language reference (see below).

**Verified this session:** the viewer loads for all four classes, both and lineup, at 1440 and 390 px, with zero console errors and zero failed requests. A2 example plan scores 70.0%. Hero renders on a transparent background. Two rounds of independent QA (functional, visual, lifecycle) in headless Chromium found and fixed about 19 issues in round 0.

## Open items from QA round 1 (reported, fix round was interrupted, so some may already be fixed; none re-tested)
Visual:
- Expanded mini score bar collapses and overlaps at about 790-940 px and 1180-1380 px viewport widths.
- At about 900-1150 px (iPad landscape, small laptops) the phone toolbar is used beside the 400 px side panel.
- Phone: footer legend height depends on color mode, so the content shifts by about 42 px when switching mode. A few tap targets are under 40 px. Selected label sits on its own anchor in A2+X2; a leader crosses another label in compact and D1.
Lifecycle:
- `setView()` while the stage has zero size can leave NaN in the camera (blank stage, console spam). Only a size change recovers it.
- `setSize()` or `select({classId})` while the viewer is hidden is not framed when it is shown (lineup cuts the quadruped, D1 too small).
- Device pixel ratio changes without a CSS size change are not picked up. Token colors are read once at creation.
Functional:
- `onSelect` fires redundant or stale intermediate events on a class change.
- With x-ray on, the battery pack cannot be picked and the click clears the selection (inherited from the original).
Known and accepted: three.js keeps one shared lookup texture after `destroy()` (constant, not a per-cycle leak); canvas click on the lidar picks the collar shell unless x-ray is on; label density "All" behaves as "Key" in A2+X2.

## Next steps (the original ask, not done)
1. Wire the viewer into the Robot tab: add the importmap, a 3D / Schematic toggle (3D default, schematic fallback on `NO_WEBGL`), mount with `extraDetail` returning `data-go` buttons for the Globe. Unify ids between the SVG schematic's `PARTS` in `index.html` and `js/data/planner-parts.js` (known mismatch: `fisheyeL` vs `fisheye`; the planner also has waist, touch, stereo, shtouch, legFL/FR/RL/RR, dock, payload that suppliers do not reference yet).
2. Hero: mount `createViewer(el, {variant: 'hero', offsetX: ...})` on the Overview, and destroy it when leaving the tab (one WebGL context at a time).
3. Redesign to the SpaceX language per `docs/design-spec.md`: pure black canvas, one near-white at stepped opacities, uppercase tracked labels, a mono face for data, 1 px hairlines, no cards or shadows, one scene per viewport, transparent nav that hides on scroll-down. Free-font matches verified on Google Fonts: Barlow family for display, Roboto Mono or JetBrains Mono for data. Do not use SpaceX's logo, wordmark, imagery, or copy.
4. Move the inline script out of `index.html` into modules, add the 3D toggle to the smoke test, then deploy.
5. Decide whether `dev/` and `docs/` should be excluded from the Netlify publish (the publish directory is the repo root, so both would be public).

## How to change things (live site)
- Parts: `PARTS` array in `index.html` (pin x/y in a 360x720 viewBox, `side` picks label side, `inside` draws a dashed pin).
- Suppliers: `SUPPLIERS` array (lat/lon, `groups`, `parts`, `status`, `origin`, `when`).
- Checklist: `CHECKLIST` (15 items; the share-link code is 15 chars of c/p/o in item order, so keep the count and order stable or bump `CK_KEY`).
- Milestones: `MILESTONES` (`kind` fixed or proposed; `id` is the `#timeline?m=` anchor).

## Lost content
The original "sourcing plan" Netlify site (capital estimates, physical space, events, contacts) was never deployed and has no source anywhere reachable. If a local copy turns up, add it as data to the existing tabs.

## Repo notes
- Default branch on GitHub is `claude/new-session-mnuntz` because the repo was empty when work began, so no pull request can target a different base until a `main` exists.
- Deploy: `netlify deploy --prod` from the repo root, or the Netlify MCP deploy tool (site id `a905d604-59ef-40ea-a382-ae74e6680f47`).
