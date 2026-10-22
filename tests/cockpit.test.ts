import { afterEach, expect, it, vi } from 'vitest';
import { hudTemplate, updateFlightInstruments } from '../client/cockpit';
import { COURSES } from '../shared/courses';
import { createRacer } from '../shared/physics';
import type { PlayerSnapshot } from '../shared/protocol';

afterEach(() => vi.unstubAllGlobals());
it('keeps navigation and powers without the telemetry, pitch or points panels', () => {
  const html = hudTemplate(COURSES[0], true);
  for (const removed of ['telemetry-panel', 'attitude-panel', 'cockpit-style', 'race-speed', 'flight-pitch', 'style-score']) expect(html).not.toContain(removed);
  for (const retained of ['power-status', 'course-progress', 'race-time', 'race-rivals', 'gate-instruction']) expect(html).toContain(retained);
});
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
