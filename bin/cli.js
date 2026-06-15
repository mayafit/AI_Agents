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
const { execFileSync } = require('child_process');
const { installSkill, uninstallSkill, getStatus, listSkills, listAgents, updateProjectContextRepoLayout, migrateRetiredSkills } = require('../lib/installer');
const { getProfile, setProfile, resolveProfile, getBmadModules, setBmadModules } = require('../lib/profile');
const { reconfigure: runReconfigure, ReconfigureYesRejectedError, ManifestNotFoundError, RoomodesSlugDivergenceError } = require('../lib/reconfigure');
const { uninstallProfileArtifacts } = require('../lib/uninstall');
const bmad = require('../lib/bmad');
const { getBmadPlatformCode } = require('../lib/agents');
const { handleCreateSkill, handleValidateSkill, handleSetMandatory, handleCustomizeAgent, handleCreateAgent } = require('../lib/skill-authoring');

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
  const header = `[${new Date().toISOString()}] ${NAME} v${VERSION} — log started\n`;
  fs.writeSync(logFd, header);

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

  return {
    globalFlag,
    forceFlag,
    yesFlag,
    agentFlag,
    customPath,
    bmadModulesFlag,
    bmadModulesPrompt,
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

function yamlEscapeValue(v) {
  if (!v) return '""';
  const s = String(v);
  if (/[:"#\[\]{}&*!|>%@`]/.test(s) || s !== s.trim() || s === '') {
    return '"' + s.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
  }
  return '"' + s + '"';
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
    return content.replace(regex, newLine);
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

function writeProjectLayoutYaml(layout) {
  const layoutPath = path.join(process.cwd(), '_bmad-output', 'project-layout.yaml');
  // Only skip writing when BOTH concerns are truly same-repo (jira requires config recording)
  const bothSame = layout.knowledgebase.mode === 'same' && layout.sprintManagement.mode === 'same';

  if (bothSame) {
    // Single-repo mode: delete stale file if exists
    if (fs.existsSync(layoutPath)) {
      fs.unlinkSync(layoutPath);
      console.log(chalk.blue('  Removed stale project-layout.yaml (now in single-repo mode)'));
    }
    return;
  }

  // Multi-repo or Jira mode: generate project-layout.yaml
  fs.mkdirSync(path.join(process.cwd(), '_bmad-output'), { recursive: true });

  const date = new Date().toISOString().slice(0, 10);
  let content = `# Generated by ma-agents — do not edit manually\n`;
  content += `# Tells agents where to find planning and sprint data\n`;
  content += `generated: "${date}"\n`;

  const projectRoot = process.cwd();

  // Knowledgebase section
  const kbPortable = toPortablePath(layout.knowledgebase.path, projectRoot);
  content += `knowledgebase:\n`;
  content += `  mode: ${layout.knowledgebase.mode}\n`;
  content += `  path: ${yamlEscapeValue(kbPortable.portable)}\n`;
  if (kbPortable.isAbsolute) {
    content += `  # PORTABILITY: absolute path — other developers may need to reconfigure\n`;
  }
  if (layout.knowledgebase.mode === 'remote' && layout.knowledgebase.gitUrl) {
    content += `  gitUrl: ${yamlEscapeValue(layout.knowledgebase.gitUrl)}\n`;
  }

  // Sprint management section
  content += `sprint_management:\n`;
  content += `  mode: ${layout.sprintManagement.mode}\n`;
  if (layout.sprintManagement.mode === 'jira') {
    content += `  jira_url: ${yamlEscapeValue(layout.sprintManagement.jiraUrl)}\n`;
    content += `  jira_project_key: ${yamlEscapeValue(layout.sprintManagement.jiraProjectKey)}\n`;
  } else {
    const spPortable = toPortablePath(layout.sprintManagement.path, projectRoot);
    content += `  path: ${yamlEscapeValue(spPortable.portable)}\n`;
    if (spPortable.isAbsolute) {
      content += `  # PORTABILITY: absolute path — other developers may need to reconfigure\n`;
    }
    if (layout.sprintManagement.mode === 'remote' && layout.sprintManagement.gitUrl) {
      content += `  gitUrl: ${yamlEscapeValue(layout.sprintManagement.gitUrl)}\n`;
    }
  }

  fs.writeFileSync(layoutPath, content, 'utf-8');
  console.log(chalk.gray(`  Created _bmad-output/project-layout.yaml`));
}

function resolveStoredPath(storedPath, projectRoot) {
  if (!storedPath) return '.';
  if (storedPath === '.') return storedPath;
  // If already absolute, use as-is (backward compat)
  if (path.isAbsolute(storedPath) || /^[A-Za-z]:/.test(storedPath)) return storedPath;
  // Relative path — resolve from project root
  return normalizePath(path.resolve(projectRoot, storedPath));
}

function readExistingLayout() {
  const projectRoot = process.cwd();
  // Try project-layout.yaml first (authoritative source written by Story 16.2)
  const layoutPath = path.join(projectRoot, '_bmad-output', 'project-layout.yaml');
  try {
    if (fs.existsSync(layoutPath)) {
      const content = fs.readFileSync(layoutPath, 'utf-8');
      const layout = { knowledgebase: null, sprintManagement: null };

      // Parse each concern section from the simple YAML
      for (const [section, key] of [['knowledgebase', 'knowledgebase'], ['sprint_management', 'sprintManagement']]) {
        const sectionMatch = content.match(new RegExp(`^${section}:\\s*$`, 'm'));
        if (!sectionMatch) continue;

        const afterSection = content.slice(sectionMatch.index + sectionMatch[0].length);
        const modeMatch = afterSection.match(/^\s+mode:\s*(\S+)/m);
        const pathMatch = afterSection.match(/^\s+path:\s*"?([^"\n]+)"?/m);
        const gitUrlMatch = afterSection.match(/^\s+gitUrl:\s*"?([^"\n]+)"?/m);
        const jiraUrlMatch = afterSection.match(/^\s+jira_url:\s*"?([^"\n]+)"?/m);
        const jiraProjectKeyMatch = afterSection.match(/^\s+jira_project_key:\s*"?([^"\n]+)"?/m);

        if (modeMatch) {
          const mode = modeMatch[1];
          if (mode === 'jira') {
            const jiraUrl = jiraUrlMatch ? jiraUrlMatch[1].replace(/^"(.*)"$/, '$1') : '';
            const jiraProjectKey = jiraProjectKeyMatch ? jiraProjectKeyMatch[1].replace(/^"(.*)"$/, '$1') : '';
            layout[key] = { mode: 'jira', jiraUrl, jiraProjectKey };
          } else if (pathMatch) {
            const resolvedPath = resolveStoredPath(pathMatch[1], projectRoot);
            const entry = { mode, path: resolvedPath };
            if (mode === 'remote' && gitUrlMatch) {
              entry.gitUrl = gitUrlMatch[1];
            }
            layout[key] = entry;
          }
        }
      }

      // Only return if we parsed at least one valid concern
      if (layout.knowledgebase || layout.sprintManagement) {
        // Fill in defaults for any missing section
        if (!layout.knowledgebase) layout.knowledgebase = { mode: 'same', path: '.' };
        if (!layout.sprintManagement) layout.sprintManagement = { mode: 'same', path: '.' };
        return layout;
      }
    }
  } catch (e) {
    console.log(chalk.yellow(`  Warning: could not read project-layout.yaml: ${e.message}`));
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
    const modeChoices = [
      { title: 'Current repository (default)', value: 'same' },
      { title: 'Local path', value: 'local' },
      { title: 'Remote git repository', value: 'remote' },
      ...(concern === 'sprintManagement' ? [{ title: 'Jira', value: 'jira' }] : []),
    ];
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

// --- Install wizard ---

async function installWizard(preselectedSkill, preselectedAgents, customPath, forceFlag, yesFlag = false, cliScope, bmadModulesFlag = '', bmadModulesPrompt = false) {
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

  // Step 2.5: Repository layout (preserve existing config on update)
  const existingLayout = isUpdate ? readExistingLayout() : null;
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

      if (!bmadInstalled) {
        if (yesFlag) {
          console.log(chalk.cyan(`\n Installing BMAD-METHOD (modules: ${bmadModules.join(', ')})...`));
          const success = await bmad.installBmad(bmadModules, bmadTools);
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
            if (success) {
              console.log(chalk.green(' BMAD-METHOD installed successfully!'));
            }
          }
        }
      } else {
        if (yesFlag) {
          console.log(chalk.cyan(`\n Updating BMAD-METHOD (modules: ${bmadModules.join(', ')})...`));
          const success = await bmad.updateBmad(bmadModules, bmadTools);
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
            if (success) {
              console.log(chalk.green(' BMAD-METHOD updated successfully!'));
            }
          }
        }
      }
    }
  }

  // Step 3.6: Write repo layout config (after BMAD install creates config.yaml)
  if (installScope === 'project') {
    writeRepoLayoutConfig(repoLayout);
    writeProjectLayoutYaml(repoLayout);
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

  // Install requested skills
  const batchState = {};
  if (yesFlag) {
    batchState.globalAction = 'update';
  }
  for (const skillId of selectedSkillIds) {
    try {
      await installSkill(skillId, selectedAgentIds, installPath, installScope, { force: !!forceFlag, yes: yesFlag, batchState });
    } catch (error) {
      console.error(chalk.red(`\n Failed to install ${skillId}:`), error.message);
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
  const { globalFlag, forceFlag, yesFlag, agentFlag, customPath, bmadModulesFlag, bmadModulesPrompt, scope, positional } = parseFlags(args);

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
    await installWizard(null, preselectedAgents, customPath, forceFlag, yesFlag, scope, bmadModulesFlag, bmadModulesPrompt);
    return;
  }

  // Skill but no agents (and no agentFlag) → wizard with skill preselected
  if (!agentFlag && agentIds.length === 0) {
    await installWizard(skillId, null, customPath, forceFlag, yesFlag, scope, bmadModulesFlag, bmadModulesPrompt);
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
  const layout = readExistingLayout();
  if (!layout) {
    console.log(chalk.cyan('\n  Single-repo layout (default)'));
    console.log(chalk.gray('  Knowledgebase:      . (current repository)'));
    console.log(chalk.gray('  Sprint management:  . (current repository)'));
    return;
  }

  console.log(chalk.bold.cyan('\n  Current Repository Layout:\n'));
  for (const [label, key] of [['Knowledgebase', 'knowledgebase'], ['Sprint Management', 'sprintManagement']]) {
    const concern = layout[key];
    console.log(chalk.white(`  ${label}:`));
    console.log(chalk.gray(`    Mode:    ${concern.mode}`));
    console.log(chalk.gray(`    Path:    ${concern.path}`));
    if (concern.gitUrl) {
      console.log(chalk.gray(`    Git URL: ${concern.gitUrl}`));
    }
  }
  console.log('');
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
  writeProjectLayoutYaml(newLayout);

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

module.exports = { parseFlags, selectBmadModules, collectRepoLayout, readExistingLayout, writeRepoLayoutConfig, writeProjectLayoutYaml, writeConfigField, normalizePath, toPortablePath, resolveStoredPath, ciCloneIfNeeded, showCurrentLayout, handleConfigLayout, yamlEscapeValue };
