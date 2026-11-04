// Swaps region-blocked videos in a playlist's YouTube version for a version of the same song
// that plays, the same suggestions the link check makes. Shows the plan unless --apply is given.
//
//   npm run fix:youtube -- neo-psych-chill                      show what would change
//   npm run fix:youtube -- neo-psych-chill --apply              change the playlist
//   npm run fix:youtube -- neo-psych-chill --apply --skip 6,9   leave tracks 6 and 9 alone
//   npm run fix:youtube -- neo-psych-chill --country NL,BE      other countries
//
// Changing a playlist needs your permission instead of an API key. One-time setup:
//   1. Google Cloud console, the MixtapeCollective project: APIs & Services > OAuth consent
//      screen, user type External, add yourself as test user, then Publish app. In testing
//      mode Google throws the login away after 7 days.
//   2. Credentials > Create credentials > OAuth client ID > Desktop app, download the JSON
//      and save it as .secrets/youtube-oauth-client.json
//   3. The first run opens a browser to log in with the channel that owns the playlists.
//      The login is kept in .secrets/youtube-token.json. Both files stay out of git.
// Deleted and private videos lose their title, so those still need fixing by hand.

import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { parse as parseYaml } from 'yaml';
import { smartlinkPlatforms, youtube, youtubeAlternative, youtubeBlockedIn, youtubeGone, youtubeItemName, youtubePlaylist, youtubeVideos } from './lib/links.mjs';

const root = path.resolve(import.meta.dirname, '..');
const secrets = path.join(root, '.secrets');
const clientFile = path.join(secrets, 'youtube-oauth-client.json');
const tokenFile = path.join(secrets, 'youtube-token.json');

const { values: opts, positionals: slugs } = parseArgs({
  allowPositionals: true,
  options: {
    apply: { type: 'boolean', default: false },
    skip: { type: 'string', default: '' },
    country: { type: 'string', default: 'NL' },
  },
});

if (!slugs.length) {
  console.error('Name the playlists to fix, for example: npm run fix:youtube -- neo-psych-chill');
  process.exit(1);
}
if (!fs.existsSync(clientFile)) {
  console.error(`No OAuth client yet. See the setup at the top of scripts/fix-youtube.mjs, it goes in ${path.relative(root, clientFile)}`);
  process.exit(1);
}

const countries = opts.country.split(',').map((c) => c.trim().toUpperCase());
const skip = new Set(opts.skip.split(',').filter(Boolean).map(Number));
const client = JSON.parse(fs.readFileSync(clientFile, 'utf8')).installed;

async function tokenRequest(params) {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: client.client_id, client_secret: client.client_secret, ...params }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Google login: ${data.error_description ?? data.error ?? res.status}`);
  return data;
}

// Loopback login: Google sends the browser back to a port on this machine with a one-time code
async function login() {
  const server = http.createServer();
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const redirect = `http://127.0.0.1:${server.address().port}`;
  const verifier = crypto.randomBytes(32).toString('base64url');
  const state = crypto.randomBytes(16).toString('hex');
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.search = new URLSearchParams({
    client_id: client.client_id,
    redirect_uri: redirect,
    response_type: 'code',
    scope: 'https://www.googleapis.com/auth/youtube',
    access_type: 'offline',
    prompt: 'consent',
    state,
    code_challenge: crypto.createHash('sha256').update(verifier).digest('base64url'),
    code_challenge_method: 'S256',
  });
  console.log(`Log in with the channel that owns the playlists:\n${url}\n`);
  if (process.platform === 'darwin') spawn('open', [url.toString()], { stdio: 'ignore' });

  const code = await new Promise((resolve, reject) => {
    server.on('request', (req, res) => {
      const back = new URL(req.url, redirect);
      if (back.searchParams.get('state') !== state) return res.writeHead(400).end();
      res.end('Logged in, you can close this tab.');
      const code = back.searchParams.get('code');
      code ? resolve(code) : reject(new Error(`Google login: ${back.searchParams.get('error')}`));
    });
  });
  server.close();

  const data = await tokenRequest({ code, redirect_uri: redirect, grant_type: 'authorization_code', code_verifier: verifier });
  fs.mkdirSync(secrets, { recursive: true });
  fs.writeFileSync(tokenFile, JSON.stringify({ refresh_token: data.refresh_token }), { mode: 0o600 });
  return data.access_token;
}

async function accessToken() {
  if (!fs.existsSync(tokenFile)) return login();
  try {
    const { refresh_token } = JSON.parse(fs.readFileSync(tokenFile, 'utf8'));
    return (await tokenRequest({ refresh_token, grant_type: 'refresh_token' })).access_token;
  } catch {
    // Revoked or expired, start over
    fs.rmSync(tokenFile);
    return login();
  }
}

const auth = { token: await accessToken() };

for (const slug of slugs) {
  const file = path.join(root, 'playlists', `${slug}.md`);
  if (!fs.existsSync(file)) {
    console.error(`${slug}: no playlists/${slug}.md`);
    continue;
  }
  const data = parseYaml(fs.readFileSync(file, 'utf8').split(/^---$/m)[1]);
  const id = data.smartlink && (await smartlinkPlatforms(data.smartlink)).youtube;
  if (!id) {
    console.error(`${data.title}: no YouTube playlist on the smartlink`);
    continue;
  }

  const items = await youtubePlaylist(id, auth);
  const videos = await youtubeVideos(items.map((i) => i.snippet.resourceId.videoId), auth);
  const inPlaylist = new Set(videos.keys());
  console.log(`\n${data.title}`);

  const swaps = [];
  for (const item of items) {
    const { title, videoOwnerChannelTitle: channel, resourceId, position } = item.snippet;
    const v = videos.get(resourceId.videoId);
    const line = `  ${String(position + 1).padStart(2)}. ${youtubeItemName(item)}`;
    if (youtubeGone(v)) {
      console.log(`${line}: gone, fix by hand`);
      continue;
    }
    if (!youtubeBlockedIn(v, countries).length) continue;
    const alt = await youtubeAlternative(title, channel.replace(/ - Topic$/, ''), resourceId.videoId, countries, auth);
    if (!alt) {
      console.log(`${line}: no version that plays in ${countries.join(', ')} found, fix by hand`);
      continue;
    }
    if (inPlaylist.has(alt.id)) {
      console.log(`${line}: the version that plays is already in the playlist, remove this one by hand`);
      continue;
    }
    const skipped = skip.has(position + 1) ? ' (skipped)' : '';
    console.log(`${line}\n      -> "${alt.snippet.title}" from ${alt.snippet.channelTitle}  https://music.youtube.com/watch?v=${alt.id}${skipped}`);
    if (!skipped) swaps.push({ item, alt });
  }

  if (!swaps.length) {
    console.log('  Nothing to swap.');
    continue;
  }
  if (!opts.apply) {
    console.log(`  ${swaps.length} to swap. Run again with --apply to make the changes, --skip <numbers> to leave some alone.`);
    continue;
  }
  // Insert the new video at the old one's position, then remove the old one, so the order
  // stays the same and positions further down don't move
  for (const { item, alt } of swaps) {
    const { position } = item.snippet;
    try {
      await youtube('playlistItems', { part: 'snippet' }, {
        ...auth,
        method: 'POST',
        body: { snippet: { playlistId: id, position, resourceId: { kind: 'youtube#video', videoId: alt.id } } },
      });
      await youtube('playlistItems', { id: item.id }, { ...auth, method: 'DELETE' });
      console.log(`  ✓ ${position + 1}. swapped`);
    } catch (e) {
      console.error(`  ✗ ${position + 1}. ${e.message}. Stopped here, the rest is untouched.`);
      break;
    }
  }
}
