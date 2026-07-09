/**
 * lib/knowledge-atlas/src/render/vendor.ts
 * ---------------------------------------------------------------------------
 * Locate and read vendored browser runtimes that are too large to embed as
 * inline strings in the bundle (mermaid, the drawio viewer). They ship as real
 * files under `lib/knowledge-atlas/vendor/` and are copied verbatim into a
 * generated site's `assets/` directory, referenced by a local relative
 * `<script src="…">`. Nothing here is fetched over the network — the files are
 * part of the committed, offline ma-agents distribution.
 *
 * The engine runs as the bundled `lib/knowledge-atlas/dist/atlas.cjs`, so the
 * vendor directory is a sibling of `dist/` (`../vendor`).
 */

import * as fs from 'fs';
import * as path from 'path';

/** Absolute path to the vendored-runtime directory, relative to the bundle. */
export function vendorDir(): string {
  return path.join(__dirname, '..', 'vendor');
}

/** Read a vendored asset (e.g. "mermaid.min.js"); returns null if absent. */
export function readVendorAsset(name: string): string | null {
  const p = path.join(vendorDir(), name);
  try {
    return fs.readFileSync(p, 'utf-8');
  } catch {
    return null;
  }
}

/** Copy a vendored asset into `outDir/assets/<name>`. Returns the relative path
 *  written (e.g. "assets/mermaid.min.js"), or null if the asset is unavailable. */
export function writeVendorAsset(outDir: string, name: string): string | null {
  const content = readVendorAsset(name);
  if (content == null) return null;
  const assetsDir = path.join(outDir, 'assets');
  fs.mkdirSync(assetsDir, { recursive: true });
  // LF-normalize for determinism (NFR62), consistent with writeHtml.
  fs.writeFileSync(path.join(assetsDir, name), content.replace(/\r\n/g, '\n'), { encoding: 'utf-8' });
  return `assets/${name}`;
}
