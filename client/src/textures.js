import * as THREE from 'three';

// Small procedural textures (no image downloads). Each returns { map, bump }.
const rnd = (a, b) => a + Math.random() * (b - a);

function canvas(size = 256) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  return [c, c.getContext('2d')];
}
function tex(c, srgb, repeat = 1) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.anisotropy = 4;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
// speckle noise: lots of small soft dots
function speckle(x, size, n, colors, rMin, rMax, alpha) {
  for (let i = 0; i < n; i++) {
    x.globalAlpha = alpha * rnd(0.4, 1);
    x.fillStyle = colors[i % colors.length];
    x.beginPath(); x.arc(rnd(0, size), rnd(0, size), rnd(rMin, rMax), 0, Math.PI * 2); x.fill();
  }
  x.globalAlpha = 1;
}
// copy a colour canvas to a greyscale bump canvas
function toBump(src, contrast = 1.6) {
  const [c, x] = canvas(src.width);
  x.filter = `grayscale(1) contrast(${contrast})`;
  x.drawImage(src, 0, 0);
  return c;
}

export function sandTextures(repeat) {
  const S = 256, [c, x] = canvas(S);
  x.fillStyle = '#d8c296'; x.fillRect(0, 0, S, S);
  speckle(x, S, 2600, ['#b89c6c', '#efdcb3', '#a88a5c', '#fff3d6', '#c9ae7e'], 0.6, 1.8, 0.8);
  speckle(x, S, 40, ['#c6ab79', '#e6d2a6'], 8, 22, 0.25);
  return { map: tex(c, true, repeat), bump: tex(toBump(c, 2), false, repeat) };
}

export function brickTextures() {
  const S = 256, [c, x] = canvas(S);
  const mortar = '#7d6a58';
  x.fillStyle = mortar; x.fillRect(0, 0, S, S);
  const rows = 8, bh = S / rows, bw = S / 4;
  for (let r = 0; r < rows; r++) {
    const off = (r % 2) * bw / 2;
    for (let k = -1; k < 5; k++) {
      const l = 30 + rnd(-6, 6), h = 30 + rnd(-4, 4);
      x.fillStyle = `hsl(${h}, ${rnd(22, 34)}%, ${l + 22}%)`;
      x.beginPath(); x.roundRect(k * bw + off + 3, r * bh + 3, bw - 6, bh - 6, 4); x.fill();
    }
  }
  speckle(x, S, 1600, ['#5e4a39', '#d9c3a6', '#8d7660'], 0.5, 1.6, 0.35);
  speckle(x, S, 30, ['#4f6b3a', '#6d8a46'], 4, 12, 0.18); // a little algae
  return { map: tex(c, true), bump: tex(toBump(c, 2.4), false) };
}

export function rockTextures() {
  const S = 256, [c, x] = canvas(S);
  x.fillStyle = '#6f7b84'; x.fillRect(0, 0, S, S);
  speckle(x, S, 120, ['#59646d', '#87939b', '#4d575f', '#9aa5ad'], 6, 26, 0.35);
  speckle(x, S, 2200, ['#3e464d', '#b3bcc2', '#5f6a72'], 0.5, 1.8, 0.6);
  speckle(x, S, 50, ['#5a7a3c', '#7a9a4a', '#4b6b33'], 5, 16, 0.3); // moss
  // cracks
  x.strokeStyle = 'rgba(30,35,40,.55)'; x.lineWidth = 1.2;
  for (let i = 0; i < 14; i++) {
    let px = rnd(0, S), py = rnd(0, S);
    x.beginPath(); x.moveTo(px, py);
    for (let k = 0; k < 6; k++) { px += rnd(-18, 18); py += rnd(-18, 18); x.lineTo(px, py); }
    x.stroke();
  }
  return { map: tex(c, true), bump: tex(toBump(c, 2), false) };
}

export function woodTextures() {
  const S = 256, [c, x] = canvas(S);
  const planks = 5, ph = S / planks;
  for (let i = 0; i < planks; i++) {
    x.fillStyle = `hsl(26, ${rnd(45, 55)}%, ${rnd(24, 32)}%)`;
    x.fillRect(0, i * ph, S, ph);
    x.strokeStyle = 'rgba(40,20,8,.35)'; x.lineWidth = 1;
    for (let g = 0; g < 9; g++) { // grain
      const y0 = i * ph + rnd(3, ph - 3);
      x.beginPath(); x.moveTo(0, y0);
      for (let px = 0; px <= S; px += 16) x.lineTo(px, y0 + Math.sin(px * 0.05 + g) * 1.5);
      x.stroke();
    }
    x.fillStyle = 'rgba(25,12,4,.8)'; x.fillRect(0, i * ph, S, 2); // gap between planks
  }
  return { map: tex(c, true), bump: tex(toBump(c, 2), false) };
}

export function tileTextures() {
  const S = 128, [c, x] = canvas(S);
  x.fillStyle = '#8f2f2f'; x.fillRect(0, 0, S, S);
  const rows = 6, h = S / rows;
  for (let r = 0; r < rows; r++) for (let k = -1; k < 7; k++) {
    x.fillStyle = `hsl(0, ${rnd(55, 65)}%, ${rnd(48, 56)}%)`;
    x.beginPath(); x.ellipse(k * 21 + (r % 2) * 10, r * h + h * 0.55, 10, h * 0.6, 0, 0, Math.PI); x.fill();
  }
  return { map: tex(c, true), bump: tex(toBump(c, 2), false) };
}

// Box-project UVs from local position so a texture keeps the same scale on every face/size.
export function boxUV(geo, scale = 1) {
  const pos = geo.attributes.position, nor = geo.attributes.normal;
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    const ax = Math.abs(nor.getX(i)), ay = Math.abs(nor.getY(i)), az = Math.abs(nor.getZ(i));
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    let u, v;
    if (ax >= ay && ax >= az) { u = z; v = y; } else if (ay >= az) { u = x; v = z; } else { u = x; v = y; }
    uv[i * 2] = u * scale; uv[i * 2 + 1] = v * scale;
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return geo;
}
