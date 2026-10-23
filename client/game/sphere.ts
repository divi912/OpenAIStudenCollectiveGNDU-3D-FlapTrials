import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData.js';

/** Smooth analytic normals; separate latitude/longitude budgets avoid oversampling small foliage. */
export function sphereData(longitude = 16, latitude = 8): VertexData {
  const positions: number[] = [], normals: number[] = [], uvs: number[] = [], indices: number[] = [];
  for (let y = 0; y <= latitude; y++) for (let x = 0; x <= longitude; x++) {
    const a = x / longitude * Math.PI * 2, b = y / latitude * Math.PI;
    const nx = Math.sin(b) * Math.cos(a), ny = Math.cos(b), nz = Math.sin(b) * Math.sin(a);
    positions.push(nx * .5, ny * .5, nz * .5); normals.push(nx, ny, nz); uvs.push(x / longitude, y / latitude);
    if (x < longitude && y < latitude) {
      const i = y * (longitude + 1) + x, j = i + longitude + 1;
      if (y > 0) indices.push(i, i + 1, j);
      if (y < latitude - 1) indices.push(i + 1, j + 1, j);
    }
  }
  const data = new VertexData(); data.positions = positions; data.normals = normals; data.uvs = uvs; data.indices = indices; return data;
}
