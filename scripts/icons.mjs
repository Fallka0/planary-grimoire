/**
 * The home-screen icons, drawn rather than exported.
 *
 *   node scripts/icons.mjs
 *
 * Every other asset in this project is authored in code — the posters are SVG
 * written by hand, the sound is an oscillator — and the icons follow, for the
 * same practical reason as much as the tidy one: there is no rasteriser on a
 * stock macOS, so an SVG icon cannot be turned into the PNGs that iOS insists
 * on without adding a toolchain to do it.
 *
 * So this writes the PNGs itself: a few hundred lines of nothing, a tiny PNG
 * encoder over node's own zlib, and the mark drawn by arithmetic. No
 * dependencies, and the result is identical on every machine.
 */

import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, "..", "public");

// ── A very small PNG writer ───────────────────────────

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(bytes) {
  let c = 0xffffffff;
  for (const byte of bytes) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const name = Buffer.from(type, "ascii");
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([name, data])));
  return Buffer.concat([length, name, data, crc]);
}

/** RGBA pixels (Uint8Array, 4 bytes each) to a PNG buffer. */
function png(width, height, pixels) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8; // bit depth
  header[9] = 6; // RGBA
  // Each scanline is prefixed with its filter type; 0 means "stored as is",
  // which costs a little size and saves a great deal of explaining.
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0;
    Buffer.from(pixels.buffer, y * width * 4, width * 4).copy(raw, y * (width * 4 + 1) + 1);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// ── The mark ──────────────────────────────────────────

const hex = (value) => [parseInt(value.slice(1, 3), 16), parseInt(value.slice(3, 5), 16), parseInt(value.slice(5, 7), 16)];

const FIELD = hex("#23308f"); // the table Grimoire is played on
const CHERRY = hex("#d9173c"); // the house chip
const PAPER = hex("#f6eee4");
const PLATE = hex("#ff5a78");

/**
 * What colour this point is, as if the mark were drawn at infinite resolution.
 *
 * Supersampled by the caller, which is how the edges come out smooth without a
 * drawing library: ask four times per pixel and average the answers.
 */
function shade(x, y, size, safe) {
  // Everything below is in units of the icon's width, so one description
  // serves every size.
  const u = x / size - 0.5;
  const v = y / size - 0.5;
  const r = Math.hypot(u, v);

  // `safe` pulls the mark in so a maskable icon can be cropped to a circle
  // without losing it. The field goes edge to edge either way.
  const s = safe ? 0.78 : 1;
  const disc = 0.3 * s;
  const ring = 0.245 * s;
  const core = 0.165 * s;
  const pip = 0.075 * s;

  if (r > disc) return FIELD;

  // The dashed edge ring: twelve ticks, as on the chip everywhere else.
  const ringBand = Math.abs(r - ring) < 0.031 * s;
  if (ringBand) {
    const angle = Math.atan2(v, u) + Math.PI;
    const ticks = 12;
    const phase = (angle / (Math.PI * 2)) * ticks;
    if (phase % 1 < 0.5) return PAPER;
    return CHERRY;
  }

  if (r < pip) return PLATE;
  if (r < core) return PAPER;
  return CHERRY;
}

function draw(size, safe) {
  const pixels = new Uint8Array(size * size * 4);
  const SAMPLES = 3; // 3×3 per pixel: enough that no edge shows a staircase
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0;
      let g = 0;
      let b = 0;
      for (let sy = 0; sy < SAMPLES; sy++) {
        for (let sx = 0; sx < SAMPLES; sx++) {
          const [cr, cg, cb] = shade(x + (sx + 0.5) / SAMPLES, y + (sy + 0.5) / SAMPLES, size, safe);
          r += cr;
          g += cg;
          b += cb;
        }
      }
      const n = SAMPLES * SAMPLES;
      const i = (y * size + x) * 4;
      pixels[i] = Math.round(r / n);
      pixels[i + 1] = Math.round(g / n);
      pixels[i + 2] = Math.round(b / n);
      pixels[i + 3] = 255;
    }
  }
  return png(size, size, pixels);
}

mkdirSync(out, { recursive: true });
const made = [
  ["icon-192.png", 192, false],
  ["icon-512.png", 512, false],
  // Masked to a circle or a squircle by the launcher, so the mark is pulled in.
  ["icon-maskable-512.png", 512, true],
  // iOS does not accept SVG here, and without it a home-screen Grimoire gets a
  // screenshot of the page instead of an icon.
  ["apple-touch-icon.png", 180, false],
];
for (const [name, size, safe] of made) {
  const file = join(out, name);
  writeFileSync(file, draw(size, safe));
  console.log(`  ${name.padEnd(24)} ${size}×${size}`);
}
console.log(`\n${made.length} icons written to public/\n`);
