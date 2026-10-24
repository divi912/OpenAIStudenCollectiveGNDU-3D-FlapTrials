import { Room, ServerError, type Client } from '@colyseus/core';
import { randomInt } from 'node:crypto';
import { FlightInput, RaceSchema } from '../../shared/schema';
import { PHYSICS_VERSION, PROTOCOL_VERSION, type InputFrame } from '../../shared/protocol';
import { GameSession } from '../session';
import { COURSES } from '../../shared/courses';
import { roomLimit } from '../config';
import { validAction, MESSAGE_LIMIT } from '../security';

export const liveRooms = new Map<string, RaceRoom>();
const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function newCode(): string { let code: string; do { code = Array.from({ length: 6 }, () => alphabet[randomInt(alphabet.length)]).join(''); } while (liveRooms.has(code)); return code; }

export class RaceRoom extends Room<{ state: RaceSchema; input: FlightInput }> {
  maxClients = 8;
  maxMessagesPerSecond = MESSAGE_LIMIT;
  model!: GameSession;
  inputs = this.defineInput(FlightInput, {
    bufferMaxSize: 32,
    sanitize: (f: FlightInput) => { f.steer = f.steer === -1 || f.steer === 1 ? f.steer : 0; f.pitch = f.pitch === -1 || f.pitch === 1 ? f.pitch : 0; f.roll = f.roll === -1 || f.roll === 1 ? f.roll : 0; },
    idle: true,
  });
  private commands = new Map<string, InputFrame>();
  private messageTimes = new Map<string, number>();
  private tickTimes: number[] = [];
  private tickCursor = 0;
  private publishedPhase = 'lobby';
  private lastActivity = Date.now();
  private publishPhase(): void {
    if (this.publishedPhase === this.state.phase) return;
    this.publishedPhase = this.state.phase;
    if (this.state.phase === 'lobby') this.unlock(); else this.lock();
    this.setMetadata({ code: this.state.code, isPublic: this.state.isPublic, phase: this.state.phase });
  }
  get metrics() {
    const sorted = [...this.tickTimes].sort((a, b) => a - b);
    return { players: this.state.players.size, phase: this.state.phase, p95TickMs: +(sorted[Math.floor(sorted.length * .95)] ?? 0).toFixed(3), maxInputQueue: Math.max(0, ...[...this.state.players.keys()].map(id => this.inputs.get(id).size)) };
  }
  onCreate(options: { isPublic?: boolean; courseId?: string; protocolVersion?: number; physicsVersion?: string }): void {
    if (options.protocolVersion !== PROTOCOL_VERSION || options.physicsVersion !== PHYSICS_VERSION) throw new ServerError(400, 'Game updated. Refresh this page to join.');
    if ((options.isPublic !== undefined && typeof options.isPublic !== 'boolean') || (options.courseId !== undefined && typeof options.courseId !== 'string')) throw new ServerError(400, 'Invalid room options.');
    if (liveRooms.size >= roomLimit()) throw new ServerError(503, 'Server full: all rooms are busy. Join an existing room or try again after a race ends.');
    this.model = new GameSession(!!options.isPublic, newCode(), options.isPublic ? COURSES[randomInt(COURSES.length)].id : options.courseId); this.state = this.model.state;
    liveRooms.set(this.state.code, this); this.setPatchRate(50);
    this.setMetadata({ code: this.state.code, isPublic: this.state.isPublic, phase: 'lobby' });
    this.clock.setInterval(() => {
      if (this.state.phase === 'lobby' && Date.now() - this.lastActivity > 10 * 60 * 1000) {
        this.broadcast('notice', 'This inactive lobby has closed. Create a new room when your flock is ready.');
        void this.disconnect(4000);
      }
    }, 30000);
    this.onMessage('action', (client, action: unknown) => {
      const now = Date.now(), last = this.messageTimes.get(client.sessionId) ?? 0;
      if (now - last < 40 || !validAction(action, this.state.raceId)) return;
      this.messageTimes.set(client.sessionId, now);
      this.lastActivity = now;
      switch (action.type) {
        case 'ready': this.model.ready(client.sessionId, action.value === true); break;
        case 'map': this.model.selectCourse(client.sessionId, action.value as string); break;
        case 'start': if (!this.model.start(client.sessionId)) client.send('notice', 'At least two birds must be ready.'); break;
        case 'loaded': this.model.loaded(client.sessionId, action.hash!, action.raceId!); break;
        case 'again': this.model.again(client.sessionId); break;
      }
      this.publishPhase();
    });
    this.setFixedTimestep(ctx => {
      const begin = performance.now();
      this.commands.clear();
      for (const [id] of this.state.players) {
        const command = this.inputs.get(id).next();
        if (command && command.raceId === this.state.raceId) this.commands.set(id, command);
      }
      this.model.step(ctx.tick, this.commands);
      this.publishPhase();
      for (const id of this.model.ejected.splice(0)) { const client = this.clients.getById(id); client?.send('notice', 'Loading timed out. Please rejoin the lobby.'); client?.leave(4000); }
      this.tickTimes[this.tickCursor++ % 256] = performance.now() - begin;
    }, 60);
  }
  onAuth(_client: Client, options: Record<string, unknown>): boolean {
    if (options.protocolVersion !== PROTOCOL_VERSION || options.physicsVersion !== PHYSICS_VERSION) throw new Error('Game updated. Refresh this page to join.');
    return true;
  }
  onJoin(client: Client, options: { name?: unknown; color?: unknown }): void { this.lastActivity = Date.now(); this.model.join(client.sessionId, options); }
  async onDrop(client: Client): Promise<void> {
    const p = this.state.players.get(client.sessionId); if (!p) return;
    if (this.state.phase !== 'racing') return;
    p.connected = false;
    try { await this.allowReconnection(client, 10); p.connected = true; }
    catch { if (p.status !== 'finished') p.status = 'dnf'; }
  }
  onLeave(client: Client): void {
    const p = this.state.players.get(client.sessionId); if (!p) return;
    this.messageTimes.delete(client.sessionId);
    if (this.state.phase !== 'racing') this.model.remove(client.sessionId);
    else {
      p.connected = false; if (p.status !== 'finished') p.status = 'dnf';
      if (this.state.hostId === client.sessionId) this.state.hostId = [...this.state.players.values()].find(v => v.connected)?.playerId ?? '';
    }
  }
  onDispose(): void { if (this.state) liveRooms.delete(this.state.code); }
}
