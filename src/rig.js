import { CatmullRomCurve3, PerspectiveCamera, Vector3 } from 'three';
import { CONSOLES, FIRST_Z, SPACING } from './objects/consoles.js';

/**
 * The camera travels a side aisle, not the centre line.
 *
 * The obvious layout — a viewing position squarely in front of each console —
 * cannot work: the path from one viewing point to the next runs straight
 * through the console you just looked at, and the lens ends up inside a
 * Super Famicom. Offsetting the whole track sideways fixes that and is the
 * better shot anyway, because every console is approached, passed and left
 * behind at an angle instead of being presented flat on.
 *
 * Position and aim ride separate splines, and both are derived from the console
 * positions rather than hand-typed, so adding an eighth console cannot
 * desynchronise the camera from the lineup.
 */
const AISLE_X = -9.5;    // how far to the side the track runs
const LEAD_Z = 3;        // how far short of each console its viewing point sits

const consoleZ = (i) => FIRST_Z - i * SPACING;
const viewZ = (i) => consoleZ(i) + LEAD_Z;

const PATH = new CatmullRomCurve3(
  [
    // A long approach. The opening title needs a stretch of timeline with no
    // console in it, and the only way to buy that is distance.
    new Vector3(AISLE_X + 5.0, 3.2, 44),
    new Vector3(AISLE_X + 2.0, 2.4, 20),
    ...CONSOLES.map((c, i) =>
      new Vector3(AISLE_X - (i % 2) * 2.0, 1.4 + (i % 3) * 0.55, viewZ(i))
    ),
    // Pull up and away for the closing wide shot, with the same slack at this
    // end so the last panel is not fighting the last console.
    new Vector3(AISLE_X - 2.0, 4.4, consoleZ(CONSOLES.length - 1) - 14),
    new Vector3(AISLE_X - 3.0, 7.0, consoleZ(CONSOLES.length - 1) - 32),
  ],
  false,
  'catmullrom',
  0.25
);

const AIM = new CatmullRomCurve3(
  [
    new Vector3(0, 1.8, 26),
    new Vector3(0, 1.5, 9),
    ...CONSOLES.map((c, i) => new Vector3(c.offsetX || 0, c.aimY, consoleZ(i))),
    // Drifting the aim left pushes the subject right, off the closing copy.
    new Vector3(-2.2, 1.9, consoleZ(CONSOLES.length - 1)),
    new Vector3(-3.2, 1.6, consoleZ(CONSOLES.length - 1) - 4),
  ],
  false,
  'catmullrom',
  0.25
);

/**
 * Both curves are walked in PARAMETER space, not by arc length.
 *
 * getPointAt() spaces samples evenly along each curve's own length. Run two
 * curves that way and they desynchronise: the aim spline is shorter than the
 * position spline, so by the middle of the page the lens was pointing several
 * units short of the console it was supposed to be framing, and the subject
 * slid off the edge of the frame.
 *
 * getPoint() maps t across the control points instead. The two arrays are the
 * same length and correspond one-to-one, so control point i is reached at the
 * same t on both — the aim is pinned to its console by construction. The cost
 * is that travel speed varies slightly with control point spacing, which here
 * is near enough uniform to be invisible.
 */
const LEAD_POINTS = 2;
const SEGMENTS = LEAD_POINTS + CONSOLES.length + 2 - 1;

/** Exactly where each console is framed, straight from the parameterisation. */
export function stationTimes() {
  return CONSOLES.map((c, i) => (LEAD_POINTS + i) / SEGMENTS);
}

/**
 * The shot list was blocked for a 16:9 frame. A perspective camera keeps its
 * VERTICAL field of view fixed, so on a 9:19.5 phone the horizontal view
 * collapses to a quarter of what was composed and every wide subject runs off
 * both edges.
 *
 * Three continuous corrections, no breakpoints. Splitting the work between
 * them matters — pure FOV widening distorts, pure dollying shrinks everything
 * against a tall frame.
 */
const REF_ASPECT = 16 / 9;

function framing(aspect) {
  const narrow = Math.min(3.5, Math.max(1, REF_ASPECT / aspect));
  return {
    fovScale: 1 + (narrow - 1) * 0.16, // 1.00 on a laptop, ~1.40 on a phone
    dolly: 1 + (narrow - 1) * 0.16,    // 1.00 on a laptop, ~1.40 on a phone
    // Fraction of the frame height to raise the subject by. A tall frame has to
    // hold both the subject and the copy, and the copy owns the bottom.
    lift: (narrow - 1) * 0.055,        // 0 on a laptop, ~0.14 on a phone
    // The mirror image of the lift. Past about 2:1 the copy stops sitting below
    // the subject and starts sitting beside it — landscape phones, and
    // ultrawide desktops for the same reason — so the subject slides right.
    shiftX: Math.min(0.18, Math.max(0, (aspect - 1.9) * 0.5)),
  };
}

export function createRig() {
  const camera = new PerspectiveCamera(40, 1, 0.1, 600);
  const pos = new Vector3();
  const aim = new Vector3();
  const pointer = { x: 0, y: 0, tx: 0, ty: 0 };

  // On a touch screen pointermove only fires mid-drag, so the parallax offset
  // latches wherever the finger left it and the camera stays skewed.
  const fine = matchMedia('(pointer: fine)');

  addEventListener(
    'pointermove',
    (e) => {
      if (!fine.matches) return;
      pointer.tx = (e.clientX / innerWidth) * 2 - 1;
      pointer.ty = (e.clientY / innerHeight) * 2 - 1;
    },
    { passive: true }
  );

  // A device can gain or lose a mouse mid-session; recentre when it does.
  fine.addEventListener('change', () => {
    pointer.tx = 0;
    pointer.ty = 0;
  });

  return {
    camera,
    update(t, time, velocity, handheld = 1) {
      const u = Math.min(1, Math.max(0, t));
      PATH.getPoint(u, pos);
      AIM.getPoint(u, aim);

      const { fovScale, dolly, lift, shiftX } = framing(camera.aspect);

      // Back off along the existing sight line, which keeps the composition and
      // the parallax between stations intact.
      pos.sub(aim).multiplyScalar(dolly).add(aim);

      // Lateral drift is in world units, so a narrow frame magnifies it.
      const sway = 1 / dolly;

      // The lens tightens slightly as the lineup approaches the present day.
      const fov = (44 - 8 * t + Math.min(Math.abs(velocity) * 5, 3)) * fovScale;

      // Aiming off the subject renders it toward the opposite edge. Converting
      // these from fractions of the frame to world units needs the working
      // distance, so it happens after the dolly and after the focal length.
      if (lift > 0 || shiftX > 0) {
        const dist = pos.distanceTo(aim);
        const halfH = dist * Math.tan((fov * Math.PI) / 360);
        aim.y -= lift * 2 * halfH;
        aim.x -= shiftX * 2 * halfH * camera.aspect;
      }

      pointer.x += (pointer.tx - pointer.x) * 0.05;
      pointer.y += (pointer.ty - pointer.y) * 0.05;

      // Operator breathing: three incommensurate frequencies so the drift never
      // visibly loops.
      const bx = (Math.sin(time * 0.41) * 0.5 + Math.sin(time * 0.97) * 0.22) * 0.20 * handheld;
      const by = (Math.cos(time * 0.33) * 0.5 + Math.sin(time * 1.21) * 0.18) * 0.14 * handheld;

      camera.position.set(
        pos.x + (bx + pointer.x * 0.8) * sway,
        pos.y + (by - pointer.y * 0.45) * sway,
        pos.z
      );
      camera.lookAt(aim.x + pointer.x * 0.5 * sway, aim.y - pointer.y * 0.3 * sway, aim.z);

      // A whisper of roll, driven by scroll velocity. Reads as momentum.
      camera.rotation.z += Math.sin(time * 0.29) * 0.010 * handheld - velocity * 0.06;

      if (Math.abs(camera.fov - fov) > 0.01) {
        camera.fov = fov;
        camera.updateProjectionMatrix();
      }
    },
  };
}
