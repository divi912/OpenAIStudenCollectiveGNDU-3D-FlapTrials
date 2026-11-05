import type { ApertureShape, Box, CompiledCourse, CourseDefinition, ObstacleDefinition, ObstacleKind } from './protocol';

export const APERTURE_SHAPES: ApertureShape[] = ['circle', 'hexagon', 'oval', 'diamond', 'triangle', 'rectangle'];
export const isGate = (o: ObstacleDefinition) => !['gust', 'speed_zone', 'pickup'].includes(o.kind);

type RoutePoint = readonly [x: number, y: number, shape: ApertureShape];
interface CourseRecipe {
  id: string; name: string; subtitle: string; description: string;
  color: string; sky: string; ground: string;
  /** Repeated stage motifs are mirrored after each recovery plaza. */
  route: readonly RoutePoint[];
}

const recipes: CourseRecipe[] = [
  { id: 'skyline_sprint', name: 'Skyline Sprint', subtitle: 'A little courage. A lot of sky.',
    description: 'A grand skyway of rising arches, sweeping rooftop turns and forgiving bank slots.',
    color: '#67b4b0', sky: '#c0e5e6', ground: '#76b9a5',
    route: [[0, 6, 'circle'], [2.8, 7, 'hexagon'], [4, 8.5, 'oval'], [2, 9, 'diamond'], [-2.8, 7, 'circle'], [-4, 5.5, 'triangle']] },
  { id: 'cloud_carnival', name: 'Cloud Carnival', subtitle: 'Take the scenic loop.',
    description: 'Loop around giant cloud hoops, climb a festival arch and sweep through the carousel.',
    color: '#e4ad51', sky: '#f9e6c6', ground: '#8bbeb8',
    route: [[0, 6, 'hexagon'], [-3.6, 6.5, 'circle'], [-4.2, 8.5, 'oval'], [0, 10, 'triangle'], [4.2, 8.5, 'circle'], [3.6, 6, 'diamond']] },
  { id: 'crosswind', name: 'Crosswind', subtitle: 'Go against the whoosh.',
    description: 'Wide zigzag sails lead into gust lanes, high bridges and an open-sky slalom.',
    color: '#85a7c9', sky: '#cbdff0', ground: '#89a8bc',
    route: [[0, 6, 'oval'], [4.5, 6, 'diamond'], [-3.6, 7.5, 'hexagon'], [3.6, 9.5, 'circle'], [-4.5, 7, 'oval'], [0, 4.8, 'triangle']] },
  { id: 'the_needle', name: 'The Needle', subtitle: 'Small gaps. Big feelings.',
    description: 'A cathedral of slim portals: bank through long needle aisles and climb diamond spires.',
    color: '#ddab75', sky: '#f1ddba', ground: '#bc9879',
    route: [[0, 6, 'rectangle'], [-3, 7.5, 'diamond'], [-3.5, 9.5, 'triangle'], [0, 8, 'rectangle'], [3.5, 6, 'hexagon'], [3, 4.5, 'oval']] },
  { id: 'clockwork', name: 'Clockwork', subtitle: 'Timing is everything.',
    description: 'Pass immense rotating gears, stepped shutter towers and a turning escapement corridor.',
    color: '#b69bbf', sky: '#dfd4e9', ground: '#a999b4',
    route: [[0, 6, 'hexagon'], [3.8, 6, 'diamond'], [3.8, 9, 'rectangle'], [0, 10, 'hexagon'], [-3.8, 9, 'circle'], [-3.8, 5, 'oval']] },
  { id: 'terminal_velocity', name: 'Terminal Velocity', subtitle: 'What goes down, must flap up.',
    description: 'Climb the launch tower, dive through low speed lanes and pull up into a soaring finish.',
    color: '#df957a', sky: '#f4d3bb', ground: '#c29480',
    route: [[0, 6, 'triangle'], [3.5, 10.5, 'circle'], [4, 8, 'oval'], [0, 4, 'hexagon'], [-4, 3.8, 'diamond'], [-3.5, 8, 'rectangle']] },
  { id: 'featherless', name: 'Featherless', subtitle: 'For the beautifully stubborn.',
    description: 'Trace a vast ascending helix, cut through tilted shafts and bank across its broken crown.',
    color: '#92aa8c', sky: '#dce4c6', ground: '#99aa82',
    route: [[0, 6, 'diamond'], [4.5, 5, 'hexagon'], [5, 8, 'circle'], [1, 10.5, 'triangle'], [-4.5, 9, 'oval'], [-5, 5.5, 'rectangle'], [0, 4, 'hexagon']] },
  { id: 'storm_spiral', name: 'Storm Spiral', subtitle: 'Find the eye. Fly through.',
    description: 'Spiral between storm shutters, ride alternating gusts and thread the quiet eye of the storm.',
    color: '#718dce', sky: '#c8d2ec', ground: '#8c9aa6',
    route: [[0, 6, 'oval'], [-4.8, 5, 'triangle'], [-4.8, 9, 'diamond'], [0, 11, 'circle'], [4.8, 9, 'hexagon'], [4.8, 5, 'rectangle'], [0, 3.5, 'oval']] },
  { id: 'crown_circuit', name: 'Crown Circuit', subtitle: 'Earn every feather.',
    description: 'The final grand circuit combines crown spires, gear galleries, deep dives and banked storm lanes.',
    color: '#c694ba', sky: '#eed6e8', ground: '#b7a0af',
    route: [[0, 6, 'triangle'], [4.5, 10, 'diamond'], [5, 6, 'hexagon'], [1.5, 3.5, 'oval'], [-4.5, 5, 'rectangle'], [-5, 10.5, 'circle'], [0, 11, 'hexagon'], [3.5, 7, 'diamond']] },
];

const quantize = (value: number) => Number(value.toFixed(6));

export const COURSES: CourseDefinition[] = recipes.map((recipe, index) => {
  const { id, name, subtitle, description, color, sky, ground, route } = recipe;
  const difficultyGroup = (['easy', 'medium', 'hard'] as const)[Math.floor(index / 3)];
  const difficultyLevel = (index % 3 + 1) as 1 | 2 | 3;
  const length = 1280 + index * 160;
  const checkpoints: CourseDefinition['checkpoints'] = [];
  for (let z = index === 0 ? 140 : 220; z < length - 125; z += 200 + index * 10) {
    checkpoints.push({ id: `cp-${checkpoints.length + 1}`, z, x: 0, y: 6 });
  }
  const obstacles: ObstacleDefinition[] = [];
  const cadence = 44 - index * 2;
  const opening = [10, 9.4, 8.8, 7.8, 7.2, 6.7, 6.2, 5.8, 5.4][index];
  let pickupIndex = 0;
  const safe = (z: number) => z < length - 40 && checkpoints.every(cp => Math.abs(cp.z - z) >= 24);
  const boundaries = [0, ...checkpoints.map(cp => cp.z), length];

  for (let stage = 0; stage < boundaries.length - 1; stage++) {
    const start = boundaries[stage], end = boundaries[stage + 1];
    const mirror = stage % 2 ? -1 : 1;
    // The empty plaza around each checkpoint lets the bird level out before the next motif.
    for (let z = stage === 0 ? 70 : start + 34, slot = 0; z <= end - (end === length ? 48 : 26); z += cadence, slot++) {
      const [rx, ry, shape] = route[(slot + (stage % 3) * 2) % route.length];
      let kind: ObstacleKind = slot % 3 === 1 ? 'wall' : 'ring';
      if (index === 1 && slot === 2 && stage % 2) kind = 'rotating_gate';
      if ((index === 4 || index === 5) && slot % 3 !== 0) kind = slot % 3 === 1 ? 'shutter' : 'rotating_gate';
      if (index >= 6 && slot % 3 === 1) kind = stage % 2 ? 'shutter' : 'rotating_gate';
      if (index === 8 && slot % 3 === 2) kind = 'rotating_gate';
      const widthScale = shape === 'triangle' ? 1.75 : shape === 'oval' ? 1.4 : shape === 'diamond' ? 1.25 : shape === 'rectangle' ? 1.12 : 1;
      const heightScale = shape === 'triangle' ? 1.65 : shape === 'oval' ? .86 : shape === 'diamond' ? 1.4 : shape === 'rectangle' ? .88 : 1;
      const gate: ObstacleDefinition = {
        id: `${id}-s${stage + 1}-g${slot + 1}`, kind, shape, z,
        x: quantize(stage === 0 && slot === 0 ? 0 : rx * mirror), y: ry,
        width: quantize(opening * widthScale), height: quantize(opening * heightScale),
        thickness: kind === 'wall' ? 1.15 : .75,
        period: 8 - index * .24 + slot % 3, phase: quantize(stage * .7 + slot * .45),
        amplitude: index < 6 ? 1.1 : 1.35, strength: mirror * (5 + index * .3),
        tilt: slot % 2 ? quantize(mirror * (.18 + index * .045)) : 0,
      };
      // The final circuit's shorter cadence needs a central approach before its bank corridor.
      if (index === 8 && slot === 2) gate.x = quantize(gate.x * .5);
      // Isolated vertical slots teach rolling; later tiers extend them into two-part bank corridors.
      if (slot === (index === 0 ? 2 : 3) && (stage % 2 === 0 || index >= 3)) {
        gate.kind = 'twist_gate'; gate.shape = 'rectangle';
        gate.width = index < 3 ? 1.55 : index < 6 ? 1.45 : 1.35;
        gate.height = 7; gate.x = 0; gate.y = 7; gate.tilt = index < 3 ? 0 : quantize(mirror * .12);
        if (index >= 3 && safe(z + 6) && z + 6 <= end - 26) {
          obstacles.push({ ...gate, id: `${gate.id}-bank`, z: z + 6, width: gate.width + .1, tilt: quantize(gate.tilt + mirror * .1) });
        }
      }
      obstacles.push(gate);
      // Gifts sit in open air after the obstacle; no route relies on a shield to be traversable.
      if (slot % 3 === 0 && safe(z + 15) && pickupIndex < 31) {
        obstacles.push({ ...gate, id: `${gate.id}-gift`, kind: 'pickup', z: z + 15,
          width: 2.8, height: 2.8, powerUp: pickupIndex % 2 ? 'shield' : 'boost', pickupIndex: pickupIndex++ });
      }
      if ((index === 2 || index >= 6) && slot % 3 === 1 && safe(z + 14)) {
        obstacles.push({ ...gate, id: `${gate.id}-wind`, kind: 'gust', z: z + 14, width: 12, height: 10,
          strength: mirror * (index === 2 ? 5 : 7 + (index - 6) * 1.5) });
      }
      if ((index === 5 || index === 8) && slot % 4 === 2 && safe(z + 12)) {
        obstacles.push({ ...gate, id: `${gate.id}-dive`, kind: 'speed_zone', z: z + 12, width: 5, height: 5, y: 4, strength: 6 });
      }
    }
  }
  obstacles.sort((a, b) => a.z - b.z);
  return { id, name, subtitle, difficulty: difficultyGroup.toUpperCase(), difficultyIndex: index, difficultyGroup, difficultyLevel,
    description, color, sky, ground, estimatedClearSeconds: Math.ceil(length / 16),
    length, width: 30, floor: -3, ceiling: 20, finishY: 6, version: '4.0.0',
    path: { turn: [.48, .56, .64, .6, .7, .74, .8, .88, .96][index], wavelength: [180, 170, 160, 155, 150, 165, 145, 135, 140][index], lift: [.14, .17, .16, .2, .22, .31, .26, .3, .34][index] },
    checkpoints, obstacles };
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

