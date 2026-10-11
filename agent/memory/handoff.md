# Handoff

## State as of 2026-10-11
- `index.html` is the whole app: five tabs (Overview, Robot, Globe, Checklist, Timeline), hash routing, cross-links, localStorage checklist, share link.
- The original "sourcing plan" Netlify site was never deployed and the repo was empty, so Globe and Timeline content was rebuilt from the build planner's origin notes and the compliance notes. See `RESEARCH_LOG.md`.
- Only the A2 Ultra class is modeled. X2/A3/D1 data lives in the build planner's `data.js`, `classes.js`, `bom.js` if it is ever wanted here.

## How to change things
- Parts: `PARTS` array in `index.html` (pin x/y in a 360x720 viewBox, `side` picks label side, `inside` draws a dashed pin).
- Suppliers: `SUPPLIERS` array (lat/lon, `groups`, `parts`, `status`, `origin`, `when`).
- Checklist: `CHECKLIST` (15 items; the share-link code is 15 chars of c/p/o in item order, so keep the count and order stable or bump `CK_KEY`).
- Milestones: `MILESTONES` (`kind` fixed or proposed; `id` is the `#timeline?m=` anchor).

## Next steps
- Deploy with `netlify deploy --prod` from the repo root (or the Netlify MCP deploy tool).
- If the lost sourcing-plan content (capital estimates, physical space, events, contacts) turns up, add it as data to the existing tabs rather than new tabs.
