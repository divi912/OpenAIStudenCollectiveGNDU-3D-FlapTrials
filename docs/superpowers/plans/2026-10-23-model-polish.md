# Model polish implementation plan

Goal: finish the approved existing visual style described in docs/MODELING-UPGRADE.md.
Architecture: preserve shared collision geometry and current model interfaces; improve authored and instanced decorative meshes. Babylon.js, TypeScript, Blender Python.

- [x] Review custom sphere/ring orientation and lighting with numerical regressions and browser screenshots.
- [x] Polish birds and environment using existing palette and mesh batching; regenerate authored assets if Blender is available.
- [x] Repair the detached comic-stamp Reduced Motion assertion without changing gameplay.
- [x] Run geometry, asset, type, unit, browser and production checks; document limitations and current budgets.

Review focus: inside-out faces; gate clearance; animated wing pivots; crowd cost; detached DOM style reads.
Ruling: work in the user's requested C: checkout on a feature branch so npm start uses the updated artifacts. Preserve pre-existing vendor changes. Hardware results require a real adapter and must not be inferred from SwiftShader.

Outcome: 58 unit/integration and 9 hardware browser tests pass; assets and production build pass. Opening screenshots for six courses reviewed. Full-course and WebGPU coverage remain explicitly documented in VERIFICATION.md.
