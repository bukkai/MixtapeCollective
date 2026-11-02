// Measures the label on a blank tape, for the corners in covers/blanks/blanks.json.
//
//   node scripts/measure-label.mjs covers/blanks/navy-dust.jpg 470 320
//   node scripts/measure-label.mjs covers/blanks/navy-dust.jpg 470 320 --angle -15 --threshold 110
//
// x y is any point on the label paper. Starting from there it collects the bright paper,
// fits a line to each edge and prints the corners. Check the preview it writes next to
// the blank (green outline) and trim the corners by hand if the label has doodles or a stamp.

import path from 'node:path';
import { parseArgs } from 'node:util';
import sharp from 'sharp';

const { values: opts, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    angle: { type: 'string', default: '-12' },
    threshold: { type: 'string', default: '125' },
  },
});
const [file, sx, sy] = positionals;
if (!file || !sx || !sy) {
  console.error('usage: node scripts/measure-label.mjs <blank> <x> <y> [--angle deg] [--threshold 0-255]');
  process.exit(1);
}

const W = 1000;
const threshold = Number(opts.threshold);
const { data } = await sharp(file).resize(W, W).greyscale().blur(1.5).raw().toBuffer({ resolveWithObject: true });

// Flood fill the paper from the seed point
const paper = new Uint8Array(W * W);
const stack = [Number(sy) * W + Number(sx)];
while (stack.length) {
  const i = stack.pop();
  if (paper[i] || data[i] < threshold) continue;
  paper[i] = 1;
  const x = i % W;
  if (x > 0) stack.push(i - 1);
  if (x < W - 1) stack.push(i + 1);
  if (i >= W) stack.push(i - W);
  if (i < W * (W - 1)) stack.push(i + W);
}

// Work in the label's own frame: u runs along the label, v across it
const th = (Number(opts.angle) * Math.PI) / 180;
const c = Math.cos(th), s = Math.sin(th);
const cols = new Map(), rows = new Map();
const extend = (map, key, val) => {
  const r = map.get(key) ?? [Infinity, -Infinity];
  map.set(key, [Math.min(r[0], val), Math.max(r[1], val)]);
};
for (let i = 0; i < W * W; i++) {
  if (!paper[i]) continue;
  const x = i % W, y = Math.floor(i / W);
  const u = Math.round(x * c + y * s), v = Math.round(-x * s + y * c);
  extend(cols, u, v);
  extend(rows, v, u);
}

// Least squares b = slope * a + offset, using the middle 60% so torn corners don't pull the line
const fit = (map, side) => {
  const keys = [...map.keys()].sort((a, b) => a - b);
  const pts = keys.slice(Math.floor(keys.length * 0.2), Math.ceil(keys.length * 0.8)).map((k) => [k, map.get(k)[side]]);
  const n = pts.length;
  const sa = pts.reduce((t, p) => t + p[0], 0), sb = pts.reduce((t, p) => t + p[1], 0);
  const saa = pts.reduce((t, p) => t + p[0] * p[0], 0), sab = pts.reduce((t, p) => t + p[0] * p[1], 0);
  const slope = (n * sab - sa * sb) / (n * saa - sa * sa);
  return [slope, (sb - slope * sa) / n];
};
const top = fit(cols, 0), bottom = fit(cols, 1), left = fit(rows, 0), right = fit(rows, 1);

// Intersect v = h(u) with u = e(v), then rotate back to image coordinates
const meet = (h, e) => {
  const u = (e[0] * h[1] + e[1]) / (1 - e[0] * h[0]);
  const v = h[0] * u + h[1];
  return [Math.round(u * c - v * s), Math.round(u * s + v * c)];
};
const corners = [meet(top, left), meet(top, right), meet(bottom, right), meet(bottom, left)];
console.log(`"corners": ${JSON.stringify(corners).replaceAll('],[', '], [')}`);

const outline = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${W}"><polygon points="${corners.map((p) => p.join(',')).join(' ')}" fill="none" stroke="#0f0" stroke-width="3"/></svg>`;
const preview = path.join(path.dirname(file), `${path.parse(file).name}.measured.jpg`);
await sharp(file).resize(W, W).composite([{ input: Buffer.from(outline) }]).jpeg().toFile(preview);
console.log(`preview: ${preview}`);
