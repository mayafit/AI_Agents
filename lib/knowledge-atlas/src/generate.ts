/**
 * lib/knowledge-atlas/src/generate.ts
 * ---------------------------------------------------------------------------
 * Story 29.1 — Core generate() function: discovery → manifest → render.
 * Story 29.2 — Extended buildManifest() with full scan→extract→graph→persist.
 *
 * Architecture invariants (Decision P5-7):
 *   - Write ONLY under `_bmad-output/knowledge-site/`. Never touch source.
 *   - No network access. Node built-ins + esbuild-inlined modules only.
 *   - LF output throughout (never emit CRLF into the HTML).
 *   - Deterministic: identical inputs + pinned SOURCE_DATE_EPOCH → byte-identical output.
 *
 * Discovery ↔ rendering seam:
 *   buildManifest() is the discovery half; renderHtml() is the rendering half.
 *   Story 29.2 extends buildManifest() with full _bmad-output scanning.
 *   Story 29.3+ extend renderHtml() with richer views.
 *   Neither half reaches into the other's domain.
 */

import * as fs from 'fs';
import * as path from 'path';
import { GenerateOptions, GenerateResult, KnowledgeManifest, FileRecord } from './types.js';
import { scanFiles } from './scan/scanner.js';
import { parseFrontmatter } from './extract/frontmatter.js';
import { extractEntities } from './extract/entities.js';
import { buildNodes, buildEdges, buildCounts } from './graph/build.js';
import { reconcileWithKgJson } from './graph/reconcile.js';
import { readManifest, writeManifest } from './manifest/persist.js';
import { computeDiff, mergeRecords } from './manifest/incremental.js';
import { renderSite } from './render/site.js';
// --- 29.4 graph/diagram/orphan pages ---
import { renderGraphPage } from './render/graph.js';
import { renderDiagrams } from './render/diagrams.js';
import { renderOrphanPage } from './render/orphan.js';

/** Current manifest schema version. Increment on breaking changes. */
const MANIFEST_VERSION = 1;

// ---------------------------------------------------------------------------
// Timestamp resolution — NFR62 determinism contract
// ---------------------------------------------------------------------------

/**
 * Maximum absolute millisecond value the ECMAScript Date type can represent
 * (±100,000,000 days from the epoch — see ECMA-262 "Time Values and Time Range").
 * A value outside this range makes `new Date(ms)` an Invalid Date, whose
 * `toISOString()` throws `RangeError: Invalid time value`. We bounds-check
 * against it so a hostile/typo'd SOURCE_DATE_EPOCH degrades gracefully to the
 * wall clock instead of crashing the whole generate run.
 */
const MAX_TIME_VALUE_MS = 8640000000000000;

/**
 * Resolve the "generated at" timestamp with this precedence:
 *   1. opts.now (caller-supplied override — used by tests and 29.6 gate)
 *   2. process.env.SOURCE_DATE_EPOCH (CI/reproducible-builds convention, seconds)
 *   3. current wall-clock time
 *
 * The result is always an ISO-8601 string with second precision (no sub-second
 * component) so the same SOURCE_DATE_EPOCH value produces byte-identical output
 * regardless of when the build runs.
 *
 * Robustness (edge-case hunter):
 *   - A `now` value that resolves to an Invalid Date throws a CLEAR error
 *     naming the offending value (not a cryptic RangeError deep in toISOString).
 *   - A numeric-string `now` (e.g. "1700000000") is treated as Unix SECONDS,
 *     the same domain as SOURCE_DATE_EPOCH, so CLI/string callers and the env
 *     var agree.
 *   - An out-of-range / non-numeric SOURCE_DATE_EPOCH falls through to the wall
 *     clock rather than emitting an Invalid Date.
 */
function resolveTimestamp(now?: Date | string | number): string {
  if (now !== undefined && now !== null) {
    let d: Date;
    if (now instanceof Date) {
      d = now;
    } else if (typeof now === 'number') {
      // Numbers are Unix seconds (same domain as SOURCE_DATE_EPOCH).
      d = new Date(now * 1000);
    } else if (/^\d+$/.test(now.trim())) {
      // A bare digit string is Unix seconds, matching SOURCE_DATE_EPOCH.
      d = new Date(parseInt(now.trim(), 10) * 1000);
    } else {
      // Otherwise treat as an ISO-8601 (or other Date-parseable) string.
      d = new Date(now);
    }
    if (!isValidDate(d)) {
      throw new Error(
        `generate: invalid \`now\` value: ${JSON.stringify(now)} — ` +
        `provide a Date, an ISO-8601 string, or Unix seconds.`,
      );
    }
    return isoSecond(d);
  }

  const epoch = process.env['SOURCE_DATE_EPOCH'];
  if (epoch) {
    const secs = parseInt(epoch, 10);
    // Reject NaN, negatives, and values that overflow the Date time range —
    // any of these would otherwise produce an Invalid Date.
    if (!isNaN(secs) && secs >= 0 && secs * 1000 <= MAX_TIME_VALUE_MS) {
      const d = new Date(secs * 1000);
      if (isValidDate(d)) {
        return isoSecond(d);
      }
    }
    // Fall through to wall clock on any invalid SOURCE_DATE_EPOCH.
  }

  return isoSecond(new Date());
}

/** True iff `d` is a valid Date (not an Invalid Date sentinel). */
function isValidDate(d: Date): boolean {
  return d instanceof Date && !isNaN(d.getTime());
}

/** Truncate a Date to second precision and return ISO-8601 (no ms component). */
function isoSecond(d: Date): string {
  // toISOString() returns "…T…Z"; strip the milliseconds part.
  return d.toISOString().replace(/\.\d{3}Z$/, 'Z');
}

// ---------------------------------------------------------------------------
// Project title derivation
// ---------------------------------------------------------------------------

/**
 * Derive a human-readable project title:
 *   1. `name` field in `<projectRoot>/package.json` (if it exists and is a string)
 *   2. Basename of projectRoot as fallback
 *   3. `'Unknown Project'` when the basename is empty (e.g. a filesystem root
 *      like `/` or `C:\`) so the <title>/<h1> are never blank.
 */
function deriveProjectTitle(projectRoot: string): string {
  const pkgPath = path.join(projectRoot, 'package.json');
  try {
    if (fs.existsSync(pkgPath)) {
      const raw = fs.readFileSync(pkgPath, 'utf-8');
      const pkg = JSON.parse(raw) as Record<string, unknown>;
      if (typeof pkg['name'] === 'string' && pkg['name'].trim()) {
        return pkg['name'].trim();
      }
    }
  } catch {
    // Non-fatal: fall through to basename
  }
  const base = path.basename(projectRoot).trim();
  return base.length > 0 ? base : 'Unknown Project';
}

// ---------------------------------------------------------------------------
// Discovery half: buildManifest()
// Story 29.2 extends this with actual _bmad-output scanning.
// ---------------------------------------------------------------------------

/**
 * Extract a single file's content and produce a FileRecord.
 * Reads the file, parses frontmatter, extracts entities.
 */
function extractFileRecord(absPath: string, fileId: string, docType: import('./types.js').DocType, contentHash: string): FileRecord {
  let content = '';
  try {
    content = fs.readFileSync(absPath, 'utf-8');
  } catch {
    // Unreadable file — return empty record
    return { path: fileId, contentHash, type: docType, entities: [], statuses: [], edges: [] };
  }

  const fm = parseFrontmatter(content, fileId);
  const { entities, statuses, edges } = extractEntities(content, fileId, docType, fm);

  return {
    path: fileId,
    contentHash,
    type: docType,
    entities,
    statuses,
    edges,
  };
}

/**
 * Build the full KnowledgeManifest from a project.
 *
 * Orchestration: scan → incremental diff → extract changed files → build graph → reconcile → return manifest.
 * Does NOT write to disk (that's done in generate() after this returns).
 *
 * @param projectRoot    Absolute path to the project root.
 * @param bmadOutputDir  Absolute path to _bmad-output.
 * @param outDir         Absolute path to the knowledge-site output directory.
 * @param generatedAt    ISO-8601 timestamp (already resolved).
 * @returns The full KnowledgeManifest.
 */
function buildManifest(
  projectRoot: string,
  bmadOutputDir: string,
  outDir: string,
  generatedAt: string,
): KnowledgeManifest {
  const projectTitle = deriveProjectTitle(projectRoot);

  // Step 1: Scan all BMAD files
  const scannedFiles = scanFiles(projectRoot, bmadOutputDir, outDir);

  // Step 2: Load prior manifest for incremental rebuild (version-guarded:
  // a schema-mismatched or stub prior is ignored → full rebuild, item 19).
  const priorManifest = readManifest(outDir, MANIFEST_VERSION);
  const priorRecords = priorManifest?.files ?? [];

  // Step 3: Compute incremental diff
  const diff = computeDiff(
    priorRecords,
    scannedFiles.map(f => ({ fileId: f.fileId, contentHash: f.contentHash })),
  );

  // Step 4: Extract records for changed/added files
  const toReprocessSet = new Set(diff.toReprocess);
  const reprocessed: FileRecord[] = [];

  for (const sf of scannedFiles) {
    if (toReprocessSet.has(sf.fileId)) {
      reprocessed.push(extractFileRecord(sf.absPath, sf.fileId, sf.type, sf.contentHash));
    }
  }

  // Step 5: Merge unchanged + reprocessed, drop removed
  const allRecords = mergeRecords(diff.unchanged, reprocessed, diff.removed);

  // Step 6: Build typed graph (nodes + edges)
  const nodes = buildNodes(allRecords);
  const edges = buildEdges(allRecords, nodes);

  // Step 7: Reconcile with knowledge-graph.json (if present)
  const { nodes: mergedNodes, edges: mergedEdges } = reconcileWithKgJson(
    nodes,
    edges,
    bmadOutputDir,
  );

  // Step 8: Build counts
  const counts = buildCounts(allRecords, mergedNodes, mergedEdges);

  return {
    projectTitle,
    generatedAt,
    projectRoot,
    bmadOutputDir,
    version: MANIFEST_VERSION,
    files: allRecords,
    nodes: mergedNodes,
    edges: mergedEdges,
    counts,
  };
}

// ---------------------------------------------------------------------------
// Rendering half: delegated to render/site.ts (Story 29.3)
// The CSS const and renderHtml() have been replaced by renderSite().
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Public API: generate()
// ---------------------------------------------------------------------------

/**
 * Generate the Knowledge Atlas site for a project.
 *
 * Writes ONLY under `_bmad-output/knowledge-site/`.
 * Returns a GenerateResult describing what was written.
 */
export function generate(opts: GenerateOptions): GenerateResult {
  const { projectRoot, outDir: outDirOverride } = opts;

  if (!projectRoot || typeof projectRoot !== 'string') {
    throw new Error('generate: projectRoot is required and must be a non-empty string');
  }

  // Edge-case (hunter #8): projectRoot must be an absolute path to an EXISTING
  // directory. Otherwise a typo'd root would silently `mkdirSync` a whole tree
  // under garbage — non-destructive-isolated-output invariant demands we fail
  // loud instead. (The CLI always passes a path.resolve()'d argument.)
  if (!path.isAbsolute(projectRoot)) {
    throw new Error(`generate: projectRoot must be an absolute path (got: ${projectRoot})`);
  }
  const rootStat = fs.statSync(projectRoot, { throwIfNoEntry: false });
  if (!rootStat || !rootStat.isDirectory()) {
    throw new Error(`generate: projectRoot does not exist or is not a directory: ${projectRoot}`);
  }

  const bmadOutputDir = path.join(projectRoot, '_bmad-output');
  const outDir = outDirOverride ?? path.join(bmadOutputDir, 'knowledge-site');

  // Safety (hunter #7): ALWAYS enforce that the resolved outDir stays under
  // projectRoot — including when the caller supplied `--out`/outDir. The CLI's
  // `--out` flows straight here, so skipping the guard for overrides was a
  // write-anywhere hole. `path.relative` of a sibling/parent starts with ".."
  // and of a different drive (Windows) is absolute.
  const rel = path.relative(projectRoot, outDir);
  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    throw new Error(`generate: outDir escapes projectRoot: ${outDir}`);
  }

  // Resolve the timestamp (NFR62 determinism)
  const generatedAt = resolveTimestamp(opts.now);

  // Discovery half: full scan→extract→graph→reconcile
  const manifest = buildManifest(projectRoot, bmadOutputDir, outDir, generatedAt);

  // Ensure output directory exists
  fs.mkdirSync(outDir, { recursive: true });

  // --- 29.4 graph/diagram/orphan pages ---
  // Written BEFORE renderSite so the home page + nav can detect graph.html
  // (via fs.existsSync in site.ts) and link the interactive graph view.
  // Each renderer is wrapped INDIVIDUALLY (finding #6 / FR234): a failure in one
  // page does not abort generate() or leave a partial site with dead nav links —
  // the other pages and index.html still render; the failure is logged to stderr
  // and that page is simply omitted from the file count.
  const safeRender = (
    label: string,
    fn: () => string[],
  ): string[] => {
    try {
      return fn();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      process.stderr.write(`[atlas] WARN: ${label} failed to render — page omitted: ${msg}\n`);
      return [];
    }
  };
  const graphFiles = safeRender('graph.html', () => renderGraphPage(manifest, outDir));
  const diagramFiles = safeRender('diagrams.html', () => renderDiagrams(manifest, outDir));
  const orphanFiles = safeRender('orphans.html', () => renderOrphanPage(manifest, outDir));
  const extraFileCount = graphFiles.length + diagramFiles.length + orphanFiles.length;
  // --- end 29.4 ---

  // Rendering half (Story 29.3): renderSite writes index.html (home), one
  // reading view per document, and search assets, returning the sorted list of
  // relative paths written. It detects the 29.4 pages written above and links
  // the interactive graph from the home/nav.
  const written = renderSite(manifest, outDir);

  // Write manifest.json (Story 29.2)
  writeManifest(outDir, manifest);

  const indexPath = path.join(outDir, 'index.html');

  return {
    outDir,
    indexPath,
    // 29.3 pages/assets + 29.4 graph/diagram/orphan pages + manifest.json
    fileCount: written.length + extraFileCount + 1,
  };
}
