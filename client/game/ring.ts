import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData.js';

/** Smooth circular silhouette with a small radial section, instead of a square tessellation budget. */
export function ringData(): VertexData {
  const positions: number[] = [], normals: number[] = [], uvs: number[] = [], indices: number[] = [];
  const around = 48, radial = 8, radius = .955, tube = .045;
  for (let i = 0; i <= around; i++) for (let j = 0; j <= radial; j++) {
    const a = i / around * Math.PI * 2, b = j / radial * Math.PI * 2;
    const r = radius + Math.cos(b) * tube;
    positions.push(Math.cos(a) * r, Math.sin(a) * r, Math.sin(b) * tube);
    normals.push(Math.cos(a) * Math.cos(b), Math.sin(a) * Math.cos(b), Math.sin(b));
    uvs.push(i / around, j / radial);
    if (i < around && j < radial) {
      const k = i * (radial + 1) + j, next = k + radial + 1;
      indices.push(k, k + 1, next, k + 1, next + 1, next);
    }
  }
  const data = new VertexData(); data.positions = positions; data.normals = normals; data.uvs = uvs; data.indices = indices; return data;
}
