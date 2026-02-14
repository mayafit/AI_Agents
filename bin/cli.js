#!/usr/bin/env node

const prompts = require('prompts');
const chalk = require('chalk');
const path = require('path');
const { installSkill, listSkills, listAgents } = require('../lib/installer');

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
  ${chalk.cyan(`npx ${NAME} list`)}                         List available skills
  ${chalk.cyan(`npx ${NAME} agents`)}                       List supported agents
  ${chalk.cyan(`npx ${NAME} help`)}                         Show this help

${chalk.bold('Install options:')}
  ${chalk.cyan('--path <dir>')}    Custom installation directory

${chalk.bold('Examples:')}
  npx ${NAME} install
  npx ${NAME} install code-review claude-code
  npx ${NAME} install test-generator claude-code cline cursor
  npx ${NAME} install skill-creator claude-code --path ./my-skills
`);
}

function showSkills() {
  const skills = listSkills();
  console.log(chalk.bold('\n Available Skills:\n'));
  skills.forEach(skill => {
    console.log(chalk.cyan(`  ${skill.id.padEnd(35)}`) + chalk.white(skill.name));
    console.log(chalk.gray(`  ${''.padEnd(35)}${skill.description}\n`));
  });
}

function showAgents() {
  const agents = listAgents();
  console.log(chalk.bold('\n Supported Agents:\n'));
  agents.forEach(agent => {
    console.log(chalk.cyan(`  ${agent.id.padEnd(20)}`) + chalk.white(agent.name) + chalk.gray(` - ${agent.description}`));
  });
  console.log('');
}

async function installWizard(preselectedSkill, preselectedAgents, customPath) {
  const skills = listSkills();
  const agents = listAgents();

  // Step 1: Select skills (multi-select)
  let selectedSkillIds;
  if (preselectedSkill) {
    selectedSkillIds = [preselectedSkill];
  } else {
    const { skills: chosen } = await prompts({
      type: 'multiselect',
      name: 'skills',
      message: 'Which skills do you want to install?',
      choices: skills.map(s => ({
        title: chalk.white(s.name) + chalk.gray(` - ${s.description}`),
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

  // Step 2: Select agents (multi-select)
  let selectedAgentIds;
  if (preselectedAgents && preselectedAgents.length > 0) {
    selectedAgentIds = preselectedAgents;
  } else {
    const { agents: chosen } = await prompts({
      type: 'multiselect',
      name: 'agents',
      message: 'Which coding agents do you want to install to?',
      choices: agents.map(a => ({
        title: chalk.white(a.name) + chalk.gray(` - ${a.description}`),
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

  // Step 3: Custom path (optional)
  let installPath = customPath || '';
  if (!installPath) {
    const { pathChoice } = await prompts({
      type: 'select',
      name: 'pathChoice',
      message: 'Installation path:',
      choices: [
        { title: 'Default (agent-specific paths)', value: 'default' },
        { title: 'Custom path...', value: 'custom' }
      ]
    });

    if (pathChoice === 'custom') {
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
  console.log(chalk.cyan('  Path:    ') + (installPath || 'default'));
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

  // Step 5: Install each skill
  for (const skillId of selectedSkillIds) {
    try {
      await installSkill(skillId, selectedAgentIds, installPath);
    } catch (error) {
      console.error(chalk.red(`\n Failed to install ${skillId}:`), error.message);
    }
  }

  console.log(chalk.bold.green('\n Installation complete!\n'));
}

async function handleInstall(args) {
  const pathIdx = args.indexOf('--path');
  let customPath = '';
  let positional = [...args];

  if (pathIdx !== -1) {
    customPath = args[pathIdx + 1] || '';
    positional.splice(pathIdx, 2);
  }

  const skillId = positional[0];
  const agentIds = positional.slice(1);

  // No args → launch wizard
  if (!skillId) {
    await installWizard(null, null, customPath);
    return;
  }

  // Skill but no agents → wizard with skill preselected
  if (agentIds.length === 0) {
    await installWizard(skillId, null, customPath);
    return;
  }

  // Full args → direct install
  try {
    await installSkill(skillId, agentIds, customPath);
    console.log(chalk.bold.green('\n Installation complete!\n'));
  } catch (error) {
    console.error(chalk.red('\n Installation failed:'), error.message);
    process.exit(1);
  }
}

async function interactiveMode() {
  console.log(chalk.bold.cyan(`\n ${NAME} v${VERSION}\n`));

  const { action } = await prompts({
    type: 'select',
    name: 'action',
    message: 'What would you like to do?',
    choices: [
      { title: 'Install skills', value: 'install' },
      { title: 'List available skills', value: 'list-skills' },
      { title: 'List supported agents', value: 'list-agents' },
      { title: 'Exit', value: 'exit' }
    ]
  });

  if (!action || action === 'exit') {
    console.log(chalk.yellow('Goodbye!'));
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

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  switch (command) {
    case 'install':
      await handleInstall(args.slice(1));
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
