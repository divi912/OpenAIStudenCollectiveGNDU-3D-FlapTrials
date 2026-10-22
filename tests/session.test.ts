import { describe, expect, it } from 'vitest';
import { GameSession } from '../server/session';
import { getCourse } from '../shared/courses';

function pair() { const s = new GameSession(false); s.join('a', { name: '<Bird>' }); s.join('b', { name: 'Blue' }); return s; }
describe('authoritative room lifecycle', () => {
  it('requires two ready racers and reserves start/map changes for the host', () => {
    const s = new GameSession(false); s.join('a', {}); s.ready('a', true);
    expect(s.start('a')).toBe(false);
    s.join('b', {}); s.ready('b', true);
    expect(s.selectCourse('b', 'clockwork')).toBe(false);
    expect(s.start('b')).toBe(false);
    expect(s.start('a')).toBe(true);
    expect(s.state.phase).toBe('loading');
  });
  it('rejects a different course hash and starts on one shared tick', () => {
    const s = pair(); s.ready('a', true); s.ready('b', true); s.start('a');
    expect(s.loaded('a', 'wrong', s.state.raceId)).toBe(false);
    s.loaded('a', getCourse('skyline_sprint').hash, s.state.raceId);
    s.loaded('b', getCourse('skyline_sprint').hash, s.state.raceId);
    s.step(1, new Map());
    expect(s.state.phase).toBe('countdown');
    s.step(s.state.startTick, new Map());
    expect(s.state.phase).toBe('racing');
    expect(s.state.players.get('a')!.z).toBe(s.state.players.get('b')!.z);
  });
  it('starts a public countdown after two racers arrive', () => {
    const s = new GameSession(true); s.join('a', {}); s.step(1, new Map());
    expect(s.state.deadline).toBe(0);
    s.join('b', {}); s.step(2, new Map());
    expect(s.state.deadline).toBe(902);
    s.step(902, new Map()); expect(s.state.phase).toBe('loading');
  });
  it('resets stale checkpoint, velocity and finish state for a rematch', () => {
    const s = pair(); const p = s.state.players.get('a')!;
    Object.assign(p, { checkpointIndex: 4, speed: 22, crashCount: 12, status: 'finished', finishTick: 100 });
    s.state.phase = 'results'; const id = s.state.raceId;
    s.again('a');
    expect(s.state.phase).toBe('lobby');
    expect(p.checkpointIndex).toBe(0); expect(p.speed).toBe(16); expect(p.crashCount).toBe(0);
    expect(p.finishTick).toBe(-1); expect(s.state.raceId).toBeGreaterThan(id);
  });
  it('migrates host ownership and releases disconnected lobby slots', () => {
    const s = pair(); s.remove('a');
    expect(s.state.hostId).toBe('b'); expect(s.state.players.size).toBe(1);
  });
  it('marks unfinished racers DNF at timeout without trusting finish messages', () => {
    const s = pair(); s.state.phase = 'racing'; s.state.startTick = 0;
    s.step(10801, new Map());
    expect(s.state.phase).toBe('results'); expect(s.state.players.get('a')!.status).toBe('dnf');
  });
  it('removes slow loaders and cancels the countdown if fewer than two remain', () => {
    const s = pair(); s.ready('a', true); s.ready('b', true); s.start('a');
    s.loaded('a', s.state.courseHash, s.state.raceId); s.step(1801, new Map());
    expect(s.state.phase).toBe('lobby'); expect(s.state.players.has('b')).toBe(false); expect(s.state.players.size).toBe(1);
  });
  it('releases disconnected DNF slots when opening the next lobby', () => {
    const s = pair(); const b = s.state.players.get('b')!; b.connected = false; b.status = 'dnf';
    s.state.phase = 'results'; s.again('a'); expect(s.state.players.has('b')).toBe(false); expect(s.state.players.size).toBe(1);
  });
});
