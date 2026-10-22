import type { InputFrame } from '../../shared/protocol';

export class Controls {
  private keys = new Set<string>();
  private flaps = 0;
  enabled = false;
  onFlap = () => {};
  onRestart = () => {};
  onMenu = () => {};
  constructor() {
    window.addEventListener('keydown', e => {
      if ((e.target instanceof HTMLInputElement) || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return;
      if (e.code === 'Escape' && !e.repeat) { this.onMenu(); return; }
      if (!this.enabled) return;
      if (['Space', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'ShiftLeft', 'ShiftRight', 'KeyA', 'KeyD', 'KeyW', 'KeyS', 'KeyQ', 'KeyE'].includes(e.code)) e.preventDefault();
      this.keys.add(e.code);
      if (e.code === 'Space' && !e.repeat) { this.flaps = Math.min(2, this.flaps + 1); this.onFlap(); }
      if (e.code === 'KeyR' && !e.repeat) this.onRestart();
    });
    window.addEventListener('keyup', e => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.clear());
    document.addEventListener('visibilitychange', () => this.clear());
  }
  clear() { this.keys.clear(); this.flaps = 0; }
  read(sequence: number, tick: number): InputFrame {
    const steer = Number(this.keys.has('KeyD') || this.keys.has('ArrowRight')) - Number(this.keys.has('KeyA') || this.keys.has('ArrowLeft'));
    const flapPressed = this.enabled && this.flaps > 0;
    if (flapPressed) this.flaps--;
    return { sequence, tick, steer: this.enabled ? steer as -1 | 0 | 1 : 0, flapPressed, diveHeld: this.enabled && (this.keys.has('ShiftLeft') || this.keys.has('ShiftRight')),
      pitch: this.enabled ? (Number(this.keys.has('KeyW') || this.keys.has('ArrowUp')) - Number(this.keys.has('KeyS') || this.keys.has('ArrowDown'))) as -1 | 0 | 1 : 0,
      roll: this.enabled ? (Number(this.keys.has('KeyQ')) - Number(this.keys.has('KeyE'))) as -1 | 0 | 1 : 0 };
  }
}
