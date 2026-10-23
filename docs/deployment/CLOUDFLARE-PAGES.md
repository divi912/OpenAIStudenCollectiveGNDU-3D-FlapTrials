# Cloudflare Pages and LAN-hosted multiplayer

## Current play mode: one player hosts on their PC

For now, the player who creates a race runs the authoritative Colyseus server on their own computer. Everyone must be connected to the same local network (Wi-Fi/LAN). The host runs the game and server together; other players open the host PC's LAN URL in their browser and join from there.

### Host steps

1. Install Node.js 24 (22.12 or newer) on the host PC.
2. In the project folder, install dependencies once with `npm ci`.
3. Run `npm run lan`. It builds the current game, starts the server, and prints the LAN URL to share.
4. Leave the terminal window open while playing. If Windows Firewall prompts for network access, allow Node on the private network.
5. Share the printed `http://<host-LAN-IP>:2567` URL with players on the same Wi-Fi/LAN. They open it, choose Join with a code, and the creator shares the six-character code.

The server binds to `0.0.0.0:2567` so other LAN devices can reach it. The server serves the browser client from the same origin, so each browser automatically connects matchmaking and WebSocket traffic to the host PC. No Cloudflare account or public backend is needed for LAN play. Solo practice also works without creating a room.

The host terminal must stay open, and the host PC must stay awake and connected. This mode is for a shared LAN; it does not let friends join across the public internet. Do not expose port 2567 to the internet or create a router port-forward for this setup.

## Cloudflare Pages role

Cloudflare Pages can host the static site at `flaptrials.divii.xyz` using build command `npm run build` and output directory `dist/client`; use Node.js 24. Add `flaptrials.divii.xyz` to the Pages project's Custom Domains after its first deployment. The included `public/_headers` applies immutable caching to Vite's content-hashed assets and basic response headers.

A Pages-hosted browser cannot start a Node server on the player's computer. For LAN multiplayer, all participants need the host's LAN URL above, which serves both client and server from the host PC. They should not use the public Pages URL to join the LAN room. Cloudflare can host the landing page/game download, while authoritative multiplayer continues to run on the room creator's computer. A future direct Pages-to-LAN connection would need a secure runtime configuration and HTTPS/WSS compatibility on the local host; this setup intentionally avoids that complication.

## If public multiplayer is added later

A persistent Node/Colyseus backend is still required for players outside the host's network. Cloudflare Pages hosts only the client bundle. The current build-time `VITE_SERVER_URL` can point a Pages client at a public HTTPS/WSS backend, but it is not used for the LAN instructions above. The included Dockerfile can run the server on a persistent Node host. Begin with one process because room lookup and room limits are stored in memory. Test WebSocket upgrades, reconnect behavior, TLS and matching client/server versions before release.

Cloudflare documentation: [Pages build configuration](https://developers.cloudflare.com/pages/configuration/build-configuration/), [Pages custom domains](https://developers.cloudflare.com/pages/configuration/custom-domains/), [WebSockets](https://developers.cloudflare.com/network/websockets/).
