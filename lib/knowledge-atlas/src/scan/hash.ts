/**
 * lib/knowledge-atlas/src/scan/hash.ts
 * ---------------------------------------------------------------------------
 * Story 29.2 — Content hashing with CRLF normalization.
 *
 * Determinism invariant (NFR62):
 *   SHA-256 is computed on CRLF-normalized (→ LF) content so Windows and
 *   Linux checkouts of the same logical file produce identical hashes.
 *   mtime is used ONLY as a cheap pre-filter, NEVER as the identity.
 */

import * as fs from 'fs';
import * as crypto from 'crypto';

/**
 * Compute the SHA-256 hex digest of a file's content with CRLF normalized to LF.
 *
 * This ensures that files with Windows CRLF line endings produce the same hash
 * as their LF counterparts (e.g. after git checkout on Windows with core.autocrlf).
 *
 * Determinism contract: identical logical content → identical hash, regardless of
 * the line-ending convention or a leading UTF-8 BOM on the local platform.
 */
export function contentHash(absPath: string): string {
  const raw = fs.readFileSync(absPath);
  // Strip a leading UTF-8 BOM (item 14) so a BOM added/removed by an editor is
  // NOT seen as a content change. `toString('utf-8')` decodes a leading
  // EF BB BF to U+FEFF; remove it before hashing.
  let text = raw.toString('utf-8');
  if (text.charCodeAt(0) === 0xfeff) {
    text = text.slice(1);
  }
  // Normalize CRLF → LF before hashing (platform-independent identity).
  const normalized = text.replace(/\r\n/g, '\n');
  return crypto.createHash('sha256').update(normalized, 'utf-8').digest('hex');
}

/**
 * Return the file's mtime as a number (ms since epoch), or 0 if the file
 * cannot be stat'd. Used ONLY as a cheap pre-filter before contentHash().
 * Never used as identity — hash comparison is always the authoritative check.
 */
export function fileMtime(absPath: string): number {
  try {
    return fs.statSync(absPath).mtimeMs;
  } catch {
    return 0;
  }
}
