import type { RacerState } from './protocol';

export const SHOP = Object.freeze({ startingPoints: 100, halfwayPoints: 50, startSeconds: 15, halfwaySeconds: 12, purchaseLimit: 2 });
export const ITEMS = [
  { id: 'boost_cell', name: 'Boost Cell', price: 25, bit: 1, kind: 'Boost', detail: '+35 boost reserve.', glyph: 'cell' },
  { id: 'guard', name: 'Crash Guard', price: 35, bit: 2, kind: 'Defense', detail: 'Blocks one frame collision. Missed gates still count.', glyph: 'guard' },
  { id: 'capacitor', name: 'Capacitor', price: 45, bit: 4, kind: 'Upgrade', detail: 'Boost recharges 50% faster for this race.', glyph: 'capacitor' },
  { id: 'jammer', name: 'Jammer', price: 40, bit: 8, kind: 'Debuff', detail: 'Locks one rival’s boost for 3s. Range: 45m ahead.', glyph: 'jammer' },
  { id: 'overdrive', name: 'Overdrive', price: 50, bit: 16, kind: 'Risk', detail: '+2 speed. Crashes cost 20 extra boost and 0.3s.', glyph: 'overdrive' },
] as const;
export type ItemId = typeof ITEMS[number]['id'];
export interface ShopState {
  flapPoints: number; boughtMask: number; loadoutMask: number;
  guardCharges: number; jammerCharges: number;
  shopUntilTick: number; shopReady: boolean; midShopVisited: boolean;
  jammedUntilTick: number; jamImmuneUntilTick: number;
}
export function shopDefaults(): ShopState {
  return { flapPoints: SHOP.startingPoints, boughtMask: 0, loadoutMask: 0, guardCharges: 0, jammerCharges: 0,
    shopUntilTick: 0, shopReady: false, midShopVisited: false, jammedUntilTick: 0, jamImmuneUntilTick: 0 };
}
export function hasItem(s: ShopState, id: ItemId): boolean { return !!(s.loadoutMask & ITEMS.find(item => item.id === id)!.bit); }
export function purchaseCount(mask: number): number { return ITEMS.filter(item => mask & item.bit).length; }
export function purchaseProblem(s: ShopState & { boostReserve: number }, id: string, solo = false): string {
  const item = ITEMS.find(item => item.id === id);
  if (!item) return 'Unknown item';
  if (s.shopReady) return 'Shop closed';
  if (s.boughtMask & item.bit) return 'Purchased';
  if (purchaseCount(s.boughtMask) >= SHOP.purchaseLimit) return 'Limit reached';
  if ((id === 'capacitor' || id === 'overdrive') && (s.loadoutMask & item.bit)) return 'Equipped';
  if (id === 'guard' && s.guardCharges) return 'Equipped';
  if (id === 'jammer' && solo) return 'Multiplayer only';
  if (id === 'jammer' && s.jammerCharges) return 'Equipped';
  if (id === 'boost_cell' && s.boostReserve >= 100) return 'Reserve full';
  if (s.flapPoints < item.price) return 'Not enough FP';
  return '';
}
/** Call only after the authority has checked phase, race id and shop deadline. */
export function purchase(s: RacerState, id: string, solo = false): boolean {
  if (purchaseProblem(s, id, solo)) return false;
  const item = ITEMS.find(item => item.id === id)!;
  s.flapPoints -= item.price; s.boughtMask |= item.bit;
  if (id === 'boost_cell') s.boostReserve = Math.min(100, s.boostReserve + 35);
  else if (id === 'guard') s.guardCharges = 1;
  else if (id === 'jammer') s.jammerCharges = 1;
  else s.loadoutMask |= item.bit;
  return true;
}
export function closeShop(s: ShopState): void { s.shopUntilTick = 0; s.shopReady = true; }
export function openShop(s: RacerState, untilTick: number, halfway = false): void {
  if (halfway && !s.midShopVisited) { s.flapPoints += SHOP.halfwayPoints; s.midShopVisited = true; }
  s.boughtMask = 0; s.shopReady = false; s.shopUntilTick = untilTick; s.boostActive = false;
}
export function shiftRaceTimers(s: RacerState, ticks: number): void {
  for (const key of ['nextFlapTick', 'respawnTick', 'shieldUntilTick', 'boostCooldownUntilTick', 'jammedUntilTick', 'jamImmuneUntilTick'] as const) {
    if (s[key] > 0) s[key] += ticks;
  }
}
/** One automatic shot at the nearest eligible rival ahead. Immunity prevents chains. */
export function resolveJammers(players: Iterable<RacerState & { connected: boolean }>, tick: number): void {
  const racers = [...players].filter(p => p.connected && p.status === 'racing' && !p.shopUntilTick);
  for (const shooter of racers) {
    if (!shooter.jammerCharges) continue;
    const target = racers.filter(p => p.playerId !== shooter.playerId && p.z > shooter.z && p.z - shooter.z <= 45
      && p.jamImmuneUntilTick <= tick).sort((a, b) => a.z - b.z || a.playerId.localeCompare(b.playerId))[0];
    if (!target) continue;
    shooter.jammerCharges = 0; target.jammedUntilTick = tick + 180; target.jamImmuneUntilTick = tick + 600; target.boostActive = false;
  }
}
