import { Scene, Vector3, WebGLRenderer } from 'three';
import { createNebula } from './objects/nebula.js';
import { createLineup, LINEUP_END } from './objects/consoles.js';
import { createRig, stationTimes } from './rig.js';
import { createTimeline } from './scroll.js';
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

const nebula = createNebula({ dust: tier.dust, depth: Math.abs(LINEUP_END) + 60 });
const lineup = createLineup();

scene.add(nebula.sky, nebula.dust, lineup.root);

/* ── Copy timing ─────────────────────────────────────────────────────────── */

// Each console panel is pinned to the point on the timeline where the camera is
// actually in front of that console, sampled from the curve. Hand-typed windows
// drift the moment the path or the spacing changes; these cannot.
const stations = stationTimes();

// The window has to be derived from the station spacing, not fixed. At seven
// stations a fixed 0.038 was comfortable; at twelve the spacing fell to 0.067
// and neighbouring captions sat on top of each other. ui.js adds a fade of 35%
// of the window on each side, so a window of 0.30x the spacing leaves the fades
// just touching and never two captions at full opacity.
const spacing = stations.length > 1 ? stations[1] - stations[0] : 0.12;
const HALF = spacing * 0.30;

for (const el of document.querySelectorAll('.panel[data-station]')) {
  const t = stations[Number(el.dataset.station)];
  el.dataset.in = Math.max(0, t - HALF).toFixed(4);
  el.dataset.out = Math.min(1, t + HALF).toFixed(4);
}

const intro = document.querySelector('header.panel');
intro.dataset.in = '0';
// No floor on this: clamping it up was what let the title sit on top of the
// first console's caption. The lead-in on the camera path is what makes room.
intro.dataset.out = Math.max(0.02, stations[0] - HALF - 0.02).toFixed(4);

const outro = document.querySelector('footer.panel');
outro.dataset.in = Math.min(0.97, stations[stations.length - 1] + HALF + 0.02).toFixed(4);
outro.dataset.out = '1';

// The scroll track has to grow with the lineup, or twelve stations go past in
// the distance that used to carry four. Bounded in pixels at both ends so a
// short landscape phone still gets a usable throw and a tall monitor does not
// turn the page into a marathon.
const track = document.getElementById('scroll');
track.style.height =
  `clamp(${stations.length * 480}px, ${(stations.length + 2) * 105}vh, ${stations.length * 1050}px)`;

// The timeline cached the document height when it was constructed, which was
// before this line ran. Without telling it, every scroll position maps to the
// wrong t and no station ever lands in front of the lens.
timeline.remeasure();

const ui = createUI();

// The footer quotes the payload, so it reads the real transferred size rather
// than a number in the copy that goes stale the next time a dependency moves.
addEventListener('load', () => {
  const el = document.querySelector('[data-fact="kb"]');
  if (!el) return;
  const nav = performance.getEntriesByType('navigation')[0];
  let bytes = nav ? nav.encodedBodySize : 0;
  for (const r of performance.getEntriesByType('resource')) bytes += r.encodedBodySize || 0;
  // encodedBodySize is zeroed for cross-origin responses without
  // Timing-Allow-Origin. Everything here is same-origin, but if a proxy hides
  // it, leaving the authored figure alone beats printing "0".
  if (bytes > 0) el.textContent = Math.round(bytes / 1024);
});

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

// The backdrop is tinted by whichever console is nearest, eased rather than
// switched so the room changes colour as you travel rather than at a boundary.
const accent = new Vector3().copy(lineup.items[0].accentVec);

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
  // Clamped so a stalled tab or a breakpoint cannot detonate the animation.
  // The meters and the quality governor must see the real number, though —
  // feeding them the clamp makes the HUD incapable of reporting below 20 fps.
  const dt = Math.min(rawDt, 1 / 20);
  last = t0;
  time += reduced ? 0 : dt;

  const tl = timeline.update(dt);
  const t = tl.value;

  rig.update(t, time, reduced ? 0 : tl.velocity, reduced ? 0 : 1);
  lineup.update(time, rig.camera);

  let nearest = lineup.items[0];
  for (const item of lineup.items) {
    if (Math.abs(rig.camera.position.z - item.position.z) <
        Math.abs(rig.camera.position.z - nearest.position.z)) {
      nearest = item;
    }
  }
  accent.lerp(nearest.accentVec, 1 - Math.pow(0.02, Math.min(dt, 0.05)));

  nebula.update(time, t, rig.camera, dpr, accent);

  // Grade drifts across the sequence: cool and clinical at the grey end of the
  // lineup, warmer as it reaches the present.
  post.compU.uBloomAmount.value = 0.40 + t * 0.20;
  post.compU.uAberration.value = 0.0018 + Math.min(Math.abs(tl.velocity) * 0.02, 0.005);
  post.compU.uVignette.value = 0.58 - t * 0.08;

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
