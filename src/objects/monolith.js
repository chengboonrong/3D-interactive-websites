import { BoxGeometry, Group, Mesh, ShaderMaterial, Vector3 } from 'three';
import { NOISE } from '../gen/noise.glsl.js';
import { envTexture } from '../gen/textures.js';

/**
 * The reflective payoff. There is no cube map and no PMREM here: reflections
 * are a direct equirectangular lookup into a 512x256 canvas gradient, with
 * roughness faked by blending toward the horizon colour. Costs one texture
 * fetch and about 30 lines of GLSL instead of a prefilter pipeline.
 */

const VERT = /* glsl */ `
varying vec3 vWorld;
varying vec3 vNormal;
varying vec3 vLocal;

void main(){
  vLocal = position;

  // A dead-flat face reflects one direction and reads as painted cardboard.
  // Bowing the broad faces into a shallow cylinder makes the reflection sweep
  // across the environment as the slab turns — the whole illusion depends on it.
  vec3 n = normal;
  if(abs(normal.z) > 0.5){
    n = normalize(vec3(position.x * 1.55, position.y * 0.05, normal.z * 1.1));
  }

  vec4 world = modelMatrix * vec4(position, 1.0);
  vWorld = world.xyz;
  vNormal = normalize(mat3(modelMatrix) * n);
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

const FRAG = /* glsl */ `
precision highp float;
${NOISE}

uniform sampler2D uEnv;
uniform float uTime;
uniform float uReveal;
uniform vec3 uTint;
uniform vec3 uEdge;

varying vec3 vWorld;
varying vec3 vNormal;
varying vec3 vLocal;

const float PI = 3.141592653589793;

vec2 equirect(vec3 d){
  return vec2(atan(d.z, d.x) / (2.0 * PI) + 0.5, acos(clamp(d.y, -1.0, 1.0)) / PI);
}

vec3 sampleEnv(vec3 d, float blur){
  // Poor-man's roughness: three taps spread along the normal's tangent plane.
  vec3 t = normalize(cross(d, vec3(0.0, 1.0, 0.0001)));
  vec3 b = cross(d, t);
  vec3 c = texture2D(uEnv, equirect(d)).rgb;
  c += texture2D(uEnv, equirect(normalize(d + t * blur))).rgb;
  c += texture2D(uEnv, equirect(normalize(d + b * blur))).rgb;
  return c / 3.0;
}

void main(){
  vec3 n = normalize(vNormal);
  vec3 v = normalize(cameraPosition - vWorld);
  float ndv = clamp(dot(n, v), 0.0, 1.0);

  // Etched horizontal grooves. Low frequency and smooth-shouldered: the first
  // pass ran them at 26 cycles and the result moired into grey mush.
  float groove = sin(vLocal.y * 7.5) * 0.5 + 0.5;
  groove = smoothstep(0.15, 0.95, groove) * 0.7 + 0.15;
  float micro = snoise(vec3(vLocal.xy * 9.0, 0.0)) * 0.05;
  n = normalize(n + vec3(0.0, (groove - 0.5) * 0.22 + micro, 0.0));

  vec3 r = reflect(-v, n);
  float rough = 0.03 + groove * 0.14;
  vec3 env = sampleEnv(r, rough) * 1.9;

  // Schlick fresnel over a metallic base — the tint colours the whole
  // reflection rather than sitting on top of a diffuse term.
  float f = 0.06 + 0.94 * pow(1.0 - ndv, 5.0);
  vec3 col = env * uTint * (0.30 + f * 1.0);

  // Anisotropic vertical streak: brushed metal, and it gives the eye something
  // to track as the slab rotates.
  float streak = pow(clamp(1.0 - abs(r.y), 0.0, 1.0), 12.0);
  col += uTint * streak * 0.22 * (1.0 - groove * 0.6);

  // Emissive seam running the height of the slab.
  float seam = smoothstep(0.06, 0.0, abs(vLocal.x)) * smoothstep(6.0, 3.0, abs(vLocal.y));
  float travel = smoothstep(0.3, 1.0, sin(vLocal.y * 0.9 - uTime * 1.1) * 0.5 + 0.5);
  col += uEdge * seam * (0.6 + travel * 3.2);

  // Edge glow so the silhouette separates from the nebula behind it.
  col += uEdge * pow(1.0 - ndv, 8.0) * 1.4;

  // Vertical falloff: the slab should fade into the dark rather than ending
  // on a hard cut against the sky.
  col *= smoothstep(6.2, 4.2, abs(vLocal.y)) * 0.55 + 0.45;

  col *= uReveal;
  gl_FragColor = vec4(col, 1.0);
}
`;

export function createMonolith({ position = new Vector3(0, 0.6, -112) } = {}) {
  const group = new Group();
  group.position.copy(position);

  const material = new ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    uniforms: {
      uEnv: { value: envTexture(1024, 512) },
      uTime: { value: 0 },
      uReveal: { value: 0 },
      uTint: { value: new Vector3(0.80, 0.70, 0.55) },
      uEdge: { value: new Vector3(1.6, 0.92, 0.35) },
    },
  });

  const slab = new Mesh(new BoxGeometry(2.8, 10.5, 0.72, 6, 40, 2), material);
  group.add(slab);

  // Three satellites on the same material — free scale reference, no extra
  // shader compile, and they break the symmetry of the silhouette.
  const shards = [];
  for (let i = 0; i < 3; i++) {
    const s = new Mesh(new BoxGeometry(0.7, 3.4, 0.7, 2, 10, 2), material);
    group.add(s);
    shards.push(s);
  }

  return {
    group,
    update(time, reveal) {
      material.uniforms.uTime.value = time;
      material.uniforms.uReveal.value = reveal;

      group.rotation.y = time * 0.13;
      slab.rotation.z = Math.sin(time * 0.31) * 0.035;

      shards.forEach((s, i) => {
        const a = time * (0.34 + i * 0.13) + (i * Math.PI * 2) / 3;
        const radius = 4.4 + i * 1.1;
        s.position.set(Math.cos(a) * radius, Math.sin(a * 0.7 + i) * 2.6, Math.sin(a) * radius);
        s.rotation.set(a * 0.6, a, a * 0.3);
      });
    },
  };
}
