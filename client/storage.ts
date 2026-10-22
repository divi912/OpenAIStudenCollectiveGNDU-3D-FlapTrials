export interface Preferences { name: string; color: string; volume: number; musicVolume: number; quality: 'auto' | 'low' | 'high'; reducedMotion: boolean }
const defaults: Preferences = { name: 'Little Bird', color: '#ffcc42', volume: .35, musicVolume: .28, quality: 'auto', reducedMotion: false };
export function preferences(): Preferences {
  try { return { ...defaults, ...JSON.parse(localStorage.getItem('flap.preferences') ?? '{}') }; } catch { return { ...defaults }; }
}
export function savePreferences(p: Preferences) { try { localStorage.setItem('flap.preferences', JSON.stringify(p)); } catch { /* Storage can be disabled; gameplay remains available. */ } }
export function personalBest(courseId: string, version: string, physics: string, mode: string, time?: number): number | null {
  const key = `flap.pb.${mode}.${courseId}.${version}.${physics}`;
  try {
    const raw = localStorage.getItem(key); const old = raw === null ? null : Number(raw);
    const valid = old !== null && Number.isFinite(old) && old > 0 ? old : null;
    if (time !== undefined && time > 0 && (valid === null || time < valid)) localStorage.setItem(key, String(time));
    return valid;
  } catch { return null; }
}
