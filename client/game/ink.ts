import { Color3 } from '@babylonjs/core/Maths/math.color.js';
import type { Mesh } from '@babylonjs/core/Meshes/mesh.js';
import { ShaderStore } from '@babylonjs/core/Engines/shaderStore.js';
import '@babylonjs/core/Rendering/outlineRenderer.js';
import { outlineVertexShader } from '@babylonjs/core/Shaders/outline.vertex.js';
import { outlineVertexShaderWGSL } from '@babylonjs/core/ShadersWGSL/outline.vertex.js';

export type InkRole = 'bird' | 'gate' | 'landmark';
const INK = Color3.FromHexString('#211e35');

/** Keep Babylon's depth-tested, hardware-instanced outline passes, but extrude in
 * world space. Object-space extrusion stretches ink across the long, thin deck
 * pieces. The cofactor normal handles nonuniform and mirrored instance matrices.
 * Both backends use the same math; no duplicate meshes or full-screen buffers. */
export function inkVertexShader(shader: string, wgsl: boolean): string {
  if (wgsl) return shader
    .replace('positionUpdated+(normalUpdated*uniforms.offset)', 'positionUpdated')
    .replace('vertexOutputs.position=uniforms.viewProjection*worldPos;', `
var a=finalWorld[0].xyz;var b=finalWorld[1].xyz;var c=finalWorld[2].xyz;
var inkNormal=normalize((cross(b,c)*normalUpdated.x+cross(c,a)*normalUpdated.y+cross(a,b)*normalUpdated.z)*sign(dot(a,cross(b,c))));
var inkDepth=abs((uniforms.viewProjection*worldPos).w);
worldPos=vec4f(worldPos.xyz+inkNormal*uniforms.offset*clamp(inkDepth*0.07,0.7,4.0),worldPos.w);
vertexOutputs.position=uniforms.viewProjection*worldPos;`);
  return shader
    .replace('positionUpdated+(normalUpdated*offset)', 'positionUpdated')
    .replace('gl_Position=viewProjection*worldPos;', `
vec3 a=finalWorld[0].xyz;vec3 b=finalWorld[1].xyz;vec3 c=finalWorld[2].xyz;
vec3 inkNormal=normalize((cross(b,c)*normalUpdated.x+cross(c,a)*normalUpdated.y+cross(a,b)*normalUpdated.z)*sign(dot(a,cross(b,c))));
float inkDepth=abs((viewProjection*worldPos).w);
worldPos.xyz+=inkNormal*offset*clamp(inkDepth*0.07,0.7,4.0);
gl_Position=viewProjection*worldPos;`);
}

// Register before the first effect compiles. Eager imports also prevent the
// renderer's lazy stock shader import from replacing this application variant.
ShaderStore.ShadersStore.outlineVertexShader = inkVertexShader(outlineVertexShader.shader, false);
ShaderStore.ShadersStoreWGSL.outlineVertexShader = inkVertexShader(outlineVertexShaderWGSL.shader, true);

export function inkMesh(mesh: Mesh, role: InkRole, low: boolean): void {
  mesh.metadata = { ...mesh.metadata, inkRole: role };
  mesh.outlineColor = INK;
  mesh.outlineWidth = role === 'bird' ? .028 : role === 'gate' ? .038 : .032;
  mesh.renderOutline = role !== 'landmark' || !low;
}

/** Exclude crowds, trim, sky, particles, water and shield transparency. Sharing
 * the selected prototypes preserves one instanced ink batch per shape/color. */
export function inkKind(kind: string): boolean {
  return ['toy-block', 'toy-hoop', 'toy-leaf', 'podium', 'island', 'cone', 'peak', 'rock', 'pipe', 'gear', 'panel'].includes(kind);
}
