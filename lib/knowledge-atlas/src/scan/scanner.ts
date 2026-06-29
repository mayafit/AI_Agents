/**
 * lib/knowledge-atlas/src/scan/scanner.ts
 * ---------------------------------------------------------------------------
 * Story 29.2 — File scanner: enumerate and classify BMAD documents under _bmad-output.
 *
 * Responsibilities:
 *   1. Recursively enumerate all files under bmadOutputDir.
 *   2. EXCLUDE the output folder (knowledge-site/) and knowledge-graph.html.
 *   3. Classify each file into a DocType by path/filename pattern.
 *   4. Compute POSIX-normalized relative file-id (path.relative + forward slashes).
 *   5. Return a sorted, deterministic file list.
 *   6. Tolerate missing bmadOutputDir (return empty list, no throw).
 *
 * Determinism invariant (NFR62):
 *   File list is sorted by POSIX file-id before return.
 *   No Date.now() / Math.random() anywhere in this module.
 */

import * as fs from 'fs';
import * as path from 'path';
import { DocType } from '../types.js';
import { contentHash } from './hash.js';

/** A single scanned file entry before extraction. */
export interface ScannedFile {
  /** POSIX-normalized path relative to projectRoot (stable file-id base). */
  fileId: string;
  /** Absolute path for reading. */
  absPath: string;
  /** Classified document type. */
  type: DocType;
  /** SHA-256 of CRLF-normalized content. */
  contentHash: string;
}

/** Extensions treated as binary and skipped (never hashed/extracted). */
const BINARY_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.ico', '.webp', '.svgz',
  '.pdf', '.zip', '.gz', '.tar', '.tgz', '.7z', '.rar',
  '.woff', '.woff2', '.ttf', '.otf', '.eot',
  '.mp3', '.mp4', '.mov', '.avi', '.wav', '.ogg', '.webm',
  '.exe', '.dll', '.so', '.dylib', '.bin', '.class', '.wasm',
  '.xlsx', '.xls', '.docx', '.doc', '.pptx', '.ppt',
]);

/**
 * Detect a binary / non-text file (item 15). Returns true if the file should be
 * skipped from hashing/extraction. Detection:
 *   1. Known binary extension, OR
 *   2. A NUL byte within the first 8 KiB of the file.
 * On any read error, treat as non-binary (caller's hash step tolerates it).
 */
function isBinaryFile(absPath: string): boolean {
  const ext = path.extname(absPath).toLowerCase();
  if (BINARY_EXTENSIONS.has(ext)) return true;

  let fd: number | undefined;
  try {
    fd = fs.openSync(absPath, 'r');
    const buf = Buffer.alloc(8192);
    const bytes = fs.readSync(fd, buf, 0, buf.length, 0);
    for (let i = 0; i < bytes; i++) {
      if (buf[i] === 0) return true; // NUL byte → binary
    }
    return false;
  } catch {
    return false;
  } finally {
    if (fd !== undefined) {
      try { fs.closeSync(fd); } catch { /* ignore */ }
    }
  }
}

/**
 * Classify a file into a DocType based on its POSIX file-id.
 *
 * Classification rules (evaluated in priority order). The brief checks come
 * BEFORE the generic prd/architecture/epic substring rules (item 11) so that
 * `briefs/epic-overview.md` is a 'brief' (not 'epics') and `epic-product-brief.md`
 * is a 'product-brief' (not 'epics'):
 *   1. knowledge-graph.json → 'knowledge-graph'
 *   2. sprint-status.yaml   → 'sprint-status'
 *   3. project-context.md   → 'project-context'
 *   4. bug-*.md             → 'bug'
 *   5. epic-N-retrospective.md → 'retrospective'
 *   6. NN-M-slug.md (story key pattern) → 'story'
 *   7. product-brief* name  → 'product-brief'
 *   8. briefs/ folder       → 'brief'
 *   9. *prd* or product-requirements* → 'prd'
 *   10. *architecture*      → 'architecture'
 *   11. *epic* (not caught above) → 'epics'
 *   12. .md / .yaml / .yml  → 'report'
 *   13. anything else       → 'unknown'
 */
export function classifyFile(fileId: string): DocType {
  // Use basename and the full POSIX path for classification
  const parts = fileId.split('/');
  const basename = parts[parts.length - 1]!.toLowerCase();
  const lowerFileId = fileId.toLowerCase();

  // knowledge-graph.json (the legacy graph artifact)
  if (basename === 'knowledge-graph.json') return 'knowledge-graph';

  // sprint-status.yaml
  if (basename === 'sprint-status.yaml') return 'sprint-status';

  // project-context.md
  if (basename === 'project-context.md') return 'project-context';

  // bug-<slug>.md — must check before generic story pattern
  if (/^bug-[a-z0-9][a-z0-9-]*\.md$/.test(basename)) return 'bug';

  // epic-N-retrospective.md (e.g. epic-7-retrospective.md)
  if (/^epic-\d+-retrospective\.md$/.test(basename)) return 'retrospective';

  // Story file: NN-M-slug.md (e.g. 29-2-scan-deterministic.md)
  // Pattern: one or more digits, dash, one or more digits, dash, slug, .md
  if (/^\d+-\d+-[a-z0-9][a-z0-9-]*\.md$/.test(basename)) return 'story';

  // Product brief by NAME (before prd/epic substrings) — item 11.
  // e.g. epic-product-brief.md must be 'product-brief', not 'epics'.
  if (/product-brief/.test(basename)) return 'product-brief';

  // Files in the briefs/ folder (before prd/epic substrings) — item 11.
  // e.g. briefs/epic-overview.md must be 'brief', not 'epics'.
  if (lowerFileId.includes('/briefs/')) return 'brief';

  // PRD: filename contains 'prd' or matches product-requirements
  if (/prd/.test(basename) || /product-requirements/.test(basename)) return 'prd';

  // Architecture document
  if (/architecture/.test(basename)) return 'architecture';

  // Epics document (contains 'epic' but not already caught as retrospective or story)
  if (/epic/.test(basename)) return 'epics';

  // Markdown and YAML files → report
  if (basename.endsWith('.md') || basename.endsWith('.yaml') || basename.endsWith('.yml')) {
    return 'report';
  }

  return 'unknown';
}

/**
 * Recursively enumerate all files under `dir`, appending their absolute paths
 * to `results`. Excludes symlinks that resolve to directories (tolerated).
 */
function walkDir(dir: string, results: string[]): void {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    // Tolerate unreadable directories
    return;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkDir(full, results);
    } else if (entry.isFile()) {
      results.push(full);
    }
    // Symlinks: skip (tolerate, not followed)
  }
}

/**
 * Scan all BMAD documents under `bmadOutputDir`.
 *
 * @param projectRoot  Absolute path to the project root.
 * @param bmadOutputDir  Absolute path to _bmad-output.
 * @param outDir  Absolute path to the knowledge-site output directory (excluded from scan).
 * @returns Sorted array of ScannedFile records (sorted by fileId, POSIX).
 */
export function scanFiles(
  projectRoot: string,
  bmadOutputDir: string,
  outDir: string,
): ScannedFile[] {
  // Tolerate missing _bmad-output
  if (!fs.existsSync(bmadOutputDir)) {
    return [];
  }

  // Normalize outDir for exclusion comparison (POSIX, NO trailing slash) so the
  // `+ '/'` below can never produce a `//` that defeats the exclusion (item 20).
  const outDirPosix = outDir.split(path.sep).join('/').replace(/\/+$/, '');

  const absPaths: string[] = [];
  walkDir(bmadOutputDir, absPaths);

  const results: ScannedFile[] = [];

  for (const absPath of absPaths) {
    const absPosix = absPath.split(path.sep).join('/').replace(/\/+$/, '');

    // Exclude files inside the output directory (knowledge-site/)
    if (absPosix === outDirPosix || absPosix.startsWith(outDirPosix + '/')) {
      continue;
    }

    // Exclude knowledge-graph.html (the legacy rendered artifact)
    const basename = path.basename(absPath);
    if (basename === 'knowledge-graph.html') {
      continue;
    }

    // Skip binary / non-text files (item 15): a binary file utf-8-coerced and
    // CRLF-normalized would yield a corrupt, non-deterministic-ish hash and no
    // meaningful entities. Detect by extension OR a null byte in the head.
    if (isBinaryFile(absPath)) {
      continue;
    }

    // Compute POSIX-normalized file-id (relative to projectRoot)
    const rel = path.relative(projectRoot, absPath);
    const fileId = rel.split(path.sep).join('/');

    // Compute content hash (CRLF-safe, BOM-stripped)
    let hash: string;
    try {
      hash = contentHash(absPath);
    } catch {
      // Tolerate unreadable files (skip)
      continue;
    }

    const type = classifyFile(fileId);

    results.push({ fileId, absPath, type, contentHash: hash });
  }

  // Deterministic: sort by fileId (POSIX)
  results.sort((a, b) => a.fileId < b.fileId ? -1 : a.fileId > b.fileId ? 1 : 0);

  return results;
}
