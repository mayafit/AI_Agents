/**
 * lib/knowledge-atlas/src/render/backlinks.ts
 * ---------------------------------------------------------------------------
 * Story 29.3 — Backlink gathering and rendering for the Knowledge Atlas.
 *
 * Provides:
 *   gatherBacklinks() — find all edges pointing TO a given node
 *   renderBacklinksHtml() — render a "Referenced by" section with links
 */

import type { GraphEdge, GraphNode, KnowledgeManifest } from '../types.js';
import { hrefToNode } from './paths.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BacklinkRef {
  /** Node ID of the source (the `from` side of the edge). */
  fromId: string;
  /** Human-readable label of the source node. */
  fromLabel: string;
  /** File ID containing the source node. */
  fromFileId: string;
  /** Optional anchor within the source file. */
  fromAnchor?: string;
  /** Edge kind (e.g., 'implements', 'depends-on'). */
  kind: string;
  /**
   * True if the source node was NOT found in the graph (dangling edge). Such a
   * backlink has no rendered page and must be shown non-clickable so it does not
   * link to a 404.
   */
  dangling?: boolean;
}

// ---------------------------------------------------------------------------
// gatherBacklinks
// ---------------------------------------------------------------------------

/**
 * Find all edges where `edge.to === nodeId` and return BacklinkRef objects
 * describing the source nodes.
 *
 * Dangling edges (where the source node is not found in `nodes`) are included
 * with a fallback label derived from the edge `from` id.
 */
export function gatherBacklinks(
  nodeId: string,
  edges: GraphEdge[],
  nodes: GraphNode[],
): BacklinkRef[] {
  const nodeMap = new Map<string, GraphNode>(nodes.map(n => [n.id, n]));
  const refs: BacklinkRef[] = [];

  for (const edge of edges) {
    if (edge.to !== nodeId) continue;
    // A node never "references itself" — skip self-edges so it isn't listed as
    // its own backlink.
    if (edge.from === nodeId) continue;

    const srcNode = nodeMap.get(edge.from);
    if (srcNode) {
      refs.push({
        fromId:      srcNode.id,
        fromLabel:   srcNode.label,
        fromFileId:  srcNode.fileId,
        fromAnchor:  srcNode.anchor,
        kind:        edge.kind,
      });
    } else {
      // Dangling source — no graph node (and thus no rendered page). Record it
      // as dangling so the renderer shows it non-clickable (never a 404 link).
      const parts = edge.from.split('#');
      refs.push({
        fromId:     edge.from,
        fromLabel:  edge.from,
        fromFileId: parts[0] ?? edge.from,
        fromAnchor: parts[1],
        kind:       edge.kind,
        dangling:   true,
      });
    }
  }

  // Deduplicate by fromId + kind, then sort for determinism
  const seen = new Set<string>();
  const deduped: BacklinkRef[] = [];
  for (const ref of refs) {
    const key = `${ref.fromId}::${ref.kind}`;
    if (!seen.has(key)) {
      seen.add(key);
      deduped.push(ref);
    }
  }

  deduped.sort((a, b) => {
    if (a.fromId < b.fromId) return -1;
    if (a.fromId > b.fromId) return 1;
    if (a.kind < b.kind) return -1;
    if (a.kind > b.kind) return 1;
    return 0;
  });

  return deduped;
}

// ---------------------------------------------------------------------------
// renderBacklinksHtml
// ---------------------------------------------------------------------------

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Render a "Referenced by" section listing all backlinks to a node.
 * Returns an empty string if there are no backlinks.
 *
 * @param backlinks  Resolved backlink refs (from gatherBacklinks).
 * @param manifest   The manifest (for path resolution).
 * @param fromRel    Site-root-relative path of the page this renders on
 *                   (e.g. "docs/prd.html"), so sibling-doc hrefs resolve.
 */
export function renderBacklinksHtml(
  backlinks: BacklinkRef[],
  manifest: KnowledgeManifest,
  fromRel = 'docs/page.html',
): string {
  if (backlinks.length === 0) return '';

  // A source is only clickable if it has a rendered doc page (its fileId is a
  // scanned document AND it isn't a dangling edge). Others render as plain,
  // non-clickable text so we never emit a link to a non-existent page.
  const docFileIds = new Set(manifest.files.map(f => f.path));

  const items = backlinks.map(ref => {
    const label = esc(ref.fromLabel);
    const kind = esc(ref.kind);
    const linkable = !ref.dangling && docFileIds.has(ref.fromFileId);
    if (!linkable) {
      return `<li><span class="backlink-dangling" aria-disabled="true">${label}</span> <span class="result-kind">${kind}</span></li>`;
    }
    const href = hrefToNode(fromRel, ref.fromFileId, ref.fromAnchor, manifest);
    return `<li><a href="${esc(href)}">${label}</a> <span class="result-kind">${kind}</span></li>`;
  });

  return [
    '<section class="backlinks-section" aria-label="Backlinks">',
    '<h3>Referenced by</h3>',
    '<ul class="backlinks-list">',
    ...items,
    '</ul>',
    '</section>',
  ].join('\n');
}
