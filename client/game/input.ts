import type { InputFrame } from '../../shared/protocol';

export class Controls {
  private keys = new Set<string>();
  private flaps = 0;
  private touches = new Map<number, string>();
  private active = false;
  onEnabledChange = (_enabled: boolean) => {};
  get enabled() { return this.active; }
  set enabled(value: boolean) {
    if (value === this.active) return;
    this.active = value;
    if (!value) this.clear();
    this.onEnabledChange(value);
  }
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
  touchStart(pointerId: number, key: string) {
    if (!this.enabled || this.touches.has(pointerId)) return;
    this.touches.set(pointerId, key);
    if (key === 'Space') { this.flaps = Math.min(2, this.flaps + 1); this.onFlap(); }
  }
  touchEnd(pointerId: number) { this.touches.delete(pointerId); }
  clear() { this.keys.clear(); this.touches.clear(); this.flaps = 0; }
  read(sequence: number, tick: number): InputFrame {
    const held = (key: string) => {
      if (this.keys.has(key)) return true;
      for (const touch of this.touches.values()) if (touch === key) return true;
      return false;
    };
    const steer = Number(held('KeyD') || held('ArrowRight')) - Number(held('KeyA') || held('ArrowLeft'));
    const flapPressed = this.enabled && this.flaps > 0;
    if (flapPressed) this.flaps--;
    return { sequence, tick, steer: this.enabled ? steer as -1 | 0 | 1 : 0, flapPressed, diveHeld: this.enabled && (held('ShiftLeft') || held('ShiftRight')),
      pitch: this.enabled ? (Number(held('KeyW') || held('ArrowUp')) - Number(held('KeyS') || held('ArrowDown'))) as -1 | 0 | 1 : 0,
      roll: this.enabled ? (Number(held('KeyQ')) - Number(held('KeyE'))) as -1 | 0 | 1 : 0 };
  }
}
