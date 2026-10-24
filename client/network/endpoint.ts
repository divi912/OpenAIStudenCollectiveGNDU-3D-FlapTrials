export interface HostedBackend { origin?: string; server?: string }

/** Keep local builds local, while recognizing the public site in either build mode. */
export function serverEndpoint(origin: string, development: boolean, configured?: string, hosted?: HostedBackend): string {
  const explicit = configured?.trim().replace(/\/+$/, '');
  if (explicit) return explicit;
  const page = new URL(origin);
  if (!development && hosted?.origin && hosted.server && page.origin === new URL(hosted.origin).origin) {
    return hosted.server.trim().replace(/\/+$/, '');
  }
  if (development) page.port = '2567';
  return page.origin;
}
