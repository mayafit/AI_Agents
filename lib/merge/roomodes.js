'use strict';

/**
 * Story 21.3 — .roomodes YAML merger (pure splicer).
 *
 * Contract (per AC #5, decision A):
 *   - Input: two strings — existingYaml (may be empty/undefined when the
 *     target file does not exist) and templateYaml (the already-composed
 *     template content; the caller — lib/installer.js — substituted
 *     {{UNIVERSAL_BLOCK}} via composeInstructionBlock BEFORE calling us).
 *   - This function MUST NOT call composeInstructionBlock. It treats
 *     templateYaml as opaque pre-composed input.
 *   - Parse both as YAML via js-yaml.
 *   - Output: serialized YAML string whose customModes array is
 *       [ ...user entries whose slug ∉ MA_AGENTS_OWNED_SLUGS,
 *         ...all entries from templateYaml.customModes ]
 *     (preserved-user-first ordering — NFR46 idempotency).
 *   - Any other top-level YAML keys from existingYaml are preserved (FR176).
 *   - For each user entry whose slug collides with an ma-agents-owned slug,
 *     emit exactly one console.warn line naming the slug verbatim (AC #6).
 *   - Pure function — no file I/O.
 *
 * Deterministic serialization (NFR46 — AC #10):
 *   js-yaml dump options are pinned so consecutive runs with identical
 *   inputs produce byte-identical output.
 */

const yaml = require('js-yaml');

/**
 * Canonical set of slugs owned by ma-agents. Exported for downstream
 * consumers (Stories 21.10 profile-reconfigure, 21.11 profile-uninstall).
 * Order is canonical — do not sort or reshuffle.
 */
const MA_AGENTS_OWNED_SLUGS = Object.freeze([
  'bmad-pm',
  'bmad-architect',
  'bmad-techlead',
  'bmad-dev'
]);

const DUMP_OPTIONS = Object.freeze({
  indent: 2,
  lineWidth: -1,
  noRefs: true,
  quotingType: '"',
  sortKeys: false
});

/**
 * Parse a YAML string into an object, returning {} for empty/undefined input.
 * Throws with a descriptive message when the YAML is malformed.
 *
 * @param {string|undefined|null} text
 * @param {string} label - 'existing' or 'template' (for error context)
 * @returns {object}
 */
function parseYaml(text, label) {
  if (text == null || String(text).trim() === '') return {};
  let parsed;
  try {
    parsed = yaml.load(text);
  } catch (err) {
    throw new Error(`mergeRoomodes: failed to parse ${label} YAML — ${err.message}`);
  }
  if (parsed == null) return {};
  if (typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`mergeRoomodes: ${label} YAML must be a mapping, got ${Array.isArray(parsed) ? 'array' : typeof parsed}`);
  }
  return parsed;
}

/**
 * Merge the ma-agents roomodes template into an existing .roomodes YAML string.
 * See file header for the full contract.
 *
 * @param {string|undefined} existingYaml - existing file content (or empty string / undefined)
 * @param {string} templateYaml - already-composed template content (NO placeholders remain)
 * @param {{warn?: (msg: string) => void}} [options] - injection point for warn emitter (tests)
 * @returns {string} serialized merged YAML
 */
function mergeRoomodes(existingYaml, templateYaml, options = {}) {
  const warn = typeof options.warn === 'function' ? options.warn : (msg) => console.warn(msg);

  const existing = parseYaml(existingYaml, 'existing');
  const template = parseYaml(templateYaml, 'template');

  const templateModes = Array.isArray(template.customModes) ? template.customModes : [];
  if (templateModes.length === 0) {
    throw new Error('mergeRoomodes: template YAML has no customModes entries — refusing to produce an empty file');
  }

  const ownedSet = new Set(MA_AGENTS_OWNED_SLUGS);
  const existingModes = Array.isArray(existing.customModes) ? existing.customModes : [];

  const preservedUserModes = [];
  for (const entry of existingModes) {
    // Defensive: tolerate malformed entries (null / non-object / missing slug).
    // Non-object entries are preserved as-is; entries without a valid slug
    // cannot collide by definition and are kept in place.
    const slug = entry && typeof entry === 'object' ? entry.slug : undefined;
    if (typeof slug === 'string' && ownedSet.has(slug)) {
      // AC #6 — one warning per colliding slug, slug cited verbatim.
      warn(`WARNING: .roomodes slug "${slug}" overwritten by ma-agents template`);
      continue;
    }
    preservedUserModes.push(entry);
  }

  // Build the merged document: non-customModes keys from existing + merged modes.
  const merged = {};
  for (const key of Object.keys(existing)) {
    if (key === 'customModes') continue;
    merged[key] = existing[key];
  }
  merged.customModes = [...preservedUserModes, ...templateModes];

  return yaml.dump(merged, DUMP_OPTIONS);
}

module.exports = {
  mergeRoomodes,
  MA_AGENTS_OWNED_SLUGS,
  _DUMP_OPTIONS: DUMP_OPTIONS
};
