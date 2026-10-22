import { expect, it } from 'vitest';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine.js';
import { Scene } from '@babylonjs/core/scene.js';
import { Mesh } from '@babylonjs/core/Meshes/mesh.js';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData.js';
import '@babylonjs/core/Meshes/Builders/boxBuilder.js';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode.js';
import { Audience } from '../client/game/audience';

it('batches a stand into one draw with distance LOD, sparse low quality, and no per-bird nodes', () => {
  const engine = new NullEngine(), scene = new Scene(engine);
  const near = new Mesh('near', scene), far = new Mesh('far', scene);
  for (const mesh of [near, far]) VertexData.CreateBox({ size: 1 }).applyToMesh(mesh);
  const crowd = new Audience(near, far), parent = new TransformNode('stand', scene);
  crowd.add(parent, 48);
  expect(parent.getChildMeshes()).toHaveLength(2);
  crowd.update(40, false);
  expect(crowd.stats.birds).toBe(104); expect(crowd.stats.draws).toBe(1);
  crowd.update(200, false);
  expect(crowd.stats.birds).toBe(52); expect(crowd.stats.draws).toBe(1);
  crowd.update(40, true);
  expect(crowd.stats.birds).toBe(52);
  parent.setEnabled(false);
  expect(crowd.stats.birds).toBe(0);
  crowd.clear();
  expect(parent.getChildMeshes()).toHaveLength(0);
  scene.dispose(); engine.dispose();
});
