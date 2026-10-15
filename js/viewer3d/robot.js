// Robot likeness builder. Full-size follows the AgiBot A2 / A2 Ultra look; compact follows the X2 / X2 Ultra look.
// Planning likeness only: no logos or wordmarks, not an official model. Robot faces +Z, robot left = +X.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { CLASSES } from '../data/classes.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const UP = V(0, 1, 0);
const phys = (o) => new THREE.MeshPhysicalMaterial(o);

export const MAT = {
  // A2: satin metallic silver shells with a clear coat
  silver: phys({ color: 0xb4c0d0, metalness: 0.88, roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.05, reflectivity: 0.95 }),
  // X2: soft glossy white shells
  white: phys({ color: 0xf4f5f7, metalness: 0.05, roughness: 0.32, clearcoat: 0.9, clearcoatRoughness: 0.18, sheen: 0.5, sheenColor: 0xffffff }),
  gloss: phys({ color: 0x0c0e12, metalness: 0.35, roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.03 }),
  joint: phys({ color: 0x24272d, metalness: 0.4, roughness: 0.55, clearcoat: 0.15 }),
  graphite: phys({ color: 0x3b3f47, metalness: 0.45, roughness: 0.48, clearcoat: 0.35 }),
  rubber: phys({ color: 0x2b2e34, metalness: 0, roughness: 0.82 }),
  yellow: phys({ color: 0xf2b300, metalness: 0.05, roughness: 0.32, clearcoat: 0.85, clearcoatRoughness: 0.15 }),
  lens: phys({ color: 0x04060a, metalness: 0.9, roughness: 0.05, clearcoat: 1 }),
  lensBlue: phys({ color: 0x0b1835, metalness: 0.7, roughness: 0.06, clearcoat: 1, emissive: 0x1e4fd8, emissiveIntensity: 0.35 }),
  screen: phys({ color: 0x04060a, metalness: 0.4, roughness: 0.05, clearcoat: 1, clearcoatRoughness: 0.02, emissive: 0x0a2030, emissiveIntensity: 0.55 }),
  eye: new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 2.4, toneMapped: false }),
  strip: new THREE.MeshStandardMaterial({ color: 0xd8efff, emissive: 0x9fd6ff, emissiveIntensity: 2.2 }),
  stripBlue: new THREE.MeshStandardMaterial({ color: 0x6fb8ff, emissive: 0x2f8fff, emissiveIntensity: 1.3 }),
  band: new THREE.MeshStandardMaterial({ color: 0x8a8f99, emissive: 0x000000, roughness: 0.4, metalness: 0.2, side: THREE.DoubleSide }),
  board: new THREE.MeshStandardMaterial({ color: 0x5b6474, roughness: 0.5, metalness: 0.3 }),
  ring: phys({ color: 0xf2f3f5, metalness: 0, roughness: 0.35, clearcoat: 0.8, emissive: 0x000000 }),
  // A2 (turntable reference): satin metallic silver, satin black, cyan eye slit
  satin: phys({ color: 0xc7ccd4, metalness: 0.78, roughness: 0.3, clearcoat: 0.6, clearcoatRoughness: 0.2, reflectivity: 0.8 }),
  satinBlack: phys({ color: 0x16181c, metalness: 0.3, roughness: 0.42, clearcoat: 0.35, clearcoatRoughness: 0.3 }),
  cyan: new THREE.MeshStandardMaterial({ color: 0x9feeff, emissive: 0x22c8ff, emissiveIntensity: 1.3 }),
};

// ---- geometry helpers
function spline(pts, n = 56) {
  const c = new THREE.SplineCurve(pts.map(([r, y]) => new THREE.Vector2(r, y)));
  return c.getPoints(n).map(p => new THREE.Vector2(Math.max(0.0006, p.x), p.y));
}
function rAt(sp, y) {
  if (y <= sp[0].y) return sp[0].x;
  for (let i = 1; i < sp.length; i++) if (sp[i].y >= y) { const a = sp[i - 1], b = sp[i]; const t = (y - a.y) / ((b.y - a.y) || 1); return a.x + (b.x - a.x) * t; }
  return sp[sp.length - 1].x;
}
function roundedRectShape(x0, y0, x1, y1, r) {
  const s = new THREE.Shape();
  s.moveTo(x0 + r, y0); s.lineTo(x1 - r, y0); s.quadraticCurveTo(x1, y0, x1, y0 + r);
  s.lineTo(x1, y1 - r); s.quadraticCurveTo(x1, y1, x1 - r, y1); s.lineTo(x0 + r, y1);
  s.quadraticCurveTo(x0, y1, x0, y1 - r); s.lineTo(x0, y0 + r); s.quadraticCurveTo(x0, y0, x0 + r, y0);
  return s;
}
// Foot plan in the XZ plane after rotateX(-PI/2) of an ExtrudeGeometry (shape is X,Y→world X,-Z).
// zHeel is the heel extent behind the ankle (positive), zToe is the toe extent in front (positive).
function footShape(w, zHeel, zToe, rr) {
  const s = new THREE.Shape();
  const hw = w / 2, hh = hw * 0.82;
  // shape Y maps to -world Z, so heel (behind, -Z) is +Y and toe (front, +Z) is -Y
  s.moveTo(-hh, zHeel);
  s.quadraticCurveTo(-hh * 0.4, zHeel + rr * 0.15, 0, zHeel + rr * 0.1);
  s.quadraticCurveTo(hh * 0.4, zHeel + rr * 0.15, hh, zHeel);
  s.lineTo(hw, -zToe + rr);
  s.quadraticCurveTo(hw, -zToe, 0, -zToe);
  s.quadraticCurveTo(-hw, -zToe, -hw, -zToe + rr);
  s.lineTo(-hh, zHeel);
  return s;
}

export function buildRobot(cls) {
  const C = CLASSES[cls];
  const compact = cls === 'compact';
  const group = new THREE.Group();
  group.userData.cls = cls;
  const robot = { cls, group, parts: {}, anchors: {}, shells: [] };

  // meshes are authored in robot coordinates; `cur` lets a limb be built inside a pivoted sub-group
  let cur = group, curM = null;
  function pivot(p, rotZ) {
    const outer = new THREE.Group(); outer.position.copy(p); outer.rotation.z = rotZ;
    const inner = new THREE.Group(); inner.position.copy(p).multiplyScalar(-1);
    outer.add(inner); group.add(outer); outer.updateMatrix(); inner.updateMatrix();
    cur = inner; curM = outer.matrix.clone().multiply(inner.matrix);
  }
  function unpivot() { cur = group; curM = null; }
  function add(mesh, mat, ud) {
    mesh.material = mat.clone();
    mesh.castShadow = true;
    const m = mesh.material;
    mesh.userData = Object.assign({ cls, base: m.color.clone(), baseEm: m.emissive ? m.emissive.clone() : new THREE.Color(0), baseEI: m.emissiveIntensity ?? 1 }, ud);
    cur.add(mesh);
    return mesh;
  }
  // variants: shell (real finish, subtle tint), joint (dark housing, moderate tint), accent (colored band/strip),
  // part (small component, strong tint), glow (screen/light, keeps its glow), fixed (lens, no tint)
  function reg(mesh, partId, variant, mat, extra = {}) {
    add(mesh, mat, Object.assign({ partId, variant }, extra));
    (robot.parts[partId] ||= []).push(mesh);
    // shell: finished casing that goes see-through in X-ray. casing: the body shell proper, which is click-through in X-ray so the
    // parts inside can be picked. The battery pack has a shell finish too, but it is a part in its own right and stays pickable.
    if (variant === 'shell') { mesh.userData.shell = true; mesh.userData.casing = partId === 'frame'; robot.shells.push(mesh); }
    return mesh;
  }
  function deco(mesh, mat, shell = false) { add(mesh, mat, { variant: 'fixed', shell }); if (shell) robot.shells.push(mesh); return mesh; }
  function anchor(id, pos, normal) {
    if (curM) { pos = pos.clone().applyMatrix4(curM); if (normal) normal = normal.clone().transformDirection(curM); }
    robot.anchors[id] = { pos, normal: normal ? normal.clone().normalize() : null };
  }

  function lathe(profile, seg = 56, phiStart = 0, phiLen = Math.PI * 2, n = 56) {
    return new THREE.LatheGeometry(spline(profile, n), seg, phiStart, phiLen);
  }
  // smooth shell between a (bottom) and b (top); prof = [[t, r], ...]
  function limb(a, b, prof, sx = 1, sz = 1, zoff = 0) {
    const len = a.distanceTo(b);
    const g = lathe(prof.map(([t, r]) => [r, t * len]), 48);
    g.scale(sx, 1, sz); g.translate(0, 0, zoff);
    const m = new THREE.Mesh(g);
    m.position.copy(a);
    m.quaternion.setFromUnitVectors(UP, b.clone().sub(a).normalize());
    return m;
  }
  function rbox(w, h, d, r, pos, seg = 4) {
    const m = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, seg, Math.min(r, w / 2 - 1e-4, h / 2 - 1e-4, d / 2 - 1e-4)));
    m.position.copy(pos); return m;
  }
  function tube(pts, r, closed = false) { return new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, closed), 64, r, 8, closed)); }
  function jointGeo(r, h) {
    const e = Math.min(r * 0.2, h * 0.25);
    return new THREE.LatheGeometry([[0.0005, -h / 2], [r - e, -h / 2], [r - e * 0.3, -h / 2 + e * 0.3], [r, -h / 2 + e], [r, h / 2 - e], [r - e * 0.3, h / 2 - e * 0.3], [r - e, h / 2], [0.0005, h / 2]].map(([x, y]) => new THREE.Vector2(x, y)), 40);
  }
  // integrated joint module: housing + colored band + reducer ring (outer end) + encoder cap (inner end) + torque ring
  function joint(partId, pos, axis, r, h, o = {}) {
    const ax = axis.clone().normalize();
    const q = new THREE.Quaternion().setFromUnitVectors(UP, ax);
    const m = new THREE.Mesh(jointGeo(r, h)); m.position.copy(pos); m.quaternion.copy(q);
    reg(m, partId, 'joint', o.mat || MAT.joint);
    if (o.band !== false) {
      const b = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.015, r * 1.015, Math.max(0.004, h * 0.13), 40, 1, true));
      b.position.copy(pos).addScaledVector(ax, h * (o.bandAt ?? 0.2)); b.quaternion.copy(q); reg(b, partId, 'joint', MAT.graphite);
    }
    if (o.detail !== false) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(r * 0.7, r * 0.085, 8, 36));
      ring.position.copy(pos).addScaledVector(ax, h / 2 + 0.0005); ring.quaternion.setFromUnitVectors(V(0, 0, 1), ax); reg(ring, 'harmonic', 'joint', MAT.graphite);
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.42, r * 0.42, 0.005, 24));
      cap.position.copy(pos).addScaledVector(ax, -(h / 2 + 0.0015)); cap.quaternion.copy(q); reg(cap, 'encoder', 'joint', MAT.graphite);
      if (r >= 0.038) {
        const tq = new THREE.Mesh(new THREE.TorusGeometry(r * 0.93, r * 0.05, 6, 40));
        tq.position.copy(pos).addScaledVector(ax, h / 2 - 0.003); tq.quaternion.setFromUnitVectors(V(0, 0, 1), ax); reg(tq, 'torque', 'joint', MAT.graphite);
      }
    }
    return m;
  }
  // sensor lens with colored bezel
  function lens(partId, pos, normal, r, mat = MAT.lensBlue) {
    const n = normal.clone().normalize();
    const q = new THREE.Quaternion().setFromUnitVectors(UP, n);
    const l = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.005, 24)); l.position.copy(pos); l.quaternion.copy(q); reg(l, partId, 'fixed', mat);
    const bz = new THREE.Mesh(new THREE.TorusGeometry(r * 1.12, r * 0.22, 8, 28)); bz.position.copy(pos).addScaledVector(n, 0.0015);
    bz.quaternion.setFromUnitVectors(V(0, 0, 1), n); reg(bz, partId, 'accent', MAT.band);
    return l;
  }
  function claw(s, pos, scale, mat, partId) {
    // Three-finger claw: two outer hooked prongs + a shorter inner thumb-like prong.
    const mk = (yaw, pitch, len, thick) => {
      const sh = new THREE.Shape();
      const t = thick;
      sh.moveTo(-t, 0); sh.lineTo(t, 0); sh.quadraticCurveTo(t * 1.4, -len * 0.45, t * 0.9, -len * 0.75);
      sh.quadraticCurveTo(t * 0.55, -len, 0, -len); sh.quadraticCurveTo(-t * 0.55, -len, -t * 0.9, -len * 0.75);
      sh.quadraticCurveTo(-t * 1.4, -len * 0.45, -t, 0);
      const g = new THREE.ExtrudeGeometry(sh, { depth: t * 1.6, bevelEnabled: true, bevelThickness: t * 0.35, bevelSize: t * 0.3, bevelSegments: 2, curveSegments: 12 });
      g.translate(0, 0, -t * 0.8);
      const m = new THREE.Mesh(g);
      m.position.copy(pos);
      m.rotation.order = 'YXZ';
      m.rotation.y = yaw; m.rotation.x = pitch;
      reg(m, partId, 'joint', mat);
      return m;
    };
    const sc = scale;
    mk(s * 0.55, 0.15, 0.095 * sc, 0.007 * sc);
    mk(-s * 0.15, 0.05, 0.09 * sc, 0.0065 * sc);
    mk(s * 0.95, 0.55, 0.07 * sc, 0.006 * sc); // thumb
  }

  if (cls === 'full') buildA2(); else if (cls === 'compact') buildX2(); else if (cls === 'a3') buildA3(); else buildD1();

  // =========================================================== A2 / A2 Ultra likeness
  function buildA2() {
    // Proportions measured from the 360° turntable reference (169 cm). Satin metallic silver shells,
    // high-gloss black head, satin-black backpack/abdomen, matte black exposed hinges. No logos or text.
    const SIL = MAT.satin, BLK = MAT.satinBlack;
    // open shell (front + sides) along a->b; prof = [[t, r], ...]; cut lowers the inner side of the top edge
    function shell(a, b, prof, o = {}) {
      const len = a.distanceTo(b);
      let g = new THREE.LatheGeometry(spline(prof.map(([t, r]) => [r, t * len]), 48), o.seg ?? 40, o.phi0 ?? -2.25, o.plen ?? 4.5);
      g.scale(o.sx ?? 1, 1, o.sz ?? 1); g.translate(0, 0, o.zoff ?? 0);
      if (o.cut) {
        const p = g.attributes.position, rmax = Math.max(...prof.map(q => q[1]));
        for (let i = 0; i < p.count; i++) {
          const t = p.getY(i) / len; if (t < 0.55) continue;
          const side = Math.max(0, Math.min(1, 0.5 - 0.5 * o.side * p.getX(i) / rmax));
          const k = (t - 0.55) / 0.45; p.setY(i, p.getY(i) - o.cut * side * k * k);
        }
      }
      if (o.flat) { g = g.toNonIndexed(); }
      g.computeVertexNormals();
      const m = new THREE.Mesh(g);
      m.position.copy(a); m.quaternion.setFromUnitVectors(UP, b.clone().sub(a).normalize());
      return m;
    }
    function ds(m) { m.material.side = THREE.DoubleSide; return m; }

    // ---- head: smooth high-gloss black egg, deeper than wide, single cyan eye slit
    const hy0 = 1.475, hz = 1.27, hzOff = 0.02;
    const headProf = [[0.004, 0], [0.03, 0.004], [0.048, 0.02], [0.063, 0.05], [0.076, 0.095], [0.083, 0.135], [0.08, 0.17], [0.066, 0.195], [0.04, 0.208], [0.004, 0.212]];
    const hsp = spline(headProf);
    const head = new THREE.Mesh(lathe(headProf, 72)); head.geometry.scale(1, 1, hz); head.position.set(0, hy0, hzOff);
    reg(head, 'frame', 'shell', MAT.gloss);
    const ey = 0.116, er = rAt(hsp, ey);
    {
      const pts = []; for (let i = 0; i <= 24; i++) { const ph = -0.52 + i * 1.04 / 24; pts.push(V(er * 1.004 * Math.sin(ph), hy0 + ey, hzOff + er * 1.004 * Math.cos(ph) * hz)); }
      reg(tube(pts, 0.0021), 'face', 'glow', MAT.cyan);
    }
    for (const s of [1, -1]) lens('fisheye', V(s * (rAt(hsp, 0.12) + 0.0008), hy0 + 0.12, hzOff), V(s, 0, 0.1), 0.0065, MAT.lens);
    const fy = 0.152, fz = rAt(hsp, fy) * hz + hzOff;
    lens('rgb', V(0, hy0 + fy, fz + 0.0008), V(0, 0.3, 1), 0.0055, MAT.lens);
    for (const [x, z] of [[-0.02, 0.022], [0.02, 0.022], [-0.02, -0.024], [0.02, -0.024]]) {
      const m = new THREE.Mesh(new THREE.SphereGeometry(0.0035, 10, 8)); m.position.set(x, hy0 + 0.2075, z + hzOff); reg(m, 'mic', 'part', MAT.graphite);
    }
    anchor('face', V(0, hy0 + ey, er * hz + hzOff + 0.003), V(0, 0, 1));
    anchor('rgb', V(0, hy0 + fy, fz + 0.004), V(0, 0.4, 1));
    anchor('mic', V(0.02, hy0 + 0.21, 0.022 + hzOff), V(0.1, 1, 0.2));
    anchor('fisheye', V(rAt(hsp, 0.12) + 0.004, hy0 + 0.12, hzOff), V(1, 0, 0.2));

    // ---- neck: slim black, horizontal ribs
    deco(new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.025, 0.075, 24)).translateY(1.445), MAT.joint);
    for (const y of [1.432, 1.444, 1.456, 1.468]) { const t = new THREE.Mesh(new THREE.TorusGeometry(0.0235, 0.0026, 6, 28)); t.rotation.x = Math.PI / 2; t.position.y = y; deco(t, MAT.graphite); }
    joint('neck', V(0, 1.428, 0), V(0, 1, 0), 0.03, 0.02, { detail: false });
    joint('neck', V(0, 1.476, 0.004), V(1, 0, 0), 0.016, 0.05, { detail: false, bandAt: 0.0 });
    anchor('neck', V(0.026, 1.456, 0.0), V(1, 0, 0.6));
    reg(rbox(0.038, 0.02, 0.016, 0.006, V(0, 1.45, 0.026)), 'rgbd', 'part', MAT.graphite);
    for (const x of [-0.009, 0.009]) lens('rgbd', V(x, 1.45, 0.0345), V(0, -0.1, 1), 0.0045);
    anchor('rgbd', V(0, 1.447, 0.036), V(0, -0.2, 1));

    // ---- chest: broad satin-silver shell; front ends in a shallow V at the midriff, back runs lower around the pack
    const cy0 = 1.0, cz = 0.7;
    const chestProf = [[0.004, 0], [0.112, 0], [0.122, 0.02], [0.133, 0.1], [0.143, 0.22], [0.149, 0.32], [0.147, 0.37], [0.13, 0.397], [0.085, 0.41], [0.004, 0.415]];
    const csp = spline(chestProf);
    {
      const g = lathe(chestProf, 72); g.scale(1, 1, cz);
      const p = g.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const y = p.getY(i); if (y > 0.2) continue;
        const x = p.getX(i), z = p.getZ(i), r = Math.hypot(x, z / cz) || 1;
        const f = Math.max(0, Math.min(1, 0.5 + 0.9 * z / (r * cz)));
        const front = 0.1 + 0.07 * Math.pow(Math.min(1, Math.abs(x) / 0.145), 1.6);
        p.setY(i, y + front * f * f * (3 - 2 * f) * (1 - y / 0.2));
      }
      g.computeVertexNormals();
      const chest = new THREE.Mesh(g); chest.position.y = cy0; reg(chest, 'frame', 'shell', SIL);
    }
    // blue light strip arching across the lower chest
    const arc = [];
    for (let i = 0; i <= 48; i++) {
      const u = -1 + i / 24, ph = u * 0.9, y = 1.203 + 0.045 * Math.sqrt(Math.max(0, 1 - Math.abs(u) ** 2.2));
      const r = rAt(csp, y - cy0) * 1.006; arc.push(V(r * Math.sin(ph), y, r * Math.cos(ph) * cz));
    }
    reg(tube(arc, 0.0026), 'frame', 'accent', MAT.stripBlue, { keepSub: true });
    // short blue strips where the chest meets the shoulder joints
    for (const s of [1, -1]) {
      const pts = []; for (let i = 0; i <= 6; i++) { const y = 1.3 + i * 0.011, r = rAt(csp, y - cy0) * 1.008, ph = s * 1.12; pts.push(V(r * Math.sin(ph), y, r * Math.cos(ph) * cz)); }
      reg(tube(pts, 0.0026), 'frame', 'accent', MAT.stripBlue, { keepSub: true });
    }
    // black collar yoke with the lidar window and two small sensor ports
    { const yp = csp.filter(p => p.y > 0.383).map(p => new THREE.Vector2(p.x * 1.012, p.y + 0.002)); const yk = new THREE.Mesh(new THREE.LatheGeometry(yp, 72)); yk.geometry.scale(1, 1, cz); yk.position.y = cy0; deco(yk, MAT.joint); }
    reg(rbox(0.06, 0.014, 0.01, 0.004, V(0, 1.396, 0.066)), 'lidar', 'part', MAT.graphite);
    deco(rbox(0.05, 0.007, 0.004, 0.002, V(0, 1.396, 0.0715)), MAT.lens);
    for (const x of [-0.055, 0.055]) { const d = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.004, 16)); d.rotation.x = Math.PI / 2 - 0.5; d.position.set(x, 1.392, 0.072); deco(d, MAT.lens); }
    anchor('lidar', V(0.025, 1.398, 0.073), V(0, 0.4, 1));
    // slender black mechanical waist
    const abProf = [[0.004, 0], [0.05, 0], [0.072, 0.03], [0.088, 0.09], [0.1, 0.17], [0.106, 0.24], [0.104, 0.28], [0.004, 0.285]];
    const absp = spline(abProf);
    const ab = new THREE.Mesh(lathe(abProf, 56)); ab.geometry.scale(1, 1, 0.74); ab.position.y = 0.875;
    { // front of the waist ends in a pointed shield over the pelvis
      const p = ab.geometry.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const y = p.getY(i); if (y > 0.1) continue;
        const x = p.getX(i), z = p.getZ(i), f = Math.max(0, Math.min(1, z / 0.06));
        p.setY(i, y - 0.03 * f * (1 - y / 0.1) + 0.05 * Math.min(1, Math.abs(x) / 0.1) ** 1.5 * f * (1 - y / 0.1));
      }
      ab.geometry.computeVertexNormals();
    }
    reg(ab, 'frame', 'shell', BLK);
    for (const y of [1.02, 1.055]) { const r = rAt(absp, y - 0.875) + 0.001; const t = new THREE.Mesh(new THREE.TorusGeometry(r, 0.0016, 6, 56)); t.rotation.x = Math.PI / 2; t.scale.set(1, 0.74, 1); t.position.y = y; deco(t, MAT.joint); }
    // pelvis: black central section
    reg(rbox(0.2, 0.1, 0.15, 0.035, V(0, 0.9, -0.008)), 'frame', 'shell', MAT.joint);
    // battery backpack: bulky satin-black rounded rectangle with seams near the top
    reg(rbox(0.21, 0.33, 0.09, 0.026, V(0, 1.21, -0.136), 6), 'battery', 'shell', BLK);
    deco(rbox(0.17, 0.003, 0.004, 0.0015, V(0, 1.315, -0.1815)), MAT.joint);
    deco(rbox(0.085, 0.018, 0.006, 0.006, V(0, 1.343, -0.18)), MAT.joint);
    anchor('battery', V(0, 1.22, -0.184), V(0, 0, -1));
    reg(rbox(0.036, 0.016, 0.018, 0.006, V(0.06, 1.382, -0.13)), 'estop', 'part', MAT.graphite);
    reg(new THREE.Mesh(new THREE.CylinderGeometry(0.0026, 0.0026, 0.02, 8)).translateX(0.07).translateY(1.398).translateZ(-0.13), 'estop', 'part', MAT.joint);
    anchor('estop', V(0.07, 1.41, -0.13), V(0.3, 0.6, -1));
    // internals
    reg(rbox(0.1, 0.012, 0.08, 0.003, V(0.0, 1.33, 0)), 'jetson', 'part', MAT.board);
    reg(rbox(0.12, 0.012, 0.08, 0.003, V(0, 1.25, 0)), 'cpu', 'part', MAT.board);
    reg(rbox(0.09, 0.04, 0.04, 0.006, V(0, 1.03, -0.02)), 'bms', 'part', MAT.board);
    reg(rbox(0.03, 0.014, 0.03, 0.003, V(0, 0.925, 0)), 'imu', 'part', MAT.board);
    anchor('jetson', V(0.03, 1.33, 0.03), null); anchor('cpu', V(-0.04, 1.25, 0.03), null);
    anchor('bms', V(0, 1.03, -0.01), null); anchor('imu', V(0, 0.925, 0.016), null);

    // ---- arms: relaxed A-pose, silver shells, exposed black hinges, black five-finger hands
    for (const s of [1, -1]) {
      const L = s > 0 ? 'L' : 'R', X = (x) => s * x;
      pivot(V(X(0.19), 1.375, 0), s * 0.11);
      joint('shoulder' + L, V(X(0.163), 1.372, 0), V(s, 0, 0), 0.046, 0.05);
      joint('shoulder' + L, V(X(0.2), 1.355, 0), V(0, 0, 1), 0.036, 0.08, { detail: false });
      joint('shoulder' + L, V(X(0.2), 1.2, 0), V(0, 1, 0), 0.034, 0.04, { detail: false });
      { const cap = new THREE.Mesh(new THREE.SphereGeometry(0.054, 32, 20)); cap.scale.set(1, 0.95, 1.06); cap.position.set(X(0.2), 1.362, 0); reg(cap, 'frame', 'shell', SIL); }
      reg(limb(V(X(0.2), 1.125, 0), V(X(0.2), 1.37, 0), [[0, 0.004], [0.03, 0.04], [0.2, 0.045], [0.6, 0.049], [0.9, 0.052], [1, 0.03]], 1, 1.06), 'frame', 'shell', SIL);
      deco(rbox(0.008, 0.055, 0.05, 0.003, V(X(0.2 + 0.05), 1.3, 0.0)), MAT.joint);
      reg(rbox(0.07, 0.07, 0.08, 0.018, V(X(0.2), 1.09, -0.004)), 'elbow' + L, 'joint', MAT.joint);
      joint('elbow' + L, V(X(0.2), 1.09, 0.0), V(s, 0, 0), 0.036, 0.088);
      reg(limb(V(X(0.2), 0.868, 0), V(X(0.2), 1.06, 0), [[0, 0.004], [0.04, 0.034], [0.4, 0.039], [0.85, 0.043], [1, 0.004]], 1, 1.05), 'frame', 'shell', SIL);
      for (const dx of [0.04, -0.04]) deco(rbox(0.012, 0.115, 0.048, 0.005, V(X(0.2 + dx), 0.935, 0.0)), MAT.joint);
      reg(rbox(0.05, 0.04, 0.056, 0.012, V(X(0.2), 0.85, 0)), 'wrist' + L, 'joint', MAT.joint);
      joint('wrist' + L, V(X(0.2), 0.876, 0), V(0, 1, 0), 0.028, 0.026, { detail: false });
      joint('wrist' + L, V(X(0.2), 0.846, 0), V(s, 0, 0), 0.022, 0.05, { detail: false });
      joint('wrist' + L, V(X(0.2), 0.826, 0), V(0, 0, 1), 0.019, 0.044, { detail: false });
      const hid = 'hand' + L;
      reg(rbox(0.028, 0.068, 0.068, 0.012, V(X(0.2), 0.785, 0.004)), hid, 'joint', MAT.joint);
      for (const [z, len] of [[-0.022, 0.044], [-0.0075, 0.052], [0.0075, 0.054], [0.022, 0.048]]) {
        const f = new THREE.Mesh(new THREE.CapsuleGeometry(0.0064, len, 4, 12));
        f.position.set(X(0.2 - 0.004), 0.748 - len / 2, z + 0.004); f.rotation.z = s * 0.08; reg(f, hid, 'joint', MAT.joint);
      }
      const th = new THREE.Mesh(new THREE.CapsuleGeometry(0.0068, 0.036, 4, 12));
      th.position.set(X(0.19), 0.765, 0.043); th.rotation.x = 0.55; th.rotation.z = s * -0.3; reg(th, hid, 'joint', MAT.joint);
      anchor('shoulder' + L, V(X(0.163), 1.372, 0.047), V(s, 0.2, 0.8));
      anchor('elbow' + L, V(X(0.2), 1.09, 0.041), V(s * 0.4, 0, 1));
      anchor('wrist' + L, V(X(0.2), 0.85, 0.03), V(s * 0.4, 0, 1));
      anchor(hid, V(X(0.214), 0.74, 0.0), V(s, 0, 0.5));
      reg(tube([V(X(0.19), 1.32, -0.03), V(X(0.2), 1.2, -0.03), V(X(0.2), 1.06, -0.03), V(X(0.2), 0.95, -0.026), V(X(0.2), 0.87, -0.02)], 0.0035), 'harness', 'joint', MAT.joint);
      unpivot();
      reg(tube([V(X(0.11), 1.39, -0.095), V(X(0.15), 1.375, -0.07), V(X(0.175), 1.36, -0.055)], 0.0035), 'harness', 'joint', MAT.joint);
    }

    // ---- legs: silver front/side shells (open at the back), exposed black hinges, flat black feet
    for (const s of [1, -1]) {
      const L = s > 0 ? 'L' : 'R', X = (x) => s * x;
      joint('hip' + L, V(X(0.092), 0.925, 0.005), V(0, 1, 0), 0.05, 0.06, { detail: false });
      joint('hip' + L, V(X(0.105), 0.895, -0.025), V(0, 0, 1), 0.05, 0.11);   // large rear (glute) housings
      joint('hip' + L, V(X(0.12), 0.83, 0), V(s, 0, 0), 0.054, 0.06);
      // black thigh frame visible from behind
      deco(new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.034, 0.32, 16)).translateX(X(0.12)).translateY(0.65).translateZ(-0.01), MAT.joint);
      ds(reg(shell(V(X(0.118), 0.472, 0), V(X(0.127), 0.885, 0), [[0, 0.028], [0.04, 0.04], [0.25, 0.049], [0.55, 0.061], [0.8, 0.073], [0.92, 0.078], [0.97, 0.066], [1, 0.035]], { sz: 0.95, cut: 0.07, side: s }), 'frame', 'shell', SIL));
      // knee drive housing on the outer thigh
      { const d = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.012, 32)); d.rotation.z = Math.PI / 2; d.position.set(X(0.122 + 0.066), 0.74, -0.008); reg(d, 'knee' + L, 'joint', MAT.joint); }
      reg(rbox(0.074, 0.07, 0.088, 0.02, V(X(0.117), 0.45, -0.006)), 'knee' + L, 'joint', MAT.joint);
      joint('knee' + L, V(X(0.117), 0.45, 0), V(s, 0, 0), 0.044, 0.092);
      ds(reg(shell(V(X(0.116), 0.112, 0), V(X(0.117), 0.425, 0), [[0, 0.024], [0.05, 0.034], [0.35, 0.041], [0.65, 0.047], [0.86, 0.046], [0.96, 0.04], [1, 0.03]], { sz: 0.9, zoff: 0.008, seg: 8, phi0: -2.0, plen: 4.0, flat: true }), 'frame', 'shell', SIL));
      // ankle linkage rods and drive motors behind the calf (no plating at the back)
      for (const dx of [-0.02, 0.02]) {
        reg(tube([V(X(0.117) + dx, 0.11, -0.036), V(X(0.117) + dx, 0.24, -0.042), V(X(0.117) + dx, 0.36, -0.042)], 0.005), 'ankle' + L, 'joint', MAT.joint);
        joint('ankle' + L, V(X(0.117) + dx, 0.375, -0.042), V(s, 0, 0), 0.019, 0.02, { detail: false, band: false });
      }
      joint('ankle' + L, V(X(0.116), 0.085, 0), V(s, 0, 0), 0.028, 0.07);
      joint('ankle' + L, V(X(0.116), 0.106, -0.004), V(0, 0, 1), 0.02, 0.05, { detail: false });
      deco(new THREE.Mesh(new THREE.CylinderGeometry(0.019, 0.023, 0.07, 18)).translateX(X(0.116)).translateY(0.14), MAT.joint);
      // foot: flat black block with a segmented toe
      reg(rbox(0.07, 0.034, 0.08, 0.014, V(X(0.116), 0.055, -0.004)), 'frame', 'shell', BLK);
      reg(rbox(0.096, 0.038, 0.172, 0.011, V(X(0.116), 0.019, 0.026)), 'frame', 'shell', BLK);
      reg(rbox(0.094, 0.032, 0.056, 0.01, V(X(0.116), 0.016, 0.1425)), 'frame', 'shell', BLK);
      for (const z of [-0.03, 0.09]) reg(rbox(0.06, 0.003, 0.04, 0.001, V(X(0.116), 0.0025, z)), 'footforce', 'part', MAT.board);
      anchor('hip' + L, V(X(0.12), 0.83, 0.055), V(s * 0.2, 0, 1));
      anchor('knee' + L, V(X(0.117), 0.45, 0.046), V(0.2 * s, 0, 1));
      anchor('ankle' + L, V(X(0.116), 0.085, 0.03), V(s * 0.4, 0, 1));
      reg(tube([V(X(0.1), 0.94, -0.085), V(X(0.12), 0.84, -0.06), V(X(0.125), 0.7, -0.045), V(X(0.12), 0.55, -0.042), V(X(0.117), 0.45, -0.05), V(X(0.117), 0.3, -0.05), V(X(0.116), 0.16, -0.04)], 0.0038), 'harness', 'joint', MAT.joint);
    }
    reg(tube([V(0, 1.37, -0.095), V(0, 1.42, -0.04), V(0, 1.46, -0.03)], 0.005), 'harness', 'joint', MAT.joint);
    anchor('harmonic', V(0.164, 0.45, 0), V(1, 0, 0.15));
    anchor('torque', V(-0.164, 0.45, 0), V(-1, 0, 0.15));
    anchor('encoder', V(-0.071, 0.45, 0.01), V(1, 0, 0.4));
    anchor('harness', V(0.125, 0.7, -0.047), V(0.3, 0, -1));
    anchor('frame', V(-0.124, 0.66, 0.058), V(0, 0, 1));
    anchor('footforce', V(0.116, 0.004, 0.17), V(0, -0.1, 1));
  }

  // =========================================================== X2 / X2 Ultra likeness
  function buildX2() {
    // ---- head: rounded black helmet with a face screen and two glowing eyes
    const hc = V(0, 1.609, 0), hw = 0.205, hh = 0.19, hd = 0.215, hr = 0.052;
    reg(rbox(hw, hh, hd, hr, hc, 8), 'frame', 'shell', MAT.gloss);
    const fzr = hc.z + hd / 2;
    reg(rbox(0.152, 0.108, 0.02, 0.012, V(0, hc.y - 0.015, fzr - 0.0055), 4), 'face', 'glow', MAT.screen);
    for (const x of [-0.034, 0.034]) {
      // vertical glowing pill eyes (X2 look)
      const e = new THREE.Mesh(new THREE.CapsuleGeometry(0.011, 0.022, 6, 16));
      e.position.set(x, hc.y - 0.012, fzr + 0.0055); reg(e, 'face', 'glow', MAT.eye);
    }
    // forehead camera row (interactive RGB + dual RGB)
    const ty = hc.y + hh / 2 - hr, tz = hc.z + hd / 2 - hr;
    for (const x of [-0.036, 0, 0.036]) {
      const a = 0.42, n = V(0, Math.sin(a), Math.cos(a));
      lens('rgb', V(x, ty + Math.sin(a) * hr, tz + Math.cos(a) * hr + 0.0015), n, x === 0 ? 0.0085 : 0.0068);
    }
    lens('rgb', V(0, hc.y + 0.023, hc.z - hd / 2 - 0.0015), V(0, 0, -1), 0.0075); // rear RGB
    for (const s of [1, -1]) {
      const sp = new THREE.Mesh(new THREE.CylinderGeometry(0.046, 0.046, 0.005, 40)); sp.rotation.z = Math.PI / 2; sp.position.set(s * (hw / 2 + 0.0015), hc.y - 0.005, -0.005); deco(sp, MAT.graphite);
      const sr = new THREE.Mesh(new THREE.TorusGeometry(0.046, 0.0025, 6, 40)); sr.rotation.y = Math.PI / 2; sr.position.set(s * (hw / 2 + 0.003), hc.y - 0.005, -0.005); deco(sr, MAT.joint);
    }
    for (const [x, z] of [[-0.03, 0.03], [0.03, 0.03], [-0.03, -0.01], [0.03, -0.01]]) {
      const m = new THREE.Mesh(new THREE.SphereGeometry(0.004, 10, 8)); m.position.set(x, hc.y + hh / 2 - 0.0015, z); reg(m, 'mic', 'part', MAT.graphite);
    }
    reg(rbox(0.09, 0.005, 0.07, 0.0024, V(0, hc.y + hh / 2 + 0.0015, -0.045)), 'touch', 'part', MAT.graphite);
    anchor('face', V(0, hc.y - 0.032, fzr + 0.005), V(0, 0, 1));
    anchor('rgb', V(0.036, ty + Math.sin(0.42) * hr, tz + Math.cos(0.42) * hr + 0.003), V(0, 0.4, 1));
    anchor('mic', V(0.03, hc.y + hh / 2 + 0.002, 0.03), V(0.1, 1, 0.3));
    anchor('touch', V(0, hc.y + hh / 2 + 0.004, -0.05), V(0, 1, -0.5));

    // ---- neck + white collar
    deco(new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.032, 0.08, 20)).translateY(1.49), MAT.joint);
    joint('neck', V(0, 1.488, 0), V(0, 1, 0), 0.036, 0.024, { detail: false });
    joint('neck', V(0, 1.508, 0), V(1, 0, 0), 0.022, 0.07, { detail: false, bandAt: 0.0 });
    const collar = new THREE.Mesh(new THREE.TorusGeometry(0.074, 0.022, 18, 56)); collar.rotation.x = Math.PI / 2; collar.scale.set(1, 0.85, 1); collar.position.y = 1.478;
    reg(collar, 'frame', 'shell', MAT.white);
    anchor('neck', V(0.0, 1.508, 0.036), V(0, 0, 1));

    // ---- chest: white barrel, wider at the top
    const cy0 = 1.10, cz = 0.62;
    const chestProf = [[0.004, 0], [0.12, 0], [0.135, 0.03], [0.16, 0.12], [0.175, 0.22], [0.178, 0.29], [0.165, 0.335], [0.125, 0.36], [0.07, 0.372], [0.004, 0.375]];
    const csp = spline(chestProf);
    const chest = new THREE.Mesh(lathe(chestProf, 72)); chest.geometry.scale(1, 1, cz); chest.position.y = cy0;
    reg(chest, 'frame', 'shell', MAT.white);
    // panel seam
    const seam = []; for (let i = 0; i <= 40; i++) { const ph = -1.35 + i * 2.7 / 40, y = 1.2 + 0.13 * (ph / 1.35) ** 2; const r = rAt(csp, y - cy0) * 1.004; seam.push(V(r * Math.sin(ph), y, r * Math.cos(ph) * cz)); }
    deco(tube(seam, 0.0016), MAT.graphite);
    // center sensor slot: RGB-D + lidar
    const sy = 1.285, sz = rAt(csp, sy - cy0) * cz;
    deco(rbox(0.034, 0.12, 0.02, 0.0095, V(0, sy, sz - 0.006)), MAT.gloss);
    lens('rgbd', V(0, 1.315, sz + 0.0045), V(0, 0, 1), 0.0062);
    lens('rgbd', V(0, 1.292, sz + 0.0045), V(0, 0, 1), 0.0062);
    lens('lidar', V(0, 1.255, sz + 0.0045), V(0, 0, 1), 0.009, MAT.lens);
    anchor('rgbd', V(0, 1.305, sz + 0.006), V(0, 0, 1));
    anchor('lidar', V(0, 1.255, sz + 0.006), V(0, 0, 1));
    // battery panel on the back
    const by = 1.32, bz = rAt(csp, by - cy0) * cz;
    reg(rbox(0.19, 0.19, 0.034, 0.014, V(0, by, -bz + 0.01)), 'battery', 'shell', MAT.joint);
    for (let i = 0; i < 5; i++) deco(rbox(0.11, 0.006, 0.004, 0.002, V(0, by - 0.05 + i * 0.016, -bz - 0.0075)), MAT.gloss);
    anchor('battery', V(0, by + 0.04, -bz - 0.008), V(0, 0, -1));
    reg(rbox(0.04, 0.02, 0.016, 0.006, V(0.06, 1.41, -bz + 0.002)), 'estop', 'part', MAT.graphite);
    anchor('estop', V(0.06, 1.41, -bz - 0.007), V(0.3, 0.5, -1));
    // waist band + exposed waist yaw module
    const wProf = [[0.004, 0], [0.096, 0], [0.108, 0.015], [0.116, 0.06], [0.124, 0.1], [0.004, 0.105]];
    const wb = new THREE.Mesh(lathe(wProf, 56)); wb.geometry.scale(1, 1, 0.78); wb.position.y = 1.02; reg(wb, 'frame', 'shell', MAT.rubber);
    joint('waist', V(0, 0.985, 0), V(0, 1, 0), 0.085, 0.075, { mat: MAT.gloss, bandAt: 0.3 });
    for (const y of [0.962, 1.0]) { const t = new THREE.Mesh(new THREE.TorusGeometry(0.0865, 0.0022, 6, 56)); t.rotation.x = Math.PI / 2; t.position.y = y; deco(t, MAT.graphite); }
    joint('waist', V(0, 1.04, 0), V(1, 0, 0), 0.03, 0.15, { detail: false, band: false });
    joint('waist', V(0, 1.04, 0), V(0, 0, 1), 0.03, 0.13, { detail: false, band: false });
    anchor('waist', V(0.06, 0.985, 0.06), V(0.5, 0, 1));
    // pelvis
    reg(rbox(0.22, 0.13, 0.17, 0.05, V(0, 0.885, 0), 6), 'frame', 'shell', MAT.joint);
    for (let i = 0; i < 4; i++) deco(rbox(0.06, 0.004, 0.004, 0.0018, V(0, 0.9 - i * 0.011, 0.086)), MAT.graphite);
    // internals
    reg(rbox(0.1, 0.012, 0.07, 0.003, V(0, 1.35, 0)), 'jetson', 'part', MAT.board);
    reg(rbox(0.12, 0.012, 0.07, 0.003, V(0, 1.24, 0)), 'cpu', 'part', MAT.board);
    reg(rbox(0.1, 0.04, 0.04, 0.006, V(0, 1.06, -0.02)), 'bms', 'part', MAT.board);
    reg(rbox(0.03, 0.014, 0.03, 0.003, V(0, 0.885, 0)), 'imu', 'part', MAT.board);
    anchor('jetson', V(0.03, 1.35, 0.03), null); anchor('cpu', V(-0.04, 1.24, 0.03), null);
    anchor('bms', V(0, 1.06, 0.0), null); anchor('imu', V(0, 0.885, 0.016), null);

    // ---- arms: black shoulder drums with white rings
    for (const s of [1, -1]) {
      const L = s > 0 ? 'L' : 'R', X = (x) => s * x;
      joint('shoulder' + L, V(X(0.205), 1.405, 0), V(s, 0, 0), 0.06, 0.07, { mat: MAT.gloss, band: false });
      pivot(V(X(0.24), 1.39, 0), s * 0.07);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.043, 0.011, 14, 48)); ring.rotation.y = Math.PI / 2; ring.position.set(X(0.2405), 1.405, 0);
      reg(ring, 'shoulder' + L, 'accent', MAT.ring, { keepSub: true });
      { const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.029, 0.029, 0.004, 32)); cap.rotation.z = Math.PI / 2; cap.position.set(X(0.2415), 1.405, 0); deco(cap, MAT.graphite); }
      joint('shoulder' + L, V(X(0.25), 1.36, 0), V(0, 0, 1), 0.038, 0.08, { detail: false });
      joint('shoulder' + L, V(X(0.255), 1.25, 0), V(0, 1, 0), 0.034, 0.04, { detail: false });
      reg(limb(V(X(0.258), 1.13, 0), V(X(0.25), 1.36, 0), [[0, 0.004], [0.03, 0.04], [0.3, 0.049], [0.8, 0.056], [0.95, 0.05], [1, 0.004]]), 'frame', 'shell', MAT.white);
      reg(rbox(0.068, 0.06, 0.078, 0.02, V(X(0.258), 1.108, -0.004)), 'elbow' + L, 'joint', MAT.joint);
      joint('elbow' + L, V(X(0.258), 1.108, 0), V(s, 0, 0), 0.034, 0.082);
      reg(limb(V(X(0.26), 0.905, 0), V(X(0.258), 1.09, 0), [[0, 0.004], [0.03, 0.034], [0.5, 0.045], [0.9, 0.043], [1, 0.004]]), 'frame', 'shell', MAT.white);
      reg(rbox(0.056, 0.06, 0.07, 0.016, V(X(0.262), 0.876, 0)), 'wrist' + L, 'joint', MAT.gloss);
      joint('wrist' + L, V(X(0.26), 0.96, 0), V(0, 1, 0), 0.026, 0.03, { detail: false });
      joint('wrist' + L, V(X(0.262), 0.872, 0), V(s, 0, 0), 0.024, 0.064, { detail: false });
      joint('wrist' + L, V(X(0.262), 0.856, 0), V(0, 0, 1), 0.02, 0.074, { detail: false, band: false });
      // optional Omnihand-style end-effector (sold separately, not in the 31 DOF)
      deco(rbox(0.028, 0.05, 0.06, 0.012, V(X(0.265), 0.825, 0.004)), MAT.white, true);
      for (const [z, len] of [[-0.022, 0.048], [-0.007, 0.055], [0.008, 0.055], [0.023, 0.05]]) {
        const f = new THREE.Mesh(new THREE.CapsuleGeometry(0.007, len, 4, 12)); f.position.set(X(0.265), 0.8 - len / 2, z); deco(f, MAT.white, true);
      }
      const th = new THREE.Mesh(new THREE.CapsuleGeometry(0.0075, 0.038, 4, 12)); th.position.set(X(0.255), 0.805, 0.042); th.rotation.x = 0.55; th.rotation.z = s * -0.35; deco(th, MAT.white, true);
      anchor('shoulder' + L, V(X(0.242), 1.405, 0.043), V(s, 0.1, 0.8));
      anchor('elbow' + L, V(X(0.258), 1.108, 0.036), V(s * 0.4, 0, 1));
      anchor('wrist' + L, V(X(0.262), 0.876, 0.036), V(s * 0.4, 0, 1));
      reg(tube([V(X(0.252), 1.3, -0.056), V(X(0.256), 1.16, -0.052), V(X(0.259), 1.0, -0.045)], 0.0035), 'harness', 'joint', MAT.joint);
      unpivot();
      reg(tube([V(X(0.12), 1.44, -0.095), V(X(0.2), 1.42, -0.065)], 0.0035), 'harness', 'joint', MAT.joint);
    }

    // ---- legs
    for (const s of [1, -1]) {
      const L = s > 0 ? 'L' : 'R', X = (x) => s * x;
      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.072, 36, 24)); cap.scale.set(0.85, 1, 1); cap.position.set(X(0.125), 0.86, 0);
      reg(cap, 'hip' + L, 'joint', MAT.gloss);
      const hring = new THREE.Mesh(new THREE.TorusGeometry(0.038, 0.004, 8, 40)); hring.rotation.y = Math.PI / 2; hring.position.set(X(0.125 + 0.0605), 0.86, 0); reg(hring, 'hip' + L, 'accent', MAT.band);
      joint('hip' + L, V(X(0.1), 0.9, 0), V(0, 1, 0), 0.035, 0.03, { detail: false });
      joint('hip' + L, V(X(0.12), 0.865, 0), V(0, 0, 1), 0.04, 0.1, { detail: false });
      joint('hip' + L, V(X(0.13), 0.86, 0), V(s, 0, 0), 0.05, 0.1, { band: false });
      reg(limb(V(X(0.11), 0.53, 0), V(X(0.122), 0.83, 0), [[0, 0.004], [0.03, 0.05], [0.25, 0.063], [0.7, 0.07], [0.92, 0.066], [0.98, 0.045], [1, 0.004]], 1, 1.05), 'frame', 'shell', MAT.white);
      for (const y of [0.6, 0.625, 0.65]) deco(rbox(0.006, 0.006, 0.04, 0.0025, V(X(0.183), y, 0)), MAT.graphite);
      reg(rbox(0.08, 0.075, 0.095, 0.025, V(X(0.11), 0.49, -0.005)), 'knee' + L, 'joint', MAT.joint);
      joint('knee' + L, V(X(0.11), 0.49, 0), V(s, 0, 0), 0.045, 0.095);
      reg(limb(V(X(0.11), 0.17, 0), V(X(0.11), 0.47, 0), [[0, 0.004], [0.03, 0.04], [0.4, 0.05], [0.8, 0.059], [0.95, 0.055], [1, 0.004]]), 'frame', 'shell', MAT.white);
      const vent = new THREE.Mesh(new THREE.CapsuleGeometry(0.008, 0.035, 4, 10)); vent.scale.set(0.5, 1, 1); vent.position.set(X(0.167), 0.36, 0); deco(vent, MAT.graphite);
      for (const dx of [-0.02, 0.02]) reg(tube([V(X(0.11) + dx, 0.12, -0.035), V(X(0.11) + dx, 0.22, -0.042), V(X(0.11) + dx, 0.3, -0.04)], 0.005), 'ankle' + L, 'joint', MAT.joint);
      joint('ankle' + L, V(X(0.11), 0.105, -0.008), V(s, 0, 0), 0.03, 0.07);
      joint('ankle' + L, V(X(0.11), 0.13, -0.008), V(0, 0, 1), 0.022, 0.05, { detail: false });
      deco(new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.026, 0.07, 18)).translateX(X(0.11)).translateY(0.16), MAT.joint);
      // chunky yellow foot on a black sole
      const fg = new THREE.ExtrudeGeometry(footShape(0.118, 0.085, 0.185, 0.055), { depth: 0.03, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.014, bevelSegments: 5, curveSegments: 18 });
      fg.rotateX(-Math.PI / 2); fg.translate(X(0.11), 0.032, 0);
      reg(new THREE.Mesh(fg), 'frame', 'shell', MAT.yellow);
      const sg = new THREE.ExtrudeGeometry(footShape(0.13, 0.092, 0.192, 0.06), { depth: 0.006, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.004, bevelSegments: 2, curveSegments: 18 });
      sg.rotateX(-Math.PI / 2); sg.translate(X(0.11), 0.004, 0); deco(new THREE.Mesh(sg), MAT.rubber);
      reg(rbox(0.07, 0.035, 0.08, 0.015, V(X(0.11), 0.085, -0.02)), 'frame', 'shell', MAT.joint);
      for (const z of [-0.04, 0.12]) reg(rbox(0.07, 0.004, 0.05, 0.0015, V(X(0.11), 0.002, z)), 'footforce', 'part', MAT.board);
      anchor('hip' + L, V(X(0.125), 0.86, 0.072), V(s * 0.3, 0, 1));
      anchor('knee' + L, V(X(0.11), 0.49, 0.0455), V(0.2 * s, 0, 1));
      anchor('ankle' + L, V(X(0.11), 0.105, 0.024), V(s * 0.4, 0, 1));
      reg(tube([V(X(0.1), 0.86, -0.085), V(X(0.115), 0.78, -0.075), V(X(0.118), 0.66, -0.075), V(X(0.112), 0.54, -0.068), V(X(0.11), 0.44, -0.062), V(X(0.11), 0.3, -0.061), V(X(0.11), 0.18, -0.045)], 0.0038), 'harness', 'joint', MAT.joint);
    }
    reg(tube([V(0, 1.42, -0.09), V(0, 1.47, -0.045), V(0, 1.51, -0.05)], 0.005), 'harness', 'joint', MAT.joint);
    anchor('harmonic', V(0.159, 0.49, 0), V(1, 0, 0.15));
    anchor('torque', V(-0.159, 0.49, 0), V(-1, 0, 0.15));
    anchor('encoder', V(-0.07, 0.49, 0.01), V(1, 0, 0.4));
    anchor('harness', V(0.118, 0.66, -0.075), V(0.3, 0, -1));
    anchor('frame', V(-0.117, 0.66, 0.073), V(0, 0, 1));
    anchor('footforce', V(0.11, 0.004, 0.2), V(0, -0.1, 1));
  }

  // =========================================================== A3-class likeness (stage humanoid)
  // Glossy black egg head, white chest plate on a dark yoke, dark waist and briefs, slim white limbs, white shoes.
  function buildA3() {
    // ---- head
    const hy0 = 1.5;
    const headProf = [[0.004, 0], [0.03, 0.008], [0.052, 0.03], [0.066, 0.07], [0.072, 0.115], [0.072, 0.16], [0.064, 0.2], [0.046, 0.225], [0.02, 0.236], [0.004, 0.238]];
    const hsp = spline(headProf);
    const head = new THREE.Mesh(lathe(headProf, 72)); head.geometry.scale(1, 1, 1.12); head.position.set(0, hy0, 0.005);
    reg(head, 'frame', 'shell', MAT.gloss);
    // binocular camera pairs behind the visor (two pairs)
    for (const [x, y] of [[-0.026, 0.13], [0.026, 0.13], [-0.03, 0.095], [0.03, 0.095]]) {
      const r = rAt(hsp, y) * 1.12 * 0.985;
      lens('stereo', V(x, hy0 + y, 0.005 + Math.sqrt(Math.max(0, r * r - x * x))), V(x * 4, 0.05, 1), 0.0062, MAT.lens);
    }
    // ear pods with mics
    for (const s of [1, -1]) {
      const ep = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.012, 28)); ep.rotation.z = Math.PI / 2; ep.position.set(s * 0.072, hy0 + 0.12, 0.0); deco(ep, MAT.graphite);
      const m = new THREE.Mesh(new THREE.SphereGeometry(0.0045, 10, 8)); m.position.set(s * 0.079, hy0 + 0.12, 0.0); reg(m, 'mic', 'part', MAT.joint);
    }
    anchor('stereo', V(0.026, hy0 + 0.13, 0.005 + rAt(hsp, 0.13) * 1.12), V(0.1, 0.05, 1));
    anchor('mic', V(0.081, hy0 + 0.12, 0.0), V(1, 0, 0.2));

    // ---- neck
    deco(new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.032, 0.08, 20)).translateY(1.47), MAT.joint);
    joint('neck', V(0, 1.455, 0), V(0, 1, 0), 0.034, 0.022, { detail: false });
    joint('neck', V(0, 1.488, 0), V(1, 0, 0), 0.02, 0.06, { detail: false, bandAt: 0.0 });
    anchor('neck', V(0.032, 1.488, 0.01), V(1, 0, 0.6));

    // ---- chest: dark yoke + white front plate + light strip
    const cy0 = 1.07, cz = 0.62;
    const chestProf = [[0.004, 0], [0.105, 0], [0.118, 0.03], [0.14, 0.13], [0.152, 0.24], [0.152, 0.3], [0.138, 0.34], [0.1, 0.365], [0.05, 0.375], [0.004, 0.377]];
    const csp = spline(chestProf);
    const yoke = new THREE.Mesh(lathe(chestProf, 72)); yoke.geometry.scale(1, 1, cz); yoke.position.y = cy0; reg(yoke, 'frame', 'shell', MAT.graphite);
    const plateP = csp.filter(p => p.y > 0.03 && p.y < 0.335).map(p => new THREE.Vector2(p.x * 1.012, p.y));
    const plate = new THREE.Mesh(new THREE.LatheGeometry(plateP, 56, -1.05, 2.1)); plate.geometry.scale(1, 1, cz); plate.position.y = cy0;
    reg(plate, 'frame', 'shell', MAT.white);
    const backP = csp.filter(p => p.y > 0.06 && p.y < 0.3).map(p => new THREE.Vector2(p.x * 1.012, p.y));
    const back = new THREE.Mesh(new THREE.LatheGeometry(backP, 48, Math.PI - 0.95, 1.9)); back.geometry.scale(1, 1, cz); back.position.y = cy0;
    reg(back, 'battery', 'shell', MAT.white);
    { const y = 1.4, r = rAt(csp, y - cy0) * 1.016; reg(tube([V(-0.03, y, r * cz * 0.995), V(0, y + 0.002, r * cz), V(0.03, y, r * cz * 0.995)], 0.0028), 'frame', 'accent', MAT.strip, { keepSub: true }); }
    // battery: two packs behind the back plate (visible as seams)
    for (const x of [-0.045, 0.045]) deco(rbox(0.07, 0.17, 0.006, 0.003, V(x, 1.22, -rAt(csp, 0.15) * cz - 0.006)), MAT.graphite);
    anchor('battery', V(0.045, 1.25, -rAt(csp, 0.18) * cz - 0.01), V(0, 0, -1));
    // radios: 5G antenna nubs on the upper back
    for (const x of [-0.06, 0.06]) reg(rbox(0.03, 0.012, 0.01, 0.004, V(x, 1.405, -0.083)), 'estop', 'part', MAT.joint);
    anchor('estop', V(0.06, 1.41, -0.09), V(0.2, 0.5, -1));
    // waist (dark) and pelvis briefs
    const wProf = [[0.004, 0], [0.085, 0], [0.09, 0.02], [0.088, 0.06], [0.098, 0.085], [0.004, 0.09]];
    const wb = new THREE.Mesh(lathe(wProf, 56)); wb.geometry.scale(1, 1, 0.75); wb.position.y = 0.985; reg(wb, 'frame', 'shell', MAT.joint);
    joint('waist', V(0, 1.0, 0), V(0, 1, 0), 0.075, 0.05, { mat: MAT.graphite, bandAt: 0.3 });
    joint('waist', V(0, 1.035, 0), V(1, 0, 0), 0.026, 0.14, { detail: false, band: false });
    joint('waist', V(0, 1.035, 0), V(0, 0, 1), 0.026, 0.11, { detail: false, band: false });
    anchor('waist', V(0.055, 1.0, 0.055), V(0.5, 0, 1));
    const pel = new THREE.Mesh(lathe([[0.004, 0], [0.07, 0.0], [0.105, 0.04], [0.118, 0.085], [0.11, 0.1], [0.004, 0.1]], 56)); pel.geometry.scale(1, 1, 0.72); pel.position.y = 0.87;
    reg(pel, 'frame', 'shell', MAT.joint);
    // internals
    reg(rbox(0.11, 0.012, 0.07, 0.003, V(0, 1.3, 0)), 'cpu', 'part', MAT.board);
    reg(rbox(0.09, 0.012, 0.06, 0.003, V(0, 1.2, 0)), 'cpu', 'part', MAT.board);
    reg(rbox(0.1, 0.04, 0.04, 0.006, V(0, 1.11, -0.02)), 'bms', 'part', MAT.board);
    reg(rbox(0.03, 0.014, 0.03, 0.003, V(0, 0.93, 0)), 'imu', 'part', MAT.board);
    anchor('cpu', V(0.035, 1.3, 0.03), null); anchor('bms', V(0, 1.11, 0.0), null); anchor('imu', V(0, 0.93, 0.016), null);

    // ---- arms: slim white, dark wrist bands
    for (const s of [1, -1]) {
      const L = s > 0 ? 'L' : 'R', X = (x) => s * x;
      pivot(V(X(0.18), 1.39, 0), s * 0.09);
      joint('shoulder' + L, V(X(0.165), 1.39, 0), V(s, 0, 0), 0.04, 0.05, { mat: MAT.graphite });
      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.047, 28, 18)); cap.scale.set(1, 0.95, 1); cap.position.set(X(0.195), 1.385, 0);
      reg(cap, 'frame', 'shell', MAT.white);
      reg(rbox(0.03, 0.04, 0.05, 0.012, V(X(0.2), 1.405, 0.0)), 'shtouch', 'part', MAT.white);
      joint('shoulder' + L, V(X(0.2), 1.3, 0), V(0, 1, 0), 0.03, 0.035, { detail: false });
      reg(limb(V(X(0.2), 1.145, 0), V(X(0.2), 1.34, 0), [[0, 0.004], [0.03, 0.03], [0.4, 0.036], [0.85, 0.04], [1, 0.004]]), 'frame', 'shell', MAT.white);
      joint('elbow' + L, V(X(0.2), 1.125, 0), V(s, 0, 0), 0.03, 0.07);
      reg(limb(V(X(0.2), 0.925, 0), V(X(0.2), 1.11, 0), [[0, 0.004], [0.04, 0.026], [0.6, 0.033], [0.92, 0.032], [1, 0.004]]), 'frame', 'shell', MAT.white);
      reg(new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.028, 24)).translateX(X(0.2)).translateY(0.92), 'wrist' + L, 'joint', MAT.joint);
      joint('wrist' + L, V(X(0.2), 0.9, 0), V(s, 0, 0), 0.018, 0.04, { detail: false });
      joint('wrist' + L, V(X(0.2), 0.885, 0), V(0, 0, 1), 0.016, 0.04, { detail: false, band: false });
      // optional dexterous hand: slim palm and four fingers + thumb
      const hid = 'hand' + L;
      reg(rbox(0.022, 0.07, 0.06, 0.01, V(X(0.2), 0.835, 0.004)), hid, 'joint', MAT.white);
      for (const [z, len] of [[-0.021, 0.04], [-0.007, 0.048], [0.007, 0.048], [0.021, 0.042]]) {
        const f = new THREE.Mesh(new THREE.CapsuleGeometry(0.0055, len, 4, 10)); f.position.set(X(0.2), 0.8 - len / 2, z); reg(f, hid, 'joint', MAT.white);
      }
      const th = new THREE.Mesh(new THREE.CapsuleGeometry(0.006, 0.03, 4, 10)); th.position.set(X(0.19), 0.82, 0.037); th.rotation.x = 0.6; reg(th, hid, 'joint', MAT.white);
      anchor('shoulder' + L, V(X(0.165), 1.39, 0.041), V(s, 0.2, 0.8));
      anchor('shtouch' + (s > 0 ? '' : '_'), V(X(0.2), 1.43, 0.0), V(s, 1, 0.3));
      anchor('elbow' + L, V(X(0.2), 1.125, 0.031), V(s * 0.4, 0, 1));
      anchor('wrist' + L, V(X(0.2), 0.915, 0.03), V(s * 0.4, 0, 1));
      anchor(hid, V(X(0.212), 0.78, 0.0), V(s, 0, 0.5));
      reg(tube([V(X(0.2), 1.3, -0.04), V(X(0.2), 1.15, -0.036), V(X(0.2), 0.97, -0.03)], 0.003), 'harness', 'joint', MAT.joint);
      unpivot();
    }
    delete robot.anchors['shtouch_'];

    // ---- legs: slim white thighs and shins, white shoes
    for (const s of [1, -1]) {
      const L = s > 0 ? 'L' : 'R', X = (x) => s * x;
      joint('hip' + L, V(X(0.085), 0.89, 0), V(0, 1, 0), 0.032, 0.03, { detail: false });
      joint('hip' + L, V(X(0.095), 0.855, 0), V(0, 0, 1), 0.034, 0.09, { detail: false, mat: MAT.graphite });
      joint('hip' + L, V(X(0.098), 0.82, 0), V(s, 0, 0), 0.05, 0.05);
      reg(limb(V(X(0.098), 0.52, 0), V(X(0.11), 0.8, 0), [[0, 0.004], [0.03, 0.04], [0.25, 0.048], [0.7, 0.056], [0.92, 0.056], [1, 0.004]], 1, 0.95), 'frame', 'shell', MAT.white);
      joint('knee' + L, V(X(0.098), 0.49, 0), V(s, 0, 0), 0.04, 0.085, { mat: MAT.graphite });
      const kc = new THREE.Mesh(new THREE.SphereGeometry(0.026, 20, 14)); kc.scale.set(0.4, 1, 1); kc.position.set(X(0.098 + 0.044), 0.49, 0); deco(kc, MAT.white);
      reg(limb(V(X(0.098), 0.12, 0), V(X(0.098), 0.46, 0), [[0, 0.004], [0.03, 0.028], [0.35, 0.034], [0.75, 0.043], [0.93, 0.042], [1, 0.004]], 1, 0.9, 0.006), 'frame', 'shell', MAT.white);
      joint('ankle' + L, V(X(0.098), 0.088, 0), V(s, 0, 0), 0.024, 0.06);
      joint('ankle' + L, V(X(0.098), 0.105, -0.004), V(0, 0, 1), 0.018, 0.045, { detail: false });
      const fg = new THREE.ExtrudeGeometry(footShape(0.085, 0.07, 0.16, 0.04), { depth: 0.03, bevelEnabled: true, bevelThickness: 0.014, bevelSize: 0.01, bevelSegments: 4, curveSegments: 16 });
      fg.rotateX(-Math.PI / 2); fg.translate(X(0.098), 0.016, 0);
      reg(new THREE.Mesh(fg), 'frame', 'shell', MAT.white);
      const sg = new THREE.ExtrudeGeometry(footShape(0.09, 0.074, 0.164, 0.042), { depth: 0.006, bevelEnabled: true, bevelThickness: 0.003, bevelSize: 0.003, bevelSegments: 2, curveSegments: 16 });
      sg.rotateX(-Math.PI / 2); sg.translate(X(0.098), 0.004, 0); deco(new THREE.Mesh(sg), MAT.rubber);
      for (const z of [-0.04, 0.11]) reg(rbox(0.065, 0.004, 0.05, 0.0015, V(X(0.098), 0.002, z)), 'footforce', 'part', MAT.board);
      anchor('hip' + L, V(X(0.098), 0.82, 0.05), V(s * 0.2, 0, 1));
      anchor('knee' + L, V(X(0.098), 0.49, 0.04), V(0.2 * s, 0, 1));
      anchor('ankle' + L, V(X(0.098), 0.088, 0.025), V(s * 0.4, 0, 1));
      reg(tube([V(X(0.09), 0.9, -0.07), V(X(0.1), 0.78, -0.052), V(X(0.1), 0.6, -0.05), V(X(0.098), 0.45, -0.045), V(X(0.098), 0.3, -0.042), V(X(0.098), 0.14, -0.035)], 0.0034), 'harness', 'joint', MAT.joint);
    }
    anchor('harmonic', V(0.143, 0.49, 0), V(1, 0, 0.15));
    anchor('torque', V(-0.143, 0.49, 0), V(-1, 0, 0.15));
    anchor('encoder', V(-0.06, 0.49, 0.01), V(1, 0, 0.4));
    anchor('harness', V(0.1, 0.6, -0.052), V(0.3, 0, -1));
    anchor('frame', V(-0.11, 0.68, 0.052), V(0, 0, 1));
    anchor('footforce', V(0.098, 0.004, 0.16), V(0, -0.1, 1));
  }

  // =========================================================== D1-class likeness (quadruped)
  // White body with a boxy camera head, exposed silver actuators, white curved legs, yellow round feet. Faces +Z.
  function buildD1() {
    const by = 0.33;
    // body: white shell over a dark chassis
    reg(rbox(0.19, 0.1, 0.44, 0.035, V(0, by, -0.01), 5), 'frame', 'shell', MAT.white);
    reg(rbox(0.16, 0.035, 0.38, 0.012, V(0, by - 0.06, -0.01)), 'frame', 'shell', MAT.graphite);
    // head block with a dark rounded-square window and big lens
    reg(rbox(0.17, 0.11, 0.11, 0.035, V(0, by + 0.015, 0.235), 5), 'frame', 'shell', MAT.white);
    deco(rbox(0.11, 0.075, 0.012, 0.018, V(0, by + 0.017, 0.287)), MAT.gloss);
    lens('rgb', V(0.005, by + 0.017, 0.2945), V(0, 0, 1), 0.019, MAT.lensBlue);
    anchor('rgb', V(0.005, by + 0.017, 0.298), V(0, 0, 1));
    // top: expansion rail + optional lidar puck + radio antennas
    reg(rbox(0.06, 0.012, 0.2, 0.004, V(0, by + 0.056, -0.04)), 'payload', 'part', MAT.graphite);
    reg(new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.038, 0.04, 28)).translateY(by + 0.082).translateZ(0.0), 'payload', 'part', MAT.graphite);
    deco(new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.036, 0.012, 28)).translateY(by + 0.085), MAT.lens);
    anchor('payload', V(0.0, by + 0.105, 0.0), V(0, 1, 0.3));
    for (const x of [-0.06, 0.06]) reg(new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.04, 8)).translateX(x).translateY(by + 0.07).translateZ(-0.2), 'estop', 'part', MAT.joint);
    anchor('estop', V(0.06, by + 0.09, -0.2), V(0.3, 1, -0.5));
    // battery: removable pack in the belly, visible as a panel on the underside/rear
    reg(rbox(0.12, 0.02, 0.22, 0.008, V(0, by - 0.083, -0.04)), 'battery', 'shell', MAT.joint);
    anchor('battery', V(0.0, by - 0.094, -0.1), V(0, -1, -0.4));
    // internals
    reg(rbox(0.1, 0.012, 0.12, 0.003, V(0, by + 0.01, 0.06)), 'cpu', 'part', MAT.board);
    reg(rbox(0.08, 0.03, 0.06, 0.005, V(0, by - 0.02, -0.12)), 'bms', 'part', MAT.board);
    reg(rbox(0.03, 0.012, 0.03, 0.003, V(0, by + 0.01, -0.03)), 'imu', 'part', MAT.board);
    anchor('cpu', V(0.035, by + 0.01, 0.08), null); anchor('bms', V(0, by - 0.02, -0.12), null); anchor('imu', V(0, by + 0.01, -0.03), null);
    // legs
    const legs = [['legFL', 1, 1], ['legFR', -1, 1], ['legRL', 1, -1], ['legRR', -1, -1]];
    for (const [id, s, f] of legs) {
      const X = (x) => s * x, hz = f * 0.17;
      // body (abduction) joint along Z, silver
      joint(id, V(X(0.075), by, hz), V(0, 0, 1), 0.038, 0.08, { mat: MAT.silver, bandAt: -0.2 });
      // thigh joint along X, outboard, silver
      joint(id, V(X(0.13), by, hz - f * 0.02), V(s, 0, 0), 0.042, 0.05, { mat: MAT.silver });
      // explicit leg: hip pod on body corner -> thigh down & back -> knee (points back) -> calf forward to foot under hip
      const lx = X(0.155), hipZ = hz - f * 0.02;
      const hip = V(lx, by, hipZ);
      const knee = V(lx, by - 0.16, hipZ - 0.095);
      const foot = V(lx, 0.028, hipZ + 0.015);
      const seg = (p0, p1, r0, r1, mat) => {
        const len = p0.distanceTo(p1);
        const m = new THREE.Mesh(new THREE.CylinderGeometry(r1, r0, len, 20));
        m.position.copy(p0).add(p1).multiplyScalar(0.5);
        m.quaternion.setFromUnitVectors(V(0, 1, 0), p1.clone().sub(p0).normalize());
        reg(m, 'frame', 'shell', mat);
      };
      const ball = (p0, r, mat, part) => { const m = new THREE.Mesh(new THREE.SphereGeometry(r, 18, 12)); m.position.copy(p0); reg(m, part || 'frame', 'shell', mat); };
      // bridge from the hip pod to the thigh drive so nothing floats
      seg(V(X(0.1), by, hipZ), hip, 0.03, 0.03, MAT.silver);
      ball(hip, 0.036, MAT.silver);
      seg(hip, knee, 0.032, 0.022, MAT.white);
      joint(id, knee, V(s, 0, 0), 0.024, 0.044, { mat: MAT.silver, detail: false });
      ball(knee, 0.025, MAT.silver);
      seg(knee, foot.clone().add(V(0, 0.015, 0)), 0.019, 0.013, MAT.white);
      const ft = new THREE.Mesh(new THREE.SphereGeometry(0.027, 20, 14)); ft.position.copy(foot); ft.scale.set(1, 0.9, 1); reg(ft, 'frame', 'shell', MAT.yellow);
      anchor(id, V(X(0.16), by, hipZ), V(s, 0, 0.3 * f));
      reg(tube([V(X(0.06), by + 0.02, hz - f * 0.06), V(X(0.13), by - 0.02, hz - f * 0.05), V(lx - s * 0.02, 0.26, hipZ - 0.05)], 0.003), 'harness', 'joint', MAT.joint);
    }
    anchor('harmonic', V(0.075, by, 0.17 + 0.042), V(0, 0, 1));
    anchor('encoder', V(-0.155, by, -0.19), V(-1, 0, -0.3));
    anchor('harness', V(0.13, by - 0.02, -0.12), V(1, -0.3, 0));
    anchor('frame', V(-0.095, by + 0.02, -0.05), V(-1, 0.3, 0));
    // charging dock beside the robot (standard accessory; counts toward the 4.4 lb definition)
    reg(rbox(0.2, 0.03, 0.16, 0.012, V(0.32, 0.015, -0.28)), 'dock', 'part', MAT.graphite);
    for (const x of [0.29, 0.35]) deco(rbox(0.02, 0.006, 0.05, 0.002, V(x, 0.032, -0.28)), MAT.yellow);
    anchor('dock', V(0.36, 0.03, -0.24), V(0.3, 1, 0.4));
  }

  group.scale.setScalar(C.scale);
  const tag = document.createElement('div'); tag.className = 'htag';
  tag.innerHTML = `<b>${C.name}</b> ${C.heightCm} cm · ~${C.massKg} kg · ${C.dof} DOF`;
  const tagObj = new CSS2DObject(tag); tagObj.position.set(0, C.tagY ?? 1.86, 0); group.add(tagObj);
  robot.tag = tagObj;
  return robot;
}
