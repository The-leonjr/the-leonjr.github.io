import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useNavigate } from 'react-router-dom';
import { byId, sphereOrder } from '../data/projects.js';
import { createAsciiOrb } from '../three/asciiOrb.js';
import { useInView } from '../hooks.js';
import { sphereStir } from '../stir.js';
import { params } from '../tune.js';

const CARD_W = 640;
const IMG_H = 342;
const PAD = 16;
const LABEL_H = 88;
const CARD_H = PAD + IMG_H + LABEL_H;

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// Draws a paper card (screenshot + name) onto a canvas and turns it into a texture.
async function makeCardTexture(project) {
  const img = new Image();
  img.src = project.cover;
  await img.decode();
  try {
    await document.fonts.load('600 46px Fredoka');
  } catch {
    /* fall back to the default font */
  }
  const c = document.createElement('canvas');
  c.width = CARD_W;
  c.height = CARD_H;
  const ctx = c.getContext('2d');
  roundRect(ctx, 1, 1, CARD_W - 2, CARD_H - 2, 14);
  ctx.fillStyle = '#f8f3e9';
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#c7bba7';
  ctx.stroke();

  const iw = CARD_W - PAD * 2;
  ctx.save();
  roundRect(ctx, PAD, PAD, iw, IMG_H, 8);
  ctx.clip();
  const scale = Math.max(iw / img.width, IMG_H / img.height);
  ctx.drawImage(img, PAD, PAD, img.width * scale, img.height * scale);
  ctx.restore();

  ctx.fillStyle = '#352b25';
  ctx.font = '600 46px Fredoka, "Segoe UI", sans-serif';
  ctx.textBaseline = 'middle';
  ctx.fillText(project.name, PAD + 6, PAD + IMG_H + LABEL_H / 2);
  ctx.fillStyle = '#f47a5a';
  ctx.textAlign = 'right';
  ctx.fillText('↗', CARD_W - PAD - 6, PAD + IMG_H + LABEL_H / 2);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

// ---------- The orb, the ring of cards, and how they move ----------

// Sizes in world units. The orb sits in the middle; the cards ride a tilted ring around it.
const ORB_R = 2.0;
const RING_R = 2.75; // front-to-back radius of the ring
const RING_RX = 2.45; // side-to-side radius: a little narrower, so side cards stay clear of the name
// The springy first turn: how far it swings and how bouncy it is.
const OPEN_TURN = 1.15; // radians
const SPRING = 38; // stiffness
const DAMPING = 8.5; // lower = more overshoot
const REVEAL_TIME = 0.95; // seconds for the cards to fan out
const FAR_TINT = new THREE.Color('#cdc4b6'); // cards going round the back fade toward this
const PATH_DOTS = 150; // dots in the orbit path
const X_AXIS = new THREE.Vector3(1, 0, 0);
const UP = new THREE.Vector3(0, 1, 0);

// Free orbits: each card's own little orbit (tilt, turn, speed, distance), spread out so they
// don't bump into each other.
const FREE = [
  [0.0, 0.0, 1.0, 1.0],
  [0.55, 0.9, 0.82, 1.08],
  [-0.45, 2.1, 1.15, 0.96],
  [0.3, 3.3, 0.9, 1.12],
  [-0.6, 4.2, 1.05, 1.02],
  [0.42, 5.3, 0.76, 0.94],
].map(([tilt, turn, speed, dist]) => ({
  q: new THREE.Quaternion().setFromEuler(new THREE.Euler(tilt, turn, 0, 'YXZ')),
  speed,
  dist,
}));

const ease = (k) => 1 - Math.pow(1 - k, 3);
const smooth = (k) => k * k * (3 - 2 * k);
const wrapAngle = (a) => Math.atan2(Math.sin(a), Math.cos(a));

// A card bent around the ring like a curved screen: its edges curve back toward the orb.
function curvedCard(w, h, bendRadius) {
  const g = new THREE.PlaneGeometry(w, h, 28, 1);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const a = p.getX(i) / bendRadius;
    p.setX(i, Math.sin(a) * bendRadius);
    p.setZ(i, (Math.cos(a) - 1) * bendRadius);
  }
  p.needsUpdate = true;
  g.computeVertexNormals();
  return g;
}

// The back of every card: plain cream paper with the site's star, like the back of a playing card.
function makeBackTexture() {
  const c = document.createElement('canvas');
  c.width = CARD_W;
  c.height = CARD_H;
  const ctx = c.getContext('2d');
  roundRect(ctx, 1, 1, CARD_W - 2, CARD_H - 2, 14);
  ctx.fillStyle = '#efe7d8';
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#c7bba7';
  ctx.stroke();
  roundRect(ctx, 22, 22, CARD_W - 44, CARD_H - 44, 10);
  ctx.strokeStyle = 'rgba(181,68,44,0.35)';
  ctx.stroke();
  ctx.fillStyle = '#e0613f';
  ctx.font = '120px "Segoe UI Symbol", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('✳', CARD_W / 2, CARD_H / 2 + 6);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// One character drawn into a small texture, for the dotted orbit path.
function glyphTexture(char) {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.font = '700 56px ui-monospace, Consolas, monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(char, 32, 34);
  return new THREE.CanvasTexture(c);
}

function Sphere({ reduced, active, drag, hovered, setHovered, wrap, onTurn, openRequest }) {
  const navigate = useNavigate();
  const { camera, size, gl } = useThree();
  // The centrepiece: a lit 3D orb with text characters on its surface.
  const orb = useMemo(() => createAsciiOrb(), []);
  useEffect(() => () => orb.dispose(), [orb]);
  const backTex = useMemo(() => makeBackTexture(), []);
  useEffect(() => () => backTex.dispose(), [backTex]);

  // The dotted orbit path: small dots with a "+" every so often, in the site's teal ink.
  const path = useMemo(() => {
    const make = (char, count, sizeWorld) => {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
      const mat = new THREE.PointsMaterial({
        map: glyphTexture(char),
        color: '#1f6b65',
        size: sizeWorld,
        transparent: true,
        depthWrite: false,
        alphaTest: 0.05,
      });
      return new THREE.Points(geo, mat);
    };
    const group = new THREE.Group();
    const dots = make('•', PATH_DOTS, 0.13);
    const marks = make('+', PATH_DOTS / 10, 0.3);
    group.add(dots, marks);
    return { group, dots, marks };
  }, []);
  useEffect(
    () => () => {
      [path.dots, path.marks].forEach((p) => {
        p.geometry.dispose();
        p.material.map.dispose();
        p.material.dispose();
      });
    },
    [path],
  );

  // Each card appears as soon as its own screenshot is ready, instead of waiting for all six.
  const [textures, setTextures] = useState([]);
  useEffect(() => {
    let alive = true;
    const made = [];
    sphereOrder.forEach((id, i) =>
      makeCardTexture(byId[id]).then((t) => {
        made.push(t);
        if (!alive) return t.dispose();
        setTextures((prev) => {
          const next = [...prev];
          next[i] = t;
          return next;
        });
      }),
    );
    return () => {
      alive = false;
      made.forEach((t) => t.dispose());
    };
  }, []);

  const mobile = size.width < 700;
  const cardW = mobile ? 1.75 : 1.45;
  const cardH = (cardW * CARD_H) / CARD_W;
  const slot = (Math.PI * 2) / sphereOrder.length;
  const geometry = useMemo(() => curvedCard(cardW, cardH, RING_R), [cardW, cardH]);
  useEffect(() => () => geometry.dispose(), [geometry]);

  // Pull the camera back so the orb is about two thirds of the hero's height and the ring fits.
  // On wider screens everything sits a little right of centre, clear of the name.
  useEffect(() => {
    const half = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const shift = mobile ? 0 : size.width * 0.12;
    const aspect = (size.width - shift * 2) / size.height;
    const short = !mobile && size.height < 780 ? 1.08 : 1;
    const needH = ((2 * ORB_R) / (2 * half * (mobile ? 0.56 : 0.66))) * short;
    const needW = (RING_RX + cardW * (mobile ? 0.25 : 0.5)) / (half * aspect);
    camera.position.set(0, 0, Math.max(needH, needW));
    if (shift) camera.setViewOffset(size.width, size.height, -shift, 0, size.width, size.height);
    else camera.clearViewOffset();
    camera.updateProjectionMatrix();
    orb.setCellSize(mobile ? 10 : 13);
  }, [camera, size, cardW, mobile, orb]);

  const cards = useRef([]);
  // phase: 'closed' (orb + SKIP orbiting), 'opening' (the springy first turn), 'open' (free to turn)
  const st = useRef({
    phase: 'closed',
    reveal: 0,
    theta: 0, // how far the cards have travelled round the ring
    omega: 0,
    target: 0,
    vel: 0, // spin momentum
    tipVel: 0, // tip momentum
    sys: new THREE.Quaternion(), // the whole orb-and-ring's tip, from dragging up and down
    last: 0,
    lastInput: 0,
    free: 0, // 0 = on the ring, 1 = drifting on their own orbits
    freeT: 0,
  });
  const v = useMemo(
    () => ({
      ringQ: new THREE.Quaternion(),
      ringEuler: new THREE.Euler(),
      worldQ: new THREE.Quaternion(),
      tmpQ: new THREE.Quaternion(),
      identity: new THREE.Quaternion(),
      orbQ: new THREE.Quaternion(),
      orbEuler: new THREE.Euler(),
      a: new THREE.Vector3(),
      b: new THREE.Vector3(),
      out: new THREE.Vector3(),
      sysUp: new THREE.Vector3(),
      tint: new THREE.Color(),
      white: new THREE.Color('#ffffff'),
    }),
    [],
  );

  const open = (dir) => {
    const s = st.current;
    if (s.phase !== 'closed') return;
    onTurn?.();
    if (reduced) {
      s.phase = 'open';
      s.reveal = 1;
      return;
    }
    s.phase = 'opening';
    s.target = s.theta + dir * OPEN_TURN;
    s.omega = dir * 1.5; // a little push, like the swipe that started it
  };
  // Opening can also be asked for from outside (keyboard focus on a project link).
  useEffect(() => {
    if (openRequest) open(params.spinDir >= 0 ? 1 : -1);
  }, [openRequest]); // eslint-disable-line react-hooks/exhaustive-deps

  useFrame((state, delta) => {
    const dt = Math.min(delta, 1 / 20);
    const frames = dt * 60;
    const t = state.clock.elapsedTime;
    const s = st.current;
    const d = drag.current;
    const dir = params.spinDir >= 0 ? 1 : -1; // which way the first turn and the fan-out go
    const focus = active ? sphereOrder.indexOf(active) : -1;

    if (s.phase === 'closed') {
      // Before anyone touches it, SKIP travels slowly round the orb on its own.
      if (!reduced) s.theta += dt * params.restSpin * dir;
      // The first real drag sets off the spring; the orb finishes the turn for you.
      // (`started` stays set until a frame handles it, so even a very quick flick counts.)
      if (d.started) {
        d.started = false;
        open(dir);
      }
      d.dx = d.dy = 0;
    } else if (s.phase === 'opening') {
      s.reveal = Math.min(1, s.reveal + dt / REVEAL_TIME);
      const acc = SPRING * (s.target - s.theta) - DAMPING * s.omega;
      s.omega += acc * dt;
      s.theta += s.omega * dt;
      d.dx = d.dy = 0;
      if (s.reveal >= 1 && Math.abs(s.target - s.theta) < 0.004 && Math.abs(s.omega) < 0.02) {
        s.phase = 'open';
        s.vel = 0;
        s.lastInput = t;
      }
    } else if (focus >= 0) {
      // Keyboard focus: stand it upright and turn the ring until that card is at the front.
      const goal = s.theta + wrapAngle(-dir * focus * slot - s.theta);
      s.theta += (goal - s.theta) * Math.min(1, dt * 5);
      s.sys.slerp(v.identity, Math.min(1, dt * 4));
      s.lastInput = t;
    } else if (d.down) {
      // Dragging sideways spins the ring; dragging up or down tips the whole orb and ring.
      s.theta += d.dx * 0.006;
      s.vel = d.dx * 0.006;
      s.tipVel = d.dy * 0.005;
      s.sys.premultiply(v.tmpQ.setFromAxisAngle(X_AXIS, s.tipVel));
      d.dx = d.dy = 0;
      s.lastInput = t;
    } else {
      // Let go: keep a little momentum, idle-spin, and slowly tip back upright.
      s.theta += s.vel;
      s.vel *= Math.pow(0.93, frames);
      s.sys.premultiply(v.tmpQ.setFromAxisAngle(X_AXIS, s.tipVel));
      s.tipVel *= Math.pow(0.9, frames);
      if (!reduced && hovered === null) s.theta += dt * 0.12 * dir;
      if (params.settle > 0) s.sys.slerp(v.identity, 1 - Math.pow(1 - params.settle, frames));
    }

    // Free orbits (optional, ?tune): after a pause the cards drift off the ring; any touch calls them back.
    const wantFree =
      params.freeOrbit >= 0.5 && s.phase === 'open' && !d.down && focus < 0 && t - s.lastInput > params.freeDelay;
    s.free += ((wantFree ? 1 : 0) - s.free) * (1 - Math.exp(-dt * (wantFree ? 0.7 : 3)));
    if (s.free > 0.001) s.freeT += dt * 0.25;
    const f = smooth(Math.min(1, s.free));

    // The ring's tilt and lean come from the ?tune panel; the whole thing is then tipped by dragging.
    v.ringQ.setFromEuler(v.ringEuler.set(params.ringTilt, 0, params.ringLean, 'XYZ'));
    v.worldQ.copy(s.sys).multiply(v.ringQ);
    v.sysUp.copy(UP).applyQuaternion(v.worldQ);

    // The orb turns with the ring, slowly on its own, and tips with it.
    orb.mesh.scale.setScalar(ORB_R);
    v.orbQ.setFromEuler(v.orbEuler.set(0.22, s.theta * 0.8 + (reduced ? 0 : t * 0.08), 0.12));
    orb.mesh.quaternion.copy(s.sys).multiply(v.orbQ);

    // Place the cards. While closed, the others wait inside the orb behind SKIP; opening fans them
    // out along the ring.
    const e = ease(s.reveal);
    cards.current.forEach((group, i) => {
      if (!group) return;
      const a = s.theta + dir * i * slot * e;
      const grow = i === 0 ? 1 : 0.62 + 0.38 * e; // others rise out of the orb as they fan out
      v.a.set(Math.sin(a) * RING_RX * grow, 0, Math.cos(a) * RING_R * grow).applyQuaternion(v.worldQ);
      if (f > 0) {
        const o = FREE[i];
        const b = a + s.freeT * o.speed * dir;
        v.b.set(Math.sin(b), 0, Math.cos(b)).multiplyScalar(RING_R * o.dist).applyQuaternion(o.q).applyQuaternion(s.sys);
        v.a.lerp(v.b, f);
      }
      group.position.copy(v.a);
      // Cards stand upright (relative to the orb's tip) and face straight out from it, turning only
      // like a door on a hinge. Out front they face you; at the sides they go edge-on; round the
      // back you see the card's back.
      v.out.copy(v.a).addScaledVector(v.sysUp, -v.a.dot(v.sysUp)).normalize();
      group.up.copy(v.sysUp);
      group.lookAt(v.a.x + v.out.x, v.a.y + v.out.y, v.a.z + v.out.z);
      const isActive = s.phase === 'open' && (sphereOrder[i] === hovered || sphereOrder[i] === active);
      const target = (i === 0 ? 1 : 0.6 + 0.4 * e) * (isActive ? 1.1 : 1);
      group.scale.setScalar(group.scale.x + (target - group.scale.x) * Math.min(1, dt * 10));
      // Farther round the back = a little dimmer, like it's in the orb's shade. No see-through.
      v.tint.copy(v.white).lerp(FAR_TINT, (1 - (v.out.z + 1) / 2) * 0.7);
      group.children.forEach((m) => m.material.color.copy(v.tint));
      group.visible = i === 0 || e > 0.001;
      // Each card casts a soft shadow onto the orb's surface.
      orb.setShadow(i, group.position, group.visible ? (i === 0 ? 1 : e) : 0);
    });

    // The dotted orbit path travels with the cards, and fades while they drift off on their own.
    const pos = path.dots.geometry.attributes.position;
    const marks = path.marks.geometry.attributes.position;
    for (let k = 0; k < PATH_DOTS; k++) {
      const a = s.theta + (k / PATH_DOTS) * Math.PI * 2;
      pos.setXYZ(k, Math.sin(a) * RING_RX, 0, Math.cos(a) * RING_R);
      if (k % 10 === 5) marks.setXYZ(k / 10 - 0.5, Math.sin(a) * RING_RX, 0, Math.cos(a) * RING_R);
    }
    pos.needsUpdate = true;
    marks.needsUpdate = true;
    path.group.quaternion.copy(v.worldQ);
    const pathAlpha = params.orbitPath * (1 - f * 0.8);
    path.dots.material.opacity = pathAlpha;
    path.marks.material.opacity = pathAlpha * 0.9;
    path.group.visible = pathAlpha > 0.01;

    const radiusPx = orb.update(gl, camera, t);

    // Tell the water how fast the orb's surface is moving (see src/stir.js).
    const box = wrap.current?.getBoundingClientRect();
    if (box) {
      const shift = camera.view?.enabled ? -camera.view.offsetX : 0;
      sphereStir.x = box.left + size.width / 2 + shift;
      sphereStir.y = box.top + size.height / 2;
      sphereStir.radius = radiusPx;
      sphereStir.dx = (s.theta - s.last) * radiusPx;
      sphereStir.dy = s.tipVel * radiusPx;
      sphereStir.live = true;
    }
    s.last = s.theta;
  });

  return (
    <>
      <primitive
        object={orb.group}
        onClick={(ev) => {
          // Tapping the orb (not a card) also opens it, for phones and anyone who doesn't drag.
          if (ev.object !== orb.mesh) return;
          ev.stopPropagation();
          open(params.spinDir >= 0 ? 1 : -1);
        }}
      />
      <primitive object={path.group} />
      {textures.map(
        (tex, i) =>
          tex && (
            <group key={sphereOrder[i]} ref={(g) => (cards.current[i] = g)} scale={i === 0 ? 1 : 0.6}>
              <mesh
                geometry={geometry}
                onPointerOver={(ev) => {
                  if (!ev.object.parent.visible) return;
                  ev.stopPropagation();
                  setHovered(sphereOrder[i]);
                }}
                onPointerOut={() => setHovered(null)}
                onClick={(ev) => {
                  ev.stopPropagation();
                  if (drag.current.moved) return;
                  if (st.current.phase === 'closed' && i !== 0) return;
                  navigate(`/work/${sphereOrder[i]}`);
                }}
              >
                <meshBasicMaterial map={tex} alphaTest={0.5} toneMapped={false} side={THREE.FrontSide} />
              </mesh>
              <mesh geometry={geometry}>
                <meshBasicMaterial map={backTex} alphaTest={0.5} toneMapped={false} side={THREE.BackSide} />
              </mesh>
            </group>
          ),
      )}
    </>
  );
}

export default function CardSphere({ reduced, active, onTurn }) {
  const wrap = useRef(null);
  const inView = useInView(wrap);
  const [hovered, setHovered] = useState(null);
  const drag = useRef({ down: false, moved: false, x: 0, y: 0, dx: 0, dy: 0, lastDx: 0, total: 0 });
  useEffect(() => {
    sphereStir.live = inView;
  }, [inView]);

  useEffect(() => {
    document.body.style.cursor = hovered ? 'pointer' : '';
    return () => {
      document.body.style.cursor = '';
    };
  }, [hovered]);

  const onPointerDown = (e) => {
    Object.assign(drag.current, { down: true, moved: false, x: e.clientX, y: e.clientY, dx: 0, dy: 0, total: 0 });
  };
  const onPointerMove = (e) => {
    const d = drag.current;
    if (!d.down) return;
    const mx = e.clientX - d.x;
    const my = e.clientY - d.y;
    d.x = e.clientX;
    d.y = e.clientY;
    d.total += Math.abs(mx) + Math.abs(my);
    if (mx) d.lastDx = mx;
    if (d.total > 6) {
      if (!d.moved) d.started = true;
      d.moved = true;
      wrap.current.classList.add('dragging');
    }
    d.dx += mx;
    d.dy += my;
  };
  const end = (e) => {
    const d = drag.current;
    d.down = false;
    // Touch has no "pointer out", so clear the highlighted card when the finger lifts.
    if (e?.pointerType && e.pointerType !== 'mouse') setHovered(null);
    wrap.current?.classList.remove('dragging');
    setTimeout(() => (d.moved = false), 0);
  };

  return (
    <div
      ref={wrap}
      className="sphere"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={end}
      onPointerCancel={end}
      onPointerLeave={end}
    >
      <Canvas
        flat
        dpr={[1, 2]}
        frameloop={inView ? 'always' : 'never'}
        camera={{ fov: 32, position: [0, 0, 12] }}
        gl={{ alpha: true, antialias: true }}
        aria-hidden="true"
      >
        <Sphere
          reduced={reduced}
          active={active}
          drag={drag}
          hovered={hovered}
          setHovered={setHovered}
          wrap={wrap}
          onTurn={onTurn}
          openRequest={!!active}
        />
      </Canvas>
    </div>
  );
}
