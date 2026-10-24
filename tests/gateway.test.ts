import { afterEach, expect, it, vi } from 'vitest';
import gateway from '../worker/index';

afterEach(() => vi.unstubAllGlobals());
const binding = () => ({ limit: vi.fn(async () => ({ success: true })) });
const env = () => ({ MULTIPLAYER_BACKEND: 'https://multiplayer.onrender.com', ASSETS: { fetch: vi.fn(async () => new Response('static asset')) }, CREATION_LIMIT: binding(), API_LIMIT: binding(), UPGRADE_LIMIT: binding(), HEALTH_LIMIT: binding() });

it('forwards health to the fixed backend without exposing a cross-origin redirect', async () => {
  const fetcher = vi.fn(async (_request: Request) => Response.json({ status: 'ok' })); vi.stubGlobal('fetch', fetcher);
  const response = await gateway.fetch(new Request('https://game.test/health'), env());
  expect(await response.json()).toEqual({ status: 'ok' });
  expect(fetcher.mock.calls[0][0].url).toBe('https://multiplayer.onrender.com/health');
  expect(response.headers.get('Cache-Control')).toBe('no-store');
});

it('preserves matchmaking body, method, origin and reservation query', async () => {
  const fetcher = vi.fn(async (_request: Request) => Response.json({ room: 'test' })); vi.stubGlobal('fetch', fetcher);
  const request = new Request('https://game.test/matchmake/create/race?test=1', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://game.test' }, body: '{"name":"Bird"}' });
  await gateway.fetch(request, env());
  const forwarded = fetcher.mock.calls[0][0];
  expect(forwarded.url).toBe('https://multiplayer.onrender.com/matchmake/create/race?test=1');
  expect(forwarded.method).toBe('POST'); expect(await forwarded.text()).toBe('{"name":"Bird"}');
  expect(forwarded.headers.get('Origin')).toBe('https://game.test');
});

it('passes WebSocket upgrades through without reconstructing the upgraded response', async () => {
  const upgraded = { status: 101, webSocket: {} } as unknown as Response;
  const fetcher = vi.fn(async (_request: Request) => upgraded); vi.stubGlobal('fetch', fetcher);
  const response = await gateway.fetch(new Request('https://game.test/process/room?sessionId=bird', { headers: { Upgrade: 'websocket' } }), env());
  expect(response).toBe(upgraded);
  expect(fetcher.mock.calls[0][0].url).toBe('https://multiplayer.onrender.com/process/room?sessionId=bird');
  expect(fetcher.mock.calls[0][0].headers.get('Upgrade')).toBe('websocket');
});

it('keeps assets local and reports temporary backend failures as retryable', async () => {
  const settings = env(), fetcher = vi.fn(async () => { throw new Error('origin unavailable'); }); vi.stubGlobal('fetch', fetcher);
  expect(await (await gateway.fetch(new Request('https://game.test/assets/game.js'), settings)).text()).toBe('static asset');
  expect(fetcher).not.toHaveBeenCalled();
  const response = await gateway.fetch(new Request('https://game.test/health'), settings);
  expect(response.status).toBe(502); expect(response.headers.get('Cache-Control')).toBe('no-store');
});

it('rejects throttled creates, foreign origins and oversized bodies before touching Render', async () => {
  const settings = env(), fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher);
  settings.CREATION_LIMIT.limit.mockResolvedValue({ success: false });
  const post = (body = '{}', origin = 'https://game.test') => new Request('https://game.test/matchmake/create/race', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: origin }, body });
  const limited = await gateway.fetch(post(), settings);
  expect(limited.status).toBe(429); expect(limited.headers.get('Retry-After')).toBe('60');
  expect((await gateway.fetch(post('{}', 'https://foreign.test'), settings)).status).toBe(403);
  settings.CREATION_LIMIT.limit.mockResolvedValue({ success: true });
  expect((await gateway.fetch(post('x'.repeat(9000)), settings)).status).toBe(413);
  expect((await gateway.fetch(post('[]'), settings)).status).toBe(400);
  expect(fetcher).not.toHaveBeenCalled();
});
