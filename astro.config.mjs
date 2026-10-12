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

/** @type {NonNullable<import('astro').AstroUserConfig['fonts']>} */
const siteFonts = [
  {
    provider: fontProviders.google(),
    name: 'Bricolage Grotesque',
    cssVariable: '--font-bricolage',
    weights: ['400 800'],
    styles: ['normal'],
  },
  {
    provider: fontProviders.google(),
    name: 'Figtree',
    cssVariable: '--font-figtree',
    weights: ['400 700'],
    styles: ['normal'],
  },
];

/** Rejected art-direction studies (B, C) — dev only, never in production. */
/** @type {NonNullable<import('astro').AstroUserConfig['fonts']>} */
const studyFonts = [
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
  integrations: [
    devRoutes(),
    sitemap({ filter: (page) => !page.includes('/_') && !page.includes('/404') }),
  ],
  vite: {
    plugins: [tailwindcss()],
  },
  fonts: devRoutesOn ? [...siteFonts, ...studyFonts] : siteFonts,
});
