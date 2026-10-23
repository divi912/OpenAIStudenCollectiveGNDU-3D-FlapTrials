import { bodyRoll } from '../../shared/track';

const clamp = (n: number, limit: number) => Math.max(-limit, Math.min(limit, n));

/** Presentation only: bounded banking keeps full barrel rolls comfortable. */
export function flightCamera(heading: number, pitch: number, roll: number, reducedMotion: boolean) {
  if (reducedMotion) return { yaw: 0, lift: 0, bank: 0 };
  return {
    yaw: clamp(heading, .65) * .75,
    lift: Math.sin(clamp(pitch, .6)),
    bank: clamp(Math.sin(bodyRoll(heading, roll)) * .2 - heading * .2, .28),
  };
}

export function smoothBank(current: number, target: number, dt: number): number {
  return current + (target - current) * (1 - Math.exp(-Math.max(0, dt) * 6));
}
