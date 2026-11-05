import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData.js';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode.js';
import { Quaternion } from '@babylonjs/core/Maths/math.vector.js';
import type { CourseDefinition } from '../../shared/protocol';
import { frameAt, trackToWorld } from '../../shared/track';
import { grandstand, type Place } from './scenery';

export interface PlaygroundLook {
  pink: string; blue: string; purple: string; yellow: string; white: string;
  sky: string; horizon: string; skyTop: string;
}
export const PLAYGROUND: PlaygroundLook = {
  pink: '#ff51a7', blue: '#27cce3', purple: '#7451d5', yellow: '#ffe05b', white: '#fff9ff',
  sky: '#b9ecf8', horizon: '#e2dfff', skyTop: '#58c5ed',
};
const LOOKS: Record<string, PlaygroundLook> = {
  skyline_sprint: PLAYGROUND,
  cloud_carnival: { pink: '#ff7b9f', blue: '#80e6e0', purple: '#9b69da', yellow: '#ffe989', white: '#fffbed', sky: '#c4efff', horizon: '#ffe4e8', skyTop: '#8bcff1' },
  crosswind: { pink: '#ff9051', blue: '#44dce7', purple: '#387bc9', yellow: '#ffe663', white: '#f4ffff', sky: '#aeecf5', horizon: '#e8fff2', skyTop: '#52b3e4' },
  the_needle: { pink: '#f65091', blue: '#62d8b2', purple: '#744bb5', yellow: '#ffcf72', white: '#fff4e5', sky: '#edccf1', horizon: '#ffe6c9', skyTop: '#b18ce2' },
  clockwork: { pink: '#ff8056', blue: '#52c9c9', purple: '#574c9b', yellow: '#ffcf43', white: '#fff6da', sky: '#bbe6dc', horizon: '#ffedbd', skyTop: '#73b8c1' },
  terminal_velocity: { pink: '#ff566b', blue: '#42d8ed', purple: '#6358d6', yellow: '#ffbe4d', white: '#fff2f8', sky: '#ffc7cb', horizon: '#ffe6bb', skyTop: '#9b8cde' },
  featherless: { pink: '#ef4fa5', blue: '#4fe5cd', purple: '#48448e', yellow: '#d5fa67', white: '#eaf9ff', sky: '#9cb7dc', horizon: '#e1c9ed', skyTop: '#586da6' },
  storm_spiral: { pink: '#b36aff', blue: '#4bd9f6', purple: '#3c397c', yellow: '#fff06c', white: '#e3f6ff', sky: '#8f98d0', horizon: '#c0c5e8', skyTop: '#495890' },
  crown_circuit: { pink: '#fa5b99', blue: '#74d9ef', purple: '#6944bc', yellow: '#ffd35c', white: '#fff9e9', sky: '#c9b6f0', horizon: '#ffe5b2', skyTop: '#8e7bdb' },
};
export function playgroundLook(course?: Pick<CourseDefinition, 'id'>): PlaygroundLook {
  return (course && LOOKS[course.id]) || PLAYGROUND;
}

/** Sweep a closed profile through exact shared track-frame endpoints. */
export function routeStripData(course: CourseDefinition, start: number, end: number, profile: [number, number][]): VertexData {
  const positions: number[] = [], indices: number[] = [], normals: number[] = [];
  const steps = Math.ceil((end - start) / 4), n = profile.length;
  for (let i = 0; i <= steps; i++) for (const [x,y] of profile) positions.push(...trackToWorld(course,x,y,start+(end-start)*i/steps));
  for (let i = 0; i < steps; i++) for (let j = 0; j < n; j++) {
    const a=i*n+j,b=i*n+(j+1)%n,c=a+n,d=b+n; indices.push(a,c,b,b,c,d);
  }
  VertexData.ComputeNormals(positions,indices,normals);
  const data=new VertexData();data.positions=positions;data.indices=indices;data.normals=normals;return data;
}
export function playgroundSection(place: Place, root: TransformNode, course: CourseDefinition, z: number) {
  const look = playgroundLook(course), chunk=new TransformNode(`playground-${z}`,root.getScene());chunk.parent=root;
  const start=z===0?-4:z-4,end=Math.min(z+124,course.length+24),half=course.width/2;
  const strip=(name:string,color:string,x0:number,x1:number,y0:number,y1:number)=>{
    const instance=place('toy-block',color,chunk);
    const mesh=instance.sourceMesh.clone(name,null,true)!;mesh.makeGeometryUnique();mesh.parent=chunk;mesh.isVisible=true;mesh.setEnabled(true);
    instance.dispose();routeStripData(course,start,end,[[x0,y0],[x1,y0],[x1,y1],[x0,y1]]).applyToMesh(mesh);
    mesh.metadata={...mesh.metadata,routeRibbon:true};mesh.renderOutline=false;mesh.freezeWorldMatrix();
  };
  strip('route-base',look.purple,-half-1.3,half+1.3,course.floor-1,course.floor-.24);
  strip('route-deck',look.blue,-half,half,course.floor-.24,course.floor);
  for(const side of [-1,1]) strip(`route-edge-${side}`,look.pink,side<0?-half-1.3:half,side<0?-half:half+1.3,course.floor-.24,course.floor+.35);
  for(let at=z;at<end;at+=32){const tile=new TransformNode('route-marking',root.getScene());tile.parent=chunk;tile.position.set(...trackToWorld(course,0,course.floor+.025,at));const f=frameAt(course,at);tile.rotationQuaternion=Quaternion.RotationYawPitchRoll(f.yaw,-f.pitch,0);
    for(const side of [-1,1]){const arrow=place('toy-block',look.white,tile,[side*.65,0,0],[.3,.025,1.9]);arrow.rotation.y=-side*.65;}
  }
  for(const node of chunk.getDescendants())if(node instanceof TransformNode)node.freezeWorldMatrix();
  return chunk;
}

/** Express a true track frame in sceneryChunk's pre-anchor coordinates. */
function landmark(parent: TransformNode, z: number, distance: number, x: number, course?: CourseDefinition) {
  const node = new TransformNode('playground-landmark', parent.getScene()); node.parent = parent;
  if (!course) { node.position.set(x, 0, distance); return node; }
  const anchor = z + 48, a = frameAt(course, anchor), f = frameAt(course, distance);
  const position = trackToWorld(course, x, 0, distance), delta = position.map((v, i) => v - a.position[i]);
  const dot = (axis: number[]) => delta.reduce((sum, value, i) => sum + value * axis[i], 0);
  node.position.set(dot(a.right), dot(a.up), anchor + dot(a.forward));
  node.rotationQuaternion = Quaternion.Inverse(Quaternion.RotationYawPitchRoll(a.yaw, -a.pitch, 0))
    .multiply(Quaternion.RotationYawPitchRoll(f.yaw, -f.pitch, 0));
  return node;
}
function base(place: Place, parent: TransformNode, look: PlaygroundLook, width = 13) {
  place('podium', look.purple, parent, [0, -5.8, 0], [width, 1.3, width]);
  place('podium', look.white, parent, [0, -5, 0], [width + .4, .3, width + .4]);
  place('podium', look.pink, parent, [0, -4.75, 0], [width - .7, .3, width - .7]);
}
function hoop(place: Place, parent: TransformNode, color: string, y: number, radius: number, flat = false) {
  const ring = place('toy-hoop', color, parent, [0, y, 0], [radius, radius, 2.5]);
  if (flat) ring.rotation.x = Math.PI / 2;
  return ring;
}
function motif(place: Place, parent: TransformNode, id: string, look: PlaygroundLook, side: number, variant: number) {
  switch (id) {
    case 'cloud_carnival': {
      // Open pavilion and tethered balloon: a soft, airy silhouette.
      base(place, parent, look, 15);
      for (const x of [-4, 4]) for (const depth of [-3, 3]) place('rod', look.white, parent, [x, -.5, depth], [.45, 8, .45]);
      place('cone', look.pink, parent, [0, 5, 0], [12, 4, 12]);
      place('podium', look.yellow, parent, [0, 3.1, 0], [13, .4, 13]);
      place('rod', look.white, parent, [0, 9, 0], [.14, 6, .14]);
      place('toy-leaf', look.pink, parent, [0, 14, 0], [5, 6, 5]);

      place('podium', look.yellow, parent, [0, 10.3, 0], [1.8, 1.1, 1.8]);
      break;
    }
    case 'crosswind': {
      // Broad pinwheel blades read clearly from a distance.
      base(place, parent, look); place('rod', look.white, parent, [0, 2, 0], [.7, 13, .7]);
      hoop(place, parent, look.blue, 10, 6);
      place('toy-leaf', look.yellow, parent, [0, 10, -.4], [1.8, 1.8, 1.8]);
      for (let i = 0; i < 4; i++) {
        const a = i * Math.PI / 2 + side * .4;
        const blade = place('toy-block', i % 2 ? look.white : look.pink, parent, [Math.sin(a) * 3, 10 + Math.cos(a) * 3, 0], [1.6, 4.5, .7]); blade.rotation.z = -a + .25;
      }
      break;
    }
    case 'the_needle': {
      // Giant spools and thread loops create a layered craft fair.
      base(place, parent, look, 14); place('rod', look.blue, parent, [0, -.1, 0], [7, 8.2, 7]);
      for (const y of [-4.3, 4.2]) place('podium', look.yellow, parent, [0, y, 0], [10.5, .8, 10.5]);
      for (let i = 0; i < 5; i++) hoop(place, parent, i % 2 ? look.white : look.pink, -3 + i * 1.5, 3.65, true);
      place('rod', look.white, parent, [side * 4.8, 3, 1], [.5, 15, .5]);
      const eye = place('toy-hoop', look.yellow, parent, [side * 4.8, 11, 1], [1.2, 2.4, 1.6]); eye.rotation.z = side * .12;
      break;
    }
    case 'clockwork': {
      base(place, parent, look, 15); place('toy-block', look.purple, parent, [0, 1, 0], [7, 11, 4]);
      hoop(place, parent, look.yellow, 9, 6);
      for (let i = 0; i < 10; i++) {
        const a = i * Math.PI / 5;
        const tooth = place('toy-block', look.yellow, parent, [Math.sin(a) * 6.1, 9 + Math.cos(a) * 6.1, 0], [1.6, 2, 1.3]); tooth.rotation.z = -a;
      }
      place('toy-leaf', look.pink, parent, [0, 9, -.5], [2, 2, 2]);
      const hand = place('toy-block', look.white, parent, [1, 10.3, -.8], [.5, 4, .4]); hand.rotation.z = -.65;
      break;
    }
    case 'terminal_velocity': {
      // Staggered launch decks make the vertical course an aerial fairground.
      for (let tier = 0; tier < 3; tier++) {
        const x = side * (tier - 1) * 3.5, y = -4 + tier * 5;
        place('rod', look.purple, parent, [x, y - 3, 0], [1.6, 6, 1.6]);
        place('podium', tier % 2 ? look.yellow : look.pink, parent, [x, y, 0], [7, .9, 9]);
        place('podium', look.white, parent, [x, y + .55, 0], [6.4, .2, 8.4]);
      }
      for (const wing of [-1, 1]) { const beam = place('toy-block', look.yellow, parent, [wing * 1.6, 16, 0], [4.5, 1.3, 1.3]); beam.rotation.z = wing * .55; }
      break;
    }
    case 'featherless': {
      // Swept wing fins and dark braces sharpen the hard arena's silhouette.
      base(place, parent, look, 16); place('toy-block', look.purple, parent, [0, 3, 0], [4, 16, 4]);
      for (let i = 0; i < 4; i++) {
        const fin = place('toy-block', i % 2 ? look.blue : look.yellow, parent, [side * (i - 1.5) * 1.6, 6 + i * 2, 0], [2, 11 - i, 2.2]); fin.rotation.z = -side * .3;
      }
      hoop(place, parent, look.pink, -2, 5, true); break;
    }
    case 'storm_spiral': {
      // Solid coils give the storm machine depth without translucent particle layers.
      base(place, parent, look, 16); place('rod', look.purple, parent, [0, 5, 0], [3, 20, 3]);
      for (let i = 0; i < 4; i++) { const ring = hoop(place, parent, i % 2 ? look.blue : look.pink, -1 + i * 4.4, 6 - i * .65, true); ring.rotation.z = side * .25; ring.rotation.y = i * .5; }
      place('toy-leaf', look.yellow, parent, [0, 17, 0], [3.6, 3.6, 3.6]);
      for (let i = 0; i < 3; i++) { const bolt = place('toy-block', look.yellow, parent, [side * (6.5 + (i % 2 ? .7 : 0)), 4 + i * 3, 1], [.85, 4, .85]); bolt.rotation.z = i % 2 ? -.5 : .5; }
      break;
    }
    case 'crown_circuit': {
      base(place, parent, look, 17); place('podium', look.purple, parent, [0, -1, 0], [10, 7, 10]);
      place('podium', look.yellow, parent, [0, 3, 0], [13, 1.2, 13]);
      place('podium', look.pink, parent, [0, 4, 0], [11, .6, 11]);
      for (let i = 0; i < 5; i++) {
        const a = i * Math.PI * 2 / 5, x = Math.sin(a) * 4.8, depth = Math.cos(a) * 4.8;
        place('cone', look.yellow, parent, [x, 7, depth], [2.8, 6, 2.8]);
        place('toy-leaf', look.white, parent, [x, 10.3, depth], [1.1, 1.1, 1.1]);
      }
      place('toy-leaf', look.yellow, parent, [0, 13, 0], [3.5, 4.5, 3.5]); break;
    }
    default: {
      base(place, parent, look); place('rod', look.white, parent, [0, 1, 0], [.5, 11, .5]);
      hoop(place, parent, look.yellow, 7.5, 3.8); hoop(place, parent, look.pink, 7.5, 5.3).rotation.y = side * -.2;
      if (variant % 2 === 0) place('toy-leaf', look.blue, parent, [0, 13.5, 0], [2.2, 2.8, 2.2]);
    }
  }
}

/** Shared mesh instances keep the solid landmarks cheap; audience batching stays unchanged. */
export function playgroundScenery(place: Place, parent: TransformNode, z: number, audience: (stand: TransformNode) => void, course?: CourseDefinition) {
  const look = playgroundLook(course), id = course?.id ?? 'skyline_sprint';
  const colors: Record<string, string> = {
    '#647d82': look.purple, '#c5d4c9': look.white, '#7ab6bb': look.blue, '#e2bd8c': look.pink,
    '#9cb9cf': look.purple, '#d7a6ad': look.pink, '#aebf9c': look.yellow, '#e8dfc8': look.white,
    '#677d77': look.purple, '#536d66': look.purple, '#d6b371': look.white, '#516b68': look.purple,
  };
  const toyPlace: Place = (kind, color, p, position, scale) => place(kind === 'banner' ? 'party-banner' : kind === 'panel' ? 'toy-block' : kind, colors[color] ?? color, p, position, scale);
  for (const side of [-1, 1]) {
    if ((z / 128) % 2 === 0) {
      const stand = grandstand(toyPlace, parent, side, z + 48, { grass: look.blue, rim: look.white, stone: look.purple, dark: look.purple, leaf: look.pink, accent: look.yellow });
      stand.position.x = side * 54; audience(stand);
    }
    // Stagger the two sides. Motif extents stay at least twenty units from the track center.
    const node = landmark(parent, z, z + (side < 0 ? 20 : 88), side * 31, course);
    motif(place, node, id, look, side, z / 128);
  }
}
