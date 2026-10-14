// Validation shared by the library sync and the site. Slugs and asset ids become file names
// and URLs, so they are checked strictly before use. Pure functions (tests/library.spec.ts).

export const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
export const ASSET_ID = /^[a-z0-9_]{1,64}$/;
export const isTodo = (v) => typeof v !== 'string' || !v.trim() || /^TODO/i.test(v.trim());

/** Optional pack copy from manifests/<batch>.json: max characters per field, max highlights. */
export const COPY_LIMITS = { tagline: 120, description: 400, highlight: 40, highlights: 6 };
export const DATE = /^\d{4}-\d{2}-\d{2}$/;

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

/**
 * Plain text from an upstream string: HTML tags, entities and control characters removed,
 * whitespace collapsed, cut at a word boundary to `max` characters. null when nothing is left.
 */
export function plainText(v, max = Infinity) {
  if (typeof v !== 'string') return null;
  let s = v
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(script|style)\b[\s\S]*?<\/\1\s*>/gi, ' ')
    .replace(/<[^>]*>?/g, ' ')
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (_, e) => {
      if (e[0] !== '#') return ENTITIES[e.toLowerCase()] ?? ' ';
      const code = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : Number(e.slice(1));
      return code > 31 && code < 0x110000 ? String.fromCodePoint(code) : ' ';
    })
    .replace(/[<>]/g, '')
    .replace(/[\u0000-\u001f\u007f\s]+/g, ' ')
    .trim();
  if (s.length > max) {
    let cut = s.slice(0, max - 1);
    const space = cut.lastIndexOf(' ');
    if (space > max / 2) cut = cut.slice(0, space);
    s = `${cut.trimEnd()}…`;
  }
  return s || null;
}

/** A real calendar date written YYYY-MM-DD. */
export const isDate = (v) =>
  typeof v === 'string' &&
  DATE.test(v) &&
  new Date(`${v}T00:00:00Z`).toISOString().slice(0, 10) === v;

/**
 * tagline, description, highlights and updated from a manifest, as plain text within
 * COPY_LIMITS. Missing or unusable fields come back null / [] (the caller falls back to
 * generated text); `warnings` says what was dropped or shortened.
 */
export function manifestCopy(manifest) {
  const warnings = [];
  const m = manifest && typeof manifest === 'object' ? manifest : {};
  const text = (key, max) => {
    if (m[key] === undefined || m[key] === null) return null;
    const full = plainText(m[key]);
    if (full === null) warnings.push(`"${key}" is empty or not text; ignored`);
    else if (full.length > max) warnings.push(`"${key}" is over ${max} characters; shortened`);
    return plainText(m[key], max);
  };
  const tagline = text('tagline', COPY_LIMITS.tagline);
  const description = text('description', COPY_LIMITS.description);
  let highlights = [];
  if (m.highlights !== undefined && m.highlights !== null) {
    if (!Array.isArray(m.highlights)) warnings.push('"highlights" is not a list; ignored');
    else {
      highlights = [
        ...new Set(m.highlights.map((h) => plainText(h, COPY_LIMITS.highlight)).filter(Boolean)),
      ];
      if (highlights.length > COPY_LIMITS.highlights) {
        warnings.push(`"highlights" has more than ${COPY_LIMITS.highlights}; kept the first ones`);
        highlights = highlights.slice(0, COPY_LIMITS.highlights);
      }
    }
  }
  let updated = null;
  if (m.updated !== undefined && m.updated !== null) {
    if (isDate(m.updated)) updated = m.updated;
    else warnings.push(`"updated" is not a YYYY-MM-DD date; ignored`);
  }
  return { tagline, description, highlights, updated, warnings };
}
