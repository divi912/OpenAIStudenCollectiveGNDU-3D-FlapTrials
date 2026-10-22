import { Client, Predict, type Room, type InputHandle, type Reconciler } from '@colyseus/sdk';
import { FlightInput, PlayerSchema, RaceSchema, SIM_FIELDS } from '../../shared/schema';
import { PHYSICS_VERSION, PROTOCOL_VERSION, type InputFrame, type PlayerSnapshot } from '../../shared/protocol';
import { getCourse } from '../../shared/courses';
import { stepRacer } from '../../shared/physics';
import type { Data } from '@colyseus/schema';

export const SERVER_URL = (import.meta.env.VITE_SERVER_URL as string | undefined) ?? (import.meta.env.DEV ? `${location.protocol}//${location.hostname}:2567` : location.origin);
export class Connection {
  private client = new Client(SERVER_URL);
  room?: Room<any, RaceSchema>;
  private predictor?: Predict;
  private reconciler?: Reconciler<PlayerSchema, Data<FlightInput>>;
  private input?: InputHandle<FlightInput>;
  private sequence = 0;
  private lastRaceId = -1;
  private attached = false;
  private renderPlayers = new Map<string, PlayerSnapshot>();
  changed = () => {};
  notice = (_text: string) => {};
  lost = () => {};
  async connect(mode: 'create' | 'quick' | 'join', name: string, color: string, code = '', courseId = 'skyline_sprint'): Promise<void> {
    const options = { name, color, protocolVersion: PROTOCOL_VERSION, physicsVersion: PHYSICS_VERSION, isPublic: mode === 'quick', courseId };
    let room: Room<any, RaceSchema>;
    if (mode === 'join') {
      const response = await fetch(`${SERVER_URL}/api/rooms/${encodeURIComponent(code.toUpperCase())}`);
      const result = await response.json(); if (!response.ok) throw new Error(result.error ?? 'Could not find that room.');
      room = await this.client.joinById<RaceSchema>(result.roomId, options, RaceSchema);
    } else if (mode === 'quick') room = await this.client.joinOrCreate<RaceSchema>('race', options, RaceSchema);
    else room = await this.client.create<RaceSchema>('race', options, RaceSchema);
    this.room = room;
    room.reconnection.enabled = true;
    this.predictor = Predict.get(room, { mode: 'lerp', delay: 100 });
    this.input = room.input({ type: FlightInput });
    room.onStateChange(state => {
      if (state.protocolVersion !== PROTOCOL_VERSION || state.physicsVersion !== PHYSICS_VERSION || state.courseHash !== getCourse(state.courseId).hash) {
        this.notice('Game version changed. Refresh before joining.'); void this.leave(); return;
      }
      const me = state.players.get(room.sessionId);
      if (me && (!this.reconciler || this.lastRaceId !== state.raceId)) {
        this.reconciler?.dispose(); this.lastRaceId = state.raceId;
        this.reconciler = this.predictor!.reconciler(me, {
          input: this.input!, fields: SIM_FIELDS, smoothMs: 65, snap: 8,
          step: (_ctx, s, cmd) => {
            if (room.state.phase === 'racing' && cmd.raceId === room.state.raceId) stepRacer(s, cmd, getCourse(room.state.courseId), s.simulationTick + 1, room.state.startTick);
            else s.simulationTick = room.state.tick;
          },
        });
        if (!this.attached) { this.predictor!.attachAll('players', { mode: 'lerp', fields: ['x', 'y', 'z', 'vx', 'vy', 'speed'], snap: 8 }); this.attached = true; }
      }
      this.changed();
    });
    room.onMessage('notice', text => this.notice(String(text)));
    room.onError((_code, message) => this.notice(message ?? 'The connection hit a bump. Please rejoin the room.'));
    room.onDrop(() => this.notice('Connection interrupted. Reconnecting… the race clock continues.'));
    room.onReconnect(() => { this.reconciler?.reset(); this.notice('Back in the sky.'); });
    room.onLeave(() => { if (this.room === room) { this.room = undefined; this.disposePrediction(); this.lost(); } });
  }
  step(now: number, read: (sequence: number, tick: number) => InputFrame): void {
    if (!this.room || !this.predictor || !this.input || !this.reconciler) return;
    const n = Math.min(8, this.predictor.tick(now));
    for (let i = 0; i < n; i++) {
      const command = read(++this.sequence, this.room.state.tick);
      Object.assign(this.input.data, command, { raceId: this.room.state.raceId }); this.input.send();
    }
  }
  players(): PlayerSnapshot[] {
    if (!this.room) return [];
    const result: PlayerSnapshot[] = [];
    for (const [id, player] of this.room.state.players) {
      let p = this.renderPlayers.get(id);
      if (!p) { p = {} as PlayerSnapshot; this.renderPlayers.set(id, p); }
      const source = id === this.room.sessionId && this.reconciler ? this.reconciler.state : player;
      for (const field of SIM_FIELDS) (p as unknown as Record<string, unknown>)[field] = source[field];
      p.x = this.predictor?.value(player, 'x') ?? player.x; p.y = this.predictor?.value(player, 'y') ?? player.y; p.z = this.predictor?.value(player, 'z') ?? player.z;
      p.name = player.name; p.color = player.color; p.ready = player.ready; p.loaded = player.loaded; p.connected = player.connected;
      result.push(p);
    }
    for (const id of this.renderPlayers.keys()) if (!this.room.state.players.has(id)) this.renderPlayers.delete(id);
    return result;
  }
  get local(): PlayerSchema | undefined { return this.reconciler?.state; }
  get latency(): number { return Math.round(this.room?.clock.rtt() ?? 0); }
  action(type: string, value?: unknown) { this.room?.send('action', { type, value, raceId: this.room.state.raceId, hash: this.room.state.courseHash }); }
  private disposePrediction() { this.reconciler?.dispose(); this.predictor?.dispose(); this.reconciler = undefined; this.predictor = undefined; this.input = undefined; this.renderPlayers.clear(); this.lastRaceId = -1; this.attached = false; }
  async leave() {
    const room = this.room; this.room = undefined; this.disposePrediction();
    if (!room) return;
    room.reconnection.enabled = false;
    if (room.connection.isOpen) await room.leave(); else room.connection.close();
  }
}
