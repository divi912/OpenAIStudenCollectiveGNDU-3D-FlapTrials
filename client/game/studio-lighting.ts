import { RawCubeTexture } from '@babylonjs/core/Materials/Textures/rawCubeTexture.js';
import { Texture } from '@babylonjs/core/Materials/Textures/texture.js';
import { Constants } from '@babylonjs/core/Engines/constants.js';
import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture.js';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial.js';
import { Color3 } from '@babylonjs/core/Maths/math.color.js';
import { CreatePlane } from '@babylonjs/core/Meshes/Builders/planeBuilder.js';
import type { Scene } from '@babylonjs/core/scene.js';

/** Tiny local studio environment: soft colored fill and broad plastic reflections. */
export function studioEnvironment(scene: Scene) {
  const size = 16;
  const faces = ['#e0e7ff', '#d4eafa', '#fffaf0', '#8d8cba', '#e3eaff', '#f6efff'].map(hex => {
    const c = Color3.FromHexString(hex), bytes = new Uint8Array(size * size * 4);
    for (let i = 0; i < bytes.length; i += 4) bytes.set([c.r * 255, c.g * 255, c.b * 255, 255], i);
    return bytes;
  });
  const environment = new RawCubeTexture(scene, faces, size, Constants.TEXTUREFORMAT_RGBA,
    Constants.TEXTURETYPE_UNSIGNED_BYTE, true, false, Texture.TRILINEAR_SAMPLINGMODE);
  environment.name = 'local-studio-fill'; environment.gammaSpace = true;
  return environment;
}

/** One shared gradient quad grounds the local bird without another scene render pass. */
export function contactShadow(scene: Scene) {
  const texture = new DynamicTexture('bird-contact-shadow', 64, scene, false);
  const ctx = texture.getContext(), gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  gradient.addColorStop(0, 'rgba(55,35,105,.32)'); gradient.addColorStop(.4, 'rgba(55,35,105,.14)');
  gradient.addColorStop(1, 'rgba(55,35,105,0)');
  ctx.clearRect(0, 0, 64, 64); ctx.fillStyle = gradient; ctx.fillRect(0, 0, 64, 64);
  texture.hasAlpha = true; texture.update();
  const material = new StandardMaterial('bird-contact-shadow', scene);
  material.disableLighting = true; material.emissiveColor = Color3.White();
  material.diffuseTexture = texture; material.useAlphaFromDiffuseTexture = true;
  material.disableDepthWrite = true; material.backFaceCulling = false;
  const mesh = CreatePlane('bird-contact-shadow', { size: 1 }, scene);
  mesh.material = material; mesh.isPickable = false; mesh.setEnabled(false);
  return mesh;
}
