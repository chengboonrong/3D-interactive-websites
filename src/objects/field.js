import {
  ConeGeometry,
  InstancedBufferAttribute,
  InstancedMesh,
  Matrix4,
  ShaderMaterial,
  Vector3,
} from 'three';
import { NOISE } from '../gen/noise.glsl.js';

/**
 * 4,096 shards, one draw call. Their height, sway and colour are solved on the
 * vertex stage from the same noise field the sky uses, so the terrain has no
 * CPU-side representation at all — nothing to store, nothing to stream.
 */

const SPREAD = 50;

const VERT = /* glsl */ `
${NOISE}

uniform float uTime;
uniform float uReveal;

attribute vec3 aOffset;
attribute float aSeed;

varying float vHeight;
varying float vSeed;
varying vec3 vNormal;
varying vec3 vWorld;

mat3 rotY(float a){
  float s = sin(a), c = cos(a);
  return mat3(c, 0.0, -s, 0.0, 1.0, 0.0, s, 0.0, c);
}

void main(){
  // Terrain amplitude from a two-octave field; the low octave carves valleys,
  // the high one gives every shard its own read.
  float base = fbm(vec3(aOffset.xz * 0.035, uTime * 0.05), 3, 2.1, 0.5);
  float detail = snoise(vec3(aOffset.xz * 0.24, uTime * 0.16 + aSeed * 3.0));
  float h = 0.9 + base * 5.2 + detail * 0.9;
  h *= uReveal;

  // Sway increases with height, like anything tall in wind.
  float sway = sin(uTime * 0.9 + aSeed * 6.28 + aOffset.x * 0.1) * 0.14 * h;

  vec3 local = position;
  local.y *= max(h, 0.05);
  local = rotY(aSeed * 6.28318) * local;
  local.x += sway * position.y;
  local.z += sway * 0.6 * position.y;

  vec3 worldPos = local + aOffset;
  worldPos.y += (h - 1.0) * 0.5 - 3.4;

  vec4 world = modelMatrix * vec4(worldPos, 1.0);
  vWorld = world.xyz;
  vNormal = normalize(mat3(modelMatrix) * rotY(aSeed * 6.28318) * normal);
  vHeight = h;
  vSeed = aSeed;

  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

const FRAG = /* glsl */ `
precision highp float;

uniform vec3 uLightDir;
uniform vec3 uCool;
uniform vec3 uHot;
uniform float uTime;

varying float vHeight;
varying float vSeed;
varying vec3 vNormal;
varying vec3 vWorld;

void main(){
  vec3 n = normalize(vNormal);
  vec3 v = normalize(cameraPosition - vWorld);
  float ndl = clamp(dot(n, normalize(uLightDir)), 0.0, 1.0);
  float fres = pow(1.0 - clamp(dot(n, v), 0.0, 1.0), 3.0);

  // Tall shards run hot, short ones stay in the cold end of the grade.
  float heat = smoothstep(1.2, 5.4, vHeight);
  vec3 col = mix(uCool, uHot, heat);

  col *= 0.16 + ndl * 0.9;

  // Rim light is what makes an instanced field read as volume rather than mess.
  col += mix(uCool, uHot, heat) * fres * 1.9;

  // A travelling pulse so the field is never static even when the camera holds.
  float pulse = smoothstep(0.86, 1.0, sin(uTime * 0.6 - vWorld.z * 0.05 + vSeed));
  col += uHot * pulse * 0.7;

  // Distance haze — reuses the sky's cold value so the two blend seamlessly.
  float fog = 1.0 - exp(-max(length(cameraPosition - vWorld) - 12.0, 0.0) * 0.012);
  col = mix(col, uCool * 0.5, clamp(fog, 0.0, 1.0));

  gl_FragColor = vec4(col, 1.0);
}
`;

export function createField({ position = new Vector3(0, 0, -74), count = 4096 } = {}) {
  const COUNT = count;
  // Three sides: a shard, not a cone. Twelve triangles per instance total.
  const geometry = new ConeGeometry(0.26, 1, 3, 1, true);
  geometry.translate(0, 0.5, 0);

  const offset = new Float32Array(COUNT * 3);
  const seed = new Float32Array(COUNT);

  // Sunflower distribution: even coverage without the grid artefacts of a
  // lattice or the clumping of pure random.
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < COUNT; i++) {
    const r = Math.sqrt(i / COUNT) * SPREAD;
    const a = i * golden;
    offset[i * 3] = Math.cos(a) * r + (Math.random() - 0.5) * 0.6;
    offset[i * 3 + 1] = 0;
    offset[i * 3 + 2] = Math.sin(a) * r * 0.75 + (Math.random() - 0.5) * 0.6;
    seed[i] = Math.random();
  }

  geometry.setAttribute('aOffset', new InstancedBufferAttribute(offset, 3));
  geometry.setAttribute('aSeed', new InstancedBufferAttribute(seed, 1));

  const material = new ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    uniforms: {
      uTime: { value: 0 },
      uReveal: { value: 0 },
      uLightDir: { value: new Vector3(-0.4, 0.75, 0.52).normalize() },
      uCool: { value: new Vector3(0.07, 0.12, 0.24) },
      uHot: { value: new Vector3(1.25, 0.62, 0.24) },
    },
  });

  const mesh = new InstancedMesh(geometry, material, COUNT);
  mesh.instanceMatrix.needsUpdate = true;
  mesh.position.copy(position);
  mesh.frustumCulled = false;

  // Instance transforms live in the attributes above; the matrix stays identity.
  const identity = new Matrix4();
  for (let i = 0; i < COUNT; i++) mesh.setMatrixAt(i, identity);

  return {
    mesh,
    update(time, reveal) {
      material.uniforms.uTime.value = time;
      material.uniforms.uReveal.value = reveal;
    },
  };
}
