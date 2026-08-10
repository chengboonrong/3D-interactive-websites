import { AdditiveBlending, CircleGeometry, Group, Mesh, ShaderMaterial, Vector3 } from 'three';
import { disc, kitUniforms, loop, part, plastic, screen, slab } from './kit.js';

/**
 * Seven Nintendo home consoles, 1990 to 2025, modelled from primitives.
 *
 * These are likenesses of the industrial design — proportions, silhouettes and
 * colours — not reproductions. No logos, no wordmarks, no interfaces, no
 * artwork. Everything is generated at boot; nothing is downloaded.
 *
 * All seven share one scale (1 unit = 40 mm), so the lineup is honest about
 * relative size. The Wii really is that small next to the Nintendo 64.
 */

// A slab is authored as a plate in XY and extruded in Z. Laying it down maps
// (w, h, d) to (width, depth, height), which is how you think about a console
// sitting on a shelf.
const LIE = [-Math.PI / 2, 0, 0];

/* ── 1990 · Super Famicom ─────────────────────────────────────────────────── */

function superFamicom() {
  const g = new Group();
  const body = plastic('#dcd9ce', { rough: 0.5 });
  const grey = plastic('#8b8b9c', { rough: 0.45 });
  const dark = plastic('#26262b', { rough: 0.6 });

  // 200 x 72 x 242 mm
  part(g, slab(5.0, 6.05, 1.3, 0.32), body, [0, 0.65, 0], LIE);

  // The raised rear deck with its rounded shoulder is the whole silhouette.
  part(g, slab(4.75, 3.1, 0.62, 0.3), body, [0, 1.6, -1.35], LIE);
  part(g, disc(0.31, 4.75, 14), body, [0, 1.6, -2.86], [0, 0, Math.PI / 2]);

  // Cartridge slot, recessed.
  part(g, slab(2.7, 1.55, 0.14, 0.06), dark, [0, 1.94, -1.5], LIE);

  // Eject button and the sliding power switch, front left of the top face.
  part(g, slab(0.95, 0.42, 0.16, 0.1), grey, [-1.45, 1.36, 1.72], LIE);
  part(g, slab(0.62, 0.38, 0.16, 0.1), grey, [-0.35, 1.36, 1.72], LIE);
  part(g, disc(0.07, 0.06, 10), plastic('#ff4436', { rough: 0.3 }), [1.7, 1.32, 1.75]);

  // Two controller ports on the front face.
  for (const x of [-1.15, 1.15]) {
    part(g, slab(0.92, 0.5, 0.14, 0.2), dark, [x, 0.6, 3.0]);
  }

  return { group: g, radius: 3.6 };
}

/* ── 1996 · Nintendo 64 ───────────────────────────────────────────────────── */

function nintendo64() {
  const g = new Group();
  const body = plastic('#34343b', { rough: 0.42 });
  const dark = plastic('#17171b', { rough: 0.55 });

  // 260 x 73 x 190 mm. Generous corner radii stand in for the taper.
  part(g, slab(6.5, 4.75, 1.45, 0.75), body, [0, 0.72, 0], LIE);

  // Rear deck carrying the cartridge slot.
  part(g, slab(4.4, 2.1, 0.6, 0.4), body, [0, 1.72, -1.2], LIE);
  part(g, slab(2.55, 1.35, 0.14, 0.06), dark, [0, 2.05, -1.25], LIE);

  // Memory expansion door, front centre of the top face.
  part(g, slab(1.55, 1.25, 0.1, 0.12), plastic('#2a2a30', { rough: 0.5 }), [0, 1.47, 1.0], LIE);

  // Four controller ports — the thing everyone remembers about this one.
  for (const x of [-2.05, -0.68, 0.68, 2.05]) {
    part(g, slab(0.86, 0.46, 0.16, 0.2), dark, [x, 0.52, 2.36]);
  }
  part(g, disc(0.07, 0.06, 10), plastic('#ff3b2f', { rough: 0.3 }), [-2.75, 1.2, 2.0]);

  return { group: g, radius: 3.7 };
}

/* ── 2001 · Nintendo GameCube ─────────────────────────────────────────────── */

function gameCube() {
  const g = new Group();
  const body = plastic('#5b5896', { rough: 0.34 });
  const lid = plastic('#4c4a83', { rough: 0.3 });
  const dark = plastic('#1e1e25', { rough: 0.55 });

  // 150 x 110 x 161 mm — very nearly a cube, which was the point.
  part(g, slab(3.75, 4.03, 2.45, 0.36), body, [0, 1.22, 0], LIE);

  // Disc lid, its circular recess and the little release button.
  part(g, slab(3.3, 3.55, 0.16, 0.3), lid, [0, 2.52, 0], LIE);
  part(g, disc(1.24, 0.07, 28), plastic('#443F76', { rough: 0.28 }), [0, 2.62, -0.1]);
  part(g, disc(0.17, 0.09, 12), plastic('#c9c9cf', { rough: 0.35 }), [0, 2.63, 1.45]);

  // The carrying handle.
  part(g, loop(0.95, 1.55, 0.24, 0.34, 0.34), body, [0, 1.35, -2.2]);

  // Controller ports and memory card slots.
  for (const x of [-1.05, -0.35, 0.35, 1.05]) {
    part(g, slab(0.52, 0.42, 0.14, 0.16), dark, [x, 0.95, 2.0]);
  }
  for (const x of [-0.62, 0.62]) {
    part(g, slab(0.9, 0.22, 0.12, 0.06), dark, [x, 0.35, 2.0]);
  }

  return { group: g, radius: 3.0 };
}

/* ── 2006 · Wii ───────────────────────────────────────────────────────────── */

function wii() {
  const g = new Group();
  const body = plastic('#f3f2ea', { rough: 0.36 });
  const grey = plastic('#b9b9b3', { rough: 0.45 });
  const dark = plastic('#1c1c20', { rough: 0.5 });

  // 44 x 157 x 215.4 mm, stood on its edge on the supplied cradle.
  const base = 0.2;
  part(g, slab(1.1, 3.93, 5.39, 0.16), body, [0, base + 1.97, 0]);

  // Slot-loading drive, and the blue ring that made it feel expensive.
  part(g, slab(0.07, 3.05, 0.05, 0.02), dark, [0, base + 2.2, 2.71]);
  part(g, slab(0.14, 3.15, 0.02, 0.05), screen('#7fd4ff', '#1b6fae'), [0, base + 2.2, 2.69]);

  for (const y of [0.62, 1.05]) {
    part(g, slab(0.42, 0.3, 0.06, 0.06), grey, [0, base + y, 2.71]);
  }

  // Cradle.
  const stand = part(g, disc(1.55, 0.2, 26), grey, [0, base / 2, 0]);
  stand.scale.set(1, 1, 1.35);

  return { group: g, radius: 3.1 };
}

/* ── 2012 · Wii U ─────────────────────────────────────────────────────────── */

function wiiU() {
  const g = new Group();
  const body = plastic('#f2f1e9', { rough: 0.36 });
  const dark = plastic('#25252a', { rough: 0.5 });
  const grey = plastic('#c6c6c0', { rough: 0.4 });

  // Console: 172 x 46 x 268.5 mm, set back and to one side.
  const c = new Group();
  c.position.set(1.75, 0.58, -1.7);
  part(c, slab(4.3, 6.71, 1.15, 0.5), body, [0, 0, 0], LIE);
  part(c, slab(2.9, 0.09, 0.05, 0.04), dark, [0, 0.04, 3.34]);
  g.add(c);

  // GamePad: 255 x 133 x 23 mm, propped in front. The second screen is the
  // whole story of this generation, so it faces the camera.
  const pad = new Group();
  pad.position.set(-1.55, 1.3, 1.35);
  pad.rotation.set(-0.38, 0.16, 0);
  part(pad, slab(6.38, 3.33, 0.58, 0.55), body);
  part(pad, slab(3.5, 2.05, 0.06, 0.06), dark, [0, 0.05, 0.28]);
  part(pad, slab(3.34, 1.92, 0.04, 0.04), screen('#63c7ff', '#12385f'), [0, 0.05, 0.31]);

  for (const x of [-2.42, 2.42]) {
    part(pad, disc(0.3, 0.16, 14), grey, [x, 0.72, 0.28], [Math.PI / 2, 0, 0]);
  }
  for (const [x, y] of [[-2.42, -0.55], [2.42, -0.62], [2.42, 0.0], [2.9, -0.31], [1.94, -0.31]]) {
    part(pad, disc(0.14, 0.12, 10), grey, [x, y, 0.28], [Math.PI / 2, 0, 0]);
  }
  g.add(pad);

  return { group: g, radius: 4.2 };
}

/* ── Hybrid tablets ───────────────────────────────────────────────────────── */

/**
 * The Switch and the Switch 2 are the same object at two sizes with different
 * Joy-Con colours, so they are built by one function. The second generation
 * grew 33 mm wider and swapped the neon rails for a dark grey with an accent
 * on the inner face.
 */
function tablet({ width, height, railWidth, leftHex, rightHex, accentL, accentR }) {
  const g = new Group();
  const shell = plastic('#212126', { rough: 0.3 });
  const bezel = plastic('#141417', { rough: 0.45 });
  const grey = plastic('#4a4a52', { rough: 0.4 });

  const core = width - railWidth * 2;
  part(g, slab(core, height, 0.35, 0.14), shell);
  part(g, slab(core - 0.28, height - 0.3, 0.04, 0.06), bezel, [0, 0, 0.17]);
  part(g, slab(core - 0.42, height - 0.44, 0.03, 0.05), screen('#8ad8ff', '#101c33'), [0, 0, 0.2]);

  const rails = [
    { x: -(core + railWidth) / 2, hex: leftHex, accent: accentL, stickY: 0.52 },
    { x: (core + railWidth) / 2, hex: rightHex, accent: accentR, stickY: -0.52 },
  ];

  for (const r of rails) {
    const rail = plastic(r.hex, { rough: 0.32 });
    part(g, slab(railWidth, height, 0.35, railWidth * 0.42), rail, [r.x, 0, 0]);

    // Accent strip on the inner face — how the second generation carries its
    // colour now that the shells are grey.
    if (r.accent) {
      part(g, slab(0.07, height - 0.5, 0.26, 0.03), plastic(r.accent, { rough: 0.25 }),
        [r.x + Math.sign(-r.x) * (railWidth / 2 - 0.02), 0, 0]);
    }

    part(g, disc(0.19, 0.12, 12), grey, [r.x, r.stickY, 0.2], [Math.PI / 2, 0, 0]);
  }

  // Face buttons and d-pad, four each.
  const right = rails[1].x;
  for (const [dx, dy] of [[0, 0.42], [0, -0.24], [-0.2, 0.09], [0.2, 0.09]]) {
    part(g, disc(0.085, 0.1, 8), grey, [right + dx, dy + 0.28, 0.2], [Math.PI / 2, 0, 0]);
  }
  const left = rails[0].x;
  for (const [dx, dy] of [[0, -0.28], [0, -0.92], [-0.2, -0.6], [0.2, -0.6]]) {
    part(g, disc(0.075, 0.1, 8), grey, [left + dx, dy, 0.2], [Math.PI / 2, 0, 0]);
  }

  return g;
}

/* ── 2017 · Nintendo Switch ───────────────────────────────────────────────── */

function nintendoSwitch() {
  const g = new Group();
  // 239 x 102 mm across the Joy-Con.
  const t = tablet({
    width: 5.98,
    height: 2.55,
    railWidth: 0.79,
    leftHex: '#00b7dd',
    rightHex: '#ff4554',
  });
  t.position.y = 1.55;
  t.rotation.set(-0.06, 0.1, 0);
  g.add(t);

  // Kickstand, folded out behind.
  part(g, slab(1.1, 1.5, 0.06, 0.06), plastic('#2a2a30', { rough: 0.45 }),
    [1.4, 0.9, -0.55], [-1.15, 0, 0]);

  return { group: g, radius: 3.4 };
}

/* ── 2025 · Nintendo Switch 2 ─────────────────────────────────────────────── */

function nintendoSwitch2() {
  const g = new Group();
  const dockShell = plastic('#3d3d44', { rough: 0.55 });

  // 272 x 116 mm across the Joy-Con — 33 mm wider than the original.
  const t = tablet({
    width: 6.8,
    height: 2.9,
    railWidth: 0.8,
    leftHex: '#3a3a41',
    rightHex: '#3a3a41',
    accentL: '#1fa8e0',
    accentR: '#ff5a3c',
  });
  t.position.set(0, 2.8, 0);
  t.rotation.set(-0.05, 0, 0);
  g.add(t);

  // Dock: a rounded front panel that swallows the lower half of the console,
  // on a slim foot. Deliberately blank — no marks.
  part(g, slab(5.5, 2.85, 1.9, 0.65), dockShell, [0, 1.5, -0.25]);
  part(g, slab(5.7, 2.2, 0.4, 0.16), dockShell, [0, 0.2, -0.25], LIE);
  part(g, slab(0.5, 0.1, 0.05, 0.03), plastic('#16161a', { rough: 0.5 }), [-2.1, 0.38, 0.73]);

  return { group: g, radius: 3.8 };
}

/* ── Handhelds ────────────────────────────────────────────────────────────── */

/**
 * These are genuinely small — a Game Boy is 90 mm across, a fifth of the width
 * of a Nintendo 64 — and the scene keeps them at true scale. Rather than cheat
 * the models, each carries a `view` factor and the camera simply steps closer.
 */

/** Cross-shaped d-pad, facing +Z. */
function dpad(g, material, [x, y, z], size = 0.62, arm = 0.2, depth = 0.09) {
  part(g, slab(size, arm, depth, 0.04), material, [x, y, z]);
  part(g, slab(arm, size, depth, 0.04), material, [x, y, z]);
}

/** Two face buttons on the diagonal, the way every Game Boy laid them out. */
function abButtons(g, material, [x, y, z], r = 0.15) {
  part(g, disc(r, 0.1, 12), material, [x, y, z], [Math.PI / 2, 0, 0]);
  part(g, disc(r, 0.1, 12), material, [x + r * 1.9, y + r * 1.15, z], [Math.PI / 2, 0, 0]);
}

/* ── 1989 · Game Boy ──────────────────────────────────────────────────────── */

function gameBoy() {
  const g = new Group();
  const body = plastic('#d1cfc4', { rough: 0.55 });
  const bezel = plastic('#4b4b52', { rough: 0.5 });
  const dark = plastic('#33333a', { rough: 0.55 });
  const magenta = plastic('#8e1f5c', { rough: 0.4 });
  const grey = plastic('#8d8d86', { rough: 0.5 });

  // 90 x 148 x 32 mm, stood upright.
  const cy = 1.85;
  part(g, slab(2.25, 3.7, 0.8, 0.18), body, [0, cy, 0]);

  // The recessed screen surround and its famous olive LCD.
  part(g, slab(1.66, 1.46, 0.08, 0.1), bezel, [0, cy + 0.87, 0.4]);
  part(g, slab(1.18, 1.06, 0.03, 0.03), screen('#c2d84b', '#6d8b12'), [0, cy + 0.87, 0.44]);

  dpad(g, dark, [-0.6, cy - 0.5, 0.42]);
  abButtons(g, magenta, [0.5, cy - 0.62, 0.42]);

  // Start and select, angled, below the middle.
  for (const dx of [-0.2, 0.2]) {
    part(g, slab(0.42, 0.14, 0.08, 0.06), grey, [dx, cy - 1.18, 0.42], [0, 0, -0.32]);
  }

  // Speaker grille, bottom right, on the diagonal.
  for (let i = 0; i < 6; i++) {
    part(g, disc(0.045, 0.05, 8), bezel,
      [0.42 + (i % 3) * 0.16, cy - 1.5 + Math.floor(i / 3) * 0.16, 0.41], [Math.PI / 2, 0, 0]);
  }

  return { group: g, radius: 1.6 };
}

/* ── 1998 · Game Boy Color ────────────────────────────────────────────────── */

function gameBoyColor() {
  const g = new Group();
  const body = plastic('#6b4fa3', { rough: 0.32 });
  const bezel = plastic('#2c2c33', { rough: 0.5 });
  const dark = plastic('#26262c', { rough: 0.55 });
  const buttons = plastic('#3a3a44', { rough: 0.4 });

  // 78 x 133 x 27 mm — narrower and squarer than the original.
  const cy = 1.67;
  part(g, slab(1.95, 3.33, 0.68, 0.24), body, [0, cy, 0]);

  part(g, slab(1.54, 1.36, 0.07, 0.1), bezel, [0, cy + 0.76, 0.34]);
  part(g, slab(1.26, 1.12, 0.03, 0.03), screen('#9fe3ff', '#1d4c7a'), [0, cy + 0.76, 0.38]);

  // Round d-pad cradle, which is what actually changed on the face.
  part(g, disc(0.32, 0.06, 16), bezel, [-0.46, cy - 0.5, 0.35], [Math.PI / 2, 0, 0]);
  dpad(g, dark, [-0.46, cy - 0.5, 0.4], 0.48, 0.16, 0.07);
  abButtons(g, buttons, [0.4, cy - 0.62, 0.36], 0.14);

  for (const dx of [-0.16, 0.16]) {
    part(g, slab(0.36, 0.12, 0.07, 0.05), buttons, [dx, cy - 1.1, 0.36], [0, 0, -0.3]);
  }

  return { group: g, radius: 1.5 };
}

/* ── 2001 · Game Boy Advance ──────────────────────────────────────────────── */

function gameBoyAdvance() {
  const g = new Group();
  const body = plastic('#464b96', { rough: 0.34 });
  const bezel = plastic('#22222a', { rough: 0.5 });
  const dark = plastic('#26262e', { rough: 0.55 });

  // 144 x 82 x 24 mm — the first one you held sideways.
  const face = new Group();
  face.position.y = 1.25;
  face.rotation.x = -0.3;

  part(face, slab(3.6, 2.05, 0.6, 0.55), body);
  part(face, slab(2.0, 1.46, 0.06, 0.08), bezel, [0, 0.06, 0.31]);
  part(face, slab(1.76, 1.26, 0.03, 0.03), screen('#a5e7ff', '#1c4468'), [0, 0.06, 0.34]);

  dpad(face, dark, [-1.26, -0.06, 0.32], 0.56, 0.18, 0.08);
  abButtons(face, plastic('#3b3f7e', { rough: 0.4 }), [1.18, -0.16, 0.32], 0.16);

  // Shoulder buttons, wrapped over the top edge.
  for (const x of [-1.5, 1.5]) {
    part(face, slab(0.62, 0.22, 0.3, 0.1), body, [x, 1.0, -0.1]);
  }
  g.add(face);

  return { group: g, radius: 2.1 };
}

/* ── Clamshells ───────────────────────────────────────────────────────────── */

/**
 * The DS and the 3DS are the same hinge at two sizes. The lid opens to about
 * twenty degrees past vertical, which is roughly where people actually hold
 * them and the angle at which both screens are visible at once.
 */
function clamshell({ width, depth, thickness, shell, topScreen, bottomScreen, extras }) {
  const g = new Group();
  const body = plastic(shell, { rough: 0.34 });
  const dark = plastic('#1c1c22', { rough: 0.5 });

  // Base, lying flat.
  part(g, slab(width, depth, thickness, 0.18), body, [0, thickness / 2, 0], LIE);
  part(g, slab(bottomScreen[0], bottomScreen[1], 0.03, 0.04), dark,
    [0, thickness + 0.01, 0.12], LIE);
  part(g, slab(bottomScreen[0] - 0.12, bottomScreen[1] - 0.12, 0.02, 0.03),
    screen('#cfe9ff', '#25506f'), [0, thickness + 0.03, 0.12], LIE);

  // Lid, hinged along the back edge.
  const lid = new Group();
  lid.position.set(0, thickness, -depth / 2 + 0.1);
  lid.rotation.x = -0.34;
  part(lid, slab(width, depth, thickness, 0.18), body, [0, depth / 2, 0]);
  part(lid, slab(topScreen[0], topScreen[1], 0.03, 0.04), dark, [0, depth / 2, thickness / 2 + 0.02]);
  part(lid, slab(topScreen[0] - 0.12, topScreen[1] - 0.12, 0.02, 0.03),
    screen('#bfe4ff', '#1d4467'), [0, depth / 2, thickness / 2 + 0.04]);
  g.add(lid);

  if (extras) extras(g, { body, dark, thickness, width, depth });
  return g;
}

/* ── 2004 · Nintendo DS ───────────────────────────────────────────────────── */

function nintendoDS() {
  const g = clamshell({
    width: 3.7,
    depth: 2.1,
    thickness: 0.35,
    shell: '#b7bac0',
    topScreen: [1.95, 1.48],
    bottomScreen: [1.95, 1.48],
    extras: (g, { dark, thickness }) => {
      dpad(g, dark, [-1.35, thickness + 0.04, 0.35], 0.42, 0.14, 0.06);
      // Four face buttons, laid out as a diamond.
      for (const [dx, dz] of [[0, -0.2], [0, 0.2], [-0.2, 0], [0.2, 0]]) {
        part(g, disc(0.09, 0.07, 10), dark, [1.35 + dx, thickness + 0.05, 0.35 + dz]);
      }
    },
  });
  return { group: g, radius: 2.2 };
}

/* ── 2011 · Nintendo 3DS ──────────────────────────────────────────────────── */

function nintendo3DS() {
  const g = clamshell({
    width: 3.35,
    depth: 1.85,
    thickness: 0.32,
    shell: '#2a7fb8',
    // The top screen went widescreen for the stereoscopic effect; the bottom
    // stayed 4:3.
    topScreen: [2.55, 1.05],
    bottomScreen: [1.6, 1.22],
    extras: (g, { dark, thickness }) => {
      // Circle Pad above the d-pad — the addition that defined this one.
      part(g, disc(0.19, 0.09, 14), plastic('#d8dae0', { rough: 0.45 }),
        [-1.2, thickness + 0.05, -0.12]);
      dpad(g, dark, [-1.2, thickness + 0.04, 0.42], 0.34, 0.12, 0.05);
      for (const [dx, dz] of [[0, -0.18], [0, 0.18], [-0.18, 0], [0.18, 0]]) {
        part(g, disc(0.08, 0.07, 10), dark, [1.2 + dx, thickness + 0.05, 0.2 + dz]);
      }
    },
  });
  return { group: g, radius: 2.0 };
}

/* ── The lineup ───────────────────────────────────────────────────────────── */

const GLOW_FRAG = /* glsl */ `
precision mediump float;
uniform vec3 uColor;
varying vec2 vUv;
void main(){
  float d = length(vUv - 0.5) * 2.0;
  float a = pow(max(1.0 - d, 0.0), 2.6);
  gl_FragColor = vec4(uColor * a, a);
}
`;

const GLOW_VERT = /* glsl */ `
varying vec2 vUv;
void main(){
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

function glow(radius, hex) {
  const m = new Mesh(
    new CircleGeometry(radius, 28),
    new ShaderMaterial({
      vertexShader: GLOW_VERT,
      fragmentShader: GLOW_FRAG,
      uniforms: { uColor: { value: hexToVec(hex) } },
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
    })
  );
  m.rotation.x = -Math.PI / 2;
  m.position.y = 0.02;
  return m;
}

function hexToVec(hex) {
  const n = parseInt(hex.replace('#', ''), 16);
  const to = (v) => Math.pow(v / 255, 2.2);
  return new Vector3(to((n >> 16) & 255), to((n >> 8) & 255), to(n & 255));
}

/**
 * Chronological, one every SPACING units down -Z. Accent colours double as the
 * pool of light under each console and as the tint the sky takes on while that
 * console is the subject.
 */
/**
 * Chronological, both product lines interleaved — which is the story: two
 * separate families running in parallel for twenty-eight years, and then the
 * Switch collapsing them into one.
 *
 *   aimY    where the lens points, roughly the visual centre of the object
 *   view    how close the camera steps, as a fraction of the standard aisle.
 *           A Game Boy is a fifth the width of a Nintendo 64 and the scene
 *           keeps true scale, so the camera moves instead of the model.
 *   offsetX how far the object stands back from the aisle, for the wide ones
 */
export const CONSOLES = [
  { id: 'gb', build: gameBoy, accent: '#b7c86a', year: 1989, aimY: 1.9, view: 0.68 },
  { id: 'sfc', build: superFamicom, accent: '#9b8fd4', year: 1990, aimY: 1.2 },
  { id: 'n64', build: nintendo64, accent: '#4fa3d1', year: 1996, aimY: 1.1 },
  { id: 'gbc', build: gameBoyColor, accent: '#a071e0', year: 1998, aimY: 1.7, view: 0.66 },
  { id: 'gba', build: gameBoyAdvance, accent: '#6f77d8', year: 2001, aimY: 1.25, view: 0.72 },
  { id: 'gcn', build: gameCube, accent: '#7a76d8', year: 2001, aimY: 1.5 },
  { id: 'ds', build: nintendoDS, accent: '#9fb4c8', year: 2004, aimY: 1.15, view: 0.72 },
  { id: 'wii', build: wii, accent: '#7fd4ff', year: 2006, aimY: 2.1 },
  { id: '3ds', build: nintendo3DS, accent: '#46b0e8', year: 2011, aimY: 1.05, view: 0.7 },
  // The Wii U is two objects side by side and much wider than the rest, so it
  // stands further back from the aisle to frame at the same size.
  { id: 'wiiu', build: wiiU, accent: '#63b8ff', year: 2012, aimY: 1.4, offsetX: 3.4 },
  { id: 'switch', build: nintendoSwitch, accent: '#ff6a6a', year: 2017, aimY: 1.6 },
  { id: 'switch2', build: nintendoSwitch2, accent: '#ffa14f', year: 2025, aimY: 2.05 },
];

export const SPACING = 28;
export const FIRST_Z = -14;

export function createLineup() {
  const root = new Group();

  const items = CONSOLES.map((spec, i) => {
    const { group, radius } = spec.build();
    const holder = new Group();
    holder.position.set(spec.offsetX || 0, 0, FIRST_Z - i * SPACING);
    holder.add(group);
    holder.add(glow(radius * 1.5, spec.accent));
    root.add(holder);

    return {
      ...spec,
      index: i,
      holder,
      inner: group,
      position: holder.position.clone(),
      accentVec: hexToVec(spec.accent),
    };
  });

  return {
    root,
    items,
    /**
     * Consoles are gated on distance rather than on timeline windows: the
     * camera path is the source of truth for what is in front of the lens, and
     * a distance test cannot drift out of sync with it the way hand-tuned
     * ranges do.
     */
    update(time, camera) {
      kitUniforms.uTime.value = time;

      for (const item of items) {
        const dz = Math.abs(camera.position.z - item.position.z);
        const near = dz < SPACING * 1.6;
        item.holder.visible = near;
        if (!near) continue;

        // Each console turns to follow the camera down the aisle, but only
        // most of the way — a full lock-on looks static, and the residual angle
        // is what gives the pass-by its parallax. A free spin would be worse
        // still: half of every rotation is the back of a console.
        const yaw = Math.atan2(
          camera.position.x - item.position.x,
          camera.position.z - item.position.z
        );
        item.inner.rotation.y = yaw * 0.88 + Math.sin(time * 0.3 + item.index) * 0.12;
        item.inner.position.y = Math.sin(time * 0.55 + item.index * 1.7) * 0.07;
      }
    },
  };
}
