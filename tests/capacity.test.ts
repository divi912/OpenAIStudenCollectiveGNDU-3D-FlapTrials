import { beforeAll, afterAll, expect, it } from 'vitest';
import { spawn, type ChildProcess } from 'node:child_process';
import { Client, type Room } from '@colyseus/sdk';
import { RaceSchema } from '../shared/schema';
import { PROTOCOL_VERSION, PHYSICS_VERSION } from '../shared/protocol';

let processHandle: ChildProcess;
const rooms: Room<any, RaceSchema>[] = [];
const endpoint = 'http://127.0.0.1:2572';
beforeAll(async () => {
  processHandle = spawn(process.execPath, ['--import', 'tsx', 'server/index.ts'], { windowsHide: true, stdio: 'ignore', env: { ...process.env, PORT: '2572', MAX_ROOMS: '1', CLIENT_ORIGIN: 'https://flaptrials.divii.xyz.' } });
  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) {
    try { if ((await fetch(`${endpoint}/health`)).ok) return; } catch { }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error('Capacity fixture server did not start.');
});
afterAll(async () => { await Promise.allSettled(rooms.map(r => r.leave())); processHandle?.kill(); });

it('reports capacity, rejects extra rooms, allows existing-room joins and fixes configured CORS', async () => {
  const client = new Client(endpoint);
  const options = { protocolVersion: PROTOCOL_VERSION, physicsVersion: PHYSICS_VERSION, isPublic: false };
  const host = await client.create<RaceSchema>('race', options, RaceSchema); rooms.push(host);
  const response = await fetch(`${endpoint}/health`, { headers: { Origin: 'https://untrusted.example' } });
  expect(response.headers.get('access-control-allow-origin')).toBe('https://flaptrials.divii.xyz');
  expect(response.headers.get('cache-control')).toBe('no-store');
  expect((await response.json()).capacity).toMatchObject({ maxRooms: 1, acceptingNewRooms: false });
  await expect(client.create('race', options)).rejects.toThrow('Server full');
  for (let i = 1; i < 8; i++) rooms.push(await client.joinById<RaceSchema>(host.roomId, options, RaceSchema));
  const result = await fetch(`${endpoint}/api/rooms/${host.state.code}`);
  expect(result.status).toBe(409);
  expect((await result.json()).error).toContain('full');
});
