# Design language reference: spacex.com, translated for a data-heavy humanoid-robot planning site

Scope: design language only (type, color, layout, motion, component behavior). No SpaceX logo, wordmark, photography, video or copy is reproduced or recommended. Every value below is tagged:

- **[V] verified**: read directly from spacex.com's live HTML, CSS or JS bundles on 2026-10-11 (fetched with curl; files: `styles.1a4bd8588c6ea618.css`, `main.38aaaafc31bc4ec8.js`, 67 lazy chunks that carry Angular component CSS, the font files themselves).
- **[R] reported**: from a third-party write-up (URL given). These sources are mostly AI-generated "design system" reconstructions and several conflict with the live CSS; they are used only for corroboration.
- **[I] inferred**: my own translation or recommendation, not something SpaceX ships.

Method note: WebFetch on spacex.com and sub-pages (`/vehicles/starship/`, `/launches/`) returned only the title "SpaceX" because the site is an Angular SPA rendered client-side. `curl` returned a 3 KB shell that inlines the critical CSS and links the bundles; the real design tokens live in those bundles.

---

## 1. Summary in one paragraph

SpaceX's site is a black page, one near-white (`#F0F0FA`) at stepped opacities, one typeface family (D-DIN, plus Roboto Mono for data), uppercase tracking-open labels, 1px hairlines, one 4px-radius ghost button that inverts to solid white on hover, and no accent colour, no cards, no shadows. Each section is one viewport tall; copy sits in a narrow column pinned to a left or right margin; imagery fills the whole section and is faded to black with a linear gradient under the text. Data (launch countdown, telemetry, mission tables, stat numbers, timelines) is set in Roboto Mono or very large D-DIN numerals, separated by hairlines, never boxed. Premium comes from restraint (almost nothing is on screen at once), extreme scale contrast (8.75rem stat numerals next to 0.75rem labels) and slow, eased reveals.

---

## 2. Principles (translated to a site with no photography)

1. **Black is the canvas, content is the light source. [V base, I translation]** SpaceX: `body` background `#000`, text `rgba(240,240,250,1)`. For us: the 3D robot is the "photograph". Render it on true `#000` (or transparent canvas over `#000`) so it dissolves into the page edge-to-edge, with no framing box. Let it bleed off the viewport edge and let the text column take the other 40%.
2. **One colour, many opacities. [V]** All text, borders and fills are the same cool white at 100/90/80/70/60/50/35/30/25/15/10% (`--white-*` tokens). Hierarchy is made by opacity and size, not hue. Keep the data site monochrome; if status semantics are unavoidable (pass/fail on a compliance checklist), use shape and label first (filled square vs outlined square, "PASS"/"OPEN" text), and add a single desaturated signal tint as a last resort [I]. SpaceX defines no accent: a `var(--orange-100)` is referenced once in a dropdown but never defined anywhere in the CSS [V].
3. **Scale contrast over decoration. [V]** Stat numerals are `8.75rem` (140px) next to `1.25rem` uppercase labels; headings are `3rem` uppercase beside `1rem` body; nav is `0.813rem`. Translate: hero numerals (compliance %, days to target) at 96-140px, everything else small.
4. **Text lives on the page, not in boxes. [V]** No cards, panels or shadows in the core layout (only shadow in the CSS is `0 8px 16px rgba(0,0,0,.2)` on dropdown menus). Group data with whitespace and 1px hairlines. Translate: tables, checklists and timelines are rules-and-type, not bordered tiles.
5. **Every section is a "scene" with one message. [V]** Home is a stack of six CMS tiles, each `max(100vh, 941px)` tall, one headline (<=41 chars), one blurb (116-226 chars), one CTA (<=17 chars) [V from the `homepage-tiles` JSON: lengths only]. Translate: one idea per viewport; a dense data table gets its own scene rather than sharing with a hero.
6. **Alternate left and right. [V]** Tiles alternate `inner-right-top`, `inner-left-top`, `inner-left-middle` (hero) etc. Text column max 450-650px, pinned 100px from the edge. Gives rhythm without grids.
7. **Data is typeset like instrumentation. [V]** Telemetry, tables and countdown use Roboto Mono, uppercase, `letter-spacing: .36px`, 12-14px, `white-60/80`. Numbers roll like an odometer. A 6x6 white square blinks to mean "live".
8. **Motion is slow, eased, and sparse. [V]** 0.4-0.75s `cubic-bezier(.19,1,.22,1)` (expo-out) or `ease-in-out` reveals, hover inversion in 0.4-0.5s. Nothing bounces. Reduced-motion is honoured in the canvas effect.
9. **The chrome disappears. [V]** Nav is a transparent fixed bar over a top-down black gradient; it hides on scroll-down and returns on scroll-up. Translate: header must never create a visible band across the robot.
10. **Photo-free is already part of the system. [V]** Sections can set `backgroundEffect: "dot-grid"`: a full-bleed black canvas with a 16px grid of tiny white dots that shimmer, plus a cursor-follow glow. This is SpaceX's own answer to "no image here", and it is the right hero backdrop for a 3D render on black (see section 10).

---

## 3. Tokens

### 3.1 Colour [V unless noted]

Source: `:root` in `styles.1a4bd8588c6ea618.css`.

| Token | Value | Computed on #000 | Contrast vs #000 [computed] | Use |
|---|---|---|---|---|
| `--bg` | `#000000` | | | page, hero, image-wrapper fallback |
| `--white-100` | `rgba(240,240,250,1)` = `#F0F0FA` | `#F0F0FA` | 18.55:1 | headings, primary text, hover state |
| `--white-90` | `rgba(240,240,250,.9)` | `#D8D8E1` | 14.83 | nav links (rest) |
| `--white-80` | `rgba(240,240,250,.8)` | `#C0C0C8` | 11.62 | secondary text, table cells, mobile nav |
| `--white-70` | `.7` | `#A8A8AF` | 8.89 | |
| `--white-60` | `.6` | `#909096` | 6.62 | telemetry labels |
| `--white-50` | `.5` | `#78787D` | 4.78 | mono sub-headers, input placeholder/border, footnotes; lowest opacity that still passes AA for body text |
| `--white-35` | `.35` | `#545458` | 2.79 | **button borders**, pill borders, node descriptions (fails AA as text; keep for borders only) |
| `--white-30` | `.3` | `#48484B` | 2.30 | spec-table row rules |
| `--white-25` | `rgba(255,255,255,.25)` | `#404040` | 2.03 | table row rules in launches tables, widget border, dividers |
| `--white-15` | `.15` | `#242426` | 1.36 | defined, little used |
| `--white-10` | `.1` | `#181819` | 1.18 | circular social buttons fill |
| `--black-50` | `rgba(0,0,0,.5)` | | | primary button fill, inputs |
| `--black-80` | `rgba(0,0,0,.8)` | | | node-marker ring, gradient ends |
| `--gray-60` | `rgba(37,38,40,.6)` (`#252628`) | | | dropdown/pagination glass |
| `--gray-80` / `--gray-40` | `rgba(37,38,40,.8)` / `.4` | | | glass hover / light glass |
| Other literals | `#232323` (tertiary button, preloader ring), `#121212` (mobile table rows), `#313233` (filter menu), `#555555` (input border), `#ccc` (CMS link hover), `#ffffff1a` (menu item hover/selected), `#fff` (white button text inverted to `#000`) | | | |

Proposed extension for a data-dense site [I]: add a raised surface for dense tables and code-ish panels, only if needed: `--surface-1: #0A0A0C`, `--surface-2: #121212` (already used by SpaceX on mobile rows) and keep borders as `--white-25` hairlines.

Accent colour: **none** [V]. Third-party claims "accent `#f0f0fa`" [R: https://opendesigner.io/design-systems/spacex] which matches: the white is the accent.

### 3.2 Spacing, sizing, radii [V]

- Page gutters: nav `24px 60px` (<=1500px: `24px 40px`; <=1279px mobile menu `24px 0` + `16px` side margins). Footer `margin: 12px 60px` (mobile `12px 16px 24px`). Tables/pages `margin: 0 60px`. Hero text block offset `left/right: 100px` (mobile: `left/right: 20px`).
- Content max-widths: `.section-inner` 1400px (home tiles) / 1700px (feature/spx sections); text column 450-650px, centered hero 960px; newsletter/footer block 960px; updates/article column 1088px.
- Section height: `max(100vh, 941px)` and `max(100svh, 941px)`; mobile: `height: auto` / `100svh`. Half-height variant: `max(50vh, 470px)` with `120px` vertical margin.
- Vertical text anchors inside a section: `top: 13%`, `top: 50%` (translateY -50%), `bottom: 15%`.
- Row/cell padding: table cells `20px 0` (spec tables) and `24px 0` (mission/telemetry/timeline tables). Feature grid `column-gap 120px; row-gap 48px`. Button row gap `16px`. Nav column-gap `40px` (-> 30 -> 24/18/12 at narrower widths); nav-link gap `24px` (-> 18 -> 12).
- Heights: button `48px`; thin button `32px`; launch widget pill `31px`; paginator buttons `48x48`; social circles `48x48`; section-tab underline `1px`.
- Radii: `4px` (buttons, widget, inputs), `3-5px` (menus), `50%` (dots, social buttons), `24px` (badge pills, 48px tall), `8px` (thumbnails). No other radii. [Third-party sources claim a 32px pill button [R: https://design.hagicode.com/designs/spacex/DESIGN.md]; the live `.spx-button` CSS says 4px. Trust the live CSS.]
- Hairlines: always `1px solid`, colour `--white-25` / `--white-30` / `--white-35`, or `--white-80`/`--white-100` for emphasis (e.g. the webcast row top border, the progression line).

### 3.3 Elevation, blur, overlays [V]

- No shadows except dropdown `box-shadow: 0 8px 16px #0003`.
- Glass: `backdrop-filter: blur(16px)` + `--gray-60` for dropdowns and pagination menus; `blur(6px)` for the hover card of the upcoming-launch widget; `backdrop-filter: brightness(.5)` for a full-screen dimming overlay (`.overlay`).
- Gradients (see section 9 for imagery).

### 3.4 Breakpoints [V]

`1500`, `1350`, `1279` (nav collapses to hamburger menu), `1000` (tracker stacks), `961` (main mobile switch; used 40 times), `768`, `600`, `399`. Also `@media (hover: none)` for touch (e.g. show hidden buttons permanently).

---

## 4. Typography

### 4.1 What SpaceX loads [V]

From `@font-face` in `styles.*.css`, and from the font files' own name tables (read with fontTools):

| Family name in CSS | File | Name table | Notes |
|---|---|---|---|
| `D-DIN` | `D-DIN.*.woff2/.woff/.otf` | "D-DIN", Regular, v1.00, (c) 2017 Datto Inc., SIL Open Font License 1.1, Reserved Font Name "D-DIN" | weight 400, `font-display: block` |
| `D-DIN-Bold` | `D-DIN-Bold.*` | "D-DIN Bold" | declared as `font-weight: 400` under its own family name (so headings never faux-bold) |
| `D-DIN-PRO` (400, 700) | `D-DIN-PRO*.woff2` | "D-DIN-PRO" v1.000 | `font-display: swap`, same metrics as D-DIN |
| `Roboto Mono` | `RobotoMono.*.ttf` | Roboto Mono Regular v3.001, OFL | weight 400 only; used for all data/telemetry/table text |

So the typeface is **D-DIN by Datto, an OFL DIN-style grotesque**. It is not on Google Fonts [R: https://learnui.design/blog/din-similar-fonts.html says the same and points to Font Squirrel as the download source]. Because it is OFL it can legally be self-hosted if sourced from its original distribution (not by hot-linking spacex.com); mind the Reserved Font Name clause if you subset or convert it. This spec uses Google Fonts alternatives (section 4.5).

Measured D-DIN metrics [V, computed from the font files]: unitsPerEm 1000; cap-height 0.690 em; x-height / cap-height 0.735 (Regular) / 0.754 (Bold); mean uppercase advance / cap-height 0.826; mean lowercase advance / cap-height 0.675 (Regular) / 0.691 (Bold); Bold stem / cap-height 0.190. Digits are **proportional** (advance widths vary 0.18 em) and there is no `tnum` feature; this is why SpaceX sets numeric readouts in Roboto Mono and builds the countdown from fixed-width digit columns.

Font stack fallbacks [V]: `D-DIN, Arial, Verdana, sans-serif` (body). Third-party sources add DIN Alternate and Helvetica Neue [R: https://open-design.ai/plugins/design-system-spacex/].

### 4.2 Case, tracking, weight rules [V]

- **Uppercase** applies to: `h1`, `h2`, `h3`, `h4`, nav links, buttons, table labels and cells, section sub-headers, stat labels, footer links, launch widget text, filters, badges, timeline text, telemetry. Body paragraphs (`p`) are sentence case in most tiles but are uppercased in hero/center blocks (`.inner-center p`, `.inner-center-top p`). Long reading text (company updates) is sentence case at `1.0625rem / 1.75`.
- **Tracking**: headings `.02em` (3rem => 0.96px, matches [R] "0.96px"); nav `.09em` (0.813rem => 1.17px, matches [R]); mono data `.36px`; buttons `.08em` (minimal/thin variants); badges `.08em`; sub-headers `.08em`; widget title `1px`; filter menu items `1.2px`-`1.5px`; huge hero numerals/titles go **negative** (`-1px` at 100px / 80px). Rule of thumb: small caps text opens up (+0.02 to +0.09em), huge display tightens (-1px).
- **Weights**: only 400 and 700 exist. Bold is used for h1/h2, nav links (`700`), the active `<a>`/link text, table value cells (`600`), tabs (`600`). Everything else 400.
- **Line-height**: display `95%` (h1 hero `line-height: 95%` / `1.0`), section titles `48px` for 3rem (1.0), `h2` blurbs `32px` for 1.25rem, body `1.5`-`1.6`, nav `94%`, mono data `100%`-`140%`.

### 4.3 Type scale (verified values, grouped by role)

| Role | Family | Size | Weight | Case | Tracking | Line-height | Source |
|---|---|---|---|---|---|---|---|
| Hero centered title (`.inner-center h1`) | D-DIN-Bold | 100px (mobile 50px) | 400 (Bold face) | upper | -1px | 95% | [V] |
| Launch/feature hero title | D-DIN-Bold | 5rem (80px), mobile 46px | | upper | -1px | 95% | [V] |
| Section title (`h2`, `.section-title`) | D-DIN-Bold | 3rem (48px), mobile 2.25rem | | upper | .02em | 48px (1.0) | [V] |
| Tile title (`h1` in launch/stats tile) | D-DIN-Bold | 46px, mobile 32px | | upper | .02em | 3rem | [V] |
| Stat numeral (`.stat-number`) | D-DIN | 8.75rem (140px), <=961: 5rem, <=600: 3rem | 400 | | | 1 | [V] |
| Stat label | D-DIN | 1.25rem, <=961: .75rem | 400 | upper | | | [V] |
| Sub-title / lead (`h2` inside metric tile, `h3`) | D-DIN | 1.25rem (20px) | 400 | upper (h3) | .02em | 32px | [V] |
| Feature header | D-DIN-Bold | 1.25rem | | | | 1.2 | [V] |
| Feature text | D-DIN | .9375rem (15px) | 400 | | | 1.5 | [V] |
| Body | D-DIN | 1rem (16px) | 400 | sentence | | 1.5rem / 1.6 | [V] |
| Long-form | D-DIN | 1.0625rem (17px) | 400 | sentence | | 1.75 | [V] |
| Nav link | D-DIN (bold weight) | .813rem (13px) | 700 | upper | .09em | 94% | [V] |
| Mobile nav link | D-DIN-Bold | 1.125rem | | upper | | 120% | [V] |
| Button label | D-DIN | .75rem (12px) | 400 | upper | .08em (minimal/thin) | 100% | [V] |
| Footer link / text | D-DIN | .75rem | 400 | upper | | | [V] |
| Section sub-header (kicker) | **Roboto Mono** | .875rem (14px) | 400 | upper | .08em | | colour `--white-50` [V] |
| Tile sub-header | Roboto Mono | 12px | 400 | upper | | 140% | `--white-80` [V] |
| Table header (`th`) | Roboto Mono | .875rem | 400 | upper | .36px | 120% | `--white-100` [V] |
| Table cell (`td`) | Roboto Mono | .875rem (12px in timeline) | 400 | upper | .36px | 140% | `--white-80`, hover `--white-100` [V] |
| Telemetry label / value | Roboto Mono | 14px | 400 / 700 (value) | upper | .36px | 100% | `--white-60` / `--white-80` [V] |
| Countdown | Roboto Mono | 12px | 400 | upper | | 24px | [V] |
| Launch-widget title | D-DIN | .625rem (10px) | 400 | upper | 1px | 94% | [V] |
| Launch-widget time | D-DIN | .75rem | 400 | upper | | | [V] |
| Paginator text | Roboto Mono | 12px (10px sub) | 400 | | | 140% | [V] |
| Badge/pill | D-DIN | .75rem | 400 | upper | .08em | 100% | [V] |
| Section tabs | D-DIN | 1rem (tiny tabs .75rem) | 600 | upper | | | opacity .3 inactive, 1 active + 1px underline [V] |

### 4.4 Mobile type [V]

`@media (max-width: 961px)`: h1 2.25rem, section h2 2.25rem/2.25rem, h3 .825rem, p 1rem/1.6, hero 50px, stat numeral 5rem then 3rem at 600px, nav items 1.125rem Bold.

### 4.5 Free font mapping (Google Fonts, all verified 200 with real `@font-face` blocks)

Verification method: `curl https://fonts.googleapis.com/css2?family=...:wght@400;500;600;700&display=swap` with a browser UA, checked HTTP 200 and counted `@font-face` blocks per weight. I also downloaded the latin woff2 files, measured them against D-DIN with fontTools (mean uppercase advance, mean lowercase advance, x-height ratio, stem), and rendered side-by-side images. Caveat: for variable fonts (Inter, Sofia Sans, Geist) the 700 stem is read from the default instance, so their 700 scores are unreliable; Barlow, Saira, Titillium, Rajdhani, Chakra Petch are static per weight.

**Display (headings, big numerals, nav): Barlow 700 (primary), Barlow Semi Condensed 600-700 (tight/long headings), Saira Semi Condensed 700 (closest by raw metrics).**
- Barlow: DIN-style rounded-rectangle grotesk, a full family (verified weights 100 through 900 upright; 12 `@font-face` blocks for 400/500/600/700 = 3 subsets x 4 weights; italics not checked). Closest in feel and the only close candidate with **`tnum` (tabular figures)** and `frac`/`pnum`, so it can also carry numbers in tables. Mean uppercase advance 0.872 vs D-DIN Bold 0.825 (about 6% wider; use `letter-spacing: -0.005em` or `font-stretch`-like tightening, or switch to Semi Condensed for headlines that must fit).
- Barlow Semi Condensed 700: uppercase 0.770 (7% narrower than D-DIN). Use at `letter-spacing: .03em` for headings that need D-DIN's footprint.
- Saira Semi Condensed 700: uppercase 0.826 (matches D-DIN Bold 0.825), x-height 0.741 (D-DIN 0.754), lowercase 0.691 (identical). Slightly more "technical"/squared. Has no `tnum`. Best "metric clone"; pick it if headline line-breaks must match SpaceX-like proportions.
- Rejected after measurement/visual: Archivo (too wide, uppercase 1.007), Chakra Petch / Oxanium / Exo 2 (squared sci-fi forms, too themed), Inter / Geist / Hanken (too wide and too neutral), Roboto Condensed (too narrow), Rajdhani (good width 0.838 but light/thin forms and x-height 0.793 too tall), Titillium Web (width 0.871, softer; acceptable second choice).

**Body / UI: Barlow 400-500** (same family as display for one coherent voice). Titillium Web 400 (verified: 400, 600, 700) and Inter Tight are fallbacks. Barlow 400 lowercase advance 0.695 vs D-DIN 0.675 (3% wider): set body at `font-size: 0.97rem` or accept.

**Mono / numeric readouts: Roboto Mono 400-500 (exactly what SpaceX ships for data), JetBrains Mono or Geist Mono as alternates.** Roboto Mono verified at 100-700 variable range. Digits are 1229/2048 em wide, fixed, so countdowns and aligned columns never jitter. Roboto Mono has no `tnum` because every glyph is already fixed-width.

CSS stacks:

```css
--font-display: "Barlow", "Barlow Semi Condensed", "DIN Alternate", "Arial Narrow", Arial, sans-serif;
--font-body:    "Barlow", "DIN Alternate", Arial, sans-serif;
--font-mono:    "Roboto Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
```

Google Fonts URLs (copy exactly):

- Barlow (display + body): `https://fonts.googleapis.com/css2?family=Barlow:wght@400;500;600;700&display=swap`
- Barlow Semi Condensed: `https://fonts.googleapis.com/css2?family=Barlow+Semi+Condensed:wght@400;500;600;700&display=swap`
- Saira Semi Condensed: `https://fonts.googleapis.com/css2?family=Saira+Semi+Condensed:wght@400;500;600;700&display=swap`
- Roboto Mono: `https://fonts.googleapis.com/css2?family=Roboto+Mono:wght@400;500;600;700&display=swap`
- Combined load for the site: `https://fonts.googleapis.com/css2?family=Barlow:wght@400;500;600;700&family=Barlow+Semi+Condensed:wght@500;600;700&family=Roboto+Mono:wght@400;500&display=swap`

Numeric rule [I]: `font-variant-numeric: tabular-nums` on any Barlow number in tables; `font-family: var(--font-mono)` for countdown digits, telemetry and anywhere digits must not jitter.

---

## 5. Layout and section structure

### 5.1 Page structure [V]

- Home = fixed header + a vertical stack of `spx-section` tiles + footer. Each tile has `.section` (relative, full width) containing `.image-wrapper` (absolutely positioned background media), an optional gradient layer, and `.section-inner` (centered, `max-width 1400-1700px`, `height: max(100vh, 941px)`) that holds the text block.
- **No page-level scroll-snap**. `scroll-snap` appears only inside the Swiper library CSS for carousels [V: grep of every bundle]. There is no `scroll-behavior: smooth`, no wheel hijack. Scroll is native.
- **Scroll-linked pinned scenes** exist for spec showcases (`stats-tile`): a `.scroll-track` of `N x 100vh`, a `position: sticky; top: 0; height: 100vh` viewport, and a rAF-throttled handler that maps scroll progress to sub-section index (0..N-1), swapping the right-half image and the left-column text/tabs. Clicking a tab scrolls to `(i + .5) / N` of the track. Image uses `transition: transform .15s linear` [V]. Mobile disables pinning.
- **Scroll-driven CSS animation**: carousels use `animation-timeline: view()` for a card reveal (`transform: translateY(-100%)` to `0` by 25% of view progress) [V].
- **Scroll cue**: an arrow at `bottom: 20px`, `animation: scrollme 3s infinite` (starts at `translateY(-35px)` full opacity, fades to 0) [V].

### 5.2 Text block positions (the "tile grammar") [V]

| Class | Placement |
|---|---|
| `.inner-center` | absolute, top 50%, left 50%, width 90%, max 960px, centered text, `translate(-50%,-50%) translateY(-50px)` |
| `.inner-center-top` / `-topmost` | top 15% / unset, centered |
| `.inner-left-middle(-compact)` | `left: 100px; top: 50%`, max-width 450-650px (520/425 compact), `translateY(-50%)` |
| `.inner-left-top` | `left: 100px; top: 13%`, max 430-535px |
| `.inner-left-bottom` | `left: 100px; bottom: 15%`, max 520px |
| `.inner-right-top` / `-topmost` | `right: 100px; top: 13%` (topmost 5%), max 450px |
| `.inner-right-middle` / `.inner-right-bottom` | mirrored |

Mobile: text block becomes in-flow, full width, `padding 16px`, media gets a fixed `400px` height or `67%` of the viewport with a vertical black gradient joining it to the text.

Inside a block, the order is: optional mono sub-header (kicker) => h1/h2 (uppercase) => `p` (1rem, `max-width: 26rem` for descriptions) => buttons row (`gap: 16px`) [V].

### 5.3 Stats strip [V]

`ul` of three equal `li` (width 29%, margin 1%), centered, max-width 940px, `margin: 75px 0`: numeral at 8.75rem D-DIN regular, label 1.25rem uppercase `--white-80` under it. No dividers.

### 5.4 Footer [V]

Single row: `margin: 12px 60px`, left = circular 48px social buttons (`--white-10` fill), center/right = link row (12px uppercase, `column-gap: 36px`). A pre-footer newsletter block: centered, max 960px, `margin: 75px auto`, a **1px x 160px white vertical rule** (`.line-tall`) above the form, then an email input (`border: 1px solid #555`, `rgba(0,0,0,.5)` fill, 4px radius, 48px high) beside the ghost submit button [V]. On mobile the footer stacks and centers.

---

## 6. Navigation

Desktop [V]:
- `position: fixed; top: 0; width: 100%; z-index: 100`. Background is **not** a bar: `linear-gradient(180deg, rgba(0,0,0,.6) 0%, rgba(0,0,0,0) 95%)`. A 300px `.header-shadow` (`rgba(0,0,0,.5)` to transparent) is layered beneath.
- Padding `24px 60px`, `column-gap: 40px`. Logo at left, text links in a row (`column-gap: 24px`), 13px bold uppercase `.09em`, colour `--white-90` rest, `--white-100` hover (no underline, no background). A bordered pill (31px, 1px `--white-25`, 4px radius) sits `position: absolute; right: 5%` and shows a live countdown; on hover it blurs (6px) and expands into a card.
- Dropdown sub-menus open on **hover** (`mouseenter` / `mouseleave`, desktop only): `max-height 0 -> 220px`, `opacity 0 -> 1` over `.5s ease`; item rows spaced `12px`, 94% line-height, weight 400. A `.menu-backdrop` (a 360px black-to-transparent gradient) fades in `.3s` behind open menus.
- **Hide on scroll-down / show on scroll-up**: JS `onScroll`: visible if `pageYOffset < previous` OR `< 50` OR menu expanded; otherwise `.header-hide { opacity: 0 }` (`transition: opacity .3s`) [V].

Mobile (<=1279px) [V]: nav turns into a full-height solid black overlay (`#000`, `100svh`), logo top-left (16px), hamburger button at `right: 12px`. Links stack: 1.125rem D-DIN-Bold uppercase, `--white-80` (active `--white-100`), `row-gap: 35px`, `margin: 0 16px`. Sub-menus expand inline (`row-gap: 24px`, 0.825rem regular). The launch widget is moved into the overlay and shown as a static card.

Translation [I]: keep a 5-6 link row (Plan, Hardware, Compliance, Supply chain, Timeline, Data), the one bordered pill on the right as a live "T-minus / compliance %" readout, the hide-on-scroll-down behavior, and the gradient scrim instead of a solid bar.

---

## 7. Buttons, links, badges, inputs, menus [V]

**Ghost button (`.spx-button`)**: `height: 48px; border: 1px solid var(--white-35); border-radius: 4px; display: inline-flex; align-items: center; background: var(--black-50); color: var(--white-100)`, with horizontal padding set per use through a `paddingHorizontal` input (default not located). Label: D-DIN 12px uppercase, centred, `line-height: 100%`. Transition `background-color .5s cubic-bezier(.19,1,.22,1)`; text colour transitions on the same curve.
- **Hover**: background becomes `--white-100` (solid `#F0F0FA`), label becomes `#000`, icon gets `filter: invert(100%)` (`.4s`). Border colour is unchanged. Arrow icon runs `slide-out` (0 -> +10px, opacity 1 -> 0, `.2s`) then `slide-in` (-10px -> 0, `.4s`, delay `.2s`) so the arrow "passes through".
- Variants: `primary` (bg `--black-50`), `tertiary` (`#232323`), `minimal` (colour `--white-80`, tracking `.08em`), `thin` (32px, no border, bg `--gray-60`), `white` (bg `--white-100`, border `--white-100`, label `#000`), `no-border` (no border, no transition), `disabled` (`opacity .3; pointer-events: none`), `[aria-selected=true]` (inverted: white bg, black text). Spinner: 15px ring, 2px white, transparent top, `spin 1s linear infinite`.
- Icon gap: `10px` from text; icon box `16px`.
- Legacy CTA in sections: `.btn` `height 65px; min-width 200px; border: 2px solid #fff; uppercase` [V in CSS, superseded by `.spx-button`].
- `all-missions-button`: `background #000; border 1px solid --white-35; radius 4px; padding 12px 20px; 14px uppercase; column-gap 8px` [V].

**Text links**: no underline anywhere (`text-decoration: none`); colour `--white-100`; CMS inline links: bold + white, hover `#ccc`. Card-style links gain an arrow glyph that moves `margin-left: 0 -> 5px` over `.3s ease-in-out` on hover [V].

**Badge/pill**: `height 48px; padding 0 40px; border 1px solid --white-35; radius 24px; 12px uppercase .08em; no fill` [V].

**Tabs (in-section)**: text buttons, uppercase, 1rem/600, `opacity .3` inactive, `opacity 1` + `border-bottom: 1px solid white` for `[aria-selected=true]`, `transition: opacity .3s`; spacing `margin: 0 10px` [V].

**Dropdown / filter**: filter trigger = Roboto Mono 14px uppercase `.36px`, `--white-80`, no border; menu `#313233`, 3px radius, items Roboto Mono 10px uppercase `1.2px`, `padding 6px 16px`, hover `#ffffff1a`. Generic dropdown = `--gray-60` + `blur(16px)`, 5px radius, `0 8px 16px #0003`, items 16px D-DIN `--white-80` => `--white-100` on hover [V].

**Pagination**: 48x48 `--gray-60` square buttons (4px radius), disabled `opacity .3`, transitions `opacity .4s ease-out`; counter in Roboto Mono 12px [V]. Carousel pagination bullets are **bars**: `32px x 2px`, radius 0, gap 4px, active `--white-100` (100%), inactive `#fff` at 50% [V, Swiper vars].

**Inputs**: 48px high, `border 1px solid #555`, `background rgba(0,0,0,.5)`, 4px radius, 12px D-DIN placeholder `--white-100` (email) or `--white-50` (page footer); focus-visible keeps the same border and sets `outline: none` (an accessibility gap; add a visible ring, see section 12) [V].

---

## 8. Data readouts

### 8.1 Live countdown [V]

- Implementation: separate **rolling digit columns**: days hundreds/tens/ones, hours tens/ones, minutes tens/ones, seconds tens/ones. Each column is `overflow: hidden; height: 13px; width: var(--countdown-digit-width)` (8px in the nav pill, 5.5px in compact cards, 10px elsewhere) containing a `position: absolute` stack of digits; the stack's `top` is set to `digit * -13px` with `transition: top .3s`. Tens columns cycle 0-5 (minutes/seconds), 0-2 (hours); updated every 1000ms outside Angular's zone. Separators are 6x6 SVG glyphs. Text rows are Roboto Mono 12px uppercase.
- **Live indicator**: a **6x6 square** (not a circle) filled `#F0F0FA`, `animation: blinker 2.5s linear(0 50%, 1 51%) infinite` which is a hard step: fully on for 50% of the cycle, fully off for 50%, no fade.
- Widget: `height 31px; border 1px solid --white-25; radius 4px; padding 0 10px;` title 10px uppercase `1px` tracking `--white-90`; time 12px uppercase right-aligned in an 8rem slot; hover swaps the time for an arrow and reveals the card.

Translate [I]: build the countdown to the compliance deadline / pilot-build date exactly this way: `T-` label, Roboto Mono, rolling columns, one blinking square for "live data".

### 8.2 Spec table (label/value rows) [V, `stats-tile` and `metric-tile`]

`table { border-collapse: collapse; width: 100%; margin-top: 30px }`, `td { padding: 20px 0; border-bottom: 1px solid var(--white-30) }`, label cell: D-DIN uppercase `.875rem` / 1.4 `--white-100` (pre-line wrapping); value cell: `1rem`, **right-aligned**, `white-space: nowrap`, weight 400 in `stats-tile` and 600 in `metric-tile`. No header row, no zebra, no vertical rules.

### 8.3 Telemetry table [V, `vehicle-tracker`]

`display: table; width: 100%`, row `border-bottom: 1px solid rgba(255,255,255,.25)` (last row none), `td { padding: 24px 0 }`, label + value: Roboto Mono 14px uppercase `.36px`, label `--white-60`, **value weight 700 `--white-80` right-aligned**. Fades in (`opacity: 0 -> 1`). A radial preloader: 50px SVG ring (`#232323` track, `#fff` progress) with the percentage in 10px bold centered.

### 8.4 List/mission table [V, `upcoming-launches-page`]

`th`: Roboto Mono 14px uppercase `.36px` `--white-100`, `padding-bottom: 24px`, no border. `tbody tr`: `border-top: 1px solid rgba(255,255,255,.25)`, cells `padding 24px 0`, Roboto Mono 14px uppercase `--white-80`, five equal columns (20%), last column right-aligned. **Hover**: row `border-top-color` -> `--white-80` (`.2s ease-out`), cells -> `--white-100`, `cursor: pointer`. Mobile: `thead` hidden, each row becomes a 2-column grid card with background `#121212` and `16px` padding.

### 8.5 Timeline table (T-minus events) [V, `launch-detail-page`]

Roboto Mono 12px uppercase 140%, `th/td padding 24px 0`, first column `min-width 138px; padding-left 16px; padding-right 24px`, rows `border-top: 1px solid rgba(255,255,255,.25)` with `transition: border-top-color .2s ease-in`. Mobile: rows become flex columns with `row-gap: 4px`.

### 8.5b Progression / stepper [V, `progression-tile`]

Container `max-width 960px`, `text-align: center`: a row of uppercase step headers above a **1px white line** (`border-top`, `top: 6px`) carrying **13px filled white circles** at equal intervals, with step text below that is `opacity 0` until `.highlight` (then `1`). Mobile turns into an accordion with 10px dots and a rotated border-chevron.

### 8.6 Infographic nodes [V]

Hotspots are **10px white dots** with a 2px `--black-80` ring, `transform: scale(1.5)` on highlight (`1.2` on hover, `.3s ease`). Node labels: 14px uppercase h4; non-active labels dim to `opacity .3`; descriptions `13px/16px --white-35` hidden (`opacity 0`) until their node is `.highlight`. Translate [I] to the globe: supplier/factory pins as 10px dots with the same ring and a label that lifts out on hover/selection.

### 8.7 Hero numerals [V]

Stat numerals use plain D-DIN Regular (not Bold) at 8.75rem so the figures feel light at large size; labels are small uppercase beneath. Translate [I]: percentages (compliance, BOM coverage) use Barlow 500 at 96-140px with the unit (`%`) at 0.3x and baseline-aligned in `--white-50`.

---

## 9. Imagery and overlays [V]

- Media fills `.image-wrapper` (`position: absolute; width/height 100%` (+10px bleed); `object-fit: cover; object-position: center`; fallback `background #000`). No borders, no radius, no frames. Content half-height variants contain the image (`left/right: 120px`, `object-fit: contain; object-position: right center`).
- Gradients are always **black-to-transparent**, never tinted, direction chosen by where the text sits:
  - text left: `linear-gradient(270deg, rgba(0,0,0,0) 50%, rgba(0,0,0,.8) 100%)`
  - text right: `linear-gradient(90deg, rgba(0,0,0,0) 50%, rgba(0,0,0,.8) 100%)`
  - bottom fade into next section: `linear-gradient(180deg, rgba(0,0,0,0) 50%, #000 100%)`
  - combo (bottom + side): `linear-gradient(270deg, rgba(0,0,0,0) 30%, rgba(0,0,0,.8) 100%), linear-gradient(180deg, rgba(0,0,0,0) 50%, #000 100%)`
  - hero detail page: bottom `0 -> #000` over 50-100% plus left `0 -> .8` over 50-100%
  - radial vignette: `radial-gradient(circle, rgba(255,255,255,0) 50%, #000 100%)` plus 90%-100% edge fades
  - top header scrim: `rgba(0,0,0,.6)` -> transparent over 95%
  - mobile: single vertical `linear-gradient(0deg, #000 0%, rgba(0,0,0,0) 50%, rgba(0,0,0,.5) 100%)` over the top 67-68% media block.
- Dim a whole screen with `backdrop-filter: brightness(.5)` (video lightbox).
- Video overlays slide up from the bottom: `height 0 -> 100%`, `top: 100vh -> 0`, `transition: top 1s`, closes with `slide-up 1s`.

### 9.1 The photo-free background SpaceX already ships: `dot-grid-background` [V]

A `<canvas>` on `#000` (`position: absolute; inset: 0; pointer-events: none`) that fades in `opacity 0 -> 1` over `.6s`. Parameters read from the component:
- Grid pitch `16px`; each dot is a filled square of half-size `1.05px * (0.78 + 0.5*depth) * (1 + 0.35*glow)`, colour `#fff`, per-dot alpha 0.00-1 (`BASE .15`, `SPARK .3`, `AMB 1.15`, `HOVER 2.4`, `CLIFT .45`).
- Per-dot "twinkle": product of two sines at speed `0.0033 * (0.4 .. 1.6)`; per-dot depth from low-frequency 2D sine noise (`DEPTH .5`) so the field has soft density variation; edges fade over 60px.
- **Intro sweep**: 3000ms ease-in-out diagonal wave (band 0.3, crest 1.2) starting 250ms after mount.
- **Pointer glow**: radius 460px; the glow position lerps toward the pointer at 0.14 per frame; each dot's "heat" decays at 0.986 per frame (a comet-like trail); heat raises alpha and size.
- Perf/accessibility: runs only while in view (IntersectionObserver, threshold .01), pauses when the tab is hidden, caps DPR at 2, **honours `prefers-reduced-motion`** by drawing one static frame, no listeners attached.
- Selected per section by `backgroundEffect === "dot-grid"`.

Use this (re-implemented, ~80 lines of canvas 2D) behind the robot hero [I].

---

## 10. Motion [V]

| Name | Definition | Where |
|---|---|---|
| Hero headline reveal | `reveal-header`: `opacity 0, translateY(220%)` => `none`, `.75s ease-in-out` | keyframes and classes verified in `styles.*.css`; used by 12 page chunks; mapping to specific elements (headline, kicker, button) is inferred from the names |
| Sub-header reveal | `reveal-subheader`: `translateY(80%)` => none, `.75s ease-in-out`, `animation-delay .5s`, `fill-mode backwards` | |
| Button reveal | `reveal-button`: `translateY(300%)` => none, `.75s ease-in-out`, `animation-delay 1s`, backwards | |
| Primary easing | `cubic-bezier(.19, 1, .22, 1)` (expo-out) | button bg/text, `.5s` |
| Material easing | `cubic-bezier(.25, .8, .25, 1)` | overlays `.4s`, form fields `.4s`, accordions `300-600ms` |
| Hover transitions | `background-color .4-.5s`, `filter .4s`, `border-top-color .2s ease-in/out`, `opacity .2s ease-in`, `opacity .3s`, `opacity .4s ease-out` | |
| Dropdown | `opacity .5s ease` + `max-height` 0 -> 220px | nav |
| Card hover | `left 1s, opacity 1s, visibility 1s` with `blur(6px)` | widget |
| Countdown digit | `top .3s` | |
| Blinker | `2.5s linear(0 50%, 1 51%) infinite` (stepped) | |
| Scroll cue | `3s infinite`, `translateY(-35px)` + fade out | |
| Header | `opacity .3s` | |
| Pinned image | `transform .15s linear` | stats tile |
| Carousel | Swiper; `view()`-driven card reveal | |

Rules: durations 0.2-0.5s for interaction, 0.75s for reveals, 1s for large panel moves, 3s for ambient loops; no springs, no overshoot, no parallax found. Reveal order is headline -> blurb (+0.5s) -> button (+1s). I did not find `prefers-reduced-motion` in the CSS, only in the canvas JS; apply it globally in our build [I].

---

## 11. Translation to the humanoid-robot planning site [I unless noted]

**Hero scene (3D render on black).** `section` full-viewport; canvas for the robot is absolutely positioned and bleeds off the right or left edge (SpaceX uses `.image-wrapper` right 50% in the stats tile); text block pinned to the opposite margin at `left: clamp(24px, 7vw, 100px)`. Backdrop: black plus the dot-grid canvas at low alpha behind the robot, and a left black gradient (`270deg, transparent 50% -> rgba(0,0,0,.8)`) only if the grid competes with text. Light the robot with a cool white key (`#F0F0FA`-tinted) and a faint rim light; no coloured lights, no floor reflection box. Hero title in uppercase Barlow 700 at `clamp(48px, 7vw, 100px)`, `-0.01em`, line-height 0.95; mono kicker above it (`RUN 07 / BIPED / US-COMPLIANT`) in Roboto Mono 14px `--white-50` `.08em`; one ghost button below. Reveal order: headline (0.75s), kicker (+0.5s), button (+1s).

**Live countdown.** Pill in the nav (31px, 1px `--white-25`, 4px radius) plus a large version in a scene: rolling digit columns, Roboto Mono, blinking 6x6 square, `D / H / M / S` micro-labels in 10px uppercase `1px`.

**Percentages / KPIs.** Three-up stat strip: numerals 8.75rem (clamp to 3rem on mobile) with 1.25rem uppercase labels, `--white-80`. No cards. Add a hairline progress bar under each (1px track `--white-25`, 1px fill `--white-100`; fill animates `width 1s cubic-bezier(.19,1,.22,1)` on enter).

**Tables (BOM, standards, suppliers).** Use the mission-table pattern: Roboto Mono 14px uppercase `.36px`, `th` `--white-100`, `td` `--white-80`, `1px rgba(255,255,255,.25)` row top borders, 24px vertical padding, 20% columns, right-aligned last numeric column, row hover raises the rule to `--white-80` and text to `--white-100` over 0.2s. Mobile: hide `thead`, 2-column grid cards on `#121212`.

**Spec table (robot dimensions, actuators).** Pinned scene: left column spec table (8.2) with tabs, right half the live render; scroll position selects the subsystem and the 3D camera flies to it. Use the `stats-tile` pinning math (`track = N * 100vh`, `progress = clamp(-rect.top / (rect.height - innerHeight))`).

**Globe.** Dots-on-black: a globe made of 1px white dots (same dot-grid logic mapped to a sphere), supplier/test-site pins as 10px white dots with a 2px black ring, scale 1.5 on selection; label in 14px uppercase; description 13px, set at `--white-60` rather than SpaceX's `--white-35` (see section 12), hidden until selected. Pins connect with 1px `--white-35` great-circle arcs.

**Timeline.** Progression-tile pattern: 1px white line, 13px filled dots, uppercase step headers above, detail text below fading in for the active step; vertical on mobile as an accordion.

**Checklist (compliance).** Rows in the telemetry-table style: label (Roboto Mono, `--white-60`) left, status right (value in 700, `--white-80`), `1px` row rules, status as `[ ]` / `[X]` square glyphs or a 10x10 outlined/filled square (matching the 6x6 square blinker language); the "open/in-progress" state blinks the square at 2.5s stepped.

**Navigation / chrome.** Fixed transparent header with top gradient; hide on scroll-down after 50px; hover mega-menu optional; footer one-line uppercase 12px links.

**What makes it feel premium, in implementable terms:**
1. Never more than ~3 type sizes visible in one viewport; sizes jump (12 / 16 / 48 / 140) with nothing between.
2. 60-100px outer gutters and 450-650px text columns; at least 40% of the viewport is empty black.
3. One colour, stepped opacities; hover = brighten text one step or invert to solid white, never change hue.
4. 1px hairlines at 25-35% white; never 2px, never boxed cards, never shadows.
5. Uppercase labels with open tracking (+0.02 to +0.09em) and tight huge display (-1px).
6. Eased 0.4-0.75s reveals, sequenced by 0.5s delays; no looping motion except one ambient element (dot grid, blinking square).
7. Data in monospace, right-aligned values, fixed-width digit columns.
8. Sections that end by fading to `#000`, so the page reads as continuous black with objects surfacing in it.

---

## 12. Gaps in the SpaceX system you should not copy [I, from verified CSS]

- Focus: inputs set `outline: none` on `:focus-visible` and I found no global focus ring. Add `outline: 1px solid var(--white-100); outline-offset: 3px` on `:focus-visible`.
- Low-contrast text: `--white-35` (2.79:1) is used for node descriptions and `--white-30` for rules. Use `--white-50` (4.78:1) as the minimum for any text; keep 35/30/25 for borders only.
- Hover-only disclosure (menus, widget card, button on card) needs a touch/keyboard equivalent; SpaceX adds `@media (hover: none)` rules in a few places only.
- `font-display: block` on D-DIN causes invisible text during load; use `swap` or `optional` with metric-matched fallback for Barlow.
- No `prefers-reduced-motion` in CSS (only in the canvas JS); add it globally.

---

## 13. Conflicts between third-party write-ups and the live CSS

| Claim | Source | Live CSS says |
|---|---|---|
| Ghost button radius 32px, "only interactive element" | [R] https://design.hagicode.com/designs/spacex/DESIGN.md, https://opendesigner.io/design-systems/spacex | `.spx-button` radius 4px; filled/inverting on hover; many other controls (tabs, dropdowns, pills, inputs, tables); 24px radius only on badge pills |
| Mono stack `ui-monospace, SF Mono, JetBrains Mono...` | [R] opendesigner.io | Roboto Mono, loaded as a webfont [V] |
| "No borders except the ghost button" | [R] | Hairline borders all over (tables, tiles, pills, inputs) [V] |
| "No transitions/animation documented" | [R] | multiple keyframes and easings [V] |
| Tracking `0.96px`, `1.17px` | [R] hagicode | matches `.02em` @ 48px and `.09em` @ 13px [V] |
| `#000`, `#f0f0fa` | [R] | matches [V] |
| Nav 13px bold uppercase | [R] | matches [V] |

---

## 14. Unverified / not confirmed

- Hover/transition behavior on sub-pages whose chunks I did not render (Starship, Dragon, Human Spaceflight page layouts); their component CSS was read, but I did not see rendered output.
- The hero video behavior beyond what CSS/JS shows (autoplay/muted/loop flags are inside CMS data and component code not fully traced).
- Exact horizontal padding of `.spx-button` (set by an Angular `paddingHorizontal` input per usage; default not located).
- Exact `.inner-center-top` font (`D-DIN-Regular`, which is not declared as an `@font-face`, so it falls back to the body stack) [V that it falls back; intent unknown].
- Whether SpaceX uses `font-synthesis` or true bold faces beyond D-DIN-Bold (it declares separate families, so no synthesis is needed).
- Whether D-DIN's original distribution (e.g. Font Squirrel) is current or what its license FAQ says about subsetting under the Reserved Font Name; only the embedded OFL text was read.
- Any behavior behind JS-rendered pages not covered by the downloaded 67 chunks (all chunks named in `runtime.*.js` were downloaded).
- Real-world performance of the dot-grid at 4K; only the code was read, not profiled.
- Whether the live site's CSS changes with A/B variants; the files are hashed per build (`styles.1a4bd8588c6ea618.css`) and could change.

---

## 15. Sources

Primary [V]:
- https://www.spacex.com/ (HTML shell with inlined `:root` tokens and `@font-face`)
- https://www.spacex.com/styles.1a4bd8588c6ea618.css (global CSS)
- https://www.spacex.com/main.38aaaafc31bc4ec8.js and 67 lazy chunks listed in `runtime.56febfaf067bbae1.js` (component CSS: header, footer, spx-button, spx-section, stats, stats-tile, metric-tile, launch-tile, launch-detail-page, upcoming-launches-page, vehicle-tracker, progression-tile, infographic-tile, badge-section, dropdown, filter, paginator, swiper, dot-grid-background, launch-countdown, launch-countdown-digit, blinker-svg)
- https://www.spacex.com/D-DIN.e58c68e58b09fc0e.woff2, D-DIN-Bold.9a5ce67e997fd030.woff2, D-DIN-PRO*.woff2, RobotoMono.19b5beb679797c73.ttf (name tables and glyph metrics read with fontTools)
- https://content.spacex.com/api/spacex-website/homepage-tiles (only layout fields read: `alignContent`, `backgroundGradient`, `isHero`, `linkIcon`, `linkAnimation`, string lengths; no copy reproduced)
- https://fonts.googleapis.com/css2?family=... (Barlow, Barlow Semi Condensed, Barlow Condensed, Saira, Saira Semi Condensed, Exo 2, Rajdhani, Chakra Petch, Oxanium, Sofia Sans, Roboto Condensed, Roboto Mono, JetBrains Mono, IBM Plex Mono, Space Mono, DM Mono, Share Tech Mono, Overpass, Titillium Web, Hanken Grotesk, Inter, Inter Tight, Geist, Geist Mono, Martian Mono, Azeret Mono, Red Hat Mono: all HTTP 200 with `@font-face` blocks)

Reported [R]:
- https://design.hagicode.com/designs/spacex/DESIGN.md
- https://opendesigner.io/design-systems/spacex
- https://open-design.ai/plugins/design-system-spacex/
- https://learnui.design/blog/din-similar-fonts.html (D-DIN not on Google Fonts; Barlow named as closest Google Font)
- https://madegooddesigns.com/din-alternatives/ (Barlow, Archivo, Saira, Exo, Fira Sans as DIN alternatives)
- https://github.com/VoltAgent/awesome-design-md/blob/main/design-md/spacex/DESIGN.md (listed in search results, not read)
