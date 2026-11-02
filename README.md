# Mixtape Collective

Playlists made like mixtapes. This repo is the source of truth for every playlist, published or not, and builds the public tape shelf.

## Layout

```
playlists/          one Markdown file per playlist (front matter = data, body = notes)
src/data/palette.ts the color set, matched to the Deezer cover editor
src/                the Astro site
covers/             cover art (add as they're made)
tracklists/         Soundiiz exports, so reorderings show up in the history
```

## Adding or updating a playlist

Copy any file in `playlists/`, rename it to a slug of the title and fill it in:

```yaml
---
title: "Microtonal Madness"
type: collection            # collection | era-retrospective
genres: "Microtonal / psychedelic rock"
color: bright-orange        # a key from src/data/palette.ts
status: published           # idea | curating | published | retired
artists:
  - "King Gizzard"
description: ""             # max 160 characters, Deezer cuts off the rest
links:
  smartlink: https://sdz.sh/...
  deezer:
  spotify:
  youtube_music:
---

Anything below the front matter is free notes: sequencing rules, tracks
that got cut and why, ideas for a sibling playlist.
```

Only `published` playlists show up on the site. Empty fields are fine.

The build validates every file: an unknown color, a typo in `status` or a description over 160 characters fails the build, so mistakes don't go live.

## Running it

```
npm install
npm run dev     # http://localhost:4321
npm run build
```

Pushing to `main` deploys to GitHub Pages via `.github/workflows/deploy.yml`. In the repo settings, set Pages > Source to "GitHub Actions" once.
