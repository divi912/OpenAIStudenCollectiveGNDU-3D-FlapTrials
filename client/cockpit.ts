import { isGate, obstaclePose } from '../shared/courses';
import { bodyRoll } from '../shared/track';
import type { CourseDefinition, PlayerSnapshot } from '../shared/protocol';
import { escapeHtml, icon } from './ui';

export function hudTemplate(course: CourseDefinition, practice: boolean): string {
  return `<div class="cockpit race-playground ${practice ? 'is-practice' : ''}">
    <header class="cockpit-top">
      <section class="flight-card course-panel"><div><p>${practice ? 'PRACTICE' : 'RACE'}</p><h2>${escapeHtml(course.name)}</h2></div></section>
      <section class="flight-card clock-panel" aria-label="Race time"><span class="instrument-label">${icon('clock', 16)}</span><strong id="race-time">00:00.000</strong><small class="sr-only" id="race-phase">Ready</small></section>
      <section class="flight-card position-panel"><div><span class="instrument-label">PLACE</span><strong id="race-position">1<small> / 1</small></strong><small class="sr-only" id="distance-left">${course.length} m to finish</small></div><button class="cockpit-menu" data-action="settings" aria-label="Race menu">${icon('settings', 22)}</button></section>
    </header>
    <aside class="cockpit-flock" ${practice ? 'hidden' : ''}><div id="race-rivals"></div></aside>
    <div class="party-event" id="party-event" role="status" hidden></div>
    <div class="gate-reticle" id="gate-reticle" hidden><i></i></div>
    <div class="center-cue" id="center-cue" aria-live="polite"></div>
    <div class="gate-guidance" id="gate-guidance"><span class="sr-only" id="gate-name">Next gate</span><strong id="gate-instruction"></strong><small id="next-checkpoint"></small></div>
    <section class="boost-reserve" aria-label="Boost reserve"><div class="boost-heading"><span>BOOST <kbd>F</kbd></span><strong id="boost-percent">60%</strong></div><div class="boost-track" role="meter" aria-label="Stored boost" aria-valuemin="0" aria-valuemax="100" aria-valuenow="60"><i id="boost-fill" style="width:60%"></i></div><small id="boost-state">Hold to boost</small></section>
    <div class="flap-wallet" id="flap-points" aria-label="Flap Points">100 FP</div>
    <div class="shop-loadout" id="shop-loadout"></div>
    <div class="power-status" id="power-status" hidden></div>
    <footer class="cockpit-bottom"><section class="flight-card navigation-panel"><div class="navigation-title"><span class="instrument-label">${icon('flag', 14)} CHECKPOINTS</span><strong id="checkpoint-text">0 / ${course.checkpoints.length}</strong></div><div class="progress-track" role="progressbar" aria-label="Course progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><div id="course-progress"></div></div></section></footer>
    <div class="performance" id="performance" hidden></div>
  </div>`;
}

export function updateFlightInstruments(local: PlayerSnapshot, course: CourseDefinition, elapsed: number, countdown: number, hazardSeconds = elapsed) {
  const text = (id: string, value: string) => { const el = document.getElementById(id); if (el) el.textContent = value; };
  const roll = bodyRoll(local.heading, local.roll);
  text('distance-left', `${Math.max(0, Math.ceil(course.length - local.z))} m to finish`);
  text('race-phase', countdown > 0 ? `TAKEOFF IN ${Math.ceil(countdown)}` : local.status === 'finished' ? 'FLIGHT COMPLETE' : local.status === 'crashed' ? 'RETURNING TO CHECKPOINT' : `${Math.floor(elapsed)}s IN THE AIR`);
  const next = course.obstacles.find(o => isGate(o) && o.z > local.z - .5);
  const guidance = document.getElementById('gate-guidance');
  if (!next) { text('gate-name', 'THE FINISH LINE'); text('gate-instruction', 'Finish'); text('next-checkpoint', `${Math.max(0, Math.ceil(course.length - local.z))} m remaining`); guidance?.classList.remove('twist'); return; }
  const distance = Math.max(0, next.z - local.z), pose = obstaclePose(next, hazardSeconds);
  text('gate-name', next.kind === 'twist_gate' ? 'TWIST SLOT · BANK TO FIT' : `${next.shape ?? 'rectangle'} ${next.kind === 'shutter' ? 'SHUTTER' : next.kind === 'rotating_gate' ? 'SPINNER' : 'GATE'}`.toUpperCase());
  if (next.kind === 'twist_gate') {
    const difference = .5 * Math.atan2(Math.sin(2 * (pose.angle + Math.PI / 2 - roll)), Math.cos(2 * (pose.angle + Math.PI / 2 - roll)));
    text('gate-instruction', Math.abs(difference) < .2 ? 'Hold your bank' : `${document.body.dataset.touch === 'true' ? 'ROLL' : 'Q / E'} · ${difference > 0 ? 'roll left' : 'roll right'}`);
  } else text('gate-instruction', `${Math.abs(pose.x - local.x) > 1.3 ? (pose.x > local.x ? 'Turn right' : 'Turn left') : 'Line up'}${Math.abs(pose.y - local.y) > 1.4 ? (pose.y > local.y ? ' & flap up' : ' & drop down') : ' & thread the gap'}`);
  text('next-checkpoint', `${Math.ceil(distance)} m`);
  guidance?.classList.toggle('twist', next.kind === 'twist_gate');
}
