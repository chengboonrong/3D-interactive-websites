import { DoubleSide, Mesh, PlaneGeometry, ShaderMaterial, Vector3 } from 'three';
import { NOISE } from '../gen/noise.glsl.js';
import { weaveTexture } from '../gen/textures.js';

const N = 40;                 // 40 x 40 = 1600 masses
const SPAN_X = 10.5;
const SPAN_Y = 7.0;
const ITERATIONS = 8;         // constraint relaxation passes per frame
const DAMPING = 0.976;
const GRAVITY = new Vector3(0, -9.0, 0);

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
${NOISE}

uniform sampler2D uWeave;
uniform vec3 uLightDir;
uniform vec3 uKey;
uniform vec3 uFill;
uniform vec3 uBase;
uniform float uTime;
uniform float uIridescence;
uniform float uWeaveScale;

varying vec3 vWorld;
varying vec3 vNormal;
varying vec2 vUv;

/**
 * Thin-film interference, cosine-approximated. Real Airy summation is not
 * worth the ALU here — three offset cosines land in the same place visually.
 */
vec3 thinFilm(float cosTheta, float thickness){
  float phase = thickness / max(cosTheta, 0.42);
  return 0.5 + 0.5 * cos(6.28318 * phase + vec3(0.0, 2.094, 4.188));
}

void main(){
  // World-space tangent frame from screen derivatives: no tangent attribute,
  // no recomputation when the simulation deforms the mesh.
  vec3 dpx = dFdx(vWorld);
  vec3 dpy = dFdy(vWorld);
  vec3 geoN = normalize(vNormal);
  if(!gl_FrontFacing) geoN = -geoN;

  vec2 dux = dFdx(vUv);
  vec2 duy = dFdy(vUv);
  vec3 tangent = normalize(dpx * duy.y - dpy * dux.y);
  vec3 bitangent = normalize(cross(geoN, tangent));

  vec4 weave = texture2D(uWeave, vUv * uWeaveScale);
  vec3 tn = weave.xyz * 2.0 - 1.0;
  vec3 n = normalize(geoN + (tangent * tn.x + bitangent * tn.y) * 0.38);

  vec3 viewDir = normalize(cameraPosition - vWorld);
  vec3 L = normalize(uLightDir);
  float ndl = dot(n, L);
  float ndv = clamp(dot(n, viewDir), 0.0, 1.0);

  // Diffuse, wrapped: cloth bleeds light around the terminator.
  float wrapped = clamp((ndl + 0.12) / 1.12, 0.0, 1.0);
  vec3 col = uBase * (uFill + uKey * wrapped);

  // Transmission through the weave when the key is behind the sheet.
  float back = clamp(-ndl, 0.0, 1.0);
  col += uKey * uBase * pow(back, 1.6) * 1.35 * weave.a;

  // Specular sheen along the thread direction, not a round highlight.
  vec3 H = normalize(L + viewDir);
  float sheen = pow(clamp(dot(n, H), 0.0, 1.0), 34.0);
  col += uKey * sheen * 0.22 * weave.a;

  // Fresnel-weighted iridescence, thickness modulated by the weave and a
  // slow noise so the colour crawls as the fabric moves.
  float fres = pow(1.0 - ndv, 3.4);
  // Thickness must vary smoothly across the sheet. Driving it from the weave's
  // high-frequency alpha put a different interference order in every texel.
  float thickness = 1.05
    + snoise(vec3(vUv * 2.2, uTime * 0.07)) * 0.22
    + snoise(vec3(vUv * 5.5, uTime * 0.03)) * 0.07;
  // Tinting the existing energy keeps the fabric reading as fabric. Adding the
  // interference term on top turned the whole sheet into a hologram.
  vec3 film = thinFilm(ndv, thickness);
  col = mix(col, col * (0.45 + film * 1.25), fres * uIridescence);
  col += film * fres * fres * uIridescence * 0.30;

  // Ambient occlusion baked into the weave alpha channel.
  col *= 0.52 + 0.48 * weave.a;

  gl_FragColor = vec4(col, 1.0);
}
`;

export function createCloth({ position = new Vector3(-9.8, 0.8, -39), rotationY = 0.42 } = {}) {
  const geometry = new PlaneGeometry(SPAN_X, SPAN_Y, N - 1, N - 1);
  const posAttr = geometry.attributes.position;
  const normAttr = geometry.attributes.normal;

  const count = N * N;
  const cur = new Float32Array(posAttr.array);   // live positions
  const prev = new Float32Array(posAttr.array);  // previous frame (verlet)
  const pinned = new Uint8Array(count);
  const rest = [];

  // Only the two top corners, and gathered inward by a third of the span.
  // A sheet pinned at its rest width is a flat sail no matter how good the
  // solver is; the slack is what buckles it into vertical folds.
  pinned[0] = 1;
  pinned[N - 1] = 1;

  // Break planarity before the first solve, otherwise the buckling has no
  // preferred direction and the sheet stays suspiciously flat.
  for (let i = 0; i < count; i++) {
    const jitter = Math.sin(i * 12.9898) * 0.04 + Math.sin((i % N) * 0.8) * 0.10;
    cur[i * 3 + 2] += jitter;
    prev[i * 3 + 2] += jitter;
  }

  const dist = (a, b) => {
    const dx = cur[a * 3] - cur[b * 3];
    const dy = cur[a * 3 + 1] - cur[b * 3 + 1];
    const dz = cur[a * 3 + 2] - cur[b * 3 + 2];
    return Math.hypot(dx, dy, dz);
  };

  // Structural links hold the sheet together; the skip-2 bend links stop it
  // from folding into itself like paper.
  for (let iy = 0; iy < N; iy++) {
    for (let ix = 0; ix < N; ix++) {
      const i = iy * N + ix;
      if (ix < N - 1) rest.push(i, i + 1, dist(i, i + 1), 1.0);
      if (iy < N - 1) rest.push(i, i + N, dist(i, i + N), 1.0);
      if (ix < N - 2) rest.push(i, i + 2, dist(i, i + 2), 0.12);
      if (iy < N - 2) rest.push(i, i + 2 * N, dist(i, i + 2 * N), 0.12);
    }
  }
  const links = new Float32Array(rest);
  const linkCount = links.length / 4;

  // Gather the anchors after the rest lengths are measured, so the solver sees
  // a genuine excess of fabric between them.
  const GATHER = 0.18;
  for (const i of [0, N - 1]) {
    cur[i * 3] *= 1 - GATHER;
    prev[i * 3] = cur[i * 3];
    cur[i * 3 + 2] += i === 0 ? 0.08 : -0.08;
    prev[i * 3 + 2] = cur[i * 3 + 2];
  }

  const material = new ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    side: DoubleSide,
    uniforms: {
      uWeave: { value: weaveTexture(256) },
      uLightDir: { value: new Vector3(-0.45, 0.6, 0.66).normalize() },
      uKey: { value: new Vector3(1.02, 0.80, 0.55) },
      uFill: { value: new Vector3(0.05, 0.07, 0.14) },
      uBase: { value: new Vector3(0.38, 0.35, 0.32) },
      uTime: { value: 0 },
      uIridescence: { value: 0.65 },
      uWeaveScale: { value: 5.0 },
    },
  });

  const mesh = new Mesh(geometry, material);
  mesh.position.copy(position);
  mesh.rotation.y = rotationY;
  mesh.frustumCulled = false;

  let wind = 0;

  function step(dt, time, gust) {
    const dt2 = dt * dt;

    // Wind: two beating sines plus a scroll-driven gust. Cheaper than sampling
    // noise per particle and, at this scale, indistinguishable.
    wind += (gust - wind) * 0.06;
    const wBase = 0.7 + Math.sin(time * 0.37) * 0.9 + Math.sin(time * 1.13) * 0.45;

    for (let i = 0; i < count; i++) {
      if (pinned[i]) continue;
      const i3 = i * 3;

      const px = cur[i3], py = cur[i3 + 1], pz = cur[i3 + 2];

      const flap = Math.sin(time * 1.6 + px * 0.55 + py * 0.38);
      const ax = GRAVITY.x + flap * 1.9 + Math.cos(time * 0.83 + py * 0.4) * 1.2;
      const ay = GRAVITY.y + Math.sin(time * 1.7 + px * 0.27) * 0.8;
      const az = GRAVITY.z + (wBase + wind * 10.0) * (0.35 + 0.65 * flap);

      cur[i3]     = px + (px - prev[i3]) * DAMPING + ax * dt2;
      cur[i3 + 1] = py + (py - prev[i3 + 1]) * DAMPING + ay * dt2;
      cur[i3 + 2] = pz + (pz - prev[i3 + 2]) * DAMPING + az * dt2;

      prev[i3] = px; prev[i3 + 1] = py; prev[i3 + 2] = pz;
    }

    for (let k = 0; k < ITERATIONS; k++) {
      for (let l = 0; l < linkCount; l++) {
        const o = l * 4;
        const a = links[o] * 3;
        const b = links[o + 1] * 3;
        const restLen = links[o + 2];
        const stiff = links[o + 3];

        const dx = cur[b] - cur[a];
        const dy = cur[b + 1] - cur[a + 1];
        const dz = cur[b + 2] - cur[a + 2];
        const len = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1e-6;

        const diff = ((len - restLen) / len) * 0.5 * stiff;
        const ox = dx * diff, oy = dy * diff, oz = dz * diff;

        const pa = pinned[links[o]], pb = pinned[links[o + 1]];
        if (!pa) { cur[a] += ox; cur[a + 1] += oy; cur[a + 2] += oz; }
        if (!pb) { cur[b] -= ox; cur[b + 1] -= oy; cur[b + 2] -= oz; }
      }
    }
  }

  const arr = posAttr.array;
  const narr = normAttr.array;

  function recomputeNormals() {
    for (let iy = 0; iy < N; iy++) {
      for (let ix = 0; ix < N; ix++) {
        const i = iy * N + ix;
        const l = (ix > 0 ? i - 1 : i) * 3;
        const r = (ix < N - 1 ? i + 1 : i) * 3;
        // Row 0 of a PlaneGeometry is the TOP edge, so i-N is up and i+N is
        // down. Getting this backwards flips every normal on the sheet.
        const up = (iy > 0 ? i - N : i) * 3;
        const dn = (iy < N - 1 ? i + N : i) * 3;

        const tx = arr[r] - arr[l], ty = arr[r + 1] - arr[l + 1], tz = arr[r + 2] - arr[l + 2];
        const bx = arr[up] - arr[dn], by = arr[up + 1] - arr[dn + 1], bz = arr[up + 2] - arr[dn + 2];

        let nx = ty * bz - tz * by;
        let ny = tz * bx - tx * bz;
        let nz = tx * by - ty * bx;
        const len = Math.hypot(nx, ny, nz) || 1;

        const i3 = i * 3;
        narr[i3] = nx / len;
        narr[i3 + 1] = ny / len;
        narr[i3 + 2] = nz / len;
      }
    }
  }

  function flush() {
    arr.set(cur);
    recomputeNormals();
    posAttr.needsUpdate = true;
    normAttr.needsUpdate = true;
  }

  return {
    mesh,
    /**
     * Run the solver forward without advancing the clock. Reduced-motion users
     * get a settled drape instead of the flat rest plane they would otherwise
     * see, since a frozen clock means gravity never integrates.
     */
    settle(steps) {
      for (let i = 0; i < steps; i++) step(1 / 60, 0, 0);
      flush();
    },
    update(dt, time, gust) {
      material.uniforms.uTime.value = time;
      // Fixed 120 Hz substeps: the solver stays stable no matter the refresh rate.
      const clamped = Math.min(dt, 1 / 30);
      const sub = clamped > 1 / 90 ? 2 : 1;
      for (let s = 0; s < sub; s++) step(clamped / sub, time, gust);

      flush();
    },
  };
}
