# Local verification — 2026-10-22

## Evidence

- Shared-simulation tests cover discrete flaps/cooldowns, dive caps, render grouping independence, exact swept sphere/box clearance, thin-wall tunneling, mandatory gate crossing, ordered checkpoints, 36-tick respawns, and rejection of premature finishes.
- Each of the six authored courses has been completed in simulation by a legal-input flight controller. The controller uses the same public flap/steer/dive inputs and never changes positions or bypasses collisions.
- Browser tests cover the actual Babylon WebGL2 scene, six-course selection, menus/settings, practice controls, crash/reset behavior, and two browsers creating/joining/readying/starting the same authoritative race.
- Real-transport integration runs a separate Colyseus server with 250 ms simulated RTT to exercise authority, reconnecting the same racer, and retaining voluntary race departures as DNF.
- Production client/server builds and generated GLBs are validated by the included commands. The assets include editable Blender sources. `npm audit --omit=dev` reports zero vulnerabilities at verification time.
- Final checks: **32 tests across 7 files**, **4 Playwright browser tests**, type checking, asset validation and production build pass. Regression coverage includes Babylon frame submission, accepting new joins after a rematch, a guest whose models load after joining, and finish crossings that precede a collision within the same tick.

## 80-client load run

Executed the actual Colyseus server and SDK clients locally for **70 seconds**, with **10 private rooms × 8 racers**. All 80 racers completed Skyline Sprint and all 10 rooms reached results. This exercised **336,400 input frames**.

Across sampled room windows, maximum per-room p95 simulation work was **0.064 ms**, maximum pending server input queue depth was **3**, and sampled server RSS peaked at **212 MB** and plateaued around 208–212 MB. This timing measures the simulation callback, not total server/network/OS work. The raw report is `.cache/loadtest.json` (generated, not versioned).

This is a local capacity smoke test, not a one-hour soak, production concurrency guarantee, or an internet packet-loss test.

## Rendering

The final production build was opened in automated Chromium. With no WebGPU adapter available it selected WebGL2, displayed both menu and practice correctly, and logged no page errors. The initial course measured **18 draw calls / 26,920 active triangles** with the Blender pipe meshes. This software-rendered run measured about **30 FPS** in practice; it does not establish the 60 FPS target on desktop hardware. The scene contains more active instances than draw calls because geometry/material batches are instanced. F3 displays live counters for the current scene.

WebGPU-first initialization and self-hosted compiler resources are implemented. The headless browser in this environment reports **no available WebGPU adapters**, so end-to-end WebGPU rendering on a real GPU remains unverified. The default startup successfully selected the WebGL2 fallback under that condition.

## Before a public release

- Profile WebGPU and WebGL2 on an Intel Iris Xe-class or comparable integrated-GPU laptop with 8 GB RAM, plus current Chrome/Edge and Firefox. Check browser/device-loss recovery and camera clipping through all courses.
- Run a longer server soak and internet tests with jitter and actual packet loss. The 250 ms RTT test adds deterministic transport delay; it does not emulate TCP congestion or retransmission.
- Playtest difficulty and the secondary tuning coefficients with people. Legal-input completion proves reachability, not enjoyable difficulty.
- Connect the chosen frontend/backend hosting accounts, select the lowest-latency available Asia region for beta players, configure HTTPS/origins, deploy matching versions, and confirm caching and rollback.

No hosting account has been provisioned or public deployment performed.
