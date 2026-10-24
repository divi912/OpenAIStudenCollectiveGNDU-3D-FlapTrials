# Cloudflare Workers hosting and LAN multiplayer

## Public website: Workers Static Assets

`flaptrials.divii.xyz` is hosted directly by the existing Worker
`openaistudencollectivegndu-3d-flaptrials`, using Workers Static Assets.
`wrangler.jsonc` uploads only `dist/client` and attaches the custom domain.
No proxy Worker or Pages origin is required. Cloudflare manages the Worker's
domain routing and underlying DNS; DNS is still involved, but no separate
Pages CNAME needs to be managed manually.

To deploy after changes, authenticate with `npx wrangler@4.152.0 login`, then run:

```sh
npm run deploy:cloudflare
```

For a Git-connected Workers Build, select this repository and the
`main` branch, set build command `npm run build:cloudflare`, and deploy
command `npx wrangler@4.152.0 deploy --keep-vars`. The checked-in config supplies
the Worker name, assets directory and custom domain. A local Wrangler deploy
does not itself enable Git-triggered builds.

The public frontend connects to the Node/Colyseus backend at
`https://openaistudencollectivegndu-3d-flaptrials.onrender.com`, configured in
`.env.cloudflare`. This file is public configuration, not a credential.
Both `npm run build` and `npm run build:cloudflare` now embed the public origin
and backend mapping from that file. When opened on `VITE_CLIENT_ORIGIN`, either
build connects to Render; local/LAN and preview hosts continue using their own
server. An explicit `VITE_SERVER_URL` always overrides this selection. If you
change the public domain or backend, update both entries in `.env.cloudflare`
and rebuild the frontend.

This prevents a Git-connected Worker built with the ordinary build command from
requesting `/health` on the static Cloudflare host. That endpoint returns 404
there because Workers Static Assets does not run the multiplayer server. A
missing backend endpoint now produces an immediate setup error instead of a
75-second cold-start retry. Actual temporary Render failures are still retried.

On Render set `CLIENT_ORIGIN=https://flaptrials.divii.xyz` exactly (no trailing
slash or period), and use `/health` as the service health-check path.
Set the Render service's Git branch to `main` so it runs the
same server version as this frontend, with all integrated gameplay and mobile changes.
Render's free service can take about a minute to wake up after inactivity;
the connection screen waits and retries while it wakes. Server restarts discard
active rooms.

Workers Static Assets serves only the frontend; Render runs multiplayer.
Ordinary `npm run build` and `npm run lan` continue connecting to the local
server when opened on a local/LAN host. LAN play remains available below.

## Optional LAN play: one player hosts on their PC

For now, the player who creates a race runs the authoritative Colyseus server on their own computer. Everyone must be connected to the same local network (Wi-Fi/LAN). The host runs the game and server together; other players open the host PC's LAN URL in their browser and join from there.

### Host steps

1. Install Node.js 24 (22.12 or newer) on the host PC.
2. In the project folder, install dependencies once with `npm ci`.
3. Run `npm run lan`. It builds the current game, starts the server, and prints the LAN URL to share.
4. Leave the terminal window open while playing. If Windows Firewall prompts for network access, allow Node on the private network.
5. Share the printed `http://<host-LAN-IP>:2567` URL with players on the same Wi-Fi/LAN. They open it, choose Join with a code, and the creator shares the six-character code.

The server binds to `0.0.0.0:2567` so other LAN devices can reach it. The server serves the browser client from the same origin, so each browser automatically connects matchmaking and WebSocket traffic to the host PC. No Cloudflare account or public backend is needed for LAN play. Solo practice also works without creating a room.

The host terminal must stay open, and the host PC must stay awake and connected. This mode is for a shared LAN; it does not let friends join across the public internet. Do not expose port 2567 to the internet or create a router port-forward for this setup.

## Optional Cloudflare Pages deployment

The existing Pages project remains available at `flap-trials.pages.dev`, using build command `npm run build` and output directory `dist/client` with Node.js 24. The primary custom domain belongs to the Worker, not Pages. The included `public/_headers` applies immutable caching to Vite's content-hashed assets and basic response headers on both static hosting options.

A Pages-hosted browser cannot start a Node server on the player's computer. For LAN multiplayer, all participants need the host's LAN URL above, which serves both client and server from the host PC. They should not use the public Pages URL to join the LAN room. Cloudflare can host the landing page/game download, while authoritative multiplayer continues to run on the room creator's computer. A future direct Pages-to-LAN connection would need a secure runtime configuration and HTTPS/WSS compatibility on the local host; this setup intentionally avoids that complication.

## Public multiplayer backend

A persistent Node/Colyseus backend is required for players outside the host's network. The included Dockerfile runs it on Render. Deploy matching client/server versions from the same branch. Keep one server instance because room lookup and room limits are stored in memory. The Cloudflare frontend uses the build-time `VITE_SERVER_URL`; a normal local build does not use the hosted backend.

Cloudflare documentation: [Pages build configuration](https://developers.cloudflare.com/pages/configuration/build-configuration/), [Pages custom domains](https://developers.cloudflare.com/pages/configuration/custom-domains/), [WebSockets](https://developers.cloudflare.com/network/websockets/).
