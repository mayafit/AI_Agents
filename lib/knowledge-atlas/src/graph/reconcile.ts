/**
 * lib/knowledge-atlas/src/graph/reconcile.ts
 * ---------------------------------------------------------------------------
 * Story 29.2 — knowledge-graph.json merge (AC 6).
 * Story 29.5 — Full reconciliation hardening: provenance tagging, additive
 *              KG-only field preservation, scan-wins on conflict, absence
 *              equivalence, malformed-KG tolerance.
 *
 * If <bmadOutputDir>/knowledge-graph.json is present, its nodes/edges are read
 * and merged with the scan-derived graph. Scan wins for any field conflict on a
 * node id present in both sources.
 *
 * Provenance policy (Story 29.5 / Decision P5-7):
 *   - When knowledge-graph.json is ABSENT: nodes/edges carry no `source` field
 *     (absence-equivalence with 29.2 scan-only output — no provenance noise).
 *   - When knowledge-graph.json is PRESENT:
 *       scan-only node/edge  → source: 'scan'
 *       KG-only node/edge    → source: 'kg'
 *       present in both      → source: 'both', scan fields win on conflict,
 *                              non-conflicting KG-only fields preserved additively.
 *
 * Full reconciliation hardening (provenance tagging, diff reporting) Story 29.5.
 * This implementation is additive and identity-stable:
 *   - Nodes/edges only in knowledge-graph.json are kept (provenance-tagged 'kg').
 *   - Nodes also in the scan graph: scan fields win for conflict resolution.
 *   - Absent knowledge-graph.json → scan-only manifest (no-op merge, no source field).
 *
 * Expected knowledge-graph.json shape (P3-1 / Epic 19):
 *   { "meta": {...}, "nodes": [...], "edges": [...] }
 *   Each node: { "id": "fileId#anchor", "kind": "...", "label": "...", ... }
 *   Each edge: { "from": "...", "to": "...", "kind": "...", ... }
 *
 * Since Epic 19 is not merged, we defensively tolerate shape variations.
 */

import * as fs from 'fs';
import * as path from 'path';
import { GraphNode, GraphEdge, NodeKind, EdgeKind, ProvenanceSource } from '../types.js';

/** Minimal shape we expect from knowledge-graph.json nodes. */
interface KGNode {
  id: string;
  kind?: string;
  label?: string;
  title?: string;
  status?: string;
  fileId?: string;
  anchor?: string;
  [key: string]: unknown;
}

/** Minimal shape we expect from knowledge-graph.json edges. */
interface KGEdge {
  from: string;
  to: string;
  kind?: string;
  dangling?: boolean;
  [key: string]: unknown;
}

/** Parsed knowledge-graph.json structure. */
interface KGJson {
  nodes?: KGNode[];
  edges?: KGEdge[];
  [key: string]: unknown;
}

// Valid node/edge kind sets for validation
const VALID_NODE_KINDS = new Set<NodeKind>([
  'capability', 'requirement', 'nfr', 'epic', 'story', 'bug', 'arch-decision', 'retrospective',
]);
const VALID_EDGE_KINDS = new Set<EdgeKind>([
  'implements', 'derives-from', 'refines', 'blocks', 'depends-on', 'validates', 'addressed-by', 'shipped-in',
]);

/**
 * Attempt to read and parse <bmadOutputDir>/knowledge-graph.json.
 * Returns null if the file is absent, unreadable, or malformed.
 * Never throws.
 */
function readKgJson(bmadOutputDir: string): KGJson | null {
  const kgPath = path.join(bmadOutputDir, 'knowledge-graph.json');
  if (!fs.existsSync(kgPath)) return null;

  try {
    const raw = fs.readFileSync(kgPath, 'utf-8');
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as KGJson;
    }
  } catch {
    // Malformed JSON — tolerate
  }
  return null;
}

/**
 * Convert a KGNode to a GraphNode, coercing kinds to valid values.
 * Returns null if the node has no valid id.
 */
function coerceNode(kgNode: KGNode): GraphNode | null {
  if (!kgNode.id || typeof kgNode.id !== 'string') return null;

  // Coerce kind
  let kind: NodeKind = 'story'; // safe fallback
  if (kgNode.kind && VALID_NODE_KINDS.has(kgNode.kind as NodeKind)) {
    kind = kgNode.kind as NodeKind;
  }

  // Derive fileId from id (everything before #)
  const hashIdx = kgNode.id.indexOf('#');
  const fileId = kgNode.fileId ?? (hashIdx >= 0 ? kgNode.id.slice(0, hashIdx) : kgNode.id);
  // Anchor precedence (finding #4): when the id carries a '#…' suffix, prefer an
  // explicit `anchor` field over the id-derived suffix so a KG node that supplies
  // a distinct anchor deep-links correctly. We only set anchor when the id has a
  // '#' separator — this keeps the 29.2 invariant (anchor ⇒ id contains '#') and
  // never invents an anchor for a file-level (anchorless) id.
  const anchor = hashIdx >= 0
    ? ((typeof kgNode.anchor === 'string' && kgNode.anchor) ? kgNode.anchor : kgNode.id.slice(hashIdx + 1))
    : undefined;

  const node: GraphNode = {
    id: kgNode.id,
    kind,
    label: typeof kgNode.label === 'string' ? kgNode.label : kgNode.id,
    fileId,
  };
  if (anchor) node.anchor = anchor;
  if (typeof kgNode.title === 'string') node.title = kgNode.title;
  if (typeof kgNode.status === 'string') node.status = kgNode.status;

  return node;
}

/**
 * Convert a KGEdge to a GraphEdge.
 * Returns null if from/to are missing.
 */
function coerceEdge(kgEdge: KGEdge): GraphEdge | null {
  if (!kgEdge.from || !kgEdge.to) return null;

  let kind: EdgeKind = 'implements'; // safe fallback
  if (kgEdge.kind && VALID_EDGE_KINDS.has(kgEdge.kind as EdgeKind)) {
    kind = kgEdge.kind as EdgeKind;
  }

  // Preserve the dangling flag (finding #3): KG-sourced edges flagged dangling
  // must keep the flag so the 29.4 orphan/gap view's Dangling References section
  // surfaces KG-sourced gaps (AC3). Without this, the flag was silently dropped.
  return {
    from: kgEdge.from,
    to: kgEdge.to,
    kind,
    ...(kgEdge.dangling === true ? { dangling: true } : {}),
  };
}

/**
 * Tag a scan node with provenance 'scan' (mutates a copy).
 * Non-conflicting KG-only fields from kgNode are merged additively.
 * Returns a new node object (does not mutate the original).
 */
function tagScanNodeWithProvenance(
  scanNode: GraphNode,
  kgNode: GraphNode | null,
): GraphNode {
  if (kgNode === null) {
    // Only in scan — provenance 'scan'
    return { ...scanNode, source: 'scan' as ProvenanceSource };
  }
  // Present in both — scan wins on conflict; KG-only non-conflicting fields preserved additively.
  // Scan-derived fields always take precedence (scan = on-disk truth).
  // We additively merge optional KG fields (title, status) only when the scan didn't produce them.
  const merged: GraphNode = { ...scanNode, source: 'both' as ProvenanceSource };
  // Additive: preserve KG title/status if scan didn't produce them
  if (!merged.title && kgNode.title) merged.title = kgNode.title;
  if (!merged.status && kgNode.status) merged.status = kgNode.status;
  return merged;
}

/**
 * Tag a KG-only node with provenance 'kg'.
 * Returns a new node object (does not mutate the original).
 */
function tagKgOnlyNode(kgNode: GraphNode): GraphNode {
  return { ...kgNode, source: 'kg' as ProvenanceSource };
}

/**
 * Tag a scan edge with provenance, merging with KG edge info if present.
 */
function tagScanEdge(
  scanEdge: GraphEdge,
  kgEdge: GraphEdge | null,
): GraphEdge {
  const source: ProvenanceSource = kgEdge !== null ? 'both' : 'scan';
  return { ...scanEdge, source };
}

/**
 * Tag a KG-only edge with provenance 'kg'.
 */
function tagKgOnlyEdge(kgEdge: GraphEdge): GraphEdge {
  return { ...kgEdge, source: 'kg' as ProvenanceSource };
}

/**
 * Merge scan-derived nodes/edges with knowledge-graph.json, if present.
 *
 * Merge rules (Story 29.5 full hardening):
 *   - When KG absent: return scan nodes/edges as-is (no source field — 29.2 equivalence).
 *   - When KG present:
 *     - Scan nodes/edges tagged 'scan'; nodes also in KG tagged 'both'.
 *     - KG-only nodes/edges appended and tagged 'kg'.
 *     - Scan fields WIN on any conflict (scan = on-disk truth).
 *     - Non-conflicting KG-only fields (title, status) preserved additively on 'both' nodes.
 *   - Identity-stable: no id changes.
 *   - Deterministic: sorted after merge.
 *   - Malformed KG tolerated (guards from 29.2 retained).
 *
 * @param scanNodes  Nodes from the scan graph.
 * @param scanEdges  Edges from the scan graph.
 * @param bmadOutputDir  Absolute path to _bmad-output.
 * @returns Merged, sorted nodes and edges.
 */
export function reconcileWithKgJson(
  scanNodes: GraphNode[],
  scanEdges: GraphEdge[],
  bmadOutputDir: string,
): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const kgJson = readKgJson(bmadOutputDir);

  if (!kgJson) {
    // Absent knowledge-graph.json — scan-only result (identity operation, no source field).
    // This preserves exact 29.2 output for absence-equivalence (AC 3.3 / AC 3).
    return { nodes: scanNodes, edges: scanEdges };
  }

  // Defensive: tolerate a knowledge-graph.json where `nodes`/`edges` is an
  // object (or any non-array) rather than an array (item 8) — never throw.
  const kgNodes = Array.isArray(kgJson.nodes) ? kgJson.nodes : [];
  const kgEdges = Array.isArray(kgJson.edges) ? kgJson.edges : [];

  // A present-but-empty knowledge-graph.json ({} or {nodes:[],edges:[]}) carries no
  // on-disk truth and is semantically equivalent to ABSENT — return the scan-only
  // result unchanged so absence-equivalence (AC 3.3) also holds for the empty case
  // (do not stamp `source:'scan'` on scan nodes for an empty KG).
  if (kgNodes.length === 0 && kgEdges.length === 0) {
    return { nodes: scanNodes, edges: scanEdges };
  }

  // Build a map of KG nodes by id for efficient lookup.
  const kgNodeMap = new Map<string, GraphNode>();
  for (const kgNode of kgNodes) {
    const coerced = coerceNode(kgNode);
    if (!coerced) continue;
    // First KG entry wins for duplicate KG ids (consistent with scan's first-wins strategy).
    if (!kgNodeMap.has(coerced.id)) {
      kgNodeMap.set(coerced.id, coerced);
    }
  }

  // seenIds: scan node ids + KG node ids already merged, so a KG file with
  // DUPLICATE ids does not produce duplicate nodes in the output (item 9).
  const seenIds = new Set<string>();

  // Tag scan nodes with provenance, additively merging KG fields where not conflicting.
  const mergedNodes: GraphNode[] = [];
  for (const scanNode of scanNodes) {
    seenIds.add(scanNode.id);
    const kgCounterpart = kgNodeMap.get(scanNode.id) ?? null;
    mergedNodes.push(tagScanNodeWithProvenance(scanNode, kgCounterpart));
  }

  // Append KG-only nodes (tagged 'kg').
  for (const [id, kgNode] of kgNodeMap) {
    if (seenIds.has(id)) continue; // already merged as 'both'
    seenIds.add(id);
    mergedNodes.push(tagKgOnlyNode(kgNode));
  }

  // Build edge key for deduplication.
  const edgeKey = (e: GraphEdge) => `${e.from}|${e.to}|${e.kind}`;

  // Build KG edge map for provenance lookup (dedup: first wins).
  const kgEdgeMap = new Map<string, GraphEdge>();
  for (const kgEdge of kgEdges) {
    const coerced = coerceEdge(kgEdge);
    if (!coerced) continue;
    const key = edgeKey(coerced);
    if (!kgEdgeMap.has(key)) {
      kgEdgeMap.set(key, coerced);
    }
  }

  const seenEdgeKeys = new Set<string>();

  // Tag scan edges with provenance.
  const mergedEdges: GraphEdge[] = [];
  for (const scanEdge of scanEdges) {
    const key = edgeKey(scanEdge);
    seenEdgeKeys.add(key);
    const kgCounterpart = kgEdgeMap.get(key) ?? null;
    mergedEdges.push(tagScanEdge(scanEdge, kgCounterpart));
  }

  // Append KG-only edges (tagged 'kg').
  for (const [key, kgEdge] of kgEdgeMap) {
    if (seenEdgeKeys.has(key)) continue; // already handled as scan edge
    seenEdgeKeys.add(key);
    mergedEdges.push(tagKgOnlyEdge(kgEdge));
  }

  // Post-reconcile dangling recompute. build.ts::buildEdges flagged scan-edge
  // `dangling` against the SCAN node set only; after merge the node set has changed:
  //   - a KG-only edge to a ghost id was never checked → must now be flagged;
  //   - a scan edge previously dangling may now RESOLVE to a KG-provided node → un-flag.
  // Recompute uniformly against the merged node id set (intentionally-terminal
  // synthetic `version:` targets are never dangling — item 17). Membership-based,
  // so it stays deterministic.
  const mergedNodeIds = new Set(mergedNodes.map(n => n.id));
  for (const e of mergedEdges) {
    const shouldDangle = !mergedNodeIds.has(e.to) && !e.to.startsWith('version:');
    if (shouldDangle) {
      e.dangling = true;
    } else if ('dangling' in e) {
      delete e.dangling;
    }
  }

  // Re-sort after merge (determinism)
  mergedNodes.sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  mergedEdges.sort((a, b) => {
    if (a.from !== b.from) return a.from < b.from ? -1 : 1;
    if (a.to !== b.to) return a.to < b.to ? -1 : 1;
    return a.kind < b.kind ? -1 : a.kind > b.kind ? 1 : 0;
  });

  return { nodes: mergedNodes, edges: mergedEdges };
}
