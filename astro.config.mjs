// @ts-check
import { defineConfig } from 'astro/config';
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
  integrations: [
    devRoutes(),
    sitemap({ filter: (page) => !page.includes('/_') && !page.includes('/404') }),
  ],
  vite: {
    plugins: [tailwindcss()],
  },
});
