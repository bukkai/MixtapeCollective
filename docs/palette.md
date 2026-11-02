# Color palette

Every playlist cover uses one color from the Deezer cover editor. The set is kept tight on purpose: reuse an existing color before introducing a new one.

The website uses approximate hex values from `src/data/palette.ts`. A playlist's `color` field must be one of the keys in that file, otherwise the build fails. Adding a color here means adding it there too.

## In use

| Color | Key | Used for |
|---|---|---|
| Dark blue | `dark-blue` | grunge, alt rock, noise rock, college rock, post-rock, drone |
| Light blue | `light-blue` | emotive math rock, shoegaze, jazzy instrumental math |
| Deep indigo | `deep-indigo` | prog metal, abrasive math rock, zeuhl, art rock |
| Dark purple | `dark-purple` | trip-hop |
| Dark maroon | `dark-maroon` | metal, hardcore, heavy stuff, proto-punk |
| Dark teal | `dark-teal` | dark ambient, post-industrial, ritual electronics, post-punk, industrial |
| Yellow-green | `yellow-green` | punk, Dutch punk |
| Bright orange | `bright-orange` | desert psych, stoner, microtonal psych, krautrock |
| Hot pink | `hot-pink` | psybient, electronic, dance-punk, Dutch rap |
| Pale lavender | `pale-lavender` | neo-psych, psych pop, dream pop |

## Reserved

| Color | Key | Reserved for |
|---|---|---|
| Medium teal | `medium-teal` | Occult Office Musick, do not reuse |

## Full Deezer set

37 colors, listed row by row as they appear in the Deezer cover editor (February 2026).

1. **Pinks / purples:** dark purple, medium purple, hot pink, light pink, very light pink (outline only)
2. **Purples:** deep indigo, medium indigo, mid purple, soft lavender, pale lavender
3. **Blues:** dark navy blue, royal blue, medium blue, light periwinkle, pale periwinkle
4. **Teals:** dark teal, medium teal, mint / turquoise, bright cyan, very pale mint
5. **Greens / yellows:** dark olive, yellow-green, bright yellow, pale yellow, near-white yellow
6. **Oranges:** burnt sienna / brown, terracotta / orange-red, bright orange, light peach, very pale peach
7. **Reds:** dark maroon, dark red / crimson, bright red, salmon pink, light pink
8. **Neutrals:** black, white
