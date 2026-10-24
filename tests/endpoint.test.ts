import { expect, it } from 'vitest';
import { serverEndpoint } from '../client/network/endpoint';

const hosted = { origin: 'https://game.example.com', server: 'https://multiplayer.onrender.com' };
it('routes the public site to Render regardless of the frontend build mode', () => {
  expect(serverEndpoint('https://game.example.com', false, undefined, hosted)).toBe(hosted.server);
  expect(serverEndpoint('https://game.example.com', false, '', hosted)).toBe(hosted.server);
  expect(serverEndpoint('https://game.example.com', false, 'https://override.example/', hosted)).toBe('https://override.example');
});
it('preserves local, LAN, preview and same-origin production connections', () => {
  expect(serverEndpoint('http://localhost:5173', true, undefined, hosted)).toBe('http://localhost:2567');
  expect(serverEndpoint('http://192.168.1.4:5173', true, undefined, hosted)).toBe('http://192.168.1.4:2567');
  expect(serverEndpoint('http://[::1]:5173', true, undefined, hosted)).toBe('http://[::1]:2567');
  expect(serverEndpoint('http://localhost:2571', false, undefined, hosted)).toBe('http://localhost:2571');
  expect(serverEndpoint('https://game.example.com.other.test', false, undefined, hosted)).toBe('https://game.example.com.other.test');
});
