import * as THREE from 'three';
import { addCaustics } from './caustics.js';
import { SUITS } from '../../shared/constants.js';

const mat = (color, opts = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.05, transparent: true, ...opts });
const sphere = (r, m, sx = 1, sy = 1, sz = 1) => {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(r, 20, 14), m);
  mesh.scale.set(sx, sy, sz);
  return mesh;
};

function eyes(group, x, y, z, size = 0.12) {
  const white = mat(0xffffff), black = mat(0x111111);
  for (const s of [1, -1]) {
    const e = sphere(size, white); e.position.set(x, y, z * s);
    const p = sphere(size * 0.55, black); p.position.set(x + size * 0.55, y, z * s + s * size * 0.3);
    group.add(e, p);
  }
}

function fishTail(color, len = 0.6, h = 0.5) {
  const g = new THREE.Group();
  const m = mat(color);
  const shape = new THREE.Shape();
  shape.moveTo(0, 0); shape.lineTo(-len, h); shape.quadraticCurveTo(-len * 0.7, 0, -len, -h); shape.lineTo(0, 0);
  const mesh = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: 0.08, bevelEnabled: false }), m);
  mesh.position.z = -0.04;
  g.add(mesh);
  return g;
}

// ---------- animals (face +X) ----------
function shark() {
  const g = new THREE.Group();
  const grey = mat(0x7d8ea0), belly = mat(0xe8eef3);
  g.add(sphere(0.5, grey, 2.4, 0.85, 0.85));
  const b = sphere(0.48, belly, 2.2, 0.6, 0.75); b.position.y = -0.14; g.add(b);
  const fin = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.75, 4), grey);
  fin.position.set(-0.1, 0.62, 0); fin.rotation.z = 0.35; fin.scale.z = 0.25; g.add(fin);
  for (const s of [1, -1]) {
    const pf = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.6, 4), grey);
    pf.position.set(0.2, -0.3, 0.3 * s); pf.rotation.set(1.2 * s, 0, 2.2); pf.scale.z = 0.3; g.add(pf);
  }
  const tail = fishTail(0x7d8ea0, 0.8, 0.65); tail.position.x = -1.1; g.add(tail);
  eyes(g, 0.85, 0.12, 0.28, 0.08);
  g.userData.tail = tail;
  return g;
}

function clownfish() {
  const g = new THREE.Group();
  const orange = mat(0xff7417), white = mat(0xffffff), black = mat(0x1a1a1a);
  g.add(sphere(0.42, orange, 1.45, 1, 0.6));
  for (const x of [0.32, -0.12, -0.5]) {
    const s = sphere(0.42, white, 0.16, x === -0.5 ? 0.6 : 0.95, 0.63); s.position.x = x; g.add(s);
    const e = sphere(0.42, black, 0.2, x === -0.5 ? 0.62 : 0.97, 0.6); e.position.x = x - 0.02; g.add(e);
  }
  const tail = fishTail(0xff7417, 0.4, 0.35); tail.position.x = -0.55; g.add(tail);
  const fin = sphere(0.25, orange, 1.2, 0.6, 0.12); fin.position.set(-0.05, 0.4, 0); g.add(fin);
  eyes(g, 0.42, 0.1, 0.18, 0.09);
  g.userData.tail = tail;
  return g;
}

function puffer() {
  const g = new THREE.Group();
  const body = mat(0xe9c46a), spot = mat(0x8a6d2b), spikeM = mat(0xf4e3b1);
  const core = new THREE.Group(); g.add(core);
  core.add(sphere(0.62, body));
  for (let i = 0; i < 8; i++) {
    const s = sphere(0.08, spot);
    const a = (i / 8) * Math.PI * 2;
    s.position.set(Math.cos(a) * 0.35 - 0.1, 0.4 + Math.sin(a) * 0.1, Math.sin(a) * 0.45);
    core.add(s);
  }
  const spikes = new THREE.Group();
  const cone = new THREE.ConeGeometry(0.06, 0.28, 5);
  for (let i = 0; i < 40; i++) {
    const m = new THREE.Mesh(cone, spikeM);
    const v = new THREE.Vector3().randomDirection();
    m.position.copy(v.clone().multiplyScalar(0.62));
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), v);
    spikes.add(m);
  }
  spikes.scale.setScalar(0.4);
  core.add(spikes);
  const tail = fishTail(0xe9c46a, 0.35, 0.3); tail.position.x = -0.6; g.add(tail);
  eyes(core, 0.5, 0.18, 0.25, 0.12);
  g.userData.tail = tail; g.userData.spikes = spikes; g.userData.core = core;
  return g;
}

function octopus() {
  const g = new THREE.Group();
  const m = mat(0xc2416b), m2 = mat(0xe57a9b);
  const head = sphere(0.55, m, 1.25, 1, 0.95); head.position.set(-0.25, 0.25, 0); g.add(head);
  const tents = [];
  for (let i = 0; i < 8; i++) {
    const pivot = new THREE.Group();
    const a = (i / 8) * Math.PI * 2;
    pivot.position.set(0.2, -0.15, 0);
    pivot.rotation.set(Math.cos(a) * 0.6, Math.sin(a) * 0.6, 0);
    const t = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.12, 1.1, 6), i % 2 ? m : m2);
    t.position.x = 0.0; t.position.y = -0.0;
    t.rotation.z = Math.PI / 2; t.position.x = 0.55;
    pivot.add(t);
    g.add(pivot);
    tents.push(pivot);
  }
  g.rotation.z = 0;
  // put tentacles trailing behind (octopus swims mantle first)
  g.children.forEach(c => c !== head && c.rotation && (c.rotation.y += Math.PI));
  eyes(g, 0.15, 0.2, 0.3, 0.11);
  g.userData.tents = tents;
  return g;
}

function turtle() {
  const g = new THREE.Group();
  const shellM = mat(0x3f7d3a), skin = mat(0x9bbf6a), rim = mat(0xc9b26b);
  const shell = sphere(0.7, shellM, 1.25, 0.6, 1); shell.position.y = 0.1; g.add(shell);
  const under = sphere(0.68, rim, 1.2, 0.3, 0.95); under.position.y = -0.05; g.add(under);
  const head = sphere(0.24, skin, 1.3, 1, 1); head.position.set(0.95, 0.1, 0); g.add(head);
  eyes(g, 1.1, 0.18, 0.13, 0.06);
  const flips = [];
  for (const [x, z] of [[0.45, 0.6], [0.45, -0.6], [-0.5, 0.5], [-0.5, -0.5]]) {
    const f = sphere(0.22, skin, 1.6, 0.25, 0.8); f.position.set(x, -0.02, z); g.add(f); flips.push(f);
  }
  g.userData.flips = flips; g.userData.shell = shell;
  return g;
}

function eel() {
  const g = new THREE.Group();
  const m = mat(0x5d7f2a), m2 = mat(0xa7c957);
  const segs = [];
  for (let i = 0; i < 9; i++) {
    const r = 0.32 - i * 0.025;
    const s = sphere(r, i % 2 ? m : m2, 1.4, 1, 1);
    s.position.x = 0.6 - i * 0.38;
    g.add(s); segs.push(s);
  }
  eyes(g, 0.8, 0.12, 0.17, 0.07);
  g.userData.segs = segs;
  return g;
}

const BUILDERS = { shark, clownfish, puffer, octopus, turtle, eel };

// ---------- the toy diver ----------
function diver(suitName) {
  const root = new THREE.Group();
  const body = new THREE.Group(); root.add(body);
  const suit = mat(SUITS[suitName] || SUITS.yellow);
  const brass = mat(0xc9a227, { metalness: 0.8, roughness: 0.3 });
  const dark = mat(0x333a44), glass = mat(0x9fe8ff, { opacity: 0.6, metalness: 0.3, roughness: 0.1 });

  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.42, 0.7, 6, 14), suit);
  torso.rotation.z = Math.PI / 2; body.add(torso);
  const helmet = sphere(0.5, brass); helmet.position.set(0.85, 0.12, 0); body.add(helmet);
  const port = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.12, 20), glass);
  port.rotation.z = Math.PI / 2; port.position.set(1.3, 0.12, 0); body.add(port);
  for (const s of [1, -1]) {
    const side = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.1, 16), glass);
    side.rotation.x = Math.PI / 2; side.position.set(0.9, 0.15, 0.47 * s); body.add(side);
  }
  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.08, 8, 20), brass);
  collar.rotation.y = Math.PI / 2; collar.position.x = 0.48; body.add(collar);
  for (const z of [0.15, -0.15]) {
    const tank = new THREE.Mesh(new THREE.CapsuleGeometry(0.14, 0.6, 4, 10), dark);
    tank.rotation.z = Math.PI / 2; tank.position.set(-0.05, 0.48, z); body.add(tank);
  }
  const legs = [];
  for (const z of [0.18, -0.18]) {
    const leg = new THREE.Group(); leg.position.set(-0.75, 0, z);
    const l = new THREE.Mesh(new THREE.CapsuleGeometry(0.15, 0.45, 4, 8), suit);
    l.rotation.z = Math.PI / 2; l.position.x = -0.3; leg.add(l);
    const fin = sphere(0.22, dark, 1.6, 0.25, 0.9); fin.position.x = -0.75; leg.add(fin);
    body.add(leg); legs.push(leg);
  }
  // spear gun, aimed independently
  const gun = new THREE.Group(); gun.position.set(0.2, -0.15, 0.45);
  const barrel = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.12, 0.12), dark); barrel.position.x = 0.55; gun.add(barrel);
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.3, 0.1), dark); grip.position.set(0.15, -0.15, 0); gun.add(grip);
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.25, 6), brass); tip.rotation.z = -Math.PI / 2; tip.position.x = 1.2; gun.add(tip);
  root.add(gun);
  const stars = new THREE.Group();
  for (let i = 0; i < 3; i++) {
    const st = new THREE.Mesh(new THREE.OctahedronGeometry(0.12), mat(0xffe066, { emissive: 0xffd000 }));
    st.position.set(Math.cos(i * 2.1) * 0.6, 1, Math.sin(i * 2.1) * 0.6); stars.add(st);
  }
  stars.visible = false; root.add(stars);
  root.userData = { body, legs, gun, stars, suitMat: suit };
  return root;
}

export function createModel(p) {
  const g = p.r === 'diver' ? diver(p.s) : BUILDERS[p.k]();
  const wrap = new THREE.Group();
  wrap.add(g);
  wrap.userData = { inner: g, role: p.r, kind: p.k, suit: p.s, flash: 0, swing: 0, mats: [] };
  wrap.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; addCaustics(o.material, 0.8); wrap.userData.mats.push(o.material); } });
  // de-dupe materials
  wrap.userData.mats = [...new Set(wrap.userData.mats)];
  wrap.userData.baseEmissive = wrap.userData.mats.map(m => m.emissive.getHex());
  wrap.userData.baseOpacity = wrap.userData.mats.map(m => m.opacity);
  return wrap;
}

export function setSuit(wrap, suit) {
  const ud = wrap.userData.inner.userData;
  if (ud.suitMat) ud.suitMat.color.setHex(SUITS[suit] || SUITS.yellow);
  wrap.userData.suit = suit;
}

// angle lerp that takes the short way round
function turn(cur, tgt, k) {
  let d = tgt - cur;
  d = Math.atan2(Math.sin(d), Math.cos(d));
  return cur + d * k;
}

// animate per frame. p.a is the aim direction [x,y,z]; models are built facing +X.
export function animateModel(wrap, p, t, dt, { faded }) {
  const ud = wrap.userData, inner = ud.inner, iu = inner.userData;
  const speed = Math.hypot(p.vx, p.vy, p.vz || 0);
  const fx = new Set(p.fx || []);
  const k = Math.min(1, dt * 10);

  // face the aim for the diver; fish face where they swim (or aim when idle)
  let dir = p.a;
  if (ud.role !== 'diver' && speed > 1.2) dir = [p.vx, p.vy, p.vz];
  const yaw = Math.atan2(-dir[2], dir[0]);
  const pitch = Math.max(-1.1, Math.min(1.1, Math.atan2(dir[1], Math.hypot(dir[0], dir[2]))));
  inner.rotation.order = 'YZX';
  inner.rotation.y = turn(inner.rotation.y, yaw, k);
  inner.rotation.z += (pitch * (ud.role === 'diver' ? 0.7 : 1) - inner.rotation.z) * k;

  if (ud.role === 'diver') {
    iu.body.rotation.x = Math.sin(t * 1.5) * 0.06;
    iu.legs.forEach((l, i) => (l.rotation.z = Math.sin(t * (4 + speed) + i * Math.PI) * 0.35));
    let ang = pitch * 0.3;
    if (ud.swing > 0) { ang += Math.sin((1 - ud.swing / 0.3) * Math.PI) * 1.4; ud.swing -= dt; }
    iu.gun.rotation.z = ang;
    iu.stars.visible = fx.has('stun');
    iu.stars.rotation.y = t * 5;
  } else {
    if (iu.tail) iu.tail.rotation.y = Math.sin(t * (6 + speed * 1.5)) * 0.5;
    if (iu.tents) iu.tents.forEach((tn, i) => (tn.rotation.z = Math.sin(t * 5 + i) * 0.25));
    if (iu.flips) iu.flips.forEach((f, i) => (f.rotation.y = Math.sin(t * 4 + (i % 2) * Math.PI) * 0.6));
    if (iu.segs) iu.segs.forEach((s, i) => (s.position.z = Math.sin(t * 6 - i * 0.7) * 0.14 * (i / 4)));
    if (iu.spikes) {
      const puffed = fx.has('puff');
      const tgt = puffed ? 1.6 : 1;
      const cur = iu.core.scale.x;
      iu.core.scale.setScalar(cur + (tgt - cur) * Math.min(1, dt * 8));
      iu.spikes.scale.setScalar(puffed ? 1 : 0.4);
    }
  }
  const stretch = fx.has('zoom') || fx.has('boost') ? 1.25 : 1;
  inner.scale.x += (stretch - inner.scale.x) * Math.min(1, dt * 8);

  // effect tint / damage flash
  ud.flash = Math.max(0, ud.flash - dt);
  const glow = ud.flash > 0 ? 0xffffff : fx.has('flare') ? 0xffaa33 : fx.has('shell') ? 0x2266ff : fx.has('frenzy') ? 0xaa1100 : fx.has('stun') ? 0x666600 : null;
  ud.mats.forEach((m, i) => {
    m.emissive.setHex(glow ?? ud.baseEmissive[i]);
    m.emissiveIntensity = ud.flash > 0 ? 0.9 : 0.6;
    m.opacity = ud.baseOpacity[i] * (faded ? 0.18 : 1);
  });
}
