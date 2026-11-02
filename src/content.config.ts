import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';
import { colorKeys } from './data/palette';

// Empty fields in front matter are fine, they're treated as "not there yet"
const url = z.preprocess((v) => v || undefined, z.string().url().optional());

const playlists = defineCollection({
  loader: glob({ pattern: '*.md', base: './playlists' }),
  schema: z.object({
    title: z.string(),
    type: z.enum(['collection', 'era-retrospective']),
    genres: z.string(),
    color: z.enum(colorKeys),
    status: z.enum(['idea', 'curating', 'published', 'retired']),
    artists: z.array(z.string()).default([]),
    // Deezer truncates at 160 characters without warning
    description: z.string().max(160).optional(),
    links: z
      .object({
        smartlink: url,
        deezer: url,
        spotify: url,
        youtube_music: url,
      })
      .default({}),
    cover: z.string().optional(),
    published: z.coerce.date().optional(),
  }),
});

export const collections = { playlists };
