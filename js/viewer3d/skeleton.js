// Static markup for the full variant. Everything lives inside the host's root element; ids are only used for
// aria relationships and carry a per-instance prefix so several viewers can share a page.
export function skeletonHtml(uid) {
  return `
<div class="v3d-grid">
  <div class="v3d-viewer">
    <div class="v3d-tbwrap">
      <div class="v3d-toolbar" role="toolbar" aria-label="Viewer controls">
        <div class="v3d-segs">
          <div class="v3d-seg" data-role="size" role="radiogroup" aria-label="Size class">
            <button type="button" role="radio" aria-checked="false" data-size="full">A2 <small>full-size</small></button>
            <button type="button" role="radio" aria-checked="false" data-size="compact">X2 <small>compact</small></button>
            <button type="button" role="radio" aria-checked="false" data-size="a3">A3 <small>stage</small></button>
            <button type="button" role="radio" aria-checked="false" data-size="d1">D1 <small>quadruped</small></button>
            <button type="button" role="radio" aria-checked="false" data-size="both">A2 + X2</button>
            <button type="button" role="radio" aria-checked="false" data-size="lineup">Lineup <small>true scale</small></button>
          </div>
          <div class="v3d-seg" data-role="mode" role="radiogroup" aria-label="Color mode">
            <button type="button" role="radio" aria-checked="false" data-mode="sub">Subsystem</button>
            <button type="button" role="radio" aria-checked="false" data-mode="origin">Recommended origin</button>
            <button type="button" role="radio" aria-checked="false" data-mode="calc">Planner: US / foreign</button>
          </div>
        </div>
        <div class="v3d-tools">
          <button type="button" class="v3d-btn" data-v3d-act="rotate" aria-pressed="false" title="Auto-rotate">Rotate</button>
          <button type="button" class="v3d-btn" data-v3d-act="xray" aria-pressed="false" title="See-through shell">X-ray</button>
          <span class="v3d-viewbtns" role="group" aria-label="Camera views">
            <button type="button" class="v3d-btn" data-v3d-act="view" data-view="front" aria-pressed="false" title="Front view">Front</button>
            <button type="button" class="v3d-btn" data-v3d-act="view" data-view="side" aria-pressed="false" title="Side view">Side</button>
            <button type="button" class="v3d-btn" data-v3d-act="view" data-view="back" aria-pressed="false" title="Back view">Back</button>
            <button type="button" class="v3d-btn" data-v3d-act="view" data-view="reset" title="Reset view">Reset</button>
          </span>
        </div>
      </div>
      <span class="v3d-scrollcue" aria-hidden="true"></span>
    </div>

    <div class="v3d-scorebar" data-slot="scorebar"></div>

    <div class="v3d-stage" data-slot="stage">
      <div data-slot="canvas-host"></div>
      <svg class="v3d-leaders" data-slot="leaders" aria-hidden="true"></svg>
      <div class="v3d-labels" data-slot="labels" role="group" aria-label="Hardware labels"></div>
      <button type="button" class="v3d-selchip" data-v3d-act="chip" hidden></button>
      <div class="v3d-loading" data-slot="loading" role="status">Loading 3D model…</div>
    </div>

    <div class="v3d-stagefoot">
      <div class="v3d-footrow">
        <div class="v3d-active" data-slot="active" role="group" aria-label="Inspect platform" hidden></div>
        <div class="v3d-legend" data-slot="legend" role="group" aria-label="Legend"></div>
        <label class="v3d-select"><span>Labels</span>
          <select data-role="density" aria-label="Label density">
            <option value="all">All</option>
            <option value="key">Key</option>
            <option value="none">Off</option>
          </select>
        </label>
      </div>
      <div class="v3d-footnotes">
        <span class="v3d-hint">Drag to rotate \u00b7 pinch or Ctrl + scroll to zoom \u00b7 click a label or part</span>
        <span class="v3d-note">Likeness for planning only \u2014 not an official AgiBot model. No logos.</span>
      </div>
    </div>
  </div>

  <aside class="v3d-side" data-slot="side" aria-label="Part details and live parts planner">
    <div class="v3d-side-inner">
      <div class="v3d-tabs" role="tablist" aria-label="Side panel">
        <button type="button" class="v3d-tab" role="tab" id="${uid}-t-details" aria-controls="${uid}-p-details" aria-selected="true" data-tab="details">Part details</button>
        <button type="button" class="v3d-tab" role="tab" id="${uid}-t-calc" aria-controls="${uid}-p-calc" aria-selected="false" tabindex="-1" data-tab="calc">Live parts planner</button>
        <button type="button" class="v3d-tab" role="tab" id="${uid}-t-parts" aria-controls="${uid}-p-parts" aria-selected="false" tabindex="-1" data-tab="parts">All parts</button>
      </div>

      <div class="v3d-tabpanel" role="tabpanel" id="${uid}-p-details" aria-labelledby="${uid}-t-details" data-panel="details">
        <div class="v3d-details" data-slot="details" aria-live="polite" aria-atomic="false"></div>
      </div>

      <div class="v3d-tabpanel" role="tabpanel" id="${uid}-p-calc" aria-labelledby="${uid}-t-calc" data-panel="calc" hidden>
        <div class="v3d-result" data-slot="result"></div>
        <p class="v3d-small">Set where each line is made: <span class="v3d-dot-us"></span> US, <span class="v3d-dot-fx"></span> foreign, or <span class="v3d-dot-unk"></span> unknown (counts as foreign). The model recolors as you go. Planner for: <b data-slot="calcClass"></b>. Edits are saved in this browser, per platform.</p>
        <div class="v3d-presets" data-slot="presets" role="group" aria-label="Example plans"></div>
        <div data-slot="presetNote"></div>
        <div class="v3d-levers"><h4 tabindex="-1">Biggest levers <small>switch to US for the largest gain</small></h4><ol data-slot="levers"></ol></div>
        <div class="v3d-ptable">
          <div class="v3d-phead"><span>Parts table</span><span class="v3d-placeholder">Relative placeholder costs — replace with quotes</span></div>
          <div class="v3d-calcrows" data-slot="rows"></div>
          <div class="v3d-ptotal" data-slot="total"></div>
        </div>
        <div class="v3d-actions"><button type="button" class="v3d-abtn" data-v3d-act="csv">Download CSV</button><button type="button" class="v3d-abtn is-ghost" data-v3d-act="reset">Reset this platform</button></div>
        <div class="v3d-valuation"><b>How to value each line (48 CFR 25.003)</b>
          <ul><li><b>Bought:</b> purchase price + freight to your site + duty.</li>
          <li><b>Made by you:</b> manufacturing cost + allocable overhead, with no profit.</li>
          <li>Final assembly labor is excluded. Each line counts as wholly domestic or wholly foreign, and unknown origin counts as foreign. The robot must also be manufactured in the US.</li></ul></div>
      </div>

      <div class="v3d-tabpanel" role="tabpanel" id="${uid}-p-parts" aria-labelledby="${uid}-t-parts" data-panel="parts" hidden>
        <input class="v3d-search" data-slot="search" type="search" placeholder="Filter parts…" aria-label="Filter parts" autocomplete="off">
        <ul class="v3d-partlist" data-slot="partlist"></ul>
      </div>
    </div>
  </aside>
</div>`;
}
