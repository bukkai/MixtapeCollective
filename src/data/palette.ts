// The Mixtape Collective color set. Names match the Deezer cover editor.
// `hex` is the website color. `deezer` is the exact swatch from the Deezer cover editor,
// used for the cover border (scripts/covers.mjs).
// Hue is the family, shade is the intensity: a new genre gets a shade of its family's hue
// before it gets a hue of its own.

export const palette = {
  'dark-blue': {
    name: 'Dark blue',
    hex: '#22356b',
    deezer: '#1f2c99',
    ink: 'light',
    use: 'grunge, alt rock, noise rock, college rock',
  },
  'medium-blue': {
    name: 'Medium blue',
    hex: '#4a5fc4',
    deezer: '#5262fc',
    ink: 'light',
    use: 'post-rock',
  },
  'light-blue': {
    name: 'Light blue',
    hex: '#8eb4e6',
    deezer: '#b4bbfe',
    ink: 'dark',
    use: 'emotive math rock, shoegaze, jazzy instrumental math',
  },
  'deep-indigo': {
    name: 'Deep indigo',
    hex: '#2e2a6e',
    deezer: '#531e83',
    ink: 'light',
    use: 'prog metal, abrasive math rock, zeuhl, art rock',
  },
  'dark-purple': {
    name: 'Dark purple',
    hex: '#4a1f5c',
    deezer: '#7d3a81',
    ink: 'light',
    use: 'trip-hop',
  },
  'dark-maroon': {
    name: 'Dark maroon',
    hex: '#5c1a1f',
    deezer: '#711b1b',
    ink: 'light',
    use: 'metal, nu-metal, drone and doom',
  },
  'dark-red': {
    name: 'Dark red',
    hex: '#a3262a',
    deezer: '#a02626',
    ink: 'light',
    use: 'protest music, crossover anger',
  },
  'dark-teal': {
    name: 'Dark teal',
    hex: '#164e4f',
    deezer: '#135e6e',
    ink: 'light',
    use: 'dark ambient, industrial, EBM',
  },
  'medium-teal': {
    name: 'Medium teal',
    hex: '#2b8a86',
    deezer: '#32808f',
    ink: 'light',
    use: 'ritual electronics, post-industrial',
  },
  'yellow-green': {
    name: 'Yellow-green',
    hex: '#a8c23a',
    deezer: '#a39a3a',
    ink: 'dark',
    use: 'punk, hardcore punk, riot grrrl, garage punk',
  },
  'bright-yellow': {
    name: 'Bright yellow',
    hex: '#f2e14c',
    deezer: '#fcff5f',
    ink: 'dark',
    use: 'rave rock, big beat, dance-punk',
  },
  'bright-orange': {
    name: 'Bright orange',
    hex: '#f08a24',
    deezer: '#ff673d',
    ink: 'dark',
    use: 'desert psych, stoner, microtonal psych, krautrock',
  },
  'hot-pink': {
    name: 'Hot pink',
    hex: '#e83e8c',
    deezer: '#de68e7',
    ink: 'dark',
    use: 'psybient, psy-dub',
  },
  'pale-lavender': {
    name: 'Pale lavender',
    hex: '#d9cdf0',
    deezer: '#e9ccff',
    ink: 'dark',
    use: 'neo-psych, psych pop, dream pop',
  },
  black: {
    name: 'Black',
    hex: '#1c1b1a',
    deezer: '#000000',
    ink: 'light',
    use: 'post-punk, gothic rock',
  },
} as const;

export type ColorKey = keyof typeof palette;
export const colorKeys = Object.keys(palette) as [ColorKey, ...ColorKey[]];
