import { obstaclePose } from '../shared/courses';
import type { CourseDefinition, InputFrame, RacerState } from '../shared/protocol';

/** Test/load generator only. Sends the same legal controls as a human; never teleports. */
export function pilot(p: RacerState, course: CourseDefinition, tick: number, raceStartTick = 0): InputFrame {
  const next = course.obstacles.find(o => o.z > p.z + .7 && !['gust', 'speed_zone'].includes(o.kind));
  let tx = 0, ty = 6;
  if (next) {
    const arrival = (tick - raceStartTick) / 60 + Math.max(0, next.z - p.z) / p.speed;
    const pose = obstaclePose(next, arrival); tx = pose.x; ty = pose.y;
  }
  const error = (tx - p.x) * 3.2 - p.vx * 1.65;
  const desiredVy = Math.max(-5, Math.min(5, (ty - p.y) * 2.7));
  const flap = p.vy < desiredVy - 2.4 && tick >= p.nextFlapTick;
  return { sequence: tick, tick, steer: Math.abs(error) < .18 ? 0 : error > 0 ? 1 : -1, flapPressed: flap, diveHeld: false };
}
