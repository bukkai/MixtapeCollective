// Shared by check-links.mjs and fix-youtube.mjs: finding each platform's playlist from a
// smartlink, and talking to YouTube.

export const platforms = {
  deezer: /https:\/\/www\.deezer\.com\/(?:[a-z]{2}\/)?playlist\/(\d+)/,
  spotify: /https:\/\/open\.spotify\.com\/playlist\/([A-Za-z0-9]+)/,
  youtube: /https:\/\/music\.youtube\.com\/playlist\?list=([\w-]+)/,
};

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const chunks = (list, size) =>
  Array.from({ length: Math.ceil(list.length / size) }, (_, i) => list.slice(i * size, (i + 1) * size));
export const plain = (text) =>
  text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

export async function smartlinkPlatforms(smartlink) {
  const res = await fetch(smartlink, { headers: { 'User-Agent': 'Mozilla/5.0 (mixtape-collective link check)' } });
  if (!res.ok) throw new Error(`smartlink returned ${res.status}`);
  const html = await res.text();
  const found = {};
  for (const [name, re] of Object.entries(platforms)) {
    const m = html.match(re);
    if (m) found[name] = m[1];
  }
  return found;
}

// Reads go with the API key. Writes need an OAuth token for the channel that owns the playlist,
// passed as `token`, and then the key isn't needed.
export async function youtube(endpoint, params, { method = 'GET', body, token } = {}) {
  const url = new URL(`https://www.googleapis.com/youtube/v3/${endpoint}`);
  for (const [k, v] of Object.entries({ ...params, key: token ? undefined : process.env.YOUTUBE_API_KEY })) {
    if (v) url.searchParams.set(k, v);
  }
  const res = await fetch(url, {
    method,
    headers: { ...(token && { Authorization: `Bearer ${token}` }), ...(body && { 'Content-Type': 'application/json' }) },
    body: body && JSON.stringify(body),
  });
  if (res.status === 204) return {};
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`YouTube ${res.status}: ${data.error?.message ?? 'no details'}`);
  return data;
}

export async function youtubePlaylist(id, auth) {
  const items = [];
  let pageToken;
  do {
    const page = await youtube('playlistItems', { part: 'snippet,status', playlistId: id, maxResults: 50, pageToken }, auth);
    items.push(...page.items);
    pageToken = page.nextPageToken;
  } while (pageToken);
  return items;
}

export async function youtubeVideos(ids, auth) {
  const videos = new Map();
  for (const batch of chunks(ids, 50)) {
    const page = await youtube('videos', { part: 'status,contentDetails,snippet', id: batch.join(','), maxResults: 50 }, auth);
    for (const v of page.items) videos.set(v.id, v);
  }
  return videos;
}

export const youtubeGone = (v) =>
  !v || v.status.privacyStatus === 'private' || !['processed', 'uploaded'].includes(v.status.uploadStatus);

// Countries from the list where the video's region restriction keeps it from playing
export const youtubeBlockedIn = (v, countries) => {
  const region = v.contentDetails?.regionRestriction ?? {};
  return countries.filter((c) => region.blocked?.includes(c) || (region.allowed && !region.allowed.includes(c)));
};

// A search costs 100 of the 10,000 units a day. 45 per run covers every blocked track today and
// still leaves room for a second run the same day.
let searchesLeft = 45;

// YouTube Music doesn't always swap in another version of a region-blocked song (King Gizzard
// in NL, Nov 2026), so look for the same song by the same artist that does play.
export async function youtubeAlternative(title, artist, skip, countries, auth) {
  if (searchesLeft-- <= 0) return;
  // A suggestion is a bonus, so running out of quota halfway shouldn't fail the playlist
  const found = await youtube(
    'search',
    { part: 'snippet', q: `${artist} ${title}`, type: 'video', regionCode: countries[0], maxResults: 10 },
    auth,
  ).catch(() => null);
  if (!found) return;
  const candidates = found.items.filter(
    (c) =>
      c.id.videoId !== skip &&
      plain(c.snippet.title).includes(plain(title)) &&
      plain(`${c.snippet.channelTitle} ${c.snippet.title}`).includes(plain(artist)),
  );
  if (!candidates.length) return;
  const videos = await youtubeVideos(candidates.map((c) => c.id.videoId), auth).catch(() => new Map());
  // The artist's own channel beats a stranger's re-upload, the exact title beats a live or remix
  // version, and a Topic channel is the tiebreaker
  const score = (v) =>
    2 * plain(v.snippet.channelTitle).includes(plain(artist)) +
    2 * (plain(v.snippet.title).replace(plain(artist), '').trim() === plain(title)) +
    v.snippet.channelTitle.endsWith(' - Topic');
  return [...videos.values()]
    .filter((v) => !youtubeGone(v) && !youtubeBlockedIn(v, countries).length)
    .sort((a, b) => score(b) - score(a))[0];
}

// What a playlist item is called in reports. A deleted video loses its title and channel,
// so only its position is left to go on.
export function youtubeItemName(item) {
  const { title, videoOwnerChannelTitle: channel, position } = item.snippet;
  return channel ? `"${title}" by ${channel.replace(/ - Topic$/, '')}` : `Track ${position + 1} ("${title}")`;
}
