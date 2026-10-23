# Phone controls

Touch devices show flight buttons when the race becomes controllable. The left pad turns and pitches; the right controls flap, dive and roll. Each flap tap generates one impulse. Holding Dive or Roll applies it continuously, and separate fingers can steer and flap together. Pointer capture handles releases outside the original button. Opening a menu, cancelling a touch, hiding the page or losing focus clears flight input.

The HUD and canvas adapt to portrait and landscape viewports, dynamic browser height, and display safe areas. Phone help uses touch instructions; the race menu includes Restart practice. Desktop keyboard controls remain available.

Validation on 2026-10-23: 67 unit/integration tests passed, production build passed. Chromium touch emulation exercised simultaneous fingers, cancellation, menus and rotation at 390x844, 320x568 and 844x390. No horizontal overflow or off-screen controls were observed. Physical iOS/Android browser and device-GPU checks are still useful before release.
