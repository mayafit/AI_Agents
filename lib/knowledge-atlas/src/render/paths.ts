/**
 * lib/knowledge-atlas/src/render/paths.ts
 * ---------------------------------------------------------------------------
 * Story 29.3 — Shared output-path helpers for the rendering site.
 *
 * Single source of truth for converting a manifest fileId into the slug used
 * for its document page (`docs/<slug>.html`) and for building the relative
 * href between two pages. Imported by site.ts, document.ts, linkify.ts and
 * backlinks.ts so every page agrees on URLs (links must resolve).
 */

import type { KnowledgeManifest } from '../types.js';

/**
 * Convert a POSIX file path / fileId to its BASE document-page slug (before any
 * collision disambiguation). Deterministic.
 *   "_bmad-output/planning-artifacts/prd.md" → "bmad-output-planning-artifacts-prd"
 *
 * NOTE: distinct fileIds can produce the SAME base slug (e.g. `a/prd.md` and
 * `a_prd.md`). Use `resolveSlug(fileId, files)` for the final, collision-free
 * page slug — always resolve against the full file list so every consumer
 * (page writer, linkify, backlinks, search) computes the identical slug.
 */
export function filePathToSlug(filePath: string): string {
  return filePath
    .replace(/\.(md|markdown|yaml|yml|json|txt)$/i, '')
    .replace(/[^a-zA-Z0-9]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Build a deterministic, collision-free `fileId → slug` map from the full list
 * of document fileIds. `fileIds` MUST be the manifest.files paths (already
 * sorted by path). When two distinct fileIds share a base slug, the first (in
 * sorted order) keeps the base slug and later ones get `-2`, `-3`, … suffixes,
 * chosen to avoid clashing with any existing base slug. Pure function of the
 * input list → every caller derives the same map.
 */
export function buildSlugMap(fileIds: string[]): Map<string, string> {
  const bases = new Set<string>();
  for (const id of fileIds) bases.add(filePathToSlug(id));

  const map = new Map<string, string>();
  const used = new Set<string>();
  for (const id of fileIds) {
    const base = filePathToSlug(id);
    let slug = base;
    if (used.has(slug)) {
      let n = 2;
      // Skip suffixes that would collide with another file's BASE slug or an
      // already-assigned slug, so results stay unique and stable.
      while (used.has(`${base}-${n}`) || bases.has(`${base}-${n}`)) n++;
      slug = `${base}-${n}`;
    }
    used.add(slug);
    map.set(id, slug);
  }
  return map;
}

/** Resolve the final, collision-free page slug for one fileId. */
export function resolveSlug(fileId: string, allFileIds: string[]): string {
  return buildSlugMap(allFileIds).get(fileId) ?? filePathToSlug(fileId);
}

/** Relative path (from the site root) to a document page for a given fileId. */
export function docPageRelPath(fileId: string, allFileIds?: string[]): string {
  const slug = allFileIds ? resolveSlug(fileId, allFileIds) : filePathToSlug(fileId);
  return `docs/${slug}.html`;
}

/**
 * Build an href to a node (fileId#anchor) FROM a page located at `fromRel`
 * (a site-root-relative path such as "index.html" or "docs/x.html").
 *
 * Document pages live under docs/, the home and search pages live at the root,
 * so a link from a doc page to another doc page needs no "../" (same dir), and
 * a link from a doc page to the root needs one "../".
 */
export function hrefToNode(
  fromRel: string,
  targetFileId: string,
  anchor: string | undefined,
  manifest: KnowledgeManifest,
): string {
  // Resolve the target page against the full (sorted) file list so collisions
  // are disambiguated identically to the page writer.
  const fileIds = manifest.files.map(f => f.path);
  const targetRel = `docs/${resolveSlug(targetFileId, fileIds)}.html`;
  const rel = relativeFromTo(fromRel, targetRel);
  return anchor ? `${rel}#${anchor}` : rel;
}

/** POSIX relative path from one site-root-relative file to another. */
export function relativeFromTo(fromRel: string, toRel: string): string {
  const fromDir = fromRel.includes('/') ? fromRel.slice(0, fromRel.lastIndexOf('/')) : '';
  const fromParts = fromDir ? fromDir.split('/') : [];
  const toParts = toRel.split('/');

  // Find common prefix
  let i = 0;
  while (i < fromParts.length && i < toParts.length - 1 && fromParts[i] === toParts[i]) i++;

  const up = fromParts.length - i;
  const ups = up > 0 ? Array(up).fill('..') : [];
  const down = toParts.slice(i);
  const joined = [...ups, ...down].join('/');
  return joined || toParts[toParts.length - 1]!;
}
