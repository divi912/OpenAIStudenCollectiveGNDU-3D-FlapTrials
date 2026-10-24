import { test, expect } from '@playwright/test';
import { existsSync, readFileSync } from 'node:fs';
import { resolve, extname, relative } from 'node:path';

test('the production website uses its gateway when direct Render access is blocked', async ({ page }) => {
  const root = resolve('dist/client');
  test.skip(!existsSync(resolve(root, 'index.html')), 'Run npm run build before the deployment regression.');
  const origin = 'https://flaptrials.divii.xyz';
  const backend = 'https://openaistudencollectivegndu-3d-flaptrials.onrender.com';
  const directRequests: string[] = [];
  let creates = 0;
  await page.route(`${origin}/**`, route => {
    const url = new URL(route.request().url());
    if (/^\/(health|api|matchmake)(\/|$)/.test(url.pathname)) {
      if (url.pathname === '/health') return route.fulfill({ json: { status: 'ok', rooms: 0, players: 0 } });
      if (url.pathname.includes('/matchmake/create/')) creates++;
      return route.fulfill({ status: 503, json: { error: 'Test server unavailable' } });
    }
    const file = resolve(root, `.${url.pathname === '/' ? '/index.html' : url.pathname}`);
    if (relative(root, file).startsWith('..') || !existsSync(file)) return route.fulfill({ status: 404 });
    const types: Record<string, string> = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.wasm': 'application/wasm', '.glb': 'model/gltf-binary' };
    return route.fulfill({ body: readFileSync(file), contentType: types[extname(file)] ?? 'application/octet-stream' });
  });
  await page.route(`${backend}/**`, route => {
    directRequests.push(route.request().url()); return route.abort('blockedbyclient');
  });
  await page.goto(`${origin}/?webgl=1`);
  await page.getByRole('button', { name: 'Create a room', exact: true }).click();
  await page.getByRole('button', { name: 'Create private room' }).click();
  await expect.poll(() => creates).toBe(1);
  expect(directRequests).toEqual([]);
});
