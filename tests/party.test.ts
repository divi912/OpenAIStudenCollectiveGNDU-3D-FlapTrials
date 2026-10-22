import { expect, it } from 'vitest';
import { partyEvent } from '../shared/party';
import { COURSES, compileCourse } from '../shared/courses';
import { createRacer, idleInput, stepRacer } from '../shared/physics';

it('announces synchronized deterministic chaos events before they start', () => {
  expect(partyEvent(1).kind).toBe('calm');
  expect(partyEvent(12).warning).toBe(true);
  expect(partyEvent(15).kind).toBe('turbo');
  expect(partyEvent(33).kind).toBe('moon');
  expect(partyEvent(51).kind).toBe('crosswind');
  expect(partyEvent(51.5)).toEqual(partyEvent(51.5));
});
it('gives turbo and low gravity real movement effects', () => {
  const course = compileCourse({ ...COURSES[0], obstacles: [], checkpoints: [], length: 10000, floor: -10000 });
  const ordinary = createRacer('normal'), turbo = createRacer('turbo'), moon = createRacer('moon');
  for (let i = 0; i < 60; i++) {
    stepRacer(ordinary, idleInput(), course, i);
    stepRacer(turbo, idleInput(), course, 900 + i);
    stepRacer(moon, idleInput(), course, 1980 + i);
  }
  expect(turbo.z).toBeGreaterThan(ordinary.z + 2);
  expect(moon.y).toBeGreaterThan(ordinary.y + 2);
});
it('a speed zone never brakes a racer who already has a faster power-up', () => {
  const zone = { ...COURSES[0].obstacles[0], kind: 'speed_zone' as const };
  const course = compileCourse({ ...COURSES[0], obstacles: [zone] });
  const empty = compileCourse({ ...COURSES[0], obstacles: [] });
  const bird = createRacer('boosted'); Object.assign(bird, { x: zone.x, y: zone.y, z: zone.z, speed: 28, boostUntilTick: 300 });
  const reference = { ...bird };
  stepRacer(reference, idleInput(), empty, 100);
  stepRacer(bird, idleInput(), course, 100);
  expect(bird.speed).toBeGreaterThanOrEqual(reference.speed);
});
it('collects a gift only once and resets active powers on a crash', () => {
  const gift = { ...COURSES[0].obstacles[0], kind: 'pickup' as const, pickupIndex: 0, powerUp: 'boost' as const };
  const course = compileCourse({ ...COURSES[0], obstacles: [gift] });
  const bird = createRacer('gift'); Object.assign(bird, { x: gift.x, y: gift.y, z: gift.z - .1 });
  stepRacer(bird, idleInput(), course, 100);
  expect(bird.boostUntilTick).toBeGreaterThan(100); expect(bird.pickupMask).toBe(1);
  const deadline = bird.boostUntilTick;
  bird.z = gift.z - .1; stepRacer(bird, idleInput(), course, 110);
  expect(bird.boostUntilTick).toBe(deadline);
  bird.x = 100; stepRacer(bird, idleInput(), course, 111);
  expect(bird.status).toBe('crashed'); expect(bird.boostUntilTick).toBe(0);
});
it('a shield protects a tight frame scrape but cannot bypass a mandatory opening or world bounds', () => {
  const gate = { ...COURSES[0].obstacles[0], shape: 'rectangle' as const, x: 0, y: 6, width: 8, height: 8 };
  const course = compileCourse({ ...COURSES[0], obstacles: [gate] });
  const bird = createRacer('shield'); Object.assign(bird, { x: 3.8, y: 6, z: gate.z - .1, shieldUntilTick: 300 });
  stepRacer(bird, idleInput(), course, 100); expect(bird.status).toBe('racing');
  Object.assign(bird, { x: 7, z: gate.z - .1 }); stepRacer(bird, idleInput(), course, 101);
  expect(bird.status).toBe('crashed');
});
