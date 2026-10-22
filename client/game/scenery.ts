import { TransformNode } from '@babylonjs/core/Meshes/transformNode.js';
import type { InstancedMesh } from '@babylonjs/core/Meshes/instancedMesh.js';
import type { CourseDefinition } from '../../shared/protocol';

export type Place = (kind: string, color: string, parent: TransformNode, position?: number[], scale?: number[]) => InstancedMesh;
export const THEMES = [
  { grass: '#71ae70', rim: '#b3d488', stone: '#9a998a', dark: '#646d72', leaf: '#588a63', accent: '#ffcd71' },
  { grass: '#d5b980', rim: '#f4dba5', stone: '#b88d73', dark: '#8e716c', leaf: '#8baf89', accent: '#a5e0d4' },
  { grass: '#88bab0', rim: '#bfdec2', stone: '#8eabb4', dark: '#667f97', leaf: '#629c94', accent: '#fff2a9' },
  { grass: '#a59fb8', rim: '#d2c1d0', stone: '#8d819b', dark: '#605c78', leaf: '#8d87ae', accent: '#edbd6d' },
  { grass: '#c3a283', rim: '#f3cf9c', stone: '#c18d7c', dark: '#926c7c', leaf: '#92a791', accent: '#ffcf7f' },
  { grass: '#709b79', rim: '#b4cb8b', stone: '#8c9a85', dark: '#596f69', leaf: '#497d69', accent: '#e3c474' },
];
const noise = (n: number) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

export function grandstand(place: Place, parent: TransformNode, side: number, z: number, theme = THEMES[0]) {
  const stand = new TransformNode('floating-grandstand', parent.getScene()); stand.parent = parent;
  stand.position.set(side * 24, -1, z); stand.rotation.y = -side * Math.PI / 2;
  // Solid spectators are attached as one GPU batch by the audience renderer.
  place('island', '#647d82', stand, [0, -.8, -4], [43, 2.5, 9]);
  place('island', '#c5d4c9', stand, [0, .5, -4], [44, .4, 9]);
  for (let row = 0; row < 5; row++) {
    const y = row * 1.25 + 1, depth = -row * 2.1;
    place('box', ['#7ab6bb', '#e2bd8c', '#9cb9cf', '#d7a6ad', '#aebf9c'][row], stand, [0, y - .4, depth], [78 - row * 1.2, .6, 2.3]);
    place('box', theme.accent, stand, [0, y - .08, depth + 1.15], [78 - row * 1.2, .10, .10]);
  }
  place('banner', '#ffffff', stand, [0, -.1, 1.32], [77, 1.15, 1]);
  for (const x of [-37, 37]) {
    place('rod', '#e4ddc6', stand, [x, 5.9, -8], [.4, 12, .4]);
    place('rod', theme.accent, stand, [x, 7.9, -8], [.65, .3, .65]);
    const flag = place('banner', '#ffffff', stand, [x + 1.9, 10.7, -8], [4, 1.8, 1]); flag.rotation.y = .18;
  }
  // Rounded canopy and luminous fascia give the stands an airborne arena silhouette.
  place('island', '#e8dfc8', stand, [0, 9.1, -9.7], [44, .45, 5.6]);
  place('island', theme.accent, stand, [0, 9.4, -9.7], [44.2, .18, 5.8]);
  for (const x of [-38, 0, 38]) place('leaf', '#ffcf6d', stand, [x, 8.6, -6], [.7, .3, .4]);
  for (const x of [-29, 29]) {
    const thruster = place('hoop', '#8ce4ed', stand, [x, -2.5, -4], [2.3, 2.3, 1]); thruster.rotation.x = Math.PI / 2;
    place('leaf', '#8ce4ed', stand, [x, -3.1, -4], [2.8, .5, 2.8]);
  }
  return stand;
}

export function garden(place: Place, parent: TransformNode, x: number, y: number, z: number, size: number, theme = THEMES[0], seed = 1) {
  place('island', theme.dark, parent, [x, y - size * .4, z], [size, size * .8, size * .85]);
  place('island', theme.stone, parent, [x, y - size * .12, z], [size * 1.05, size * .3, size * .89]);
  place('island', theme.rim, parent, [x, y + .04, z], [size * 1.08, .32, size * .92]);
  place('island', theme.grass, parent, [x, y + .23, z], [size * 1.06, .24, size * .91]);
  for (let i = 0; i < 7; i++) {
    const a = i * 2.399, r = size * (.35 + noise(seed + i) * .52);
    const px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r * .8;
    const stone = place('rock', i % 2 ? theme.stone : theme.rim, parent, [px, y + .39, pz], [.65, .35 + noise(i) * .4, .5]);
    stone.rotation.y = a;
    if (i % 2 === 0) {
      const treeY = y + .4;
      place('rod', '#806b56', parent, [px, treeY + 1.1, pz], [.24, 2.3, .24]);
      for (let j = 0; j < 3; j++) place('leaf', j === 1 ? theme.grass : theme.leaf, parent, [px + Math.sin(j * 3) * .65, treeY + 2.3 + j * .55, pz + Math.cos(j * 3) * .45], [1.8 - j * .22, 1.6 - j * .2, 1.7 - j * .2]);
    }
  }
  for (let i = 0; i < 14; i++) {
    const a = i * 2.399 + seed, r = Math.sqrt(noise(i + seed)) * size * .85;
    const px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r * .82;
    const blade = place('grass', theme.leaf, parent, [px, y + .65, pz], [.16, .8, .25]); blade.rotation.z = Math.sin(a) * .4;
    if (i % 3 === 0) {
      place('rod', theme.leaf, parent, [px + .25, y + .55, pz], [.035, .5, .035]);
      place('leaf', i % 2 ? '#f0b8a7' : theme.accent, parent, [px + .25, y + .85, pz], [.32, .16, .32]);
      place('leaf', '#fff4ce', parent, [px + .25, y + .94, pz], [.11, .08, .11]);
    }
  }
  // Hanging roots and moss break the clean edge without adding collision clutter.
  for (let i = 0; i < 6; i++) {
    const a = i * 1.7, px = x + Math.cos(a) * size, pz = z + Math.sin(a) * size * .86;
    place('rod', theme.leaf, parent, [px, y - 1.1, pz], [.13, 2 + noise(i + seed) * 1.8, .13]);
    place('leaf', theme.grass, parent, [px, y - .4, pz], [.65, .7, .55]);
  }
}

export function sceneryChunk(place: Place, parent: TransformNode, course: CourseDefinition, z: number, rotors: TransformNode[], audience?: (stand: TransformNode) => void) {
  const theme = THEMES[course.difficultyIndex], index = z / 128;
  // Independent islands and gaps replace the continuous rectangular runway.
  if (z === 0) garden(place, parent, 0, -4.5, 6, 13, theme, 5);
  for (const side of [-1, 1]) {
    const x = side * (22 + noise(index + side) * 7), cz = z + 35 + side * 20;
    const stand = grandstand(place, parent, side, z + 48, theme);
    audience?.(stand);
    if (index % 2 === 0) garden(place, parent, side * 48, -9, z + 108, 8, theme, index * 7 + side);
    // Waterfalls, white streaks and spray; all decorative and below the course floor.
    if ((index + side + 1) % 3 === 0) {
      const wx = x - side * 7;
      place('water', '#96dad9', parent, [wx, -15, cz + 2], [2.4, 20, .13]);
      for (let j = 0; j < 3; j++) place('water', '#dcf7ef', parent, [wx - .75 + j * .7, -15, cz + 2.1], [.1, 18 - j, .1]);
      place('leaf', '#d7e9df', parent, [wx, -25, cz + 2], [5, 1.2, 4]);
    }
    if (side === -1 && index % 3 === 1) {
      const balloon = new TransformNode('striped-balloon', parent.getScene()); balloon.parent = parent; balloon.position.set(x - 12, 13 + noise(index) * 8, cz + 10);
      place('leaf', theme.accent, balloon, [0, 2, 0], [5, 6.5, 5]);
      place('leaf', '#fff0ce', balloon, [0, 2, .1], [2.3, 6.65, 5]);
      place('island', '#9a7755', balloon, [0, -3.7, 0], [1.2, .9, 1]);
      for (const s of [-1, 1]) place('rod', '#d5bb83', balloon, [s * .8, -2.3, 0], [.06, 3, .06]);
    }
    if (course.id === 'clockwork') {
      place('rod', theme.dark, parent, [x + side * 8, 1, cz + 20], [2.5, 14, 2.5]);
      for (let j = 0; j < 3; j++) {
        const gear = place('gear', theme.accent, parent, [x + side * 8 + j * 2.5, 4 + j, cz + 21.5], [2, 2, 2]); rotors.push(gear);
      }
    }
  }
  // Small navigation buoys mark the world bounds without enclosing the flight space.
  for (let i = 0; i < 4; i++) for (const side of [-1, 1]) {
    place('leaf', theme.accent, parent, [side * 11.8, -1.8, z + i * 32], [.28, .28, .28]);
    place('rod', theme.rim, parent, [side * 11.8, -2.8, z + i * 32], [.07, 2, .07]);
  }
}
