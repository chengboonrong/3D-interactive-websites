# Aurelia — cinematic motion without video

A scroll-driven landing page whose "footage" is a live Three.js scene. There is no
video file, no image sequence, and no texture download: every pixel is solved on
the GPU as you scroll.

The whole page — renderer, shaders, cloth solver, post chain, textures — is
**546 KB on disk / 143 KB gzipped** (119 KB brotli). A two-second 1080p H.264 clip is larger.

```
npm install
npm run dev       # http://localhost:5173
npm run build
npm run size      # per-file raw / gzip / brotli report
```

## The four beats

The page is one continuous camera move through four stations. Scroll position
maps to a single normalised `t ∈ [0,1]`; camera, grade, and copy are all pure
functions of it, so the sequence scrubs backwards as cleanly as it plays forward.

| `t` | Station | What is actually running |
| --- | --- | --- |
| 0.00–0.20 | **Nebula** | Domain-warped fbm on an inverted icosahedron, plus 2,600 additive motes for parallax |
| 0.20–0.45 | **Cloth** | 1,600-mass verlet lattice, 8 relaxation passes/frame, thin-film interference shading |
| 0.45–0.72 | **Field** | 4,096 instanced shards in one draw call, displaced entirely on the vertex stage |
| 0.72–1.00 | **Monolith** | Equirectangular reflection sampled straight from a 1024×512 canvas gradient |

CSS breakpoints at 900 / 720 / 640 / 380 px plus a landscape-under-520px rule
handle type and chrome only — the 3D framing is continuous, so there is nothing
for them to keep in sync.

## Where the weight went

| | gzip |
| --- | --- |
| `three` (tree-shaken) | ~137 KB |
| Application + all shaders | ~4 KB |
| CSS | ~2 KB |
| HTML | ~1 KB |
| **Textures, environment maps, video** | **0 KB** |

Three.js is essentially the entire payload. Everything that would normally be a
download is a function instead:

- **Fabric weave** — an analytic height field rasterised to a 256² normal map at
  boot (`src/gen/textures.js`). Band-limited on purpose: the first version used
  per-texel white noise and minified into RGB confetti.
- **Environment map** — a 1024×512 canvas with a horizon gradient and three
  softbox lights. Sampled equirectangularly with a 3-tap spread for roughness,
  which skips PMREM entirely.
- **Grain / dither** — one 64² noise texture, sampled once per pixel in the
  composite pass, monochrome and weighted toward the shadows the way emulsion is.

## Rendering notes

**Post chain is hand-rolled** (`src/gfx/post.js`) rather than `EffectComposer` +
`UnrealBloomPass`: scene → HDR target → soft-knee bright pass → three separable
blur ping-pongs at quarter resolution → composite with ACES, lateral chromatic
aberration, vignette, grain. Seven to nine passes depending on tier, ~4 KB of
GLSL, and it tree-shakes to nothing beyond the core renderer.

**Colour management is manual.** The scene renders to a half-float linear target;
all generated textures are tagged `NoColorSpace` and authored as linear data, and
the composite pass does tonemapping and the transfer function itself. Nothing is
decoded or encoded twice.

**Everything is a function of `t`.** No scroll listeners fire animations, no
timelines hold state. That is what makes fast scrubbing and reverse scrolling
behave.

**Cost scales with what is on screen.** Each station simulates and draws only
while it is near the lens (`src/main.js`). The cloth solver — the one genuinely
expensive thing here — is idle for three quarters of the page.

**Resolution adapts.** Rendering starts at DPR 1.35 (1.0 on a phone), drops
toward 0.75 (0.6) after sustained slow frames, and climbs back to 1.75 (1.5)
once the frame timer has been comfortable.

**The frame reframes itself for the viewport.** The shot list was blocked for
16:9. A perspective camera holds its *vertical* field of view fixed, so on a
9:19.5 phone the horizontal view collapses to a quarter of what was composed and
every wide subject runs off both edges. `framing()` in `src/rig.js` corrects it
continuously from the aspect ratio — no breakpoints — with three moves split
between them, because any one alone has a cost:

| | laptop | phone portrait |
| --- | --- | --- |
| Lens widening | 1.00× | 1.40× |
| Dolly back | 1.00× | 1.40× |
| Subject lift | 0 | 14% of frame height |

Widening alone distorts; dollying alone shrinks everything against a tall frame.
The lift raises each subject out of the lower third so the copy — which anchors
to the bottom on phones — never lands on top of it.

**Quality tiers.** `src/tier.js` makes one decision at boot from viewport size,
`hardwareConcurrency` and pointer coarseness. It is not a breakpoint: a
1024-wide tablet and a 1024-wide window on a workstation want different budgets
and CSS cannot tell them apart. On the low tier the dust drops from 2,600 to
1,100 motes, the field from 4,096 to 2,000 shards, the cloth from 40×40 to 30×30
masses at 6 solver passes instead of 8, and bloom loses one blur pair.

Also handled: `prefers-reduced-motion` (holds a static frame), tab visibility,
WebGL context loss and restore, and a text fallback when WebGL is unavailable.

## Verifying it

`scripts/verify.mjs` drives headless Chromium through nine scroll positions,
waits for the smoothed timeline to converge at each one, screenshots, and reports
FPS, draw calls, triangle count and any console output.

```
npm run build
npm run preview &
node scripts/verify.mjs           # OUT=dir STOPS=0,0.3,0.9 to narrow it
```

Playwright is a dev dependency and only this script needs it. If your
environment already has a Chromium (`PLAYWRIGHT_BROWSERS_PATH`), set
`PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1` before installing; the script falls back to
a system Chromium path when it finds one.

## AI-generated source assets

The pipeline this page demonstrates is: generate the look with an image model,
then rebuild it as real-time geometry and shaders instead of shipping the frames.
What is committed here is the second half — the reconstruction. Every visual is
procedural, which is why the texture budget is zero.

To reconstruct from generated keyframes instead, the substitution points are
`envTexture()` in `src/gen/textures.js` (the reflected environment) and the
palette uniforms in `src/objects/nebula.js` (the sky grade). Both are small
enough that a compressed AVIF keyframe would still leave the page under 300 KB
gzipped — but sampling a generated plate costs more bytes than the noise function
that replaced it, so the procedural route won on both size and controllability.

## Layout

```
src/
  main.js              frame loop, station gating, adaptive DPR
  rig.js               camera + aim splines
  scroll.js            scroll → smoothed timeline + velocity
  ui.js                copy panels, progress rail, HUD
  gfx/post.js          bright pass, blur, composite
  gfx/fullscreen.js    fullscreen-triangle helper
  gen/textures.js      weave, environment, dither
  gen/noise.glsl.js    simplex + fbm chunk shared by every shader
  tier.js              one boot-time quality decision
  objects/             nebula, cloth, field, monolith
scripts/
  size-report.mjs      raw / gzip / brotli per file
  verify.mjs           headless render check
```
