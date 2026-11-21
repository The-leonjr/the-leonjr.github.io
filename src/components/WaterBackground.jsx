import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { useInView } from '../hooks.js';
import { ShaderGradientCanvas, ShaderGradient } from '@shadergradient/react';

// Two watercolour palettes. The left half of the screen uses LEFT, the right half RIGHT.
// Crossing the middle with the cursor slowly washes one into the other.
// The middle colour is near-white paper, so the washes bloom on paper instead of covering it.
const LEFT = ['#6fd3b2', '#f7f3ea', '#2f9b8c']; // mint and sea-glass teal
const RIGHT = ['#ec7d9b', '#f8f2e6', '#9e4a84']; // rose and a red-leaning plum (no blue)
// Raw sRGB values: this canvas writes colours straight to the screen with no conversion.
const PAPER = new THREE.Vector3(0xf4 / 255, 0xf0 / 255, 0xe7 / 255);

// How the water behaves. Bigger DECAY = colour takes longer to settle back.
const DECAY = 0.9935; // per frame at 60fps: about 2 seconds to half-settle, 6+ to settle fully
const PUSH = 0.32; // how far colour gets shoved by the cursor
const CURSOR_LAG = 0.055; // lower = the stir point trails further behind the cursor
const COLOUR_FADE = 0.35; // lower = slower wash between palettes

const hexToRGB = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
const LEFT_RGB = LEFT.map(hexToRGB);
const RIGHT_RGB = RIGHT.map(hexToRGB);
const PAPER_RGB = ['#e9efe3', '#f7f3ea', '#efe6e6'].map(hexToRGB); // the in-between "clear water" step

const quadVert = /* glsl */ `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

// The trail remembers where the cursor moved and in which direction. It fades slowly.
const trailFrag = /* glsl */ `
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
    // Let the trail drift along itself a little, so it smears like water instead of fading in place.
    vec4 prev = texture2D(uPrev, vUv - here.xy * 0.006);
    vec3 t = prev.xyz * uDecay;
    vec2 d = vUv - uMouse;
    d.x *= uAspect;
    float g = exp(-dot(d, d) / (uRadius * uRadius));
    t.xy += uVel * g;
    t.z = min(t.z + g * length(uVel) * 6.0, 1.0);
    gl_FragColor = vec4(clamp(t.xy, -1.0, 1.0), t.z, 1.0);
  }
`;

// Final picture: the ShaderGradient image, pushed around by the trail and painted onto paper.
const compFrag = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D uGrad;
  uniform sampler2D uTrail;
  uniform vec3 uPaper;
  uniform vec2 uRes;
  uniform float uTime;
  uniform float uPush;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + 1.0), f.x), f.y);
  }
  float cover(vec2 p) {
    vec3 c = texture2D(uGrad, p).rgb;
    return smoothstep(0.05, 0.42, length(c - vec3(0.97, 0.955, 0.92)));
  }

  void main() {
    vec4 tr = texture2D(uTrail, vUv);
    vec2 uv = vUv - tr.xy * uPush;
    // Slightly uneven edges, like pigment soaking into paper.
    uv += (vec2(noise(vUv * 7.0 + uTime * 0.02), noise(vUv * 7.0 + 9.0 - uTime * 0.02)) - 0.5) * 0.014;
    // A small blur softens the hard crest of the 3D water plane into a bleed.
    vec2 b = 6.0 / uRes;
    vec3 g = texture2D(uGrad, uv).rgb * 0.4
      + (texture2D(uGrad, uv + vec2(b.x, 0.0)).rgb + texture2D(uGrad, uv - vec2(b.x, 0.0)).rgb
      + texture2D(uGrad, uv + vec2(0.0, b.y)).rgb + texture2D(uGrad, uv - vec2(0.0, b.y)).rgb) * 0.15;

    // How much pigment sits here: zero where the gradient is at its paper-white colour.
    vec2 px = 5.0 / uRes;
    float c0 = cover(uv);
    float cx = cover(uv + vec2(px.x, 0.0));
    float cy = cover(uv + vec2(0.0, px.y));
    // Uneven pigment density, like a real wash drying.
    float dens = 0.72 + 0.4 * noise(vUv * vec2(4.0, 2.6) + uTime * 0.01);
    float amount = clamp(c0 * dens, 0.0, 1.0);
    // Where the cursor pushed through, the wash thins and the paper shows.
    amount *= 1.0 - clamp(tr.z, 0.0, 1.0) * 0.65;

    // The gradient's lighting greys the colours a little; give them back some saturation.
    g = mix(vec3(dot(g, vec3(0.299, 0.587, 0.114))), g, 1.3);
    vec3 col = mix(uPaper, g, amount * 0.9);

    // Wet edges: pigment collects where the wash changes, so those lines go darker.
    float edge = clamp(length(vec2(cx - c0, cy - c0)) * 9.0, 0.0, 1.0);
    col = mix(col, col * 0.74, edge * amount);

    // Granulation inside the pigment, plus a little paper tooth everywhere.
    float gran = noise(gl_FragCoord.xy * 0.3) * noise(gl_FragCoord.xy * 0.07 + 3.0);
    col *= 1.0 - gran * 0.13 * amount;
    col += (hash(gl_FragCoord.xy + fract(uTime)) - 0.5) * 0.02;

    // Fade to plain paper at the bottom so the hero runs straight into the page.
    col = mix(uPaper, col, smoothstep(0.0, 0.3, vUv.y));
    gl_FragColor = vec4(col, 1.0);
  }
`;

function makeTarget(w, h, type) {
  return new THREE.WebGLRenderTarget(w, h, {
    type,
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    depthBuffer: type === THREE.UnsignedByteType,
  });
}

// Runs after ShaderGradient each frame: renders it to a texture, updates the trail, draws the result.
function WaterPass({ reduced, pointer }) {
  const { gl, scene, camera, size } = useThree();
  const colourUniforms = useRef(null);
  const hookedMaterial = useRef(null);
  const mix = useRef(0);
  const stir = useRef({ x: 0.5, y: 0.5, px: 0.5, py: 0.5, seen: false, t: 0 });

  const res = useMemo(() => {
    const quad = new THREE.PlaneGeometry(2, 2);
    const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const trailMat = new THREE.ShaderMaterial({
      vertexShader: quadVert,
      fragmentShader: trailFrag,
      uniforms: {
        uPrev: { value: null },
        uMouse: { value: new THREE.Vector2(0.5, 0.5) },
        uVel: { value: new THREE.Vector2() },
        uAspect: { value: 1 },
        uDecay: { value: DECAY },
        uRadius: { value: 0.12 },
      },
      depthTest: false,
    });
    const compMat = new THREE.ShaderMaterial({
      vertexShader: quadVert,
      fragmentShader: compFrag,
      uniforms: {
        uGrad: { value: null },
        uTrail: { value: null },
        uPaper: { value: PAPER.clone() },
        uRes: { value: new THREE.Vector2(1, 1) },
        uTime: { value: 0 },
        uPush: { value: PUSH },
      },
      depthTest: false,
    });
    const trailScene = new THREE.Scene();
    trailScene.add(new THREE.Mesh(quad, trailMat));
    const compScene = new THREE.Scene();
    compScene.add(new THREE.Mesh(quad, compMat));
    const floatType = gl.capabilities.isWebGL2 ? THREE.HalfFloatType : THREE.UnsignedByteType;
    return {
      cam,
      trailMat,
      compMat,
      trailScene,
      compScene,
      trails: [makeTarget(256, 256, floatType), makeTarget(256, 256, floatType)],
      grad: makeTarget(2, 2, THREE.UnsignedByteType),
    };
  }, [gl]);

  // Keep the gradient texture the same size as the canvas.
  useEffect(() => {
    const v = gl.getDrawingBufferSize(new THREE.Vector2());
    res.grad.setSize(Math.max(2, v.x), Math.max(2, v.y));
    res.compMat.uniforms.uRes.value.set(v.x, v.y);
    res.trailMat.uniforms.uAspect.value = size.width / Math.max(1, size.height);
  }, [gl, res, size]);

  useEffect(
    () => () => {
      res.trails.forEach((t) => t.dispose());
      res.grad.dispose();
      res.trailMat.dispose();
      res.compMat.dispose();
    },
    [res],
  );

  // Priority 1 takes over rendering from R3F, so this function draws every frame.
  useFrame((state, delta) => {
    const dt = Math.min(delta, 1 / 20);

    // Grab ShaderGradient's colour uniforms, so palettes can blend without rebuilding its material.
    // If ShaderGradient ever swaps its material, hook the new one.
    const mat = scene.getObjectByName('shadergradient-mesh')?.material;
    if (mat && hookedMaterial.current !== mat) {
      hookedMaterial.current = mat;
      colourUniforms.current = null;
      const original = mat.onBeforeCompile;
      mat.onBeforeCompile = (shader, renderer) => {
        original.call(mat, shader, renderer);
        colourUniforms.current = shader.uniforms;
      };
      mat.needsUpdate = true;
    }

    // Where the "hand in the water" is. It trails behind the real cursor.
    const s = stir.current;
    const p = pointer.current;
    s.t += dt;
    let tx = p.x;
    let ty = p.y;
    if (!p.active && !reduced) {
      // Nobody is pointing: a slow invisible stir wanders so the water never looks frozen.
      // It stays on the side the visitor last pointed at, so the colour doesn't change by itself.
      const side = p.moved ? (p.x > 0.5 ? 0.75 : 0.25) : 0.3;
      tx = side + Math.cos(s.t * 0.13) * 0.17;
      ty = 0.55 + Math.sin(s.t * 0.21) * 0.22;
    } else if (!p.active) {
      tx = s.x;
      ty = s.y;
    }
    const k = 1 - Math.pow(1 - CURSOR_LAG, dt * 60);
    s.px = s.x;
    s.py = s.y;
    s.x += (tx - s.x) * k;
    s.y += (ty - s.y) * k;
    const vx = (s.x - s.px) * (p.active ? 9 : 4);
    const vy = (s.y - s.py) * (p.active ? 9 : 4);

    // Slowly wash between palettes depending on which half of the screen the cursor is in.
    const target = p.moved && p.x > 0.5 ? 1 : 0;
    // Uses the real frame time (not the clamped one) so a slow frame rate doesn't stall the fade.
    mix.current += (target - mix.current) * (1 - Math.exp(-Math.min(delta, 0.5) * COLOUR_FADE));
    const cu = colourUniforms.current;
    if (cu && cu.uC1r) {
      // Fade the old colour out to paper, then bloom the new one. Blending teal straight into
      // plum would pass through blue on the way, so the wash clears first instead.
      const m = mix.current;
      const from = m < 0.5 ? LEFT_RGB : PAPER_RGB;
      const to = m < 0.5 ? PAPER_RGB : RIGHT_RGB;
      const k = m < 0.5 ? m * 2 : (m - 0.5) * 2;
      ['1', '2', '3'].forEach((n, i) => {
        ['r', 'g', 'b'].forEach((ch, j) => {
          cu[`uC${n}${ch}`].value = from[i][j] + (to[i][j] - from[i][j]) * k;
        });
      });
    }

    // 1. ShaderGradient into a texture.
    gl.setRenderTarget(res.grad);
    gl.render(scene, camera);

    // 2. Update the trail (ping-pong between two textures).
    const [read, write] = res.trails;
    res.trailMat.uniforms.uPrev.value = read.texture;
    res.trailMat.uniforms.uMouse.value.set(s.x, s.y);
    res.trailMat.uniforms.uVel.value.set(reduced ? 0 : vx, reduced ? 0 : vy);
    res.trailMat.uniforms.uDecay.value = Math.pow(DECAY, dt * 60);
    gl.setRenderTarget(write);
    gl.render(res.trailScene, res.cam);
    res.trails.reverse();

    // 3. Paint it on screen.
    res.compMat.uniforms.uGrad.value = res.grad.texture;
    res.compMat.uniforms.uTrail.value = res.trails[0].texture;
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
  const pointer = useRef({ x: 0.3, y: 0.5, active: false, moved: false, last: 0 });
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
      pointer.current.moved = true;
      pointer.current.last = performance.now();
    };
    const idle = setInterval(() => {
      if (performance.now() - pointer.current.last > 4000) pointer.current.active = false;
    }, 500);
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => {
      window.removeEventListener('pointermove', onMove);
      clearInterval(idle);
    };
  }, []);

  // Rendered once. ShaderGradient's props never change, so its material is never rebuilt.
  const gradient = useMemo(
    () => (
      <ShaderGradient
        control="props"
        type="waterPlane"
        animate={reduced ? 'off' : 'on'}
        uTime={0}
        uSpeed={0.1}
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
        color1={LEFT[0]}
        color2={LEFT[1]}
        color3={LEFT[2]}
        reflection={0.1}
        cAzimuthAngle={180}
        cPolarAngle={115}
        cDistance={3.9}
        cameraZoom={1.6}
        lightType="3d"
        brightness={1.1}
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
