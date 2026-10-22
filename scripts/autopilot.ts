import { isGate, obstaclePose } from '../shared/courses';
import type { CourseDefinition, InputFrame, RacerState } from '../shared/protocol';
import { wrapAngle } from '../shared/track';

/** Test/load generator only. Sends the same legal controls as a human; never teleports. */
export function pilot(p: RacerState, course: CourseDefinition, tick: number, raceStartTick = 0): InputFrame {
  const next = course.obstacles.find(o => o.z > p.z - 1.1 && isGate(o));
  let tx = 0, ty = 6;
  if (next) {
    const arrival = (tick - raceStartTick) / 60 + Math.max(0, next.z - p.z) / p.speed;
    const pose = obstaclePose(next, arrival); tx = pose.x; ty = pose.y;
  }
  const rollingSoon = next?.kind === 'twist_gate' && next.z - p.z < 11;
  if (next?.kind === 'twist_gate') {
    const angle = obstaclePose(next, (tick - raceStartTick) / 60).angle;
    if (Math.abs(Math.cos(angle)) > .6 && next.z - p.z < 18) tx -= (p.y - next.y) * Math.tan(angle);
    if (!rollingSoon && next.z - p.z < 26) ty += 1;
  }
  const desiredHeading = Math.max(-.48, Math.min(.48, Math.atan2((tx - p.x) * 4.2 - p.vx * 1.7, p.speed)));
  const error = desiredHeading - p.heading;
  let targetRoll = 0;
  if (rollingSoon && next) {
    targetRoll = wrapAngle(obstaclePose(next, (tick - raceStartTick) / 60).angle + Math.PI / 2);
    targetRoll += Math.round((p.roll - targetRoll) / Math.PI) * Math.PI;
    targetRoll += p.heading * .55;
  }
  const rollError = wrapAngle(targetRoll - p.roll);
  const desiredPitch = rollingSoon ? .35 : Math.max(-.22, Math.min(.32, (ty - p.y) * .1));
  const desiredVy = Math.max(-5, Math.min(5, (ty - p.y) * 2.7)) - Math.sin(p.pitch) * p.speed * .55;
  const impulse = 5.5 * (.45 + .55 * Math.cos(p.roll)) * Math.cos(p.pitch);
  const flap = impulse > 1 && p.vy < desiredVy - impulse / 2 && tick >= p.nextFlapTick;
  return { sequence: tick, tick, steer: Math.abs(error) < .025 ? 0 : error > 0 ? 1 : -1, flapPressed: flap, diveHeld: false,
    pitch: Math.abs(desiredPitch - p.pitch) < .025 ? 0 : desiredPitch > p.pitch ? 1 : -1,
    roll: Math.abs(rollError) < .045 ? 0 : rollError > 0 ? 1 : -1 };
}
