import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useNavigate } from 'react-router-dom';
import { byId, sphereOrder } from '../data/projects.js';
import { createAsciiOrb } from '../three/asciiOrb.js';
import { useInView } from '../hooks.js';
import { sphereStir } from '../stir.js';

// Where each card sits on the sphere (before any rotation). The first three face the visitor.
const POINTS = [
  [0.0, -0.5, 0.87], // memematch, front and slightly low
  [-0.78, 0.05, 0.62], // skip, front left
  [0.78, 0.12, 0.6], // analysets, front right
  [-0.45, 0.72, -0.52], // aurafarm, back
  [0.5, 0.68, -0.53], // salarycalc, back
  [0.1, -0.2, -0.97], // animal adoption, back
].map(([x, y, z]) => new THREE.Vector3(x, y, z).normalize());

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

function Sphere({ reduced, active, drag, hovered, setHovered, wrap }) {
  const navigate = useNavigate();
  const { camera, size } = useThree();
  const group = useRef();
  // The centrepiece: a lit 3D orb drawn in text characters.
  const orb = useMemo(() => createAsciiOrb(), []);
  useEffect(() => () => orb.dispose(), [orb]);

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
  const R = mobile ? 1.7 : 2.5;
  const cardW = mobile ? 1.6 : 1.6;
  const cardH = (cardW * CARD_H) / CARD_W;

  // Pull the camera back far enough that the whole sphere fits the canvas. On wider screens the
  // sphere sits a little right of centre so it doesn't run into the name in the bottom-left corner.
  useEffect(() => {
    const half = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const shift = mobile ? 0 : size.width * 0.07;
    const aspect = (size.width - shift * 2) / size.height;
    const short = !mobile && size.height < 780 ? 1.1 : 1;
    const needH = ((R + cardH * 0.75) / half) * short;
    const needW = (R + cardW * (mobile ? 0.45 : 0.7)) / (half * aspect);
    camera.position.set(0, 0, Math.max(needH, needW) + R * (mobile ? 0.1 : 0.25));
    if (shift) camera.setViewOffset(size.width, size.height, -shift, 0, size.width, size.height);
    else camera.clearViewOffset();
    camera.updateProjectionMatrix();
    orb.setLayout(size.width, size.height, mobile ? 8 : 10);
  }, [camera, size, R, cardW, cardH, mobile, orb]);

  const cards = useRef([]);
  const state = useRef({ yaw: 0, pitch: -0.08, lastYaw: 0, lastPitch: 0 });
  const born = useRef([]);
  const tmp = useMemo(() => new THREE.Vector3(), []);
  const euler = useMemo(() => new THREE.Euler(), []);

  // Priority 1 means this function draws the frame itself (in three passes, see the end).
  useFrame((s, delta) => {
    const dt = Math.min(delta, 1 / 20);
    const st = state.current;
    const d = drag.current;

    // Rotation: follow the drag, keep a little momentum, then idle-spin when nobody is touching it.
    const focusIndex = active ? sphereOrder.indexOf(active) : -1;
    if (focusIndex >= 0) {
      // Keyboard focus: turn the sphere so that card faces the visitor.
      const p = POINTS[focusIndex];
      const targetYaw = Math.atan2(-p.x, p.z);
      const targetPitch = Math.atan2(p.y, Math.hypot(p.x, p.z));
      const dyaw = Math.atan2(Math.sin(targetYaw - st.yaw), Math.cos(targetYaw - st.yaw));
      st.yaw += dyaw * Math.min(1, dt * 5);
      st.pitch += (targetPitch - st.pitch) * Math.min(1, dt * 5);
    } else if (d.down) {
      st.yaw += d.dx;
      st.pitch = THREE.MathUtils.clamp(st.pitch + d.dy, -0.7, 0.7);
      d.vx = d.dx;
      d.dx = d.dy = 0;
    } else {
      st.yaw += d.vx;
      d.vx *= Math.pow(0.92, dt * 60);
      if (!reduced && hovered === null) st.yaw += dt * 0.12;
      st.pitch += (-0.08 - st.pitch) * Math.min(1, dt * 0.6);
    }

    group.current.rotation.set(st.pitch, st.yaw, 0, 'XYZ');

    // Tell the water where the sphere is and how fast its surface is moving, so it can drag the
    // water around with it (see src/stir.js).
    const box = wrap.current?.getBoundingClientRect();
    if (box) {
      const half = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
      const radiusPx = (R / (camera.position.z * half)) * (size.height / 2);
      const shift = camera.view?.enabled ? -camera.view.offsetX : 0;
      sphereStir.x = box.left + size.width / 2 + shift;
      sphereStir.y = box.top + size.height / 2;
      sphereStir.radius = radiusPx;
      sphereStir.dx = (st.yaw - st.lastYaw) * radiusPx;
      sphereStir.dy = (st.pitch - st.lastPitch) * radiusPx;
      sphereStir.live = true;
    }
    st.lastYaw = st.yaw;
    st.lastPitch = st.pitch;
    // The orb spins on its own and leans with the sphere when you drag it.
    orb.mesh.scale.setScalar(R * 0.62);
    orb.mesh.rotation.set(0.35 + st.pitch * 0.6, (reduced ? 0 : s.clock.elapsedTime * 0.22) + st.yaw * 0.6, 0.18);

    // Entrance: each card starts in the middle and deals out to its place once its image is ready.
    euler.set(st.pitch, st.yaw, 0, 'XYZ');
    cards.current.forEach((mesh, i) => {
      if (!mesh) return;
      if (born.current[i] === undefined) born.current[i] = s.clock.elapsedTime + i * 0.06;
      const since = s.clock.elapsedTime - born.current[i];
      const k = reduced ? 1 : THREE.MathUtils.clamp(since / 1.1, 0, 1);
      const ease = 1 - Math.pow(1 - k, 3);
      mesh.position.copy(POINTS[i]).multiplyScalar(R * ease);
      // Cards always face the camera so the screenshots stay readable.
      mesh.quaternion.copy(group.current.quaternion).invert().multiply(camera.quaternion);
      tmp.copy(POINTS[i]).applyEuler(euler);
      const front = (tmp.z + 1) / 2;
      const isActive = sphereOrder[i] === hovered || sphereOrder[i] === active;
      const target = (isActive ? 1.28 : 1) * (0.25 + 0.75 * ease);
      const sc = mesh.scale.x + (target - mesh.scale.x) * Math.min(1, dt * 10);
      mesh.scale.setScalar(sc);
      mesh.material.opacity = (0.6 + 0.4 * front) * Math.min(1, k * 3);
      mesh.renderOrder = isActive ? 10 : 0;
      mesh.userData.front = tmp.z > 0;
    });

    // Draw: cards behind the orb, then the ASCII orb, then the cards in front of it.
    const gl = s.gl;
    const meshes = cards.current.filter(Boolean);
    gl.autoClear = false;
    gl.setRenderTarget(null);
    gl.clear();
    meshes.forEach((m) => (m.visible = !m.userData.front));
    gl.render(s.scene, camera);
    orb.render(gl, camera, s.clock.elapsedTime);
    gl.clearDepth();
    meshes.forEach((m) => (m.visible = m.userData.front));
    gl.render(s.scene, camera);
    meshes.forEach((m) => (m.visible = true));
  }, 1);

  return (
    <>
      <group ref={group}>
        {textures.map((tex, i) => tex && (
          <mesh
            key={sphereOrder[i]}
            ref={(m) => (cards.current[i] = m)}
            scale={0.25}
            onPointerOver={(e) => {
              e.stopPropagation();
              setHovered(sphereOrder[i]);
            }}
            onPointerOut={() => setHovered(null)}
            onClick={(e) => {
              e.stopPropagation();
              if (drag.current.moved) return;
              navigate(`/work/${sphereOrder[i]}`);
            }}
          >
            <planeGeometry args={[cardW, cardH]} />
            <meshBasicMaterial map={tex} transparent toneMapped={false} />
          </mesh>
        ))}
      </group>
    </>
  );
}

export default function CardSphere({ reduced, active }) {
  const wrap = useRef(null);
  const inView = useInView(wrap);
  const [hovered, setHovered] = useState(null);
  const drag = useRef({ down: false, moved: false, x: 0, y: 0, dx: 0, dy: 0, vx: 0 });
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
    const d = drag.current;
    Object.assign(d, { down: true, moved: false, x: e.clientX, y: e.clientY, dx: 0, dy: 0, vx: 0, total: 0 });
  };
  const onPointerMove = (e) => {
    const d = drag.current;
    if (!d.down) return;
    const mx = e.clientX - d.x;
    const my = e.clientY - d.y;
    d.x = e.clientX;
    d.y = e.clientY;
    d.total += Math.abs(mx) + Math.abs(my);
    if (d.total > 6) {
      d.moved = true;
      wrap.current.classList.add('dragging');
    }
    d.dx += mx * 0.006;
    d.dy += my * 0.004;
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
        <Sphere reduced={reduced} active={active} drag={drag} hovered={hovered} setHovered={setHovered} wrap={wrap} />
      </Canvas>
    </div>
  );
}
