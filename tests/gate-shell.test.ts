import { expect, it } from 'vitest';
import { gateShell } from '../client/game/gate-shell';
import { COURSES, apertureClearance, apertureVertices, isGate } from '../shared/courses';

it('keeps every bevel outside the true aperture and lights the front surface toward the racer', () => {
  for (const course of COURSES) for (const gate of course.obstacles.filter(isGate)) {
    const data = gateShell(apertureVertices(gate), gate.kind === 'wall' ? .9 : .55, gate.thickness);
    const p = data.positions!, n = data.normals!;
    for (let i = 0; i < p.length; i += 3) {
      expect(Number.isFinite(p[i] + p[i + 1] + p[i + 2])).toBe(true);
      expect(apertureClearance(gate, p[i], p[i + 1])).toBeLessThanOrEqual(1e-6);
      expect(Math.abs(p[i + 2])).toBeLessThanOrEqual(gate.thickness / 2 + 1e-6);
    }
    expect(n[5]).toBeLessThan(0);
    expect(data.indices!.length / 3).toBeLessThanOrEqual(512);
  }
});
