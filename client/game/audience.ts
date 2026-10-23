import { Matrix, Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector.js';
import { Color3 } from '@babylonjs/core/Maths/math.color.js';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial.js';
import type { TransformNode } from '@babylonjs/core/Meshes/transformNode.js';
import type { Mesh } from '@babylonjs/core/Meshes/mesh.js';
import '@babylonjs/core/Meshes/thinInstanceMesh.js';

interface Batch { near: Mesh; far: Mesh; z: number; detailed: boolean }
const palette = ['#fff0bd', '#e8aab2', '#a0cbd7', '#c6b6e5', '#b8d59d', '#f4c186'];
const noise = (n: number) => { const v = Math.sin(n * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };

/** One solid, vertex-coloured bird mesh and one static GPU instance buffer per stand/LOD.
 * No spectator skeletons, materials, textures, picking, shadows or JS transforms per bird.
 */
export class Audience {
  private batches: Batch[] = [];
  private material: StandardMaterial;
  constructor(private near: Mesh, private far: Mesh) {
    this.material = new StandardMaterial('audience-plumage', near.getScene());
    this.material.diffuseColor = Color3.White(); this.material.specularColor = Color3.Black();
    this.material.emissiveColor.set(.12, .12, .12);
    this.material.freeze();
  }
  add(parent: TransformNode, z: number) {
    const matrices = new Float32Array(104 * 16), colors = new Float32Array(104 * 4);
    // Interleave seats spatially: a half-count prefix still fills all four tiers.
    for (let i = 0; i < 104; i++) {
      const seat = (i * 37) % 104, row = Math.floor(seat / 26), col = seat % 26;
      const seed = seat + z * 17, size = .85 + noise(seed) * .22;
      const x = (col - 12.5) * 2.83 + (noise(seed + 1) - .5) * .5;
      const y = row * 1.25 + 1.02, depth = -row * 2.1 + .14;
      Matrix.Compose(new Vector3(size, size, size), Quaternion.RotationYawPitchRoll((noise(seed + 2) - .5) * .65, 0, (noise(seed + 3) - .5) * .16), new Vector3(x, y, depth)).copyToArray(matrices, i * 16);
      const color = Color3.FromHexString(palette[Math.floor(noise(seed + 4) * palette.length)]).toLinearSpace();
      colors.set([color.r, color.g, color.b, 1], i * 4);
    }
    const make = (source: Mesh, label: string) => {
      const mesh = source.clone(`audience-${label}`, parent, true)!;
      // Thin-instance attributes live on the geometry: isolate buffers between stands.
      mesh.makeGeometryUnique(); mesh.material = this.material; mesh.isVisible = true;
      mesh.position.setAll(0); mesh.rotationQuaternion = null; mesh.rotation.setAll(0); mesh.scaling.setAll(1);
      mesh.isPickable = false; mesh.receiveShadows = false;
      mesh.thinInstanceSetBuffer('matrix', matrices, 16, true);
      mesh.thinInstanceSetBuffer('color', colors, 4, true);
      mesh.thinInstanceRefreshBoundingInfo(); mesh.setEnabled(false);
      return mesh;
    };
    this.batches.push({ near: make(this.near, 'near'), far: make(this.far, 'far'), z, detailed: false });
  }
  update(progress: number, low: boolean, sparse = false) {
    for (const b of this.batches) {
      const distance = Math.abs(progress - b.z);
      // Hysteresis avoids flicker at the LOD boundary. Distant stands fade into course fog.
      b.detailed = !low && distance < (b.detailed ? 110 : 90);
      const visible = distance < (low ? 205 : 310);
      const count = b.detailed && !sparse ? 104 : 52;
      b.near.thinInstanceCount = count; b.far.thinInstanceCount = count;
      b.near.setEnabled(visible && b.detailed); b.far.setEnabled(visible && !b.detailed);
    }
  }
  clear() { for (const b of this.batches) { b.near.dispose(); b.far.dispose(); } this.batches = []; }
  get stats() {
    let birds = 0, draws = 0, triangles = 0;
    for (const b of this.batches) for (const mesh of [b.near, b.far]) if (mesh.isEnabled()) {
      birds += mesh.thinInstanceCount; draws++; triangles += mesh.getTotalIndices() / 3 * mesh.thinInstanceCount;
    }
    return { birds, draws, triangles };
  }
}
