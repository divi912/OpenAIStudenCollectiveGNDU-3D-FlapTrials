# Model polish verification � 2026-10-23

- Fixed reversed triangle winding in custom spheres, rings and bevelled frames for Babylon's default left-handed scene. Normalized averaged gate seam normals. Three new regressions check finite positions, unit normals, nondegenerate faces and winding; existing all-course aperture-clearance test also passes.
- Added bird goggle temples/brass rivets, nostrils and a leather harness backplate. Regenerated bird and LOD GLBs and editable Blender sources using portable Blender 4.5.9. Main: 53,416 triangles / 1,262,440 bytes. LOD: 12,812 triangles / 311,788 bytes. Both retain five meshes and wing/beak pivots.
- Added tree branches, layered waterfall sheets/spray and balloon basket struts/rim. Existing instancing and chunk visibility remain.
- Reduced Motion browser assertion now retries the current locator's computed CSS instead of doing a separate one-shot style read on a short-lived cue. Product behavior is unchanged.
- Final verification: **58 unit/integration tests passed**, typecheck and production build passed, asset validation passed, diff whitespace check passed. **9 browser tests passed** in 53.2s with Chromium's D3D11 backend against the local development server on port 5174. Initial concurrent software-rendered run had four timing/navigation failures; the clean hardware run passed all nine.
- Production screenshots captured for home and all six course openings with no page errors. Adapter reported `ANGLE (AMD, AMD Radeon(TM) Graphics, Direct3D11)`. At 1440x1050, sampled FPS were Skyline 60, Needle 60, Crosswind 60, Clockwork 60, Terminal 59, Featherless 56. Active triangles ranged from 912,764 to 946,920; crowd used 6 draw calls. These are brief opening-scene samples, not sustained full-course benchmarks. Software rendering reported 2�4 FPS and must not be confused with these hardware results.
- Independent code review found no actionable correctness issues. Remaining coverage: sustained full-course performance, distant/moving gate close-ups throughout each course, and WebGPU validation. No public deployment or gameplay changes.
- Local evidence: `.cache/hardware/report.json`, `.cache/hardware/*.png`, `.cache/hardware-e2e.log`, `.cache/unit-polish-final.log`, `.cache/build-polish.log`. Re-run hardware tests using `npx playwright test --config .cache/playwright.hardware.config.ts` while the dev client is on port 5174 and game server on 2567.

---

# Local verification — 2026-10-22

## Minimal HUD, solid audience and soundtrack

- **54 unit/integration tests and 9 browser tests** pass. Browser checks cover the simplified HUD, working flight/rooms, actual GPU-instanced birds, lower crowd cost on Low quality, repeated practice restarts, independent persisted music mute, browser audio unlock and the rendered music waveform. A focused layout check verifies that two active power badges clear the progress card at 1440, 1280 and 780px widths.
- The new Blender models have **278 triangles / 8,764 bytes** near and **94 triangles / 4,136 bytes** far, each one vertex-colored primitive with no textures, skeletons or animation. Combined gzip size is approximately **5.5 KB** using the existing production HTTP compression. Static thin-instance buffers render a stand in one draw without per-bird JS objects. Nearby stands use 104 birds; distant/Low quality uses 52, with frustum/chunk/distance culling. Quality switching and LOD hysteresis are handled explicitly.
- **Wing Cup Weekend** is an original 132 BPM, 16-bar instrumental rendered once through OfflineAudioContext, then looped by one source. It adds no music-file transfer or per-frame note scheduling. The stereo 22,050 Hz buffer lasts 29.09s and uses about 5.13 MB. Browser waveform verification checks headroom, nonzero signal and loop continuity; a short percussion attack fixes a measured hi-hat discontinuity at the boundary. Music and effects have separate saved levels; hidden tabs suspend audio.
- Review caught inherited positioning that could overlap power badges with the new footer, and an Adaptive-to-High switch retaining low audience detail. Both were corrected. The existing real-GPU/WebGPU and human-listening performance/feel limits still apply: a software-rendered browser cannot certify lag-free hardware performance or subjective musical taste.

## 3D flight and cockpit refinement

- **52 unit/integration tests and 7 browser tests** pass, along with type checking, production build and asset validation. New coverage includes heading/pitch motion, real roll-dependent slot clearance, angular reset/replay, full-roll scoring without partial-bank farming, path/frame orthonormality, and exact agreement between Babylon quaternion orientation and shared wing probes.
- Every final course completes with legal controls **within the real authoritative timeout**. Local deterministic pilot times: Skyline 52.6s; Needle 108.6s; Crosswind 92.7s; Clockwork 100.7s; Terminal 122.1s; Featherless 111.1s. The pilot uses pitch/roll/turn/flap inputs, never changes positions and does not bypass collision. These are route-reachability results, not human difficulty/comfort ratings.
- Browser checks verify actual W/Q keyboard motion, matching top/bottom cockpit card geometry at **1440×900 and 1280×720**, both saved Reduced Motion and comic stamp behavior, all-six-course Node/Chromium hash equality, two-browser race startup, practice reset and party events. Fresh screenshots were inspected for the balanced cockpit, elevated clouds and comic effects.
- A fresh production-server **70-second, 80-racer, 10-room** run sent **336,560 input frames**, and **all 80 racers finished** the revised Skyline course. Maximum sampled per-room p95 simulation callback was **0.164 ms**, pending queue depth **4**, server RSS **199 MB**. This includes angular flight and swept wing probes; it remains a local capacity test rather than an internet/long-soak guarantee.
- Final review caught partial-bank trick scoring, different clocks for HUD moving-gate guidance versus rendered hazards, and the app preference not reaching comic-animation CSS. These are fixed with regressions. Stopwatch elapsed time remains separate from the predicted hazard time used by rendering, reticle and guidance.
- The browser environment still lacks a WebGPU adapter. WebGL2 rendering is exercised; real-GPU WebGPU performance and human motion-comfort testing remain external validation. Earlier sections below preserve baseline evidence from prior versions.

## Party/stadium upgrade

- **43 unit/integration tests** pass, including shaped-aperture clearance, rejecting circle-corner bypasses, distinct circle/oval proportions, event warnings and physics, one-time pickup collection, shield boundaries, boosted speed-zone interactions, and all-six-course legal-input completion.
- **5 Playwright tests** pass, including real Node/Chromium course-hash agreement for all six maps, delayed model startup in a two-browser race, and the first party warning/active event. Authoring coordinates are quantized to six decimal places after a real Chromium/Node `Math.sin` rounding difference was found to change the original raw JSON hash.
- Updated Blender assets validate: 442 KB / 18,616 triangles for the close-up bird; 145 KB / 5,954 triangles for the racing LOD; 38 KB / 976 triangles for the pipe kit. Editable sources are included. Lowering foliage geometry and introducing the bird LOD reduced the first detailed scene from roughly 369k active triangles to roughly 108k.
- Fresh production-browser inspection confirms the cone mountains are absent and instanced spectator rows, five-tier grandstands, canopies and banners render. The initial stadium scene measured approximately **59 draw calls / 108k active triangles**, with about **17 FPS on this headless software-rendered run**. This is not the real-hardware 60 FPS target. The available browser again selected WebGL2 because no WebGPU adapter was available. No page errors were logged.
- A new **70-second / 80-client / 10-room** party-version load run sent **336,640 input frames** and all **80 racers finished**. Maximum sampled per-room p95 callback work was **0.090 ms**, pending queue depth **6**, RSS **231 MB**. The final circle/oval proportion refinement was made after that capacity run; the final six-course simulation tests cover those shapes.
- Fresh code review found the boosted speed-zone interaction and identical circle/oval proportions. Both were reproduced with failing tests and corrected. Production build/type checking/asset validation pass. The original verification below is retained as baseline evidence.

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
