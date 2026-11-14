'use strict';

/**
 * Story 36.5 — test-owned model of `ma-standards-apply` (Story 37.2 adopts it).
 *
 * `ma-standards-apply` does not exist yet. P5-11.10 / F29 specify it as a
 * marker writer over the instruction files, between
 * `<!-- ma-standards:start -->` / `<!-- ma-standards:end -->`, idempotent, with
 * a `remove` sub-command. This module is exactly that, built on the shared
 * block writer (lib/inject/marker-block.js) so both owners pass the same case
 * table (test/fixtures/instruction-file-coexistence/case-table.json).
 *
 * `.roomodes` is one of the five files ma-standards-apply writes, but it is
 * YAML, not markdown: an HTML-comment marker pair is not valid there and a YAML
 * comment pair is dropped by any parse/dump writer (proved by AC10 in
 * test/instruction-file-coexistence.test.js against lib/merge/roomodes.js). It
 * is therefore NOT in MARKDOWN_FILES; 37.2 owns its block form (a
 * `customModes` entry with an owned slug, merged structurally).
 */

const path = require('path');
const { spliceFile, removeFile, MA_STANDARDS_MARKERS } = require('../../lib/inject/marker-block');

const INSTRUCTION_FILES = Object.freeze([
  'AGENTS.md',
  'CLAUDE.md',
  '.clinerules',
  '.roomodes',
  '.github/copilot-instructions.md'
]);

const MARKDOWN_FILES = Object.freeze(INSTRUCTION_FILES.filter((f) => f !== '.roomodes'));

function checkFiles(files) {
  for (const f of files) {
    if (!MARKDOWN_FILES.includes(f)) {
      throw new Error(`ma-standards-apply: ${f} is not a markdown instruction file`);
    }
  }
}

/**
 * Write the ma-standards block into each file.
 * @returns {Object<string,string>} file -> 'created'|'appended'|'replaced'|'unchanged'
 */
function apply(projectRoot, body, { files = MARKDOWN_FILES } = {}) {
  checkFiles(files);
  const result = {};
  for (const f of files) result[f] = spliceFile(path.join(projectRoot, f), MA_STANDARDS_MARKERS, body);
  return result;
}

/**
 * `ma-standards-apply remove`: remove the ma-standards block from each file.
 * @returns {Object<string,string>} file -> 'absent'|'removed'|'deleted'
 */
function remove(projectRoot, { files = MARKDOWN_FILES } = {}) {
  checkFiles(files);
  const result = {};
  for (const f of files) result[f] = removeFile(path.join(projectRoot, f), MA_STANDARDS_MARKERS);
  return result;
}

module.exports = { apply, remove, MARKERS: MA_STANDARDS_MARKERS, INSTRUCTION_FILES, MARKDOWN_FILES };
