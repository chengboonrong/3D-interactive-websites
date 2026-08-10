/**
 * One quality decision, made once at boot. Everything expensive reads from it.
 *
 * This is deliberately not a breakpoint: a 1024-wide tablet on a weak GPU and a
 * 1024-wide window on a workstation want different budgets, and CSS cannot tell
 * them apart. Width is only one of the signals, and the adaptive DPR governor
 * in main.js still corrects whatever this gets wrong.
 */
export function detectTier() {
  const shortEdge = Math.min(innerWidth, innerHeight);
  const cores = navigator.hardwareConcurrency || 4;
  const coarse = matchMedia('(pointer: coarse)').matches;

  // Touch plus a small-ish short edge is a phone or a tablet, and both want the
  // cheaper scene. A mouse means a real machine however narrow the window is.
  //
  // Core count is only a backstop for genuinely tiny hardware. It is a poor
  // proxy for GPU throughput in either direction — plenty of capable laptops
  // report four, and plenty of weak phones report eight — so the bar is low
  // and the adaptive DPR governor handles what this misses.
  const low = (coarse && shortEdge < 1100) || cores <= 2;

  return {
    low,
    // Phone panels are ~2.5x denser than a laptop's, and the sky shader is
    // fill-rate bound, so the pixel budget has to come down with them.
    dprStart: low ? 1.0 : 1.35,
    dprCap: low ? 1.5 : 1.75,
    dprFloor: low ? 0.6 : 0.75,
    dust: low ? 1100 : 2600,
    bloomPasses: low ? 2 : 3,
  };
}
