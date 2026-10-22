export const PROTOCOL_VERSION = 3;
export const PHYSICS_VERSION = 'flight-3d-3';
export const TICK_RATE = 60;
export const DT = 1 / TICK_RATE;
export const COLORS = ['#ffcc42', '#55bce7', '#ee6865', '#77c875', '#b58ae0', '#f4a36d', '#65cbb6', '#f28eae'] as const;
export type Vec3 = [number, number, number];
export type RacerStatus = 'racing' | 'crashed' | 'finished' | 'dnf';
export type RoomPhase = 'lobby' | 'loading' | 'countdown' | 'racing' | 'results';
export interface InputFrame { sequence: number; tick: number; steer: -1 | 0 | 1; flapPressed: boolean; diveHeld: boolean; pitch?: -1 | 0 | 1; roll?: -1 | 0 | 1 }
export interface RacerState {
  playerId: string; x: number; y: number; z: number; vx: number; vy: number; speed: number;
  checkpointIndex: number; sectionProgress: number; crashCount: number; status: RacerStatus;
  nextFlapTick: number; respawnTick: number; finishTick: number; finishFraction: number;
  lastProcessedSequence: number;
  simulationTick: number;
  crashCause: string;
  boostUntilTick: number; shieldUntilTick: number; pickupMask: number;
  heading: number; pitch: number; roll: number; rollTravel: number; trickCount: number;
  gatesCleared: number; cleanStreak: number; bestStreak: number; styleScore: number;
}
export interface PlayerSnapshot extends RacerState { name: string; color: string; ready: boolean; loaded: boolean; connected: boolean }
export interface RoomSnapshot {
  roomId: string; code: string; raceId: number; phase: RoomPhase; hostId: string; isPublic: boolean;
  courseId: string; courseHash: string; physicsVersion: string; protocolVersion: number;
  tick: number; startTick: number; deadline: number; players: Record<string, PlayerSnapshot>;
}
export interface Box { center: Vec3; half: Vec3; angle?: number }
export type ApertureShape = 'circle' | 'oval' | 'triangle' | 'diamond' | 'hexagon' | 'rectangle';
export type ObstacleKind = 'ring' | 'wall' | 'shutter' | 'rotating_gate' | 'twist_gate' | 'gust' | 'speed_zone' | 'pickup';
export interface ObstacleDefinition {
  id: string; kind: ObstacleKind; z: number; x: number; y: number; width: number; height: number;
  thickness: number; period: number; phase: number; amplitude: number; strength: number;
  shape?: ApertureShape; powerUp?: 'boost' | 'shield'; pickupIndex?: number;
  tilt?: number;
}
export interface CheckpointDefinition { id: string; z: number; x: number; y: number }
export interface CourseDefinition {
  id: string; version: string; name: string; subtitle: string; difficulty: string; difficultyIndex: number;
  description: string; color: string; sky: string; ground: string; estimatedClearSeconds: number;
  length: number; width: number; floor: number; ceiling: number; finishY: number;
  checkpoints: CheckpointDefinition[]; obstacles: ObstacleDefinition[];
  path?: { turn: number; wavelength: number; lift: number };
}
export interface CompiledCourse {
  definition: CourseDefinition; hash: string; bins: Map<number, ObstacleDefinition[]>;
}
export function sanitizeInput(raw: unknown): InputFrame | null {
  if (!raw || typeof raw !== 'object') return null;
  const v = raw as Record<string, unknown>;
  if (!Number.isSafeInteger(v.sequence) || (v.sequence as number) < 0 || !Number.isSafeInteger(v.tick)
    || ![-1, 0, 1].includes(v.steer as number) || ![-1, 0, 1].includes((v.pitch ?? 0) as number) || ![-1, 0, 1].includes((v.roll ?? 0) as number) || typeof v.flapPressed !== 'boolean' || typeof v.diveHeld !== 'boolean') return null;
  return { sequence: v.sequence as number, tick: v.tick as number, steer: v.steer as -1 | 0 | 1, flapPressed: v.flapPressed, diveHeld: v.diveHeld, pitch: (v.pitch ?? 0) as -1 | 0 | 1, roll: (v.roll ?? 0) as -1 | 0 | 1 };
}
export function cleanName(value: unknown): string {
  return typeof value === 'string' ? value.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 20) || 'Little Bird' : 'Little Bird';
}
export function rankRacers<T extends RacerState>(players: T[]): T[] {
  return [...players].sort((a, b) => {
    if (a.status === 'finished' && b.status === 'finished') return (a.finishTick - b.finishTick) || (a.finishFraction - b.finishFraction) || a.playerId.localeCompare(b.playerId);
    if (a.status === 'finished') return -1;
    if (b.status === 'finished') return 1;
    return (b.checkpointIndex - a.checkpointIndex) || (b.sectionProgress - a.sectionProgress) || a.playerId.localeCompare(b.playerId);
  });
}
export function finishSeconds(p: RacerState, startTick: number): number { return Math.max(0, (p.finishTick + p.finishFraction - startTick) / TICK_RATE); }

