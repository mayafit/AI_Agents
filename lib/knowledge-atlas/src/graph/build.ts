/**
 * lib/knowledge-atlas/src/graph/build.ts
 * ---------------------------------------------------------------------------
 * Story 29.2 — Typed graph builder.
 *
 * Takes per-file extraction results and materializes typed GraphNodes and GraphEdges.
 *
 * Node identity (P3-1 scheme):
 *   id = fileId#anchor  — where anchor = headingToSlug(entity token or heading)
 *   For entity tokens referenced in body text, the "definition site" is the
 *   first file where the token appears, or the file whose type matches the entity
 *   (e.g. FR### defined in prd, Epic N defined in epics, Story in its own file).
 *
 * Stable ordering (NFR62):
 *   Nodes sorted by id; edges sorted by (from, to, kind).
 *   No Date.now() / Math.random().
 *
 * Dangling edges:
 *   Edges whose `to` target node id is not found in the final node set are flagged
 *   with dangling:true. They are NOT dropped — the 29.4 orphan/gap view uses them.
 */

import { GraphNode, GraphEdge, NodeKind, FileRecord, DocType } from '../types.js';
import { entityToSlug, makeEntityNodeId } from '../extract/slug.js';

/**
 * Pick a representative lifecycle status for a node from a file's statuses.
 * Preference order matters for badges (29.3): the "furthest along" wins is NOT
 * assumed — we simply take the first in a stable, documented priority so the
 * choice is deterministic.
 */
const STATUS_PRIORITY = ['done', 'review', 'in-progress', 'ready-for-dev', 'backlog'];
function pickStatus(statuses: string[]): string | undefined {
  for (const s of STATUS_PRIORITY) {
    if (statuses.includes(s)) return s;
  }
  return statuses.length > 0 ? [...statuses].sort()[0] : undefined;
}

// ---------------------------------------------------------------------------
// Entity token → NodeKind mapping
// ---------------------------------------------------------------------------

/** Determine the NodeKind for a given entity token. */
function entityKind(token: string): NodeKind {
  if (/^FR\d+$/.test(token)) return 'requirement';
  if (/^NFR\d+$/.test(token)) return 'nfr';
  if (/^F\d{1,3}$/.test(token)) return 'capability';
  if (/^Epic \d+$/i.test(token)) return 'epic';
  if (/^Story \d+\.\d+$/i.test(token)) return 'story';
  if (/^\d+-\d+-[a-z0-9][a-z0-9-]*$/.test(token)) return 'story';
  if (/^bug-[a-z0-9][a-z0-9-]*$/.test(token)) return 'bug';
  if (/^P\d+-\d+$/.test(token)) return 'arch-decision';
  if (/^epic-\d+-retrospective$/.test(token)) return 'retrospective';
  return 'story'; // fallback
}

/** Determine the preferred definition-site DocType for a NodeKind. */
function preferredDocType(kind: NodeKind): DocType | null {
  switch (kind) {
    case 'requirement':
    case 'nfr':
    case 'capability':
      return 'prd';
    case 'epic':
      return 'epics';
    case 'story':
      return 'story';
    case 'bug':
      return 'bug';
    case 'arch-decision':
      return 'architecture';
    case 'retrospective':
      return 'retrospective';
    case 'document':
      // 'document' is a file-level NodeKind (Story 29.8) only — entityKind()
      // never assigns it to an entity token, so this branch is unreachable in
      // practice. Present only for switch exhaustiveness over NodeKind.
      return null;
  }
}

/**
 * Story 29.8 — NodeKind for a file's OWN file-level node (AC1). story/bug/
 * retrospective keep their pre-29.8 typed kinds (backward-compat); every other
 * DocType (prd/architecture/epics/brief/product-brief/report/sprint-status/
 * project-context/knowledge-graph/unknown) gets the 'document' kind so EVERY
 * scanned document — not just implementation artifacts — has a node that can
 * be a `references` edge source/target (the Prophesee 0-edge bug: a
 * planning-heavy project's PRD/architecture/epics docs had no file node at
 * all, so nothing could link FROM them to the FR/Epic entities they define).
 */
function fileNodeKind(docType: DocType): NodeKind {
  if (docType === 'story') return 'story';
  if (docType === 'bug') return 'bug';
  if (docType === 'retrospective') return 'retrospective';
  return 'document';
}

// ---------------------------------------------------------------------------
// Node materialization
// ---------------------------------------------------------------------------

/** Story-key prefix for `Story N.M` (→ "N-M-"), used for def-site basename match. */
function storyKeyPrefix(token: string): string | null {
  const m = token.match(/^Story\s+(\d+)\.(\d+)$/i);
  if (!m) return null;
  return `${m[1]}-${m[2]}-`;
}

/**
 * Choose the definition-site file for an entity token (item 3).
 *
 * For `Story N.M` tokens specifically, prefer the story FILE whose basename
 * starts with the story-key prefix (`1-2-*.md`) — that is the real definition
 * site, not the first arbitrary story file that merely *mentions* it (which
 * produced bogus self-edges). Fall back to: epics file → preferred doc type →
 * first occurrence.
 */
function chooseDefFile(
  token: string,
  kind: NodeKind,
  fileList: { fileId: string; type: DocType }[],
): { fileId: string; type: DocType } | undefined {
  if (kind === 'story') {
    const prefix = storyKeyPrefix(token);
    if (prefix) {
      // 1. File whose basename matches the story key (the real def site).
      const byBasename = fileList.find(f => {
        const base = f.fileId.split('/').pop() ?? '';
        return base.startsWith(prefix);
      });
      if (byBasename) return byBasename;
      // 2. The epics file (membership listing).
      const epicsFile = fileList.find(f => f.type === 'epics');
      if (epicsFile) return epicsFile;
    }
  }

  const preferred = preferredDocType(kind);
  const byPreferred = preferred ? fileList.find(f => f.type === preferred) : undefined;
  if (byPreferred) return byPreferred;

  return fileList[0];
}

/**
 * Build typed GraphNodes from all file records.
 *
 *   Node id = fileId#anchor (anchor = entityToSlug(token)).
 *   File-level nodes (story/bug/retro) get id = fileId and carry lifecycle status.
 *   Synthetic version nodes (id = version:vX.Y) back shipped-in edges (item 17).
 *
 * @param records  Per-file extraction records.
 * @returns Sorted array of unique GraphNode objects.
 */
export function buildNodes(records: FileRecord[]): GraphNode[] {
  // First pass: collect all entity tokens and which files they appear in
  const tokenFiles = new Map<string, { fileId: string; type: DocType }[]>();

  for (const rec of records) {
    for (const token of rec.entities) {
      let arr = tokenFiles.get(token);
      if (!arr) { arr = []; tokenFiles.set(token, arr); }
      arr.push({ fileId: rec.path, type: rec.type });
    }
  }

  const nodeMap = new Map<string, GraphNode>();

  // File-level nodes for EVERY scanned document (Story 29.8 AC1) — previously
  // only story/bug/retrospective got one, so a planning doc (prd/architecture/
  // epics/…) could DEFINE entity nodes but never itself be a link source/target
  // (the Prophesee 0-edge bug). story/bug/retrospective keep their pre-29.8
  // typed kinds for backward-compat; everything else gets 'document'. This
  // file-level id (no '#anchor') never collides with an entity-token node id
  // (always fileId#anchor), so an FR/Epic entity stays its own separate node.
  for (const rec of records) {
    // knowledge-graph.json is NOT a "document" in the AC1 sense — it is the
    // machine-readable graph-reconciliation input (graph/reconcile.ts), never
    // entity-extracted (see extract/entities.ts's early return for it), and
    // its content is treated as equivalent-to-absent when empty. Giving it a
    // file node here would break that absence-equivalence invariant (a
    // present-but-empty `{}` KG file would then differ from a wholly-absent
    // one purely by SCAN side effects) for zero navigational benefit — nothing
    // meaningful ever mentions "the knowledge-graph.json file" in prose.
    if (rec.type === 'knowledge-graph') continue;

    const kind = fileNodeKind(rec.type);
    const basename = rec.path.split('/').pop()!.replace(/\.(md|yaml|yml|json)$/i, '');
    const status = pickStatus(rec.statuses);
    const node: GraphNode = {
      id: rec.path,
      kind,
      label: basename,
      fileId: rec.path,
    };
    if (status) node.status = status;
    nodeMap.set(rec.path, node);
  }

  // Second pass: for each entity token, pick the best definition-site file.
  for (const [token, fileList] of tokenFiles) {
    const kind = entityKind(token);
    const defFile = chooseDefFile(token, kind, fileList);
    if (!defFile) continue;

    const anchor = entityToSlug(token);
    const id = makeEntityNodeId(defFile.fileId, token);

    if (!nodeMap.has(id)) {
      nodeMap.set(id, {
        id,
        kind,
        label: token,
        fileId: defFile.fileId,
        anchor,
      });
    }
  }

  // Note (item 17): `shipped-in` edges target synthetic `version:vX.Y` ids.
  // Versions are NOT a BMAD entity kind, so we do NOT mint mistyped nodes for
  // them. Instead they are treated as intentionally-terminal in buildEdges()
  // (isTerminalTarget) so they are never flagged dangling and never pollute the
  // 29.4 orphan/gap view.

  // Sort by id for determinism
  return [...nodeMap.values()].sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}

// ---------------------------------------------------------------------------
// Edge materialization
// ---------------------------------------------------------------------------

/**
 * Collect all edges from file records and resolve/flag dangling edges.
 *
 * - Deduplicates edges by (from, to, kind).
 * - Edges whose `to` is not in the node id set are flagged dangling:true.
 * - Sorted by (from, to, kind) for determinism.
 *
 * @param records  Per-file extraction records.
 * @param nodes    Already-built node array (for dangling detection).
 * @returns Sorted array of (possibly-dangling) GraphEdge objects.
 */
export function buildEdges(records: FileRecord[], nodes: GraphNode[]): GraphEdge[] {
  const nodeIds = new Set(nodes.map(n => n.id));

  // Collect and deduplicate edges
  const edgeMap = new Map<string, GraphEdge>();

  for (const rec of records) {
    for (const edge of rec.edges) {
      // Resolve to/from to node ids where possible
      const from = resolveId(edge.from, nodes, rec.path);
      const to = resolveId(edge.to, nodes, rec.path);

      // No self-loops (item 3 / Story 29.8): a resolved from===to is always
      // degenerate, never a real relationship. This can arise for `references`
      // edges when an entity token's normalized form collides with its own
      // file-level node's label (e.g. an `epic-N-retrospective` token equals
      // that retrospective FILE's own basename) — resolveId's by-label lookup
      // then resolves the token back to the doc's own file node. Skip rather
      // than emit a no-op edge.
      if (from === to) continue;

      const key = `${from}|${to}|${edge.kind}`;

      if (!edgeMap.has(key)) {
        // A target is dangling only if it is neither a real node nor an
        // intentionally-terminal synthetic target (e.g. version: ids, item 17).
        const dangling = !nodeIds.has(to) && !isTerminalTarget(to);
        const e: GraphEdge = { from, to, kind: edge.kind };
        if (dangling) e.dangling = true;
        edgeMap.set(key, e);
      }
    }
  }

  // Sort by (from, to, kind)
  return [...edgeMap.values()].sort((a, b) => {
    if (a.from !== b.from) return a.from < b.from ? -1 : 1;
    if (a.to !== b.to) return a.to < b.to ? -1 : 1;
    return a.kind < b.kind ? -1 : a.kind > b.kind ? 1 : 0;
  });
}

/**
 * Attempt to resolve a raw entity token or file-id to a canonical node id.
 * If the raw id is already a node id, return it.
 * If it's an entity token, compute its node id via the node whose label matches.
 */
function resolveId(raw: string, nodes: GraphNode[], contextFileId: string): string {
  // Already a node id (contains '/' or '#')?
  if (nodes.some(n => n.id === raw)) return raw;

  // Is it an entity token? Find the node whose label matches
  const byLabel = nodes.find(n => n.label === raw);
  if (byLabel) return byLabel.id;

  // Could be a raw file-id (no anchor)
  const byFileId = nodes.find(n => n.fileId === raw && !n.anchor);
  if (byFileId) return byFileId.id;

  // Return as-is (will be marked dangling unless terminal)
  return raw;
}

/**
 * True if `to` is an intentionally-terminal synthetic target that should NOT be
 * counted as a dangling/orphan edge (item 17). Currently: `version:` ids from
 * shipped-in edges. Keeping this explicit means 29.4's orphan/gap view stays clean.
 */
function isTerminalTarget(to: string): boolean {
  return to.startsWith('version:');
}

// ---------------------------------------------------------------------------
// Aggregate counts
// ---------------------------------------------------------------------------

/**
 * Build aggregate count map: files, nodes, edges, and per-NodeKind counts.
 */
export function buildCounts(
  records: FileRecord[],
  nodes: GraphNode[],
  edges: GraphEdge[],
): Record<string, number> {
  const counts: Record<string, number> = {
    files: records.length,
    nodes: nodes.length,
    edges: edges.length,
  };

  // Per-kind counts
  for (const node of nodes) {
    const key = `nodes.${node.kind}`;
    counts[key] = (counts[key] ?? 0) + 1;
  }

  return counts;
}
