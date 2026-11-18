// Shared between server and client. The tank is a 3D box: x = width, y = height, z = depth.
// 10x the water of the original 44 x 15 x 20 tank (about 2.15x along each side)
export const TANK = { minX: -47.5, maxX: 47.5, minY: 0.6, maxY: 32, minZ: -21.5, maxZ: 21.5 };

export const ROUND_TIME = 150; // seconds of diver air
export const SUIT_PICK_TIME = 6;
export const END_TIME = 7;
export const TICK = 30;
export const SEND_RATE = 20;

export const DIVER = {
  hp: 10, speed: 6.2, radius: 0.9,
  spearCd: 0.55, spearSpeed: 26, spearLife: 1.3, spearDmg: 2, spearHitPad: 0.35,
  swingCd: 0.7, swingRange: 2.8, swingDmg: 3, swingCone: 1.0, // radians off the aim line
  abilityCd: 10, // flare
};

// Boost: everyone. Drains fast, refills slowly. Once empty you must wait until it's back to `restart`.
export const BOOST = { mult: 1.8, drain: 0.65, regen: 0.12, restart: 0.3 };
export const FLARE_TIME = 4; // diver ability: reveals fish hiding in seaweed / the cave

export const ANIMAL_HP = 6; // spear 2 dmg => 3 hits, swing 3 dmg => 2 hits
export const BITE = { range: 1.0, cd: 1.1, dmg: 1 };

export const ANIMALS = {
  shark:     { name: 'Shark',     speed: 7.4, radius: 1.0, ability: 'Frenzy',  abilityDesc: 'Bite twice as fast for 3s', cd: 9 },
  clownfish: { name: 'Clownfish', speed: 8.0, radius: 0.6, ability: 'Zoom',    abilityDesc: 'Burst of speed',            cd: 4 },
  puffer:    { name: 'Pufferfish',speed: 5.6, radius: 0.8, ability: 'Puff Up', abilityDesc: 'Spears bounce off, spikes hurt the diver', cd: 8 },
  octopus:   { name: 'Octopus',   speed: 6.6, radius: 0.8, ability: 'Ink',     abilityDesc: 'Ink cloud blocks spears and sight', cd: 7 },
  turtle:    { name: 'Turtle',    speed: 5.2, radius: 0.95,ability: 'Shell',   abilityDesc: 'Invulnerable for 2.5s', cd: 9 },
  eel:       { name: 'Eel',       speed: 7.0, radius: 0.7, ability: 'Shock',   abilityDesc: 'Stun a nearby diver', cd: 8 },
};

export const SUITS = {
  yellow: 0xf5c518, orange: 0xff7a1a, red: 0xe23b3b, teal: 0x1fb5a8, purple: 0x8a4fff,
};

// Tank features (all 3D)
export const BUBBLE_COLUMNS = [
  { x: -26, z: 6, r: 1.8, push: 30 },
  { x: 9, z: -11, r: 1.8, push: 30 },
  { x: -2, z: 13, r: 1.6, push: 30 },
  { x: 28, z: 8, r: 1.8, push: 30 },
  { x: -40, z: -10, r: 1.6, push: 30 },
  { x: 40, z: -4, r: 1.6, push: 30 },
];
// castles against the back wall; fish swim in through the front arches, the diver doesn't fit
export const CAVES = [
  { minX: 24, maxX: 32, minY: 0, maxY: 4.2, minZ: -21.5, maxZ: -15.5 },
  { minX: -36, maxX: -28, minY: 0, maxY: 4.2, minZ: -21.5, maxZ: -15.5 },
];
export const SEAWEED = [
  { x: -39, z: -13, r: 3.2, h: 12 },
  { x: -9, z: -15, r: 3.0, h: 10 },
  { x: 19, z: 11, r: 2.8, h: 14 },
  { x: -22, z: 15, r: 2.6, h: 11 },
  { x: 40, z: 15, r: 3.0, h: 12 },
  { x: 6, z: 2, r: 2.4, h: 9 },
  { x: -33, z: 3, r: 2.4, h: 10 },
  { x: 35, z: -12, r: 2.6, h: 13 },
  { x: -6, z: 17, r: 2.2, h: 8 },
];
export const ANEMONES = [
  { x: -15, y: 1.2, z: 0, r: 2.5 },
  { x: 16, y: 1.2, z: -2, r: 2.5 },
];
export const HEAL_EVERY = 3;

export const dist3 = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
