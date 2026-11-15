import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons');

function crc32(buffer) {
  let crc = ~0;
  for (let i = 0; i < buffer.length; i += 1) {
    crc ^= buffer[i];
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return ~crc >>> 0;
}

function chunk(type, data) {
  const name = Buffer.from(type);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([name, data])), 0);
  return Buffer.concat([length, name, data, crc]);
}

function png(size, pixels) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y += 1) {
    const row = y * (size * 4 + 1);
    raw[row] = 0;
    pixels.copy(raw, row + 1, y * size * 4, (y + 1) * size * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([signature, chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

function draw(size, scale) {
  const pixels = Buffer.alloc(size * size * 4);
  const background = [47, 106, 74, 255];
  const mark = [244, 247, 244, 255];
  const center = (size - 1) / 2;
  const radius = size * 0.28 * scale;
  const thickness = Math.max(2, size * 0.045 * scale);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const offset = (y * size + x) * 4;
      pixels[offset] = background[0];
      pixels[offset + 1] = background[1];
      pixels[offset + 2] = background[2];
      pixels[offset + 3] = 255;
      const distance = Math.hypot(x - center, y - center);
      if (Math.abs(distance - radius) <= thickness || distance <= thickness * 1.35) {
        pixels[offset] = mark[0];
        pixels[offset + 1] = mark[1];
        pixels[offset + 2] = mark[2];
      }
    }
  }
  return pixels;
}

mkdirSync(root, { recursive: true });
writeFileSync(join(root, 'icon-192.png'), png(192, draw(192, 1)));
writeFileSync(join(root, 'icon-512.png'), png(512, draw(512, 1)));
writeFileSync(join(root, 'icon-maskable-512.png'), png(512, draw(512, 0.72)));
writeFileSync(join(root, 'apple-touch-icon.png'), png(180, draw(180, 1)));
console.log('icons written');
