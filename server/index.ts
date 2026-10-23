import { defineServer, defineRoom } from '@colyseus/core';
import { RaceRoom, liveRooms } from './rooms/RaceRoom';
import { COURSES } from '../shared/courses';
import express from 'express';
import { resolve } from 'node:path';
import compression from 'compression';

const requests = new Map<string, { time: number; count: number }>();
export const server = defineServer({
  rooms: { race: defineRoom(RaceRoom).filterBy(['isPublic']) },
  express: app => {
    app.use(compression());
    app.use((req, res, next) => {
      const origin = process.env.CLIENT_ORIGIN ?? '*';
      res.setHeader('Access-Control-Allow-Origin', origin); res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
      if (req.method === 'OPTIONS') { res.sendStatus(204); return; }
      if (req.path.startsWith('/api') || req.path.startsWith('/matchmake')) {
        const ip = req.ip ?? ''; const now = Date.now();
        const entry = requests.get(ip);
        if (!entry || now - entry.time > 60000) requests.set(ip, { time: now, count: 1 });
        else if (++entry.count > 80) { res.status(429).json({ error: 'A few too many requests. Try again in a minute.' }); return; }
        if (requests.size > 5000) for (const [key, v] of requests) if (now - v.time > 60000) requests.delete(key);
      }
      next();
    });
    app.get('/health', (_req, res) => res.json({ status: 'ok', rooms: liveRooms.size, players: [...liveRooms.values()].reduce((n, r) => n + r.state.players.size, 0), memoryMB: Math.round(process.memoryUsage().rss / 1048576), simulation: [...liveRooms.values()].map(r => r.metrics), uptime: Math.round(process.uptime()) }));
    app.get('/api/rooms/:code', (req, res) => {
      const room = liveRooms.get(String(req.params.code).toUpperCase());
      if (!room) { res.status(404).json({ error: 'That nest could not be found. Check the room code.' }); return; }
      if (room.state.phase !== 'lobby') { res.status(409).json({ error: 'This race is underway. Try joining after the results.' }); return; }
      if (room.state.players.size >= 8) { res.status(409).json({ error: 'This nest is full. Eight birds is a crowd!' }); return; }
      res.json({ roomId: room.roomId });
    });
    app.get('/api/courses', (_req, res) => res.json(COURSES.map(({ id, name, version }) => ({ id, name, version }))));
    app.use(express.static(resolve('dist/client'), { index: 'index.html', maxAge: '1h', setHeaders: (res, path) => { if (/[\\/]assets[\\/]/.test(path)) res.setHeader('Cache-Control', 'public,max-age=31536000,immutable'); } }));
  },
});

const port = Number(process.env.PORT ?? 2567);
server.listen(port, '0.0.0.0').then(() => console.log(`Flap Trials server listening on http://localhost:${port}`));

