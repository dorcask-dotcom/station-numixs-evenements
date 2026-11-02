'use strict';
/* Génère les icônes de l'application (un « N » en pixels, aux couleurs de la charte). Sans dépendance. */
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');

const BG = [62, 62, 61], FG = [214, 216, 55];
const N = ['X...X', 'XX..X', 'X.X.X', 'X..XX', 'X...X'];

function crc32(buf) {
  let c, crc = ~0;
  for (let i = 0; i < buf.length; i++) {
    c = (crc ^ buf[i]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return ~crc >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
function png(size) {
  const unit = size * 0.5 / 5, off = (size - unit * 5) / 2, pad = unit * 0.08;
  const raw = Buffer.alloc((size * 3 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 3 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      const c = Math.floor((x - off) / unit), r = Math.floor((y - off) / unit);
      let on = false;
      if (c >= 0 && c < 5 && r >= 0 && r < 5 && N[r][c] === 'X') {
        const fx = (x - off) - c * unit, fy = (y - off) - r * unit;
        on = fx >= pad && fx <= unit - pad && fy >= pad && fy <= unit - pad;
      }
      const col = on ? FG : BG, i = y * (size * 3 + 1) + 1 + x * 3;
      raw[i] = col[0]; raw[i + 1] = col[1]; raw[i + 2] = col[2];
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
const dir = path.join(__dirname, '..', 'site');
for (const s of [192, 512]) fs.writeFileSync(path.join(dir, 'icon-' + s + '.png'), png(s));
console.log('Icônes générées.');
