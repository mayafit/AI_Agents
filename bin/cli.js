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
const { installSkill, uninstallSkill, getStatus, listSkills, listAgents, updateProjectContextRepoLayout, migrateRetiredSkills, reconcileAgentsSharedSkills, generateProjectContext } = require('../lib/installer');
// Story 31.13 / OQ-1 — the PER-MACHINE bound-project record. Required here and
// nowhere else: `resolveProjectTopology` must never depend on it (NFR83), and the
// single import site is what makes "losing it degrades `status` only" a
// structural property rather than a promise.
const { readBoundProjects, recordBoundProject, boundProjectsPath } = require('../lib/bound-projects');
const { getProfile, setProfile, resolveProfile, getBmadModules, setBmadModules, showDemerzelDeprecationNoticeOnce, getCustomMarketplaceSelection, hasShownNotice, markNoticeShown } = require('../lib/profile');
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
  ${chalk.cyan(`npx ${NAME} status`)}                       Show install scope, bound projects and installed skills
  ${chalk.cyan(`npx ${NAME} bind`)}                         Bind this project (knowledge stores + sprint management)
                                             — installs nothing
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

async function showStatus(args) {
  const globalFlag = args.includes('--global');
  const scope = globalFlag ? 'global' : 'project';
  const positional = args.filter(a => a !== '--global');

  const results = getStatus(positional, '', scope);

  // Story 31.13 AC7 (FR253) — the ACTIVE install scope, and for a global install
  // the per-machine list of bound projects with each one's binding health.
  //
  // BEFORE the early return below, deliberately: a machine with a global install
  // and no project-scope skills takes that return, and it is precisely the
  // machine whose bound-project list the user needs. Reporting scope only when
  // skills happen to be listed would make AC7 invisible on its own primary case.
  const scopes = detectInstallScopes();
  printScopeReport(scopes);

  // Story 31.13 AC3 — THE OFFER'S CLI CALL SITE.
  //
  // The offer that reaches a globally-installed SKILL at activation time is the
  // Story 31.4 preflight embedded in the skill documents; the CLI is not present
  // at that moment and cannot be. But `offerBind` must not be a seam with no
  // production caller — an exported function nothing calls is the "presence, not
  // effect" shape this epic keeps producing, and it is what left Story 31.11's
  // AC6 offer with no reader.
  //
  // `status` on a GLOBAL install, run inside a project with no committed binding,
  // is the one CLI moment where the user is asking about exactly this state. So
  // the offer is made here, and only here.
  //
  // `yes` is derived from whether a TTY is attached. Without one — a pipe, a CI
  // step, a test harness — there is no user to choose, so `offerBind` states the
  // remedy and stops rather than prompting. It never binds either way; only an
  // explicit `true` answer can do that.
  if (scopes.global) {
    await offerBind({ projectRoot: process.cwd(), yes: !process.stdin.isTTY });
  }

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

// ═══════════════════════════════════════════════════════════════════════════
// THE GENERATION STAMP (Story 31.3 AC7; consumed by Story 31.4 AC6)
//
// AC7 asks for a stamp "identifying the `project-layout.yaml` state
// `config.yaml` was generated from, so Story 31.4 can detect drift WITHOUT
// depending on filesystem mtimes".
//
// ── WHY NOT MTIME ─────────────────────────────────────────────────────────
// Decision P5-9.3's second rule still reads "when a skill activates and
// `project-layout.yaml` is NEWER THAN the generated `config.yaml`, the skill
// fails loud" — an mtime comparison. That wording is SUPERSEDED and was never
// amended (the implementation-readiness review filed it as "C-6 BEFORE 31.3 —
// amend P5-9.3"). It is not implementable as written: `git checkout`, `git
// pull` and a fresh clone all set working-tree mtimes to checkout time in no
// guaranteed order, so a pull that moves a store can leave the committed file
// OLDER than the generated one (missed drift — the exact failure the guard
// exists to prevent) and an ordinary rebuild can leave it NEWER with nothing
// changed (false alarm on every skill activation). This is open question OQ-2,
// and it settles HERE, with the story that writes the stamp — not with 31.4,
// which only consumes it.
//
// ── THE FORMAT (STABLE CONTRACT FOR STORY 31.4) ───────────────────────────
//
//     project_layout_stamp: "sha256:<64 lowercase hex chars>"
//
// one flat scalar in `_bmad/bmm/config.yaml`, written by `writeConfigField`
// like every other generated field, so it round-trips through the same escaper
// and needs no new parser on either side.
//
// The hashed input is the CANONICAL RE-SERIALIZATION of the three location
// records — `system_requirements_store`, `software_requirements_store`,
// `sprint_management`, in that fixed order — produced by the SAME
// `serializeStore` / `serializeSprintManagement` functions that write
// `project-layout.yaml` itself. Deliberately NOT a hash of the file's raw
// bytes. What is therefore EXCLUDED from the stamp, and why:
//
//   - the `generated:` date, which changes on every install with nothing having
//     moved;
//   - comments and the header banner;
//   - key order and whitespace;
//   - LINE ENDINGS. This repo is developed on Windows and CI'd on Linux; a
//     raw-byte hash would report drift on every cross-platform checkout with
//     `core.autocrlf` in play, and a guard that cries wolf on a clean clone is
//     a guard people learn to ignore;
//   - `schema_version`. A Story 31.7 migration that rewrites a legacy file into
//     schema v2 WITHOUT moving anything must not read as drift — a legacy
//     binding and its migrated equivalent normalise to the same three records
//     and therefore to the same stamp. That is the AC8/NFR82 posture (nothing
//     moved ⇒ nothing to re-bind) expressed in the stamp itself.
//
// What is INCLUDED is exactly what can move an artifact: each store's backend,
// mode, portable path, git URL, Confluence space key and root-page identity,
// and the sprint-management record (including the Jira URL / project key).
//
// ── HOW STORY 31.4 USES IT ────────────────────────────────────────────────
//   1. `resolveProjectTopology(projectRoot)` — the committed binding NOW.
//   2. `computeProjectLayoutStamp(topology, projectRoot)` — what the stamp
//      WOULD be for that binding.
//   3. `readProjectLayoutStamp(configContent)` — what `config.yaml` records.
//   4. Not equal ⇒ drift. Both functions are exported for exactly this.
//      Comparison is on the opaque string; 31.4 must not parse it.
//
//      `readProjectLayoutStamp` returns a DISCRIMINATED result — never a bare
//      string, never a bare `null` — because "there is no stamp" and "there is a
//      stamp and it cannot be used" are DIFFERENT FACTS, and only one of them is
//      benign:
//
//          { ok: true,  value: 'sha256:<64 lowercase hex>' }
//          { ok: false, reason: 'absent',    message }
//          { ok: false, reason: 'malformed', message, raw }
//
//        - `absent`    — the file carries no `project_layout_stamp:` line at
//                        all. THAT, and only that, is the PRE-F26 config that
//                        31.4 AC5 degrades to today's behaviour for. Not drift.
//        - `malformed` — the line IS present but its value is not a stamp this
//                        build wrote: truncated, re-cased, a different algorithm,
//                        damaged by a merge, commented out, or indented into some
//                        other block. This is NOT a pre-F26 config and MUST NOT
//                        be treated as one. The file claims to have been
//                        generated and the claim is unreadable, so 31.4 must
//                        report `message` verbatim and refuse to certify the
//                        binding — the same posture it takes for drift.
//
//      An earlier draft of this contract said a null read means "pre-F26, NOT
//      drift", and the reader returned that same null for both states. That made
//      `valid binding + mangled stamp` — ordinary merge damage, a hand-edit, a
//      truncated write — classify as pre-F26, so 31.4 would decline to block and
//      a skill would run against paths nothing had verified. Validation
//      degrading to permissive is the defect class F26 exists to remove; it is
//      not allowed to live in the contract 31.4 is built from.
//
//   5. ORDER: THE RESOLVER FIRST, THE STAMP SECOND. 31.4 keys on
//      `resolveProjectTopology` and consults the stamp only afterwards.
//      That ordering is what makes the `unbound + fallback` branch of
//      `generateBmmConfig` below correct rather than a silent-permissive hole:
//      that branch generates a config from the caller's answered layout and
//      deliberately writes NO stamp, because there is no `project-layout.yaml`
//      to stamp. A stamp invented there would be a false claim about a binding
//      that does not exist, and would later collide with the real binding the
//      next install writes. Because 31.4 asks the resolver first, it learns
//      `unbound` from the file system BEFORE the stamp is read, so an `absent`
//      stamp is never the fact it reasons from — it is only ever a corroboration
//      of something the resolver already established.
//   6. To NAME the drift ("which store moved, from where to where", 31.4 AC1),
//      31.4 compares the per-store path fields already in `config.yaml`
//      (`system_requirements_path` / `software_requirements_path` /
//      `sprint_management_path`) against the freshly resolved topology. The
//      stamp answers "did anything move?"; those fields answer "what".
//
// The `sha256:` prefix is part of the value, not decoration: it makes the hash
// function explicit in the file, so a future change of algorithm is a visible
// format change rather than a silent mismatch that reads as permanent drift.
// ═══════════════════════════════════════════════════════════════════════════
const PROJECT_LAYOUT_STAMP_FIELD = 'project_layout_stamp';
const PROJECT_LAYOUT_STAMP_PREFIX = 'sha256:';

/**
 * The exact bytes the stamp hashes. Split out from the hashing so a test can
 * assert WHAT is covered rather than only that two hashes differ — a hash test
 * that only ever compares digests cannot tell "the field is covered" from "the
 * field changed something else".
 */
function canonicalBindingBytes(topology, projectRoot) {
  return (
    `system_requirements_store:\n${serializeStore(topology.systemRequirementsStore, projectRoot)}` +
    `software_requirements_store:\n${serializeStore(topology.softwareRequirementsStore, projectRoot)}` +
    serializeSprintManagement(topology.sprintManagement, projectRoot)
  );
}

function computeProjectLayoutStamp(topology, projectRoot) {
  const canonical = canonicalBindingBytes(topology, projectRoot);
  return PROJECT_LAYOUT_STAMP_PREFIX +
    crypto.createHash('sha256').update(canonical, 'utf8').digest('hex');
}

/**
 * Reads the stamp back out of `config.yaml` content.
 *
 * CONTRACT — a DISCRIMINATED result, in the same shape and for the same reason as
 * `resolveProjectTopology`'s. Never returns null, never throws:
 *
 *     { ok: true,  value: 'sha256:<64 lowercase hex>' }
 *     { ok: false, reason: 'absent',    message: '...' }
 *     { ok: false, reason: 'malformed', message: '...', raw: '<what was there>' }
 *
 * The two failure reasons are NOT interchangeable and the split is the whole
 * point of the function's shape. `absent` is a pre-F26 config: nothing ever wrote
 * a stamp here, 31.4 AC5 degrades to today's behaviour, and that is benign.
 * `malformed` is a config that CLAIMS to have been generated and whose claim
 * cannot be read — merge damage, a hand-edit, a truncated write. The previous
 * signature returned the same `null` for both, which meant a valid binding
 * carrying a mangled stamp was indistinguishable from a project that predates the
 * feature, and a consumer following the documented contract would decline to
 * block. A guard that degrades to permissive on damaged input is not a guard.
 *
 * The discriminated shape (rather than the superseded null-or-string pair) is
 * what makes that unmissable: any caller reaching for `.value` is forced past
 * `.ok`, so it cannot silently inherit the old conflation.
 *
 * MATCHING IS DELIBERATELY THE WRITER'S OWN MATCHING. `writeConfigField` locates
 * a field with `^<field>:.*$` under the `m` flag and replaces the FIRST match
 * only, so the reader anchors the key to column 0 and takes the first occurrence
 * too. Reader and writer therefore always speak about the same line: a
 * `# project_layout_stamp: …` in a comment, or an indented `project_layout_stamp:`
 * nested inside some other mapping, is not the field either of them means, and is
 * not accepted as one. (A duplicate top-level key cannot arise from the writer,
 * and if one were hand-added the whole file would already fail js-yaml's
 * duplicate-key check — a far louder failure than this reader's.)
 *
 * The VALUE is validated rather than accepted as free text, and anything that is
 * not exactly this build's output is `malformed` rather than quietly dropped: a
 * truncated digest of any length, uppercase hex, another algorithm's prefix, an
 * unbalanced quote, or trailing content after the digest.
 */
const STAMP_ABSENT = 'absent';
const STAMP_MALFORMED = 'malformed';

function readProjectLayoutStamp(configContent) {
  const content = String(configContent == null ? '' : configContent);

  // Step 1 — is the field there AT ALL? Column-anchored, first occurrence, `m`
  // flag: exactly what writeConfigField would rewrite.
  const keyLine = content.match(/^project_layout_stamp:(.*)$/m);
  if (!keyLine) {
    return {
      ok: false,
      reason: STAMP_ABSENT,
      message:
        `_bmad/bmm/config.yaml carries no ${PROJECT_LAYOUT_STAMP_FIELD}: field. This is a ` +
        `config generated before F26 introduced the stamp, not evidence that anything moved.`,
    };
  }

  // `.` does not match `\n` but DOES match `\r`, so a CRLF file would otherwise
  // leave a carriage return glued to the digest and read as malformed.
  const rawValue = keyLine[1].replace(/\r$/, '').trim();

  // Step 2 — is the value one this build wrote? Quotes must BALANCE; stripping a
  // leading `"` without requiring the trailing one would accept a value the YAML
  // parser reads differently, which is the reader/parser disagreement the suite's
  // js-yaml oracle exists to prevent.
  let unquoted = rawValue;
  if (/^"[^]*"$/.test(unquoted) || /^'[^]*'$/.test(unquoted)) {
    unquoted = unquoted.slice(1, -1);
  }

  if (!/^sha256:[0-9a-f]{64}$/.test(unquoted)) {
    return {
      ok: false,
      reason: STAMP_MALFORMED,
      raw: rawValue,
      message:
        `_bmad/bmm/config.yaml has a ${PROJECT_LAYOUT_STAMP_FIELD}: field whose value is not a ` +
        `stamp this ma-agents wrote (expected "sha256:" followed by 64 lowercase hex ` +
        `characters), got ${JSON.stringify(rawValue)}. The file claims to have been generated ` +
        `from a committed binding and that claim cannot be read — treat it as unverified, NOT ` +
        `as a config that predates the stamp. Re-run the installer (or \`ma-agents bind\`) to ` +
        `regenerate config.yaml from _bmad-output/project-layout.yaml.`,
    };
  }

  return { ok: true, value: unquoted };
}

/**
 * The legacy `{knowledgebase, sprintManagement}` wizard shape viewed as a
 * topology: both stores point at the one answered location. Exactly the mapping
 * `writeProjectLayoutYaml` applies when the committed stores agree, kept in one
 * place so the generated config and the committed binding cannot disagree about
 * what a single answer means.
 */
function topologyFromLegacyLayout(layout) {
  const kb = (layout && layout.knowledgebase) || { mode: 'same', path: '.' };
  return {
    // Story 31.5 fix round. The collapse is only correct for a layout that
    // HAS no per-store records — a pre-31.5 project, where one answered location
    // stood for both stores. Story 31.5's wizard feeds this path a layout that
    // carries both: install Step 3.6 reaches it whenever `writeProjectLayoutYaml`
    // throws (an unwritable `_bmad-output/`), leaving the binding `unbound`, and a
    // divergent SYSTEM store then silently collapsed onto the software store's
    // location in the generated `config.yaml` — with the right record sitting
    // unread on the very object being passed in. Same collapse class the read
    // path already fixed; prefer the explicit record, fall back to the view.
    systemRequirementsStore: (layout && layout.systemRequirementsStore) || kb,
    softwareRequirementsStore: (layout && layout.softwareRequirementsStore) || kb,
    sprintManagement: (layout && layout.sprintManagement) || { mode: 'same', path: '.' },
  };
}

// A store's value for a `*_path` field in config.yaml. `toPortablePath(undefined)`
// already returns `'.'`, so a confluence store (which has no `.path` at all)
// resolves to the local-artifacts default without a special case — see the long
// note in generateBmmConfig about why that value is deliberately unchanged.
function storeConfigPath(store, projectRoot) {
  return toPortablePath(store && store.path, projectRoot).portable;
}

/**
 * Story 31.3 — GENERATE `_bmad/bmm/config.yaml` FROM `_bmad-output/project-layout.yaml`.
 *
 * AC1. The file does not move and no skill learns a new location: all 39
 * existing references keep reading `_bmad/bmm/config.yaml`, and every field they
 * read today (`knowledgebase_path`, `sprint_management_path`,
 * `planning_artifacts`, `implementation_artifacts`) is still there with the same
 * derivation. It GROWS two per-store fields, `system_requirements_path` and
 * `software_requirements_path`, because a single-valued `planning_artifacts`
 * cannot serve two stores in different places. The retained single-valued fields
 * resolve to the SOFTWARE requirements store (FR264 as amended 2026-08-02), so
 * untouched references keep working unchanged.
 *
 * AC2. ONE WAY ONLY: committed -> per-machine. This function READS
 * `project-layout.yaml` and WRITES `config.yaml`. There is no inverse anywhere.
 * (The FR265 fallback in `readExistingLayout` is NOT an inverse: it pre-populates
 * a WIZARD from a pre-F26 config so the user can be asked, and writes nothing.)
 *
 * AC3. Fires on install and `ma-agents bind` only. Both production call sites are
 * write paths — Step 3.6 of `install` (inside the `installScope === 'project'`
 * gate; FR251 forbids a global install doing project-scoped work) and
 * `handleConfigLayout`. No read path calls it.
 *
 * AC4. Overwrites wholesale and says so, naming the file. "Wholesale" is scoped
 * to the GENERATED fields: the file is upstream BMAD's module config and also
 * carries fields ma-agents does not own (`user_name`, `output_folder`, ...).
 * Truncating it would destroy those and break every skill, so generation
 * overwrites each generated field unconditionally — never merging with, or
 * preferring, whatever was there — and leaves foreign keys alone. This is what
 * the story's own technical note directs by naming `writeConfigField()` as the
 * helper to reuse.
 *
 * AC5. `_bmad/config.user.toml` and `_bmad/custom/config.user.toml` are never
 * touched: this function opens exactly one path. (Module configs here are YAML,
 * root and user configs are TOML — `config.user.yaml` does not exist.)
 *
 * AC7. Writes the generation stamp documented above.
 *
 * 2B NIT 4 — A DERIVED FILE IS NEVER BUILT FROM A BINDING THE SYSTEM REFUSED TO
 * TRUST. `writeProjectLayoutYaml` already refuses to overwrite an `invalid` /
 * `unreadable` / `too-new` binding, but the derived `config.yaml` used to be
 * written anyway, from the bare default, and the warning never mentioned
 * `config.yaml` at all. A generated file derived from a binding we would not read
 * is exactly the permissive degradation P5-9.1 exists to prevent, so this
 * function refuses too, names `config.yaml` in the message, and leaves the
 * existing file untouched.
 *
 * @param {object}  opts
 * @param {string}  opts.projectRoot
 * @param {object=} opts.fallbackLayout Legacy `{knowledgebase, sprintManagement}`
 *   used ONLY when the project has no committed binding at all (`unbound`).
 *   Never used to override a binding that exists — that would make the generator
 *   two-sourced and reintroduce the disagreement this story removes.
 * @returns {boolean} whether config.yaml was written.
 */
function generateBmmConfig(opts) {
  const options = opts || {};
  const projectRoot = options.projectRoot || process.cwd();
  const configPath = path.join(projectRoot, '_bmad', 'bmm', 'config.yaml');
  const fallbackLayout = options.fallbackLayout || null;

  // ── SOURCE SELECTION. The committed binding is authoritative; the caller's
  // layout is a fallback for an unbound project only.
  const binding = resolveProjectTopology(projectRoot);

  if (!binding.ok && binding.reason !== BINDING_UNBOUND) {
    // 2B nit 4. Fail loud and name BOTH files — the derived one especially,
    // because that is the file the user's skills will actually read.
    console.log(chalk.red(
      `  Refusing to regenerate _bmad/bmm/config.yaml — the committed binding in\n` +
      `  _bmad-output/project-layout.yaml is ${binding.reason}:\n` +
      `    ${binding.message}\n` +
      `  _bmad/bmm/config.yaml has been left UNCHANGED rather than generated from a default,\n` +
      `  because a derived config built from a binding this build refuses to read would\n` +
      `  silently point your skills at the wrong place. Fix the binding (or delete it and\n` +
      `  re-run the installer), then re-run to regenerate config.yaml.`
    ));
    return false;
  }

  let topology;
  // Whether this generation has a committed binding state to stamp. The stamp
  // itself is COMPUTED INSIDE the try below (R-4), not here — see the note there.
  let stampable;
  if (binding.ok) {
    topology = binding.topology;
    stampable = true;
  } else if (fallbackLayout) {
    // Unbound: no committed binding to generate from. This is reachable when
    // `writeProjectLayoutYaml` could not write (unwritable `_bmad-output/`), and
    // in the direct-call path the existing suites exercise. Generate today's
    // fields from the answered layout so the install still produces a usable
    // config — but write NO stamp, because there is no binding state to stamp,
    // and a stamp invented here would be a claim about a file that does not
    // exist — one that would collide with the real binding the next install
    // writes.
    //
    // This is NOT the silent-permissive shape it can look like. Per the contract
    // above (step 5), Story 31.4 keys on `resolveProjectTopology` FIRST and the
    // stamp SECOND: it learns `unbound` from the absent `project-layout.yaml`
    // before it ever reads the stamp, so the resulting `absent` stamp only
    // corroborates a fact already established — it is never the fact 31.4
    // reasons from. Writing a stamp here would be the permissive move, not the
    // strict one.
    topology = topologyFromLegacyLayout(fallbackLayout);
    stampable = false;
  } else {
    console.log(chalk.yellow(
      `  Skipping _bmad/bmm/config.yaml generation: this project has no committed binding in\n` +
      `  _bmad-output/project-layout.yaml and no layout was supplied to generate from.\n` +
      `  Run the installer (or a future \`ma-agents bind\`) to write the binding first.`
    ));
    return false;
  }

  try {
    // R-4 — INSIDE the try on purpose. `computeProjectLayoutStamp` re-runs the
    // `project-layout.yaml` serializers, and those THROW rather than return on a
    // value they refuse to write (`serializeStore`'s backend-enum check,
    // `assertWritableMode`, `assertSingleLineIdentity`). Install Step 3.6 already
    // wraps `writeProjectLayoutYaml` in a try/catch for exactly this hazard but
    // does NOT wrap `generateBmmConfig`, so a throw escaping from here would reach
    // `main().catch` and print a stack trace over a substantially-finished
    // install. Every malformed identity found so far is normalised by
    // `parseLayoutYaml`/`storeFromRaw` before a serializer sees it, so no
    // reachable input is claimed — this closes an asymmetry rather than a proven
    // defect, and costs one line to close.
    const stamp = stampable ? computeProjectLayoutStamp(topology, projectRoot) : null;

    if (!fs.existsSync(configPath)) {
      // Create an empty file so writeConfigField can append to it
      fs.mkdirSync(path.join(projectRoot, '_bmad', 'bmm'), { recursive: true });
      fs.writeFileSync(configPath, '', 'utf-8');
    }
    let content = fs.readFileSync(configPath, 'utf-8');

    const systemStore = topology.systemRequirementsStore;
    const softwareStore = topology.softwareRequirementsStore;
    const sprint = topology.sprintManagement || { mode: 'same', path: '.' };

    // ── The non-file-system note (B-1 consequence 3), now per store.
    //
    // `toPortablePath(undefined)` already returns `'.'`, so nothing crashes and
    // the literal `undefined` is never written — but writing `.` for a Confluence
    // store SILENTLY says "the knowledgebase is this repo", which is exactly the
    // permissive-default shape B-1 itself was. So it is said out loud rather than
    // left to fall out of a falsy check.
    //
    // The VALUE is deliberately unchanged (`.`): `knowledgebase_path` is what
    // `planning_artifacts` is derived from below and what the Knowledge Atlas
    // config scan reads (lib/knowledge-atlas/src/scan/config.ts), so changing it
    // would move resolved artifact paths and violate NFR82.
    //
    // What `knowledgebase_path` SHOULD mean for a Confluence-backed store remains
    // a genuine open question and is NOT decided here — see
    // `_bmad-output/implementation-artifacts/
    //  bug-knowledgebase-path-has-no-defined-meaning-for-a-confluence-store.md`.
    // This story adds the per-store fields the question's own analysis says are
    // the precondition for answering it (one scalar cannot describe two stores),
    // but choosing what a Confluence store's path MEANS belongs to Story 31.6,
    // which owns the Confluence read path. Pinned by
    // `test/project-layout-two-store-round-trip.test.js` and by this story's
    // suite so it cannot drift silently.
    const softwareBackend = backendOfStore(softwareStore);
    const systemBackend = backendOfStore(systemStore);
    let notes = [];
    if (softwareBackend !== DEFAULT_STORE_BACKEND) {
      notes.push({ backend: softwareBackend, fields: ['knowledgebase_path', 'software_requirements_path'] });
    }
    if (systemBackend !== DEFAULT_STORE_BACKEND) {
      notes.push({ backend: systemBackend, fields: ['system_requirements_path'] });
    }
    // While the two stores are the same store (every project that can exist
    // before Story 31.5), one note covering all three fields — not the same
    // sentence twice.
    if (notes.length === 2 && !storesDiverge(systemStore, softwareStore)) {
      notes = [{
        backend: softwareBackend,
        fields: ['knowledgebase_path', 'software_requirements_path', 'system_requirements_path'],
      }];
    }
    for (const note of notes) {
      console.log(chalk.yellow(
        `  Note: the knowledge store is ${note.backend}-backed, which has no filesystem path.\n` +
        `  config.yaml's ${note.fields.join(', ')} ${note.fields.length > 1 ? 'are' : 'is'} left at "." ` +
        `(the local artifacts default)\n` +
        `  so planning artifacts keep resolving where they do today. The authoritative\n` +
        `  ${note.backend} identity lives in _bmad-output/project-layout.yaml and is unchanged.`
      ));
    }

    // ── The legacy single-valued field. FR264 as amended 2026-08-02: it resolves
    // to the SOFTWARE requirements store. Unconditionally, divergent or not.
    const kbPath = storeConfigPath(softwareStore, projectRoot);
    content = writeConfigField(content, 'knowledgebase_path', kbPath);

    // ── The two NEW per-store fields (AC1). Written next to the legacy field
    // they generalise, so a human reading config.yaml sees the relationship.
    // `software_requirements_path` is by construction the same value as
    // `knowledgebase_path`; it is written anyway rather than aliased, because a
    // reader of the new field must not have to know the legacy one exists.
    content = writeConfigField(content, 'system_requirements_path', storeConfigPath(systemStore, projectRoot));
    content = writeConfigField(content, 'software_requirements_path', kbPath);

    // 3.12.3: when the user provides a non-`.` path for knowledgebase /
    // sprint management, treat that path as the literal artifacts directory
    // — no nested `_bmad-output/<…>-artifacts/` subtree. The wizard prompt
    // ("Where is your knowledgebase managed?") implies the path IS the
    // artifacts folder, not a parent. Only `.` (current repo) gets the
    // canonical `_bmad-output/...` layout because in single-repo mode
    // there's no other folder semantics to honor.
    const planningArtifacts = kbPath === '.' ? canonicalArtifactPath('planning-artifacts') : kbPath;
    let summary;
    if (sprint.mode === 'jira') {
      // Jira backend: write sprint_backend + Jira config; no sprint_management_path
      content = writeConfigField(content, 'sprint_backend', 'jira');
      content = writeConfigField(content, 'jira_url', sprint.jiraUrl);
      content = writeConfigField(content, 'jira_project_key', sprint.jiraProjectKey);
      content = writeConfigField(content, 'planning_artifacts', planningArtifacts);
      content = writeConfigField(content, 'implementation_artifacts', canonicalArtifactPath('implementation-artifacts'));
      summary = `  Config: knowledgebase_path="${kbPath}", sprint_backend=jira, jira_url="${sprint.jiraUrl}", jira_project_key="${sprint.jiraProjectKey}"`;
    } else {
      // File-system backend
      const spPath = storeConfigPath(sprint, projectRoot);
      content = writeConfigField(content, 'sprint_backend', 'file-system');
      content = writeConfigField(content, 'sprint_management_path', spPath);
      content = writeConfigField(content, 'planning_artifacts', planningArtifacts);
      content = writeConfigField(content, 'implementation_artifacts',
        spPath === '.' ? canonicalArtifactPath('implementation-artifacts') : spPath);
      summary = `  Config: knowledgebase_path="${kbPath}", sprint_backend=file-system, sprint_management_path="${spPath}"`;
    }

    // AC7 — LAST, so it sits at the end of the generated block and reads as what
    // it is: a statement about everything above it.
    if (stamp) content = writeConfigField(content, PROJECT_LAYOUT_STAMP_FIELD, stamp);

    fs.writeFileSync(configPath, content, 'utf-8');

    // AC4 — the overwrite notice. Names the file it overwrote, every time.
    //
    // The unbound branch deliberately does NOT name `project-layout.yaml`: there
    // is no such file in that case, so naming it would be a false statement about
    // where these values came from. (It also keeps
    // `project-layout-binding-spine.test.js`'s "a config.yaml write must never
    // name project-layout.yaml" scenario honest.)
    console.log(chalk.gray(stamp
      ? `  Regenerated _bmad/bmm/config.yaml from _bmad-output/project-layout.yaml — its generated fields were OVERWRITTEN.`
      : `  Wrote _bmad/bmm/config.yaml — its generated fields were OVERWRITTEN.`));
    console.log(chalk.gray(summary));
    return true;
  } catch (e) {
    console.log(chalk.red(`  Cannot write config.yaml: ${e.message}`));
    return false;
  }
}

/**
 * The legacy-shape entry point, retained deliberately.
 *
 * Every caller that has a `{knowledgebase, sprintManagement}` layout in hand —
 * `handleConfigLayout`, Step 3.6 of the installer, and the existing suites — goes
 * through here. It is a THIN adapter, not a second writer: there is exactly one
 * function that writes config.yaml, and the committed binding still wins whenever
 * one exists, so calling this on a bound project generates from the binding and
 * ignores the argument. That precedence is the whole point of AC1 — a caller
 * cannot route around the authoritative source by passing a layout.
 */
function writeRepoLayoutConfig(layout) {
  return generateBmmConfig({ projectRoot: process.cwd(), fallbackLayout: layout });
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

// ─── The per-backend WIZARD view, keyed by STORE_BACKENDS ───────────────────
//
// Story 31.5 AC3: each knowledge-store question selects a BACKEND first, and
// then that backend's location. That makes the wizard a THIRD direction over the
// `backend` enum — exactly as MODE_PROMPT_TITLES made it a third direction over
// the `mode` enums — so it gets the same treatment: ONE table keyed by the enum
// members, with the suite pinning that these keys are exactly STORE_BACKENDS. A
// wizard carrying its own private list of backends would reinstate the read/write
// enum disagreement this epic has already fixed three times.
//
// `collect` gathers that backend's location. `null` means "a member of the enum
// whose wizard flow does not exist yet", and such a backend is NOT OFFERED.
//
// WHY NOT OFFERED, rather than offered-and-pending. Story 31.5's AC5 allowed
// either "not offered until 31.8" or "offered, recorded with a clearly-stated
// configuration-pending state". The implementation-readiness review directed the
// first: a pending state would need a THIRD value in a two-value schema field
// that Story 31.2 sealed as a closed enum shared by reader, writer and prompt,
// which is precisely the closed-enum defect class this epic has already fixed
// three times. Offering a backend the installer cannot configure would also
// record an unusable store — the permissive degradation P5-9 exists to prevent.
//
// STORY 31.8 HAS LANDED, and it was exactly the one-line change predicted here:
// `confluence` now names its flow and is therefore offered, with no other change
// to this table and none to `offerableStoreBackends` below. `collect: null`
// remains the documented way to carry a member of the enum ahead of its flow.
const STORE_BACKEND_WIZARD = Object.freeze({
  'file-system': Object.freeze({
    title: 'File system (this repository, a local path, or a remote git repository)',
    // Named function, not an inline arrow, so the table entry and the flow it
    // names are greppable in both directions.
    collect: collectFileSystemStoreLocation,
  }),
  confluence: Object.freeze({
    title: 'Confluence',
    // Story 31.8 — space (FR259) and root page (FR260), collected OFFLINE. The
    // flow asks two questions and neither is a credential (NFR79); see the block
    // comment above `collectConfluenceStoreLocation`.
    collect: collectConfluenceStoreLocation,
  }),
});

// The backends the wizard may actually offer — DERIVED from the enum and the
// table above, listed nowhere. Order is STORE_BACKENDS' insertion order, which
// is the order the user reads.
//
// `wizard` is a parameter only so the suite can pin that this really is a
// derivation rather than a literal that happens to read `['file-system']` today:
// the table is frozen (deliberately), so the test cannot give confluence a flow
// in place and observe it become offered. Every production call site takes the
// default. A hardcoded list here would be a SECOND definition of what Story 31.8
// has to change, which is exactly the shape this epic keeps re-finding.
function offerableStoreBackends(wizard = STORE_BACKEND_WIZARD) {
  return [...STORE_BACKENDS].filter((backend) => {
    const entry = wizard[backend];
    return !!(entry && typeof entry.collect === 'function');
  });
}

// Story 31.8 mutation round. `wizard` is threaded through here for exactly the
// reason it exists on `offerableStoreBackends` above, and it was missing: with
// two offerable backends, replacing this body with the literal
// `[{...'file-system'}, {...confluence}]` was UNDETECTABLE. The existing
// enum-poisoning test adds a member and asserts the choices do NOT grow — which a
// hardcoded list also satisfies — and the derivation probe was aimed one function
// too low. The parameter makes the derivation observable at the layer the wizard
// actually calls. Every production call site takes the default.
function backendChoicesForStore(wizard = STORE_BACKEND_WIZARD) {
  return offerableStoreBackends(wizard).map((value) => ({
    title: wizard[value].title,
    value,
  }));
}

// ─── The three concerns the layout wizard asks about (Story 31.5 AC1) ───────
//
// FR111's SINGLE knowledgebase question is superseded by two independent
// knowledge-store questions. FR112's sprint-management question is UNCHANGED and
// remains a third, separate concern asked exactly as it is today — sprint state
// is deliberately not folded into either store, because FR112 and FR267 are
// explicit that it is tracked separately and story files follow
// `sprint_management_path`, not either store.
//
// `contents` is AC7. The wizard states what each store holds AT THE POINT OF
// ASKING, inside the question text itself rather than in a console.log printed
// next to it: a nearby line is a line the user may have scrolled past, and a test
// asserting that it appeared "somewhere in stdout" would prove presence rather
// than that the two questions are unambiguous. Putting it in the `message` makes
// the claim checkable against the question the user was actually shown.
//
// `key` doubles as the concern name passed to `modeChoicesFor`, which offers
// SPRINT_MODES for `sprintManagement` and STORE_MODES for everything else — so
// the two store concerns get STORE_MODES (no `jira`) by construction.
const REPO_LAYOUT_CONCERNS = Object.freeze([
  Object.freeze({
    key: 'systemRequirementsStore',
    kind: 'store',
    label: 'system requirements store',
    contents: 'product brief and PRD (for a sharded PRD, its index and all shards)',
  }),
  Object.freeze({
    key: 'softwareRequirementsStore',
    kind: 'store',
    label: 'software requirements store',
    contents: 'architecture document, UX designs, epics',
  }),
  Object.freeze({
    key: 'sprintManagement',
    kind: 'sprint',
    // Byte-identical to the label FR112's question has always used, so
    // "Where is your sprint management managed?" is unchanged (AC1).
    label: 'sprint management',
  }),
]);

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

/**
 * Story 31.13 fix round — THE OUTCOME OF AN AUTHORITATIVE WRITE, AS A VALUE.
 *
 * `writeProjectLayoutYaml` has five exits and used to return `undefined` from
 * every one of them, so a caller could not tell "wrote it" from "could not create
 * the directory". `handleBind` consequently printed `Bound.`, exited 0, generated
 * a `config.yaml` and registered the project after a write that had FAILED — the
 * blocking defect this round exists to close. A guard bolted onto `handleBind`
 * alone would have left the same blindness for the next caller, so the outcome is
 * made observable AT THE SOURCE instead.
 *
 * The five outcomes are kept SEPARATE, by name, for the reason `BINDING_UNBOUND`
 * and `BINDING_UNREADABLE` are separate: two of them mean the binding on disk is
 * good and three mean it is not, and collapsing them loses exactly the distinction
 * the caller needs. In particular `UNCHANGED_LEGACY` (Story 31.7 AC3/AC4 declined
 * to rewrite a legacy file because NOTHING MOVED — the project IS bound, by the
 * file that was already there) must never read as a failure, and `FAILED_MKDIR` /
 * `FAILED_WRITE` must never read as a success.
 */
const LAYOUT_WRITE_WROTE = 'wrote';
const LAYOUT_WRITE_UNCHANGED_LEGACY = 'unchanged-legacy';
const LAYOUT_WRITE_REFUSED = 'refused';
const LAYOUT_WRITE_FAILED_MKDIR = 'failed-mkdir';
const LAYOUT_WRITE_FAILED_WRITE = 'failed-write';

/**
 * Which outcomes leave a usable committed binding on disk.
 *
 * DEFAULT-DENY, deliberately: the bound set is enumerated and everything else is
 * unbound, so an outcome added later is treated as NOT-bound until someone decides
 * otherwise. The inverse spelling (`=== FAILED_MKDIR || === FAILED_WRITE`) would
 * silently admit a sixth outcome as a success, which is the shape of the defect
 * this whole mechanism replaces.
 */
function projectLayoutWriteIsBound(outcome) {
  const o = outcome && outcome.outcome;
  return o === LAYOUT_WRITE_WROTE || o === LAYOUT_WRITE_UNCHANGED_LEGACY;
}

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
    // THE DECLARED VERSION DECIDES WHICH SHAPE IS EXPECTED — always, with no
    // fallback. This condition used to also require `raw.system_requirements_store`
    // to be present, which meant a file DECLARING `schema_version: 2` while
    // carrying only a v1 `knowledgebase:` record fell through to the legacy branch
    // below and was reported as `schemaVersion: 1` — the declared version silently
    // ignored, the only place in this resolver where that happened. Story 31.7's
    // preservation branch in `writeProjectLayoutYaml` then made that permanent:
    // before it, the next install overwrote the incoherent file with a real v2 one
    // and the problem self-healed; after it, "nothing moved" is true (both stores
    // derive from the one legacy record) so nothing is ever written again, and the
    // legacy notice tells the user their file "predates the two-store layout"
    // about a file that declares schema 2. Frozen, and told something false.
    //
    // ma-agents cannot produce this shape: the writer emits `schema_version:` and
    // both store records together. It is reachable only by hand-editing or a bad
    // merge, so it is MALFORMED, and the posture for a malformed authoritative
    // file in this epic is to fail loud and touch nothing (P5-9.3): a v3 file is
    // `too-new` and refused, a v2 file missing one store record is `invalid`.
    // Reading a declared-v2 file as v1 was the sole exception. It now classifies
    // `invalid` like its siblings, which also restores a way OUT — the
    // non-destruction guard prints the message below and names the recovery — and
    // makes the detector's justifying comment true rather than false. Nothing is
    // migrated and nothing is rewritten; this is a refusal, not a repair.
    if (schemaVersion >= PROJECT_LAYOUT_SCHEMA_VERSION) {
      const systemStore = storeFromRaw(raw.system_requirements_store, projectRoot);
      const softwareStore = storeFromRaw(raw.software_requirements_store, projectRoot);
      if (!systemStore || !softwareStore) {
        return fail(BINDING_INVALID,
          `_bmad-output/project-layout.yaml declares schema_version ${schemaVersion} but is ` +
          `missing a required store record (system_requirements_store / ` +
          `software_requirements_store). A file that declares schema ` +
          `${PROJECT_LAYOUT_SCHEMA_VERSION} while carrying only a pre-F26 knowledgebase record ` +
          `is malformed, not legacy - a genuine pre-F26 file declares no schema_version at all. ` +
          `Fix it by hand, or delete it and re-run the installer to write a fresh binding.`);
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

    // Legacy (FR122/Story 16.2 shape, or a file declaring a schema_version below
    // the current one): a single `knowledgebase:` record read as both stores
    // pointing at that location. Only reachable now when the DECLARED version is
    // below the current one — a declared-current file is adjudicated above,
    // whatever records it happens to carry.
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

// ═══════════════════════════════════════════════════════════════════════════
// STORY 31.7 (FR265, NFR82) — LEGACY SINGLE-STORE COMPATIBILITY, AND A
// MIGRATION THAT IS OFFERED AND NEVER PERFORMED.
//
// ── HOW LEGACY IS DETECTED, AND WHY NOT BY FIELD NAMES ────────────────────
// The story's own technical note is explicit: detect legacy by the ABSENCE of
// Story 31.2's `schema_version` field, not by heuristics over which field names
// happen to be present. That is what this function does, and it does it by
// asking `resolveProjectTopology` rather than re-reading the file: the resolver
// already derives `topology.schemaVersion` from exactly one thing — a present,
// numeric `schema_version:` line, defaulting to 1 when absent or empty — and it
// is the ONLY place that derivation exists. A second reader here would be a
// second definition of "what schema is this file", i.e. the read/write enum
// disagreement this epic has already fixed three times, one layer up.
//
// A heuristic over field names would ALSO be wrong on its own terms, not merely
// duplicative. `knowledgebase:` present is not sufficient (a hand-edited v2 file
// may carry a stale one), and `system_requirements_store:` absent is not
// sufficient either: a file that DECLARES the current schema but is missing a
// store record is `invalid` — a fault, not a legacy layout — whether what it
// carries instead is a stale `knowledgebase:` record or nothing at all.
//
// That second claim is now true of EVERY declared-current file. It was NOT true
// when this comment was first written: the shape `schema_version: 2` + a
// `knowledgebase:` record and no `system_requirements_store:` fell through to the
// resolver's legacy branch and came back `ok:true, schemaVersion: 1` — i.e. as
// precisely the "legacy layout" this paragraph asserted it could not be, which
// then earned it a notice saying its file "predates the two-store layout" about a
// file declaring schema 2. The resolver was corrected (see the block above the
// declared-version gate in `resolveProjectTopology`); the shape is pinned in
// test/project-layout-legacy-single-store.test.js.
//
// ── WHY THIS CANNOT CONTRADICT STORY 31.4'S DISCRIMINATOR ─────────────────
// Story 31.4's skill preflight decides "is this genuinely a pre-F26 project?"
// in its Step P2 — the branch it reaches ONLY when `_bmad-output/
// project-layout.yaml` is ABSENT (or blank/comments-only). There it corroborates
// the absent `project_layout_stamp` against `system_requirements_path` /
// `software_requirements_path` in `config.yaml`, because a config carrying those
// is demonstrably NOT pre-F26 and must HALT.
//
// This function is disjoint from that branch BY CONSTRUCTION: it returns
// `legacy: false` for every `ok:false` result, so it can only ever fire where a
// `project-layout.yaml` EXISTS AND RESOLVES — which is precisely the input on
// which 31.4 takes Step P1 → Step P3 and never reaches Step P2 at all. The two
// therefore cannot disagree about the same project: for any project one of them
// classifies, the other is in a different branch. Pinned in
// test/project-layout-legacy-single-store.test.js ("agreement with Story 31.4").
//
// It also never reads a stamp, and never reads `config.yaml` at all. An absent
// stamp is 31.4's evidence, and reusing it here would couple the informational
// notice to the blocking guard's evidence — the coupling the story's second
// technical note forbids.
//
// ── THE RESULT IS DISCRIMINATED, for the same reason 31.2's and 31.3's are ──
//     { legacy: true,  topology }
//     { legacy: false, reason: 'two-store', topology }
//     { legacy: false, reason: 'unbound'|'unreadable'|'invalid'|'too-new', message }
// A bare boolean would collapse "this project is fine, it is already split" into
// "this project's binding is corrupt", and the caller would print an
// informational notice for both — or, worse, for neither.
// ═══════════════════════════════════════════════════════════════════════════

// AC1's second clause — "already on the two-store layout" — is a NON-legacy
// outcome with its own name, so a caller cannot confuse it with a fault.
const LEGACY_TWO_STORE = 'two-store';

function detectLegacySingleStore(projectRoot) {
  const binding = resolveProjectTopology(projectRoot);
  if (!binding.ok) {
    // Every fault, and `unbound`, are NOT legacy. `unbound` especially: a project
    // with no committed binding is Story 31.4's Step P2 input and is decided
    // there, against `config.yaml`'s per-store fields. Claiming it here would be
    // this story contradicting that discriminator — the exact failure the
    // technical notes warn about.
    return { legacy: false, reason: binding.reason, message: binding.message };
  }
  if (binding.topology.schemaVersion >= PROJECT_LAYOUT_SCHEMA_VERSION) {
    return { legacy: false, reason: LEGACY_TWO_STORE, topology: binding.topology };
  }
  return { legacy: true, topology: binding.topology };
}

// ── THE NOTICE (AC2) ───────────────────────────────────────────────────────
//
// AC2 fixes the content at exactly three facts, one per constant below:
//   (i)   this project is on the legacy single-store layout;
//   (ii)  what that means — both stores resolve to the one location, and
//         nothing has been changed or moved;
//   (iii) the EXACT command that splits it, and that nothing happens unless the
//         user runs it.
//
// ── CHANNEL SEPARATION FROM STORY 31.4'S DRIFT ERROR ──────────────────────
// The story's second technical note makes this a requirement, not a nicety:
// legacy is informational and non-blocking, drift is loud and blocking, and if
// they share a channel the user learns to ignore both. Four things keep them
// apart, and each is pinned by a test:
//
//   1. DIFFERENT SURFACE. 31.4's guard lives in the 41 byte-identical preflight
//      blocks embedded in the skill entry documents and speaks at SKILL
//      ACTIVATION. This notice is printed by the ma-agents CLI during `install`
//      and nowhere else. No skill document mentions the legacy layout at all —
//      a legacy project produces ZERO extra output on skill activation, which is
//      also how AC5 is satisfied for "activations".
//   2. DIFFERENT COLOUR. 31.4 halts in the red/`stopping` register. This is
//      chalk.cyan + chalk.gray — the same informational register Story 30.4's
//      one-time notice uses, and deliberately NOT chalk.yellow (this codebase's
//      warning colour) either.
//   3. DIFFERENT VOCABULARY. The halt blocks open "ma-agents — stopping:" and
//      close "Nothing has been read or written on your behalf." Those phrases
//      are ABSENT here, and the test asserts their absence rather than merely
//      asserting this text is present.
//   4. DIFFERENT CONSEQUENCE. 31.4 refuses to proceed. This returns a boolean
//      and the install continues; it cannot halt anything, because it is a
//      `console.log` and a manifest write and has no other effect.
//
// The command is its own constant so a test can bind AC2's "the exact command"
// claim to the shipped string rather than to a copy of it, and so a mutant that
// changes the command cannot survive by matching a looser regex.
const LEGACY_SINGLE_STORE_SPLIT_COMMAND = 'ma-agents config layout';

const LEGACY_SINGLE_STORE_NOTICE_FACT_1 =
  '  Note: this project uses the legacy single-store knowledge layout.';

const LEGACY_SINGLE_STORE_NOTICE_FACT_2 =
  '  What that means: _bmad-output/project-layout.yaml predates the two-store layout, so the\n' +
  '  system requirements store (product brief, PRD) and the software requirements store\n' +
  '  (architecture, UX designs, epics) both resolve to the SAME one location:';

const LEGACY_SINGLE_STORE_NOTICE_FACT_3 =
  `  Nothing has been changed or moved and every artifact path is exactly where it was. To\n` +
  `  split the two stores so they can live in different places, run \`${LEGACY_SINGLE_STORE_SPLIT_COMMAND}\`.\n` +
  `  Nothing is migrated unless you run it. This message is shown once.`;

const LEGACY_SINGLE_STORE_NOTICE_ID = 'legacy-single-store';

/**
 * AC2 + AC5 — print the legacy notice AT MOST ONCE, EVER, for this project.
 *
 * Idempotence uses Story 30.4's generic one-time-notice tracking verbatim
 * (`lib/profile.js#hasShownNotice` / `#markNoticeShown`, persisted under
 * `notices` in the project-root `.ma-agents.json`), rather than a second
 * mechanism that would have to be kept honest separately. AC5 names that pattern
 * explicitly.
 *
 * NON-BLOCKING BY CONSTRUCTION (AC2): this function prompts nothing, throws
 * nothing at its caller, exits nothing, and writes nothing under `_bmad-output/`.
 * It touches exactly one file, `.ma-agents.json`, and only to record that it has
 * spoken. A failure to record that is deliberately swallowed: an unwritable
 * manifest must not abort an install over an informational message. The cost of
 * swallowing is that the notice may print again next time — the safe direction,
 * and the only direction available, since the alternative is failing an install.
 *
 * MIGRATION IS OFFERED, NEVER PERFORMED (AC3): this is the entire offer. It
 * names `ma-agents config layout` — which since Story 31.5 asks the two
 * independent store questions and writes through Story 31.2's
 * `writeProjectLayoutYaml` — and does not itself call, schedule or arm anything.
 * Accepting the offer means the user runs that command; declining means they do
 * not, and a project on which they do not run it is left byte-identical (AC4),
 * which `writeProjectLayoutYaml`'s legacy-preservation branch is what actually
 * guarantees.
 *
 * @param {string} projectRoot
 * @returns {boolean} true if the notice printed on this call; false if the
 *   project is not legacy, or the notice had already been shown.
 */
function showLegacySingleStoreNoticeOnce(projectRoot) {
  const detection = detectLegacySingleStore(projectRoot);
  if (!detection.legacy) return false;
  if (hasShownNotice(projectRoot, LEGACY_SINGLE_STORE_NOTICE_ID)) return false;

  console.log(chalk.cyan(`\n${LEGACY_SINGLE_STORE_NOTICE_FACT_1}`));
  console.log(chalk.gray(LEGACY_SINGLE_STORE_NOTICE_FACT_2));
  console.log(chalk.gray(
    `    ${summarizeStoreIdentity(detection.topology.softwareRequirementsStore)}`));
  console.log(chalk.gray(`${LEGACY_SINGLE_STORE_NOTICE_FACT_3}\n`));

  try {
    markNoticeShown(projectRoot, LEGACY_SINGLE_STORE_NOTICE_ID);
  } catch (e) {
    // See the NON-BLOCKING note above. Said out loud rather than silently
    // dropped, so a user who sees the notice twice knows why.
    console.log(chalk.gray(
      `  (could not record that this notice was shown: ${e.message} — it may appear again)`));
  }
  return true;
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
        `  The project is left UNBOUND — fix the path above, then re-run\n` +
        `  \`${NAME} bind\` (or \`npx ${NAME} install\`) to write the binding.`
      )
    );
    return { outcome: LAYOUT_WRITE_FAILED_MKDIR, error: e };
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
        `_bmad-output/project-layout.yaml and run \`${NAME} bind\` to write a fresh binding\n` +
        `  (or re-run the installer, which does the same thing plus a full re-install).`
      )
    );
    return { outcome: LAYOUT_WRITE_REFUSED, reason: existing.reason, error: null };
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

  // ── STORY 31.7 AC3/AC4 — LEGACY PRESERVATION. NOTHING MOVED ⇒ NOTHING WRITTEN.
  //
  // THIS IS A FIX TO A STORY 31.2 IMPLEMENTATION DEFECT, NOT A RESOLUTION OF ANY
  // REQUIREMENTS CONFLICT. Stated precisely, because an in-source rationale that
  // mis-states a merged story's AC is exactly what 31.2's R-6 guard exists to
  // prevent.
  //
  // STORY 31.2 AC5 ALREADY FORBADE THIS REWRITE, in its own words: a pre-F26
  // `project-layout.yaml` is read as both stores pointing at that one location
  // "with no error AND NO REWRITE". 31.2 AC2 and 31.2 AC5 do not collide and
  // never did — AC2 removes the "both concerns are same-repo ⇒ do not write"
  // CONDITIONAL SCOPE branch; AC5 carves out the LEGACY case. They are
  // complementary halves of one story, written together.
  //
  // What shipped was AC5's read half only. `resolveProjectTopology` classifies a
  // legacy file correctly, but "no rewrite" was never implemented at all: this
  // function emits `schema_version: PROJECT_LAYOUT_SCHEMA_VERSION`
  // unconditionally, and AC2 makes it run on EVERY install and bind — so the
  // first `ma-agents install` over a pre-F26 project silently converted its
  // single `knowledgebase:` record into `system_requirements_store:` +
  // `software_requirements_store:`, with no question asked and no way back. Two
  // of 31.2's OWN round-trip tests pinned that behaviour as correct (one asserted
  // `schema_version: 2` after a write that moved nothing, with the message "the
  // write upgrades the schema"), which is how a green suite carried the defect
  // through an initial review and three fix rounds. Both were amended by this
  // story — see `test/project-layout-two-store-round-trip.test.js`.
  //
  // Filed, with the account of why those review rounds missed it, in
  // `_bmad-output/implementation-artifacts/bug-31-2-ac5-no-rewrite-half-was-never-implemented.md`.
  //
  // 31.7's own ACs are satisfied by the same branch and independently require it:
  // AC3 forbids any install, bind or skill activation rewriting a legacy layout
  // into two stores without an explicit user choice; AC4 requires that declining
  // the split leaves the project BYTE-IDENTICAL; and AC5 requires the notice not
  // to nag across "repeated installs on an un-split legacy project", which
  // presupposes a project can STILL BE legacy after an install. Under the shipped
  // behaviour it never could be — the first install always split it — so AC5 was
  // unsatisfiable and AC4's byte-identity was false on the very first run.
  //
  // The rule is deliberately narrow: it applies ONLY to a file that is already
  // legacy, and only when NOTHING WOULD MOVE. A schema v2 file is untouched by
  // this branch and keeps today's behaviour, including its refreshed `generated:`
  // date — so no Story 31.2/31.3/31.5 behaviour changes.
  //
  // WHAT "NOTHING WOULD MOVE" MEANS, and why it is not a hand-rolled comparison:
  // `canonicalBindingBytes` is Story 31.3's existing canonicalisation of exactly
  // the three location records, through the SAME serializers that write this
  // file. It already excludes `schema_version`, the `generated:` date, comments,
  // key order and line endings — the full list is in the stamp contract above,
  // and the `schema_version` exclusion is documented there as being for this very
  // case. Reusing it means "nothing moved" here is the same question, answered by
  // the same code, as "no drift" in Story 31.4. A private field-by-field compare
  // would be a second definition of store identity, free to disagree.
  //
  // Consequence, and it is the intended one: a legacy project that answers the
  // wizard with the SAME location for both stores is also left byte-identical,
  // because those answers canonicalise to the existing bytes. A user only leaves
  // the legacy layout by actually splitting the stores — which is what "migration
  // is offered, never performed" means in practice.
  if (existingTopology && existingTopology.schemaVersion < PROJECT_LAYOUT_SCHEMA_VERSION) {
    let unchanged = false;
    try {
      const candidate = {
        systemRequirementsStore: systemStore,
        softwareRequirementsStore: softwareStore,
        sprintManagement,
      };
      unchanged = canonicalBindingBytes(candidate, projectRoot)
        === canonicalBindingBytes(existingTopology, projectRoot);
    } catch {
      // A value one of the serializers refuses to write. NOT treated as
      // "unchanged" — that would silently swallow a real error and skip a write
      // the caller asked for. Fall through, so the same throw reaches the caller
      // from the real write below and is reported there, exactly as it is today.
      unchanged = false;
    }
    if (unchanged) {
      // Deliberately ONE terse line, and deliberately NOT a second copy of the
      // offer. This line prints on every install, in place of the
      // `Wrote _bmad-output/project-layout.yaml` line it substitutes for, so it
      // must stay a statement of what happened to the file. Repeating "run
      // `ma-agents config layout`" here would be the nagging AC5 forbids — the
      // offer is made once, by showLegacySingleStoreNoticeOnce, and that is the
      // only place it lives.
      console.log(chalk.gray(
        `  _bmad-output/project-layout.yaml left unchanged (legacy single-store layout, nothing moved)`
      ));
      return { outcome: LAYOUT_WRITE_UNCHANGED_LEGACY, error: null };
    }
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
        `  The project is left UNBOUND — fix the path above, then re-run\n` +
        `  \`${NAME} bind\` (or \`npx ${NAME} install\`) to write the binding.`
      )
    );
    return { outcome: LAYOUT_WRITE_FAILED_WRITE, error: e };
  }
  console.log(chalk.gray(`  Wrote _bmad-output/project-layout.yaml (system + software requirements stores, sprint management)`));
  return { outcome: LAYOUT_WRITE_WROTE, error: null };
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

/**
 * The repository-layout wizard.
 *
 * RETURN SHAPE (Story 31.5). Always `{knowledgebase, sprintManagement}` — the
 * legacy pair every pre-31.5 consumer reads. The INTERACTIVE branch additionally
 * returns `systemRequirementsStore` and `softwareRequirementsStore`, the two
 * independently-answered records, and `knowledgebase` is then a VIEW of the
 * software store (FR264). `writeProjectLayoutYaml` prefers the explicit pair
 * when present, so two divergent stores are written as answered.
 *
 * THE `--yes` BRANCH IS DELIBERATELY UNCHANGED, and does NOT emit the explicit
 * pair. AC9 requires `--yes` to default both stores to `file-system` / current
 * repository with no prompts, and P2-10 makes multi-repo interactive-only
 * configuration — so there is no second store to answer here, only one legacy
 * location (from `MA_KNOWLEDGEBASE_PATH`, from an existing binding, or the
 * default). What that ONE location means for TWO stores is already decided, once,
 * at the write choke point: FR264 applies it to the software store, and a
 * divergent system store is preserved verbatim. Re-deciding it here would be a
 * second definition of that rule, in the branch with the least observability —
 * which is how `install --yes` came to destroy a committed Confluence store in
 * the first place. Leaving this branch byte-for-byte as it was is also what makes
 * the NFR82 claim checkable: the non-interactive path is not merely believed
 * unchanged, it is unchanged.
 */
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

  // ── INTERACTIVE. Story 31.5: THREE concerns, not two. The two knowledge
  // stores are asked independently — each gets its own backend question and its
  // own location question, and neither answer is read while resolving the other
  // (AC2/FR257). The sprint-management question is byte-for-byte the one FR112
  // has always asked.
  const layout = {
    knowledgebase: null,
    systemRequirementsStore: null,
    softwareRequirementsStore: null,
    sprintManagement: null,
  };

  for (const concern of REPO_LAYOUT_CONCERNS) {
    const existingRecord = existingRecordForConcern(existingLayout, concern);

    if (concern.kind === 'sprint') {
      layout[concern.key] = await collectSprintManagementLocation(concern, existingRecord);
      continue;
    }

    // NON-DESTRUCTION, not a silent repoint. A project may already carry a
    // committed store on a backend this build's wizard cannot offer yet.
    // Asking anyway would offer only the backends that DO have a flow, and the
    // first Enter would replace a valid store with `file-system / same / "."` —
    // the exact destructive default that a wizard answer indistinguishable from
    // a real one already caused once in this epic. Preserve the record verbatim
    // and say so.
    //
    // Story 31.8: `confluence` now HAS a flow, so this block no longer fires for
    // any member of today's enum — every committed store is reconfigurable, and
    // `ma-agents config layout` over a Confluence project asks the real
    // questions instead of declining. That is proved from the other side: the
    // reconfiguration test in
    // `test/project-layout-confluence-configuration.test.js` asserts the wizard
    // ASKS (so this branch was not taken) and that accepting every
    // pre-population rewrites the committed file byte-identically (so agency is
    // preserved without an extra "keep it unchanged" question, which would have
    // meant a non-enum value in a closed-enum prompt — the shape the readiness
    // review already rejected for the configuration-pending state).
    //
    // The guard is KEPT rather than deleted: it is the contract that makes
    // `collect: null` a safe way to carry a future backend in the enum ahead of
    // its flow, and deleting it would make the next such member destructive on
    // the first Enter.
    const existingBackend = existingRecord ? backendOfStore(existingRecord) : null;
    if (existingBackend && !offerableStoreBackends().includes(existingBackend)) {
      console.log(chalk.yellow(
        `  Your ${concern.label} is ${existingBackend}-backed. This installer cannot yet\n` +
        `  reconfigure a ${existingBackend} store, so it has been left UNCHANGED:\n` +
        `    ${summarizeStoreIdentity(existingRecord)}\n` +
        `  To change it, edit _bmad-output/project-layout.yaml.`
      ));
      layout[concern.key] = existingRecord;
      continue;
    }

    // AC3 — the BACKEND first, then that backend's location. Choices are derived
    // from STORE_BACKEND_WIZARD, so no value outside the closed enum can be
    // offered and a member with no wizard flow is not offered at all (AC5).
    //
    // MUTANT M22 IS NO LONGER EQUIVALENT — Story 31.8 made `confluence`
    // offerable, so `offerableStoreBackends()` now returns TWO members and the
    // pre-selection below is load-bearing. Replacing it with the literal `0`
    // pre-selects `file-system` for a project whose committed store is
    // Confluence, and one Enter repoints it — B-1 all over again. The covering
    // test is `test/project-layout-confluence-configuration.test.js`, section
    // "M22", which pins that an existing confluence store pre-selects the
    // confluence CHOICE (asserted by value through `choices[initial]`, not by
    // index, so a reordering of the enum cannot make the assertion pass for the
    // wrong backend) and that accepting the pre-selection leaves the committed
    // record byte-identical.
    const backendChoices = backendChoicesForStore();
    const initialBackend = existingBackend
      ? backendChoices.findIndex((c) => c.value === existingBackend)
      : 0;
    const { backend } = await prompts({
      type: 'select',
      name: 'backend',
      // AC7 — the store's contents, stated in the question itself.
      message: `Which backend holds your ${concern.label} — ${concern.contents}?`,
      choices: backendChoices,
      initial: initialBackend >= 0 ? initialBackend : 0,
    });

    if (!backend) process.exit(0);

    const entry = STORE_BACKEND_WIZARD[backend];
    if (!entry || typeof entry.collect !== 'function') {
      // Unreachable while the choices come from the table (the value came OUT of
      // it), and deliberately a throw rather than a fallback to the file-system
      // flow: recording a file-system store for a backend the user chose is the
      // silent-repoint defect one layer in.
      throw new Error(
        `No wizard flow for knowledge-store backend ${describeValue(backend)} — ` +
        `STORE_BACKEND_WIZARD must name every member of STORE_BACKENDS ` +
        `(${legalBackendsForMessage()}). Refusing to guess a location shape.`
      );
    }

    // The ANSWERED backend is passed to the flow, so the record it returns names
    // the backend it was chosen for rather than re-deriving one.
    layout[concern.key] = await entry.collect(concern, existingRecord, backend);
  }

  // FR264 / P5-9.2 — the legacy single-valued view resolves to the SOFTWARE
  // requirements store. Every pre-31.5 consumer of this function's return value
  // (`generateRepoLayoutSection`, `writeRepoLayoutConfig`, and
  // `writeProjectLayoutYaml`'s legacy branch) reads `knowledgebase`, so it stays
  // — as a VIEW of a store that was independently answered, never as a third
  // source of truth. `writeProjectLayoutYaml` prefers the two explicit records
  // above it, so the view is never what decides what is written.
  layout.knowledgebase = layout.softwareRequirementsStore;

  // Today's advisory, unchanged in wording and still keyed on the legacy pair
  // (software store vs sprint management). Guarded on the backend because a
  // non-file-system store has neither `mode` nor `path`, and `undefined ===
  // undefined` would otherwise make two unconfigured fields read as "the same
  // external repository".
  const software = layout.softwareRequirementsStore;
  const sprint = layout.sprintManagement;
  if (backendOfStore(software) === DEFAULT_STORE_BACKEND
      && software.mode !== 'same' && sprint.mode !== 'same'
      && software.path === sprint.path) {
    console.log(chalk.cyan('  Both concerns point to same external repository'));
  }

  return layout;
}

/**
 * Which already-committed record pre-populates this concern's questions.
 *
 * The full three-record `topology` is preferred when `readExistingLayout()`
 * supplied one, so a project whose two stores DIVERGE pre-populates each question
 * from its OWN store rather than from the collapsed legacy view — which would
 * show the software store's location as the system store's answer.
 *
 * The fallback is the legacy single `knowledgebase` value, which is what every
 * project created before Story 31.5 has: one answered location standing for both
 * stores. That is the same collapse `topologyFromLegacyLayout` applies, and it is
 * exact while the two stores agree.
 */
function existingRecordForConcern(existingLayout, concern) {
  if (!existingLayout) return null;
  const topology = existingLayout.topology || null;
  if (topology && topology[concern.key]) return topology[concern.key];
  if (concern.kind === 'sprint') return existingLayout.sprintManagement || null;
  return existingLayout.knowledgebase || null;
}

/**
 * The `file-system` backend's location flow (AC4). The FR113–FR116 semantics are
 * REUSED, not reimplemented: the mode choices come from `modeChoicesFor` (so the
 * store concerns offer STORE_MODES and never `jira`), and the local-path and
 * remote-clone flows are the existing `collectLocalPath` / `collectRemotePath`,
 * with their existing-directory confirmation, path validation and clone
 * behaviour, called once per store with that store's label.
 *
 * `backend` is stated explicitly on the returned record. It is redundant on the
 * write half — `serializeFileSystemStore` emits `backend: file-system`
 * unconditionally, so the committed bytes are identical either way (NFR82) — but
 * a record that names its own backend cannot be mistaken for one whose backend
 * was never asked about.
 */
async function collectFileSystemStoreLocation(concern, existingRecord, backend) {
  // Story 31.5 fix round. `backend` is the ANSWERED backend, threaded in
  // from the question, not a fourth spelling of the default. Writing
  // DEFAULT_STORE_BACKEND into the record was correct only by coincidence — the
  // table happens to wire this flow to the `file-system` key — and would have
  // recorded a backend the user did not choose the moment a second key shared
  // the flow. Fail loud rather than defaulting: a `backend`-less record is
  // exactly the "never asked about" shape stating it explicitly exists to rule out.
  if (!backend) {
    throw new Error(
      `collectFileSystemStoreLocation was called with no answered backend for ` +
      `${concern.label}. A location flow must record the backend it was chosen FOR; ` +
      `refusing to substitute ${describeValue(DEFAULT_STORE_BACKEND)}.`
    );
  }
  // MUTANT M21 — `modeChoicesFor(concern.key)` replaced by a constant.
  //
  // Story 31.8 was expected to resolve this and DID NOT, so the status is
  // recorded honestly rather than quietly closed. `modeChoicesFor` partitions
  // its argument exactly once — `'sprintManagement'` versus everything else — and
  // Story 31.8 deliberately gave `confluence` NO mode set (a confluence store has
  // no `mode` at all; its identity is a space plus a root page, and it never
  // reaches this function). So:
  //
  //   - substituting either STORE concern's key here remains EQUIVALENT, and no
  //     test can distinguish it, because both map to STORE_MODES. This is a
  //     property of `modeChoicesFor`'s partition, not a gap in coverage, and it
  //     will stay equivalent until some store concern is offered a different
  //     mode set;
  //   - substituting `'sprintManagement'` is NOT equivalent — it would silently
  //     add `jira` to a knowledge store's mode choices — and IS covered, on BOTH
  //     store concerns, by `test/project-layout-confluence-configuration.test.js`
  //     section "M21" and by project-layout-enum-single-source.test.js.
  //
  // The reverse substitution in `collectSprintManagementLocation` (a store key
  // there would withdraw `jira`) is likewise pinned in
  // project-layout-enum-single-source.test.js.
  const modeChoices = modeChoicesFor(concern.key);
  const existingMode = existingRecord ? existingRecord.mode : null;
  const initialIndex = existingMode ? modeChoices.findIndex((c) => c.value === existingMode) : 0;

  const { mode } = await prompts({
    type: 'select',
    name: 'mode',
    message: `Where is your ${concern.label} managed?`,
    choices: modeChoices,
    initial: initialIndex >= 0 ? initialIndex : 0,
  });

  if (!mode) process.exit(0);

  if (mode === 'same') return { backend, mode: 'same', path: '.' };
  if (mode === 'local') return { backend, ...(await collectLocalPath(concern.label)) };
  if (mode === 'remote') return { backend, ...(await collectRemotePath(concern.label)) };

  // Unreachable: `mode` came out of `modeChoicesFor`, i.e. out of STORE_MODES.
  // Left as a throw rather than a `null` return, because returning null here is
  // what would put an unwritable record into the layout and surface as a
  // TypeError somewhere else entirely.
  throw new Error(
    `Unhandled knowledge-store mode ${describeValue(mode)} for ${concern.label} — ` +
    `expected one of ${[...STORE_MODES].join(', ')}.`
  );
}

// ─── Story 31.8 — the `confluence` backend's configuration flow ─────────────
//
// FR259 (which space) + FR260 (which root page, blank ⇒ generated and NAMED to
// the user). Two text questions and nothing else. In particular:
//
//   - NO credential question. Not a token, not a username, not a base URL that
//     could carry one, not a "stay signed in" flag. Authentication against
//     Confluence is entirely the MCP server's responsibility (NFR79, P5-9.6),
//     and ma-agents writes nothing about it to disk. The absence is the
//     requirement, so it is asserted as an absence — see
//     `test/project-layout-confluence-configuration.test.js`.
//   - NO reachability check. Collecting a space key and a page name is OFFLINE
//     configuration (NFR80): nothing here resolves a host, opens a socket, or
//     shells out. Whether the space exists is a RUNTIME question, answered by
//     Story 31.9's MCP routing; whether the root page exists is Story 31.10's,
//     which creates it. An install must not require network access.
//   - NO local mirror, cache or sync of any kind. FR266 is retired at P5-9.6.

/**
 * The name a blank root-page answer resolves to: `{project_name}` (AC3).
 *
 * TWO sources, in this order, and the second is not a permissive degradation of
 * the first — it is the SAME RULE, applied one layer earlier:
 *
 *   1. `project_name` from `_bmad/bmm/config.yaml`, read through
 *      `bmad.readCanonicalBmadConfig` (the only sanctioned read path for
 *      BMAD-canonical values in this codebase, so this is not a second spelling
 *      of where that value lives). This is literally the `{project_name}` the
 *      acceptance criteria and Story 31.10 name.
 *   2. The basename of the project root. On a FRESH install this wizard runs at
 *      install Step 3.3, ABOVE the BMAD install at Step 3.5, so config.yaml does
 *      not exist yet and source 1 is simply not available. Basename is what
 *      bmad-method itself seeds `project_name` with
 *      (`node_modules/bmad-method/tools/installer/ui.js` —
 *      `project_name: path.basename(directory)`), so the two sources agree by
 *      construction on every project whose `project_name` has not been hand-edited.
 *
 * Returns `null` — never `''` and never a fabricated placeholder — when neither
 * source yields a name (a project root with no basename, e.g. a filesystem
 * root). The caller then REQUIRES an explicit answer rather than silently
 * generating a page named after nothing, which is precisely the "user is left
 * guessing where the artifacts went" failure AC3 exists to prevent.
 */
function generatedRootPageTitle(projectRoot) {
  const root = path.resolve(projectRoot || process.cwd());
  let declared = '';
  try {
    const config = bmad.readCanonicalBmadConfig(root);
    if (config && typeof config.project_name === 'string') declared = config.project_name.trim();
  } catch (e) {
    // An unreadable/odd config.yaml is not a reason to abort configuration; the
    // basename below is a complete answer on its own. Nothing is guessed here —
    // the fallback is a DIFFERENT source, not a relaxed reading of this one.
    declared = '';
  }
  if (declared) return declared;
  const base = path.basename(root).trim();
  return base || null;
}

/**
 * The prompt-time half of the identity policy — the SAME policy the serializer
 * enforces, called through the same function (`assertSingleLineIdentity`) rather
 * than restated here. A second spelling of "what is a legal Confluence identity"
 * is the read/write-disagreement shape this epic has already fixed three times.
 *
 * Returns `true` or a message, which is the contract `prompts` expects. Telling
 * the user at the moment they type is strictly better than throwing at write
 * time, but it is the SAME rule, so a value that passes here cannot be one the
 * writer refuses (and vice versa).
 */
function validateConfluenceIdentity(value, fieldName, opts) {
  const required = !!(opts && opts.required);
  const s = value == null ? '' : String(value);
  if (!s.trim()) {
    if (!required) return true;
    return fieldName === 'space_key'
      ? 'A Confluence space key is required — this store has no location without one.'
      : 'A root page name is required here: this project has no name to generate one from.';
  }
  try {
    assertSingleLineIdentity(s, fieldName);
  } catch (e) {
    return e.message;
  }
  return true;
}

/**
 * AC1–AC3. Asks the space (FR259), then the root page (FR260), and returns the
 * `{backend, spaceKey, rootPage:{title, id}}` record Story 31.2's schema sealed.
 *
 * OQ-4 (root-page identity: human-readable title vs opaque page id) resolves to
 * TITLE AT CONFIGURATION TIME, `id: null`. Not a preference — AC7 forces it:
 * turning a title into a page id requires asking Confluence, and this story must
 * complete with no network access. Story 31.2's schema reserves BOTH fields, so
 * this populates the reserved object without reopening it, and Story 31.10 — the
 * layer that actually talks to the MCP — is where an `id` can be learned and
 * filled in.
 *
 * CONSEQUENCE, handled here: on RECONFIGURATION a previously-learned `id` is
 * carried forward ONLY while the title is unchanged. Change the title and the id
 * is dropped, because a `{title, id}` pair naming two different pages is worse
 * than a pair with one field — it is a record that looks resolved and points
 * somewhere the user did not choose.
 */
async function collectConfluenceStoreLocation(concern, existingRecord, backend) {
  // Same fail-loud contract as the file-system flow: a location flow records the
  // backend it was chosen FOR. Substituting a default here would record a
  // backend the user did not answer.
  if (!backend) {
    throw new Error(
      `collectConfluenceStoreLocation was called with no answered backend for ` +
      `${concern.label}. A location flow must record the backend it was chosen FOR; ` +
      `refusing to substitute ${describeValue(DEFAULT_STORE_BACKEND)}.`
    );
  }

  // Pre-population comes from the existing record ONLY when that record is
  // itself a confluence store. A file-system record has no space key, and
  // reading `.spaceKey` off it would pre-fill `undefined`.
  const existing = (existingRecord && backendOfStore(existingRecord) === 'confluence')
    ? existingRecord : null;
  const existingRootPage = (existing && existing.rootPage) || {};

  // AC1 / FR259.
  const spaceAnswer = await prompts({
    type: 'text',
    name: 'spaceKey',
    message: `Which Confluence space holds your ${concern.label}?`,
    initial: (existing && existing.spaceKey) || '',
    validate: (value) => validateConfluenceIdentity(value, 'space_key', { required: true }),
  });
  // `undefined` is a CANCELLED prompt; `''` is a real (rejected) answer. The
  // select-based flows can use `if (!x)` for both because no legal choice is
  // falsy; a free-text answer cannot, and collapsing the two would turn an empty
  // string into a silent `process.exit(0)` mid-install.
  if (spaceAnswer.spaceKey === undefined) process.exit(0);
  const spaceKey = String(spaceAnswer.spaceKey).trim();
  if (!spaceKey) {
    // Unreachable interactively — `validate` above refuses to submit a blank
    // answer. Kept as a throw rather than a fallback because the fallback shape
    // ("record it anyway, empty") is a store that resolves nowhere, which is the
    // permissive degradation P5-9 exists to prevent.
    throw new Error(
      `No Confluence space was given for ${concern.label}. A confluence store's space key ` +
      `is its location; refusing to record a store with none.`
    );
  }

  // AC2 / FR260, and AC3's generated name — computed BEFORE the question so the
  // question can NAME it. "Leave it blank and something will be generated" is
  // the shape that leaves a user guessing; naming it up front and again after
  // the answer is what AC3 asks for.
  const generated = generatedRootPageTitle(process.cwd());
  const existingTitle = String(existingRootPage.title || '').trim();
  const rootAnswer = await prompts({
    type: 'text',
    name: 'rootPageTitle',
    message: `Which Confluence page should your ${concern.label} artifacts be created under?`
      + (generated ? ` (leave blank to use a page named "${generated}", after your project)` : ''),
    initial: existingTitle,
    validate: (value) => validateConfluenceIdentity(value, 'root_page.title', { required: !generated }),
  });
  if (rootAnswer.rootPageTitle === undefined) process.exit(0);
  const answeredTitle = String(rootAnswer.rootPageTitle == null ? '' : rootAnswer.rootPageTitle).trim();

  let title;
  if (answeredTitle) {
    title = answeredTitle;
  } else {
    if (!generated) {
      // Unreachable interactively (validate makes the answer required in exactly
      // this case). Fail loud rather than write `title: null` and leave 31.10 to
      // invent a name at the moment it can no longer ask.
      throw new Error(
        `No root page was given for ${concern.label}, and no project name could be derived ` +
        `to generate one from. Re-run and name the page explicitly.`
      );
    }
    title = generated;
    // AC3 — the user is TOLD the name, in the same words the record now carries,
    // so the announcement and the committed file cannot disagree. The creation
    // itself is Story 31.10's MCP write, so this says "will be created", not
    // "was created".
    console.log(chalk.cyan(
      `  No root page given for your ${concern.label}. ma-agents will use a page named\n` +
      `  "${title}" (named after your project) in the "${spaceKey}" space, and create it\n` +
      `  there the first time artifacts are published.`
    ));
  }

  // The id survives only while it still identifies the answered page — see the
  // OQ-4 note above.
  const carriedId = String(existingRootPage.id || '').trim();
  const id = (carriedId && existingTitle && existingTitle === title) ? carriedId : null;

  return { backend, spaceKey, rootPage: { title, id } };
}

/**
 * FR112's sprint-management question, unchanged (AC1). Extracted from the old
 * two-concern loop verbatim — same message, same choice list (SPRINT_MODES, so
 * `jira` is still offered), same pre-selection, same four branches.
 */
async function collectSprintManagementLocation(concern, existingRecord) {
  const modeChoices = modeChoicesFor(concern.key);
  const existingMode = existingRecord ? existingRecord.mode : null;
  const initialIndex = existingMode ? modeChoices.findIndex((c) => c.value === existingMode) : 0;

  const { mode } = await prompts({
    type: 'select',
    name: 'mode',
    message: `Where is your ${concern.label} managed?`,
    choices: modeChoices,
    initial: initialIndex >= 0 ? initialIndex : 0,
  });

  if (!mode) process.exit(0);

  if (mode === 'same') return { mode: 'same', path: '.' };
  if (mode === 'local') return await collectLocalPath(concern.label);
  if (mode === 'remote') return await collectRemotePath(concern.label);
  if (mode === 'jira') return await collectJiraConfig();

  throw new Error(
    `Unhandled sprint_management mode ${describeValue(mode)} — ` +
    `expected one of ${[...SPRINT_MODES].join(', ')}.`
  );
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

/**
 * Story 31.12 AC5/AC6 (FR250 degradation path) — what a global install says
 * about BMAD.
 *
 * Story 31.1's spike returned a FAIL verdict against a live bmad-method@6.10.0:
 * there is no user-level install target and, decisively, no module-resolution
 * search order that could find one (`findBmadDir` is a single `path.join` with
 * no upward walk, `resolve_config.py` hard-fails on a missing project-local
 * `_bmad/`, ~211 `{project-root}/_bmad/…` literals across 46 skills, no
 * `BMAD_HOME` escape hatch, and `bmad install --global` errors as an unknown
 * option). Upstream `bmad-code-org/BMAD-METHOD#1728` would change that, but it
 * is OPEN and not in 6.10.0 — it is the watch trigger, not a shipped feature.
 *
 * So the filter below and the `installScope === 'project'` guard on the BMAD
 * integration block are CORRECT, not a defect to be lifted. What changes here is
 * only what the user is told. AC6 makes the tone testable: a global install with
 * project-scoped BMAD is a SUPPORTED CONFIGURATION, not a degraded one, so this
 * is not a warning and not an error. The superseded text said "Warning:",
 * "skipped", and "Run again without --global" — it framed a working mode as a
 * mistake to undo. It is therefore also no longer rendered through
 * `chalk.yellow`, this codebase's warning colour (readiness review F-12).
 *
 * AC5 fixes the CONTENT at exactly three facts, one per constant below:
 *   (i)   BMAD remains project-scoped;
 *   (ii)  the command that installs BMAD into a project;
 *   (iii) the knowledge-store configuration is unaffected.
 *
 * WORDING CONSTRAINT on fact (ii): `cd <project> && ma-agents install` reaches
 * the BMAD install only when BOTH an IDE-category agent is selected (the
 * `bmadTools.length > 0` guard, built from `category === 'ide'`) AND the user
 * accepts the "BMAD-METHOD not detected. Would you like to install it?" confirm.
 * Declining leaves BMAD uninstalled. The text therefore says the installer
 * *offers* — it must never imply one invocation guarantees a BMAD install.
 *
 * Pinned by test/global-install-scope.test.js ("AC5/AC6" section), which asserts
 * the three facts AND the absence of the alarming framing, against the output of
 * a real `install --yes --global` run.
 */
const GLOBAL_BMAD_SCOPE_NOTICE_FACT_1 =
  '  Note: BMAD-METHOD is installed per project rather than globally, so these BMAD agents are not part of a global install:';

const GLOBAL_BMAD_SCOPE_NOTICE_FACT_2 =
  "  To set BMAD up in a project, run `ma-agents install` from that project's root with an IDE\n" +
  '  agent selected; the installer then offers to install BMAD-METHOD into that project.';

const GLOBAL_BMAD_SCOPE_NOTICE_FACT_3 =
  '  Your knowledge-store configuration is unaffected: each project records its own knowledgebase\n' +
  '  and sprint bindings in its own _bmad-output/project-layout.yaml.';

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

  // Resolution of the profile stays here, unchanged, after agent selection. Its
  // PERSISTENCE moved down to Step 3.2, below the scope question — see the note
  // there (FR251 / Story 31.11 AC3).

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

  // Step 3.2: Persist the profile resolved at Step 2.4 (Story 21.1 AC #9 —
  // "before any agent install step", which this still is: Step 5 is the install
  // and Step 3.5's BMAD integration, the only other profile reader, is below).
  //
  // FR251 / Story 31.11 AC3 — the persist target is `process.cwd()`, i.e. THE
  // PROJECT ROOT. A global install has no project in scope, so writing
  // `.ma-agents.json` there was project-scoped work done on behalf of an install
  // that will never read it back: every consumer of the persisted profile
  // (`updateAgentInstructions` / `stampExtraInstructionTemplates` in
  // lib/installer.js, and lib/bmad.js) sits behind a `scope === 'project'` gate,
  // so under global scope the file was written, never read, and left behind in a
  // directory the user only happened to be standing in. It is now written under
  // the same predicate as every other project-scoped step.
  if (installScope === 'project') {
    setProfile(projectRootForProfile, resolvedProfile);
  }

  // Step 3.3: Repository layout — read the committed binding UNCONDITIONALLY.
  //
  // FR251 / Story 31.11 AC3 — ORDERING. This was Step 2.5, ABOVE the scope
  // question, so `collectRepoLayout` asked "Where is your knowledgebase
  // managed?" and "Where is your sprint management managed?" before anything
  // knew whether a project was in scope at all. A global install therefore
  // prompted for knowledge-store locations it then threw away — and with
  // MA_KNOWLEDGEBASE_GIT_URL set it went further and CLONED a repository
  // (`ciCloneIfNeeded`), i.e. reached the network, on an install that has no
  // project (NFR77).
  //
  // The collection now runs BELOW the scope question, under the SAME predicate
  // as all three of its consumers (`installScope === 'project'` at Step 3.6,
  // at the `.agents/skills` reconcile, and at the Step 6 project-context
  // update). One predicate, four sites: a global install collects nothing,
  // prompts nothing, clones nothing, and writes nothing under any project root.
  //
  // What did NOT move: the scope QUESTION itself (AC1) — its guard, its three
  // choices and its wording are byte-identical to before this story, and `git
  // diff` shows them as context, not as a change. THIS block moved down past it.
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
  //
  // NOTE the split below. `readExistingLayout()` stays UNCONDITIONAL — that is
  // B-1's fix above and it is deliberately not weakened by anything in Story
  // 31.11. It is a pure read: it writes nothing, prompts nothing, and therefore
  // cannot violate FR251 whatever the scope. The FR251 surface is
  // `collectRepoLayout`, which PROMPTS ("Where is your knowledgebase managed?" /
  // "Where is your sprint management managed?") and, with MA_KNOWLEDGEBASE_GIT_URL
  // set, CLONES (`ciCloneIfNeeded`) — knowledge-store prompting and network
  // access on an install that has no project. Only that call is gated.
  const existingLayout = readExistingLayout();
  let repoLayout = null;
  if (installScope === 'project') {
    repoLayout = await collectRepoLayout({ yes: yesFlag }, existingLayout);
  }

  // Step 3.4: BMAD agents are project-scoped, so a global install does not carry
  // them. Story 31.12 (FR250 degradation path) KEEPS this filter — under the
  // Story 31.1 FAIL verdict it is the correct behaviour — and changes only what
  // the user is told about it. See GLOBAL_BMAD_SCOPE_NOTICE_FACT_1..3 above.
  if (installScope === 'global') {
    const bmadAgentIds = selectedAgentIds.filter(id => {
      const agent = agents.find(a => a.id === id);
      return agent && agent.category === 'bmad';
    });
    if (bmadAgentIds.length > 0) {
      console.log(chalk.cyan(`\n${GLOBAL_BMAD_SCOPE_NOTICE_FACT_1}`));
      console.log(chalk.cyan(`    ${bmadAgentIds.join(', ')}`));
      console.log(chalk.gray(GLOBAL_BMAD_SCOPE_NOTICE_FACT_2));
      console.log(chalk.gray(GLOBAL_BMAD_SCOPE_NOTICE_FACT_3));
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

  // Step 3.6: Write the committed binding, then GENERATE the per-machine config
  // from it (after BMAD install creates config.yaml).
  //
  // FR251 / Story 31.11: BOTH writes stay inside this one `installScope ===
  // 'project'` gate. They are project-scoped work, and a global install must
  // perform none of it. Do not add a second, ungated call site.
  if (installScope === 'project') {
    // Story 31.3 AC1/AC2 — ORDER IS LOAD-BEARING, and it is the reverse of what
    // it was. `config.yaml` is now GENERATED FROM `project-layout.yaml`, so the
    // authoritative file must exist and be current before the derived one is
    // produced. Generating first would have derived this install's config from
    // the PREVIOUS install's binding — off by one run, and invisible.
    //
    // The order also carries the divergence case: when the two committed stores
    // point at different places and the wizard supplied only the single legacy
    // answer, `writeProjectLayoutYaml` applies it to the software store and
    // PRESERVES the system store (FR264). Generating afterwards means
    // `config.yaml` reflects the preserved system store rather than the
    // collapsed answer.
    //
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
        `  The project is left UNBOUND - correct the above, then run\n` +
        `  \`${NAME} bind\` to write the binding without a full re-install.`
      ));
    }
    // `fallbackLayout` covers only the case where the binding could not be
    // written at all (the warning above fired), so the install still leaves a
    // usable config. When the binding exists it wins outright — see
    // generateBmmConfig.
    generateBmmConfig({ projectRoot: process.cwd(), fallbackLayout: repoLayout });

    // Story 31.7 (FR265) AC2/AC5 — tell the user, ONCE and non-blockingly, that
    // this project is on the legacy single-store layout and name the command
    // that splits it. No-op on a two-store project, on an unbound one, on a
    // binding this build refuses to read, and on every run after the first.
    //
    // AFTER the two writes above, deliberately: the notice describes the state
    // the install LEAVES the project in, and under the legacy-preservation branch
    // in `writeProjectLayoutYaml` that state is still legacy. Printing before
    // would risk describing a layout the install was about to change.
    //
    // Inside the `installScope === 'project'` gate for the same FR251 reason the
    // Demerzel notice is (Story 31.11 AC3): the shown-once flag is per-project
    // state in the project-root `.ma-agents.json`, and a global install has no
    // project to stamp it into.
    showLegacySingleStoreNoticeOnce(process.cwd());
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
  //
  // FR251 / Story 31.11 AC3 — "for this project" is the operative phrase: the
  // shown-once flag is persisted into the PROJECT ROOT `.ma-agents.json`
  // (`lib/profile.js#markNoticeShown`). A global install has no project, so it
  // must not stamp a per-project flag into whatever directory the user happened
  // to run from. Deliberately accepted: a user who ONLY ever installs globally
  // does not see this notice until they install into a project, at which point
  // it prints — once — against the project it actually concerns.
  if (installScope === 'project') {
    try {
      showDemerzelDeprecationNoticeOnce(process.cwd());
    } catch (err) {
      console.log(chalk.yellow(`\n Deprecation notice skipped: ${err.message}`));
    }
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
  // FR251 / Story 31.11 AC3 — same gate as the wizard's Step 3.2. `scope` here
  // comes straight from `parseFlags` (`--global` → 'global'), so it is already
  // known at this point and no reordering is needed on this path. A direct
  // `ma-agents install <skill> <agent> --global` must not stamp
  // `.ma-agents.json` into whatever directory it was run from either.
  if (scope === 'project') {
    setProfile(projectRootForProfile, resolvedProfile);
  }

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
  // FR251 / Story 31.11 AC3 — project-scoped, for the reason given at the
  // wizard's copy of this block: the shown-once flag lands in the project-root
  // `.ma-agents.json`.
  if (scope === 'project') {
    try {
      showDemerzelDeprecationNoticeOnce(process.cwd());
    } catch (err) {
      console.log(chalk.yellow(`\n Deprecation notice skipped: ${err.message}`));
    }
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

  // Write the committed binding FIRST, then regenerate the derived config from
  // it — same order, and for the same reason, as Step 3.6 of the installer
  // (Story 31.3 AC1/AC2: config.yaml is generated from project-layout.yaml, so
  // the authoritative file must be current before the derived one is produced).
  try {
    writeProjectLayoutYaml(newLayout);
  } catch (e) {
    console.log(chalk.yellow(
      `  Warning: could not write _bmad-output/project-layout.yaml: ${e.message}\n` +
      `  The binding was left unchanged.`
    ));
  }
  generateBmmConfig({ projectRoot: process.cwd(), fallbackLayout: newLayout });

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

// ═══════════════════════════════════════════════════════════════════════════
// Story 31.13 — `ma-agents bind` (FR252) and scope reporting in `status` (FR253)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * AC3's decision procedure, as a PURE function.
 *
 * Separated from the prompting so "the offer never runs bind without the user's
 * choice" is provable rather than promised: this function decides WHETHER to
 * offer and writes nothing, and `offerBind` below is the only thing that can
 * run bind — and only on an explicit affirmative answer.
 *
 * KEYED ON `resolveProjectTopology` FIRST (the Story 31.3/31.4 contract). The
 * three outcomes are deliberately distinct, because `absent` and `malformed` are
 * NOT interchangeable:
 *   - `unbound`  → OFFER. This is AC3's case: no committed binding at all.
 *   - `ok`       → do not offer. The project is bound; there is nothing to bind.
 *   - anything else (`unreadable` / `invalid` / `too-new`) → do NOT offer, and
 *     say why. A binding this build cannot read is a DIFFERENT FACT from a
 *     project that has none (Story 31.4's default-deny rule), and offering to
 *     write a fresh binding over it is the destructive-overwrite shape Story
 *     31.2's guard exists to refuse. Bind itself refuses the same way.
 *
 * @returns {{offer: boolean, reason: string, message: string}}
 */
function bindOfferDecision(projectRoot) {
  const binding = resolveProjectTopology(projectRoot);
  if (binding.ok) {
    return {
      offer: false,
      reason: 'already-bound',
      message: 'This project already has a committed knowledge binding.',
    };
  }
  if (binding.reason !== BINDING_UNBOUND) {
    return {
      offer: false,
      reason: binding.reason,
      message:
        `_bmad-output/project-layout.yaml is ${binding.reason}: ${binding.message}. ` +
        `This project IS bound — the binding just cannot be read — so binding it afresh ` +
        `would overwrite it. Fix it by hand, or delete it and run \`ma-agents bind\`.`,
    };
  }
  return {
    offer: true,
    reason: BINDING_UNBOUND,
    message:
      'This project has no _bmad-output/project-layout.yaml, so nothing states where its ' +
      'knowledge stores live.',
  };
}

/**
 * AC3 — the automatic offer, at the CLI. Asks; runs bind ONLY on an explicit yes.
 *
 * WHAT THIS IS AND IS NOT. The offer that reaches a globally-installed SKILL at
 * activation time is TEXT, and it lives in the Story 31.4 preflight embedded in
 * every shipped skill document (Step P2 — "Run `npx ma-agents install` … or
 * `ma-agents bind` …"). That block is the surface an agent actually loads when a
 * skill activates, which is why the offer belongs there and not in a file nothing
 * is directed to read. This story's contribution to that half is that the command
 * the text names NOW EXISTS. `test/project-layout-bind.test.js` pins both halves.
 *
 * This function is the EXECUTABLE half: the same decision, callable, so the
 * "never without the user's choice" property is a property of code rather than of
 * prose. `yes` is honoured as a REFUSAL to offer, not as an acceptance — a
 * non-interactive run has no user to choose, and auto-accepting would be exactly
 * the thing AC3 forbids.
 *
 * @returns {Promise<{ran: boolean, reason: string}>}
 */
async function offerBind({ projectRoot = process.cwd(), yes = false } = {}) {
  const decision = bindOfferDecision(projectRoot);
  if (!decision.offer) {
    return { ran: false, reason: decision.reason };
  }

  console.log(chalk.cyan(`\n  ${decision.message}`));

  if (yes) {
    // Non-interactive. State the remedy and STOP. Running bind here would be an
    // offer that accepted itself.
    console.log(chalk.gray('  Run `ma-agents bind` in this project to create one. Not doing it for you.'));
    return { ran: false, reason: 'declined-non-interactive' };
  }

  const { doBind } = await prompts({
    type: 'confirm',
    name: 'doBind',
    message: 'Bind this project now (answer the knowledge-store and sprint-management questions)?',
    initial: false,
  });

  if (doBind !== true) {
    console.log(chalk.gray('  Not bound. Run `ma-agents bind` whenever you are ready.'));
    return { ran: false, reason: 'declined' };
  }

  // N3 - THE ROOT THE OFFER DECIDED ON MUST BE THE ROOT THAT GETS BOUND.
  //
  // `bindOfferDecision` above keys on `projectRoot`; `handleBind` re-derives its
  // own root from `process.cwd()`, and so do `writeProjectLayoutYaml`,
  // `readExistingLayout` and `collectRepoLayout`. Plumbing `projectRoot` through
  // would therefore fix one of four and leave the write itself pointed at the cwd
  // - worse than the disagreement it set out to remove. So the agreement is
  // CHECKED rather than assumed: deciding to offer for one project and then
  // binding a different one is a silent wrong-project bind, and until the fix
  // above it would have reported `Bound.` and exited 0 while doing it.
  //
  // Unreachable from today's only caller (`status` passes `process.cwd()`). It is
  // pinned by a test so that a second caller cannot reintroduce it quietly - a
  // latent trap with a failing-if-touched test is a decision, not a trap.
  const cwd = process.cwd();
  if (path.resolve(projectRoot) !== path.resolve(cwd)) {
    console.log(chalk.red(
      `  Not binding: this offer was decided for\n` +
      `    ${projectRoot}\n` +
      `  but \`${NAME} bind\` would bind\n` +
      `    ${cwd}\n` +
      `  Run \`${NAME} bind\` from inside the project you mean.`
    ));
    return { ran: false, reason: 'project-root-mismatch' };
  }

  const result = await handleBind([]);
  return { ran: true, reason: 'accepted', result };
}

/**
 * `ma-agents bind` — write a project's committed binding WITHOUT installing
 * anything (FR252).
 *
 * AC1: collects exactly the three project-scoped answers, and no others, by
 * calling `collectRepoLayout` — Story 31.5's and 31.8's collection flow itself,
 * not a copy of it. The three questions ARE `REPO_LAYOUT_CONCERNS`; a second copy
 * of the store questions living here is the defect this story is most likely to
 * introduce, so there is deliberately no question text in this function at all.
 *
 * AC2: installs nothing. Nothing below touches `installSkill`, any agent skills
 * directory, or the BMAD installer. The only thing written under `_bmad/` is the
 * generated `config.yaml`, which P5-9.3 requires to fire on bind.
 *
 * AC4/NFR78: on an already-bound project this REPORTS the bindings and changes
 * nothing unless the user explicitly says they want to edit an answer.
 *
 * AC6: regenerates `config.yaml` from the layout, and touches neither
 * `_bmad/config.user.toml` nor `_bmad/custom/config.user.toml` (P5-9.4) — it
 * calls `generateBmmConfig`, whose only write target is `_bmad/bmm/config.yaml`.
 */
async function handleBind(args = []) {
  const { yesFlag } = parseFlags(args);
  const projectRoot = process.cwd();

  console.log(chalk.bold.cyan(`\n  ${NAME} bind — project knowledge binding\n`));

  // ── Step 1. The Story 31.3 rule: key on `resolveProjectTopology` FIRST.
  const binding = resolveProjectTopology(projectRoot);

  if (!binding.ok && binding.reason !== BINDING_UNBOUND) {
    // NOT a bind. The same refusal `writeProjectLayoutYaml` would make, made
    // BEFORE any question is asked, so the user is not walked through three
    // prompts whose answers will then be thrown away.
    console.log(chalk.red(
      `  Refusing to bind — the existing binding in _bmad-output/project-layout.yaml is ` +
      `${binding.reason}:\n` +
      `    ${binding.message}\n` +
      `  The file has been left UNCHANGED. Fix it by hand, or delete ` +
      `_bmad-output/project-layout.yaml\n` +
      `  and run \`${NAME} bind\` again to write a fresh binding.`
    ));
    process.exitCode = 1;
    return { bound: false, reason: binding.reason };
  }

  // ── Step 2. AC4 — an already-bound project REPORTS and changes nothing unless
  // the user explicitly asks to edit an answer.
  let editAnswers = true;
  if (binding.ok) {
    console.log(chalk.white('  This project is already bound. Its committed bindings are:'));
    showCurrentLayout();

    if (yesFlag) {
      // Non-interactive: there is no user to say "edit". Explicitly NOT an
      // implicit yes — the default on the interactive prompt below is also `no`,
      // so both paths agree.
      editAnswers = false;
    } else {
      const { edit } = await prompts({
        type: 'confirm',
        name: 'edit',
        message: 'Change any of these answers?',
        initial: false,
      });
      editAnswers = edit === true;
    }

    if (!editAnswers) {
      console.log(chalk.gray('  Bindings left unchanged — no answer was edited.'));
    }
  }

  // ── Step 3. Collect, but ONLY when there is something to collect.
  //
  // AC4's "changes nothing" is enforced by NOT WRITING, not by writing the same
  // bytes and hoping they match. `writeProjectLayoutYaml` refreshes the
  // `generated:` date on every write, so a re-write is byte-identical only while
  // the two runs fall on the same calendar day — which is a coincidence, not a
  // guarantee, and is exactly the "prove the negative by byte-identity" trap this
  // epic keeps falling into. The committed binding is therefore not written at
  // all on a no-edit re-run.
  let layoutForContext = null;
  if (editAnswers) {
    const existingLayout = readExistingLayout();
    const newLayout = await collectRepoLayout({ yes: yesFlag }, existingLayout);

    // Same order as install Step 3.6 and `handleConfigLayout`: the authoritative
    // file first, the derived one after (Story 31.3 AC1/AC2).
    // THE FIX (Story 31.13 fix round, BLOCKING). `writeProjectLayoutYaml` now
    // returns a named outcome, so this function can finally tell "wrote it" from
    // "could not create the directory". Before it did, every exit of that callee
    // returned `undefined`, it SWALLOWED both I/O failures itself, and the catch
    // below was therefore DEAD CODE on exactly the paths it was written for.
    // Steps 4-6 and the `Bound.` line then ran unconditionally: a bind whose
    // authoritative write had failed printed `Bound.`, exited 0, generated a
    // `config.yaml` full of `.` defaults, and registered the project.
    //
    // The outcome is checked with `projectLayoutWriteIsBound`, which enumerates
    // the BOUND outcomes and denies everything else - so Story 31.7's
    // legacy-skip ("nothing moved", the project IS bound by the file already
    // there) stays a success, and a sixth outcome added later fails closed.
    let writeOutcome;
    try {
      writeOutcome = writeProjectLayoutYaml(newLayout);
    } catch (e) {
      // Still reachable, and no longer dead: the serializers throw DELIBERATELY
      // (the closed backend enum, the confluence identity guard). A throw is a
      // different fact from a returned failure, but it has the same consequence
      // - nothing reached disk - so it is mapped onto the same outcome.
      console.log(chalk.yellow(
        `  Warning: could not write _bmad-output/project-layout.yaml: ${e.message}`
      ));
      writeOutcome = { outcome: LAYOUT_WRITE_FAILED_WRITE, error: e };
    }

    if (!projectLayoutWriteIsBound(writeOutcome)) {
      // ABORT. Every step below this line acts on a binding that is not on disk.
      //
      // Generating `config.yaml` here is what produced a config with NO
      // `project-layout.yaml` behind it - precisely the drifted state Story
      // 31.4's guard exists to catch (verified: that guard HALTS on it with
      // `halt:binding-missing`) - while this command reported success. And
      // because `recordBoundProject` replaces an `unreadable` registry
      // WHOLESALE, registering a never-bound project could also discard the
      // records of every project that genuinely is bound.
      const why = (writeOutcome && writeOutcome.outcome) || 'unknown';
      console.log(chalk.red(
        `\n  NOT BOUND (${why}). _bmad-output/project-layout.yaml was not written, so\n` +
        `  nothing else was changed either: _bmad/bmm/config.yaml was NOT regenerated\n` +
        `  and this project was NOT recorded. Fix the cause reported above, then run\n` +
        `  \`${NAME} bind\` again.`
      ));
      process.exitCode = 1;
      return { bound: false, reason: why };
    }
    layoutForContext = newLayout;
  } else {
    layoutForContext = readExistingLayout();
  }

  // ── Step 4. AC6 — regenerate `config.yaml` from the binding.
  //
  // This runs on the no-edit path TOO, and that is load-bearing rather than
  // sloppy: Story 31.4's staleness HALT tells the user "Run `ma-agents bind` to
  // regenerate `_bmad/bmm/config.yaml` from the committed binding". A bind that
  // skipped generation whenever the binding was unchanged would leave that
  // instruction false in the one situation it is given in — a config that has
  // drifted from a binding nobody edited.
  //
  // It does not break AC4's byte-identity either: `generateBmmConfig` derives
  // every field from the committed binding and carries no timestamp, so
  // regenerating from an unchanged binding reproduces the same bytes (NFR81's
  // determinism). AC4 is proved on that basis, not on a promise that nothing ran.
  //
  // `fallbackLayout` is supplied for the unbound-and-unwritable case only; when a
  // committed binding exists it wins outright inside `generateBmmConfig`.
  generateBmmConfig({ projectRoot, fallbackLayout: layoutForContext });

  // ── Step 5. AC1/AC5 — project-context.md.
  //
  // AC5 is a hard NEVER-OVERWRITE, stronger than the installer's behaviour: the
  // installer updates an existing file's manifest paths in place, bind does not
  // touch it at all. "Left untouched" means untouched.
  const contextPath = path.join(projectRoot, '_bmad-output', 'project-context.md');
  if (fs.existsSync(contextPath)) {
    console.log(chalk.gray(
      '  _bmad-output/project-context.md already exists — left untouched, generation skipped.'
    ));
  } else {
    try {
      // Agents are DISCOVERED, never installed. `getStatus` reads the manifests
      // that are already on disk at both scopes; bind installs nothing (AC2).
      const installedAgents = getStatus([], '', 'all').map((e) => e.agent);
      const seen = new Set();
      const uniqueAgents = installedAgents.filter((a) => {
        if (!a || seen.has(a.id)) return false;
        seen.add(a.id);
        return true;
      });
      const content = await generateProjectContext(projectRoot, uniqueAgents, layoutForContext);
      fs.mkdirSync(path.join(projectRoot, '_bmad-output'), { recursive: true });
      fs.writeFileSync(contextPath, content, 'utf-8');
      console.log(chalk.gray('  Wrote _bmad-output/project-context.md'));
    } catch (e) {
      console.log(chalk.yellow(`  project-context.md generation skipped: ${e.message}`));
    }
  }

  // ── Step 6. AC8 — record this project in the PER-MACHINE registry.
  //
  // LAST, and non-fatally. The registry is a display cache for `status` and
  // nothing else reads it; a failure here must never turn a successful bind into
  // a failed one, and losing the file entirely costs `status` output and nothing
  // more. See the OQ-1 decision recorded in lib/bound-projects.js.
  const recorded = recordBoundProject(projectRoot);
  if (!recorded.ok) {
    console.log(chalk.gray(
      `  (could not update the per-machine bound-project record: ${recorded.message} — ` +
      `this affects \`${NAME} status\` output only)`
    ));
  }

  console.log(chalk.bold.green('\n  Bound.\n'));
  return { bound: true, reason: editAnswers ? 'written' : 'unchanged' };
}

/**
 * AC7 — which scope(s) ma-agents is actually installed at on this machine.
 *
 * Derived from WHERE a manifest with skills was found, not from what a manifest
 * says about itself: the path is a fact, a recorded field is a claim. (The claim
 * is separately kept honest — `ensureManifest` now back-fills `scope` on its
 * migrate branch, which it previously set only when creating a manifest.)
 *
 * @returns {{project: boolean, global: boolean, label: string}}
 */
function detectInstallScopes() {
  let project = false;
  let global = false;
  for (const entry of getStatus([], '', 'all')) {
    if (entry.scope === 'global') global = true;
    if (entry.scope === 'project') project = true;
  }
  let label;
  if (project && global) label = 'project + global';
  else if (global) label = 'global';
  else if (project) label = 'project';
  else label = 'none detected';
  return { project, global, label };
}

/**
 * AC7 — join the per-machine bound-project record against what is actually on
 * disk at each recorded root.
 *
 * The health of each entry is decided by `resolveProjectTopology` — the SAME
 * resolver every other consumer uses — so "readable" here means readable to the
 * thing that will actually read it, not to a private re-implementation. A project
 * that was bound and has since been moved or deleted therefore shows up as
 * `missing`/`unreadable` rather than being listed as healthy.
 *
 * @returns {Array<{root: string, boundAt: string, ok: boolean, state: string, detail: string}>}
 */
function describeBoundProjects() {
  const registry = readBoundProjects();
  if (!registry.ok) return [];
  return registry.projects.map((p) => {
    if (!fs.existsSync(p.root)) {
      return {
        root: p.root,
        boundAt: p.boundAt,
        ok: false,
        state: 'missing',
        detail: 'the project root no longer exists (moved or deleted)',
      };
    }
    const binding = resolveProjectTopology(p.root);
    if (binding.ok) {
      return {
        root: p.root,
        boundAt: p.boundAt,
        ok: true,
        state: 'bound',
        detail: 'readable _bmad-output/project-layout.yaml',
      };
    }
    return {
      root: p.root,
      boundAt: p.boundAt,
      ok: false,
      state: binding.reason,
      detail: binding.message,
    };
  });
}

/**
 * AC7's rendering. Split out from `showStatus` so the scope report can be
 * exercised without driving the whole skills listing.
 */
function printScopeReport(scopes) {
  console.log(chalk.bold(`\n  Install scope: ${scopes.label}`));

  if (!scopes.global) return;

  const registry = readBoundProjects();
  if (!registry.ok) {
    // AC8 — a lost or damaged registry is a DISPLAY degradation and says so. It
    // is never reported as a broken install, and the two reasons are not
    // conflated: "nothing has been bound on this machine" and "there is a record
    // here this build cannot read" are different facts.
    const line = registry.reason === 'absent'
      ? `  No projects recorded as bound on this machine (${registry.path}).`
      : `  The per-machine bound-project record could not be read: ${registry.message}`;
    console.log(chalk.gray(line));
    console.log(chalk.gray(
      '  This affects this listing only — every project still resolves its own binding\n' +
      '  from _bmad-output/project-layout.yaml at its root.'
    ));
    return;
  }

  const entries = describeBoundProjects();
  if (entries.length === 0) {
    console.log(chalk.gray(`  No projects recorded as bound on this machine (${registry.path}).`));
    return;
  }

  console.log(chalk.white('\n  Bound projects on this machine:'));
  for (const e of entries) {
    if (e.ok) {
      console.log(chalk.green(`    [bound]   ${e.root}`));
    } else {
      console.log(chalk.yellow(`    [${e.state}] ${e.root}`));
      console.log(chalk.gray(`              ${e.detail}`));
    }
  }
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
    await showStatus([]);
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
      await showStatus(args.slice(1));
      break;
    // Story 31.13 (FR252). Story 31.4's preflight — embedded in every shipped
    // skill document — instructs the user to run this command in five separate
    // HALT messages. Until this case existed, all five named a command that did
    // not dispatch.
    case 'bind':
      await handleBind(args.slice(1));
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
  // Story 31.13 fix round - the outcome of an authoritative write, as a value.
  // Exported for the same reason the BINDING_* reasons are: a test must branch on
  // the outcome BY NAME, so "skipped because the layout is legacy" and "failed to
  // write" can never be collapsed back into one. `projectLayoutWriteIsBound` is
  // exported so the bound/unbound partition is asserted against the SHIPPED
  // predicate rather than against a copy of it in a test.
  LAYOUT_WRITE_WROTE, LAYOUT_WRITE_UNCHANGED_LEGACY, LAYOUT_WRITE_REFUSED,
  LAYOUT_WRITE_FAILED_MKDIR, LAYOUT_WRITE_FAILED_WRITE, projectLayoutWriteIsBound,
  // Story 31.3 — the config.yaml generator and its stamp. `generateBmmConfig` is
  // the entry point Story 31.13's `ma-agents bind` calls; `computeProjectLayoutStamp`
  // and `readProjectLayoutStamp` are the PAIR Story 31.4's drift guard consumes, so
  // that 31.4 depends on two functions rather than on a hash format it re-implements.
  // `canonicalBindingBytes` is exported so a test can assert WHAT the stamp covers,
  // not merely that two digests differ. `STAMP_ABSENT` / `STAMP_MALFORMED` are
  // exported for the same reason `BINDING_*` are: 31.4 must branch on the reason
  // by NAME, so the two failure states can never be collapsed back into one.
  generateBmmConfig, computeProjectLayoutStamp, readProjectLayoutStamp, canonicalBindingBytes,
  STAMP_ABSENT, STAMP_MALFORMED,
  topologyFromLegacyLayout, PROJECT_LAYOUT_STAMP_FIELD, PROJECT_LAYOUT_STAMP_PREFIX,
  // Story 31.12 (FR250) — exported so the tone/content test binds to the SHIPPED
  // strings rather than to copies of them, which could drift apart silently.
  GLOBAL_BMAD_SCOPE_NOTICE_FACT_1, GLOBAL_BMAD_SCOPE_NOTICE_FACT_2, GLOBAL_BMAD_SCOPE_NOTICE_FACT_3,
  // Story 31.7 (FR265) — legacy detection, and the notice bound to its SHIPPED
  // strings for the same reason as the 31.12 constants above. The split command
  // is its own export so AC2's "the exact command" claim is checkable against
  // one string rather than against a regex over prose.
  detectLegacySingleStore, showLegacySingleStoreNoticeOnce,
  LEGACY_SINGLE_STORE_NOTICE_ID, LEGACY_SINGLE_STORE_SPLIT_COMMAND, LEGACY_TWO_STORE,
  LEGACY_SINGLE_STORE_NOTICE_FACT_1, LEGACY_SINGLE_STORE_NOTICE_FACT_2,
  LEGACY_SINGLE_STORE_NOTICE_FACT_3,
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
  IDENTITY_NOT_CONFIGURED,
  // Story 31.5 — the per-backend WIZARD view and the concern table. Exported for
  // the same reason STORE_BACKEND_VIEWS is: the suite pins that these keys are
  // exactly STORE_BACKENDS, so a backend added to the enum without a wizard flow
  // fails here rather than at the moment a user picks it. Both tables are frozen
  // entries included, so handing out the real objects is inert.
  STORE_BACKEND_WIZARD, REPO_LAYOUT_CONCERNS, offerableStoreBackends,
  backendChoicesForStore,
  // Story 31.8 — the confluence configuration flow and the two pure functions it
  // is built from. `generatedRootPageTitle` is exported because AC3's promise
  // ("named for the project, and you are told the name") is only checkable if
  // the test can compute the SAME name the wizard announces and the record
  // carries, from the same function, rather than restating the rule.
  // `validateConfluenceIdentity` is exported for the same reason the prompt
  // carries it: it is the policy the serializer enforces, and a test must be able
  // to show the two agree rather than that each exists.
  collectConfluenceStoreLocation, generatedRootPageTitle, validateConfluenceIdentity,
  // Story 31.13 — `ma-agents bind` (FR252) and scope reporting in `status`
  // (FR253). `bindOfferDecision` is exported separately from `offerBind` because
  // AC3's "never runs bind without the user's choice" is only checkable if the
  // DECISION can be exercised without the prompting: a test that had to answer a
  // prompt to learn what was decided could not distinguish "did not offer" from
  // "offered and was declined". `describeBoundProjects` and `detectInstallScopes`
  // are exported so AC7 can be asserted on data rather than on scraped output.
  handleBind, offerBind, bindOfferDecision, detectInstallScopes, describeBoundProjects,
  printScopeReport, boundProjectsPath };
