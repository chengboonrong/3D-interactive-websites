import { Scene, WebGLRenderer } from 'three';
import { createNebula } from './objects/nebula.js';
import { createCloth } from './objects/cloth.js';
import { createField } from './objects/field.js';
import { createMonolith } from './objects/monolith.js';
import { createRig } from './rig.js';
import { createTimeline, band, window4 } from './scroll.js';
import { createUI } from './ui.js';
import { Post } from './gfx/post.js';

const canvas = document.getElementById('stage');
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

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
// Nine passes per frame; without this the composite pass resets the counters
// and the HUD reports 1 draw call forever.
renderer.info.autoReset = false;

const scene = new Scene();
const rig = createRig();
const post = new Post(renderer);
const timeline = createTimeline();
const ui = createUI();

const nebula = createNebula();
const cloth = createCloth();
const field = createField();
const monolith = createMonolith();

scene.add(nebula.sky, nebula.dust, cloth.mesh, field.mesh, monolith.group);

// With motion reduced the clock never advances, so the cloth is solved to a
// resting drape once up front rather than sitting there as a flat plane.
if (reduced) cloth.settle(55);

/* ── Resolution ──────────────────────────────────────────────────────────── */

// Start conservative and let the frame timer earn the pixels back.
let dprCap = Math.min(devicePixelRatio || 1, 1.75);
let dpr = Math.min(devicePixelRatio || 1, 1.35);
let width = 0;
let height = 0;

function resize() {
  width = innerWidth;
  height = innerHeight;
  renderer.setPixelRatio(dpr);
  renderer.setSize(width, height, false);
  post.setSize(width, height, dpr);
  rig.camera.aspect = width / Math.max(height, 1);
  rig.camera.updateProjectionMatrix();
}

addEventListener('resize', resize, { passive: true });
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

  if (slowFrames > 45 && dpr > 0.75) {
    dpr = Math.max(0.75, dpr - 0.15);
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
