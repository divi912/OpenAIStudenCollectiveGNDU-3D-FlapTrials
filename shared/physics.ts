import { crossingFraction, sweepSphereMovingBox } from './collision';
import { apertureClearance, isGate, obstacleBoxes, obstacleBoxAt, obstaclePose } from './courses';
import { DT, type CompiledCourse, type InputFrame, type RacerState, type Vec3 } from './protocol';
import { partyEvent } from './party';

export const PHYSICS = Object.freeze({ gravity: 12, flapImpulse: 5.5, maxClimb: 8, maxFall: 15, baseSpeed: 16, maxSpeed: 22,
  maxLateral: 6, flapIntervalTicks: 8, respawnTicks: 36, radius: 0.42,
  lateralAcceleration: 23, lateralDrag: 3.8, diveAcceleration: 15, diveSpeedRecovery: 2.1, speedRecovery: 1.4, flapSpeedCost: 0.65 });
export function idleInput(): InputFrame { return { sequence: 0, tick: 0, steer: 0, flapPressed: false, diveHeld: false }; }
export function createRacer(playerId: string): RacerState {
  return { playerId, x: 0, y: 6, z: 0, vx: 0, vy: 0, speed: 16, checkpointIndex: 0, sectionProgress: 0,
    crashCount: 0, status: 'racing', nextFlapTick: 0, respawnTick: 0, finishTick: -1, finishFraction: 0, lastProcessedSequence: -1, simulationTick: -1, crashCause: '', boostUntilTick: 0, shieldUntilTick: 0, pickupMask: 0 };
}
export function respawnRacer(s: RacerState, course: CompiledCourse): void {
  const cp = course.definition.checkpoints[s.checkpointIndex - 1];
  s.x = cp?.x ?? 0; s.y = cp?.y ?? 6; s.z = cp?.z ?? 0;
  s.vx = 0; s.vy = 0; s.speed = 16; s.status = 'racing'; s.sectionProgress = 0;
}
function crash(s: RacerState, tick: number, cause: string): void {
  s.status = 'crashed'; s.crashCount++; s.respawnTick = tick + PHYSICS.respawnTicks; s.crashCause = cause;
  s.boostUntilTick = 0; s.shieldUntilTick = 0;
}
export function stepRacer(s: RacerState, input: InputFrame, course: CompiledCourse, tick: number, raceStartTick = 0): void {
  s.simulationTick = tick;
  if (s.status === 'finished' || s.status === 'dnf') return;
  s.lastProcessedSequence = Math.max(s.lastProcessedSequence, input.sequence);
  if (s.status === 'crashed') { if (tick >= s.respawnTick) { respawnRacer(s, course); s.nextFlapTick = tick; } return; }
  const from: Vec3 = [s.x, s.y, s.z];
  const seconds = (tick - raceStartTick) * DT, event = partyEvent(seconds);
  const chaos = event.warning ? 'calm' : event.kind;
  const shielded = tick < s.shieldUntilTick;
  const targetSpeed = (input.diveHeld ? PHYSICS.maxSpeed : PHYSICS.baseSpeed) + (chaos === 'turbo' ? 6 : 0) + (tick < s.boostUntilTick ? 9 : 0);
  if (input.flapPressed && tick >= s.nextFlapTick) {
    s.vy = Math.min(PHYSICS.maxClimb, s.vy + PHYSICS.flapImpulse);
    s.speed = Math.max(PHYSICS.baseSpeed - 1, s.speed - PHYSICS.flapSpeedCost);
    s.nextFlapTick = tick + PHYSICS.flapIntervalTicks;
  }
  s.vy = Math.max(-PHYSICS.maxFall, s.vy - (PHYSICS.gravity * (chaos === 'moon' ? .45 : 1) + (input.diveHeld ? PHYSICS.diveAcceleration : 0)) * DT);
  s.vx += input.steer * PHYSICS.lateralAcceleration * DT;
  s.vx *= Math.exp(-PHYSICS.lateralDrag * DT);
  s.vx = Math.max(-PHYSICS.maxLateral, Math.min(PHYSICS.maxLateral, s.vx));
  if (chaos === 'crosswind') s.vx = Math.max(-6, Math.min(6, s.vx + Math.sin(seconds * 1.7) * 14 * DT));
  s.speed += (Math.min(30, targetSpeed) - s.speed) * (1 - Math.exp(-(targetSpeed > 22 ? 4 : input.diveHeld ? PHYSICS.diveSpeedRecovery : PHYSICS.speedRecovery) * DT));
  const candidates = course.bins.get(Math.floor(s.z / 64)) ?? [];
  for (const o of candidates) {
    if (Math.abs(s.z - o.z) < 7 && Math.abs(s.x - o.x) < o.width / 2 && Math.abs(s.y - o.y) < o.height / 2) {
      if (o.kind === 'gust') s.vx = Math.max(-6, Math.min(6, s.vx + o.strength * DT));
      if (o.kind === 'speed_zone') { s.speed = Math.max(s.speed, Math.min(Math.min(30, Math.max(PHYSICS.maxSpeed, targetSpeed)), s.speed + 6 * DT)); s.vy = Math.max(-15, s.vy - 3 * DT); }
    }
  }
  const to: Vec3 = [s.x + s.vx * DT, s.y + s.vy * DT, s.z + s.speed * DT];
  let impact = 2;
  let crashCause = 'obstacle';
  for (const o of candidates) {
    if (Math.abs(o.z - s.z) > 4 || !isGate(o)) continue;
    const moving = o.kind === 'shutter' || o.kind === 'rotating_gate';
    const boxes = obstacleBoxes(o, seconds);
    const bound = moving ? (Math.PI * 2 / o.period * (o.kind === 'shutter' ? o.amplitude : Math.hypot(o.width / 2 + 3, o.height / 2 + 3))) * DT : 0;
    for (let i = 0; i < boxes.length && !shielded; i++) {
      const fraction = sweepSphereMovingBox(from, to, PHYSICS.radius, moving ? t => obstacleBoxAt(o, seconds + t * DT, i) : () => boxes[i], bound);
      if (fraction !== null) impact = Math.min(impact, fraction);
    }
    const crossing = crossingFraction(from[2], to[2], o.z);
    if (crossing !== null && crossing < impact) {
      const pose = obstaclePose(o, seconds + crossing * DT);
      const dx = from[0] + (to[0] - from[0]) * crossing - pose.x;
      const dy = from[1] + (to[1] - from[1]) * crossing - pose.y;
      const x = dx * Math.cos(pose.angle) + dy * Math.sin(pose.angle);
      const y = -dx * Math.sin(pose.angle) + dy * Math.cos(pose.angle);
      if (apertureClearance(o, x, y) < (shielded ? .01 : PHYSICS.radius)) { impact = crossing; crashCause = 'missed_gate'; }
    }
  }
  const d = course.definition;
  for (const [a, b, plane, positive] of [[from[0], to[0], d.width / 2 - PHYSICS.radius, true], [from[0], to[0], -d.width / 2 + PHYSICS.radius, false], [from[1], to[1], d.ceiling - PHYSICS.radius, true], [from[1], to[1], d.floor + PHYSICS.radius, false]] as const) {
    if (positive ? b > plane : b < plane) { const hit = Math.max(0, (plane - a) / (b - a)); if (hit < impact) { impact = hit; crashCause = 'bounds'; } }
  }
  const cp = d.checkpoints[s.checkpointIndex];
  if (cp) {
    const crossing = crossingFraction(from[2], to[2], cp.z);
    if (crossing !== null && crossing < impact) s.checkpointIndex++;
  }
  const finish = crossingFraction(from[2], to[2], d.length);
  if (finish !== null && finish < impact && s.checkpointIndex === d.checkpoints.length) {
    s.status = 'finished'; s.finishTick = tick; s.finishFraction = finish;
  } else if (finish !== null && s.checkpointIndex !== d.checkpoints.length) impact = Math.min(impact, finish);
  if (impact <= 1 && s.status !== 'finished') {
    s.x = from[0] + (to[0] - from[0]) * impact; s.y = from[1] + (to[1] - from[1]) * impact; s.z = from[2] + (to[2] - from[2]) * impact;
    crash(s, tick, crashCause);
  } else { s.x = to[0]; s.y = to[1]; s.z = to[2]; }
  if (s.status === 'racing') for (const o of candidates) {
    if (o.kind !== 'pickup' || (s.pickupMask & (1 << o.pickupIndex!))) continue;
    const crossing = crossingFraction(from[2], s.z, o.z);
    if (crossing !== null && Math.hypot((from[0] + (s.x - from[0]) * crossing - o.x) / (o.width / 2), (from[1] + (s.y - from[1]) * crossing - o.y) / (o.height / 2)) < 1) {
      s.pickupMask |= 1 << o.pickupIndex!;
      if (o.powerUp === 'boost') s.boostUntilTick = tick + 150; else s.shieldUntilTick = tick + 240;
    }
  }
  const previousZ = d.checkpoints[s.checkpointIndex - 1]?.z ?? 0;
  const nextZ = d.checkpoints[s.checkpointIndex]?.z ?? d.length;
  s.sectionProgress = Math.max(0, Math.min(1, (s.z - previousZ) / (nextZ - previousZ)));
}
export function replay(state: RacerState, inputs: InputFrame[], course: CompiledCourse, startTick: number, raceStartTick = 0): RacerState {
  for (let i = 0; i < inputs.length; i++) stepRacer(state, inputs[i], course, startTick + i, raceStartTick);
  return state;
}
