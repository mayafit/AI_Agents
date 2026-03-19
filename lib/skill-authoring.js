'use strict';

const fs = require('fs');
const path = require('path');
const chalk = require('chalk');

const SKILLS_DIR = path.join(process.cwd(), 'skills');
const KEBAB_CASE_PATTERN = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;

/**
 * Validate that a skill name is kebab-case.
 * @param {string} name
 * @returns {boolean}
 */
function validateSkillName(name) {
  return KEBAB_CASE_PATTERN.test(name);
}

/**
 * Convert kebab-case string to Title Case.
 * e.g. 'my-new-skill' -> 'My New Skill'
 * @param {string} kebab
 * @returns {string}
 */
function kebabToTitleCase(kebab) {
  return kebab.split('-').map(w => w[0].toUpperCase() + w.slice(1)).join(' ');
}

/**
 * Create a new skill directory with required files.
 * @param {string} skillName  kebab-case skill name
 * @returns {{ success: boolean, message: string }}
 */
function createSkill(skillName) {
  const skillDir = path.join(SKILLS_DIR, skillName);

  // Duplicate detection
  if (fs.existsSync(skillDir)) {
    return {
      success: false,
      error: `Error: Skill '${skillName}' already exists at skills/${skillName}/`,
      hint: `Hint: Choose a different name or remove the existing skill first`
    };
  }

  // Create root directory
  fs.mkdirSync(skillDir, { recursive: true });

  // Create empty subdirectories
  fs.mkdirSync(path.join(skillDir, 'templates'), { recursive: true });
  fs.mkdirSync(path.join(skillDir, 'references'), { recursive: true });
  fs.mkdirSync(path.join(skillDir, 'assets'), { recursive: true });

  const titleName = kebabToTitleCase(skillName);

  // Generate skill.json
  const skillJson = {
    name: titleName,
    description: '',
    version: '1.0.0',
    category: 'workflow',
    author: 'ma-agents',
    tags: [],
    always_load: false
  };
  fs.writeFileSync(
    path.join(skillDir, 'skill.json'),
    JSON.stringify(skillJson, null, 2) + '\n',
    'utf8'
  );

  // Generate SKILL.md
  const skillMd = `# ${titleName}

<Brief description of what this skill does and when it applies.>

## Policies

### 1. <First Policy>

**Rule:** <What the agent must do or not do>

**Action:**
- <Specific instruction>
- <Specific instruction>

### 2. <Second Policy>

**Rule:** <What the agent must do or not do>

**Action:**
- <Specific instruction>

## References

- <Link to any supporting documents in references/ directory>
`;
  fs.writeFileSync(path.join(skillDir, 'SKILL.md'), skillMd, 'utf8');

  return { success: true };
}

/**
 * CLI handler for the create-skill command.
 * @param {string[]} args  CLI arguments after 'create-skill'
 */
function handleCreateSkill(args) {
  const skillName = args[0];

  if (!skillName) {
    console.error(chalk.red('Error: Skill name is required'));
    console.error(chalk.gray('  Hint: Usage: npx ma-agents create-skill <skill-name>'));
    process.exit(1);
  }

  // Validate name
  if (!validateSkillName(skillName)) {
    console.error(chalk.red('Error: Skill name must be kebab-case (lowercase letters, numbers, hyphens)'));
    console.error(chalk.gray('  Hint: Example: my-new-skill, python-linting, api-security'));
    process.exit(1);
  }

  // Attempt creation
  const result = createSkill(skillName);

  if (!result.success) {
    console.error(chalk.red(result.error));
    console.error(chalk.gray('  ' + result.hint));
    process.exit(1);
  }

  console.log(chalk.green(`Skill '${skillName}' created at skills/${skillName}/`));
  console.log(chalk.gray(`  Next: Edit skill.json and SKILL.md to add your skill content`));
}

module.exports = { validateSkillName, createSkill, handleCreateSkill, kebabToTitleCase };
