import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { createAsciiOrb } from '../three/asciiOrb.js';
import { useReducedMotion } from '../hooks.js';

// The homepage orb on its own, for About and the 404 page. It turns slowly and leans toward the mouse.
export default function AsciiOrb({ dropped = false, label }) {
  const host = useRef(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    const el = host.current;
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: false });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    el.appendChild(renderer.domElement);

    const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 50);
    camera.position.set(0, 0, 6);
    const orb = createAsciiOrb();
    orb.mesh.scale.setScalar(dropped ? 1.05 : 1.25);
    if (dropped) orb.mesh.position.set(0.35, -0.55, 0);

    const resize = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      orb.setLayout(w, h, 9);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(el);

    const mouse = { x: 0, y: 0 };
    const onMove = (e) => {
      mouse.x = e.clientX / innerWidth - 0.5;
      mouse.y = e.clientY / innerHeight - 0.5;
    };
    addEventListener('pointermove', onMove, { passive: true });

    let visible = false;
    const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting));
    io.observe(el);

    const clock = new THREE.Clock();
    const draw = () => {
      const t = clock.getElapsedTime();
      orb.mesh.rotation.set(0.35 + mouse.y * 0.5, (reduced ? 0.6 : t * 0.25) + mouse.x * 0.8, dropped ? 0.5 : 0.18);
      renderer.setRenderTarget(null);
      renderer.clear();
      orb.render(renderer, camera, reduced ? 2 : t);
    };
    let raf;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      if (visible) draw();
    };
    if (reduced) draw();
    else loop();

    return () => {
      cancelAnimationFrame(raf);
      removeEventListener('pointermove', onMove);
      io.disconnect();
      ro.disconnect();
      orb.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      el.removeChild(renderer.domElement);
    };
  }, [dropped, reduced]);

  return <div ref={host} className="ascii-orb" role="img" aria-label={label} />;
}
