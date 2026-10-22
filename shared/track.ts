import type { CourseDefinition, Vec3 } from './protocol';

export interface TrackFrame { position: Vec3; right: Vec3; up: Vec3; forward: Vec3; yaw: number; pitch: number }
const paths = new WeakMap<CourseDefinition, Vec3[]>();
const STEP = 4;
function angles(course: CourseDefinition, distance: number) {
  const path = course.path ?? { turn: .5, wavelength: 145, lift: .14 };
  return { yaw: path.turn * Math.sin(distance / path.wavelength), pitch: path.lift * Math.sin(distance / (path.wavelength * .7)) };
}
function basis(course: CourseDefinition, distance: number) {
  const { yaw, pitch } = angles(course, distance), sy = Math.sin(yaw), cy = Math.cos(yaw), sp = Math.sin(pitch), cp = Math.cos(pitch);
  return { yaw, pitch, forward: [sy * cp, sp, cy * cp] as Vec3, right: [cy, 0, -sy] as Vec3, up: [-sy * sp, cp, -cy * sp] as Vec3 };
}
export function frameAt(course: CourseDefinition, distance: number): TrackFrame {
  let points = paths.get(course);
  if (!points) {
    points = [[0, 0, 0]];
    for (let s = 0; s < course.length + 640; s += STEP) {
      const f = basis(course, s + STEP / 2).forward, previous = points[points.length - 1];
      points.push([previous[0] + f[0] * STEP, previous[1] + f[1] * STEP, previous[2] + f[2] * STEP]);
    }
    paths.set(course, points);
  }
  const i = Math.max(0, Math.min(points.length - 2, Math.floor(distance / STEP))), t = (distance - i * STEP) / STEP;
  const a = points[i], b = points[i + 1];
  return { ...basis(course, distance), position: [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t] };
}
export function trackToWorld(course: CourseDefinition, x: number, y: number, distance: number): Vec3 {
  const f = frameAt(course, distance);
  return [f.position[0] + f.right[0] * x + f.up[0] * y, f.position[1] + f.right[1] * x + f.up[1] * y, f.position[2] + f.right[2] * x + f.up[2] * y];
}
export function wrapAngle(angle: number): number { return Math.atan2(Math.sin(angle), Math.cos(angle)); }
export function bodyRoll(heading: number, roll: number): number { return roll - heading * .55; }
/** Local wing clearance probes; identical for every cosmetic bird. */
export function wingOffset(heading: number, pitch: number, roll: number): Vec3 {
  const c = Math.cos(bodyRoll(heading, roll)), s = Math.sin(bodyRoll(heading, roll)), sy = Math.sin(heading), cy = Math.cos(heading);
  return [(cy * c - sy * Math.sin(pitch) * s) * .43, Math.cos(pitch) * s * .43, (-sy * c - cy * Math.sin(pitch) * s) * .43];
}
