// @ts-check
import { defineConfig, fontProviders } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';

/**
 * Dev-only routes (/_studies, /_gallery). They are injected only when running
 * `astro dev` (or when DEV_ROUTES=1 for screenshot runs against a preview build),
 * so they never ship in the production build.
 * @returns {import('astro').AstroIntegration}
 */
function devRoutes() {
  return {
    name: 'rdw-dev-routes',
    hooks: {
      'astro:config:setup': ({ command, injectRoute }) => {
        if (command !== 'dev' && process.env.DEV_ROUTES !== '1') return;
        injectRoute({ pattern: '/_studies', entrypoint: './src/dev/studies.astro' });
        injectRoute({ pattern: '/_gallery', entrypoint: './src/dev/gallery.astro' });
      },
    },
  };
}

export default defineConfig({
  site: 'https://rdwlabz.com',
  trailingSlash: 'ignore',
  devToolbar: { enabled: false },
  integrations: [
    devRoutes(),
    sitemap({ filter: (page) => !page.includes('/_') && !page.includes('/404') }),
  ],
  vite: {
    plugins: [tailwindcss()],
  },
  fonts: [
    // Study A — Workbench
    {
      provider: fontProviders.google(),
      name: 'Bricolage Grotesque',
      cssVariable: '--font-a-display',
      weights: ['400 800'],
      styles: ['normal'],
    },
    {
      provider: fontProviders.google(),
      name: 'Figtree',
      cssVariable: '--font-a-body',
      weights: ['400 700'],
      styles: ['normal'],
    },
    // Study B — Arcade cartridge
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
    // Study C — Blueprint
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
  ],
});
