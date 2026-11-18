import * as THREE from 'three';
import { TANK, BUBBLE_COLUMNS, CAVES, SEAWEED, ANEMONES } from '../../shared/constants.js';
import { addCaustics, causticTime } from './caustics.js';
import { sandTextures, brickTextures, rockTextures, woodTextures, tileTextures, boxUV } from './textures.js';

export function buildScene(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const WATER = 0x1a6f9e;
  scene.background = new THREE.Color(0x0a1822); // dim room around the tank
  scene.fog = new THREE.Fog(WATER, 30, 130);

  const camera = new THREE.PerspectiveCamera(65, 1, 0.1, 500);
  camera.position.set(0, 20, 70);

  // soft fill from all around, plus the tank lamp straight above (the only shadow caster)
  scene.add(new THREE.HemisphereLight(0xbfeaff, 0x24402f, 0.95));
  const sun = new THREE.DirectionalLight(0xfff6e0, 3.2);
  sun.position.set(6, 90, 12);
  sun.castShadow = true;
  sun.shadow.mapSize.set(4096, 4096);
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.04;
  Object.assign(sun.shadow.camera, { left: -52, right: 52, top: 28, bottom: -28, near: 40, far: 120 });
  scene.add(sun);

  const W = TANK.maxX - TANK.minX, D = TANK.maxZ - TANK.minZ, H = TANK.maxY + 1;
  const cx = (TANK.maxX + TANK.minX) / 2, cz = (TANK.maxZ + TANK.minZ) / 2;

  // ---- gravel floor ----
  const sand = sandTextures(1);
  sand.map.repeat.set(W / 7, D / 7); sand.bump.repeat.set(W / 7, D / 7);
  const floor = new THREE.Mesh(new THREE.BoxGeometry(W, 1, D), new THREE.MeshStandardMaterial({ map: sand.map, bumpMap: sand.bump, bumpScale: 1.5, roughness: 1 }));
  floor.position.set(cx, -0.5, cz); floor.receiveShadow = true; scene.add(floor);
  const pebbleColors = [0xf2a7c3, 0x8fd3ff, 0xffe28a, 0xb6f5a2, 0xffffff, 0xc9a7ff];
  const pebbles = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.2, 0), new THREE.MeshStandardMaterial({ roughness: 0.8 }), 4500);
  const m4 = new THREE.Matrix4(), col = new THREE.Color();
  for (let i = 0; i < pebbles.count; i++) {
    const s = 0.6 + Math.random() * 0.9;
    m4.compose(new THREE.Vector3(TANK.minX + Math.random() * W, Math.random() * 0.1, TANK.minZ + Math.random() * D),
      new THREE.Quaternion().random(), new THREE.Vector3(s, s * 0.7, s));
    pebbles.setMatrixAt(i, m4);
    pebbles.setColorAt(i, col.setHex(pebbleColors[i % pebbleColors.length]));
  }
  pebbles.receiveShadow = true; scene.add(pebbles);

  // ---- glass walls: each pane faces inward and is single-sided, so from outside it disappears ----
  const glass = new THREE.MeshStandardMaterial({ color: 0xbfefff, transparent: true, opacity: 0.12, roughness: 0.05, metalness: 0.1, side: THREE.FrontSide, depthWrite: false });
  const walls = [
    [W, H, cx, TANK.maxZ, Math.PI],        // front, faces -z
    [D, H, TANK.minX, cz, Math.PI / 2],    // left, faces +x
    [D, H, TANK.maxX, cz, -Math.PI / 2],   // right, faces -x
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

  const rimMat = new THREE.MeshStandardMaterial({ color: 0x222831, roughness: 0.6, fog: false });
  const rimBot = new THREE.Mesh(new THREE.BoxGeometry(W + 0.8, 0.8, D + 0.8), rimMat);
  rimBot.position.set(cx, -1.3, cz); scene.add(rimBot);
  for (const [sx, sz, x, z] of [[W + 0.8, 0.4, cx, TANK.maxZ + 0.2], [W + 0.8, 0.4, cx, TANK.minZ - 0.2], [0.4, D, TANK.minX - 0.2, cz], [0.4, D, TANK.maxX + 0.2, cz]]) {
    const r = new THREE.Mesh(new THREE.BoxGeometry(sx, 0.4, sz), rimMat); r.position.set(x, H + 0.1, z); scene.add(r);
  }
  // a table under the tank so the outside reads as "a room"
  const table = new THREE.Mesh(new THREE.BoxGeometry(W + 8, 1.2, D + 8), new THREE.MeshStandardMaterial({ color: 0x5b3a22, roughness: 0.8, fog: false }));
  table.position.set(cx, -2.3, cz); scene.add(table);

  // ---- the tank lamp: a light bar resting across the top rims ----
  const lamp = new THREE.Group();
  const lampBody = new THREE.Mesh(new THREE.BoxGeometry(W * 0.94, 1.5, 7), new THREE.MeshStandardMaterial({ color: 0xe9eef2, roughness: 0.35, metalness: 0.1, fog: false }));
  lamp.add(lampBody);
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(W * 0.9, 5.6), new THREE.MeshBasicMaterial({ color: 0xfff8e6, fog: false }));
  glow.rotation.x = Math.PI / 2; glow.position.y = -0.76; lamp.add(glow); // faces down into the water
  const stripMat = new THREE.MeshBasicMaterial({ color: 0xbff4ff, fog: false });
  for (const zz of [-3.52, 3.52]) { // glowing edge lines on the front and back of the hood
    const strip = new THREE.Mesh(new THREE.BoxGeometry(W * 0.9, 0.18, 0.05), stripMat);
    strip.position.set(0, -0.45, zz); lamp.add(strip);
  }
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) { // arms out to the front and back rims
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, D / 2 - 2), lampBody.material);
    leg.position.set(sx * W * 0.4, -0.2, sz * (D / 4)); lamp.add(leg);
  }
  lamp.position.set(cx, H + 1.0, cz); scene.add(lamp);
  // soft halo on the water surface under the lamp
  const haloC = document.createElement('canvas'); haloC.width = haloC.height = 128;
  const hx = haloC.getContext('2d'), hg = hx.createRadialGradient(64, 64, 4, 64, 64, 64);
  hg.addColorStop(0, 'rgba(255,250,225,.9)'); hg.addColorStop(0.4, 'rgba(255,245,210,.25)'); hg.addColorStop(1, 'rgba(255,245,210,0)');
  hx.fillStyle = hg; hx.fillRect(0, 0, 128, 128);
  const halo = new THREE.Mesh(new THREE.PlaneGeometry(W * 1.05, 18), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(haloC), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, opacity: 0.6, side: THREE.DoubleSide }));
  halo.rotation.x = Math.PI / 2; halo.position.set(cx, TANK.maxY + 0.1, cz); scene.add(halo);

  // water surface (seen from below)
  const surface = new THREE.Mesh(new THREE.PlaneGeometry(W, D, 44, 20),
    new THREE.MeshStandardMaterial({ color: 0xaeeeff, transparent: true, opacity: 0.45, side: THREE.DoubleSide, roughness: 0.1, emissive: 0x2a7fa0 }));
  surface.rotation.x = -Math.PI / 2; surface.position.set(cx, TANK.maxY + 0.3, cz); scene.add(surface);

  // light shafts
  const shC = document.createElement('canvas'); shC.width = 4; shC.height = 128;
  const shx = shC.getContext('2d'), shg = shx.createLinearGradient(0, 0, 0, 128);
  shg.addColorStop(0, 'rgba(255,255,240,1)'); shg.addColorStop(1, 'rgba(255,255,240,0)');
  shx.fillStyle = shg; shx.fillRect(0, 0, 4, 128);
  const shaftMat = new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(shC), transparent: true, opacity: 0.08, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending });
  for (let i = 0; i < 34; i++) {
    const s = new THREE.Mesh(new THREE.PlaneGeometry(2.5 + Math.random() * 3.5, H * 1.15), shaftMat);
    s.position.set(TANK.minX + 3 + Math.random() * (W - 6), H * 0.45, cz + (Math.random() - 0.5) * (D - 10));
    s.rotation.set(0, Math.random() * Math.PI, (Math.random() - 0.5) * 0.25);
    scene.add(s);
  }

  // ---- castles, each with a fish-only cave ----
  const brick = brickTextures(), tiles = tileTextures();
  const castleStone = new THREE.MeshStandardMaterial({ map: brick.map, bumpMap: brick.bump, bumpScale: 3, roughness: 0.95 });
  const roofMat = new THREE.MeshStandardMaterial({ map: tiles.map, bumpMap: tiles.bump, bumpScale: 2, roughness: 0.7 });
  for (const CAVE of CAVES) {
  const castle = new THREE.Group();
  const stone = castleStone;
  const dark = new THREE.MeshBasicMaterial({ color: 0x1a1008 });
  const cw = CAVE.maxX - CAVE.minX, cd = CAVE.maxZ - CAVE.minZ;
  const ccx = (CAVE.minX + CAVE.maxX) / 2, ccz = (CAVE.minZ + CAVE.maxZ) / 2, ch = CAVE.maxY;
  const t = 0.6; // wall thickness (just outside the cave box)
  const wall = (sx, sy, sz, x, y, z, m = stone) => { const w = new THREE.Mesh(boxUV(new THREE.BoxGeometry(sx, sy, sz), 0.4), m); w.position.set(x, y, z); castle.add(w); return w; };
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
    const tg = new THREE.CylinderGeometry(1.1, 1.2, 4.5, 16);
    { const uv = tg.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 2.8, uv.getY(i) * 1.8); }
    const tower = new THREE.Mesh(tg, stone); tower.position.set(x, ch + 3.4, ccz); castle.add(tower);
    const rg = new THREE.ConeGeometry(1.45, 1.8, 16);
    { const uv = rg.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 3, uv.getY(i) * 1.2); }
    const roof = new THREE.Mesh(rg, roofMat); roof.position.set(x, ch + 6.5, ccz); castle.add(roof);
  }
  castle.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  scene.add(castle);
  const sign = makeTextSprite('CAVE: fish only', '#fff', 'rgba(0,0,0,.45)');
  sign.position.set(ccx, ch + 1.9, CAVE.maxZ + 1.2); sign.scale.set(4.5, 1.1, 1); scene.add(sign);
  }

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
      m.castShadow = true; m.receiveShadow = true;
      scene.add(m); weeds.push(m);
    }
  }

  // ---- anemones (heal fish) ----
  const anMat = new THREE.MeshStandardMaterial({ color: 0xff6fb5, emissive: 0x551133, roughness: 0.6 });
  const anBaseMat = new THREE.MeshStandardMaterial({ color: 0xc23d84 });
  const healMat = new THREE.MeshBasicMaterial({ color: 0xff9ad5, transparent: true, opacity: 0.08, depthWrite: false });
  const anTents = [], healBubbles = [];
  for (const A of ANEMONES) {
    const anem = new THREE.Group();
    const anBase = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 1.1, 0.8, 16), anBaseMat);
    anBase.position.y = 0.4; anem.add(anBase);
    for (let i = 0; i < 40; i++) {
      const tt = new THREE.Mesh(new THREE.CapsuleGeometry(0.09, 1.2, 3, 6), anMat);
      const a = Math.random() * Math.PI * 2, r = Math.random() * 0.75;
      const pivot = new THREE.Group(); pivot.position.set(Math.cos(a) * r, 0.8, Math.sin(a) * r);
      tt.position.y = 0.6; pivot.add(tt); pivot.rotation.set(Math.sin(a) * 0.4, 0, Math.cos(a) * 0.4);
      pivot.userData.phase = Math.random() * 6;
      anem.add(pivot); anTents.push(pivot);
    }
    anem.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    anem.position.set(A.x, 0, A.z); scene.add(anem);
    const hb = new THREE.Mesh(new THREE.SphereGeometry(A.r, 24, 16), healMat);
    hb.position.set(A.x, A.y, A.z); scene.add(hb); healBubbles.push(hb);
  }

  // ---- bubble columns ----
  const bubbleGeo = new THREE.SphereGeometry(0.16, 8, 6);
  const bubbleMat = new THREE.MeshStandardMaterial({ color: 0xe6fbff, emissive: 0x6fb8d8, transparent: true, opacity: 0.7, roughness: 0.05 });
  const stoneT = rockTextures();
  const airStoneMat = new THREE.MeshStandardMaterial({ color: 0x9fb2c0, map: stoneT.map, bumpMap: stoneT.bump, bumpScale: 2, roughness: 1 });
  const columns = BUBBLE_COLUMNS.map(bc => {
    const st = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.75, 0.45, 14), airStoneMat);
    st.position.set(bc.x, 0.22, bc.z); st.castShadow = st.receiveShadow = true; scene.add(st);
    const count = 220;
    const inst = new THREE.InstancedMesh(bubbleGeo, bubbleMat, count);
    const parts = Array.from({ length: count }, () => {
      const a = Math.random() * Math.PI * 2, r = Math.random() * bc.r * 0.8;
      return { y: Math.random() * TANK.maxY, x: Math.cos(a) * r, z: Math.sin(a) * r, s: 0.5 + Math.random() * 1.3, sp: 4 + Math.random() * 4, ph: Math.random() * 6 };
    });
    scene.add(inst);
    return { b: bc, inst, parts };
  });

  // floating specks
  const dustPos = new Float32Array(3000 * 3);
  for (let i = 0; i < 3000; i++) {
    dustPos[i * 3] = TANK.minX + Math.random() * W; dustPos[i * 3 + 1] = Math.random() * TANK.maxY; dustPos[i * 3 + 2] = TANK.minZ + Math.random() * D;
  }
  const dustGeo = new THREE.BufferGeometry(); dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
  scene.add(new THREE.Points(dustGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.07, transparent: true, opacity: 0.5 })));

  // decorations: treasure chest, rocks
  const chest = new THREE.Group();
  const woodT = woodTextures();
  const wood = new THREE.MeshStandardMaterial({ map: woodT.map, bumpMap: woodT.bump, bumpScale: 2, roughness: 0.85 }), gold = new THREE.MeshStandardMaterial({ color: 0xf2c94c, metalness: 0.8, roughness: 0.3, emissive: 0x332200 });
  const cb = new THREE.Mesh(boxUV(new THREE.BoxGeometry(1.8, 1, 1.1), 0.9), wood); cb.position.y = 0.5; chest.add(cb);
  const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 1.8, 12, 1, false, 0, Math.PI), wood);
  lid.rotation.z = Math.PI / 2; lid.position.y = 1; chest.add(lid);
  for (let i = 0; i < 6; i++) { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.05, 10), gold); c.position.set(-0.6 + i * 0.25, 1.05, 0.5); c.rotation.x = 1.2; chest.add(c); }
  chest.position.set(-30, 0, 9); chest.rotation.y = 0.6; chest.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } }); scene.add(chest);
  const rockT = rockTextures();
  const rockMat = new THREE.MeshStandardMaterial({ map: rockT.map, bumpMap: rockT.bump, bumpScale: 3, roughness: 0.95, flatShading: true });
  for (const [x, z, s] of [[4, 17, 1.8], [34, 15, 1.4], [-43, 17, 1.6], [17, -17, 2.2], [-20, -17, 1.9], [0, -6, 1.3], [44, 2, 1.5], [-12, 8, 1.2], [24, 0, 1.7]]) {
    const r = new THREE.Mesh(boxUV(new THREE.DodecahedronGeometry(s, 1), 0.35), rockMat);
    r.rotation.y = x * 1.3;
    r.position.set(x, s * 0.4, z); r.scale.y = 0.6; r.castShadow = r.receiveShadow = true; scene.add(r);
  }

  // rippling lamp light on everything inside the tank (not the table, rims or the lamp itself)
  const noCaustics = new Set([table, rimBot]);
  scene.traverse(o => { if (o.isMesh && !noCaustics.has(o) && o.parent !== lamp) addCaustics(o.material); });

  const tmpM = new THREE.Matrix4(), tmpQ = new THREE.Quaternion(), tmpS = new THREE.Vector3(), tmpP = new THREE.Vector3();
  function animate(time, dt) {
    causticTime.value = time;
    shaftMat.opacity = 0.07 + Math.sin(time * 0.7) * 0.02;
    for (const w of weeds) {
      const pos = w.geometry.attributes.position, base = w.userData.base;
      for (let i = 0; i < pos.count; i++) {
        const y = base[i * 3 + 1];
        pos.array[i * 3] = base[i * 3] + Math.sin(time * 1.4 + w.userData.phase + y * 0.5) * y * 0.08;
      }
      pos.needsUpdate = true;
    }
    for (const p of anTents) p.rotation.x = Math.sin(time * 2 + p.userData.phase) * 0.35;
    for (const hb of healBubbles) hb.scale.setScalar(1 + Math.sin(time * 2) * 0.04);
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
