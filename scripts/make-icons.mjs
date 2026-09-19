// Generates WinKit extension icons + web favicon from the canonical mark.
// Source of truth: logo/logo.png (transparent, textless, centered).
// No external deps: plain resize via node:zlib-free PNG handling is overkill,
// so this script shells to the file directly with a tiny pure-JS scaler.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { inflateSync, deflateSync } from 'node:zlib';

function crc32(buf) {
  let table = crc32.table;
  if (!table) {
    table = crc32.table = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c >>> 0;
    }
  }
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function readPng(path) {
  const raw = readFileSync(path);
  let pos = 8;
  let width = 0;
  let height = 0;
  let ctype = 0;
  const idats = [];
  while (pos < raw.length) {
    const len = raw.readUInt32BE(pos);
    const type = raw.toString('ascii', pos + 4, pos + 8);
    const data = raw.subarray(pos + 8, pos + 8 + len);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      ctype = data[9];
    } else if (type === 'IDAT') {
      idats.push(data);
    }
    pos += 12 + len;
  }
  if (ctype !== 6) throw new Error('expected RGBA PNG, got color type ' + ctype);
  const inflated = inflateSync(Buffer.concat(idats));
  const channels = 4;
  const stride = width * channels;
  const px = Buffer.alloc(width * height * channels);
  let p = 0;
  for (let y = 0; y < height; y++) {
    const filter = inflated[p++];
    const row = px.subarray(y * stride, (y + 1) * stride);
    const prev = y > 0 ? px.subarray((y - 1) * stride, y * stride) : Buffer.alloc(stride);
    for (let x = 0; x < stride; x++) {
      const a = x >= channels ? row[x - channels] : 0;
      const b = prev[x];
      const c = x >= channels ? prev[x - channels] : 0;
      let v = inflated[p++];
      if (filter === 1) v = (v + a) & 255;
      else if (filter === 2) v = (v + b) & 255;
      else if (filter === 3) v = (v + ((a + b) >> 1)) & 255;
      else if (filter === 4) {
        const pa = Math.abs(b - c);
        const pb = Math.abs(a - c);
        const pc = Math.abs(a + b - 2 * c);
        const pr = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
        v = (v + pr) & 255;
      }
      row[x] = v;
    }
  }
  return { width, height, px };
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function writePng(path, width, height, px) {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0;
    px.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  writeFileSync(
    path,
    Buffer.concat([
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
      chunk('IHDR', ihdr),
      chunk('IDAT', deflateSync(raw)),
      chunk('IEND', Buffer.alloc(0)),
    ]),
  );
}

function resize(src, size) {
  const { width: sw, height: sh, px } = src;
  const out = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      // 2x2 box sample
      for (let dy = 0; dy < 2; dy++) {
        for (let dx = 0; dx < 2; dx++) {
          const sx = Math.min(sw - 1, Math.floor(((x * 2 + dx) / (size * 2)) * sw));
          const sy = Math.min(sh - 1, Math.floor(((y * 2 + dy) / (size * 2)) * sh));
          const i = (sy * sw + sx) * 4;
          r += px[i];
          g += px[i + 1];
          b += px[i + 2];
          a += px[i + 3];
        }
      }
      const o = (y * size + x) * 4;
      out[o] = Math.round(r / 4);
      out[o + 1] = Math.round(g / 4);
      out[o + 2] = Math.round(b / 4);
      out[o + 3] = Math.round(a / 4);
    }
  }
  return out;
}

const src = readPng(new URL('../logo/logo.png', import.meta.url));
mkdirSync(new URL('../public.ext/icons/', import.meta.url), { recursive: true });
// Single-pass bilinear from the full-res source.
function at(size) {
  const { width: sw, height: sh, px } = src;
  const out = Buffer.alloc(size * size * 4);
  const ch = (x, y, c) => {
    const cx = Math.max(0, Math.min(sw - 1, x));
    const cy = Math.max(0, Math.min(sh - 1, y));
    return px[(cy * sw + cx) * 4 + c];
  };
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const gx = ((x + 0.5) / size) * sw - 0.5;
      const gy = ((y + 0.5) / size) * sh - 0.5;
      const x0 = Math.floor(gx);
      const y0 = Math.floor(gy);
      const fx = gx - x0;
      const fy = gy - y0;
      const o = (y * size + x) * 4;
      for (let c = 0; c < 4; c++) {
        out[o + c] = Math.round(
          ch(x0, y0, c) * (1 - fx) * (1 - fy) +
            ch(x0 + 1, y0, c) * fx * (1 - fy) +
            ch(x0, y0 + 1, c) * (1 - fx) * fy +
            ch(x0 + 1, y0 + 1, c) * fx * fy,
        );
      }
    }
  }
  return { px: out, size };
}

for (const size of [16, 32, 48, 128]) {
  const { px } = at(size);
  writePng(new URL(`../public.ext/icons/icon${size}.png`, import.meta.url), size, size, px);
  console.log(`icon${size}.png written`);
}
{
  const { px } = at(64);
  writePng(new URL('../public.web/favicon.png', import.meta.url), 64, 64, px);
  console.log('favicon.png written');
}
