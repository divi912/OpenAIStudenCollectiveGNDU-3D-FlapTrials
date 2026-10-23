# Visual/modeling upgrade handoff

Status: **resumed and polished**, 2026-10-23. Geometry fixes and model/scenery details are implemented; see VERIFICATION.md for current checks and remaining long-course/WebGPU coverage. The last completed gameplay/HUD/music checkpoint is `c494f16`.

## User direction

The game still looked too low-poly. Add visible detail across birds, obstacles, audience and the wider environment, accepting a higher visual budget while retaining sensible optimization. Keep the simplified HUD and existing race mechanics.

## Implemented in this checkpoint

- `scripts/models.py`: smoother main bird; more back/wing feathers, shafts, harness stitching and badge. Higher-detail racing LOD. Smoother pipe kit and a bevelled `RoundedPanel` prop.
- `scripts/audience.py`: smooth close audience bird, eye highlights, layered wing feathers; cheaper distant model. One vertex-colored mesh per model, no separate textures or skeletons.
- `client/game/scene.ts`: local racer uses the full bird model; rivals use the smaller one. Richer lighting contrast, smoother shapes, material maps, continuous gate frames and additional fittings.
- `client/game/scenery.ts`: seat backs, rails, lanterns, roof ribs, braces, denser tree crowns and broken rocky island skirts.
- `client/game/gate-shell.ts`: bevelled, extruded frames built outward from the shared aperture contour. `tests/gate-shell.test.ts` checks that their vertices stay outside the opening and front normals face toward approaching racers.
- `client/game/sphere.ts` and `ring.ts`: separate radial/longitudinal geometry budgets with analytic normals.
- `client/game/surfaces.ts`: shared 256px procedural enamel, stone and foliage diffuse/normal textures.
- `client/game/audience.ts`: Adaptive can reduce spectator density while preserving the smooth nearby model. Explicit Low uses the cheaper distant model. Existing per-stand batching and distance culling remain.

## Current exported assets

| Asset | Triangles | Approximate raw GLB size |
| --- | ---: | ---: |
| Main bird | 53,416 | 1,233 KB |
| Racing bird LOD | 12,812 | 304 KB |
| Obstacle kit | 1,612 | 64 KB |
| Near audience bird | 2,006 | 50 KB |
| Far audience bird | 322 | 9 KB |

The matching editable `.blend` files are committed in `assets/source/`; runtime models are in `public/models/`. Earlier README/verification sections describe older, smaller assets and historical measurements. The table above describes this unfinished pass.

Regenerate with Blender 4.5 LTS installed, `BLENDER_BIN` set, or portable Blender extracted under `.tools/blender`:

```sh
npm run assets:build
npm run assets:check
```

Blender is not required to run the committed game. Generated GLBs are included; build-time Blender tools are not shipped to the browser.

## Original handoff checklist (historical; current results in VERIFICATION.md)

1. **Review geometry and lighting in close-up.** Check front/back culling and normals for the custom ring, sphere and bevelled frame. Inspect every opening shape and moving gate. Check UV seams, normal-map direction and lighting on scaled surfaces. The frame regression passes, but a full visual review is unfinished.
2. **Resolve the Reduced Motion browser assertion.** Latest run: eight browser tests have no recorded failures; `tests/e2e/game.spec.ts` Reduced Motion check received an empty computed `animationName` instead of `none`. Investigate whether the comic stamp is replaced/detached between visibility and style reads before changing product behavior. This also occurred intermittently before this pass.
3. **Profile real hardware and tune detail distance.** Early headless WebGL2/SwiftShader snapshots were expensive (roughly 0.87–1.27 million active triangles before the final sphere optimization, around 3–8 software-rendered FPS). Those are not hardware benchmarks. Verify the latest custom sphere reduction, near/far crowd boundaries, density and decorative geometry cost on an actual GPU. Keep close-up detail; reduce unseen/far work first. Real WebGPU validation remains outstanding.
4. **Finish visual polish across all six courses.** Inspect bird close-ups, curves, twist tunnels, stage structure, islands and waterfalls. Check gate silhouette/readability at racing speed and confirm decoration never implies a smaller clear opening.
5. **Complete final validation and update docs.** Run the commands below, inspect fresh production screenshots and update README/VERIFICATION with final budgets and measured results. The production build has not been reverified after the last geometry edits in this checkpoint.

```sh
npm run typecheck
npm test
npm run assets:check
npm run test:e2e
npm run build
```

At pause, **55 unit/integration tests pass**, including all-course route tests and the new frame-clearance regression. Do not repeat gameplay changes as part of this art pass. No public deployment was requested.
