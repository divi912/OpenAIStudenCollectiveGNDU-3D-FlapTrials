import { afterAll, beforeAll, expect, it } from 'vitest';
import { defineServer, defineRoom } from '@colyseus/core';
import { Client, type Room } from '@colyseus/sdk';
import { RaceRoom, liveRooms } from '../server/rooms/RaceRoom';
import { RaceSchema } from '../shared/schema';
import { PHYSICS_VERSION, PROTOCOL_VERSION } from '../shared/protocol';

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
    room.onStateChange(s => { if (s.phase === 'loading') room.send('action', { type: 'loaded', hash: s.courseHash, raceId: s.raceId }); });
    room.send('action', { type: 'ready', value: true });
  }
  await until(() => [...host.state.players.values()].every(p => p.ready));
  host.send('action', { type: 'start' });
  await until(() => host.state.phase === 'racing');
  const actual = liveRooms.get(host.state.code)!;
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
});
