import * as THREE from 'three';
import { TANK, BUBBLE_COLUMNS, CAVE, SEAWEED, ANEMONE } from '../../shared/constants.js';

export function buildScene(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const WATER = 0x1a6f9e;
  scene.background = new THREE.Color(WATER);
  scene.fog = new THREE.Fog(WATER, 18, 62);

  const camera = new THREE.PerspectiveCamera(65, 1, 0.1, 200);
  camera.position.set(0, 9, 26);

  scene.add(new THREE.HemisphereLight(0xc8f2ff, 0x2a4d3a, 1.5));
  const sun = new THREE.DirectionalLight(0xffffff, 2.2);
  sun.position.set(-8, 34, 10);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -26, right: 26, top: 16, bottom: -16, near: 1, far: 70 });
  scene.add(sun);

  const W = TANK.maxX - TANK.minX, D = TANK.maxZ - TANK.minZ, H = TANK.maxY + 1;
  const cx = (TANK.maxX + TANK.minX) / 2, cz = (TANK.maxZ + TANK.minZ) / 2;

  // ---- gravel floor ----
  const floor = new THREE.Mesh(new THREE.BoxGeometry(W, 1, D), new THREE.MeshStandardMaterial({ color: 0xd9c49a, roughness: 1 }));
  floor.position.set(cx, -0.5, cz); floor.receiveShadow = true; scene.add(floor);
  const pebbleColors = [0xf2a7c3, 0x8fd3ff, 0xffe28a, 0xb6f5a2, 0xffffff, 0xc9a7ff];
  const pebbles = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.2, 0), new THREE.MeshStandardMaterial({ roughness: 0.8 }), 2600);
  const m4 = new THREE.Matrix4(), col = new THREE.Color();
  for (let i = 0; i < pebbles.count; i++) {
    const s = 0.6 + Math.random() * 0.9;
    m4.compose(new THREE.Vector3(TANK.minX + Math.random() * W, Math.random() * 0.1, TANK.minZ + Math.random() * D),
      new THREE.Quaternion().random(), new THREE.Vector3(s, s * 0.7, s));
    pebbles.setMatrixAt(i, m4);
    pebbles.setColorAt(i, col.setHex(pebbleColors[i % pebbleColors.length]));
  }
  pebbles.receiveShadow = true; scene.add(pebbles);

  // ---- glass walls on all four sides ----
  const glass = new THREE.MeshStandardMaterial({ color: 0xbfefff, transparent: true, opacity: 0.12, roughness: 0.05, metalness: 0.1, side: THREE.DoubleSide, depthWrite: false });
  const walls = [
    [W, H, cx, cz + D / 2, 0], [W, H, cx, cz - D / 2, 0],
    [D, H, TANK.minX, cz, Math.PI / 2], [D, H, TANK.maxX, cz, Math.PI / 2],
  ];
  for (const [w, h, x, z, ry] of walls) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), glass);
    m.position.set(x, h / 2, z); m.rotation.y = ry; scene.add(m);
  }
  // back wall gets a painted ocean backdrop like a real aquarium
  const bg = document.createElement('canvas'); bg.width = 512; bg.height = 256;
  const b = bg.getContext('2d');
  const g = b.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, '#7fe0ff'); g.addColorStop(0.55, '#1e8fc4'); g.addColorStop(1, '#0d5a86');
  b.fillStyle = g; b.fillRect(0, 0, 512, 256);
  b.fillStyle = 'rgba(10,60,80,.55)';
  for (let i = 0; i < 9; i++) { // distant rocks
    const x = Math.random() * 512, w = 60 + Math.random() * 120, h = 30 + Math.random() * 70;
    b.beginPath(); b.ellipse(x, 256, w, h, 0, Math.PI, 0); b.fill();
  }
  const backdrop = new THREE.Mesh(new THREE.PlaneGeometry(W, H), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(bg), fog: false }));
  backdrop.position.set(cx, H / 2, TANK.minZ - 0.05); scene.add(backdrop);

  const frame = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(W, H, D)),
    new THREE.LineBasicMaterial({ color: 0xe6fbff, transparent: true, opacity: 0.8 }));
  frame.position.set(cx, H / 2, cz); scene.add(frame);
  const rimMat = new THREE.MeshStandardMaterial({ color: 0x222831, roughness: 0.6 });
  const rimBot = new THREE.Mesh(new THREE.BoxGeometry(W + 0.8, 0.8, D + 0.8), rimMat);
  rimBot.position.set(cx, -1.3, cz); scene.add(rimBot);
  for (const [sx, sz, x, z] of [[W + 0.8, 0.4, cx, TANK.maxZ + 0.2], [W + 0.8, 0.4, cx, TANK.minZ - 0.2], [0.4, D, TANK.minX - 0.2, cz], [0.4, D, TANK.maxX + 0.2, cz]]) {
    const r = new THREE.Mesh(new THREE.BoxGeometry(sx, 0.4, sz), rimMat); r.position.set(x, H + 0.1, z); scene.add(r);
  }
  // a table under the tank so the outside reads as "a room"
  const table = new THREE.Mesh(new THREE.BoxGeometry(W + 8, 1.2, D + 8), new THREE.MeshStandardMaterial({ color: 0x5b3a22, roughness: 0.8 }));
  table.position.set(cx, -2.3, cz); scene.add(table);

  // water surface (seen from below)
  const surface = new THREE.Mesh(new THREE.PlaneGeometry(W, D, 44, 20),
    new THREE.MeshStandardMaterial({ color: 0xaeeeff, transparent: true, opacity: 0.45, side: THREE.DoubleSide, roughness: 0.1, emissive: 0x2a7fa0 }));
  surface.rotation.x = -Math.PI / 2; surface.position.set(cx, TANK.maxY + 0.3, cz); scene.add(surface);

  // light shafts
  const shaftMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.045, depthWrite: false, side: THREE.DoubleSide });
  for (let i = 0; i < 10; i++) {
    const s = new THREE.Mesh(new THREE.PlaneGeometry(2 + Math.random() * 2, H * 1.2), shaftMat);
    s.position.set(TANK.minX + 3 + Math.random() * (W - 6), H / 2, TANK.minZ + 2 + Math.random() * (D - 4));
    s.rotation.set(0, Math.random() * Math.PI, 0.2);
    scene.add(s);
  }

  // ---- castle with a fish-only cave ----
  const castle = new THREE.Group();
  const stone = new THREE.MeshStandardMaterial({ color: 0xb08a6a, roughness: 0.9 });
  const dark = new THREE.MeshBasicMaterial({ color: 0x1a1008 });
  const cw = CAVE.maxX - CAVE.minX, cd = CAVE.maxZ - CAVE.minZ;
  const ccx = (CAVE.minX + CAVE.maxX) / 2, ccz = (CAVE.minZ + CAVE.maxZ) / 2, ch = CAVE.maxY;
  const t = 0.6; // wall thickness (just outside the cave box)
  const wall = (sx, sy, sz, x, y, z, m = stone) => { const w = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), m); w.position.set(x, y, z); castle.add(w); return w; };
  wall(t, ch, cd, CAVE.minX - t / 2, ch / 2, ccz);            // left wall
  wall(t, ch, cd, CAVE.maxX + t / 2, ch / 2, ccz);            // right wall
  wall(cw + 2 * t, 1.2, cd + t, ccx, ch + 0.6, ccz + t / 2);   // roof
  // front wall with two small arched openings (fish-sized)
  const arches = [ccx - 2, ccx + 2], aw = 2.2, ah = 2.4;
  const segs = [[CAVE.minX - t, arches[0] - aw / 2], [arches[0] + aw / 2, arches[1] - aw / 2], [arches[1] + aw / 2, CAVE.maxX + t]];
  for (const [a, bb] of segs) wall(bb - a, ch, t, (a + bb) / 2, ch / 2, CAVE.maxZ + t / 2);
  for (const ax of arches) {
    wall(aw, ch - ah, t, ax, ah + (ch - ah) / 2, CAVE.maxZ + t / 2);
    const arch = new THREE.Mesh(new THREE.CylinderGeometry(aw / 2, aw / 2, t + 0.02, 20, 1, false, -Math.PI / 2, Math.PI), dark);
    arch.rotation.x = Math.PI / 2; arch.position.set(ax, ah, CAVE.maxZ + t / 2); castle.add(arch);
  }
  // inside: dark so the cave reads as a cave
  wall(cw, ch, 0.1, ccx, ch / 2, CAVE.minZ + 0.06, dark);
  for (const x of [CAVE.minX + 0.9, CAVE.maxX - 0.9]) {
    const tower = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.2, 4.5, 14), stone); tower.position.set(x, ch + 3.4, ccz); castle.add(tower);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(1.45, 1.8, 14), new THREE.MeshStandardMaterial({ color: 0xd94f4f })); roof.position.set(x, ch + 6.5, ccz); castle.add(roof);
  }
  castle.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  scene.add(castle);
  const sign = makeTextSprite('CAVE: fish only', '#fff', 'rgba(0,0,0,.45)');
  sign.position.set(ccx, ch + 1.9, CAVE.maxZ + 1.2); sign.scale.set(4.5, 1.1, 1); scene.add(sign);

  // ---- seaweed patches ----
  const weeds = [];
  const weedMats = [0x2f9e44, 0x51cf66, 0x37b24d].map(c => new THREE.MeshStandardMaterial({ color: c, roughness: 0.7, side: THREE.DoubleSide }));
  for (const sw of SEAWEED) {
    const n = Math.round(sw.r * sw.r * 4);
    for (let i = 0; i < n; i++) {
      const h = sw.h * (0.75 + Math.random() * 0.35);
      const geo = new THREE.PlaneGeometry(0.5, h, 1, 10);
      geo.translate(0, h / 2, 0);
      const m = new THREE.Mesh(geo, weedMats[i % 3]);
      const a = Math.random() * Math.PI * 2, rr = Math.sqrt(Math.random()) * sw.r;
      m.position.set(sw.x + Math.cos(a) * rr, 0, sw.z + Math.sin(a) * rr);
      m.rotation.y = Math.random() * Math.PI;
      m.userData.base = geo.attributes.position.array.slice();
      m.userData.phase = Math.random() * 6;
      m.castShadow = true;
      scene.add(m); weeds.push(m);
    }
  }

  // ---- anemone (heals fish) ----
  const anem = new THREE.Group();
  const anMat = new THREE.MeshStandardMaterial({ color: 0xff6fb5, emissive: 0x551133, roughness: 0.6 });
  const anBase = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 1.1, 0.8, 16), new THREE.MeshStandardMaterial({ color: 0xc23d84 }));
  anBase.position.y = 0.4; anem.add(anBase);
  const anTents = [];
  for (let i = 0; i < 40; i++) {
    const tt = new THREE.Mesh(new THREE.CapsuleGeometry(0.09, 1.2, 3, 6), anMat);
    const a = Math.random() * Math.PI * 2, r = Math.random() * 0.75;
    const pivot = new THREE.Group(); pivot.position.set(Math.cos(a) * r, 0.8, Math.sin(a) * r);
    tt.position.y = 0.6; pivot.add(tt); pivot.rotation.set(Math.sin(a) * 0.4, 0, Math.cos(a) * 0.4);
    pivot.userData.phase = Math.random() * 6;
    anem.add(pivot); anTents.push(pivot);
  }
  anem.position.set(ANEMONE.x, 0, ANEMONE.z); scene.add(anem);
  const healBubble = new THREE.Mesh(new THREE.SphereGeometry(ANEMONE.r, 24, 16),
    new THREE.MeshBasicMaterial({ color: 0xff9ad5, transparent: true, opacity: 0.08, depthWrite: false }));
  healBubble.position.set(ANEMONE.x, ANEMONE.y, ANEMONE.z); scene.add(healBubble);

  // ---- bubble columns ----
  const bubbleGeo = new THREE.SphereGeometry(0.16, 8, 6);
  const bubbleMat = new THREE.MeshStandardMaterial({ color: 0xe6fbff, emissive: 0x6fb8d8, transparent: true, opacity: 0.7, roughness: 0.05 });
  const columns = BUBBLE_COLUMNS.map(bc => {
    const st = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.7, 0.4, 12), new THREE.MeshStandardMaterial({ color: 0x3b4a57 }));
    st.position.set(bc.x, 0.2, bc.z); scene.add(st);
    const count = 110;
    const inst = new THREE.InstancedMesh(bubbleGeo, bubbleMat, count);
    const parts = Array.from({ length: count }, () => {
      const a = Math.random() * Math.PI * 2, r = Math.random() * bc.r * 0.8;
      return { y: Math.random() * TANK.maxY, x: Math.cos(a) * r, z: Math.sin(a) * r, s: 0.5 + Math.random() * 1.3, sp: 4 + Math.random() * 4, ph: Math.random() * 6 };
    });
    scene.add(inst);
    return { b: bc, inst, parts };
  });

  // floating specks
  const dustPos = new Float32Array(500 * 3);
  for (let i = 0; i < 500; i++) {
    dustPos[i * 3] = TANK.minX + Math.random() * W; dustPos[i * 3 + 1] = Math.random() * TANK.maxY; dustPos[i * 3 + 2] = TANK.minZ + Math.random() * D;
  }
  const dustGeo = new THREE.BufferGeometry(); dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
  scene.add(new THREE.Points(dustGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.07, transparent: true, opacity: 0.5 })));

  // decorations: treasure chest, rocks
  const chest = new THREE.Group();
  const wood = new THREE.MeshStandardMaterial({ color: 0x7a4a21 }), gold = new THREE.MeshStandardMaterial({ color: 0xf2c94c, metalness: 0.8, roughness: 0.3, emissive: 0x332200 });
  const cb = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1, 1.1), wood); cb.position.y = 0.5; chest.add(cb);
  const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 1.8, 12, 1, false, 0, Math.PI), wood);
  lid.rotation.z = Math.PI / 2; lid.position.y = 1; chest.add(lid);
  for (let i = 0; i < 6; i++) { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.05, 10), gold); c.position.set(-0.6 + i * 0.25, 1.05, 0.5); c.rotation.x = 1.2; chest.add(c); }
  chest.position.set(-15, 0, 4); chest.rotation.y = 0.6; chest.traverse(o => o.isMesh && (o.castShadow = true)); scene.add(chest);
  const rockMat = new THREE.MeshStandardMaterial({ color: 0x6b7a85, roughness: 0.95, flatShading: true });
  for (const [x, z, s] of [[2, 8, 1.4], [16, 7, 1.1], [-20, 8, 1.2], [8, -8, 1.6], [-14, -8, 1.3]]) {
    const r = new THREE.Mesh(new THREE.DodecahedronGeometry(s, 0), rockMat);
    r.position.set(x, s * 0.4, z); r.scale.y = 0.6; r.castShadow = r.receiveShadow = true; scene.add(r);
  }

  const tmpM = new THREE.Matrix4(), tmpQ = new THREE.Quaternion(), tmpS = new THREE.Vector3(), tmpP = new THREE.Vector3();
  function animate(time, dt) {
    for (const w of weeds) {
      const pos = w.geometry.attributes.position, base = w.userData.base;
      for (let i = 0; i < pos.count; i++) {
        const y = base[i * 3 + 1];
        pos.array[i * 3] = base[i * 3] + Math.sin(time * 1.4 + w.userData.phase + y * 0.5) * y * 0.08;
      }
      pos.needsUpdate = true;
    }
    for (const p of anTents) p.rotation.x = Math.sin(time * 2 + p.userData.phase) * 0.35;
    healBubble.scale.setScalar(1 + Math.sin(time * 2) * 0.04);
    for (const c of columns) {
      c.parts.forEach((p, i) => {
        p.y += p.sp * dt;
        if (p.y > TANK.maxY) p.y = 0.3;
        tmpP.set(c.b.x + p.x + Math.sin(time * 3 + p.ph) * 0.15, p.y, c.b.z + p.z);
        tmpS.setScalar(p.s * (0.6 + (p.y / TANK.maxY) * 0.6));
        tmpM.compose(tmpP, tmpQ, tmpS);
        c.inst.setMatrixAt(i, tmpM);
      });
      c.inst.instanceMatrix.needsUpdate = true;
    }
    const sp = surface.geometry.attributes.position;
    for (let i = 0; i < sp.count; i++) sp.array[i * 3 + 2] = Math.sin(time * 1.5 + sp.array[i * 3] * 0.5 + sp.array[i * 3 + 1] * 0.3) * 0.1;
    sp.needsUpdate = true;
  }

  return { renderer, scene, camera, animate };
}

export function makeTextSprite(text, color = '#fff', bg = null) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 128;
  const x = c.getContext('2d');
  if (bg) { x.fillStyle = bg; x.beginPath(); x.roundRect(8, 16, 496, 96, 40); x.fill(); }
  x.font = 'bold 56px "Baloo 2", sans-serif'; x.fillStyle = color; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillText(text, 256, 66);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  return new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
}
