export type PartyKind = 'calm' | 'turbo' | 'moon' | 'crosswind';
const events = [
  { kind: 'turbo', name: 'TURBO FLOCK', detail: 'Everyone gets a tailwind. Hold your line!', color: '#ffb44f' },
  { kind: 'moon', name: 'MOON WINGS', detail: 'Low gravity. Easy on the flaps!', color: '#bda4ff' },
  { kind: 'crosswind', name: 'WILD WINDS', detail: 'A gusty surprise. Counter-steer!', color: '#6fe4d2' },
] as const;
/** A race-wide party director. No client clocks, random timers or per-client phases. */
export function partyEvent(seconds: number): { kind: PartyKind; name: string; detail: string; color: string; warning: boolean; remaining: number } {
  if (seconds < 12) return { kind: 'calm', name: '', detail: '', color: '#ffffff', warning: false, remaining: 12 - seconds };
  const elapsed = seconds - 12, cycle = Math.floor(elapsed / 18), phase = elapsed % 18;
  const event = events[cycle % events.length];
  if (phase >= 10) return { kind: 'calm', name: '', detail: '', color: event.color, warning: false, remaining: 18 - phase };
  return { ...event, warning: phase < 3, remaining: phase < 3 ? 3 - phase : 10 - phase };
}
