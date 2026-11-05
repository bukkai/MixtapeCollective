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
    // Set by hand when publishing to YouTube: own name first, search terms after the pipe.
    // YouTube allows 150 characters, mobile search shows roughly the first 50 to 60.
    youtubeTitle: z.string().max(150).optional(),
    genres: z.string(),
    color: z.enum(colorKeys),
    status: z.enum(['idea', 'curating', 'published', 'retired']),
    artists: z.array(z.string()).default([]),
    // Deezer truncates at 160 characters without warning
    description: z.string().max(160).optional(),
    // Soundiiz smartlink, already covers every platform
    smartlink: url,
    cover: z.string().optional(),
    // Cover generator (npm run covers): blank from covers/blanks/blanks.json, text for the label
    tape: z.string().optional(),
    label: z.string().optional(),
    font: z.enum(['marker', 'salt', 'brush', 'typewriter']).optional(),
    published: z.coerce.date().optional(),
  }),
});

export const collections = { playlists };
