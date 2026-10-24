import { defineServer, defineRoom, matchMaker } from '@colyseus/core';
import { WebSocketTransport } from '@colyseus/ws-transport';
import { RaceRoom, liveRooms } from './rooms/RaceRoom';
import { COURSES } from '../shared/courses';
import express from 'express';
import { resolve } from 'node:path';
import compression from 'compression';
import { clientOrigin, roomLimit, apiRateLimit, healthRateLimit } from './config';
import { RequestGuard, installRequestGuard, FRAME_LIMIT } from './security';

const origin = clientOrigin(process.env.CLIENT_ORIGIN);
roomLimit(); // Fail invalid deployment configuration before accepting traffic.
const guard = new RequestGuard(origin, apiRateLimit(), healthRateLimit());
matchMaker.controller.getCorsHeaders = headers => ({ 'Access-Control-Allow-Origin': origin === '*' ? headers.get('origin') ?? '*' : origin });
export const server = defineServer({
  transport: new WebSocketTransport({ maxPayload: FRAME_LIMIT, perMessageDeflate: false, verifyClient: (info, done) => {
    const result = guard.upgrade(info.req);
    if (result) done(false, result.status, result.message, result.retryAfter ? { 'Retry-After': String(result.retryAfter) } : undefined);
    else done(true);
  } }),
  rooms: { race: defineRoom(RaceRoom).filterBy(['isPublic']) },
  express: app => {
    app.disable('x-powered-by');
    app.use(compression());
    app.use((req, res, next) => {
      res.setHeader('Access-Control-Allow-Origin', origin); res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
      if (req.method === 'OPTIONS') { res.sendStatus(204); return; }
      next();
    });
    app.get('/health', (_req, res) => {
      let players = 0, availablePublicSeats = 0;
      const simulation = [];
      for (const room of liveRooms.values()) {
        players += room.state.players.size;
        if (room.state.isPublic && room.state.phase === 'lobby' && !room.locked) availablePublicSeats += room.maxClients - room.state.players.size;
        simulation.push(room.metrics);
      }
      res.setHeader('Cache-Control', 'no-store');
      res.json({ status: 'ok', rooms: liveRooms.size, players, capacity: { maxRooms: roomLimit(), maxPlayersPerRoom: 8, acceptingNewRooms: liveRooms.size < roomLimit(), availablePublicSeats }, memoryMB: Math.round(process.memoryUsage().rss / 1048576), simulation, uptime: Math.round(process.uptime()) });
    });
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
server.listen(port, '0.0.0.0').then(() => {
  installRequestGuard(server.transport.server!, guard);
  console.log(`Flap Trials server listening on http://localhost:${port}`);
});

