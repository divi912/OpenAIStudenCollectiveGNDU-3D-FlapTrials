import { crossingFraction, sweepSphereMovingBox } from './collision';
import { apertureClearance, isGate, obstacleBoxes, obstacleBoxAt, obstaclePose } from './courses';
import { DT, type CompiledCourse, type InputFrame, type RacerState, type Vec3 } from './protocol';
import { partyEvent } from './party';
import { wingOffset, wrapAngle, bodyRoll } from './track';

export const PHYSICS = Object.freeze({ gravity: 12, flapImpulse: 5.5, maxClimb: 8, maxFall: 15, baseSpeed: 16, maxSpeed: 22,
  maxLateral: 10, flapIntervalTicks: 8, respawnTicks: 36, radius: 0.32,
  lateralAcceleration: 23, lateralDrag: 3.8, diveAcceleration: 15, diveSpeedRecovery: 2.1, speedRecovery: 1.4, flapSpeedCost: 0.65 });
export function idleInput(): InputFrame { return { sequence: 0, tick: 0, steer: 0, flapPressed: false, diveHeld: false, pitch: 0, roll: 0 }; }
export function createRacer(playerId: string): RacerState {
  return { playerId, x: 0, y: 6, z: 0, vx: 0, vy: 0, speed: 16, checkpointIndex: 0, sectionProgress: 0,
    crashCount: 0, status: 'racing', nextFlapTick: 0, respawnTick: 0, finishTick: -1, finishFraction: 0, lastProcessedSequence: -1, simulationTick: -1, crashCause: '', boostUntilTick: 0, shieldUntilTick: 0, pickupMask: 0,
    heading: 0, pitch: 0, roll: 0, rollTravel: 0, trickCount: 0, gatesCleared: 0, cleanStreak: 0, bestStreak: 0, styleScore: 0 };
}
export function respawnRacer(s: RacerState, course: CompiledCourse): void {
  const cp = course.definition.checkpoints[s.checkpointIndex - 1];
  s.x = cp?.x ?? 0; s.y = cp?.y ?? 6; s.z = cp?.z ?? 0;
  s.vx = 0; s.vy = 0; s.speed = 16; s.status = 'racing'; s.sectionProgress = 0;
  s.heading = 0; s.pitch = 0; s.roll = 0; s.rollTravel = 0; s.cleanStreak = 0;
}
function crash(s: RacerState, tick: number, cause: string): void {
  s.status = 'crashed'; s.crashCount++; s.respawnTick = tick + PHYSICS.respawnTicks; s.crashCause = cause;
  s.boostUntilTick = 0; s.shieldUntilTick = 0;
  s.cleanStreak = 0; s.rollTravel = 0;
}
export function stepRacer(s: RacerState, input: InputFrame, course: CompiledCourse, tick: number, raceStartTick = 0): void {
  s.simulationTick = tick;
  if (s.status === 'finished' || s.status === 'dnf') return;
  s.lastProcessedSequence = Math.max(s.lastProcessedSequence, input.sequence);
  if (s.status === 'crashed') { if (tick >= s.respawnTick) { respawnRacer(s, course); s.nextFlapTick = tick; } return; }
  const from: Vec3 = [s.x, s.y, s.z];
  const oldWing = wingOffset(s.heading, s.pitch, s.roll), oldHeading = s.heading, oldPitch = s.pitch, oldRoll = s.roll;
  s.heading = Math.max(-.65, Math.min(.65, input.steer ? s.heading + input.steer * 1.25 * DT : s.heading * Math.exp(-2.6 * DT)));
  s.pitch = Math.max(-.6, Math.min(.6, input.pitch ? s.pitch + input.pitch * 1.1 * DT : s.pitch * Math.exp(-2.4 * DT)));
  const rollDelta = (input.roll ?? 0) * 6.4 * DT;
  s.roll += rollDelta || -wrapAngle(s.roll) * (1 - Math.exp(-.8 * DT));
  s.rollTravel += s.roll - oldRoll;
  if (Math.abs(s.rollTravel) >= Math.PI * 2) { s.rollTravel -= Math.sign(s.rollTravel) * Math.PI * 2; s.trickCount++; s.styleScore += 200; }
  const seconds = (tick - raceStartTick) * DT, event = partyEvent(seconds);
  const chaos = event.warning ? 'calm' : event.kind;
  const shielded = tick < s.shieldUntilTick;
  const targetSpeed = (input.diveHeld ? PHYSICS.maxSpeed : PHYSICS.baseSpeed) + (chaos === 'turbo' ? 6 : 0) + (tick < s.boostUntilTick ? 9 : 0);
  if (input.flapPressed && tick >= s.nextFlapTick) {
    s.vy = Math.min(PHYSICS.maxClimb, s.vy + PHYSICS.flapImpulse * (.45 + .55 * Math.cos(bodyRoll(s.heading, s.roll))) * Math.cos(s.pitch));
    s.vx -= Math.sin(bodyRoll(s.heading, s.roll)) * PHYSICS.flapImpulse * .15;
    s.speed = Math.max(PHYSICS.baseSpeed - 1, s.speed - PHYSICS.flapSpeedCost);
    s.nextFlapTick = tick + PHYSICS.flapIntervalTicks;
  }
  s.vy = Math.max(-PHYSICS.maxFall, s.vy - (PHYSICS.gravity * (chaos === 'moon' ? .45 : 1) + (input.diveHeld ? PHYSICS.diveAcceleration : 0)) * DT);
  s.vx += (Math.sin(s.heading) * s.speed - s.vx) * (1 - Math.exp(-5 * DT));
  s.vx = Math.max(-PHYSICS.maxLateral, Math.min(PHYSICS.maxLateral, s.vx));
  if (chaos === 'crosswind') s.vx = Math.max(-PHYSICS.maxLateral, Math.min(PHYSICS.maxLateral, s.vx + Math.sin(seconds * 1.7) * 14 * DT));
  s.speed += (Math.min(30, targetSpeed) - s.speed) * (1 - Math.exp(-(targetSpeed > 22 ? 4 : input.diveHeld ? PHYSICS.diveSpeedRecovery : PHYSICS.speedRecovery) * DT));
  const candidates = course.bins.get(Math.floor(s.z / 64)) ?? [];
  for (const o of candidates) {
    if (Math.abs(s.z - o.z) < 7 && Math.abs(s.x - o.x) < o.width / 2 && Math.abs(s.y - o.y) < o.height / 2) {
      if (o.kind === 'gust') s.vx = Math.max(-PHYSICS.maxLateral, Math.min(PHYSICS.maxLateral, s.vx + o.strength * DT));
      if (o.kind === 'speed_zone') { s.speed = Math.max(s.speed, Math.min(Math.min(30, Math.max(PHYSICS.maxSpeed, targetSpeed)), s.speed + 6 * DT)); s.vy = Math.max(-15, s.vy - 3 * DT); }
    }
  }
  const to: Vec3 = [s.x + s.vx * DT, s.y + (s.vy + Math.sin(s.pitch) * s.speed * .55) * DT, s.z + s.speed * Math.cos(s.heading) * Math.cos(s.pitch) * DT];
  const newWing = wingOffset(s.heading, s.pitch, s.roll);
  const probes = [{ from, to, radius: PHYSICS.radius }, ...[-1, 1].map(sign => ({ from: from.map((n, i) => n + oldWing[i] * sign) as Vec3, to: to.map((n, i) => n + newWing[i] * sign) as Vec3, radius: .18 }))];
  const angularTravel = (Math.abs(s.heading - oldHeading) + Math.abs(s.pitch - oldPitch) + Math.abs(s.roll - oldRoll)) * .43;
  let impact = 2;
  let crashCause = 'obstacle';
  let clearCount = 0, clearScore = 0;
  for (const o of candidates) {
    if (Math.abs(o.z - s.z) > 4 || !isGate(o)) continue;
    const moving = o.kind === 'shutter' || o.kind === 'rotating_gate';
    const boxes = obstacleBoxes(o, seconds);
    const bound = moving ? (Math.PI * 2 / o.period * (o.kind === 'shutter' ? o.amplitude : Math.hypot(o.width / 2 + 3, o.height / 2 + 3))) * DT : 0;
    for (let i = 0; i < boxes.length && !shielded; i++) {
      for (const probe of probes) {
        const fraction = sweepSphereMovingBox(probe.from, probe.to, probe.radius + (probe.radius < PHYSICS.radius ? .002 : 0), moving ? t => obstacleBoxAt(o, seconds + t * DT, i) : () => boxes[i], bound + angularTravel);
        if (fraction !== null) impact = Math.min(impact, fraction);
      }
    }
    const crossing = crossingFraction(from[2], to[2], o.z);
    if (crossing !== null && crossing < impact) {
      const pose = obstaclePose(o, seconds + crossing * DT);
      const dx = from[0] + (to[0] - from[0]) * crossing - pose.x;
      const dy = from[1] + (to[1] - from[1]) * crossing - pose.y;
      const x = dx * Math.cos(pose.angle) + dy * Math.sin(pose.angle);
      const y = -dx * Math.sin(pose.angle) + dy * Math.cos(pose.angle);
      if (apertureClearance(o, x, y) < (shielded ? .01 : PHYSICS.radius)) { impact = crossing; crashCause = 'missed_gate'; }
      else { clearCount++; clearScore += apertureClearance(o, x, y) < .9 ? 120 : 80; }
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
  const hitObstacle = impact <= 1 && s.status !== 'finished';
  if (hitObstacle) {
    s.x = from[0] + (to[0] - from[0]) * impact; s.y = from[1] + (to[1] - from[1]) * impact; s.z = from[2] + (to[2] - from[2]) * impact;
    crash(s, tick, crashCause);
  } else { s.x = to[0]; s.y = to[1]; s.z = to[2]; }
  if (!hitObstacle) { s.gatesCleared += clearCount; s.cleanStreak += clearCount; s.bestStreak = Math.max(s.bestStreak, s.cleanStreak); s.styleScore += clearScore; }
  if (s.status === 'racing') for (const o of candidates) {
    if (o.kind !== 'pickup' || (s.pickupMask & (1 << o.pickupIndex!))) continue;
    const crossing = crossingFraction(from[2], s.z, o.z);
    if (crossing !== null && Math.hypot((from[0] + (s.x - from[0]) * crossing - o.x) / (o.width / 2), (from[1] + (s.y - from[1]) * crossing - o.y) / (o.height / 2)) < 1) {
      s.pickupMask |= 1 << o.pickupIndex!;
      s.styleScore += 25;
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
