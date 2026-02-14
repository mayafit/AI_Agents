const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');
const { getAgent, getAllAgents } = require('./agents');

/**
 * Get all available skills
 */
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

/**
 * Get all supported agents
 */
function listAgents() {
  return getAllAgents();
}

/**
 * Install a skill for specified agents
 */
async function installSkill(skillId, agentIds, customPath = '') {
  const skills = listSkills();
  const skill = skills.find(s => s.id === skillId);

  if (!skill) {
    throw new Error(`Skill '${skillId}' not found. Run "list" to see available skills.`);
  }

  console.log(chalk.cyan(`\nInstalling skill: ${skill.name}`));

  for (const agentId of agentIds) {
    const agent = getAgent(agentId);

    if (!agent) {
      console.log(chalk.yellow(`  Warning: Skipping unknown agent: ${agentId}`));
      continue;
    }

    console.log(chalk.gray(`  Installing for ${agent.name}...`));

    try {
      // Determine installation path
      const installPath = customPath || agent.getSkillsPath();

      // Ensure the skills directory exists
      await fs.ensureDir(installPath);

      // Get the skill source file based on agent template
      const skillSourceDir = path.join(__dirname, '..', 'skills', skillId);
      let sourceFile = path.join(skillSourceDir, `${agent.template}${agent.fileExtension}`);

      // Fallback to generic template if specific template doesn't exist
      if (!fs.existsSync(sourceFile)) {
        sourceFile = path.join(skillSourceDir, `generic${agent.fileExtension}`);
      }

      // Fallback to SKILL.md if no agent-specific or generic template exists
      if (!fs.existsSync(sourceFile)) {
        const skillMdPath = path.join(skillSourceDir, 'SKILL.md');
        if (fs.existsSync(skillMdPath)) {
          sourceFile = skillMdPath;
        }
      }

      if (!fs.existsSync(sourceFile)) {
        console.log(chalk.yellow(`    Warning: No template found for ${agent.name}, skipping`));
        continue;
      }

      // Copy the skill file
      const targetFile = path.join(installPath, `${skillId}${agent.fileExtension}`);
      await fs.copy(sourceFile, targetFile);
      console.log(chalk.green(`    + Installed to ${targetFile}`));

      // Copy bundled resources (scripts/, references/, assets/) if they exist
      const resourceDirs = ['scripts', 'references', 'assets'];
      for (const dir of resourceDirs) {
        const resourceSource = path.join(skillSourceDir, dir);
        if (fs.existsSync(resourceSource)) {
          const resourceTarget = path.join(installPath, skillId, dir);
          await fs.ensureDir(path.join(installPath, skillId));
          await fs.copy(resourceSource, resourceTarget);
          console.log(chalk.green(`    + Copied ${dir}/ resources`));
        }
      }
    } catch (error) {
      console.log(chalk.red(`    x Failed: ${error.message}`));
    }
  }
}

module.exports = {
  listSkills,
  listAgents,
  installSkill
};
