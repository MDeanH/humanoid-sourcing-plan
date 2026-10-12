// Public entry for the 3D viewer. Import with the host page's import map:
//   <script type="importmap">{"imports":{"three":"./vendor/three/three.module.js","three/addons/":"./vendor/three/addons/"}}</script>
//   import { createViewer, webglAvailable } from './js/viewer3d/viewer.js';
// The caller loads css/tokens.css and css/viewer3d.css (plus css/viewer3d-stage.css for the stage variant).
import { probeWebGL } from './scene.js';
import { createFullViewer } from './full.js';
import { createHeroViewer } from './hero.js';
import { createStageViewer } from './stage.js';

const mounted = new WeakMap();

/** True when a WebGL2 context can be created. */
export function webglAvailable() { return probeWebGL(); }

/**
 * Options: { variant: 'full' | 'hero' | 'stage', classId, size, mode, partId, debug, offsetX (hero, stage), storagePrefix,
 *   extraDetail(part, classId) -> HTML string appended to the part details, onSelect(partId, classId), onClassChange(classId, size) }.
 * variant 'stage' (see stage.js) is the interactive landing-page robot: transparent canvas, turntable, drag to rotate, hotspots.
 *   Its size is 'full' | 'compact' | 'a3' | 'd1' | 'lineup' (default classId) and mode is 'sub' | 'origin' | 'calc'. It also takes
 *   onHover(partId | null, classId) and onClassPick(classId) (lineup). It never navigates; the host decides what a click means.
 *   Methods: setSize, setOffsetX, setXray, spinTo, spinBy, highlight, setInteractive, getState, resize, pause, resume, destroy.
 * Errors thrown by the host callbacks are caught and logged with console.error; they never break the viewer. An extraDetail
 * that returns anything but a string is ignored (with a console warning).
 *
 * Mounts a viewer into `root`. Throws an Error with code 'NO_WEBGL' when WebGL cannot be created
 * (root is left untouched so the caller can render its 2D fallback).
 */
export function createViewer(root, options = {}) {
  if (!root || root.nodeType !== 1) throw new TypeError('createViewer(root, options): root must be an element');
  const prev = mounted.get(root);
  if (prev) { try { prev.destroy(); } catch (e) { /* already gone */ } }
  const o = Object.assign({}, options);
  const viewer = o.variant === 'hero' ? createHeroViewer(root, o) : o.variant === 'stage' ? createStageViewer(root, o) : createFullViewer(root, o);
  mounted.set(root, viewer);
  return viewer;
}
