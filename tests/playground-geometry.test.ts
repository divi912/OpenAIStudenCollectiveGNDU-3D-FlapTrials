import '@babylonjs/core/Meshes/instancedMesh.js';
import { afterEach, expect, it } from 'vitest';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine.js';
import { Scene } from '@babylonjs/core/scene.js';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode.js';
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder.js';
import { Quaternion, Vector3, Matrix } from '@babylonjs/core/Maths/math.vector.js';
import { playgroundScenery, playgroundSection, routeStripData } from '../client/game/playground';
import type { Place } from '../client/game/scenery';
import { COURSES } from '../shared/courses';
import { frameAt, trackToWorld } from '../shared/track';

const engines: NullEngine[] = [];
afterEach(() => { engines.splice(0).forEach(e => e.dispose()); });
function fixture() {
  const engine = new NullEngine(); engines.push(engine);
  const scene = new Scene(engine), root = new TransformNode('root', scene);
  const source = CreateBox('source', {}, scene); source.isVisible = false;
  const place: Place = (kind, color, parent, position = [0, 0, 0], scale = [1, 1, 1]) => {
    const mesh = source.createInstance(kind); mesh.parent = parent;
    mesh.position.set(position[0], position[1], position[2]);
    // Conservative source extents for rings and the diameter-two grandstand islands.
    const diameter = ['toy-hoop', 'hoop', 'island'].includes(kind) ? 2 : 1;
    mesh.scaling.set(scale[0] * diameter, scale[1] * (kind === 'island' ? 1 : diameter), scale[2] * diameter);
    mesh.metadata = { color }; return mesh;
  };
  return { scene, root, place };
}

it('joins deck chunks exactly and keeps the upper edge on the collision floor for all courses', () => {
  for (const c of COURSES) {
    const profile: [number, number][] = [[-c.width / 2, c.floor - .24], [c.width / 2, c.floor - .24], [c.width / 2, c.floor], [-c.width / 2, c.floor]];
    for (const end of [124, 252, 508]) {
      const left = routeStripData(c, end - 128, end, profile), right = routeStripData(c, end, end + 128, profile);
      for (const [x, y] of profile) {
        const target = trackToWorld(c, x, y, end);
        for (const data of [left, right]) {
          const positions = data.positions!;
          let distance = Infinity;
          for (let i = 0; i < positions.length; i += 3) distance = Math.min(distance, Math.hypot(...target.map((v, axis) => v - positions[i + axis])));
          expect(distance).toBeLessThan(1e-8);
        }
      }
      const positions = left.positions!, indices = left.indices!, normals = left.normals!;
      for (let i = 0; i < indices.length; i += 3) {
        const [a, b, d] = [indices[i], indices[i + 1], indices[i + 2]].map(j => Vector3.FromArray(positions, j * 3));
        expect(Vector3.Dot(Vector3.Cross(b.subtract(a), d.subtract(a)), Vector3.FromArray(normals, indices[i] * 3))).toBeLessThan(-1e-6);
      }
    }
  }
});

it('builds bounded merged route surfaces without overlapping tile boxes', () => {
  const { root, place } = fixture();
  const chunk = playgroundSection(place, root, COURSES[0], 0);
  const meshes = chunk.getChildMeshes();
  expect(meshes.filter(m => m.name.startsWith('route-')).length).toBe(4);
  expect(meshes.length).toBeLessThanOrEqual(12);
  expect(meshes.filter(m => m.name === 'toy-block').every(m => m.scaling.y < .1)).toBe(true);
});

it('keeps landmarks clear of stands after curved chunk transforms and preserves crowd cadence', () => {
  const { root, scene, place } = fixture();
  for (const course of COURSES) for (const z of [0, 128, 256, 512]) {
    const chunk = new TransformNode('chunk', scene); chunk.parent = root;
    let stands = 0;
    playgroundScenery(place, chunk, z, () => stands++, course);
    expect(stands).toBe(z % 256 === 0 ? 2 : 0);
    const f = frameAt(course, z + 48);
    for (const child of chunk.getChildren()) if (child instanceof TransformNode) child.position.z -= z + 48;
    chunk.position.set(...f.position); chunk.rotationQuaternion = Quaternion.RotationYawPitchRoll(f.yaw, -f.pitch, 0);
    for (const node of chunk.getDescendants()) if (node instanceof TransformNode) node.computeWorldMatrix(true);
    const landmarks = chunk.getChildren().filter(n => n.name === 'playground-landmark') as TransformNode[];
    const stadiums = chunk.getChildren().filter(n => n.name === 'floating-grandstand') as TransformNode[];
    for (let i = 0; i < landmarks.length; i++) {
      const side = i === 0 ? -1 : 1, distance = z + (side < 0 ? 20 : 88);
      expect(Vector3.Distance(landmarks[i].getAbsolutePosition(), Vector3.FromArray(trackToWorld(course, side * 31, 0, distance)))).toBeLessThan(.001);
      const bounds = (node: TransformNode) => {
        const inverse = Matrix.Invert(chunk.computeWorldMatrix(true));
        const points = node.getChildMeshes().flatMap(mesh => { mesh.computeWorldMatrix(true); return mesh.getBoundingInfo().boundingBox.vectorsWorld.map(v => Vector3.TransformCoordinates(v, inverse)); });
        return {min: points.reduce((a,b)=>Vector3.Minimize(a,b),new Vector3(Infinity,Infinity,Infinity)),max:points.reduce((a,b)=>Vector3.Maximize(a,b),new Vector3(-Infinity,-Infinity,-Infinity))};
      };
      const a = bounds(landmarks[i]);
      for (const stand of stadiums) {
        const b = bounds(stand);
        const overlap = ['x', 'y', 'z'].every(axis => a.min[axis as 'x'] < b.max[axis as 'x'] && a.max[axis as 'x'] > b.min[axis as 'x']);
        expect(overlap, `${course.id} z=${z} landmark ${side} intersects a stand`).toBe(false);
      }
    }
    chunk.dispose();
  }
});

it('uses a single balloon hull and mirrors directional motif geometry', () => {
  const { root, place } = fixture();
  for (const id of ['cloud_carnival', 'crosswind', 'terminal_velocity', 'storm_spiral']) {
    const course = COURSES.find(c => c.id === id)!;
    playgroundScenery(place, root, 128, () => {}, course);
    const nodes = root.getChildren().filter(n => n.name === 'playground-landmark') as TransformNode[];
    if (id === 'cloud_carnival') for (const node of nodes) expect(node.getChildMeshes().filter(m => m.name === 'toy-leaf')).toHaveLength(1);
    for (const mesh of nodes[0].getChildMeshes()) {
      const match = nodes[1].getChildMeshes().find(other => other.name === mesh.name && Math.abs(other.position.x + mesh.position.x) < 1e-5 && Math.abs(other.position.y - mesh.position.y) < 1e-5 && Math.abs(other.position.z - mesh.position.z) < 1e-5);
      expect(match, `${id}: missing reflected ${mesh.name} at ${mesh.position}`).toBeDefined();
    }
    nodes.forEach(n => n.dispose());
  }
});
