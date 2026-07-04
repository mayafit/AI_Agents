/**
 * lib/knowledge-atlas/src/render/linkify.ts
 * ---------------------------------------------------------------------------
 * Story 29.3 — HTML linkification and sanitization for Knowledge Atlas.
 *
 * Provides:
 *   linkifyHtml()   — turn entity tokens in HTML text into hyperlinks
 *   sanitizeHtml()  — strip dangerous HTML from rendered markdown output
 */

import type { KnowledgeManifest } from '../types.js';
import { filePathToSlug, buildSlugMap } from './paths.js';

// ---------------------------------------------------------------------------
// Entity token patterns
// Entity tokens that should be recognized and linked.
// ---------------------------------------------------------------------------

const ENTITY_PATTERNS: RegExp[] = [
  /\bNFR\d+\b/g,                        // NFR62, NFR12, etc.
  /\bFR\d+\b/g,                         // FR101, FR202
  /\bF\d+\b/g,                          // F1, F2 (capability)
  /\bEpic\s+\d+\b/g,                    // Epic 1, Epic 12
  /\bStory\s+\d+\.\d+\b/g,             // Story 1.2, Story 12.5
  /\bbug-[\w-]+\b/g,                    // bug-null-pointer
  /\bP\d+-\d+\b/g,                      // P5-7, P3-1
  /\b\d+-\d+-[\w-]+\b/g,               // 1-1-oauth2-integration
  /\bepic-\d+-retrospective\b/g,       // epic-1-retrospective
];

// Combined pattern for fast scanning (union of all above, without /g)
const COMBINED_PATTERN = new RegExp(
  ENTITY_PATTERNS.map(r => r.source).join('|'),
  'g',
);

// ---------------------------------------------------------------------------
// HTML tag parser (minimal — enough to skip code/pre/a contexts)
// ---------------------------------------------------------------------------

/**
 * Parse HTML into a list of segments: either raw tags or text content.
 * We walk the string and split at < > boundaries.
 */
interface HtmlSegment {
  type: 'tag' | 'text';
  value: string;
}

function parseHtmlSegments(html: string): HtmlSegment[] {
  const segments: HtmlSegment[] = [];
  let i = 0;

  while (i < html.length) {
    const tagStart = html.indexOf('<', i);
    if (tagStart === -1) {
      // Remaining is text
      if (i < html.length) {
        segments.push({ type: 'text', value: html.slice(i) });
      }
      break;
    }
    if (tagStart > i) {
      segments.push({ type: 'text', value: html.slice(i, tagStart) });
    }
    const tagEnd = html.indexOf('>', tagStart);
    if (tagEnd === -1) {
      // Unclosed tag — treat rest as text
      segments.push({ type: 'text', value: html.slice(tagStart) });
      break;
    }
    segments.push({ type: 'tag', value: html.slice(tagStart, tagEnd + 1) });
    i = tagEnd + 1;
  }

  return segments;
}

// ---------------------------------------------------------------------------
// linkifyHtml
// ---------------------------------------------------------------------------

/**
 * Build a relative URL from a document page (docs/slug.html) to a target.
 * All doc pages live under docs/, so relative links back up one level with ../
 * when linking to the same docs/ dir.
 */
function resolveHref(
  targetFileId: string,
  targetAnchor: string | undefined,
  currentFileId: string,
  slugMap: Map<string, string>,
): string {
  const targetSlug = slugMap.get(targetFileId) ?? filePathToSlug(targetFileId);
  const currentSlug = slugMap.get(currentFileId) ?? filePathToSlug(currentFileId);
  const anchor = targetAnchor ? `#${targetAnchor}` : '';

  if (targetSlug === currentSlug) {
    // Same page — just use the anchor
    return anchor || '#';
  }

  // Both are under docs/ — relative link within same dir
  return `${targetSlug}.html${anchor}`;
}

/**
 * Try to find a node in the manifest that matches the given token string.
 * Checks label equality (case-insensitive) and node-id slug match.
 *
 * A target is only linkable if its `fileId` is one of the scanned documents
 * (i.e. a page actually written under docs/). Knowledge-graph-only nodes whose
 * fileId has no rendered page (e.g. `legacy-source`) are NOT linked — otherwise
 * the link would 404 against a non-existent page.
 */
function resolveToken(
  token: string,
  manifest: KnowledgeManifest,
  docFileIds: Set<string>,
): { fileId: string; anchor?: string } | null {
  const lower = token.toLowerCase().trim();

  // Exact label match (case-insensitive), restricted to real doc pages.
  for (const node of manifest.nodes) {
    if (node.label.toLowerCase() === lower && docFileIds.has(node.fileId)) {
      return { fileId: node.fileId, anchor: node.anchor };
    }
  }

  // Fall back to an entity-slug match on the node id, still doc-page-restricted.
  const tokenSlug = lower.replace(/\s+/g, '-').replace(/\./g, '-');
  for (const node of manifest.nodes) {
    if (!docFileIds.has(node.fileId)) continue;
    const idLower = node.id.toLowerCase();
    if (idLower.endsWith(`#${tokenSlug}`) || idLower.includes(`#${tokenSlug}`)) {
      return { fileId: node.fileId, anchor: node.anchor };
    }
  }

  return null;
}

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Walk HTML segments and linkify entity tokens in text nodes that are not
 * inside <code>, <pre>, or existing <a> tags.
 *
 * Skips tokens that are already linked (inside <a>).
 */
export function linkifyHtml(
  html: string,
  manifest: KnowledgeManifest,
  currentFileId: string,
): string {
  if (!html || manifest.nodes.length === 0) return html;

  // Only nodes whose fileId is a rendered document page are linkable.
  const docFileIds = new Set(manifest.files.map(f => f.path));
  // Collision-free slug map — identical to the page writer's, so links resolve.
  const slugMap = buildSlugMap(manifest.files.map(f => f.path));

  const segments = parseHtmlSegments(html);
  let inCode = 0;
  let inPre = 0;
  let inA = 0;
  const parts: string[] = [];

  for (const seg of segments) {
    if (seg.type === 'tag') {
      const tagLower = seg.value.toLowerCase();
      // Track nesting
      if (/^<code(\s|>)/i.test(seg.value)) inCode++;
      else if (/^<\/code\s*>/i.test(seg.value)) inCode = Math.max(0, inCode - 1);
      else if (/^<pre(\s|>)/i.test(seg.value)) inPre++;
      else if (/^<\/pre\s*>/i.test(seg.value)) inPre = Math.max(0, inPre - 1);
      else if (/^<a(\s|>)/i.test(seg.value)) inA++;
      else if (/^<\/a\s*>/i.test(seg.value)) inA = Math.max(0, inA - 1);
      // Suppress unused variable warning
      void tagLower;
      parts.push(seg.value);
    } else {
      // Text node
      if (inCode > 0 || inPre > 0 || inA > 0) {
        // Don't linkify inside code/pre/a
        parts.push(seg.value);
      } else {
        // Linkify entity tokens
        parts.push(linkifyText(seg.value, manifest, currentFileId, docFileIds, slugMap));
      }
    }
  }

  return parts.join('');
}

/**
 * Linkify entity tokens within a plain text string.
 */
function linkifyText(
  text: string,
  manifest: KnowledgeManifest,
  currentFileId: string,
  docFileIds: Set<string>,
  slugMap: Map<string, string>,
): string {
  // Reset lastIndex for the combined pattern
  COMBINED_PATTERN.lastIndex = 0;
  let result = '';
  let last = 0;
  let match: RegExpExecArray | null;

  while ((match = COMBINED_PATTERN.exec(text)) !== null) {
    const token = match[0];
    const start = match.index;

    // Append text before this match
    result += text.slice(last, start);
    last = start + token.length;

    // Try to resolve this token to a node
    const resolved = resolveToken(token, manifest, docFileIds);
    if (resolved) {
      const href = resolveHref(resolved.fileId, resolved.anchor, currentFileId, slugMap);
      result += `<a href="${esc(href)}" class="entity-link">${esc(token)}</a>`;
    } else {
      // No match — leave as-is
      result += token;
    }
  }

  // Append remaining text
  result += text.slice(last);
  return result;
}

// ---------------------------------------------------------------------------
// sanitizeHtml
// ---------------------------------------------------------------------------

/** Tag names allowed in output HTML. Everything else is stripped (tags only, content kept). */
const ALLOWED_TAGS = new Set([
  'p', 'a', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'ul', 'ol', 'li', 'blockquote', 'code', 'pre',
  'em', 'strong', 'b', 'i', 'u', 's', 'del', 'ins', 'mark',
  'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td',
  'hr', 'br',
  'div', 'span', 'section', 'article', 'nav', 'header', 'footer',
  'figure', 'figcaption', 'img', 'picture', 'source',
  'details', 'summary',
  'abbr', 'cite', 'q', 'sub', 'sup', 'kbd', 'samp', 'var',
  'dl', 'dt', 'dd',
]);

/** Dangerous tags whose content must also be removed. */
const CONTENT_REMOVAL_TAGS = new Set([
  'script', 'style', 'iframe', 'object', 'embed',
  'form', 'input', 'button', 'select', 'textarea', 'label',
  'link', 'meta', 'base',
]);

/**
 * Decode HTML character references and strip URL-parser-ignored whitespace,
 * mirroring what the BROWSER does when it HTML-decodes an attribute value
 * before parsing it as a URL. Used ONLY to detect the true scheme for the
 * allowlist test below — the original (still-encoded) attribute text is what
 * gets emitted to output; we never rewrite the href itself here.
 *
 * MUST-FIX #1 (stored XSS): the previous `isSafeUrl` tested the RAW attribute
 * text, but the browser HTML-decodes entities AFTER sanitization runs and
 * before it navigates. Two independent bypasses existed:
 *   1. `javascript&#58;alert(1)` has no literal ':' pre-decode, so the old
 *      code's `colon === -1` branch treated it as a schemeless relative path.
 *   2. `jav&#x09;ascript:alert(1)` contains a literal '#' inside the numeric
 *      reference `&#x09;` itself — the old "':' precedes a '/','?','#' → it's
 *      a path colon, not a scheme colon" heuristic saw that '#' and matched
 *      the colon-is-in-a-path branch, waving through an actual scheme colon.
 * Decoding entities (and stripping the tab/newline/control noise browsers
 * also discard mid-URL) BEFORE running the heuristics closes both: the probe
 * now sees exactly the string the browser will act on.
 */
function decodeForSchemeProbe(value: string): string {
  return value
    // Hex numeric refs: &#x6a; / &#X6A (trailing ';' optional per the HTML
    // spec's legacy numeric-reference parsing).
    .replace(/&#x([0-9a-f]+);?/gi, (_m, hex: string) => {
      const code = parseInt(hex, 16);
      return Number.isFinite(code) ? String.fromCodePoint(code) : '';
    })
    // Decimal numeric refs: &#58; / &#58
    .replace(/&#(\d+);?/g, (_m, dec: string) => {
      const code = parseInt(dec, 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : '';
    })
    // The few NAMED character references that can reassemble a scheme-
    // relevant character (colon, or whitespace the URL parser discards).
    .replace(/&colon;/gi, ':')
    .replace(/&tab;/gi, '\t')
    .replace(/&newline;/gi, '\n')
    // Any other named reference (&amp; &nbsp; etc.) is dropped — it cannot
    // reconstruct a dangerous scheme, since the only characters a URL parser
    // treats specially (colon, tab/CR/LF, C0 controls, space) are already
    // decoded above or stripped below.
    .replace(/&[a-z][a-z0-9]*;/gi, '')
    // Browsers ignore ASCII tab/newline/CR anywhere in a URL and strip
    // leading/trailing C0 controls + space before scheme detection. Removing
    // all C0 controls/space/tab/newline everywhere is a superset of that and
    // can only make the probe MORE conservative (never hides a real scheme).
    .replace(/[\x00-\x20]+/g, '')
    .toLowerCase();
}

/**
 * Allowlist test for href/src/action values. Returns true ONLY for URLs that
 * cannot execute script: relative paths (`./x`, `../x`, `x`, `/x`), in-page
 * anchors (`#x`), query-only (`?x`), and the mailto:/tel: schemes. Any value
 * whose first URL delimiter is a `:` (i.e. an explicit scheme other than the
 * two allowed) is rejected — this blocks javascript:, vbscript:, data:, file:,
 * and any future executable scheme without a denylist to maintain.
 *
 * The scheme test runs against the ENTITY-DECODED probe (see
 * decodeForSchemeProbe above), not the raw attribute text, so an
 * HTML-entity-obfuscated scheme cannot slip past the allowlist.
 */
function isSafeUrl(value: string): boolean {
  const raw = value.trim();
  if (raw === '') return true; // empty href/src — harmless, keep as-is

  const v = decodeForSchemeProbe(raw);
  if (v === '') return true;

  // Relative / anchor / query forms never carry a scheme.
  if (/^[.\/#?]/.test(v)) return true;
  // A scheme is text before the first ':' that precedes any '/', '?', or '#'.
  const colon = v.indexOf(':');
  if (colon === -1) return true; // no scheme → relative path
  const slash = v.search(/[/?#]/);
  if (slash !== -1 && slash < colon) return true; // ':' is in a path segment, not a scheme
  const scheme = v.slice(0, colon);
  return scheme === 'mailto' || scheme === 'tel';
}

/**
 * Sanitize HTML from rendered markdown output.
 * - Removes <script>, <iframe>, <object>, <embed>, <form> and their content
 * - Removes on* event handler attributes
 * - Removes javascript: href/src values
 * - Strips unknown tags (but keeps their text content)
 * - Keeps safe tags with safe attributes
 */
export function sanitizeHtml(html: string): string {
  if (!html) return html;

  // Step 0: Strip HTML comments entirely, content included (NICE-TO-HAVE #5).
  // Comments are a known mutation-XSS surface (parser disagreements on how a
  // comment interacts with surrounding markup on re-parse/innerHTML), and
  // authored/rendered doc content has no legitimate need for them to survive
  // into the shipped page. Runs before all other steps.
  let result = html.replace(/<!--[\s\S]*?-->/g, '');

  // Step 1: Remove content-removal tags and their inner content
  for (const tag of CONTENT_REMOVAL_TAGS) {
    // Remove both self-closing and paired tags with content
    // Use a non-greedy match to handle multiple occurrences
    const openRe = new RegExp(`<${tag}(?:\\s[^>]*)?>[\\s\\S]*?<\\/${tag}\\s*>`, 'gi');
    const selfRe = new RegExp(`<${tag}(?:\\s[^>]*)?\\/?>`, 'gi');
    result = result.replace(openRe, '');
    result = result.replace(selfRe, '');
  }

  // Step 2: Process remaining tags
  result = result.replace(/<(!?\/?[\w:-]+)([^>]*)>/g, (fullMatch, tagName: string, attrs: string) => {
    // Real `<!-- ... -->` comments are already stripped in Step 0. Anything
    // still matching `!...` here is a non-comment bang construct (e.g. a
    // stray `<!DOCTYPE>` or an unterminated `<!--` with no closing `-->`) —
    // pass it through unchanged; it carries no executable attribute surface.
    if (tagName.startsWith('!')) return fullMatch;

    const lcTag = tagName.toLowerCase().replace(/^\//, '');
    const isClosing = tagName.startsWith('/');

    // Already removed content-removal tags above, but belt+suspenders
    if (CONTENT_REMOVAL_TAGS.has(lcTag)) return '';

    if (!ALLOWED_TAGS.has(lcTag)) {
      // Strip the tag, keep content (return empty string for tag only)
      return '';
    }

    if (isClosing) {
      return `</${lcTag}>`;
    }

    // Sanitize attributes
    const safeAttrs = sanitizeAttributes(lcTag, attrs);
    return safeAttrs ? `<${lcTag} ${safeAttrs}>` : `<${lcTag}>`;
  });

  return result;
}

/**
 * Sanitize the attribute string for a given tag.
 * Returns a sanitized attribute string (may be empty).
 */
function sanitizeAttributes(tag: string, attrString: string): string {
  const safeAttrs: string[] = [];

  // Parse individual attributes with a regex
  const attrRe = /\s+([\w:-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|(\S+)))?/g;
  let m: RegExpExecArray | null;

  while ((m = attrRe.exec(attrString)) !== null) {
    const attrName = (m[1] ?? '').toLowerCase();
    const attrValue = m[2] ?? m[3] ?? m[4] ?? '';

    // Remove on* event handlers
    if (/^on/i.test(attrName)) continue;

    // Check href/src/action values (NFR64 — document content is never
    // executed; no browser carve-out). Use a strict ALLOWLIST rather than a
    // denylist so novel executable schemes (vbscript:, data:, javascript:,
    // etc.) can never slip through: permit only relative paths, in-page
    // anchors, and mailto:/tel: links.
    if (attrName === 'href' || attrName === 'src' || attrName === 'action') {
      if (!isSafeUrl(attrValue.trim())) continue;
    }

    // img-specific: allow safe attrs only
    if (tag === 'img') {
      const imgAllowed = new Set(['src', 'alt', 'width', 'height', 'loading', 'decoding', 'title', 'class', 'id']);
      if (!imgAllowed.has(attrName)) continue;
    }

    // a-specific: allow safe attrs only
    if (tag === 'a') {
      const aAllowed = new Set(['href', 'title', 'class', 'id', 'aria-label', 'aria-describedby', 'target', 'rel']);
      if (!aAllowed.has(attrName)) continue;
      // Force rel="noopener" for external target="_blank"
      if (attrName === 'target' && attrValue === '_blank') {
        safeAttrs.push('rel="noopener noreferrer"');
      }
    }

    // General allowed attributes (class, id, aria-*, data-*, role, lang, dir, etc.)
    const generalAllowed = /^(class|id|role|lang|dir|title|aria-[\w-]+|data-[\w-]+|type|colspan|rowspan|scope|align|valign|width|height|alt|loading|decoding)$/;
    if (!generalAllowed.test(attrName) && tag !== 'img' && tag !== 'a') {
      // For non-img/a tags, only allow general attrs
      if (!generalAllowed.test(attrName)) continue;
    }

    // Safe — include
    const val = attrValue.replace(/"/g, '&quot;');
    safeAttrs.push(`${attrName}="${val}"`);
  }

  return safeAttrs.join(' ');
}
