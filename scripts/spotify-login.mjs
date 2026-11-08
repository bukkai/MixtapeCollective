// Logs in to Spotify once, so the link check and stats can read playlists as you.
//
//   npm run login:spotify
//
// One-time setup:
//   1. Spotify Developer Dashboard, your app > Settings > Redirect URIs: add
//      http://127.0.0.1:8888/callback exactly like that (Spotify doesn't accept localhost)
//   2. Put SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET in .secrets/.env, one KEY=value per line
//   3. Run this, log in with the account that owns the playlists. The login lands in
//      .secrets/spotify-token.json, which stays out of git.
//   4. For the weekly checks on GitHub, copy the refresh token into a repository secret:
//      node -p "require('./.secrets/spotify-token.json').refresh_token" | gh secret set SPOTIFY_REFRESH_TOKEN

import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { spotify, spotifyKeys, spotifyTokenFile, spotifyTokenRequest } from './lib/spotify.mjs';

const port = 8888;
const redirect = `http://127.0.0.1:${port}/callback`;

if (!spotifyKeys.app) {
  console.error('No SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET. Put them in .secrets/.env, see the top of scripts/spotify-login.mjs');
  process.exit(1);
}

const state = crypto.randomBytes(16).toString('hex');
const url = new URL('https://accounts.spotify.com/authorize');
url.search = new URLSearchParams({
  client_id: process.env.SPOTIFY_CLIENT_ID,
  response_type: 'code',
  redirect_uri: redirect,
  scope: 'playlist-read-private playlist-read-collaborative',
  state,
});

const server = http.createServer();
await new Promise((resolve, reject) => {
  server.once('error', (e) => reject(e.code === 'EADDRINUSE' ? new Error(`Port ${port} is in use, close whatever runs there`) : e));
  server.listen(port, '127.0.0.1', resolve);
});

console.log(`Log in with the account that owns the playlists:\n${url}\n`);
if (process.platform === 'darwin') spawn('open', [url.toString()], { stdio: 'ignore' });

const code = await new Promise((resolve, reject) => {
  server.on('request', (req, res) => {
    const back = new URL(req.url, redirect);
    if (back.pathname !== '/callback' || back.searchParams.get('state') !== state) return res.writeHead(400).end();
    res.end('Logged in, you can close this tab.');
    const code = back.searchParams.get('code');
    code ? resolve(code) : reject(new Error(`Spotify login: ${back.searchParams.get('error')}`));
  });
});
server.close();

const data = await spotifyTokenRequest({ grant_type: 'authorization_code', code, redirect_uri: redirect });
fs.mkdirSync(path.dirname(spotifyTokenFile), { recursive: true });
fs.writeFileSync(spotifyTokenFile, JSON.stringify({ refresh_token: data.refresh_token }), { mode: 0o600 });

const me = await spotify('/me');
console.log(`Logged in as ${me.display_name ?? me.id}, saved to ${path.relative(process.cwd(), spotifyTokenFile)}`);
console.log('\nFor GitHub:\n  node -p "require(\'./.secrets/spotify-token.json\').refresh_token" | gh secret set SPOTIFY_REFRESH_TOKEN');
