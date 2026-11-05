# Race Worlds Implementation Plan

> **For agentic workers:** Use the existing shared simulation and Babylon renderer. The user requested direct implementation and parallel work on maps while the primary agent applies the newly supplied rendering skills.

**Goal:** Nine larger, distinct courses in three escalating difficulty tiers, presented with a consistent toy-like race identity and a compact HUD.

**Architecture:** Shared course recipes own gameplay and course hashes. Instanced playground scenery owns decoration, using the same track frames. The renderer supplies shared plastic materials, local studio lighting, optional FXAA, and one contact-shadow quad. Course selection stays in the existing menu and room flow.

**Tech Stack:** TypeScript, Babylon.js, Colyseus, Vitest, Playwright. Transfer lighting/material/performance principles from the supplied Three.js skills without adding a second renderer.

## Constraints

- Three stages each for Easy, Medium, Hard; every successive stage in a tier is longer and more demanding.
- Preserve existing six course IDs and add Cloud Carnival, Storm Spiral, Crown Circuit.
- Gate geometry follows the shared collision aperture. Decoration stays outside the flight corridor or below the floor.
- Keep deterministic simulation, server authority, quality settings, reduced motion, and touch controls.
- No publication or deployment in this task.

## Tasks

- [x] Primary: implement compact race HUD, concise feedback, and shared rendering enhancements.
- [x] Course agent: author nine versioned recipes and prove reachability with legal inputs.
- [x] Picker agent: group course and room selection into three tiers with three stages.
- [x] Environment agent: supply nine palettes and distinct large landmarks with bounded instancing.
- [x] Primary: integrate styles and course metadata, inspect actual race views, verify switching and touch layouts.
- [ ] Primary: run typecheck/build, unit and relevant browser checks; resolve regressions and record practical limits.

## Review focus

Course-hash agreement between browser/server, all-nine legal-input completion, gate visual/collision alignment, hidden scenery returning after restart, quality toggles, and narrow screens with touch controls.
