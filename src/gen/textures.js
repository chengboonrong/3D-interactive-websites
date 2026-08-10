import {
  CanvasTexture,
  DataTexture,
  LinearFilter,
  LinearMipmapLinearFilter,
  NoColorSpace,
  RGBAFormat,
  RepeatWrapping,
  ClampToEdgeWrapping,
} from 'three';

/**
 * Every texture in this project is synthesised at boot. Nothing is fetched.
 * The values are treated as linear data (masks, normals, radiance), never as
 * sRGB photographs, so no colour-space decode is applied anywhere.
 */

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return { c, ctx: c.getContext('2d', { willReadFrequently: false }) };
}

/** Deterministic PRNG so the look is identical on every load and every device. */
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

/**
 * Woven fabric, packed as a tangent-space normal map in RGB with the weave
 * occlusion in A. Two interleaved thread directions, slightly irregular.
 */
export function weaveTexture(size = 256) {
  const threads = 34;
  const cell = size / threads;

  // Low-frequency "slub": real yarn is not uniform, but the variation has to be
  // an order of magnitude coarser than a texel or it aliases into RGB confetti
  // the moment the surface is minified.
  const G = 16;
  const rand = rng(0x5eed);
  const slub = new Float32Array(G * G);
  for (let i = 0; i < G * G; i++) slub[i] = rand();

  const smooth = (x) => x * x * (3 - 2 * x);
  const sampleSlub = (u, v) => {
    const x = u * G, y = v * G;
    const x0 = Math.floor(x), y0 = Math.floor(y);
    const fx = smooth(x - x0), fy = smooth(y - y0);
    const at = (a, b) => slub[(((b % G) + G) % G) * G + (((a % G) + G) % G)];
    const top = at(x0, y0) * (1 - fx) + at(x0 + 1, y0) * fx;
    const bot = at(x0, y0 + 1) * (1 - fx) + at(x0 + 1, y0 + 1) * fx;
    return top * (1 - fy) + bot * fy;
  };

  // Analytic height field, sampled with central differences for the normal.
  // No per-texel randomness anywhere: everything here is band-limited.
  const height = (x, y) => {
    const fx = x / cell, fy = y / cell;
    const over = ((Math.floor(fx) + Math.floor(fy)) & 1) === 0;
    const warp = Math.cos((fx - Math.floor(fx) - 0.5) * Math.PI);
    const weft = Math.cos((fy - Math.floor(fy) - 0.5) * Math.PI);
    const h = over ? warp * 0.85 + weft * 0.15 : weft * 0.85 + warp * 0.15;
    return h * (0.82 + 0.18 * sampleSlub(x / size, y / size));
  };

  const data = new Uint8Array(size * size * 4);
  const STRENGTH = 1.6;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const hl = height(x - 1, y), hr = height(x + 1, y);
      const hd = height(x, y - 1), hu = height(x, y + 1);

      let nx = (hl - hr) * STRENGTH;
      let ny = (hd - hu) * STRENGTH;
      const nz = 1.0;
      const inv = 1 / Math.hypot(nx, ny, nz);
      nx *= inv; ny *= inv;

      const i = (y * size + x) * 4;
      data[i] = (nx * 0.5 + 0.5) * 255;
      data[i + 1] = (ny * 0.5 + 0.5) * 255;
      data[i + 2] = nz * inv * 255;
      // Alpha carries weave occlusion: thread crowns lit, interstices shaded.
      data[i + 3] = (0.5 + height(x, y) * 0.42) * 255;
    }
  }

  const tex = new DataTexture(data, size, size, RGBAFormat);
  tex.wrapS = tex.wrapT = RepeatWrapping;
  tex.minFilter = LinearMipmapLinearFilter;
  tex.magFilter = LinearFilter;
  tex.generateMipmaps = true;
  tex.colorSpace = NoColorSpace;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Equirectangular studio environment. This is what the monolith reflects:
 * a horizon gradient, three soft key lights and a warm bounce. 512x256.
 */
export function envTexture(w = 512, h = 256) {
  const { c, ctx } = canvas(w, h);

  // Sky-to-floor gradient in roughly linear radiance terms.
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0.0, '#0b1018');
  sky.addColorStop(0.42, '#1a2230');
  sky.addColorStop(0.5, '#2b3444');
  sky.addColorStop(0.52, '#0a0c12');
  sky.addColorStop(1.0, '#04050a');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);

  const lights = [
    { x: 0.18, y: 0.3, rx: 0.16, ry: 0.34, c: '255,244,222', i: 1.0 },
    { x: 0.62, y: 0.22, rx: 0.1, ry: 0.2, c: '198,222,255', i: 0.75 },
    { x: 0.88, y: 0.4, rx: 0.07, ry: 0.5, c: '255,196,120', i: 0.6 },
  ];

  ctx.globalCompositeOperation = 'lighter';
  for (const l of lights) {
    const g = ctx.createRadialGradient(l.x * w, l.y * h, 0, l.x * w, l.y * h, Math.max(l.rx * w, l.ry * h));
    g.addColorStop(0, `rgba(${l.c},${l.i})`);
    g.addColorStop(0.35, `rgba(${l.c},${l.i * 0.35})`);
    g.addColorStop(1, `rgba(${l.c},0)`);
    ctx.save();
    ctx.translate(l.x * w, l.y * h);
    ctx.scale(1, (l.ry * h) / (l.rx * w));
    ctx.translate(-l.x * w, -l.y * h);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }

  // Horizontal softbox bars — these are what read as "expensive" in reflections.
  for (let i = 0; i < 3; i++) {
    const y = h * (0.14 + i * 0.09);
    const g = ctx.createLinearGradient(0, y - 5, 0, y + 5);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(0.5, `rgba(255,250,240,${0.22 - i * 0.06})`);
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, y - 5, w, 10);
  }
  ctx.globalCompositeOperation = 'source-over';

  const tex = new CanvasTexture(c);
  tex.wrapS = RepeatWrapping;
  tex.wrapT = ClampToEdgeWrapping;
  tex.minFilter = LinearFilter;
  tex.magFilter = LinearFilter;
  tex.generateMipmaps = false;
  tex.colorSpace = NoColorSpace;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Interleaved-gradient blue-ish noise used to dither the final composite.
 * Without it, the wide dark gradients band badly on 8-bit displays.
 */
export function ditherTexture(size = 64) {
  const rand = rng(0xb10e);
  const data = new Uint8Array(size * size * 4);
  for (let i = 0; i < size * size; i++) {
    const v = rand() * 255;
    data[i * 4] = v;
    data[i * 4 + 1] = rand() * 255;
    data[i * 4 + 2] = rand() * 255;
    data[i * 4 + 3] = 255;
  }
  const tex = new DataTexture(data, size, size, RGBAFormat);
  tex.wrapS = tex.wrapT = RepeatWrapping;
  tex.minFilter = tex.magFilter = LinearFilter;
  tex.colorSpace = NoColorSpace;
  tex.needsUpdate = true;
  return tex;
}
