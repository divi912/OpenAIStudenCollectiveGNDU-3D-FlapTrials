import { getCourse, COMPILED_COURSES } from '../shared/courses';
import { idleInput, stepRacer } from '../shared/physics';
import { COLORS, cleanName, type InputFrame } from '../shared/protocol';
import { PlayerSchema, RaceSchema } from '../shared/schema';
import { PRE_RACE_SECONDS } from '../shared/intro';

export class GameSession {
  readonly state = new RaceSchema();
  readonly ejected: string[] = [];
  constructor(isPublic: boolean, code = 'LOCAL', courseId = 'skyline_sprint') { this.state.isPublic = isPublic; this.state.code = code; this.state.courseId = getCourse(courseId).definition.id; this.state.courseHash = getCourse(this.state.courseId).hash; }
  join(id: string, options: { name?: unknown; color?: unknown }): PlayerSchema {
    if (this.state.players.size >= 8 || this.state.phase !== 'lobby') throw new Error('This race is full or already underway.');
    const p = new PlayerSchema(); p.playerId = id; p.name = cleanName(options.name);
    p.color = COLORS.includes(options.color as typeof COLORS[number]) ? options.color as string : COLORS[this.state.players.size];
    p.ready = this.state.isPublic;
    this.state.players.set(id, p); if (!this.state.hostId) this.state.hostId = id;
    return p;
  }
  remove(id: string): void {
    this.state.players.delete(id);
    if (this.state.hostId === id) this.state.hostId = this.state.players.keys().next().value ?? '';
  }
  ready(id: string, ready: boolean): void {
    const p = this.state.players.get(id); if (p && this.state.phase === 'lobby') p.ready = ready;
  }
  selectCourse(id: string, courseId: string): boolean {
    if (id !== this.state.hostId || this.state.phase !== 'lobby' || !COMPILED_COURSES.has(courseId)) return false;
    this.state.courseId = courseId; this.state.courseHash = getCourse(courseId).hash;
    return true;
  }
  start(id: string): boolean {
    if (id !== this.state.hostId || this.state.phase !== 'lobby' || this.state.players.size < 2
      || [...this.state.players.values()].some(p => !p.ready || !p.connected)) return false;
    this.beginLoading(); return true;
  }
  private beginLoading(): void {
    this.state.phase = 'loading'; this.state.deadline = this.state.tick + 1800;
    for (const p of this.state.players.values()) { p.reset(); p.ready = true; }
  }
  loaded(id: string, hash: string, raceId: number): boolean {
    const p = this.state.players.get(id);
    if (!p || this.state.phase !== 'loading' || raceId !== this.state.raceId || hash !== this.state.courseHash) return false;
    p.loaded = true; return true;
  }
  again(id: string): void {
    if (!this.state.players.has(id) || this.state.phase !== 'results') return;
    this.state.raceId++; this.state.phase = 'lobby'; this.state.deadline = 0; this.state.startTick = 0;
    for (const [playerId, p] of this.state.players) if (!p.connected) this.remove(playerId);
    for (const p of this.state.players.values()) { p.reset(); p.ready = this.state.isPublic; }
  }
  step(tick: number, inputs: Map<string, InputFrame>): void {
    const s = this.state; s.tick = tick;
    if (s.phase === 'lobby' && s.isPublic) {
      const ready = [...s.players.values()].filter(p => p.ready && p.connected);
      if (ready.length < 2) s.deadline = 0;
      else if (!s.deadline) s.deadline = tick + 900;
      else if (tick >= s.deadline) {
        for (const [id, p] of s.players) if (!p.ready || !p.connected) { this.ejected.push(id); this.remove(id); }
        this.beginLoading();
      }
    }
    if (s.phase === 'loading') {
      if (tick >= s.deadline) for (const [id, p] of s.players) if (!p.loaded || !p.connected) { this.ejected.push(id); this.remove(id); }
      if (s.players.size < 2) { s.phase = 'lobby'; s.deadline = 0; return; }
      if ([...s.players.values()].every(p => p.loaded && p.connected)) {
        s.phase = 'countdown'; s.startTick = tick + PRE_RACE_SECONDS * 60;
      }
    }
    if (s.phase === 'countdown' && tick >= s.startTick) {
      if ([...s.players.values()].filter(p => p.connected).length < 2) { s.phase = 'lobby'; s.deadline = 0; return; }
      s.phase = 'racing'; for (const p of s.players.values()) p.simulationTick = tick - 1;
    }
    if (s.phase !== 'racing') { for (const p of s.players.values()) p.simulationTick = tick; return; }
    const course = getCourse(s.courseId);
    for (const [id, p] of s.players) stepRacer(p, p.connected ? inputs.get(id) ?? idleInput() : idleInput(), course, tick, s.startTick);
    if (tick - s.startTick >= Math.max(180, course.definition.estimatedClearSeconds + 90) * 60) {
      for (const p of s.players.values()) if (p.status !== 'finished') p.status = 'dnf';
    }
    if ([...s.players.values()].every(p => p.status === 'finished' || p.status === 'dnf')) s.phase = 'results';
  }
}
