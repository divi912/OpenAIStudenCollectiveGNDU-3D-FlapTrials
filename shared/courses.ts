import type { Box, CompiledCourse, CourseDefinition, ObstacleDefinition, ObstacleKind } from './protocol';

const descriptions = [
  ['skyline_sprint', 'Skyline Sprint', 'A little courage. A lot of sky.', 'EASY', 'Learn the rhythm. Thread generous rings above a sunlit sea of clouds.', '#67b4b0', '#c0e5e6', '#76b9a5', 55],
  ['the_needle', 'The Needle', 'Small gaps. Big feelings.', 'PRECISE', 'Find your line through narrow pipes and alternating offset openings.', '#ddab75', '#f1ddba', '#bc9879', 70],
  ['crosswind', 'Crosswind', 'Go against the whoosh.', 'INTERMEDIATE', 'Read the windsocks and counter-steer through sweeping gusts.', '#85a7c9', '#cbdff0', '#89a8bc', 80],
  ['clockwork', 'Clockwork', 'Timing is everything.', 'ADVANCED', 'Moving shutters and rotating apertures. Pick your moment, keep your nerve.', '#b69bbf', '#dfd4e9', '#a999b4', 90],
  ['terminal_velocity', 'Terminal Velocity', 'What goes down, must flap up.', 'ADVANCED', 'Trade altitude for speed, then earn it back through long climbs.', '#df957a', '#f4d3bb', '#c29480', 100],
  ['featherless', 'Featherless', 'For the beautifully stubborn.', 'EXPERT', 'A little of everything, tightly packed. Brave birds can take the inside line.', '#92aa8c', '#dce4c6', '#99aa82', 110],
] as const;

export const COURSES: CourseDefinition[] = descriptions.map((meta, index) => {
  const [id, name, subtitle, difficulty, description, color, sky, ground, estimatedClearSeconds] = meta;
  const length = estimatedClearSeconds * 16;
  const checkpoints = Array.from({ length: Math.floor((length - 100) / (index < 2 ? 140 : 180)) }, (_, i) => ({ id: `cp-${i + 1}`, z: (i + 1) * (index < 2 ? 140 : 180), x: 0, y: 6 }));
  const obstacles: ObstacleDefinition[] = [];
  const gap = index === 0 ? 65 : index === 5 ? 45 : 55;
  for (let z = 70, i = 0; z < length - 45; z += gap, i++) {
    if (checkpoints.some(cp => Math.abs(cp.z - z) < 27)) continue;
    let kind: ObstacleKind = i % 3 === 1 ? 'wall' : 'ring';
    if (index === 2 && i % 3 === 1) kind = 'gust';
    if (index === 3) kind = i % 2 ? 'shutter' : 'rotating_gate';
    if (index === 4 && i % 3 === 1) kind = 'speed_zone';
    if (index === 5) kind = (['ring', 'shutter', 'wall', 'gust', 'rotating_gate'] as const)[i % 5];
    const x = i === 0 ? 0 : Math.sin(i * 1.6) * (index === 0 ? 1.8 : 4.2);
    const y = index === 4 ? [10, 3.5, 5, 11, 4][i % 5] : 6 + Math.sin(i * 1.9) * (index === 0 ? 1 : 2.8);
    obstacles.push({ id: `${id}-${i}`, kind, z, x, y,
      width: index === 0 ? 9 : index === 1 ? 4.2 : index === 5 ? 4 : 6,
      height: index === 0 ? 7 : index === 1 ? 4.2 : index === 5 ? 4 : 5.5,
      thickness: kind === 'wall' ? 1.1 : 0.65, period: 5 + (i % 3), phase: i * 0.8,
      amplitude: kind === 'shutter' ? 2.2 : 1.4, strength: i % 2 ? 7 : -7 });
  }
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
    version: '1.0.0', checkpoints, obstacles };
});

export function compileCourse(definition: CourseDefinition): CompiledCourse {
  if (!Number.isFinite(definition.length) || definition.length <= 0 || !Number.isFinite(definition.width) || definition.width <= 0) throw new Error('Invalid course bounds');
  let last = 0;
  for (const cp of definition.checkpoints) {
    if (!Number.isFinite(cp.z) || cp.z <= last || cp.z >= definition.length) throw new Error('Checkpoints must be ordered inside the course');
    if (Math.abs(cp.x) > definition.width / 2 - 1 || cp.y <= definition.floor + 1 || cp.y >= definition.ceiling - 1) throw new Error('Unsafe checkpoint spawn');
    last = cp.z;
  }
  const ids = new Set<string>();
  const bins = new Map<number, ObstacleDefinition[]>();
  for (const o of definition.obstacles) {
    if (ids.has(o.id) || !['ring', 'wall', 'shutter', 'rotating_gate', 'gust', 'speed_zone'].includes(o.kind)) throw new Error('Invalid obstacle identifier/kind');
    ids.add(o.id);
    if (![o.x, o.y, o.z, o.width, o.height, o.thickness, o.period, o.phase, o.amplitude, o.strength].every(Number.isFinite)
      || o.width <= 1 || o.height <= 1 || o.thickness <= 0 || o.z < 20 || o.z >= definition.length
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
  return { x: o.x, y: o.y + (o.kind === 'shutter' ? Math.sin(phase) * o.amplitude : 0), angle: o.kind === 'rotating_gate' ? phase : 0 };
}

export function obstacleBoxes(o: ObstacleDefinition, seconds: number): Box[] {
  if (o.kind === 'gust' || o.kind === 'speed_zone') return [];
  const pose = obstaclePose(o, seconds);
  const rail = o.kind === 'wall' ? 2.4 : 0.7;
  const hw = o.width / 2, hh = o.height / 2;
  const c = Math.cos(pose.angle), s = Math.sin(pose.angle);
  const box = (x: number, y: number, hx: number, hy: number): Box => ({
    center: [pose.x + x * c - y * s, pose.y + x * s + y * c, o.z], half: [hx, hy, o.thickness / 2], angle: pose.angle,
  });
  return [box(-hw - rail / 2, 0, rail / 2, hh + rail), box(hw + rail / 2, 0, rail / 2, hh + rail), box(0, -hh - rail / 2, hw, rail / 2), box(0, hh + rail / 2, hw, rail / 2)];
}

