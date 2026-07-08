/**
 * lib/knowledge-atlas/src/render/document.ts
 * ---------------------------------------------------------------------------
 * Story 29.3 — Document page renderer for the Knowledge Atlas.
 *
 * Renders a single FileRecord into a complete HTML page.
 *
 * Features:
 *   - Reads markdown from disk, parses with markdown-it
 *   - Renders a TOC from headings (using headingToSlug for anchors)
 *   - Applies status badges from file's statuses
 *   - Applies linkifyHtml to rendered content
 *   - Applies sanitizeHtml to rendered content
 *   - Renders authored ```mermaid fences (see mermaid strategy below)
 *   - Shows backlinks ("Referenced by") for entity nodes in this file
 *   - Wraps in pageShell (baseHref "../" — doc pages live under docs/)
 *
 * mermaid strategy (v1 — accepted deviation from "render WITH mermaid"):
 *   Authored ```mermaid fences are rendered as a self-contained, styled
 *   PLAIN-TEXT figure (`.mermaid-block` → `<pre class="mermaid-fallback">`),
 *   which is the story's explicitly-permitted plain-text fallback. No mermaid
 *   runtime is bundled or referenced: shipping the ~3.5MB mermaid v11 ESM
 *   browser bundle into the drift-guarded atlas.cjs (or as an asset) for a
 *   feature no fixture exercises would violate the zero-dependency-first /
 *   "heavy libs only where needed" invariant. Consequences: NO CDN, NO
 *   <script src>, NO asset copy, NO client init — the diagram SOURCE is always
 *   legible (no blank screen). Doc pages therefore emit zero JS. If full
 *   client-side mermaid is later required, vendor it at build time the same way
 *   lunr is (build-atlas.js injecting a global string). See story Dev Notes.
 */

import * as fs from 'fs';
import * as path from 'path';
import MarkdownIt from 'markdown-it';
import { headingToSlug } from '../extract/slug.js';
import { pageShell } from './layout.js';
import type { NavFlags } from './layout.js';
import { gatherBacklinks, renderBacklinksHtml } from './backlinks.js';
import { linkifyHtml, sanitizeHtml, rewriteAuthoredLinks } from './linkify.js';
import { resolveSlug } from './paths.js';
import type { FileRecord, KnowledgeManifest, GraphNode } from '../types.js';

// ---------------------------------------------------------------------------
// markdown-it setup
// ---------------------------------------------------------------------------

const md = new MarkdownIt({
  html:        true,
  linkify:     true,
  typographer: false,
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Get the human-readable name for a file path (last segment, minus extension). */
function fileTitle(filePath: string): string {
  const base = filePath.split('/').pop() ?? filePath;
  return base.replace(/\.(md|yaml|json)$/i, '');
}

// ---------------------------------------------------------------------------
// Status badge rendering
// ---------------------------------------------------------------------------

function renderStatusBadges(statuses: string[]): string {
  if (!statuses || statuses.length === 0) return '';
  return statuses.map(s => {
    const cls = `status-pill status-${s.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
    return `<span class="${esc(cls)}">${esc(s)}</span>`;
  }).join(' ');
}

// ---------------------------------------------------------------------------
// TOC extraction from markdown
// ---------------------------------------------------------------------------

interface TocEntry {
  level: number;
  text: string;
  slug: string;
}

function extractToc(markdownContent: string): TocEntry[] {
  const entries: TocEntry[] = [];
  const headingRe = /^(#{1,6})\s+(.+)$/gm;
  let m: RegExpExecArray | null;
  while ((m = headingRe.exec(markdownContent)) !== null) {
    const level = m[1].length;
    const raw = m[2].trim();
    // The heading id emitted by addHeadingAnchors is derived from the RENDERED
    // heading with HTML tags stripped — i.e. inline code KEEPS its text (only
    // the `backticks`/tags are gone). Mirror that here so the TOC slug matches
    // the heading id (strip only the backtick delimiters, keep the code text).
    const forSlug = raw.replace(/`+/g, '');
    const text = forSlug; // display text without backtick delimiters
    const slug = headingToSlug(forSlug);
    if (slug) {
      entries.push({ level, text, slug });
    }
  }
  return entries;
}

function renderToc(entries: TocEntry[]): string {
  if (entries.length < 3) return ''; // skip trivial TOCs

  const items = entries.map(e => {
    const indent = '  '.repeat(Math.max(0, e.level - 1));
    return `${indent}<li><a href="#${esc(e.slug)}">${esc(e.text)}</a></li>`;
  });

  return [
    '<nav class="toc" aria-label="Table of contents">',
    '<div class="toc-title">Contents</div>',
    '<ol>',
    ...items,
    '</ol>',
    '</nav>',
  ].join('\n');
}

// ---------------------------------------------------------------------------
// Mermaid fence processing
// ---------------------------------------------------------------------------

/**
 * Render authored ```mermaid fences (AC 1). markdown-it renders them as
 *   <pre><code class="language-mermaid">...</code></pre>
 *
 * Mermaid is rendered as a self-contained, vendored-locally figure: the diagram
 * source is shown as a styled plain-text block (the explicitly-permitted
 * plain-text fallback). This honors the sealed-packaging invariant (no CDN, no
 * fetch, no megabyte runtime to bloat the committed bundle for a feature no
 * fixture exercises) AND progressive enhancement (the diagram source is always
 * legible, never a blank screen). The `.mermaid` div retains the verbatim
 * definition so a future client-side enhancer could upgrade it in place.
 */
function processMermaidFences(html: string): { html: string; hasMermaid: boolean } {
  let hasMermaid = false;

  const fenceRe = /<pre><code class="language-mermaid">([\s\S]*?)<\/code><\/pre>/gi;
  const result = html.replace(fenceRe, (_match, codeContent: string) => {
    hasMermaid = true;
    // codeContent is already HTML-entity-encoded by markdown-it; keep it encoded
    // (safe) and present it verbatim inside a labelled figure.
    return [
      '<figure class="mermaid-block" aria-label="Mermaid diagram">',
      '<figcaption class="mermaid-note">Mermaid diagram (source)</figcaption>',
      `<div class="mermaid"><pre class="mermaid-fallback">${codeContent.trim()}</pre></div>`,
      '</figure>',
    ].join('\n');
  });

  return { html: result, hasMermaid };
}

// ---------------------------------------------------------------------------
// Add heading anchors to the rendered HTML
// ---------------------------------------------------------------------------

function addHeadingAnchors(html: string): string {
  return html.replace(/<(h[1-6])>(.*?)<\/h[1-6]>/gi, (_match, tag: string, content: string) => {
    // Strip tags from content to get plain text for slug
    const plainText = content.replace(/<[^>]*>/g, '');
    const slug = headingToSlug(plainText);
    if (!slug) return _match;
    return `<${tag} id="${esc(slug)}">${content}</${tag}>`;
  });
}

// ---------------------------------------------------------------------------
// Get all nodes for a given file
// ---------------------------------------------------------------------------

function getFileNodes(fileId: string, nodes: GraphNode[]): GraphNode[] {
  return nodes.filter(n => n.fileId === fileId);
}

// ---------------------------------------------------------------------------
// renderDocumentPage
// ---------------------------------------------------------------------------

/**
 * Render a complete HTML page for a single FileRecord.
 *
 * @param fileRec      The file record from the manifest.
 * @param manifest     The full knowledge manifest.
 * @param projectRoot  Absolute path to the project root (to read markdown files).
 * @param navFlags     Which 29.4 pages (graph/diagrams/orphans) exist in this
 *                      build, so the shared nav can link to them (SHOULD-FIX #2).
 * @param resolveAbsPath  Story 29.7 — optional fileId → absolute-path resolver.
 *                      A file scanned from a knowledge source OUTSIDE
 *                      `projectRoot` has a fileId of the form
 *                      `<source-basename>/<relPath>`, which is NOT joinable
 *                      with `projectRoot` to recover its real location. When
 *                      provided (generate.ts always provides it, built from
 *                      the current scan), it is consulted first; falling back
 *                      to `path.join(projectRoot, fileRec.path)` — the
 *                      historical behavior — when it returns nothing, so
 *                      callers that never pass it (e.g. direct unit use) are
 *                      unaffected.
 * @returns `{ html, articleText }` — the full page HTML plus the plain-text of
 *          JUST the rendered article body (no nav/footer/TOC/status chrome), so
 *          the search index reflects document content, not shell boilerplate.
 */
export interface RenderedDocument {
  /** Full self-contained HTML page. */
  html: string;
  /** Plain-text of the rendered article body only (for the search index). */
  articleText: string;
}

export function renderDocumentPage(
  fileRec: FileRecord,
  manifest: KnowledgeManifest,
  projectRoot: string,
  navFlags?: NavFlags,
  resolveAbsPath?: (fileId: string) => string | undefined,
): RenderedDocument {
  const absPath = resolveAbsPath?.(fileRec.path) ?? path.join(projectRoot, fileRec.path);
  const title = fileTitle(fileRec.path);

  // Read markdown content
  let rawContent = '';
  try {
    rawContent = fs.readFileSync(absPath, 'utf-8');
    // Normalize CRLF
    rawContent = rawContent.replace(/\r\n/g, '\n');
  } catch {
    rawContent = `# ${title}\n\n*(File not found: ${fileRec.path})*\n`;
  }

  // Strip frontmatter for rendering (---...--- block at top)
  let markdownContent = rawContent;
  if (rawContent.startsWith('---\n')) {
    const endFm = rawContent.indexOf('\n---\n', 4);
    if (endFm !== -1) {
      markdownContent = rawContent.slice(endFm + 5); // skip past closing ---
    }
  }

  // Extract TOC entries from raw markdown (before HTML rendering)
  const tocEntries = extractToc(markdownContent);

  // Render markdown to HTML
  let renderedHtml = md.render(markdownContent);

  // Add heading anchors for in-page navigation
  renderedHtml = addHeadingAnchors(renderedHtml);

  // Process mermaid fences (rendered as a self-contained plain-text figure)
  const { html: mermaidHtml } = processMermaidFences(renderedHtml);
  renderedHtml = mermaidHtml;

  // Rewrite AUTHORED relative markdown cross-links (e.g. `[x](roadmap.md)`)
  // to the RENDERED sibling doc page — bug fix (see render/linkify.ts for
  // the full writeup). Must run before linkifyHtml/sanitizeHtml so the
  // resolved href is what the safe-URL allowlist evaluates.
  renderedHtml = rewriteAuthoredLinks(renderedHtml, manifest, fileRec.path);

  // Linkify entity tokens (now that HTML structure is stable)
  renderedHtml = linkifyHtml(renderedHtml, manifest, fileRec.path);

  // Sanitize HTML
  renderedHtml = sanitizeHtml(renderedHtml);

  // Gather and render backlinks for all nodes in this file. Backlinks are
  // rendered on THIS doc page, whose real site-root-relative path is
  // docs/<resolvedSlug>.html — use the SAME slug the page writer used so
  // hrefToNode's relative-path math is correct (no spurious ../../).
  const fileIds = manifest.files.map(f => f.path);
  const fromRel = `docs/${resolveSlug(fileRec.path, fileIds)}.html`;
  const fileNodes = getFileNodes(fileRec.path, manifest.nodes);
  let backlinksHtml = '';
  for (const node of fileNodes) {
    const bl = gatherBacklinks(node.id, manifest.edges, manifest.nodes);
    backlinksHtml += renderBacklinksHtml(bl, manifest, fromRel);
  }

  // Render TOC
  const tocHtml = renderToc(tocEntries);

  // Status badges
  const statusBadgesHtml = renderStatusBadges(fileRec.statuses);

  // Entity anchor targets (AC 2): each node defined in THIS file has a canonical
  // id of `fileId#anchor`. Some anchors come from headings (already emitted as
  // heading ids above), but entity-token anchors (e.g. `story-1-1`) may not map
  // to a heading slug (`story-11-oauth2-integration`). We emit an invisible
  // anchor target for every file node whose anchor is not already a heading id,
  // so every cross-link `…#anchor` resolves to a real location on the page.
  const existingIds = new Set<string>();
  for (const m of renderedHtml.matchAll(/\sid="([^"]+)"/g)) existingIds.add(m[1]!);
  const anchorTargets: string[] = [];
  for (const node of fileNodes) {
    if (node.anchor && !existingIds.has(node.anchor)) {
      anchorTargets.push(`<span class="entity-anchor" id="${esc(node.anchor)}"></span>`);
      existingIds.add(node.anchor);
    }
  }
  const anchorTargetsHtml = anchorTargets.join('\n');

  // Back link
  const backLinkHtml = '<a class="back-link" href="../index.html">&larr; Back to Home</a>';

  // Build the page body
  const pageBody = [
    '<div class="content-wrap">',
    backLinkHtml,
    '<article class="doc-body">',
    statusBadgesHtml ? `<div class="doc-statuses" style="margin-bottom:0.75rem">${statusBadgesHtml}</div>` : '',
    anchorTargetsHtml,
    tocHtml,
    renderedHtml,
    backlinksHtml,
    '</article>',
    '</div>',
  ].filter(Boolean).join('\n');

  // Reading views require zero JS — mermaid is rendered as a plain-text figure
  // and all links are static HTML (progressive-enhancement baseline, AC 7).
  // Doc pages live under docs/, so nav/search links need a "../" baseHref.
  const html = pageShell({
    title,
    body: pageBody,
    manifest,
    pageType: 'document',
    baseHref: '../',
    navFlags,
  });

  // Article-only plain text for the search index (SF-1): strip tags from the
  // rendered document body, NOT the whole page — so nav/footer/TOC/status
  // boilerplate ("Knowledge Atlas", etc.) never pollutes search results.
  const articleText = `${title} ${renderedHtml}`
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return { html, articleText };
}
