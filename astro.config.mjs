// @ts-check
import { defineConfig, fontProviders } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';

// `check` is included so the dev-only pages still type-check against their font variables.
const devRoutesOn =
  process.argv.includes('dev') || process.argv.includes('check') || process.env.DEV_ROUTES === '1';

/**
 * Dev-only routes (/_studies, /_gallery). They are injected only when running
 * `astro dev` (or when DEV_ROUTES=1), so they never ship in the production build.
 * @returns {import('astro').AstroIntegration}
 */
function devRoutes() {
  return {
    name: 'rdw-dev-routes',
    hooks: {
      'astro:config:setup': ({ injectRoute }) => {
        if (!devRoutesOn) return;
        injectRoute({ pattern: '/_studies', entrypoint: './src/dev/studies.astro' });
        injectRoute({ pattern: '/_gallery', entrypoint: './src/dev/gallery.astro' });
      },
    },
  };
}

/** Rejected art-direction studies (B, C) — dev only, never in production. */
/** @type {NonNullable<import('astro').AstroUserConfig['fonts']>} */
const studyFonts = [
  // Round 1 heading font, kept for side-by-side comparison only
  {
    provider: fontProviders.google(),
    name: 'Bricolage Grotesque',
    cssVariable: '--font-bricolage',
    weights: ['400 800'],
    styles: ['normal'],
  },
  {
    provider: fontProviders.google(),
    name: 'Pixelify Sans',
    cssVariable: '--font-b-display',
    weights: ['400 700'],
    styles: ['normal'],
  },
  {
    provider: fontProviders.google(),
    name: 'Space Grotesk',
    cssVariable: '--font-b-body',
    weights: ['400 700'],
    styles: ['normal'],
  },
  {
    provider: fontProviders.google(),
    name: 'Unbounded',
    cssVariable: '--font-c-display',
    weights: ['400 900'],
    styles: ['normal'],
  },
  // Round 2 heading-font candidates (type study on /_studies)
  {
    provider: fontProviders.google(),
    name: 'Lilita One',
    cssVariable: '--font-t1',
    weights: ['400'],
    styles: ['normal'],
    subsets: ['latin'],
  },
  {
    provider: fontProviders.google(),
    name: 'Fredoka',
    cssVariable: '--font-t3',
    weights: ['600 700'],
    styles: ['normal'],
    subsets: ['latin'],
  },
  {
    provider: fontProviders.google(),
    name: 'IBM Plex Mono',
    cssVariable: '--font-c-body',
    weights: ['400', '600'],
    styles: ['normal'],
    fallbacks: ['monospace'],
  },
];

export default defineConfig({
  site: 'https://rdwlabz.com',
  // `/projects` (no slash) everywhere: emits projects.html, which Cloudflare Pages serves at /projects.
  trailingSlash: 'never',
  build: { format: 'file' },
  devToolbar: { enabled: false },
  // Opt-in only: the library portal prefetches /library while its intro plays.
  prefetch: true,
  integrations: [
    devRoutes(),
    sitemap({ filter: (page) => !page.includes('/_') && !page.includes('/404') }),
  ],
  vite: {
    plugins: [tailwindcss()],
    // RDWLABZ_DATA / RDWLABZ_LIBRARY=<abs path> build from another projects.json / library.json
    // (tests build an empty shelf or fixture packs this way without touching the real files).
    resolve: {
      alias: [
        ...(process.env.RDWLABZ_DATA
          ? [{ find: /^\.\.\/data\/projects\.json$/, replacement: process.env.RDWLABZ_DATA }]
          : []),
        ...(process.env.RDWLABZ_LIBRARY
          ? [{ find: /^\.\.\/data\/library\.json$/, replacement: process.env.RDWLABZ_LIBRARY }]
          : []),
      ],
    },
  },
  // Site fonts are inline so each provider's options are type-checked.
  fonts: [
    // Headings + wordmark only. Single weight: weight synthesis is disabled in global.css.
    // Self-hosted Latin subset (Google serves this family only as ~90 Korean slices); see docs/ASSETS.md.
    {
      provider: fontProviders.local(),
      name: 'Bagel Fat One',
      cssVariable: '--font-bagel',
      fallbacks: ['ui-rounded', 'system-ui', 'sans-serif'],
      options: {
        variants: [
          { src: ['./src/assets/fonts/BagelFatOne-Latin.woff2'], weight: 400, style: 'normal' },
        ],
      },
    },
    {
      provider: fontProviders.google(),
      name: 'Figtree',
      cssVariable: '--font-figtree',
      weights: ['400 700'],
      styles: ['normal'],
    },
    ...(devRoutesOn ? studyFonts : []),
  ],
});
