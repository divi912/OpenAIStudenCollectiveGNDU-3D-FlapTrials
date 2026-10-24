/** Canonicalize a single configured origin; never reflect arbitrary request origins. */
export function clientOrigin(value = '*'): string {
  if (value.trim() === '*') return '*';
  const url = new URL(value.trim());
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash || (url.pathname !== '/' && url.pathname !== '')) throw new Error('CLIENT_ORIGIN must be one HTTP(S) origin.');
  url.hostname = url.hostname.replace(/\.+$/, '');
  return url.origin;
}

export function roomLimit(value = process.env.MAX_ROOMS): number {
  const limit = Number(value ?? 10);
  if (!Number.isSafeInteger(limit) || limit < 1) throw new Error('MAX_ROOMS must be a positive integer.');
  return limit;
}

export function apiRateLimit(value = process.env.HTTP_REQUESTS_PER_MINUTE): number {
  const limit = Number(value ?? 600);
  if (!Number.isSafeInteger(limit) || limit < 1) throw new Error('HTTP_REQUESTS_PER_MINUTE must be a positive integer.');
  return limit;
}

export function healthRateLimit(value = process.env.HEALTH_REQUESTS_PER_MINUTE): number {
  const limit = Number(value ?? 1200);
  if (!Number.isSafeInteger(limit) || limit < 1) throw new Error('HEALTH_REQUESTS_PER_MINUTE must be a positive integer.');
  return limit;
}
