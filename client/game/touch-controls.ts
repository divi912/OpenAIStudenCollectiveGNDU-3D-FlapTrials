import type { Controls } from './input';

export const touchDevice = matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;

/** Pointer capture keeps independent fingers held until release, even outside the button. */
export function mountTouchControls(controls: Controls, parent: HTMLElement) {
  document.body.dataset.touch = String(touchDevice);
  const root = document.createElement('div');
  root.className = 'touch-controls'; root.hidden = !controls.enabled;
  const button = (key: string, label: string, text: string, cls = '') =>
    `<button type="button" data-flight-key="${key}" aria-label="${label}" class="touch-key ${cls}">${text}</button>`;
  root.innerHTML = `<div class="touch-pad" role="group" aria-label="Flight direction">
    ${button('KeyW', 'Pitch up', '▲', 'pitch-up')}${button('KeyA', 'Turn left', '◀', 'turn-left')}
    ${button('KeyD', 'Turn right', '▶', 'turn-right')}${button('KeyS', 'Pitch down', '▼', 'pitch-down')}
    <span class="touch-pad-label">TURN / PITCH</span></div>
    <div class="touch-actions" role="group" aria-label="Flight actions">
    <div class="touch-roll">${button('KeyQ', 'Roll left', 'ROLL ↶')}${button('KeyE', 'Roll right', 'ROLL ↷')}</div>
    <div class="touch-flap-row">${button('ShiftLeft', 'Dive', 'DIVE')}${button('Space', 'Flap', 'FLAP', 'touch-flap')}</div></div>`;
  parent.append(root);
  const clearFeedback = () => root.querySelectorAll('.pressed').forEach(el => el.classList.remove('pressed'));
  controls.onEnabledChange = enabled => { root.hidden = !enabled; if (!enabled) clearFeedback(); };
  root.addEventListener('pointerdown', e => {
    const target = (e.target as Element).closest<HTMLButtonElement>('[data-flight-key]');
    if (!target || !controls.enabled) return;
    e.preventDefault(); target.setPointerCapture(e.pointerId);
    controls.touchStart(e.pointerId, target.dataset.flightKey!); target.classList.add('pressed');
  });
  const release = (e: PointerEvent) => {
    controls.touchEnd(e.pointerId);
    (e.target as Element).closest('button')?.classList.remove('pressed');
  };
  root.addEventListener('pointerup', release);
  root.addEventListener('pointercancel', release);
  root.addEventListener('lostpointercapture', release);
  root.addEventListener('contextmenu', e => e.preventDefault());
  window.addEventListener('blur', clearFeedback);
  document.addEventListener('visibilitychange', clearFeedback);
}
