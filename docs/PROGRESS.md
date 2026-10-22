# Execution ledger — plan: docs/PLAN.md

- Setup: empty directory with two reference PNGs, no prior repository or app. Initialized feat/flap-trials in the requested directory; no existing branch requires isolation.
- Pre-flight: simulation is shared by practice, server and prediction. Course instances are immutable; graphics never decide race outcomes. Asset generation is build-time only.
- Task 1: complete — 18 passing flight, collision, course-integrity and room-lifecycle tests.
- Task 2: Blender 4.5.14 LTS portable available locally. Editable sources and validated small GLBs generated. Runtime axes normalized during export.
- User steering: added Screenshot_20261022-181304.png as optional world reference. Use chunky green pipeways, floating grassy brick islands, clouds and distant block skyline; preserve approved race mechanics.
- User steering: replace Three.js with Babylon.js and prefer WebGPU. Ruling: initialize Babylon WebGPU where available and retain WebGL2 fallback — integrated-laptop compatibility and headless verification require both paths. Existing GLB/physics/server work is engine-independent.
- Task 3: in progress.
- Tasks 3–4: implemented and browser verified: landing/menu, controls/settings, six-course practice, keyboard edge input, chase camera, collision cues, private create/join/ready/shared countdown. Playwright 3/3 passing; Vitest 25/25 including all-six-course legal-input completions. WebGL2 measured 18 course draw calls/~23k active triangles in the initial scene; these are local measurements, not hardware guarantees.
- Task 5: first 80-client/10-room/30-second real-transport load test passed (144,240 input frames); extended 70-second run follows. No public hosting provisioned.
- Ruling: mandatory gates use a validated aperture crossing as well as solid-frame collisions; going around a floating frame produces a distinct missed-gate cue and checkpoint reset. This prevents trivial course bypass without turning frames into opaque walls.
- Ruling: use direct @colyseus/core/tools/transport packages rather than the umbrella package. This removes unused auth/editor/Redis dependencies; npm production audit reports zero vulnerabilities.
