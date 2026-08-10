# A history in plastic

Fifteen Nintendo machines, 1989 to 2025, modelled from primitives and rendered
live in the browser as you scroll. No photographs, no downloaded textures, no
video.

**573 KB on disk / 152 KB gzipped** (126 KB brotli), of which three.js is the overwhelming
majority. All fifteen machines, the backdrop, the environment map and the film
grade together add a handful of KB.

```
npm install
npm run dev       # http://localhost:5173
npm run build
npm run size      # per-file raw / gzip / brotli report
```

## What is on the page

Fifteen machines, chronological, both product lines interleaved — which is the
story: two separate families running in parallel for twenty-eight years, and
then the Switch collapsing them into one.

| | Machine | Year | Real size |
| --- | --- | --- | --- |
| 01 | Game Boy | 1989 | 90 × 148 × 32 mm |
| 02 | Super Famicom | 1990 | 200 × 72 × 242 mm |
| 03 | Nintendo 64 | 1996 | 260 × 73 × 190 mm |
| 04 | Game Boy Color | 1998 | 78 × 133 × 27 mm |
| 05 | Game Boy Advance | 2001 | 144 × 82 × 24 mm |
| 06 | GameCube | 2001 | 150 × 110 × 161 mm |
| 07 | Game Boy Advance SP | 2003 | 82 × 84.6 mm folded |
| 08 | Nintendo DS | 2004 | 148 × 84 mm per half |
| 09 | Nintendo DS Lite | 2006 | 133 × 73.9 mm per half |
| 10 | Wii | 2006 | 44 × 157 × 215 mm |
| 11 | Nintendo 3DS | 2011 | 134 × 74 mm per half |
| 12 | Wii U | 2012 | 172 × 46 × 269 mm, plus the GamePad |
| 13 | New Nintendo 3DS | 2014 | 142 × 80.6 mm per half |
| 14 | Nintendo Switch | 2017 | 239 × 102 mm across the Joy-Con |
| 15 | Nintendo Switch 2 | 2025 | 272 × 116 mm, in its dock |

Everything is drawn at **one scale — 1 unit to 40 mm** — so the sizes are true
against each other. A Game Boy really is a fifth the width of a Nintendo 64, the
Wii really is that slight beside it, and the DS Lite really is that much
smaller than the DS it replaced.

Which creates a framing problem the models are not allowed to solve: a handheld
at true scale is too small to read at the distance that suits a home console. So
each entry carries a `view` factor and **the camera steps closer** instead — the
geometry never lies about size.

## What these models are, and are not

They are **likenesses of the industrial design** — proportions, silhouettes,
colours, the details that make each one recognisable at a glance. They are built
from three primitives (a rounded slab, a rounded loop, a cylinder), because that
is genuinely what most consumer plastic is.

They are **not** reproductions, and the page carries **no logos, no wordmarks, no
interfaces and no artwork**. The screens show an abstract gradient; the Switch 2
dock face is deliberately blank. Nintendo, Super Famicom, Nintendo 64, GameCube,
Wii, Wii U, Game Boy, Nintendo DS, Nintendo 3DS and Nintendo Switch are
trademarks of Nintendo. This is an unofficial
rendering exercise with no affiliation.

The sales figures in the copy are the widely published lifetime numbers and are
worth checking against Nintendo's own consolidated sales data before this goes
anywhere public.

## How it is built

**Nothing is downloaded.** Every texture is a function:

- The **environment map** reflected in every plastic surface is a 1024×512
  canvas — a horizon gradient and three softbox lights — sampled
  equirectangularly with a three-tap spread standing in for roughness. That
  skips PMREM entirely.
- **Grain and dither** share one 64² noise texture, sampled once per pixel in
  the composite pass, monochrome and weighted toward the shadows the way
  emulsion is.
- The **backdrop** is domain-warped fbm on an inverted icosahedron, held well
  down in exposure. It takes its hue from whichever console is currently the
  subject, so the room changes colour as the lineup moves through the eras.

**One material for all fifteen.** A half-Lambert plastic shader with an
equirectangular reflection, a Fresnel term and a metallic switch, cached by
appearance so the whole lineup shares a handful of programs.

**The camera runs a side aisle.** The obvious layout — a viewing position
squarely in front of each console — cannot work, because the path from one
viewing point to the next runs straight through the console you just looked at.
Offsetting the whole track sideways fixes that and is the better shot anyway:
every console is approached, passed and left behind at an angle. Each one turns
to follow the camera, but only 88% of the way, so the residual angle keeps the
parallax alive.

**Position and aim are walked in parameter space, not by arc length.**
`getPointAt()` spaces samples evenly along each curve's own length, and two
curves of different lengths desynchronise — by the middle of the page the lens
was pointing several units short of its subject. `getPoint()` maps `t` across
the control points, which are one-to-one between the two arrays, so the aim is
pinned to its console by construction. It also makes the station times exact
rather than sampled.

**The copy is timed from the camera, not typed.** Each panel's window is derived
from the parameterisation at boot, so adding an eighth console cannot leave the
captions behind.

**Post is hand-rolled** rather than `EffectComposer` + `UnrealBloomPass`: scene →
HDR target → soft-knee bright pass → separable blur ping-pongs at quarter
resolution → composite with ACES, lateral chromatic aberration, vignette and
grain. Seven to nine passes depending on tier, ~4 KB of GLSL.

**Colour management is manual.** Linear half-float target, all generated
textures tagged `NoColorSpace`, hex colours decoded from sRGB where they are
authored, transfer function applied once in the composite.

## Phones and tablets

**The frame reframes itself.** The shot list was blocked for 16:9. A perspective
camera holds its *vertical* field of view fixed, so on a 9:19.5 phone the
horizontal view collapses to a quarter of what was composed. `framing()` in
`src/rig.js` corrects it continuously from the aspect ratio — no breakpoints —
with the work split three ways, because any one alone has a cost:

| | laptop | phone portrait |
| --- | --- | --- |
| Lens widening | 1.00× | 1.40× |
| Dolly back | 1.00× | 1.40× |
| Subject lift | 0 | 14% of frame height |

Widening alone distorts; dollying alone shrinks everything against a tall frame.
The lift raises each subject out of the lower third so the copy — which anchors
to the bottom on phones — never lands on top of it. Past roughly 2:1 the copy
sits *beside* the subject instead, so the lift becomes a horizontal shift.

**Quality tiers.** `src/tier.js` makes one decision at boot from pointer
coarseness, short-edge length and core count. Not a breakpoint: a 1024-wide
tablet and a 1024-wide window on a workstation want different budgets and CSS
cannot tell them apart. The low tier halves the dust motes, drops a bloom blur
pair, and caps DPR at 1.5 rather than honouring a phone's reported 3.

CSS breakpoints at 900 / 720 / 640 / 380 px plus a landscape-under-520px rule
handle type and chrome only.

Also handled: `prefers-reduced-motion`, tab visibility, WebGL context loss and
restore, iOS URL-bar resize thrash, and a text fallback when WebGL is
unavailable.

## Tests and CI

```
npm test        # node --test, no framework, no dependencies
```

The suite covers the parts that are provable without a GPU: the rounded-slab
and loop builders measure their requested outside dimensions (including the
degenerate cases — a slab thinner than its own chamfer, a corner radius larger
than the slab), the scroll easing curves clamp and stay monotonic, the station
times are evenly spaced with room at both ends for the intro and outro copy,
the lineup is chronological, and the quality tier picks correctly for a phone,
a tablet, a four-core laptop and a two-core machine.

Two source changes exist for this: the environment map is built on first use
rather than at import, so the geometry helpers can be imported outside a
browser, and `detectTier()` takes its three signals as optional arguments so
both tiers can be exercised without depending on the core count of whatever is
running the suite.

`.github/workflows/ci.yml` runs `npm test`, `npm run build` and `npm run size`
on pull requests only. It sets `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD` because
Playwright is a dev dependency of the render check below, which needs a real
browser and does not run in CI.

## Verifying rendering

`scripts/verify.mjs` drives headless Chromium through a list of scroll
positions, waits for the smoothed timeline to converge *and* for real frames to
render, screenshots, and reports frame time, draw calls, triangle count and any
console output.

```
npm run build
npm run preview &
node scripts/verify.mjs                      # every station
STOPS=0,0.5,1 OUT=shots node scripts/verify.mjs
VIEWPORT=390x844 MOBILE=1 node scripts/verify.mjs
REDUCED=1 node scripts/verify.mjs
```

Playwright is a dev dependency and only this script needs it. If your
environment already has a Chromium (`PLAYWRIGHT_BROWSERS_PATH`), set
`PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1` before installing; the script falls back to
a system Chromium path when it finds one.

## Layout

```
src/
  main.js              frame loop, panel timing, adaptive DPR
  rig.js               camera + aim splines, aspect framing
  scroll.js            scroll → smoothed timeline + velocity
  ui.js                copy panels, progress rail, HUD
  tier.js              one boot-time quality decision
  gfx/post.js          bright pass, blur, composite
  gfx/fullscreen.js    fullscreen-triangle helper
  gen/textures.js      environment map, dither
  gen/noise.glsl.js    simplex + fbm chunk shared by every shader
  objects/kit.js       rounded slab / loop / cylinder, plastic material
  objects/consoles.js  the fifteen builders and the lineup
  objects/nebula.js    backdrop and dust
scripts/
  size-report.mjs      raw / gzip / brotli per file
  verify.mjs           headless render check
test/
  geometry.test.js     slab and loop dimensions, degenerate cases
  timeline.test.js     easing curves, station spacing, lineup invariants
  tier.test.js         quality tier decisions
```
