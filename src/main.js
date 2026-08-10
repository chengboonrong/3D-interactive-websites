import { Scene, WebGLRenderer } from 'three';
import { createNebula } from './objects/nebula.js';
import { createCloth } from './objects/cloth.js';
import { createField } from './objects/field.js';
import { createMonolith } from './objects/monolith.js';
import { createRig } from './rig.js';
import { createTimeline, band, window4 } from './scroll.js';
import { createUI } from './ui.js';
import { Post } from './gfx/post.js';
import { detectTier } from './tier.js';

const canvas = document.getElementById('stage');
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const tier = detectTier();

let renderer;
try {
  renderer = new WebGLRenderer({
    canvas,
    antialias: false,      // resolved by the composite pass and DPR instead
    alpha: false,
    powerPreference: 'high-performance',
    stencil: false,
  });
} catch (err) {
  document.body.innerHTML =
    '<p class="fallback">This page renders in real time and needs WebGL.</p>';
  throw err;
}

renderer.setClearColor(0x05060a, 1);
renderer.autoClear = false;
// Seven to nine passes per frame depending on tier; without this the composite
// pass resets the counters and the HUD reports 1 draw call forever.
renderer.info.autoReset = false;

const scene = new Scene();
const rig = createRig();
const post = new Post(renderer, { bloomPasses: tier.bloomPasses });
const timeline = createTimeline();
const ui = createUI();

const nebula = createNebula({ dust: tier.dust });
const cloth = createCloth({ segments: tier.clothSegments, iterations: tier.clothIterations });
const field = createField({ count: tier.shards });
const monolith = createMonolith();

// The copy quotes exact counts, and the low tier changes them. Writing the
// real figures in beats shipping a page that claims 4,096 shards while drawing
// 2,000 of them.
const WORDS = { 6: 'six', 8: 'eight' };
const facts = {
  masses: (tier.clothSegments ** 2).toLocaleString('en-US'),
  passes: WORDS[tier.clothIterations] || String(tier.clothIterations),
  shards: tier.shards.toLocaleString('en-US'),
};
for (const el of document.querySelectorAll('[data-fact]')) {
  const value = facts[el.dataset.fact];
  if (value) el.textContent = value;
}

scene.add(nebula.sky, nebula.dust, cloth.mesh, field.mesh, monolith.group);

// With motion reduced the clock never advances, so the cloth is solved to a
// resting drape once up front rather than sitting there as a flat plane.
if (reduced) cloth.settle(55);

/* ── Resolution ──────────────────────────────────────────────────────────── */

// Start conservative and let the frame timer earn the pixels back. Phones
// report a device pixel ratio of 3 and cannot afford to honour it here — the
// sky shader is fill-rate bound, so the cap is where most of the budget is won.
const dprCap = Math.min(devicePixelRatio || 1, tier.dprCap);
let dpr = Math.min(devicePixelRatio || 1, tier.dprStart);
let width = 0;
let height = 0;

let appliedDpr = 0;

function resize() {
  // Measure the canvas, not the window: #stage is pinned to the large viewport
  // so its box is stable while the mobile URL bar slides over it.
  const w = canvas.clientWidth || innerWidth;
  const h = canvas.clientHeight || innerHeight;
  if (w === width && h === height && dpr === appliedDpr) return;

  width = w;
  height = h;
  appliedDpr = dpr;
  renderer.setPixelRatio(dpr);
  renderer.setSize(width, height, false);
  post.setSize(width, height, dpr);
  rig.camera.aspect = width / Math.max(height, 1);
  rig.camera.updateProjectionMatrix();
}

addEventListener('resize', resize, { passive: true });
// iOS reports the pre-rotation viewport on the orientationchange event itself,
// so the follow-up resize is what actually has the right numbers. Re-running it
// on the next frame covers the browsers that do not fire one.
addEventListener('orientationchange', () => requestAnimationFrame(resize), { passive: true });
resize();

/* ── Adaptive quality ────────────────────────────────────────────────────── */

let slowFrames = 0;
let fastFrames = 0;

function adapt(dt) {
  if (dt > 1 / 45) {
    // Weight the count by how bad the frame was. A fixed increment means a
    // device running at 1 fps waits three quarters of a minute for relief.
    slowFrames += dt > 1 / 8 ? 12 : dt > 1 / 20 ? 4 : 1;
    fastFrames = 0;
  } else if (dt < 1 / 58) {
    fastFrames++;
    slowFrames = 0;
  }

  if (slowFrames > 45 && dpr > tier.dprFloor) {
    dpr = Math.max(tier.dprFloor, dpr - 0.15);
    slowFrames = 0;
    resize();
  } else if (fastFrames > 240 && dpr < dprCap) {
    dpr = Math.min(dprCap, dpr + 0.1);
    fastFrames = 0;
    resize();
  }
}

/* ── Frame loop ──────────────────────────────────────────────────────────── */

let last = performance.now() / 1000;
let time = 0;
let running = true;
let rafId = 0;

// Scheduling is funnelled through here because a frame can be requested from
// three places. Without the id guard, the callback already queued when the tab
// was hidden and the one the visibility handler schedules both survive, and the
// loop silently doubles every time the user switches away and back.
function schedule() {
  if (!rafId) rafId = requestAnimationFrame(frame);
}

function resume() {
  last = performance.now() / 1000;
  running = true;
  schedule();
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden) running = false;
  else resume();
});

function frame(now) {
  rafId = 0;
  if (!running) return;
  schedule();

  const t0 = now / 1000;
  const rawDt = t0 - last;
  // Clamped so a stalled tab or a breakpoint cannot detonate the simulation.
  // The meters and the quality governor must see the real number, though —
  // feeding them the clamp makes the HUD incapable of reporting below 20 fps.
  const dt = Math.min(rawDt, 1 / 20);
  last = t0;
  time += reduced ? 0 : dt;

  const tl = timeline.update(dt);
  const t = tl.value;

  rig.update(t, time, reduced ? 0 : tl.velocity, reduced ? 0 : 1);
  nebula.update(time, t, rig.camera, dpr);

  // Each station only pays for itself while it is anywhere near the lens.
  const clothLive = window4(t, 0.06, 0.20, 0.44, 0.56);
  if (clothLive > 0.001) {
    cloth.mesh.visible = true;
    if (!reduced) cloth.update(dt, time, Math.min(Math.abs(tl.velocity) * 1.6, 0.9));
  } else {
    cloth.mesh.visible = false;
  }

  const fieldLive = window4(t, 0.32, 0.48, 0.72, 0.86);
  field.mesh.visible = fieldLive > 0.001;
  if (field.mesh.visible) field.update(time, fieldLive);

  const monoLive = band(t, 0.60, 0.80);
  monolith.group.visible = monoLive > 0.001;
  if (monolith.group.visible) monolith.update(time, monoLive);

  // Grade moves with the story: cold and clean at the top, hot and blown out
  // by the time the monolith fills the frame.
  post.compU.uBloomAmount.value = 0.42 + band(t, 0.55, 1.0) * 0.26;
  post.compU.uExposure.value = 1.0 + band(t, 0.4, 1.0) * 0.06;
  post.compU.uAberration.value = 0.0022 + Math.min(Math.abs(tl.velocity) * 0.02, 0.006);
  post.compU.uVignette.value = 0.62 - band(t, 0.7, 1.0) * 0.16;

  renderer.info.reset();
  post.render(scene, rig.camera, time);

  ui.update(t, rawDt, renderer.info.render);
  adapt(rawDt);
}

schedule();

// Context loss happens on mobile every time the OS reclaims memory. Without
// this the page is a black rectangle with no explanation.
canvas.addEventListener('webglcontextlost', (e) => {
  e.preventDefault();
  running = false;
});
canvas.addEventListener('webglcontextrestored', () => {
  resize();
  resume();
});
