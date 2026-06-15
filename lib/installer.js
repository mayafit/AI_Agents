const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');
const prompts = require('prompts');
const { getAgent, getAllAgents } = require('./agents');
// Story 22.8 — reuse the canonical stage-directory name so the gitignore policy
// stays in lock-step with lib/bmad.js#stagePlugin / cleanupStage.
const { PLUGIN_STAGE_DIR_NAME } = require('./bmad');

const MANIFEST_FILE = '.ma-agents.json';
const MANIFEST_VERSION = '1.2.0';
const MA_AGENTS_SOURCE = 'ma-agents';
const TEMPLATE_PATH = path.join(__dirname, 'templates', 'project-context.template.md');
const UNIVERSAL_INSTRUCTION_TEMPLATE_PATH = path.join(__dirname, 'templates', 'instruction-block-universal.template.md');
const GIT_INSTRUCTION_TEMPLATE_PATH = path.join(__dirname, 'templates', 'instruction-block-git.template.md');
const ONPREM_INSTRUCTION_TEMPLATE_PATH = path.join(__dirname, 'templates', 'instruction-block-onprem.template.md');
const CLINERULES_TEMPLATE_PATH = path.join(__dirname, 'templates', 'clinerules.template.md');
const EXTRA_TEMPLATE_DIR = path.join(__dirname, 'templates');

/**
 * Story 21.5 AC #6 — Dual-file drift detection error.
 *
 * Thrown by the installer when the in-marker contents of `.cline/clinerules.md`
 * and `.clinerules` diverge (non-whitespace diff). `--yes` does NOT bypass this
 * check — reconciliation between the two Cline rule files is user work, and
 * silently picking a "winner" could discard intentional edits.
 *
 * Follows the error-class naming pattern introduced by Story 21.3/21.10's
 * RoomodesSlugDivergenceError.
 */
class ClinerulesDualFileDriftError extends Error {
  constructor({ fileA, fileB, diff }) {
    const header = `Cline dual-file drift detected between ${fileA} and ${fileB}.`;
    const guidance = 'Reconcile the two files manually (copy the correct marker-block content into both) before re-running install. `--yes` does NOT bypass this check.';
    super(`${header}\n${guidance}\n\n--- diff (${fileA} vs. ${fileB}) ---\n${diff}`);
    this.name = 'ClinerulesDualFileDriftError';
    this.fileA = fileA;
    this.fileB = fileB;
    this.diff = diff;
  }
}

/**
 * Extract the content between MA-AGENTS markers in a file, without the marker
 * lines themselves. Returns null when the file does not exist OR has no marker
 * pair. Whitespace-only leading/trailing runs inside the block are preserved —
 * caller decides whether to normalize before comparing.
 */
function _extractMarkerBlockInner(filePath) {
  if (!fs.existsSync(filePath)) return null;
  const content = fs.readFileSync(filePath, 'utf-8');
  const m = content.match(/<!-- MA-AGENTS-START -->([\s\S]*?)<!-- MA-AGENTS-END -->/);
  if (!m) return null;
  return m[1];
}

/**
 * Story 21.5 AC #6 — Compare in-marker content of `.cline/clinerules.md` and
 * `.clinerules` (when both exist). Non-whitespace divergence throws
 * ClinerulesDualFileDriftError. If only one file exists, drift detection is
 * skipped (AC #6, Task 3.4 "render once, write twice" invariant).
 *
 * Exposed for tests via module.exports; called internally by
 * updateAgentInstructions on the Cline agent path.
 */
function checkClinerulesDualFileDrift(projectRoot) {
  const pathA = path.join(projectRoot, '.cline', 'clinerules.md');
  const pathB = path.join(projectRoot, '.clinerules');
  // .clinerules is now a directory (Cline's correct structure) — no file to drift-check.
  if (fs.existsSync(pathB) && fs.lstatSync(pathB).isDirectory()) return;
  const innerA = _extractMarkerBlockInner(pathA);
  const innerB = _extractMarkerBlockInner(pathB);
  if (innerA == null || innerB == null) return; // one (or both) absent — skip
  const normalize = (s) => s.replace(/\s+/g, ' ').trim();
  if (normalize(innerA) === normalize(innerB)) return;
  // Build a minimal unified diff (line-level) for the message.
  const linesA = innerA.split('\n');
  const linesB = innerB.split('\n');
  const diffLines = [];
  const maxLen = Math.max(linesA.length, linesB.length);
  for (let i = 0; i < maxLen; i++) {
    const a = linesA[i];
    const b = linesB[i];
    if (a === b) continue;
    if (a !== undefined) diffLines.push(`- ${a}`);
    if (b !== undefined) diffLines.push(`+ ${b}`);
  }
  throw new ClinerulesDualFileDriftError({
    fileA: path.relative(projectRoot, pathA).replace(/\\/g, '/'),
    fileB: path.relative(projectRoot, pathB).replace(/\\/g, '/'),
    diff: diffLines.join('\n')
  });
}

// Story 21.4 — memoize resolved BMAD-output dirs per projectRoot so the
// install loop resolves once (AC #10c) and logs once.
const _bmadOutputDirsCache = new Map();
const _bmadOutputDirsLogged = new Set();

/**
 * Story 21.2 — Universal per-tool instruction block composer.
 *
 * Reads lib/templates/instruction-block-universal.template.md (always).
 * If profile === 'on-prem', appends lib/templates/instruction-block-onprem.template.md
 * separated by a single blank line. If the on-prem template is missing when required,
 * THROWS — there is no silent fallback (Decision A, AC #3).
 *
 * Templates contain NO substitution of {{...}} placeholders inside this function; any
 * substitution (e.g., {{MANIFEST_PATH}}) is the caller's responsibility, applied AFTER
 * composition. This keeps the composer a single-owner entry point that downstream
 * stories 21.3/21.4/21.5/21.6 consume without duplication.
 *
 * @param {{profile: string|undefined, projectRoot: string}} args
 * @returns {string} composed template content (with placeholders intact)
 */
function composeInstructionBlock({ profile, projectRoot } = {}) {
  // projectRoot is accepted for API-stability with downstream stories even though
  // the current implementation does not read from it (templates ship with the
  // package). Keeping the parameter documented avoids signature churn in 21.6.
  void projectRoot;

  let universal;
  try {
    universal = fs.readFileSync(UNIVERSAL_INSTRUCTION_TEMPLATE_PATH, 'utf-8');
  } catch (err) {
    throw new Error(
      `universal instruction template not found at ${UNIVERSAL_INSTRUCTION_TEMPLATE_PATH} — ma-agents installation may be corrupted: ${err.message}`
    );
  }

  if (!universal.includes('{{MANIFEST_PATH}}')) {
    throw new Error(
      `universal instruction template at ${UNIVERSAL_INSTRUCTION_TEMPLATE_PATH} is missing the required {{MANIFEST_PATH}} placeholder`
    );
  }

  // Story 26.1 — the git workflow guardrail block is appended to EVERY profile
  // (standard and on-prem), so this read must be as robust as the universal
  // read above. Any failure to load a non-empty git template surfaces as a
  // clear, path-identifying error — the guardrails must never silently vanish.
  let git;
  try {
    git = fs.readFileSync(GIT_INSTRUCTION_TEMPLATE_PATH, 'utf-8');
  } catch (err) {
    throw new Error(
      `git instruction template not found or unreadable at ${GIT_INSTRUCTION_TEMPLATE_PATH} — ma-agents installation may be corrupted: ${err.message}`
    );
  }
  if (git.trim() === '') {
    throw new Error(
      `git instruction template at ${GIT_INSTRUCTION_TEMPLATE_PATH} is empty — ma-agents installation may be corrupted`
    );
  }

  // Compose in the exact order universal + git (+ on-prem). Each piece is
  // trailing-whitespace-normalized and joined by exactly one blank line so that
  // first-insert and in-place-replace produce byte-identical marker content
  // (FR176 / NFR46 idempotency).
  let composed = universal.replace(/\s+$/, '') + '\n\n' + git.replace(/\s+$/, '');

  if (profile === 'on-prem') {
    if (!fs.existsSync(ONPREM_INSTRUCTION_TEMPLATE_PATH)) {
      throw new Error('on-prem profile selected but instruction-block-onprem.template.md is missing');
    }
    const onprem = fs.readFileSync(ONPREM_INSTRUCTION_TEMPLATE_PATH, 'utf-8');
    composed += '\n\n' + onprem.replace(/\s+$/, '');
  }

  // Bug 27.10 — the source templates are authored with CRLF line endings, but the
  // segment seams and terminator above are hand-written LF. That mix yields a block
  // whose body lines are CRLF while the joins are LF. Normalize to pure LF once here
  // so the composed block is EOL-consistent regardless of how templates were checked
  // out on Windows, and so downstream marker-merge (which assumes LF) stays stable.
  return composed.replace(/\r\n/g, '\n') + '\n';
}

/**
 * Story 21.4 AC #10 — resolve BMAD output directories once per install.
 * Story 22.7 — reads the canonical v6.3.0 config at `_bmad/bmm/config.yaml`.
 *
 * Precedence:
 *   a) If `_bmad/bmm/config.yaml` exists AND has explicit `planning_artifacts`,
 *      `architecture_artifacts`, and `implementation_artifacts`, use those.
 *   b) Otherwise, fall back to the documented defaults:
 *        planning:       _bmad-output/planning-artifacts
 *        architecture:   _bmad-output/planning-artifacts (co-located default)
 *        stories:        _bmad-output/implementation-artifacts
 *
 * This resolver NEVER consults the legacy `_bmad/_config/manifest.yaml`.
 * If a legacy install is present without the canonical file, the defaults
 * are used; the install flow (`lib/bmad.js::installBmad`) invokes
 * `ensureCanonicalConfigLocation()` earlier so bmad-method regenerates the
 * canonical layout during the install that triggered this call.
 *
 * YAML parsing is intentionally minimal — we only need a handful of
 * top-level scalar keys. Adding a full YAML dependency just for this is
 * overkill and would widen the supply chain for one helper.
 *
 * @param {string} projectRoot
 * @returns {{planning: string, architecture: string, stories: string}}
 */
function resolveBmadOutputDirs(projectRoot) {
  if (_bmadOutputDirsCache.has(projectRoot)) {
    return _bmadOutputDirsCache.get(projectRoot);
  }

  const defaults = {
    planning: '_bmad-output/planning-artifacts',
    architecture: '_bmad-output/planning-artifacts',
    stories: '_bmad-output/implementation-artifacts'
  };

  const configPath = path.join(projectRoot, '_bmad', 'bmm', 'config.yaml');
  const dirs = { ...defaults };

  if (fs.existsSync(configPath)) {
    try {
      const yamlText = fs.readFileSync(configPath, 'utf-8');
      const scanScalar = (key) => {
        // Match `key: "value"` or `key: value` at line start (indent tolerated),
        // ignoring commented lines. Value is the quoted string or the bare token.
        const re = new RegExp(`^[\\t ]*${key}\\s*:\\s*(?:"([^"]*)"|'([^']*)'|([^#\\n\\r]+?))\\s*(?:#.*)?$`, 'm');
        const m = yamlText.match(re);
        if (!m) return null;
        const raw = m[1] || m[2] || m[3] || '';
        return raw.trim().replace(/\\/g, '/');
      };
      const planning = scanScalar('planning_artifacts');
      const architecture = scanScalar('architecture_artifacts');
      const stories = scanScalar('implementation_artifacts');
      if (planning) dirs.planning = planning;
      if (architecture) dirs.architecture = architecture;
      if (stories) dirs.stories = stories;
    } catch {
      // Malformed or unreadable config — fall back silently to defaults.
    }
  }

  _bmadOutputDirsCache.set(projectRoot, dirs);
  if (!_bmadOutputDirsLogged.has(projectRoot)) {
    _bmadOutputDirsLogged.add(projectRoot);
    console.log(
      `Resolved BMAD output dirs: planning=${dirs.planning}, architecture=${dirs.architecture}, stories=${dirs.stories}`
    );
  }
  return dirs;
}

// Claude Code hook configuration for MANIFEST verification
const CLAUDE_CODE_HOOK_ID = 'ma-agents-verify-manifest';
const CLAUDE_CODE_SETTINGS_FILE = '.claude/settings.json';

// Bug 27.8 — the SessionStart hook must point at a path that exists in a real
// (npx/node_modules) install, not at the package's own `lib/` which is never
// copied into the target. The dependency-free hook script is copied into the
// target's `.claude/hooks/` and the command resolves it via $CLAUDE_PROJECT_DIR
// (the target project root). The legacy `lib/hooks/...` command string is kept
// here only so existing installs get it removed/migrated on the next run.
const CLAUDE_CODE_HOOK_SOURCE = path.join(__dirname, 'hooks', 'claude-code', 'verify-manifest.js');
const CLAUDE_CODE_HOOK_TARGET_REL = '.claude/hooks/verify-manifest.js';
const CLAUDE_CODE_HOOK_COMMAND = `node "$CLAUDE_PROJECT_DIR/${CLAUDE_CODE_HOOK_TARGET_REL}"`;
const CLAUDE_CODE_HOOK_LEGACY_COMMAND = `node "$CLAUDE_PROJECT_DIR/lib/hooks/claude-code/verify-manifest.js"`;

function getPackageVersion() {
  const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf-8'));
  return pkg.version;
}

function getBmadVersion() {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'node_modules', 'bmad-method', 'package.json'), 'utf-8'));
    return pkg.version;
  } catch {
    return null;
  }
}

// --- Manifest functions ---

function readManifest(installPath) {
  const manifestPath = path.join(installPath, MANIFEST_FILE);
  if (!fs.existsSync(manifestPath)) {
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
  } catch {
    return null;
  }
}

function writeManifest(installPath, manifest) {
  const manifestPath = path.join(installPath, MANIFEST_FILE);
  // Stamp version fields on every write so they always reflect the last run.
  manifest.toolVersion = getPackageVersion();
  manifest.bmadVersion = getBmadVersion();
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n', 'utf-8');
}

const BMAD_OUTPUT_PATTERNS = ['_bmad-output', '_bmad-output/', '/_bmad-output', '/_bmad-output/'];

function ensureBmadOutputTracked(projectRoot) {
  const gitignorePath = path.join(projectRoot, '.gitignore');
  let content;
  try {
    content = fs.readFileSync(gitignorePath, 'utf-8');
  } catch (err) {
    if (err.code === 'ENOENT') return; // no .gitignore — nothing to do
    throw err;
  }

  const lines = content.split(/\r?\n/);
  const filtered = lines.filter(line => !BMAD_OUTPUT_PATTERNS.includes(line.trim()));

  if (filtered.length === lines.length) return; // nothing removed — do not write

  fs.writeFileSync(gitignorePath, filtered.join('\n'), 'utf-8');
  console.log(chalk.green('_bmad-output is now tracked as project knowledge (not gitignored)'));
}

// Story 22.8 — plugin-stage directory gitignore policy.
//
// Sister-policy to BMAD_OUTPUT_PATTERNS above. `_bmad-output/` is intentionally
// NOT gitignored (it holds tracked project knowledge); by contrast the
// project-local plugin stage (`<projectRoot>/.ma-agents-plugin-stage/`, see
// lib/bmad.js#stagePlugin) is a transient install artifact that should NEVER
// be committed. Both forms (trailing / or not) match the directory per git's
// pathspec rules, and the leading-slash variants anchor to the project root.
const PLUGIN_STAGE_PATTERNS = [
  PLUGIN_STAGE_DIR_NAME,                  // .ma-agents-plugin-stage
  `${PLUGIN_STAGE_DIR_NAME}/`,            // .ma-agents-plugin-stage/
  `/${PLUGIN_STAGE_DIR_NAME}`,            // /.ma-agents-plugin-stage
  `/${PLUGIN_STAGE_DIR_NAME}/`,           // /.ma-agents-plugin-stage/
];

// Canonical entry we write when the pattern is absent — trailing slash makes
// the "directory-only" intent explicit for human readers.
const PLUGIN_STAGE_CANONICAL_ENTRY = `${PLUGIN_STAGE_DIR_NAME}/`;

/**
 * Ensure `.ma-agents-plugin-stage/` is present in the target project's
 * `.gitignore`. Append-only and idempotent:
 *
 *  - If `.gitignore` is absent, create it with the single canonical entry.
 *  - If any active (non-comment) line already matches any PLUGIN_STAGE_PATTERNS
 *    variant, do nothing.
 *  - Otherwise, append `PLUGIN_STAGE_CANONICAL_ENTRY` preserving the file's
 *    existing line endings (CRLF vs LF) and guaranteeing a trailing newline
 *    so the new entry is not concatenated to the previous line.
 *
 * Unrelated lines are never modified — this is strictly additive. Commented
 * variants (lines starting with `#`) are ignored for the "already present"
 * check, matching git's own semantics.
 *
 * F2a contract — the caller MUST pass the **project root** (the directory
 * that contains the target project's top-level `.gitignore`), NOT a per-agent
 * skills install path (e.g., `.claude/skills/`). Earlier (pre-F2a) the call
 * site in `installSkill()` passed `installPath`, which produced per-skill-dir
 * `.gitignore` files instead of one project-root file. The fix moved the
 * single invocation next to `stagePlugin(projectRoot)` in `lib/bmad.js`.
 *
 * Defensive behavior — if `projectRoot` is falsy or not a string, this
 * function is a no-op. The `ensurePluginStageGitignoredForProject()` helper
 * in `lib/bmad.js` is the canonical caller; this guard exists so a stray
 * call from misconfigured tests or third-party code cannot accidentally write
 * to `cwd`.
 *
 * @param {string} projectRoot - Absolute path to the target project.
 */
function ensurePluginStageIgnored(projectRoot) {
  // F2a — defensive guard: reject undefined/null/non-string input rather than
  // silently writing to `path.join(undefined, '.gitignore')` (which throws on
  // older Node) or to whatever `path.join('')` resolves to (cwd).
  if (typeof projectRoot !== 'string' || projectRoot.length === 0) {
    return;
  }

  const gitignorePath = path.join(projectRoot, '.gitignore');

  let content = '';
  let fileExists = true;
  try {
    content = fs.readFileSync(gitignorePath, 'utf-8');
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
    fileExists = false;
  }

  if (fileExists) {
    const alreadyPresent = content.split(/\r?\n/).some(rawLine => {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) return false; // skip blanks & comments
      return PLUGIN_STAGE_PATTERNS.includes(line);
    });
    if (alreadyPresent) return; // idempotent no-op
  }

  // Preserve the file's existing line-ending style; default to LF for new files.
  const usesCrlf = fileExists && /\r\n/.test(content);
  const eol = usesCrlf ? '\r\n' : '\n';

  let next = content;
  if (next && !next.endsWith('\n') && !next.endsWith('\r\n')) {
    next += eol; // ensure the append lands on its own line
  }
  next += PLUGIN_STAGE_CANONICAL_ENTRY + eol;

  fs.writeFileSync(gitignorePath, next, 'utf-8');
  console.log(
    chalk.green(
      `${PLUGIN_STAGE_CANONICAL_ENTRY} added to .gitignore (transient plugin stage — safe to ignore)`
    )
  );
}

// Bug 27.11 — the installer writes the `_bmad/` module tree which is
// "Installer-managed. Regenerated on every install — treat as read-only."
// Leaving it tracked guarantees churn and merge conflicts on every reinstall.
// This sister-policy to PLUGIN_STAGE_PATTERNS ensures `_bmad/` is gitignored.
//
// IMPORTANT: this targets ONLY the regenerated `_bmad/` tree. The
// `_bmad-output/` directory holds tracked project knowledge and is
// deliberately kept OUT of .gitignore (see ensureBmadOutputTracked) — the
// patterns below never match it because git treats `_bmad/` (trailing-slash
// anchored) and `_bmad-output` as distinct entries.
const BMAD_DIR_NAME = '_bmad';
const BMAD_DIR_PATTERNS = [
  BMAD_DIR_NAME,            // _bmad
  `${BMAD_DIR_NAME}/`,      // _bmad/
  `/${BMAD_DIR_NAME}`,      // /_bmad
  `/${BMAD_DIR_NAME}/`,     // /_bmad/
];
const BMAD_DIR_CANONICAL_ENTRY = `${BMAD_DIR_NAME}/`;

/**
 * Ensure `_bmad/` is present in the target project's `.gitignore`. Mirrors the
 * append-only, idempotent, EOL-preserving contract of `ensurePluginStageIgnored`.
 *
 *  - If `.gitignore` is absent, create it with the single canonical entry.
 *  - If any active (non-comment) line already matches any BMAD_DIR_PATTERNS
 *    variant, do nothing.
 *  - Otherwise, append `BMAD_DIR_CANONICAL_ENTRY` preserving existing EOL style.
 *
 * Defensive: no-op on falsy/non-string projectRoot, matching the sister helper.
 *
 * @param {string} projectRoot - Absolute path to the target project root.
 */
function ensureBmadDirIgnored(projectRoot) {
  if (typeof projectRoot !== 'string' || projectRoot.length === 0) {
    return;
  }

  const gitignorePath = path.join(projectRoot, '.gitignore');

  let content = '';
  let fileExists = true;
  try {
    content = fs.readFileSync(gitignorePath, 'utf-8');
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
    fileExists = false;
  }

  if (fileExists) {
    const alreadyPresent = content.split(/\r?\n/).some(rawLine => {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) return false; // skip blanks & comments
      return BMAD_DIR_PATTERNS.includes(line);
    });
    if (alreadyPresent) return; // idempotent no-op
  }

  const usesCrlf = fileExists && /\r\n/.test(content);
  const eol = usesCrlf ? '\r\n' : '\n';

  let next = content;
  if (next && !next.endsWith('\n') && !next.endsWith('\r\n')) {
    next += eol; // ensure the append lands on its own line
  }
  next += BMAD_DIR_CANONICAL_ENTRY + eol;

  fs.writeFileSync(gitignorePath, next, 'utf-8');
  console.log(
    chalk.green(
      `${BMAD_DIR_CANONICAL_ENTRY} added to .gitignore (installer-managed BMAD tree — regenerated on every install)`
    )
  );
}

function ensureManifest(installPath, agentId, scope) {
  let manifest = readManifest(installPath);
  if (!manifest) {
    // Bug 27.9 — when bootstrapped before any agent is known (e.g. profile
    // bootstrap via setProfile → ensureManifest(root, null, 'project')), agentId
    // is null. Mirror the migrate-branch guard so we never write the malformed
    // `agent: null` / `agents: [null]` shape; an empty agents array is valid.
    manifest = {
      manifestVersion: MANIFEST_VERSION,
      agent: agentId || null,
      agents: agentId ? [agentId] : [],
      scope: scope,
      skills: {}
    };
  } else {
    // Migrate v1.0.0 manifests: add agents array if missing
    if (!manifest.agents) {
      manifest.agents = manifest.agent ? [manifest.agent] : [];
    }
    // Add current agent if not already present
    if (agentId && !manifest.agents.includes(agentId)) {
      manifest.agents.push(agentId);
    }
    // Keep backward-compat agent field as first agent
    manifest.agent = manifest.agents[0] || null;
  }
  return manifest;
}

function getManifestAgents(manifest) {
  if (!manifest) return [];
  if (manifest.agents && Array.isArray(manifest.agents)) {
    return manifest.agents;
  }
  return manifest.agent ? [manifest.agent] : [];
}

function getInstalledSkillInfo(installPath, skillId) {
  const manifest = readManifest(installPath);
  if (!manifest || !manifest.skills || !manifest.skills[skillId]) {
    return null;
  }
  return manifest.skills[skillId];
}

async function generateSkillsManifest(installPath) {
  const skills = listSkills();
  const manifest = readManifest(installPath);
  if (!manifest || !manifest.skills) return;

  const manifestYamlPath = path.join(installPath, 'MANIFEST.yaml');
  let yamlContent = '# MANIFEST.yaml\n\nskills:\n';

  const skillIds = Object.keys(manifest.skills).sort();
  for (const skillId of skillIds) {
    const skill = skills.find(s => s.id === skillId);
    if (!skill) continue;

    yamlContent += `  - id: ${skillId}\n`;
    yamlContent += `    file: ${skillId}/SKILL.md\n`;
    yamlContent += `    description: ${skill.description}\n`;

    if (skill.applies_when && Array.isArray(skill.applies_when)) {
      yamlContent += '    applies_when:\n';
      skill.applies_when.forEach(cond => {
        yamlContent += `      - ${cond}\n`;
      });
    }

    if (skill.always_load) {
      yamlContent += '    always_load: true\n';
    }

    yamlContent += '\n';
  }

  await fs.writeFile(manifestYamlPath, yamlContent, 'utf-8');
  console.log(chalk.cyan(`    + Generated ${manifestYamlPath}`));
}

/**
 * Generate project-context.md content by stamping the template with installed agent MANIFEST paths.
 * @param {string} projectRoot - Absolute path to project root (unused for path generation but part of API)
 * @param {Array<{skillsDir: string}>} installedAgents - Agent objects with skillsDir property
 * @param {Object|null} [layout=null] - Repository layout from collectRepoLayout() (null for single-repo)
 * @returns {Promise<string>} Stamped template content string (does NOT write any file)
 */
async function generateProjectContext(projectRoot, installedAgents, layout = null) {
  let template;
  try {
    template = await fs.readFile(TEMPLATE_PATH, 'utf8');
  } catch (err) {
    throw new Error(`project-context template not found at ${TEMPLATE_PATH} — ma-agents installation may be corrupted: ${err.message}`);
  }

  const validAgents = installedAgents ? installedAgents.filter(a => a && a.skillsDir) : [];
  let manifestList;
  if (validAgents.length === 0) {
    manifestList = '  - (no agents installed — run ma-agents to install skills)';
  } else {
    manifestList = validAgents
      .map(a => `  - \`${a.skillsDir}/MANIFEST.yaml\``)
      .join('\n');
  }

  let content = template.replace('{{MANIFEST_PATHS_LIST}}', manifestList);

  // Replace repo layout placeholder (Story 16.3)
  const layoutSection = generateRepoLayoutSection(layout);
  if (layoutSection) {
    content = content.replace('{{REPO_LAYOUT_SECTION}}', '\n' + layoutSection + '\n');
  } else {
    // Clean removal: remove placeholder and avoid double blank lines
    content = content.replace(/\{\{REPO_LAYOUT_SECTION\}\}\r?\n/, '');
  }

  return content;
}

/**
 * Generate the Repository Layout markdown section for project-context.md.
 * Returns the section with markers for multi-repo, or empty string for single-repo/null layout.
 * @param {Object|null} layout - Layout object from collectRepoLayout()
 * @returns {string} Markdown section with markers, or empty string
 */
function generateRepoLayoutSection(layout) {
  if (!layout || !layout.knowledgebase || !layout.sprintManagement) return '';
  if (layout.knowledgebase.mode === 'same' && layout.sprintManagement.mode === 'same') return '';

  const normPath = (p) => (p || '.').replace(/\\/g, '/');
  const kbDisplay = layout.knowledgebase.mode === 'same'
    ? 'current repository (default)'
    : normPath(layout.knowledgebase.path);
  const spDisplay = layout.sprintManagement.mode === 'same'
    ? 'current repository (default)'
    : normPath(layout.sprintManagement.path);

  let lines = [
    '<!-- ma-agents:repo-layout-start -->',
    '### Repository Layout',
    `- **Knowledgebase:** ${kbDisplay}`,
    `- **Sprint Management:** ${spDisplay}`,
  ];

  if (layout.knowledgebase.mode !== 'same') {
    lines.push('- When creating or reading planning artifacts, use the knowledgebase path');
  }
  if (layout.sprintManagement.mode !== 'same') {
    lines.push('- When creating or reading sprint/story artifacts, use the sprint management path');
  }

  lines.push('<!-- ma-agents:repo-layout-end -->');
  return lines.join('\n');
}

/**
 * Update the Repository Layout section in an existing project-context.md.
 * Uses marker-based update pattern (same as manifest paths).
 * @param {string} outputPath - Absolute path to existing project-context.md
 * @param {Object|null} layout - Layout object from collectRepoLayout()
 * @returns {Promise<boolean>} true if file was written, false otherwise
 */
async function updateProjectContextRepoLayout(outputPath, layout) {
  let content;
  try {
    content = await fs.readFile(outputPath, 'utf8');
  } catch {
    return false;
  }

  const newSection = generateRepoLayoutSection(layout);
  const START = '<!-- ma-agents:repo-layout-start -->';
  const END = '<!-- ma-agents:repo-layout-end -->';
  const startIdx = content.indexOf(START);
  const endIdx = content.indexOf(END);

  if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
    // Markers exist — replace content between them
    if (newSection) {
      const newContent = content.slice(0, startIdx) + newSection + content.slice(endIdx + END.length);
      if (newContent === content) return false;
      await fs.writeFile(outputPath, newContent, 'utf8');
      return true;
    } else {
      // Single-repo: remove the entire section including markers and surrounding blank lines
      let before = content.slice(0, startIdx);
      let after = content.slice(endIdx + END.length);
      // Clean up trailing newline from before and leading newline from after
      if (before.endsWith('\n')) before = before.slice(0, -1);
      if (after.startsWith('\n')) after = after.slice(1);
      const newContent = before + '\n' + after;
      if (newContent === content) return false;
      await fs.writeFile(outputPath, newContent, 'utf8');
      return true;
    }
  }

  // Markers don't exist
  if (!newSection) return false; // single-repo, nothing to insert

  // Find insertion point: before "## Technology Stack"
  const techStackIdx = content.indexOf('## Technology Stack');
  if (techStackIdx === -1) {
    // Can't find expected structure — skip with info
    return false;
  }

  const newContent = content.slice(0, techStackIdx) + newSection + '\n\n' + content.slice(techStackIdx);
  await fs.writeFile(outputPath, newContent, 'utf8');
  return true;
}

/**
 * Update the MANIFEST paths section in an existing project-context.md.
 * Locates content between <!-- ma-agents:manifest-paths-start --> and
 * <!-- ma-agents:manifest-paths-end --> markers and replaces it with the
 * current agent list. Returns true if the file was updated, false if
 * markers were not found (old-format file — backward compatible) or if
 * the content was already up to date.
 * @param {string} outputPath - Absolute path to the existing project-context.md
 * @param {Array<{skillsDir: string}>} installedAgents - Agent objects with skillsDir property
 * @returns {Promise<boolean>} true if file was written, false otherwise
 */
async function updateProjectContextManifestPaths(outputPath, installedAgents) {
  const content = await fs.readFile(outputPath, 'utf8');
  const validAgents = installedAgents ? installedAgents.filter(a => a && a.skillsDir) : [];
  const newList = validAgents.length === 0
    ? '  - (no agents installed — run ma-agents to install skills)'
    : validAgents.map(a => `  - \`${a.skillsDir}/MANIFEST.yaml\``).join('\n');

  const START = '<!-- ma-agents:manifest-paths-start -->';
  const END = '<!-- ma-agents:manifest-paths-end -->';
  const startIdx = content.indexOf(START);
  const endIdx = content.indexOf(END);

  if (startIdx === -1 || endIdx === -1 || endIdx <= startIdx) {
    return false; // no markers — old-format file, skip silently (backward compatible)
  }

  const before = content.slice(0, startIdx + START.length);
  const after = content.slice(endIdx);
  const newContent = `${before}\n${newList}\n${after}`;

  if (newContent === content) {
    return false; // already up to date, no write needed
  }

  await fs.writeFile(outputPath, newContent, 'utf8');
  return true;
}

/**
 * Find the insertion point in content after all skipped headers.
 * For '---' pattern, skips YAML frontmatter block (opening --- on first line through closing ---).
 * @param {string} content - File content
 * @param {string[]} [skipPatterns] - Patterns to skip (currently supports '---' for YAML frontmatter)
 * @returns {number} Character index where injection should be inserted
 */
function findInsertionPoint(content, skipPatterns) {
  if (!content || !skipPatterns || skipPatterns.length === 0) {
    return 0;
  }

  let idx = 0;

  for (const pattern of skipPatterns) {
    if (pattern === '---') {
      // YAML frontmatter: must start at position 0 (or after leading whitespace)
      const trimmedStart = content.slice(idx).trimStart();
      const leadingWhitespace = content.length - idx - trimmedStart.length;

      if (!trimmedStart.startsWith('---')) {
        continue;
      }

      // Find the opening ---
      const openIdx = idx + leadingWhitespace;
      const afterOpen = content.indexOf('\n', openIdx);
      if (afterOpen === -1) {
        continue;
      }

      // Find the closing ---
      const closeIdx = content.indexOf('\n---', afterOpen);
      if (closeIdx === -1) {
        continue;
      }

      // Move past the closing --- line
      const afterClose = content.indexOf('\n', closeIdx + 1);
      if (afterClose === -1) {
        idx = content.length;
      } else {
        idx = afterClose + 1;
      }
    }
  }

  return idx;
}

/**
 * Story 21.2 AC #10 — canonical backup filename format.
 * Format: <target>.backup-<ISO-8601-timestamp> with colons replaced by hyphens
 * for Windows filename safety (e.g., .claude/CLAUDE.md.backup-2026-04-15T12-30-00Z).
 * Story 21.2 OWNS this format; stories 21.10 (reconfigure) and 21.11 (uninstall)
 * consume it. The date source is injectable to keep tests deterministic.
 */
function formatBackupTimestamp(date = new Date()) {
  // ISO 8601 with hyphens instead of colons and no milliseconds:
  // 2026-04-15T12-30-00Z
  return date.toISOString().replace(/\.\d{3}Z$/, 'Z').replace(/:/g, '-');
}

function buildBackupFilename(targetPath, date = new Date()) {
  const base = `${targetPath}.backup-${formatBackupTimestamp(date)}`;
  // Guard against sub-second re-runs clobbering a prior backup. If the canonical
  // name already exists on disk, append a ".N" suffix until we find a free slot.
  if (!fs.existsSync(base)) return base;
  let i = 1;
  while (fs.existsSync(`${base}.${i}`)) i++;
  return `${base}.${i}`;
}

/**
 * Story 21.2 AC #10 — marker-block drift handler.
 *
 * Called when the existing in-marker content differs from what
 * composeInstructionBlock would produce for the current profile. In interactive
 * mode (no --yes), prompts the user for confirmation. With --yes or when stdin
 * is not a TTY, emits the pinned WARNING line and proceeds. In all drift cases
 * where we proceed with the overwrite, a backup sibling file is written
 * containing ONLY the marker-block region (markers included).
 *
 * Throws if the user declines the interactive prompt, short-circuiting the
 * write in the caller.
 */
async function handleMarkerBlockDrift({ filePath, existingBlock, expectedBlock, yesMode }) {
  const backupPath = buildBackupFilename(filePath);

  // In non-interactive mode (yes mode or non-TTY), emit pinned warning and proceed.
  // In interactive mode, show diff preview and prompt for confirmation.
  const interactive = !yesMode && process.stdin.isTTY;

  if (interactive) {
    // Show a compact diff-style preview. We intentionally do not require a diff
    // library — the on-screen diff is informational only.
    console.log(chalk.yellow(`\nma-agents marker-block in ${filePath} was modified since last install.`));
    console.log(chalk.gray('--- current on-disk (inside markers) ---'));
    console.log(existingBlock);
    console.log(chalk.gray('--- expected (ma-agents) ---'));
    console.log(expectedBlock);
    const { proceed } = await prompts({
      type: 'confirm',
      name: 'proceed',
      message: `Overwrite and back up previous content to ${backupPath}?`,
      initial: false
    });
    if (!proceed) {
      throw new Error(`User declined to overwrite ma-agents marker block in ${filePath}`);
    }
  } else {
    // AC #10 pinned WARNING line (verbatim).
    console.log(
      `WARNING: ma-agents marker-block content modified since last install — overwriting. Previous content backed up to ${backupPath}`
    );
  }

  // Backup contains only the marker-block region (markers included).
  await fs.outputFile(backupPath, existingBlock, 'utf-8');
}

/**
 * Story 21.4 — markdown-markers merger for extraInstructionTemplates.
 *
 * Writes a marker-wrapped instruction block into a markdown target file. This
 * is the same marker-wrap contract used by updateAgentInstructions for
 * single-instructionFile agents (AC #5), lifted into a reusable helper so the
 * extraInstructionTemplates processor can dispatch on merger = 'markdown-markers'.
 *
 * Behavior (AC #5):
 *   - If target file does not exist: create it by writing the full template
 *     contents (including the leading "Generated by ma-agents" comment and
 *     the markers), with `composedBlock` placed between the MA-AGENTS markers.
 *   - If target exists with markers: replace in-marker content only; content
 *     outside markers is preserved byte-for-byte. Hand-edit drift detection
 *     (AC #11) uses the same handleMarkerBlockDrift helper as Story 21.2.
 *   - If target exists WITHOUT markers: append the marker block at EOF
 *     separated by one blank line. Existing content preserved.
 *
 * @param {string} targetPath - absolute path to the target file
 * @param {string} templateBody - static template text (from lib/templates/)
 * @param {string} composedBlock - the output of composeInstructionBlock(...)
 * @param {{ yesMode?: boolean }} opts
 * @returns {Promise<'created'|'updated'|'appended'|'skipped'>}
 */
async function markdownMarkersMerger(targetPath, templateBody, composedBlock, opts = {}) {
  const markerStart = '<!-- MA-AGENTS-START -->';
  const markerEnd = '<!-- MA-AGENTS-END -->';
  const yesMode = !!(opts.yesMode || process.env.MA_AGENTS_YES === '1');

  // Normalize composedBlock trailing whitespace once so first-insert and
  // in-place-replace both produce byte-identical in-marker content (NFR46).
  const normalized = composedBlock.replace(/\s+$/, '') + '\n';
  const wrappedBlock = `${markerStart}\n${normalized}${markerEnd}`;

  if (!fs.existsSync(targetPath)) {
    // AC #5 first bullet: fresh create — write leading comment + template, with
    // markers replaced to carry the composed content.
    const leadingComment = '<!-- Generated by ma-agents. Edit outside the MA-AGENTS-START/END markers to preserve your changes. -->\n';
    // The template already contains placeholder empty markers ("<!-- MA-AGENTS-START -->\n<!-- MA-AGENTS-END -->").
    // Replace the first such pair with the wrapped block. If the template has no markers,
    // the block is appended at EOF separated by one blank line (defensive — template ships with markers).
    const emptyMarkerPair = new RegExp(`${markerStart}\\s*\\n\\s*${markerEnd}`);
    let body;
    if (emptyMarkerPair.test(templateBody)) {
      body = templateBody.replace(emptyMarkerPair, wrappedBlock);
    } else {
      const trimmed = templateBody.replace(/\s+$/, '');
      body = trimmed + '\n\n' + wrappedBlock + '\n';
    }
    // Ensure single trailing newline.
    const finalBody = body.replace(/\s+$/, '') + '\n';
    await fs.outputFile(targetPath, leadingComment + finalBody, 'utf-8');
    console.log(chalk.cyan(`    + Created ${path.relative(path.dirname(targetPath), targetPath) === path.basename(targetPath) ? path.basename(targetPath) : targetPath}`));
    return 'created';
  }

  const content = await fs.readFile(targetPath, 'utf-8');
  const regex = new RegExp(`${markerStart}[\\s\\S]*?${markerEnd}`);
  const existingMatch = content.match(regex);

  if (existingMatch) {
    // AC #5 second bullet + AC #11 drift detection.
    const existingBlock = existingMatch[0];
    if (existingBlock === wrappedBlock) {
      // Byte-identical — idempotent no-op write to preserve mtime semantics would be
      // wasteful; just return. Outside-markers content is unchanged.
      return 'skipped';
    }
    // Drift: previous content differs from expected.
    try {
      await handleMarkerBlockDrift({
        filePath: targetPath,
        existingBlock,
        expectedBlock: wrappedBlock,
        yesMode
      });
    } catch (declineErr) {
      console.log(chalk.gray(`    Skipped ${path.basename(targetPath)} (user declined marker-block overwrite)`));
      return 'skipped';
    }
    const replaced = content.replace(regex, wrappedBlock);
    await fs.writeFile(targetPath, replaced, 'utf-8');
    console.log(chalk.cyan(`    + Updated ${path.basename(targetPath)}`));
    return 'updated';
  }

  // AC #5 third bullet: existing file, no markers — append marker block at EOF
  // separated by one blank line.
  const base = content.replace(/\s+$/, '');
  const appended = (base.length ? base + '\n\n' : '') + wrappedBlock + '\n';
  await fs.writeFile(targetPath, appended, 'utf-8');
  console.log(chalk.cyan(`    + Appended marker block to ${path.basename(targetPath)}`));
  return 'appended';
}

/**
 * Story 21.4 — process extraInstructionTemplates entries on an agent.
 *
 * For each { template, target, merger } entry:
 *   1. Resolve the source template file under lib/templates/.
 *   2. Call composeInstructionBlock({ profile, projectRoot }) exactly once per
 *      entry (canonical composer contract — Story 21.2, decision A).
 *   3. Dispatch on `merger`:
 *        - 'markdown-markers' → markdownMarkersMerger (this story)
 *        - 'yaml-customModes' → reserved for Story 21.3 (.roomodes)
 *   4. Per-entry MANIFEST_PATH substitution is applied to the composed string
 *      BEFORE the merger receives it (caller-owned per Story 21.2 AC #3).
 *
 * @param {object} agent - lib/agents.js entry
 * @param {string} projectRoot
 * @param {{ yesMode?: boolean }} opts
 */
async function stampExtraInstructionTemplates(agent, projectRoot, opts = {}) {
  if (!Array.isArray(agent.extraInstructionTemplates) || agent.extraInstructionTemplates.length === 0) {
    return;
  }

  // Resolve BMAD output dirs once per projectRoot (memoized + logged once).
  resolveBmadOutputDirs(projectRoot);

  const { getProfile } = require('./profile');
  const resolvedProfile = getProfile(projectRoot) || 'standard';
  const agentProjectPath = agent.getProjectPath();
  const relManifestPath = path.relative(projectRoot, path.join(agentProjectPath, 'MANIFEST.yaml')).replace(/\\/g, '/');

  for (const entry of agent.extraInstructionTemplates) {
    if (!entry || !entry.template || !entry.target || !entry.merger) {
      console.log(chalk.yellow(`    Warning: malformed extraInstructionTemplates entry on ${agent.id}, skipping`));
      continue;
    }
    const templatePath = path.join(EXTRA_TEMPLATE_DIR, entry.template);
    if (!fs.existsSync(templatePath)) {
      console.log(chalk.yellow(`    Warning: template not found at ${templatePath}, skipping`));
      continue;
    }
    const templateBody = fs.readFileSync(templatePath, 'utf-8');

    // Canonical composer contract: called exactly once per artifact.
    let composed = composeInstructionBlock({ profile: resolvedProfile, projectRoot });
    // Post-composition substitution is caller-owned (Story 21.2 AC #3).
    composed = composed.replace(/\{\{MANIFEST_PATH\}\}/g, relManifestPath);

    const targetPath = path.join(projectRoot, entry.target);

    if (entry.merger === 'markdown-markers') {
      await markdownMarkersMerger(targetPath, templateBody, composed, { yesMode: opts.yesMode });
    } else if (entry.merger === 'yaml-customModes') {
      // Story 21.3 — .roomodes YAML splice. The template contains
      // {{UNIVERSAL_BLOCK}} sentinels that must be expanded with the
      // composed block BEFORE the merger (caller-owned substitution, AC #2/#4).
      // Indent-preserving expansion keeps each line of the multi-line block
      // aligned with the YAML block-scalar indent of the sentinel.
      const composedTemplate = templateBody.replace(
        /^([ \t]*)\{\{UNIVERSAL_BLOCK\}\}/gm,
        (_m, indent) => composed
          .replace(/\s+$/, '')
          .split('\n')
          .map(line => indent + line)
          .join('\n')
      );
      const { mergeRoomodes } = require('./merge/roomodes');
      const existingYaml = fs.existsSync(targetPath)
        ? fs.readFileSync(targetPath, 'utf-8')
        : '';
      const mergedContent = mergeRoomodes(existingYaml, composedTemplate);

      // Backup if the target exists and content differs (Story 21.2 canonical format).
      if (fs.existsSync(targetPath)) {
        const existing = fs.readFileSync(targetPath, 'utf-8');
        if (existing !== mergedContent) {
          const backupPath = buildBackupFilename(targetPath);
          await fs.outputFile(backupPath, existing, 'utf-8');
        }
      }

      const tmpPath = targetPath + '.tmp';
      await fs.outputFile(tmpPath, mergedContent, 'utf-8');
      await fs.rename(tmpPath, targetPath);
      console.log(chalk.cyan(`    + Updated ${entry.target}`));
    } else {
      console.log(chalk.yellow(`    Warning: unknown merger '${entry.merger}' for ${agent.id}, skipping ${entry.target}`));
    }
  }
}

async function updateAgentInstructions(agent, projectRoot, opts = {}) {
  if (!agent.instructionFiles || agent.instructionFiles.length === 0) return;

  // Story 21.2 — yesMode resolution (AC #10): explicit opts.yesMode wins,
  // fall back to MA_AGENTS_YES env var (used by tests and subprocess flows).
  // The CLI passes yesMode via opts when --yes is set so non-interactive
  // installs do not hang on the drift-confirmation prompt.
  const yesMode = !!(opts.yesMode || process.env.MA_AGENTS_YES === '1');

  // Story 21.2 — resolve profile once per stamped artifact; compose the universal
  // (+ on-prem when applicable) block once; mergers consume the already-composed string.
  // Lazy require avoids potential circular-import pitfalls at module load (profile.js
  // already lazy-requires installer for the ensureManifest bootstrap path).
  const { getProfile } = require('./profile');
  const resolvedProfile = getProfile(projectRoot) || 'standard';
  const composedTemplate = composeInstructionBlock({ profile: resolvedProfile, projectRoot });

  // JSON merge strategy (e.g., OpenCode)
  // OpenCode expects instructions to be plain strings, not objects.
  // We identify our entries by a marker prefix in the string content,
  // and also clean up legacy object-format entries from older versions.
  if (agent.injectionStrategy?.position === 'json-merge') {
    const targetKey = agent.injectionStrategy.targetKey || 'instructions';
    const filePath = path.join(projectRoot, agent.instructionFiles[0]);
    const agentProjectPath = agent.getProjectPath();
    const relManifestPath = path.relative(projectRoot, path.join(agentProjectPath, 'MANIFEST.yaml')).replace(/\\/g, '/');
    // Story 21.2 — substitute {{MANIFEST_PATH}} AFTER composition (caller-owned, per AC #3).
    // Prefix with [ma-agents] tag so the isMaEntry filter identifies the entry on re-install.
    const instructionBody = composedTemplate.replace(/\{\{MANIFEST_PATH\}\}/g, relManifestPath);
    const instructionText = `[${MA_AGENTS_SOURCE}] ${instructionBody}`.replace(/\s+$/, '');

    const isMaEntry = (entry) =>
      (typeof entry === 'string' && entry.startsWith(`[${MA_AGENTS_SOURCE}]`)) ||
      (typeof entry === 'object' && entry != null && entry._source === MA_AGENTS_SOURCE);

    // Story 21.4 AC #6, #7 — collect any extra path-string entries that must be
    // appended to the JSON array (e.g., literal "AGENTS.md" for OpenCode). These
    // entries are USER-OWNED after first install (no [ma-agents] prefix → the
    // isMaEntry filter does NOT match them → never re-appended, never removed
    // by subsequent installs). Dedup uses strict string equality per AC #6.
    const extraJsonEntries = [];
    if (Array.isArray(agent.extraInstructionTemplates)) {
      for (const tpl of agent.extraInstructionTemplates) {
        if (tpl && tpl.merger === 'markdown-markers' && typeof tpl.target === 'string') {
          extraJsonEntries.push(tpl.target);
        }
      }
    }

    if (!fs.existsSync(filePath)) {
      // File absent: create fresh (atomic write)
      const data = { [targetKey]: [instructionText, ...extraJsonEntries] };
      const tmpPath = filePath + '.tmp';
      await fs.outputFile(tmpPath, JSON.stringify(data, null, 2), 'utf-8');
      await fs.rename(tmpPath, filePath);
      console.log(chalk.cyan(`    + Created ${agent.instructionFiles[0]}`));
      // Continue to stamp extra templates below (e.g., AGENTS.md).
    } else {
      // File present: read and merge
      try {
        const content = await fs.readFile(filePath, 'utf-8');
        const data = JSON.parse(content);
        if (!Array.isArray(data[targetKey])) {
          data[targetKey] = [];
        }
        // Filter out stale ma-agents entries (string or legacy object format), keep user entries
        const userEntries = data[targetKey].filter(entry => entry != null && !isMaEntry(entry));
        // Story 21.4 AC #6 — append extraJsonEntries (e.g., "AGENTS.md") using strict
        // string-equality dedup against userEntries so pre-existing user additions
        // are not duplicated. AC #7: entries lack the [ma-agents] prefix and are
        // therefore user-owned after first install.
        const missingExtras = extraJsonEntries.filter(e => !userEntries.includes(e));
        data[targetKey] = [...userEntries, instructionText, ...missingExtras];
        // Atomic write: temp file then rename
        const tmpPath = filePath + '.tmp';
        await fs.outputFile(tmpPath, JSON.stringify(data, null, 2), 'utf-8');
        await fs.rename(tmpPath, filePath);
        console.log(chalk.cyan(`    + Updated ${agent.instructionFiles[0]}`));
      } catch (err) {
        console.error(`[${MA_AGENTS_SOURCE}] ERROR: Could not parse ${filePath} — ${err.message}. File not modified.`);
        return; // non-fatal: do NOT re-throw
      }
    }

    // Story 21.4 — stamp any extraInstructionTemplates (e.g., AGENTS.md) after
    // the JSON-merge branch. This path does not fall through to the markdown
    // marker-wrap below because `instructionFiles: ['opencode.json']` is JSON.
    await stampExtraInstructionTemplates(agent, projectRoot, { yesMode });
    return;
  }

  const agentProjectPath = agent.getProjectPath();
  const relManifestPath = path.relative(projectRoot, path.join(agentProjectPath, 'MANIFEST.yaml')).replace(/\\/g, '/');

  // Story 21.2 — replace the previously-hardcoded planningInstruction with the
  // composed block. {{MANIFEST_PATH}} substitution happens AFTER composition
  // (caller-owned per AC #3). The leading "\n" preserves the historical shape
  // of the wrapped instruction so existing markers keep the same layout.
  const planningInstruction = '\n' + composedTemplate.replace(/\{\{MANIFEST_PATH\}\}/g, relManifestPath);

  const markerStart = '<!-- MA-AGENTS-START -->';
  const markerEnd = '<!-- MA-AGENTS-END -->';
  // NFR46: normalize once so first-insert and in-place-replace produce
  // byte-identical marker-block content. Both paths now use `.trim()` + '\n'.
  const wrappedInstruction = `${markerStart}${planningInstruction}${markerEnd}`;
  const wrappedInstructionWithTrailingNewline = wrappedInstruction + '\n';

  // Story 21.5 AC #6 — Cline dual-file drift detection.
  // Runs BEFORE the file loop so we abort cleanly without partial writes.
  // `--yes` does NOT bypass (explicit documented exception, AC #6).
  if (agent.id === 'cline') {
    checkClinerulesDualFileDrift(projectRoot);
  }

  // Story 21.5 AC #1, #2 — optional framing template for fresh Cline file creation.
  // The composer produces the universal body once; the framing supplies the
  // Cline-flavored header paragraph + Architect-mode guidance line. Framing is
  // only used when creating a NEW file — existing files go through the normal
  // marker-replace path so user content outside markers is preserved (AC #4).
  let frameworkTemplate = null;
  if (agent.id === 'cline' && fs.existsSync(CLINERULES_TEMPLATE_PATH)) {
    frameworkTemplate = fs.readFileSync(CLINERULES_TEMPLATE_PATH, 'utf-8');
  }

  for (const fileName of agent.instructionFiles) {
    const filePath = path.join(projectRoot, fileName);
    let content = '';

    if (fs.existsSync(filePath)) {
      content = await fs.readFile(filePath, 'utf-8');

      const regex = new RegExp(`${markerStart}[\\s\\S]*?${markerEnd}`, 'g');
      const existingMatch = content.match(regex);
      if (existingMatch) {
        // AC #10 — upgrade-safety: detect hand-edits to the marker block and back up.
        const existingBlock = existingMatch[0];
        if (existingBlock !== wrappedInstruction) {
          let proceedWithOverwrite = true;
          try {
            await handleMarkerBlockDrift({
              filePath,
              existingBlock,
              expectedBlock: wrappedInstruction,
              yesMode
            });
          } catch (declineErr) {
            // User declined in interactive mode — leave file unchanged for this agent file.
            proceedWithOverwrite = false;
            console.log(chalk.gray(`    Skipped ${fileName} (user declined marker-block overwrite)`));
          }
          if (!proceedWithOverwrite) continue;
        }
        // Replace existing block in-place (AC #2)
        content = content.replace(regex, wrappedInstruction);
      } else {
        // Top-insert: place after skipped headers (AC #1, #3)
        const strategy = agent.injectionStrategy || { position: 'top', skipPatterns: [] };
        const insertIdx = findInsertionPoint(content, strategy.skipPatterns);
        content = content.slice(0, insertIdx) + wrappedInstructionWithTrailingNewline + '\n' + content.slice(insertIdx);
      }
    } else if (agent.category === 'bmad') {
      // BMAD agent instruction files ARE the agent definitions (persona, menu, activation).
      // Never create them from scratch — they must be deployed by applyCustomizations().
      // Creating them here would produce a file with ONLY the MA-AGENTS block,
      // wiping the entire agent definition.
      console.log(chalk.gray(`    Skipped ${fileName} (BMAD agent file not yet deployed)`));
      continue;
    } else if (frameworkTemplate) {
      // Story 21.5 AC #1/#2 — fresh Cline file: wrap the composed block in
      // the Cline-flavored framing template (header paragraph + Architect-mode
      // guidance line). The framing contains empty MA-AGENTS markers that we
      // replace with the wrapped block. Cross-file byte-identity by construction
      // is preserved because both `.cline/clinerules.md` and `.clinerules`
      // receive the SAME rendered string in this single loop pass.
      const emptyMarkerPair = new RegExp(`${markerStart}\\s*\\n\\s*${markerEnd}`);
      let framed;
      if (emptyMarkerPair.test(frameworkTemplate)) {
        framed = frameworkTemplate.replace(emptyMarkerPair, wrappedInstruction);
      } else {
        // Defensive: framing shipped without markers — append block at EOF.
        const trimmed = frameworkTemplate.replace(/\s+$/, '');
        framed = trimmed + '\n\n' + wrappedInstruction + '\n';
      }
      content = framed.replace(/\s+$/, '') + '\n';
    } else {
      // New non-BMAD file: block is sole content (AC #1, #3)
      content = wrappedInstructionWithTrailingNewline;
    }

    await fs.outputFile(filePath, content, 'utf-8');
    console.log(chalk.cyan(`    + Updated ${fileName}`));
  }

  // Story 21.4 — stamp any extraInstructionTemplates on non-JSON-merge agents
  // (forward-compat for Story 21.3 .roomodes and Story 21.5 .clinerules).
  await stampExtraInstructionTemplates(agent, projectRoot, { yesMode });
}

// Story 21.3's parallel applyExtraInstructionTemplates was consolidated during
// rebase onto Story 21.4's canonical stampExtraInstructionTemplates dispatcher
// (see above) — the yaml-customModes merger branch lives there now.

/**
 * Compare two semver strings. Returns -1, 0, or 1.
 */
function compareSemver(a, b) {
  const pa = (a || '0.0.0').split('.').map(Number);
  const pb = (b || '0.0.0').split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if (pa[i] > pb[i]) return 1;
    if (pa[i] < pb[i]) return -1;
  }
  return 0;
}

// --- Skill listing ---

function listSkills() {
  const skillsDir = path.join(__dirname, '..', 'skills');

  if (!fs.existsSync(skillsDir)) {
    return [];
  }

  const skillDirs = fs.readdirSync(skillsDir, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .map(dirent => dirent.name);

  return skillDirs.map(skillDir => {
    const metaPath = path.join(skillsDir, skillDir, 'skill.json');

    if (!fs.existsSync(metaPath)) {
      return null;
    }

    const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
    return {
      id: skillDir,
      ...meta
    };
  }).filter(Boolean);
}

function listAgents() {
  return getAllAgents();
}

// --- Core install logic (no prompts) ---

async function performInstall(skillId, skill, agent, installPath) {
  const skillSourceDir = path.join(__dirname, '..', 'skills', skillId);
  let sourceFile = path.join(skillSourceDir, `${agent.template}${agent.fileExtension}`);

  if (!fs.existsSync(sourceFile)) {
    sourceFile = path.join(skillSourceDir, `generic${agent.fileExtension}`);
  }

  if (!fs.existsSync(sourceFile)) {
    const skillMdPath = path.join(skillSourceDir, 'SKILL.md');
    if (fs.existsSync(skillMdPath)) {
      sourceFile = skillMdPath;
    }
  }

  if (!fs.existsSync(sourceFile)) {
    console.log(chalk.yellow(`    Warning: No template found for ${agent.name}, skipping`));
    return false;
  }

  const skillDir = path.join(installPath, skillId);
  await fs.ensureDir(skillDir);

  let content = await fs.readFile(sourceFile, 'utf-8');

  // Strip any existing YAML frontmatter from the source
  const frontmatterRegex = /^---\s*\n[\s\S]*?\n---\s*\n/;
  content = content.replace(frontmatterRegex, '');

  // Inject YAML frontmatter from skill.json (single source of truth)
  const frontmatter = [
    '---',
    `name: ${skill.name}`,
    `description: ${skill.description}`,
    '---',
    ''
  ].join('\n');
  content = frontmatter + content;

  const targetFile = path.join(skillDir, 'SKILL.md');
  await fs.writeFile(targetFile, content, 'utf-8');
  console.log(chalk.green(`    + Installed to ${targetFile}`));

  // Copy bundled resources
  const resourceMap = agent.resourceMap || {};
  const resourceDirs = ['scripts', 'references', 'assets', 'examples', 'hooks', 'docs', 'templates'];
  for (const dir of resourceDirs) {
    const resourceSource = path.join(skillSourceDir, dir);
    if (fs.existsSync(resourceSource)) {
      const targetDirName = resourceMap[dir] || dir;
      const resourceTarget = path.join(skillDir, targetDirName);
      await fs.copy(resourceSource, resourceTarget);
      console.log(chalk.green(`    + Copied ${dir}/ → ${targetDirName}/`));
    }
  }

  // Copy template.md if it exists
  const templateSource = path.join(skillSourceDir, 'template.md');
  if (fs.existsSync(templateSource)) {
    await fs.copy(templateSource, path.join(skillDir, 'template.md'));
    console.log(chalk.green(`    + Copied template.md`));
  }

  return true;
}

// --- Install with upgrade detection ---

async function installSkill(skillId, agentIds, customPath = '', scope = 'project', options = {}) {
  const { force = false, yes = false } = options;

  // Task 4.3: Pre-set batch global action for non-interactive mode (shared batchState reference)
  if (yes && options.batchState && !options.batchState.globalAction) {
    options.batchState.globalAction = 'update';
  }

  const skills = listSkills();
  const skill = skills.find(s => s.id === skillId);

  if (!skill) {
    throw new Error(`Skill '${skillId}' not found. Run "list" to see available skills.`);
  }

  console.log(chalk.cyan(`\nInstalling skill: ${skill.name} v${skill.version}`));

  // Group agents by their resolved install path to avoid redundant installs
  const pathGroups = new Map();
  for (const agentId of agentIds) {
    const agent = getAgent(agentId);
    if (!agent) {
      console.log(chalk.yellow(`  Warning: Skipping unknown agent: ${agentId}`));
      continue;
    }
    const installPath = customPath || (scope === 'global' ? agent.getGlobalPath() : agent.getProjectPath());
    if (!installPath) {
      console.log(chalk.yellow(`  Warning: Agent '${agent.name}' does not support ${scope} installation, skipping`));
      continue;
    }
    if (!pathGroups.has(installPath)) {
      pathGroups.set(installPath, []);
    }
    pathGroups.get(installPath).push({ agentId, agent });
  }

  // Guard: project-context generation runs at most once per installSkill() call.
  // pathGroups can have multiple entries when agents share paths; without this flag
  // the generation would fire once per path group, producing redundant file I/O.
  let projectContextHandled = false;

  for (const [installPath, agentEntries] of pathGroups) {
    const primaryAgent = agentEntries[0].agent;
    const agentNames = agentEntries.map(e => e.agent.name).join(', ');

    try {
      await fs.ensureDir(installPath);

      const installed = getInstalledSkillInfo(installPath, skillId);

      if (installed && !force) {
        const cmp = compareSemver(skill.version, installed.version);

        let action;

        // Check if a global action was already chosen for this batch
        const batchState = options.batchState || {};

        if (batchState.globalAction) {
          action = batchState.globalAction;
        } else if (cmp > 0) {
          // Upgrade available
          console.log(chalk.yellow(`  ${skill.name} v${installed.version} → v${skill.version} update available for ${agentNames}`));
          const { choice } = await prompts({
            type: 'select',
            name: 'choice',
            message: 'What would you like to do?',
            choices: [
              { title: 'Update (recommended)', value: 'update' },
              { title: 'Update all remaining', value: 'update-all' },
              { title: 'Skip (keep current)', value: 'skip' },
              { title: 'Skip all remaining', value: 'skip-all' },
              { title: 'Clean reinstall', value: 'reinstall' },
              { title: 'Remove (uninstall)', value: 'remove' }
            ]
          });
          // Task 4.4: Guard against unexpected prompts in non-interactive mode
          if (yes && choice === undefined) {
            console.error(chalk.red('Error: Unexpected interactive prompt in non-interactive mode'));
            process.exit(1);
          }
          action = choice;
        } else if (cmp === 0) {
          // Same version
          console.log(chalk.gray(`  ${skill.name} v${installed.version} already installed for ${agentNames}`));
          const { choice } = await prompts({
            type: 'select',
            name: 'choice',
            message: 'What would you like to do?',
            choices: [
              { title: 'Skip (keep current)', value: 'skip' },
              { title: 'Skip all remaining', value: 'skip-all' },
              { title: 'Clean reinstall', value: 'reinstall' },
              { title: 'Remove (uninstall)', value: 'remove' }
            ]
          });
          // Task 4.4: Guard against unexpected prompts in non-interactive mode
          if (yes && choice === undefined) {
            console.error(chalk.red('Error: Unexpected interactive prompt in non-interactive mode'));
            process.exit(1);
          }
          action = choice;
        } else {
          // Downgrade
          console.log(chalk.yellow(`  ${skill.name} v${installed.version} installed, package has v${skill.version} for ${agentNames}`));
          const { choice } = await prompts({
            type: 'select',
            name: 'choice',
            message: 'What would you like to do?',
            choices: [
              { title: 'Skip (keep current)', value: 'skip' },
              { title: 'Skip all remaining', value: 'skip-all' },
              { title: `Downgrade to v${skill.version}`, value: 'update' },
              { title: `Downgrade all to package version`, value: 'update-all' },
              { title: 'Remove (uninstall)', value: 'remove' }
            ]
          });
          // Task 4.4: Guard against unexpected prompts in non-interactive mode
          if (yes && choice === undefined) {
            console.error(chalk.red('Error: Unexpected interactive prompt in non-interactive mode'));
            process.exit(1);
          }
          action = choice;
        }

        if (!action) {
          console.log(chalk.gray(`    Skipped`));
          continue;
        }

        // Handle global actions
        if (action === 'update-all') {
          batchState.globalAction = 'update';
          action = 'update';
        } else if (action === 'skip-all') {
          batchState.globalAction = 'skip';
          action = 'skip';
        }

        if (action === 'skip') {
          console.log(chalk.gray(`    Skipped`));
          continue;
        }

        if (action === 'remove') {
          await performUninstall(skillId, installPath);
          const manifest = ensureManifest(installPath, agentEntries[0].agentId, scope);
          delete manifest.skills[skillId];
          writeManifest(installPath, manifest);
          console.log(chalk.green(`    - Removed ${skill.name} from ${agentNames}`));

          // Generate MANIFEST.yaml and update agent instruction files
          await generateSkillsManifest(installPath);
          if (scope === 'project') {
            for (const entry of agentEntries) {
              await updateAgentInstructions(entry.agent, process.cwd(), { yesMode: yes });
            }
          }
          continue;
        }

        if (action === 'reinstall') {
          await performUninstall(skillId, installPath);
        }

        // action === 'update' or 'reinstall' → proceed to install below
      }

      if (!installed || force) {
        console.log(chalk.gray(`  Installing for ${agentNames}...`));
      }

      // Perform the install ONCE for this shared path
      const success = await performInstall(skillId, skill, primaryAgent, installPath);

      if (success) {
        // Update manifest with ALL agents that share this path
        const manifest = ensureManifest(installPath, agentEntries[0].agentId, scope);
        for (const entry of agentEntries) {
          if (!manifest.agents.includes(entry.agentId)) {
            manifest.agents.push(entry.agentId);
          }
        }
        manifest.agent = manifest.agents[0];

        const now = new Date().toISOString();
        const existing = manifest.skills[skillId];
        manifest.skills[skillId] = {
          version: skill.version,
          installedAt: existing ? existing.installedAt : now,
          updatedAt: now,
          installerVersion: getPackageVersion(),
          agentVersion: primaryAgent.version
        };
        writeManifest(installPath, manifest);
        ensureBmadOutputTracked(installPath);
        // F2a — the plugin-stage gitignore policy was previously applied here
        // with `installPath` (the per-agent skills directory), which produced
        // per-skill-dir `.gitignore` files instead of one project-root file.
        // The single invocation now lives next to `stagePlugin(projectRoot)` in
        // `lib/bmad.js` (see `ensurePluginStageGitignoredForProject` callers in
        // installBmad / runMigration / updateBmad). Story 22.8 AC #1 / AC #5
        // are satisfied at the project-root level; the per-agent path here
        // would never have been the correct write target.

        // Generate MANIFEST.yaml and update instruction files for ALL agents
        await generateSkillsManifest(installPath);
        if (scope === 'project') {
          for (const entry of agentEntries) {
            await updateAgentInstructions(entry.agent, process.cwd(), { yesMode: yes });
            // Story 21.4 — updateAgentInstructions now internally invokes
            // stampExtraInstructionTemplates, which handles per-agent extra
            // templates (e.g., Roo Code .roomodes via merger 'yaml-customModes',
            // OpenCode AGENTS.md via merger 'markdown-markers'). No sibling
            // call needed here.
          }
          // Deploy Claude Code hook when skills are installed for claude-code
          if (includesClaudeCode(agentEntries)) {
            await deployClaudeCodeHook(process.cwd());
          }
          // Generate project-context.md on first install; update manifest paths on subsequent installs.
          // Bug B2 — also run obsolete-tool-dir cleanup on the first successful path-group iteration.
          // Guard: runs at most once per installSkill() call — pathGroups may have multiple entries
          // when agents share install paths, so without this flag these would fire redundantly.
          if (!projectContextHandled) {
            projectContextHandled = true;
            // Bug B2 — clean up stale tool-level skill directories left by earlier routing migrations.
            try {
              await migrateObsoleteToolDirs(process.cwd());
            } catch (err) {
              console.log(chalk.yellow(`⚠ obsolete-tool-dir cleanup failed: ${err.message} — continuing install`));
            }
            const projectRoot = process.cwd();
            const outputPath = path.join(projectRoot, '_bmad-output', 'project-context.md');
            const allAgents = getManifestAgents(manifest).map(id => getAgent(id)).filter(Boolean);
            try {
              await fs.ensureDir(path.join(projectRoot, '_bmad-output'));
              if (await fs.pathExists(outputPath)) {
                const updated = await updateProjectContextManifestPaths(outputPath, allAgents);
                if (updated) {
                  console.log(chalk.green('✓ project-context.md manifest paths updated'));
                } else {
                  console.log(chalk.blue('ℹ project-context.md already up to date'));
                }
              } else {
                const content = await generateProjectContext(projectRoot, allAgents);
                await fs.writeFile(outputPath, content, 'utf8');
                console.log(chalk.green('✓ project-context.md generated at _bmad-output/project-context.md'));
              }
            } catch (err) {
              console.log(chalk.yellow(`⚠ project-context generation failed: ${err.message} — continuing install`));
            }
          }
        }
      }
    } catch (error) {
      console.log(chalk.red(`    x Failed: ${error.message}`));
    }
  }
}

// --- Uninstall ---

async function performUninstall(skillId, installPath) {
  const skillDir = path.join(installPath, skillId);
  if (fs.existsSync(skillDir)) {
    await fs.remove(skillDir);
  }
}

/**
 * Story 22.3 / 22.2 — Legacy skill retirement + rename migration (AC 7).
 *
 * BMAD v6.3.0 retired four upstream skills:
 *   - bmad-init                         (upstream PR #2159 — agents read _bmad/bmm/config.yaml directly)
 *   - bmad-agent-qa                     (Quinn — merged into Amelia in PR #2186)
 *   - bmad-agent-sm                     (Bob   — merged into Amelia in PR #2179)
 *   - bmad-agent-quick-flow-solo-dev    (Barry — merged into Amelia in PR #2177)
 *
 * Story 22.2 additionally renamed the five ma-agents custom-agent skills out of
 * the upstream-reserved `bmad-*` prefix:
 *   - bmad-ma-agent-cyber   → ma-agent-cyber
 *   - bmad-ma-agent-devops  → ma-agent-devops
 *   - bmad-ma-agent-sre     → ma-agent-sre
 *   - bmad-ma-agent-ml      → ma-agent-ml
 *   - bmad-ma-agent-sqa     → ma-agent-sqa
 *
 * Both retirements and renames produce the same stale-artifact problem: existing
 * ma-agents installs may still carry the old IDs in `.ma-agents.json` and still
 * have the old folders deployed under each agent's skill root. This helper sweeps
 * every agent install path and, for every obsolete ID (retired or renamed):
 *   1. removes the ID from the manifest's `skills` map
 *   2. deletes the installed skill directory under the agent's skill root
 *   3. regenerates MANIFEST.yaml so the deployed manifest drops the obsolete IDs
 *
 * The follow-up install step re-adds the renamed skills under their new IDs, so
 * users effectively see a one-shot upgrade — no manual cleanup, no dangling
 * duplicates. The migration is idempotent — running it again on a clean install
 * is a no-op.
 *
 * Returns the list of per-path migration actions (for testability and logging).
 */
const RETIRED_SKILL_IDS = Object.freeze([
  'bmad-init',
  'bmad-agent-qa',
  'bmad-agent-sm',
  'bmad-agent-quick-flow-solo-dev'
]);

// Skills that were renamed (not retired). The new ID is installed fresh by
// the regular install flow after migration clears the old ID.
const RENAMED_SKILL_IDS = Object.freeze([
  'bmad-ma-agent-cyber',
  'bmad-ma-agent-devops',
  'bmad-ma-agent-sre',
  'bmad-ma-agent-ml',
  'bmad-ma-agent-sqa'
]);

// Union of every obsolete ID the sweep must purge from existing installs.
// Kept as a frozen array so accidental mutation is surfaced at test time.
const OBSOLETE_SKILL_IDS = Object.freeze([...RETIRED_SKILL_IDS, ...RENAMED_SKILL_IDS]);

// Registry of old tool-level skill directories that earlier ma-agents versions
// wrote to but no longer use. Each entry describes one migration:
//   obsolete     — the legacy path (relative to project root)
//   replacedBy   — the current path that skills are now written to
//   sinceVersion — the ma-agents release that made the change (informational)
//
// Story 24.11 (AC5) will add additional entries to this list when .agents/skills/
// cross-tool routing is assessed. Define new entries here; `migrateObsoleteToolDirs`
// iterates the registry automatically.
//
// Kept frozen so accidental mutation is surfaced at test time.
const OBSOLETE_TOOL_SKILL_DIRS = Object.freeze([
  // Pre-F2b (PR #70) copilot wrote skills to .github/copilot/skills;
  // F2b realigned the target to .github/skills to match the BMAD upstream path.
  { obsolete: '.github/copilot/skills', replacedBy: '.github/skills', sinceVersion: '3.7.0' },
  // bmad-method 6.5.0 moved github-copilot, roo, and kilo platforms from
  // tool-specific paths to the shared .agents/skills/ directory.
  { obsolete: '.github/skills', replacedBy: '.agents/skills', sinceVersion: '3.8.1' },
  { obsolete: '.roo/skills', replacedBy: '.agents/skills', sinceVersion: '3.8.1' },
  { obsolete: '.kilocode/skills', replacedBy: '.agents/skills', sinceVersion: '3.8.1' }
]);

async function migrateRetiredSkills(options = {}) {
  const { scope = 'project', customPath = '' } = options;
  const results = [];

  // Build the list of install paths to sweep. We consider every registered
  // agent for the requested scope — the retirement/rename is agent-agnostic.
  const pathsSeen = new Set();
  const targetPaths = [];

  if (customPath) {
    targetPaths.push(customPath);
  } else {
    for (const agent of getAllAgents()) {
      const p = scope === 'global' ? agent.getGlobalPath() : agent.getProjectPath();
      if (p && !pathsSeen.has(p)) {
        pathsSeen.add(p);
        targetPaths.push(p);
      }
    }
  }

  for (const installPath of targetPaths) {
    let manifestMutated = false;
    let filesRemoved = 0;
    const removedIds = [];
    let pathError = null;

    try {
      // Read manifest (if any). Missing manifest is fine — we still check for
      // orphaned skill directories left behind by a partial uninstall.
      const manifest = readManifest(installPath);

      for (const obsoleteId of OBSOLETE_SKILL_IDS) {
        // 1. Manifest entry cleanup
        if (manifest && manifest.skills && Object.prototype.hasOwnProperty.call(manifest.skills, obsoleteId)) {
          delete manifest.skills[obsoleteId];
          manifestMutated = true;
          removedIds.push(obsoleteId);
        }

        // 2. Installed-directory cleanup — guard against ENOENT (idempotency)
        const skillDir = path.join(installPath, obsoleteId);
        if (fs.existsSync(skillDir)) {
          try {
            await fs.remove(skillDir);
            filesRemoved++;
            if (!removedIds.includes(obsoleteId)) {
              removedIds.push(obsoleteId);
            }
          } catch (err) {
            // Non-fatal — surface the path so the user can clean up manually.
            console.log(chalk.yellow(`    ! Could not remove ${skillDir}: ${err.message}`));
          }
        }
      }

      if (manifestMutated) {
        writeManifest(installPath, manifest);
      }

      if (manifestMutated || filesRemoved > 0) {
        // Regenerate the deployed MANIFEST.yaml so AC 1 is satisfied for
        // existing installs — the file is derived from `.ma-agents.json::skills`.
        if (manifest && manifest.skills) {
          try {
            await generateSkillsManifest(installPath);
          } catch (err) {
            console.log(chalk.yellow(`    ! MANIFEST.yaml regeneration skipped for ${installPath}: ${err.message}`));
          }
        }
        console.log(chalk.green(
          `  - Cleaned ${removedIds.length} obsolete skill(s) at ${installPath}: ${removedIds.join(', ')}`
        ));
      }
    } catch (err) {
      // Isolate per-path failures so one broken install path does not
      // abort the sweep across all other agents.
      pathError = err;
      console.log(chalk.yellow(
        `    ! Obsolete-skill migration failed for ${installPath}: ${err.message}`
      ));
    }

    results.push({ installPath, removedIds, filesRemoved, manifestMutated, error: pathError });
  }

  return results;
}

/**
 * Bug B2 — Stale copilot skills dir cleanup (and future obsolete tool-dir migrations).
 *
 * Iterates `OBSOLETE_TOOL_SKILL_DIRS` and, for each entry, checks whether the
 * legacy directory exists under `projectRoot`. Behaviour per entry:
 *
 *   - Obsolete dir absent          → no-op (idempotent)
 *   - Obsolete dir present AND
 *     replacedBy dir has content   → remove obsolete dir, log info message
 *   - Obsolete dir present BUT
 *     replacedBy dir is empty/gone → preserve obsolete dir, log warning
 *                                    (user may have local edits; safer to keep)
 *
 * @param {string} projectRoot — absolute path to the project root (process.cwd() in production)
 * @returns {Promise<Array<{entry, action, obsoletePath, replacedByPath, error}>>}
 */
async function migrateObsoleteToolDirs(projectRoot) {
  const results = [];

  for (const entry of OBSOLETE_TOOL_SKILL_DIRS) {
    const obsoletePath = path.join(projectRoot, entry.obsolete);
    const replacedByPath = path.join(projectRoot, entry.replacedBy);
    let action = 'noop';
    let error = null;

    try {
      if (!fs.existsSync(obsoletePath)) {
        // Nothing to do — already clean.
        action = 'noop';
      } else {
        // Check whether the replacement directory has any content.
        let replacedByHasContent = false;
        if (fs.existsSync(replacedByPath)) {
          const entries = fs.readdirSync(replacedByPath);
          replacedByHasContent = entries.length > 0;
        }

        if (replacedByHasContent) {
          // Safe to remove — skills have been migrated to the new location.
          await fs.remove(obsoletePath);
          action = 'removed';
          console.log(chalk.green(
            `  - Removed legacy tool skills directory ${entry.obsolete} ` +
            `(moved to ${entry.replacedBy} in v${entry.sinceVersion})`
          ));
        } else {
          // Replacement is absent or empty — do not silently destroy user content.
          action = 'preserved';
          console.log(chalk.yellow(
            `  ! Legacy tool skills directory ${entry.obsolete} was not removed ` +
            `because ${entry.replacedBy} is empty or absent. ` +
            `Remove it manually once you have confirmed there is nothing to keep: ` +
            `rm -rf ${entry.obsolete}`
          ));
        }
      }
    } catch (err) {
      action = 'error';
      error = err;
      console.log(chalk.yellow(
        `  ! Could not migrate obsolete tool dir ${entry.obsolete}: ${err.message}`
      ));
    }

    results.push({ entry, action, obsoletePath, replacedByPath, error });
  }

  return results;
}

async function uninstallSkill(skillId, agentIds, customPath = '', scope = 'project') {
  console.log(chalk.cyan(`\nUninstalling skill: ${skillId}`));

  // Group agents by their resolved install path
  const pathGroups = new Map();
  for (const agentId of agentIds) {
    const agent = getAgent(agentId);
    if (!agent) {
      console.log(chalk.yellow(`  Warning: Skipping unknown agent: ${agentId}`));
      continue;
    }
    const installPath = customPath || (scope === 'global' ? agent.getGlobalPath() : agent.getProjectPath());
    if (!installPath) {
      console.log(chalk.yellow(`  Warning: Agent '${agent.name}' does not support ${scope} scope, skipping`));
      continue;
    }
    if (!pathGroups.has(installPath)) {
      pathGroups.set(installPath, []);
    }
    pathGroups.get(installPath).push({ agentId, agent });
  }

  for (const [installPath, agentEntries] of pathGroups) {
    try {
      const installed = getInstalledSkillInfo(installPath, skillId);

      if (!installed) {
        const skillDir = path.join(installPath, skillId);
        if (fs.existsSync(skillDir)) {
          await performUninstall(skillId, installPath);
          console.log(chalk.green(`  - Removed ${skillId} from ${installPath} (legacy install)`));
        } else {
          console.log(chalk.gray(`  ${skillId} is not installed at ${installPath}`));
        }
        continue;
      }

      // Read current manifest to check which agents still need this path
      const manifest = readManifest(installPath) || { agents: [], skills: {} };
      const currentAgents = getManifestAgents(manifest);

      // Remove the requested agents from the manifest's agent list
      const agentIdsToRemove = new Set(agentEntries.map(e => e.agentId));
      const remainingAgents = currentAgents.filter(id => !agentIdsToRemove.has(id));

      if (remainingAgents.length === 0) {
        // No agents left that need this skill at this path -> delete the files
        await performUninstall(skillId, installPath);
        delete manifest.skills[skillId];
        console.log(chalk.green(`  - Removed ${skillId} v${installed.version} from ${installPath}`));
      } else {
        // Other agents still need the files, just update the manifest
        console.log(chalk.gray(`  ${skillId} still needed by ${remainingAgents.join(', ')} at ${installPath}, keeping files`));
      }

      // Update the agents list in manifest
      manifest.agents = remainingAgents;
      manifest.agent = remainingAgents[0] || null;
      writeManifest(installPath, manifest);

      // Regenerate MANIFEST.yaml and update instruction files
      await generateSkillsManifest(installPath);
      if (scope === 'project') {
        for (const entry of agentEntries) {
          await updateAgentInstructions(entry.agent, process.cwd());
        }
        // Remove Claude Code hook when no skills remain for claude-code
        if (includesClaudeCode(agentEntries)) {
          const currentManifest = readManifest(installPath);
          const hasRemainingSkills = currentManifest && currentManifest.skills && Object.keys(currentManifest.skills).length > 0;
          if (!hasRemainingSkills) {
            await removeClaudeCodeHook(process.cwd());
          }
        }
      }
    } catch (error) {
      console.log(chalk.red(`    x Failed: ${error.message}`));
    }
  }
}

// --- Status ---

function getStatus(agentIds, customPath = '', scope = 'project') {
  const results = [];

  const targetAgents = agentIds && agentIds.length > 0
    ? agentIds.map(id => getAgent(id)).filter(Boolean)
    : getAllAgents();

  for (const agent of targetAgents) {
    const projectPath = agent.getProjectPath();
    const globalPath = agent.getGlobalPath();

    // Filter paths based on scope
    let pathsToCheck;
    if (customPath) {
      pathsToCheck = [{ path: customPath, scope: 'custom' }];
    } else if (scope === 'global') {
      pathsToCheck = globalPath ? [{ path: globalPath, scope: 'global' }] : [];
    } else if (scope === 'project') {
      pathsToCheck = [{ path: projectPath, scope: 'project' }];
    } else {
      pathsToCheck = [{ path: projectPath, scope: 'project' }];
      if (globalPath) {
        pathsToCheck.push({ path: globalPath, scope: 'global' });
      }
    }

    for (const { path: checkPath, scope: checkScope } of pathsToCheck) {
      const manifest = readManifest(checkPath);
      if (!manifest || !manifest.skills || Object.keys(manifest.skills).length === 0) {
        continue;
      }

      results.push({
        agent: agent,
        installPath: checkPath,
        scope: checkScope,
        skills: manifest.skills
      });
    }
  }

  return results;
}

// --- Claude Code Hook Management ---

/**
 * Deploy the verify-manifest SessionStart hook into .claude/settings.json.
 * Performs a JSON merge — preserves existing settings and hooks.
 */
async function deployClaudeCodeHook(projectRoot) {
  const settingsPath = path.join(projectRoot, CLAUDE_CODE_SETTINGS_FILE);
  let settings = {};

  if (fs.existsSync(settingsPath)) {
    try {
      settings = JSON.parse(await fs.readFile(settingsPath, 'utf-8'));
    } catch {
      console.log(chalk.yellow('    Warning: Could not parse .claude/settings.json, skipping hook deployment'));
      return;
    }
  }

  if (!settings.hooks) {
    settings.hooks = {};
  }
  if (!settings.hooks.SessionStart) {
    settings.hooks.SessionStart = [];
  }

  // Bug 27.8 — copy the self-contained hook into the target so the command
  // resolves in any install (npx/node_modules/dev-repo). The legacy command
  // string (which pointed at the never-copied package `lib/`) is migrated to
  // the new command on every run.
  const hookTargetPath = path.join(projectRoot, CLAUDE_CODE_HOOK_TARGET_REL);
  await fs.ensureDir(path.dirname(hookTargetPath));
  await fs.copy(CLAUDE_CODE_HOOK_SOURCE, hookTargetPath, { overwrite: true });

  const hookCommand = CLAUDE_CODE_HOOK_COMMAND;
  let migrated = false;
  for (const group of settings.hooks.SessionStart) {
    if (!group.hooks) continue;
    for (const h of group.hooks) {
      if (h.command === CLAUDE_CODE_HOOK_LEGACY_COMMAND || h._id === CLAUDE_CODE_HOOK_ID) {
        h.command = hookCommand;
        h._id = CLAUDE_CODE_HOOK_ID;
        migrated = true;
      }
    }
  }

  const alreadyInstalled = settings.hooks.SessionStart.some(group =>
    group.hooks && group.hooks.some(h => h.command === hookCommand)
  );

  if (!alreadyInstalled) {
    settings.hooks.SessionStart.push({
      matcher: 'startup',
      hooks: [
        {
          type: 'command',
          command: hookCommand,
          _id: CLAUDE_CODE_HOOK_ID
        }
      ]
    });
  } else if (!migrated) {
    // Hook entry already current and file copied — still ensure settings exist.
    await fs.ensureDir(path.dirname(settingsPath));
    await fs.writeFile(settingsPath, JSON.stringify(settings, null, 2) + '\n', 'utf-8');
    return;
  }

  await fs.ensureDir(path.dirname(settingsPath));
  await fs.writeFile(settingsPath, JSON.stringify(settings, null, 2) + '\n', 'utf-8');
  console.log(chalk.cyan('    + Deployed Claude Code verify-manifest hook'));
}

/**
 * Remove the verify-manifest hook from .claude/settings.json.
 */
async function removeClaudeCodeHook(projectRoot) {
  const settingsPath = path.join(projectRoot, CLAUDE_CODE_SETTINGS_FILE);

  if (!fs.existsSync(settingsPath)) return;

  let settings;
  try {
    settings = JSON.parse(await fs.readFile(settingsPath, 'utf-8'));
  } catch {
    return;
  }

  // Bug 27.8 — remove the copied hook file from the target as well.
  const hookTargetPath = path.join(projectRoot, CLAUDE_CODE_HOOK_TARGET_REL);
  try {
    await fs.remove(hookTargetPath);
  } catch {
    // best-effort cleanup — never fail uninstall over a missing file
  }

  if (!settings.hooks || !settings.hooks.SessionStart) return;

  // Match both the current command and the legacy package-relative command so
  // older installs get cleaned up too.
  settings.hooks.SessionStart = settings.hooks.SessionStart.filter(group => {
    if (!group.hooks) return true;
    group.hooks = group.hooks.filter(h =>
      h.command !== CLAUDE_CODE_HOOK_COMMAND &&
      h.command !== CLAUDE_CODE_HOOK_LEGACY_COMMAND &&
      h._id !== CLAUDE_CODE_HOOK_ID
    );
    return group.hooks.length > 0;
  });

  // Clean up empty arrays
  if (settings.hooks.SessionStart.length === 0) {
    delete settings.hooks.SessionStart;
  }
  if (Object.keys(settings.hooks).length === 0) {
    delete settings.hooks;
  }

  await fs.writeFile(settingsPath, JSON.stringify(settings, null, 2) + '\n', 'utf-8');
  console.log(chalk.cyan('    - Removed Claude Code verify-manifest hook'));
}

/**
 * Check if any agents in the list include claude-code.
 */
function includesClaudeCode(agentEntries) {
  return agentEntries.some(e => e.agentId === 'claude-code');
}

module.exports = {
  listSkills,
  listAgents,
  installSkill,
  uninstallSkill,
  getStatus,
  readManifest,
  ensureManifest,
  getInstalledSkillInfo,
  getManifestAgents,
  compareSemver,
  findInsertionPoint,
  deployClaudeCodeHook,
  removeClaudeCodeHook,
  ensureBmadOutputTracked,
  ensurePluginStageIgnored,
  ensureBmadDirIgnored,
  generateSkillsManifest,
  generateProjectContext,
  generateRepoLayoutSection,
  updateProjectContextRepoLayout,
  _updateProjectContextManifestPaths: updateProjectContextManifestPaths,
  _testUpdateAgentInstructions: updateAgentInstructions,
  _MA_AGENTS_SOURCE: MA_AGENTS_SOURCE,
  // Story 21.2 — universal instruction-block composer and helpers.
  composeInstructionBlock,
  buildBackupFilename,
  formatBackupTimestamp,
  UNIVERSAL_INSTRUCTION_TEMPLATE_PATH,
  GIT_INSTRUCTION_TEMPLATE_PATH,
  ONPREM_INSTRUCTION_TEMPLATE_PATH,
  // Story 21.4 — AGENTS.md template, markdown-markers merger, extraInstructionTemplates processor.
  // Story 21.3 (rebased) — yaml-customModes merger dispatch is integrated into stampExtraInstructionTemplates.
  resolveBmadOutputDirs,
  markdownMarkersMerger,
  stampExtraInstructionTemplates,
  EXTRA_TEMPLATE_DIR,
  // Story 21.5 — Cline dual-file drift detection + framing template path.
  CLINERULES_TEMPLATE_PATH,
  ClinerulesDualFileDriftError,
  checkClinerulesDualFileDrift,
  // Story 22.3 — legacy skill retirement migration (AC 7)
  // Story 22.2 — extended to also sweep renamed skill IDs (bmad-ma-agent-*)
  migrateRetiredSkills,
  RETIRED_SKILL_IDS,
  RENAMED_SKILL_IDS,
  OBSOLETE_SKILL_IDS,
  // Bug B2 — stale copilot skills dir cleanup + future tool-dir migrations.
  // Story 24.11 (AC5) will extend OBSOLETE_TOOL_SKILL_DIRS with additional entries.
  OBSOLETE_TOOL_SKILL_DIRS,
  migrateObsoleteToolDirs
};
