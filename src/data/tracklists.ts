// Soundiiz exports in /tracklists, named after the playlist file.
// Read at build time so the site can search every artist on every tape.

const files = import.meta.glob<string>('../../tracklists/*.csv', {
  query: '?raw',
  import: 'default',
  eager: true,
});

// Small CSV parser: quoted fields, doubled quotes, commas and newlines inside quotes
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  text = text.replace(/^﻿/, '');
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.some((f) => f !== '')) rows.push(row);
      row = [];
    } else field += c;
  }
  row.push(field);
  if (row.some((f) => f !== '')) rows.push(row);
  return rows;
}

/** Unique artists on a tape, in running order. Empty if there's no export yet. */
export function artistsFor(slug: string): string[] {
  const text = files[`../../tracklists/${slug}.csv`];
  if (!text) return [];
  const [header, ...rows] = parseCsv(text);
  const col = header.indexOf('artist');
  if (col < 0) return [];
  const seen = new Map<string, string>();
  for (const r of rows) {
    const name = r[col]?.trim();
    if (name && !seen.has(name.toLowerCase())) seen.set(name.toLowerCase(), name);
  }
  return [...seen.values()];
}

/** Lowercase, strip accents, so "altin gun" finds Altın Gün */
export function fold(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ı/g, 'i')
    .replace(/ø/g, 'o')
    .replace(/æ/g, 'ae')
    .replace(/ß/g, 'ss');
}
