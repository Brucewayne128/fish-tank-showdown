import {
  TANK, ROUND_TIME, SUIT_PICK_TIME, END_TIME, DIVER, ANIMAL_HP, BITE, ANIMALS, SUITS,
  BUBBLE_COLUMNS, CAVES, SEAWEED, ANEMONES, HEAL_EVERY, BOOST, FLARE_TIME, dist3,
} from '../shared/constants.js';

const BOT_NAMES = ['Bubbles', 'Finn', 'Coral', 'Gill', 'Splash', 'Kelp', 'Pebble', 'Squirt'];
const ANIMAL_KINDS = Object.keys(ANIMALS);
const MAX_PLAYERS = 10;

let nextId = 1;
const rand = (a, b) => a + Math.random() * (b - a);
const norm = (x, y, z) => { const l = Math.hypot(x, y, z) || 1; return { x: x / l, y: y / l, z: z / l }; };

function inBox(c, x, y, z, pad) {
  return x > c.minX - pad && x < c.maxX + pad && y > c.minY - pad && y < c.maxY + pad
    && z > c.minZ - pad && z < c.maxZ + pad;
}
// returns the cave the point is in (or null)
export function inCave(x, y, z, pad = 0) {
  return CAVES.find(c => inBox(c, x, y, z, pad)) || null;
}
const nearest = (list, p) => list.reduce((b, c) => {
  const d = Math.hypot((c.x ?? (c.minX + c.maxX) / 2) - p.x, (c.z ?? (c.minZ + c.maxZ) / 2) - p.z);
  return d < b.d ? { c, d } : b;
}, { c: list[0], d: Infinity }).c;
export function inSeaweed(x, y, z) {
  return SEAWEED.some(s => Math.hypot(x - s.x, z - s.z) < s.r && y < s.h);
}

export class Room {
  constructor(code, onEmpty) {
    this.code = code;
    this.onEmpty = onEmpty;
    this.players = new Map();
    this.phase = 'lobby';
    this.timer = 0;
    this.spears = [];
    this.inks = [];
    this.events = [];
    this.hostId = null;
    this.diverId = null;
    this.result = null;
    this.spearId = 1;
    this.sendAcc = 0;
  }

  get humans() { return [...this.players.values()].filter(p => !p.bot); }
  get full() { return this.players.size >= MAX_PLAYERS; }

  addPlayer(ws, name, kind) {
    const p = this.makePlayer(name, ANIMALS[kind] ? kind : 'clownfish', ws);
    this.players.set(p.id, p);
    if (!this.hostId) this.hostId = p.id;
    if (this.phase !== 'lobby') { p.role = 'spectator'; p.alive = false; }
    this.send(p, { t: 'welcome', id: p.id, room: this.code });
    return p;
  }

  addBot() {
    if (this.full || this.phase !== 'lobby') return;
    const used = new Set([...this.players.values()].map(p => p.name));
    const name = BOT_NAMES.find(n => !used.has(n)) || 'Bot' + nextId;
    const kind = ANIMAL_KINDS[Math.floor(Math.random() * ANIMAL_KINDS.length)];
    const p = this.makePlayer(name, kind, null);
    p.bot = true;
    this.players.set(p.id, p);
  }

  removeBot() {
    const bot = [...this.players.values()].reverse().find(p => p.bot);
    if (bot && this.phase === 'lobby') this.players.delete(bot.id);
  }

  makePlayer(name, kind, ws) {
    return {
      id: String(nextId++), name: String(name || 'Player').slice(0, 16), kind, ws, bot: false,
      role: 'animal', suit: 'yellow', x: 0, y: 5, z: 0, vx: 0, vy: 0, vz: 0, hp: ANIMAL_HP, alive: true,
      aim: { x: 1, y: 0, z: 0 },
      input: { mx: 0, my: 0, mz: 0, aim: { x: 1, y: 0, z: 0 }, fire: false, swing: false, ability: false, boost: false },
      cd: { fire: 0, swing: 0, ability: 0, bite: 0, heal: 0, spike: 0 },
      fx: { frenzy: 0, puff: 0, shell: 0, stun: 0, zoom: 0, flare: 0 },
      stamina: 1, tired: false, boosting: false,
      kills: 0, hidden: false, cave: false,
    };
  }

  removePlayer(id) {
    const p = this.players.get(id);
    if (!p) return;
    this.players.delete(id);
    if (this.hostId === id) this.hostId = this.humans[0]?.id || null;
    if (!this.humans.length) { this.onEmpty(this.code); return; }
    if ((this.phase === 'suit' || this.phase === 'play') && id === this.diverId) {
      this.endRound('animals', `${p.name} (the diver) left the tank`);
    }
  }

  handle(p, msg) {
    switch (msg.t) {
      case 'pick':
        if (this.phase === 'lobby' && ANIMALS[msg.kind]) p.kind = msg.kind;
        break;
      case 'suit':
        if (this.phase === 'suit' && p.id === this.diverId && SUITS[msg.suit]) p.suit = msg.suit;
        break;
      case 'start':
        if (p.id === this.hostId && this.phase === 'lobby') this.startRound();
        break;
      case 'bot':
        if (p.id === this.hostId) msg.add ? this.addBot() : this.removeBot();
        break;
      case 'in': {
        // move is a world-space direction (the client turns stick/keys + camera into it), length <= 1
        const i = p.input;
        let mx = +msg.mx || 0, my = +msg.my || 0, mz = +msg.mz || 0;
        const ml = Math.hypot(mx, my, mz);
        if (ml > 1) { mx /= ml; my /= ml; mz /= ml; }
        i.mx = mx; i.my = my; i.mz = mz;
        if (Array.isArray(msg.aim) && msg.aim.length === 3 && msg.aim.every(Number.isFinite)) {
          i.aim = norm(msg.aim[0], msg.aim[1], msg.aim[2]);
        }
        i.fire = !!msg.f; i.swing = !!msg.s; i.ability = !!msg.a; i.boost = !!msg.b;
        break;
      }
    }
  }

  startRound() {
    if (this.players.size < 2) this.addBot();
    const humans = this.humans;
    const diver = humans[Math.floor(Math.random() * humans.length)];
    this.diverId = diver.id;
    this.spears = []; this.inks = []; this.result = null;
    for (const p of this.players.values()) {
      Object.keys(p.cd).forEach(k => (p.cd[k] = 0));
      Object.keys(p.fx).forEach(k => (p.fx[k] = 0));
      p.vx = p.vy = p.vz = 0; p.alive = true; p.kills = 0;
      p.stamina = 1; p.tired = false; p.boosting = false;
      p.input.mx = p.input.my = p.input.mz = 0;
      if (p === diver) {
        p.role = 'diver'; p.hp = DIVER.hp; p.x = -38; p.y = 14; p.z = 0;
        p.aim = p.input.aim = { x: 1, y: 0, z: 0 };
      } else {
        p.role = 'animal'; p.hp = ANIMAL_HP;
        p.x = rand(15, 42); p.y = rand(6, 24); p.z = rand(-12, 16);
        p.aim = p.input.aim = { x: -1, y: 0, z: 0 };
      }
    }
    this.phase = 'suit';
    this.timer = SUIT_PICK_TIME;
    this.events.push({ e: 'diver', id: diver.id });
  }

  endRound(winner, reason) {
    if (this.phase === 'end') return;
    this.phase = 'end';
    this.timer = END_TIME;
    this.result = { winner, reason };
    this.events.push({ e: 'end', winner, reason });
  }

  toLobby() {
    this.phase = 'lobby';
    this.diverId = null;
    this.spears = []; this.inks = [];
    for (const p of this.players.values()) { p.role = 'animal'; p.alive = true; p.hp = ANIMAL_HP; }
  }

  // ---------------- simulation ----------------
  update(dt) {
    if (this.phase === 'suit') {
      this.timer -= dt;
      if (this.timer <= 0) { this.phase = 'play'; this.timer = ROUND_TIME; }
    } else if (this.phase === 'play') {
      this.timer -= dt;
      this.simulate(dt);
      if (this.timer <= 0) this.endRound('animals', 'The diver ran out of air!');
    } else if (this.phase === 'end') {
      this.timer -= dt;
      this.simulate(dt);
      if (this.timer <= 0) this.toLobby();
    }
    this.sendAcc += dt;
    if (this.sendAcc >= 1 / 20) { this.sendAcc = 0; this.broadcastSnap(); }
  }

  simulate(dt) {
    const diver = this.players.get(this.diverId);
    const playing = this.phase === 'play';

    for (const p of this.players.values()) {
      if (!p.alive || p.role === 'spectator') continue;
      for (const k in p.cd) p.cd[k] = Math.max(0, p.cd[k] - dt);
      for (const k in p.fx) p.fx[k] = Math.max(0, p.fx[k] - dt);
      if (p.bot && playing) this.botThink(p, diver, dt);
      this.updateStamina(p, dt);
      this.move(p, dt);
      if (playing) {
        if (p.role === 'diver') this.diverActions(p);
        else this.animalActions(p, diver);
      }
    }

    this.updateSpears(dt);
    this.inks = this.inks.filter(k => (k.life -= dt) > 0);

    if (playing && diver) {
      if (diver.hp <= 0) {
        diver.alive = false;
        this.endRound('animals', `${diver.name} got nibbled to pieces!`);
      } else if (![...this.players.values()].some(p => p.role === 'animal' && p.alive)) {
        this.endRound('diver', `${diver.name} cleared the tank!`);
      }
    }
  }

  updateStamina(p, dt) {
    const i = p.input;
    const moving = Math.hypot(i.mx, i.my, i.mz) > 0.1;
    p.boosting = i.boost && moving && !p.tired && p.stamina > 0 && this.phase === 'play' && !p.fx.stun;
    if (p.boosting) {
      p.stamina = Math.max(0, p.stamina - BOOST.drain * dt);
      if (p.stamina === 0) p.tired = true;
    } else {
      p.stamina = Math.min(1, p.stamina + BOOST.regen * dt);
      if (p.tired && p.stamina >= BOOST.restart) p.tired = false;
    }
  }

  move(p, dt) {
    const isDiver = p.role === 'diver';
    let speed = isDiver ? DIVER.speed : ANIMALS[p.kind].speed;
    if (p.boosting) speed *= BOOST.mult;
    if (p.fx.zoom) speed *= 2.3;
    if (p.fx.puff) speed *= 0.6;
    if (p.fx.shell) speed *= 0.5;
    let { mx, my, mz } = p.input;
    if (p.fx.stun || this.phase !== 'play') { mx = my = mz = 0; }
    const k = Math.min(1, dt * 6);
    p.vx += (mx * speed - p.vx) * k;
    p.vy += (my * speed - p.vy) * k;
    p.vz += (mz * speed - p.vz) * k;

    // bubble columns blow the diver up and away (gentle lift for animals)
    for (const b of BUBBLE_COLUMNS) {
      const dx = p.x - b.x, dz = p.z - b.z, d = Math.hypot(dx, dz);
      if (d < b.r + (isDiver ? DIVER.radius : 0)) {
        if (isDiver) {
          p.vy += b.push * dt;
          const nx = d > 0.01 ? dx / d : 1, nz = d > 0.01 ? dz / d : 0;
          p.vx += nx * b.push * 0.7 * dt; p.vz += nz * b.push * 0.7 * dt;
        } else p.vy += 4 * dt;
      }
    }

    p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
    const r = this.radius(p);
    if (p.x < TANK.minX + r) { p.x = TANK.minX + r; p.vx = Math.max(0, p.vx); }
    if (p.x > TANK.maxX - r) { p.x = TANK.maxX - r; p.vx = Math.min(0, p.vx); }
    if (p.z < TANK.minZ + r) { p.z = TANK.minZ + r; p.vz = Math.max(0, p.vz); }
    if (p.z > TANK.maxZ - r) { p.z = TANK.maxZ - r; p.vz = Math.min(0, p.vz); }
    if (p.y < TANK.minY + r * 0.5) { p.y = TANK.minY + r * 0.5; p.vy = Math.max(0, p.vy); }
    if (p.y > TANK.maxY - r * 0.5) { p.y = TANK.maxY - r * 0.5; p.vy = Math.min(0, p.vy); }

    // the diver is too big for the cave: push out through the nearest open face
    const cave = isDiver && inCave(p.x, p.y, p.z, r);
    if (cave) {
      const CAVE = cave;
      const faces = [
        [p.x - (CAVE.minX - r), 'x', CAVE.minX - r],
        [(CAVE.maxX + r) - p.x, 'x', CAVE.maxX + r],
        [(CAVE.maxY + r) - p.y, 'y', CAVE.maxY + r],
        [(CAVE.maxZ + r) - p.z, 'z', CAVE.maxZ + r],
      ].sort((a, b) => a[0] - b[0]);
      const [, axis, val] = faces[0];
      p[axis] = val;
      p['v' + axis] = 0;
    }

    p.aim = p.input.aim;
    p.hidden = !isDiver && inSeaweed(p.x, p.y, p.z);
    p.cave = !isDiver && !!inCave(p.x, p.y, p.z);
  }

  radius(p) {
    if (p.role === 'diver') return DIVER.radius;
    return ANIMALS[p.kind].radius * (p.fx.puff ? 1.6 : 1);
  }

  diverActions(p) {
    if (p.fx.stun) return;
    const i = p.input, a = i.aim;
    if (i.fire && p.cd.fire <= 0) {
      p.cd.fire = DIVER.spearCd;
      this.spears.push({
        id: this.spearId++, x: p.x + a.x * 1.3, y: p.y + a.y * 1.3, z: p.z + a.z * 1.3,
        vx: a.x * DIVER.spearSpeed, vy: a.y * DIVER.spearSpeed, vz: a.z * DIVER.spearSpeed,
        life: DIVER.spearLife, owner: p.id,
      });
      this.events.push({ e: 'shoot', id: p.id });
    }
    if (i.swing && p.cd.swing <= 0) {
      p.cd.swing = DIVER.swingCd;
      this.events.push({ e: 'swing', id: p.id });
      const cosCone = Math.cos(DIVER.swingCone);
      for (const t of this.players.values()) {
        if (t.role !== 'animal' || !t.alive || t.cave) continue;
        const dx = t.x - p.x, dy = t.y - p.y, dz = t.z - p.z;
        const d = Math.hypot(dx, dy, dz);
        if (d > DIVER.swingRange + this.radius(t)) continue;
        const dot = (dx * a.x + dy * a.y + dz * a.z) / (d || 1);
        if (dot > cosCone || d < 1.4) {
          if (this.damageAnimal(t, DIVER.swingDmg, p, t.x, t.y, t.z)) {
            t.vx += (dx / (d || 1)) * 14; t.vy += (dy / (d || 1)) * 14; t.vz += (dz / (d || 1)) * 14;
          }
        }
      }
    }
    if (i.ability && p.cd.ability <= 0) {
      p.cd.ability = DIVER.abilityCd;
      p.fx.flare = FLARE_TIME;
      this.events.push({ e: 'ability', id: p.id, kind: 'flare' });
    }
  }

  animalActions(p, diver) {
    const i = p.input;
    const def = ANIMALS[p.kind];
    const d = diver && diver.alive ? dist3(p, diver) : Infinity;
    const reach = this.radius(p) + DIVER.radius + BITE.range;

    if (i.fire && p.cd.bite <= 0) {
      p.cd.bite = p.fx.frenzy ? BITE.cd * 0.45 : BITE.cd;
      this.events.push({ e: 'chomp', id: p.id });
      if (d < reach) {
        this.damageDiver(diver, BITE.dmg, p);
        const n = norm(diver.x - p.x, diver.y - p.y, diver.z - p.z);
        diver.vx += n.x * 5; diver.vy += n.y * 5; diver.vz += n.z * 5;
        p.bitAt = 1;
      }
    }
    if (p.fx.puff && d < reach - 0.3 && p.cd.spike <= 0) {
      p.cd.spike = 0.8;
      this.damageDiver(diver, 1, p);
    }
    if (i.ability && p.cd.ability <= 0) {
      p.cd.ability = def.cd;
      switch (p.kind) {
        case 'shark': p.fx.frenzy = 3; break;
        case 'clownfish': p.fx.zoom = 1; break;
        case 'puffer': p.fx.puff = 3; break;
        case 'turtle': p.fx.shell = 2.5; break;
        case 'octopus': this.inks.push({ x: p.x, y: p.y, z: p.z, r: 3.4, life: 4.5 }); break;
        case 'eel':
          if (d < 4.5) { diver.fx.stun = 1.3; this.damageDiver(diver, 1, p); }
          break;
      }
      this.events.push({ e: 'ability', id: p.id, kind: p.kind });
    }
    // anemones heal animals
    if (p.hp < ANIMAL_HP && p.cd.heal <= 0 && ANEMONES.some(an => Math.hypot(p.x - an.x, p.y - an.y, p.z - an.z) < an.r)) {
      p.cd.heal = HEAL_EVERY;
      p.hp = Math.min(ANIMAL_HP, p.hp + 1);
      this.events.push({ e: 'heal', id: p.id });
    }
  }

  damageDiver(diver, dmg, from) {
    if (!diver || !diver.alive) return;
    diver.hp = Math.max(0, diver.hp - dmg);
    this.events.push({ e: 'bite', x: diver.x, y: diver.y, z: diver.z, id: diver.id, by: from.id });
  }

  damageAnimal(a, dmg, from, x, y, z) {
    if (a.fx.shell) { this.events.push({ e: 'block', x, y, z }); return false; }
    a.hp = Math.max(0, a.hp - dmg);
    this.events.push({ e: 'hit', x, y, z, id: a.id });
    if (a.hp <= 0) {
      a.alive = false;
      from.kills++;
      this.events.push({ e: 'kill', id: a.id, by: from.id });
    }
    return true;
  }

  updateSpears(dt) {
    const out = [];
    for (const s of this.spears) {
      s.life -= dt;
      s.x += s.vx * dt; s.y += s.vy * dt; s.z += s.vz * dt;
      let dead = s.life <= 0 || s.x < TANK.minX || s.x > TANK.maxX || s.z < TANK.minZ || s.z > TANK.maxZ
        || s.y < TANK.minY - 0.5 || s.y > TANK.maxY + 1;
      if (!dead && inCave(s.x, s.y, s.z)) { dead = true; this.events.push({ e: 'thunk', x: s.x, y: s.y, z: s.z }); }
      if (!dead && this.inks.some(k => Math.hypot(s.x - k.x, s.y - k.y, s.z - k.z) < k.r)) dead = true;
      if (!dead) {
        for (const a of this.players.values()) {
          if (a.role !== 'animal' || !a.alive || a.cave) continue;
          if (dist3(a, s) < this.radius(a) + DIVER.spearHitPad) {
            if (a.fx.puff) { // bounce off the spikes
              s.vx = -s.vx; s.vy = -s.vy; s.vz = -s.vz; s.life = Math.min(s.life, 0.35);
              s.x += s.vx * dt * 2; s.y += s.vy * dt * 2; s.z += s.vz * dt * 2;
              this.events.push({ e: 'block', x: s.x, y: s.y, z: s.z });
            } else {
              const from = this.players.get(s.owner) || { kills: 0 };
              this.damageAnimal(a, DIVER.spearDmg, from, s.x, s.y, s.z);
              dead = true;
            }
            break;
          }
        }
      }
      if (!dead) out.push(s);
    }
    this.spears = out;
  }

  botThink(p, diver, dt) {
    const i = p.input;
    p.botT = (p.botT || 0) - dt;
    if (!diver || !diver.alive) { i.mx = i.my = i.mz = 0; i.boost = false; return; }
    const dx = diver.x - p.x, dy = diver.y - p.y, dz = diver.z - p.z;
    const d = Math.hypot(dx, dy, dz);
    if (p.botT <= 0) {
      p.botT = rand(0.3, 0.8);
      p.jx = rand(-1.5, 1.5); p.jy = rand(-1.5, 1.5); p.jz = rand(-1.5, 1.5);
      p.flee = p.hp <= 2 && Math.random() < 0.7;
    }
    if (p.bitAt) { p.bitAt = 0; p.retreat = rand(1.4, 2.6); p.rdir = norm(rand(-1, 1), rand(-0.5, 0.5), rand(-1, 1)); }
    p.retreat = Math.max(0, (p.retreat || 0) - dt);
    let tx, ty, tz;
    if (p.retreat > 0) {
      tx = p.x - dx * 2 + p.rdir.x * 4; ty = p.y - dy + p.rdir.y * 3; tz = p.z - dz * 2 + p.rdir.z * 4;
    } else if (p.flee) {
      // retreat to the nearest anemone to heal, or into the nearest cave
      const an = nearest(ANEMONES, p), cave = nearest(CAVES, p);
      const heal = Math.hypot(p.x - an.x, p.z - an.z) < 20;
      tx = heal ? an.x : (cave.minX + cave.maxX) / 2;
      ty = heal ? an.y + 0.5 : 2;
      tz = heal ? an.z : cave.maxZ - 1.5;
    } else { tx = diver.x + p.jx; ty = diver.y + p.jy; tz = diver.z + p.jz; }
    const m = { x: tx - p.x, y: ty - p.y, z: tz - p.z };
    const ml = Math.hypot(m.x, m.y, m.z) || 1;
    const slow = Math.min(1, ml) * 0.65;
    i.mx = (m.x / ml) * slow; i.my = (m.y / ml) * slow; i.mz = (m.z / ml) * slow;
    i.aim = p.retreat > 0 ? norm(m.x, m.y, m.z) : norm(dx, dy, dz);
    i.boost = (p.retreat > 0 || p.flee) && d < 6; // bots boost to escape
    i.fire = p.retreat <= 0 && d < this.radius(p) + DIVER.radius + BITE.range && Math.random() < dt * 1.6;
    i.ability = d < 4 && Math.random() < dt * 0.6;
  }

  // ---------------- networking ----------------
  send(p, msg) {
    if (p.ws && p.ws.readyState === 1) p.ws.send(JSON.stringify(msg));
  }

  broadcastSnap() {
    const r = n => Math.round(n * 100) / 100;
    const snap = {
      t: 'snap', phase: this.phase, time: Math.max(0, Math.round(this.timer * 10) / 10),
      host: this.hostId, diver: this.diverId, result: this.result,
      players: [...this.players.values()].map(p => ({
        id: p.id, n: p.name, k: p.kind, r: p.role, s: p.suit, b: p.bot ? 1 : 0,
        x: r(p.x), y: r(p.y), z: r(p.z), vx: r(p.vx), vy: r(p.vy), vz: r(p.vz),
        hp: p.hp, al: p.alive ? 1 : 0,
        a: [r(p.aim.x), r(p.aim.y), r(p.aim.z)], h: p.hidden ? 1 : 0, c: p.cave ? 1 : 0, kl: p.kills,
        fx: Object.entries(p.fx).filter(([, v]) => v > 0).map(([k]) => k).concat(p.boosting ? ['boost'] : []),
        cd: r(p.cd.ability), st: r(p.stamina), ti: p.tired ? 1 : 0,
      })),
      spears: this.spears.map(s => [s.id, r(s.x), r(s.y), r(s.z), r(s.vx), r(s.vy), r(s.vz)]),
      inks: this.inks.map(k => [r(k.x), r(k.y), r(k.z), k.r, r(k.life)]),
      ev: this.events,
    };
    this.events = [];
    const json = JSON.stringify(snap);
    for (const p of this.players.values()) if (p.ws && p.ws.readyState === 1) p.ws.send(json);
  }
}
