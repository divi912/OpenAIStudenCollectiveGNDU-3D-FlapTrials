import { Schema, MapSchema, defineTypes } from '@colyseus/schema';
import { createRacer } from './physics';
import { PHYSICS_VERSION, PROTOCOL_VERSION, type RacerState, type RacerStatus, type RoomPhase } from './protocol';

export class FlightInput extends Schema {
  sequence = 0; tick = 0; steer: -1 | 0 | 1 = 0; flapPressed = false; diveHeld = false; raceId = 0;
}
defineTypes(FlightInput, { sequence: 'uint32', tick: 'uint32', steer: 'int8', flapPressed: 'boolean', diveHeld: 'boolean', raceId: 'uint32' });

export const SIM_FIELDS = ['playerId', 'x', 'y', 'z', 'vx', 'vy', 'speed', 'checkpointIndex', 'sectionProgress', 'crashCount', 'status', 'nextFlapTick', 'respawnTick', 'finishTick', 'finishFraction', 'lastProcessedSequence', 'simulationTick', 'crashCause', 'boostUntilTick', 'shieldUntilTick', 'pickupMask'] as const;
export class PlayerSchema extends Schema implements RacerState {
  playerId = ''; x = 0; y = 6; z = 0; vx = 0; vy = 0; speed = 16;
  checkpointIndex = 0; sectionProgress = 0; crashCount = 0; status: RacerStatus = 'racing';
  nextFlapTick = 0; respawnTick = 0; finishTick = -1; finishFraction = 0; lastProcessedSequence = -1; simulationTick = -1;
  crashCause = '';
  boostUntilTick = 0; shieldUntilTick = 0; pickupMask = 0;
  name = 'Little Bird'; color = '#ffcc42'; ready = false; loaded = false; connected = true;
  reset() { Object.assign(this, createRacer(this.playerId)); this.ready = false; this.loaded = false; }
}
defineTypes(PlayerSchema, {
  playerId: 'string', x: 'float64', y: 'float64', z: 'float64', vx: 'float64', vy: 'float64', speed: 'float64',
  checkpointIndex: 'uint8', sectionProgress: 'float64', crashCount: 'uint16', status: 'string',
  nextFlapTick: 'float64', respawnTick: 'float64', finishTick: 'float64', finishFraction: 'float64', lastProcessedSequence: 'float64', simulationTick: 'float64',
  name: 'string', color: 'string', ready: 'boolean', loaded: 'boolean', connected: 'boolean',
  crashCause: 'string',
  boostUntilTick: 'float64', shieldUntilTick: 'float64', pickupMask: 'uint32',
});
export class RaceSchema extends Schema {
  code = ''; raceId = 1; phase: RoomPhase = 'lobby'; hostId = ''; isPublic = false;
  courseId = 'skyline_sprint'; courseHash = ''; physicsVersion = PHYSICS_VERSION; protocolVersion = PROTOCOL_VERSION;
  tick = 0; startTick = 0; deadline = 0; players = new MapSchema<PlayerSchema>();
}
defineTypes(RaceSchema, {
  code: 'string', raceId: 'uint32', phase: 'string', hostId: 'string', isPublic: 'boolean',
  courseId: 'string', courseHash: 'string', physicsVersion: 'string', protocolVersion: 'uint8',
  tick: 'float64', startTick: 'float64', deadline: 'float64', players: { map: PlayerSchema },
});
