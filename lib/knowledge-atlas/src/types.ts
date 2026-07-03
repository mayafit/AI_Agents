/**
 * lib/knowledge-atlas/src/types.ts
 * ---------------------------------------------------------------------------
 * Story 29.1 — Shared type definitions for the Knowledge Atlas engine.
 * Story 29.2 — Extended with scan/extract/graph/manifest types.
 *
 * Architecture invariant (Decision P5-7):
 *   Keep the discovery half (scan → manifest) and the rendering half
 *   (manifest → HTML) cleanly separable. The KnowledgeManifest is the
 *   contract between them. Story 29.1 seeds a stub; Story 29.2 fills the
 *   discovery fields. Later stories add sections without touching this
 *   seam as long as they extend (not replace) KnowledgeManifest.
 */

// ---------------------------------------------------------------------------
// Core options passed into generate()
// ---------------------------------------------------------------------------

/**
 * Options for the `generate()` function.
 *
 * - `projectRoot`  — absolute path to the consuming project root. Required.
 * - `outDir`       — override the default output directory
 *                    (`<projectRoot>/_bmad-output/knowledge-site`).
 * - `now`          — override the "generated at" timestamp for determinism.
 *                    Accept a Date, an ISO-8601 string, or a Unix-seconds
 *                    number (same domain as SOURCE_DATE_EPOCH).
 *
 * Determinism contract (NFR62):
 *   Identical inputs + pinned SOURCE_DATE_EPOCH ⇒ byte-identical output.
 *   Resolution order: opts.now > process.env.SOURCE_DATE_EPOCH > current time.
 *   Every later story must honor this chain.
 */
export interface GenerateOptions {
  projectRoot: string;
  outDir?: string;
  now?: Date | string | number;
}

// ---------------------------------------------------------------------------
// Result returned by generate()
// ---------------------------------------------------------------------------

export interface GenerateResult {
  /** Absolute path to the output directory (<projectRoot>/_bmad-output/knowledge-site). */
  outDir: string;
  /** Absolute path to the generated index.html. */
  indexPath: string;
  /** Number of files written (index.html + manifest.json). */
  fileCount: number;
}

// ---------------------------------------------------------------------------
// Story 29.2 — Document type classification
// ---------------------------------------------------------------------------

/**
 * Classification of a file found under _bmad-output.
 * Maps to BMAD's canonical document types.
 */
export type DocType =
  | 'product-brief'
  | 'prd'
  | 'architecture'
  | 'epics'
  | 'brief'
  | 'story'
  | 'bug'
  | 'retrospective'
  | 'sprint-status'
  | 'project-context'
  | 'report'
  | 'knowledge-graph'
  | 'unknown';

// ---------------------------------------------------------------------------
// Story 29.2 — Graph node/edge types
// ---------------------------------------------------------------------------

/**
 * Kind of entity node in the knowledge graph.
 * Maps directly to BMAD entity vocabulary (P3-1 scheme).
 */
export type NodeKind =
  | 'capability'      // F## capability
  | 'requirement'     // FR### functional requirement
  | 'nfr'             // NFR## non-functional requirement
  | 'epic'            // Epic N
  | 'story'           // Story N.M / NN-M-slug
  | 'bug'             // bug-<slug>
  | 'arch-decision'   // P#-# architecture decision
  | 'retrospective';  // epic-N-retrospective

/**
 * Kind of directed edge in the knowledge graph.
 * Maps to BMAD relationship vocabulary.
 */
export type EdgeKind =
  | 'implements'      // story/epic implements FR/NFR/F
  | 'derives-from'    // story derives from epic
  | 'refines'         // spec refines requirement
  | 'blocks'          // entity blocks another
  | 'depends-on'      // entity depends on another
  | 'validates'       // retro validates epic/story
  | 'addressed-by'    // issue addressed-by story/fix
  | 'shipped-in';     // entity shipped-in version

/**
 * Provenance tag indicating where a node/edge originated.
 * Added in Story 29.5 for full reconciliation hardening.
 *   'scan'  — derived from filesystem scan only
 *   'kg'    — present only in knowledge-graph.json (KG-only)
 *   'both'  — present in both scan and knowledge-graph.json
 * Omitted when knowledge-graph.json is absent (scan-only, absence-equivalence
 * with 29.2 output).
 */
export type ProvenanceSource = 'scan' | 'kg' | 'both';

/**
 * A typed node in the knowledge graph.
 * Identity scheme: `file-id#anchor` (P3-1 heading→anchor slug).
 * Anchors match knowledge-graph.json and VSCode markdown link resolution.
 */
export interface GraphNode {
  /** Stable identity: POSIX file-id + '#' + anchor slug (or just file-id for file-level nodes). */
  id: string;
  kind: NodeKind;
  /** Human-readable label (entity token or heading text). */
  label: string;
  /** Full section heading or document title, if available. */
  title?: string;
  /** Lifecycle status if extracted (backlog, ready-for-dev, in-progress, review, done). */
  status?: string;
  /** POSIX-normalized file-id (relative path, no anchor). */
  fileId: string;
  /** Heading anchor slug within the file, if applicable. */
  anchor?: string;
  /**
   * Provenance: where this node came from (Story 29.5).
   * Present only when knowledge-graph.json was processed during reconciliation.
   * Renderers must remain correct when this field is undefined.
   */
  source?: ProvenanceSource;
}

/**
 * A typed directed edge in the knowledge graph.
 * Both `from` and `to` reference GraphNode ids.
 * Dangling edges (unknown target id) are recorded and flagged for 29.4 orphan/gap view.
 */
export interface GraphEdge {
  from: string;
  to: string;
  kind: EdgeKind;
  /** True if `to` target node id was not found in the graph (orphan/gap). */
  dangling?: boolean;
  /**
   * Provenance: where this edge came from (Story 29.5).
   * Present only when knowledge-graph.json was processed during reconciliation.
   * Renderers must remain correct when this field is undefined.
   */
  source?: ProvenanceSource;
}

// ---------------------------------------------------------------------------
// Story 29.2 — Per-file record
// ---------------------------------------------------------------------------

/**
 * Per-file record in the manifest.
 * One record per scanned file under _bmad-output.
 */
export interface FileRecord {
  /** POSIX-normalized path, relative to projectRoot. */
  path: string;
  /** SHA-256 hex of CRLF-normalized file content. */
  contentHash: string;
  /** Classified document type. */
  type: DocType;
  /** Entity tokens extracted from this file (FR123, NFR45, etc.). */
  entities: string[];
  /**
   * Lifecycle statuses associated with this file (frontmatter `status:` plus
   * any standalone status tokens found in the body). Used by the graph builder
   * to stamp `GraphNode.status` on this file's own story/bug/epic node. 29.3
   * renders these as badges.
   */
  statuses: string[];
  /** Edges derived from this file's co-occurrences and relationships. */
  edges: GraphEdge[];
}

// ---------------------------------------------------------------------------
// KnowledgeManifest — the discovery ↔ rendering contract
//
// Story 29.1 keeps this minimal (stub). Story 29.2 adds scan-derived fields.
// Renderers in 29.3+ consume this manifest; they must never reach back into
// the filesystem themselves — all discovery is done before rendering begins.
// ---------------------------------------------------------------------------

/**
 * The full knowledge manifest produced by the discovery phase and consumed by renderers.
 * Extended by Story 29.2 with rich scan/graph fields.
 * Schema is additive — 29.3+ extend without breaking 29.1's seam.
 */
export interface KnowledgeManifest {
  /** Human-readable project title (derived from package.json or folder name). */
  projectTitle: string;

  /**
   * ISO-8601 generation timestamp.
   * Pinned via opts.now / SOURCE_DATE_EPOCH for deterministic output.
   */
  generatedAt: string;

  /** Absolute path to the project root (used by renderers that write assets). */
  projectRoot: string;

  /** Absolute path to _bmad-output within the project. */
  bmadOutputDir: string;

  // Story 29.2 fields:

  /** Schema version for forward-compatibility. Incremented with breaking changes. */
  version: number;

  /** Per-file records for all scanned files under _bmad-output. */
  files: FileRecord[];

  /** Deduplicated, sorted graph nodes derived from all scanned files. */
  nodes: GraphNode[];

  /** Deduplicated, sorted graph edges derived from all scanned files. */
  edges: GraphEdge[];

  /**
   * Aggregate counts for quick stats rendering.
   * Keys: 'files', 'nodes', 'edges', and per-NodeKind counts.
   */
  counts: Record<string, number>;
}
