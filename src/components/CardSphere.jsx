import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useNavigate } from 'react-router-dom';
import { byId, sphereOrder } from '../data/projects.js';
import { buildKnot } from '../three/knot.js';
import { useInView } from '../hooks.js';

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
const LABEL_H = 74;
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
    await document.fonts.load('600 36px Fredoka');
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
  ctx.font = '600 36px Fredoka, "Segoe UI", sans-serif';
  ctx.textBaseline = 'middle';
  ctx.fillText(project.name, PAD + 6, PAD + IMG_H + LABEL_H / 2);
  ctx.fillStyle = '#e0613f';
  ctx.textAlign = 'right';
  ctx.fillText('↗', CARD_W - PAD - 6, PAD + IMG_H + LABEL_H / 2);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

function Sphere({ reduced, active, drag, hovered, setHovered }) {
  const navigate = useNavigate();
  const { camera, size } = useThree();
  const group = useRef();
  const knot = useMemo(() => buildKnot(), []);
  const glow = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d');
    const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grd.addColorStop(0, 'rgba(157,205,189,0.75)');
    grd.addColorStop(1, 'rgba(157,205,189,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, 128, 128);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, []);

  const [textures, setTextures] = useState([]);
  useEffect(() => {
    let alive = true;
    Promise.all(sphereOrder.map((id) => makeCardTexture(byId[id]))).then((t) => alive && setTextures(t));
    return () => {
      alive = false;
    };
  }, []);
  useEffect(() => () => textures.forEach((t) => t.dispose()), [textures]);

  const mobile = size.width < 700;
  const R = mobile ? 1.7 : 2.5;
  const cardW = mobile ? 1.5 : 1.6;
  const cardH = (cardW * CARD_H) / CARD_W;

  // Pull the camera back far enough that the whole sphere fits the canvas.
  useEffect(() => {
    const half = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const aspect = size.width / size.height;
    const needH = (R + cardH * 0.75) / half;
    const needW = (R + cardW * (mobile ? 0.5 : 0.7)) / (half * aspect);
    camera.position.set(0, 0, Math.max(needH, needW) + R * (mobile ? 0.1 : 0.25));
    camera.updateProjectionMatrix();
  }, [camera, size, R, cardW, cardH, mobile]);

  const cards = useRef([]);
  const state = useRef({ yaw: 0, pitch: -0.08, start: null });
  const tmp = useMemo(() => new THREE.Vector3(), []);
  const euler = useMemo(() => new THREE.Euler(), []);

  useFrame((s, delta) => {
    const dt = Math.min(delta, 1 / 20);
    const st = state.current;
    const d = drag.current;
    if (st.start === null && textures.length) st.start = s.clock.elapsedTime;

    // Rotation: follow the drag, keep a little momentum, then idle-spin when nobody is touching it.
    const focusIndex = active ? sphereOrder.indexOf(active) : -1;
    if (focusIndex >= 0) {
      // Keyboard focus: turn the sphere so that card faces the visitor.
      const p = POINTS[focusIndex];
      const targetYaw = -Math.atan2(p.x, p.z);
      const dyaw = Math.atan2(Math.sin(targetYaw - st.yaw), Math.cos(targetYaw - st.yaw));
      st.yaw += dyaw * Math.min(1, dt * 5);
      st.pitch += (Math.asin(p.y) * 0.8 - st.pitch) * Math.min(1, dt * 5);
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
    knot.rotation.y = THREE.MathUtils.degToRad(13) + s.clock.elapsedTime * (reduced ? 0 : 0.25);

    // Entrance: cards start stacked in the middle and deal out to their places.
    const since = st.start === null ? 0 : s.clock.elapsedTime - st.start;
    euler.set(st.pitch, st.yaw, 0, 'XYZ');
    cards.current.forEach((mesh, i) => {
      if (!mesh) return;
      const k = reduced ? 1 : THREE.MathUtils.clamp((since - i * 0.08) / 1.1, 0, 1);
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
      mesh.material.opacity = (0.45 + 0.55 * front) * Math.min(1, k * 3);
      mesh.renderOrder = isActive ? 10 : 0;
    });
  });

  return (
    <>
      <sprite scale={[R * 1.3, R * 1.3, 1]}>
        <spriteMaterial map={glow} transparent depthWrite={false} toneMapped={false} />
      </sprite>
      <group ref={group}>
        <primitive object={knot} scale={R * 0.32} />
        {textures.map((tex, i) => (
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
  const end = () => {
    const d = drag.current;
    d.down = false;
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
        <Sphere reduced={reduced} active={active} drag={drag} hovered={hovered} setHovered={setHovered} />
      </Canvas>
    </div>
  );
}
