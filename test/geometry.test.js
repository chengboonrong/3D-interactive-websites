import test from 'node:test';
import assert from 'node:assert/strict';

import { slab, loop, MM } from '../src/objects/kit.js';

/** Finished outside dimensions of a geometry, as a caller would measure them. */
function extent(geometry) {
  geometry.computeBoundingBox();
  const { min, max } = geometry.boundingBox;
  return [max.x - min.x, max.y - min.y, max.z - min.z];
}

test('a slab measures its requested outside dimensions', () => {
  // The bevel is inset from the requested size rather than added to it, so
  // callers can think in outside dimensions. Easy to get backwards.
  const [w, h, d] = extent(slab(5, 6.05, 1.3, 0.32));
  assert.ok(Math.abs(w - 5) < 1e-6, `width ${w}`);
  assert.ok(Math.abs(h - 6.05) < 1e-6, `height ${h}`);
  assert.ok(Math.abs(d - 1.3) < 1e-6, `depth ${d}`);
});

test('a slab is centred on the origin', () => {
  const g = slab(4, 2, 0.8, 0.2);
  g.computeBoundingBox();
  const { min, max } = g.boundingBox;
  for (const axis of ['x', 'y', 'z']) {
    const centre = (min[axis] + max[axis]) / 2;
    assert.ok(Math.abs(centre) < 1e-6, `${axis} centre off by ${centre}`);
  }
});

test('slabs thinner than the bevel still come out the right thickness', () => {
  // Screens and slot covers are a couple of hundredths deep. Without clamping,
  // the bevel eats straight through them and the extrude depth goes negative.
  for (const d of [0.02, 0.03, 0.05, 0.1]) {
    const [, , depth] = extent(slab(1.5, 1.2, d, 0.05, 0.05));
    assert.ok(Math.abs(depth - d) < 1e-6, `requested ${d}, measured ${depth}`);
  }
});

test('a corner radius larger than the slab does not invert it', () => {
  // Clamped to a stadium. Chamfering a coarsely tessellated curve overshoots
  // the box slightly, so this is a sanity bound rather than an exact match.
  const [w, h] = extent(slab(1, 1, 0.5, 10));
  assert.ok(Math.abs(w - 1) < 0.005, `width ${w}`);
  assert.ok(Math.abs(h - 1) < 0.005, `height ${h}`);
});

test('slab geometry is finite and has normals', () => {
  const g = slab(3, 2, 1, 0.25);
  const position = g.getAttribute('position');
  const normal = g.getAttribute('normal');
  assert.ok(position.count > 0);
  assert.equal(normal.count, position.count);
  for (const v of position.array) assert.ok(Number.isFinite(v), 'NaN in positions');
  for (const v of normal.array) assert.ok(Number.isFinite(v), 'NaN in normals');
});

test('a loop measures its outside dimensions and is hollow', () => {
  const [w, h, d] = extent(loop(0.95, 1.55, 0.24, 0.34, 0.34));
  assert.ok(Math.abs(w - 0.95) < 1e-6, `width ${w}`);
  assert.ok(Math.abs(h - 1.55) < 1e-6, `height ${h}`);
  assert.ok(Math.abs(d - 0.34) < 1e-6, `depth ${d}`);

  // A hole means more vertices than the solid equivalent; if the hole were
  // dropped the handle would render as a filled block.
  const solid = slab(0.95, 1.55, 0.34, 0.34);
  assert.ok(
    loop(0.95, 1.55, 0.24, 0.34, 0.34).getAttribute('position').count >
      solid.getAttribute('position').count,
    'loop should have more geometry than a solid slab'
  );
});

test('the scale constant is one unit to forty millimetres', () => {
  assert.ok(Math.abs(MM * 40 - 1) < 1e-12);
});
