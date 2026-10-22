import { describe, expect, it } from 'vitest';
import { COURSES, compileCourse, obstaclePose } from '../shared/courses';
import { sanitizeInput, rankRacers } from '../shared/protocol';
import { createRacer } from '../shared/physics';
describe('course and protocol integrity', () => {
  it('quantizes authored coordinates so browser math differences cannot change the course hash', () => {
    for (const course of COURSES) for (const obstacle of course.obstacles) {
      expect(obstacle.x).toBe(Number(obstacle.x.toFixed(6)));
      expect(obstacle.y).toBe(Number(obstacle.y.toFixed(6)));
    }
  });
  it('loads all six unrestricted courses and rejects unsafe checkpoint staging', () => {
    expect(COURSES.map(c => c.id)).toEqual(['skyline_sprint', 'the_needle', 'crosswind', 'clockwork', 'terminal_velocity', 'featherless']);
    for (const course of COURSES) expect(compileCourse(course).hash.length).toBeGreaterThan(0);
    expect(() => compileCourse({ ...COURSES[0], checkpoints: [{ id: 'bad', x: 0, y: 6, z: 70 }] })).toThrow(/staging/);
  });
  it('rejects NaN movement, out-of-range steering and forged sequence values', () => {
    expect(sanitizeInput({ sequence: 1, tick: 0, steer: NaN, flapPressed: true, diveHeld: false })).toBeNull();
    expect(sanitizeInput({ sequence: -1, tick: 0, steer: 0, flapPressed: false, diveHeld: false })).toBeNull();
    expect(sanitizeInput({ sequence: 1, tick: 0, steer: 99, flapPressed: false, diveHeld: false })).toBeNull();
  });
  it('ranks validated finishes before higher unfinished progress', () => {
    const a = { ...createRacer('a'), checkpointIndex: 100, sectionProgress: 1 };
    const b = { ...createRacer('b'), status: 'finished' as const, finishTick: 100, finishFraction: 0.8 };
    const c = { ...createRacer('c'), status: 'finished' as const, finishTick: 100, finishFraction: 0.2 };
    expect(rankRacers([a, b, c]).map(p => p.playerId)).toEqual(['c', 'b', 'a']);
  });
  it('evaluates moving obstacles from race time without accumulating animation state', () => {
    const o = COURSES[3].obstacles[0]; const first = obstaclePose(o, 10);
    obstaclePose(o, 999); expect(obstaclePose(o, 10)).toEqual(first);
  });
});
