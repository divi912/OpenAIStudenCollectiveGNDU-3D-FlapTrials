export interface RateBinding { limit(options: { key: string }): Promise<{ success: boolean }> }
export interface GatewayLimits {
  CREATION_LIMIT: RateBinding;
  API_LIMIT: RateBinding;
  UPGRADE_LIMIT: RateBinding;
  HEALTH_LIMIT: RateBinding;
}
const BODY_LIMIT = 8192;
const failure = (status: number, error: string) => Response.json({ error }, { status, headers: { 'Cache-Control': 'no-store', ...(status === 429 ? { 'Retry-After': '60' } : {}) } });

export async function prepareGatewayRequest(request: Request, limits: GatewayLimits): Promise<Request | Response> {
  const url = new URL(request.url), websocket = request.headers.get('Upgrade')?.toLowerCase() === 'websocket';
  const origin = request.headers.get('Origin');
  if (origin && origin !== url.origin && (request.method === 'POST' || websocket)) return failure(403, 'This website is not allowed to connect.');
  if (url.pathname.length + url.search.length > 2048) return failure(414, 'Request address is too long.');
  const allowed = websocket ? ['GET'] : url.pathname.startsWith('/matchmake/') ? ['POST', 'OPTIONS'] : ['GET', 'HEAD', 'OPTIONS'];
  if (!allowed.includes(request.method)) return failure(405, 'Method not allowed.');
  if (request.method === 'OPTIONS') return new Response(null, { status: 204 });
  // This header is supplied by Cloudflare at the edge, rather than a browser ID.
  const key = request.headers.get('CF-Connecting-IP') ?? 'local';
  const bucket = websocket ? limits.UPGRADE_LIMIT : url.pathname === '/health' ? limits.HEALTH_LIMIT : limits.API_LIMIT;
  try {
    if (!(await bucket.limit({ key })).success) return failure(429, 'Too many requests. Please wait a minute before trying again.');
    if (/^\/matchmake\/(create|joinOrCreate)\//.test(url.pathname) && !(await limits.CREATION_LIMIT.limit({ key })).success) return failure(429, 'Too many room requests. Please wait a minute before trying again.');
  } catch { return failure(503, 'Connection checks are temporarily unavailable. Please retry shortly.'); }
  if (request.method !== 'POST') return request;
  if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get('Content-Type') ?? '')) return failure(415, 'Send a JSON request.');
  if (Number(request.headers.get('Content-Length') ?? 0) > BODY_LIMIT) return failure(413, 'Request body is too large.');
  const reader = request.body?.getReader(), chunks: Uint8Array[] = [];
  let total = 0;
  if (reader) {
    try {
      while (true) {
        const { value, done } = await reader.read(); if (done) break;
        total += value.byteLength;
        if (total > BODY_LIMIT) { void reader.cancel(); return failure(413, 'Request body is too large.'); }
        chunks.push(value);
      }
    } catch { return failure(400, 'Could not read request.'); }
  }
  const bytes = new Uint8Array(total); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  try {
    const body = JSON.parse(new TextDecoder().decode(bytes) || '{}');
    if (!body || typeof body !== 'object' || Array.isArray(body)) return failure(400, 'Invalid room request.');
  } catch { return failure(400, 'Invalid JSON request.'); }
  const headers = new Headers(request.headers); headers.delete('Content-Length');
  return new Request(request.url, { method: 'POST', headers, body: bytes, signal: request.signal });
}
