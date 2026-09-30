import test from 'node:test';
import assert from 'node:assert/strict';
import {heightSolution, tvCorners, roomClearances, project} from './geometry.mjs';

const base = {eyeHeight: 100, centerHeight: 120, distance: 150, gaze: 0, tolerance: 5, offset: 10, bodyHeight: 74, tilt: 0};
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} != ${expected}`);

test('Eye-level reference, mount offset, physical edges and true sight distance', () => {
  const result = heightSolution(base);
  close(result.target, 100);
  close(result.targetMount, 90);
  close(result.bottom, 83);
  close(result.top, 157);
  close(result.distance3d, Math.sqrt(22900));
  close(result.actualGaze, Math.atan2(20, 150) * 180 / Math.PI);
  assert.equal(result.withinPreference, false);
});

test('Reclined viewing uses the chosen gaze angle and angular tolerance', () => {
  const result = heightSolution({...base, gaze: 10, offset: -8});
  close(result.target, 100 + 150 * Math.tan(Math.PI / 18));
  close(result.targetMount, result.target + 8);
  close(result.low, 100 + 150 * Math.tan(Math.PI / 36));
  close(result.high, 100 + 150 * Math.tan(Math.PI / 12));
  assert.equal(result.withinPreference, true);
});

test('Aiming the tilted screen at eyes gives zero incidence for frontal viewing', () => {
  const aimed = heightSolution(base).aimTilt;
  close(heightSolution({...base, tilt: aimed}).incidence, 0);
  const oblique = heightSolution({...base, sideAngle: 30, tilt: aimed});
  assert.ok(oblique.incidence > 28 && oblique.incidence < 31);
});

test('Full body thickness and tilted corners determine wall/floor collisions', () => {
  const pose = {x: 130, y: 42, a: Math.PI / 2};
  const corners = tvCorners(pose, 120, 0, 122.5, 74, 5.6);
  const clearance = roomClearances(corners);
  close(clearance.wall, -19.25);
  close(clearance.sideWall, 127.2);
  close(clearance.floor, 83);
  const tilted = tvCorners({x: 130, y: 5, a: 0}, 120, 15, 122.5, 74, 5.6);
  assert.ok(roomClearances(tilted).wall < 0);
});

test('Orthographic projection preserves the supplied heights and scales linearly', () => {
  const point = project([100, 50, 120]);
  const doubled = project([200, 100, 240]);
  point.forEach((v, i) => close(doubled[i], v * 2));
  assert.ok(project([0, 0, 120])[1] < project([0, 0, 100])[1]);
});

test('Invalid geometry is rejected instead of producing a plausible recommendation', () => {
  for (const bad of [{distance: 0}, {eyeHeight: NaN}, {gaze: 85}, {bodyHeight: -1}]) {
    assert.throws(() => heightSolution({...base, ...bad}), RangeError);
  }
});
