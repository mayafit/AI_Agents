'use strict';

/**
 * Story 21.11 — Profile Uninstall orchestrator.
 *
 * Public API:
 *   async uninstallProfileArtifacts(projectRoot, { yes = false } = {}) -> void
 *
 * Orchestrates:
 *   1. Detect which of the 5 injection files contain MA-AGENTS-START/END markers.
 *   2. Detect whether .roomodes contains any of the 4 owned slugs.
 *   3. Idempotency check: if nothing is found, print "Nothing to do." and return.
 *   4. Confirmation (unless --yes): list files, ask to continue.
 *   5. For each injection file: backup → strip marker block → if empty, delete.
 *   6. For .roomodes: backup → parse → remove owned slugs → write or delete.
 *   7. Update .ma-agents.json: clearProfile(), append profileHistory entry.
 *
 * Notes:
 *   - buildBackupFilename is reused from lib/installer.js (Story 21.2).
 *   - MA_AGENTS_OWNED_SLUGS is imported from lib/merge/roomodes.js (Story 21.3).
 *   - clearProfile is the 4th export added to lib/profile.js in this story.
 *   - --yes is SUPPORTED (legitimate CI decommissioning use-case), unlike reconfigure
 *     which REJECTS --yes. Documented asymmetry.
 */

const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const defaultPrompts = require('prompts');

const { clearProfile, getProfile } = require('./profile');
const { buildBackupFilename, EXTRA_TEMPLATE_DIR } = require('./installer');
const { MA_AGENTS_OWNED_SLUGS } = require('./merge/roomodes');

const MANIFEST_FILE = '.ma-agents.json';
const PROFILE_HISTORY_CAP = 20;

const MARKER_START = '<!-- MA-AGENTS-START -->';
const MARKER_END = '<!-- MA-AGENTS-END -->';

/**
 * The 5 canonical injection files that can hold MA-AGENTS-START/END blocks.
 * Relative to projectRoot.
 */
const INJECTION_FILES = [
  'CLAUDE.md',
  '.clinerules',
  '.cline/clinerules.md',
  '.roo/rules/00-ma-agents.md',
  'AGENTS.md'
];

/**
 * Strip the MA-AGENTS-START...MA-AGENTS-END block (INCLUDING marker lines)
 * from a file's content string. Returns the content with the block removed.
 * If the marker is not found, returns the original content unchanged.
 */
function stripMarkerBlock(content) {
  // Match from the start marker line through the end marker line, inclusive.
  // The regex is non-greedy and dot-matches-newline via [\s\S].
  return content.replace(/[ \t]*<!-- MA-AGENTS-START -->[ \t]*\r?\n[\s\S]*?<!-- MA-AGENTS-END -->[ \t]*\r?\n?/g, '');
}

/**
 * Returns true if the string `content` is empty or whitespace-only.
 */
function isBlankContent(content) {
  return content.trim().length === 0;
}

/**
 * Check for slug divergence between installed .roomodes and the shipped template.
 * Returns an array of divergent owned slug names (may be empty).
 * If either file is absent or malformed, returns [].
 */
function detectDivergentSlugs(projectRoot) {
  const roomodesPath = path.join(projectRoot, '.roomodes');
  if (!fs.existsSync(roomodesPath)) return [];
  const templatePath = path.join(EXTRA_TEMPLATE_DIR, 'roomodes.template.yaml');
  if (!fs.existsSync(templatePath)) return [];

  let yaml;
  try { yaml = require('js-yaml'); } catch { return []; }

  let existing, template;
  try {
    existing = yaml.load(fs.readFileSync(roomodesPath, 'utf-8')) || {};
    template = yaml.load(fs.readFileSync(templatePath, 'utf-8')) || {};
  } catch {
    return [];
  }

  const existingModes = Array.isArray(existing.customModes) ? existing.customModes : [];
  const templateModes = Array.isArray(template.customModes) ? template.customModes : [];
  const templateBySlug = new Map();
  for (const m of templateModes) {
    if (m && typeof m === 'object' && typeof m.slug === 'string') {
      templateBySlug.set(m.slug, m);
    }
  }

  const divergent = [];
  for (const entry of existingModes) {
    if (!entry || typeof entry !== 'object') continue;
    const slug = entry.slug;
    if (typeof slug !== 'string') continue;
    if (!MA_AGENTS_OWNED_SLUGS.includes(slug)) continue;
    const tpl = templateBySlug.get(slug);
    if (!tpl) {
      // Owned slug present but not in template — treat as user-modified.
      divergent.push(slug);
      continue;
    }
    // Compare everything except customInstructions (which is per-profile composed).
    const normalize = (mode) => {
      const copy = { ...mode };
      delete copy.customInstructions;
      return yaml.dump(copy, { sortKeys: true });
    };
    if (normalize(entry) !== normalize(tpl)) {
      divergent.push(slug);
    }
  }
  return divergent;
}

/**
 * Append a profileHistory entry, capped at PROFILE_HISTORY_CAP entries.
 * Reads and writes .ma-agents.json directly (same pattern as reconfigure.js).
 */
function appendUninstallHistory(projectRoot, entry) {
  const manifestPath = path.join(projectRoot, MANIFEST_FILE);
  if (!fs.existsSync(manifestPath)) return;
  const raw = fs.readFileSync(manifestPath, 'utf-8');
  const manifest = JSON.parse(raw);
  const history = Array.isArray(manifest.profileHistory) ? manifest.profileHistory.slice() : [];
  history.push(entry);
  while (history.length > PROFILE_HISTORY_CAP) {
    history.shift();
  }
  manifest.profileHistory = history;
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n', 'utf-8');
}

/**
 * Main uninstall orchestrator.
 *
 * @param {string}  projectRoot
 * @param {object}  [opts]
 * @param {boolean} [opts.yes=false]       Skip confirmation prompt (CI decommissioning).
 *                                         NOTE: Unlike `reconfigure`, --yes IS supported
 *                                         here — this is intentional asymmetry since
 *                                         uninstall is a valid CI teardown operation.
 * @param {object}  [opts.promptsLib]      Prompts implementation override (for tests).
 * @param {Date}    [opts.now]             Date injection (for tests).
 */
async function uninstallProfileArtifacts(projectRoot, { yes = false, promptsLib, now } = {}) {
  const prompts = promptsLib || defaultPrompts;
  const nowDate = now || new Date();

  // --- Step 1: Detect targets ---

  // Which injection files have ma-agents marker blocks?
  const injectionTargets = [];
  for (const rel of INJECTION_FILES) {
    const absPath = path.join(projectRoot, rel);
    if (!fs.existsSync(absPath)) continue;
    const content = fs.readFileSync(absPath, 'utf-8');
    if (content.includes(MARKER_START)) {
      injectionTargets.push({ rel, absPath, content });
    }
  }

  // Does .roomodes contain any owned slugs?
  const roomodesPath = path.join(projectRoot, '.roomodes');
  let roomodesHasOwnedSlugs = false;
  if (fs.existsSync(roomodesPath)) {
    const roomodesContent = fs.readFileSync(roomodesPath, 'utf-8');
    roomodesHasOwnedSlugs = MA_AGENTS_OWNED_SLUGS.some(slug =>
      // Match slug as a YAML key to avoid substring false-positives
      roomodesContent.includes(`slug: ${slug}`) || roomodesContent.includes(`slug: '${slug}'`) || roomodesContent.includes(`slug: "${slug}"`)
    );
  }

  // --- Step 2: Idempotency check ---
  if (injectionTargets.length === 0 && !roomodesHasOwnedSlugs) {
    console.log('No ma-agents-owned profile artifacts found. Nothing to do.');
    return;
  }

  // --- Step 3: Confirmation ---
  const filesToModify = [
    ...injectionTargets.map(t => t.rel),
    ...(roomodesHasOwnedSlugs ? ['.roomodes'] : [])
  ];

  const list = filesToModify.map(f => `  - ${f}`).join('\n');
  console.log(`The following files will be modified:\n${list}`);

  if (!yes) {
    const resp = await prompts({
      type: 'confirm',
      name: 'proceed',
      message: 'The above ma-agents-owned content will be removed. User content outside markers will be preserved. Continue? (y/N)',
      initial: false
    });
    if (!resp || resp.proceed !== true) {
      console.log(chalk.gray('Aborted — no files modified.'));
      return;
    }
  }

  // --- Step 4: Process injection files ---
  for (const { rel, absPath, content } of injectionTargets) {
    // Write backup first
    const backupPath = buildBackupFilename(absPath);
    fs.writeFileSync(backupPath, content, 'utf-8');

    // Strip the marker block
    const stripped = stripMarkerBlock(content);

    if (isBlankContent(stripped)) {
      // Resulting file is empty/whitespace-only — delete it
      fs.unlinkSync(absPath);
      console.log(chalk.gray(`  Removed (now empty): ${rel}`));
    } else {
      fs.writeFileSync(absPath, stripped, 'utf-8');
      console.log(chalk.gray(`  Stripped marker block: ${rel}`));
    }
  }

  // --- Step 5: Process .roomodes ---
  if (roomodesHasOwnedSlugs) {
    const roomodesContent = fs.readFileSync(roomodesPath, 'utf-8');

    // Check for slug divergence — warn but proceed
    const divergentSlugs = detectDivergentSlugs(projectRoot);
    if (divergentSlugs.length > 0) {
      const slugList = divergentSlugs.map(s => `"${s}"`).join(', ');
      console.warn(chalk.yellow(
        `WARNING: removing hand-edited ma-agents-owned slugs [${slugList}]. Previous bodies backed up.`
      ));
    }

    // Write backup before modifying
    const backupPath = buildBackupFilename(roomodesPath);
    fs.writeFileSync(backupPath, roomodesContent, 'utf-8');

    // Parse YAML, remove only owned slugs
    const yaml = require('js-yaml');
    let parsed;
    try {
      parsed = yaml.load(roomodesContent) || {};
    } catch {
      console.warn(chalk.yellow('WARNING: .roomodes could not be parsed as YAML — skipping slug removal.'));
      parsed = null;
    }

    if (parsed !== null) {
      const existingModes = Array.isArray(parsed.customModes) ? parsed.customModes : [];
      const ownedSet = new Set(MA_AGENTS_OWNED_SLUGS);
      const userModes = existingModes.filter(
        m => m && typeof m === 'object' && !ownedSet.has(m.slug)
      );

      // Check if the file should be deleted (customModes empty and no other meaningful keys)
      const otherKeys = Object.keys(parsed).filter(k => k !== 'customModes');
      if (userModes.length === 0 && otherKeys.length === 0) {
        fs.unlinkSync(roomodesPath);
        console.log(chalk.gray('  Removed (now empty): .roomodes'));
      } else {
        parsed.customModes = userModes;
        const DUMP_OPTIONS = {
          indent: 2,
          lineWidth: -1,
          noRefs: true,
          quotingType: '"',
          sortKeys: false
        };
        fs.writeFileSync(roomodesPath, yaml.dump(parsed, DUMP_OPTIONS), 'utf-8');
        console.log(chalk.gray('  Removed owned slugs from: .roomodes'));
      }
    }
  }

  // --- Step 6: Update .ma-agents.json ---
  const manifestPath = path.join(projectRoot, MANIFEST_FILE);
  if (fs.existsSync(manifestPath)) {
    const previousProfile = getProfile(projectRoot);

    // clearProfile deletes the 'profile' key (not set to null/empty)
    clearProfile(projectRoot);

    // Append history entry
    appendUninstallHistory(projectRoot, {
      date: nowDate.toISOString(),
      from: previousProfile,
      to: null,
      source: 'uninstall'
    });

    console.log(chalk.green('  Updated .ma-agents.json: profile cleared, history appended.'));
  }

  console.log(chalk.bold.green('\n  Uninstall complete. All ma-agents-owned artifacts removed.\n'));
}

module.exports = {
  uninstallProfileArtifacts,
  // Exposed for tests
  stripMarkerBlock,
  appendUninstallHistory,
  PROFILE_HISTORY_CAP
};
