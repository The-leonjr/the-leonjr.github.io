import * as THREE from 'three';

// A lit 3D orb redrawn as text characters, entirely on the GPU.
//
// 1. The orb is rendered into a tiny image where one pixel = one character cell. Each pixel stores
//    how much "ink" that cell needs: dense where the orb is in shadow, sparse where the light hits,
//    plus a swirling surface pattern so you can see it turn, and a flag for specular glints.
// 2. A full-screen pass looks up each cell and draws the matching character from a glyph sheet.
// Dark characters on light paper, so shadow = dense characters, like shading with a pencil.

const RAMP = ' .,:;-=+*#%@';

const orbVert = /* glsl */ `
  varying vec3 vN;
  varying vec3 vObj;
  varying vec3 vView;
  void main() {
    vObj = position;
    vN = normalize(normalMatrix * normal);
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vView = mv.xyz;
    gl_Position = projectionMatrix * mv;
  }
`;

const orbFrag = /* glsl */ `
  precision highp float;
  varying vec3 vN;
  varying vec3 vObj;
  varying vec3 vView;
  uniform float uTime;
  uniform vec3 uLight;

  float hash(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
  float noise(vec3 p) {
    vec3 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = mix(mix(hash(i), hash(i + vec3(1, 0, 0)), f.x), mix(hash(i + vec3(0, 1, 0)), hash(i + vec3(1, 1, 0)), f.x), f.y);
    float b = mix(mix(hash(i + vec3(0, 0, 1)), hash(i + vec3(1, 0, 1)), f.x), mix(hash(i + vec3(0, 1, 1)), hash(i + 1.0), f.x), f.y);
    return mix(a, b, f.z);
  }
  float fbm(vec3 p) { float s = 0.0, w = 0.5; for (int i = 0; i < 4; i++) { s += w * noise(p); p *= 2.03; w *= 0.5; } return s; }

  void main() {
    vec3 N = normalize(vN);
    vec3 V = normalize(-vView);
    vec3 L = normalize(uLight);
    float diff = max(dot(N, L), 0.0);
    float spec = pow(max(dot(reflect(-L, N), V), 0.0), 28.0);
    float rim = pow(1.0 - max(dot(N, V), 0.0), 2.2);

    // Swirling bands on the surface, so the rotation is visible.
    vec3 q = vObj * 1.8;
    q.y += fbm(vObj * 2.4 + uTime * 0.05) * 1.2;
    float bands = smoothstep(0.35, 0.65, 0.5 + 0.5 * sin(q.y * 5.0 + fbm(q) * 4.0));

    float light = 0.08 + 0.92 * diff;
    float ink = 0.14 + (1.0 - light) * 0.86 + bands * 0.3 + rim * 0.3;
    ink = clamp(ink, 0.2, 1.0);
    gl_FragColor = vec4(ink, step(0.45, spec), bands, 1.0);
  }
`;

const quadVert = /* glsl */ `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

const asciiFrag = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D uOrb;
  uniform sampler2D uGlyphs;
  uniform vec2 uCells;
  uniform float uCount;
  uniform vec3 uLight;
  uniform vec3 uDark;
  uniform vec3 uGlint;
  uniform vec3 uPaper;
  uniform float uPaperAlpha;
  void main() {
    vec2 cell = floor(vUv * uCells);
    vec2 f = fract(vUv * uCells);
    vec4 o = texture2D(uOrb, (cell + 0.5) / uCells);
    if (o.a < 0.5) discard;
    bool glint = o.g > 0.5;
    float index = glint ? 8.0 : floor(clamp(o.r, 0.0, 0.999) * uCount);
    float a = texture2D(uGlyphs, vec2((index + f.x) / uCount, f.y)).a;
    vec3 col = mix(uLight, uDark, smoothstep(0.15, 0.85, o.r));
    if (glint) col = uGlint;
    // A soft paper disc behind the characters, so the orb reads as one solid ball over the water.
    gl_FragColor = vec4(mix(uPaper, col, a), max(uPaperAlpha, a));
  }
`;

const rgb = (h) => new THREE.Vector3(...[1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255));

function glyphSheet() {
  const cw = 48;
  const ch = 64;
  const c = document.createElement('canvas');
  c.width = cw * RAMP.length;
  c.height = ch;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.font = '700 60px ui-monospace, "Cascadia Mono", Consolas, Menlo, monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  [...RAMP].forEach((g, i) => ctx.fillText(g, i * cw + cw / 2, ch / 2 + 3));
  const t = new THREE.CanvasTexture(c);
  t.minFilter = THREE.LinearFilter;
  t.generateMipmaps = false;
  return t;
}

/**
 * @param {object} colours  hex strings: light (lit side), dark (shadow side), glint (highlights)
 */
export function createAsciiOrb({ light = '#2f8a7e', dark = '#163f3a', glint = '#e8603f' } = {}) {
  const orbMat = new THREE.ShaderMaterial({
    vertexShader: orbVert,
    fragmentShader: orbFrag,
    uniforms: { uTime: { value: 0 }, uLight: { value: new THREE.Vector3(-0.55, 0.65, 0.75) } },
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 64, 48), orbMat);
  const orbScene = new THREE.Scene();
  orbScene.add(mesh);

  const cells = new THREE.WebGLRenderTarget(2, 2, {
    minFilter: THREE.NearestFilter,
    magFilter: THREE.NearestFilter,
    depthBuffer: true,
  });
  const glyphs = glyphSheet();
  const asciiMat = new THREE.ShaderMaterial({
    vertexShader: quadVert,
    fragmentShader: asciiFrag,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    uniforms: {
      uOrb: { value: cells.texture },
      uGlyphs: { value: glyphs },
      uCells: { value: new THREE.Vector2(2, 2) },
      uCount: { value: RAMP.length },
      uLight: { value: rgb(light) },
      uDark: { value: rgb(dark) },
      uGlint: { value: rgb(glint) },
      uPaper: { value: rgb('#f4f0e7') },
      uPaperAlpha: { value: 0.6 },
    },
  });
  const quadScene = new THREE.Scene();
  quadScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), asciiMat));
  const quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const clear = new THREE.Color();

  return {
    mesh,
    /** Size of the drawing area in CSS pixels and the size of one character cell. */
    setLayout(width, height, cellPx) {
      const cols = Math.max(2, Math.round(width / cellPx));
      const rows = Math.max(2, Math.round(height / (cellPx * 1.35)));
      cells.setSize(cols, rows);
      asciiMat.uniforms.uCells.value.set(cols, rows);
    },
    /** Draws the orb as text into whatever the renderer is currently drawing to. */
    render(renderer, camera, time) {
      orbMat.uniforms.uTime.value = time;
      const target = renderer.getRenderTarget();
      const alpha = renderer.getClearAlpha();
      renderer.getClearColor(clear);
      const autoClear = renderer.autoClear;
      renderer.setRenderTarget(cells);
      renderer.setClearColor(0x000000, 0);
      renderer.clear();
      renderer.render(orbScene, camera);
      renderer.setRenderTarget(target);
      renderer.setClearColor(clear, alpha);
      renderer.autoClear = false;
      renderer.render(quadScene, quadCam);
      renderer.autoClear = autoClear;
    },
    dispose() {
      cells.dispose();
      glyphs.dispose();
      orbMat.dispose();
      asciiMat.dispose();
      mesh.geometry.dispose();
    },
  };
}
