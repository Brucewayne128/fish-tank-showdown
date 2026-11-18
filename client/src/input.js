import * as THREE from 'three';

// Third-person controls.
// Desktop: click to lock the mouse, move mouse to look, WASD swim (W goes where you look),
//          Space up / Ctrl or C down, Shift boost, click shoot/bite, right-click or F swing, E ability.
// Touch:   left stick swims, drag anywhere else to look, on-screen buttons for the rest.
export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.held = { fire: false, swing: false, ability: false, boost: false };
    this.latched = { fire: false, swing: false, ability: false };
    this.stick = { x: 0, y: 0 };
    this.yaw = Math.PI / 2;   // looking toward +X
    this.pitch = 0;
    this.enabled = false;     // only steer the camera while a round is on
    this.isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
    this.locked = false;

    const typing = e => e.target.tagName === 'INPUT';
    const keyAct = { KeyE: 'ability', KeyQ: 'ability', KeyF: 'swing', KeyJ: 'fire', ShiftLeft: 'boost', ShiftRight: 'boost' };
    addEventListener('keydown', e => {
      if (typing(e)) return;
      this.keys.add(e.code);
      if (keyAct[e.code]) this.press(keyAct[e.code], true);
      if (this.enabled && ['Space', 'ArrowUp', 'ArrowDown'].includes(e.code)) e.preventDefault();
    });
    addEventListener('keyup', e => {
      this.keys.delete(e.code);
      if (keyAct[e.code]) this.press(keyAct[e.code], false);
    });
    addEventListener('blur', () => { this.keys.clear(); Object.keys(this.held).forEach(k => (this.held[k] = false)); });

    // mouse: pointer lock for looking around
    document.addEventListener('pointerlockchange', () => { this.locked = document.pointerLockElement === canvas; });
    addEventListener('mousemove', e => {
      if (!this.locked) return;
      this.look(e.movementX * 0.0024, e.movementY * 0.0024);
    });
    canvas.addEventListener('pointerdown', e => {
      if (e.pointerType === 'touch') return;
      if (this.enabled && !this.locked) { canvas.requestPointerLock?.(); return; } // first click just grabs the mouse
      this.press(e.button === 2 ? 'swing' : 'fire', true);
    });
    addEventListener('pointerup', e => {
      if (e.pointerType === 'touch') return;
      this.press(e.button === 2 ? 'swing' : 'fire', false);
    });
    canvas.addEventListener('contextmenu', e => e.preventDefault());

    this.setupTouch();
  }

  look(dx, dy) {
    if (!this.enabled) return;
    this.yaw -= dx;
    this.pitch = Math.max(-1.25, Math.min(1.25, this.pitch - dy));
  }

  setView(yaw, pitch) { this.yaw = yaw; this.pitch = pitch; }

  press(k, down) {
    this.held[k] = down;
    if (down && k in this.latched) this.latched[k] = true;
  }

  // actions held now or pressed since the last send (quick taps never get lost)
  consume() {
    const out = { boost: this.held.boost };
    for (const k in this.latched) { out[k] = this.held[k] || this.latched[k]; this.latched[k] = false; }
    return out;
  }

  // camera forward (where you look) and flat right vector
  forward(out = new THREE.Vector3()) {
    const cp = Math.cos(this.pitch);
    return out.set(Math.sin(this.yaw) * cp, Math.sin(this.pitch), Math.cos(this.yaw) * cp);
  }
  right(out = new THREE.Vector3()) {
    return out.set(-Math.cos(this.yaw), 0, Math.sin(this.yaw));
  }

  // world-space swim direction, length <= 1
  move() {
    let f = this.stick.y, s = this.stick.x, up = 0;
    const k = this.keys;
    if (k.has('KeyW') || k.has('ArrowUp')) f += 1;
    if (k.has('KeyS') || k.has('ArrowDown')) f -= 1;
    if (k.has('KeyD') || k.has('ArrowRight')) s += 1;
    if (k.has('KeyA') || k.has('ArrowLeft')) s -= 1;
    if (k.has('Space')) up += 1;
    if (k.has('KeyC') || k.has('ControlLeft')) up -= 1;
    const fw = this.forward(), rt = this.right();
    const v = new THREE.Vector3().addScaledVector(fw, f).addScaledVector(rt, s);
    v.y += up;
    if (v.lengthSq() > 1) v.normalize();
    return v;
  }

  setupTouch() {
    const stick = document.getElementById('stick'), knob = document.getElementById('knob');
    let id = null, cx = 0, cy = 0;
    const R = 50;
    const upd = (x, y) => {
      let dx = x - cx, dy = y - cy;
      const l = Math.hypot(dx, dy);
      if (l > R) { dx = (dx / l) * R; dy = (dy / l) * R; }
      knob.style.transform = `translate(${dx}px, ${dy}px)`;
      this.stick.x = dx / R; this.stick.y = -dy / R;
    };
    stick.addEventListener('pointerdown', e => {
      id = e.pointerId; try { stick.setPointerCapture(id); } catch {}
      const r = stick.getBoundingClientRect(); cx = r.left + r.width / 2; cy = r.top + r.height / 2;
      upd(e.clientX, e.clientY);
    });
    stick.addEventListener('pointermove', e => { if (e.pointerId === id) upd(e.clientX, e.clientY); });
    const end = e => { if (e.pointerId !== id) return; id = null; this.stick.x = this.stick.y = 0; knob.style.transform = ''; };
    stick.addEventListener('pointerup', end);
    stick.addEventListener('pointercancel', end);

    // drag on the open screen to look around
    const looks = new Map();
    this.canvas.addEventListener('pointerdown', e => {
      if (e.pointerType !== 'touch') return;
      looks.set(e.pointerId, { x: e.clientX, y: e.clientY });
    });
    this.canvas.addEventListener('pointermove', e => {
      const l = looks.get(e.pointerId);
      if (!l) return;
      this.look((e.clientX - l.x) * 0.006, (e.clientY - l.y) * 0.006);
      l.x = e.clientX; l.y = e.clientY;
    });
    const lend = e => looks.delete(e.pointerId);
    this.canvas.addEventListener('pointerup', lend);
    this.canvas.addEventListener('pointercancel', lend);

    for (const [elId, act] of [['t-fire', 'fire'], ['t-swing', 'swing'], ['t-ability', 'ability'], ['t-boost', 'boost']]) {
      const b = document.getElementById(elId);
      b.addEventListener('pointerdown', e => { e.preventDefault(); try { b.setPointerCapture(e.pointerId); } catch {} this.press(act, true); });
      const up = () => this.press(act, false);
      b.addEventListener('pointerup', up);
      b.addEventListener('pointercancel', up);
    }
  }
}
