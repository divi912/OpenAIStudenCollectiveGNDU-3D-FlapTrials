import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture.js';
import { Texture } from '@babylonjs/core/Materials/Textures/texture.js';
import type { Scene } from '@babylonjs/core/scene.js';

export type Finish = 'enamel' | 'stone' | 'foliage';
/** Small shared surface maps add variation without per-object image downloads. */
export function surfaceMap(scene: Scene, finish: Finish): { diffuse: DynamicTexture; normal: DynamicTexture } {
  const size = 256, diffuse = new DynamicTexture(`${finish}-surface`, { width: size, height: size }, scene, true);
  const ctx = diffuse.getContext() as CanvasRenderingContext2D;
  ctx.fillStyle = '#f5f3ec'; ctx.fillRect(0, 0, size, size);
  let seed = 72391;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) | 0; return (seed >>> 0) / 4294967296; };
  for (let i = 0; i < 1500; i++) {
    const gray = 210 + Math.floor(random() * 45); ctx.fillStyle = `rgba(${gray},${gray},${gray},${finish === 'enamel' ? .2 : .45})`;
    ctx.beginPath(); ctx.ellipse(random() * size, random() * size, .4 + random() * (finish === 'stone' ? 4 : 1.2), .5 + random() * 2, 0, 0, Math.PI * 2); ctx.fill();
  }
  if (finish === 'enamel') {
    ctx.strokeStyle = '#c7cfcb'; ctx.lineWidth = 1;
    for (const y of [14, 242]) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(size, y); ctx.stroke(); }
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 17, size, 2);
    for (const x of [20, 128, 236]) { ctx.fillStyle = '#bbc5bf'; ctx.beginPath(); ctx.arc(x, 9, 2.1, 0, Math.PI * 2); ctx.fill(); }
  } else if (finish === 'foliage') {
    ctx.strokeStyle = '#b2c5ab'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(128, 0); ctx.lineTo(128, 256); ctx.stroke();
    ctx.lineWidth = 1;
    for (let y = 20; y < 256; y += 25) for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(128, y); ctx.quadraticCurveTo(128 + s * 55, y - 15, 128 + s * 110, y - 45); ctx.stroke(); }
  }
  diffuse.wrapU = diffuse.wrapV = Texture.WRAP_ADDRESSMODE; diffuse.anisotropicFilteringLevel = 4; diffuse.update();
  const pixels = ctx.getImageData(0, 0, size, size).data;
  const normal = new DynamicTexture(`${finish}-normal`, { width: size, height: size }, scene, true);
  const normalContext = normal.getContext() as CanvasRenderingContext2D, image = normalContext.createImageData(size, size);
  const h = (x: number, y: number) => pixels[(((y + size) % size) * size + (x + size) % size) * 4] / 255;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const i = (y * size + x) * 4, nx = (h(x - 1, y) - h(x + 1, y)) * 1.5, ny = (h(x, y - 1) - h(x, y + 1)) * 1.5, length = Math.hypot(nx, ny, 1);
    image.data.set([Math.round((nx / length * .5 + .5) * 255), Math.round((ny / length * .5 + .5) * 255), Math.round((1 / length * .5 + .5) * 255), 255], i);
  }
  normalContext.putImageData(image, 0, 0); normal.wrapU = normal.wrapV = Texture.WRAP_ADDRESSMODE; normal.level = .35; normal.update();
  return { diffuse, normal };
}
