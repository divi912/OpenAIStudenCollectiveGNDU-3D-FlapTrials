interface Env {
  ASSETS: { fetch(request: Request): Promise<Response> };
  MULTIPLAYER_BACKEND: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const websocket = request.headers.get('Upgrade')?.toLowerCase() === 'websocket';
    const api = url.pathname === '/health' || url.pathname.startsWith('/api/') || url.pathname.startsWith('/matchmake/');
    if (!api && !websocket) return env.ASSETS.fetch(request);

    // The upstream host comes only from deployment configuration, never a client path.
    const upstream = new URL(env.MULTIPLAYER_BACKEND);
    upstream.pathname = url.pathname; upstream.search = url.search;
    const forwarded = new Request(upstream, request);
    forwarded.headers.delete('Host');
    try {
      const response = await fetch(forwarded, { redirect: 'manual' });
      // An upgraded Response owns the socket; cloning it would lose that connection.
      if (response.status === 101) return response;
      const headers = new Headers(response.headers);
      headers.set('Cache-Control', 'no-store'); headers.set('X-Flap-Gateway', 'render');
      return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
    } catch {
      return Response.json({ error: 'The multiplayer server is temporarily unavailable. Please retry shortly.' }, {
        status: 502, headers: { 'Cache-Control': 'no-store', 'Retry-After': '5', 'X-Flap-Gateway': 'render' },
      });
    }
  },
};
