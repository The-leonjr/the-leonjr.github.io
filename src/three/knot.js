import * as THREE from 'three';

// The three-band knot from the original site, rebuilt in 3D.
// Each band is a thin ring turned the same way the old CSS turned it.
const BANDS = [
  { color: '#528b7e', rot: [63, 0, 0] },
  { color: '#ac9161', rot: [0, 65, 24] },
  { color: '#76a999', rot: [0, -35, -33] },
];

const deg = THREE.MathUtils.degToRad;

/**
 * @param {object} opts
 * @param {boolean} opts.lit  true = shaded materials (for the ASCII version), false = flat colours
 */
export function buildKnot({ lit = false } = {}) {
  const make = (color, extra = {}) =>
    lit
      ? new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.05, ...extra })
      : new THREE.MeshBasicMaterial({ color, toneMapped: false, ...extra });

  const knot = new THREE.Group();
  const ring = new THREE.TorusGeometry(1, 0.06, 16, 120);
  const inner = new THREE.TorusGeometry(0.93, 0.012, 8, 120);
  const bead = new THREE.SphereGeometry(0.075, 20, 16);
  const smallBead = new THREE.SphereGeometry(0.055, 20, 16);

  for (const band of BANDS) {
    const g = new THREE.Group();
    g.rotation.set(deg(band.rot[0]), deg(band.rot[1]), deg(band.rot[2]), 'YZX');
    g.add(new THREE.Mesh(ring, make(band.color)));
    if (!lit) g.add(new THREE.Mesh(inner, make('#d7ead9', { transparent: true, opacity: 0.7 })));
    const top = new THREE.Mesh(bead, make('#cee1c7'));
    top.position.set(0, 1, 0);
    const bottom = new THREE.Mesh(smallBead, make('#d5ba87'));
    bottom.position.set(0, -1, 0);
    g.add(top, bottom);
    knot.add(g);
  }

  // The resting tilt of the original knot.
  knot.rotation.set(deg(-19), deg(13), deg(-12));
  return knot;
}
