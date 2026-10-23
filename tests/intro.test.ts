import { expect, it } from 'vitest';
import { introShot, INTRO_SECONDS, PRE_RACE_SECONDS } from '../shared/intro';
import { GameSession } from '../server/session';

it('flies over the course before framing the starting lineup', () => {
  expect(introShot(0, 1000).lineup).toBe(false);
  expect(introShot(3, 1000).z).toBeGreaterThan(introShot(1, 1000).z);
  expect(introShot(4, 1000).lineup).toBe(true);
  expect(introShot(INTRO_SECONDS, 1000).z).toBe(0);
  expect(introShot(-1, 1000)).toEqual(introShot(0, 1000));
  expect(introShot(99, 1000)).toEqual(introShot(INTRO_SECONDS, 1000));
});

it('uses static shots for reduced motion', () => {
  expect(introShot(0, 1000, true)).toEqual(introShot(3, 1000, true));
  expect(introShot(4, 1000, true)).toEqual(introShot(6, 1000, true));
});

it('holds all racers at spawn through the intro and starts on one shared tick', () => {
  const session = new GameSession(false);
  for (const id of ['a', 'b']) { session.join(id, {}); session.ready(id, true); }
  session.start('a');
  for (const id of ['a', 'b']) session.loaded(id, session.state.courseHash, session.state.raceId);
  session.step(1, new Map());
  expect(session.state.startTick).toBe(1 + PRE_RACE_SECONDS * 60);
  session.step(session.state.startTick - 1, new Map());
  expect(session.state.phase).toBe('countdown');
  for (const player of session.state.players.values()) expect(player.z).toBe(0);
  session.step(session.state.startTick, new Map());
  expect(session.state.phase).toBe('racing');
  expect(session.state.players.get('a')!.z).toBe(session.state.players.get('b')!.z);
});
