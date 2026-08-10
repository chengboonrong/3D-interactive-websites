import test from 'node:test';
import assert from 'node:assert/strict';

import { band, panelOpacity } from '../src/scroll.js';
import { stationTimes } from '../src/rig.js';
import { CONSOLES } from '../src/objects/consoles.js';

test('band clamps outside its range', () => {
  assert.equal(band(-1, 0.2, 0.8), 0);
  assert.equal(band(0.2, 0.2, 0.8), 0);
  assert.equal(band(0.8, 0.2, 0.8), 1);
  assert.equal(band(2, 0.2, 0.8), 1);
});

test('band eases symmetrically about its midpoint', () => {
  assert.ok(Math.abs(band(0.5, 0.2, 0.8) - 0.5) < 1e-12);
  const below = band(0.35, 0.2, 0.8);
  const above = band(0.65, 0.2, 0.8);
  assert.ok(Math.abs(below + above - 1) < 1e-12, 'smoothstep should be point-symmetric');
});

test('band is monotonic', () => {
  let previous = -1;
  for (let i = 0; i <= 50; i++) {
    const v = band(i / 50, 0.1, 0.9);
    assert.ok(v >= previous, `decreased at ${i / 50}`);
    previous = v;
  }
});

test('band treats a zero-width range as a step rather than dividing by zero', () => {
  // NaN here would travel straight into an opacity and blank a panel silently.
  assert.equal(band(0.4, 0.5, 0.5), 0);
  assert.equal(band(0.5, 0.5, 0.5), 1);
  assert.equal(band(0.6, 0.5, 0.5), 1);
});

test('a panel reaches full opacity in the middle of its window', () => {
  assert.ok(Math.abs(panelOpacity(0.5, 0.45, 0.55) - 1) < 1e-9);
  assert.equal(panelOpacity(0.2, 0.45, 0.55), 0);
  assert.equal(panelOpacity(0.8, 0.45, 0.55), 0);
});

test('a panel pinned to the start of the timeline is fully open at t=0', () => {
  // There is no room before t=0 to fade in. A symmetric window puts half the
  // ramp off the end of the timeline and caps the opening title at ~74%.
  assert.equal(panelOpacity(0, 0, 0.075), 1);
  assert.ok(panelOpacity(0.2, 0, 0.075) < 0.01, 'it should still fade out');
});

test('a panel pinned to the end of the timeline is fully open at t=1', () => {
  assert.equal(panelOpacity(1, 0.93, 1), 1);
  assert.ok(panelOpacity(0.8, 0.93, 1) < 0.01, 'it should still fade in');
});

test('panel opacity never leaves 0..1', () => {
  for (const [a, b] of [[0, 0.075], [0.45, 0.55], [0.93, 1], [0, 1]]) {
    for (let i = -10; i <= 110; i++) {
      const v = panelOpacity(i / 100, a, b);
      assert.ok(v >= 0 && v <= 1 && Number.isFinite(v), `panelOpacity(${i / 100}, ${a}, ${b}) = ${v}`);
    }
  }
});

test('stationTimes returns one strictly increasing time per machine', () => {
  const t = stationTimes();
  assert.equal(t.length, CONSOLES.length);

  for (const v of t) {
    assert.ok(v > 0 && v < 1, `station time ${v} should sit inside the timeline`);
  }
  for (let i = 1; i < t.length; i++) {
    assert.ok(t[i] > t[i - 1], `station ${i} should come after ${i - 1}`);
  }
});

test('stations are evenly spaced, and both ends keep room for the copy', () => {
  const t = stationTimes();
  const gaps = t.slice(1).map((v, i) => v - t[i]);
  const first = gaps[0];
  for (const gap of gaps) {
    assert.ok(Math.abs(gap - first) < 1e-9, 'uneven station spacing');
  }

  // The intro and outro panels live in the slack at either end. If a station
  // ran right up to the edge there would be nowhere to put them.
  assert.ok(t[0] >= first, 'no lead-in before the first machine');
  assert.ok(1 - t[t.length - 1] >= first, 'no lead-out after the last machine');
});

test('the lineup is chronological', () => {
  for (let i = 1; i < CONSOLES.length; i++) {
    assert.ok(
      CONSOLES[i].year >= CONSOLES[i - 1].year,
      `${CONSOLES[i].id} (${CONSOLES[i].year}) is out of order`
    );
  }
});

test('every machine declares what the camera and the copy need', () => {
  const ids = new Set();
  for (const c of CONSOLES) {
    assert.equal(typeof c.id, 'string');
    assert.ok(!ids.has(c.id), `duplicate id ${c.id}`);
    ids.add(c.id);

    assert.equal(typeof c.build, 'function');
    assert.ok(Number.isFinite(c.aimY), `${c.id} needs an aimY`);
    assert.match(c.accent, /^#[0-9a-f]{6}$/i, `${c.id} accent should be a hex colour`);
    if (c.view !== undefined) {
      assert.ok(c.view > 0 && c.view <= 1, `${c.id} view factor out of range`);
    }
  }
});
