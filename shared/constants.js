// Shared between server and client. The tank is a 3D box: x = width, y = height, z = depth.
export const TANK = { minX: -22, maxX: 22, minY: 0.6, maxY: 15, minZ: -10, maxZ: 10 };

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
  { x: -12, z: 3, r: 1.6, push: 30 },
  { x: 4, z: -5, r: 1.6, push: 30 },
  { x: -1, z: 6, r: 1.4, push: 30 },
];
// castle against the back wall; fish swim in through the front arches, the diver doesn't fit
export const CAVE = { minX: 11, maxX: 19, minY: 0, maxY: 4.2, minZ: -10, maxZ: -4 };
export const SEAWEED = [
  { x: -18, z: -6, r: 2.6, h: 7 },
  { x: -4, z: -7, r: 2.3, h: 6 },
  { x: 9, z: 5, r: 2.2, h: 8 },
  { x: -10, z: 7, r: 2.0, h: 6.5 },
];
export const ANEMONE = { x: -7, y: 1.2, z: 0, r: 2.3, healEvery: 3 };

export const dist3 = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
