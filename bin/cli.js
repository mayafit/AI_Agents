#!/usr/bin/env node

const prompts = require('prompts');
const chalk = require('chalk');
const path = require('path');
const { installSkill, listSkills, listAgents } = require('../lib/installer');

const VERSION = require('../package.json').version;

function showHelp() {
  console.log(`
${chalk.bold.cyan('AI Agent Skills')} ${chalk.gray(`v${VERSION}`)}

${chalk.bold('Usage:')}
  ${chalk.cyan('npx ai-agent-skills')}                              Interactive mode
  ${chalk.cyan('npx ai-agent-skills install')} <skill> <agents...>  Install a skill
  ${chalk.cyan('npx ai-agent-skills list')}                         List available skills
  ${chalk.cyan('npx ai-agent-skills agents')}                       List supported agents
  ${chalk.cyan('npx ai-agent-skills help')}                         Show this help

${chalk.bold('Install options:')}
  ${chalk.cyan('--path <dir>')}    Custom installation directory

${chalk.bold('Examples:')}
  npx ai-agent-skills install code-review claude-code
  npx ai-agent-skills install test-generator claude-code cline cursor
  npx ai-agent-skills install skill-creator claude-code --path ./my-skills
  npx ai-agent-skills list
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

  if (!skillId) {
    console.error(chalk.red('\nError: No skill specified.'));
    console.log(chalk.gray('Usage: npx ai-agent-skills install <skill> <agents...>'));
    console.log(chalk.gray('Run "npx ai-agent-skills list" to see available skills.\n'));
    process.exit(1);
  }

  if (agentIds.length === 0) {
    console.error(chalk.red('\nError: No agents specified.'));
    console.log(chalk.gray('Usage: npx ai-agent-skills install <skill> <agents...>'));
    console.log(chalk.gray('Run "npx ai-agent-skills agents" to see supported agents.\n'));
    process.exit(1);
  }

  try {
    await installSkill(skillId, agentIds, customPath);
    console.log(chalk.bold.green('\n Installation complete!\n'));
  } catch (error) {
    console.error(chalk.red('\n Installation failed:'), error.message);
    process.exit(1);
  }
}

async function interactiveMode() {
  console.log(chalk.bold.cyan('\n AI Agent Skills Installer\n'));

  const { action } = await prompts({
    type: 'select',
    name: 'action',
    message: 'What would you like to do?',
    choices: [
      { title: 'Install a skill', value: 'install' },
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
    const skills = listSkills();

    const { selectedSkill } = await prompts({
      type: 'select',
      name: 'selectedSkill',
      message: 'Select a skill to install:',
      choices: skills.map(s => ({ title: `${s.name} - ${s.description}`, value: s.id }))
    });

    if (!selectedSkill) {
      console.log(chalk.yellow('No skill selected. Exiting.'));
      process.exit(0);
    }

    const agents = listAgents();

    const { selectedAgents } = await prompts({
      type: 'multiselect',
      name: 'selectedAgents',
      message: 'Select agents to install this skill for:',
      choices: agents.map(a => ({ title: a.name, value: a.id, selected: false })),
      min: 1
    });

    if (!selectedAgents || selectedAgents.length === 0) {
      console.log(chalk.yellow('No agents selected. Exiting.'));
      process.exit(0);
    }

    const { installPath } = await prompts({
      type: 'text',
      name: 'installPath',
      message: 'Installation path (leave empty for default):',
      initial: ''
    });

    try {
      await installSkill(selectedSkill, selectedAgents, installPath);
      console.log(chalk.bold.green('\n Installation complete!\n'));
    } catch (error) {
      console.error(chalk.red('\n Installation failed:'), error.message);
      process.exit(1);
    }
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
      console.log(`ai-agent-skills v${VERSION}`);
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
