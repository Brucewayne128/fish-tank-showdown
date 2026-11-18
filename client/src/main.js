import * as THREE from 'three';
import './style.css';
import { buildScene } from './scene.js';
import { createModel, animateModel, setSuit } from './models.js';
import { Input } from './input.js';
import { sfx } from './audio.js';
import {
  TANK, ROUND_TIME, DIVER, ANIMAL_HP, ANIMALS, SUITS, BOOST,
} from '../../shared/constants.js';

const $ = id => document.getElementById(id);
const EMOJI = { shark: '🦈', clownfish: '🐠', puffer: '🐡', octopus: '🐙', turtle: '🐢', eel: '🐍' };
const store = {
  get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};

// ---------------- state ----------------
const S = {
  ws: null, myId: null, room: null, kind: store.get('tw_kind') || 'clownfish',
  name: store.get('tw_name') || '', snap: null, prevSnap: null, snapAt: 0, prevAt: 0,
  phase: 'home', me: { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, init: false }, mySuit: 'yellow',
  models: new Map(), labels: new Map(), spears: new Map(), inks: [], particles: [],
  shake: 0, lastRole: null,
};

// ---------------- three ----------------
const { renderer, scene, camera, animate: animateScene } = buildScene($('game'));
const input = new Input($('game'));

function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

// ---------------- screens ----------------
const SCREENS = ['home', 'lobby', 'suit', 'end'];
function show(name) {
  SCREENS.forEach(s => $(s).classList.toggle('hidden', s !== name));
  const inGame = name === null || name === 'end';
  $('hud').classList.toggle('hidden', !inGame);
  $('touch').classList.toggle('hidden', !(inGame && input.isTouch));
  if (!inGame || name === 'end') document.exitPointerLock?.();
  $('install-tip').classList.toggle('hidden', inGame || !showInstallTip());
}
// iPhone browsers don't let a web page hide their toolbars; the home-screen version runs full screen
function showInstallTip() {
  const iPhone = /iPhone|iPod/.test(navigator.userAgent);
  const standalone = navigator.standalone || matchMedia('(display-mode: standalone), (display-mode: fullscreen)').matches;
  return iPhone && !standalone && store.get('tw_tip') !== '1';
}
$('install-close').addEventListener('click', () => { store.set('tw_tip', '1'); $('install-tip').classList.add('hidden'); });
function toast(msg, ms = 2200) {
  const t = $('toast'); t.textContent = msg; t.classList.remove('hidden');
  clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.add('hidden'), ms);
}

const params = new URLSearchParams(location.search);
const inviteCode = (params.get('room') || '').toUpperCase();

// browsers only allow sound after the first tap/click
addEventListener('pointerdown', () => sfx.unlock(), { once: true });
addEventListener('keydown', () => sfx.unlock(), { once: true });

// phones: go fullscreen and lock to landscape on the first tap (works on Android; iPhone just shows the rotate screen)
async function goLandscape() {
  if (!input.isTouch) return;
  try { if (!document.fullscreenElement) await document.documentElement.requestFullscreen?.({ navigationUI: 'hide' }); } catch {}
  try { await screen.orientation?.lock?.('landscape'); } catch {}
}
addEventListener('click', goLandscape, { once: true, capture: true });
$('rotate').addEventListener('click', goLandscape);

function boot() {
  $('home-name').value = S.name;
  if (inviteCode) $('join-code').value = inviteCode;
  // returning players with a saved name jump straight into the invited room
  if (inviteCode && S.name) connect(inviteCode, false);
  else show('home');
}

function readName() {
  const n = $('home-name').value.trim() || S.name || 'Player' + Math.floor(Math.random() * 900 + 100);
  S.name = n; store.set('tw_name', n);
  return n;
}
$('btn-create').addEventListener('click', () => { sfx.unlock(); readName(); connect('', false); });
$('btn-join').addEventListener('click', () => {
  sfx.unlock(); readName();
  const code = $('join-code').value.trim().toUpperCase();
  if (code.length < 4) { $('home-error').textContent = 'Enter a room code.'; return; }
  connect(code, code !== inviteCode);
});
$('join-code').addEventListener('keydown', e => e.key === 'Enter' && $('btn-join').click());

// lobby
function buildAnimalGrid() {
  const grid = $('animal-grid'); grid.innerHTML = '';
  for (const [k, a] of Object.entries(ANIMALS)) {
    const b = document.createElement('button');
    b.className = 'animal' + (k === S.kind ? ' sel' : '');
    b.innerHTML = `<div class="emoji">${EMOJI[k]}</div><div class="nm">${a.name}</div><div class="ab"><b>${a.ability}:</b> ${a.abilityDesc}</div>`;
    b.onclick = () => { S.kind = k; store.set('tw_kind', k); send({ t: 'pick', kind: k }); buildAnimalGrid(); sfx.click(); };
    grid.appendChild(b);
  }
}
buildAnimalGrid();
$('btn-share').addEventListener('click', async () => {
  const url = `${location.origin}/?room=${S.room}`;
  if (navigator.share && input.isTouch) {
    try { await navigator.share({ title: 'Fish Tank Showdown', text: 'Jump in my fish tank!', url }); return; } catch {}
  }
  try { await navigator.clipboard.writeText(url); toast('Invite link copied!'); } catch { prompt('Copy this link:', url); }
});
$('btn-start').addEventListener('click', () => send({ t: 'start' }));
$('btn-bot-add').addEventListener('click', () => send({ t: 'bot', add: true }));
$('btn-bot-rm').addEventListener('click', () => send({ t: 'bot', add: false }));

function buildSuitGrid() {
  const grid = $('suit-grid'); grid.innerHTML = '';
  for (const [k, c] of Object.entries(SUITS)) {
    const b = document.createElement('button');
    b.className = 'swatch' + (k === S.mySuit ? ' sel' : '');
    b.style.background = '#' + c.toString(16).padStart(6, '0');
    b.title = k;
    b.onclick = () => { S.mySuit = k; send({ t: 'suit', suit: k }); buildSuitGrid(); sfx.click(); };
    grid.appendChild(b);
  }
}

// ---------------- network ----------------
function send(m) { if (S.ws && S.ws.readyState === 1) S.ws.send(JSON.stringify(m)); }

function connect(code, mustExist) {
  $('home-error').textContent = '';
  if (S.ws) { S.ws.onclose = null; S.ws.close(); }
  const ws = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`);
  S.ws = ws;
  ws.onopen = () => ws.send(JSON.stringify({ t: 'join', name: S.name, kind: S.kind, room: code, mustExist }));
  ws.onmessage = ev => onMessage(JSON.parse(ev.data));
  ws.onclose = () => {
    if (S.ws !== ws) return;
    S.ws = null; S.room = null; clearWorld();
    show('home'); $('home-error').textContent = 'Disconnected from the tank.';
  };
  ws.onerror = () => { $('home-error').textContent = 'Could not reach the server.'; };
}

// lobby options: diver opt-in (saved on this device) and bot difficulty (host picks)
S.wantsDiver = store.get('tw_diver') !== '0';
$('opt-diver').checked = S.wantsDiver;
$('opt-diver').addEventListener('change', e => {
  S.wantsDiver = e.target.checked; store.set('tw_diver', S.wantsDiver ? '1' : '0');
  send({ t: 'diverpref', on: S.wantsDiver }); sfx.click();
});
$('diff-seg').addEventListener('click', e => {
  const l = e.target.closest('button')?.dataset.l;
  if (l && S.snap?.host === S.myId) { send({ t: 'diff', level: l }); sfx.click(); }
});

function onMessage(m) {
  if (m.t === 'error') { const ws = S.ws; S.ws = null; if (ws) { ws.onclose = null; ws.close(); } show('home'); $('home-error').textContent = m.error; return; }
  if (m.t === 'welcome') {
    S.myId = m.id; S.room = m.room;
    $('room-code').textContent = m.room;
    history.replaceState(null, '', `/?room=${m.room}`);
    send({ t: 'diverpref', on: S.wantsDiver });
    return;
  }
  if (m.t === 'snap') {
    S.prevSnap = S.snap; S.prevAt = S.snapAt;
    S.snap = m; S.snapAt = performance.now();
    m.byId = new Map(m.players.map(p => [p.id, p]));
    for (const e of m.ev) onEvent(e, m);
    updatePhaseUI(m);
  }
}

function onEvent(e, m) {
  const me = m.byId.get(S.myId);
  const nameOf = id => m.byId.get(id)?.n || '?';
  switch (e.e) {
    case 'diver': {
      S.me.init = false;
      const p = m.byId.get(S.myId);
      // start each round looking the way your character faces
      if (p) input.setView(e.id === S.myId ? Math.PI / 2 : -Math.PI / 2, -0.1);
      if (e.id === S.myId) S.mySuit = m.byId.get(e.id)?.s || 'yellow';
      sfx.reveal();
      break;
    }
    case 'hit': flashModel(e.id); burst(e.x, e.y, e.z, 0xff5d5d, 14); sfx.hit(); break;
    case 'block': burst(e.x, e.y, e.z, 0xffffff, 8); sfx.clink(); break;
    case 'thunk': burst(e.x, e.y, e.z, 0xb08a6a, 6); sfx.clink(); break;
    case 'bite':
      flashModel(e.id); burst(e.x, e.y, e.z, 0xff2d55, 10); sfx.chomp();
      if (e.id === S.myId) S.shake = 0.35;
      break;
    case 'chomp': { const mod = S.models.get(e.id); if (mod) mod.userData.chomp = 0.2; break; }
    case 'shoot': sfx.shoot(); break;
    case 'swing': { const mod = S.models.get(e.id); if (mod) mod.userData.swing = 0.3; sfx.swoosh(); break; }
    case 'heal': if (e.id === S.myId) sfx.heal(); break;
    case 'ability': {
      const p = m.byId.get(e.id);
      if (p) {
        if (e.kind === 'eel') shell(p.x, p.y, p.z, 0xfff35c, 4.5);
        if (e.kind === 'flare') shell(p.x, p.y, p.z, 0xffaa33, 10);
        if (e.kind === 'octopus') sfx.ink(); else sfx.power();
      }
      break;
    }
    case 'kill': {
      const v = m.byId.get(e.id);
      feed(`${e.by === S.myId ? 'You' : nameOf(e.by)} 🔱 ${e.id === S.myId ? 'you' : nameOf(e.id)}`);
      if (v) burst(v.x, v.y, v.z, 0xffffff, 24);
      sfx.kill();
      break;
    }
    case 'end': {
      const iWon = (e.winner === 'diver') === (me?.r === 'diver');
      $('end-title').textContent = e.winner === 'diver' ? '🤿 The Diver wins!' : '🐟 The Fish win!';
      $('end-reason').textContent = e.reason;
      if (me && me.r !== 'spectator') iWon ? sfx.win() : sfx.lose();
      break;
    }
  }
}

function feed(text) {
  const d = document.createElement('div'); d.textContent = text; $('feed').prepend(d);
  setTimeout(() => d.remove(), 4000);
  while ($('feed').children.length > 5) $('feed').lastChild.remove();
}

let lastPhase = null;
function updatePhaseUI(m) {
  const me = m.byId.get(S.myId);
  if (!me) return;
  const isHost = m.host === S.myId;
  if (m.phase === 'lobby') {
    if (lastPhase !== 'lobby') { show('lobby'); buildAnimalGrid(); }
    const list = $('player-list');
    const html = m.players.map(p => `<li class="${p.id === S.myId ? 'me' : ''}">${EMOJI[p.k]} ${escapeHtml(p.n)}${p.b ? ' 🤖' : ''}${p.id === m.host ? ' 👑' : ''}</li>`).join('');
    if (list.innerHTML !== html) list.innerHTML = html;
    $('player-count').textContent = `(${m.players.length}/10)`;
    $('host-controls').classList.toggle('hidden', !isHost);
    $('wait-host').classList.toggle('hidden', isHost);
    $('btn-start').textContent = m.players.length < 2 ? 'Start (with a bot)' : 'Start round';
    for (const b of $('diff-seg').children) b.classList.toggle('sel', b.dataset.l === m.diff);
    $('diff-seg').classList.toggle('locked', !isHost);
    // if nobody wants to dive, a bot will be the diver
    const willing = m.players.some(p => !p.b && p.wd);
    $('opt-diver').parentElement.title = willing ? '' : 'Nobody wants to dive, so a bot will be the diver.';
  } else if (m.phase === 'suit') {
    if (lastPhase !== 'suit') {
      show('suit');
      const diver = m.byId.get(m.diver);
      if (m.diver === S.myId) {
        $('suit-title').textContent = "🤿 You're the Diver!";
        $('suit-sub').textContent = 'Pick your dive suit. Spear the fish before your air runs out.';
        buildSuitGrid();
      } else {
        $('suit-title').textContent = `${diver?.n || 'Someone'} is the Diver!`;
        $('suit-sub').textContent = me.r === 'spectator' ? 'You joined mid-round. You can play next round.' : `You're a ${ANIMALS[me.k].name}. Bite them 10 times to win!`;
        $('suit-grid').innerHTML = '';
      }
    }
    $('suit-timer').textContent = `Starting in ${Math.ceil(m.time)}`;
  } else if (m.phase === 'play') {
    if (lastPhase !== 'play') { show(null); setHelp(me); }
  } else if (m.phase === 'end') {
    if (lastPhase !== 'end') show('end');
    $('end-next').textContent = `Back to the lobby in ${Math.ceil(m.time)}…`;
  }
  lastPhase = m.phase;
}

function setHelp(me) {
  const touch = input.isTouch;
  if (me.r === 'diver') {
    $('help').textContent = touch ? '' : 'Mouse look · WASD swim · Space/C up/down · Click shoot · Right-click swing · Shift boost · E flare';
    $('t-fire').textContent = '🔱'; $('t-swing').classList.remove('hidden');
  } else {
    $('help').textContent = touch ? '' : `Mouse look · WASD swim · Space/C up/down · Click bite · Shift boost · E ${ANIMALS[me.k].ability}`;
    $('t-fire').textContent = '😬'; $('t-swing').classList.add('hidden');
  }
  $('crosshair').classList.toggle('hidden', me.r !== 'diver');
}

function escapeHtml(s) { return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

// ---------------- world rendering ----------------
function clearWorld() {
  for (const m of S.models.values()) scene.remove(m);
  for (const l of S.labels.values()) l.remove();
  for (const s of S.spears.values()) scene.remove(s);
  S.inks.forEach(i => scene.remove(i));
  S.models.clear(); S.labels.clear(); S.spears.clear(); S.inks = [];
  S.snap = S.prevSnap = null; lastPhase = null;
}

function flashModel(id) { const m = S.models.get(id); if (m) m.userData.flash = 0.15; }

const partGeo = new THREE.SphereGeometry(0.08, 6, 4);
function burst(x, y, z, color, n) {
  const mat = new THREE.MeshBasicMaterial({ color, transparent: true });
  for (let i = 0; i < n; i++) {
    const m = new THREE.Mesh(partGeo, mat);
    m.position.set(x, y, z);
    const v = new THREE.Vector3().randomDirection().multiplyScalar(2 + Math.random() * 4);
    S.particles.push({ m, vx: v.x, vy: v.y, vz: v.z, life: 0.5 + Math.random() * 0.3 });
    scene.add(m);
  }
}
// expanding see-through sphere (eel shock, diver flare)
function shell(x, y, z, color, r) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.4, depthWrite: false, side: THREE.DoubleSide }));
  m.position.set(x, y, z);
  S.particles.push({ m, shell: r, life: 0.5, max: 0.5 });
  scene.add(m);
}

const spearGeo = new THREE.CylinderGeometry(0.04, 0.04, 1.3, 6); spearGeo.rotateZ(Math.PI / 2);
const spearTip = new THREE.ConeGeometry(0.1, 0.3, 6); spearTip.rotateZ(-Math.PI / 2); spearTip.translate(0.75, 0, 0);
const spearMat = new THREE.MeshStandardMaterial({ color: 0xd0d6dc, metalness: 0.8, roughness: 0.3, emissive: 0x333333 });
const X_AXIS = new THREE.Vector3(1, 0, 0);
function makeSpear() {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(spearGeo, spearMat), new THREE.Mesh(spearTip, spearMat));
  return g;
}
const inkMat = new THREE.MeshStandardMaterial({ color: 0x120a1c, transparent: true, opacity: 0.88, roughness: 1 });
function makeInk(r) {
  const g = new THREE.Group();
  for (let i = 0; i < 8; i++) {
    const s = new THREE.Mesh(new THREE.SphereGeometry(r * (0.45 + Math.random() * 0.3), 12, 10), inkMat);
    s.position.set((Math.random() - 0.5) * r, (Math.random() - 0.5) * r * 0.8, (Math.random() - 0.5) * r);
    g.add(s);
  }
  return g;
}

const lerp = (a, b, t) => a + (b - a) * t;
function interpPlayer(id, alpha) {
  const cur = S.snap.byId.get(id);
  const prev = S.prevSnap?.byId?.get(id);
  if (!prev) return { x: cur.x, y: cur.y, z: cur.z };
  return { x: lerp(prev.x, cur.x, alpha), y: lerp(prev.y, cur.y, alpha), z: lerp(prev.z, cur.z, alpha) };
}

// local prediction for my own movement; the server also applies bubbles + the cave, so we blend toward it
function predictMe(meP, dt, mv, boosting) {
  const me = S.me;
  if (!me.init) Object.assign(me, { x: meP.x, y: meP.y, z: meP.z, vx: meP.vx, vy: meP.vy, vz: meP.vz, init: true });
  const fx = new Set(meP.fx);
  let speed = meP.r === 'diver' ? DIVER.speed : ANIMALS[meP.k].speed;
  if (boosting) speed *= BOOST.mult;
  if (fx.has('zoom')) speed *= 2.3;
  if (fx.has('puff')) speed *= 0.6;
  if (fx.has('shell')) speed *= 0.5;
  let { x: mx, y: my, z: mz } = mv;
  if (fx.has('stun') || S.snap.phase !== 'play') { mx = my = mz = 0; }
  const k = Math.min(1, dt * 6);
  me.vx += (mx * speed - me.vx) * k; me.vy += (my * speed - me.vy) * k; me.vz += (mz * speed - me.vz) * k;
  me.x += me.vx * dt; me.y += me.vy * dt; me.z += me.vz * dt;
  const age = (performance.now() - S.snapAt) / 1000;
  const sx = meP.x + meP.vx * age, sy = meP.y + meP.vy * age, sz = meP.z + meP.vz * age;
  const err = Math.hypot(sx - me.x, sy - me.y, sz - me.z);
  const pull = err > 3 ? 1 : Math.min(1, dt * 8);
  me.x += (sx - me.x) * pull; me.y += (sy - me.y) * pull; me.z += (sz - me.z) * pull;
  me.x = Math.max(TANK.minX, Math.min(TANK.maxX, me.x));
  me.y = Math.max(TANK.minY, Math.min(TANK.maxY, me.y));
  me.z = Math.max(TANK.minZ, Math.min(TANK.maxZ, me.z));
  return { x: me.x, y: me.y, z: me.z };
}

const tmpV = new THREE.Vector3(), tmpF = new THREE.Vector3(), camTarget = new THREE.Vector3(), camLook = new THREE.Vector3();
function flareOn() { const d = S.snap?.byId.get(S.snap.diver); return !!d?.fx.includes('flare'); }

// Aim from the player toward the point the crosshair sits on (30 units down the camera's line of sight).
// On touch screens the diver also snaps to the nearest visible fish in a cone ahead.
function aimFrom(pos, iAmDiver) {
  if (input.isTouch && iAmDiver) {
    const fw = input.forward(tmpF);
    let best = null, bestDot = Math.cos(0.45);
    for (const p of S.snap.players) {
      if (p.r !== 'animal' || !p.al || (p.h && !flareOn()) || p.c) continue;
      tmpV.set(p.x - pos.x, p.y - pos.y, p.z - pos.z);
      const d = tmpV.length();
      if (d > 20) continue;
      const dot = tmpV.dot(fw) / d;
      if (dot > bestDot) { bestDot = dot; best = tmpV.clone().divideScalar(d); }
    }
    if (best) return best;
  }
  const target = camera.getWorldDirection(new THREE.Vector3()).multiplyScalar(30).add(camera.position);
  return target.sub(tmpV.set(pos.x, pos.y, pos.z)).normalize();
}

const labelPos = new THREE.Vector3();
let sendAcc = 0, lastT = performance.now(), orbit = 0;

function frame() {
  requestAnimationFrame(frame);
  const now = performance.now();
  const dt = Math.min(0.05, (now - lastT) / 1000); lastT = now;
  const t = now / 1000;
  animateScene(t, dt);

  const snap = S.snap;
  let myRole = null, inInk = false, focus = null, outsideView = false;
  const live = !!snap && (snap.phase === 'play' || snap.phase === 'end' || snap.phase === 'suit');
  input.enabled = live && snap.phase !== 'suit';

  if (live) {
    const span = Math.max(16, S.snapAt - S.prevAt);
    const alpha = Math.min(1.2, (now - S.snapAt) / span);
    const meP = snap.byId.get(S.myId);
    myRole = meP?.r;
    const iAmDiver = myRole === 'diver';
    const flare = flareOn();
    const mv = input.move();
    let myPos = null;
    if (meP && meP.al && meP.r !== 'spectator') {
      const boosting = input.held.boost && !meP.ti && meP.st > 0 && mv.lengthSq() > 0.01;
      myPos = predictMe(meP, dt, mv, boosting);
    }

    if (myPos) {
      const aim = aimFrom(myPos, iAmDiver);
      meP._aim = [aim.x, aim.y, aim.z];
      sendAcc += dt;
      if (sendAcc >= 1 / 20) {
        sendAcc = 0;
        const a = input.consume();
        send({
          t: 'in', mx: +mv.x.toFixed(2), my: +mv.y.toFixed(2), mz: +mv.z.toFixed(2),
          aim: meP._aim.map(v => +v.toFixed(3)), f: a.fire ? 1 : 0, s: a.swing ? 1 : 0, a: a.ability ? 1 : 0, b: a.boost ? 1 : 0,
        });
      }
      focus = myPos;
    } else if (meP && meP.r === 'animal' && !meP.al) {
      outsideView = true; // eaten: watch the rest of the round through the front glass
    } else {
      const d = snap.byId.get(snap.diver);
      if (d) focus = interpPlayer(d.id, alpha);
    }

    // players
    const seen = new Set();
    for (const p of snap.players) {
      if (p.r === 'spectator') continue;
      seen.add(p.id);
      let model = S.models.get(p.id);
      if (model && (model.userData.role !== p.r || model.userData.kind !== p.k)) { scene.remove(model); S.models.delete(p.id); model = null; }
      if (!model) { model = createModel(p); S.models.set(p.id, model); scene.add(model); }
      if (p.r === 'diver' && model.userData.suit !== p.s) setSuit(model, p.s);
      const pos = p.id === S.myId && myPos ? myPos : interpPlayer(p.id, alpha);
      model.position.set(pos.x, pos.y, pos.z);
      model.visible = !!p.al;
      const view = p.id === S.myId && meP._aim ? { ...p, a: meP._aim } : p;
      const faded = p.r === 'animal' && iAmDiver && (p.h || p.c) && !flare;
      if (model.userData.chomp > 0) { model.userData.chomp -= dt; model.userData.inner.position.x = Math.sin(model.userData.chomp * 15) * 0.25; }
      else model.userData.inner.position.x = 0;
      animateModel(model, view, t, dt, { faded });

      // name tag + health bar (not for yourself; your bars are in the HUD)
      let label = S.labels.get(p.id);
      if (!label) {
        label = document.createElement('div'); label.className = 'tag';
        label.innerHTML = `<span></span><div class="bar"><div></div></div>`;
        $('labels').appendChild(label); S.labels.set(p.id, label);
      }
      labelPos.set(pos.x, pos.y + (p.r === 'diver' ? 1.5 : 1.3), pos.z).project(camera);
      const hidden = !p.al || faded || labelPos.z > 1 || p.id === S.myId;
      label.style.display = hidden ? 'none' : '';
      if (!hidden) {
        label.style.left = ((labelPos.x + 1) / 2) * window.innerWidth + 'px';
        label.style.top = ((1 - labelPos.y) / 2) * window.innerHeight + 'px';
        const txt = (p.r === 'diver' ? '🤿 ' : EMOJI[p.k] + ' ') + p.n;
        if (label.firstChild.textContent !== txt) label.firstChild.textContent = txt;
        const max = p.r === 'diver' ? DIVER.hp : ANIMAL_HP;
        const bar = label.querySelector('.bar div');
        bar.style.width = (p.hp / max) * 100 + '%';
        bar.style.background = p.hp / max > 0.5 ? '#4ade80' : p.hp / max > 0.25 ? '#facc15' : '#ef4444';
      }
    }
    for (const [id, m] of S.models) if (!seen.has(id)) { scene.remove(m); S.models.delete(id); S.labels.get(id)?.remove(); S.labels.delete(id); }

    // spears (extrapolated between snapshots)
    const age = (now - S.snapAt) / 1000;
    const sSeen = new Set();
    for (const [id, x, y, z, vx, vy, vz] of snap.spears) {
      sSeen.add(id);
      let m = S.spears.get(id);
      if (!m) { m = makeSpear(); S.spears.set(id, m); scene.add(m); }
      m.position.set(x + vx * age, y + vy * age, z + vz * age);
      m.quaternion.setFromUnitVectors(X_AXIS, tmpV.set(vx, vy, vz).normalize());
    }
    for (const [id, m] of S.spears) if (!sSeen.has(id)) { scene.remove(m); S.spears.delete(id); }

    // ink clouds
    while (S.inks.length < snap.inks.length) { const g = makeInk(3.4); scene.add(g); S.inks.push(g); }
    while (S.inks.length > snap.inks.length) scene.remove(S.inks.pop());
    snap.inks.forEach(([x, y, z, r, life], i) => {
      const g = S.inks[i];
      g.position.set(x, y, z);
      g.scale.setScalar(Math.min(1, life * 1.5) * (1 + Math.sin(t * 2 + i) * 0.04));
      g.rotation.y = t * 0.2;
      if (iAmDiver && camera.position.distanceTo(g.position) < r) inInk = true;
    });

    if (meP) updateHUD(snap, meP);
  } else if (S.models.size && snap?.phase === 'lobby') {
    for (const m of S.models.values()) scene.remove(m);
    for (const l of S.labels.values()) l.remove();
    for (const s of S.spears.values()) scene.remove(s);
    S.inks.forEach(i => scene.remove(i)); S.inks = [];
    S.models.clear(); S.labels.clear(); S.spears.clear();
  }
  $('ink-overlay').style.opacity = inInk ? 1 : 0;
  $('lock-hint').classList.toggle('hidden', !(live && snap.phase === 'play' && !input.isTouch && !input.locked));

  // particles
  S.particles = S.particles.filter(p => {
    p.life -= dt;
    if (p.shell) {
      const k = 1 - p.life / p.max;
      p.m.scale.setScalar(0.5 + k * p.shell); p.m.material.opacity = 0.4 * (1 - k);
    } else {
      p.m.position.x += p.vx * dt; p.m.position.y += p.vy * dt; p.m.position.z += p.vz * dt;
      p.vx *= 0.92; p.vy *= 0.92; p.vz *= 0.92;
      p.m.scale.setScalar(Math.max(0.01, p.life * 2));
    }
    if (p.life <= 0) { scene.remove(p.m); return false; }
    return true;
  });

  // ---- camera ----
  if (outsideView) {
    camera.position.lerp(tmpV.set(0, 19, 64), Math.min(1, dt * 2));
    camera.lookAt(0, 12, 0);
  } else if (focus) {
    // third person: behind and a little above your character, looking where you look
    const fw = input.forward(tmpF);
    const back = myRole === 'diver' || myRole === 'animal' ? 6.5 : 9;
    camTarget.set(focus.x, focus.y + 1.6, focus.z).addScaledVector(fw, -back);
    // the camera may leave the tank (the glass is invisible from outside); just keep it above the gravel
    camTarget.y = Math.max(0.8, camTarget.y);
    camera.position.lerp(camTarget, Math.min(1, dt * 12));
    camLook.set(focus.x, focus.y + 1.0, focus.z).addScaledVector(fw, 6);
    S.shake = Math.max(0, S.shake - dt);
    if (S.shake) camLook.add(tmpV.randomDirection().multiplyScalar(S.shake * 0.5));
    camera.lookAt(camLook);
  } else {
    // menus: slow orbit around the tank
    orbit += dt * 0.08;
    camera.position.lerp(tmpV.set(Math.sin(orbit) * 78, 46, Math.cos(orbit) * 78), Math.min(1, dt * 2));
    camera.lookAt(0, 10, 0);
  }

  renderer.render(scene, camera);
}

function updateHUD(snap, me) {
  const air = snap.phase === 'play' ? snap.time / ROUND_TIME : snap.phase === 'suit' ? 1 : 0;
  $('air-fill').style.width = Math.max(0, air * 100) + '%';
  const sec = Math.ceil(snap.phase === 'play' ? snap.time : snap.phase === 'suit' ? ROUND_TIME : 0);
  $('air-time').textContent = `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
  const alive = snap.players.filter(p => p.r === 'animal' && p.al).length;
  $('hud-alive').textContent = `🐟 ${alive} left`;
  const abil = me.r === 'diver' ? 'Flare' : ANIMALS[me.k]?.ability;
  const cdTxt = `${abil} ${me.cd > 0 ? Math.ceil(me.cd) + 's' : 'ready'}`;
  if (me.r === 'diver') {
    $('hud-role').textContent = '🤿 Diver';
    $('hp-label').textContent = `Health ${me.hp}/${DIVER.hp} · ${cdTxt}`;
    $('hp-fill').style.width = (me.hp / DIVER.hp) * 100 + '%';
  } else if (me.r === 'animal') {
    $('hud-role').textContent = `${EMOJI[me.k]} ${ANIMALS[me.k].name}${me.al ? '' : ' (eaten, watching from outside)'}`;
    $('hp-label').textContent = me.al ? `Health ${me.hp}/${ANIMAL_HP} · ${cdTxt}` : 'Spectating';
    $('hp-fill').style.width = (me.hp / ANIMAL_HP) * 100 + '%';
  } else {
    $('hud-role').textContent = '👀 Spectating';
    $('hp-label').textContent = 'You can play next round';
    $('hp-fill').style.width = '0%';
  }
  $('boost-fill').style.width = (me.st ?? 1) * 100 + '%';
  $('boost-fill').classList.toggle('tired', !!me.ti);
  $('t-ability').classList.toggle('cool', me.cd > 0);
  $('t-boost').classList.toggle('cool', !!me.ti);
}

boot();
requestAnimationFrame(frame);
