/**
 * lib/knowledge-atlas/src/manifest/persist.ts
 * ---------------------------------------------------------------------------
 * Story 29.2 — Manifest persistence: write manifest.json with stable ordering.
 *
 * Determinism invariant (NFR62):
 *   - Object keys serialized in stable sorted order.
 *   - Output uses LF line endings and ends with a trailing newline.
 *   - A from-scratch build and an incremental rebuild of the same tree must
 *     produce byte-identical manifest.json output.
 */

import * as fs from 'fs';
import * as path from 'path';
import { KnowledgeManifest } from '../types.js';

/**
 * Serialise a value with stable (sorted) key ordering at every object level.
 * Arrays are serialised as-is (element order must already be stable/sorted by callers).
 */
function stableStringify(value: unknown, indent: number = 2): string {
  return JSON.stringify(value, sortReplacer, indent);
}

/**
 * JSON.stringify replacer that sorts object keys alphabetically.
 * Arrays pass through unchanged (their order is caller-controlled).
 */
function sortReplacer(_key: string, value: unknown): unknown {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    // Sort keys and rebuild the object
    const sorted: Record<string, unknown> = {};
    for (const k of Object.keys(value as Record<string, unknown>).sort()) {
      sorted[k] = (value as Record<string, unknown>)[k];
    }
    return sorted;
  }
  return value;
}

/**
 * Write the manifest as JSON to `<outDir>/manifest.json`.
 *
 * Output format:
 *   - Pretty-printed (2-space indent) for human readability.
 *   - Object keys in stable (sorted) order.
 *   - LF line endings (normalized from any platform).
 *   - Trailing newline.
 */
export function writeManifest(outDir: string, manifest: KnowledgeManifest): string {
  fs.mkdirSync(outDir, { recursive: true });

  // Serialize with stable key order
  let json = stableStringify(manifest);
  // Normalize to LF
  json = json.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  // Ensure trailing newline
  if (!json.endsWith('\n')) json += '\n';

  const manifestPath = path.join(outDir, 'manifest.json');
  fs.writeFileSync(manifestPath, json, { encoding: 'utf-8' });

  return manifestPath;
}

/**
 * Read and parse manifest.json from `<outDir>/manifest.json`.
 * Returns null if absent, unparseable, or schema-version-mismatched.
 *
 * Schema-version guard (item 19): if the prior manifest's `version` differs from
 * `expectedVersion`, treat it as no prior manifest (forces a full rebuild) so
 * stale-shaped FileRecords never flow through the incremental diff. When
 * `expectedVersion` is undefined, no version check is applied.
 *
 * Also tolerates a prior manifest missing the 29.2 `files` array (pre-29.2 stub)
 * by treating it as no prior.
 */
export function readManifest(outDir: string, expectedVersion?: number): KnowledgeManifest | null {
  const manifestPath = path.join(outDir, 'manifest.json');
  if (!fs.existsSync(manifestPath)) return null;
  try {
    const raw = fs.readFileSync(manifestPath, 'utf-8');
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    const manifest = parsed as Partial<KnowledgeManifest>;

    // Version guard: mismatched (or missing) version → full rebuild.
    if (expectedVersion !== undefined && manifest.version !== expectedVersion) {
      return null;
    }

    // Shape guard: a prior without a files array can't drive incremental diff.
    if (!Array.isArray(manifest.files)) return null;

    return manifest as KnowledgeManifest;
  } catch {
    // Corrupt — treat as no prior manifest
  }
  return null;
}
