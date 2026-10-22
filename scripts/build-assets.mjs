import { existsSync, readdirSync, mkdirSync, writeFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const local = resolve('.tools/blender');
const candidates = [process.env.BLENDER_BIN, resolve('.tools/blender/blender.exe')];
if (existsSync(local)) for (const name of readdirSync(local)) candidates.push(resolve(local, name, 'blender.exe'));
const blender = candidates.find(p => p && existsSync(p)) ?? 'blender';
mkdirSync('public/models', { recursive: true }); mkdirSync('assets/source', { recursive: true });
const run = spawnSync(blender, ['--background', '--factory-startup', '--python', resolve('scripts/models.py')], { stdio: 'inherit' });
if (run.error || run.status) { console.error('Set BLENDER_BIN to your Blender executable, or extract portable Blender under .tools/blender.'); process.exit(1); }
const manifest = { version: 1, generator: 'scripts/models.py', assets: ['bird.glb', 'obstacle-kit.glb'].map(file => ({ file, bytes: statSync(`public/models/${file}`).size })) };
writeFileSync('public/models/manifest.json', JSON.stringify(manifest, null, 2));
console.log('Editable Blender sources and runtime GLBs generated.');
