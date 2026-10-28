import * as THREE from "three";

/* Piezas básicas compartidas por la cámara y los entornos. Unidades: milímetros. */

export const V = (x, y, z) => new THREE.Vector3(x, y, z);
const UP = V(0, 1, 0);

export const std = (color, metalness = 0, roughness = 0.7, extra = {}) =>
  new THREE.MeshStandardMaterial({ color, metalness, roughness, ...extra });

export function mesh(geo, mat, parent, pos, rot) {
  const m = new THREE.Mesh(geo, mat);
  if (pos) m.position.set(pos[0], pos[1], pos[2]);
  if (rot) m.rotation.set(rot[0], rot[1], rot[2]);
  parent?.add(m);
  return m;
}

export const box = (w, h, d, mat, parent, pos, rot) => mesh(new THREE.BoxGeometry(w, h, d), mat, parent, pos, rot);

/** Cilindro entre dos puntos; r2 permite conicidad hacia `b`. */
export function rod(a, b, r, mat, parent, r2 = r, seg = 14) {
  const dir = b.clone().sub(a);
  const len = dir.length();
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r2, r, len, seg), mat);
  m.position.copy(a).addScaledVector(dir, 0.5);
  m.quaternion.setFromUnitVectors(UP, dir.normalize());
  parent?.add(m);
  return m;
}

/** Tubería por tramos rectos con codos esféricos. */
export function pipe(points, r, mat, parent) {
  const g = new THREE.Group();
  for (let i = 0; i < points.length - 1; i++) {
    rod(points[i], points[i + 1], r, mat, g);
    if (i > 0) mesh(new THREE.SphereGeometry(r, 10, 8), mat, g, points[i].toArray());
  }
  parent?.add(g);
  return g;
}

/** Manguera o cable curvo que pasa por los puntos dados. */
export function hose(points, r, mat, parent, seg = 40) {
  const m = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), seg, r, 8, false), mat);
  parent?.add(m);
  return m;
}

/** Plano con textura, visible por una sola cara (las paredes se cortan solas al orbitar por fuera). */
export function panel(w, h, mat, parent, pos, rot) {
  return mesh(new THREE.PlaneGeometry(w, h), mat, parent, pos, rot);
}

/** Libera geometrías, materiales y texturas de un subárbol. */
export function disposeTree(root) {
  root.traverse((o) => {
    o.geometry?.dispose();
    const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
    mats.forEach((m) => {
      for (const k of ["map", "alphaMap", "emissiveMap"]) m[k]?.dispose();
      m.dispose();
    });
  });
}

export const smooth = (a, b, x) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
