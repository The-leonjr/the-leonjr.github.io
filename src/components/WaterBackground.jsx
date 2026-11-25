import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { ShaderGradientCanvas, ShaderGradient } from '@shadergradient/react';
import { useInView } from '../hooks.js';
import { params } from '../tune.js';
import { sphereStir, waterPokes } from '../stir.js';

// How it works, in three layers:
// 1. ShaderGradient draws the slow, flowing water shapes. Its three colours are set to pure red,
//    green and blue so its output tells us how much of each "slot" is at every pixel.
// 2. A dye layer turns those slots into watercolour: green on the left, rose and plum on the right,
//    with a wobbly border where the two swim around each other.
// 3. The cursor stirs a velocity field. The dye is carried along by it (dragged, not pushed away),
//    then slowly relaxes back to the flowing base.

// Every number and colour that shapes the feel lives in src/tune.js (and the ?tune panel).
// Colour slots per side: main pigment, light wash, deep pigment. No blue, no orange.

// Raw sRGB values: this canvas writes colours straight to the screen with no conversion.
const hex = (h) => new THREE.Vector3(...[1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255));
const PAPER = hex('#f4f0e7');

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
  uniform float uWisps;
  uniform float uTime;
  uniform vec4 uVort[8];
  uniform vec4 uSphere; // centre x, y, radius (all in 0..1 of the hero), unused
  uniform vec2 uSphereVel;
  ${noiseGLSL}

  void main() {
    vec4 here = texture2D(uPrev, vUv);
    vec4 prev = texture2D(uPrev, vUv - here.xy * 0.5);
    vec2 d = vUv - uMouse;
    d.x *= uAspect;
    float g = exp(-dot(d, d) / (uRadius * uRadius));
    vec2 v = prev.xy * uDecay + uVel * g;

    // The card sphere's spin drags the water around it, and keeps it coasting as the spin slows.
    vec2 sq = vUv - uSphere.xy;
    sq.x *= uAspect;
    v += uSphereVel * exp(-dot(sq, sq) / (uSphere.z * uSphere.z * 1.6));

    // Wisps: where the water is moving, gently turn its direction by an amount that varies
    // smoothly across the screen. Turning never adds speed, so it can't run away, and the
    // colour carried along it pulls out into tendrils.
    vec2 p = vec2(vUv.x * uAspect, vUv.y) * 9.0 + vec2(uTime * 0.25, -uTime * 0.18);
    float turn = (noise(p) - 0.5) * 2.0 * uWisps * 0.22;
    float cs = cos(turn), sn = sin(turn);
    v = vec2(v.x * cs - v.y * sn, v.x * sn + v.y * cs);

    // Swirls: small spinning spots dropped either side of the cursor's path, turning opposite
    // ways so the stroke ends in a pair of curls, like the wake behind a hand.
    for (int i = 0; i < 8; i++) {
      vec4 k = uVort[i];
      if (k.z == 0.0) continue;
      vec2 q = vUv - k.xy;
      q.x *= uAspect;
      float f = exp(-dot(q, q) / (k.w * k.w));
      vec2 spinV = vec2(-q.y, q.x) * k.z * f;
      spinV.x /= uAspect;
      v += spinV;
    }
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
  uniform float uRightBoost;
  uniform vec3 uL1, uL2, uL3, uR1, uR2, uR3;
  ${noiseGLSL}
  void main() {
    vec2 v = texture2D(uVel, vUv).xy;
    vec4 carried = texture2D(uDye, vUv - v * uDrag);

    // ShaderGradient's output as weights for the three colour slots.
    vec3 g = max(texture2D(uGrad, vUv).rgb, 0.0);
    vec3 w = g / max(g.r + g.g + g.b, 0.001);

    // Left is green, right is rose and plum. The border wanders so the two swim around each other.
    float wobble = (noise(vec2(vUv.y * 2.2, uTime * 0.05)) - 0.5) * 0.34
                 + (noise(vec2(vUv.y * 6.0 + 4.0, uTime * 0.09)) - 0.5) * 0.1;
    float side = smoothstep(0.36, 0.64, vUv.x + wobble);
    vec3 c1 = mix(uL1, uR1, side);
    vec3 c2 = mix(uL2, uR2, side);
    vec3 c3 = mix(uL3, uR3, side);
    vec3 pigment = w.r * c1 + w.g * c2 + w.b * c3;
    float amount = mix(uMin + side * uRightBoost * 0.5, 0.9, clamp(w.r * 0.85 + w.b * 1.15 + side * uRightBoost, 0.0, 1.0));

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
  uniform float uTrailDark;
  uniform float uEdges;
  uniform float uFadeStart; // where the fade begins, in 0..1 of this canvas from the bottom
  uniform float uRagged;
  uniform float uGranules;
  ${noiseGLSL}
  void main() {
    vec4 d = texture2D(uDye, vUv);
    float wet = texture2D(uVel, vUv).z;

    // The trail reads as a heavier stroke of the same colour.
    float amount = clamp(d.a + wet * uTrailDark, 0.0, 1.0);
    vec3 col = mix(uPaper, d.rgb, amount * 0.94);

    // Wet edges: pigment collects where the wash changes.
    vec2 px = 4.0 / uRes;
    float ax = texture2D(uDye, vUv + vec2(px.x, 0.0)).a;
    float ay = texture2D(uDye, vUv + vec2(0.0, px.y)).a;
    float edge = clamp(length(vec2(ax - d.a, ay - d.a)) * uEdges, 0.0, 1.0);
    col = mix(col, col * 0.76, edge * amount);

    // Drying granules: as a dragged patch dries back (its wetness half gone), darker specks of
    // pigment settle into the paper's tooth there.
    float drying = clamp(wet * (1.0 - wet) * 4.0, 0.0, 1.0);
    float speck = smoothstep(0.62, 0.8, noise(gl_FragCoord.xy * 0.45) * 0.6 + noise(gl_FragCoord.xy * 0.13 + 5.0) * 0.4);
    col = mix(col, d.rgb * 0.62, speck * drying * uGranules * 0.85);

    // Granulation inside the pigment, plus a little paper tooth everywhere.
    float gran = noise(gl_FragCoord.xy * 0.3) * noise(gl_FragCoord.xy * 0.07 + 3.0);
    col *= 1.0 - gran * 0.12 * amount;
    col += (hash(gl_FragCoord.xy + fract(uTime)) - 0.5) * 0.018;

    // Fade into the page below the hero: begins above the hero's bottom edge, ends at the bottom of
    // the tail, eases out so there is no visible stop, and wobbles like watercolour bleeding.
    float rag = (noise(vec2(vUv.x * 5.0, uTime * 0.04)) - 0.5) * 2.0 * uRagged
              + (noise(vec2(vUv.x * 17.0 + 3.0, uTime * 0.07)) - 0.5) * uRagged;
    float fade = smoothstep(0.0, max(uFadeStart, 0.001), vUv.y + rag);
    fade = fade * fade * (3.0 - 2.0 * fade);
    col = mix(uPaper, col, fade);
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

const STEP = 1 / 60; // the water always moves in steps of this many seconds

const setHex = (vec, h) => vec.set(...[1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255));

// Copies the live settings (src/tune.js) into the shaders. Cheap enough to do every frame.
function applySettings(res) {
  const v = res.velMat.uniforms;
  const d = res.dyeMat.uniforms;
  const c = res.compMat.uniforms;
  v.uRadius.value = params.strokeWidth;
  v.uWisps.value = params.wisps;
  d.uDrag.value = params.drag;
  d.uMin.value = params.minWater;
  d.uRightBoost.value = params.rightBoost;
  setHex(d.uL1.value, params.leftMain);
  setHex(d.uL2.value, params.leftLight);
  setHex(d.uL3.value, params.leftDeep);
  setHex(d.uR1.value, params.rightMain);
  setHex(d.uR2.value, params.rightLight);
  setHex(d.uR3.value, params.rightDeep);
  c.uTrailDark.value = params.trailDark;
  c.uEdges.value = params.wetEdges;
  c.uRagged.value = params.fadeRagged;
  c.uGranules.value = params.granules;
}

function WaterPass({ reduced, pointer, wrap }) {
  const { gl, scene, camera, size } = useThree();
  const stir = useRef({ x: 0.3, y: 0.5, px: 0.3, py: 0.5, t: 0 });
  const first = useRef(true);
  const detail = useRef(0);
  const vortices = useRef([]); // each: { x, y, s, r, age }
  const lastSpawn = useRef(0);
  const seenSplash = useRef(waterPokes.splashes);
  const owed = useRef(0); // water time not simulated yet, in seconds

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
      uDecay: { value: 0.965 },
      uRadius: { value: 0.11 },
      uWisps: { value: 0 },
      uTime: { value: 0 },
      uVort: { value: Array.from({ length: 8 }, () => new THREE.Vector4()) },
      uSphere: { value: new THREE.Vector4(0.5, 0.5, 0.2, 0) },
      uSphereVel: { value: new THREE.Vector2() },
    });
    const dyeMat = mat(dyeFrag, {
      uDye: { value: null },
      uVel: { value: null },
      uGrad: { value: null },
      uTime: { value: 0 },
      uRelax: { value: 1 },
      uDrag: { value: 0.9 },
      uMin: { value: 0.1 },
      uRightBoost: { value: 0 },
      uL1: { value: new THREE.Vector3() },
      uL2: { value: new THREE.Vector3() },
      uL3: { value: new THREE.Vector3() },
      uR1: { value: new THREE.Vector3() },
      uR2: { value: new THREE.Vector3() },
      uR3: { value: new THREE.Vector3() },
    });
    const compMat = mat(compFrag, {
      uDye: { value: null },
      uVel: { value: null },
      uPaper: { value: PAPER },
      uRes: { value: new THREE.Vector2(1, 1) },
      uTime: { value: 0 },
      uTrailDark: { value: 0.22 },
      uEdges: { value: 10 },
      uFadeStart: { value: 0.2 },
      uRagged: { value: 0.03 },
      uGranules: { value: 0 },
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

  // Size the working textures from the canvas size and the "detail" setting.
  const resize = () => {
    const v = gl.getDrawingBufferSize(new THREE.Vector2());
    const k = params.detail;
    const w = Math.max(2, Math.round(v.x * k));
    const h = Math.max(2, Math.round(v.y * k));
    res.grad.setSize(w, h);
    res.dye.forEach((t) => t.setSize(w, h));
    res.vel.forEach((t) => t.setSize(Math.max(2, Math.round(w / 2)), Math.max(2, Math.round(h / 2))));
    res.compMat.uniforms.uRes.value.set(v.x, v.y);
    res.velMat.uniforms.uAspect.value = size.width / Math.max(1, size.height);
    detail.current = k;
    first.current = true;
  };
  useEffect(resize, [gl, res, size]);

  useEffect(
    () => () => {
      [...res.vel, ...res.dye, res.grad].forEach((t) => t.dispose());
      [res.velMat, res.dyeMat, res.compMat].forEach((m) => m.dispose());
    },
    [res],
  );

  // One step of the water: move the "hand", add swirls, stir the velocity, carry the dye.
  // It always advances exactly STEP seconds, so the water looks the same on a 60 Hz screen and a
  // 120 Hz one (with one step per screen frame, faster screens used to get weaker swirls).
  const step = (time) => {
    const s = stir.current;
    const p = pointer.current;
    s.t += STEP;

    // Where the "hand in the water" is. It trails behind the real cursor.
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
    s.px = s.x;
    s.py = s.y;
    s.x += (tx - s.x) * params.cursorLag;
    s.y += (ty - s.y) * params.cursorLag;
    const vx = reduced ? 0 : (s.x - s.px) * gain;
    const vy = reduced ? 0 : (s.y - s.py) * gain;

    // Drop a pair of wake curls behind the cursor while it moves (Swirls slider).
    const speed = Math.hypot(vx, vy);
    const list = vortices.current;
    if (params.swirls > 0 && p.active && speed > 0.0015 && s.t - lastSpawn.current > 0.09) {
      lastSpawn.current = s.t;
      const mx = vx / speed;
      const my = vy / speed;
      const side = params.strokeWidth * 1.1; // just outside the stroke
      const back = params.strokeWidth * 0.8; // a little behind the cursor
      const r = params.strokeWidth * 0.9;
      const strength = (params.swirls * Math.min(speed, 0.02) * 0.8) / r;
      // Left of the path spins one way, right of the path the other.
      list.push({ x: s.x - mx * back - my * side, y: s.y - my * back + mx * side, s: strength, r, age: 0 });
      list.push({ x: s.x - mx * back + my * side, y: s.y - my * back - mx * side, s: -strength, r, age: 0 });
      while (list.length > 8) list.shift();
    }
    // "Make a mess" (play panel): four big swirl pairs at random spots, lasting a bit longer.
    if (waterPokes.splashes !== seenSplash.current) {
      seenSplash.current = waterPokes.splashes;
      if (!reduced) {
        list.length = 0;
        for (let n = 0; n < 4; n++) {
          const x = 0.12 + Math.random() * 0.76;
          const y = 0.3 + Math.random() * 0.55;
          const r = 0.07 + Math.random() * 0.07;
          const strength = (0.03 + Math.random() * 0.02) / r;
          const a = Math.random() * Math.PI * 2; // the pair sits side by side at a random angle
          const ox = Math.cos(a) * r * 0.6;
          const oy = Math.sin(a) * r * 0.6;
          list.push({ x: x + ox, y: y + oy, s: strength, r, age: 0, life: 2.5 });
          list.push({ x: x - ox, y: y - oy, s: -strength, r, age: 0, life: 2.5 });
        }
      }
    }
    const life = 1.2; // how long a wake curl lasts, unless it says otherwise
    for (let i = list.length - 1; i >= 0; i--) {
      list[i].age += STEP;
      if (list[i].age > (list[i].life || life)) list.splice(i, 1);
    }
    const slots = res.velMat.uniforms.uVort.value;
    slots.forEach((slot, i) => {
      const k = list[i];
      if (!k) return slot.set(0, 0, 0, 1);
      const fade = (1 - k.age / (k.life || life)) ** 2;
      slot.set(k.x, k.y, k.s * fade, k.r);
    });

    // Stir the velocity field.
    res.velMat.uniforms.uTime.value = time;
    res.velMat.uniforms.uPrev.value = res.vel[0].texture;
    res.velMat.uniforms.uMouse.value.set(s.x, s.y);
    res.velMat.uniforms.uVel.value.set(vx, vy);
    res.velMat.uniforms.uDecay.value = params.stirLife;
    gl.setRenderTarget(res.vel[1]);
    gl.render(res.velScene, res.cam);
    res.vel.reverse();

    // Carry the dye along and let it relax toward the base.
    res.dyeMat.uniforms.uDye.value = res.dye[0].texture;
    res.dyeMat.uniforms.uVel.value = res.vel[0].texture;
    res.dyeMat.uniforms.uGrad.value = res.grad.texture;
    res.dyeMat.uniforms.uTime.value = time;
    res.dyeMat.uniforms.uRelax.value = first.current || reduced ? 1 : params.linger;
    first.current = false;
    gl.setRenderTarget(res.dye[1]);
    gl.render(res.dyeScene, res.cam);
    res.dye.reverse();
  };

  useFrame((state, delta) => {
    if (params.detail !== detail.current) resize();
    applySettings(res);

    // 1. ShaderGradient's flowing shapes into a texture.
    gl.setRenderTarget(res.grad);
    gl.render(scene, camera);

    // The canvas runs past the hero by the tail, so work out where the fade starts on it.
    const hero = wrap.current?.parentElement;
    if (hero) {
      if (hero.style.getPropertyValue('--water-tail') !== String(params.fadeTail)) {
        hero.style.setProperty('--water-tail', String(params.fadeTail));
      }
      const heroH = hero.clientHeight;
      const total = wrap.current.clientHeight || heroH;
      const tail = total - heroH;
      res.compMat.uniforms.uFadeStart.value = (tail + params.fadeStart * heroH) / total;
    }

    // Read the card sphere's spin (src/stir.js) and turn it into a current around it.
    // The sphere reports how far it moved this screen frame; rescale that to one water step.
    const box = wrap.current?.getBoundingClientRect();
    const sv = res.velMat.uniforms.uSphereVel.value;
    if (box && sphereStir.live && !reduced && params.sphereStir > 0) {
      res.velMat.uniforms.uSphere.value.set(
        (sphereStir.x - box.left) / box.width,
        1 - (sphereStir.y - box.top) / box.height,
        Math.max(0.02, sphereStir.radius / box.height),
        0,
      );
      const k = params.sphereStir * 0.35 * (STEP / Math.max(delta, 1 / 240));
      sv.set(
        THREE.MathUtils.clamp((sphereStir.dx / box.width) * k, -0.02, 0.02),
        THREE.MathUtils.clamp((-sphereStir.dy / box.height) * k, -0.02, 0.02),
      );
    } else {
      sv.set(0, 0);
    }

    // 2. Move the water in fixed steps: none on some frames of a fast screen, two at most on a
    // slow one (anything further behind is dropped rather than piling up).
    if (first.current) owed.current = Math.max(owed.current, STEP);
    owed.current += Math.min(delta, 0.25);
    let steps = 0;
    while (owed.current >= STEP && steps < 2) {
      step(state.clock.elapsedTime);
      owed.current -= STEP;
      steps += 1;
    }
    if (steps === 2) owed.current = Math.min(owed.current, STEP);

    // 3. Paint it on screen.
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
        <WaterPass reduced={reduced} pointer={pointer} wrap={wrap} />
      </ShaderGradientCanvas>
    </div>
  );
}
