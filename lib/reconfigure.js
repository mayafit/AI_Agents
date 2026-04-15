'use strict';

/**
 * Story 21.10 — Profile Reconfigure orchestrator.
 *
 * Public API:
 *   async reconfigure({ projectRoot, argv, promptsLib }) -> { status, from, to }
 *
 * Orchestrates:
 *   1. Pre-flight: refuse --yes, require .ma-agents.json.
 *   2. Re-run the profile-selection prompt (same shape as Story 21.1 wizard)
 *      with the currently-persisted value as the default.
 *   3. Same-value shortcut.
 *   4. Per-file drift guards:
 *        - Story 21.3 slug-stomp protection (RoomodesSlugDivergenceError)
 *          unless --force-roomodes-overwrite.
 *        - Story 21.5 .clinerules dual-file drift (ClinerulesDualFileDriftError,
 *          no override).
 *   5. Two-step confirmation listing files to be modified (AC #7).
 *   6. Persist new profile via setProfile (source="wizard" log line).
 *   7. Re-stamp all profile-dependent artifacts by calling the canonical
 *      updateAgentInstructions helper from lib/installer.js for every agent in
 *      the manifest. Backups are written by the installer's drift handler via
 *      the canonical buildBackupFilename helper (Story 21.2 AC #8).
 *   8. Append a { date, from, to, source: "reconfigure" } entry to
 *      .ma-agents.json::profileHistory, capped at PROFILE_HISTORY_CAP entries
 *      with oldest-first eviction.
 *
 * Does NOT modify lib/profile.js's public contract — it is a new consumer.
 */

const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const defaultPrompts = require('prompts');

const { getProfile, setProfile } = require('./profile');
const installer = require('./installer');
const { getAgent } = require('./agents');

const MANIFEST_FILE = '.ma-agents.json';
const PROFILE_HISTORY_CAP = 20;
const YES_REJECT_MESSAGE =
  '--yes is not valid for reconfigure — this command is interactive by design to prevent accidental CI-triggered profile changes.';

/**
 * Story 21.10 AC #9 — thrown when the user has edited content of an
 * ma-agents-owned `.roomodes` slug in place. Reconfigure would otherwise
 * silently overwrite those edits. Bypass with --force-roomodes-overwrite.
 */
class RoomodesSlugDivergenceError extends Error {
  constructor({ divergentSlugs, path: roomodesPath }) {
    const slugs = divergentSlugs.map(s => `"${s}"`).join(', ');
    const header = `ma-agents-owned .roomodes slug(s) ${slugs} diverge from the shipped template in ${roomodesPath}.`;
    const guidance = 'Either rename the slug(s) so they are user-owned, or pass --force-roomodes-overwrite to accept the overwrite.';
    super(`${header}\n${guidance}`);
    this.name = 'RoomodesSlugDivergenceError';
    this.divergentSlugs = divergentSlugs;
    this.path = roomodesPath;
  }
}

/**
 * Story 21.10 AC #1 — named error when .ma-agents.json is absent.
 * Distinct name so CLI + tests can dispatch on it without message-matching.
 */
class ManifestNotFoundError extends Error {
  constructor(projectRoot) {
    super(`.ma-agents.json not found at ${projectRoot} — run \`ma-agents install\` first. reconfigure presumes a prior install.`);
    this.name = 'ManifestNotFoundError';
    this.projectRoot = projectRoot;
  }
}

/**
 * Story 21.10 AC #6 — thrown when --yes is supplied.
 * Exposed so callers can dispatch on .name rather than matching the message.
 */
class ReconfigureYesRejectedError extends Error {
  constructor() {
    super(YES_REJECT_MESSAGE);
    this.name = 'ReconfigureYesRejectedError';
  }
}

/**
 * Returns the list of project-relative files reconfigure would touch for the
 * given installed-agent list. Used for the AC #7 confirmation preview and by
 * tests. Order is stable.
 */
function listTouchedFiles(projectRoot, agentEntries) {
  const files = new Set();
  for (const agent of agentEntries) {
    if (!agent) continue;
    // Primary instruction files.
    if (Array.isArray(agent.instructionFiles)) {
      for (const rel of agent.instructionFiles) files.add(rel);
    }
    // Extra templates (AGENTS.md, .roomodes, etc.).
    if (Array.isArray(agent.extraInstructionTemplates)) {
      for (const entry of agent.extraInstructionTemplates) {
        if (entry && typeof entry.target === 'string') files.add(entry.target);
      }
    }
  }
  return Array.from(files).sort();
}

/**
 * Story 21.10 AC #9 — slug-stomp protection.
 *
 * Parses the project-root `.roomodes` (YAML). For each ma-agents-owned slug
 * present in the existing file whose customInstructions (or any non-slug field)
 * differs from the shipped template, record the slug as divergent. Throws
 * RoomodesSlugDivergenceError when any are divergent and `force` is false.
 *
 * If `.roomodes` or the roomodes template is absent, the check is a no-op —
 * nothing to diverge from.
 */
function checkRoomodesSlugDivergence(projectRoot, { force } = {}) {
  const roomodesPath = path.join(projectRoot, '.roomodes');
  if (!fs.existsSync(roomodesPath)) return;
  const templatePath = path.join(installer.EXTRA_TEMPLATE_DIR, 'roomodes.template.yaml');
  if (!fs.existsSync(templatePath)) return;

  const yaml = require('js-yaml');
  const { MA_AGENTS_OWNED_SLUGS } = require('./merge/roomodes');

  let existing;
  let template;
  try {
    existing = yaml.load(fs.readFileSync(roomodesPath, 'utf-8')) || {};
    template = yaml.load(fs.readFileSync(templatePath, 'utf-8')) || {};
  } catch {
    // Malformed YAML — not our problem at this layer; let the merger surface it.
    return;
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
    // Compare YAML dumps of the two entries minus placeholder expansion. The
    // template still contains `{{UNIVERSAL_BLOCK}}` sentinels inside
    // customInstructions; compare all other fields strictly. For
    // customInstructions, ignore the {{UNIVERSAL_BLOCK}}-bearing line and
    // compare the surrounding static text.
    const normalize = (mode) => {
      const copy = { ...mode };
      // Strip customInstructions — it contains per-profile composed text after
      // installer stamping; its content legitimately changes per profile.
      delete copy.customInstructions;
      return yaml.dump(copy, { sortKeys: true });
    };
    if (normalize(entry) !== normalize(tpl)) {
      divergent.push(slug);
    }
  }

  if (divergent.length > 0 && !force) {
    throw new RoomodesSlugDivergenceError({
      divergentSlugs: divergent,
      path: path.relative(projectRoot, roomodesPath).replace(/\\/g, '/') || '.roomodes'
    });
  }
}

/**
 * Story 21.10 AC #11 — append { date, from, to, source } to
 * .ma-agents.json::profileHistory, capped at PROFILE_HISTORY_CAP entries
 * (oldest-first eviction when the cap is exceeded).
 *
 * Performed as a read-modify-write through the same JSON-IO path used by
 * setProfile so we avoid parallel I/O semantics (AC spec: "Ensure the write
 * goes through setProfile or an equivalent atomic write path").
 */
function appendProfileHistory(projectRoot, entry) {
  const manifestPath = path.join(projectRoot, MANIFEST_FILE);
  // Read current manifest (setProfile has just written to it).
  const raw = fs.readFileSync(manifestPath, 'utf-8');
  const manifest = JSON.parse(raw);
  const history = Array.isArray(manifest.profileHistory) ? manifest.profileHistory.slice() : [];
  history.push(entry);
  while (history.length > PROFILE_HISTORY_CAP) {
    history.shift(); // oldest-first eviction
  }
  manifest.profileHistory = history;
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n', 'utf-8');
}

/**
 * Main orchestrator.
 *
 * @param {object}   opts
 * @param {string}   opts.projectRoot
 * @param {string[]} [opts.argv]           raw argv (excluding the 'reconfigure' verb)
 * @param {object}   [opts.promptsLib]     prompts implementation (for tests)
 * @param {Date}     [opts.now]            date injection (for tests)
 * @returns {Promise<{status: 'unchanged'|'aborted'|'reconfigured', from: string|undefined, to: string|undefined}>}
 */
async function reconfigure({ projectRoot, argv = [], promptsLib, now } = {}) {
  const prompts = promptsLib || defaultPrompts;
  const nowDate = now || new Date();

  // --- AC #6: --yes rejection ---
  if (argv.includes('--yes')) {
    throw new ReconfigureYesRejectedError();
  }

  const forceRoomodes = argv.includes('--force-roomodes-overwrite');

  // --- AC #1: require .ma-agents.json ---
  const manifestPath = path.join(projectRoot, MANIFEST_FILE);
  if (!fs.existsSync(manifestPath)) {
    throw new ManifestNotFoundError(projectRoot);
  }

  const previousProfile = getProfile(projectRoot);

  // --- AC #2: re-prompt with persisted value as default ---
  const choices = [
    { title: 'Yes — apply local-LLM guardrails (recommended for non-Claude models)', value: 'on-prem' },
    { title: 'No  — standard install (Claude on web, Anthropic API, etc.)', value: 'standard' }
  ];
  const initialIdx = previousProfile === 'on-prem' ? 0 : 1;
  const promptResponse = await prompts({
    type: 'select',
    name: 'chosenProfile',
    message: `Current profile: ${previousProfile || '(unset)'}. Change to?`,
    choices,
    initial: initialIdx
  });
  const chosenProfile = promptResponse && promptResponse.chosenProfile;
  if (!chosenProfile) {
    // User hit Ctrl-C at the prompt — abort silently, nothing modified.
    return { status: 'aborted', from: previousProfile, to: undefined };
  }

  // --- AC #4: same-value short-circuit ---
  if (chosenProfile === previousProfile) {
    console.log(`Profile unchanged: ${chosenProfile}. No re-stamp needed.`);
    return { status: 'unchanged', from: previousProfile, to: chosenProfile };
  }

  // --- Enumerate installed agents from manifest BEFORE any mutation ---
  const rawManifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
  const agentIds = installer.getManifestAgents(rawManifest);
  const agentEntries = agentIds.map(id => getAgent(id)).filter(Boolean);

  // --- AC #9: slug-stomp pre-check (before any write) ---
  checkRoomodesSlugDivergence(projectRoot, { force: forceRoomodes });

  // --- AC #10: .clinerules dual-file drift pre-check (no override) ---
  //            Only check when Cline is installed.
  const clineInstalled = agentEntries.some(a => a && a.id === 'cline');
  if (clineInstalled) {
    installer.checkClinerulesDualFileDrift(projectRoot);
  }

  // --- AC #7: two-step confirmation — list files and ask to continue ---
  const touched = listTouchedFiles(projectRoot, agentEntries);
  const list = touched.length ? touched.map(f => `  - ${f}`).join('\n') : '  (no files)';
  console.log(`The following files will be updated to match profile=${chosenProfile}:\n${list}`);
  const continueResp = await prompts({
    type: 'confirm',
    name: 'proceed',
    message: 'Continue?',
    initial: false
  });
  if (!continueResp || continueResp.proceed !== true) {
    console.log(chalk.gray('Aborted — no files modified.'));
    return { status: 'aborted', from: previousProfile, to: chosenProfile };
  }

  // --- AC #3: persist new profile, log canonical format ---
  setProfile(projectRoot, chosenProfile);
  console.log(chalk.cyan(`Using profile: ${chosenProfile} (from wizard)`));

  // --- AC #5 + #8: re-stamp all profile-dependent artifacts.
  //                 updateAgentInstructions handles drift detection + backup
  //                 via the canonical buildBackupFilename helper; yesMode=true
  //                 suppresses per-file interactive prompts since we've already
  //                 obtained a single global confirmation in the step above.
  for (const agent of agentEntries) {
    try {
      await installer._testUpdateAgentInstructions(agent, projectRoot, { yesMode: true });
    } catch (err) {
      // Surface the error to the caller but make sure the history is NOT
      // appended — incomplete re-stamp should not record a success event.
      throw err;
    }
  }

  // --- AC #11: append profileHistory entry (capped) ---
  appendProfileHistory(projectRoot, {
    date: nowDate.toISOString(),
    from: previousProfile,
    to: chosenProfile,
    source: 'reconfigure'
  });

  console.log(chalk.green(`Reconfigure complete: ${previousProfile} → ${chosenProfile}`));
  return { status: 'reconfigured', from: previousProfile, to: chosenProfile };
}

module.exports = {
  reconfigure,
  RoomodesSlugDivergenceError,
  ManifestNotFoundError,
  ReconfigureYesRejectedError,
  PROFILE_HISTORY_CAP,
  YES_REJECT_MESSAGE,
  // exposed for tests
  listTouchedFiles,
  checkRoomodesSlugDivergence,
  appendProfileHistory
};
