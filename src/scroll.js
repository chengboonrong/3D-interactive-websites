/**
 * Turns raw scroll position into a smoothed 0..1 timeline plus a velocity term.
 * Everything in the scene is a pure function of these two numbers, which is why
 * the page can be scrubbed backwards without any state falling out of sync.
 */
export function createTimeline() {
  const state = { raw: 0, value: 0, velocity: 0 };
  let last = 0;
  let max = 0;

  // Reading scrollHeight forces layout, so it is cached and only refreshed on
  // resize. Doing it inside the scroll handler costs a reflow per event.
  function remeasure() {
    max = document.documentElement.scrollHeight - window.innerHeight;
    measure();
  }

  function measure() {
    state.raw = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
  }

  remeasure();
  state.value = state.raw;
  last = state.raw;

  addEventListener('scroll', measure, { passive: true });
  addEventListener('resize', remeasure, { passive: true });

  return {
    state,
    /**
     * Re-read the document height. Anything that changes the length of the
     * scroll track after boot has to call this: the max is cached to keep
     * scrollHeight out of the scroll handler, so it will not notice on its own.
     */
    remeasure,
    /** Critically-damped-ish follow. dt-aware so it feels the same at 60 and 120 Hz. */
    update(dt) {
      const k = 1 - Math.pow(0.0016, Math.min(dt, 0.05));
      state.value += (state.raw - state.value) * k;

      const instant = (state.value - last) / Math.max(dt, 1e-4);
      state.velocity += (instant - state.velocity) * 0.16;
      last = state.value;
      return state;
    },
  };
}

/** Maps t into 0..1 across [a,b] with smoothstep easing at both ends. */
export function band(t, a, b) {
  const x = Math.min(1, Math.max(0, (t - a) / (b - a)));
  return x * x * (3 - 2 * x);
}

/** 0 outside [a,d], ramping up over [a,b] and back down over [c,d]. */
export function window4(t, a, b, c, d) {
  return band(t, a, b) * (1 - band(t, c, d));
}
