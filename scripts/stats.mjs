// Snapshots how many people follow each published playlist, per platform, and appends it to
// stats/followers.csv so we can see growth over time.
//
//   npm run stats                       every published playlist
//   npm run stats -- emotive-math-rock  just these
//   npm run stats -- --dry-run          print, don't write
//
// What each platform gives us:
//   Deezer   fans, from the public API, no key needed
//   Spotify  followers (saves), needs SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET, skipped without.
//            Uses the login from npm run login:spotify when there is one, see scripts/lib/spotify.mjs
//   YouTube  playlist views, read from the playlist page. Playlists have no subscribers on YouTube
//            and the Data API doesn't expose views, so the page is all there is. If YouTube changes
//            its markup this one goes blank before anything else does.
//
// One row per playlist, platform and day. Running twice on the same day replaces that day's rows.

import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { parse as parseYaml } from 'yaml';
import { spotify, spotifyKeys } from './lib/spotify.mjs';

const root = path.resolve(import.meta.dirname, '..');
const csvPath = path.join(root, 'stats', 'followers.csv');
const header = 'date,slug,platform,metric,count';

const { values: opts, positionals: slugs } = parseArgs({
  allowPositionals: true,
  options: { 'dry-run': { type: 'boolean', default: false } },
});

const env = process.env;
const hasSpotify = spotifyKeys.app;
const ua = { 'User-Agent': 'Mozilla/5.0 (mixtape-collective stats)', 'Accept-Language': 'en' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const platforms = {
  deezer: /https:\/\/www\.deezer\.com\/(?:[a-z]{2}\/)?playlist\/(\d+)/,
  spotify: /https:\/\/open\.spotify\.com\/playlist\/([A-Za-z0-9]+)/,
  youtube: /https:\/\/music\.youtube\.com\/playlist\?list=([\w-]+)/,
};

async function smartlinkPlatforms(smartlink) {
  const res = await fetch(smartlink, { headers: ua });
  if (!res.ok) throw new Error(`smartlink returned ${res.status}`);
  const html = await res.text();
  const found = {};
  for (const [name, re] of Object.entries(platforms)) {
    const m = html.match(re);
    if (m) found[name] = m[1];
  }
  return found;
}

async function deezerFans(id) {
  await sleep(150);
  const data = await (await fetch(`https://api.deezer.com/playlist/${id}`)).json();
  if (data.error) throw new Error(`Deezer: ${data.error.message}`);
  return data.fans;
}

async function spotifyFollowers(id) {
  const data = await spotify(`/playlists/${id}?fields=followers(total)`);
  if (typeof data.followers?.total !== 'number') throw new Error('Spotify returned no follower count');
  return data.followers.total;
}

// The header reads "35 videos" and "31 views" (or "No views"), in English thanks to hl=en
async function youtubeViews(id) {
  const res = await fetch(`https://www.youtube.com/playlist?list=${id}&hl=en`, { headers: ua });
  if (!res.ok) throw new Error(`YouTube page returned ${res.status}`);
  const m = (await res.text()).match(/"content":"(No|[\d,]+) views?"/);
  if (!m) throw new Error('YouTube page has no view count, markup may have changed');
  return m[1] === 'No' ? 0 : Number(m[1].replaceAll(',', ''));
}

const sources = [
  { platform: 'deezer', metric: 'fans', run: deezerFans },
  { platform: 'spotify', metric: 'followers', run: spotifyFollowers, skip: !hasSpotify },
  { platform: 'youtube', metric: 'views', run: youtubeViews },
];

// Previous counts, to show what changed since the last snapshot on another day
const today = new Date().toISOString().slice(0, 10);
const oldRows = fs.existsSync(csvPath)
  ? fs.readFileSync(csvPath, 'utf8').trim().split('\n').slice(1).filter(Boolean).map((l) => l.split(','))
  : [];
const previous = new Map();
for (const [date, slug, platform, , count] of oldRows) {
  if (date < today) previous.set(`${slug}/${platform}`, Number(count));
}

console.log(`Snapshot for ${today}: Deezer fans, ${hasSpotify ? 'Spotify followers' : 'Spotify skipped (no key)'}, YouTube views\n`);

const rows = [];
const errors = [];
const files = fs.readdirSync(path.join(root, 'playlists')).filter((f) => f.endsWith('.md'));
for (const file of files) {
  const slug = path.basename(file, '.md');
  if (slugs.length && !slugs.includes(slug)) continue;
  const data = parseYaml(fs.readFileSync(path.join(root, 'playlists', file), 'utf8').split(/^---$/m)[1]);
  if (data.status !== 'published' && !slugs.includes(slug)) continue;
  if (!data.smartlink) {
    errors.push(`${data.title}: no smartlink`);
    continue;
  }

  let found;
  try {
    found = await smartlinkPlatforms(data.smartlink);
  } catch (e) {
    errors.push(`${data.title}: ${e.message}`);
    continue;
  }

  const line = [];
  for (const { platform, metric, run, skip } of sources) {
    if (skip || !found[platform]) continue;
    try {
      const count = await run(found[platform]);
      rows.push([today, slug, platform, metric, count]);
      const before = previous.get(`${slug}/${platform}`);
      const delta = before === undefined || before === count ? '' : ` (${count > before ? '+' : ''}${count - before})`;
      line.push(`${platform} ${count}${delta}`);
    } catch (e) {
      errors.push(`${data.title}: ${e.message}`);
    }
  }
  console.log(`${data.title}: ${line.join(', ') || 'nothing'}`);
}

const totals = {};
for (const [, , platform, , count] of rows) totals[platform] = (totals[platform] ?? 0) + count;
console.log(`\nTotal: ${Object.entries(totals).map(([p, n]) => `${p} ${n}`).join(', ')}`);
if (errors.length) console.log(`\nCouldn't get:\n${errors.map((e) => `  ${e}`).join('\n')}`);

if (!opts['dry-run'] && rows.length) {
  // Replace today's rows for what we just measured, keep everything else
  const measured = new Set(rows.map(([, slug, platform]) => `${slug}/${platform}`));
  const kept = oldRows.filter(([date, slug, platform]) => !(date === today && measured.has(`${slug}/${platform}`)));
  const all = [...kept, ...rows].sort((a, b) => a[0].localeCompare(b[0]) || a[1].localeCompare(b[1]) || a[2].localeCompare(b[2]));
  fs.mkdirSync(path.dirname(csvPath), { recursive: true });
  fs.writeFileSync(csvPath, [header, ...all.map((r) => r.join(','))].join('\n') + '\n');
  console.log(`\nWrote ${rows.length} rows to stats/followers.csv`);
}
