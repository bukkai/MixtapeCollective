// Checks that published playlists still work: the smartlink resolves and lists its platforms,
// the Deezer playlist exists, and every track on it can be played in the given countries.
//
//   npm run check:links                         every published playlist, checked for NL
//   npm run check:links -- emotive-math-rock    just these
//   npm run check:links -- --country NL,BE,US   other countries
//   npm run check:links -- --report report.md   also write the report as Markdown
//
// Exits with 1 when something needs attention, so CI can act on it.
// Deezer's `readable` flag depends on where the request comes from, so tracks are checked
// against `available_countries` instead. That works the same on a laptop or a US CI runner.

import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { parse as parseYaml } from 'yaml';

const root = path.resolve(import.meta.dirname, '..');

const { values: opts, positionals: slugs } = parseArgs({
  allowPositionals: true,
  options: {
    country: { type: 'string', default: 'NL' },
    report: { type: 'string' },
  },
});

const countries = opts.country.split(',').map((c) => c.trim().toUpperCase());

const platforms = {
  deezer: /https:\/\/www\.deezer\.com\/(?:[a-z]{2}\/)?playlist\/(\d+)/,
  spotify: /https:\/\/open\.spotify\.com\/playlist\/[A-Za-z0-9]+/,
  youtube: /https:\/\/music\.youtube\.com\/playlist\?list=[\w-]+/,
};

// Deezer allows 50 requests per 5 seconds, stay well under it
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let lastRequest = 0;
async function deezer(url, attempt = 1) {
  const wait = lastRequest + 150 - Date.now();
  if (wait > 0) await sleep(wait);
  lastRequest = Date.now();
  // Quota errors and the odd HTML error page are worth retrying, other errors are real answers
  let data;
  try {
    data = await (await fetch(`https://api.deezer.com${url}`)).json();
  } catch (e) {
    if (attempt >= 4) throw new Error(`Deezer ${url}: ${e.message}`);
  }
  if (data && data.error?.code !== 4) return data;
  await sleep(5000 * attempt);
  return deezer(url, attempt + 1);
}

async function smartlinkPlatforms(smartlink) {
  const res = await fetch(smartlink, { headers: { 'User-Agent': 'Mozilla/5.0 (mixtape-collective link check)' } });
  if (!res.ok) throw new Error(`smartlink returned ${res.status}`);
  const html = await res.text();
  const found = {};
  for (const [name, re] of Object.entries(platforms)) {
    const m = html.match(re);
    if (m) found[name] = m;
  }
  return found;
}

async function deezerTracks(id) {
  const tracks = [];
  for (let index = 0; ; index += 100) {
    const page = await deezer(`/playlist/${id}/tracks?limit=100&index=${index}`);
    if (page.error) throw new Error(`Deezer playlist ${id}: ${page.error.message}`);
    tracks.push(...page.data);
    if (tracks.length >= page.total || !page.data.length) return tracks;
  }
}

// Pulled tracks often come back as a re-upload under a new id. Look for the same title by the
// same artist that does play everywhere we care about.
// Deezer's artist:"" track:"" search syntax returns nothing lately, so search plainly and match
// on names. Re-uploads can sit under a new artist id, so ids don't help either.
async function replacement(track) {
  const same = (a, b) => a.toLowerCase() === b.toLowerCase();
  const q = `${track.artist.name} ${track.title_short}`;
  const found = await deezer(`/search?q=${encodeURIComponent(q)}&limit=25`);
  const candidates = (found.data ?? []).filter(
    (c) => c.id !== track.id && same(c.artist.name, track.artist.name) && same(c.title_short, track.title_short),
  );
  // Same version first, so a live or acoustic take only comes up when nothing else does
  candidates.sort((a, b) => same(b.title, track.title) - same(a.title, track.title));
  for (const c of candidates.slice(0, 5)) {
    const detail = await deezer(`/track/${c.id}`);
    if (countries.every((country) => detail.available_countries?.includes(country))) return c;
  }
}

async function check(slug, data) {
  const problems = [];
  const info = [];

  if (!data.smartlink) return { problems: ['no smartlink in front matter'], info };

  let found;
  try {
    found = await smartlinkPlatforms(data.smartlink);
  } catch (e) {
    return { problems: [`${data.smartlink}: ${e.message}`], info };
  }
  const missing = Object.keys(platforms).filter((p) => !found[p]);
  if (missing.length) problems.push(`smartlink doesn't list ${missing.join(', ')}`);
  if (!found.deezer) return { problems, info };

  let tracks;
  try {
    tracks = await deezerTracks(found.deezer[1]);
  } catch (e) {
    problems.push(e.message);
    return { problems, info };
  }
  info.push(`${tracks.length} tracks on Deezer`);

  for (const t of tracks) {
    const detail = await deezer(`/track/${t.id}`);
    const label = `"${t.title}" by ${t.artist.name}`;
    const available = detail.available_countries ?? [];
    let problem;
    if (detail.error || !available.length) problem = `${label} is pulled from Deezer everywhere`;
    else {
      const blocked = countries.filter((c) => !available.includes(c));
      if (blocked.length) problem = `${label} not playable in ${blocked.join(', ')}`;
    }
    if (!problem) continue;
    const swap = await replacement(t);
    problems.push(swap ? `${problem}. Playable copy: [${swap.title}, from ${swap.album.title}](${swap.link})` : problem);
  }

  return { problems, info };
}

const files = fs
  .readdirSync(path.join(root, 'playlists'))
  .filter((f) => f.endsWith('.md'))
  .filter((f) => !slugs.length || slugs.includes(path.basename(f, '.md')));

const results = [];
for (const file of files) {
  const src = fs.readFileSync(path.join(root, 'playlists', file), 'utf8');
  const data = parseYaml(src.split(/^---$/m)[1]);
  const slug = path.basename(file, '.md');
  if (data.status !== 'published' && !slugs.includes(slug)) continue;
  const result = await check(slug, data);
  results.push({ slug, title: data.title, ...result });
  const mark = result.problems.length ? '✗' : '✓';
  console.log(`${mark} ${data.title}${result.info.length ? ` (${result.info.join(', ')})` : ''}`);
  for (const p of result.problems) console.log(`    ${p}`);
}

const broken = results.filter((r) => r.problems.length);
console.log(`\n${results.length} playlists checked for ${countries.join(', ')}, ${broken.length} need attention`);

if (opts.report) {
  const lines = [
    `Checked ${results.length} published playlists on ${new Date().toISOString().slice(0, 10)}, tracks checked for ${countries.join(', ')}.`,
    '',
  ];
  for (const r of broken) {
    lines.push(`### ${r.title}`, `\`playlists/${r.slug}.md\``, '');
    for (const p of r.problems) lines.push(`- ${p}`);
    lines.push('');
  }
  if (!broken.length) lines.push('Everything plays.');
  fs.writeFileSync(opts.report, lines.join('\n'));
}

process.exitCode = broken.length ? 1 : 0;
