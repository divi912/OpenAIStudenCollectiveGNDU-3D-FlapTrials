import type { ServerHealth } from '../../shared/server-health';

export function connectionError(cause: unknown): string {
  const text = cause instanceof Error ? cause.message : String(cause ?? '');
  if (/server full|all rooms|all nests/i.test(text)) return 'Server full: all rooms are busy. Join a friend’s room or try again after a race ends.';
  if (/seat reservation|room.*full|maxClients/i.test(text)) return 'That room is full or its invitation expired. Try another room or ask the host for a new code.';
  if (/429|too many requests/i.test(text)) return 'Too many requests. Please wait a minute before trying again.';
  if (/fetch|network|timeout|timed out|failed to connect|502|503|504/i.test(text)) return 'The multiplayer server could not be reached. It may be waking up or restarting. Try again shortly; solo practice still works.';
  return text || 'Could not connect. Please try again.';
}

export async function waitForServer(url: string, signal: AbortSignal): Promise<ServerHealth> {
  const timeout = AbortSignal.timeout(75000);
  const combined = AbortSignal.any([signal, timeout]);
  while (!combined.aborted) {
    try {
      const response = await fetch(`${url}/health`, { cache: 'no-store', signal: AbortSignal.any([combined, AbortSignal.timeout(8000)]) });
      if (response.status === 429) throw new Error('429: too many requests');
      if (response.ok) {
        const health = await response.json() as ServerHealth;
        if (health.status === 'ok') return health;
      }
    } catch (cause) {
      if (cause instanceof Error && cause.message.startsWith('429:')) throw cause;
      if (combined.aborted) break;
    }
    await new Promise<void>(resolve => {
      const done = () => { clearTimeout(timer); combined.removeEventListener('abort', done); resolve(); };
      const timer = setTimeout(done, 1500);
      combined.addEventListener('abort', done, { once: true });
      if (combined.aborted) done();
    });
  }
  throw new Error(signal.aborted ? 'Connection cancelled.' : 'Server wake-up timed out. Please try again shortly.');
}
