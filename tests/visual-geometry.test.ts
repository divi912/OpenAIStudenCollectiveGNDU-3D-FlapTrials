import { expect, it } from 'vitest';
import { sphereData } from '../client/game/sphere';
import { gateShell } from '../client/game/gate-shell';
import { ringData } from '../client/game/ring';

for (const [name, data] of [['sphere', sphereData()], ['ring', ringData()], ['gate', gateShell([[-2,-2],[2,-2],[2,2],[-2,2]], .55, .8)]] as const) {
  it(`${name} has finite unit normals, outward winding and nondegenerate faces`, () => {
    const p = data.positions!, n = data.normals!, indices = data.indices!;
    for (let i = 0; i < n.length; i += 3) {
      expect(Math.hypot(n[i], n[i + 1], n[i + 2])).toBeCloseTo(1, 5);
      expect(Number.isFinite(p[i] + p[i + 1] + p[i + 2])).toBe(true);
    }
    for (let i = 0; i < indices.length; i += 3) {
      const [a,b,c] = [indices[i],indices[i+1],indices[i+2]].map(v => v * 3);
      const u = [p[b]-p[a],p[b+1]-p[a+1],p[b+2]-p[a+2]];
      const v = [p[c]-p[a],p[c+1]-p[a+1],p[c+2]-p[a+2]];
      const cross = [u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];
      expect(cross[0]*n[a]+cross[1]*n[a+1]+cross[2]*n[a+2]).toBeLessThan(-1e-8);
    }
  });
}

