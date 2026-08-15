#!/usr/bin/env node

// Bug A fix — suppress the cosmetic Node.js ExperimentalWarning about
// CommonJS require() of an ES Module. Must be installed BEFORE any
// other require() so the filter catches warnings fired by the very
// first dependency-loading call below. See lib/warning-filter.js.
//
// Re-exec gating:
//   - Only when this file is launched as the CLI (require.main === module).
//     When imported by the test suite or another script, skip the re-exec
//     path — otherwise the importing process would silently fork itself.
//   - Only for commands that can trigger the CJS-require-ESM warning,
//     i.e. those that spawn bmad-method or otherwise load the heavy
//     transitive dependency graph. Informational commands (--help,
//     --version, status, list, agents) stay single-process for fast
//     cold start. The listener-only fallback is still attached so
//     in-process warnings still route through our filter.
const { installExperimentalWarningFilter } = require('../lib/warning-filter');
const _reexecCommands = new Set([
  'install', 'uninstall', 'remove',
  'create-skill', 'validate-skill', 'set-mandatory',
  'customize-agent', 'create-agent',
  'config',
  undefined, // bare `ma-agents` → interactive wizard
]);
const _firstArg = process.argv[2];
installExperimentalWarningFilter({
  reexec: require.main === module && _reexecCommands.has(_firstArg),
});

const prompts = require('prompts');
const chalk = require('chalk');
const path = require('path');
const fs = require('fs');
// Used ONLY as a validity oracle for the authoritative binding file (see
// resolveProjectTopology). Already loaded on every run via lib/bmad.js.
const yaml = require('js-yaml');
const { execFileSync } = require('child_process');
const { installSkill, uninstallSkill, getStatus, listSkills, listAgents, updateProjectContextRepoLayout, migrateRetiredSkills, reconcileAgentsSharedSkills } = require('../lib/installer');
const { getProfile, setProfile, resolveProfile, getBmadModules, setBmadModules, showDemerzelDeprecationNoticeOnce, getCustomMarketplaceSelection } = require('../lib/profile');
const { reconfigure: runReconfigure, ReconfigureYesRejectedError, ManifestNotFoundError, RoomodesSlugDivergenceError } = require('../lib/reconfigure');
const { uninstallProfileArtifacts } = require('../lib/uninstall');
const bmad = require('../lib/bmad');
const { getBmadPlatformCode } = require('../lib/agents');
const { enumerateCustomSource, NFR71_WARNING, CustomMarketplaceError, reconcileCustomMarketplaceSelection, registryTrustLabel } = require('../lib/custom-marketplace');
const { setLogSink, diag, diagError } = require('../lib/diag');
const { handleCreateSkill, handleValidateSkill, handleSetMandatory, handleCustomizeAgent, handleCreateAgent } = require('../lib/skill-authoring');
// 2B nit 1 — the knowledge-store `backend` enum and its default now live in a
// dependency-free leaf module under lib/, so `lib/installer.js` (which must NOT
// require this file — the dependency runs the other way) consumes the SAME
// definition instead of open-coding a second one. See lib/store-backends.js.
const { STORE_BACKEND_LIST, DEFAULT_STORE_BACKEND } = require('../lib/store-backends');
const crypto = require('crypto');

const PKG = require('../package.json');
const NAME = PKG.name;
const VERSION = PKG.version;

/**
 * Set up logging to tee all stdout/stderr output to a file.
 * Returns a cleanup function to close the file descriptor.
 *
 * @param {string} logFilePath - Path to the log file
 * @returns {Function} cleanup function
 */
function setupLogging(logFilePath) {
  const logFd = fs.openSync(logFilePath, 'w');
  // Rich header — the environment facts needed to make sense of a report later:
  // exact version, how it was invoked, runtime, platform, and where it ran.
  const header =
    `[${new Date().toISOString()}] ${NAME} v${VERSION} — log started\n` +
    `  argv:     ${process.argv.slice(1).join(' ')}\n` +
    `  node:     ${process.version}\n` +
    `  platform: ${process.platform} ${process.arch}\n` +
    `  cwd:      ${process.cwd()}\n`;
  fs.writeSync(logFd, header);

  // Route log-file-only diagnostics (lib/diag.js) to this fd. These breadcrumbs
  // (custom-marketplace phases, swallowed error causes, etc.) land ONLY in the
  // log, never on the user's console.
  setLogSink((s) => { try { fs.writeSync(logFd, s); } catch { /* ignore */ } });

  const origStdoutWrite = process.stdout.write.bind(process.stdout);
  const origStderrWrite = process.stderr.write.bind(process.stderr);

  process.stdout.write = function (chunk, encoding, callback) {
    const str = typeof chunk === 'string' ? chunk : chunk.toString();
    try { fs.writeSync(logFd, str); } catch { /* ignore write errors */ }
    return origStdoutWrite(chunk, encoding, callback);
  };

  process.stderr.write = function (chunk, encoding, callback) {
    const str = typeof chunk === 'string' ? chunk : chunk.toString();
    try { fs.writeSync(logFd, str); } catch { /* ignore write errors */ }
    return origStderrWrite(chunk, encoding, callback);
  };

  // Store log fd globally so bmad.js can use pipe mode
  process.env.MA_AGENTS_LOG_ACTIVE = '1';

  return function cleanup() {
    process.stdout.write = origStdoutWrite;
    process.stderr.write = origStderrWrite;
    const footer = `\n[${new Date().toISOString()}] log ended\n`;
    try { fs.writeSync(logFd, footer); } catch { /* ignore */ }
    setLogSink(null);
    try { fs.closeSync(logFd); } catch { /* ignore */ }
    delete process.env.MA_AGENTS_LOG_ACTIVE;
  };
}

function showHelp() {
  console.log(`
${chalk.bold.cyan(NAME)} ${chalk.gray(`v${VERSION}`)}

${chalk.bold('Usage:')}
  ${chalk.cyan(`npx ${NAME}`)}                              Interactive wizard
  ${chalk.cyan(`npx ${NAME} install`)}                      Interactive install wizard
  ${chalk.cyan(`npx ${NAME} install`)} <skill> <agents...>  Install directly
  ${chalk.cyan(`npx ${NAME} uninstall`)} <skill> <agents..> Uninstall a skill
  ${chalk.cyan(`npx ${NAME} uninstall --profile-artifacts`)}  Remove ma-agents-owned profile content from all injection files
  ${chalk.cyan(`npx ${NAME} status`)}                       Show installed skills
  ${chalk.cyan(`npx ${NAME} list`)}                         List available skills
  ${chalk.cyan(`npx ${NAME} agents`)}                       List supported agents
  ${chalk.cyan(`npx ${NAME} create-skill`)} <name>           Scaffold a new skill directory
  ${chalk.cyan(`npx ${NAME} validate-skill`)} <name>         Validate a skill against the schema
  ${chalk.cyan(`npx ${NAME} set-mandatory`)} <name> [--off]  Mark a skill as always-load (or remove)
  ${chalk.cyan(`npx ${NAME} customize-agent`)} <agent>       Customize a BMAD agent persona and actions
  ${chalk.cyan(`npx ${NAME} create-agent`)} <name>           Create a new specialized BMAD agent
  ${chalk.cyan(`npx ${NAME} reconfigure`)}                 Re-run the profile prompt and re-stamp artifacts
  ${chalk.cyan(`npx ${NAME} config layout`)}                Reconfigure repository layout
  ${chalk.cyan(`npx ${NAME} config layout --show`)}         Show current layout (read-only)
  ${chalk.cyan(`npx ${NAME} help`)}                         Show this help

${chalk.bold('Install options:')}
  ${chalk.cyan('--global')}          Install to global/user-level paths (default: project-level)
  ${chalk.cyan('--path <dir>')}      Custom installation directory
  ${chalk.cyan('--force')}           Skip upgrade prompts, always overwrite
  ${chalk.cyan('--yes')}             Skip all prompts, use defaults (for CI/CD)
  ${chalk.cyan('--agent <name>')}    Target a specific agent (skip agent selection)
  ${chalk.cyan('--bmad-modules [csv]')} Control BMAD module selection.
                       Bare:    open a multiselect prompt
                       With CSV: install exactly those (e.g. tea,bmb)
                       Omitted: install every non-retired module (default)
                       'bmm' is always force-included.
  ${chalk.cyan('--bmad-custom-source <ref>')} Enumerate extensions from ONE custom
                       marketplace repo (local path or Git URL containing
                       .claude-plugin/marketplace.json) and offer them in
                       ma-agents' own multiselect. Non-interactive equivalent
                       of the "Install additional BMAD extensions from a
                       custom source?" prompt. Ambient git credentials only —
                       no token handling.
  ${chalk.cyan('--log')}              Log all console output to install_<datetime>.log

${chalk.bold('Reconfigure options:')}
  ${chalk.cyan('--force-roomodes-overwrite')}  Accept slug-stomp on user-edited ma-agents slugs
  ${chalk.gray('(reconfigure rejects --yes by design — it is interactive only)')}

${chalk.bold('Uninstall --profile-artifacts options:')}
  ${chalk.cyan('--yes')}  Skip confirmation prompt (supported for CI decommissioning)
  ${chalk.gray('(asymmetry note: uninstall --profile-artifacts accepts --yes; reconfigure does not)')}

${chalk.bold('Notes:')}
  Divergent \`.cline/clinerules.md\` vs. \`.clinerules\` marker blocks require
  manual reconciliation — \`--yes\` does not bypass this check.

${chalk.bold('Examples:')}
  npx ${NAME} install
  npx ${NAME} install code-review claude-code
  npx ${NAME} install code-review claude-code --force
  npx ${NAME} install --yes
  npx ${NAME} install --yes --agent claude-code
  npx ${NAME} install --yes --global
  npx ${NAME} install --yes --bmad-modules bmm,tea,bmb
  npx ${NAME} install --bmad-modules                    # prompt for modules
  npx ${NAME} install --yes --bmad-custom-source ./org-marketplace
  npx ${NAME} install --bmad-custom-source git@git.intra.example:team/bmad-marketplace.git
  npx ${NAME} uninstall code-review claude-code
  npx ${NAME} status
  npx ${NAME} status --global
`);
}

function showSkills(args) {
  const mandatoryOnly = args && args.includes('--mandatory');
  let skills = listSkills();
  if (mandatoryOnly) {
    skills = skills.filter(s => s.always_load === true);
    console.log(chalk.bold('\n Mandatory Skills (always_load: true):\n'));
  } else {
    console.log(chalk.bold('\n Available Skills:\n'));
  }
  skills.forEach(skill => {
    console.log(chalk.cyan(`  ${skill.id.padEnd(35)}`) + chalk.white(`${skill.name}`) + chalk.gray(` v${skill.version}`));
    console.log(chalk.gray(`  ${''.padEnd(35)}${skill.description}\n`));
  });
}

function showAgents() {
  const agents = listAgents();
  console.log(chalk.bold('\n Supported Agents:\n'));

  const ideAgents = agents.filter(a => a.category !== 'bmad');
  const bmadAgents = agents.filter(a => a.category === 'bmad');

  console.log(chalk.bold.yellow('  AI Coding Assistants:'));
  ideAgents.forEach(agent => {
    console.log(chalk.cyan(`    ${agent.id.padEnd(20)}`) + chalk.white(agent.name) + chalk.gray(` v${agent.version} - ${agent.description}`));
  });

  console.log(chalk.bold.yellow('\n  BMAD Method Agents:'));
  bmadAgents.forEach(agent => {
    console.log(chalk.cyan(`    ${agent.id.padEnd(20)}`) + chalk.white(agent.name) + chalk.gray(` v${agent.version} - ${agent.description}`));
  });
  console.log('');
}

function showStatus(args) {
  const globalFlag = args.includes('--global');
  const scope = globalFlag ? 'global' : 'project';
  const positional = args.filter(a => a !== '--global');

  const results = getStatus(positional, '', scope);

  if (results.length === 0) {
    console.log(chalk.gray(`\n  No skills installed (${scope} scope)\n`));
    return;
  }

  console.log(chalk.bold(`\n Installed Skills:\n`));

  for (const entry of results) {
    console.log(chalk.cyan(`  ${entry.agent.name}`) + chalk.gray(` (${entry.scope}: ${entry.installPath})`));

    const skillIds = Object.keys(entry.skills);
    for (const skillId of skillIds) {
      const info = entry.skills[skillId];
      const installed = new Date(info.installedAt).toLocaleDateString();
      const updated = info.updatedAt !== info.installedAt
        ? chalk.gray(` updated ${new Date(info.updatedAt).toLocaleDateString()}`)
        : '';
      console.log(
        chalk.white(`    ${skillId.padEnd(35)}`) +
        chalk.green(`v${info.version}`) +
        chalk.gray(`  installed ${installed}`) +
        updated
      );
    }
    console.log('');
  }
}

// --- Parse common flags from args ---

function parseFlags(args) {
  const globalFlag = args.includes('--global');
  const forceFlag = args.includes('--force');
  const yesFlag = args.includes('--yes');
  let customPath = '';
  let agentFlag = '';

  let positional = [...args].filter(a =>
    a !== '--global' && a !== '--force' && a !== '--yes'
  );

  const pathIdx = positional.indexOf('--path');
  if (pathIdx !== -1) {
    customPath = positional[pathIdx + 1] || '';
    positional.splice(pathIdx, 2);
  }

  const agentIdx = positional.indexOf('--agent');
  if (agentIdx !== -1) {
    const agentName = positional[agentIdx + 1];
    if (!agentName || agentName.startsWith('--')) {
      console.error(chalk.red('Error: --agent requires an agent name'));
      console.error(chalk.gray('  Hint: Run "list" to see available agents'));
      process.exit(1);
    }
    agentFlag = agentName;
    positional.splice(agentIdx, 2);
  }

  // --bmad-modules — controls BMad module selection. Optional-value flag:
  //   bare         → ask the user via multiselect prompt
  //   with CSV     → install exactly those (bmm force-prepended, unknowns rejected)
  //   not present  → install all non-retired modules (no prompt)
  // Force-prepending of `bmm` and validation of unknown ids is handled
  // centrally by lib/bmad.resolveBmadModules.
  let bmadModulesFlag = '';
  let bmadModulesPrompt = false;
  const bmadModulesIdx = positional.indexOf('--bmad-modules');
  if (bmadModulesIdx !== -1) {
    const value = positional[bmadModulesIdx + 1];
    if (!value || value.startsWith('--')) {
      // Bare flag — the next token is another flag or the end of args.
      // Treat as a request to prompt the user.
      bmadModulesPrompt = true;
      positional.splice(bmadModulesIdx, 1);
    } else {
      bmadModulesFlag = value;
      positional.splice(bmadModulesIdx, 2);
    }
  }

  // --bmad-custom-source <ref> — Story 30.6a. Requires an explicit value (a
  // path or Git URL); unlike --bmad-modules there is no "bare = prompt" form
  // because the underlying Y/N wizard prompt already exists for interactive
  // runs. A missing value is an error, not a silent no-op, to avoid a typo'd
  // invocation silently skipping the intended custom source.
  let bmadCustomSourceFlag = '';
  const bmadCustomSourceIdx = positional.indexOf('--bmad-custom-source');
  if (bmadCustomSourceIdx !== -1) {
    const value = positional[bmadCustomSourceIdx + 1];
    if (!value || value.startsWith('--')) {
      console.error(chalk.red('Error: --bmad-custom-source requires a path or Git URL'));
      process.exit(1);
    }
    bmadCustomSourceFlag = value;
    positional.splice(bmadCustomSourceIdx, 2);
  }

  return {
    globalFlag,
    forceFlag,
    yesFlag,
    agentFlag,
    customPath,
    bmadModulesFlag,
    bmadModulesPrompt,
    bmadCustomSourceFlag,
    scope: globalFlag ? 'global' : 'project',
    positional
  };
}

// --- Repository layout wizard ---

async function collectLocalPath(concern) {
  while (true) {
    const { localPath } = await prompts({
      type: 'text',
      name: 'localPath',
      message: `Enter local path for ${concern} (this is the literal folder; no extra subdirectories will be created):`
    });

    if (!localPath || !localPath.trim()) {
      console.log(chalk.red('  Path cannot be empty. Please try again.'));
      continue;
    }

    const resolved = path.resolve(process.cwd(), localPath.trim());

    if (fs.existsSync(resolved)) {
      if (!fs.statSync(resolved).isDirectory()) {
        console.log(chalk.red(`  "${resolved}" exists but is a file, not a directory. Please try again.`));
        continue;
      }
    } else {
      console.log(chalk.yellow(`  Warning: "${resolved}" does not exist.`));
      const { confirmed } = await prompts({
        type: 'confirm',
        name: 'confirmed',
        message: 'Use this path anyway? (It must exist before agents run)',
        initial: false
      });
      if (!confirmed) continue;
      console.log(chalk.yellow(`  Note: Path "${resolved}" must exist before agents run.`));
    }

    if (resolved.startsWith(process.cwd())) {
      console.log(chalk.yellow(`  Warning: Path is inside the current repository. Nested repos may cause git confusion.`));
    }

    return { mode: 'local', path: resolved };
  }
}

async function collectRemotePath(concern) {
  while (true) {
    // Collect git URL
    let gitUrl;
    while (true) {
      const { url } = await prompts({
        type: 'text',
        name: 'url',
        message: `Enter git URL for ${concern}:`
      });
      if (!url || !url.trim()) {
        console.log(chalk.red('  Git URL cannot be empty. Please try again.'));
        continue;
      }
      gitUrl = url.trim();
      break;
    }

    // Collect destination path
    let destPath;
    while (true) {
      const { dest } = await prompts({
        type: 'text',
        name: 'dest',
        message: `Enter local destination path for clone:`
      });
      if (!dest || !dest.trim()) {
        console.log(chalk.red('  Destination path cannot be empty. Please try again.'));
        continue;
      }
      destPath = path.resolve(process.cwd(), dest.trim());
      break;
    }

    // Check destination
    if (fs.existsSync(destPath)) {
      if (!fs.statSync(destPath).isDirectory()) {
        console.log(chalk.red(`  "${destPath}" exists but is a file, not a directory. Please try again.`));
        continue;
      }
      // Existing directory — show summary and confirm
      const files = fs.readdirSync(destPath);
      const isGitRepo = fs.existsSync(path.join(destPath, '.git'));
      console.log(chalk.blue(`  Directory exists: ${files.length} items${isGitRepo ? ' (git repo)' : ''}`));
      const { confirmed } = await prompts({
        type: 'confirm',
        name: 'confirmed',
        message: 'Use this existing directory?',
        initial: true
      });
      if (!confirmed) continue;
    } else {
      // Clone
      const existedBefore = fs.existsSync(destPath);
      try {
        console.log(chalk.cyan(`  Cloning ${gitUrl}...`));
        execFileSync('git', ['clone', gitUrl, destPath], {
          timeout: 120000,
          env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
          stdio: 'inherit'
        });
      } catch (err) {
        console.log(chalk.red(`  Clone failed: ${err.message}`));
        if (!existedBefore && fs.existsSync(destPath)) {
          fs.rmSync(destPath, { recursive: true, force: true });
        }
        const { retry } = await prompts({
          type: 'confirm',
          name: 'retry',
          message: 'Retry?',
          initial: true
        });
        if (retry) continue;
        console.log(chalk.yellow(`  Falling back to current repository for ${concern}`));
        return { mode: 'same', path: '.' };
      }
    }

    if (destPath.startsWith(process.cwd())) {
      console.log(chalk.yellow(`  Warning: Destination is inside the current repository. Nested repos may cause git confusion.`));
    }

    return { mode: 'remote', path: destPath, gitUrl };
  }
}

async function collectJiraConfig() {
  // Collect Jira server URL
  let jiraUrl;
  while (true) {
    const { url } = await prompts({
      type: 'text',
      name: 'url',
      message: 'Jira server URL (e.g. https://mycompany.atlassian.net):'
    });
    if (!url || !url.trim()) {
      console.log(chalk.red('  Jira server URL cannot be empty. Please try again.'));
      continue;
    }
    jiraUrl = url.trim();
    break;
  }

  // Collect Jira project key
  let jiraProjectKey;
  while (true) {
    const { key } = await prompts({
      type: 'text',
      name: 'key',
      message: 'Jira project key (e.g. MYPROJ):'
    });
    if (!key || !key.trim()) {
      console.log(chalk.red('  Jira project key cannot be empty. Please try again.'));
      continue;
    }
    if (!/^[A-Z][A-Z0-9]+$/.test(key.trim())) {
      console.log(chalk.red('  Jira project key must be uppercase alphanumeric (e.g. MYPROJ). Please try again.'));
      continue;
    }
    jiraProjectKey = key.trim();
    break;
  }

  return { mode: 'jira', jiraUrl, jiraProjectKey };
}

function normalizePath(p) {
  return p.replace(/\\/g, '/');
}

// Characters that cannot appear RAW inside a YAML double-quoted scalar without
// either terminating it early or producing something a real YAML parser rejects:
//   \ and "         - the two structural characters of the scalar itself.
//   U+0000-U+001F   - C0 controls. Includes CR/LF (which would break out of the
//                     scalar and inject a sibling key) and TAB/NUL/VT/FF, which
//                     YAML forbids raw and js-yaml rejects outright.
//   U+007F-U+009F   - DEL and the C1 controls, likewise forbidden raw. U+0085
//                     (NEL) lives in this range and is a YAML line break.
//   U+2028 / U+2029 - Unicode line/paragraph separators; YAML line breaks.
//   U+00A0 / U+FEFF - legal raw, but JS String.prototype.trim() treats both as
//                     whitespace, so leaving them raw would make this module's
//                     own line-based reader lossy. Escaped for round-trip
//                     fidelity rather than for safety.
const YAML_DQ_MUST_ESCAPE = /[\\"\u0000-\u001f\u007f-\u009f\u00a0\u2028\u2029\ufeff]/g;

/**
 * Renders any value as a VALID YAML double-quoted scalar.
 *
 * INVARIANT: total. It never throws, and there is no input for which it emits
 * something a conforming YAML parser rejects. Correct escaping subsumes the
 * injection defence entirely - an escaped CR/LF cannot break out of the scalar -
 * so there is nothing left here to reject. Any *policy* rejection of line breaks
 * belongs at the serializer boundary, which knows the file and field name (see
 * assertSingleLineIdentity). Paired with yamlUnescapeDoubleQuoted so writer and
 * reader agree on exactly one legal value set.
 *
 * Shared with writeConfigField (_bmad/bmm/config.yaml), which is why a throw here
 * would name the wrong file. Why the earlier *rejecting* escaper was withdrawn is
 * in the commit message and the story record.
 */
function yamlEscapeValue(v) {
  if (v == null || v === '') return '""';
  const s = String(v);
  return '"' + s.replace(YAML_DQ_MUST_ESCAPE, (ch) => {
    if (ch === '\\') return '\\\\';
    if (ch === '"') return '\\"';
    return '\\u' + ch.charCodeAt(0).toString(16).padStart(4, '0');
  }) + '"';
}

/**
 * The exact inverse of yamlEscapeValue for the three escape forms this module
 * emits (backslash-backslash, backslash-quote, \uXXXX), plus the remainder of
 * the YAML 1.2 double-quoted escape set so that a hand-edited file - or one
 * written by a real YAML emitter - still reads correctly. An unknown escape
 * degrades to the escaped character itself rather than throwing: this reader's
 * job is to resolve a binding, and resolveProjectTopology classifies unusable
 * content separately.
 */
function yamlUnescapeDoubleQuoted(s) {
  return s.replace(/\\(u[0-9a-fA-F]{4}|x[0-9a-fA-F]{2}|[\s\S])/g, (_m, esc) => {
    if (esc.length === 5 && esc[0] === 'u') return String.fromCharCode(parseInt(esc.slice(1), 16));
    if (esc.length === 3 && esc[0] === 'x') return String.fromCharCode(parseInt(esc.slice(1), 16));
    switch (esc) {
      case '0': return '\u0000';
      case 'a': return '\u0007';
      case 'b': return '\b';
      case 't': return '\t';
      case 'n': return '\n';
      case 'v': return '\v';
      case 'f': return '\f';
      case 'r': return '\r';
      case 'e': return '\u001b';
      case 'N': return '\u0085';
      case '_': return '\u00a0';
      case 'L': return '\u2028';
      case 'P': return '\u2029';
      default: return esc;
    }
  });
}

/**
 * The POLICY guard that the first round's B-2 throw was reaching for, relocated
 * to the layer that knows which file it is writing. Applies ONLY to the
 * free-text human-identity fields of a confluence store (space key, root-page
 * title/id) - NOT to paths or git URLs, because U+2028 / U+2029 / U+0085 are all
 * legal in a real directory name on both Linux and Windows, were writable by a
 * pre-31.2 ma-agents, and must therefore keep round-tripping rather than crash
 * an install that has already completed.
 *
 * Escaping already makes these values SAFE; this guard only enforces that a
 * multi-line Confluence space key or page title is nonsense input worth
 * reporting (P5-9.3 fail-loud posture), and it names the real file and field so
 * the message is actionable.
 */
function assertSingleLineIdentity(value, fieldName) {
  if (value == null) return value;
  const s = String(value);
  if (/[\r\n\u2028\u2029\u0085]/.test(s)) {
    throw new Error(
      `Refusing to write _bmad-output/project-layout.yaml: the confluence store's ` +
      `${fieldName} contains a line break, which is not valid identity for a ` +
      `Confluence space or page: ${JSON.stringify(s)}`
    );
  }
  return s;
}

function toPortablePath(absolutePath, projectRoot) {
  if (!absolutePath || absolutePath === '.') return { portable: '.', isAbsolute: false };

  const rel = normalizePath(path.relative(projectRoot, absolutePath));

  // Same directory: path.relative returns '' — treat as '.'
  if (rel === '') return { portable: '.', isAbsolute: false };

  // Cross-drive on Windows: path.relative returns the absolute target unchanged
  if (path.isAbsolute(rel) || /^[A-Za-z]:/.test(rel)) {
    return { portable: normalizePath(absolutePath), isAbsolute: true };
  }

  // Too many levels up — treat as non-portable
  const upLevels = (rel.match(/\.\./g) || []).length;
  if (upLevels > 3) {
    return { portable: normalizePath(absolutePath), isAbsolute: true };
  }

  return { portable: rel, isAbsolute: false };
}

function writeConfigField(content, fieldName, value) {
  const regex = new RegExp(`^${fieldName}:.*$`, 'm');
  const newLine = `${fieldName}: ${yamlEscapeValue(value)}`;
  if (regex.test(content)) {
    // Function replacer, NOT the string form: a `$&` / `$'` / `$1` sequence in a
    // legitimate path or Jira URL would otherwise be expanded as a replacement
    // pattern and corrupt config.yaml. Same class as the escaping bug above - a
    // value channel being treated as syntax.
    return content.replace(regex, () => newLine);
  }
  return content.trimEnd() + '\n' + newLine + '\n';
}

// Bug 27.15 — unify the path convention. config.toml (written by upstream
// manifest-generator) declares artifact paths with a `{project-root}/` prefix;
// previously writeRepoLayoutConfig emitted a THIRD variant: bare relative
// `_bmad-output/...`. Emit the same `{project-root}/`-prefixed form here so
// ma-agents stops adding a divergent third convention. config.toml is the
// install-owned source of truth; the per-module config.yaml is the
// upstream-stripped read copy. Fully aligning the upstream stripper
// (official-modules.js) is a separate upstream follow-up; vendored node_modules
// is not edited here.
function canonicalArtifactPath(suffix) {
  return `{project-root}/_bmad-output/${suffix}`;
}

function writeRepoLayoutConfig(layout) {
  const configPath = path.join(process.cwd(), '_bmad', 'bmm', 'config.yaml');
  try {
    if (!fs.existsSync(configPath)) {
      // Create an empty file so writeConfigField can append to it
      fs.mkdirSync(path.join(process.cwd(), '_bmad', 'bmm'), { recursive: true });
      fs.writeFileSync(configPath, '', 'utf-8');
    }
    let content = fs.readFileSync(configPath, 'utf-8');
    const projectRoot = process.cwd();

    // B-1 consequence 3. Making the install path read the committed binding means
    // `layout.knowledgebase` can now be a NON-file-system store (today:
    // `confluence`), which has no `.mode` and no `.path`. Before B-1 that store
    // had already been collapsed to `{same, "."}` upstream, so this function only
    // ever saw file-system shapes on the install path.
    //
    // `toPortablePath(undefined)` already returns `'.'`, so nothing crashes and
    // the literal `undefined` is never written — but writing `.` for a Confluence
    // store SILENTLY says "the knowledgebase is this repo", which is exactly the
    // permissive-default shape B-1 itself is. So it is made explicit here rather
    // than left to fall out of a falsy check.
    //
    // The VALUE is deliberately unchanged (`.`): `knowledgebase_path` is what
    // `planning_artifacts` is derived from below and what the Knowledge Atlas
    // config scan reads (lib/knowledge-atlas/src/scan/config.ts), so changing it
    // would move resolved artifact paths and violate NFR82.
    //
    // What `knowledgebase_path` SHOULD mean for a Confluence-backed store is a
    // genuine open question and NOT decided here — see
    // `_bmad-output/implementation-artifacts/
    //  bug-knowledgebase-path-has-no-defined-meaning-for-a-confluence-store.md`
    // (Story 31.3 / 31.6). Pinned by `test/project-layout-two-store-round-trip.test.js`
    // so it cannot drift silently.
    const kbBackend = backendOfStore(layout.knowledgebase);
    if (kbBackend !== DEFAULT_STORE_BACKEND) {
      console.log(chalk.yellow(
        `  Note: the knowledge store is ${kbBackend}-backed, which has no filesystem path.\n` +
        `  config.yaml's knowledgebase_path is left at "." (the local artifacts default) so\n` +
        `  planning artifacts keep resolving where they do today. The authoritative\n` +
        `  ${kbBackend} identity lives in _bmad-output/project-layout.yaml and is unchanged.`
      ));
    }

    const kbPortable = toPortablePath(layout.knowledgebase.path, projectRoot);
    const kbPath = kbPortable.portable;
    content = writeConfigField(content, 'knowledgebase_path', kbPath);

    const spMode = layout.sprintManagement.mode;
    // 3.12.3: when the user provides a non-`.` path for knowledgebase /
    // sprint management, treat that path as the literal artifacts directory
    // — no nested `_bmad-output/<…>-artifacts/` subtree. The wizard prompt
    // ("Where is your knowledgebase managed?") implies the path IS the
    // artifacts folder, not a parent. Only `.` (current repo) gets the
    // canonical `_bmad-output/...` layout because in single-repo mode
    // there's no other folder semantics to honor.
    if (spMode === 'jira') {
      // Jira backend: write sprint_backend + Jira config; no sprint_management_path
      content = writeConfigField(content, 'sprint_backend', 'jira');
      content = writeConfigField(content, 'jira_url', layout.sprintManagement.jiraUrl);
      content = writeConfigField(content, 'jira_project_key', layout.sprintManagement.jiraProjectKey);
      const planningArtifacts = kbPath === '.' ? canonicalArtifactPath('planning-artifacts') : kbPath;
      const implArtifacts = canonicalArtifactPath('implementation-artifacts');
      content = writeConfigField(content, 'planning_artifacts', planningArtifacts);
      content = writeConfigField(content, 'implementation_artifacts', implArtifacts);
      fs.writeFileSync(configPath, content, 'utf-8');
      console.log(chalk.gray(`  Config: knowledgebase_path="${kbPath}", sprint_backend=jira, jira_url="${layout.sprintManagement.jiraUrl}", jira_project_key="${layout.sprintManagement.jiraProjectKey}"`));
    } else {
      // File-system backend
      const spPortable = toPortablePath(layout.sprintManagement.path, projectRoot);
      const spPath = spPortable.portable;
      content = writeConfigField(content, 'sprint_backend', 'file-system');
      content = writeConfigField(content, 'sprint_management_path', spPath);
      const planningArtifacts = kbPath === '.' ? canonicalArtifactPath('planning-artifacts') : kbPath;
      const implArtifacts = spPath === '.' ? canonicalArtifactPath('implementation-artifacts') : spPath;
      content = writeConfigField(content, 'planning_artifacts', planningArtifacts);
      content = writeConfigField(content, 'implementation_artifacts', implArtifacts);
      fs.writeFileSync(configPath, content, 'utf-8');
      console.log(chalk.gray(`  Config: knowledgebase_path="${kbPath}", sprint_backend=file-system, sprint_management_path="${spPath}"`));
    }
  } catch (e) {
    console.log(chalk.red(`  Cannot write config.yaml: ${e.message}`));
  }
}

// ─── project-layout.yaml — schema v2: the two-store binding spine (Story 31.2) ──
//
// P5-9.1: this file is the SINGLE authoritative record of where a project's
// knowledge lives, written unconditionally on every install and every bind.
// Exactly three location records (AC1): `system_requirements_store`,
// `software_requirements_store`, `sprint_management` — no fourth store, no
// `implementation_artifacts` record (story files follow sprint_management,
// FR267). Each of the two knowledge stores carries a `backend`
// (`file-system` | `confluence`) plus its backend-specific fields. A
// `confluence` store records ONLY the space key and a `{title, id}` root-page
// identity (NFR79) — never credentials; `serializeConfluenceStore` below
// enumerates exactly those fields and reads nothing else off the input
// object, so a stray credential-shaped property can never reach the file.
//
// Story 31.5 has not landed yet: the installer still asks a single
// knowledgebase question, so both stores are pointed at that one answer
// (mapped in `writeProjectLayoutYaml` below) — this is what keeps the
// existing single-knowledgebase wizard working unmodified until 31.5 splits
// it into two independent questions. That mapping applies only while the two
// committed stores AGREE; once they diverge, the single answer goes to the
// software store (FR264) and the system store is preserved — see the
// preservation block in `writeProjectLayoutYaml`.
const PROJECT_LAYOUT_SCHEMA_VERSION = 2;

// `backend` is a CLOSED enum in both directions, exactly like `mode`. Defined
// ONCE - now in `lib/store-backends.js`, not here - and consumed by both halves
// (`storeFromRaw` on read, `serializeStore` on write) because the two spelled it
// out as independent inline literals with independently hand-written error
// messages, and that is the precise shape of the defect this epic has now found
// three times: write side and read side disagreeing about a closed enum. Story
// 31.5 asks `backend` per store, doubling the surface, so the set is
// single-sourced before that lands rather than after.
//
// Story 31.3 / 2B nit 1 — MOVED OUT of this file. The definition used to live
// here, which left `lib/installer.js` (which must not require bin/cli.js) with a
// SECOND, unpinned spelling of the same default. Both now read the leaf module.
// The Set is rebuilt from the shared list rather than exported from it because
// membership tests are on hot read/write paths and Set lookup is what the rest of
// this file is written against.
const STORE_BACKENDS = new Set(STORE_BACKEND_LIST);

// The backend a store has when it never states one. Both the pre-F26 legacy
// block (AC5) and the legacy `{mode, path}` wizard shape omit `backend:`
// entirely, and "never stated" has always meant file-system on the read half,
// the write half, the display half and `generateRepoLayoutSection`'s
// project-context half. `DEFAULT_STORE_BACKEND` is imported from
// `lib/store-backends.js` at the top of this file — deliberately NOT re-declared
// here, so `const DEFAULT_STORE_BACKEND = '...'` appears nowhere in this file and
// a fourth definition cannot be reintroduced by a copy/paste.

// Both backend messages are DERIVED from the set above, never hand-written, so
// a member added to the enum cannot be named by one direction and omitted by
// the other. Renders `"file-system" or "confluence"`; the quoting matches
// requireKnownMode's, so an offending value and the legal values read alike.
// The exact rendering is pinned by the suite - "each member appears somewhere
// in the message" is too weak to notice the separator changing.
function legalBackendsForMessage() {
  const members = [...STORE_BACKENDS].map((b) => JSON.stringify(b));
  if (members.length < 2) return members.join('');
  return `${members.slice(0, -1).join(', ')} or ${members[members.length - 1]}`;
}

// ─── The per-backend IDENTITY VIEW, keyed by STORE_BACKENDS ─────────────────
//
// What IDENTIFIES a store is backend-specific. A `file-system` store is
// {mode, path, gitUrl?}; a `confluence` store has NEITHER a mode nor a path —
// its identity is a space key plus a `{title, id}` root page. Two consumers need
// that per-backend field list, and both previously assumed the file-system shape
// was total:
//
//   - showCurrentLayout, which printed `Mode: undefined / Path: undefined` for a
//     completely valid confluence store — the display defect;
//   - the DIVERGENCE test writeProjectLayoutYaml's preservation needs, to decide
//     whether the two committed stores already point at different places — the
//     read/write defect.
//
// One table, keyed by the enum members, exactly as MODE_PROMPT_TITLES is keyed by
// the mode enums: a backend added to STORE_BACKENDS names its fields once here
// and both the renderer and the comparator follow. A backend-aware renderer with
// its own private list of backends would reinstate precisely the read/write
// disagreement the shared-enum work removed.
//
// `storeIdentityFields` THROWS for a backend with no entry rather than degrading
// to the file-system shape. A permissive fallback is exactly how a confluence
// store came to render as `undefined`, and the suite pins that these keys are
// the whole of STORE_BACKENDS, so the throw is unreachable by construction.
//
// Each field is `{label, value, omitWhenAbsent?}`: `label` is the human field
// name, `value` the raw stored value with null/absent meaning "never
// configured", and `omitWhenAbsent` marks a field that is simply not printed
// when it has no value (today's `gitUrl`, shown only in remote mode).
const STORE_BACKEND_VIEWS = Object.freeze({
  'file-system': Object.freeze({
    // Exactly today's three lines in today's order, and no `Backend:` line: a
    // file-system store must render byte-identically to before (display AC2).
    identity: (store) => [
      { label: 'Mode', value: store.mode },
      { label: 'Path', value: store.path },
      { label: 'Git URL', value: store.gitUrl, omitWhenAbsent: true },
    ],
  }),
  confluence: Object.freeze({
    // `backend` comes in as the RESOLVED backend rather than being re-spelled
    // here, so this table names each backend exactly once — as a key.
    identity: (store, backend) => [
      { label: 'Backend', value: backend },
      { label: 'Space key', value: store.spaceKey },
      { label: 'Root page title', value: (store.rootPage && store.rootPage.title) },
      { label: 'Root page id', value: (store.rootPage && store.rootPage.id) },
    ],
  }),
});

// An absent/empty `backend` is "never stated" — file-system — matching
// storeFromRaw on the read half and serializeStore on the write half.
function backendOfStore(store) {
  const declared = (store && typeof store.backend === 'string' && store.backend !== '')
    ? store.backend : null;
  return declared || DEFAULT_STORE_BACKEND;
}

function storeIdentityFields(store) {
  const backend = backendOfStore(store);
  const view = STORE_BACKEND_VIEWS[backend];
  if (!view) {
    throw new Error(
      `No identity view for knowledge-store backend ${describeValue(backend)} — ` +
      `STORE_BACKEND_VIEWS must name every member of STORE_BACKENDS ` +
      `(${legalBackendsForMessage()}). Refusing to guess which fields identify ` +
      `this store, because guessing the file-system shape is what rendered a ` +
      `confluence store as "undefined".`
    );
  }
  return view.identity(store || {}, backend);
}

// sprint_management is the third location record and carries NO backend (P5-9.5)
// — its shape is discriminated by `mode: jira`, which likewise has no `path`.
// Kept alongside the store views because the renderer walks all three records
// and `Path: undefined` for a Jira sprint backend is the same defect in the same
// function.
function sprintIdentityFields(sprint) {
  const s = sprint || {};
  if (s.mode === 'jira') {
    return [
      { label: 'Mode', value: s.mode },
      { label: 'Jira URL', value: s.jiraUrl },
      { label: 'Jira project key', value: s.jiraProjectKey },
    ];
  }
  return [
    { label: 'Mode', value: s.mode },
    { label: 'Path', value: s.path },
    { label: 'Git URL', value: s.gitUrl, omitWhenAbsent: true },
  ];
}

// An absent field and an empty one are the same "never configured" value on both
// sides of a comparison — which is exactly what scalarString() already
// normalised on read.
function identityValueKey(v) {
  return (v == null || v === '') ? null : String(v);
}

/**
 * Do the two knowledge stores point at DIFFERENT places? Derived from the same
 * table the renderer uses, so a future backend can never be compared on
 * file-system fields it does not have.
 *
 * This is the predicate the whole read/write fix turns on: while the two stores
 * agree, collapsing them onto the single legacy `knowledgebase` value is exact
 * and mapping one answered location back onto both is correct (FR264/NFR82).
 * Once they disagree, that mapping destroys one of them.
 */
function storesDiverge(a, b) {
  if (backendOfStore(a) !== backendOfStore(b)) return true;
  const fa = storeIdentityFields(a);
  const fb = storeIdentityFields(b);
  // Same backend ⇒ same field list by construction; compared anyway so a table
  // entry that ever became input-dependent cannot make two stores compare equal
  // on a subset of their identity.
  if (fa.length !== fb.length) return true;
  for (let i = 0; i < fa.length; i++) {
    if (fa[i].label !== fb[i].label) return true;
    if (identityValueKey(fa[i].value) !== identityValueKey(fb[i].value)) return true;
  }
  return false;
}

// The words a genuinely absent optional field renders as. Never a JavaScript
// primitive: `undefined` in this output reads as file corruption, and a user who
// concludes that re-runs the wizard.
const IDENTITY_NOT_CONFIGURED = 'not configured';

/**
 * TOTAL display coercion for one identity value. Cannot throw and cannot emit
 * the literal `undefined`: null/absent/empty render as words, and anything else
 * goes through describeValue (itself total).
 *
 * A store whose `path` is genuinely the nine-character string "undefined" does
 * render as `undefined` — that is the true value of the field, not this defect.
 */
function renderIdentityValue(v) {
  if (typeof v === 'string') return v === '' ? IDENTITY_NOT_CONFIGURED : v;
  if (v == null) return IDENTITY_NOT_CONFIGURED;
  return describeValue(v);
}

// One-line rendering of a store's identity, for a warning message rather than
// the multi-line display block. Same table, so it can never describe a store by
// fields that store does not have.
function summarizeStoreIdentity(store) {
  return storeIdentityFields(store)
    .filter((f) => !(f.omitWhenAbsent && (f.value == null || f.value === '')))
    .map((f) => `${f.label}: ${renderIdentityValue(f.value)}`)
    .join(', ');
}

// TOTAL value renderer for error messages. `JSON.stringify` is not total: it
// THROWS on a BigInt and on a circular object, and returns `undefined` (not a
// string) for a function or a symbol. On an error path that means a bare
// TypeError escaping in place of the intended message - naming neither the
// offending field nor the legal set, which is the one thing the message exists
// to say. Unreachable from today's callers (the wizard produces `{mode, path}`
// and readExistingLayout returns validated topology or null), but an error path
// is the worst possible place to hold a second error.
function describeValue(v) {
  try {
    const s = JSON.stringify(v);
    if (typeof s === 'string') return s;
  } catch (e) { /* BigInt, circular reference, a throwing toJSON */ }
  try {
    return typeof v === 'symbol' ? v.toString() : String(v);
  } catch (e) { /* a throwing toString / valueOf / Symbol.toPrimitive */ }
  return `[unprintable ${typeof v}]`;
}

// N-1: `mode` is a CLOSED enum in both directions, exactly like `backend`.
// It was previously the one field raw-interpolated on write (`mode: ${mode}`)
// and merely string-coerced on read, so a hand-edited `mode:` was a value
// channel that became SYNTAX on the next write - it round-tripped through
// readExistingLayout -> collectRepoLayout(--yes) -> writeProjectLayoutYaml and
// emitted whatever it contained (an `api_token:` key, a second
// `schema_version:`) at valid indentation, into both store records. Escaping is
// the wrong instrument here: `mode: same` is deliberately unquoted, so the
// values are validated instead and only enum members are ever emitted.
//
// The sets come from collectRepoLayout: every store mode is same|local|remote,
// and sprint_management additionally offers jira.
const STORE_MODES = new Set(['same', 'local', 'remote']);
const SPRINT_MODES = new Set(['same', 'local', 'remote', 'jira']);

// The wizard is the THIRD direction that touches these enums: it PRODUCES the
// value the writer validates and the reader reads back. It used to spell the
// members out a third time as a literal `modeChoices` array, so a prompt could
// offer a mode the writer rejects, or an enum could gain a member the prompt
// never offers. One title per member here; the per-concern choice list is the
// relevant enum mapped through this table (Set iteration is insertion-ordered,
// so the offered order is the enum's order). A member with no title would be
// unofferable, so the suite pins that these keys are exactly the union of the
// two enums.
//
// Frozen because it is exported: a consumer that assigned a title here would
// silently change what the wizard offers for every subsequent run in the
// process. The Sets above cannot be protected the same way - `Object.freeze`
// does not stop `Set.prototype.add` - so `module.exports` hands out COPIES of
// them instead of the live objects (see the export list at the bottom).
const MODE_PROMPT_TITLES = Object.freeze({
  same: 'Current repository (default)',
  local: 'Local path',
  remote: 'Remote git repository',
  jira: 'Jira',
});

function modeChoicesFor(concern) {
  const legal = concern === 'sprintManagement' ? SPRINT_MODES : STORE_MODES;
  return [...legal].map((value) => ({ title: MODE_PROMPT_TITLES[value], value }));
}

// Read half. Throws; resolveProjectTopology converts it to `invalid`. Failing
// loud rather than coercing to 'same' mirrors the `backend` enum for the same
// reason: `mode` decides whether a path is cloned, and whether sprint artifacts
// live in Jira or on disk, so guessing would silently repoint a store. It also
// keeps the non-destruction guard engaged instead of laundering a tampered
// value into a clean file on the next write.
function requireKnownMode(mode, legal, fieldName) {
  if (legal.has(mode)) return mode;
  throw new Error(
    `Unknown ${fieldName} mode ${JSON.stringify(mode)} in ` +
    `_bmad-output/project-layout.yaml. Expected one of ` +
    `${[...legal].map((m) => JSON.stringify(m)).join(', ')}. Refusing to guess.`
  );
}

// Write half. An unknown mode must never reach the file, so this throws before
// any bytes are produced - same contract as serializeStore's backend enum, and
// the two install-time call sites already degrade such a throw to
// warn-and-leave-UNBOUND. Returns the validated member, which by construction
// contains no character needing YAML quoting.
//
// `describeValue` here, plain `JSON.stringify` in requireKnownMode above. The
// difference is the TYPE GUARD on the input, not the age or provenance of the
// function. requireKnownMode is only ever reached through `scalarString()`, so
// its `mode` is a non-empty string by construction and JSON.stringify is total
// on it. This function takes `store.mode` / `sprint.mode` straight off a
// caller-supplied object with no guard at all, and `writeProjectLayoutYaml` is
// exported - so `writeProjectLayoutYaml({sprintManagement: {mode: 1n}})` really
// does reach here with a BigInt and really would throw a bare TypeError naming
// neither the field nor the legal set. Behaviour is unchanged for every
// reachable input: describeValue(s) === JSON.stringify(s) for every string.
function assertWritableMode(mode, legal, fieldName) {
  if (legal.has(mode)) return mode;
  throw new Error(
    `Refusing to write _bmad-output/project-layout.yaml: invalid ${fieldName} mode ` +
    `${describeValue(mode)} — must be one of ${[...legal].join(', ')}`
  );
}

// Minimal indentation-aware reader for the subset of YAML this module itself
// writes (flat scalars, one level of nesting for a store's `root_page`).
// Deliberately not a general YAML parser — scoped to project-layout.yaml's
// own shape, old (FR122/16.2) and new (schema v2) alike, matching this
// codebase's existing hand-rolled-parser convention for this file rather
// than introducing a new dependency on a hot path.
function parseLayoutYaml(content) {
  const root = {};
  const stack = [{ indent: -1, obj: root }];
  for (const rawLine of content.split(/\r?\n/)) {
    if (!rawLine.trim() || rawLine.trim().startsWith('#')) continue;
    const indent = rawLine.match(/^\s*/)[0].length;
    const line = rawLine.trim();
    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) continue;
    const key = line.slice(0, colonIdx).trim();
    let value = line.slice(colonIdx + 1).trim();

    while (stack.length > 1 && indent <= stack[stack.length - 1].indent) stack.pop();
    const parent = stack[stack.length - 1].obj;

    if (value === '') {
      const child = {};
      parent[key] = child;
      stack.push({ indent, obj: child });
    } else {
      // R-4: decode with the exact inverse of yamlEscapeValue. The old
      // two-replace form handled only \" and \\, so every other escape the
      // writer emits read back as literal backslash-text - a reader/writer
      // disagreement that made the round trip lossy and non-idempotent.
      // `[\s\S]` rather than `.` in the quote test because `.` does not match
      // U+2028/U+2029/CR/LF, so a hand-written file carrying one of those raw
      // silently failed quote-detection and kept its surrounding quotes.
      if (/^"[\s\S]*"$/.test(value)) value = yamlUnescapeDoubleQuoted(value.slice(1, -1));
      else if (value === 'null' || value === '~') value = null;
      parent[key] = value;
    }
  }
  return root;
}

/**
 * parseLayoutYaml renders an EMPTY scalar (`path:` / `backend:` / `space_key:`
 * with nothing after the colon) as `{}`, because an empty value is how this
 * reader signals "a nested block follows". Every field read off a parsed record
 * must therefore go through this coercion, or the object leaks downstream and
 * surfaces either as a TypeError (`path.isAbsolute({})`) or, worse, as the string
 * `"[object Object]"` written back into the authoritative file on the next save.
 *
 * Returns the string, or null for anything that is not a usable non-empty
 * scalar (`{}`, null, an empty string, a number - parseLayoutYaml never
 * produces one, but a caller could).
 */
function scalarString(v) {
  return (typeof v === 'string' && v !== '') ? v : null;
}

function resolveStoredPath(storedPath, projectRoot) {
  if (!storedPath) return '.';
  if (storedPath === '.') return storedPath;
  // If already absolute, use as-is (backward compat)
  if (path.isAbsolute(storedPath) || /^[A-Za-z]:/.test(storedPath)) return storedPath;
  // Relative path — resolve from project root
  return normalizePath(path.resolve(projectRoot, storedPath));
}

// Raw parsed section -> internal store shape, with portable-path resolution.
// Every field is read through scalarString(), so an empty scalar anywhere in the
// record degrades to that field's documented default instead of leaking a `{}`
// into the topology (see scalarString above).
function storeFromRaw(raw, projectRoot) {
  if (!raw || typeof raw !== 'object') return null;

  // The backend enum is CLOSED on read as well as on write: an unrecognised
  // value must not silently fall through to file-system and, with no `path:`
  // present, resolve the store to the PROJECT ROOT. Fail loud per the P5-9.3 /
  // NFR56 posture; resolveProjectTopology turns this throw into an `invalid`
  // result.
  //
  // R-5: an ABSENT `backend:` and an EMPTY `backend:` are both "the field was
  // never stated" and both default to file-system (AC5's pre-F26 legacy block).
  // Previously only absence was handled, so an empty scalar reached the enum
  // check as `{}` and produced the unactionable message
  // `Unknown knowledge-store backend {}` - a throw where the contract promises
  // coercion, and the exact opposite of what the identical malformation on
  // `path:` does. Only a non-empty STRING that is not one of the two legal
  // values is a genuine unknown backend.
  const backend = scalarString(raw.backend) || DEFAULT_STORE_BACKEND;
  if (!STORE_BACKENDS.has(backend)) {
    throw new Error(
      `Unknown knowledge-store backend ${JSON.stringify(backend)} in ` +
      `_bmad-output/project-layout.yaml. Expected ${legalBackendsForMessage()}. ` +
      `Refusing to guess - an unrecognised backend would otherwise resolve this ` +
      `store to the project root.`
    );
  }
  if (backend === 'confluence') {
    // R-3: this branch previously used bare `!= null` checks with no string
    // coercion, so an empty `space_key:` / `title:` / `id:` scalar resolved to
    // `{}` and the next write emitted `space_key: "[object Object]"` into the
    // authoritative file. Identical defect class to the file-system branch
    // below, in the branch the first fix round did not touch.
    const rp = (raw.root_page && typeof raw.root_page === 'object') ? raw.root_page : {};
    return {
      backend: 'confluence',
      spaceKey: scalarString(raw.space_key),
      rootPage: {
        title: scalarString(rp.title),
        id: scalarString(rp.id),
      },
    };
  }
  const mode = requireKnownMode(scalarString(raw.mode) || 'same', STORE_MODES, 'knowledge-store');
  const rawPath = scalarString(raw.path) || '.';
  const resolvedPath = resolveStoredPath(rawPath, projectRoot);
  const entry = { backend: 'file-system', mode, path: resolvedPath };
  if (mode === 'remote') {
    const gitUrl = scalarString(raw.gitUrl);
    if (gitUrl) entry.gitUrl = gitUrl;
  }
  return entry;
}

function sprintFromRaw(raw, projectRoot) {
  if (!raw || typeof raw !== 'object') return { mode: 'same', path: '.' };
  if (scalarString(raw.mode) === 'jira') {
    // `raw.jira_url || ''` was the same uncoerced read as the confluence branch:
    // an empty `jira_url:` scalar is `{}`, which is TRUTHY, so it survived the
    // `||` and the next write emitted `jira_url: "[object Object]"`.
    return {
      mode: 'jira',
      jiraUrl: scalarString(raw.jira_url) || '',
      jiraProjectKey: scalarString(raw.jira_project_key) || '',
    };
  }
  const mode = requireKnownMode(scalarString(raw.mode) || 'same', SPRINT_MODES, 'sprint_management');
  const rawPath = scalarString(raw.path) || '.';
  const resolvedPath = resolveStoredPath(rawPath, projectRoot);
  const entry = { mode, path: resolvedPath };
  if (mode === 'remote') {
    const gitUrl = scalarString(raw.gitUrl);
    if (gitUrl) entry.gitUrl = gitUrl;
  }
  return entry;
}

/**
 * AC8 / NFR83 - the binding resolver. Given only a project root, returns the full
 * committed topology from `_bmad-output/project-layout.yaml` alone, with NO
 * reference to `_bmad/` or any other per-machine install state. This is the
 * library function `ma-agents bind` and `ma-agents status` are meant to call (the
 * commands themselves are Story 31.13); a globally-installed BMAD SKILL does not
 * call this directly - per Story 31.6 AC5 skills keep reading the generated
 * `_bmad/bmm/config.yaml`, and satisfy NFR83 indirectly by detecting a
 * missing/stale binding and offering `ma-agents bind` (31.11 AC6 -> 31.13 AC3).
 * See implementation-readiness-f26.md finding F-3 - the two ACs describe two
 * different consumers, not a contradiction.
 *
 * AC5 (FR265 read half): a pre-F26 file (no `schema_version`, a single
 * `knowledgebase:` record) resolves as BOTH stores pointing at that one location -
 * no error, no rewrite. This function never writes.
 *
 * CONTRACT - a DISCRIMINATED result. Never returns null, never throws:
 *
 *     { ok: true,  topology: {...} }
 *     { ok: false, reason: 'unbound' | 'unreadable' | 'invalid' | 'too-new', message: '...' }
 *
 *   - `unbound`    - no binding here to speak of: absent, or empty / comments-only.
 *                    The ONLY reason under which a caller may write.
 *   - `unreadable` - bytes exist but nothing trustworthy can be extracted: an I/O
 *                    error, content js-yaml rejects (see the validity gate below),
 *                    or a parse yielding no keys at all.
 *   - `invalid`    - parses, declares a binding, but not one this build can
 *                    honour: an unrecognised `backend:` or `mode:`, or keys with
 *                    no recognisable store record.
 *   - `too-new`    - a `schema_version` from a newer ma-agents. Split out from
 *                    `invalid` so `ma-agents status` (31.13) can say "upgrade
 *                    ma-agents" rather than "this file is corrupt"; the behaviour
 *                    is identical - refuse to read, refuse to overwrite.
 *
 * Every `ok:false` reason other than `unbound` means a caller MUST NOT overwrite
 * the file and should report `message` verbatim (P5-9.3 / NFR56 fail-loud).
 * The discriminated shape (rather than the superseded null-or-throw pair) is what
 * makes that unmissable: any caller reaching for `.topology` is forced past `.ok`,
 * so 31.3, 31.4 and 31.13 cannot each forget a try/catch. Rationale for the change
 * is in the commit message and the story record.
 */
const BINDING_UNBOUND = 'unbound';
const BINDING_UNREADABLE = 'unreadable';
const BINDING_INVALID = 'invalid';
const BINDING_TOO_NEW = 'too-new';

function resolveProjectTopology(projectRoot) {
  const layoutPath = path.join(projectRoot, '_bmad-output', 'project-layout.yaml');
  const fail = (reason, message) => ({ ok: false, reason, message });

  let content;
  try {
    if (!fs.existsSync(layoutPath)) {
      return fail(BINDING_UNBOUND,
        `No _bmad-output/project-layout.yaml in ${projectRoot} - this project has no ` +
        `committed knowledge binding yet.`);
    }
    content = fs.readFileSync(layoutPath, 'utf-8');
  } catch (e) {
    return fail(BINDING_UNREADABLE,
      `Cannot read _bmad-output/project-layout.yaml: ${e.message}`);
  }

  const hasContent = content
    .split(/\r?\n/)
    .some((l) => l.trim() !== '' && !l.trim().startsWith('#'));
  if (!hasContent) {
    return fail(BINDING_UNBOUND,
      `_bmad-output/project-layout.yaml is empty - this project has no committed ` +
      `knowledge binding yet.`);
  }

  // N-2 - THE VALIDITY GATE. parseLayoutYaml is deliberately lenient (it skips
  // any line without a colon, and is indentation-agnostic about tabs), so it
  // happily "reads" files a real YAML parser rejects: a git merge conflict
  // (`<<<<<<< HEAD` / `=======` / `>>>>>>> origin/main` all lack a colon and are
  // silently dropped, leaving the last-writer side) or tab-indented content.
  // Without this gate the non-destruction guard in writeProjectLayoutYaml was
  // adjudicated by the lenient parser, so it returned ok:true for genuinely
  // corrupt bytes and the overwrite proceeded - destroying the conflict markers
  // and one side of the merge with no warning. project-layout.yaml is COMMITTED
  // and carries a `generated:` date that changes on every install, so conflicts
  // are ordinary, not exotic.
  //
  // js-yaml validates ONLY; parseLayoutYaml remains the reader (its escape
  // handling and shape are what the rest of this module is built on). The throw
  // is classified `unreadable` - bytes exist but nothing trustworthy can be
  // extracted - and is caught here so this function stays total.
  try {
    yaml.load(content);
  } catch (e) {
    return fail(BINDING_UNREADABLE,
      `_bmad-output/project-layout.yaml is not valid YAML: ${(e && e.message) || String(e)}\n` +
      `  If this is a merge conflict, resolve it by hand — or delete the file and re-run the ` +
      `installer to write a fresh binding.`);
  }

  let raw;
  try {
    raw = parseLayoutYaml(content);
  } catch (e) {
    return fail(BINDING_UNREADABLE,
      `Cannot parse _bmad-output/project-layout.yaml: ${e.message}`);
  }
  if (!raw || typeof raw !== 'object' || Object.keys(raw).length === 0) {
    return fail(BINDING_UNREADABLE,
      `_bmad-output/project-layout.yaml has content but no readable fields. Fix it, or ` +
      `delete it and re-run the installer to write a fresh binding.`);
  }

  // Schema gate. An absent or empty `schema_version:` means a pre-F26 file (AC5),
  // which is schema 1. A version this build does not understand is INVALID and
  // must not be read as v2 or overwritten: a newer ma-agents may have recorded
  // records or fields that would be silently dropped on the next write.
  const declaredVersion = scalarString(raw.schema_version);
  let schemaVersion = 1;
  if (declaredVersion !== null) {
    if (!/^\d+$/.test(declaredVersion.trim())) {
      return fail(BINDING_INVALID,
        `_bmad-output/project-layout.yaml has a non-numeric schema_version ` +
        `${JSON.stringify(declaredVersion)}. Refusing to guess which schema this file uses.`);
    }
    schemaVersion = parseInt(declaredVersion.trim(), 10);
  }
  if (schemaVersion > PROJECT_LAYOUT_SCHEMA_VERSION) {
    return fail(BINDING_TOO_NEW,
      `_bmad-output/project-layout.yaml declares schema_version ${schemaVersion}, but this ` +
      `ma-agents understands up to ${PROJECT_LAYOUT_SCHEMA_VERSION}. It was written by a newer ` +
      `version. Refusing to read or overwrite it - upgrade ma-agents instead.`);
  }

  try {
    if (schemaVersion >= PROJECT_LAYOUT_SCHEMA_VERSION && raw.system_requirements_store) {
      const systemStore = storeFromRaw(raw.system_requirements_store, projectRoot);
      const softwareStore = storeFromRaw(raw.software_requirements_store, projectRoot);
      if (!systemStore || !softwareStore) {
        return fail(BINDING_INVALID,
          `_bmad-output/project-layout.yaml declares schema_version ${schemaVersion} but is ` +
          `missing a required store record (system_requirements_store / ` +
          `software_requirements_store).`);
      }
      return {
        ok: true,
        topology: {
          schemaVersion,
          generated: scalarString(raw.generated),
          systemRequirementsStore: systemStore,
          softwareRequirementsStore: softwareStore,
          sprintManagement: sprintFromRaw(raw.sprint_management, projectRoot),
        },
      };
    }

    // Legacy (FR122/Story 16.2 shape, or a schema_version < 2 file): a single
    // `knowledgebase:` record read as both stores pointing at that location.
    const legacyStore = storeFromRaw(raw.knowledgebase, projectRoot);
    if (!legacyStore) {
      return fail(BINDING_INVALID,
        `_bmad-output/project-layout.yaml has content but declares no recognisable store ` +
        `record (expected system_requirements_store for schema ` +
        `${PROJECT_LAYOUT_SCHEMA_VERSION}, or knowledgebase for a pre-F26 file). Fix it, or ` +
        `delete it and re-run the installer to write a fresh binding.`);
    }
    return {
      ok: true,
      topology: {
        schemaVersion: 1,
        generated: scalarString(raw.generated),
        systemRequirementsStore: legacyStore,
        softwareRequirementsStore: { ...legacyStore },
        sprintManagement: sprintFromRaw(raw.sprint_management, projectRoot),
      },
    };
  } catch (e) {
    // storeFromRaw's closed-enum throw, and anything else semantic. Converted
    // here so that this function's never-throws contract holds for every caller.
    return fail(BINDING_INVALID, e.message);
  }
}

// Enumerate exactly {mode, path, gitUrl} — see the NFR79 note at the top of
// this section. `store` here is always a file-system-backend store.
function serializeFileSystemStore(store, projectRoot) {
  const mode = assertWritableMode((store && store.mode) || 'same', STORE_MODES, 'knowledge-store');
  const rawPath = (store && store.path != null) ? store.path : '.';
  const portable = toPortablePath(rawPath, projectRoot);
  let out = `  backend: file-system\n`;
  out += `  mode: ${mode}\n`;
  out += `  path: ${yamlEscapeValue(portable.portable)}\n`;
  if (portable.isAbsolute) {
    out += `  # PORTABILITY: absolute path — other developers may need to reconfigure\n`;
  }
  if (mode === 'remote' && store.gitUrl) {
    out += `  gitUrl: ${yamlEscapeValue(store.gitUrl)}\n`;
  }
  return out;
}

// Enumerate exactly {space_key, root_page: {title, id}} — nothing else is
// ever read off `store`, so an accidental credential field on the in-memory
// object (e.g. a `token`/`password` picked up upstream) cannot leak into the
// committed file. This is what AC6's "no credential-shaped field can be
// written" test proves, and what makes the file safe to commit (NFR79).
function serializeConfluenceStore(store) {
  const rootPage = (store && store.rootPage) || {};
  // The line-break POLICY check lives here, not in yamlEscapeValue: this is the
  // layer that knows it is writing project-layout.yaml and which field is at
  // fault, so the message names both. Escaping already guarantees the emitted
  // file is parseable whatever these values contain (see yamlEscapeValue); this
  // guard exists because a multi-line Confluence space key or page title is
  // meaningless identity, not because it is dangerous.
  const spaceKey = assertSingleLineIdentity(store && store.spaceKey, 'space_key');
  const title = assertSingleLineIdentity(rootPage.title, 'root_page.title');
  const id = assertSingleLineIdentity(rootPage.id, 'root_page.id');
  let out = `  backend: confluence\n`;
  out += `  space_key: ${yamlEscapeValue(spaceKey)}\n`;
  out += `  root_page:\n`;
  out += `    title: ${title ? yamlEscapeValue(title) : 'null'}\n`;
  out += `    id: ${id ? yamlEscapeValue(id) : 'null'}\n`;
  return out;
}

// AC1 — the legal backends, from the one STORE_BACKENDS definition the read
// half enforces too. Fail loud on anything else rather than silently coercing a
// typo'd/unknown backend into file-system, which would write a DIFFERENT backend
// than the caller asked for with no signal at all.
//
// `backend === undefined` remains LEGAL and falls through to the file-system
// serializer: callers still pass the legacy `{mode, path}` shape (the installer's
// `layout.knowledgebase`, and writeProjectLayoutYaml's own `{mode:'same'}`
// default), and an absent backend there means "never stated", exactly as it does
// on the read half. Only a STATED backend outside the enum is an error.
function serializeStore(store, projectRoot) {
  const backend = store && store.backend;
  if (backend !== undefined && !STORE_BACKENDS.has(backend)) {
    throw new Error(
      `Invalid store backend ${describeValue(backend)} — must be ${legalBackendsForMessage()}`
    );
  }
  if (backend === 'confluence') return serializeConfluenceStore(store);
  return serializeFileSystemStore(store, projectRoot);
}

function serializeSprintManagement(sprint, projectRoot) {
  let out = `sprint_management:\n`;
  if (sprint && sprint.mode === 'jira') {
    out += `  mode: jira\n`;
    out += `  jira_url: ${yamlEscapeValue(sprint.jiraUrl)}\n`;
    out += `  jira_project_key: ${yamlEscapeValue(sprint.jiraProjectKey)}\n`;
    return out;
  }
  // SPRINT_MODES, not STORE_MODES: sprint management's legal set includes
  // `jira`. The two are interchangeable for the values that actually reach here
  // (the `jira` early return above shadows the only member they differ on), but
  // the enum decides what the ERROR MESSAGE enumerates - and with STORE_MODES an
  // invalid sprint mode was told the legal values were `same, local, remote`,
  // omitting the one mode the read half accepts and the Jira backend depends on.
  // The equivalence was also load-bearing on that early return's position, so a
  // later reorder would have made sprint `jira` unwritable.
  const mode = assertWritableMode((sprint && sprint.mode) || 'same', SPRINT_MODES, 'sprint_management');
  const rawPath = (sprint && sprint.path != null) ? sprint.path : '.';
  const portable = toPortablePath(rawPath, projectRoot);
  out += `  mode: ${mode}\n`;
  out += `  path: ${yamlEscapeValue(portable.portable)}\n`;
  if (portable.isAbsolute) {
    out += `  # PORTABILITY: absolute path — other developers may need to reconfigure\n`;
  }
  if (mode === 'remote' && sprint && sprint.gitUrl) {
    out += `  gitUrl: ${yamlEscapeValue(sprint.gitUrl)}\n`;
  }
  return out;
}

/**
 * Writes the authoritative binding spine, `_bmad-output/project-layout.yaml`
 * (P5-9.1). AC2/AC3 (Story 31.2): written UNCONDITIONALLY on every call — the
 * pre-31.2 "both concerns are same-repo => skip, and unlink any stale file"
 * branch is gone. An installer run must never delete this file once it
 * exists; AC3's regression test pins that no code path here calls
 * `fs.unlinkSync`.
 *
 * Accepts the installer's existing `{knowledgebase, sprintManagement}` shape
 * (unchanged, since Story 31.5 — not 31.2 — splits the wizard into two
 * independent store questions) and maps it onto the new three-record schema:
 * both `system_requirements_store` and `software_requirements_store` are
 * written from `layout.knowledgebase` (both stores -> the one answered
 * location), so nothing regresses before 31.5 lands. A caller that already
 * has two independently-resolved stores (a future 31.5/31.13 caller) may
 * instead pass `systemRequirementsStore` / `softwareRequirementsStore`
 * directly and they take precedence.
 */
function writeProjectLayoutYaml(layout) {
  const projectRoot = process.cwd();
  const layoutPath = path.join(projectRoot, '_bmad-output', 'project-layout.yaml');

  // Guard the directory creation. Pre-31.2 this function ran only in
  // multi-repo/Jira mode; AC2 makes it run on EVERY project install, which is
  // what made an unwritable `_bmad-output/` reachable — and it runs in Step 3.6,
  // AFTER the BMAD install has already completed, so an unhandled throw here
  // would abort a substantially-finished install. Mirrors the existing
  // non-fatal policy in writeRepoLayoutConfig(). Warn and return rather than
  // half-writing: a truncated authoritative binding is worse than none, and the
  // resolver treats an absent file as "unbound" (a recoverable state that
  // `ma-agents bind` fixes) rather than as corruption.
  try {
    fs.mkdirSync(path.join(projectRoot, '_bmad-output'), { recursive: true });
  } catch (e) {
    console.log(
      chalk.yellow(
        `  Warning: could not create _bmad-output/ for project-layout.yaml: ${e.message}\n` +
        `  The project is left UNBOUND — re-run the installer once _bmad-output/ is writable\n` +
        `  (a future \`ma-agents bind\` will do this without a full re-install).`
      )
    );
    return;
  }

  // R-2 - THE NON-DESTRUCTION GUARD. AC2 makes this function run on every
  // install and every bind, so it is the single choke point through which every
  // overwrite of the authoritative binding passes. Putting the guard here rather
  // than at each call site is deliberate: 31.3, 31.4 and 31.13 add more callers,
  // and a guard they have to remember is a guard that will be forgotten - which
  // is precisely how the first fix round ended up destroying a `backend: notion`
  // binding and replacing it with `file-system / path: "."`.
  //
  // Only `unbound` (absent or empty file) permits a write. Every other reason
  // means there are bytes here that this build does not understand, and replacing
  // them would be unrecoverable data loss. Refuse, fail loud, and leave the file
  // exactly as it is (P5-9.3).
  const existing = resolveProjectTopology(projectRoot);
  if (!existing.ok && existing.reason !== BINDING_UNBOUND) {
    console.log(
      chalk.red(
        `  Refusing to overwrite _bmad-output/project-layout.yaml - the existing binding is ` +
        `${existing.reason}:\n` +
        `    ${existing.message}\n` +
        `  The file has been left UNCHANGED. To recover: fix it by hand, or delete ` +
        `_bmad-output/project-layout.yaml and re-run the installer to write a fresh binding.`
      )
    );
    return;
  }

  // ── PRESERVATION. A record the caller did not supply is carried over from the
  // existing file rather than being stamped with a default or with another
  // record's value.
  //
  // This sits HERE, at the same choke point as the non-destruction guard above
  // and off the SAME read of the existing file, for the reason that guard is
  // here: 31.3, 31.4, 31.5 and 31.13 add more callers, and a preservation step
  // each of them has to remember is one that will be forgotten. It composes with
  // the guard rather than bypassing it — the guard has already returned for every
  // reason except `unbound`, so by this line `existing` is either an ok topology
  // (something to preserve) or an absent/empty file (nothing to lose). There is
  // no third case in which preservation could silently do nothing.
  //
  // Order of precedence per record:
  //   1. an explicit per-store argument (`systemRequirementsStore` /
  //      `softwareRequirementsStore`) — the door Story 31.2 built, and what
  //      Story 31.5's two-question wizard will pass;
  //   2. the legacy single `layout.knowledgebase` answer, subject to the
  //      divergence rule below;
  //   3. the corresponding record already in the file;
  //   4. the single-repo default.
  const DEFAULT_RECORD = { mode: 'same', path: '.' };
  const existingTopology = existing.ok ? existing.topology : null;
  const existingSystem = existingTopology ? existingTopology.systemRequirementsStore : null;
  const existingSoftware = existingTopology ? existingTopology.softwareRequirementsStore : null;
  const existingStoresDiverge =
    !!(existingSystem && existingSoftware && storesDiverge(existingSystem, existingSoftware));
  const legacyStore = layout.knowledgebase || null;

  // FR264: the legacy single-valued field resolves to the SOFTWARE requirements
  // store. Unconditionally — divergent or not, one answered location is that
  // store's new location.
  const softwareStore =
    layout.softwareRequirementsStore || legacyStore || existingSoftware || DEFAULT_RECORD;

  // The system store is where the two defects met. While the committed stores
  // AGREE (every project that can exist before Story 31.5), the one answered
  // location maps onto BOTH — today's behaviour, which NFR82 and the existing
  // suites pin, and which is correct because there was only ever one question.
  // Once they DIVERGE, that same mapping is what silently destroyed a Confluence
  // space key, so the answered location goes to the software store only and the
  // system store is preserved verbatim.
  let systemStore;
  if (layout.systemRequirementsStore) {
    systemStore = layout.systemRequirementsStore;
  } else if (legacyStore && !existingStoresDiverge) {
    systemStore = legacyStore;
  } else if (existingSystem) {
    systemStore = existingSystem;
  } else {
    systemStore = legacyStore || DEFAULT_RECORD;
  }

  const sprintManagement =
    layout.sprintManagement
    || (existingTopology ? existingTopology.sprintManagement : null)
    || DEFAULT_RECORD;

  // Non-destructive AND non-blocking, but never silent: the user asked one
  // question and two stores exist, so say which one was left alone and how to
  // change it. Refusing the write instead would be defensible but would break
  // `ma-agents config layout` on exactly the projects Story 31.5 creates.
  if (existingStoresDiverge && legacyStore && !layout.systemRequirementsStore) {
    console.log(chalk.yellow(
      `  Note: this project's two knowledge stores point at DIFFERENT locations, and only\n` +
      `  one location was supplied. Per FR264 it was applied to the SOFTWARE requirements\n` +
      `  store. The SYSTEM requirements store was left UNCHANGED:\n` +
      `    ${summarizeStoreIdentity(existingSystem)}\n` +
      `  To change it, edit the system_requirements_store record in\n` +
      `  _bmad-output/project-layout.yaml.`
    ));
  }

  const date = new Date().toISOString().slice(0, 10);
  let content = `# Generated by ma-agents — do not edit manually\n`;
  content += `# The authoritative, committed record of where this project's knowledge\n`;
  content += `# lives (P5-9.1). Read by the binding resolver (ma-agents bind / status)\n`;
  content += `# and regenerated into _bmad/bmm/config.yaml on install and bind (31.3).\n`;
  content += `schema_version: ${PROJECT_LAYOUT_SCHEMA_VERSION}\n`;
  content += `generated: "${date}"\n`;
  content += `system_requirements_store:\n${serializeStore(systemStore, projectRoot)}`;
  content += `software_requirements_store:\n${serializeStore(softwareStore, projectRoot)}`;
  content += serializeSprintManagement(sprintManagement, projectRoot);

  // Same non-fatal policy for the write itself (EACCES / EROFS / ENOSPC).
  //
  // The serializers can still throw deliberately - the closed backend enum
  // (serializeStore) and the confluence identity guard (assertSingleLineIdentity).
  // Those are caller-visible data errors and are NOT swallowed here. The first
  // round justified that by claiming they "fire BEFORE any bytes are written";
  // that was true here but false for writeConfigField, and it also missed that an
  // uncaught throw from this function reaches main().catch and prints a raw stack
  // trace AFTER the BMAD install has completed. The throws are therefore kept, and
  // the two INSTALL-TIME call sites catch them and degrade to the same
  // warn-and-leave-UNBOUND outcome as an I/O failure. Path and gitUrl values can
  // no longer throw at all: they are escaped, not rejected.
  try {
    fs.writeFileSync(layoutPath, content, 'utf-8');
  } catch (e) {
    console.log(
      chalk.yellow(
        `  Warning: could not write _bmad-output/project-layout.yaml: ${e.message}\n` +
        `  The project is left UNBOUND — re-run the installer once the file is writable\n` +
        `  (a future \`ma-agents bind\` will do this without a full re-install).`
      )
    );
    return;
  }
  console.log(chalk.gray(`  Wrote _bmad-output/project-layout.yaml (system + software requirements stores, sprint management)`));
}

/**
 * Install-time / reconfigure-wizard helper — pre-populates the wizard from
 * whatever binding record already exists. Returns the legacy
 * `{knowledgebase, sprintManagement}` shape every existing consumer
 * (`collectRepoLayout`, `writeRepoLayoutConfig`, `showCurrentLayout`,
 * `handleConfigLayout`) already expects, collapsing the two independently-
 * answered stores onto the single value that shape can hold — the
 * **software requirements store** is the collapse target, matching FR264/
 * P5-9.2's choice of the software-requirements store as the legacy-field
 * target — and ADDITIONALLY returns the full three-record `topology`, so the
 * collapse is a VIEW rather than a loss.
 *
 * STRATEGY (the read defect's AC4): preserve-on-read, option (a), not
 * refuse-to-collapse (b). Rationale:
 *   - The four legacy consumers are on the install and reconfigure paths. Failing
 *     the collapse would make `ma-agents install` and `ma-agents config layout`
 *     refuse to run on any project with two divergent stores — i.e. on exactly
 *     the projects Story 31.5 exists to create — which is a worse outcome than
 *     the display imprecision it would be protecting against.
 *   - Nothing here needs to fail loud, because nothing is lost: the collapsed
 *     value is still exactly the software store (FR264), the full topology rides
 *     alongside it, and the destructive half of the defect is fixed at the WRITE
 *     choke point, where preservation cannot be forgotten by a future caller.
 *   - The one case that genuinely needs a decision — divergent stores plus a
 *     caller supplying only the single legacy value — is decided in
 *     writeProjectLayoutYaml: apply it to the software store, preserve the system
 *     store verbatim, and tell the user. Non-destructive, non-blocking, informative.
 *
 * NOT the AC8 resolver — `resolveProjectTopology()` above is. This function
 * additionally falls back to a bare `_bmad/bmm/config.yaml` (FR265's "has
 * only the FR117 single knowledgebase_path" legacy path, for a project that
 * predates project-layout.yaml's unconditional-write behaviour entirely).
 * That fallback is deliberately scoped to this install-time helper: it is
 * never called by `resolveProjectTopology()`, which per P5-9.1 depends on
 * project-layout.yaml alone.
 */
function readExistingLayout() {
  const projectRoot = process.cwd();
  const binding = resolveProjectTopology(projectRoot);
  if (binding.ok) {
    return {
      knowledgebase: binding.topology.softwareRequirementsStore,
      sprintManagement: binding.topology.sprintManagement,
      // ADDITIVE, non-lossy: the full three-record topology alongside the
      // collapsed legacy view. Every existing consumer reads only the two legacy
      // keys and is unaffected; showCurrentLayout uses this to render a divergent
      // pair instead of silently showing one of them. `null` when the topology
      // came from the config.yaml fallback below, so a consumer can tell
      // "no topology" from "topology with divergent stores" — an absent key would
      // read as the latter by accident.
      topology: binding.topology,
    };
  }
  // R-2: an `invalid` / `unreadable` binding is NOT "no binding". The previous
  // version caught the semantic throw here and fell through to the structural
  // path, which is how a bound-but-invalid project came to be reported as unbound.
  // Report it and stop - do NOT substitute config.yaml values, because per P5-9.1
  // topology comes from project-layout.yaml and nowhere else; quietly answering
  // from config.yaml would be the same conflation one layer down. The wizard
  // simply gets no pre-population, and writeProjectLayoutYaml refuses to
  // overwrite, so nothing is lost.
  if (binding.reason !== BINDING_UNBOUND) {
    console.log(chalk.yellow(
      `  Warning: the committed binding in _bmad-output/project-layout.yaml is ` +
      `${binding.reason} and was NOT used:\n    ${binding.message}`
    ));
    return null;
  }

  // Fallback: check config.yaml for path fields
  const configPath = path.join(projectRoot, '_bmad', 'bmm', 'config.yaml');
  try {
    if (fs.existsSync(configPath)) {
      const content = fs.readFileSync(configPath, 'utf-8');
      const kbMatch = content.match(/^knowledgebase_path:\s*"?([^"\n]+)"?/m);
      const spMatch = content.match(/^sprint_management_path:\s*"?([^"\n]+)"?/m);

      const kbPath = kbMatch ? resolveStoredPath(kbMatch[1], projectRoot) : null;
      const spPath = spMatch ? resolveStoredPath(spMatch[1], projectRoot) : null;

      // Only return if at least one non-default path exists
      if ((kbPath && kbPath !== '.') || (spPath && spPath !== '.')) {
        return {
          knowledgebase: kbPath && kbPath !== '.'
            ? { mode: 'local', path: kbPath }
            : { mode: 'same', path: '.' },
          sprintManagement: spPath && spPath !== '.'
            ? { mode: 'local', path: spPath }
            : { mode: 'same', path: '.' },
          // No project-layout.yaml exists on this path, so there is no committed
          // three-record topology to report. Stated explicitly rather than left
          // absent — see the note on the ok branch above.
          topology: null,
        };
      }
    }
  } catch (e) {
    console.log(chalk.yellow(`  Warning: could not read config.yaml layout: ${e.message}`));
  }

  return null;
}

function ciCloneIfNeeded(destPath, gitUrl, clonedRepos) {
  // Deduplicate: same URL + path already cloned
  const key = `${gitUrl}::${destPath}`;
  if (clonedRepos.has(key)) return;

  if (fs.existsSync(destPath)) {
    if (fs.existsSync(path.join(destPath, '.git'))) {
      console.log(chalk.gray(`  Using existing clone at ${destPath}`));
      clonedRepos.set(key, true);
      return;
    }
    throw new Error(`Destination exists but is not a git repo — remove it or use a different path: ${destPath}`);
  }

  try {
    console.log(chalk.cyan(`  Cloning ${gitUrl} → ${destPath}`));
    execFileSync('git', ['clone', '--depth', '1', gitUrl, destPath], { stdio: 'pipe' });
    clonedRepos.set(key, true);
  } catch (e) {
    throw new Error(`Failed to clone ${gitUrl}: ${e.message}`);
  }
}

async function collectRepoLayout(flags, existingLayout = null) {
  // CI/CD mode: env vars > existing layout > defaults
  if (flags.yes) {
    const kbPath = process.env.MA_KNOWLEDGEBASE_PATH;
    const sprintPath = process.env.MA_SPRINT_PATH;
    const kbGitUrl = process.env.MA_KNOWLEDGEBASE_GIT_URL;
    const sprintGitUrl = process.env.MA_SPRINT_GIT_URL;

    // Validate: git URL requires corresponding path
    if (kbGitUrl && !kbPath) {
      throw new Error('MA_KNOWLEDGEBASE_GIT_URL requires MA_KNOWLEDGEBASE_PATH to be set (clone destination)');
    }
    if (sprintGitUrl && !sprintPath) {
      throw new Error('MA_SPRINT_GIT_URL requires MA_SPRINT_PATH to be set (clone destination)');
    }

    // Env vars take precedence
    if (kbPath || sprintPath || kbGitUrl || sprintGitUrl) {
      const result = { knowledgebase: null, sprintManagement: null };

      // Track cloned repos to avoid duplicate clones (AC #8)
      const clonedRepos = new Map();

      for (const [concern, envPath, envGitUrl] of [
        ['knowledgebase', kbPath, kbGitUrl],
        ['sprintManagement', sprintPath, sprintGitUrl],
      ]) {
        if (envGitUrl && envPath) {
          const resolvedPath = path.resolve(envPath);
          // Clone if needed (CI-mode: fail loudly, no fallback)
          ciCloneIfNeeded(resolvedPath, envGitUrl, clonedRepos);
          result[concern] = { mode: 'remote', path: resolvedPath, gitUrl: envGitUrl };
        } else if (envPath) {
          result[concern] = { mode: 'local', path: path.resolve(envPath) };
        } else {
          result[concern] = existingLayout ? existingLayout[concern] : { mode: 'same', path: '.' };
        }
      }

      return result;
    }
    // No env vars: preserve existing layout if available
    if (existingLayout) {
      return existingLayout;
    }
    // No env vars, no existing layout: default to single-repo
    return {
      knowledgebase: { mode: 'same', path: '.' },
      sprintManagement: { mode: 'same', path: '.' },
    };
  }

  const layout = { knowledgebase: null, sprintManagement: null };
  const labels = { knowledgebase: 'knowledgebase', sprintManagement: 'sprint management' };

  for (const concern of ['knowledgebase', 'sprintManagement']) {
    const existingMode = existingLayout && existingLayout[concern] ? existingLayout[concern].mode : null;
    // Derived from STORE_MODES / SPRINT_MODES via MODE_PROMPT_TITLES rather
    // than re-listing the members here — see the table's note.
    const modeChoices = modeChoicesFor(concern);
    // Pre-select existing mode if available
    const initialIndex = existingMode ? modeChoices.findIndex(c => c.value === existingMode) : 0;

    const { mode } = await prompts({
      type: 'select',
      name: 'mode',
      message: `Where is your ${labels[concern]} managed?`,
      choices: modeChoices,
      initial: initialIndex >= 0 ? initialIndex : 0
    });

    if (!mode) process.exit(0);

    if (mode === 'same') {
      layout[concern] = { mode: 'same', path: '.' };
    } else if (mode === 'local') {
      layout[concern] = await collectLocalPath(labels[concern]);
    } else if (mode === 'remote') {
      layout[concern] = await collectRemotePath(labels[concern]);
    } else if (mode === 'jira') {
      layout[concern] = await collectJiraConfig();
    }
  }

  // Check if both concerns point to same external path
  if (layout.knowledgebase.mode !== 'same' && layout.sprintManagement.mode !== 'same'
      && layout.knowledgebase.path === layout.sprintManagement.path) {
    console.log(chalk.cyan('  Both concerns point to same external repository'));
  }

  return layout;
}

// --- BMad module selection ---

/**
 * Resolve which BMAD modules to install for this run.
 *
 * Three branches:
 *   1. `--bmad-modules <csv>` → install exactly those (bmm force-prepended,
 *      unknowns rejected with a clear error)
 *   2. `--bmad-modules` bare  → multiselect prompt; bmm is required and
 *      pre-checked, others default-checked so a no-op confirmation matches
 *      the no-flag default
 *   3. (no flag)              → install every non-retired module from the
 *      cache manifest, no prompt — restores the originally-intended
 *      behavior that the hardcoded ['bmm'] literal had been suppressing
 *
 * `bmm` is force-included in every path because the BMad core agents
 * (analyst, PM, dev, architect, ...) live there and downstream skills
 * break without them. Retired modules (currently only `wds`) are filtered
 * out unconditionally.
 */
async function selectBmadModules({ bmadModulesFlag, bmadModulesPrompt, projectRoot } = {}) {
  const installable = bmad.getInstallableBmadModules().filter(m => !m.retired);
  const root = projectRoot || process.cwd();

  // Bug 27.13 — persist the resolved selection so a deselection sticks across
  // future installs/reconfigures that do not re-pass --bmad-modules.
  const persist = (modules) => {
    try {
      setBmadModules(root, modules);
    } catch (err) {
      console.warn(chalk.yellow(`  Warning: could not persist BMAD module selection: ${err.message}`));
    }
    return modules;
  };

  // Branch 1: explicit CSV — validate + use as-is.
  if (bmadModulesFlag) {
    const requested = bmadModulesFlag.split(',').map(s => s.trim()).filter(Boolean);
    try {
      return persist(bmad.resolveBmadModules({ requested, available: installable }));
    } catch (err) {
      console.error(chalk.red(`Error: ${err.message}`));
      process.exit(1);
    }
  }

  // Branch 2: bare --bmad-modules → multiselect prompt.
  if (bmadModulesPrompt) {
    const choices = installable.map(m => {
      const isCore = m.id === 'bmm';
      const requiredTag = isCore ? chalk.yellow(' (required)') : '';
      return {
        title: chalk.white(m.id) + requiredTag + chalk.gray(` — ${m.description}`),
        value: m.id,
        // Default-check everything so hitting Enter matches the no-flag
        // "install all" default. Users uncheck what they want to skip.
        selected: true,
      };
    });

    const { chosenModules } = await prompts({
      type: 'multiselect',
      name: 'chosenModules',
      message: 'Select BMAD-METHOD modules to install:',
      choices,
      instructions: chalk.gray('  Use space to toggle, enter to confirm. bmm is required and will be installed regardless.'),
      min: 1,
    });

    if (chosenModules === undefined) process.exit(0);

    // Belt-and-suspenders: force bmm back in if the user managed to uncheck
    // it despite the (required) tag.
    return persist(bmad.resolveBmadModules({ requested: chosenModules, available: installable }));
  }

  // Branch 3: no flag → use the persisted selection from a prior run if present
  // (bug 27.13 — a previous deselection must survive); otherwise fall back to
  // the original "install every available module" default. The persisted set is
  // intersected with the currently-installable set so a since-retired module
  // does not resurface, and bmm is force-included via resolveBmadModules.
  const persisted = getBmadModules(root);
  if (persisted && persisted.length > 0) {
    const availableIds = new Set(installable.map(m => m.id));
    const stillInstallable = persisted.filter(id => availableIds.has(id));
    try {
      return persist(bmad.resolveBmadModules({ requested: stillInstallable, available: installable }));
    } catch {
      // If the persisted set somehow fails validation, fall through to default.
    }
  }
  return persist(installable.map(m => m.id));
}

// --- Custom marketplace source (Story 30.6a) ---

/**
 * Story 30.6b AC 6 — single source of truth for whether the base BMAD
 * install/update step (Step 3.5) left a usable installation for the
 * custom-marketplace subset install (Step 3.5b) to layer `--custom-source`
 * onto. Pure function, exported for direct unit testing (no need to drive
 * the full wizard to exercise this policy):
 *
 *   - not attempted (user declined, or --yes short-circuited before any
 *     call): usable only if BMAD was ALREADY installed from a prior run —
 *     there is no `_bmad/` tree to layer onto for a declined FRESH install.
 *   - attempted: usable iff the install/update call itself reported success.
 *
 * @param {Object} ctx
 * @param {boolean} ctx.bmadInstalled - Was BMAD already installed before this step?
 * @param {boolean} ctx.attempted - Was `installBmad`/`updateBmad` actually invoked?
 * @param {boolean} [ctx.success] - That call's return value (ignored if `attempted` is false).
 * @returns {boolean}
 */
function resolveBaseBmadOk({ bmadInstalled, attempted, success }) {
  if (!attempted) return Boolean(bmadInstalled);
  return Boolean(success);
}

/**
 * FR239-FR241 — after BMAD module selection, offer to enumerate ONE custom
 * marketplace source and let the user pick which of its declared extensions
 * to install. This function does the Y/N prompt (or its `--bmad-custom-source`
 * non-interactive equivalent), the enumerate call, the NFR71 warning, and
 * ma-agents' OWN multiselect (FR240) — and stops there.
 *
 * Scope boundary (Story 30.6a vs 30.6b): this returns the user's selection —
 * `{ source, mode, selectedCodes, plugins, rootDir, sourceUrl }` (the last two
 * added by 30.6b — additive, existing 30.6a consumers only read the first
 * four fields) — for Story 30.6b to consume for prune-and-stage. NO pruning,
 * staging, or `bmad-method` invocation happens here or anywhere in this
 * function. Returns `null` when the feature is not engaged (no flag, and
 * either --yes with no flag, or the user answered "N") — this is the
 * byte-identical-to-baseline "off" path required by NFR70.
 *
 * @param {Object} ctx
 * @param {string} [ctx.bmadCustomSourceFlag] - `--bmad-custom-source <ref>` value
 * @param {boolean} [ctx.yesFlag] - non-interactive run
 * @returns {Promise<null|{ source: string, mode: 'discovery'|'direct'|'registry', selectedCodes: string[],
 *   plugins: Array<Object>, rootDir: string, sourceUrl: string|null }>}
 */
async function promptCustomMarketplace({ bmadCustomSourceFlag = '', yesFlag = false } = {}) {
  let source = bmadCustomSourceFlag;

  if (!source) {
    if (yesFlag) {
      // Non-interactive run with no flag — feature stays off (NFR70: a
      // no-source install is byte-identical to baseline). There is no
      // "bare = prompt" fallback for --yes, matching how other install-time
      // Y/N prompts behave under --yes.
      return null;
    }
    const { wantsCustomSource } = await prompts({
      type: 'confirm',
      name: 'wantsCustomSource',
      message: 'Install additional BMAD extensions from a custom source? (y/N)',
      initial: false,
    });
    if (!wantsCustomSource) return null;

    const { sourceInput } = await prompts({
      type: 'text',
      name: 'sourceInput',
      message: 'Custom marketplace source (local path or Git URL):',
    });
    if (!sourceInput || !sourceInput.trim()) {
      console.log(chalk.yellow('  No source entered — skipping custom marketplace source.'));
      return null;
    }
    source = sourceInput.trim();
  }

  let enumerated;
  diag('custom-source: enumerate begin', { source });
  try {
    enumerated = await enumerateCustomSource(source);
  } catch (err) {
    // Fail clean (spike §3 contract) — a short, human-readable message only.
    // Never print err.stack here: an unreachable/unauthorized custom source
    // must not dump a raw upstream stack, and must never touch the base
    // install (the rest of installWizard proceeds unaffected). The full cause
    // (and stack) goes to the LOG FILE only, for diagnosis.
    diagError('custom-source: enumerate failed', err);
    const message = err instanceof CustomMarketplaceError ? err.message : `Custom marketplace source error: ${err.message}`;
    console.log(chalk.red(`\n  ${message}`));
    console.log(chalk.gray('  Skipping custom marketplace source; the rest of the install is unaffected.'));
    return null;
  }

  const { plugins, mode, rootDir, sourceUrl } = enumerated;
  diag('custom-source: enumerated', {
    source, mode, rootDir, sourceUrl,
    pluginCount: (plugins || []).length,
    codes: (plugins || []).map((p) => p.code),
  });
  if (!plugins || plugins.length === 0) {
    console.log(chalk.yellow(`  Custom marketplace source "${source}" declared no plugins — nothing to select.`));
    return { source, mode, selectedCodes: [], plugins: [], rootDir, sourceUrl };
  }

  // NFR71 — shown before the user can select/install anything from the source.
  console.log(chalk.yellow(`\n  Warning: ${NFR71_WARNING}`));

  if (yesFlag) {
    // --yes + --bmad-custom-source: select every declared plugin, matching
    // the "select all" default used elsewhere in --yes mode (bmad modules,
    // skills). The user asked for this source explicitly via the flag.
    const selectedCodes = plugins.map((p) => p.code);
    console.log(chalk.cyan(`  Custom marketplace: selected all ${selectedCodes.length} extension(s) from "${source}".`));
    return { source, mode, selectedCodes, plugins, rootDir, sourceUrl };
  }

  // Registry mode (this story): show display_name + trust tier + category and
  // make the community/unverified trust tier explicit PER ENTRY (AC2, NFR71).
  // Registry entries are opt-in — nothing is pre-selected (AC1/AC2). Discovery/
  // direct keep their existing "all pre-selected" behavior unchanged (AC6).
  const isRegistry = mode === 'registry';
  const { chosenCodes } = await prompts({
    type: 'multiselect',
    name: 'chosenCodes',
    message: `Select extensions to install from "${source}":`,
    choices: plugins.map((p) => {
      if (isRegistry) {
        const label = registryTrustLabel(p);
        const certified = p.trustTier === 'bmad-certified';
        const head = chalk.white(p.displayName || p.name || p.code);
        const tier = (certified ? chalk.green : chalk.yellow)(`[${label}]`);
        const cat = p.category ? chalk.gray(` {${p.category}${p.subcategory ? `/${p.subcategory}` : ''}}`) : '';
        const desc = p.description ? chalk.gray(` — ${p.description}`) : '';
        return { title: `${head} ${tier}${cat}${desc}`, value: p.code, selected: false };
      }
      return {
        title: chalk.white(p.code) + chalk.gray(p.description ? ` — ${p.description}` : ''),
        value: p.code,
        selected: true,
      };
    }),
    instructions: chalk.gray('  Use space to toggle, enter to confirm.'),
  });

  if (chosenCodes === undefined) {
    console.log(chalk.gray('  Custom marketplace selection cancelled.'));
    return null;
  }

  return { source, mode, selectedCodes: chosenCodes, plugins, rootDir, sourceUrl };
}

/**
 * Story 30.7 (FR242) — on `update`, re-enumerate a PERSISTED custom
 * marketplace source instead of asking the plain Y/N prompt again, and
 * reconcile the fresh plugin list against the persisted `selectedCodes`.
 * Newly-appeared plugins are reported ONLY — never added to the returned
 * selection. A code that is no longer declared is dropped and reported.
 *
 * Fail-loud contract: if the persisted source cannot be re-enumerated
 * (unreachable, removed, drifted adapter surface), this prints a clear,
 * visible error and returns `null` WITHOUT writing anything to
 * `.ma-agents.json` — the persisted selection is left exactly as it was so a
 * later successful `update` picks up where the user left off. This function
 * never calls `setCustomMarketplaceSelection` itself; persistence only ever
 * happens after a REAL install, in `lib/bmad.js#installCustomMarketplaceSubset`.
 *
 * @param {Object} ctx
 * @param {string} ctx.projectRoot
 * @returns {Promise<undefined|null|{ source: string, mode: 'discovery'|'direct'|'registry',
 *   selectedCodes: string[], plugins: Array<Object>, rootDir: string, sourceUrl: string|null }>}
 *   `undefined` — nothing persisted; caller should fall back to `promptCustomMarketplace()`.
 *   `null` — persisted source exists but could not be re-enumerated (fail-loud; skip this run).
 *   selection object — reconciled; `selectedCodes` is the persisted set minus any `removed`.
 */
async function reconcileCustomMarketplaceOnUpdate({ projectRoot }) {
  const persisted = getCustomMarketplaceSelection(projectRoot);
  diag('custom-source: reconcile on update', persisted
    ? { source: persisted.source, mode: persisted.mode, selectedCodes: persisted.selectedCodes }
    : { persisted: false });
  if (!persisted) return undefined;

  let enumerated;
  try {
    enumerated = await enumerateCustomSource(persisted.source);
  } catch (err) {
    diagError('custom-source: reconcile re-enumerate failed', err);
    const message = err instanceof CustomMarketplaceError ? err.message : `Custom marketplace source error: ${err.message}`;
    console.log(chalk.red(`\n  Custom marketplace update FAILED: ${message}`));
    console.log(
      chalk.red(
        `  The persisted selection (${persisted.selectedCodes.join(', ') || '(none)'}) from ` +
        `"${persisted.source}" is UNCHANGED — it will be retried on the next update.`
      )
    );
    return null;
  }

  const { plugins, mode, rootDir, sourceUrl } = enumerated;
  const { added, removed, stillPresent } = reconcileCustomMarketplaceSelection({
    persistedSelectedCodes: persisted.selectedCodes,
    enumeratedPlugins: plugins,
  });

  console.log(chalk.cyan(`\n  Custom marketplace source "${persisted.source}" re-enumerated:`));
  if (persisted.sha) {
    // The persisted SHA is the last-installed commit, INFORMATIONAL only.
    // Updates deliberately float to remote HEAD (FR242/NFR72) to surface
    // newly-published extensions — we report the last-installed SHA rather
    // than pin to it, so the float-to-HEAD behavior is explicit, not silent.
    console.log(chalk.gray(`    (last installed at ${persisted.sha.slice(0, 12)}; update re-enumerates at the source's current HEAD, not this pin)`));
  }
  if (added.length > 0) {
    console.log(chalk.gray(`    + newly available (not auto-installed; re-run the custom-source flow to add): ${added.join(', ')}`));
  }
  if (removed.length > 0) {
    console.log(chalk.yellow(`    - no longer available (dropped from the installed selection): ${removed.join(', ')}`));
  }
  if (added.length === 0 && removed.length === 0) {
    console.log(chalk.gray('    No changes vs. the persisted selection.'));
  }

  if (stillPresent.length === 0) {
    console.log(chalk.yellow('  None of the previously-selected extensions are declared by this source anymore — nothing to reinstall from it.'));
  }

  return { source: persisted.source, mode, selectedCodes: stillPresent, plugins, rootDir, sourceUrl };
}

// --- Install wizard ---

async function installWizard(preselectedSkill, preselectedAgents, customPath, forceFlag, yesFlag = false, cliScope, bmadModulesFlag = '', bmadModulesPrompt = false, bmadCustomSourceFlag = '') {
  const skills = listSkills();
  const agents = listAgents();

  let selectedSkillIds = preselectedSkill ? [preselectedSkill] : [];
  let selectedAgentIds = preselectedAgents || [];
  let installScope = cliScope || 'project';
  let installPath = customPath || '';

  const existingStatus = getStatus([], '', 'project');
  let isUpdate = false;

  // Step 0: Check for existing installation ONLY in interactive mode (no preselected skill)
  if (!preselectedSkill && !customPath && existingStatus.length > 0) {
    if (yesFlag) {
      // Default: clean reinstall (avoids isUpdate path which re-triggers skill selection prompts)
      for (const entry of existingStatus) {
        for (const skillId of Object.keys(entry.skills)) {
          await uninstallSkill(skillId, [entry.agent.id], '', 'project');
        }
      }
      console.log(chalk.gray(' Clean slate prepared.'));
    } else {
      console.log(chalk.cyan('\n Existing installation detected in project.'));

      const { action } = await prompts({
        type: 'select',
        name: 'action',
        message: 'What would you like to do?',
        choices: [
          { title: 'Update (add/remove skills)', value: 'update' },
          { title: 'Clean reinstall (remove all first)', value: 'reinstall' },
          { title: 'Uninstall all skills', value: 'uninstall' },
          { title: 'Cancel', value: 'cancel' }
        ]
      });

      if (!action || action === 'cancel') process.exit(0);

      if (action === 'uninstall') {
        const { confirmed } = await prompts({
          type: 'confirm',
          name: 'confirmed',
          message: 'This will remove all ma-agents skills from this project. Are you sure?',
          initial: false
        });
        if (!confirmed) process.exit(0);

        for (const entry of existingStatus) {
          for (const skillId of Object.keys(entry.skills)) {
            await uninstallSkill(skillId, [entry.agent.id], '', 'project');
          }
        }
        console.log(chalk.bold.green('\n All skills successfully removed!\n'));
        return;
      }

      if (action === 'reinstall') {
        for (const entry of existingStatus) {
          for (const skillId of Object.keys(entry.skills)) {
            await uninstallSkill(skillId, [entry.agent.id], '', 'project');
          }
        }
        console.log(chalk.gray(' Clean slate prepared.'));
      }

      if (action === 'update') {
        isUpdate = true;
        // Pre-populate selections from existing status
        const existingSkillIds = new Set();
        const existingAgentIds = new Set();
        existingStatus.forEach(entry => {
          existingAgentIds.add(entry.agent.id);
          Object.keys(entry.skills).forEach(id => existingSkillIds.add(id));
        });
        selectedSkillIds = Array.from(existingSkillIds);
        selectedAgentIds = Array.from(existingAgentIds);
      }
    }
  }

  // Step 1: Select skills
  if (yesFlag || selectedSkillIds.length === 0 || isUpdate) {
    if (yesFlag) {
      selectedSkillIds = skills.map(s => s.id);
    } else {
      const { selectionType } = await prompts({
        type: 'select',
        name: 'selectionType',
        message: 'Would you like to install all available skills or choose specific ones?',
        choices: [
          { title: 'Install all available skills', value: 'all' },
          { title: 'Choose which skills to install', value: 'custom' }
        ]
      });

      if (!selectionType) process.exit(0);

      if (selectionType === 'all') {
        selectedSkillIds = skills.map(s => s.id);
      } else {
        const { skills: chosen } = await prompts({
          type: 'multiselect',
          name: 'skills',
          message: 'Select the skills you want to have installed:',
          choices: skills.map(s => ({
            title: chalk.white(s.name) + chalk.gray(` v${s.version} - ${s.description}`),
            value: s.id,
            selected: selectedSkillIds.includes(s.id)
          })),
          instructions: chalk.gray('  Use space to select, enter to confirm'),
          min: 1
        });

        if (!chosen) process.exit(0);
        selectedSkillIds = chosen;
      }
    }
  }

  // Step 2: Select agents
  if (yesFlag || selectedAgentIds.length === 0 || isUpdate) {
    const ideAgents = agents.filter(a => a.category !== 'bmad');
    const bmadAgents = agents.filter(a => a.category === 'bmad');

    if (yesFlag) {
      // Bug B1 fix: when --agent flag is present (preselectedAgents already
      // populated selectedAgentIds), do NOT overwrite with all agents.
      // Only fall back to all agents when no agent was pre-selected.
      if (selectedAgentIds.length === 0) {
        selectedAgentIds = [...ideAgents.map(a => a.id), ...bmadAgents.map(a => a.id)];
      }
      if (selectedAgentIds.length === 0) {
        console.error(chalk.red('Error: No agents detected'));
        console.error(chalk.gray('  Hint: Ensure at least one supported IDE is present'));
        process.exit(1);
      }
    } else {
      // 2.1 Coding Assistants
      const { ideChosen } = await prompts({
        type: 'multiselect',
        name: 'ideChosen',
        message: 'Select AI Coding Assistants:',
        choices: ideAgents.map(a => ({
          title: chalk.white(a.name) + chalk.gray(` v${a.version} - ${a.description}`),
          value: a.id,
          selected: selectedAgentIds.includes(a.id)
        })),
        instructions: chalk.gray('  Use space to select, enter to confirm'),
      });

      if (ideChosen === undefined) process.exit(0);

      // 2.2 BMAD Method Agents
      const { bmadChosen } = await prompts({
        type: 'multiselect',
        name: 'bmadChosen',
        message: 'Select BMAD Method Agents:',
        choices: bmadAgents.map(a => ({
          title: chalk.white(a.name) + chalk.gray(` v${a.version} - ${a.description}`),
          value: a.id,
          selected: selectedAgentIds.includes(a.id)
        })),
        instructions: chalk.gray('  Use space to select, enter to confirm'),
      });

      if (bmadChosen === undefined) process.exit(0);

      selectedAgentIds = [...ideChosen, ...bmadChosen];

      if (selectedAgentIds.length === 0) {
        console.log(chalk.yellow('No agents selected. Please select at least one agent to install skills.'));
        process.exit(1);
      }
    }
  }

  // Step 2.4: Profile resolution (Story 21.1, ACs #7–#9)
  // Must run AFTER agent selection and BEFORE repo layout, so downstream stories
  // can gate layout-related guidance on profile. setProfile() is called BEFORE
  // any agent install runs — guaranteeing persistence even if a later step fails.
  // Profile lives at the project root (cwd), NOT the custom skills-install path.
  const projectRootForProfile = process.cwd();
  const persistedProfile = getProfile(projectRootForProfile);
  let resolvedProfile = resolveProfile({
    persisted: persistedProfile,
    yesMode: yesFlag
  });
  let profileSource;
  if (persistedProfile) profileSource = '.ma-agents.json';
  else if (resolvedProfile === 'standard' && yesFlag) profileSource = '--yes default';

  if (resolvedProfile === null) {
    const { chosenProfile } = await prompts({
      type: 'select',
      name: 'chosenProfile',
      message: 'Is this an on-prem / air-gapped install using a local LLM (e.g. Nemotron)?',
      choices: [
        { title: 'Yes — apply local-LLM guardrails (recommended for non-Claude models)', value: 'on-prem' },
        { title: 'No  — standard install (Claude on web, Anthropic API, etc.)', value: 'standard' }
      ],
      initial: 1
    });
    if (!chosenProfile) process.exit(0);
    resolvedProfile = chosenProfile;
    profileSource = 'interactive prompt';
  }

  console.log(chalk.cyan(`Using profile: ${resolvedProfile} (from ${profileSource})`));

  // Persist BEFORE any agent install step (AC #9). setProfile bootstraps the
  // manifest via ensureManifest when absent.
  setProfile(projectRootForProfile, resolvedProfile);

  // Step 2.5: Repository layout — read the committed binding UNCONDITIONALLY.
  //
  // B-1. This was `isUpdate ? readExistingLayout() : null`. `isUpdate` is true
  // ONLY for the interactive "Update (add/remove skills)" menu choice — it is
  // false for EVERY `--yes` run and false on a fresh clone. So on the two paths
  // that matter most (CI and a colleague cloning a bound repo) `existingLayout`
  // was `null`, collectRepoLayout fell through to its bare single-repo default
  // `{knowledgebase:{same,.}, sprintManagement:{same,.}}`, and that default
  // reached writeProjectLayoutYaml INDISTINGUISHABLE FROM A REAL ANSWER. Result:
  // `ma-agents install --yes` over a committed Confluence binding silently
  // replaced the software requirements store with `file-system / same / "."` —
  // space key and root page gone — and over a NON-divergent Confluence pair it
  // destroyed both stores without printing a single word about it. A default
  // that degrades to permissive instead of failing loud; the same shape this
  // epic has now produced five times.
  //
  // Reading unconditionally is the whole fix, because everything downstream is
  // already built for it: collectRepoLayout with a non-null existingLayout and
  // no env vars returns it VERBATIM (see the `if (existingLayout) return
  // existingLayout;` branch), and writeProjectLayoutYaml's preservation step
  // then carries every record the caller did not supply. It also makes the
  // install path agree with `handleConfigLayout`, which has always read
  // unconditionally.
  //
  // Restricting preservation to `confluence`-backed stores was considered and
  // REJECTED: two `file-system` stores in different locations is FR258's normal
  // case, so a Confluence-only rule would still collapse `system: local /a` +
  // `software: local /b` on every `install --yes`.
  //
  // Consequence deliberately accepted: on a project with a legacy
  // `knowledgebase_path` in `_bmad/bmm/config.yaml` but NO
  // `_bmad-output/project-layout.yaml`, readExistingLayout's FR265 config.yaml
  // fallback is now reachable from `install` (it previously was not). A `--yes`
  // reinstall there used to reset the layout to `same/.`; it now keeps the path
  // config.yaml already records. That is the DEFECT `test/config-lost-on-
  // update.test.js` exists to prevent — none of its 13 tests pins the reset as
  // desired — and it satisfies NFR82 because the resolved artifact paths are the
  // ones config.yaml already resolves to.
  const existingLayout = readExistingLayout();
  const repoLayout = await collectRepoLayout({ yes: yesFlag }, existingLayout);

  // Step 3: Scope (Skip if update, yesFlag, CLI --global flag, or path already set)
  if (!isUpdate && !installPath && !yesFlag && !cliScope) {
    const { pathChoice } = await prompts({
      type: 'select',
      name: 'pathChoice',
      message: 'Installation scope:',
      choices: [
        { title: 'Project level (current directory)', value: 'project' },
        { title: 'Global (user-level settings)', value: 'global' },
        { title: 'Custom path...', value: 'custom' }
      ]
    });

    if (pathChoice === 'global') {
      installScope = 'global';
    } else if (pathChoice === 'custom') {
      const { customDir } = await prompts({
        type: 'text',
        name: 'customDir',
        message: 'Enter installation directory:',
        initial: './skills'
      });
      installPath = customDir || '';
    }
  }

  // Step 3.4: Filter out BMAD agents for global scope (they require project-level install)
  if (installScope === 'global') {
    const bmadAgentIds = selectedAgentIds.filter(id => {
      const agent = agents.find(a => a.id === id);
      return agent && agent.category === 'bmad';
    });
    if (bmadAgentIds.length > 0) {
      console.log(chalk.yellow(`\n  Warning: BMAD agents require project-level installation and will be skipped for global scope:`));
      console.log(chalk.yellow(`    ${bmadAgentIds.join(', ')}`));
      console.log(chalk.gray(`  Run again without --global to install BMAD agents into the current project.`));
      selectedAgentIds = selectedAgentIds.filter(id => !bmadAgentIds.includes(id));
    }
  }

  // Step 3.5: BMAD-METHOD Integration
  if (installScope === 'project') {
    const bmadToolsFilter = agents.filter(a => a.category === 'ide').map(a => a.id);

    if (yesFlag) {
      // Warn about IDE agents not supported for BMAD customizations
      const ideAgentIds = agents.filter(a => a.category !== 'bmad').map(a => a.id);
      const unsupported = selectedAgentIds.filter(id => ideAgentIds.includes(id) && !bmadToolsFilter.includes(id));
      unsupported.forEach(id => {
        console.log(chalk.yellow(`  Warning: Agent '${id}' is not supported for BMAD customizations`));
      });
    }

    const bmadInstalled = bmad.isBmadInstalled();
    const bmadTools = selectedAgentIds.filter(id => bmadToolsFilter.includes(id)).map(id => getBmadPlatformCode(id));
    // Story 22.6 — ma-agents customizations are now packaged as a BMAD plugin
    // and installed by bmad-method itself via --custom-source. The separate
    // `applyCustomizations()` call has been removed; installBmad()/updateBmad()
    // stage the plugin and invoke the installer in one pass.
    // v6.6.0: --tools none is rejected for fresh installs; skip BMAD entirely when no IDE tools selected.
    if (bmadTools.length > 0) {
      // Resolve module set once per BMAD invocation. Default is "install
      // every non-retired module"; users opt into a specific subset with
      // --bmad-modules <csv> or open a multiselect prompt with --bmad-modules
      // (bare).
      const bmadModules = await selectBmadModules({
        bmadModulesFlag,
        bmadModulesPrompt,
        projectRoot: process.cwd(),
      });

      // Story 30.6b AC 6 — tracks whether the base BMAD install/update step
      // left a usable installation for the custom-marketplace subset install
      // (Step 3.5b) to layer onto. See resolveBaseBmadOk() for the policy.
      let baseBmadOk = resolveBaseBmadOk({ bmadInstalled, attempted: false });

      if (!bmadInstalled) {
        if (yesFlag) {
          console.log(chalk.cyan(`\n Installing BMAD-METHOD (modules: ${bmadModules.join(', ')})...`));
          const success = await bmad.installBmad(bmadModules, bmadTools);
          baseBmadOk = resolveBaseBmadOk({ bmadInstalled, attempted: true, success });
          if (success) {
            console.log(chalk.green(' BMAD-METHOD installed successfully!'));
          }
        } else {
          const { installBmad } = await prompts({
            type: 'confirm',
            name: 'installBmad',
            message: 'BMAD-METHOD not detected. Would you like to install it?',
            initial: true
          });

          if (installBmad) {
            console.log(chalk.cyan(`\n Installing BMAD-METHOD (modules: ${bmadModules.join(', ')})...`));
            const success = await bmad.installBmad(bmadModules, bmadTools);
            baseBmadOk = resolveBaseBmadOk({ bmadInstalled, attempted: true, success });
            if (success) {
              console.log(chalk.green(' BMAD-METHOD installed successfully!'));
            }
          } else {
            baseBmadOk = resolveBaseBmadOk({ bmadInstalled, attempted: false });
          }
        }
      } else {
        if (yesFlag) {
          console.log(chalk.cyan(`\n Updating BMAD-METHOD (modules: ${bmadModules.join(', ')})...`));
          const success = await bmad.updateBmad(bmadModules, bmadTools);
          baseBmadOk = resolveBaseBmadOk({ bmadInstalled, attempted: true, success });
          if (success) {
            console.log(chalk.green(' BMAD-METHOD updated successfully!'));
          }
        } else {
          const { updateBmad } = await prompts({
            type: 'confirm',
            name: 'updateBmad',
            message: 'BMAD-METHOD installation detected. Would you like to update it?',
            initial: true
          });

          if (updateBmad) {
            console.log(chalk.cyan(`\n Updating BMAD-METHOD (modules: ${bmadModules.join(', ')})...`));
            const success = await bmad.updateBmad(bmadModules, bmadTools);
            baseBmadOk = resolveBaseBmadOk({ bmadInstalled, attempted: true, success });
            if (success) {
              console.log(chalk.green(' BMAD-METHOD updated successfully!'));
            }
          }
          // else: update declined, but BMAD was already installed from a
          // prior run — resolveBaseBmadOk({attempted:false}) is `bmadInstalled`,
          // i.e. still true (there IS a usable base).
        }
      }

      // Step 3.5b: Custom marketplace source (Story 30.6a enumerate + wizard;
      // Story 30.6b prune + stage + install-the-subset; Story 30.7 persist +
      // re-enumerate/reconcile on update, FR240/FR242).
      let customMarketplaceSelection = null;
      // Story 30.7 — on a BMAD-METHOD *update* (i.e. `bmadInstalled` was
      // already true before this run, so bmad.updateBmad() ran above — this
      // is the FR242 "on update" case, and is DELIBERATELY independent of
      // `isUpdate`, which only tracks ma-agents' own "Update (add/remove
      // skills)" wizard choice and stays false under `--yes` reruns) with NO
      // explicit `--bmad-custom-source` override, prefer re-enumerating a
      // PERSISTED source over asking the plain Y/N prompt again. An explicit
      // flag always wins (fresh engagement via the normal prompt path below).
      // `undefined` means nothing was persisted — fall through unchanged.
      let usedPersistedReconcile = false;
      if (bmadInstalled && !bmadCustomSourceFlag) {
        const reconciled = await reconcileCustomMarketplaceOnUpdate({ projectRoot: process.cwd() });
        if (reconciled !== undefined) {
          usedPersistedReconcile = true;
          customMarketplaceSelection = reconciled; // null (fail-loud skip) or a reconciled selection
        }
      }
      if (!usedPersistedReconcile) {
        try {
          customMarketplaceSelection = await promptCustomMarketplace({ bmadCustomSourceFlag, yesFlag });
        } catch (err) {
          console.log(chalk.yellow(`\n  Custom marketplace source skipped: ${err.message}`));
        }
      }
      if (customMarketplaceSelection && customMarketplaceSelection.selectedCodes.length > 0) {
        diag('custom-source: install begin', {
          mode: customMarketplaceSelection.mode,
          source: customMarketplaceSelection.source,
          selectedCodes: customMarketplaceSelection.selectedCodes,
          baseBmadOk,
        });
        if (!baseBmadOk) {
          // AC 6 (30.6b) — never layer --custom-source onto a project with no
          // (or a broken) base BMAD install. The rest of the install is
          // otherwise unaffected.
          console.log(
            chalk.yellow(
              '\n  Skipping custom marketplace install — the base BMAD install/update did not ' +
              'complete successfully, so there is no BMAD installation to add it to.'
            )
          );
        } else {
          try {
            const success = await bmad.installCustomMarketplaceSubset({
              projectRoot: process.cwd(),
              modules: bmadModules,
              tools: bmadTools,
              selection: customMarketplaceSelection,
            });
            diag('custom-source: install result', { success: !!success });
            if (success) {
              console.log(chalk.green('  Custom marketplace subset installed successfully!'));
            }
          } catch (err) {
            // User sees the one-liner; the full cause/stack (which entry, the
            // git/resolve error, the FR238 zero-module detail) goes to the log.
            diagError('custom-source: install failed', err);
            console.log(chalk.red(`\n  Custom marketplace install failed: ${err.message}`));
          }
        }
      }
    }
  }

  // Step 3.6: Write repo layout config (after BMAD install creates config.yaml)
  if (installScope === 'project') {
    writeRepoLayoutConfig(repoLayout);
    // R-4: Step 3.6 runs AFTER the BMAD install has completed. An uncaught throw
    // from here reaches main().catch, which prints the raw Error (stack trace,
    // exit 1) on a substantially-finished install - the exact failure mode the
    // directory/write guards inside writeProjectLayoutYaml exist to prevent.
    // Legal-but-unusual path characters no longer throw at all now that they are
    // escaped rather than rejected; this catches what remains (the closed backend
    // enum, the confluence identity guard) and degrades to the same
    // warn-and-leave-UNBOUND outcome.
    try {
      writeProjectLayoutYaml(repoLayout);
    } catch (e) {
      console.log(chalk.yellow(
        `  Warning: could not write _bmad-output/project-layout.yaml: ${e.message}\n` +
        `  The project is left UNBOUND - re-run the installer once this is corrected\n` +
        `  (a future \`ma-agents bind\` will do this without a full re-install).`
      ));
    }
  }

  // Step 4: Confirm
  console.log('');
  console.log(chalk.bold('  Summary:'));
  console.log(chalk.cyan('  Skills:  ') + selectedSkillIds.join(', '));
  console.log(chalk.cyan('  Agents:  ') + selectedAgentIds.join(', '));
  console.log(chalk.cyan('  Path:    ') + (installPath || (installScope === 'global' ? 'global (user-level)' : 'project (current directory)')));
  console.log('');

  if (!yesFlag) {
    const { confirmed } = await prompts({
      type: 'confirm',
      name: 'confirmed',
      message: isUpdate ? 'Apply changes?' : 'Proceed with installation?',
      initial: true
    });

    if (!confirmed) {
      console.log(chalk.yellow('Operation cancelled.'));
      process.exit(0);
    }
  }

  // Step 5: Execution
  if (isUpdate) {
    // Build a map: skillId -> set of agent IDs that originally had it installed
    const originalAgentsBySkill = new Map();
    const originalAllAgentIds = new Set();
    existingStatus.forEach(entry => {
      originalAllAgentIds.add(entry.agent.id);
      Object.keys(entry.skills).forEach(skillId => {
        if (!originalAgentsBySkill.has(skillId)) {
          originalAgentsBySkill.set(skillId, new Set());
        }
        originalAgentsBySkill.get(skillId).add(entry.agent.id);
      });
    });

    const finalSkills = new Set(selectedSkillIds);

    // Skills to fully remove (deselected from skill list)
    const toRemove = [...originalAgentsBySkill.keys()].filter(id => !finalSkills.has(id));

    if (toRemove.length > 0) {
      console.log(chalk.gray(`\n  Cleaning up ${toRemove.length} removed skills...`));
      for (const skillId of toRemove) {
        // Use the ORIGINAL agent IDs, not the new selection
        const originalAgents = [...originalAgentsBySkill.get(skillId)];
        await uninstallSkill(skillId, originalAgents, installPath, 'project');
      }
    }

    // Also handle agents that were deselected: uninstall their skills
    const deselectedAgents = [...originalAllAgentIds].filter(id => !selectedAgentIds.includes(id));

    if (deselectedAgents.length > 0) {
      console.log(chalk.gray(`\n  Removing skills from ${deselectedAgents.length} deselected agents...`));
      for (const [skillId, agentSet] of originalAgentsBySkill) {
        const agentsToRemoveFrom = deselectedAgents.filter(id => agentSet.has(id));
        if (agentsToRemoveFrom.length > 0) {
          await uninstallSkill(skillId, agentsToRemoveFrom, installPath, 'project');
        }
      }
    }
  }

  // Story 22.3 — Legacy skill retirement migration (AC 7).
  // Sweep every agent install path and remove any of the four retired skill IDs
  // (bmad-init, bmad-agent-qa, bmad-agent-sm, bmad-agent-quick-flow-solo-dev)
  // from the manifest and the installed skill directories. Idempotent — safe
  // to run on fresh installs where nothing is retired.
  try {
    await migrateRetiredSkills({ scope: installScope, customPath: installPath });
  } catch (err) {
    console.log(chalk.yellow(`\n Retired-skill migration skipped: ${err.message}`));
  }

  // Story 30.4 (FR245/FR246) — idempotent one-time Demerzel deprecation
  // notice. No-op after the first time it has ever printed for this project.
  try {
    showDemerzelDeprecationNoticeOnce(process.cwd());
  } catch (err) {
    console.log(chalk.yellow(`\n Deprecation notice skipped: ${err.message}`));
  }

  // Install requested skills
  const batchState = {};
  if (yesFlag) {
    batchState.globalAction = 'update';
  }

  // Cleaner update/reinstall UX — when re-running against a project that already
  // has some of the selected skills installed, offer a SINGLE batch decision up
  // front instead of prompting once per skill. Setting batchState.globalAction
  // here makes installSkill() apply it to every skill without prompting (the
  // same mechanism --yes uses). Skipped in --yes mode (already resolved above)
  // and on a fresh install (nothing already present). Picking 'per-skill' leaves
  // globalAction unset, preserving the existing per-skill prompts (which now
  // include "…all remaining" shortcuts as a fallback).
  if (!yesFlag && !batchState.globalAction) {
    const alreadyInstalled = new Set();
    for (const entry of existingStatus) {
      for (const id of Object.keys(entry.skills)) alreadyInstalled.add(id);
    }
    const overlapCount = selectedSkillIds.filter(id => alreadyInstalled.has(id)).length;
    if (overlapCount > 0) {
      const { batchChoice } = await prompts({
        type: 'select',
        name: 'batchChoice',
        message: `${overlapCount} of the selected skills are already installed. What would you like to do with all of them?`,
        choices: [
          { title: 'Update all (refresh to packaged version)', value: 'update' },
          { title: 'Clean reinstall all (remove + install)', value: 'reinstall' },
          { title: 'Skip all (keep current)', value: 'skip' },
          { title: 'Decide per-skill', value: 'per-skill' }
        ],
        initial: 0
      });
      // Escape / Ctrl+C → undefined → fall through to per-skill (safe default).
      if (batchChoice && batchChoice !== 'per-skill') {
        batchState.globalAction = batchChoice;
      }
    }
  }

  for (const skillId of selectedSkillIds) {
    try {
      await installSkill(skillId, selectedAgentIds, installPath, installScope, { force: !!forceFlag, yes: yesFlag, batchState });
    } catch (error) {
      console.error(chalk.red(`\n Failed to install ${skillId}:`), error.message);
    }
  }

  // Bug 27.16 — if BMAD populated the shared `.agents/skills` dir but no
  // .agents-targeting agent (copilot/kilocode/roo-code) was selected, the
  // standalone catalog + MANIFEST.yaml were never written there. Backfill them
  // so the dir is never BMAD-only without the MANIFEST.yaml the instruction
  // block points agents at. No-op when an .agents agent was selected or no
  // shared dir exists.
  if (installScope === 'project') {
    try {
      await reconcileAgentsSharedSkills(process.cwd(), selectedAgentIds, installScope);
    } catch (err) {
      console.log(chalk.yellow(` .agents/skills reconciliation skipped: ${err.message}`));
    }
  }

  // Step 6: Update project-context.md with repo layout section (after skills installed project-context.md)
  if (installScope === 'project') {
    const outputPath = path.join(process.cwd(), '_bmad-output', 'project-context.md');
    try {
      if (fs.existsSync(outputPath)) {
        const updated = await updateProjectContextRepoLayout(outputPath, repoLayout);
        if (updated) {
          console.log(chalk.green(' project-context.md repo layout section updated'));
        }
      }
    } catch (err) {
      console.log(chalk.yellow(` project-context repo layout update skipped: ${err.message}`));
    }
  }

  console.log(chalk.bold.green('\n Done!\n'));
}

// --- Command handlers ---

async function handleInstall(args) {
  const { globalFlag, forceFlag, yesFlag, agentFlag, customPath, bmadModulesFlag, bmadModulesPrompt, bmadCustomSourceFlag, scope, positional } = parseFlags(args);

  // Task 3.2: Validate agentFlag against known agents
  if (agentFlag) {
    const knownAgents = listAgents();
    const isKnown = knownAgents.some(a => a.id === agentFlag);
    if (!isKnown) {
      console.error(chalk.red(`Error: Unknown agent '${agentFlag}'`));
      console.error(chalk.gray('  Hint: Run "list" to see available agents'));
      process.exit(1);
    }
  }

  const skillId = positional[0];
  const agentIds = positional.slice(1);
  const preselectedAgents = agentFlag ? [agentFlag] : null;

  // No skill → launch wizard (Task 3.3, 3.4)
  if (!skillId) {
    await installWizard(null, preselectedAgents, customPath, forceFlag, yesFlag, scope, bmadModulesFlag, bmadModulesPrompt, bmadCustomSourceFlag);
    return;
  }

  // Skill but no agents (and no agentFlag) → wizard with skill preselected
  if (!agentFlag && agentIds.length === 0) {
    await installWizard(skillId, null, customPath, forceFlag, yesFlag, scope, bmadModulesFlag, bmadModulesPrompt, bmadCustomSourceFlag);
    return;
  }

  // Direct install path — Story 21.1 AC #9, #11: resolve + persist profile BEFORE install.
  // Profile lives at the project root (cwd), not the custom skills-install path.
  // When stdin is not a TTY and nothing is resolvable, default to 'standard' (same
  // behavior as --yes) rather than aborting — keeps CI/CD direct installs working.
  const projectRootForProfile = process.cwd();
  const persistedProfile = getProfile(projectRootForProfile);
  let resolvedProfile = resolveProfile({
    persisted: persistedProfile,
    yesMode: yesFlag
  });
  let profileSource;
  if (persistedProfile) profileSource = '.ma-agents.json';
  else if (resolvedProfile === 'standard' && yesFlag) profileSource = '--yes default';

  if (resolvedProfile === null) {
    if (!process.stdin.isTTY) {
      // Non-interactive fallback: default to 'standard' and persist (mirrors --yes).
      resolvedProfile = 'standard';
      profileSource = '--yes default';
    } else {
      const { chosenProfile } = await prompts({
        type: 'select',
        name: 'chosenProfile',
        message: 'Is this an on-prem / air-gapped install using a local LLM (e.g. Nemotron)?',
        choices: [
          { title: 'Yes — apply local-LLM guardrails (recommended for non-Claude models)', value: 'on-prem' },
          { title: 'No  — standard install (Claude on web, Anthropic API, etc.)', value: 'standard' }
        ],
        initial: 1
      });
      if (!chosenProfile) process.exit(0);
      resolvedProfile = chosenProfile;
      profileSource = 'interactive prompt';
    }
  }

  console.log(chalk.cyan(`Using profile: ${resolvedProfile} (from ${profileSource})`));
  setProfile(projectRootForProfile, resolvedProfile);

  // Full args → direct install (Task 3.5)
  const targetAgents = agentFlag ? [agentFlag] : agentIds;

  // Story 22.3 (AC 7) — sweep retired legacy skills before installing.
  // When a customPath is given we narrow the sweep to that single path;
  // otherwise migrateRetiredSkills sweeps every registered agent under the
  // current scope (the retirement is agent-agnostic, so broader sweep is
  // the intended behavior even when --agent restricts the install to one).
  try {
    await migrateRetiredSkills({ scope, customPath: customPath || '' });
  } catch (err) {
    console.log(chalk.yellow(`\n Retired-skill migration skipped: ${err.message}`));
  }

  // Story 30.4 (FR245/FR246) — idempotent one-time Demerzel deprecation
  // notice. No-op after the first time it has ever printed for this project.
  try {
    showDemerzelDeprecationNoticeOnce(process.cwd());
  } catch (err) {
    console.log(chalk.yellow(`\n Deprecation notice skipped: ${err.message}`));
  }

  try {
    await installSkill(skillId, targetAgents, customPath, scope, { force: forceFlag, yes: yesFlag });
    console.log(chalk.bold.green('\n Installation complete!\n'));
  } catch (error) {
    console.error(chalk.red('\n Installation failed:'), error.message);
    process.exit(1);
  }
}

async function handleUninstall(args) {
  // Story 21.11 — if --profile-artifacts flag is present, route to uninstallProfileArtifacts.
  // --yes IS supported for profile-artifact uninstall (CI decommissioning use-case).
  // This is an intentional asymmetry vs. `reconfigure` which REJECTS --yes.
  if (args.includes('--profile-artifacts')) {
    const yesFlag = args.includes('--yes');
    try {
      await uninstallProfileArtifacts(process.cwd(), { yes: yesFlag });
    } catch (error) {
      console.error(chalk.red('\n Profile artifact uninstall failed:'), error.message);
      process.exit(1);
    }
    return;
  }

  const { globalFlag, customPath, scope, positional } = parseFlags(args);

  const skillId = positional[0];
  const agentIds = positional.slice(1);

  if (!skillId) {
    console.error(chalk.red('Usage: npx ma-agents uninstall <skill> <agents...>'));
    process.exit(1);
  }

  if (agentIds.length === 0) {
    console.error(chalk.red('Please specify at least one agent. Run "npx ma-agents agents" to see options.'));
    process.exit(1);
  }

  try {
    await uninstallSkill(skillId, agentIds, customPath, scope);
    console.log(chalk.bold.green('\n Uninstall complete!\n'));
  } catch (error) {
    console.error(chalk.red('\n Uninstall failed:'), error.message);
    process.exit(1);
  }
}

// --- Config layout command ---

function showCurrentLayout() {
  // R-2: distinguish "unbound" from "bound but unreadable/invalid" BEFORE falling
  // back to the single-repo default. Reporting a `backend: notion` project as
  // `Single-repo layout (default)` is the conflation the resolver contract
  // forbids, and it is what made the destructive overwrite look reasonable.
  const binding = resolveProjectTopology(process.cwd());
  if (!binding.ok && binding.reason !== BINDING_UNBOUND) {
    console.log(chalk.red(`\n  Repository layout: binding is ${binding.reason}`));
    console.log(chalk.red(`  ${binding.message}`));
    console.log(chalk.gray('  This project IS bound - the binding just cannot be honoured. Nothing'));
    console.log(chalk.gray('  will be overwritten until it is fixed.'));
    return;
  }

  const layout = readExistingLayout();
  if (!layout) {
    console.log(chalk.cyan('\n  Single-repo layout (default)'));
    console.log(chalk.gray('  Knowledgebase:      . (current repository)'));
    console.log(chalk.gray('  Sprint management:  . (current repository)'));
    return;
  }

  console.log(chalk.bold.cyan('\n  Current Repository Layout:\n'));

  const topology = layout.topology || null;
  const system = topology ? topology.systemRequirementsStore : null;
  const software = topology ? topology.softwareRequirementsStore : null;

  if (system && software && storesDiverge(system, software)) {
    // The two committed stores point at different locations — the FR257 case.
    // Render BOTH, each named after the record it came from and each through its
    // own backend's field list, so the user can see at a glance which store has
    // which backend. Collapsing them onto one `Knowledgebase:` block hid a
    // confluence system store completely, and it is the block the user reads
    // immediately before answering the reconfigure wizard.
    printIdentityBlock('System requirements store', storeIdentityFields(system));
    printIdentityBlock('Software requirements store', storeIdentityFields(software));
  } else {
    // Non-divergent — which is every project that can exist before Story 31.5,
    // and the config.yaml-fallback case where there is no topology at all.
    // Exactly today's single block under today's label (display AC2).
    printIdentityBlock('Knowledgebase', storeIdentityFields(layout.knowledgebase));
  }
  printIdentityBlock('Sprint Management', sprintIdentityFields(layout.sprintManagement));
  console.log('');
}

/**
 * Prints one `Label:` heading and its identity fields. The `padEnd(8) + ' '`
 * reproduces today's alignment byte-for-byte — `Mode:` and `Path:` followed by
 * four spaces, `Git URL:` by one — so a file-system store's output is unchanged
 * (display AC2). Values go through renderIdentityValue, which cannot emit the
 * literal `undefined` (display AC3/AC4).
 */
function printIdentityBlock(label, fields) {
  console.log(chalk.white(`  ${label}:`));
  for (const field of fields) {
    if (field.omitWhenAbsent && (field.value == null || field.value === '')) continue;
    console.log(chalk.gray(`    ${(field.label + ':').padEnd(8)} ${renderIdentityValue(field.value)}`));
  }
}

async function handleConfigLayout(args) {
  const { yesFlag } = parseFlags(args);
  const showOnly = args.includes('--show');

  if (showOnly) {
    showCurrentLayout();
    return;
  }

  // Show current before reconfiguring
  showCurrentLayout();

  // Read existing and present pre-populated wizard
  const existingLayout = readExistingLayout();
  const newLayout = await collectRepoLayout({ yes: yesFlag }, existingLayout);

  // Write updated config
  writeRepoLayoutConfig(newLayout);
  try {
    writeProjectLayoutYaml(newLayout);
  } catch (e) {
    console.log(chalk.yellow(
      `  Warning: could not write _bmad-output/project-layout.yaml: ${e.message}\n` +
      `  The binding was left unchanged.`
    ));
  }

  // Update project-context.md
  const outputPath = path.join(process.cwd(), '_bmad-output', 'project-context.md');
  try {
    if (fs.existsSync(outputPath)) {
      const updated = await updateProjectContextRepoLayout(outputPath, newLayout);
      if (updated) {
        console.log(chalk.green('  project-context.md repo layout section updated'));
      }
    }
  } catch (err) {
    console.log(chalk.yellow(`  project-context repo layout update skipped: ${err.message}`));
  }

  console.log(chalk.bold.green('\n  Layout reconfigured!\n'));
}

// --- Profile reconfigure (Story 21.10) ---
async function handleReconfigure(args) {
  try {
    await runReconfigure({ projectRoot: process.cwd(), argv: args });
  } catch (err) {
    if (err instanceof ReconfigureYesRejectedError) {
      console.error(chalk.red(err.message));
      process.exit(1);
    }
    if (err instanceof ManifestNotFoundError) {
      console.error(chalk.red(err.message));
      console.error(chalk.gray('  Hint: run `npx ma-agents install` before `reconfigure`.'));
      process.exit(1);
    }
    if (err instanceof RoomodesSlugDivergenceError) {
      console.error(chalk.red(err.message));
      process.exit(1);
    }
    if (err && err.name === 'ClinerulesDualFileDriftError') {
      console.error(chalk.red(err.message));
      process.exit(1);
    }
    throw err;
  }
}

// --- Interactive mode ---

async function interactiveMode() {
  console.log(chalk.bold.cyan(`\n ${NAME} v${VERSION}\n`));

  const { action } = await prompts({
    type: 'select',
    name: 'action',
    message: 'What would you like to do?',
    choices: [
      { title: 'Install skills', value: 'install' },
      { title: 'Show installed skills', value: 'status' },
      { title: 'List available skills', value: 'list-skills' },
      { title: 'List supported agents', value: 'list-agents' },
      { title: 'Exit', value: 'exit' }
    ]
  });

  if (!action || action === 'exit') {
    console.log(chalk.yellow('Goodbye!'));
    process.exit(0);
  }

  if (action === 'status') {
    showStatus([]);
    process.exit(0);
  }

  if (action === 'list-skills') {
    showSkills();
    process.exit(0);
  }

  if (action === 'list-agents') {
    showAgents();
    process.exit(0);
  }

  if (action === 'install') {
    await installWizard();
  }
}

// --- Main ---

async function main() {
  const args = process.argv.slice(2);

  // Handle --log flag globally (before command routing)
  let cleanupLog = null;
  const logIdx = args.indexOf('--log');
  if (logIdx !== -1) {
    const ts = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').replace('Z', '');
    const logFile = `install_${ts}.log`;
    cleanupLog = setupLogging(logFile);
    console.log(chalk.gray(`  Logging to ${logFile}`));
    args.splice(logIdx, 1);
  }

  const command = args[0];

  switch (command) {
    case 'install':
      await handleInstall(args.slice(1));
      break;
    case 'uninstall':
    case 'remove':
      await handleUninstall(args.slice(1));
      break;
    case 'status':
      showStatus(args.slice(1));
      break;
    case 'list':
    case 'list-skills':
      showSkills(args.slice(1));
      break;
    case 'agents':
    case 'list-agents':
      showAgents();
      break;
    case 'create-skill':
      await handleCreateSkill(args.slice(1));
      break;
    case 'validate-skill':
      await handleValidateSkill(args.slice(1));
      break;
    case 'set-mandatory':
      await handleSetMandatory(args.slice(1));
      break;
    case 'customize-agent':
      await handleCustomizeAgent(args.slice(1));
      break;
    case 'create-agent':
      await handleCreateAgent(args.slice(1));
      break;
    case 'config':
      if (args[1] === 'layout') {
        await handleConfigLayout(args.slice(2));
      } else {
        console.error(chalk.red(`Unknown config subcommand: ${args[1] || '(none)'}`));
        console.error(chalk.gray('  Usage: npx ma-agents config layout [--show] [--yes]'));
        process.exit(1);
      }
      break;
    case 'reconfigure':
      await handleReconfigure(args.slice(1));
      break;
    case 'help':
    case '--help':
    case '-h':
      showHelp();
      break;
    case 'version':
    case '--version':
    case '-v':
      console.log(`${NAME} v${VERSION}`);
      break;
    default:
      await interactiveMode();
      break;
  }

  if (cleanupLog) cleanupLog();
}

if (require.main === module) {
  main().catch(error => {
    console.error(chalk.red('Error:'), error);
    process.exit(1);
  });
}

module.exports = { parseFlags, selectBmadModules, promptCustomMarketplace, reconcileCustomMarketplaceOnUpdate, resolveBaseBmadOk, collectRepoLayout, readExistingLayout, writeRepoLayoutConfig, writeProjectLayoutYaml, writeConfigField, normalizePath, toPortablePath, resolveStoredPath, ciCloneIfNeeded, showCurrentLayout, handleConfigLayout, yamlEscapeValue, yamlUnescapeDoubleQuoted, resolveProjectTopology, parseLayoutYaml, PROJECT_LAYOUT_SCHEMA_VERSION, BINDING_UNBOUND, BINDING_UNREADABLE, BINDING_INVALID, BINDING_TOO_NEW,
  // COPIES, not the live Sets. These are the single source of truth for what a
  // store's `mode`/`backend` may be, consumed by the reader, the writer and the
  // wizard alike; handing out the real objects would let any consumer `.add()`
  // a member and silently widen all three at once. Copies are inert.
  STORE_MODES: new Set(STORE_MODES), SPRINT_MODES: new Set(SPRINT_MODES),
  STORE_BACKENDS: new Set(STORE_BACKENDS),
  MODE_PROMPT_TITLES, modeChoicesFor, legalBackendsForMessage,
  // The per-backend identity view and everything derived from it. Exported so the
  // suite can pin that STORE_BACKEND_VIEWS names exactly STORE_BACKENDS — a
  // backend with no view would otherwise be discovered by a user, at the moment
  // the renderer throws. The table itself is frozen (entries included), so
  // handing out the real object cannot let a consumer redefine what identifies a
  // store.
  STORE_BACKEND_VIEWS, DEFAULT_STORE_BACKEND, backendOfStore, storeIdentityFields,
  sprintIdentityFields, storesDiverge, renderIdentityValue, summarizeStoreIdentity,
  IDENTITY_NOT_CONFIGURED };
