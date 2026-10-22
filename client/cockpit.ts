import { isGate, obstaclePose } from '../shared/courses';
import { bodyRoll } from '../shared/track';
import type { CourseDefinition, PlayerSnapshot } from '../shared/protocol';
import { birdMark, escapeHtml, icon } from './ui';

export function hudTemplate(course: CourseDefinition, practice: boolean): string {
  return `<div class="cockpit">
    <header class="cockpit-top">
      <section class="flight-card course-panel">${birdMark}<div><span class="instrument-label">FLAP TRIALS · AIR STADIUM</span><h2>${escapeHtml(course.name)}</h2><p>${practice ? 'SOLO PRACTICE' : 'PARTY MULTIPLAYER'} <i>·</i> ${course.difficulty}</p></div></section>
      <section class="flight-card clock-panel"><span class="instrument-label">FLIGHT TIME</span><strong id="race-time">00:00.000</strong><small id="race-phase">WINGS AT THE READY</small></section>
      <section class="flight-card position-panel"><div><span class="instrument-label">RACE POSITION</span><strong id="race-position">1<small> / 1</small></strong><small id="distance-left">${course.length} m to finish</small></div><button class="cockpit-menu" data-action="settings" aria-label="Race menu">${icon('settings', 22)}</button></section>
    </header>
    <aside class="flight-card cockpit-flock"><span class="instrument-label">${icon('people', 13)} THE FLOCK</span><div id="race-rivals"></div><p class="panel-footnote">Same wings. Questionable decisions.</p></aside>
    <div class="party-event" id="party-event" role="status" hidden></div>
    <div class="gate-reticle" id="gate-reticle" hidden><i></i><span>NEXT</span></div>
    <div class="center-cue" id="center-cue" aria-live="polite"></div>
    <div class="gate-guidance" id="gate-guidance"><span class="instrument-label" id="gate-name">NEXT OPENING</span><strong id="gate-instruction">Find your line</strong><small id="next-checkpoint">Follow the golden checkpoint flags</small></div>
    <div class="power-status" id="power-status" hidden></div>
    <footer class="cockpit-bottom">
      <section class="flight-card navigation-panel"><div class="navigation-title"><span class="instrument-label">COURSE PROGRESS</span><strong id="checkpoint-text">0 / ${course.checkpoints.length}</strong></div><div class="progress-track"><div id="course-progress"></div></div><div class="flight-bindings"><span><kbd>SPACE</kbd> flap</span><span><kbd>A D</kbd> turn</span><span><kbd>W S</kbd> pitch</span><span><kbd>Q E</kbd> roll</span><span><kbd>SHIFT</kbd> dive</span></div><p class="panel-footnote">Flap for height. Bank through gaps. Try to look intentional.</p></section>
    </footer><div class="performance" id="performance" hidden></div>
  </div>`;
}

export function updateFlightInstruments(local: PlayerSnapshot, course: CourseDefinition, elapsed: number, countdown: number, hazardSeconds = elapsed) {
  const text = (id: string, value: string) => { const el = document.getElementById(id); if (el) el.textContent = value; };
  const roll = bodyRoll(local.heading, local.roll);
  text('distance-left', `${Math.max(0, Math.ceil(course.length - local.z))} m to finish`);
  text('race-phase', countdown > 0 ? `TAKEOFF IN ${Math.ceil(countdown)}` : local.status === 'finished' ? 'FLIGHT COMPLETE' : local.status === 'crashed' ? 'RETURNING TO CHECKPOINT' : `${Math.floor(elapsed)}s IN THE AIR`);
  const next = course.obstacles.find(o => isGate(o) && o.z > local.z - .5);
  const guidance = document.getElementById('gate-guidance');
  if (!next) { text('gate-name', 'THE FINISH LINE'); text('gate-instruction', 'Bring those wings home'); text('next-checkpoint', `${Math.max(0, Math.ceil(course.length - local.z))} m remaining`); guidance?.classList.remove('twist'); return; }
  const distance = Math.max(0, next.z - local.z), pose = obstaclePose(next, hazardSeconds);
  text('gate-name', next.kind === 'twist_gate' ? 'TWIST SLOT · BANK TO FIT' : `${next.shape ?? 'rectangle'} ${next.kind === 'shutter' ? 'SHUTTER' : next.kind === 'rotating_gate' ? 'SPINNER' : 'GATE'}`.toUpperCase());
  if (next.kind === 'twist_gate') {
    const difference = .5 * Math.atan2(Math.sin(2 * (pose.angle + Math.PI / 2 - roll)), Math.cos(2 * (pose.angle + Math.PI / 2 - roll)));
    text('gate-instruction', Math.abs(difference) < .2 ? 'Good bank. Hold your line!' : `Q / E · ${difference > 0 ? 'roll left' : 'roll right'}`);
  } else text('gate-instruction', `${Math.abs(pose.x - local.x) > 1.3 ? (pose.x > local.x ? 'Turn right' : 'Turn left') : 'Line up'}${Math.abs(pose.y - local.y) > 1.4 ? (pose.y > local.y ? ' & flap up' : ' & drop down') : ' & thread the gap'}`);
  text('next-checkpoint', `${Math.ceil(distance)} m ahead · ${(distance / Math.max(1, local.speed)).toFixed(1)}s approach`);
  guidance?.classList.toggle('twist', next.kind === 'twist_gate');
}
