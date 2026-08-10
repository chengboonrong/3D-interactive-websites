import {
  CylinderGeometry,
  ExtrudeGeometry,
  Mesh,
  Shape,
  ShaderMaterial,
  Vector3,
} from 'three';
import { envTexture } from '../gen/textures.js';

/**
 * A small modelling kit. Every console on this page is built from three
 * primitives — a rounded slab, a rounded loop and a cylinder — because that is
 * genuinely what most consumer plastic is: extruded rounded rectangles with
 * chamfers. Nothing here is loaded; it is all generated at boot like the rest
 * of the page.
 *
 * One real-world scale throughout: 1 unit = 40 mm. Which is why the Wii looks
 * so small parked next to the Nintendo 64 — it is.
 */
export const MM = 1 / 40;

/* ── Geometry ─────────────────────────────────────────────────────────────── */

function roundedRect(w, h, r) {
  const x = -w / 2;
  const y = -h / 2;
  const rad = Math.min(r, w / 2, h / 2);
  const s = new Shape();
  s.moveTo(x + rad, y);
  s.lineTo(x + w - rad, y);
  s.quadraticCurveTo(x + w, y, x + w, y + rad);
  s.lineTo(x + w, y + h - rad);
  s.quadraticCurveTo(x + w, y + h, x + w - rad, y + h);
  s.lineTo(x + rad, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - rad);
  s.lineTo(x, y + rad);
  s.quadraticCurveTo(x, y, x + rad, y);
  return s;
}

/**
 * A slab with rounded corners in XY and a chamfer on both faces, centred on
 * the origin. `w`, `h` and `d` are the finished outside dimensions — the
 * chamfer is inset from them, not added to them.
 *
 * Exact to floating point at ordinary corner radii. At radii approaching half
 * the shorter side the outline becomes a stadium, and offsetting a coarsely
 * tessellated curve outward for the chamfer overshoots the box by around a
 * tenth of a percent. Not worth more curve segments for a 2 mm handle.
 */
export function slab(w, h, d, r = 0.12, bevel = 0.05) {
  const b = Math.min(bevel, d / 2 - 0.001, w / 4, h / 4);
  const g = new ExtrudeGeometry(roundedRect(w - b * 2, h - b * 2, Math.max(0.01, r - b)), {
    depth: Math.max(0.001, d - b * 2),
    bevelEnabled: true,
    bevelSize: b,
    bevelThickness: b,
    bevelSegments: 2,
    curveSegments: 5,
  });
  g.translate(0, 0, -(d / 2 - b));
  g.computeVertexNormals();
  return g;
}

/**
 * A rounded rectangular loop — the GameCube handle, and nothing else.
 *
 * Like slab(), the chamfer is inset from the requested size rather than added
 * to it, so w/h/d are the finished outside dimensions. The first version added
 * it, which made every loop 2 x bevel larger than asked for.
 */
export function loop(w, h, thickness, d, r = 0.2, bevel = 0.03) {
  const b = Math.min(bevel, d / 2 - 0.001, thickness / 3);
  const outer = roundedRect(w - b * 2, h - b * 2, Math.max(0.01, r - b));
  outer.holes.push(
    roundedRect(
      w - b * 2 - thickness * 2,
      h - b * 2 - thickness * 2,
      Math.max(0.01, r - thickness)
    )
  );
  const g = new ExtrudeGeometry(outer, {
    depth: Math.max(0.001, d - b * 2),
    bevelEnabled: true,
    bevelSize: b,
    bevelThickness: b,
    bevelSegments: 1,
    curveSegments: 6,
  });
  g.translate(0, 0, -(d / 2 - b));
  g.computeVertexNormals();
  return g;
}

export function disc(radius, height, segments = 20) {
  return new CylinderGeometry(radius, radius, height, segments);
}

/* ── Material ─────────────────────────────────────────────────────────────── */

/**
 * Built on first use rather than at import. Nothing needs it until a material
 * exists, and deferring it keeps this module importable without a DOM — which
 * is what lets the geometry helpers be unit tested outside a browser.
 */
let ENV = null;
function environment() {
  if (!ENV) ENV = envTexture(1024, 512);
  return ENV;
}

const VERT = /* glsl */ `
varying vec3 vWorld;
varying vec3 vNormal;
varying vec2 vUv;
void main(){
  vUv = uv;
  vec4 world = modelMatrix * vec4(position, 1.0);
  vWorld = world.xyz;
  vNormal = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

const FRAG = /* glsl */ `
precision highp float;

uniform sampler2D uEnv;
uniform vec3 uColor;
uniform vec3 uKey;
uniform vec3 uAmbient;
uniform vec3 uFog;
uniform vec3 uLightDir;
uniform float uRough;
uniform float uMetal;
uniform float uFogDensity;

varying vec3 vWorld;
varying vec3 vNormal;
varying vec2 vUv;

const float PI = 3.141592653589793;

vec2 equirect(vec3 d){
  return vec2(atan(d.z, d.x) / (2.0 * PI) + 0.5, acos(clamp(d.y, -1.0, 1.0)) / PI);
}

// Roughness by spreading three taps rather than prefiltering. Plastic is not
// mirror-smooth, and at these sizes nobody can tell the difference.
vec3 sampleEnv(vec3 d, float blur){
  vec3 t = normalize(cross(d, vec3(0.0, 1.0, 0.0001)));
  vec3 b = cross(d, t);
  vec3 c = texture2D(uEnv, equirect(d)).rgb;
  c += texture2D(uEnv, equirect(normalize(d + t * blur))).rgb;
  c += texture2D(uEnv, equirect(normalize(d + b * blur))).rgb;
  return c / 3.0;
}

void main(){
  vec3 n = normalize(vNormal);
  if(!gl_FrontFacing) n = -n;

  vec3 v = normalize(cameraPosition - vWorld);
  vec3 L = normalize(uLightDir);
  float ndv = clamp(dot(n, v), 0.0, 1.0);

  // Half-lambert. Injection-moulded plastic scatters enough that a hard
  // terminator reads as metal.
  float ndl = clamp(dot(n, L) * 0.5 + 0.5, 0.0, 1.0);
  vec3 diffuse = uColor * (uAmbient + uKey * ndl * ndl);

  vec3 env = sampleEnv(reflect(-v, n), 0.04 + uRough * 0.5) * 1.6;
  float f = 0.04 + 0.96 * pow(1.0 - ndv, 5.0) * (1.0 - uRough * 0.6);

  // Metals tint their reflection with the base colour; dielectrics do not.
  vec3 spec = env * mix(vec3(1.0), uColor, uMetal) * mix(f, 0.55 + f, uMetal);

  vec3 H = normalize(L + v);
  float gloss = pow(clamp(dot(n, H), 0.0, 1.0), mix(90.0, 8.0, uRough));

  vec3 col = mix(diffuse, vec3(0.0), uMetal) + spec + uKey * gloss * (1.0 - uRough) * 0.5;

  // Exponential fog toward the sky colour, so the far end of the lineup sinks
  // into the backdrop instead of ending on a hard silhouette.
  float dist = length(cameraPosition - vWorld);
  col = mix(col, uFog, 1.0 - exp(-dist * uFogDensity));

  gl_FragColor = vec4(col, 1.0);
}
`;

const SCREEN_FRAG = /* glsl */ `
precision highp float;
uniform vec3 uTop;
uniform vec3 uBottom;
uniform vec3 uFog;
uniform float uFogDensity;
uniform float uTime;
varying vec3 vWorld;
varying vec3 vNormal;
varying vec2 vUv;

void main(){
  // Deliberately abstract. This stands in for a running console, not for any
  // particular interface — no marks, no artwork.
  vec3 col = mix(uBottom, uTop, smoothstep(0.0, 1.0, vUv.y));
  float sweep = smoothstep(0.35, 0.0, abs(fract(vUv.y * 0.5 - uTime * 0.08) - 0.5));
  col += uTop * sweep * 0.25;
  col *= 0.965 + 0.035 * sin(vUv.y * 70.0);

  float dist = length(cameraPosition - vWorld);
  col = mix(col, uFog, 1.0 - exp(-dist * uFogDensity));
  gl_FragColor = vec4(col, 1.0);
}
`;

const shared = {
  uKey: { value: new Vector3(1.15, 1.06, 0.92) },
  uAmbient: { value: new Vector3(0.20, 0.23, 0.30) },
  uLightDir: { value: new Vector3(-0.42, 0.78, 0.55).normalize() },
  uFog: { value: new Vector3(0.03, 0.04, 0.07) },
  uFogDensity: { value: 0.014 },
  uTime: { value: 0 },
};

const cache = new Map();

/** Materials are cached by appearance so the whole lineup shares a handful. */
export function plastic(hex, { rough = 0.35, metal = 0 } = {}) {
  const key = `${hex}|${rough}|${metal}`;
  let m = cache.get(key);
  if (!m) {
    m = new ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: {
        ...shared,
        uEnv: { value: environment() },
        uColor: { value: srgb(hex) },
        uRough: { value: rough },
        uMetal: { value: metal },
      },
    });
    cache.set(key, m);
  }
  return m;
}

export function screen(topHex, bottomHex) {
  const key = `screen|${topHex}|${bottomHex}`;
  let m = cache.get(key);
  if (!m) {
    m = new ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: SCREEN_FRAG,
      uniforms: {
        uTop: { value: srgb(topHex) },
        uBottom: { value: srgb(bottomHex) },
        uFog: shared.uFog,
        uFogDensity: shared.uFogDensity,
        uTime: shared.uTime,
      },
    });
    cache.set(key, m);
  }
  return m;
}

/** Hex authored in sRGB, used in a linear pipeline, so it has to be decoded. */
function srgb(hex) {
  const n = typeof hex === 'string' ? parseInt(hex.replace('#', ''), 16) : hex;
  const to = (v) => Math.pow(v / 255, 2.2);
  return new Vector3(to((n >> 16) & 255), to((n >> 8) & 255), to(n & 255));
}

export const kitUniforms = shared;

/* ── Assembly ─────────────────────────────────────────────────────────────── */

/** Add a mesh at a position, optionally rotated. Returns it for further use. */
export function part(group, geometry, material, [x, y, z] = [0, 0, 0], rot) {
  const m = new Mesh(geometry, material);
  m.position.set(x, y, z);
  if (rot) m.rotation.set(rot[0] || 0, rot[1] || 0, rot[2] || 0);
  group.add(m);
  return m;
}
