// Pure checks for the web-projects showcase: data validation, personal-data detection and
// "is this page broken / behind a login" classification. Shared by the capture scripts, the
// site build (src/lib/showcase.ts) and the tests, so all three agree on what passes.

export const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const LIMITS = { name: 60, blurb: 280, tags: 4, tag: 24 };
/** Hosts capture-private.mjs accepts: this machine or a private LAN address only. */
const LOCAL_HOST =
  /^(localhost|127(?:\.\d{1,3}){3}|\[::1\]|::1|0\.0\.0\.0|10(?:\.\d{1,3}){3}|192\.168(?:\.\d{1,3}){2}|172\.(?:1[6-9]|2\d|3[01])(?:\.\d{1,3}){2}|[a-z0-9-]+\.(?:local|localhost|test))$/i;

export function isLocalUrl(url) {
  try {
    const u = new URL(url);
    return (u.protocol === 'http:' || u.protocol === 'https:') && LOCAL_HOST.test(u.hostname);
  } catch {
    return false;
  }
}

const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9-]+(?:\.[A-Z0-9-]+)*\.[A-Z]{2,}/gi;
// NANP and international numbers with separators; bare digit runs (prices, specs, years) don't match.
const PHONE =
  /(?:\+\d{1,3}[\s.-]?)?(?:\(\d{3}\)\s?|\b\d{3}[\s.-])\d{3}[\s.-]\d{4}\b|\+\d{1,3}(?:[\s.-]\d{2,4}){2,4}\b/g;
const STREET =
  /\b\d{1,6}\s+(?:[NSEW]\.?\s+)?(?:[A-Z][a-z]+\.?\s+){1,4}(?:St|Street|Ave|Avenue|Rd|Road|Blvd|Boulevard|Dr|Drive|Ln|Lane|Ct|Court|Way|Pl|Place|Hwy|Highway|Pkwy|Parkway|Cir|Circle|Ter|Terrace)\b\.?/g;
const PO_BOX = /\bP\.?\s?O\.?\s+Box\s+\d+/gi;
const ZIP_LINE = /\b[A-Z][a-z]+,\s*[A-Z]{2}\s+\d{5}(?:-\d{4})?\b/g;

// Emails compare case-insensitively; phone numbers and addresses by letters and digits only.
const norm = (s) => (s.includes('@') ? s.toLowerCase() : s.toLowerCase().replace(/[^a-z0-9]/g, ''));

/**
 * Emails, phone numbers and street addresses in `text`. `allow` holds exact strings a public site
 * itself publishes as its business contact (e.g. "hello@example.com"); they're compared with
 * punctuation and spacing ignored. Private captures never pass `allow`.
 * @returns {{ kind: 'email' | 'phone' | 'address', value: string }[]}
 */
export function findPersonalData(text, allow = []) {
  const allowed = new Set(allow.map(norm));
  const out = [];
  const add = (kind, re) => {
    for (const m of text.matchAll(re)) {
      const value = m[0].trim();
      if (!allowed.has(norm(value)) && !out.some((o) => o.value === value))
        out.push({ kind, value });
    }
  };
  add('email', EMAIL);
  add('phone', PHONE);
  add('address', STREET);
  add('address', PO_BOX);
  add('address', ZIP_LINE);
  return out;
}

const ERROR_TEXT =
  /\b(?:40[34]|50[0234])\b|not found|page not found|something went wrong|internal server error|bad gateway|service unavailable|application error|site can.t be reached|just a moment|attention required|access denied|forbidden/i;
const LOGIN_PATH = /\/(?:log-?in|sign-?in|signin|auth|sso|session|account\/login)(?:[/?#]|$)/i;
const LOGIN_TEXT =
  /\b(?:sign|log)\s?in to (?:continue|your account)|please (?:sign|log)\s?in|you must be (?:signed|logged) in/i;

/**
 * Decide whether a loaded page is fit to screenshot.
 * @param {{ status: number, url: string, title: string, headings: string[],
 *   passwordFields: number, bodyText: string }} page
 * @returns {string | null} why it can't be shown, or null when it's fine
 */
export function pageProblem(page) {
  if (!page.status || page.status >= 400) return `HTTP ${page.status || 'no response'}`;
  const head = [page.title, ...page.headings].join(' · ');
  if (ERROR_TEXT.test(head)) return `looks like an error page ("${head.slice(0, 80)}")`;
  if (page.passwordFields > 0) return 'login wall (a password field is visible)';
  if (LOGIN_PATH.test(new URL(page.url).pathname)) return `login wall (redirected to ${page.url})`;
  if (LOGIN_TEXT.test(page.bodyText.slice(0, 2000))) return 'login wall (asks to sign in)';
  if (page.bodyText.trim().length < 20) return 'page is blank';
  return null;
}

const plain = (s) => typeof s === 'string' && s.trim() === s && !/[<>{}\u0000-\u001f]/.test(s);

/**
 * Validate src/data/showcase.json.
 * @returns {string[]} problems; empty means valid
 */
export function validateShowcase(data) {
  const errs = [];
  if (!Array.isArray(data)) return ['showcase.json must be an array'];
  const slugs = new Set();
  data.forEach((e, i) => {
    const at = `showcase[${i}]${e?.slug ? ` (${e.slug})` : ''}`;
    if (!e || typeof e !== 'object') return errs.push(`${at}: not an object`);
    const known = ['slug', 'name', 'url', 'kind', 'blurb', 'tags', 'private', 'publicContact'];
    for (const k of Object.keys(e))
      if (!known.includes(k)) errs.push(`${at}: unknown field "${k}"`);
    if (typeof e.slug !== 'string' || !SLUG.test(e.slug)) errs.push(`${at}: bad slug`);
    else if (slugs.has(e.slug)) errs.push(`${at}: duplicate slug`);
    else slugs.add(e.slug);
    if (!plain(e.name) || !e.name || e.name.length > LIMITS.name) errs.push(`${at}: bad name`);
    if (e.kind !== 'web') errs.push(`${at}: kind must be "web"`);
    if (typeof e.private !== 'boolean') errs.push(`${at}: private must be true or false`);
    if (!plain(e.blurb) || !e.blurb || e.blurb.length > LIMITS.blurb) errs.push(`${at}: bad blurb`);
    if (
      !Array.isArray(e.tags) ||
      e.tags.length > LIMITS.tags ||
      e.tags.some((t) => !plain(t) || !t || t.length > LIMITS.tag)
    )
      errs.push(`${at}: tags must be up to ${LIMITS.tags} short strings`);
    if (e.private) {
      // A private build is never linked, so a URL would only leak where it lives.
      if (e.url != null) errs.push(`${at}: private entries must not have a url`);
      if (e.publicContact) errs.push(`${at}: private entries can't allow contact details`);
    } else {
      let u = null;
      try {
        u = new URL(e.url);
      } catch {
        /* reported below */
      }
      if (!u || u.protocol !== 'https:' || isLocalUrl(e.url))
        errs.push(`${at}: url must be a public https URL`);
    }
    if (
      e.publicContact != null &&
      (!Array.isArray(e.publicContact) || e.publicContact.some((s) => !plain(s) || !s))
    )
      errs.push(`${at}: publicContact must be a list of strings`);
    const pii = findPersonalData(`${e.name ?? ''}\n${e.blurb ?? ''}\n${(e.tags ?? []).join('\n')}`);
    if (pii.length) errs.push(`${at}: contact details in the copy (${pii.map((p) => p.value)})`);
  });
  return errs;
}
