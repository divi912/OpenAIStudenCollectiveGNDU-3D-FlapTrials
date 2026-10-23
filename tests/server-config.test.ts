import { expect, it } from 'vitest';
import { clientOrigin, roomLimit } from '../server/config';
import { canRequestRoom } from '../shared/server-health';

it('canonicalizes the configured client origin without reflecting other websites', () => {
  expect(clientOrigin(' https://flaptrials.divii.xyz. ')).toBe('https://flaptrials.divii.xyz');
  expect(clientOrigin('https://flaptrials.divii.xyz/')).toBe('https://flaptrials.divii.xyz');
  expect(clientOrigin('http://localhost:5173')).toBe('http://localhost:5173');
  expect(clientOrigin()).toBe('*');
  for (const origin of ['invalid', 'https://x.test/path', 'https://user:password@x.test', 'file:///x']) expect(() => clientOrigin(origin)).toThrow();
});

it('validates room limits and allows code joins and available public seats at capacity', () => {
  expect(roomLimit('2')).toBe(2);
  for (const limit of ['0', '-1', 'nope', '1.5']) expect(() => roomLimit(limit)).toThrow();
  const health = { status: 'ok' as const, rooms: 10, players: 10, capacity: { maxRooms: 10, maxPlayersPerRoom: 8, acceptingNewRooms: false, availablePublicSeats: 0 } };
  expect(canRequestRoom(health, 'create')).toBe(false);
  expect(canRequestRoom(health, 'quick')).toBe(false);
  expect(canRequestRoom(health, 'join')).toBe(true);
  health.capacity.availablePublicSeats = 2;
  expect(canRequestRoom(health, 'quick')).toBe(true);
  expect(canRequestRoom(health, 'create')).toBe(false);
});
