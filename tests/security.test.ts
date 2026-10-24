import { expect, it } from 'vitest';
import { WindowLimiter, allowedOrigin, validAction } from '../server/security';

it('enforces independent windows, reports retry time and bounds tracking memory', () => {
  const limiter = new WindowLimiter(2);
  expect(limiter.take('a', 2, 1000, 0).allowed).toBe(true);
  expect(limiter.take('a', 2, 1000, 100).allowed).toBe(true);
  expect(limiter.take('a', 2, 1000, 200)).toMatchObject({ allowed: false, retryAfter: 1 });
  expect(limiter.take('b', 2, 1000, 200).allowed).toBe(true);
  expect(limiter.take('c', 2, 1000, 200).allowed).toBe(false);
  expect(limiter.take('a', 2, 1000, 1001).allowed).toBe(true);
});
it('allows the configured website and non-browser tools, rejects foreign browser origins', () => {
  expect(allowedOrigin('https://game.test', 'https://game.test')).toBe(true);
  expect(allowedOrigin(undefined, 'https://game.test')).toBe(true);
  expect(allowedOrigin('https://evil.test', 'https://game.test')).toBe(false);
  expect(allowedOrigin('null', 'https://game.test')).toBe(false);
  expect(allowedOrigin('http://localhost:5173', '*')).toBe(true);
});
it('rejects malformed and stale actions without coercing objects into strings', () => {
  for (const action of [null, [], { type: 'map', value: {} }, { type: 'loaded', hash: {}, raceId: 1 }, { type: 'ready', value: 'yes' }, { type: 'start', raceId: 0 }, { type: 'unknown' }]) expect(validAction(action, 1)).toBe(false);
  expect(validAction({ type: 'ready', value: true, raceId: 1 }, 1)).toBe(true);
  expect(validAction({ type: 'start' }, 1)).toBe(true);
  expect(validAction({ type: 'loaded', hash: '1234abcd', raceId: 1 }, 1)).toBe(true);
});
