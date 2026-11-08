import { defineConfig } from 'astro/config';

// SITE and BASE_PATH are set by the GitHub Pages workflow.
// With a custom domain BASE_PATH is empty and everything lives at the root.
export default defineConfig({
  // Pages reports http:// until "Enforce HTTPS" is on; canonical and og URLs should always be https.
  site: process.env.SITE?.replace(/^http:\/\//, 'https://') || undefined,
  base: process.env.BASE_PATH || '/',
});
