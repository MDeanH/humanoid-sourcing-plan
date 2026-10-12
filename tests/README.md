# Tests

Browser tests for the site, in `tests/e2e/`. They start a throwaway static server, drive the real page in headless Chromium, and print PASS or FAIL lines.

```
npm i -D playwright      # or use a global Playwright
node tests/e2e/navigation-and-flows.js
node tests/e2e/a11y-and-loading.js
node tests/e2e/hash-and-globe-robustness.js
```

- `navigation-and-flows.js`: every in-page link resolves, click-a-part to globe, back button, rapid clicks, checklist cycling and share links, keyboard path, reduced motion, no-WebGL fallback.
- `a11y-and-loading.js`: the 3D engine and globe libraries load only when needed, titles and headings, skip link, focus, dock and menu semantics, arrow keys vs widgets, 320 px menu, reduced-motion globe.
- `hash-and-globe-robustness.js`: hostile and malformed URLs, focus kept across globe filters, filter and selection rules, class-restricted parts, lineup round trip, invalid share codes, resize during a spin.

Headless Chromium here renders WebGL in software at about 3 frames per second, so a spin can take longer than on a real GPU. The waits allow for that.
