export interface ServerHealth {
  status: 'ok';
  rooms: number;
  players: number;
  capacity?: { maxRooms: number; maxPlayersPerRoom: number; acceptingNewRooms: boolean; availablePublicSeats: number };
}

export function canRequestRoom(health: ServerHealth, mode: 'create' | 'quick' | 'join'): boolean {
  return mode === 'join' || !health.capacity || health.capacity.acceptingNewRooms || (mode === 'quick' && health.capacity.availablePublicSeats > 0);
}
