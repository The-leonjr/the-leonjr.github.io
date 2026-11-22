import * as THREE from 'three';

// A lit 3D orb whose surface is covered in text characters.
//
// The characters live ON the sphere: the surface is divided into rows of latitude, and each row
// into cells (fewer cells near the poles so they stay roughly square). Every cell picks one
// character from how much light reaches its centre, so as the orb turns you can follow a single
// "@" as it rotates, narrows and disappears around the side. The light stays still; the ink turns.
// Dark ink on light paper: shadow = dense characters, like shading with a pencil.

const RAMP = ' .,:;-=+*#%@';

const vert = /* glsl */ `
  varying vec3 vObj;
  varying vec3 vNView;
  varying vec3 vViewPos;
  void main() {
    vObj = position;
    vNView = normalize(normalMatrix * normal);
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vViewPos = mv.xyz;
    gl_Position = projectionMatrix * mv;
  }
`;

const frag = /* glsl */ `
  precision highp float;
  varying vec3 vObj;
  varying vec3 vNView;
  varying vec3 vViewPos;
  uniform sampler2D uGlyphs;
  uniform float uCount;
  uniform float uRows;
  uniform float uCols;
  uniform float uTime;
  uniform vec3 uLightObj;   // light direction, in the orb's own (rotating) space
  uniform vec3 uCamObj;     // camera position, in the orb's own space
  uniform vec3 uLightView;  // light direction in view space, for the smooth paper shading
  uniform vec3 uInkLight, uInkDark, uGlint, uPaperLit, uPaperShade;
  uniform float uPaperAlpha;

  const float PI = 3.14159265;

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
    vec3 P = normalize(vObj);

    // Which character cell of the surface this pixel belongs to.
    float lat = asin(clamp(P.y, -1.0, 1.0));
    float lon = atan(P.x, P.z);
    float rowF = (lat / PI + 0.5) * uRows;
    float row = floor(rowF);
    float latC = ((row + 0.5) / uRows - 0.5) * PI;
    float cols = max(3.0, floor(uCols * cos(latC) + 0.5));
    float colF = (lon / (2.0 * PI) + 0.5) * cols;
    float col = floor(colF);
    float lonC = ((col + 0.5) / cols - 0.5) * 2.0 * PI;
    vec2 inCell = vec2(fract(colF), fract(rowF));

    // Light at the centre of the cell decides the character, so it stays put as the orb turns.
    vec3 N = vec3(cos(latC) * sin(lonC), sin(latC), cos(latC) * cos(lonC));
    vec3 V = normalize(uCamObj - N);
    float diff = max(dot(N, uLightObj), 0.0);
    float spec = pow(max(dot(reflect(-uLightObj, N), V), 0.0), 26.0);
    float rim = pow(1.0 - max(dot(N, V), 0.0), 2.0);
    float bounce = max(-N.y, 0.0) * 0.15;

    // Slow swirling bands drawn on the surface, so the turning is easy to see.
    vec3 q = N * 1.8;
    q.y += fbm(N * 2.4 + uTime * 0.03) * 1.2;
    float bands = smoothstep(0.35, 0.65, 0.5 + 0.5 * sin(q.y * 5.0 + fbm(q) * 4.0));

    float light = 0.05 + 0.95 * diff + bounce;
    float ink = clamp(0.1 + (1.0 - light) * 0.9 + bands * 0.24 + rim * 0.25, 0.14, 1.0);
    bool glint = spec > 0.5;
    float index = glint ? 8.0 : floor(clamp(ink, 0.0, 0.999) * uCount);

    // The character, with a little spacing inside its cell.
    vec2 g = (inCell - 0.5) / 0.86 + 0.5;
    float inside = step(0.0, g.x) * step(g.x, 1.0) * step(0.0, g.y) * step(g.y, 1.0);
    float a = texture2D(uGlyphs, vec2((index + clamp(g.x, 0.0, 1.0)) / uCount, clamp(g.y, 0.0, 1.0))).a * inside;

    vec3 inkCol = mix(uInkLight, uInkDark, smoothstep(0.3, 0.95, ink));
    if (glint) inkCol = uGlint;

    // Smooth paper ball underneath: warm cream where lit, plum-tinted in shadow, soft at the rim.
    vec3 Nv = normalize(vNView);
    float pixLight = max(dot(Nv, normalize(uLightView)), 0.0);
    float facing = max(dot(Nv, normalize(-vViewPos)), 0.0);
    vec3 paper = mix(uPaperShade, uPaperLit, smoothstep(0.0, 0.85, pixLight));
    float paperA = uPaperAlpha * smoothstep(0.0, 0.5, facing);
    gl_FragColor = vec4(mix(paper, inkCol, a), max(paperA, a * smoothstep(0.0, 0.15, facing)));
  }
`;

const rgb = (h) => new THREE.Color().setRGB(...[1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255));

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

// Where the light comes from, relative to the camera: upper left, slightly in front.
const LIGHT = new THREE.Vector3(-0.55, 0.65, 0.75).normalize();

export function createAsciiOrb({
  inkLight = '#2f8a7e',
  inkDark = '#5e2347', // deep plum-burgundy for the shadow side
  glint = '#e8603f',
  paperLit = '#fcf6ea',
  paperShade = '#d8c4cc',
} = {}) {
  const glyphs = glyphSheet();
  const uniforms = {
    uGlyphs: { value: glyphs },
    uCount: { value: RAMP.length },
    uRows: { value: 60 },
    uCols: { value: 120 },
    uTime: { value: 0 },
    uLightObj: { value: new THREE.Vector3() },
    uCamObj: { value: new THREE.Vector3() },
    uLightView: { value: LIGHT.clone() },
    uInkLight: { value: rgb(inkLight) },
    uInkDark: { value: rgb(inkDark) },
    uGlint: { value: rgb(glint) },
    uPaperLit: { value: rgb(paperLit) },
    uPaperShade: { value: rgb(paperShade) },
    uPaperAlpha: { value: 0.93 },
  };
  const material = new THREE.ShaderMaterial({
    vertexShader: vert,
    fragmentShader: frag,
    uniforms,
    transparent: true,
    depthWrite: true, // so project cards passing behind are hidden by the ball, pixel by pixel
  });
  const geometry = new THREE.SphereGeometry(1, 96, 64);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.renderOrder = -1;

  // A soft contact shadow under the orb.
  const shadowTex = (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d');
    const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grd.addColorStop(0, 'rgba(70,30,55,0.5)');
    grd.addColorStop(0.55, 'rgba(70,30,55,0.16)');
    grd.addColorStop(1, 'rgba(70,30,55,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(c);
  })();
  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthTest: false, depthWrite: false }),
  );
  shadow.renderOrder = -2;

  const group = new THREE.Group();
  group.add(shadow, mesh);

  let cellPx = 13;
  const tmpQ = new THREE.Quaternion();
  const size = new THREE.Vector2();
  const world = new THREE.Vector3();

  return {
    /** Add this to a scene. */
    group,
    /** The orb itself: set its position, scale (= radius) and rotation. */
    mesh,
    /** Roughly how big one character should be on screen, in CSS pixels. */
    setCellSize(px) {
      cellPx = px;
    },
    /** Call once per frame before rendering. Returns the orb's radius on screen, in pixels. */
    update(renderer, camera, time) {
      uniforms.uTime.value = time;
      mesh.updateMatrixWorld();
      camera.updateMatrixWorld();
      // Light and camera, expressed in the orb's own turning space.
      tmpQ.copy(mesh.quaternion).invert();
      uniforms.uLightObj.value.copy(LIGHT).applyQuaternion(camera.quaternion).applyQuaternion(tmpQ).normalize();
      uniforms.uCamObj.value.copy(camera.position);
      mesh.worldToLocal(uniforms.uCamObj.value);
      // Pick the number of rows so a character is about cellPx tall where it faces you.
      renderer.getSize(size);
      const dist = camera.position.distanceTo(mesh.getWorldPosition(world));
      const half = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
      const radiusPx = (mesh.scale.x / (dist * half)) * (size.y / 2);
      const rows = THREE.MathUtils.clamp(Math.round((Math.PI * radiusPx) / cellPx), 18, 110);
      uniforms.uRows.value = rows;
      uniforms.uCols.value = Math.round(rows * 2 * 0.78); // characters are a bit narrower than tall
      // Contact shadow just under the ball, facing the camera.
      const r = mesh.scale.x;
      shadow.position.set(mesh.position.x + r * 0.1, mesh.position.y - r * 1.08, mesh.position.z - r);
      shadow.scale.set(r * 2.1, r * 0.5, 1);
      shadow.quaternion.copy(camera.quaternion);
      return radiusPx;
    },
    dispose() {
      glyphs.dispose();
      shadowTex.dispose();
      geometry.dispose();
      material.dispose();
      shadow.geometry.dispose();
      shadow.material.dispose();
    },
  };
}
