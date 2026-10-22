import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
mkdirSync('.cache', { recursive: true });
const browser = await chromium.launch({ headless: true, args: ['--enable-unsafe-swiftshader', '--enable-unsafe-webgpu', '--use-angle=swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 1050 } });
const errors=[];
page.on('pageerror', e => { errors.push(e.message); console.log('ERROR',e.message); });
page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') console.log(m.type(), m.text().slice(0,350)); });
await page.goto(process.argv[2] ?? 'http://127.0.0.1:5173/?webgl=1&debug=1');
try { await page.waitForFunction(() => !!document.body.dataset.renderer, { timeout:45000 }); } catch {}
await page.evaluate(() => document.fonts.ready); await page.waitForTimeout(1500);
console.log('DIAGNOSTIC',JSON.stringify(await page.evaluate(() => ({data:window.__flap,boot:document.querySelector('#boot-note')?.textContent,overflow:document.documentElement.scrollWidth>innerWidth}))));
await page.screenshot({ path:'.cache/home.png',fullPage:true });
if (!errors.length && await page.locator('body').getAttribute('data-renderer')) {
  await page.getByRole('button',{name:'Solo practice'}).click(); await page.waitForTimeout(3500);
  await page.keyboard.press('Space'); await page.waitForTimeout(100);
  await page.screenshot({path:'.cache/race.png'});
  console.log('RACE',JSON.stringify(await page.evaluate(()=>window.__flap)));
}
await browser.close();
