/**
 * lib/knowledge-atlas/src/scan/config.ts
 * ---------------------------------------------------------------------------
 * Story 29.7 — Config-aware knowledge-source discovery.
 *
 * Real projects (e.g. Prophesee) keep planning/knowledge docs in folders set
 * by `_bmad/bmm/config.yaml` — `planning_artifacts`, `implementation_artifacts`,
 * `knowledgebase_path` — which may live OUTSIDE `_bmad-output` entirely. The
 * engine previously hard-scanned `<projectRoot>/_bmad-output` only, so those
 * documents were invisible to the Atlas. `resolveKnowledgeSources()` reads the
 * project's own config and returns the UNION of every knowledge source that
 * exists, deduplicated, with a stable `fileIdPrefix` per source.
 *
 * Backward-compat (AC3, hard gate): a project with no `_bmad/bmm/config.yaml`
 * (or one with none of the relevant keys) MUST resolve to exactly one source —
 * `<projectRoot>/_bmad-output` with fileIdPrefix `_bmad-output` — the SAME
 * identity scheme `scanFiles()` has always produced. Every code path below is
 * written so the no-config case degrades to exactly that.
 *
 * Sealed/offline: js-yaml is already bundled (used by extract/frontmatter.ts)
 * — no new dependency is introduced.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { KnowledgeSource } from '../types.js';

/** Default `_bmad-output` folder name, used when no config (or no `output_folder`) is present. */
const DEFAULT_OUTPUT_FOLDER = '_bmad-output';

/** Result of `resolveKnowledgeSources()`. */
export interface ResolvedKnowledgeSources {
  /** Deduplicated, deterministically-sorted knowledge sources to scan. */
  sources: KnowledgeSource[];
  /** The resolved `output_folder` value (relative to projectRoot), default `_bmad-output`. */
  outputFolder: string;
  /**
   * Story 29.7 MUST-FIX #1 — true if a CONFIGURED knowledge source resolved to
   * the generated output dir (`<output_folder>/knowledge-site`) itself, or to a
   * path NESTED under it. Such a source was DROPPED from `sources` (never
   * scanned) and a warning was written to stderr; the caller MUST also skip the
   * stale-output purge in that case so the user's data at that location is never
   * destroyed. (An ANCESTOR of the output dir — e.g. the default `_bmad-output`
   * — does NOT set this flag: purging its `knowledge-site/` subdir is safe.)
   */
  outputOverlap: boolean;
}

/**
 * Normalize a raw config scalar (Task 1.1 value-normalization rule):
 *   1. `String(v).trim()`.
 *   2. Replace `{project-root}` / `{project_root}` placeholders with `projectRoot`.
 *   3. Strip surrounding/embedded quotes: `.replace(/^["']+|["']+$/g, '')`.
 *   4. Re-trim (placeholder/quote substitution can leave incidental whitespace).
 *
 * Does NOT resolve to absolute — callers that need an absolute path call
 * `resolveAbsolute()` afterward. Returns '' for an empty/whitespace-only result.
 */
function normalizeScalar(raw: string, projectRoot: string): string {
  let s = raw.trim();
  s = s.replace(/\{project[-_]root\}/g, projectRoot);
  s = s.replace(/^["']+|["']+$/g, '');
  return s.trim();
}

/**
 * Read a config key as a NORMALIZED string, or return undefined.
 *
 * MUST be a genuine string (Story 29.7 NICE-TO-HAVE #5): a YAML list, number,
 * boolean, or mapping value is IGNORED (returns undefined → caller falls back)
 * rather than being `String()`-coerced into a bogus literal folder name like
 * `"a,b"` (list) or `"123"` (number). Returns undefined for an empty result.
 */
function readStringKey(cfg: Record<string, unknown>, key: string, projectRoot: string): string | undefined {
  const raw = cfg[key];
  if (typeof raw !== 'string') return undefined;
  const v = normalizeScalar(raw, projectRoot);
  return v.length > 0 ? v : undefined;
}

/**
 * Resolve a normalized scalar to an absolute, OS-native path with no trailing
 * separator. Relative values resolve FROM `projectRoot` (Task 1.1).
 */
function resolveAbsolute(value: string, projectRoot: string): string {
  const resolved = path.isAbsolute(value) ? path.normalize(value) : path.resolve(projectRoot, value);
  const stripped = resolved.replace(/[\\/]+$/, '');
  return stripped.length > 0 ? stripped : resolved;
}

/**
 * True if `child` is `parent` itself or nested underneath it (path-prefix
 * comparison on OS-native separators). Used both for the projectRoot
 * under/outside test and for the nested-source dedup pass.
 */
function isAncestorOf(parent: string, child: string): boolean {
  if (parent === child) return true;
  const withSep = parent.endsWith(path.sep) ? parent : parent + path.sep;
  return child.startsWith(withSep);
}

/**
 * Read and parse `<projectRoot>/_bmad/bmm/config.yaml`. Tolerates a missing
 * file, an unreadable file, malformed YAML, or a non-object top level —
 * returns `null` in every such case (never throws).
 */
function readBmmConfig(projectRoot: string): Record<string, unknown> | null {
  const configPath = path.join(projectRoot, '_bmad', 'bmm', 'config.yaml');
  try {
    if (!fs.existsSync(configPath)) return null;
    const raw = fs.readFileSync(configPath, 'utf-8');
    const parsed = yaml.load(raw);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // Malformed YAML / unreadable file — tolerate, caller falls back to defaults.
  }
  return null;
}

/** A candidate source before fileIdPrefix assignment. */
interface Candidate {
  absPath: string;
}

/**
 * Discover every knowledge source a project's BMAD setup defines (Task 1.1).
 *
 * Precedence / tolerance:
 *   - No config file, malformed config, or no relevant keys → `{ sources: [<root>/_bmad-output], outputFolder: '_bmad-output' }`.
 *   - `output_folder` (default `_bmad-output`) always contributes the default source,
 *     regardless of whether it exists on disk yet (matches `scanFiles()`'s historical
 *     tolerance of a missing `_bmad-output`).
 *   - `planning_artifacts` / `implementation_artifacts` / `knowledgebase_path` each
 *     contribute a candidate source ONLY when set AND existing on disk.
 *   - Candidates equal to, or nested under, another kept candidate are dropped
 *     (broadest source wins) — first-seen wins for exact duplicates.
 *   - MUST-FIX #1: a candidate that resolves to the generated output dir
 *     (`<output_folder>/knowledge-site`) or NESTED under it is dropped WITH A
 *     WARNING and flags `outputOverlap` — so the purge never destroys it.
 *   - Sources OUTSIDE projectRoot get `fileIdPrefix = basename(absPath)`.
 *     MUST-FIX #2: a `-2`/`-3` suffix is applied on ANY prefix collision
 *     (internal-vs-external included), deterministically — never silently
 *     dropping a document whose fileId would otherwise clash.
 *   - Final list sorted by `fileIdPrefix` (determinism, NFR62).
 */
export function resolveKnowledgeSources(projectRoot: string): ResolvedKnowledgeSources {
  let outputFolder = DEFAULT_OUTPUT_FOLDER;
  let planningArtifacts: string | undefined;
  let implementationArtifacts: string | undefined;
  let knowledgebasePath: string | undefined;

  const cfg = readBmmConfig(projectRoot);
  if (cfg) {
    // NICE-TO-HAVE #5: non-string values (list/number/bool/mapping) are ignored.
    const of = readStringKey(cfg, 'output_folder', projectRoot);
    if (of) outputFolder = of;
    const pa = readStringKey(cfg, 'planning_artifacts', projectRoot);
    if (pa) planningArtifacts = resolveAbsolute(pa, projectRoot);
    const ia = readStringKey(cfg, 'implementation_artifacts', projectRoot);
    if (ia) implementationArtifacts = resolveAbsolute(ia, projectRoot);
    const kb = readStringKey(cfg, 'knowledgebase_path', projectRoot);
    if (kb) knowledgebasePath = resolveAbsolute(kb, projectRoot);
  }

  const defaultAbsPath = resolveAbsolute(outputFolder, projectRoot);
  // The generated site dir that generate() writes to (and purges). A configured
  // source AT or UNDER this path would be destroyed by the purge (MUST-FIX #1).
  const outputDir = resolveAbsolute(path.join(outputFolder, 'knowledge-site'), projectRoot);

  // Candidate list in a stable, documented order: default, then the three
  // configured keys (only when set AND present on disk).
  const candidates: Candidate[] = [{ absPath: defaultAbsPath }];
  for (const v of [planningArtifacts, implementationArtifacts, knowledgebasePath]) {
    if (v && fs.existsSync(v)) candidates.push({ absPath: v });
  }

  // Pass 0 (MUST-FIX #1): drop any candidate that IS the output dir or is
  // nested UNDER it — scanning it would ingest generated pages, and (worse) the
  // stale-output purge would delete the user's data there. Warn + flag so the
  // caller skips the purge. The DEFAULT source (`_bmad-output`) is an ANCESTOR
  // of the output dir, never a descendant/equal, so it is never dropped here.
  let outputOverlap = false;
  const nonOverlapping: Candidate[] = [];
  for (const c of candidates) {
    if (c.absPath === outputDir || isAncestorOf(outputDir, c.absPath)) {
      outputOverlap = true;
      process.stderr.write(
        `[atlas] WARN: knowledge source ${c.absPath} overlaps the output dir ${outputDir} — skipped\n`,
      );
      continue;
    }
    nonOverlapping.push(c);
  }

  // Pass 1: dedup EXACT duplicate absPaths — first occurrence wins (stable order).
  const seenExact = new Set<string>();
  const deduped: Candidate[] = [];
  for (const c of nonOverlapping) {
    if (seenExact.has(c.absPath)) continue;
    seenExact.add(c.absPath);
    deduped.push(c);
  }

  // Pass 2: drop any candidate NESTED under a DIFFERENT kept candidate (keep the
  // broadest source — e.g. implementation_artifacts under the default _bmad-output).
  const keptAfterNesting = deduped.filter((c) =>
    !deduped.some((other) => other !== c && isAncestorOf(other.absPath, c.absPath) && other.absPath !== c.absPath),
  );

  // Assign the BASE fileIdPrefix per Task 2.1's under/outside rule.
  interface WithPrefix { absPath: string; prefix: string; external: boolean; }
  const withPrefix: WithPrefix[] = keptAfterNesting.map((c) => {
    const rel = path.relative(projectRoot, c.absPath);
    const isUnderRoot = rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
    const prefix = isUnderRoot
      ? (rel === '' ? '' : rel.split(path.sep).join('/'))
      : path.basename(c.absPath);
    return { absPath: c.absPath, prefix, external: !isUnderRoot };
  });

  // MUST-FIX #2: disambiguate prefix collisions across ALL sources (internal
  // AND external — e.g. internal `docs` vs external basename `docs`), not just
  // external-vs-external. Process in a deterministic order (by absPath) so the
  // first source keeps the bare prefix and each subsequent collider gets the
  // lowest free `-N` suffix. Without this, `scanSources()`'s dedup-by-fileId
  // would silently DROP one source's documents. An empty prefix (a source
  // rooted exactly at projectRoot) is never suffixed — it is unique by
  // construction (only one source can be the root).
  const sortedForPrefix = [...withPrefix].sort((a, b) =>
    a.absPath < b.absPath ? -1 : a.absPath > b.absPath ? 1 : 0,
  );
  const usedPrefixes = new Set<string>();
  for (const s of sortedForPrefix) {
    if (s.prefix === '') { continue; }
    if (!usedPrefixes.has(s.prefix)) {
      usedPrefixes.add(s.prefix);
      continue;
    }
    let n = 2;
    while (usedPrefixes.has(`${s.prefix}-${n}`)) n++;
    s.prefix = `${s.prefix}-${n}`;
    usedPrefixes.add(s.prefix);
  }

  const sources: KnowledgeSource[] = withPrefix.map((s) => ({ absPath: s.absPath, fileIdPrefix: s.prefix }));
  sources.sort((a, b) => (a.fileIdPrefix < b.fileIdPrefix ? -1 : a.fileIdPrefix > b.fileIdPrefix ? 1 : 0));

  return { sources, outputFolder, outputOverlap };
}
