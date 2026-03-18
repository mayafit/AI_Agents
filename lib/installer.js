const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');
const prompts = require('prompts');
const { getAgent, getAllAgents } = require('./agents');

const MANIFEST_FILE = '.ma-agents.json';
const MANIFEST_VERSION = '1.1.0';
const MA_AGENTS_SOURCE = 'ma-agents';

// Claude Code hook configuration for MANIFEST verification
const CLAUDE_CODE_HOOK_ID = 'ma-agents-verify-manifest';
const CLAUDE_CODE_SETTINGS_FILE = '.claude/settings.json';

function getPackageVersion() {
  const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf-8'));
  return pkg.version;
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
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n', 'utf-8');
}

function ensureManifest(installPath, agentId, scope) {
  let manifest = readManifest(installPath);
  if (!manifest) {
    manifest = {
      manifestVersion: MANIFEST_VERSION,
      agent: agentId,
      agents: [agentId],
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

async function updateAgentInstructions(agent, projectRoot) {
  if (!agent.instructionFiles || agent.instructionFiles.length === 0) return;

  // JSON merge strategy (e.g., OpenCode)
  if (agent.injectionStrategy?.position === 'json-merge') {
    const targetKey = agent.injectionStrategy.targetKey || 'instructions';
    const filePath = path.join(projectRoot, agent.instructionFiles[0]);
    const agentProjectPath = agent.getProjectPath();
    const relManifestPath = path.relative(projectRoot, path.join(agentProjectPath, 'MANIFEST.yaml')).replace(/\\/g, '/');
    const instructionText = `# AI Agent Skills - Planning Instruction\n\nYou have access to a library of skills in your skills directory. Before starting any task:\n\n1. Read the skill manifest at ${relManifestPath}\n2. Based on the task description, select which skills are relevant\n3. Read only the selected skill files\n4. Then proceed with the task\n\nAlways load skills marked with always_load: true.\nDo not load skills that are not relevant to the current task.`;

    if (!fs.existsSync(filePath)) {
      // File absent: create fresh (atomic write)
      const data = { [targetKey]: [] };
      data[targetKey].push({ _source: MA_AGENTS_SOURCE, text: instructionText });
      const tmpPath = filePath + '.tmp';
      await fs.outputFile(tmpPath, JSON.stringify(data, null, 2), 'utf-8');
      await fs.rename(tmpPath, filePath);
      console.log(chalk.cyan(`    + Created ${agent.instructionFiles[0]}`));
      return;
    }
    // File present: read and merge
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const data = JSON.parse(content);
      if (!Array.isArray(data[targetKey])) {
        data[targetKey] = [];
      }
      // Filter out stale ma-agents entries, keep user entries (null-safe)
      const userEntries = data[targetKey].filter(entry => entry != null && entry._source !== MA_AGENTS_SOURCE);
      // Append fresh ma-agents entries
      const freshEntries = [{ _source: MA_AGENTS_SOURCE, text: instructionText }];
      data[targetKey] = [...userEntries, ...freshEntries];
      // Atomic write: temp file then rename
      const tmpPath = filePath + '.tmp';
      await fs.outputFile(tmpPath, JSON.stringify(data, null, 2), 'utf-8');
      await fs.rename(tmpPath, filePath);
      console.log(chalk.cyan(`    + Updated ${agent.instructionFiles[0]}`));
    } catch (err) {
      console.error(`[${MA_AGENTS_SOURCE}] ERROR: Could not parse ${filePath} — ${err.message}. File not modified.`);
      return; // non-fatal: do NOT re-throw
    }
    return;
  }

  const agentProjectPath = agent.getProjectPath();
  const relManifestPath = path.relative(projectRoot, path.join(agentProjectPath, 'MANIFEST.yaml')).replace(/\\/g, '/');

  const planningInstruction = `
# AI Agent Skills - Planning Instruction

You have access to a library of skills in your skills directory. Before starting any task:

1. Read the skill manifest at ${relManifestPath}
2. Based on the task description, select which skills are relevant
3. Read only the selected skill files
4. Then proceed with the task

Always load skills marked with always_load: true.
Do not load skills that are not relevant to the current task.
`;

  const markerStart = '<!-- MA-AGENTS-START -->';
  const markerEnd = '<!-- MA-AGENTS-END -->';
  const wrappedInstruction = `${markerStart}${planningInstruction}${markerEnd}\n`;

  for (const fileName of agent.instructionFiles) {
    const filePath = path.join(projectRoot, fileName);
    let content = '';

    if (fs.existsSync(filePath)) {
      content = await fs.readFile(filePath, 'utf-8');

      const regex = new RegExp(`${markerStart}[\\s\\S]*?${markerEnd}`, 'g');
      if (regex.test(content)) {
        // Replace existing block in-place (AC #2)
        content = content.replace(regex, wrappedInstruction.trim());
      } else {
        // Top-insert: place after skipped headers (AC #1, #3)
        const strategy = agent.injectionStrategy || { position: 'top', skipPatterns: [] };
        const insertIdx = findInsertionPoint(content, strategy.skipPatterns);
        content = content.slice(0, insertIdx) + wrappedInstruction + '\n' + content.slice(insertIdx);
      }
    } else if (agent.category === 'bmad') {
      // BMAD agent instruction files ARE the agent definitions (persona, menu, activation).
      // Never create them from scratch — they must be deployed by applyCustomizations().
      // Creating them here would produce a file with ONLY the MA-AGENTS block,
      // wiping the entire agent definition.
      console.log(chalk.gray(`    Skipped ${fileName} (BMAD agent file not yet deployed)`));
      continue;
    } else {
      // New non-BMAD file: block is sole content (AC #1, #3)
      content = wrappedInstruction;
    }

    await fs.outputFile(filePath, content, 'utf-8');
    console.log(chalk.cyan(`    + Updated ${fileName}`));
  }
}

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
    if (!pathGroups.has(installPath)) {
      pathGroups.set(installPath, []);
    }
    pathGroups.get(installPath).push({ agentId, agent });
  }

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
              await updateAgentInstructions(entry.agent, process.cwd());
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

        // Generate MANIFEST.yaml and update instruction files for ALL agents
        await generateSkillsManifest(installPath);
        if (scope === 'project') {
          for (const entry of agentEntries) {
            await updateAgentInstructions(entry.agent, process.cwd());
          }
          // Deploy Claude Code hook when skills are installed for claude-code
          if (includesClaudeCode(agentEntries)) {
            await deployClaudeCodeHook(process.cwd());
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
      pathsToCheck = [{ path: globalPath, scope: 'global' }];
    } else if (scope === 'project') {
      pathsToCheck = [{ path: projectPath, scope: 'project' }];
    } else {
      pathsToCheck = [
        { path: projectPath, scope: 'project' },
        { path: globalPath, scope: 'global' }
      ];
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

  // Check if our hook is already present
  const hookCommand = `node "$CLAUDE_PROJECT_DIR/lib/hooks/claude-code/verify-manifest.js"`;
  const alreadyInstalled = settings.hooks.SessionStart.some(group =>
    group.hooks && group.hooks.some(h => h.command === hookCommand)
  );

  if (alreadyInstalled) {
    return; // Already deployed
  }

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

  if (!settings.hooks || !settings.hooks.SessionStart) return;

  const hookCommand = `node "$CLAUDE_PROJECT_DIR/lib/hooks/claude-code/verify-manifest.js"`;
  settings.hooks.SessionStart = settings.hooks.SessionStart.filter(group => {
    if (!group.hooks) return true;
    group.hooks = group.hooks.filter(h => h.command !== hookCommand && h._id !== CLAUDE_CODE_HOOK_ID);
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
  getInstalledSkillInfo,
  getManifestAgents,
  compareSemver,
  findInsertionPoint,
  deployClaudeCodeHook,
  removeClaudeCodeHook,
  _testUpdateAgentInstructions: updateAgentInstructions,
  _MA_AGENTS_SOURCE: MA_AGENTS_SOURCE
};
