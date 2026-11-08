// Shared by check-links.mjs, stats.mjs and spotify-login.mjs: talking to the Spotify Web API.
//
// Since the February 2026 changes, reading what's in a playlist needs a logged-in user, an app
// token alone gets "401 Valid user authentication required". So there are two levels:
//   app   SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET, client credentials
//   user  the above plus a refresh token from `npm run login:spotify`, kept in
//         .secrets/spotify-token.json locally and in SPOTIFY_REFRESH_TOKEN on GitHub
// Locally the scripts also read .secrets/.env, so the keys don't have to be exported every time.

import fs from 'node:fs';
import path from 'node:path';

const env = process.env;
const root = path.resolve(import.meta.dirname, '../..');
export const spotifyTokenFile = path.join(root, '.secrets', 'spotify-token.json');

function savedRefreshToken() {
  if (env.SPOTIFY_REFRESH_TOKEN) return env.SPOTIFY_REFRESH_TOKEN;
  try {
    return JSON.parse(fs.readFileSync(spotifyTokenFile, 'utf8')).refresh_token;
  } catch {
    return undefined;
  }
}

export const spotifyKeys = {
  app: Boolean(env.SPOTIFY_CLIENT_ID && env.SPOTIFY_CLIENT_SECRET),
  get user() {
    return this.app && Boolean(savedRefreshToken());
  },
};

export async function spotifyTokenRequest(params) {
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${env.SPOTIFY_CLIENT_ID}:${env.SPOTIFY_CLIENT_SECRET}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams(params),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Spotify login failed: ${data.error_description ?? data.error ?? res.status}`);
  return data;
}

// The token lasts an hour, a run takes minutes
let token;
async function accessToken() {
  if (token) return token;
  const refresh = savedRefreshToken();
  if (!refresh) return (token = (await spotifyTokenRequest({ grant_type: 'client_credentials' })).access_token);
  const data = await spotifyTokenRequest({ grant_type: 'refresh_token', refresh_token: refresh });
  // Spotify sometimes hands out a new refresh token. Keep it locally, on GitHub the old one keeps working.
  if (data.refresh_token && data.refresh_token !== refresh && !env.SPOTIFY_REFRESH_TOKEN) {
    fs.writeFileSync(spotifyTokenFile, JSON.stringify({ refresh_token: data.refresh_token }), { mode: 0o600 });
  }
  return (token = data.access_token);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function spotify(url) {
  const res = await fetch(url.startsWith('https:') ? url : `https://api.spotify.com/v1${url}`, {
    headers: { Authorization: `Bearer ${await accessToken()}` },
  });
  if (res.status === 429) {
    await sleep((Number(res.headers.get('retry-after')) || 5) * 1000);
    return spotify(url);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Spotify ${res.status}: ${data.error?.message ?? 'no details'}`);
  return data;
}
