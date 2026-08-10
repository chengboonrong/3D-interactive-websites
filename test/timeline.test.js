import test from 'node:test';
import assert from 'node:assert/strict';

import { band, window4 } from '../src/scroll.js';
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

test('window4 is zero outside and one across the plateau', () => {
  assert.equal(window4(0.0, 0.2, 0.3, 0.7, 0.8), 0);
  assert.equal(window4(0.2, 0.2, 0.3, 0.7, 0.8), 0);
  assert.equal(window4(0.5, 0.2, 0.3, 0.7, 0.8), 1);
  assert.equal(window4(0.8, 0.2, 0.3, 0.7, 0.8), 0);
  assert.equal(window4(1.0, 0.2, 0.3, 0.7, 0.8), 0);
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
