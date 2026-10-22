# Flap Trials

Tiny wings. Big trials. A keyboard-controlled multiplayer party flight racer in a floating bird stadium.

## Run locally

Requires Node.js **22.12+** (Node 24 recommended).

```sh
npm ci
npm run dev
```

Open **http://localhost:5173**. Vite serves the client on port 5173 and the authoritative Colyseus server runs on port 2567. Both bind to the local network, so a friend on the same LAN can open your machine's IP address on port 5173. Allow these ports through the host firewall if needed.

Choose **Solo practice** for an immediate offline race. To race together, use **Create a room**, share its six-character code, join from another browser, ready up, and let the host start. **Let's race** joins the public queue, which starts a 15-second preparation timer once two players are ready.

| Key | Action |
| --- | --- |
| Space | One upward flap per press; holding does not repeat |
| A / D or left/right arrows | Turn the bird's heading |
| W / S or up/down arrows | Pitch up/down |
| Q / E | Roll left/right; release to ease upright |
| Shift | Dive |
| R | Restart solo practice |
| Esc | Open/close settings; online races keep running |
| F3 | Toggle rendering/network diagnostics |

Fly through every solid gate, then the golden checkpoint flags. Missing a mandatory gate also returns you to the previous checkpoint. Wind and golden jetstream zones are non-solid. Crashes take 0.6 seconds to respawn, and the clock keeps running. Every bird has the same hitbox and cannot collide with other racers.

The 3D flight revision follows **curving, climbing centerlines** through the stadium. Turning changes the heading and travel vector; pitch aims the nose; roll changes lift and the clearance of the wings. Discrete flaps remain necessary. Automatic leveling and a small baseline arcade lift keep banked flight manageable. All birds share the same body sphere and two swept wing probes; cosmetics do not change clearance. Coral twist slots reward banking, and narrow angled tunnel sequences require coordinating pitch, roll and flap timing. Respawns reset heading, pitch and roll.

The minimal race HUD keeps time, placement, flock standings, next-opening guidance and centered course progress. Active powers appear in a small strip only while equipped. Speed/telemetry, pitch/bank instruments and the points panel have been removed. Full barrel rolls and clean gates still earn comic effects and results-screen style stats. **Validated finish time determines placement.** Reduced Motion also suppresses comic stamp animations.

An original upbeat 132 BPM instrumental, **Wing Cup Weekend**, starts after the first interaction. It is synthesized once into a seamless 29-second loop and then uses a single audio source during play, with no music download or live note scheduling. Settings has separate saved music and sound-effect volume controls; zero mutes music. Audio suspends while the tab is hidden.

The party upgrade adds circular, oval, triangular, diamond, hexagonal and rectangular gates in tighter sequences. Gold crystals grant **2.5 seconds of Rocket Boost**; blue crystals grant a **4-second Bubble Shield** that forgives frame scrapes while still requiring a valid opening crossing. Pickups are personal to each racer, collected once per race, and active powers clear on a crash.

Starting 12 seconds into the race, a three-second warning announces a shared event. **Turbo Flock** gives everyone a tailwind, **Moon Wings** lowers gravity, and **Wild Winds** adds lateral gusts. Events last seven seconds with recovery gaps between them. All phases use authoritative race ticks, including in client prediction. Solo practice uses the same rules.

## Renderer and assets

**Babylon.js 9.32** initializes **WebGPU first** when the browser exposes a supported adapter, falling back to WebGL2. WebGPU requires a secure context (HTTPS or localhost) and supporting browser/driver. `?webgl=1` explicitly selects WebGL2 for comparison. Shader compiler assets, fonts and models are served locally; no runtime Babylon CDN connection is needed.

The renderer uses shared geometry, instancing, course-section visibility, pooled effects, simple lighting, and adaptive resolution. Graphics settings never change simulation speed. The simulation runs at 60 Hz; the server publishes state at 20 Hz. The close-up Blender bird has **18,616 triangles**, while racing birds and smaller menu birds use a **5,954-triangle LOD**. Both retain five meshes and animated wings. The obstacle kit is 976 triangles.

Floating grandstands replace the cone mountains and flat runway. Five-tier seating, canopies, banners, thrusters, clouds, garden islands, waterfalls and balloons frame the course. Spectators are solid Blender bird models with beaks, eyes, folded wings, tails and crests. GPU thin instances batch each stand into one draw, with static buffers, vertex colors, no textures/rigs/shadows and no per-bird JavaScript objects. Near birds use 278 triangles; distant birds use 94. Distance LOD, culling, lower crowd density and adaptive quality keep the cost bounded. Both models together total about 13 KB raw, with existing production HTTP compression reducing transfer further. Each course has its own palette. Gate visuals and swept collision share the same polygon boundary and moving pose.

Editable assets are in `assets/source`, including `audience.blend` and `audience-lod.blend`. Runtime GLBs are in `public/models`. Blender is **not required to run or build the game**; generated GLBs are included.

To regenerate models, install Blender LTS, set `BLENDER_BIN` to its executable, or extract portable Blender beneath `.tools/blender`:

```powershell
$env:BLENDER_BIN = 'C:\Program Files\Blender Foundation\Blender 4.5\blender.exe'
npm run assets:build
npm run assets:check
```

The asset generator uses Blender's Python interface without external add-ons. An interactive Blender MCP connection is optional. The three PNG design references in the root directory are development references and are not shipped to browsers.

## Courses and architecture

All six courses are open immediately: Skyline Sprint, The Needle, Crosswind, Clockwork, Terminal Velocity, and Featherless. Every map now has its own turning/climbing path, tilted gates and roll-slot challenges. Needle, Clockwork and Featherless add multi-stage twist tunnels; Terminal emphasizes pitching climbs/dives; Crosswind combines banks with gusts. A user-facing course editor remains future work.

- `shared`: course validation/compilation, track frames/world transforms, deterministic angular flight, swept body/wing collision, protocol, schema, ranking.
- `client`: Babylon scene, local prediction/reconciliation, remote interpolation, menus, HUD, keyboard controls and synthesized audio.
- `server`: authoritative rooms, matchmaking, lobby/loading/countdown/race/results lifecycle, reconnection and race validation.
- `scripts`: Blender generation, asset validation, browser inspection and legal-input load-test pilots.

Clients send inputs, never positions or finish times. Race ID, protocol version, physics version and course hash prevent incompatible state. Prediction includes cooldown, crash and respawn state. Moving hazards are functions of race ticks. Server-validated sub-tick finish crossings resolve close finishes; identical crossing times share a place. Personal bests stay on the device, keyed by mode/course/physics version.

Private races need 2–8 ready players. Loading times out after 30 seconds. Unloaded players are removed before countdown, and races with fewer than two participants return to the lobby. Unexpected race disconnects allow 10 seconds to reconnect; neutral flight continues, then the racer receives DNF. Race timeout is `max(180, estimatedClearSeconds + 90)` seconds. Lobby ownership transfers when the host leaves. Rematches preserve the room code and reset all flight state.

## Verification

```sh
npm test                 # Physics, collision, lifecycle, input validation, all-six-course playability
npm run typecheck
npm run test:e2e         # First run: npx playwright install chromium
npm run assets:check
npm run build
npm run loadtest         # Requires the local game server; default 10 rooms × 8 racers × 30 seconds
```

Load-test options in PowerShell:

```powershell
$env:ROOMS='10'
$env:RACERS='8'
$env:DURATION='70'
npm run loadtest
```

Load tests submit real legal input frames; they do not teleport racers or bypass server rules. The JSON report is saved to `.cache/loadtest.json`. `/health` reports active rooms, racers, server memory and per-room simulation timing/queue depth. `?debug=1` enables client diagnostics. `node scripts/inspect.mjs` saves home/race screenshots to `.cache`.

Local browser and load tests are engineering checks, not a guarantee of 60 FPS on every integrated GPU or a production capacity claim. See `docs/VERIFICATION.md` for measured results and remaining hardware/network validation.

## Production

```sh
npm run build
npm start
```

The Node server serves the production client at **http://localhost:2567**. Build output is separated into `dist/client` and `dist/server`.

For separate hosting, set **`VITE_SERVER_URL` before building** to the HTTPS address of the persistent multiplayer server. Cloudflare Pages can deploy `dist/client` using `npm ci && npm run build`. Use a persistent Node service or Colyseus Cloud for the backend; static hosting alone cannot host authoritative rooms. A Dockerfile and PM2 configuration are included. `PORT` defaults to 2567, `CLIENT_ORIGIN` defaults to `*` (set to the client origin for production), and `MAX_ROOMS` defaults to 10.

Use one process initially. Room-code lookup and room limits are process-local; multiple processes require shared room discovery/presence and admission control before scaling. Existing races are ephemeral and are lost on server restart. Drain active rooms before deploying; deploy matching client/server versions together. Keep the previous compatible deployment available for rollback. No account system, database, Redis service or paid model-generation API is needed for the single-process beta.

No cloud account or public deployment has been created by the local implementation.

## Third-party licenses

Babylon.js: Apache-2.0. Colyseus: MIT. Fredoka and Manrope fonts: SIL Open Font License; license files are included with the fonts. WebGPU shader compiler files are copied from the installed Babylon package by `postinstall`.
