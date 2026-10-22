# Flap Trials implementation plan

Spec: the user-approved Flap Trials v1.0 GDD (2026-10-22) and the two root visual references.

Goal: a lightweight, desktop-web, non-elimination multiplayer flight racer with all six courses available.

## Tasks
1. Shared deterministic 60 Hz flight, continuous collision, course definitions and ordered race rules. Verify replay, input timing, swept collisions, checkpoints and finish.
2. Scripted Blender bird and modular obstacle assets, editable sources, exported GLBs and validation. Reference-inspired smooth toy shading, four player colors.
3. Babylon.js scene, WebGPU-preferred engine with WebGL2 fallback, chase camera, keyboard input, practice, HUD and reference-inspired responsive menus. All six courses selectable.
4. Colyseus authoritative rooms, private codes, quick play, ready/loading/countdown, prediction and interpolation, reconnection, placements/results.
5. Browser/integration/load verification, performance instrumentation, deployment configuration and documentation.

## Global constraints
- No accounts, unlocks, elimination, competitive body collisions, stamina or free multiplayer restart.
- Simulation 60 Hz, snapshots 20 Hz, respawn 0.6 seconds; GDD physics defaults; secondary coefficients tuned as configuration.
- 2–8 racers; 10 room/80 racer beta load target, not an unmeasured capacity guarantee.
- Everyday integrated-GPU laptops, 8 GB RAM; adaptive 720–1080p render resolution; selected-course transfer target under 10 MB.
- Host online later with a CDN client and persistent Node/Colyseus server; no cloud provisioning without an actual tested build.

## Review focus
Input burst/repeat and stale races; moving-hazard collision between ticks; early/disallowed finishes; prediction replay cooldown/respawn state; disconnect/slow-loading cleanup; memory and resource disposal across repeated races.
