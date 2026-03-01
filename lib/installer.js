const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');
const prompts = require('prompts');
const { getAgent, getAllAgents } = require('./agents');

const MANIFEST_FILE = '.ma-agents.json';
const MANIFEST_VERSION = '1.0.0';

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
      scope: scope,
      skills: {}
    };
  }
  return manifest;
}

function getInstalledSkillInfo(installPath, skillId) {
  const manifest = readManifest(installPath);
  if (!manifest || !manifest.skills || !manifest.skills[skillId]) {
    return null;
  }
  return manifest.skills[skillId];
}

async function generateSkillsManifest(installPath, agent) {
  const skills = listSkills();
  const manifest = readManifest(installPath);
  if (!manifest || !manifest.skills) return;

  const manifestYamlPath = path.join(installPath, 'MANIFEST.yaml');
  let yamlContent = '# skills/MANIFEST.yaml\n\nskills:\n';

  const skillIds = Object.keys(manifest.skills).sort();
  for (const skillId of skillIds) {
    const skill = skills.find(s => s.id === skillId);
    if (!skill) continue;

    yamlContent += `  - id: ${skillId}\n`;
    yamlContent += `    file: skills/${skillId}/SKILL.md\n`;
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

async function updateAgentInstructions(agent, projectRoot) {
  if (!agent.instructionFiles || agent.instructionFiles.length === 0) return;

  const agentProjectPath = agent.getProjectPath();
  const relManifestPath = path.relative(process.cwd(), path.join(agentProjectPath, 'MANIFEST.yaml')).replace(/\\/g, '/');

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
  const wrappedInstruction = `\n${markerStart}${planningInstruction}${markerEnd}\n`;

  for (const fileName of agent.instructionFiles) {
    const filePath = path.join(projectRoot, fileName);
    let content = '';

    if (fs.existsSync(filePath)) {
      content = await fs.readFile(filePath, 'utf-8');

      const regex = new RegExp(`${markerStart}[\\s\\S]*?${markerEnd}`, 'g');
      if (regex.test(content)) {
        content = content.replace(regex, wrappedInstruction.trim());
      } else {
        content += wrappedInstruction;
      }
    } else {
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
  const { force = false } = options;
  const skills = listSkills();
  const skill = skills.find(s => s.id === skillId);

  if (!skill) {
    throw new Error(`Skill '${skillId}' not found. Run "list" to see available skills.`);
  }

  console.log(chalk.cyan(`\nInstalling skill: ${skill.name} v${skill.version}`));

  for (const agentId of agentIds) {
    const agent = getAgent(agentId);

    if (!agent) {
      console.log(chalk.yellow(`  Warning: Skipping unknown agent: ${agentId}`));
      continue;
    }

    try {
      const installPath = customPath || (scope === 'global' ? agent.getGlobalPath() : agent.getProjectPath());
      await fs.ensureDir(installPath);

      const installed = getInstalledSkillInfo(installPath, skillId);

      if (installed && !force) {
        const cmp = compareSemver(skill.version, installed.version);

        let action;
        if (cmp > 0) {
          // Upgrade available
          console.log(chalk.yellow(`  ${skill.name} v${installed.version} → v${skill.version} update available for ${agent.name}`));
          const { choice } = await prompts({
            type: 'select',
            name: 'choice',
            message: 'What would you like to do?',
            choices: [
              { title: 'Update (recommended)', value: 'update' },
              { title: 'Skip (keep current)', value: 'skip' },
              { title: 'Clean reinstall', value: 'reinstall' },
              { title: 'Remove (uninstall)', value: 'remove' }
            ]
          });
          action = choice;
        } else if (cmp === 0) {
          // Same version
          console.log(chalk.gray(`  ${skill.name} v${installed.version} already installed for ${agent.name}`));
          const { choice } = await prompts({
            type: 'select',
            name: 'choice',
            message: 'What would you like to do?',
            choices: [
              { title: 'Skip (keep current)', value: 'skip' },
              { title: 'Clean reinstall', value: 'reinstall' },
              { title: 'Remove (uninstall)', value: 'remove' }
            ]
          });
          action = choice;
        } else {
          // Downgrade
          console.log(chalk.yellow(`  ${skill.name} v${installed.version} installed, package has v${skill.version} for ${agent.name}`));
          const { choice } = await prompts({
            type: 'select',
            name: 'choice',
            message: 'What would you like to do?',
            choices: [
              { title: 'Skip (keep current)', value: 'skip' },
              { title: `Downgrade to v${skill.version}`, value: 'update' },
              { title: 'Remove (uninstall)', value: 'remove' }
            ]
          });
          action = choice;
        }

        if (!action || action === 'skip') {
          console.log(chalk.gray(`    Skipped`));
          continue;
        }

        if (action === 'remove') {
          await performUninstall(skillId, installPath);
          const manifest = ensureManifest(installPath, agentId, scope);
          delete manifest.skills[skillId];
          writeManifest(installPath, manifest);
          console.log(chalk.green(`    - Removed ${skill.name} from ${agent.name}`));

          // Generate MANIFEST.yaml and update agent instruction files
          await generateSkillsManifest(installPath, agent);
          if (scope === 'project') {
            await updateAgentInstructions(agent, process.cwd());
          }
          continue;
        }

        if (action === 'reinstall') {
          await performUninstall(skillId, installPath);
        }

        // action === 'update' or 'reinstall' → proceed to install below
      }

      if (!installed || force) {
        console.log(chalk.gray(`  Installing for ${agent.name}...`));
      }

      const success = await performInstall(skillId, skill, agent, installPath);

      if (success) {
        // Update manifest
        const manifest = ensureManifest(installPath, agentId, scope);
        const now = new Date().toISOString();
        const existing = manifest.skills[skillId];
        manifest.skills[skillId] = {
          version: skill.version,
          installedAt: existing ? existing.installedAt : now,
          updatedAt: now,
          installerVersion: getPackageVersion(),
          agentVersion: agent.version
        };
        writeManifest(installPath, manifest);

        // Generate MANIFEST.yaml and update agent instruction files
        await generateSkillsManifest(installPath, agent);
        if (scope === 'project') {
          await updateAgentInstructions(agent, process.cwd());
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

  for (const agentId of agentIds) {
    const agent = getAgent(agentId);

    if (!agent) {
      console.log(chalk.yellow(`  Warning: Skipping unknown agent: ${agentId}`));
      continue;
    }

    try {
      const installPath = customPath || (scope === 'global' ? agent.getGlobalPath() : agent.getProjectPath());
      const installed = getInstalledSkillInfo(installPath, skillId);

      if (!installed) {
        const skillDir = path.join(installPath, skillId);
        if (fs.existsSync(skillDir)) {
          await performUninstall(skillId, installPath);
          console.log(chalk.green(`  - Removed ${skillId} from ${agent.name} (legacy install)`));
        } else {
          console.log(chalk.gray(`  ${skillId} is not installed for ${agent.name}`));
        }
        continue;
      }

      await performUninstall(skillId, installPath);

      const manifest = ensureManifest(installPath, agentId, scope);
      delete manifest.skills[skillId];
      writeManifest(installPath, manifest);

      console.log(chalk.green(`  - Removed ${skillId} v${installed.version} from ${agent.name}`));

      // Generate MANIFEST.yaml and update agent instruction files
      await generateSkillsManifest(installPath, agent);
      if (scope === 'project') {
        await updateAgentInstructions(agent, process.cwd());
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

    // Check both scopes unless custom path is specified
    const pathsToCheck = customPath
      ? [{ path: customPath, scope: 'custom' }]
      : [
        { path: projectPath, scope: 'project' },
        { path: globalPath, scope: 'global' }
      ];

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

module.exports = {
  listSkills,
  listAgents,
  installSkill,
  uninstallSkill,
  getStatus,
  readManifest,
  getInstalledSkillInfo,
  compareSemver
};
