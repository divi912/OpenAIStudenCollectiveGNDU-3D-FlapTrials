import type { IncomingMessage, Server, ServerResponse } from 'node:http';

export const HTTP_BODY_LIMIT = 8192;
export const FRAME_LIMIT = 4096;
export const MESSAGE_LIMIT = 180;

export class WindowLimiter {
  private entries = new Map<string, { count: number; until: number }>();
  private nextSweep = 0;
  constructor(private maxKeys = 10000) {}
  forget(key: string) { this.entries.delete(key); }
  take(key: string, limit: number, windowMs = 60000, now = Date.now()) {
    if (now >= this.nextSweep) {
      for (const [id, entry] of this.entries) if (entry.until <= now) this.entries.delete(id);
      this.nextSweep = now + 1000;
    }
    let entry = this.entries.get(key);
    if (entry && entry.until <= now) { this.entries.delete(key); entry = undefined; }
    if (!entry) {
      if (this.entries.size >= this.maxKeys) return { allowed: false, retryAfter: 1 };
      entry = { count: 0, until: now + windowMs }; this.entries.set(key, entry);
    }
    if (entry.count >= limit) return { allowed: false, retryAfter: Math.max(1, Math.ceil((entry.until - now) / 1000)) };
    entry.count++; return { allowed: true, retryAfter: 0 };
  }
}

export function allowedOrigin(origin: string | undefined, configured: string): boolean {
  return !origin || configured === '*' || origin === configured;
}

export interface RoomAction { type: 'ready' | 'map' | 'start' | 'loaded' | 'again'; value?: unknown; raceId?: number; hash?: string }
export function validAction(value: unknown, raceId: number): value is RoomAction {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const a = value as RoomAction;
  if (a.raceId !== undefined && a.raceId !== raceId) return false;
  switch (a.type) {
    case 'ready': return typeof a.value === 'boolean';
    case 'map': return typeof a.value === 'string' && a.value.length <= 64;
    case 'loaded': return typeof a.hash === 'string' && /^[a-f0-9]{8}$/.test(a.hash) && a.raceId === raceId;
    case 'start': case 'again': return true;
    default: return false;
  }
}

export class RequestGuard {
  private limiter = new WindowLimiter();
  constructor(private origin: string, private apiLimit = 600, private healthLimit = 1200) {}
  upgrade(req: IncomingMessage): { status: number; message: string; retryAfter?: number } | undefined {
    if (!allowedOrigin(req.headers.origin, this.origin)) return { status: 403, message: 'This website is not allowed to connect.' };
    const ip = req.socket.remoteAddress ?? 'unknown';
    const result = this.limiter.take(`ws:${ip}`, 240);
    if (!result.allowed) return { status: 429, message: 'Too many connection attempts. Please wait.', retryAfter: result.retryAfter };
  }
  http(req: IncomingMessage, res: ServerResponse): boolean {
    const reject = (status: number, message: string, retryAfter?: number) => {
      res.setHeader('Access-Control-Allow-Origin', this.origin === '*' ? req.headers.origin ?? '*' : this.origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true'); res.setHeader('Cache-Control', 'no-store');
      res.setHeader('Content-Type', 'application/json');
      if (retryAfter) res.setHeader('Retry-After', String(retryAfter));
      res.writeHead(status); res.end(JSON.stringify({ error: message }));
      return false;
    };
    let path: string;
    try {
      const host = req.headers[':authority'] ?? req.headers.host ?? 'localhost';
      const proto = req.headers['x-forwarded-proto'];
      if (typeof host !== 'string' || !host || /[\s/\\?#@]/.test(host) || (proto !== undefined && (typeof proto !== 'string' || !/^https?$/i.test(proto)))) return reject(400, 'Invalid request URL headers.');
      new URL(`http://${host}`);
      path = new URL(req.url ?? '/', 'http://localhost').pathname.toLowerCase().replace(/\/+$/, '') || '/';
    } catch { return reject(400, 'Invalid request address.'); }
    const health = path === '/health';
    const protectedApi = health || path.startsWith('/api/') || path.startsWith('/matchmake/');
    if (!protectedApi) return true;
    if ((req.url?.length ?? 0) > 2048) return reject(414, 'Request address is too long.');
    if (!health && !allowedOrigin(req.headers.origin, this.origin)) return reject(403, 'This website is not allowed to connect.');
    if (req.method === 'OPTIONS') return true;
    if (path.startsWith('/matchmake/') ? req.method !== 'POST' : !['GET', 'HEAD'].includes(req.method ?? '')) return reject(405, 'Method not allowed.');
    const ip = req.socket.remoteAddress ?? 'unknown';
    const result = this.limiter.take(`${health ? 'health' : 'api'}:${ip}`, health ? this.healthLimit : this.apiLimit);
    if (!result.allowed) return reject(429, 'Too many requests. Please wait before trying again.', result.retryAfter);
    if (/^\/matchmake\/(create|joinorcreate)\//.test(path)) {
      const creates = this.limiter.take(`create:${ip}`, 60);
      if (!creates.allowed) return reject(429, 'Too many room requests. Please wait before trying again.', creates.retryAfter);
    }
    if (path.startsWith('/matchmake/')) {
      if (!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type'] ?? '')) return reject(415, 'Send a JSON request.');
      const length = Number(req.headers['content-length'] ?? 0);
      if (!Number.isFinite(length) || length > HTTP_BODY_LIMIT) return reject(413, 'Request body is too large.');
      // Enforce the same cap for streamed/chunked requests before the framework parser.
      let received = 0;
      req.on('data', (chunk: Buffer) => {
        received += chunk.length;
        if (received > HTTP_BODY_LIMIT) { if (!res.headersSent) reject(413, 'Request body is too large.'); req.destroy(); }
      });
    }
    return true;
  }
}

/** Colyseus prepends its router ahead of Express, so guard the actual request entry. */
export function installRequestGuard(server: Server, guard: RequestGuard) {
  const listeners = server.listeners('request'); server.removeAllListeners('request');
  server.on('request', (req, res) => {
    if (!guard.http(req, res)) return;
    for (const listener of listeners) listener.call(server, req, res);
  });
  server.headersTimeout = 15000; server.requestTimeout = 20000;
}
