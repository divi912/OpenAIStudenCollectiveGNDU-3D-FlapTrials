import { afterAll, beforeAll, expect, it } from 'vitest';
import { defineServer, defineRoom } from '@colyseus/core';
import { Client, type Room } from '@colyseus/sdk';
import { RaceRoom, liveRooms } from '../server/rooms/RaceRoom';
import { RaceSchema } from '../shared/schema';
import { PHYSICS_VERSION, PROTOCOL_VERSION } from '../shared/protocol';
import { getCourse } from '../shared/courses';

const server = defineServer({ rooms: { race: defineRoom(RaceRoom).filterBy(['isPublic']) } });
const clients: Room<any, RaceSchema>[] = [];
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
async function until(check: () => boolean) {
  const end = Date.now() + 12000;
  while (Date.now() < end) { if (check()) return; await delay(25); }
  throw new Error('Room transition timed out');
}
beforeAll(async () => { await server.listen(2570); });
afterAll(async () => {
  await Promise.allSettled(clients.filter(r => r.connection.isOpen).map(r => r.leave()));
  await server.gracefullyShutdown(false);
});

it('reopens admission and matchmaking metadata after a results-to-lobby rematch', async () => {
  const sdk = new Client('http://127.0.0.1:2570');
  const options = { protocolVersion: PROTOCOL_VERSION, physicsVersion: PHYSICS_VERSION, isPublic: false };
  const host = await sdk.create<RaceSchema>('race', options, RaceSchema); clients.push(host);
  const guest = await sdk.joinById<RaceSchema>(host.roomId, options, RaceSchema); clients.push(guest);
  await until(() => host.state.players.size === 2);
  for (const room of [host, guest]) {
    room.onMessage('notice', () => {});
    room.onStateChange(s => { if (s.phase === 'loading') room.send('action', { type: 'loaded', hash: s.courseHash, raceId: s.raceId }); if (s.phase === 'shopping' && !s.shopRound && !s.players.get(room.sessionId)?.shopReady) room.send('action', { type: 'shop-done', raceId: s.raceId }); });
  }
  guest.send('action', { type: 'ready', value: true });
  await until(() => host.state.players.get(guest.sessionId)?.ready === true);
  // A legitimate Ready/Start burst must not silently drop the second action.
  host.send('action', { type: 'ready', value: true });
  host.send('action', { type: 'start' });
  await until(() => host.state.phase === 'racing');
  const actual = liveRooms.get(host.state.code)!;
  // Move the authority's fixture to halfway, then exercise shop actions over real sockets.
  const leader = actual.state.players.get(host.sessionId)!;
  Object.assign(leader, { z: getCourse(actual.state.courseId).definition.length / 2 + 10, x: 0, y: 6, status: 'racing', shieldUntilTick: actual.state.tick + 1000 });
  await until(() => host.state.phase === 'shopping' && guest.state.phase === 'shopping');
  const positions = [...actual.state.players.values()].map(p => p.z), originalStart = actual.state.startTick;
  expect([...host.state.players.values()].map(p => p.flapPoints)).toEqual([150, 150]);
  await delay(200);
  expect([...actual.state.players.values()].map(p => p.z)).toEqual(positions);
  host.send('action', { type: 'buy', value: 'guard', raceId: host.state.raceId });
  await until(() => guest.state.players.get(host.sessionId)?.guardCharges === 1);
  expect(guest.state.players.get(host.sessionId)!.flapPoints).toBe(115);
  for (const room of [host, guest]) room.send('action', { type: 'shop-done', raceId: room.state.raceId });
  await until(() => host.state.phase === 'racing' && guest.state.phase === 'racing');
  expect(actual.state.startTick).toBeGreaterThan(originalStart);
  // End the fixture race through authoritative state; admission is tested over real transport.
  for (const p of actual.state.players.values()) { p.status = 'finished'; p.finishTick = actual.state.startTick + 1; }
  await until(() => host.state.phase === 'results');
  expect(actual.locked).toBe(true);
  host.send('action', { type: 'again' });
  await until(() => host.state.phase === 'lobby');
  const newcomer = await sdk.joinById<RaceSchema>(host.roomId, options, RaceSchema); clients.push(newcomer);
  expect(actual.locked).toBe(false);
  expect(actual.metadata.phase).toBe('lobby');
  expect(newcomer.roomId).toBe(host.roomId);
}, 25000);
