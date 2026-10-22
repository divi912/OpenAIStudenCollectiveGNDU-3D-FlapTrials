import { expect, it } from 'vitest';
import { bodyRoll, frameAt, trackToWorld, wingOffset } from '../shared/track';
import { Matrix, Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector.js';
import { compileCourse, COURSES } from '../shared/courses';
import { createRacer, idleInput, stepRacer, respawnRacer } from '../shared/physics';
import { sanitizeInput } from '../shared/protocol';

it('maps every course onto a turning and climbing 3D centerline with orthonormal frames', () => {
  for (const course of COURSES) {
    const a = frameAt(course, 0), b = frameAt(course, 200);
    expect(Math.abs(b.yaw - a.yaw)).toBeGreaterThan(.05);
    expect(Math.abs(b.position[1] - a.position[1])).toBeGreaterThan(1);
    const p = trackToWorld(course, 2, 6, 200), center = trackToWorld(course, 0, 6, 200);
    expect(Math.hypot(...p.map((n, i) => n - center[i]))).toBeCloseTo(2);
    expect(Math.hypot(...b.forward)).toBeCloseTo(1);
    expect(b.forward.reduce((n, v, i) => n + v * b.up[i], 0)).toBeCloseTo(0);
  }
});
it('steering turns the heading and changes the flight direction, while pitch affects altitude', () => {
  const course = compileCourse({ ...COURSES[0], obstacles: [], checkpoints: [], width: 1000, floor: -1000 });
  const bird = createRacer('turn'), level = createRacer('level');
  for (let tick = 0; tick < 45; tick++) {
    stepRacer(bird, { ...idleInput(), steer: 1, pitch: 1 }, course, tick);
    stepRacer(level, idleInput(), course, tick);
  }
  expect(bird.heading).toBeGreaterThan(.2); expect(bird.pitch).toBeGreaterThan(.2);
  expect(bird.x).toBeGreaterThan(1); expect(bird.y).toBeGreaterThan(level.y);
  expect(bird.z).toBeLessThan(level.z);
});
it('a rolled bird fits a vertical slot that its unrolled wings cannot pass', () => {
  const gate = { ...COURSES[0].obstacles[0], kind: 'twist_gate' as const, shape: 'rectangle' as const, width: .95, height: 5, x: 0, y: 6, z: 70, tilt: 0 };
  const course = compileCourse({ ...COURSES[0], obstacles: [gate] });
  const level = createRacer('level'), rolled = createRacer('rolled');
  for (const p of [level, rolled]) Object.assign(p, { z: 69.1 });
  rolled.roll = Math.PI / 2;
  for (let tick = 0; tick < 8; tick++) { stepRacer(level, idleInput(), course, tick); stepRacer(rolled, idleInput(), course, tick); }
  expect(level.status).toBe('crashed'); expect(rolled.status).toBe('racing'); expect(rolled.z).toBeGreaterThan(70);
});
it('resets orientation on checkpoint respawn and rejects illegal angular controls', () => {
  const bird = createRacer('reset'); Object.assign(bird, { roll: 2, pitch: .6, heading: .7 });
  respawnRacer(bird, compileCourse(COURSES[0]));
  expect([bird.heading, bird.pitch, bird.roll]).toEqual([0, 0, 0]);
  expect(sanitizeInput({ ...idleInput(), pitch: 7 })).toBeNull();
  expect(sanitizeInput({ ...idleInput(), roll: NaN })).toBeNull();
});
it('awards full barrel rolls and replays angular state independently of render grouping', () => {
  const course = compileCourse({ ...COURSES[0], obstacles: [], checkpoints: [], floor: -10000, width: 1000 });
  const a = createRacer('roll'), b = createRacer('roll');
  const input = (tick: number) => ({ ...idleInput(), sequence: tick, tick, roll: 1 as const, pitch: tick < 30 ? 1 as const : 0 as const });
  for (let t = 0; t < 90; t++) stepRacer(a, input(t), course, t);
  for (let frame = 0; frame < 30; frame++) for (let i = 0; i < 3; i++) { const t = frame * 3 + i; stepRacer(b, input(t), course, t); }
  expect(a).toEqual(b); expect(a.trickCount).toBe(1); expect(a.styleScore).toBe(200);
});
it('provides a distinct bank challenge and a curved path in all six authored courses', () => {
  for (const course of COURSES) {
    expect(course.obstacles.some(o => o.kind === 'twist_gate')).toBe(true);
    expect(course.path!.turn).toBeGreaterThan(.3);
    expect(course.obstacles.some(o => Math.abs(o.tilt ?? 0) > .1)).toBe(true);
  }
});
it('uses the same orientation for Babylon rendering and shared wing collision probes', () => {
  const f = frameAt(COURSES[3], 280), heading = .31, pitch = .23, roll = 1.2;
  const q = Quaternion.RotationYawPitchRoll(f.yaw, -f.pitch, 0).multiply(Quaternion.RotationYawPitchRoll(heading, -pitch, bodyRoll(heading, roll)));
  const visual = Vector3.TransformNormal(new Vector3(.43, 0, 0), Matrix.Compose(Vector3.One(), q, Vector3.Zero()));
  const local = wingOffset(heading, pitch, roll);
  const expected = f.right.map((v, i) => v * local[0] + f.up[i] * local[1] + f.forward[i] * local[2]);
  expect(visual.x).toBeCloseTo(expected[0]); expect(visual.y).toBeCloseTo(expected[1]); expect(visual.z).toBeCloseTo(expected[2]);
});
it('does not award a barrel roll for repeatedly banking and returning to level', () => {
  const course = compileCourse({ ...COURSES[0], obstacles: [], checkpoints: [], floor: -100000, length: 10000 });
  const bird = createRacer('partial'); let tick = 0;
  for (let cycle = 0; cycle < 6; cycle++) {
    for (let i = 0; i < 10; i++) stepRacer(bird, { ...idleInput(), roll: 1 }, course, tick++);
    for (let i = 0; i < 300; i++) stepRacer(bird, idleInput(), course, tick++);
  }
  expect(bird.trickCount).toBe(0); expect(bird.styleScore).toBe(0);
});
