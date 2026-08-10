import {
  AdditiveBlending,
  BackSide,
  BufferAttribute,
  BufferGeometry,
  Color,
  IcosahedronGeometry,
  Mesh,
  Points,
  ShaderMaterial,
} from 'three';
import { COLOR, NOISE } from '../gen/noise.glsl.js';

/**
 * The environment: an inverted icosahedron carrying a domain-warped fbm, plus
 * a slab of additive motes for parallax. Together they do the job a 40 MB
 * background plate would normally do.
 */

const SKY_VERT = /* glsl */ `
varying vec3 vDir;
void main(){
  vDir = position;
  // Translation is stripped so the dome stays locked to the camera.
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
}
`;

const SKY_FRAG = /* glsl */ `
precision highp float;
${NOISE}
${COLOR}

uniform float uTime;
uniform float uProgress;
uniform vec3 uColdA;
uniform vec3 uColdB;
uniform vec3 uWarm;
varying vec3 vDir;

void main(){
  vec3 d = normalize(vDir);

  // Two layers drifting at different rates give depth without a second draw.
  float t = uTime * 0.014;
  // The far layer gets a full domain warp; the near layer gets a single cheap
  // warp vector instead of a second full one. 25 simplex evaluations per pixel
  // rather than 34, and the filigree survives.
  float far = warpFbm(d * 1.35 + vec3(0.0, 0.0, t), 1.15);
  float w = fbm(d * 2.2 + vec3(0.0, t * 0.9, 0.0), 3, 2.0, 0.5);
  float near = fbm(d * 3.10 + w * 0.55 + vec3(t * 1.7, -t * 0.6, 0.0), 5, 2.02, 0.5);

  float density = far * 0.62 + near * 0.38;
  // A tighter window leaves real black between the filaments. Without it the
  // frame is wall-to-wall cloud and nothing reads as foreground.
  density = smoothstep(-0.04, 0.88, density);

  // The grade rotates through the scroll: cold void -> warm interior.
  float mixWarm = smoothstep(0.40, 1.0, uProgress);
  vec3 cold = mix(uColdA, uColdB, density);
  vec3 col = mix(cold, uWarm, mixWarm * density * 0.42);

  // Filaments: the ridge of the noise field, boosted so bloom can grab it.
  float ridge = 1.0 - abs(near * 2.0 - 0.35);
  // Deliberately a two-tone ramp (teal -> amber) rather than a full palette
  // sweep. Rainbow filaments read as a screensaver; two hues read as a grade.
  vec3 filament = mix(vec3(0.10, 0.34, 0.52), vec3(0.95, 0.52, 0.16), mixWarm * 0.7 + density * 0.3);
  // The cold palette has far less base luminance than the warm one, so the
  // filaments have to carry more of the exposure at the start of the page.
  col += filament * pow(max(ridge, 0.0), 8.0) * mix(2.2, 1.2, mixWarm);

  // Horizon lift so the lower hemisphere never reads as flat black.
  col += uColdA * 0.22 * smoothstep(0.55, -0.35, d.y);

  gl_FragColor = vec4(col, 1.0);
}
`;

const DUST_VERT = /* glsl */ `
uniform float uTime;
uniform float uPixelRatio;
attribute float aSize;
attribute float aSeed;
varying float vFade;

void main(){
  vec3 p = position;
  // Slow individual drift keeps the field from looking like a static starfield.
  p.x += sin(uTime * 0.13 + aSeed * 6.28) * 1.4;
  p.y += cos(uTime * 0.11 + aSeed * 4.71) * 1.1;

  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  float dist = -mv.z;

  // Fade in from the far plane and out as motes pass the lens.
  vFade = smoothstep(2.0, 14.0, dist) * (1.0 - smoothstep(90.0, 170.0, dist));
  vFade *= 0.35 + 0.65 * abs(sin(uTime * 0.7 + aSeed * 12.0));

  gl_PointSize = aSize * uPixelRatio * (60.0 / max(dist, 0.001));
  gl_Position = projectionMatrix * mv;
}
`;

const DUST_FRAG = /* glsl */ `
precision mediump float;
uniform vec3 uColor;
varying float vFade;
void main(){
  vec2 q = gl_PointCoord - 0.5;
  float d = dot(q, q);
  if(d > 0.25) discard;
  float a = exp(-d * 14.0) * vFade;
  gl_FragColor = vec4(uColor * a, a);
}
`;

export function createNebula() {
  const sky = new Mesh(
    new IcosahedronGeometry(1, 5),
    new ShaderMaterial({
      vertexShader: SKY_VERT,
      fragmentShader: SKY_FRAG,
      side: BackSide,
      depthWrite: false,
      uniforms: {
        uTime: { value: 0 },
        uProgress: { value: 0 },
        uColdA: { value: new Color(0.020, 0.030, 0.058) },
        uColdB: { value: new Color(0.16, 0.22, 0.40) },
        uWarm: { value: new Color(0.30, 0.17, 0.06) },
      },
    })
  );
  sky.scale.setScalar(400);
  sky.frustumCulled = false;
  sky.renderOrder = -1;

  const COUNT = 2600;
  const pos = new Float32Array(COUNT * 3);
  const size = new Float32Array(COUNT);
  const seed = new Float32Array(COUNT);

  for (let i = 0; i < COUNT; i++) {
    // Spread along the flight path so there is always dust near the lens.
    pos[i * 3] = (Math.random() - 0.5) * 90;
    pos[i * 3 + 1] = (Math.random() - 0.5) * 55;
    pos[i * 3 + 2] = 14 - Math.random() * 160;
    size[i] = 0.7 + Math.random() * 2.6;
    seed[i] = Math.random();
  }

  const geo = new BufferGeometry();
  geo.setAttribute('position', new BufferAttribute(pos, 3));
  geo.setAttribute('aSize', new BufferAttribute(size, 1));
  geo.setAttribute('aSeed', new BufferAttribute(seed, 1));

  const dust = new Points(
    geo,
    new ShaderMaterial({
      vertexShader: DUST_VERT,
      fragmentShader: DUST_FRAG,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      uniforms: {
        uTime: { value: 0 },
        uPixelRatio: { value: 1 },
        uColor: { value: new Color(1.0, 0.86, 0.66) },
      },
    })
  );
  dust.frustumCulled = false;

  return {
    sky,
    dust,
    update(time, progress, camera, dpr) {
      sky.material.uniforms.uTime.value = time;
      sky.material.uniforms.uProgress.value = progress;
      sky.position.copy(camera.position);
      dust.material.uniforms.uTime.value = time;
      dust.material.uniforms.uPixelRatio.value = dpr;
    },
  };
}
