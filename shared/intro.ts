// Shared by solo, the authoritative countdown and the cinematic renderer.
export const INTRO_SECONDS = 6;
export const COUNTDOWN_SECONDS = 3;
export const PRE_RACE_SECONDS = INTRO_SECONDS + COUNTDOWN_SECONDS;

export function introShot(elapsed: number, length: number, reducedMotion = false) {
  const t = Math.max(0, Math.min(INTRO_SECONDS, elapsed));
  const lineup = t >= 4;
  const progress = Math.min(1, t / 4);
  const ease = progress * progress * (3 - 2 * progress);
  return {
    lineup,
    z: lineup ? 0 : length * (reducedMotion ? .2 : .04 + ease * .78),
    side: lineup ? (reducedMotion ? 3 : 5 - (t - 4) * 2) : (reducedMotion ? 25 : 30 - ease * 15),
    height: lineup ? 8 : 24,
  };
}
