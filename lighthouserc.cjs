/** Lighthouse CI: production build, mobile profile (LH default), 3 runs, median asserted. */
const { readFileSync } = process.getBuiltinModule('node:fs');
const firstPack = JSON.parse(readFileSync(`${__dirname}/src/data/library.json`, 'utf8')).packs[0]
  ?.slug;
const median = (minScore) => ['error', { minScore, aggregationMethod: 'median-run' }];
const core = {
  'categories:performance': median(0.9),
  'categories:accessibility': median(0.9),
  'categories:best-practices': median(0.9),
  'cumulative-layout-shift': ['error', { maxNumericValue: 0.1, aggregationMethod: 'median-run' }],
};
// The 3D home is a different budget: a live WebGL scene on a throttled phone. The approved
// redesign targets 70 performance / 95 accessibility there, while content pages keep the old bar.
const home = {
  'categories:performance': median(0.7),
  'categories:accessibility': median(0.95),
  'categories:best-practices': median(0.9),
  'cumulative-layout-shift': ['error', { maxNumericValue: 0.1, aggregationMethod: 'median-run' }],
};

module.exports = {
  ci: {
    collect: {
      startServerCommand: 'npx astro preview --port 4393',
      startServerReadyPattern: 'localhost:4393',
      url: [
        'http://localhost:4393/',
        'http://localhost:4393/projects',
        // The real 404 response can't be audited (LH refuses non-2xx documents), so the page is
        // audited at /404. It is noindex on purpose, so SEO is reported but not gated there.
        'http://localhost:4393/404',
        'http://localhost:4393/about',
        'http://localhost:4393/library',
        ...(firstPack ? [`http://localhost:4393/library/${firstPack}`] : []),
      ],
      numberOfRuns: 3,
    },
    assert: {
      assertMatrix: [
        {
          matchingUrlPattern: 'localhost:4393/$',
          assertions: { ...home, 'categories:seo': median(0.9) },
        },
        {
          matchingUrlPattern: 'localhost:4393/(projects|about|library(/[a-z0-9-]+)?)$',
          assertions: { ...core, 'categories:seo': median(0.9) },
        },
        { matchingUrlPattern: 'localhost:4393/404$', assertions: core },
      ],
    },
    upload: { target: 'filesystem', outputDir: '.lighthouseci/reports' },
  },
};
