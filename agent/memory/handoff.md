# Handoff

## State as of 2026-10-12

The site is rebuilt around the robot. See `README.md` for the full description. Short version: six stations (Robot, Globe, Plan, Checklist, Timeline, Planner) on a CSS 3D turntable ring; the robot is the main page; clicking a part on it turns the robot and spins the ring to the globe filtered to that part's suppliers. SpaceX-style design (black, one near-white, tracked uppercase, mono data, hairlines).

Verified in headless Chromium: about 60 behaviour checks pass (`tests/e2e/`, see `tests/README.md`) with zero console errors; layouts checked at 1920, 1440, 1280x720, 1024, 820 and 390 widths; three independent reviews (visual design vs the spec, behaviour and robustness, accessibility and performance) were run and their findings fixed.

## Architecture in one paragraph
`index.html` holds the shell. `js/app.js` is the router (hash routes, parsed by `js/ui.js`) and wires the nav, menu, dock and keys. `js/ring.js` lays the stations out as faces of a drum and animates it with the Web Animations API; at rest only the active station is laid flat, visible and interactive, the rest are `visibility:hidden`, `inert`, `aria-hidden`. Each station is a module in `js/views/` returning `{prepare(params), enter(params), leave(), refresh(), destroy()}`; `prepare` runs before a spin (set filters, start loading), `enter` after it, `leave` when the ring turns away (pause WebGL). The 3D viewer (`js/viewer3d/viewer.js`, `createViewer(root, {variant})`) has three variants: `stage` (main page: transparent canvas, hotspots, turntable, `spinTo`/`spinBy`/`highlight`/`setXray`/`setSize`/`setOffsetX`), `hero` (non-interactive) and `full` (the planner). three.js and the globe libraries are loaded lazily.

## How to change things
- Look and feel: `css/tokens.css` (all colors, fonts, spacing tokens), then `css/site.css`. The planner and stage inherit through the tokens.
- Suppliers, steps, checklist items, milestones: `js/data/site-data.js`. Keep the checklist at 15 items in a stable order (the share-link code is one letter per item) or change `CK_KEY` in `js/checklist-store.js`. `parts: ['*']` means every part.
- Parts and platforms: `js/data/planner-parts.js`, `classes.js`, `bom.js` (the build planner's data, unchanged). A part no supplier lists exactly falls back to its group via `PART_GROUP` in `site-data.js`.
- Copy on the main page: `js/views/robot.js`.

## Known limits and open decisions
- Hotspots do not test occlusion: a front-facing dot can sit behind the robot's own limb. Labels over the light robot body rely on a black text halo.
- Software WebGL in the test environment runs at about 3 fps, so spins take longer there than on a real GPU. Real-device performance has not been measured.
- The turntable reading ("pages on a ring that spin") was my interpretation of the request. If the intent was different, say the robot's own platform turning, that is a small change in `js/views/robot.js` and `js/viewer3d/stage.js`.
- The monochrome palette keeps small muted tints for origin (US/China/third country) and checklist status, always paired with a label or shape. Revisit if a purer monochrome is wanted.
- `dev/`, `docs/`, `tests/` and `agent/` are public on Netlify because the publish directory is the repo root. Exclude with redirects in `netlify.toml` if that matters.
- The Planner station still looks like a denser tool (boxed labels); it is restyled only through scoped overrides in `css/site.css`.
- Lost content: the original "sourcing plan" site (capital estimates, physical space, events, contacts) was never deployed and has no reachable source. The GitHub repo description mentions strain-wave reducer suppliers, a Tesla playbook, capital estimates, events and contacts; if a local copy exists, add it as data to the existing stations.
- Supplier HQ coordinates and the Allied Motion to Allient rename are from general knowledge and were not verified by search.

## Robot lab
`lab/` holds passive test procedures for our AgiBot A2 Ultra (network capture, Ethernet, depth recording, LoRa status link) and, as of 2026-10-13, two venue notes: `lab/venue-survey.md` (one-time receive-only RF survey with the Flipper, LilyGO boards, Pi 5 and Mac) and `lab/venue-dropouts.md` (which link drops, logging it through show hours with `linklog.sh`, `airscan.sh` and `survey-summary.sh`, and fixes). None has been run against the real robot yet; open questions are in `RESEARCH_LOG.md`. Also as of 2026-10-13: `lab/wifi-analyzer/` (Mac app, iPhone dashboard, T-Deck, LoRa32 Paxcounter, watch; status per device in its README). The T-Deck, LoRa32 and watch now run this firmware instead of Meshtastic, the Nori remote and the Nori watch firmware.

## Repo notes
- `main` on GitHub is the first commit (the earlier merged site). Work is on `claude/new-session-mnuntz`; draft PR #1 tracks it.
- Deploy: `netlify deploy --prod` from the repo root, or the Netlify MCP deploy tool (site id `a905d604-59ef-40ea-a382-ae74e6680f47`).
