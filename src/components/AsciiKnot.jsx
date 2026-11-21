import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { AsciiEffect } from 'three/examples/jsm/effects/AsciiEffect.js';
import { buildKnot } from '../three/knot.js';
import { useReducedMotion } from '../hooks.js';

// The homepage knot, rendered with three.js and redrawn as text characters.
export default function AsciiKnot({ tipped = false, label }) {
  const host = useRef(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    const el = host.current;
    const renderer = new THREE.WebGLRenderer({ antialias: false });
    const effect = new AsciiEffect(renderer, ' .:-+*=%@#', { invert: true, resolution: 0.16 });
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 50);
    camera.position.set(0, 0, 6);

    scene.add(new THREE.AmbientLight('#ffffff', 0.35));
    const key = new THREE.DirectionalLight('#ffffff', 2.4);
    key.position.set(2, 3, 4);
    scene.add(key);

    const knot = buildKnot({ lit: true });
    knot.scale.setScalar(1.15);
    if (tipped) {
      knot.rotation.z = 1.25;
      knot.scale.setScalar(1.0);
    }
    scene.add(knot);

    const s = effect.domElement.style;
    s.color = '#1f6b65';
    s.backgroundColor = 'transparent';
    el.appendChild(effect.domElement);

    const resize = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      effect.setSize(w, h);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(el);

    // Turn toward the mouse, a little.
    const mouse = { x: 0, y: 0 };
    const onMove = (e) => {
      mouse.x = e.clientX / innerWidth - 0.5;
      mouse.y = e.clientY / innerHeight - 0.5;
    };
    addEventListener('pointermove', onMove, { passive: true });

    let visible = false;
    const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting));
    io.observe(el);

    let raf;
    const clock = new THREE.Clock();
    const loop = () => {
      raf = requestAnimationFrame(loop);
      if (!visible) return;
      const t = clock.getElapsedTime();
      knot.rotation.y = (reduced ? 0.4 : t * 0.35) + mouse.x * 0.8;
      knot.rotation.x = -0.33 + mouse.y * 0.6;
      effect.render(scene, camera);
    };
    if (reduced) {
      visible = true;
      loop();
      cancelAnimationFrame(raf);
    } else {
      loop();
    }

    return () => {
      cancelAnimationFrame(raf);
      removeEventListener('pointermove', onMove);
      io.disconnect();
      ro.disconnect();
      el.removeChild(effect.domElement);
      renderer.dispose();
      renderer.forceContextLoss();
    };
  }, [tipped, reduced]);

  return <div ref={host} className="ascii-knot" role="img" aria-label={label} />;
}
