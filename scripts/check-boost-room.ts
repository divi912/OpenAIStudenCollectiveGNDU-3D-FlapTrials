import { Client, type Room } from '@colyseus/sdk';
import { FlightInput, RaceSchema } from '../shared/schema';
import { PROTOCOL_VERSION, PHYSICS_VERSION } from '../shared/protocol';
import { pilot } from './autopilot';
import { getCourse } from '../shared/courses';

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
const client = new Client(process.env.SERVER_URL ?? 'http://127.0.0.1:2567');
const rooms: Room<any, RaceSchema>[] = [];
let timer: ReturnType<typeof setInterval> | undefined;
let activeSeen = false, drained = false, released = false;

try {
  const options = { protocolVersion: PROTOCOL_VERSION, physicsVersion: PHYSICS_VERSION,
    isPublic: false, name: 'Boost Check', courseId: 'crown_circuit' };
  const host = await client.create<RaceSchema>('race', options, RaceSchema);
  rooms.push(host);
  const guest = await client.joinById<RaceSchema>(host.roomId, { ...options, name: 'Observer' }, RaceSchema);
  rooms.push(guest);
  const inputs = rooms.map(room => room.input({ type: FlightInput }));
  let sequence = 0;
  for (const room of rooms) {
    room.reconnection.enabled = false;
    room.onMessage('notice', console.log);
    room.onStateChange(state => {
      if (state.phase === 'loading') room.send('action', { type: 'loaded', raceId: state.raceId, hash: state.courseHash });
    });
    room.send('action', { type: 'ready', value: true });
  }
  await wait(500);
  host.send('action', { type: 'start' });
  const begin = Date.now();
  timer = setInterval(() => {
    sequence++;
    rooms.forEach((room, index) => {
      const state = room.state, racer = state.players.get(room.sessionId);
      if (!racer) return;
      const command = pilot(racer, getCourse(state.courseId).definition, state.tick, state.startTick);
      Object.assign(inputs[index].data, command, { raceId: state.raceId, sequence,
        boostHeld: index === 0 && state.tick - state.startTick < 60 });
      inputs[index].send();
    });
    const observed = guest.state.players.get(host.sessionId);
    if (observed?.boostActive) {
      activeSeen = true;
      if (observed.boostReserve < 56) drained = true;
    }
    if (drained && !observed?.boostActive) released = true;
  }, 1000 / 60);
  while (Date.now() - begin < 22000 && !released) await wait(100);
  console.log(JSON.stringify({ protocol: host.state.protocolVersion, physics: host.state.physicsVersion,
    course: host.state.courseId, players: host.state.players.size, activeSeen, drained, released }));
  if (!activeSeen || !drained || !released) throw new Error('Live boost synchronization failed');
} finally {
  clearInterval(timer);
  // Close test sockets directly so a failed server cannot stall test teardown.
  for (const room of rooms) room.reconnection.enabled = false;
  await Promise.allSettled(rooms.map(room => room.leave(false)));
}
