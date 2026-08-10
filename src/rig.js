import { CatmullRomCurve3, PerspectiveCamera, Vector3 } from 'three';

/**
 * Camera flight path. Position and aim ride separate splines so the lens can
 * lead or lag the motion — the single most effective trick for making a
 * scroll-driven move feel operated rather than interpolated.
 */
const PATH = new CatmullRomCurve3([
  new Vector3(0.0, 0.9, 14),
  new Vector3(2.4, 1.5, -2),
  new Vector3(-1.0, 1.2, -18),
  new Vector3(3.0, -0.4, -34),
  new Vector3(-2.2, 3.6, -54),
  new Vector3(2.8, 1.0, -78),
  new Vector3(-2.6, 1.8, -86),
  new Vector3(0.0, 1.0, -90),
], false, 'catmullrom', 0.25);

const AIM = new CatmullRomCurve3([
  new Vector3(0.0, 0.4, -6),
  new Vector3(-3.6, 0.7, -22),
  new Vector3(-8.4, 0.5, -37),
  new Vector3(-2.0, 0.0, -44),
  new Vector3(0.0, 0.0, -70),
  new Vector3(0.0, 0.4, -88),
  new Vector3(0.0, 0.6, -116),
  new Vector3(0.0, 0.6, -118),
], false, 'catmullrom', 0.25);

/**
 * The shot list was blocked for a 16:9 frame. A perspective camera keeps its
 * VERTICAL field of view fixed, so on a 9:19.5 phone the horizontal view
 * collapses to a quarter of what was composed and every wide subject — the
 * cloth above all — runs off both edges.
 *
 * Two continuous corrections, no breakpoints: widen the lens a little, and
 * dolly back a little. Splitting it between the two matters — pure FOV
 * widening distorts, pure dollying shrinks everything against the tall frame.
 */
const REF_ASPECT = 16 / 9;

function framing(aspect) {
  const narrow = Math.min(3.5, Math.max(1, REF_ASPECT / aspect));
  return {
    fovScale: 1 + (narrow - 1) * 0.16, // 1.00 on a laptop, ~1.40 on a phone
    dolly: 1 + (narrow - 1) * 0.16,    // 1.00 on a laptop, ~1.40 on a phone
    // Fraction of the frame height to raise the subject by. A tall frame has
    // to hold both the subject and the copy, and the copy owns the bottom, so
    // the subject moves up out of it rather than the type moving onto metal.
    lift: (narrow - 1) * 0.055,        // 0 on a laptop, ~0.14 on a phone
    // The mirror image of the lift. Past about 2:1 the copy stops sitting
    // below the subject and starts sitting beside it — landscape phones, and
    // ultrawide desktops for the same reason — so the subject slides right.
    shiftX: Math.min(0.18, Math.max(0, (aspect - 1.9) * 0.5)),
  };
}

export function createRig() {
  const camera = new PerspectiveCamera(42, 1, 0.1, 600);
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
      PATH.getPointAt(Math.min(0.9999, Math.max(0, t)), pos);
      AIM.getPointAt(Math.min(0.9999, Math.max(0, t)), aim);

      const { fovScale, dolly, lift, shiftX } = framing(camera.aspect);

      // Back off along the existing sight line, which keeps the composition
      // and the parallax between stations intact.
      pos.sub(aim).multiplyScalar(dolly).add(aim);

      // Lateral drift is in world units, so a narrow frame magnifies it.
      const sway = 1 / dolly;

      // The lens tightens as the sequence closes in on the monolith.
      const fov = (46 - 11 * t + Math.min(Math.abs(velocity) * 6, 4)) * fovScale;

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

      // Operator breathing: three incommensurate frequencies so the drift
      // never visibly loops.
      const bx = (Math.sin(time * 0.41) * 0.5 + Math.sin(time * 0.97) * 0.22) * 0.22 * handheld;
      const by = (Math.cos(time * 0.33) * 0.5 + Math.sin(time * 1.21) * 0.18) * 0.16 * handheld;

      camera.position.set(
        pos.x + (bx + pointer.x * 0.9) * sway,
        pos.y + (by - pointer.y * 0.5) * sway,
        pos.z
      );
      camera.lookAt(aim.x + pointer.x * 0.6 * sway, aim.y - pointer.y * 0.35 * sway, aim.z);

      // A whisper of roll, driven by scroll velocity. Reads as momentum.
      camera.rotation.z += Math.sin(time * 0.29) * 0.012 * handheld - velocity * 0.08;

      if (Math.abs(camera.fov - fov) > 0.01) {
        camera.fov = fov;
        camera.updateProjectionMatrix();
      }
    },
  };
}
