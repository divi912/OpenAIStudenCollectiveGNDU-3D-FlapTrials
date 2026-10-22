import { Client, type Room, type InputHandle } from '@colyseus/sdk';
import { FlightInput, RaceSchema } from '../shared/schema';
import { getCourse } from '../shared/courses';
import { PHYSICS_VERSION, PROTOCOL_VERSION } from '../shared/protocol';
import { pilot } from './autopilot';
import { writeFileSync, mkdirSync } from 'node:fs';

const endpoint = process.env.SERVER_URL ?? 'http://127.0.0.1:2567';
const roomCount = Number(process.env.ROOMS ?? 10), perRoom = Number(process.env.RACERS ?? 8), duration = Number(process.env.DURATION ?? 30);
const all: { room: Room<any, RaceSchema>; input: InputHandle<FlightInput>; sequence: number }[] = [];
const client = new Client(endpoint);
const options = { protocolVersion: PROTOCOL_VERSION, physicsVersion: PHYSICS_VERSION, isPublic: false, name: 'Load Bird' };
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
let handle: ReturnType<typeof setInterval> | undefined;
let failed = false;
try {
  for (let r = 0; r < roomCount; r++) {
    const host = await client.create<RaceSchema>('race', options, RaceSchema);
    const group = [host];
    for (let i = 1; i < perRoom; i++) group.push(await client.joinById<RaceSchema>(host.roomId, { ...options, name: `Bird ${r + 1}-${i + 1}` }, RaceSchema));
    for (const room of group) {
      const bird = { room, input: room.input({ type: FlightInput }), sequence: 0 }; all.push(bird);
      room.onError((code, message) => { failed = true; console.error('room error', code, message); });
      room.onMessage('notice', () => {});
      room.onStateChange(state => { if (state.phase === 'loading') room.send('action', { type: 'loaded', raceId: state.raceId, hash: state.courseHash }); });
      room.send('action', { type: 'ready', value: true });
    }
    await wait(100); host.send('action', { type: 'start' });
    console.log(`Room ${r + 1}: ${group.length} racers connected`);
  }
  const begin = performance.now(); let sentTicks = 0, totalInputs = 0;
  handle = setInterval(() => {
    const due = Math.min(8, Math.floor((performance.now() - begin) / (1000 / 60)) - sentTicks);
    for (let i = 0; i < due; i++) {
      sentTicks++;
      for (const bot of all) {
        const state = bot.room.state, player = state.players.get(bot.room.sessionId); if (!player) continue;
        const command = pilot(player, getCourse(state.courseId).definition, state.tick, state.startTick);
        Object.assign(bot.input.data, command, { raceId: state.raceId, sequence: ++bot.sequence }); bot.input.send(); totalInputs++;
      }
    }
  }, 8);
  const samples: unknown[] = [];
  for (let elapsed = 0; elapsed < duration; elapsed += 5) { await wait(Math.min(5, duration - elapsed) * 1000); const response = await fetch(`${endpoint}/health`); const health = await response.json(); samples.push(health); console.log(JSON.stringify(health)); }
  const summary = { date: new Date().toISOString(), endpoint, roomCount, perRoom, duration, totalInputs, samples,
    racers: all.map(b => ({ status: b.room.state.players.get(b.room.sessionId)?.status, z: b.room.state.players.get(b.room.sessionId)?.z, crashes: b.room.state.players.get(b.room.sessionId)?.crashCount, pendingInputs: b.input.pendingCount })) };
  mkdirSync('.cache', { recursive: true }); writeFileSync('.cache/loadtest.json', JSON.stringify(summary, null, 2));
  if (all.length !== roomCount * perRoom || totalInputs < roomCount * perRoom * duration * 50) failed = true;
  console.log(`Completed: ${all.length} clients; ${totalInputs} input frames; report .cache/loadtest.json`);
} finally { if (handle) clearInterval(handle); await Promise.allSettled(all.map(bot => bot.room.leave())); }
if (failed) process.exitCode = 1;
