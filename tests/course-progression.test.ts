import { describe, expect, it } from 'vitest';
import { COURSES, apertureClearance, compileCourse, getCourse, isGate } from '../shared/courses';

const median = (values: number[]) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];

describe('nine-course progression', () => {
  it('offers three ordered challenges per tier while preserving saved course identifiers', () => {
    expect(COURSES.map(course => course.id)).toEqual([
      'skyline_sprint', 'cloud_carnival', 'crosswind',
      'the_needle', 'clockwork', 'terminal_velocity',
      'featherless', 'storm_spiral', 'crown_circuit',
    ]);
    for (const [index, course] of COURSES.entries()) {
      const group = ['easy', 'medium', 'hard'][Math.floor(index / 3)];
      expect(course.difficultyGroup).toBe(group);
      expect(course.difficultyLevel).toBe(index % 3 + 1);
      expect(course.difficulty).toBe(group.toUpperCase());
      expect(course.difficultyIndex).toBe(index);
      expect(getCourse(course.id).definition).toBe(course);
      expect(course.version).toBe('4.0.0');
    }
  });

  it('gives each successive challenge a longer route, tighter cadence and smaller typical opening', () => {
    for (const start of [0, 3, 6]) {
      for (let i = start + 1; i <= start + 2; i++) {
        const easier = COURSES[i - 1], harder = COURSES[i];
        const gates = harder.obstacles.filter(isGate), previous = easier.obstacles.filter(isGate);
        expect(harder.length).toBeGreaterThan(easier.length);
        expect(median(gates.slice(1).map((gate, index) => gate.z - gates[index].z)))
          .toBeLessThan(median(previous.slice(1).map((gate, index) => gate.z - previous[index].z)));
        expect(median(gates.map(gate => apertureClearance(gate, 0, 0))))
          .toBeLessThan(median(previous.map(gate => apertureClearance(gate, 0, 0))));
      }
    }
    const oldLength: Record<string, number> = { skyline_sprint: 880, the_needle: 1120, crosswind: 1280, clockwork: 1440, terminal_velocity: 1600, featherless: 1760 };
    for (const course of COURSES) {
      expect(course.length).toBeGreaterThanOrEqual((oldLength[course.id] ?? 1000) * 1.2);
      expect(course.estimatedClearSeconds).toBeGreaterThanOrEqual(course.length / 16);
    }
  });

  it('preserves safe recovery between authored sections and a readable launch', () => {
    expect(COURSES[0].obstacles.find(isGate)?.z).toBe(70);
    expect(COURSES[0].checkpoints[0].z).toBe(140);
    for (const course of COURSES) {
      expect(() => compileCourse(course)).not.toThrow();
      expect(course.checkpoints.length).toBeGreaterThanOrEqual(5);
      for (const checkpoint of course.checkpoints) {
        expect(course.obstacles.every(obstacle => Math.abs(obstacle.z - checkpoint.z) >= 24)).toBe(true);
        expect(course.obstacles.some(obstacle => isGate(obstacle) && obstacle.z > checkpoint.z + 24 && obstacle.z < checkpoint.z + 100)).toBe(true);
      }
      expect(course.length - course.obstacles.filter(isGate).at(-1)!.z).toBeGreaterThanOrEqual(40);
    }
  });

  it('adds more bank, moving-gate and environmental hazards as each tier advances', () => {
    const hazardCount = (index: number) => COURSES[index].obstacles.filter(obstacle =>
      ['twist_gate', 'shutter', 'rotating_gate', 'gust', 'speed_zone'].includes(obstacle.kind)).length;
    for (const start of [0, 3, 6]) {
      expect(hazardCount(start + 1)).toBeGreaterThan(hazardCount(start));
      expect(hazardCount(start + 2)).toBeGreaterThan(hazardCount(start + 1));
    }
  });

  it('uses broad stage arrangements and distinct silhouettes without unbounded obstacle growth', () => {
    const arrangements = new Set<string>();
    for (const course of COURSES) {
      const gates = course.obstacles.filter(isGate);
      expect(Math.max(...gates.map(gate => gate.x)) - Math.min(...gates.map(gate => gate.x))).toBeGreaterThanOrEqual(5);
      expect(Math.max(...gates.map(gate => gate.y)) - Math.min(...gates.map(gate => gate.y))).toBeGreaterThanOrEqual(3);
      expect(new Set(gates.map(gate => gate.shape)).size).toBeGreaterThanOrEqual(3);
      expect(course.obstacles.length).toBeLessThanOrEqual(180);
      expect(course.obstacles.filter(obstacle => obstacle.kind === 'pickup').length).toBeLessThanOrEqual(31);
      arrangements.add(gates.slice(1, 9).map(gate => `${gate.kind}:${gate.shape}:${Math.sign(gate.x)}:${Math.sign(gate.y - 6)}`).join('|'));
    }
    expect(arrangements.size).toBe(9);
  });
});
