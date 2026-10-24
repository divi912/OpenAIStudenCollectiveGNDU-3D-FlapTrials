import { beforeEach, afterEach, expect, it } from 'vitest';
import { spawn, type ChildProcess } from 'node:child_process';
import { Client, type Room } from '@colyseus/sdk';
import WebSocket from 'ws';
import { request as httpRequest } from 'node:http';
import { RaceSchema } from '../shared/schema';
import { PROTOCOL_VERSION, PHYSICS_VERSION } from '../shared/protocol';

const endpoint = 'http://127.0.0.1:2574', origin = 'https://game.test';
const options = { protocolVersion: PROTOCOL_VERSION, physicsVersion: PHYSICS_VERSION, isPublic: false };
let handle: ChildProcess;
let rooms: Room<any, RaceSchema>[] = [];
beforeEach(async () => {
  rooms = [];
  handle = spawn(process.execPath, ['--import', 'tsx', 'server/index.ts'], { windowsHide: true, stdio: 'ignore', env: { ...process.env, PORT: '2574', CLIENT_ORIGIN: origin, HTTP_REQUESTS_PER_MINUTE: '5', HEALTH_REQUESTS_PER_MINUTE: '20' } });
  const until = Date.now() + 10000;
  while (Date.now() < until) { try { if ((await fetch(`${endpoint}/health`)).ok) return; } catch {} await new Promise(r => setTimeout(r, 50)); }
  throw new Error('Abuse fixture did not start.');
});
afterEach(async () => { await Promise.allSettled(rooms.filter(r => r.connection.isOpen).map(r => r.leave())); handle?.kill(); });
const post = (body: string, extra: Record<string, string> = {}) => fetch(`${endpoint}/matchmake/create/race`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...extra }, body });

it('guards actual Colyseus matchmaking before Express, including spoofed forwarding headers', async () => {
  expect((await post('{}', { Origin: 'https://foreign.test' })).status).toBe(403);
  expect((await post('x'.repeat(9000))).status).toBe(413);
  expect((await post('{}')).ok).toBe(false); // Missing protocol rejected before allocation.
  expect((await (await fetch(`${endpoint}/health`)).json()).rooms).toBe(0);
  expect((await post('not-json')).status).toBe(400);
  expect((await post('{}', { 'Content-Type': 'text/plain' })).status).toBe(415);
  const client = new Client(endpoint), room = await client.create<RaceSchema>('race', options, RaceSchema); rooms.push(room);
  const limited = await post(JSON.stringify(options), { 'X-Forwarded-For': '203.0.113.1', 'CF-Connecting-IP': '203.0.113.2' });
  expect(limited.status).toBe(429); expect(Number(limited.headers.get('Retry-After'))).toBeGreaterThan(0);
  expect(room.connection.isOpen).toBe(true);
});

it('rejects foreign WebSockets and disconnects oversized frames and message floods without harming other racers', async () => {
  const rejected = await new Promise<number>((resolve, reject) => {
    const ws = new WebSocket('ws://127.0.0.1:2574/unknown/room', { origin: 'https://foreign.test' });
    ws.on('unexpected-response', (_request, response) => { response.resume(); ws.terminate(); resolve(response.statusCode ?? 0); });
    ws.on('error', () => {}); ws.on('open', () => { ws.close(); reject(new Error('Foreign origin was accepted')); });
  });
  expect(rejected).toBe(403);
  const client = new Client(endpoint), host = await client.create<RaceSchema>('race', options, RaceSchema); rooms.push(host);
  const guest = await client.joinById<RaceSchema>(host.roomId, options, RaceSchema); rooms.push(guest);
  host.reconnection.enabled = false; guest.reconnection.enabled = false;
  host.onError(() => {}); guest.onError(() => {});
  const oversizedClose = new Promise<void>(resolve => host.onLeave(() => resolve()));
  host.send('action', 'x'.repeat(5000));
  await oversizedClose; expect(guest.connection.isOpen).toBe(true);
  const spammer = await client.joinById<RaceSchema>(guest.roomId, options, RaceSchema); rooms.push(spammer);
  spammer.reconnection.enabled = false; spammer.onError(() => {});
  const floodClose = new Promise<void>(resolve => spammer.onLeave(() => resolve()));
  for (let i = 0; i < 400; i++) spammer.send('action', { type: 'ready', value: true });
  await floodClose;
  expect(guest.connection.isOpen).toBe(true);
}, 15000);

it('bounds chunked bodies too and keeps serving after an oversized streamed request', async () => {
  await new Promise<void>((resolve, reject) => {
    const request = httpRequest(`${endpoint}/matchmake/create/race`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Transfer-Encoding': 'chunked' } }, response => {
      expect(response.statusCode).toBe(413); response.resume(); response.on('end', resolve); response.on('error', () => resolve());
    });
    request.on('error', error => { if ((error as NodeJS.ErrnoException).code === 'ECONNRESET') resolve(); else reject(error); });
    for (let i = 0; i < 10; i++) request.write('x'.repeat(1000)); request.end();
  });
  expect((await fetch(`${endpoint}/health`)).ok).toBe(true);
  const room = await new Client(endpoint).create<RaceSchema>('race', options, RaceSchema); rooms.push(room);
  expect(room.connection.isOpen).toBe(true);
});

it('rejects malformed URL headers without stopping rooms, and covers Express route aliases', async () => {
  expect((await post(JSON.stringify(options), { 'X-Forwarded-Proto': ':' })).status).toBe(400);
  const hostStatus = await new Promise<number>((resolve, reject) => {
    const request = httpRequest(`${endpoint}/matchmake/create/race`, { method: 'POST', headers: { Host: 'bad/path', 'Content-Type': 'application/json' } }, response => { response.resume(); resolve(response.statusCode ?? 0); });
    request.on('error', reject); request.end(JSON.stringify(options));
  });
  expect(hostStatus).toBe(400);
  expect((await fetch(`${endpoint}/health`)).ok).toBe(true);
  expect((await fetch(`${endpoint}/API/rooms/ABC123`, { headers: { Origin: 'https://foreign.test' } })).status).toBe(403);
  for (let i = 0; i < 5; i++) expect((await fetch(`${endpoint}/API/courses/`)).status).toBe(200);
  expect((await fetch(`${endpoint}/api/courses`)).status).toBe(429);
  let healthStatus = 0;
  for (let i = 0; i < 21; i++) { const response = await fetch(`${endpoint}/HEALTH/`); healthStatus = response.status; await response.arrayBuffer(); }
  expect(healthStatus).toBe(429);
}, 15000);
