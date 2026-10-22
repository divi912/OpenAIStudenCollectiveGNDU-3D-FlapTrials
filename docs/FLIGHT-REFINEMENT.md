# Curving flight and cockpit refinement

User intent: retain flappy rhythm and party multiplayer while making the bird turn, pitch and twist through genuine 3D course layouts. They selected arcade flight on curving courses, with A/D turns, W/S pitch, Q/E roll, Space flap and Shift dive. Refine menu and race GUI symmetry, raise clouds, add informative instruments and comic feedback.

## Flight and course design

Automatic travel follows an arc-length course centerline with sweeping yaw and gentle climbing/descending bends. Shared race state remains in track coordinates so authoritative progress/checkpoint rules stay reliable. Convert track positions and orientations into world space for scenery, birds, hazards and camera. Turning changes heading and travel; pitch changes the flight vector; flaps act along the bird's up direction, so rolls affect lift. Returning the controls eases the bird toward level flight. Camera follows curves with a stable horizon and no forced roll.

Use the same body sphere and two small wing clearance probes for every bird. Orientation therefore changes real clearance through narrow twist slots, rather than merely animating the mesh. Swept probes include angular travel. Shields still cannot bypass the mandatory opening. Safe respawns reset all orientation. Tuning retained a 45% baseline arcade lift when fully banked, blended with the orientation-dependent lift, so discrete flaps can sustain a bank through a tunnel; fully realistic sideways lift made the short party courses unnecessarily punishing.

Revise all six courses: Skyline introduces broad banked gates and forgiving roll slots; Needle has narrow alternating slots; Crosswind combines banked slaloms and wind; Clockwork uses rotating twist windows; Terminal mixes pitch climbs/dives and banked slots; Featherless combines helix alignments, twist slots and tight compound sequences. Preserve recovery space around checkpoints. Course/protocol/physics versions change together.

## Interface and effects

Use aligned three-column top and bottom cockpit bands, paired side panels, consistent card sizes and one spacing scale. Show time, place, progress, next gate/distance/roll guidance, speed, altitude, climb, roll/pitch instruments, powers, upcoming chaos, bonks, clean streak and trick style. Keep the center flight space clear except target guidance and brief comic stamps. Menus lose randomly rotated decorative labels and gain consistent alignment.

Comic cues include crash starbursts/feathers, near-miss and streak stamps, barrel-roll callouts and power effects. Reduced Motion suppresses decorative motion and keeps the horizon steady. Clouds move above the arena with varied sizes and heights, clear of racing sight lines.

## Implementation and verification

1. Add shared path/frame transforms, angular input/state and orientation-aware sweeps. Test turning, pitch, roll clearance, reverse invalid inputs, reset and replay.
2. Re-author every course and update the legal-input pilot to control angular flight. Complete each course in simulation.
3. Map the Babylon world and camera onto the new path; raise clouds and add readable twist gate markings and effects.
4. Replace the HUD with the aligned cockpit, update help/menus/results and show comic feedback from validated state changes.
5. Verify protocol/input synchronization, two-browser races, keyboard controls and HUD layout at desktop sizes, screenshots, production build and asset checks. Request final review and fix material findings.

## Verification outcome

52 unit/integration tests and 7 browser tests pass. Every final course completes using legal controls within its authoritative timeout: Skyline 52.6s, Needle 108.6s, Crosswind 92.7s, Clockwork 100.7s, Terminal 122.1s and Featherless 111.1s in the deterministic local pilot run. These demonstrate reachability, not human difficulty ratings. Browser tests cover physical pitch/roll input, paired panel alignment at 1440×900 and 1280×720, saved Reduced Motion effects, two-browser startup and party events. Babylon quaternion orientation is tested against the shared wing collision probes. Reviewer findings on partial-bank trick scoring and moving-gate guidance clocks were reproduced with failing tests and fixed; in-app Reduced Motion now reaches CSS too.
