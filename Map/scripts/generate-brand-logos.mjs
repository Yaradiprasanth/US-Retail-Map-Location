/**
 * Generates 12 placeholder brand logo PNGs (32×32) for the map.
 * Run: node scripts/generate-brand-logos.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import zlib from "node:zlib";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, "../frontend/public/logos");

const PALETTE = [
  [37, 99, 235],
  [124, 58, 237],
  [219, 39, 119],
  [220, 38, 38],
  [234, 88, 12],
  [202, 138, 4],
  [22, 163, 74],
  [13, 148, 136],
  [8, 145, 178],
  [79, 70, 229],
  [100, 116, 139],
  [30, 41, 59],
];

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = c & 1 ? (c >>> 1) ^ 0xedb88320 : c >>> 1;
  }
  return ~c >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const typeBuf = Buffer.from(type);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])));
  return Buffer.concat([len, typeBuf, data, crc]);
}

function pngCircle(size, [r, g, b]) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  const cx = (size - 1) / 2;
  const cy = (size - 1) / 2;
  const radius = size * 0.42;

  for (let y = 0; y < size; y++) {
    const row = 1 + y * (size * 4 + 1);
    raw[row - 1] = 0;
    for (let x = 0; x < size; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const inside = dx * dx + dy * dy <= radius * radius;
      const i = row + x * 4;
      if (inside) {
        raw[i] = r;
        raw[i + 1] = g;
        raw[i + 2] = b;
        raw[i + 3] = 255;
      } else {
        raw[i] = 0;
        raw[i + 1] = 0;
        raw[i + 2] = 0;
        raw[i + 3] = 0;
      }
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const compressed = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", compressed),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

fs.mkdirSync(outDir, { recursive: true });

for (let i = 0; i < PALETTE.length; i++) {
  const file = path.join(outDir, `brand-${i}.png`);
  fs.writeFileSync(file, pngCircle(32, PALETTE[i]));
  console.log("Wrote", file);
}

console.log(`Done — ${PALETTE.length} placeholder logos in frontend/public/logos/`);
