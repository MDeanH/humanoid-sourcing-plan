// Station 6: the full platform planner. The complete 3D tool: four platforms, lineup, color modes, labels,
// and the live parts planner with the strict above-65% / above-75% score.
import { $, esc, CLASSES } from '../ui.js';

export function createPlannerView(el) {
  el.innerHTML = `
  <div class="page wide">
    <header class="page-head">
      <p class="eyebrow">Planner</p>
      <h1 class="h1" data-role="title" tabindex="-1">Full platform planner</h1>
      <p class="lede">All four platforms with their published specs, and a live parts planner: mark each line US-made, foreign or unknown and watch the score against the 65% and 75% tests. Costs are relative placeholders, not quotes.</p>
    </header>
    <div class="planner-root" data-role="root"><p class="mono planner-load">Loading 3D planner</p></div>
  </div>`;

  const root = $('[data-role=root]', el);
  const S = { viewer: null, failed: false, active: false, want: { cls: 'full', part: null } };

  async function mount() {
    if (S.viewer || S.failed) return;
    try {
      const mod = await import('../viewer3d/viewer.js');
      if (!mod.webglAvailable()) throw Object.assign(new Error('WebGL unavailable'), { code: 'NO_WEBGL' });
      root.replaceChildren();
      S.viewer = mod.createViewer(root, {
        variant: 'full', classId: S.want.cls, size: S.want.cls, partId: S.want.part || null,
        // host buttons inside the details panel: clicks bubble up to the app's data-go handler
        extraDetail: (part, classId) => `<div class="xlinks"><button type="button" class="btn sm" data-go="globe?part=${esc(part.id)}&cls=${esc(classId)}">Trace suppliers on the globe</button></div>`,
      });
      if (!S.active) S.viewer.pause();
    } catch (err) {
      S.failed = true;
      if (!err || err.code !== 'NO_WEBGL') console.error(err);
      root.innerHTML = '<p class="planner-error">The 3D planner needs WebGL, which is not available here. The original build planner works the same way: <a href="https://humanoid-build-planner.netlify.app" target="_blank" rel="noopener">humanoid-build-planner.netlify.app</a>.</p>';
    }
  }
  function apply(params) {
    const cls = params.cls && CLASSES[params.cls] ? params.cls : null;
    if (cls) S.want.cls = cls;
    S.want.part = params.part || null;
    if (S.viewer) {
      if (cls) S.viewer.setSize(cls);
      if (S.want.part) S.viewer.select(S.want.part, { classId: S.want.cls });
    }
  }

  return {
    prepare(params) { apply(params); mount(); },
    enter(params) {
      S.active = true;
      apply(params || {});
      mount().then(() => { if (S.viewer) S.viewer.resume(); });
      el.scrollTop = 0;
    },
    leave() { S.active = false; if (S.viewer) S.viewer.pause(); },
    refresh() {},
    destroy() { if (S.viewer) S.viewer.destroy(); },
  };
}
