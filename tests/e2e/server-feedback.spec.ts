import { test, expect } from '@playwright/test';

test('explains full servers before attempting to allocate another room', async ({ page }) => {
  let creates = 0;
  page.on('request', request => { if (request.url().includes('/matchmake/create/')) creates++; });
  await page.route('**/health', route => route.fulfill({ json: { status: 'ok', rooms: 10, players: 80, capacity: { maxRooms: 10, maxPlayersPerRoom: 8, acceptingNewRooms: false, availablePublicSeats: 0 } } }));
  await page.goto('/?webgl=1');
  await page.getByRole('button', { name: 'Create a room', exact: true }).click();
  await page.getByRole('button', { name: 'Create private room' }).click();
  await expect(page.locator('#form-error')).toContainText('Server full');
  await expect(page.locator('#loading-feedback')).toBeHidden();
  expect(creates).toBe(0);
});

test('shows cold-start feedback and allows cancellation instead of a stuck spinner', async ({ page }) => {
  await page.route('**/health', route => route.fulfill({ status: 503, body: 'Waking' }));
  await page.goto('/?webgl=1');
  await page.getByRole('button', { name: 'Create a room', exact: true }).click();
  await page.getByRole('button', { name: 'Create private room' }).click();
  await expect(page.locator('#loading-feedback')).toContainText('minute to wake up');
  await page.getByRole('button', { name: 'Cancel connection' }).click();
  await expect(page.locator('#loading-feedback')).toBeHidden();
  await expect(page.locator('#form-error')).toContainText('cancelled');
  await expect(page.locator('#profile-form button[type=submit]')).toBeEnabled();
});
