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

export function createRig() {
  const camera = new PerspectiveCamera(42, 1, 0.1, 600);
  const pos = new Vector3();
  const aim = new Vector3();
  const pointer = { x: 0, y: 0, tx: 0, ty: 0 };

  addEventListener(
    'pointermove',
    (e) => {
      pointer.tx = (e.clientX / innerWidth) * 2 - 1;
      pointer.ty = (e.clientY / innerHeight) * 2 - 1;
    },
    { passive: true }
  );

  return {
    camera,
    update(t, time, velocity, handheld = 1) {
      PATH.getPointAt(Math.min(0.9999, Math.max(0, t)), pos);
      AIM.getPointAt(Math.min(0.9999, Math.max(0, t)), aim);

      pointer.x += (pointer.tx - pointer.x) * 0.05;
      pointer.y += (pointer.ty - pointer.y) * 0.05;

      // Operator breathing: three incommensurate frequencies so the drift
      // never visibly loops.
      const bx = (Math.sin(time * 0.41) * 0.5 + Math.sin(time * 0.97) * 0.22) * 0.22 * handheld;
      const by = (Math.cos(time * 0.33) * 0.5 + Math.sin(time * 1.21) * 0.18) * 0.16 * handheld;

      camera.position.set(
        pos.x + bx + pointer.x * 0.9,
        pos.y + by - pointer.y * 0.5,
        pos.z
      );
      camera.lookAt(aim.x + pointer.x * 0.6, aim.y - pointer.y * 0.35, aim.z);

      // A whisper of roll, driven by scroll velocity. Reads as momentum.
      camera.rotation.z += Math.sin(time * 0.29) * 0.012 * handheld - velocity * 0.08;

      // The lens tightens as the sequence closes in on the monolith.
      const fov = 46 - 11 * t + Math.min(Math.abs(velocity) * 6, 4);
      if (Math.abs(camera.fov - fov) > 0.01) {
        camera.fov = fov;
        camera.updateProjectionMatrix();
      }
    },
  };
}
