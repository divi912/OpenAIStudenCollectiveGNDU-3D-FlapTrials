import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData.js';

/** Closed bevelled frame. The inner contour stays on the shared collision aperture. */
export function gateShell(points: [number, number][], width: number, depth: number): VertexData {
  const bevel = Math.min(.10, depth * .2, width * .2), half = depth / 2;
  const profile = [[0, -half + bevel], [bevel, -half], [width - bevel, -half], [width, -half + bevel], [width, half - bevel], [width - bevel, half], [bevel, half], [0, half - bevel]];
  const positions: number[] = [], indices: number[] = [], uvs: number[] = [], normals: number[] = [];
  let distance = 0;
  for (let i = 0; i <= points.length; i++) {
    const p = points[i % points.length], prev = points[(i + points.length - 1) % points.length], next = points[(i + 1) % points.length];
    const ax = p[0] - prev[0], ay = p[1] - prev[1], bx = next[0] - p[0], by = next[1] - p[1];
    const a = Math.hypot(ax, ay), b = Math.hypot(bx, by);
    const nx = ay / a + by / b, ny = -ax / a - bx / b;
    const denominator = (nx * by - ny * bx) / b;
    if (i > 0) distance += a;
    for (const [out, z] of profile) {
      positions.push(p[0] + out * nx / denominator, p[1] + out * ny / denominator, z);
      uvs.push(distance / 3, (z + half) / depth);
    }
    if (i < points.length) for (let j = 0; j < 8; j++) {
      const a = i * 8 + j, b = i * 8 + (j + 1) % 8, c = a + 8, d = b + 8;
      indices.push(a, c, b, b, c, d);
    }
  }
  VertexData.ComputeNormals(positions, indices, normals, { useRightHandedSystem: true });
  // The duplicated UV seam shares the same lighting normal.
  for (let j = 0; j < 24; j++) {
    const end = points.length * 24 + j, average = (normals[j] + normals[end]) / 2;
    normals[j] = normals[end] = average;
  }
  const data = new VertexData(); data.positions = positions; data.indices = indices; data.normals = normals; data.uvs = uvs;
  return data;
}
