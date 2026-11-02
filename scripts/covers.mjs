// Builds playlist covers from a blank tape, a label and the playlist color.
//
//   npm run covers                      every playlist with `tape` and `label` set
//   npm run covers -- emotive-math-rock just these
//   npm run covers -- emotive-math-rock --label "emomath" --tape scuffed-black --font salt --out /tmp/try
//
// Writes covers/<slug>.jpg (1000x1000, Deezer and Spotify) and covers/youtube/<slug>.jpg (1280x720).
// Blank tapes and the corners of their label (top-left, top-right, bottom-right, bottom-left)
// live in covers/blanks/blanks.json.

import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import sharp from 'sharp';
import opentype from 'opentype.js';
import { parse as parseYaml } from 'yaml';
import { palette } from '../src/data/palette.ts';

const root = path.resolve(import.meta.dirname, '..');
const blanksDir = path.join(root, 'covers/blanks');
const blanks = JSON.parse(fs.readFileSync(path.join(blanksDir, 'blanks.json'), 'utf8'));

const fontFile = (pkg) => path.join(root, `node_modules/@fontsource/${pkg}/files/${pkg}-latin-400-normal.woff`);
// stroke thickens a font that only comes in a thin weight, as a fraction of the font size
const fonts = {
  marker: { file: fontFile('permanent-marker'), stroke: 0 },
  salt: { file: fontFile('rock-salt'), stroke: 0.045 },
  brush: { file: fontFile('caveat-brush'), stroke: 0 },
  typewriter: { file: fontFile('special-elite'), stroke: 0 },
};

const SIZE = 1000;
const INK = '#1b1915';

const { values: opts, positionals: slugs } = parseArgs({
  allowPositionals: true,
  options: {
    label: { type: 'string' },
    tape: { type: 'string' },
    font: { type: 'string' },
    out: { type: 'string' },
  },
});

const outDir = opts.out ? path.resolve(opts.out) : path.join(root, 'covers');

// Small stable jitter per playlist so labels don't all sit identically
function jitter(slug) {
  let h = 7;
  for (const c of slug) h = (h * 31 + c.charCodeAt(0)) | 0;
  const r = (n) => ((Math.abs(h >> n) % 1000) / 1000) * 2 - 1;
  return { angle: r(0) * 0.5, dx: r(4) * 10, dy: r(8) * 6 };
}

// opentype's own toPathData() packs numbers so tightly that librsvg sometimes gives up halfway
// through (Rock Salt at some sizes lost its last letters), so spell every coordinate out
function pathData(p) {
  const n = (v) => v.toFixed(2);
  return p.commands
    .map((c) => {
      if (c.type === 'Z') return 'Z';
      if (c.type === 'Q') return `Q ${n(c.x1)} ${n(c.y1)} ${n(c.x)} ${n(c.y)}`;
      if (c.type === 'C') return `C ${n(c.x1)} ${n(c.y1)} ${n(c.x2)} ${n(c.y2)} ${n(c.x)} ${n(c.y)}`;
      return `${c.type} ${n(c.x)} ${n(c.y)}`;
    })
    .join(' ');
}

// Text runs along the label's top and bottom edges and fills most of the band between them.
// The side edges only set the width: torn or slanted ends shouldn't skew the lettering.
function labelBox([tl, tr, br, bl]) {
  const angleOf = (a, b) => Math.atan2(b[1] - a[1], b[0] - a[0]);
  const angle = (angleOf(tl, tr) + angleOf(bl, br)) / 2;
  const length = (Math.hypot(tr[0] - tl[0], tr[1] - tl[1]) + Math.hypot(br[0] - bl[0], br[1] - bl[1])) / 2;
  // distance from the top edge to the bottom edge's midpoint
  const mid = [(bl[0] + br[0]) / 2, (bl[1] + br[1]) / 2];
  const band = Math.abs((mid[0] - tl[0]) * Math.sin(angle) - (mid[1] - tl[1]) * Math.cos(angle));
  return {
    x: (tl[0] + tr[0] + br[0] + bl[0]) / 4,
    y: (tl[1] + tr[1] + br[1] + bl[1]) / 4,
    width: length * 0.82,
    height: band * 0.68,
    angle: (angle * 180) / Math.PI,
  };
}

function labelSvg(text, fontName, box, slug) {
  const { file, stroke } = fonts[fontName] ?? fonts.marker;
  const font = opentype.parse(fs.readFileSync(file).buffer);
  const probe = font.getPath(text, 0, 0, 100).getBoundingBox();
  const size = 100 * Math.min(box.width / (probe.x2 - probe.x1), box.height / (probe.y2 - probe.y1));
  const glyphs = font.getPath(text, 0, 0, size);
  const b = glyphs.getBoundingBox();
  const j = jitter(slug);
  const transform = [
    `translate(${box.x + j.dx} ${box.y + j.dy})`,
    `rotate(${box.angle + j.angle})`,
    `translate(${-(b.x1 + b.x2) / 2} ${-(b.y1 + b.y2) / 2})`,
  ].join(' ');

  // Wobbly edges plus a few dry spots, so it reads as marker on paper rather than type
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}">
    <filter id="ink" filterUnits="userSpaceOnUse" x="0" y="0" width="${SIZE}" height="${SIZE}">
      <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="2" seed="3" result="wobble"/>
      <feDisplacementMap in="SourceGraphic" in2="wobble" scale="5" result="shaky"/>
      <feTurbulence type="fractalNoise" baseFrequency="0.6" numOctaves="1" seed="9" result="grain"/>
      <feColorMatrix in="grain" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -1.4 1.7" result="dry"/>
      <feComposite in="shaky" in2="dry" operator="in"/>
    </filter>
    <g filter="url(#ink)"><path d="${pathData(glyphs)}" transform="${transform}" fill="${INK}" fill-opacity="0.9" stroke="${INK}" stroke-opacity="0.9" stroke-width="${stroke * size}" stroke-linejoin="round"/></g>
  </svg>`;
}

// Rounded square with slightly bulging sides, like an old TV screen
function frameSvg() {
  const a = 75, z = SIZE - a, r = 16, bulge = 22, m = SIZE / 2;
  const d = [
    `M ${a + r} ${a}`,
    `Q ${m} ${a - bulge} ${z - r} ${a}`,
    `Q ${z} ${a} ${z} ${a + r}`,
    `Q ${z + bulge} ${m} ${z} ${z - r}`,
    `Q ${z} ${z} ${z - r} ${z}`,
    `Q ${m} ${z + bulge} ${a + r} ${z}`,
    `Q ${a} ${z} ${a} ${z - r}`,
    `Q ${a - bulge} ${m} ${a} ${a + r}`,
    `Q ${a} ${a} ${a + r} ${a}`,
    'Z',
  ].join(' ');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}"><path d="${d}" fill="#fff"/></svg>`;
}

async function build(slug, data) {
  const tapeName = opts.tape ?? data.tape;
  const text = opts.label ?? data.label;
  const tape = blanks[tapeName];
  if (!tape) throw new Error(`${slug}: unknown tape "${tapeName}", see covers/blanks/blanks.json`);
  const color = palette[data.color]?.deezer;
  if (!color) throw new Error(`${slug}: color "${data.color}" has no deezer value in palette.ts`);

  const labelled = await sharp(path.join(blanksDir, tape.file))
    .resize(SIZE, SIZE)
    .composite([{ input: Buffer.from(labelSvg(text, opts.font ?? data.font ?? tape.font, labelBox(tape.corners), slug)), blend: 'multiply' }])
    .toBuffer();

  const framed = await sharp(labelled)
    .composite([{ input: Buffer.from(frameSvg()), blend: 'dest-in' }])
    .png()
    .toBuffer();

  const square = await sharp({ create: { width: SIZE, height: SIZE, channels: 3, background: color } })
    .composite([{ input: framed }])
    .jpeg({ quality: 90 })
    .toBuffer();

  // YouTube wants 16:9: same square in the middle, color fills the sides
  const wide = await sharp({ create: { width: 1280, height: 720, channels: 3, background: color } })
    .composite([{ input: await sharp(square).resize(720, 720).toBuffer(), left: 280, top: 0 }])
    .jpeg({ quality: 90 })
    .toBuffer();

  fs.mkdirSync(path.join(outDir, 'youtube'), { recursive: true });
  fs.writeFileSync(path.join(outDir, `${slug}.jpg`), square);
  fs.writeFileSync(path.join(outDir, 'youtube', `${slug}.jpg`), wide);
  console.log(`${slug}: "${text}" on ${tapeName}, ${data.color}`);
}

const files = slugs.length ? slugs.map((s) => `${s}.md`) : fs.readdirSync(path.join(root, 'playlists'));
for (const file of files) {
  const src = fs.readFileSync(path.join(root, 'playlists', file), 'utf8');
  const data = parseYaml(src.split(/^---$/m)[1]);
  const slug = path.basename(file, '.md');
  if (!(opts.tape ?? data.tape) || !(opts.label ?? data.label)) {
    if (slugs.length) console.warn(`${slug}: no tape or label, skipped`);
    continue;
  }
  await build(slug, data);
}
