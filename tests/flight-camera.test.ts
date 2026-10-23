import { expect, it } from 'vitest';
import { flightCamera, smoothBank } from '../client/game/flight-camera';

it('leans into steering, follows pitch and responds to rolls', () => {
  expect(flightCamera(0, 0, 0, false)).toEqual({ yaw: 0, lift: 0, bank: 0 });
  const left = flightCamera(-.5, -.3, 0, false), right = flightCamera(.5, .3, 0, false);
  expect(right.yaw).toBeGreaterThan(0);
  expect(left.yaw).toBe(-right.yaw);
  expect(left.bank).toBeCloseTo(-right.bank);
  expect(right.lift).toBeGreaterThan(0);
  expect(flightCamera(0, 0, 1, false).bank).toBeGreaterThan(0);
});

it('bounds banking throughout barrel rolls and disables motion for reduced motion', () => {
  for (let roll = -20; roll < 20; roll += .1) {
    expect(Math.abs(flightCamera(.65, .6, roll, false).bank)).toBeLessThanOrEqual(.28);
    expect(flightCamera(.65, .6, roll, true)).toEqual({ yaw: 0, lift: 0, bank: 0 });
  }
});

it('smooths bank independently of frame rate and eases back to level', () => {
  let bank = 0;
  for (let i = 0; i < 60; i++) bank = smoothBank(bank, .2, 1 / 60);
  expect(bank).toBeCloseTo(smoothBank(0, .2, 1), 10);
  expect(smoothBank(bank, 0, .5)).toBeLessThan(bank);
  expect(smoothBank(.1, .2, 0)).toBe(.1);
});
