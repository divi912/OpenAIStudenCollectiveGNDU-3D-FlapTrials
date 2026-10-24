import { test, expect } from '@playwright/test';
import { existsSync, readFileSync } from 'node:fs';
import { resolve, extname, relative } from 'node:path';

test('an ordinary production build uses Render on the public domain rather than the static host', async ({ page }) => {
  const root = resolve('dist/client');
  test.skip(!existsSync(resolve(root, 'index.html')), 'Run npm run build before the deployment regression.');
  const origin = 'https://flaptrials.divii.xyz';
  const backend = 'https://openaistudencollectivegndu-3d-flaptrials.onrender.com';
  const wrongHost: string[] = [];
  let creates = 0;
  await page.route(`${origin}/**`, route => {
    const url = new URL(route.request().url());
    if (/^\/(health|api|matchmake)(\/|$)/.test(url.pathname)) {
      wrongHost.push(url.pathname); return route.fulfill({ status: 404 });
    }
    const file = resolve(root, `.${url.pathname === '/' ? '/index.html' : url.pathname}`);
    if (relative(root, file).startsWith('..') || !existsSync(file)) return route.fulfill({ status: 404 });
    const types: Record<string, string> = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.wasm': 'application/wasm', '.glb': 'model/gltf-binary' };
    return route.fulfill({ body: readFileSync(file), contentType: types[extname(file)] ?? 'application/octet-stream' });
  });
  await page.route(`${backend}/**`, route => {
    const headers = { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Credentials': 'true', 'Access-Control-Allow-Headers': 'Content-Type,Authorization' };
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    if (new URL(route.request().url()).pathname === '/health') return route.fulfill({ json: { status: 'ok', rooms: 0, players: 0 }, headers });
    if (route.request().url().includes('/matchmake/create/')) creates++;
    return route.fulfill({ status: 503, json: { error: 'Test server unavailable' }, headers });
  });
  await page.goto(`${origin}/?webgl=1`);
  await page.getByRole('button', { name: 'Create a room', exact: true }).click();
  await page.getByRole('button', { name: 'Create private room' }).click();
  await expect.poll(() => creates).toBe(1);
  expect(wrongHost).toEqual([]);
});
