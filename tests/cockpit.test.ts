import { afterEach, expect, it, vi } from 'vitest';
import { updateFlightInstruments } from '../client/cockpit';
import { COURSES } from '../shared/courses';
import { createRacer } from '../shared/physics';
import type { PlayerSnapshot } from '../shared/protocol';

afterEach(() => vi.unstubAllGlobals());
it('guides toward the rendered moving-gate phase rather than an older stopwatch snapshot', () => {
  const elements = new Map<string, { textContent: string; style: { setProperty: () => void }; classList: { toggle: () => void; remove: () => void } }>();
  vi.stubGlobal('document', { getElementById: (id: string) => {
    if (!elements.has(id)) elements.set(id, { textContent: '', style: { setProperty() {} }, classList: { toggle() {}, remove() {} } });
    return elements.get(id);
  } });
  const gate = { ...COURSES[0].obstacles[0], kind: 'shutter' as const, x: 0, y: 6, z: 70, period: 6, phase: 0, amplitude: 2.2 };
  const bird = { ...createRacer('pilot'), name: 'Pilot', color: '#ffcc42', ready: true, loaded: true, connected: true } satisfies PlayerSnapshot;
  updateFlightInstruments(bird, { ...COURSES[0], obstacles: [gate] }, 0, 0, 1.5);
  expect(elements.get('gate-instruction')?.textContent).toContain('flap up');
});
