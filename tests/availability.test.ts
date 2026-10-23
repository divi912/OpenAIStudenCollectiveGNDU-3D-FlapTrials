import { afterEach, expect, it, vi } from 'vitest';
import { connectionError, waitForServer } from '../client/network/availability';

afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

it('retries a waking server and returns real health, not an HTML landing page', async () => {
  vi.useFakeTimers();
  const health = { status: 'ok', rooms: 0, players: 0 };
  const fetcher = vi.fn().mockResolvedValueOnce(new Response('Waking', { status: 503 })).mockResolvedValueOnce(Response.json(health));
  vi.stubGlobal('fetch', fetcher);
  const pending = waitForServer('https://server.test', new AbortController().signal);
  await vi.advanceTimersByTimeAsync(1600);
  expect(await pending).toEqual(health);
  expect(fetcher).toHaveBeenCalledTimes(2);
});

it('cancels a retry without issuing more requests', async () => {
  vi.useFakeTimers();
  const fetcher = vi.fn().mockResolvedValue(new Response('Waking', { status: 503 })); vi.stubGlobal('fetch', fetcher);
  const controller = new AbortController();
  const pending = waitForServer('https://server.test', controller.signal);
  const rejected = expect(pending).rejects.toThrow('cancelled');
  await vi.advanceTimersByTimeAsync(20); controller.abort(); await rejected;
  await vi.advanceTimersByTimeAsync(5000);
  expect(fetcher).toHaveBeenCalledTimes(1);
});

it('does not retry rate limits and explains server capacity and room errors', async () => {
  const fetcher = vi.fn().mockResolvedValue(new Response('', { status: 429 })); vi.stubGlobal('fetch', fetcher);
  await expect(waitForServer('https://server.test', new AbortController().signal)).rejects.toThrow('429');
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(connectionError(new Error('Server full'))).toContain('Server full');
  expect(connectionError(new Error('seat reservation expired'))).toContain('room is full');
  expect(connectionError(new Error('Failed to fetch'))).toContain('waking up');
});
