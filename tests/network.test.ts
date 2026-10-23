import { beforeAll, afterAll, expect, it } from 'vitest';
import { spawn, type ChildProcess } from 'node:child_process';
import { Client, type Room } from '@colyseus/sdk';
import { FlightInput, RaceSchema } from '../shared/schema';
import { PHYSICS_VERSION, PROTOCOL_VERSION } from '../shared/protocol';

let processHandle: ChildProcess;
const rooms: Room<any, RaceSchema>[] = [];
const endpoint = 'http://127.0.0.1:2568';
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
async function until(check: () => boolean | Promise<boolean>, ms = 15000) {
  const end = Date.now() + ms;
  while (Date.now() < end) { if (await check()) return; await delay(25); }
  throw new Error('Timed out waiting for authoritative state');
}
beforeAll(async () => {
  processHandle = spawn(process.execPath, ['--import', 'tsx', 'server/index.ts'], { windowsHide: true, env: { ...process.env, PORT: '2568', COLYSEUS_LATENCY: '250' }, stdio: ['ignore', 'pipe', 'pipe'] });
  processHandle.stdout?.on('data', () => {}); processHandle.stderr?.on('data', () => {});
  await until(async () => { try { return (await fetch(`${endpoint}/health`)).ok; } catch { return false; } });
}, 15000);
afterAll(async () => { try { await Promise.allSettled(rooms.filter(r => r.connection.isOpen).map(r => r.leave())); } finally { processHandle?.kill(); } });

it('keeps authority, reconnects the same racer and retains a voluntary quitter as DNF at 250 ms simulated RTT', async () => {
  const client = new Client(endpoint);
  const options = { protocolVersion: PROTOCOL_VERSION, physicsVersion: PHYSICS_VERSION, name: 'Latency Bird', isPublic: false };
  const a = await client.create<RaceSchema>('race', options, RaceSchema); rooms.push(a);
  const b = await client.joinById<RaceSchema>(a.roomId, options, RaceSchema); rooms.push(b);
  for (const room of [a, b]) {
    room.onMessage('notice', () => {});
    room.onStateChange(s => { if (s.phase === 'loading') room.send('action', { type: 'loaded', hash: s.courseHash, raceId: s.raceId }); });
  }
  await until(() => a.state.players.size === 2 && b.state.players.size === 2);
  a.send('action', { type: 'ready', value: true }); b.send('action', { type: 'ready', value: true });
  await until(() => [...a.state.players.values()].every(p => p.ready));
  a.send('action', { type: 'start' });
  await until(() => a.state.phase === 'racing' && b.state.phase === 'racing');
  expect(a.state.startTick).toBe(b.state.startTick);
  const input = a.input({ type: FlightInput });
  Object.assign(input.data, { sequence: 99999, tick: 1000000000, steer: 1, flapPressed: true, diveHeld: true, raceId: a.state.raceId }); input.send();
  await delay(500);
  const me = a.state.players.get(a.sessionId)!;
  expect(me.z).toBeLessThan(40); expect(me.checkpointIndex).toBe(0); expect(me.status).not.toBe('finished'); expect(me.speed).toBeLessThanOrEqual(22);
  const token = b.reconnectionToken, id = b.sessionId, startTick = a.state.startTick;
  b.reconnection.enabled = false; b.connection.close();
  await until(() => a.state.players.get(id)?.connected === false);
  const c = await client.reconnect<RaceSchema>(token, RaceSchema); rooms.push(c); c.onMessage('notice', () => {});
  await until(() => a.state.players.get(id)?.connected === true);
  expect(c.sessionId).toBe(id); expect(a.state.startTick).toBe(startTick);
  await c.leave(); await until(() => a.state.players.get(id)?.status === 'dnf');
  expect(a.state.players.has(id)).toBe(true); expect(a.state.players.get(id)!.connected).toBe(false);
}, 35000);
