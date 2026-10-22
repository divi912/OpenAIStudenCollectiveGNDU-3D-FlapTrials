import { expect, it } from 'vitest';
import { apertureClearance, apertureVertices, COURSES, obstacleBoxes } from '../shared/courses';
import { compileCourse } from '../shared/courses';
import { createRacer, idleInput, stepRacer } from '../shared/physics';
import type { ObstacleDefinition } from '../shared/protocol';

const circle = { ...COURSES[0].obstacles[0], shape: 'circle', x: 0, y: 6, width: 8, height: 8 } as ObstacleDefinition;
it('uses the actual curved aperture instead of accepting the corners of its bounding rectangle', () => {
  expect(apertureClearance(circle, 0, 0)).toBeGreaterThan(3.9);
  expect(apertureClearance(circle, 3, 3)).toBeLessThan(0);
  expect(apertureVertices(circle).length).toBeGreaterThanOrEqual(24);
  expect(obstacleBoxes(circle, 0)).toHaveLength(apertureVertices(circle).length);
});
it('rejects a flight through the empty corner outside a circular opening', () => {
  const bird = createRacer('corner');
  Object.assign(bird, { x: 3.3, y: 9.3, z: circle.z - .1 });
  stepRacer(bird, idleInput(), compileCourse({ ...COURSES[0], obstacles: [circle] }), 10);
  expect(bird.status).toBe('crashed');
});
it('distinguishes triangle, diamond, oval and hexagon clearances and validates shape data', () => {
  for (const [shape, sides] of [['triangle', 3], ['diamond', 4], ['hexagon', 6]] as const) {
    const o = { ...circle, shape };
    expect(apertureVertices(o)).toHaveLength(sides);
    expect(apertureClearance(o, 0, 0)).toBeGreaterThan(.42);
    expect(apertureClearance(o, 5, 0)).toBeLessThan(0);
  }
  expect(apertureClearance({ ...circle, shape: 'oval', width: 12, height: 4 }, 0, 1.8)).toBeLessThan(.3);
  expect(() => compileCourse({ ...COURSES[0], obstacles: [{ ...circle, shape: 'unknown' as any }] })).toThrow(/shape/);
});
it('authors several distinct aperture shapes in every course', () => {
  for (const course of COURSES) expect(new Set(course.obstacles.filter(o => !['gust', 'speed_zone', 'pickup'].includes(o.kind)).map(o => o.shape)).size).toBeGreaterThanOrEqual(3);
});
it('authors circles with equal axes and visibly wider oval openings', () => {
  for (const course of COURSES) for (const o of course.obstacles.filter(o => ['ring', 'wall', 'shutter', 'rotating_gate'].includes(o.kind))) {
    if (o.shape === 'circle') expect(o.width).toBe(o.height);
    if (o.shape === 'oval') expect(o.width / o.height).toBeGreaterThan(1.4);
  }
});
