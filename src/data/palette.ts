// The Mixtape Collective color set. Names match the Deezer cover editor.
// Hex values are close approximations for the website, not Deezer's exact values.
// Keep this tight: reuse an existing color before adding a new one.

export const palette = {
  'dark-blue': {
    name: 'Dark blue',
    hex: '#22356b',
    ink: 'light',
    use: 'grunge, alt rock, noise rock, post-rock, drone',
  },
  'light-blue': {
    name: 'Light blue',
    hex: '#8eb4e6',
    ink: 'dark',
    use: 'emotive math rock, shoegaze, jazzy instrumental math',
  },
  'deep-indigo': {
    name: 'Deep indigo',
    hex: '#2e2a6e',
    ink: 'light',
    use: 'prog metal, abrasive math rock, zeuhl, art rock',
  },
  'dark-purple': {
    name: 'Dark purple',
    hex: '#4a1f5c',
    ink: 'light',
    use: 'trip-hop',
  },
  'dark-maroon': {
    name: 'Dark maroon',
    hex: '#5c1a1f',
    ink: 'light',
    use: 'metal, hardcore, heavy stuff, proto-punk',
  },
  'dark-teal': {
    name: 'Dark teal',
    hex: '#164e4f',
    ink: 'light',
    use: 'dark ambient, ritual electronics, post-punk, industrial',
  },
  'medium-teal': {
    name: 'Medium teal',
    hex: '#2b8a86',
    ink: 'light',
    use: 'reserved for Occult Office Musick',
  },
  'yellow-green': {
    name: 'Yellow-green',
    hex: '#a8c23a',
    ink: 'dark',
    use: 'punk',
  },
  'bright-orange': {
    name: 'Bright orange',
    hex: '#f08a24',
    ink: 'dark',
    use: 'desert psych, stoner, microtonal psych, krautrock',
  },
  'hot-pink': {
    name: 'Hot pink',
    hex: '#e83e8c',
    ink: 'dark',
    use: 'psybient, electronic, dance-punk',
  },
  'pale-lavender': {
    name: 'Pale lavender',
    hex: '#d9cdf0',
    ink: 'dark',
    use: 'neo-psych, psych pop, dream pop',
  },
} as const;

export type ColorKey = keyof typeof palette;
export const colorKeys = Object.keys(palette) as [ColorKey, ...ColorKey[]];
