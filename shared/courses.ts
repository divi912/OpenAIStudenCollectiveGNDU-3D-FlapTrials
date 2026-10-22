import type { ApertureShape, Box, CompiledCourse, CourseDefinition, ObstacleDefinition, ObstacleKind } from './protocol';

export const APERTURE_SHAPES: ApertureShape[] = ['circle', 'hexagon', 'oval', 'diamond', 'triangle', 'rectangle'];
export const isGate = (o: ObstacleDefinition) => !['gust', 'speed_zone', 'pickup'].includes(o.kind);

const descriptions = [
  ['skyline_sprint', 'Skyline Sprint', 'A little courage. A lot of sky.', 'EASY', 'Learn flap rhythm and sweeping turns, then bank through forgiving twist slots.', '#67b4b0', '#c0e5e6', '#76b9a5', 55],
  ['the_needle', 'The Needle', 'Small gaps. Big feelings.', 'PRECISE', 'Bank through alternating narrow slots and twisting tunnel sequences.', '#ddab75', '#f1ddba', '#bc9879', 70],
  ['crosswind', 'Crosswind', 'Go against the whoosh.', 'INTERMEDIATE', 'Carve banked slaloms and hold your wings steady against sweeping gusts.', '#85a7c9', '#cbdff0', '#89a8bc', 80],
  ['clockwork', 'Clockwork', 'Timing is everything.', 'ADVANCED', 'Time rotating apertures, pitch through shutters and thread banked twist corridors.', '#b69bbf', '#dfd4e9', '#a999b4', 90],
  ['terminal_velocity', 'Terminal Velocity', 'What goes down, must flap up.', 'ADVANCED', 'Pitch through sweeping climbs and dives, saving momentum for angled slots.', '#df957a', '#f4d3bb', '#c29480', 100],
  ['featherless', 'Featherless', 'For the beautifully stubborn.', 'EXPERT', 'Helix alignments, twisting shafts and compound banks through the sharpest curves.', '#92aa8c', '#dce4c6', '#99aa82', 110],
] as const;

export const COURSES: CourseDefinition[] = descriptions.map((meta, index) => {
  const [id, name, subtitle, difficulty, description, color, sky, ground, estimatedClearSeconds] = meta;
  const length = estimatedClearSeconds * 16;
  const checkpoints = Array.from({ length: Math.floor((length - 100) / (index < 2 ? 140 : 180)) }, (_, i) => ({ id: `cp-${i + 1}`, z: (i + 1) * (index < 2 ? 140 : 180), x: 0, y: 6 }));
  const obstacles: ObstacleDefinition[] = [];
  const gap = index === 0 ? 36 : index === 5 ? 29 : 33;
  for (let z = 70, i = 0; z < length - 45; z += gap, i++) {
    if (checkpoints.some(cp => Math.abs(cp.z - z) < 23)) continue;
    let kind: ObstacleKind = i % 3 === 1 ? 'wall' : 'ring';
    if (index === 2 && i % 3 === 1) kind = 'gust';
    if (index === 3) kind = i % 2 ? 'shutter' : 'rotating_gate';
    if (index === 4 && i % 3 === 1) kind = 'speed_zone';
    if (index === 5) kind = (['ring', 'shutter', 'wall', 'gust', 'rotating_gate'] as const)[i % 5];
    const x = Number((i === 0 ? 0 : Math.sin(i * 1.6) * (index === 0 ? 1.8 : 4.2)).toFixed(6));
    const y = Number((index === 4 ? [10, 3.5, 5, 11, 4][i % 5] : 6 + Math.sin(i * 1.9) * (index === 0 ? 1 : 2.8)).toFixed(6));
    const shape = APERTURE_SHAPES[i % APERTURE_SHAPES.length];
    const narrow = shape === 'triangle' || shape === 'diamond';
    obstacles.push({ id: `${id}-${i}`, kind, shape, z, x, y,
      width: (index === 0 ? 8.8 : index === 1 ? 5.2 : index === 5 ? 5 : 6.6) + (narrow ? 1.5 : 0),
      height: (index === 0 ? 8 : index === 1 ? 5.5 : index === 5 ? 5.2 : 6.6) + (narrow ? 1.5 : 0),
      thickness: kind === 'wall' ? 1.1 : 0.65, period: 5 + (i % 3), phase: i * 0.8,
      amplitude: kind === 'shutter' ? 2.2 : 1.4, strength: i % 2 ? 7 : -7 });
  }
  let pickupIndex = 0;
  for (const [j, gate] of obstacles.filter(isGate).entries()) {
    gate.tilt = j % 3 === 1 ? Number(((j % 2 ? 1 : -1) * (.2 + index * .07)).toFixed(6)) : 0;
    if (j % 6 === 3) {
      gate.kind = 'twist_gate'; gate.shape = 'rectangle'; gate.width = index === 0 ? 1.28 : 1.16; gate.height = index === 0 ? 6 : 5.4;
      gate.x = 0; gate.y = 7; gate.tilt = index === 1 && j % 12 > 6 ? Math.PI / 2 : index === 3 ? -.3 : 0;
      if ([1, 3, 5].includes(index)) for (let stage = 1; stage <= 2; stage++) {
        const z = gate.z + stage * 4.5;
        if (checkpoints.some(cp => Math.abs(cp.z - z) < 22)) continue;
        obstacles.push({ ...gate, id: `${gate.id}-twist-${stage}`, z, width: 1.35, tilt: gate.tilt + stage * .12 });
      }
    } else if (index === 5 && j % 4 !== 0) {
      gate.x = Number((Math.sin(j * 1.2) * 3).toFixed(6)); gate.y = Number((6.5 + Math.cos(j * 1.2) * 2.3).toFixed(6));
    }
  }
  for (const gate of obstacles) {
    if (gate.shape === 'circle') gate.height = gate.width;
    if (gate.shape === 'oval') { gate.width = Number((gate.width * 1.25).toFixed(6)); gate.height = Number((gate.height * .72).toFixed(6)); }
  }
  for (const gate of [...obstacles].filter(isGate).filter((_, i) => i % 2 === 0)) {
    const z = gate.z + 13;
    if (checkpoints.some(cp => Math.abs(cp.z - z) < 20) || pickupIndex >= 31) continue;
    obstacles.push({ ...gate, id: `${gate.id}-gift`, kind: 'pickup', z, width: 2.6, height: 2.6, powerUp: pickupIndex % 2 ? 'shield' : 'boost', pickupIndex: pickupIndex++ });
  }
  obstacles.sort((a, b) => a.z - b.z);
  if (index === 5) {
    for (const gate of [...obstacles].filter((_, i) => i % 4 === 1)) {
      const z = gate.z + 23;
      if (checkpoints.some(cp => Math.abs(cp.z - z) < 25)) continue;
      obstacles.push({ ...gate, id: `${gate.id}-shortcut`, kind: 'speed_zone', z, x: gate.x > 0 ? -4.5 : 4.5, y: 3.5, width: 3.4, height: 3.6, strength: 6 });
    }
    obstacles.sort((a, b) => a.z - b.z);
  }
  return { id, name, subtitle, difficulty, difficultyIndex: index, description, color, sky, ground,
    estimatedClearSeconds, length, width: 24, floor: -2, ceiling: 17, finishY: 6,
    version: '3.0.0', path: { turn: [.45, .6, .75, .65, .7, .85][index], wavelength: [160, 145, 135, 140, 150, 120][index], lift: [.12, .16, .14, .19, .25, .22][index] }, checkpoints, obstacles };
});

export function compileCourse(definition: CourseDefinition): CompiledCourse {
  if (!Number.isFinite(definition.length) || definition.length <= 0 || !Number.isFinite(definition.width) || definition.width <= 0) throw new Error('Invalid course bounds');
  if (definition.path && (![definition.path.turn, definition.path.wavelength, definition.path.lift].every(Number.isFinite) || definition.path.wavelength < 80 || Math.abs(definition.path.turn) > 1 || Math.abs(definition.path.lift) > .4)) throw new Error('Invalid course path');
  let last = 0;
  for (const cp of definition.checkpoints) {
    if (!Number.isFinite(cp.z) || cp.z <= last || cp.z >= definition.length) throw new Error('Checkpoints must be ordered inside the course');
    if (Math.abs(cp.x) > definition.width / 2 - 1 || cp.y <= definition.floor + 1 || cp.y >= definition.ceiling - 1) throw new Error('Unsafe checkpoint spawn');
    last = cp.z;
  }
  const ids = new Set<string>();
  const bins = new Map<number, ObstacleDefinition[]>();
  for (const o of definition.obstacles) {
    if (ids.has(o.id) || !['ring', 'wall', 'shutter', 'rotating_gate', 'twist_gate', 'gust', 'speed_zone', 'pickup'].includes(o.kind)) throw new Error('Invalid obstacle identifier/kind');
    if (o.shape && !APERTURE_SHAPES.includes(o.shape)) throw new Error('Invalid aperture shape');
    if (o.tilt !== undefined && !Number.isFinite(o.tilt)) throw new Error('Invalid gate tilt');
    if (o.kind === 'pickup' && (!['boost', 'shield'].includes(o.powerUp ?? '') || !Number.isInteger(o.pickupIndex) || o.pickupIndex! < 0 || o.pickupIndex! > 30)) throw new Error('Invalid pickup');
    ids.add(o.id);
    if (![o.x, o.y, o.z, o.width, o.height, o.thickness, o.period, o.phase, o.amplitude, o.strength].every(Number.isFinite)
      || o.width <= .65 || o.height <= .65 || o.thickness <= 0 || o.z < 20 || o.z >= definition.length
      || (['shutter', 'rotating_gate'].includes(o.kind) && o.period <= 0)) throw new Error(`Invalid obstacle ${o.id}`);
    if (definition.checkpoints.some(cp => Math.abs(cp.z - o.z) < 20)) throw new Error('Obstacle overlaps safe checkpoint staging');
    for (let bin = Math.floor((o.z - 8) / 64); bin <= Math.floor((o.z + 8) / 64); bin++) {
      const list = bins.get(bin) ?? []; list.push(o); bins.set(bin, list);
    }
  }
  const text = JSON.stringify(definition);
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) hash = Math.imul(hash ^ text.charCodeAt(i), 16777619);
  return { definition, bins, hash: (hash >>> 0).toString(16) };
}

export const COMPILED_COURSES = new Map(COURSES.map(c => [c.id, compileCourse(c)]));
export function getCourse(id: string): CompiledCourse { return COMPILED_COURSES.get(id) ?? COMPILED_COURSES.get('skyline_sprint')!; }

/** The same tick-derived aperture pose is used by graphics and collision. */
export function obstaclePose(o: ObstacleDefinition, seconds: number): { x: number; y: number; angle: number } {
  const phase = seconds * Math.PI * 2 / o.period + o.phase;
  return { x: o.x, y: o.y + (o.kind === 'shutter' ? Math.sin(phase) * o.amplitude : 0), angle: (o.tilt ?? 0) + (o.kind === 'rotating_gate' ? phase : 0) };
}

export function obstacleBoxes(o: ObstacleDefinition, seconds: number): Box[] {
  if (!isGate(o)) return [];
  const cached = staticBoxes.get(o);
  if (cached) return cached;
  const boxes = apertureVertices(o).map((_, i) => obstacleBoxAt(o, seconds, i));
  if (o.kind !== 'shutter' && o.kind !== 'rotating_gate') staticBoxes.set(o, boxes);
  return boxes;
}

const vertices = new WeakMap<ObstacleDefinition, [number, number][]>();
const staticBoxes = new WeakMap<ObstacleDefinition, Box[]>();
export function apertureVertices(o: ObstacleDefinition): [number, number][] {
  let points = vertices.get(o); if (points) return points;
  const hw = o.width / 2, hh = o.height / 2, shape = o.shape ?? 'rectangle';
  if (shape === 'rectangle') points = [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]];
  else {
    const count = shape === 'triangle' ? 3 : shape === 'diamond' ? 4 : shape === 'hexagon' ? 6 : 32;
    const offset = shape === 'triangle' || shape === 'diamond' ? Math.PI / 2 : shape === 'hexagon' ? Math.PI / 6 : 0;
    points = Array.from({ length: count }, (_, i) => { const a = i * Math.PI * 2 / count + offset; return [Math.cos(a) * hw, Math.sin(a) * hh]; });
  }
  vertices.set(o, points); return points;
}
/** Signed clearance to the convex opening: shared by collision, shields and gate feedback. */
export function apertureClearance(o: ObstacleDefinition, x: number, y: number): number {
  const points = apertureVertices(o); let distance = Infinity;
  for (let i = 0; i < points.length; i++) {
    const a = points[i], b = points[(i + 1) % points.length], dx = b[0] - a[0], dy = b[1] - a[1];
    distance = Math.min(distance, (dx * (y - a[1]) - dy * (x - a[0])) / Math.hypot(dx, dy));
  }
  return distance;
}
export function obstacleBoxAt(o: ObstacleDefinition, seconds: number, i: number): Box {
  const points = apertureVertices(o), a = points[i], b = points[(i + 1) % points.length];
  const dx = b[0] - a[0], dy = b[1] - a[1], length = Math.hypot(dx, dy), rail = o.kind === 'wall' ? .9 : .55;
  const x = (a[0] + b[0]) / 2 + dy / length * rail / 2, y = (a[1] + b[1]) / 2 - dx / length * rail / 2;
  const pose = obstaclePose(o, seconds), c = Math.cos(pose.angle), s = Math.sin(pose.angle);
  return { center: [pose.x + x * c - y * s, pose.y + x * s + y * c, o.z], half: [length / 2 + rail * .2, rail / 2, o.thickness / 2], angle: Math.atan2(dy, dx) + pose.angle };
}

