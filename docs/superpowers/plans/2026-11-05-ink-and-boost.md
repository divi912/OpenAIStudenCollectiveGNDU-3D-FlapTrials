# Ink rendering, geometry cleanup and stored boost

User requested direct implementation with subagents, using the supplied Three.js skills while retaining the game's renderer. Keep product text direct.

## Rendering and geometry

Use dark silhouette outlines on racers, obstacles and major landmarks. Avoid an expensive ink pass on clouds, transparent effects and tiny crowd parts. Keep quality controls, instancing and animated wing transforms working. Audit and correct overlapping/copanar road surfaces, near-coincident balloon shells, stand symmetry and mirrored landmark construction. Preserve the actual flight aperture and floor.

## Boost balance

- Store0–100 reserve; start at60.
- Hold F or the touch BOOST control for +6 target speed, spending25 reserve per second.
- Require15 reserve to begin a burst; allow an active burst to spend the remainder.
- Refill4 per second during normal flight after a1.5-second delay.
- Award6 for a clean mandatory gate once per race; gold pickups add25 reserve instead of automatically spending it.
- Crashes remove25; respawning does not refill the meter.
- Cap combined speed from reserve, diving and events at30.
- Server simulation owns the state; input validation, prediction, replay, schema and versioning must agree.

## Ownership and checks

Rendering agent owns outline helpers and scene integration. Geometry agent owns scenery construction and measurable alignment tests. Boost agent owns shared simulation/schema/input and its tests. Primary owns the meter, help, integration and browser checks.

Check legal completion of all nine courses, reserve depletion/recovery/rewards, replay farming, multiplayer synchronization, narrow/touch layouts, outlined actual race screenshots and production build. These changes are reviewed locally before any new deployment.
