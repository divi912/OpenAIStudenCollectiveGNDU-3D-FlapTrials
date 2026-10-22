import { describe, expect, it } from 'vitest';
import { createRacer, stepRacer, PHYSICS, idleInput, replay } from '../shared/physics';
import { compileCourse, COURSES } from '../shared/courses';
import { sweepSphereBox, crossingFraction } from '../shared/collision';

describe('fixed-step flight', () => {
  it('applies discrete impulses and enforces the minimum flap interval', () => {
    const bird = createRacer('bird');
    const course = compileCourse(COURSES[0]);
    stepRacer(bird, { ...idleInput(), flapPressed: true }, course, 0);
    const after = bird.vy;
    stepRacer(bird, { ...idleInput(), flapPressed: true }, course, 1);
    expect(bird.vy).toBeCloseTo(after - PHYSICS.gravity / 60);
  });
  it('caps dive speed and descent without changing the simulation time', () => {
    const course = compileCourse({ ...COURSES[0], obstacles: [], checkpoints: [], length: 100000, floor: -100000 });
    const bird = createRacer('bird');
    for (let tick = 0; tick < 600; tick++) stepRacer(bird, { ...idleInput(), diveHeld: true }, course, tick);
    expect(bird.speed).toBeLessThanOrEqual(22);
    expect(bird.speed).toBeGreaterThan(21);
    expect(bird.vy).toBeGreaterThanOrEqual(-15);
    expect(bird.z).toBeGreaterThan(160);
  });
  it('replays the same tick inputs identically regardless of render grouping', () => {
    const course = compileCourse(COURSES[0]);
    const inputs = Array.from({ length: 240 }, (_, tick) => ({ ...idleInput(), sequence: tick, flapPressed: tick % 30 === 0, steer: (tick < 100 ? 1 : -1) as -1 | 1 }));
    const a = replay(createRacer('bird'), inputs, course, 0);
    const b = createRacer('bird');
    for (let frame = 0; frame < 120; frame++) for (let i = 0; i < 2; i++) {
      const tick = frame * 2 + i;
      stepRacer(b, inputs[tick], course, tick);
    }
    expect(a).toEqual(b);
  });
});

describe('continuous collision and checkpoints', () => {
  it('keeps a valid finish that precedes a boundary impact in the same tick', () => {
    const course = compileCourse({ ...COURSES[0], obstacles: [], checkpoints: [] });
    const bird = createRacer('bird');
    Object.assign(bird, { z: course.definition.length - .01, x: course.definition.width / 2 - PHYSICS.radius - .02, vx: 6 });
    stepRacer(bird, idleInput(), course, 100);
    expect(bird.status).toBe('finished');
    expect(bird.crashCount).toBe(0);
  });
  it('rejects bypassing a mandatory gate around the outside of its frame', () => {
    const course = compileCourse(COURSES[0]); const bird = createRacer('bird');
    Object.assign(bird, { x: 10, y: 6, z: 69.9 });
    stepRacer(bird, idleInput(), course, 100);
    expect(bird.status).toBe('crashed');
    expect(bird.crashCause).toBe('missed_gate');
  });
  it('detects a thin wall crossed entirely within a tick', () => {
    expect(sweepSphereBox([0, 0, 0], [0, 0, 10], 0.35, { center: [0, 0, 5], half: [2, 2, 0.02] })).not.toBeNull();
  });
  it('does not invent a corner collision inside an inflated box', () => {
    expect(sweepSphereBox([1.3, 1.3, -3], [1.3, 1.3, 3], 0.35, { center: [0, 0, 0], half: [1, 1, 1] })).toBeNull();
  });
  it('only accepts a forward plane crossing', () => {
    expect(crossingFraction(4, 6, 5)).toBe(0.5);
    expect(crossingFraction(6, 4, 5)).toBeNull();
  });
  it('respawns after 36 ticks without advancing the checkpoint or keeping dive momentum', () => {
    const course = compileCourse(COURSES[0]);
    const bird = createRacer('bird');
    Object.assign(bird, { status: 'crashed', respawnTick: 36, crashCount: 1, speed: 22, z: 40, vy: -15 });
    for (let tick = 1; tick < 36; tick++) stepRacer(bird, idleInput(), course, tick);
    expect(bird.status).toBe('crashed');
    stepRacer(bird, idleInput(), course, 36);
    expect(bird.status).toBe('racing');
    expect(bird.z).toBe(0);
    expect(bird.speed).toBe(16);
    expect(bird.checkpointIndex).toBe(0);
    expect(bird.crashCount).toBe(1);
  });
  it('cannot finish by skipping checkpoint traversal', () => {
    const course = compileCourse(COURSES[0]);
    const bird = createRacer('bird');
    Object.assign(bird, { z: course.definition.length - 0.1, y: course.definition.finishY });
    stepRacer(bird, idleInput(), course, 0);
    expect(bird.status).not.toBe('finished');
  });
});
