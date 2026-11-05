# Color palette

Every playlist cover uses one color from the Deezer cover editor. Hue is the family, shade is the intensity: a new genre gets a shade of its family's hue (dark blue, medium blue, light blue) before it gets a hue of its own. Each color should mean one thing.

The website uses approximate hex values from `src/data/palette.ts`. A playlist's `color` field must be one of the keys in that file, otherwise the build fails. Adding a color here means adding it there too.

## In use

| Family | Color | Key | Used for |
|---|---|---|---|
| Indie and alt guitar | Dark blue | `dark-blue` | grunge, alt rock, noise rock, college rock |
| | Medium blue | `medium-blue` | post-rock |
| | Light blue | `light-blue` | emotive math rock, shoegaze, jazzy instrumental math |
| Complex and prog | Deep indigo | `deep-indigo` | prog metal, abrasive math rock, zeuhl, art rock |
| Heavy | Dark maroon | `dark-maroon` | metal, nu-metal, drone and doom |
| | Dark red | `dark-red` | protest music, crossover anger |
| Punk | Yellow-green | `yellow-green` | punk, hardcore punk, riot grrrl, garage punk |
| Electronic crossover | Bright yellow | `bright-yellow` | rave rock, big beat, dance-punk |
| Warm psych | Bright orange | `bright-orange` | desert psych, stoner, microtonal psych, krautrock |
| Hazy psych | Pale lavender | `pale-lavender` | neo-psych, psych pop, dream pop |
| Psychedelic electronic | Hot pink | `hot-pink` | psybient, psy-dub |
| Downtempo | Dark purple | `dark-purple` | trip-hop |
| Dark and ritual | Dark teal | `dark-teal` | dark ambient, industrial, EBM |
| | Medium teal | `medium-teal` | ritual electronics, post-industrial |
| Goth | Black | `black` | post-punk, gothic rock |

## Full Deezer set

37 colors, listed row by row as they appear in the Deezer cover editor (February 2026). Hex values sampled from the editor (November 2026); the cover script uses them for the border via `deezer` in `palette.ts`.

```
#7d3a81 #ab50b2 #de68e7 #fbc6ff #fddeff
#531e83 #7628ba #a237ff #d9affe #e9ccff
#1f2c99 #2d3ed9 #5262fc #b4bbfe #d0d5fe
#135e6e #32808f #7bcec9 #96f9f3 #defdfb
#5d5621 #a39a3a #fcff5f #fdffb8 #ffffeb
#8f3a22 #c54f2f #ff673d #ffcbbd #ffe2d9
#711b1b #a02626 #da3434 #ffa9a8 #ffcaca
#000000 #ffffff
```

1. **Pinks / purples:** dark purple, medium purple, hot pink, light pink, very light pink (outline only)
2. **Purples:** deep indigo, medium indigo, mid purple, soft lavender, pale lavender
3. **Blues:** dark navy blue, royal blue, medium blue, light periwinkle, pale periwinkle
4. **Teals:** dark teal, medium teal, mint / turquoise, bright cyan, very pale mint
5. **Greens / yellows:** dark olive, yellow-green, bright yellow, pale yellow, near-white yellow
6. **Oranges:** burnt sienna / brown, terracotta / orange-red, bright orange, light peach, very pale peach
7. **Reds:** dark maroon, dark red / crimson, bright red, salmon pink, light pink
8. **Neutrals:** black, white
