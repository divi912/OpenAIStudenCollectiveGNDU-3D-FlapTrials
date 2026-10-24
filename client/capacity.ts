import type { ServerHealth } from '../shared/server-health';

export function capacityTemplate(): string {
  return `<section class="server-capacity" id="server-capacity" aria-labelledby="capacity-title" data-status="checking">
    <div class="capacity-intro"><span class="eyebrow">THE AIRPORT BOARD</span><h2 id="capacity-title">Room for your flock.</h2><p id="capacity-message">Checking the multiplayer server. Solo practice is always available.</p><span class="capacity-state" id="capacity-state" role="status">Checking server</span></div>
    <div class="capacity-stats"><div><span>ROOMS IN USE</span><strong id="capacity-rooms">—</strong><small id="capacity-room-limit">Live room occupancy</small></div><div><span>ROOM SLOTS FREE</span><strong id="capacity-free">—</strong><small>For new private or public rooms</small></div><div><span>RACERS IN ROOMS</span><strong id="capacity-players">—</strong><small id="capacity-party-size">Up to 8 birds per room</small></div><div class="capacity-meter" role="meter" aria-label="Room occupancy" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0" hidden><i id="capacity-fill"></i></div></div>
    <div class="capacity-footer"><div><strong id="capacity-public">Public race seats: checking</strong><small id="capacity-updated">Updates once a minute while this page is open.</small></div><div class="capacity-actions"><button class="button secondary" data-action="refresh-status" id="capacity-refresh">Refresh status</button><button class="button primary" data-action="create" id="capacity-host">Host a private race</button><button class="text-button" data-action="join">Join by code</button></div></div>
  </section>`;
}

export function updateCapacity(health: ServerHealth | undefined, state: 'checking' | 'ready' | 'offline', checkedAt = 0) {
  const panel = document.getElementById('server-capacity'); if (!panel) return;
  const text = (id: string, value: string) => { const node = document.getElementById(id); if (node) node.textContent = value; };
  const capacity = health?.capacity, ready = state === 'ready' && !!health && !!capacity;
  const full = ready && !capacity.acceptingNewRooms;
  panel.dataset.status = ready ? full ? 'full' : 'online' : state;
  text('capacity-state', ready ? full ? 'New rooms full' : 'Multiplayer online' : state === 'checking' ? 'Checking server' : 'Server waking or unavailable');
  text('capacity-message', ready ? full ? 'New room slots are busy. Join a friend by code or take an open public seat.' : 'Bring 2–8 friends, share a room code and race. All six courses are open.' : state === 'checking' ? 'Checking the multiplayer server. Solo practice is always available.' : 'The free server may be waking up. Check again shortly, or fly solo while you wait.');
  text('capacity-rooms', ready ? `${health.rooms} / ${capacity.maxRooms}` : '—');
  text('capacity-free', ready ? String(Math.max(0, capacity.maxRooms - health.rooms)) : '—');
  text('capacity-players', ready ? String(health.players) : '—');
  text('capacity-room-limit', ready ? `Server limit: ${capacity.maxRooms} rooms` : 'Live room occupancy');
  text('capacity-party-size', ready ? `Up to ${capacity.maxPlayersPerRoom} birds per room` : 'Up to 8 birds per room');
  text('capacity-public', ready ? `${capacity.availablePublicSeats} open seats in public lobbies` : 'Public race seats: unavailable');
  text('capacity-updated', checkedAt ? `Checked ${new Date(checkedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · updates every minute` : 'Updates once a minute while this page is open.');
  const host = document.getElementById('capacity-host') as HTMLButtonElement | null;
  if (host) host.disabled = !!full;
  const meter = panel.querySelector<HTMLElement>('.capacity-meter');
  if (meter) {
    meter.hidden = !ready;
    const percent = ready ? Math.max(0, Math.min(100, health.rooms / Math.max(1, capacity.maxRooms) * 100)) : 0;
    meter.setAttribute('aria-valuenow', String(Math.round(percent)));
    meter.setAttribute('aria-valuetext', ready ? `${health.rooms} of ${capacity.maxRooms} rooms occupied` : 'Unknown');
    document.getElementById('capacity-fill')?.style.setProperty('width', `${percent}%`);
  }
}
