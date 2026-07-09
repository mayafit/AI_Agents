/**
 * lib/knowledge-atlas/src/extract/frontmatter.ts
 * ---------------------------------------------------------------------------
 * Story 29.2 — YAML frontmatter parser using js-yaml.
 *
 * js-yaml is bundled into atlas.cjs by esbuild (import → inlined).
 * Do NOT expose it as a runtime dependency of the consuming project.
 *
 * Robustness: malformed YAML is silently tolerated — returns null.
 * Never throws; the caller always gets a Record or null.
 */

import * as yaml from 'js-yaml';

/**
 * Parse the YAML frontmatter block from markdown/yaml file content.
 *
 * Frontmatter format:
 *   ---
 *   key: value
 *   ---
 *   (rest of document)
 *
 * For .yaml / .yml files the entire content is attempted as YAML (no fence).
 *
 * @param content  Raw file content (may have CRLF; normalize before calling or after).
 * @param fileId   Used only for error context (not thrown).
 * @returns Parsed frontmatter object, or null if absent/malformed.
 */
export function parseFrontmatter(content: string, fileId: string): Record<string, unknown> | null {
  // CRLF→LF, strip a leading UTF-8 BOM, then trim leading blank lines (item 16)
  // so frontmatter preceded by a blank line / BOM is not silently lost.
  let normalized = content.replace(/\r\n/g, '\n');
  if (normalized.charCodeAt(0) === 0xfeff) normalized = normalized.slice(1);
  normalized = normalized.replace(/^[ \t]*\n+/, '');

  // Try YAML-fenced frontmatter (--- ... ---)
  const fenceMatch = normalized.match(/^---[ \t]*\n([\s\S]*?)\n---[ \t]*(?:\n|$)/);
  if (fenceMatch) {
    try {
      const parsed = yaml.load(fenceMatch[1]!);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      // Malformed YAML — tolerate, return null
    }
    return null;
  }

  // For .yaml / .yml files: try parsing the whole content as YAML
  if (fileId.endsWith('.yaml') || fileId.endsWith('.yml')) {
    try {
      const parsed = yaml.load(normalized);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      // Malformed YAML — tolerate
    }
  }

  return null;
}

/**
 * Extract a string field from a parsed frontmatter object, or return undefined.
 */
export function fmString(fm: Record<string, unknown> | null, key: string): string | undefined {
  if (!fm) return undefined;
  const v = fm[key];
  return typeof v === 'string' ? v : undefined;
}

/**
 * Extract a string-or-number field as a string from frontmatter, or return undefined.
 */
export function fmStringLike(fm: Record<string, unknown> | null, key: string): string | undefined {
  if (!fm) return undefined;
  const v = fm[key];
  if (typeof v === 'string') return v;
  if (typeof v === 'number') return String(v);
  return undefined;
}
