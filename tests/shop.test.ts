import { describe, expect, it } from 'vitest';
import { GameSession } from '../server/session';
import { COURSES, compileCourse, getCourse } from '../shared/courses';
import { createRacer, idleInput, stepRacer } from '../shared/physics';
import { SHOP, closeShop, openShop, purchase, resolveJammers } from '../shared/shop';
import { validAction } from '../server/security';

function buying() {
  const session = new GameSession(false);
  for (const id of ['a', 'b']) { session.join(id, {}); session.ready(id, true); }
  session.start('a');
  for (const id of ['a', 'b']) session.loaded(id, session.state.courseHash, session.state.raceId);
  session.step(1, new Map()); return session;
}
function racing() {
  const session = buying();
  session.finishBuying('a'); session.finishBuying('b'); session.step(2, new Map());
  session.step(session.state.startTick, new Map()); return session;
}
const openCourse = compileCourse({ ...COURSES[0], obstacles: [], checkpoints: [], floor: -10000, ceiling: 10000, length: 10000 });

describe('Flap Points economy', () => {
  it('grants equal starting points and validates purchases, funds, duplicates and the two-item limit', () => {
    const session = buying(), a = session.state.players.get('a')!, b = session.state.players.get('b')!;
    expect(a.flapPoints).toBe(100); expect(b.flapPoints).toBe(100);
    expect(session.buy('a', 'unknown')).toBe(false);
    expect(session.buy('outsider', 'guard')).toBe(false);
    expect(session.buy('a', 'overdrive')).toBe(true);
    expect(session.buy('a', 'overdrive')).toBe(false);
    expect(session.buy('a', 'capacitor')).toBe(true);
    expect(a.flapPoints).toBe(5); expect(b.flapPoints).toBe(100);
    expect(session.buy('a', 'guard')).toBe(false);
    a.flapPoints = 100;
    expect(session.buy('a', 'guard')).toBe(false);
    expect(session.finishBuying('a')).toBe(true);
    expect(session.buy('a', 'boost_cell')).toBe(false);
  });
  it('rejects purchases outside a live buy window and expires an idle shop', () => {
    const session = buying();
    session.state.tick = session.state.deadline;
    expect(session.buy('a', 'guard')).toBe(false);
    session.step(session.state.deadline, new Map());
    expect(session.state.phase).toBe('countdown');
    expect(session.buy('a', 'guard')).toBe(false);
    expect(validAction({ type: 'buy', value: 'guard', raceId: 1 }, 1)).toBe(true);
    for (const value of [{ type: 'buy', value: 'guard' }, { type: 'buy', value: 'guard', raceId: 0 }, { type: 'buy', value: {}, raceId: 1 }, { type: 'shop-done' }]) expect(validAction(value, 1)).toBe(false);
  });
  it('does not charge for a full boost reserve or a solo jammer', () => {
    const racer = createRacer('solo'); racer.boostReserve = 100;
    expect(purchase(racer, 'boost_cell', true)).toBe(false);
    expect(purchase(racer, 'jammer', true)).toBe(false);
    expect(racer.flapPoints).toBe(100);
  });
  it('carries savings to halfway, prevents permanent item stacking and resets the next race', () => {
    const session = buying(), a = session.state.players.get('a')!;
    session.buy('a', 'capacitor');
    openShop(a, 100, true);
    expect(a.flapPoints).toBe(105);
    expect(purchase(a, 'capacitor')).toBe(false);
    expect(purchase(a, 'guard')).toBe(true);
    openShop(a, 200, true); expect(a.flapPoints).toBe(70);
    session.state.phase = 'results'; session.again('a');
    expect(a).toMatchObject({ flapPoints: 100, loadoutMask: 0, boughtMask: 0, guardCharges: 0, jammerCharges: 0, midShopVisited: false });
  });
});

describe('shared halfway buy phase', () => {
  it('pauses everybody once, preserves positions, and excludes the stop from race and effect timers', () => {
    const session = racing(), s = session.state, a = s.players.get('a')!, b = s.players.get('b')!;
    a.z = getCourse(s.courseId).definition.length / 2 + 10; a.shieldUntilTick = s.tick + 1000;
    b.z = 100; b.y = 6; b.boostCooldownUntilTick = s.tick + 500;
    session.step(s.tick + 1, new Map());
    expect(s.phase).toBe('shopping'); expect(s.shopRound).toBe(1);
    expect([a.flapPoints, b.flapPoints]).toEqual([150, 150]);
    const position = [a.x, a.y, a.z, b.x, b.y, b.z], begin = s.shopStartedTick, start = s.startTick;
    const shield = a.shieldUntilTick, recharge = b.boostCooldownUntilTick;
    session.finishBuying('a'); session.step(begin + 100, new Map());
    expect(s.phase).toBe('shopping'); expect([a.x, a.y, a.z, b.x, b.y, b.z]).toEqual(position);
    session.finishBuying('b'); session.step(begin + 200, new Map());
    expect(s.phase).toBe('racing'); expect(s.startTick).toBe(start + 200);
    expect(a.shieldUntilTick).toBe(shield + 200); expect(b.boostCooldownUntilTick).toBe(recharge + 200);
    expect(a.z - b.z).toBeCloseTo(position[2] - position[5], 2);
    a.z = getCourse(s.courseId).definition.length / 2 + 10;
    session.step(s.tick + 1, new Map());
    expect(s.phase).toBe('racing'); expect(a.flapPoints).toBe(150);
  });
  it('resumes at the deadline when a player does not confirm', () => {
    const session = racing(), s = session.state;
    s.players.get('a')!.z = getCourse(s.courseId).definition.length / 2 + 10;
    session.step(s.tick + 1, new Map()); const deadline = s.deadline;
    expect(deadline - s.tick).toBe(SHOP.halfwaySeconds * 60);
    session.step(deadline, new Map()); expect(s.phase).toBe('racing');
    expect([...s.players.values()].every(p => p.shopUntilTick === 0)).toBe(true);
  });
  it('keeps an ongoing race when a rival disconnects during the halfway shop', () => {
    const session = racing(), s = session.state;
    s.players.get('a')!.z = getCourse(s.courseId).definition.length / 2 + 10;
    session.step(s.tick + 1, new Map());
    s.players.get('b')!.connected = false;
    session.finishBuying('a'); session.step(s.tick + 1, new Map());
    expect(s.phase).toBe('racing'); expect(s.players.get('a')!.flapPoints).toBe(150);
  });
});

describe('purchased race effects', () => {
  it('refills reserve and increases recharge without stacking', () => {
    const normal = createRacer('normal'), upgraded = createRacer('upgraded');
    purchase(upgraded, 'boost_cell'); expect(upgraded.boostReserve).toBe(95);
    purchase(upgraded, 'capacitor'); normal.boostReserve = upgraded.boostReserve = 0;
    for (let tick = 0; tick < 60; tick++) {
      stepRacer(normal, idleInput(), openCourse, tick); stepRacer(upgraded, idleInput(), openCourse, tick);
    }
    expect(upgraded.boostReserve).toBeCloseTo(normal.boostReserve * 1.5);
  });
  it('makes Overdrive faster while increasing the real crash penalty', () => {
    const normal = createRacer('normal'), risk = createRacer('risk'); purchase(risk, 'overdrive');
    for (let tick = 0; tick < 60; tick++) { stepRacer(normal, idleInput(), openCourse, tick); stepRacer(risk, idleInput(), openCourse, tick); }
    expect(risk.z).toBeGreaterThan(normal.z + .5);
    normal.x = risk.x = 1000; normal.boostReserve = risk.boostReserve = 100;
    stepRacer(normal, idleInput(), openCourse, 61); stepRacer(risk, idleInput(), openCourse, 61);
    expect(risk.respawnTick - normal.respawnTick).toBe(18);
    expect(normal.boostReserve - risk.boostReserve).toBe(20);
  });
  it('consumes one Crash Guard on a scrape and still rejects missed openings', () => {
    const gate = { ...COURSES[0].obstacles[0], shape: 'rectangle' as const, x: 0, y: 6, width: 8, height: 8 };
    const course = compileCourse({ ...COURSES[0], obstacles: [gate] });
    const racer = createRacer('guard'); purchase(racer, 'guard');
    Object.assign(racer, { x: 3.8, y: 6, z: gate.z - .1 });
    stepRacer(racer, idleInput(), course, 100);
    expect(racer.status).toBe('racing'); expect(racer.guardCharges).toBe(0); expect(racer.shieldUntilTick).toBe(160);
    Object.assign(racer, { x: 7, z: gate.z - .1 }); stepRacer(racer, idleInput(), course, 101);
    expect(racer.status).toBe('crashed');
  });
  it('jams the nearest eligible rival, respects range and immunity, and never takes steering away', () => {
    const a = { ...createRacer('a'), connected: true }, b = { ...createRacer('b'), connected: true }, c = { ...createRacer('c'), connected: true };
    purchase(a, 'jammer'); purchase(c, 'jammer'); b.z = 20; c.z = -10;
    resolveJammers([a, b, c], 100);
    expect(b.jammedUntilTick).toBe(280); expect(a.jammerCharges).toBe(0);
    expect(b.jamImmuneUntilTick).toBe(700);
    stepRacer(b, { ...idleInput(), steer: 1, boostHeld: true }, openCourse, 101);
    expect(b.boostActive).toBe(false); expect(b.heading).toBeGreaterThan(0);
    a.z = 1000; c.jammerCharges = 1; resolveJammers([a, b, c], 102);
    expect(c.jammerCharges).toBe(1); expect(b.jammedUntilTick).toBe(280);
    stepRacer(b, { ...idleInput(), boostHeld: true }, openCourse, 280); expect(b.boostActive).toBe(true);
  });
  it('never simulates movement or spends boost while a shop is open', () => {
    const racer = createRacer('paused'); openShop(racer, 500, true);
    stepRacer(racer, { ...idleInput(), boostHeld: true, flapPressed: true }, openCourse, 100);
    expect(racer.z).toBe(0); expect(racer.boostReserve).toBe(60);
    closeShop(racer); stepRacer(racer, idleInput(), openCourse, 101); expect(racer.z).toBeGreaterThan(0);
  });
});
