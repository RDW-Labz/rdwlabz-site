// Validation shared by the library sync and the site. Slugs and asset ids become file names
// and URLs, so they are checked strictly before use. Pure functions (tests/library.spec.ts).

export const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
export const ASSET_ID = /^[a-z0-9_]{1,64}$/;
export const isTodo = (v) => typeof v !== 'string' || !v.trim() || /^TODO/i.test(v.trim());
