// Web preview GLBs for the Clay Asset Library: decimates very dense meshes, adds smooth normals
// (the source meshes have none), resizes textures to WebP and meshopt-compresses geometry.
// Used by build-library.mjs.
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, meshopt, prune, simplify, textureCompress, weld } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer';
import sharp from 'sharp';

/** Previews above this many triangles are simplified to about PREVIEW_TRIANGLES. */
const DENSE_TRIANGLES = 60_000;
const PREVIEW_TRIANGLES = 40_000;

let io;
async function getIO() {
  if (io) return io;
  await MeshoptDecoder.ready;
  await MeshoptEncoder.ready;
  await MeshoptSimplifier.ready;
  io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
    'meshopt.decoder': MeshoptDecoder,
    'meshopt.encoder': MeshoptEncoder,
  });
  return io;
}

/**
 * Area-weighted smooth normals, shared across UV seams (vertices at the same position), so
 * clay surfaces shade softly. gltf-transform's normals() makes flat normals by unwelding,
 * which looks faceted and triples the vertex count.
 */
function smoothNormals() {
  return (doc) => {
    for (const mesh of doc.getRoot().listMeshes()) {
      for (const prim of mesh.listPrimitives()) {
        if (prim.getAttribute('NORMAL') || prim.getMode() !== 4) continue;
        const pos = prim.getAttribute('POSITION');
        const count = pos.getCount();
        const idx = prim.getIndices();
        const index = idx ? idx.getArray() : Uint32Array.from({ length: count }, (_, i) => i);
        const p = pos.getArray();
        const key = new Int32Array(count);
        const groups = new Map();
        for (let i = 0; i < count; i++) {
          const k = `${Math.round(p[i * 3] * 1e5)},${Math.round(p[i * 3 + 1] * 1e5)},${Math.round(p[i * 3 + 2] * 1e5)}`;
          if (!groups.has(k)) groups.set(k, groups.size);
          key[i] = groups.get(k);
        }
        const acc = new Float64Array(groups.size * 3);
        for (let t = 0; t + 2 < index.length; t += 3) {
          const [a, b, c] = [index[t], index[t + 1], index[t + 2]];
          const e1 = [
            p[b * 3] - p[a * 3],
            p[b * 3 + 1] - p[a * 3 + 1],
            p[b * 3 + 2] - p[a * 3 + 2],
          ];
          const e2 = [
            p[c * 3] - p[a * 3],
            p[c * 3 + 1] - p[a * 3 + 1],
            p[c * 3 + 2] - p[a * 3 + 2],
          ];
          const n = [
            e1[1] * e2[2] - e1[2] * e2[1],
            e1[2] * e2[0] - e1[0] * e2[2],
            e1[0] * e2[1] - e1[1] * e2[0],
          ];
          for (const v of [a, b, c]) {
            const g = key[v] * 3;
            acc[g] += n[0];
            acc[g + 1] += n[1];
            acc[g + 2] += n[2];
          }
        }
        const out = new Float32Array(count * 3);
        for (let i = 0; i < count; i++) {
          const g = key[i] * 3;
          const len = Math.hypot(acc[g], acc[g + 1], acc[g + 2]) || 1;
          out[i * 3] = acc[g] / len;
          out[i * 3 + 1] = acc[g + 1] / len;
          out[i * 3 + 2] = acc[g + 2] / len;
        }
        const normal = doc
          .createAccessor()
          .setType('VEC3')
          .setArray(out)
          .setBuffer(pos.getBuffer());
        prim.setAttribute('NORMAL', normal);
      }
    }
  };
}

/** Some upstream GLBs label JPEG textures image/png; trust the bytes, not the label. */
function fixMimeTypes() {
  return (doc) => {
    for (const t of doc.getRoot().listTextures()) {
      const b = t.getImage();
      if (!b || b.length < 12) continue;
      if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) t.setMimeType('image/jpeg');
      else if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47)
        t.setMimeType('image/png');
      else if (String.fromCharCode(...b.slice(8, 12)) === 'WEBP') t.setMimeType('image/webp');
    }
  };
}

/**
 * @param {Uint8Array} glb source model
 * @param {{ texture?: number }} [opts] max texture edge in px
 * @returns {Promise<Uint8Array>}
 */
export async function optimizeGlb(glb, { texture = 512 } = {}) {
  const io = await getIO();
  const doc = await io.readBinary(glb);
  doc.setLogger({ debug() {}, info() {}, warn() {}, error: console.error });
  let tris = 0;
  for (const m of doc.getRoot().listMeshes()) {
    for (const p of m.listPrimitives()) {
      tris += (p.getIndices()?.getCount() ?? p.getAttribute('POSITION')?.getCount() ?? 0) / 3;
    }
  }
  const dense =
    tris > DENSE_TRIANGLES
      ? [
          simplify({
            simplifier: MeshoptSimplifier,
            ratio: PREVIEW_TRIANGLES / tris,
            error: 0.01,
            lockBorder: false,
          }),
        ]
      : [];
  await doc.transform(
    fixMimeTypes(),
    dedup(),
    weld(),
    ...dense,
    smoothNormals(),
    prune(),
    textureCompress({
      encoder: sharp,
      targetFormat: 'webp',
      resize: [texture, texture],
      quality: 82,
    }),
    meshopt({ encoder: MeshoptEncoder, level: 'medium' }),
  );
  return io.writeBinary(doc);
}
