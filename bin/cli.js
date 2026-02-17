#!/usr/bin/env node

const prompts = require('prompts');
const chalk = require('chalk');
const path = require('path');
const { installSkill, uninstallSkill, getStatus, listSkills, listAgents } = require('../lib/installer');

const PKG = require('../package.json');
const NAME = PKG.name;
const VERSION = PKG.version;

function showHelp() {
  console.log(`
${chalk.bold.cyan(NAME)} ${chalk.gray(`v${VERSION}`)}

${chalk.bold('Usage:')}
  ${chalk.cyan(`npx ${NAME}`)}                              Interactive wizard
  ${chalk.cyan(`npx ${NAME} install`)}                      Interactive install wizard
  ${chalk.cyan(`npx ${NAME} install`)} <skill> <agents...>  Install directly
  ${chalk.cyan(`npx ${NAME} uninstall`)} <skill> <agents..> Uninstall a skill
  ${chalk.cyan(`npx ${NAME} status`)}                       Show installed skills
  ${chalk.cyan(`npx ${NAME} list`)}                         List available skills
  ${chalk.cyan(`npx ${NAME} agents`)}                       List supported agents
  ${chalk.cyan(`npx ${NAME} help`)}                         Show this help

${chalk.bold('Install options:')}
  ${chalk.cyan('--global')}        Install to global/user-level paths (default: project-level)
  ${chalk.cyan('--path <dir>')}    Custom installation directory
  ${chalk.cyan('--force')}         Skip upgrade prompts, always overwrite

${chalk.bold('Examples:')}
  npx ${NAME} install
  npx ${NAME} install code-review claude-code
  npx ${NAME} install code-review claude-code --force
  npx ${NAME} uninstall code-review claude-code
  npx ${NAME} status
  npx ${NAME} status --global
`);
}

function showSkills() {
  const skills = listSkills();
  console.log(chalk.bold('\n Available Skills:\n'));
  skills.forEach(skill => {
    console.log(chalk.cyan(`  ${skill.id.padEnd(35)}`) + chalk.white(`${skill.name}`) + chalk.gray(` v${skill.version}`));
    console.log(chalk.gray(`  ${''.padEnd(35)}${skill.description}\n`));
  });
}

function showAgents() {
  const agents = listAgents();
  console.log(chalk.bold('\n Supported Agents:\n'));
  agents.forEach(agent => {
    console.log(chalk.cyan(`  ${agent.id.padEnd(20)}`) + chalk.white(agent.name) + chalk.gray(` v${agent.version} - ${agent.description}`));
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
  let customPath = '';
  let positional = [...args].filter(a => a !== '--global' && a !== '--force');

  const pathIdx = positional.indexOf('--path');
  if (pathIdx !== -1) {
    customPath = positional[pathIdx + 1] || '';
    positional.splice(pathIdx, 2);
  }

  return {
    globalFlag,
    forceFlag,
    customPath,
    scope: globalFlag ? 'global' : 'project',
    positional
  };
}

// --- Install wizard ---

async function installWizard(preselectedSkill, preselectedAgents, customPath, forceFlag) {
  const skills = listSkills();
  const agents = listAgents();

  // Step 1: Select skills
  let selectedSkillIds;
  if (preselectedSkill) {
    selectedSkillIds = [preselectedSkill];
  } else {
    const { skills: chosen } = await prompts({
      type: 'multiselect',
      name: 'skills',
      message: 'Which skills do you want to install?',
      choices: skills.map(s => ({
        title: chalk.white(s.name) + chalk.gray(` v${s.version} - ${s.description}`),
        value: s.id,
        selected: false
      })),
      instructions: chalk.gray('  Use space to select, enter to confirm'),
      min: 1
    });

    if (!chosen || chosen.length === 0) {
      console.log(chalk.yellow('No skills selected. Exiting.'));
      process.exit(0);
    }
    selectedSkillIds = chosen;
  }

  // Step 2: Select agents
  let selectedAgentIds;
  if (preselectedAgents && preselectedAgents.length > 0) {
    selectedAgentIds = preselectedAgents;
  } else {
    const { agents: chosen } = await prompts({
      type: 'multiselect',
      name: 'agents',
      message: 'Which coding agents do you want to install to?',
      choices: agents.map(a => ({
        title: chalk.white(a.name) + chalk.gray(` v${a.version} - ${a.description}`),
        value: a.id,
        selected: false
      })),
      instructions: chalk.gray('  Use space to select, enter to confirm'),
      min: 1
    });

    if (!chosen || chosen.length === 0) {
      console.log(chalk.yellow('No agents selected. Exiting.'));
      process.exit(0);
    }
    selectedAgentIds = chosen;
  }

  // Step 3: Installation scope
  let installPath = customPath || '';
  let installScope = 'project';
  if (!installPath) {
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

  // Step 4: Confirm
  console.log('');
  console.log(chalk.bold('  Summary:'));
  console.log(chalk.cyan('  Skills:  ') + selectedSkillIds.join(', '));
  console.log(chalk.cyan('  Agents:  ') + selectedAgentIds.join(', '));
  console.log(chalk.cyan('  Path:    ') + (installPath || (installScope === 'global' ? 'global (user-level)' : 'project (current directory)')));
  console.log('');

  const { confirmed } = await prompts({
    type: 'confirm',
    name: 'confirmed',
    message: 'Proceed with installation?',
    initial: true
  });

  if (!confirmed) {
    console.log(chalk.yellow('Installation cancelled.'));
    process.exit(0);
  }

  // Step 5: Install each skill (with upgrade detection)
  for (const skillId of selectedSkillIds) {
    try {
      await installSkill(skillId, selectedAgentIds, installPath, installScope, { force: !!forceFlag });
    } catch (error) {
      console.error(chalk.red(`\n Failed to install ${skillId}:`), error.message);
    }
  }

  console.log(chalk.bold.green('\n Installation complete!\n'));
}

// --- Command handlers ---

async function handleInstall(args) {
  const { globalFlag, forceFlag, customPath, scope, positional } = parseFlags(args);

  const skillId = positional[0];
  const agentIds = positional.slice(1);

  // No args → launch wizard
  if (!skillId) {
    await installWizard(null, null, customPath, forceFlag);
    return;
  }

  // Skill but no agents → wizard with skill preselected
  if (agentIds.length === 0) {
    await installWizard(skillId, null, customPath, forceFlag);
    return;
  }

  // Full args → direct install
  try {
    await installSkill(skillId, agentIds, customPath, scope, { force: forceFlag });
    console.log(chalk.bold.green('\n Installation complete!\n'));
  } catch (error) {
    console.error(chalk.red('\n Installation failed:'), error.message);
    process.exit(1);
  }
}

async function handleUninstall(args) {
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
      showSkills();
      break;
    case 'agents':
    case 'list-agents':
      showAgents();
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
}

main().catch(error => {
  console.error(chalk.red('Error:'), error);
  process.exit(1);
});
