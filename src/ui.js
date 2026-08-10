import { window4 } from './scroll.js';

/**
 * Copy panels are driven by the same timeline as the camera, so type and
 * motion can never drift apart the way scroll-triggered CSS eventually does.
 */
export function createUI() {
  const panels = [...document.querySelectorAll('.panel')].map((el) => ({
    el,
    in: parseFloat(el.dataset.in),
    out: parseFloat(el.dataset.out),
    last: -1,
  }));

  const fill = document.getElementById('railfill');
  const mFps = document.getElementById('m-fps');
  const mDraw = document.getElementById('m-draw');
  const mTri = document.getElementById('m-tri');

  let statsAt = 0;
  let frames = 0;
  let acc = 0;

  return {
    update(t, dt, info) {
      for (const p of panels) {
        const fadeIn = (p.out - p.in) * 0.35;
        const a = window4(t, p.in - fadeIn, p.in + fadeIn * 0.5, p.out - fadeIn * 0.5, p.out + fadeIn);
        if (Math.abs(a - p.last) < 0.002) continue;
        p.last = a;
        p.el.style.opacity = a.toFixed(3);
        p.el.style.visibility = a < 0.004 ? 'hidden' : 'visible';
        p.el.style.transform = `translate3d(0, ${((1 - a) * 26).toFixed(2)}px, 0)`;
      }

      fill.style.height = `${(t * 100).toFixed(2)}%`;

      frames++;
      acc += dt;
      statsAt += dt;
      if (statsAt >= 0.5) {
        mFps.textContent = Math.round(frames / acc);
        mDraw.textContent = info.calls;
        mTri.textContent = info.triangles > 9999
          ? `${(info.triangles / 1000).toFixed(1)}k`
          : info.triangles;
        statsAt = 0;
        frames = 0;
        acc = 0;
      }
    },
  };
}
