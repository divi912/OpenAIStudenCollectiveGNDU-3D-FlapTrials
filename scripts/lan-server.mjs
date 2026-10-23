import { networkInterfaces } from 'node:os';
import { spawn } from 'node:child_process';

const port = Number(process.env.PORT ?? 2567);
const addresses = [...new Set(Object.values(networkInterfaces()).flatMap(items =>
  (items ?? []).filter(item => item.family === 'IPv4' && !item.internal).map(item => item.address),
))];
console.log('Flap Trials LAN server');
console.log(`This PC: http://localhost:${port}`);
if (addresses.length) for (const address of addresses) console.log(`Share with players on your Wi-Fi/LAN: http://${address}:${port}`);
else console.log('No LAN IPv4 address found. Check your Wi-Fi/network connection.');
console.log('Keep this window open while you play. Press Ctrl+C to stop the server.');

const server = spawn(process.execPath, ['dist/server/index.js'], {
  stdio: 'inherit',
  env: { ...process.env, PORT: String(port), HOST: '0.0.0.0' },
  windowsHide: true,
});
const stop = signal => { if (!server.killed) server.kill(signal); };
process.on('SIGINT', () => stop('SIGINT'));
process.on('SIGTERM', () => stop('SIGTERM'));
server.on('exit', (code, signal) => { process.exitCode = code ?? (signal ? 1 : 0); });
