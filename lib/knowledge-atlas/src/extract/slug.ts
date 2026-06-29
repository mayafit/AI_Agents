/**
 * lib/knowledge-atlas/src/extract/slug.ts
 * ---------------------------------------------------------------------------
 * Story 29.2 — P3-1 heading→anchor slug algorithm.
 *
 * Implements the GitHub/VSCode markdown heading slug algorithm so anchors in the
 * manifest match those produced by VSCode's markdown preview and knowledge-graph.json
 * (once Epic 19 / emitToGraph is merged). Story 29.5 will reconcile if needed.
 *
 * Algorithm (GitHub-style, confirmed by VSCode markdown anchor resolution):
 *   1. Lowercase the heading text.
 *   2. Remove characters that are NOT alphanumeric, space, or hyphen.
 *      (i.e. strip punctuation: . , ! ? : ; ' " ( ) [ ] { } / \ | @ # $ % ^ & * + = ~ ` < >)
 *   3. Replace spaces with hyphens.
 *   4. Collapse consecutive hyphens to a single hyphen.
 *   5. Strip leading/trailing hyphens.
 *
 * Examples:
 *   'Hello World'                   → 'hello-world'
 *   'FR123: Functional Requirement' → 'fr123-functional-requirement'
 *   'P5-7 Decision'                 → 'p5-7-decision'
 *   'NFR62 — Determinism'           → 'nfr62--determinism' → 'nfr62-determinism' (collapsed)
 *   '  Leading & trailing  '        → 'leading-trailing'
 *
 * Note: This is the P3-1 identity scheme. Epic 19 (which defines emitToGraph)
 * uses this same algorithm. If the real knowledge-graph.json uses a different
 * variant, Story 29.5 will reconcile; we keep it stable here.
 */

/**
 * Convert a markdown heading string to a GitHub/VSCode-compatible anchor slug.
 *
 * @param heading  Raw heading text (without the leading `#` characters).
 * @returns Anchor slug string suitable for `file-id#anchor` identity.
 */
export function headingToSlug(heading: string): string {
  return heading
    .toLowerCase()
    // Remove any character that is not alphanumeric, space, or hyphen
    .replace(/[^\w\s-]/g, '')
    // \w includes underscore — replace underscores with hyphen for consistency
    .replace(/_/g, '-')
    // Replace spaces (and runs of spaces) with a single hyphen
    .replace(/\s+/g, '-')
    // Collapse consecutive hyphens to a single hyphen
    .replace(/-{2,}/g, '-')
    // Strip leading/trailing hyphens
    .replace(/^-+|-+$/g, '');
}

/**
 * Convert an ENTITY TOKEN (not a heading) to an anchor slug.
 *
 * Unlike GitHub heading slugs (which simply strip `.`), entity ids must keep
 * `Story 1.2` distinct from `Story 12`. The dot is structurally significant in
 * `Story N.M`, so we map `.` → `-` BEFORE slugifying:
 *   'Story 1.2' → 'story-1-2'   (vs 'Story 12' → 'story-12')
 *   'P5-7'      → 'p5-7'
 *   'FR101'     → 'fr101'
 *
 * This is our own identity scheme for entity tokens; do not rely on GitHub's
 * dot-stripping for entity ids.
 */
export function entityToSlug(token: string): string {
  return headingToSlug(token.replace(/\./g, '-'));
}

/**
 * Build a `file-id#anchor` node id from a POSIX file-id and a heading text.
 * If heading is empty/undefined, returns just the fileId (file-level node).
 *
 * Uses the GitHub/VSCode heading-slug algorithm — intended for HEADINGS, not
 * entity tokens. For entity-token ids use `makeEntityNodeId`.
 */
export function makeNodeId(fileId: string, heading?: string): string {
  if (!heading || !heading.trim()) return fileId;
  const slug = headingToSlug(heading.trim());
  if (!slug) return fileId;
  return `${fileId}#${slug}`;
}

/**
 * Build a `file-id#anchor` node id for an ENTITY TOKEN using the entity slug
 * scheme (dot → hyphen), so `Story 1.2` and `Story 12` never collide.
 */
export function makeEntityNodeId(fileId: string, token?: string): string {
  if (!token || !token.trim()) return fileId;
  const slug = entityToSlug(token.trim());
  if (!slug) return fileId;
  return `${fileId}#${slug}`;
}
