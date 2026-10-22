import type { Box, Vec3 } from './protocol';

export function crossingFraction(from: number, to: number, plane: number): number | null {
  return from < plane && to >= plane ? (plane - from) / (to - from) : null;
}

export function pointBoxDistance(p: Vec3, box: Box): number {
  const dx = p[0] - box.center[0], dy = p[1] - box.center[1];
  const c = Math.cos(box.angle ?? 0), s = Math.sin(box.angle ?? 0);
  const x = Math.abs(dx * c + dy * s) - box.half[0];
  const y = Math.abs(-dx * s + dy * c) - box.half[1];
  const z = Math.abs(p[2] - box.center[2]) - box.half[2];
  return Math.hypot(Math.max(x, 0), Math.max(y, 0), Math.max(z, 0)) + Math.min(Math.max(x, y, z), 0);
}

/** Conservative advancement against the exact rounded Minkowski boundary, not an inflated AABB. */
export function sweepSphereBox(from: Vec3, to: Vec3, radius: number, box: Box): number | null {
  return sweepSphereMovingBox(from, to, radius, () => box, 0);
}
export function sweepSphereMovingBox(from: Vec3, to: Vec3, radius: number, at: (t: number) => Box, obstacleTravelBound: number): number | null {
  const dx = to[0] - from[0], dy = to[1] - from[1], dz = to[2] - from[2];
  const bound = Math.hypot(dx, dy, dz) + obstacleTravelBound;
  let t = 0;
  const p: Vec3 = [...from];
  for (let i = 0; i < 96; i++) {
    p[0] = from[0] + dx * t; p[1] = from[1] + dy * t; p[2] = from[2] + dz * t;
    const distance = pointBoxDistance(p, at(t)) - radius;
    if (distance <= 1e-7) return t;
    if (bound < 1e-12) return null;
    t += Math.max(distance / bound * 0.95, 1e-8);
    if (t > 1) return null;
  }
  // An unresolved near-tangent contact is conservatively counted only inside numerical tolerance.
  return pointBoxDistance(p, at(t)) - radius < 1e-5 ? t : null;
}

