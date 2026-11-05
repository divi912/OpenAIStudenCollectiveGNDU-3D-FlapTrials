# Visual identity and course progression

Updated November 5, 2026.

## Presentation

The menu uses the title **Flap Trials** and direct action labels. Decorative slogans and jokey filler are removed from menus, help, loading, results and race feedback. Courses are grouped as Easy, Medium and Hard, with three ordered stages per tier.

The toy-like palette continues into every race: bright gates, smooth plastic surfaces, track-aligned floor sections and large landmarks. The HUD retains time, place, checkpoint progress, gate distance, active powers and event notices. It removes permanent control reminders and decorative paragraphs. Touch controls and reduced motion remain supported.

## Rendering

The project remains on Babylon.js. The supplied Three.js lighting, materials, post-processing and performance skills inform transferable techniques:

- A local 16px cube environment provides soft studio fill without external downloads.
- Shared nonmetallic PBR plastic materials use moderate roughness and restrained clearcoat; color inputs are converted to linear space.
- One gradient contact-shadow quad follows the local bird. Its height and the visible track derive from the collision floor.
- FXAA smooths rendered edges and detaches on Low quality.
- Repeated scenery uses instancing, static track transforms are frozen, distant chunks are culled, and the existing audience LOD remains active.

## Courses

| Tier | Stage 1 | Stage 2 | Stage 3 |
| --- | --- | --- | --- |
| Easy | Skyline Sprint — 1,280 m | Cloud Carnival — 1,440 m | Crosswind — 1,600 m |
| Medium | The Needle — 1,760 m | Clockwork — 1,920 m | Terminal Velocity — 2,080 m |
| Hard | Featherless — 2,240 m | Storm Spiral — 2,400 m | Crown Circuit — 2,560 m |

Lengths, typical opening clearance, cadence and hazard counts progress within each tier. Course layouts are version4.0.0; saved records are already keyed by course version. Original six identifiers remain, with three new identifiers. Every course completes with the unchanged legal-input pilot, including without pickups. This demonstrates reachability; difficulty and flight feel still benefit from human playtesting.

Landmarks include ring plazas, balloon pavilions, pinwheels, spools, cog towers, launch decks, wing towers, storm coils and crown platforms. Decorative props stay outside the flight corridor. Gate frames retain the shared collision aperture.

## Verification

Unit/integration tests cover all-nine progression, hashes, collision geometry and legal-input completion. Browser checks cover all-nine rendering and switching, tier selection at320px through desktop, touch rotation, saved quality/motion settings, delayed model startup in two clients, and a shared room selecting all nine courses before starting Crown Circuit. Screenshots in`.cache` come from the actual renderer. Automated rendering checks are not sustained hardware performance benchmarks.


## Comic outlines and geometry repair

The local ink-and-boost pass adds depth-tested world-space outlines to birds, gates and major solid scenery. It keeps the existing instanced Babylon rendering and supplies equivalent GLSL/WGSL outline math for nonuniform transforms. Low quality disables landmark ink; birds and gameplay gates retain it. Clouds, shields and tiny crowd parts do not gain another outline pass. PBR surfaces now use a more matte response.

Track decks are indexed ribbons with shared chunk endpoints, replacing overlapping boxes. The visible top still matches the collision floor. Balloon pavilions have one hull, stands sit clear of landmarks, center braces are upright, end flags mirror, and directional motifs mirror across their local center. Geometry tests cover all nine courses in multiple curved sections.

Stored boost uses the rules in README and shared physics. Client/server protocol4 is required. A complete boost tank lasts4 seconds; actual human balance needs playtesting. All nine legal-input completion tests still pass without needing boost. This local pass is not yet published.


## Floating HUD and anti-aliasing

Race panels have no visible containers. Fredoka text and dark text strokes preserve contrast over the world, with permanent practice/place/checkpoint labels removed. Only the course, timer, place, boost and progress remain; event text appears only during an event. Touch controls also use floating glyphs with pressed-color feedback.

High quality renders at1.5× CSS resolution (bounded to2880×1800), requests up to8× MSAA where supported, and applies FXAA after resolving the scene. Adaptive starts at1.25× and4× MSAA, retaining the existing dynamic-resolution response. Low omits the extra post-process. Sample counts are capped by the device; sustained performance varies by GPU.
