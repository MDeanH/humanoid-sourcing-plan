// Recoloring of the robot meshes for the three color modes, x-ray, and the selection highlight.
// Mesh userData (variant, base, baseEm, baseEI, keepSub) is authored by robot.js.
import * as THREE from 'three';

const tmp = new THREE.Color();
const col = new THREE.Color();
const WHITE = new THREE.Color('#ffffff');
const BLACK = new THREE.Color('#000000');

/** Tint one mesh toward `c` (a THREE.Color) according to its variant and the active color mode. */
export function colorMesh(m, c, mode) {
  const ud = m.userData;
  const v = ud.variant;
  if (v === 'fixed') return;
  const mat = m.material;
  const base = ud.base || WHITE;
  const baseEm = ud.baseEm || BLACK;
  const baseEI = ud.baseEI ?? 1;
  const sub = mode === 'sub';
  if (v === 'shell') {
    // keep the real finish readable; only a subtle tint / emissive accent in the other modes
    tmp.copy(base).lerp(c, sub ? 0 : (mode === 'calc' ? 0.16 : 0.1));
    mat.color.copy(tmp);
    if (mat.emissive) {
      if (sub) { mat.emissive.copy(baseEm); mat.emissiveIntensity = baseEI; }
      else { mat.emissive.copy(c); mat.emissiveIntensity = mode === 'calc' ? 0.1 : 0.06; }
    }
  } else if (v === 'joint') {
    // dark housings; the colored bands carry the subsystem color
    tmp.copy(base).lerp(c, sub ? 0 : 0.32);
    mat.color.copy(tmp);
    if (mat.emissive) { mat.emissive.copy(BLACK); mat.emissiveIntensity = 0.04; }
  } else if (v === 'accent') {
    if (ud.keepSub && sub) { mat.color.copy(base); if (mat.emissive) { mat.emissive.copy(baseEm); mat.emissiveIntensity = baseEI; } }
    else { mat.color.copy(c); if (mat.emissive) { mat.emissive.copy(c); mat.emissiveIntensity = 0.65; } }
  } else if (v === 'glow') {
    if (sub) { mat.color.copy(base); if (mat.emissive) { mat.emissive.copy(baseEm); mat.emissiveIntensity = baseEI; } }
    else { tmp.copy(base).lerp(c, 0.35); mat.color.copy(tmp); if (mat.emissive) { mat.emissive.copy(c); mat.emissiveIntensity = Math.max(0.85, baseEI * 0.8); } }
  } else { // part
    tmp.copy(base).lerp(c, sub ? 0.6 : 0.85);
    mat.color.copy(tmp);
    if (mat.emissive) { mat.emissive.copy(c); mat.emissiveIntensity = 0.22; }
  }
}

/** colorOf(partId) -> css color string for this robot's platform and the current mode. */
export function applyRobotColors(robot, mode, colorOf) {
  for (const [pid, meshes] of Object.entries(robot.parts)) {
    col.set(colorOf(pid));
    for (const m of meshes) colorMesh(m, col, mode);
  }
}

export function recolorMesh(m, mode, css) {
  const ud = m.userData;
  const mat = m.material;
  if (mat.emissive) { mat.emissive.copy(ud.baseEm || BLACK); mat.emissiveIntensity = ud.baseEI ?? 0.1; }
  col.set(css);
  colorMesh(m, col, mode);
}

export function applyXray(robot, on) {
  for (const m of robot.shells) {
    const mat = m.material;
    if (mat.transparent === on && mat.depthWrite === !on) continue;
    mat.transparent = on;
    mat.opacity = on ? 0.2 : 1;
    mat.depthWrite = !on;
    mat.needsUpdate = true;
  }
}

/** Selection highlight: white emissive. Intensity is driven per frame by the caller. */
export function highlightMesh(m, intensity) {
  const mat = m.material;
  if (!mat.emissive) return;
  mat.emissive.setRGB(1, 1, 1);
  mat.emissiveIntensity = intensity;
}
