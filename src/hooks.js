import { useEffect, useState } from 'react';

export function useReducedMotion() {
  const query = '(prefers-reduced-motion: reduce)';
  const [reduced, setReduced] = useState(() => matchMedia(query).matches);
  useEffect(() => {
    const mq = matchMedia(query);
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return reduced;
}

let webglSupport;
export function hasWebGL() {
  if (webglSupport === undefined) {
    try {
      const c = document.createElement('canvas');
      const gl = c.getContext('webgl2') || c.getContext('webgl');
      webglSupport = !!gl;
      gl?.getExtension('WEBGL_lose_context')?.loseContext(); // give the test context back
    } catch {
      webglSupport = false;
    }
  }
  return webglSupport;
}

// True while the element is on screen, so 3D scenes can pause when scrolled away.
export function useInView(ref, rootMargin = '100px') {
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { rootMargin });
    io.observe(el);
    return () => io.disconnect();
  }, [ref, rootMargin]);
  return inView;
}
