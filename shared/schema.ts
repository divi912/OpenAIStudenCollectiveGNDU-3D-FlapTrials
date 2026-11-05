import { Schema, MapSchema, defineTypes } from '@colyseus/schema';
import { BOOST, createRacer } from './physics';
import { PHYSICS_VERSION, PROTOCOL_VERSION, type RacerState, type RacerStatus, type RoomPhase } from './protocol';

export class FlightInput extends Schema {
  sequence = 0; tick = 0; steer: -1 | 0 | 1 = 0; flapPressed = false; diveHeld = false; boostHeld = false; raceId = 0; pitch: -1 | 0 | 1 = 0; roll: -1 | 0 | 1 = 0;
}
defineTypes(FlightInput, { sequence: 'uint32', tick: 'uint32', steer: 'int8', flapPressed: 'boolean', diveHeld: 'boolean', boostHeld: 'boolean', raceId: 'uint32', pitch: 'int8', roll: 'int8' });

export const SIM_FIELDS = ['playerId', 'x', 'y', 'z', 'vx', 'vy', 'speed', 'checkpointIndex', 'sectionProgress', 'crashCount', 'status', 'nextFlapTick', 'respawnTick', 'finishTick', 'finishFraction', 'lastProcessedSequence', 'simulationTick', 'crashCause', 'boostUntilTick', 'shieldUntilTick', 'pickupMask', 'boostReserve', 'boostCooldownUntilTick', 'boostActive', 'boostRewardZ', 'heading', 'pitch', 'roll', 'rollTravel', 'trickCount', 'gatesCleared', 'cleanStreak', 'bestStreak', 'styleScore', 'flapPoints', 'boughtMask', 'loadoutMask', 'guardCharges', 'jammerCharges', 'shopUntilTick', 'shopReady', 'midShopVisited', 'jammedUntilTick', 'jamImmuneUntilTick'] as const;
export class PlayerSchema extends Schema implements RacerState {
  playerId = ''; x = 0; y = 6; z = 0; vx = 0; vy = 0; speed = 16;
  checkpointIndex = 0; sectionProgress = 0; crashCount = 0; status: RacerStatus = 'racing';
  nextFlapTick = 0; respawnTick = 0; finishTick = -1; finishFraction = 0; lastProcessedSequence = -1; simulationTick = -1;
  crashCause = '';
  boostUntilTick = 0; shieldUntilTick = 0; pickupMask = 0;
  boostReserve = BOOST.initial; boostCooldownUntilTick = 0; boostActive = false; boostRewardZ = -1;
  heading = 0; pitch = 0; roll = 0; rollTravel = 0; trickCount = 0;
  gatesCleared = 0; cleanStreak = 0; bestStreak = 0; styleScore = 0;
  flapPoints = 100; boughtMask = 0; loadoutMask = 0; guardCharges = 0; jammerCharges = 0;
  shopUntilTick = 0; shopReady = false; midShopVisited = false; jammedUntilTick = 0; jamImmuneUntilTick = 0;
  name = 'Little Bird'; color = '#ffcc42'; ready = false; loaded = false; connected = true;
  reset() { Object.assign(this, createRacer(this.playerId)); this.ready = false; this.loaded = false; }
}
defineTypes(PlayerSchema, {
  playerId: 'string', x: 'float64', y: 'float64', z: 'float64', vx: 'float64', vy: 'float64', speed: 'float64',
  checkpointIndex: 'uint8', sectionProgress: 'float64', crashCount: 'uint16', status: 'string',
  nextFlapTick: 'float64', respawnTick: 'float64', finishTick: 'float64', finishFraction: 'float64', lastProcessedSequence: 'float64', simulationTick: 'float64',
  name: 'string', color: 'string', ready: 'boolean', loaded: 'boolean', connected: 'boolean',
  flapPoints: 'uint16', boughtMask: 'uint8', loadoutMask: 'uint8', guardCharges: 'uint8', jammerCharges: 'uint8',
  shopUntilTick: 'float64', shopReady: 'boolean', midShopVisited: 'boolean', jammedUntilTick: 'float64', jamImmuneUntilTick: 'float64',
  crashCause: 'string',
  boostUntilTick: 'float64', shieldUntilTick: 'float64', pickupMask: 'uint32',
  boostReserve: 'float64', boostCooldownUntilTick: 'float64', boostActive: 'boolean', boostRewardZ: 'float64',
  heading: 'float64', pitch: 'float64', roll: 'float64', rollTravel: 'float64', trickCount: 'uint16', gatesCleared: 'uint16', cleanStreak: 'uint16', bestStreak: 'uint16', styleScore: 'uint32',
});
export class RaceSchema extends Schema {
  code = ''; raceId = 1; phase: RoomPhase = 'lobby'; hostId = ''; isPublic = false;
  courseId = 'skyline_sprint'; courseHash = ''; physicsVersion = PHYSICS_VERSION; protocolVersion = PROTOCOL_VERSION;
  tick = 0; startTick = 0; deadline = 0; shopRound = 0; shopStartedTick = 0; players = new MapSchema<PlayerSchema>();
}
defineTypes(RaceSchema, {
  code: 'string', raceId: 'uint32', phase: 'string', hostId: 'string', isPublic: 'boolean',
  courseId: 'string', courseHash: 'string', physicsVersion: 'string', protocolVersion: 'uint8',
  tick: 'float64', startTick: 'float64', deadline: 'float64', shopRound: 'uint8', shopStartedTick: 'float64', players: { map: PlayerSchema },
});
