// Pack quality, measured from the clay-asset-packs files, and the copy built only from it:
// the generated description and the "What's new" phrases (diff against the previous sync).
// Pure functions except readImageSize (tests/library.spec.ts).
import { open, readFile } from 'node:fs/promises';

/** Change entries kept per pack, newest first. */
export const MAX_CHANGES = 3;
/** Triangle and size changes smaller than this are noise, not news. */
const MIN_DELTA = 0.05;

/** Width and height from a PNG, GIF or JPEG header; null when it's none of those. */
export function imageSize(buf) {
  if (
    buf.length >= 24 &&
    buf.readUInt32BE(0) === 0x89504e47 &&
    buf.toString('ascii', 12, 16) === 'IHDR'
  ) {
    return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
  }
  if (buf.length >= 10 && buf.toString('ascii', 0, 3) === 'GIF') {
    return { width: buf.readUInt16LE(6), height: buf.readUInt16LE(8) };
  }
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8) {
    let i = 2;
    while (i + 9 < buf.length) {
      if (buf[i] !== 0xff) {
        i++;
        continue;
      }
      const marker = buf[i + 1];
      if (marker === 0xff || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd8)) {
        i += marker === 0xff ? 1 : 2;
        continue;
      }
      // SOF0–SOF15 carry the frame size; C4 (DHT), C8 (JPG) and CC (DAC) don't.
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
        return { width: buf.readUInt16BE(i + 7), height: buf.readUInt16BE(i + 5) };
      }
      i += 2 + buf.readUInt16BE(i + 2);
    }
  }
  return null;
}

/** Reads just enough of an image file for its size (a large EXIF block means the whole JPEG). */
export async function readImageSize(path) {
  const fh = await open(path, 'r');
  try {
    const head = Buffer.alloc(64 * 1024);
    const { bytesRead } = await fh.read(head, 0, head.length, 0);
    const size = imageSize(head.subarray(0, bytesRead));
    if (size || bytesRead < head.length) return size;
  } finally {
    await fh.close();
  }
  return imageSize(await readFile(path));
}

/** { count, min, max } of each image's short side ("1080 px"), or null with no readable image. */
export function pxRange(sizes) {
  const px = sizes.filter(Boolean).map((s) => Math.min(s.width, s.height));
  return px.length ? { count: px.length, min: Math.min(...px), max: Math.max(...px) } : null;
}

/** mesh.type from per-model watertight flags (true / false / null when the manifest says nothing). */
export function meshType(flags) {
  const closed = flags.filter((f) => f === true).length;
  const open = flags.filter((f) => f === false).length;
  if (!flags.length || closed + open < flags.length) return { type: null, watertight: closed };
  return { type: open === 0 ? 'watertight' : closed === 0 ? 'open' : 'mixed', watertight: closed };
}

const fmt = (n) => n.toLocaleString('en-US');
const plural = (n, w) => `${fmt(n)} ${w}${n === 1 ? '' : 's'}`;
const and = (xs) => (xs.length > 1 ? `${xs.slice(0, -1).join(', ')} and ${xs.at(-1)}` : xs[0]);
/** Same rounding as the site's formatBytes, so phrases match the stats. */
export function formatBytes(n) {
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)} GB`;
  if (n >= 1e6) return `${Math.round(n / 1e6)} MB`;
  return `${Math.max(1, Math.round(n / 1e3))} KB`;
}
const px = (r) => (r.min === r.max ? `${r.min} px` : `${r.min}–${r.max} px`);
const round100 = (n) => Math.round(n / 100) * 100;
const moved = (a, b) => Math.abs(b - a) / Math.max(a, 1) >= MIN_DELTA;

/** The pack description, from measured quality only. "rig-ready" only when every mesh is watertight. */
export function describeQuality(q) {
  const m = q.models;
  const kinds = [
    m.character && plural(m.character, 'character'),
    m.creature && plural(m.creature, 'creature'),
    m.prop && plural(m.prop, 'prop'),
  ].filter(Boolean);
  let first = plural(m.total, 'model');
  if (kinds.length) first += ` (${and(kinds)})`;
  if (q.triangles) {
    first +=
      q.triangles.min === q.triangles.max
        ? `, ${fmt(q.triangles.avg)} triangles each`
        : `, about ${fmt(round100(q.triangles.avg))} triangles each on average (${fmt(q.triangles.min)} to ${fmt(q.triangles.max)})`;
  }
  const out = [`${first}.`];
  if (q.mesh.type === 'watertight') out.push('Every mesh is watertight and rig-ready.');
  else if (q.mesh.type === 'mixed')
    out.push(`${fmt(q.mesh.watertight)} of ${fmt(m.total)} meshes are watertight.`);
  if (q.textures) {
    let t = plural(q.textures.sets, 'texture set');
    if (q.textures.px) t += ` at ${px(q.textures.px)}`;
    if (q.textures.maps.length) t += ` (${and(q.textures.maps)} maps)`;
    out.push(`${t}.`);
  }
  const previews = [
    q.previews && `${px(q.previews.px)} preview images`,
    q.turntables && `${px(q.turntables.px)} turntables`,
  ].filter(Boolean);
  if (previews.length) out.push(`${and(previews).replace(/^./, (c) => c.toUpperCase())}.`);
  out.push(`${formatBytes(q.bytes)} in ${plural(q.files, 'file')}.`);
  return out.join(' ');
}

function pxChange(label, was, now) {
  if (!was && now) return [`Now includes ${label.toLowerCase()} at ${px(now.px)}`];
  if (was && !now) return [`${label} removed`];
  if (!was || !now || !was.px || !now.px || was.px.min === now.px.min) return [];
  return now.px.min > was.px.min
    ? [`${label} ${label === 'Textures' ? 'upgraded to' : 'now'} ${now.px.min} px`]
    : [`${label} now ${now.px.min} px (was ${was.px.min} px)`];
}

/**
 * Plain factual phrases for what changed between two syncs of a pack's quality. [] when nothing
 * did, or when there is no previous measurement (the first measured sync is the baseline).
 */
export function diffQuality(was, now) {
  if (!was || !now) return [];
  const items = [];
  if (was.models.total !== now.models.total) {
    items.push(`${plural(now.models.total, 'model')} (was ${fmt(was.models.total)})`);
  }
  if (was.triangles && now.triangles) {
    const [a, b] = [round100(was.triangles.avg), round100(now.triangles.avg)];
    if (a !== b && moved(was.triangles.avg, now.triangles.avg)) {
      items.push(
        `${b > a ? 'Higher-detail' : 'Lighter'} models (avg ${fmt(b)} triangles, was ${fmt(a)})`,
      );
    }
  }
  if (was.mesh.type !== now.mesh.type && now.mesh.type) {
    if (now.mesh.type === 'watertight') items.push('Every mesh is now watertight and rig-ready');
    else if (was.mesh.type === 'watertight') {
      items.push(
        now.mesh.type === 'open'
          ? 'Meshes are now open, no longer rig-ready'
          : `Only ${fmt(now.mesh.watertight)} of ${fmt(now.models.total)} meshes are watertight now, no longer rig-ready`,
      );
    } else {
      items.push(`${fmt(now.mesh.watertight)} of ${fmt(now.models.total)} meshes now watertight`);
    }
  }
  if (was.textures && now.textures && was.textures.sets !== now.textures.sets) {
    items.push(`${plural(now.textures.sets, 'texture set')} (was ${fmt(was.textures.sets)})`);
  }
  items.push(...pxChange('Textures', was.textures, now.textures));
  items.push(...pxChange('Preview images', was.previews, now.previews));
  items.push(...pxChange('Turntables', was.turntables, now.turntables));
  if (formatBytes(was.bytes) !== formatBytes(now.bytes) && moved(was.bytes, now.bytes)) {
    items.push(`Pack size ${formatBytes(now.bytes)} (was ${formatBytes(was.bytes)})`);
  }
  return items;
}

/** New items become today's entry (merged if a sync already ran today); last MAX_CHANGES kept. */
export function addChanges(changes, items, date) {
  const list = Array.isArray(changes) ? changes : [];
  if (!items.length) return list;
  if (list[0]?.date === date) {
    return [{ date, items: [...new Set([...list[0].items, ...items])] }, ...list.slice(1)];
  }
  return [{ date, items }, ...list].slice(0, MAX_CHANGES);
}
