/**
 * lib/knowledge-atlas/src/extract/entities.ts
 * ---------------------------------------------------------------------------
 * Story 29.2 — Entity token extraction and graph edge derivation.
 *
 * Entity vocabulary (from BMAD brief addendum + architecture):
 *   FR###           Functional requirement
 *   NFR##           Non-functional requirement
 *   F##             Capability (feature)
 *   Epic N          Epic reference
 *   Story N.M       Story reference
 *   NN-M-slug       Story file key (story file naming convention)
 *   bug-<slug>      Bug reference
 *   P#-#            Architecture decision
 *   epic-N-retrospective  Retrospective reference
 *   Statuses        backlog / ready-for-dev / in-progress / review / done
 *
 * Determinism invariant (NFR62):
 *   All regex operations are deterministic. Entity arrays are sorted before return.
 *   No Date.now() / Math.random() anywhere.
 *
 * Edge derivation table:
 *   story file → implements FR/NFR/F it references
 *   story file → derives-from epic (from frontmatter epic: field or Epic N in body)
 *   retrospective → validates epic
 *   "Blocked by:" / "Blocks:" prose → blocks edge
 *   "Depends on:" prose → depends-on edge
 *   "shipped v..." prose → shipped-in edge
 */

import { GraphEdge, DocType } from '../types.js';

// ---------------------------------------------------------------------------
// Entity regex patterns (anchored, well-tested)
// ---------------------------------------------------------------------------

/** Matches FR### (1–3+ digits). e.g. FR1, FR216 */
const RE_FR = /\bFR(\d+)\b/g;

/** Matches NFR## (1–3+ digits). e.g. NFR62 */
const RE_NFR = /\bNFR(\d+)\b/g;

/** Matches F## (capability, 1–3 digits). Must be word-boundary to avoid FR/NFR. */
const RE_F = /\bF(\d{1,3})\b(?!R)/g;

/** Matches "Epic N" or "Epic NN" (1–4 digits). */
const RE_EPIC = /\bEpic\s+(\d{1,4})\b/gi;

/** Matches "Story N.M" (e.g. Story 29.2). */
const RE_STORY_NM = /\bStory\s+(\d+)\.(\d+)\b/gi;

/**
 * Matches story file key "NN-M-slug" (e.g. 29-2-scan-extract).
 * The 3rd segment MUST start with a LETTER so ISO dates (`2023-01-15`) and
 * numeric URL/path segments (`/29-2-3`) are not misclassified as story keys.
 * `1-1-oauth2` and `29-2-scan` still match (slug starts with a letter).
 */
const RE_STORY_KEY = /\b(\d+)-(\d+)-([a-z][a-z0-9-]*)\b/g;

/** Matches "bug-<slug>" (e.g. bug-null-pointer, bug-crash-on-exit). */
const RE_BUG = /\bbug-([a-z0-9][a-z0-9-]*)\b/gi;

/** Matches "P#-#" architecture decision (e.g. P5-7, P3-1). */
const RE_ARCH = /\bP(\d+)-(\d+)\b/g;

/** Matches "epic-N-retrospective" (e.g. epic-7-retrospective). */
const RE_RETRO = /\bepic-(\d+)-retrospective\b/gi;

/** Lifecycle status tokens. */
const STATUSES = new Set(['backlog', 'ready-for-dev', 'in-progress', 'review', 'done']);

/** Matches "Blocked by:" followed by entity references. */
const RE_BLOCKED_BY = /blocked\s+by[:\s]+(.+?)(?:\n|$)/gi;

/** Matches "Blocks:" followed by entity references. */
const RE_BLOCKS = /\bblocks[:\s]+(.+?)(?:\n|$)/gi;

/** Matches "Depends on:" prose. */
const RE_DEPENDS_ON = /depends\s+on[:\s]+(.+?)(?:\n|$)/gi;

/** Matches "Addressed by:" prose → addressed-by edge (mirrors RE_BLOCKED_BY). */
const RE_ADDRESSED_BY = /addressed\s+by[:\s]+(.+?)(?:\n|$)/gi;

/** Matches "shipped vX.Y.Z" or "shipped in vX.Y.Z" — does NOT capture trailing punctuation. */
const RE_SHIPPED = /shipped(?:\s+in)?\s+(v[\d]+(?:\.[\d]+)*)/gi;

// ---------------------------------------------------------------------------
// Extraction result
// ---------------------------------------------------------------------------

export interface ExtractionResult {
  /** Deduplicated, sorted entity tokens. */
  entities: string[];
  /** Raw statuses found in the document (frontmatter + standalone body tokens). */
  statuses: string[];
  /** Edges derived from this file. */
  edges: GraphEdge[];
}

// ---------------------------------------------------------------------------
// Code-span stripping (item 7)
//
// Entity tokens that appear inside fenced (```…```) or inline (`…`) code spans
// are code samples, NOT real references, and must not become graph entities.
// We blank them to spaces (preserving length / newlines) BEFORE running the
// entity regexes so positions stay stable and determinism is preserved.
// ---------------------------------------------------------------------------

/** Replace every non-newline char in `s` with a space (keeps line structure). */
function blankOut(s: string): string {
  return s.replace(/[^\n]/g, ' ');
}

/**
 * Blank out fenced code blocks (``` … ```  and ~~~ … ~~~) and inline code
 * spans (`…`). Newlines are preserved so line-oriented status guards still work.
 */
function stripCodeSpans(content: string): string {
  // Fenced blocks first (``` or ~~~), including the fences themselves.
  let out = content.replace(/(^|\n)(```|~~~)[^\n]*\n[\s\S]*?\n\2[ \t]*(?=\n|$)/g, (m) => blankOut(m));
  // Any unterminated trailing fence: blank from the fence to end of string.
  out = out.replace(/(^|\n)(```|~~~)[\s\S]*$/g, (m) => blankOut(m));
  // Inline code spans: `…` (single line).
  out = out.replace(/`[^`\n]*`/g, (m) => blankOut(m));
  return out;
}

/**
 * Build a regex that matches a lifecycle status token only when it stands alone
 * (bounded by start/whitespace/punctuation), so `not-in-progress` and `not-done`
 * do NOT count as `in-progress` / `done`. We can't use \b because `-` is a word
 * char boundary issue; instead require the char before/after to be non-[a-z0-9-].
 */
function standaloneStatusRegex(status: string): RegExp {
  // (?<![a-z0-9-]) — not preceded by an identifier/hyphen char
  // (?![a-z0-9-])  — not followed by an identifier/hyphen char
  return new RegExp(`(?<![a-z0-9-])${status}(?![a-z0-9-])`, 'i');
}

// ---------------------------------------------------------------------------
// Token normalizers
// ---------------------------------------------------------------------------

function normalizeFR(n: string): string { return `FR${n}`; }
function normalizeNFR(n: string): string { return `NFR${n}`; }
function normalizeF(n: string): string { return `F${n}`; }
function normalizeEpic(n: string): string { return `Epic ${n}`; }
function normalizeStoryNM(major: string, minor: string): string { return `Story ${major}.${minor}`; }
function normalizeStoryKey(major: string, minor: string, slug: string): string {
  return `${major}-${minor}-${slug}`;
}
function normalizeBug(slug: string): string { return `bug-${slug.toLowerCase()}`; }
function normalizeArch(major: string, minor: string): string { return `P${major}-${minor}`; }
function normalizeRetro(n: string): string { return `epic-${n}-retrospective`; }

// ---------------------------------------------------------------------------
// Main extraction function
// ---------------------------------------------------------------------------

/**
 * Extract entities, statuses, and edges from a file's content.
 *
 * @param content  Raw file content (will be CRLF-normalized internally).
 * @param fileId   POSIX file-id of the file being extracted.
 * @param docType  Classified document type.
 * @param frontmatter  Already-parsed frontmatter (or null).
 * @returns ExtractionResult with deduplicated entities, statuses, and edges.
 */
export function extractEntities(
  content: string,
  fileId: string,
  docType: DocType,
  frontmatter: Record<string, unknown> | null,
): ExtractionResult {
  // knowledge-graph.json is reconciled separately (graph/reconcile.ts); never
  // regex-extract its JSON text into spurious nodes/edges (item 2).
  if (docType === 'knowledge-graph') {
    return { entities: [], statuses: [], edges: [] };
  }

  // CRLF-normalize, then blank out code spans so code-sample tokens are ignored.
  const normalized = stripCodeSpans(content.replace(/\r\n/g, '\n'));
  const entitySet = new Set<string>();
  const statusSet = new Set<string>();
  const edges: GraphEdge[] = [];

  // ── Extract frontmatter status ──
  if (frontmatter) {
    const fmStatus = frontmatter['status'];
    if (typeof fmStatus === 'string') {
      const s = fmStatus.toLowerCase().trim();
      if (STATUSES.has(s)) statusSet.add(s);
    }

    // Epic reference from frontmatter (e.g. epic: epic-7)
    const fmEpic = frontmatter['epic'];
    if (typeof fmEpic === 'string') {
      const epicMatch = fmEpic.match(/(\d+)/);
      if (epicMatch) {
        entitySet.add(normalizeEpic(epicMatch[1]!));
      }
    }
  }

  // ── Body entity extraction ──
  // Reset lastIndex for each regex (g flag keeps state)

  // FR### — functional requirements
  RE_FR.lastIndex = 0;
  for (const m of normalized.matchAll(RE_FR)) {
    entitySet.add(normalizeFR(m[1]!));
  }

  // NFR## — non-functional requirements
  RE_NFR.lastIndex = 0;
  for (const m of normalized.matchAll(RE_NFR)) {
    entitySet.add(normalizeNFR(m[1]!));
  }

  // F## — capabilities (must not match FR or NFR)
  // We use a negative lookahead in the regex to avoid FR/NFR
  RE_F.lastIndex = 0;
  for (const m of normalized.matchAll(RE_F)) {
    entitySet.add(normalizeF(m[1]!));
  }

  // Epic N
  RE_EPIC.lastIndex = 0;
  for (const m of normalized.matchAll(RE_EPIC)) {
    entitySet.add(normalizeEpic(m[1]!));
  }

  // Story N.M
  RE_STORY_NM.lastIndex = 0;
  for (const m of normalized.matchAll(RE_STORY_NM)) {
    entitySet.add(normalizeStoryNM(m[1]!, m[2]!));
  }

  // Story file key NN-M-slug (avoid matching things like "2023-01-foo" dates by checking context)
  // Only match if not preceded by a digit-dash pattern that looks like a date
  RE_STORY_KEY.lastIndex = 0;
  for (const m of normalized.matchAll(RE_STORY_KEY)) {
    const key = normalizeStoryKey(m[1]!, m[2]!, m[3]!);
    entitySet.add(key);
  }

  // bug-<slug>
  RE_BUG.lastIndex = 0;
  for (const m of normalized.matchAll(RE_BUG)) {
    entitySet.add(normalizeBug(m[1]!));
  }

  // P#-# architecture decision
  RE_ARCH.lastIndex = 0;
  for (const m of normalized.matchAll(RE_ARCH)) {
    entitySet.add(normalizeArch(m[1]!, m[2]!));
  }

  // epic-N-retrospective
  RE_RETRO.lastIndex = 0;
  for (const m of normalized.matchAll(RE_RETRO)) {
    entitySet.add(normalizeRetro(m[1]!));
  }

  // Statuses in body — standalone tokens only (item 6): `not-in-progress` must
  // NOT match `in-progress`, `not-done` must NOT match `done`.
  for (const status of STATUSES) {
    if (standaloneStatusRegex(status).test(normalized)) {
      statusSet.add(status);
    }
  }

  // ── Edge derivation ──
  const sourceId = fileId;

  if (docType === 'story') {
    // Story implements FR/NFR/F it references
    const frRefs: string[] = [];
    RE_FR.lastIndex = 0;
    for (const m of normalized.matchAll(RE_FR)) frRefs.push(normalizeFR(m[1]!));
    RE_NFR.lastIndex = 0;
    for (const m of normalized.matchAll(RE_NFR)) frRefs.push(normalizeNFR(m[1]!));
    RE_F.lastIndex = 0;
    for (const m of normalized.matchAll(RE_F)) frRefs.push(normalizeF(m[1]!));

    for (const ref of dedupSorted(frRefs)) {
      edges.push({ from: sourceId, to: ref, kind: 'implements' });
    }

    // Story derives-from epic (from frontmatter or body)
    const epicRefs: string[] = [];
    RE_EPIC.lastIndex = 0;
    for (const m of normalized.matchAll(RE_EPIC)) epicRefs.push(normalizeEpic(m[1]!));
    if (frontmatter?.['epic']) {
      const em = String(frontmatter['epic']).match(/(\d+)/);
      if (em) epicRefs.push(normalizeEpic(em[1]!));
    }
    for (const ref of dedupSorted(epicRefs)) {
      edges.push({ from: sourceId, to: ref, kind: 'derives-from' });
    }
  }

  if (docType === 'retrospective') {
    // Self-register: retrospective file is itself a retrospective entity
    const retroFilenameMatch = fileId.match(/epic-(\d+)-retrospective/);
    if (retroFilenameMatch) {
      entitySet.add(normalizeRetro(retroFilenameMatch[1]!));
    }

    // Retrospective validates epic
    RE_EPIC.lastIndex = 0;
    const epicRefs: string[] = [];
    for (const m of normalized.matchAll(RE_EPIC)) epicRefs.push(normalizeEpic(m[1]!));
    // Also extract from filename: epic-N-retrospective
    if (retroFilenameMatch) epicRefs.push(normalizeEpic(retroFilenameMatch[1]!));
    for (const ref of dedupSorted(epicRefs)) {
      edges.push({ from: sourceId, to: ref, kind: 'validates' });
    }
  }

  if (docType === 'epics') {
    // Epics doc: epic derives-from stories listed
    // No direct edges here — graph builder handles epic→story membership
  }

  // "Blocked by:" prose → blocks edge
  RE_BLOCKED_BY.lastIndex = 0;
  for (const m of normalized.matchAll(RE_BLOCKED_BY)) {
    const refs = extractEntityRefs(m[1]!);
    for (const ref of refs) {
      edges.push({ from: ref, to: sourceId, kind: 'blocks' });
    }
  }

  // "Blocks:" prose → blocks edge
  RE_BLOCKS.lastIndex = 0;
  for (const m of normalized.matchAll(RE_BLOCKS)) {
    const refs = extractEntityRefs(m[1]!);
    for (const ref of refs) {
      edges.push({ from: sourceId, to: ref, kind: 'blocks' });
    }
  }

  // "Depends on:" prose → depends-on edge
  RE_DEPENDS_ON.lastIndex = 0;
  for (const m of normalized.matchAll(RE_DEPENDS_ON)) {
    const refs = extractEntityRefs(m[1]!);
    for (const ref of refs) {
      edges.push({ from: sourceId, to: ref, kind: 'depends-on' });
    }
  }

  // "Addressed by:" prose → addressed-by edge (item 1).
  // Semantics mirror RE_BLOCKED_BY: the referenced entity (e.g. a fixing story)
  // addresses THIS file (the issue/bug). Edge: { from: ref, to: sourceId }.
  RE_ADDRESSED_BY.lastIndex = 0;
  for (const m of normalized.matchAll(RE_ADDRESSED_BY)) {
    const refs = extractEntityRefs(m[1]!);
    for (const ref of refs) {
      edges.push({ from: ref, to: sourceId, kind: 'addressed-by' });
    }
  }

  // "shipped vX.Y.Z" → shipped-in edge.
  // The version target is intentionally terminal (item 17): version nodes are
  // synthesized in the graph builder so these edges are never flagged dangling.
  RE_SHIPPED.lastIndex = 0;
  for (const m of normalized.matchAll(RE_SHIPPED)) {
    const version = m[1]!;
    edges.push({ from: sourceId, to: `version:${version}`, kind: 'shipped-in' });
  }

  return {
    entities: dedupSorted([...entitySet]),
    statuses: [...statusSet].sort(),
    edges,
  };
}

/**
 * Extract entity references from a prose string (for relationship parsing).
 * Returns normalized entity tokens.
 */
function extractEntityRefs(prose: string): string[] {
  const refs: string[] = [];

  RE_FR.lastIndex = 0;
  for (const m of prose.matchAll(RE_FR)) refs.push(normalizeFR(m[1]!));
  RE_NFR.lastIndex = 0;
  for (const m of prose.matchAll(RE_NFR)) refs.push(normalizeNFR(m[1]!));
  RE_STORY_NM.lastIndex = 0;
  for (const m of prose.matchAll(RE_STORY_NM)) refs.push(normalizeStoryNM(m[1]!, m[2]!));
  RE_STORY_KEY.lastIndex = 0;
  for (const m of prose.matchAll(RE_STORY_KEY)) refs.push(normalizeStoryKey(m[1]!, m[2]!, m[3]!));
  RE_BUG.lastIndex = 0;
  for (const m of prose.matchAll(RE_BUG)) refs.push(normalizeBug(m[1]!));
  RE_EPIC.lastIndex = 0;
  for (const m of prose.matchAll(RE_EPIC)) refs.push(normalizeEpic(m[1]!));
  RE_ARCH.lastIndex = 0;
  for (const m of prose.matchAll(RE_ARCH)) refs.push(normalizeArch(m[1]!, m[2]!));

  return refs;
}

/** Deduplicate and sort an array of strings. */
function dedupSorted(arr: string[]): string[] {
  return [...new Set(arr)].sort();
}

/**
 * Return the set of lifecycle statuses present in the content.
 * Exported for testing.
 */
export function extractStatuses(content: string): string[] {
  const found: string[] = [];
  for (const status of STATUSES) {
    if (standaloneStatusRegex(status).test(content)) found.push(status);
  }
  return found.sort();
}
