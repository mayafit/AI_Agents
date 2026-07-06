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
import { DocType, KnowledgeSource } from '../types.js';
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
 * Directory names never descended into during a scan (Story 29.7 SHOULD-FIX #3).
 *
 * Now that knowledge sources are CONFIGURABLE (and can resolve broadly — even to
 * a project root or a checkout that contains a VCS/tooling tree), the walker must
 * not ingest VCS metadata, dependency trees, or IDE folders as "documents"
 * (the real Prophesee bug: `prophesee-knowledge/.git/HEAD`, `.git/hooks/*.sample`
 * were scanned as docs). We also never descend into a `knowledge-site` output dir.
 *
 * In addition to this explicit list, ANY dot-directory (name starting with `.`)
 * is skipped. The existing fixtures contain none of these, so this is
 * byte-neutral for the backward-compat (AC3) gate.
 */
const EXCLUDED_DIR_NAMES = new Set([
  '.git', 'node_modules', '.hg', '.svn', '.idea', '.vscode', 'knowledge-site',
]);

/**
 * Recursively enumerate all files under `dir`, appending their absolute paths
 * to `results`. Excludes symlinks that resolve to directories (tolerated), and
 * skips VCS/dependency/IDE/output directories (see EXCLUDED_DIR_NAMES) plus any
 * dot-directory.
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
      // Skip VCS/dependency/IDE/output dirs and any dot-directory (SHOULD-FIX #3).
      if (EXCLUDED_DIR_NAMES.has(entry.name) || entry.name.startsWith('.')) {
        continue;
      }
      walkDir(full, results);
    } else if (entry.isFile()) {
      // Story 29.8 — skip hidden FILES too (extends 29.7's hidden-DIR skip).
      // A dotfile at a source root (`.gitignore`, `.gitattributes`, `.DS_Store`,
      // any basename starting with `.`) is tooling metadata, not a BMAD
      // document; without this it leaked in as an `unknown` doc (real Prophesee
      // bug). The existing fixtures contain no such dotfiles, so this is
      // byte-neutral for the backward-compat (AC3/AC6) gate.
      if (entry.name.startsWith('.')) {
        continue;
      }
      results.push(full);
    }
    // Symlinks: skip (tolerate, not followed)
  }
}

/**
 * Scan all BMAD documents across multiple knowledge sources (Story 29.7).
 *
 * Each source contributes files under its own `absPath`, with the resulting
 * fileId built as `fileIdPrefix + '/' + relToSource` (or just `relToSource`
 * when `fileIdPrefix` is empty). All other per-file logic — outDir exclusion,
 * `knowledge-graph.html` exclusion, binary skip, CRLF/BOM-safe hashing,
 * classification — is IDENTICAL to the original single-source `scanFiles()`.
 *
 * A source whose `absPath` does not exist is tolerated (contributes zero
 * files), matching `scanFiles()`'s historical tolerance of a missing
 * `_bmad-output`.
 *
 * Results are merged across all sources, sorted by fileId (POSIX), and
 * deduplicated by fileId (first-encountered — i.e. earliest source in the
 * input array, in on-disk walk order — wins; `Array.prototype.sort` is stable
 * so ties from equal fileIds preserve that encounter order).
 *
 * @param sources  Knowledge sources to scan (see `resolveKnowledgeSources()`).
 * @param outDir   Absolute path to the knowledge-site output directory (excluded from scan).
 * @returns Sorted, deduplicated array of ScannedFile records (sorted by fileId, POSIX).
 */
export function scanSources(
  sources: KnowledgeSource[],
  outDir: string,
): ScannedFile[] {
  // Normalize outDir for exclusion comparison (POSIX, NO trailing slash) so the
  // `+ '/'` below can never produce a `//` that defeats the exclusion (item 20).
  const outDirPosix = outDir.split(path.sep).join('/').replace(/\/+$/, '');

  const results: ScannedFile[] = [];

  for (const source of sources) {
    // Tolerate a source that doesn't exist yet (e.g. _bmad-output pre-first-run).
    if (!fs.existsSync(source.absPath)) {
      continue;
    }

    const absPaths: string[] = [];
    walkDir(source.absPath, absPaths);

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

      // Compute POSIX-normalized file-id, prefixed per source (Task 2.1).
      const relToSource = path.relative(source.absPath, absPath).split(path.sep).join('/');
      const fileId = source.fileIdPrefix ? `${source.fileIdPrefix}/${relToSource}` : relToSource;

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
  }

  // Deterministic: sort by fileId (POSIX). Stable sort preserves the
  // source-array / on-disk-walk encounter order for equal fileIds.
  results.sort((a, b) => a.fileId < b.fileId ? -1 : a.fileId > b.fileId ? 1 : 0);

  // Dedup identical fileIds — first-encountered (post-stable-sort) wins.
  const seen = new Set<string>();
  const deduped: ScannedFile[] = [];
  for (const r of results) {
    if (seen.has(r.fileId)) continue;
    seen.add(r.fileId);
    deduped.push(r);
  }

  return deduped;
}

/**
 * Scan all BMAD documents under `bmadOutputDir` (single-source form).
 *
 * Preserved for backward compatibility and as the no-config default path:
 * this is exactly `scanSources()` called with a single source whose
 * `fileIdPrefix` is the projectRoot-relative POSIX path of `bmadOutputDir`
 * (e.g. `_bmad-output`) — the SAME identity scheme this function has always
 * produced (AC3 backward-compat hard gate).
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
  const fileIdPrefix = path.relative(projectRoot, bmadOutputDir).split(path.sep).join('/');
  return scanSources([{ absPath: bmadOutputDir, fileIdPrefix }], outDir);
}
