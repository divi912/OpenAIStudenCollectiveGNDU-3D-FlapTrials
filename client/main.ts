import './styles.css';
import './cockpit.css';
import './intro.css';
import './nametags.css';
import './loading.css';
import { LoadingFeedback } from './loading';
import { connectionError } from './network/availability';
import type { ServerHealth } from '../shared/server-health';
import { NameTags } from './game/nametags';
import { GameScene } from './game/scene';
import { Controls } from './game/input';
import { GameAudio } from './game/audio';
import { partyEvent } from '../shared/party';
import { INTRO_SECONDS, COUNTDOWN_SECONDS, PRE_RACE_SECONDS } from '../shared/intro';
import { hudTemplate, updateFlightInstruments } from './cockpit';
import { Connection, SERVER_URL } from './network/connection';
import { COURSES, getCourse } from '../shared/courses';
import { createRacer, stepRacer } from '../shared/physics';
import { DT, PHYSICS_VERSION, finishSeconds, rankRacers, type PlayerSnapshot, type RacerState } from '../shared/protocol';
import { preferences, savePreferences, personalBest } from './storage';
import { homeTemplate, courseCards, profileModal, helpModal, settingsModal, lobbyModal, resultsModal, formatTime, icon, escapeHtml } from './ui';

const app = document.querySelector<HTMLDivElement>('#app')!;
app.innerHTML = '<canvas id="world" class="world-canvas" aria-label="Flap Trials 3D world"></canvas><div id="home"></div><div id="hud" hidden></div><div id="race-intro" hidden><div class="intro-title"><span id="intro-label"></span><h1 id="intro-course"></h1><p id="intro-detail"></p></div><div id="intro-roster"></div><div class="intro-timeline"><i></i></div></div><div id="modal"></div><div id="toast" role="status" aria-live="polite"></div><div id="boot-note">Warming up the wings…</div>';
const home = document.querySelector<HTMLDivElement>('#home')!, hud = document.querySelector<HTMLDivElement>('#hud')!, modal = document.querySelector<HTMLDivElement>('#modal')!, toastElement = document.querySelector<HTMLDivElement>('#toast')!;
app.insertAdjacentHTML('beforeend', '<div id="bird-names" aria-hidden="true"></div>');
const nameContainer = document.querySelector<HTMLDivElement>('#bird-names')!;
const nameTags = new NameTags(nameContainer);
const p = preferences(), controls = new Controls(), audio = new GameAudio(), connection = new Connection();
const loading = new LoadingFeedback(app, () => connection.cancelConnect());
connection.progress = state => loading.connection(state);
audio.volume = p.volume;
audio.musicVolume = p.musicVolume;
document.body.dataset.reducedMotion = String(p.reducedMotion);
let selected = COURSES[0].id;
let scene: GameScene | undefined;
let practice: PlayerSnapshot | undefined;
let practiceTick = 0, practiceStartTime = 0, accumulator = 0;
let view: 'home' | 'race' = 'home';
let modalKind = '', lobbySignature = '', raceCourse = '', resultsKey = '';
let previousCrashCount = 0, previousCheckpoint = 0, finishSoundPlayed = false;
let previousTime = performance.now(), lastHud = 0, toastTimer = 0, previousCountdown = -1;
let debug = new URLSearchParams(location.search).has('debug');
let cueUntil = 0;
let previousParty = '', previousPickupMask = 0;
let previousTricks = 0, previousGates = 0;

function toast(message: string) {
  toastElement.textContent = message; toastElement.classList.add('show'); clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toastElement.classList.remove('show'), 4500);
}
function setModal(html: string, kind: string) {
  modal.innerHTML = html; modalKind = kind; controls.enabled = false; controls.clear();
  if (html) {
    const first = modal.querySelector<HTMLElement>('input, button:not(.modal-close), select'); setTimeout(() => first?.focus({ preventScroll: true }), 0);
  }
}
function closeModal() { if (modalKind === 'lobby') return; setModal('', ''); controls.enabled = view === 'race'; }
function showHome() {
  view = 'home'; practice = undefined; practiceTick = 0; controls.enabled = false; controls.clear();
  document.body.dataset.view = 'home'; home.hidden = false; hud.hidden = true; hud.innerHTML = '';
  home.innerHTML = homeTemplate(selected); setModal('', ''); scene?.showMenu(); resultsKey = ''; raceCourse = '';
  void updateServerStatus();
}
function resetFeedback() { previousCrashCount = 0; previousCheckpoint = 0; finishSoundPlayed = false; previousCountdown = -1; cueUntil = 0; resultsKey = ''; previousParty = ''; previousPickupMask = 0; previousTricks = 0; previousGates = 0; }
function startPractice() {
  if (!scene?.ready) { toast('The sky is almost ready. Give it a moment.'); return; }
  audio.unlock(); savePreferences(p); resetFeedback(); practiceTick = 0; accumulator = 0;
  practice = { ...createRacer('practice'), name: p.name, color: p.color, ready: true, loaded: true, connected: true };
  practiceStartTime = performance.now() + PRE_RACE_SECONDS * 1000;
  openRace(selected, true); closeModal(); controls.enabled = false;
}
function openRace(courseId: string, isPractice: boolean) {
  view = 'race'; document.body.dataset.view = 'race'; home.hidden = true; hud.hidden = false;
  if (raceCourse !== courseId || !hud.innerHTML) { raceCourse = courseId; hud.innerHTML = hudTemplate(getCourse(courseId).definition, isPractice); }
  scene?.showCourse(getCourse(courseId).definition);
}
function showResults(players: PlayerSnapshot[], selfId: string, courseId: string, startTick: number, isPractice: boolean) {
  const key = isPractice ? `practice-${practiceStartTime}` : `online-${connection.room?.state.raceId}`;
  if (resultsKey === key) return; resultsKey = key;
  const course = getCourse(courseId).definition;
  const me = players.find(v => v.playerId === selfId);
  let pb: number | null = null;
  if (me?.status === 'finished') {
    pb = personalBest(courseId, course.version, PHYSICS_VERSION, isPractice ? 'practice' : 'race', finishSeconds(me, startTick));
    if (!finishSoundPlayed) { audio.finish(); finishSoundPlayed = true; }
  }
  setModal(resultsModal(players, selfId, course, startTick, isPractice, pb), 'results');
  if (me) modal.querySelector('.results-summary')?.insertAdjacentHTML('afterend', `<div class="result-flight-stats"><span><b>${me.styleScore.toLocaleString()}</b>STYLE POINTS</span><span><b>${me.trickCount}</b>BARREL ROLLS</span><span><b>${me.bestStreak}</b>BEST CLEAN STREAK</span></div>`);
}
async function leave() { await connection.leave(); loading.hide(); showHome(); }
connection.notice = toast;
connection.lost = () => { loading.hide(); toast('The room connection closed. You can rejoin or start a new race.'); showHome(); };
connection.changed = () => {
  const room = connection.room; if (!room) return;
  const s = room.state;
  if (s.phase === 'lobby') {
    loading.hide();
    if (view !== 'home') { showHome(); resetFeedback(); }
    const signature = JSON.stringify([s.courseId, s.hostId, s.raceId, !!s.deadline, [...s.players.values()].map(v => [v.playerId, v.ready, v.connected])]);
    if (modalKind === 'settings' || modalKind === 'help') return;
    if (signature !== lobbySignature || modalKind !== 'lobby') { lobbySignature = signature; setModal(lobbyModal(s, room.sessionId), 'lobby'); }
  } else if (s.phase === 'loading') {
    if (view !== 'race' || raceCourse !== s.courseId) { resetFeedback(); openRace(s.courseId, false); setModal('', ''); }
    if (scene?.ready) connection.action('loaded');
    loading.race([...s.players.values()].filter(v => v.loaded).length, s.players.size, (s.deadline - s.tick) / 60, !!scene?.ready);
  } else if (s.phase === 'countdown' || s.phase === 'racing') {
    loading.hide();
    if (view !== 'race' || raceCourse !== s.courseId) openRace(s.courseId, false);
    if (modalKind === 'lobby' || modalKind === 'loading') closeModal();
    controls.enabled = !modalKind && s.phase === 'racing';
  } else if (s.phase === 'results') {
    loading.hide();
    showResults([...s.players.values()].map(v => v.toJSON() as PlayerSnapshot), room.sessionId, s.courseId, s.startTick, false);
  }
};
controls.onFlap = () => audio.flap();
controls.onRestart = () => { if (practice && !modalKind) startPractice(); };
controls.onMenu = () => { audio.unlock(); if (modalKind === 'settings' || modalKind === 'help') closeModal(); else if (!modalKind || modalKind === 'lobby') setModal(settingsModal(p, scene?.renderer ?? 'Loading', view === 'race'), 'settings'); };

document.addEventListener('click', async event => {
  const target = (event.target as HTMLElement).closest<HTMLElement>('[data-action]');
  if (!target || target.hasAttribute('disabled')) return;
  audio.unlock(); const action = target.dataset.action;
  switch (action) {
    case 'home': if (!connection.room && view === 'home') closeModal(); break;
    case 'help': setModal(helpModal(), 'help'); break;
    case 'settings': setModal(settingsModal(p, scene?.renderer ?? 'Loading', view === 'race'), 'settings'); break;
    case 'close': if (modalKind === 'profile') connection.cancelConnect(); if (modalKind === 'lobby' || modalKind === 'results') await leave(); else if (connection.room?.state.phase === 'lobby') { lobbySignature = ''; modalKind = ''; connection.changed(); } else closeModal(); break;
    case 'practice': startPractice(); break;
    case 'course': selected = target.dataset.course!; document.querySelector('#course-grid')!.innerHTML = courseCards(selected); break;
    case 'quick': case 'create': case 'join': setModal(profileModal(action, p), 'profile'); break;
    case 'color':
      p.color = target.dataset.color!; savePreferences(p);
      for (const button of modal.querySelectorAll<HTMLButtonElement>('.color-option')) { const chosen = button.dataset.color === p.color; button.classList.toggle('chosen', chosen); button.setAttribute('aria-pressed', String(chosen)); button.innerHTML = chosen ? icon('check', 19) : ''; }
      break;
    case 'lobby-course': connection.action('map', target.dataset.course); break;
    case 'copy':
      try { await navigator.clipboard.writeText(connection.room?.state.code ?? ''); toast('Room code copied. Invite your flock!'); } catch { toast(`Your room code is ${connection.room?.state.code}.`); }
      break;
    case 'ready': connection.action('ready', !connection.room?.state.players.get(connection.room.sessionId)?.ready); break;
    case 'start': connection.action('start'); break;
    case 'leave': await leave(); break;
    case 'again': if (practice) startPractice(); else { resultsKey = ''; connection.action('again'); } break;
    case 'change-map':
      if (practice) { showHome(); document.querySelector('#courses-title')?.scrollIntoView({ behavior: p.reducedMotion ? 'instant' : 'smooth', block: 'center' }); }
      else { resultsKey = ''; connection.action('again'); }
      break;
  }
});
document.addEventListener('submit', async event => {
  const form = event.target as HTMLFormElement; if (form.id !== 'profile-form') return;
  event.preventDefault(); const data = new FormData(form); p.name = String(data.get('name') || 'Little Bird').trim().slice(0, 20); savePreferences(p);
  const submit = form.querySelector<HTMLButtonElement>('button[type="submit"]')!, error = form.querySelector<HTMLParagraphElement>('#form-error')!;
  submit.disabled = true; submit.textContent = 'Finding your nest…'; error.textContent = '';
  try {
    await connection.connect(form.dataset.mode as 'create' | 'quick' | 'join', p.name, p.color, String(data.get('code') ?? '').trim(), selected);
  } catch (cause) {
    error.textContent = connectionError(cause);
    submit.disabled = false; submit.innerHTML = `Try again ${icon('arrow')}`;
  }
});
document.addEventListener('input', event => {
  const input = event.target as HTMLInputElement;
  if (input.id === 'volume') { p.volume = Number(input.value); audio.volume = p.volume; }
  else if (input.id === 'music-volume') { p.musicVolume = Number(input.value); audio.musicVolume = p.musicVolume; }
  else if (input.id === 'quality') p.quality = input.value as typeof p.quality;
  else if (input.id === 'reduced-motion') p.reducedMotion = input.checked;
  else return;
  savePreferences(p); scene?.setPreferences(p);
  document.body.dataset.reducedMotion = String(p.reducedMotion);
});
document.addEventListener('keydown', event => {
  if (event.code === 'F3') { event.preventDefault(); debug = !debug; }
  if (event.key === 'Tab' && modalKind) {
    const items = [...modal.querySelectorAll<HTMLElement>('button:not([disabled]), input, select, a[href]')];
    if (!items.length) return;
    if (event.shiftKey && document.activeElement === items[0]) { event.preventDefault(); items.at(-1)?.focus(); }
    else if (!event.shiftKey && document.activeElement === items.at(-1)) { event.preventDefault(); items[0].focus(); }
  }
});
document.addEventListener('visibilitychange', () => { audio.setHidden(document.hidden); if (!document.hidden) { previousTime = performance.now(); accumulator = 0; } });

async function updateServerStatus() {
  const text = document.querySelector('#server-status-text'); if (!text) return;
  try {
    const response = await fetch(`${SERVER_URL}/health`, { signal: AbortSignal.timeout(2500), cache: 'no-store' });
    if (!response.ok) throw new Error('offline');
    const health = await response.json() as ServerHealth;
    if (health.status !== 'ok') throw new Error('not a multiplayer server');
    const full = health.capacity && !health.capacity.acceptingNewRooms && health.capacity.availablePublicSeats === 0;
    text.textContent = full ? 'All rooms busy · join with a code' : `Multiplayer ready${health.capacity ? ` · ${health.rooms}/${health.capacity.maxRooms} rooms` : ''}`;
    document.querySelector('.server-status')?.classList.toggle('online', !full);
  }
  catch { text.textContent = 'Solo practice ready'; document.querySelector('.server-status')?.classList.remove('online'); }
}
function cue(html: string, duration = 0) { const el = document.querySelector('#center-cue'); if (el) el.innerHTML = html; if (duration) cueUntil = performance.now() + duration; }
function updateHud(now: number, players: PlayerSnapshot[], localId: string, elapsed: number, countdown: number, hazardSeconds: number) {
  const local = players.find(v => v.playerId === localId); if (!local) return;
  const time = document.querySelector('#race-time'); if (!time) return;
  const course = getCourse(raceCourse).definition;
  updateFlightInstruments(local, course, elapsed, countdown, hazardSeconds);
  const reticle = document.querySelector<HTMLElement>('#gate-reticle')!, marker = scene?.gateMarker(local, hazardSeconds);
  reticle.hidden = !marker; if (marker) { reticle.style.setProperty('--target-x', `${marker.x}%`); reticle.style.setProperty('--target-y', `${marker.y}%`); }
  const event = partyEvent(countdown > 0 ? 0 : hazardSeconds), party = document.querySelector<HTMLElement>('#party-event')!;
  party.hidden = event.kind === 'calm'; party.classList.toggle('warning', event.warning); party.style.setProperty('--event-color', event.color);
  document.querySelector('.cockpit')?.classList.toggle('party-active', event.kind !== 'calm');
  const partyKey = `${event.kind}-${event.warning}`;
  if (partyKey !== previousParty) { previousParty = partyKey; if (event.kind !== 'calm') audio.tone(event.warning ? 420 : 740, .2); }
  party.innerHTML = `<span>${event.warning ? 'INCOMING CHAOS' : 'FLOCK-WIDE EVENT'}</span><strong>${event.name} <i>${Math.ceil(event.remaining)}</i></strong><small>${event.warning ? `Starts in ${Math.ceil(event.remaining)}… get ready!` : event.detail}</small>`;
  const powers = document.querySelector<HTMLElement>('#power-status')!;
  const boost = Math.max(0, (local.boostUntilTick - local.simulationTick) / 60), shield = Math.max(0, (local.shieldUntilTick - local.simulationTick) / 60);
  powers.innerHTML = `${boost ? `<span class="boost-power">✦ ROCKET <b>${boost.toFixed(1)}s</b></span>` : ''}${shield ? `<span class="shield-power">◈ BUBBLE <b>${shield.toFixed(1)}s</b></span>` : ''}`;
  powers.hidden = !boost && !shield;
  if (local.pickupMask !== previousPickupMask) { previousPickupMask = local.pickupMask; audio.tone(1100, .16); }
  time.textContent = formatTime(local.status === 'finished' ? finishSeconds(local, practice ? 0 : connection.room?.state.startTick ?? 0) : elapsed);
  document.querySelector('#checkpoint-text')!.textContent = `${local.checkpointIndex} / ${course.checkpoints.length}`;
  (document.querySelector('#course-progress') as HTMLElement).style.width = `${Math.max(0, Math.min(100, local.z / course.length * 100))}%`;
  const rank = rankRacers(players), place = rank.findIndex(v => v.playerId === localId) + 1;
  document.querySelector('#race-position')!.innerHTML = `${place}<small> / ${players.length}</small>`;
  document.querySelector('#race-rivals')!.innerHTML = practice ? '<small>Just you and the sky.</small>' : rank.slice(0, 5).map((v, i) => `<div class="rival ${v.playerId === localId ? 'local' : ''}"><span>${i + 1}</span><i style="background:${v.color}"></i><strong>${escapeHtml(v.name)}</strong>${v.status === 'finished' ? icon('check', 12) : ''}</div>`).join('');
  if (local.crashCount > previousCrashCount) {
    previousCrashCount = local.crashCount; audio.crash(); scene?.crash(local);
    const joke = local.crashCause === 'missed_gate' ? 'NOT A DOOR!' : ['BONK!', 'EGGSCUSE ME!', 'FEATHER BENDER!'][local.crashCount % 3];
    cue(`<div class="comic-stamp"><b>${joke}</b><small>${local.crashCause === 'missed_gate' ? 'The opening was over there. Try the Q / E roll!' : local.crashCause === 'bounds' ? 'The audience paid to watch you fly inside the arena.' : 'A brief disagreement with architecture. Back to your checkpoint.'}</small></div>`, 900);
  }
  if (local.trickCount > previousTricks) { previousTricks = local.trickCount; audio.tone(900, .2); scene?.crash(local); cue('<div class="comic-stamp roll"><b>ROTISSERIE MODE!</b><small>One complete barrel roll. +200 style. Zero dignity lost.</small></div>', 1400); }
  if (local.gatesCleared > previousGates) { previousGates = local.gatesCleared; if (local.cleanStreak >= 3 && local.cleanStreak % 3 === 0 && now > cueUntil) cue(`<div class="comic-stamp positive"><b>${local.cleanStreak >= 6 ? 'UNFLAPPABLE!' : 'FLAPULOUS!'}</b><small>${local.cleanStreak} clean gates in a row. The crowd is losing its feathers.</small></div>`, 1100); }
  if (local.checkpointIndex > previousCheckpoint) { previousCheckpoint = local.checkpointIndex; audio.checkpoint(); if (now > cueUntil) cue('<strong class="checkpoint-cue">Checkpoint!</strong><span>A little closer to the finish.</span>', 950); }
  if (countdown > 0) {
    const count = Math.ceil(countdown);
    cue(`<span class="countdown-label">WINGS AT THE READY</span><strong class="countdown-number">${count}</strong><span>SPACE flap · A / D turn · W / S pitch · Q / E roll</span>`);
    if (count !== previousCountdown) { previousCountdown = count; audio.tone(440, .1); }
  } else if (previousCountdown > 0) { previousCountdown = 0; audio.tone(880, .3); cue('<strong class="countdown-number go">FLY!</strong>', 700); }
  else if (now > cueUntil && local.status !== 'finished') cue('');
  if (local.status === 'finished' && !practice && connection.room?.state.phase !== 'results') cue('<strong class="checkpoint-cue">You made it!</strong><span>Waiting for the rest of the flock…</span>');
  const performanceEl = document.querySelector<HTMLElement>('#performance')!; performanceEl.hidden = !debug;
  if (debug && scene) { const s = scene.stats; performanceEl.textContent = `${s.renderer} · ${s.fps} FPS · ${s.width}×${s.height} · ${s.drawCalls} draw calls · ${Math.round(s.triangles / 1000)}k tris · ${connection.latency} ms RTT`; }
}
function frame(now: number) {
  const dt = Math.min(.25, (now - previousTime) / 1000); previousTime = now;
  let players: PlayerSnapshot[] = [], localId = '', elapsed = 0, countdown = 0, raceSeconds = 0;
  if (practice && view === 'race') {
    countdown = Math.max(0, (practiceStartTime - now) / 1000);
    if (!countdown && practice.status !== 'finished' && practice.status !== 'dnf') {
      accumulator += dt;
      while (accumulator >= DT) { stepRacer(practice, controls.read(practiceTick, practiceTick), getCourse(selected), practiceTick); practiceTick++; accumulator -= DT; }
      if (practiceTick >= Math.max(180, getCourse(selected).definition.estimatedClearSeconds + 90) * 60) practice.status = 'dnf';
    }
    players = [practice]; localId = 'practice'; elapsed = practiceTick / 60; raceSeconds = elapsed;
    if (practice.status === 'finished' || practice.status === 'dnf') showResults(players, localId, selected, 0, true);
  } else if (connection.room) {
    connection.step(now, (seq, tick) => controls.read(seq, tick));
    const s = connection.room.state; players = connection.players(); localId = connection.room.sessionId;
    const serverTick = s.tick;
    countdown = s.phase === 'countdown' ? Math.max(0, (s.startTick - serverTick) / 60) : s.phase === 'loading' ? 3 : 0;
    elapsed = s.phase === 'racing' || s.phase === 'results' ? Math.max(0, (serverTick - s.startTick) / 60) : 0;
    raceSeconds = Math.max(0, ((connection.local?.simulationTick ?? serverTick) - s.startTick) / 60);
  }
  if (view === 'race' && now - lastHud > 80) { lastHud = now; updateHud(now, players, localId, elapsed, countdown, raceSeconds); }
  const introElapsed = view === 'race' && countdown > COUNTDOWN_SECONDS
    ? Math.max(0, PRE_RACE_SECONDS - countdown) : undefined;
  const intro = document.querySelector<HTMLDivElement>('#race-intro')!;
  intro.hidden = introElapsed === undefined;
  document.body.dataset.intro = String(introElapsed !== undefined);
  if (introElapsed !== undefined) {
    const lineup = introElapsed >= 4;
    document.querySelector('#intro-label')!.textContent = lineup ? 'MEET THE FLOCK' : 'YOUR NEXT CHALLENGE';
    document.querySelector('#intro-course')!.textContent = getCourse(raceCourse).definition.name;
    document.querySelector('#intro-detail')!.textContent = lineup ? 'Tiny wings. Big ambitions. Get ready to fly!' : 'Clear every gate. Chase the golden flags. Own the finish.';
    const roster = document.querySelector<HTMLDivElement>('#intro-roster')!;
    const names = lineup ? players.map(v => `<span style="--bird-color:${v.color}">${escapeHtml(v.name)}${v.playerId === localId ? '<small>YOU</small>' : ''}</span>`).join('') : '';
    if (roster.innerHTML !== names) roster.innerHTML = names;
    intro.style.setProperty('--intro-progress', String(introElapsed / INTRO_SECONDS));
  }
  if (practice && view === 'race') { controls.enabled = !modalKind && countdown === 0; if (countdown > 0) controls.clear(); }
  scene?.render(now, dt, players, localId, raceSeconds, introElapsed);
  nameContainer.hidden = view !== 'race' || !!modalKind;
  nameTags.update(view === 'race' ? players : [], id => scene?.birdMarker(id), localId);
  requestAnimationFrame(frame);
}

showHome();
const slowBoot = window.setTimeout(() => { const note = document.querySelector('#boot-note'); if (note) note.textContent = 'Still loading the 3D birds and stadium. Please keep this tab open…'; }, 5000);
GameScene.create(document.querySelector<HTMLCanvasElement>('#world')!, p).then(result => {
  clearTimeout(slowBoot);
  scene = result;
  if (view === 'race' && raceCourse) result.showCourse(getCourse(raceCourse).definition); else result.showMenu();
  connection.changed();
  document.querySelector('#boot-note')?.remove();
  document.body.dataset.renderer = result.renderer; requestAnimationFrame(frame);
}).catch(error => {
  clearTimeout(slowBoot);
  console.error('Could not initialize the game renderer:', error);
  const note = document.querySelector('#boot-note')!;
  note.textContent = 'The 3D world could not load. Try a current browser with hardware acceleration enabled, then refresh.';
  note.classList.add('boot-error');
});
setInterval(() => { if (!document.hidden && !connection.room && !practice) void updateServerStatus(); }, 60000);

// Read-only diagnostics for browser automation and local profiling; never an authority channel.
Object.defineProperty(window, '__flap', { get: () => ({ audio: audio.stats, view, courseId: raceCourse || selected, renderer: scene?.renderer, stats: scene?.stats, camera: scene?.cameraMotion, network: { sentInputs: connection.sentInputs }, practice: practice ? { ...practice } : undefined, room: connection.room?.state.toJSON(), sessionId: connection.room?.sessionId }) });
