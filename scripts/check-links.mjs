// Checks that published playlists still work: the smartlink resolves and lists its platforms,
// each platform's playlist exists, and every track on it can be played in the given countries.
//
//   npm run check:links                         every published playlist, checked for NL
//   npm run check:links -- emotive-math-rock    just these
//   npm run check:links -- --country NL,BE,US   other countries
//   npm run check:links -- --report report.md   also write the report as Markdown
//
// Deezer needs no key. YouTube needs YOUTUBE_API_KEY and is skipped without it. Spotify checks
// every track with SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET and a login (see scripts/lib/spotify.mjs),
// and without them only whether the playlist exists and how many tracks it has. The report says which ran.
//
// Exits with 1 when something needs attention, so CI can act on it.
// Tracks Deezer's API calls dead don't count while Deezer probably still plays them: the same
// recording (same ISRC) is back under a new id, or the album is still in the catalog. Those are
// listed separately as worth a look, like track counts that differ between platforms.
// Deezer's `readable` flag depends on where the request comes from, so tracks are checked
// against `available_countries` instead. That works the same on a laptop or a US CI runner.
// Spotify and YouTube take the country as a parameter, so they don't have that problem.

import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { parse as parseYaml } from 'yaml';
import {
  platforms,
  searchQuota,
  sleep,
  smartlinkPlatforms,
  youtubeAlternative,
  youtubeBlockedIn,
  youtubeGone,
  youtubeItemName,
  youtubePlaylist,
  youtubeVideos,
} from './lib/links.mjs';
import { spotify, spotifyKeys } from './lib/spotify.mjs';

const root = path.resolve(import.meta.dirname, '..');

const { values: opts, positionals: slugs } = parseArgs({
  allowPositionals: true,
  options: {
    country: { type: 'string', default: 'NL' },
    report: { type: 'string' },
  },
});

const countries = opts.country.split(',').map((c) => c.trim().toUpperCase());
const env = process.env;
const keys = {
  // Reading tracks needs a logged-in user since February 2026, see scripts/lib/spotify.mjs
  spotify: spotifyKeys.user,
  youtube: env.YOUTUBE_API_KEY,
};

// Deezer allows 50 requests per 5 seconds, stay well under it
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

async function deezerTracks(id) {
  const tracks = [];
  for (let index = 0; ; index += 100) {
    const page = await deezer(`/playlist/${id}/tracks?limit=100&index=${index}`);
    if (page.error) throw new Error(`Deezer playlist ${id}: ${page.error.message}`);
    tracks.push(...page.data);
    if (tracks.length >= page.total || !page.data.length) return tracks;
  }
}

const playsEverywhere = (detail) => countries.every((c) => detail.available_countries?.includes(c));

// The same recording re-uploaded under a new id, which Deezer plays in place of the dead one
async function reupload(track) {
  if (!track.isrc) return;
  const found = await deezer(`/track/isrc:${track.isrc}`);
  if (!found.error && found.id !== track.id && playsEverywhere(found)) return found;
}

// Otherwise look for the same title by the same artist that does play everywhere we care about.
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
    if (playsEverywhere(await deezer(`/track/${c.id}`))) return c;
  }
}

async function checkDeezer(id, out) {
  const tracks = await deezerTracks(id);
  out.counts.Deezer = tracks.length;

  for (const t of tracks) {
    const detail = await deezer(`/track/${t.id}`);
    const label = `"${t.title}" by ${t.artist.name}`;
    const available = detail.available_countries ?? [];
    let problem;
    if (detail.error || !available.length) problem = `${label} is pulled from Deezer everywhere`;
    else {
      const blocked = countries.filter((c) => !available.includes(c));
      if (blocked.length) problem = `${label} not playable on Deezer in ${blocked.join(', ')}`;
    }
    if (!problem) continue;
    const copy = (swap) => `[${swap.title}, from ${swap.album.title}](${swap.link})`;
    const same = await reupload(t);
    if (same) {
      out.minor.push(`${label} plays on Deezer as its re-upload ${copy(same)}`);
      continue;
    }
    const swap = await replacement(t);
    const suggestion = swap ? `. Playable copy, check the version: ${copy(swap)}` : '';
    // The app plays a fallback the public API can't see, so a track it calls dead often still
    // plays. Only count it while its album is gone from the catalog as well.
    const album = detail.album && (await deezer(`/album/${detail.album.id}`));
    if (!detail.error && album && !album.error && album.available !== false) {
      out.minor.push(`${problem} according to the API, but its album is still listed, so it probably plays${suggestion}`);
      continue;
    }
    out.problems.push(`${problem}, album gone too${suggestion}`);
  }
}

// With a market, Spotify relinks dead ids to a playable copy by itself and only reports
// is_playable false when there's really nothing to play. A removed track comes back as null.
// Since the February 2026 API changes /tracks answers 403 and the playlist lives at /items,
// with each entry under `item` instead of `track`. Both are asked for in case of a mixed rollout.
async function checkSpotify(id, out) {
  const blocked = new Map();
  let removed = 0;
  const fields = 'name,is_playable,restrictions,artists(name)';
  for (const market of countries) {
    const items = [];
    let url = `/playlists/${id}/items?market=${market}&limit=100&fields=next,items(is_local,item(${fields}),track(${fields}))`;
    while (url) {
      const page = await spotify(url);
      items.push(...page.items);
      url = page.next;
    }
    out.counts.Spotify = items.length;
    const entries = items.map((i) => ({ is_local: i.is_local, t: i.item ?? i.track }));
    removed = entries.filter((e) => !e.t).length;
    for (const { is_local, t } of entries) {
      if (is_local || !t || t.is_playable !== false) continue;
      const reason = t.restrictions?.reason ? ` (${t.restrictions.reason})` : '';
      const label = `"${t.name}" by ${t.artists.map((a) => a.name).join(', ')}${reason}`;
      blocked.set(label, [...(blocked.get(label) ?? []), market]);
    }
  }
  for (const [label, markets] of blocked) out.problems.push(`${label} not playable on Spotify in ${markets.join(', ')}`);
  if (removed) out.problems.push(`${removed} track${removed > 1 ? 's are' : ' is'} gone from Spotify, the playlist shows ${removed > 1 ? 'them' : 'it'} as unavailable`);
}

// The Web API needs an app whose owner has Premium. Without a key, the public playlist page
// still tells whether the playlist exists and how many tracks it has, from its preview tags.
async function checkSpotifyPage(id, out) {
  const res = await fetch(`https://open.spotify.com/playlist/${id}`, { headers: { 'User-Agent': 'Mozilla/5.0 (mixtape-collective link check)' } });
  if (res.status === 404) throw new Error(`Spotify playlist ${id} is gone`);
  if (!res.ok) throw new Error(`Spotify playlist page returned ${res.status}`);
  const count = (await res.text()).match(/<meta name="music:song_count" content="(\d+)"/)?.[1];
  if (count) out.counts.Spotify = Number(count);
}

// Removed videos stay in the playlist as "Deleted video" or "Private video", and the videos
// endpoint simply leaves them out. Region blocks are on the video itself. YouTube Music often
// plays another version of the song in their place (tested Nov 2026: fully blocked, allowed in
// 3 countries and allowed in 34 all played in NL), so those are only worth a look, with a
// version that plays when one turns up. `npm run fix:youtube` swaps those in.
async function checkYoutube(id, out) {
  const items = await youtubePlaylist(id);
  out.counts.YouTube = items.length;
  const videos = await youtubeVideos(items.map((i) => i.snippet.resourceId.videoId));

  for (const item of items) {
    const { title, videoOwnerChannelTitle: channel, resourceId } = item.snippet;
    const label = `[${youtubeItemName(item)}](https://music.youtube.com/watch?v=${resourceId.videoId})`;
    const v = videos.get(resourceId.videoId);
    if (youtubeGone(v)) {
      out.problems.push(`${label} is gone from YouTube (position ${item.snippet.position + 1})`);
      continue;
    }
    const off = youtubeBlockedIn(v, countries);
    if (!off.length) continue;
    // Say which kind of restriction it is, an allow list that leaves NL out reads differently from a block
    const region = v.contentDetails.regionRestriction;
    const how = region.blocked?.includes(off[0]) ? `blocked in ${region.blocked.length} countries` : `allowed in only ${region.allowed.length}`;
    const swap = channel && (await youtubeAlternative(title, channel.replace(/ - Topic$/, ''), resourceId.videoId, countries));
    const suggestion = swap
      ? `. Version that plays: [${swap.snippet.title}, from ${swap.snippet.channelTitle}](https://music.youtube.com/watch?v=${swap.id})`
      : '';
    out.minor.push(`${label} blocked on YouTube in ${off.join(', ')} (${how}), YouTube Music may or may not play another version${suggestion}`);
  }
}

const checks = { deezer: checkDeezer, spotify: keys.spotify ? checkSpotify : checkSpotifyPage, youtube: checkYoutube };
const names = { deezer: 'Deezer', spotify: 'Spotify', youtube: 'YouTube' };

async function check(slug, data) {
  const out = { problems: [], minor: [], counts: {} };
  if (!data.smartlink) return { ...out, problems: ['no smartlink in front matter'] };

  let found;
  try {
    found = await smartlinkPlatforms(data.smartlink);
  } catch (e) {
    return { ...out, problems: [`${data.smartlink}: ${e.message}`] };
  }
  const missing = Object.keys(platforms).filter((p) => !found[p]);
  if (missing.length) out.problems.push(`smartlink doesn't list ${missing.map((p) => names[p]).join(', ')}`);

  for (const [platform, run] of Object.entries(checks)) {
    if (!found[platform] || (platform === 'youtube' && !keys.youtube)) continue;
    try {
      await run(found[platform], out);
    } catch (e) {
      out.problems.push(e.message);
    }
  }

  // Soundiiz can't always find a match on every platform, so a gap is worth a look, not an alarm
  const counts = Object.entries(out.counts);
  if (new Set(counts.map(([, n]) => n)).size > 1) {
    out.minor.push(`Track counts differ: ${counts.map(([p, n]) => `${p} ${n}`).join(', ')}. Soundiiz may not have found a match, or the playlists drifted apart`);
  }
  return out;
}

const files = fs
  .readdirSync(path.join(root, 'playlists'))
  .filter((f) => f.endsWith('.md'))
  .filter((f) => !slugs.length || slugs.includes(path.basename(f, '.md')));

const checked = [
  'Deezer',
  keys.spotify
    ? 'Spotify'
    : `Spotify (playlist and track count only, ${spotifyKeys.app ? 'no login, run npm run login:spotify' : 'no key'})`,
  keys.youtube ? 'YouTube' : 'YouTube skipped (no key)',
];
console.log(`Checking ${checked.join(', ')}\n`);

const results = [];
for (const file of files) {
  const src = fs.readFileSync(path.join(root, 'playlists', file), 'utf8');
  const data = parseYaml(src.split(/^---$/m)[1]);
  const slug = path.basename(file, '.md');
  if (data.status !== 'published' && !slugs.includes(slug)) continue;
  const result = await check(slug, data);
  results.push({ slug, title: data.title, ...result });
  const mark = result.problems.length ? '✗' : '✓';
  const counts = Object.entries(result.counts).map(([p, n]) => `${p} ${n}`);
  console.log(`${mark} ${data.title}${counts.length ? ` (${counts.join(', ')})` : ''}`);
  for (const p of result.problems) console.log(`    ${p}`);
  for (const p of result.minor) console.log(`    (minor) ${p}`);
}

const broken = results.filter((r) => r.problems.length);
const tidy = results.filter((r) => r.minor.length);
console.log(
  `\n${results.length} playlists checked for ${countries.join(', ')}, ${broken.length} need attention, ${tidy.length} worth a look`,
);

if (opts.report) {
  const lines = [
    `Checked ${results.length} published playlists on ${new Date().toISOString().slice(0, 10)} for ${countries.join(', ')}: ${checked.join(', ')}.`,
    '',
  ];
  for (const r of broken) {
    lines.push(`### ${r.title}`, `\`playlists/${r.slug}.md\``, '');
    for (const p of r.problems) lines.push(`- ${p}`);
    lines.push('');
  }
  if (!broken.length) lines.push('Nothing needs fixing.', '');
  if (searchQuota.used) lines.push("YouTube's search quota ran out during this run, so some blocked videos have no suggested version.", '');
  // `*` bullets so the workflow's "did the list change" check only looks at real problems
  if (tidy.length) {
    lines.push(
      '<details><summary>Worth a look when convenient</summary>',
      '',
      "Tracks Deezer or YouTube call unplayable while the app most likely still plays them or another version, and playlists whose track counts differ between platforms.",
      '',
    );
    for (const r of tidy) {
      lines.push(`**${r.title}**`, '');
      for (const p of r.minor) lines.push(`* ${p}`);
      lines.push('');
    }
    lines.push('</details>');
  }
  fs.writeFileSync(opts.report, lines.join('\n'));
}

process.exitCode = broken.length ? 1 : 0;
