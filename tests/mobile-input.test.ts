import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { Controls } from '../client/game/input';
beforeEach(() => { vi.stubGlobal('window', new EventTarget()); vi.stubGlobal('document', new EventTarget()); });
afterEach(() => vi.unstubAllGlobals());
it('combines multiple fingers and only flaps once per press', () => {
 const controls = new Controls(); controls.enabled = true;
 controls.touchStart(1, 'KeyD'); controls.touchStart(2, 'Space'); controls.touchStart(3, 'KeyW');
 expect(controls.read(1, 0)).toMatchObject({steer:1,pitch:1,flapPressed:true});
 expect(controls.read(2, 1)).toMatchObject({steer:1,pitch:1,flapPressed:false});
 controls.touchEnd(2); controls.touchStart(2,'Space');
 expect(controls.read(3, 2).flapPressed).toBe(true);
 controls.touchEnd(1); expect(controls.read(4, 3).steer).toBe(0);
});
it('clears held fingers and queued flaps when menus or app interruption disable flight', () => {
 const controls = new Controls(); controls.enabled = true;
 controls.touchStart(1, 'ShiftLeft'); controls.touchStart(2,'Space'); controls.touchStart(3,'KeyQ');
 controls.enabled = false; controls.enabled = true;
 expect(controls.read(1,0)).toMatchObject({diveHeld:false,flapPressed:false,roll:0});
 controls.touchStart(4,'KeyA'); window.dispatchEvent(new Event('blur'));
 expect(controls.read(2,1).steer).toBe(0);
});
it('ignores input while disabled and preserves another finger holding the same button', () => {
 const controls = new Controls(); controls.touchStart(1,'Space'); controls.enabled = true;
 expect(controls.read(1,0).flapPressed).toBe(false);
 controls.touchStart(2,'KeyE'); controls.touchStart(3,'KeyE'); controls.touchEnd(2);
 expect(controls.read(2,1).roll).toBe(-1);
 controls.touchEnd(3); expect(controls.read(3,2).roll).toBe(0);
});
