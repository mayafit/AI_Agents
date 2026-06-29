/**
 * lib/knowledge-atlas/src/graph/reconcile.ts
 * ---------------------------------------------------------------------------
 * Story 29.2 — knowledge-graph.json merge (AC 6).
 *
 * If <bmadOutputDir>/knowledge-graph.json is present, its nodes/edges are read
 * and merged with the scan-derived graph. Scan wins for any field conflict on a
 * node id present in both sources.
 *
 * Full reconciliation hardening (provenance tagging, diff reporting) is Story 29.5.
 * This implementation is additive and identity-stable:
 *   - Nodes/edges only in knowledge-graph.json are kept (provenance-tagged minimally).
 *   - Nodes also in the scan graph: scan fields win for conflict resolution.
 *   - Absent knowledge-graph.json → scan-only manifest (no-op merge).
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
import { GraphNode, GraphEdge, NodeKind, EdgeKind } from '../types.js';

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
  // Only set anchor when the id actually contains a '#' separator
  const anchor = hashIdx >= 0
    ? (kgNode.anchor ?? kgNode.id.slice(hashIdx + 1))
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

  return { from: kgEdge.from, to: kgEdge.to, kind };
}

/**
 * Merge scan-derived nodes/edges with knowledge-graph.json, if present.
 *
 * Merge rules:
 *   - Scan wins: for any node id present in both, scan fields take precedence.
 *   - Additive: nodes/edges only in knowledge-graph.json are appended.
 *   - Identity-stable: no id changes.
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
    // Absent knowledge-graph.json — scan-only result (identity operation)
    return { nodes: scanNodes, edges: scanEdges };
  }

  // Defensive: tolerate a knowledge-graph.json where `nodes`/`edges` is an
  // object (or any non-array) rather than an array (item 8) — never throw.
  const kgNodes = Array.isArray(kgJson.nodes) ? kgJson.nodes : [];
  const kgEdges = Array.isArray(kgJson.edges) ? kgJson.edges : [];

  // seenIds: scan node ids + KG node ids already merged, so a KG file with
  // DUPLICATE ids does not produce duplicate nodes in the output (item 9).
  const seenIds = new Set(scanNodes.map(n => n.id));

  // Merge nodes: start with scan nodes, append KG-only nodes (first wins).
  const mergedNodes = [...scanNodes];
  for (const kgNode of kgNodes) {
    const coerced = coerceNode(kgNode);
    if (!coerced) continue;
    if (seenIds.has(coerced.id)) continue; // scan wins / dedup KG dupes — skip
    seenIds.add(coerced.id);
    mergedNodes.push(coerced);
  }

  // Build edge dedup key. seenEdgeKeys is seeded from scan edges AND grows as KG
  // edges are added, so duplicate KG edges are also de-duplicated (item 9).
  const edgeKey = (e: GraphEdge) => `${e.from}|${e.to}|${e.kind}`;
  const seenEdgeKeys = new Set(scanEdges.map(edgeKey));

  // Merge edges: start with scan edges, append KG-only edges.
  const mergedEdges = [...scanEdges];
  for (const kgEdge of kgEdges) {
    const coerced = coerceEdge(kgEdge);
    if (!coerced) continue;
    const key = edgeKey(coerced);
    if (seenEdgeKeys.has(key)) continue; // scan wins / dedup KG dupes — skip
    seenEdgeKeys.add(key);
    mergedEdges.push(coerced);
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
