import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { ShaderGradientCanvas, ShaderGradient } from '@shadergradient/react';
import { useInView } from '../hooks.js';

// How it works, in three layers:
// 1. ShaderGradient draws the slow, flowing water shapes. Its three colours are set to pure red,
//    green and blue so its output tells us how much of each "slot" is at every pixel.
// 2. A dye layer turns those slots into watercolour: green on the left, rose and plum on the right,
//    with a wobbly border where the two swim around each other.
// 3. The cursor stirs a velocity field. The dye is carried along by it (dragged, not pushed away),
//    then slowly relaxes back to the flowing base.

// Colour slots per side: [main pigment, light wash, deep pigment]. No blue, no orange.
const LEFT = ['#5fcca6', '#cfeadf', '#23897b'];
const RIGHT = ['#e5618a', '#efbccb', '#863170'];

// Raw sRGB values: this canvas writes colours straight to the screen with no conversion.
const hex = (h) => new THREE.Vector3(...[1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255));
const PAPER = hex('#f4f0e7');

// Feel. Lower RELAX = the dragged colour lingers longer before settling back.
const MIN_WATER = 0.1; // the water never thins below this, so it is always there
const RELAX = 0.008; // per frame at 60fps: about 2 seconds to half-settle, 6+ to settle fully
const DRAG = 1.1; // how far colour travels with the cursor
const FRAY = 2.6; // how much the dragged colour frays into wispy tendrils
const VEL_DECAY = 0.965; // how long the cursor's stir keeps moving the water
const STIR_RADIUS = 0.055; // width of the stroke the cursor leaves
const CURSOR_LAG = 0.08; // lower = the stir point trails further behind the cursor

const quadVert = /* glsl */ `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

const noiseGLSL = /* glsl */ `
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + 1.0), f.x), f.y);
  }
`;

// Velocity field: the cursor adds its motion, the field carries itself along and fades.
// .z keeps a slower-fading "wet" record of where the cursor has been, used to darken the trail.
const velFrag = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D uPrev;
  uniform vec2 uMouse;
  uniform vec2 uVel;
  uniform float uAspect;
  uniform float uDecay;
  uniform float uRadius;
  void main() {
    vec4 here = texture2D(uPrev, vUv);
    vec4 prev = texture2D(uPrev, vUv - here.xy * 0.5);
    vec2 d = vUv - uMouse;
    d.x *= uAspect;
    float g = exp(-dot(d, d) / (uRadius * uRadius));
    vec2 v = prev.xy * uDecay + uVel * g;
    // Small eddies curl off both edges of the stroke, spinning opposite ways, like a real wake.
    float ring = exp(-dot(d, d) / (uRadius * uRadius * 4.0)) - g;
    float spin = sign(uVel.x * d.y - uVel.y * d.x);
    vec2 around = normalize(vec2(-d.y, d.x) + 1e-5);
    v += around * spin * ring * length(uVel) * 0.9;
    float wet = max(prev.z * 0.993, g * clamp(length(uVel) * 60.0, 0.0, 1.0));
    gl_FragColor = vec4(clamp(v, -0.05, 0.05), wet, 1.0);
  }
`;

// Dye: carried along by the velocity, relaxing toward the flowing base colour.
const dyeFrag = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D uDye;
  uniform sampler2D uVel;
  uniform sampler2D uGrad;
  uniform float uTime;
  uniform float uRelax;
  uniform float uDrag;
  uniform float uMin;
  uniform float uFray;
  uniform vec2 uTexel;
  uniform vec3 uL1, uL2, uL3, uR1, uR2, uR3;
  ${noiseGLSL}
  void main() {
    vec2 v = texture2D(uVel, vUv).xy;
    // Where the water is moving, a fine noise frays the colour into wisps, like ink in water.
    float speed = length(v);
    vec2 wisp = vec2(noise(vUv * 26.0 + uTime * 0.4), noise(vUv * 26.0 + 11.0 - uTime * 0.4)) - 0.5;
    vec4 carried = texture2D(uDye, vUv - v * uDrag - wisp * speed * uFray);

    // ShaderGradient's output as weights for the three colour slots (lightly blurred to stay smooth).
    vec2 t = uTexel * 2.0;
    vec3 g = texture2D(uGrad, vUv).rgb * 0.36
      + (texture2D(uGrad, vUv + vec2(t.x, 0.0)).rgb + texture2D(uGrad, vUv - vec2(t.x, 0.0)).rgb
      + texture2D(uGrad, vUv + vec2(0.0, t.y)).rgb + texture2D(uGrad, vUv - vec2(0.0, t.y)).rgb) * 0.16;
    g = max(g, 0.0);
    vec3 w = g / max(g.r + g.g + g.b, 0.001);

    // Left is green, right is rose and plum. The border wanders so the two swim around each other.
    float wobble = (noise(vec2(vUv.y * 2.2, uTime * 0.05)) - 0.5) * 0.34
                 + (noise(vec2(vUv.y * 6.0 + 4.0, uTime * 0.09)) - 0.5) * 0.1;
    float side = smoothstep(0.36, 0.64, vUv.x + wobble);
    vec3 c1 = mix(uL1, uR1, side);
    vec3 c2 = mix(uL2, uR2, side);
    vec3 c3 = mix(uL3, uR3, side);
    vec3 pigment = w.r * c1 + w.g * c2 + w.b * c3;
    // The rose side is naturally paler, so it gets a little more pigment to stay as strong as the green.
    float amount = mix(uMin + side * 0.08, 0.9, clamp(w.r * 0.85 + w.b * 1.15 + side * 0.12, 0.0, 1.0));

    gl_FragColor = mix(carried, vec4(pigment, amount), uRelax);
  }
`;

// Final picture: the dye painted onto paper, with wet edges, a darker trail and paper grain.
const compFrag = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D uDye;
  uniform sampler2D uVel;
  uniform vec3 uPaper;
  uniform vec2 uRes;
  uniform float uTime;
  ${noiseGLSL}
  void main() {
    vec2 h = 1.0 / uRes;
    vec4 d = texture2D(uDye, vUv) * 0.5
      + (texture2D(uDye, vUv + vec2(h.x, h.y)) + texture2D(uDye, vUv - vec2(h.x, h.y))
      + texture2D(uDye, vUv + vec2(h.x, -h.y)) + texture2D(uDye, vUv - vec2(h.x, -h.y))) * 0.125;
    float wet = texture2D(uVel, vUv).z;

    // The trail reads as a heavier, wetter stroke of the same colour.
    float amount = clamp(d.a + wet * 0.3, 0.0, 1.0);
    vec3 col = mix(uPaper, d.rgb, amount * 0.94);

    // Wet edges: pigment collects where the wash changes.
    vec2 px = 4.0 / uRes;
    float ax = texture2D(uDye, vUv + vec2(px.x, 0.0)).a;
    float ay = texture2D(uDye, vUv + vec2(0.0, px.y)).a;
    float edge = clamp(length(vec2(ax - d.a, ay - d.a)) * 10.0, 0.0, 1.0);
    col = mix(col, col * 0.76, edge * amount);

    // Granulation inside the pigment, plus a little paper tooth everywhere.
    float gran = noise(gl_FragCoord.xy * 0.3) * noise(gl_FragCoord.xy * 0.07 + 3.0);
    col *= 1.0 - gran * 0.12 * amount;
    col += (hash(gl_FragCoord.xy + fract(uTime)) - 0.5) * 0.018;

    // Only the last strip fades to paper, so the hero runs straight into the page.
    col = mix(uPaper, col, smoothstep(0.0, 0.08, vUv.y));
    gl_FragColor = vec4(col, 1.0);
  }
`;

function target(w, h) {
  return new THREE.WebGLRenderTarget(w, h, {
    type: THREE.HalfFloatType,
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    depthBuffer: false,
  });
}

function WaterPass({ reduced, pointer }) {
  const { gl, scene, camera, size } = useThree();
  const stir = useRef({ x: 0.3, y: 0.5, px: 0.3, py: 0.5, t: 0 });
  const first = useRef(true);

  const res = useMemo(() => {
    const quad = new THREE.PlaneGeometry(2, 2);
    const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const mat = (frag, uniforms) =>
      new THREE.ShaderMaterial({ vertexShader: quadVert, fragmentShader: frag, uniforms, depthTest: false });
    const velMat = mat(velFrag, {
      uPrev: { value: null },
      uMouse: { value: new THREE.Vector2(0.3, 0.5) },
      uVel: { value: new THREE.Vector2() },
      uAspect: { value: 1 },
      uDecay: { value: VEL_DECAY },
      uRadius: { value: STIR_RADIUS },
    });
    const dyeMat = mat(dyeFrag, {
      uDye: { value: null },
      uVel: { value: null },
      uGrad: { value: null },
      uTime: { value: 0 },
      uRelax: { value: 1 },
      uDrag: { value: DRAG },
      uMin: { value: MIN_WATER },
      uFray: { value: FRAY },
      uTexel: { value: new THREE.Vector2(0.001, 0.001) },
      uL1: { value: hex(LEFT[0]) },
      uL2: { value: hex(LEFT[1]) },
      uL3: { value: hex(LEFT[2]) },
      uR1: { value: hex(RIGHT[0]) },
      uR2: { value: hex(RIGHT[1]) },
      uR3: { value: hex(RIGHT[2]) },
    });
    const compMat = mat(compFrag, {
      uDye: { value: null },
      uVel: { value: null },
      uPaper: { value: PAPER },
      uRes: { value: new THREE.Vector2(1, 1) },
      uTime: { value: 0 },
    });
    const sceneFor = (m) => {
      const s = new THREE.Scene();
      s.add(new THREE.Mesh(quad, m));
      return s;
    };
    return {
      cam,
      velMat,
      dyeMat,
      compMat,
      velScene: sceneFor(velMat),
      dyeScene: sceneFor(dyeMat),
      compScene: sceneFor(compMat),
      vel: [target(256, 256), target(256, 256)],
      dye: [target(2, 2), target(2, 2)],
      grad: new THREE.WebGLRenderTarget(2, 2, { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter }),
    };
  }, []);

  useEffect(() => {
    const v = gl.getDrawingBufferSize(new THREE.Vector2());
    const dw = Math.max(2, Math.round(v.x * 0.75));
    const dh = Math.max(2, Math.round(v.y * 0.75));
    res.grad.setSize(dw, dh);
    res.dye.forEach((t) => t.setSize(dw, dh));
    res.vel.forEach((t) => t.setSize(Math.max(2, Math.round(v.x / 3)), Math.max(2, Math.round(v.y / 3))));
    res.dyeMat.uniforms.uTexel.value.set(1 / dw, 1 / dh);
    res.compMat.uniforms.uRes.value.set(v.x, v.y);
    res.velMat.uniforms.uAspect.value = size.width / Math.max(1, size.height);
    first.current = true;
  }, [gl, res, size]);

  useEffect(
    () => () => {
      [...res.vel, ...res.dye, res.grad].forEach((t) => t.dispose());
      [res.velMat, res.dyeMat, res.compMat].forEach((m) => m.dispose());
    },
    [res],
  );

  useFrame((state, delta) => {
    const dt = Math.min(delta, 1 / 20);
    const frames = dt * 60;

    // Where the "hand in the water" is. It trails behind the real cursor.
    const s = stir.current;
    const p = pointer.current;
    s.t += dt;
    let tx = p.x;
    let ty = p.y;
    let gain = 1;
    if (!p.active) {
      // Nobody is pointing: a slow invisible stir keeps each side gently moving, on its own side.
      const side = p.x > 0.5 ? 0.78 : 0.22;
      tx = side + Math.cos(s.t * 0.15) * 0.12;
      ty = 0.55 + Math.sin(s.t * 0.23) * 0.25;
      gain = 0.35;
    }
    const k = 1 - Math.pow(1 - CURSOR_LAG, frames);
    s.px = s.x;
    s.py = s.y;
    s.x += (tx - s.x) * k;
    s.y += (ty - s.y) * k;
    const vx = reduced ? 0 : (s.x - s.px) * gain;
    const vy = reduced ? 0 : (s.y - s.py) * gain;

    // 1. ShaderGradient's flowing shapes into a texture.
    gl.setRenderTarget(res.grad);
    gl.render(scene, camera);

    // 2. Stir the velocity field.
    res.velMat.uniforms.uPrev.value = res.vel[0].texture;
    res.velMat.uniforms.uMouse.value.set(s.x, s.y);
    res.velMat.uniforms.uVel.value.set(vx, vy);
    res.velMat.uniforms.uDecay.value = Math.pow(VEL_DECAY, frames);
    gl.setRenderTarget(res.vel[1]);
    gl.render(res.velScene, res.cam);
    res.vel.reverse();

    // 3. Carry the dye along and let it relax toward the base.
    res.dyeMat.uniforms.uDye.value = res.dye[0].texture;
    res.dyeMat.uniforms.uVel.value = res.vel[0].texture;
    res.dyeMat.uniforms.uGrad.value = res.grad.texture;
    res.dyeMat.uniforms.uTime.value = state.clock.elapsedTime;
    res.dyeMat.uniforms.uRelax.value = first.current || reduced ? 1 : 1 - Math.pow(1 - RELAX, frames);
    first.current = false;
    gl.setRenderTarget(res.dye[1]);
    gl.render(res.dyeScene, res.cam);
    res.dye.reverse();

    // 4. Paint it on screen.
    res.compMat.uniforms.uDye.value = res.dye[0].texture;
    res.compMat.uniforms.uVel.value = res.vel[0].texture;
    res.compMat.uniforms.uTime.value = state.clock.elapsedTime;
    gl.setRenderTarget(null);
    gl.render(res.compScene, res.cam);
  }, 1);

  return null;
}

// Stops drawing while the hero is scrolled out of view, without throwing the canvas away.
function Pause({ running }) {
  const setFrameloop = useThree((s) => s.setFrameloop);
  useEffect(() => setFrameloop(running ? 'always' : 'never'), [running, setFrameloop]);
  return null;
}

export default function WaterBackground({ reduced }) {
  const wrap = useRef(null);
  const pointer = useRef({ x: 0.3, y: 0.5, active: false, last: 0 });
  const inView = useInView(wrap, '0px');

  // Track the cursor over the hero, in 0..1 coordinates with y pointing up.
  useEffect(() => {
    const onMove = (e) => {
      const el = wrap.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      if (e.clientY < r.top || e.clientY > r.bottom) return;
      pointer.current.x = (e.clientX - r.left) / r.width;
      pointer.current.y = 1 - (e.clientY - r.top) / r.height;
      pointer.current.active = true;
      pointer.current.last = performance.now();
    };
    const idle = setInterval(() => {
      if (performance.now() - pointer.current.last > 3000) pointer.current.active = false;
    }, 500);
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => {
      window.removeEventListener('pointermove', onMove);
      clearInterval(idle);
    };
  }, []);

  // Rendered once. Its props never change, so ShaderGradient never rebuilds its material.
  // The pure red/green/blue colours are slot markers, not the colours you see.
  const gradient = useMemo(
    () => (
      <ShaderGradient
        control="props"
        type="waterPlane"
        animate={reduced ? 'off' : 'on'}
        uTime={0}
        uSpeed={0.12}
        uStrength={2.4}
        uDensity={1.1}
        uFrequency={5.5}
        uAmplitude={1}
        positionX={-0.5}
        positionY={0.1}
        positionZ={0}
        rotationX={0}
        rotationY={0}
        rotationZ={235}
        color1="#b30000"
        color2="#00b300"
        color3="#0000b3"
        reflection={0.1}
        cAzimuthAngle={180}
        cPolarAngle={115}
        cDistance={3.9}
        cameraZoom={1.6}
        lightType="3d"
        brightness={1}
        envPreset="city"
        grain="off"
        wireframe={false}
        shader="defaults"
      />
    ),
    [reduced],
  );

  return (
    <div ref={wrap} className="water" aria-hidden="true">
      <ShaderGradientCanvas pointerEvents="none" pixelDensity={1} fov={45} lazyLoad={false}>
        {gradient}
        <Pause running={inView} />
        <WaterPass reduced={reduced} pointer={pointer} />
      </ShaderGradientCanvas>
    </div>
  );
}
