import { expect, it } from 'vitest';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine.js';
import { Scene } from '@babylonjs/core/scene.js';
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder.js';
import '@babylonjs/core/Meshes/instancedMesh.js';
import { outlineVertexShader } from '@babylonjs/core/Shaders/outline.vertex.js';
import { outlineVertexShaderWGSL } from '@babylonjs/core/ShadersWGSL/outline.vertex.js';
import { inkKind, inkMesh, inkVertexShader } from '../client/game/ink';

it('extrudes both backend shaders after instance transforms, preserving the stock animation includes', () => {
  for (const [source, wgsl] of [[outlineVertexShader.shader, false], [outlineVertexShaderWGSL.shader, true]] as const) {
    const shader = inkVertexShader(source, wgsl);
    expect(shader).toContain('cross(b,c)*normalUpdated.x');
    expect(shader.indexOf('inkNormal=')).toBeGreaterThan(shader.indexOf('#include<bonesVertex>'));
    expect(shader).not.toContain('positionUpdated+(normalUpdated*');
    expect(shader).toContain('#include<bonesVertex>');
    expect(shader).toContain('#include<morphTargetsVertex>');
    expect(shader).toContain('clamp(inkDepth*0.07,0.7,4.0)');
  }
});

it('keeps source meshes hidden and shares geometry with instances; low drops only landmark ink', () => {
  const engine = new NullEngine(); const scene = new Scene(engine);
  try {
    const source = CreateBox('prototype', {}, scene); source.isVisible = false;
    inkMesh(source, 'landmark', false);
    const instance = source.createInstance('nonuniform'); instance.scaling.set(25, .25, 8);
    expect(source.isVisible).toBe(false);
    expect(instance.sourceMesh).toBe(source);
    expect(scene.meshes).toHaveLength(2);
    inkMesh(source, 'landmark', true); expect(source.renderOutline).toBe(false);
    inkMesh(source, 'gate', true); expect(source.renderOutline).toBe(true);
    inkMesh(source, 'bird', true); expect(source.renderOutline).toBe(true);
    expect(source.outlineWidth).toBeLessThan(.04);
  } finally { scene.dispose(); engine.dispose(); }
});

it('selects solid landmarks without outlining crowds, clouds, transparent shields or small trim', () => {
  for (const kind of ['cloud', 'bubble', 'water', 'sun', 'rod', 'leaf', 'star', 'banner', 'party-banner']) expect(inkKind(kind)).toBe(false);
  for (const kind of ['toy-block', 'toy-hoop', 'podium', 'gear', 'pipe']) expect(inkKind(kind)).toBe(true);
});
