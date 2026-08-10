import { HalfFloatType, LinearFilter, Scene, Vector2, WebGLRenderTarget } from 'three';
import { makePass, PASS_CAMERA } from './fullscreen.js';
import { ditherTexture } from '../gen/textures.js';

/**
 * A hand-rolled post chain instead of EffectComposer + UnrealBloomPass.
 * Three passes, two small render targets, ~4 KB of shader. The stock stack
 * costs an order of magnitude more bytes for the same look at this scale.
 *
 *   scene -> HDR target -> bright/downsample -> separable blur x3 -> composite
 */

const BRIGHT_FRAG = /* glsl */ `
precision highp float;
uniform sampler2D uScene;
uniform float uThreshold;
uniform float uKnee;
varying vec2 vUv;

void main(){
  vec3 c = texture2D(uScene, vUv).rgb;
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  // Soft knee so highlights ramp into bloom instead of popping.
  float s = clamp((l - uThreshold + uKnee) / (2.0 * uKnee), 0.0, 1.0);
  float w = max(l - uThreshold, s * s * uKnee) / max(l, 1e-4);
  gl_FragColor = vec4(c * w, 1.0);
}
`;

const BLUR_FRAG = /* glsl */ `
precision highp float;
uniform sampler2D uTex;
uniform vec2 uDir;      // texel-sized step, already scaled by radius
varying vec2 vUv;

void main(){
  // 9-tap gaussian collapsed to 5 bilinear fetches.
  vec3 c = texture2D(uTex, vUv).rgb * 0.227027;
  c += (texture2D(uTex, vUv + uDir * 1.3846).rgb + texture2D(uTex, vUv - uDir * 1.3846).rgb) * 0.316216;
  c += (texture2D(uTex, vUv + uDir * 3.2308).rgb + texture2D(uTex, vUv - uDir * 3.2308).rgb) * 0.070270;
  gl_FragColor = vec4(c, 1.0);
}
`;

const COMPOSITE_FRAG = /* glsl */ `
precision highp float;
uniform sampler2D uScene;
uniform sampler2D uBloom;
uniform sampler2D uDither;
uniform vec2 uResolution;
uniform float uTime;
uniform float uBloomAmount;
uniform float uAberration;
uniform float uGrain;
uniform float uExposure;
uniform float uVignette;
varying vec2 vUv;

// ACES filmic approximation (Krzysztof Narkowicz). Cheap, and it keeps
// saturated highlights from clipping to flat white.
vec3 aces(vec3 x){
  const float a = 2.51, b = 0.03, c = 2.43, d = 0.59, e = 0.14;
  return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
}

void main(){
  vec2 uv = vUv;
  vec2 fromCenter = uv - 0.5;
  float r2 = dot(fromCenter, fromCenter);

  // Lateral chromatic aberration: scales with the square of image height,
  // which is how real glass behaves.
  vec2 ca = fromCenter * r2 * uAberration;
  vec3 scene;
  scene.r = texture2D(uScene, uv + ca).r;
  scene.g = texture2D(uScene, uv).g;
  scene.b = texture2D(uScene, uv - ca).b;

  vec3 bloom = texture2D(uBloom, uv).rgb;
  vec3 col = scene + bloom * uBloomAmount;

  col *= uExposure;
  col = aces(col);

  // Vignette applied after tonemapping so it reads as an optical falloff.
  col *= 1.0 - uVignette * smoothstep(0.16, 0.78, r2);

  // Linear -> display. Approximate sRGB is within a hair of the piecewise curve
  // and saves a branch per channel.
  col = pow(max(col, 0.0), vec3(1.0 / 2.2));

  // Animated grain + dither in one fetch. Kills 8-bit banding in the gradients.
  vec3 n = texture2D(uDither, uv * uResolution / 64.0 + vec2(uTime * 31.7, uTime * 17.3)).rgb;

  // Monochrome, and weighted toward the shadows: real emulsion grain is
  // invisible in the highlights, and RGB noise on a bright surface reads as a
  // broken sensor rather than film.
  float luma = dot(col, vec3(0.2126, 0.7152, 0.0722));
  col += (n.r - 0.5) * uGrain * (0.25 + 0.75 * (1.0 - luma) * (1.0 - luma));
  col += (n.g - 0.5) / 255.0;

  gl_FragColor = vec4(col, 1.0);
}
`;

export class Post {
  constructor(renderer, { bloomPasses = 3 } = {}) {
    this.renderer = renderer;
    this.bloomPasses = bloomPasses;
    this.scene = new Scene();

    const rtOpts = {
      type: HalfFloatType,
      minFilter: LinearFilter,
      magFilter: LinearFilter,
      depthBuffer: true,
      stencilBuffer: false,
    };

    this.hdr = new WebGLRenderTarget(1, 1, rtOpts);
    this.blurA = new WebGLRenderTarget(1, 1, { ...rtOpts, depthBuffer: false });
    this.blurB = new WebGLRenderTarget(1, 1, { ...rtOpts, depthBuffer: false });

    this.brightU = {
      uScene: { value: this.hdr.texture },
      uThreshold: { value: 0.85 },
      uKnee: { value: 0.45 },
    };
    this.blurU = { uTex: { value: null }, uDir: { value: new Vector2() } };
    this.compU = {
      uScene: { value: this.hdr.texture },
      uBloom: { value: this.blurA.texture },
      uDither: { value: ditherTexture(64) },
      uResolution: { value: new Vector2(1, 1) },
      uTime: { value: 0 },
      uBloomAmount: { value: 0.72 },
      uAberration: { value: 0.0035 },
      uGrain: { value: 0.032 },
      uExposure: { value: 1.05 },
      uVignette: { value: 0.55 },
    };

    this.bright = makePass(BRIGHT_FRAG, this.brightU);
    this.blur = makePass(BLUR_FRAG, this.blurU);
    this.composite = makePass(COMPOSITE_FRAG, this.compU);
  }

  setSize(w, h, dpr) {
    const pw = Math.max(1, Math.round(w * dpr));
    const ph = Math.max(1, Math.round(h * dpr));
    this.hdr.setSize(pw, ph);

    // Bloom lives at quarter resolution. Nobody has ever noticed.
    this.bw = Math.max(1, pw >> 2);
    this.bh = Math.max(1, ph >> 2);
    this.blurA.setSize(this.bw, this.bh);
    this.blurB.setSize(this.bw, this.bh);
    this.compU.uResolution.value.set(pw, ph);
  }

  /** Renders a single fullscreen pass into `target` (null = canvas). */
  draw(mesh, target) {
    this.scene.clear();
    this.scene.add(mesh);
    this.renderer.setRenderTarget(target);
    this.renderer.render(this.scene, PASS_CAMERA);
  }

  render(scene, camera, time) {
    const r = this.renderer;

    r.setRenderTarget(this.hdr);
    r.clear();
    r.render(scene, camera);

    this.draw(this.bright, this.blurA);

    // Ping-pong pairs at widening radii approximate a much larger kernel. One
    // fewer pair is the cheapest quality lever there is on a phone.
    for (let i = 0; i < this.bloomPasses; i++) {
      const radius = 1.0 + i * 1.9;
      this.blurU.uTex.value = this.blurA.texture;
      this.blurU.uDir.value.set(radius / this.bw, 0);
      this.draw(this.blur, this.blurB);

      this.blurU.uTex.value = this.blurB.texture;
      this.blurU.uDir.value.set(0, radius / this.bh);
      this.draw(this.blur, this.blurA);
    }

    this.compU.uTime.value = time;
    this.draw(this.composite, null);
    r.setRenderTarget(null);
  }

  dispose() {
    this.hdr.dispose();
    this.blurA.dispose();
    this.blurB.dispose();
    this.compU.uDither.value.dispose();
    for (const m of [this.bright, this.blur, this.composite]) m.material.dispose();
  }
}
