import type { AbstractEngine } from '@babylonjs/core/Engines/abstractEngine.js';
import type { Scene } from '@babylonjs/core/scene.js';

// WebGPU submits command buffers in endFrame; beginFrame also samples real frame time.
export function presentFrame(engine: Pick<AbstractEngine, 'beginFrame' | 'endFrame'>, scene: Pick<Scene, 'render'>): void {
  engine.beginFrame();
  try { scene.render(); } finally { engine.endFrame(); }
}
