import test from 'node:test';
import assert from 'node:assert/strict';

import { detectTier } from '../src/tier.js';

const PHONE = { shortEdge: 390, cores: 8, coarse: true };
const TABLET = { shortEdge: 820, cores: 8, coarse: true };
const LAPTOP = { shortEdge: 900, cores: 4, coarse: false };
const NARROW_WINDOW = { shortEdge: 500, cores: 8, coarse: false };
const NETBOOK = { shortEdge: 768, cores: 2, coarse: false };

test('touch devices take the low tier', () => {
  assert.equal(detectTier(PHONE).low, true);
  assert.equal(detectTier(TABLET).low, true);
});

test('a four-core laptop takes the high tier', () => {
  // An earlier revision demoted anything with four cores or fewer, which is a
  // large share of perfectly capable laptops.
  assert.equal(detectTier(LAPTOP).low, false);
});

test('a narrow window with a mouse is not a phone', () => {
  assert.equal(detectTier(NARROW_WINDOW).low, false);
});

test('very low core counts still fall back to the low tier', () => {
  assert.equal(detectTier(NETBOOK).low, true);
});

test('the low tier is cheaper than the high tier on every axis', () => {
  const low = detectTier(PHONE);
  const high = detectTier(LAPTOP);
  assert.ok(low.dust < high.dust);
  assert.ok(low.bloomPasses < high.bloomPasses);
  assert.ok(low.dprStart < high.dprStart);
  assert.ok(low.dprCap < high.dprCap);
});

test('the resolution governor has somewhere to move in both directions', () => {
  for (const probe of [PHONE, TABLET, LAPTOP, NETBOOK]) {
    const t = detectTier(probe);
    assert.ok(t.dprFloor < t.dprStart, 'no headroom to drop resolution');
    assert.ok(t.dprStart < t.dprCap, 'no headroom to raise resolution');
    assert.ok(t.dprFloor > 0);
    assert.ok(t.dust > 0);
    assert.ok(t.bloomPasses >= 1);
  }
});
