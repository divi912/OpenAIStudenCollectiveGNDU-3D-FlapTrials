import { describe, expect, it } from 'vitest';
import { compileCourse, COURSES } from '../shared/courses';
import { BOOST, createRacer, idleInput, replay, respawnRacer, stepRacer } from '../shared/physics';
import { sanitizeInput } from '../shared/protocol';
import { FlightInput, PlayerSchema, SIM_FIELDS } from '../shared/schema';
import { GameSession } from '../server/session';

const openCourse = () => compileCourse({ ...COURSES[0], obstacles: [], checkpoints: [], length: 100000, floor: -100000 });

describe('stored boost reserve', () => {
  it('starts each racer with 60 reserve and synchronized boost state', () => {
    const racer = createRacer('bird');
    expect(racer).toMatchObject({ boostReserve: 60, boostActive: false, boostCooldownUntilTick: 0, boostRewardZ: -1 });
    const player = new PlayerSchema();
    for (const key of ['boostReserve', 'boostActive', 'boostCooldownUntilTick', 'boostRewardZ'] as const) {
      expect(player[key]).toBe(racer[key]); expect(SIM_FIELDS).toContain(key);
    }
    expect(new FlightInput().boostHeld).toBe(false);
  });

  it('spends a full reserve in four seconds and provides additional forward speed only while held', () => {
    const course = openCourse(), bird = createRacer('boost'), normal = createRacer('normal');
    bird.boostReserve = 100;
    for (let tick = 0; tick < 240; tick++) {
      stepRacer(bird, { ...idleInput(), boostHeld: true }, course, tick);
      stepRacer(normal, idleInput(), course, tick);
    }
    expect(bird.boostReserve).toBeCloseTo(0); expect(bird.speed).toBeCloseTo(22, 3);
    expect(bird.z).toBeGreaterThan(normal.z + 20);
    stepRacer(bird, { ...idleInput(), boostHeld: true }, course, 240);
    expect(bird.boostActive).toBe(false);
  });

  it('regenerates four units per second only after the release cooldown', () => {
    const course = openCourse(), bird = createRacer('release');
    stepRacer(bird, { ...idleInput(), boostHeld: true }, course, 0);
    const spent = bird.boostReserve;
    for (let tick = 1; tick < 90; tick++) stepRacer(bird, idleInput(), course, tick);
    expect(bird.boostReserve).toBe(spent);
    for (let tick = 90; tick < 150; tick++) stepRacer(bird, idleInput(), course, tick);
    expect(bird.boostReserve).toBeCloseTo(spent + 4);
    bird.boostReserve = 100; stepRacer(bird, idleInput(), course, 150);
    expect(bird.boostReserve).toBe(100);
  });

  it('requires fifteen reserve to activate but sustains an active burst below fifteen', () => {
    const course = openCourse(), bird = createRacer('minimum');
    bird.boostReserve = 14; bird.boostCooldownUntilTick = 100;
    stepRacer(bird, { ...idleInput(), boostHeld: true }, course, 0);
    expect(bird.boostActive).toBe(false); expect(bird.boostReserve).toBe(14);
    bird.boostReserve = 15;
    for (let tick = 1; tick < 10; tick++) stepRacer(bird, { ...idleInput(), boostHeld: true }, course, tick);
    expect(bird.boostActive).toBe(true); expect(bird.boostReserve).toBeCloseTo(11.25);
    stepRacer(bird, idleInput(), course, 10);
    stepRacer(bird, { ...idleInput(), boostHeld: true }, course, 11);
    expect(bird.boostActive).toBe(false);
  });

  it('stacks with dive and tailwind while enforcing the absolute speed cap', () => {
    const course = openCourse(), bird = createRacer('stack'); bird.boostReserve = 100;
    for (let tick = 900; tick < 1020; tick++) stepRacer(bird, { ...idleInput(), diveHeld: true, boostHeld: true }, course, tick);
    expect(bird.speed).toBeGreaterThan(29.9); expect(bird.speed).toBeLessThanOrEqual(30);
    expect(BOOST.speedBonus).toBe(6);
  });

  it('awards clean gates once even after crashing and replaying a checkpoint section', () => {
    const gate = { ...COURSES[0].obstacles[0], x: 0, y: 6, z: 70, width: 8, height: 8 };
    const course = compileCourse({ ...COURSES[0], checkpoints: [], obstacles: [gate] });
    const bird = createRacer('gate'); Object.assign(bird, { z: 69.9, boostReserve: 20, boostCooldownUntilTick: 1000 });
    stepRacer(bird, idleInput(), course, 0);
    expect(bird.boostReserve).toBe(26); expect(bird.boostRewardZ).toBe(70);
    bird.x = 100; stepRacer(bird, idleInput(), course, 1);
    expect(bird.boostReserve).toBe(1); expect(bird.boostActive).toBe(false);
    expect(bird.boostCooldownUntilTick).toBe(91);
    respawnRacer(bird, course); Object.assign(bird, { z: 69.9, boostCooldownUntilTick: 1000 });
    stepRacer(bird, idleInput(), course, 2);
    expect(bird.boostReserve).toBe(1); expect(bird.boostRewardZ).toBe(70);
  });

  it('stores a pickup once, clamps its reward and does not force activation', () => {
    const gift = { ...COURSES[0].obstacles[0], kind: 'pickup' as const, powerUp: 'boost' as const, pickupIndex: 0 };
    const course = compileCourse({ ...COURSES[0], obstacles: [gift] });
    const bird = createRacer('gift'); Object.assign(bird, { x: gift.x, y: gift.y, z: gift.z - .1, boostReserve: 90, boostCooldownUntilTick: 1000 });
    stepRacer(bird, idleInput(), course, 0);
    expect(bird.boostReserve).toBe(100); expect(bird.boostActive).toBe(false); expect(bird.boostUntilTick).toBe(0);
    bird.boostReserve = 20; bird.z = gift.z - .1;
    stepRacer(bird, idleInput(), course, 1); expect(bird.boostReserve).toBe(20);
  });

  it('freezes resources after finishing and keeps replay deterministic', () => {
    const course = openCourse();
    const inputs = Array.from({ length: 300 }, (_, tick) => ({ ...idleInput(), sequence: tick, boostHeld: tick < 120 }));
    const a = replay(createRacer('same'), inputs, course, 0), b = createRacer('same');
    for (let t = 0; t < inputs.length; t++) stepRacer(b, inputs[t], course, t);
    expect(a).toEqual(b);
    a.status = 'finished'; const reserve = a.boostReserve;
    stepRacer(a, { ...idleInput(), boostHeld: true }, course, 300);
    expect(a.boostReserve).toBe(reserve);
  });

  it('accepts only a boolean boost request and strips forged reserve and active state', () => {
    expect(sanitizeInput({ ...idleInput(), boostHeld: undefined })?.boostHeld).toBe(false);
    expect(sanitizeInput({ ...idleInput(), boostHeld: true, boostReserve: 100, boostActive: true })).toMatchObject({ boostHeld: true });
    expect(sanitizeInput({ ...idleInput(), boostHeld: true })).not.toHaveProperty('boostReserve');
    for (const value of [1, 'true', null, {}, NaN]) expect(sanitizeInput({ ...idleInput(), boostHeld: value })).toBeNull();
  });

  it('simulates independent multiplayer reserve from legal inputs and resets it on rematch', () => {
    const session = new GameSession(false); const a = session.join('a', {}), b = session.join('b', {});
    session.state.phase = 'racing';
    session.step(0, new Map([['a', { ...idleInput(), boostHeld: true }]]));
    expect(a.boostReserve).toBeCloseTo(60 - 25 / 60); expect(a.boostActive).toBe(true);
    expect(b.boostActive).toBe(false); expect(b.boostReserve).toBeGreaterThanOrEqual(60);
    session.state.phase = 'results'; session.again('a');
    expect(a.boostReserve).toBe(60); expect(a.boostRewardZ).toBe(-1); expect(a.boostActive).toBe(false);
  });
});
