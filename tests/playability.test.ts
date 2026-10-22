import { expect, it } from 'vitest';
import { COURSES, getCourse } from '../shared/courses';
import { createRacer, stepRacer } from '../shared/physics';
import { pilot } from '../scripts/autopilot';

for (const definition of COURSES) it(`${definition.name} has a reachable complete route using legal controls`, () => {
  const bird = createRacer('playtest'); const course = getCourse(definition.id);
  const deadlineTicks = Math.max(180, definition.estimatedClearSeconds + 90) * 60;
  for (let tick = 0; tick < deadlineTicks && bird.status !== 'finished'; tick++) stepRacer(bird, pilot(bird, definition, tick), course, tick);
  expect(bird.status, `stuck at z=${bird.z.toFixed(1)}, checkpoint=${bird.checkpointIndex}, crashes=${bird.crashCount}, cause=${bird.crashCause}`).toBe('finished');
  expect(bird.checkpointIndex).toBe(definition.checkpoints.length);
});
