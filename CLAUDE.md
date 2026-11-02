# Working on Mixtape Collective

This repo is the source of truth for Mixtape Collective. Read `docs/brief.md` for the philosophy and `docs/palette.md` for colors. The files in `playlists/` win over anything remembered from earlier conversations: always read the file before stating a playlist's status, artists or links.

## Data

- One Markdown file per playlist in `playlists/`, slug of the title as filename. Schema in `src/content.config.ts`.
- `status`: `idea` | `curating` | `published` | `retired`. Only `published` shows on the site.
- `color` must be a key from `src/data/palette.ts`. Don't introduce new colors without asking.
- `description` max 160 characters. Deezer truncates without warning, the build enforces it.
- Free notes (sequencing decisions, cut tracks, sibling ideas) go in the body below the front matter.
- Run `npm run build` after changes. A failing build usually means a schema error in a playlist file.

## Writing

- Casual, human, slightly opinionated. Sounds like a friend handing you a tape.
- No em dashes. No marketing fluff. No academic language.
- Social posts short, no hashtags unless they earn their place.

## Curation rules

- Full-listen sequencing. Arc: entry, establishment, deep middle, build, peak, landing.
- Max 2 to 3 tracks per artist, never the same artist back to back.
- Route artists to the playlist where they fit instead of forcing them into the wrong one. Texture and vibe over loose genre labels.
- Rhythm check for groove and ambient lists: is the rhythm the point, or just texture? If the kick drum pushes you forward, it probably doesn't belong.
- Microtonal claims are verified against Xenharmonic Wiki, interviews or album notes. Self-description alone isn't enough.
- Long-form ambient and experimental releases: watch for album titles mistaken for track titles.
- Tracks Stephan names himself are assumed available on Deezer.
- Flag uncertainty about obscure artists instead of padding with guesses.

## Commits

Small, descriptive commits. Pushing to `main` deploys the site.
