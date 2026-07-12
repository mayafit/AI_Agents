'use strict';

const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const { getAllAgents } = require('./agents');

const KEBAB_CASE_PATTERN = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;

/**
 * Check that targetPath is within baseDir (prevents path traversal via path.join).
 * @param {string} targetPath  Constructed path to validate
 * @param {string} baseDir     Trusted base directory
 * @returns {boolean}
 */
function isWithinDir(targetPath, baseDir) {
  const resolved = path.resolve(targetPath);
  const base = path.resolve(baseDir);
  return resolved === base || resolved.startsWith(base + path.sep);
}

/**
 * Escape a user-supplied string for safe embedding in a YAML double-quoted scalar.
 * @param {string} s
 * @returns {string}  Double-quoted, safely escaped YAML scalar
 */
function yamlStr(s) {
  return '"' + String(s || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n') + '"';
}

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
  return kebab.split('-').map(w => w.length > 0 ? w[0].toUpperCase() + w.slice(1) : '').join(' ');
}

/**
 * Create a new skill directory with required files.
 * @param {string} skillName  kebab-case skill name
 * @param {string} [skillsDir]  base skills directory (defaults to <cwd>/skills)
 * @returns {{ success: boolean, error?: string, hint?: string }}
 */
function createSkill(skillName, skillsDir) {
  const baseDir = skillsDir || path.join(process.cwd(), 'skills');
  const skillDir = path.join(baseDir, skillName);

  // Prevent path traversal (path.join normalizes '..' segments)
  if (!isWithinDir(skillDir, baseDir)) {
    return { success: false, error: `Invalid skill name '${skillName}'`, hint: 'Skill names must be lowercase kebab-case' };
  }

  // Duplicate detection
  if (fs.existsSync(skillDir)) {
    return {
      success: false,
      error: `Skill '${skillName}' already exists at ${path.join('skills', skillName)}`,
      hint: `Choose a different name or remove the existing skill first`
    };
  }

  // Create all directories and files with rollback on failure
  try {
    fs.mkdirSync(skillDir, { recursive: true });
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

  } catch (err) {
    // Rollback: remove partially-created directory so the name is not permanently locked
    try {
      fs.rmSync(skillDir, { recursive: true, force: true });
    } catch (_) {
      // Best-effort cleanup; ignore secondary errors
    }
    return {
      success: false,
      error: `Failed to create skill '${skillName}': ${err.message}`,
      hint: `Check directory permissions and try again`
    };
  }

  return { success: true, skillDir, titleName: kebabToTitleCase(skillName) };
}

/**
 * CLI handler for the create-skill command.
 * @param {string[]} args  CLI arguments after 'create-skill'
 */
async function handleCreateSkill(args) {
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
    console.error(chalk.red(`Error: ${result.error}`));
    console.error(chalk.gray(`  Hint: ${result.hint}`));
    process.exit(1);
  }

  const displayPath = path.join('skills', skillName);
  console.log(chalk.green(`Skill '${skillName}' created at ${displayPath}`));
  console.log(chalk.gray(`  Next: Edit skill.json and SKILL.md to add your skill content`));
  console.log(chalk.gray(`  Next: Register in .claude/skills/MANIFEST.yaml to enable auto-loading`));
}

const VALID_CATEGORIES = ['security', 'architecture', 'testing', 'documentation', 'workflow', 'language'];
const SEMVER_PATTERN = /^\d+\.\d+\.\d+$/;

/**
 * Validate an existing skill directory against the schema.
 * @param {string} skillName  skill directory name
 * @param {string} [skillsDir]  base skills directory (defaults to <cwd>/skills)
 * @returns {{ valid: boolean, notFound?: boolean, errors: string[], warnings: string[], metadata?: object }}
 */
function validateSkill(skillName, skillsDir) {
  const baseDir = skillsDir || path.join(process.cwd(), 'skills');
  const skillDir = path.join(baseDir, skillName);
  const errors = [];
  const warnings = [];

  // Prevent path traversal
  if (!isWithinDir(skillDir, baseDir)) {
    return { valid: false, notFound: true, errors: [`Invalid skill name '${skillName}'`], warnings };
  }

  // Check skill directory exists
  if (!fs.existsSync(skillDir)) {
    return { valid: false, notFound: true, errors: [`Skill '${skillName}' not found`], warnings };
  }

  // Task 2: File existence checks
  const hasSkillJson = fs.existsSync(path.join(skillDir, 'skill.json'));
  const hasSkillMd = fs.existsSync(path.join(skillDir, 'SKILL.md'));

  if (!hasSkillJson) errors.push('missing required file skill.json');
  if (!hasSkillMd) errors.push('missing required file SKILL.md');

  // Task 3: skill.json field validation
  let metadata = null;
  if (hasSkillJson) {
    let parsed;
    try {
      parsed = JSON.parse(fs.readFileSync(path.join(skillDir, 'skill.json'), 'utf8'));
    } catch (_) {
      errors.push('skill.json is not valid JSON');
    }

    if (parsed) {
      metadata = parsed;

      // Required fields
      if (typeof parsed.name !== 'string' || parsed.name.trim() === '') {
        errors.push('name: required, must be a non-empty string');
      }
      if (typeof parsed.version !== 'string' || !SEMVER_PATTERN.test(parsed.version)) {
        errors.push('version: must match semver format (e.g., 1.0.0)');
      }
      if (!Object.prototype.hasOwnProperty.call(parsed, 'description') || typeof parsed.description !== 'string') {
        errors.push('description: required, must be a string');
      }

      // Optional fields — validate only if present
      if (parsed.category !== undefined && !VALID_CATEGORIES.includes(parsed.category)) {
        errors.push(`category: must be one of: ${VALID_CATEGORIES.join(', ')}`);
      }
      if (parsed.tags !== undefined && !Array.isArray(parsed.tags)) {
        errors.push('tags: must be an array of strings');
      }
      if (parsed.always_load !== undefined && typeof parsed.always_load !== 'boolean') {
        errors.push('always_load: must be a boolean');
      }
      if (parsed.author !== undefined && (typeof parsed.author !== 'string' || parsed.author.trim() === '')) {
        errors.push('author: must be a non-empty string if present');
      }
      if (parsed.applies_when !== undefined && !Array.isArray(parsed.applies_when)) {
        errors.push('applies_when: must be an array of strings');
      }
    }
  }

  // Task 4: Template validation
  const templatesDir = path.join(skillDir, 'templates');
  if (fs.existsSync(templatesDir)) {
    const knownAgentIds = new Set(getAllAgents().map(a => a.id));
    const files = fs.readdirSync(templatesDir).filter(f =>
      f.endsWith('.md') && fs.statSync(path.join(templatesDir, f)).isFile()
    );
    for (const file of files) {
      const agentId = path.basename(file, '.md');
      if (knownAgentIds.has(agentId)) {
        // valid — no action needed (metadata shown in output)
      } else {
        warnings.push(`Template '${file}' targets unknown agent '${agentId}'`);
      }
    }
  }

  return { valid: errors.length === 0, errors, warnings, metadata };
}

/**
 * CLI handler for the validate-skill command.
 * @param {string[]} args  CLI arguments after 'validate-skill'
 */
async function handleValidateSkill(args) {
  const skillName = args[0];

  if (!skillName) {
    console.error(chalk.red('Error: Skill name is required'));
    console.error(chalk.gray('  Hint: Usage: npx ma-agents validate-skill <skill-name>'));
    process.exit(1);
  }

  const result = validateSkill(skillName);

  if (result.notFound) {
    console.error(chalk.red(`Error: Skill '${skillName}' not found`));
    console.error(chalk.gray(`  Hint: Run "list" to see available skills`));
    process.exit(1);
  }

  if (result.valid) {
    const m = result.metadata || {};
    console.log(chalk.bold.green(`VALID: ${skillName}`));
    if (m.name)        console.log(`  Name:        ${m.name}`);
    if (m.version)     console.log(`  Version:     ${m.version}`);
    if (m.category)    console.log(`  Category:    ${m.category}`);
    if (Array.isArray(m.tags)) console.log(`  Tags:        ${m.tags.length} tag${m.tags.length !== 1 ? 's' : ''}`);
    if (m.always_load !== undefined) console.log(`  Always Load: ${m.always_load}`);
  } else {
    console.log(chalk.bold.red(`INVALID: ${skillName}`));
    console.log(`  Errors:`);
    result.errors.forEach(e => console.log(`  - ${e}`));
  }

  if (result.warnings && result.warnings.length > 0) {
    if (result.valid) console.log(`  Warnings:`);
    result.warnings.forEach(w => console.log(chalk.yellow(`  - ${w}`)));
  }

  process.exit(result.valid ? 0 : 1);
}

/**
 * Toggle the always_load flag on a skill's skill.json.
 * @param {string} skillName  kebab-case skill name
 * @param {boolean} enable    true = mandatory, false = optional
 * @param {string} [skillsDir]  base skills directory (defaults to <cwd>/skills)
 * @returns {{ success: boolean, error?: string, hint?: string }}
 */
function setMandatory(skillName, enable, skillsDir) {
  const baseDir = skillsDir || path.join(process.cwd(), 'skills');
  const skillDir = path.join(baseDir, skillName);
  const skillJsonPath = path.join(skillDir, 'skill.json');

  // Prevent path traversal
  if (!isWithinDir(skillDir, baseDir)) {
    return { success: false, error: `Invalid skill name '${skillName}'`, hint: 'Skill names must be lowercase kebab-case' };
  }

  if (!fs.existsSync(skillJsonPath)) {
    return {
      success: false,
      error: `Skill '${skillName}' not found`,
      hint: `Run "list" to see available skills`
    };
  }

  let data;
  try {
    data = JSON.parse(fs.readFileSync(skillJsonPath, 'utf8'));
  } catch (_) {
    return {
      success: false,
      error: `skill.json for '${skillName}' is not valid JSON`,
      hint: `Fix skill.json before updating always_load`
    };
  }

  data.always_load = enable;

  try {
    fs.writeFileSync(skillJsonPath, JSON.stringify(data, null, 2) + '\n', 'utf8');
  } catch (err) {
    return {
      success: false,
      error: `Failed to write skill.json: ${err.message}`,
      hint: `Check file permissions and try again`
    };
  }

  return { success: true, enable };
}

/**
 * CLI handler for the set-mandatory command.
 * @param {string[]} args  CLI arguments after 'set-mandatory'
 */
async function handleSetMandatory(args) {
  const { generateSkillsManifest } = require('./installer');

  const skillName = args[0];

  if (!skillName) {
    console.error(chalk.red('Error: Skill name is required'));
    console.error(chalk.gray('  Hint: Usage: npx ma-agents set-mandatory <skill-name> [--off]'));
    process.exit(1);
  }

  const enable = !args.includes('--off');
  const result = setMandatory(skillName, enable);

  if (!result.success) {
    console.error(chalk.red(`Error: ${result.error}`));
    console.error(chalk.gray(`  Hint: ${result.hint}`));
    process.exit(1);
  }

  if (enable) {
    console.log(chalk.green(`Skill '${skillName}' is now mandatory (always_load: true)`));
  } else {
    console.log(chalk.yellow(`Skill '${skillName}' is no longer mandatory (always_load: false)`));
  }

  // Regenerate MANIFEST.yaml to reflect the change (best-effort — no-op if no install found)
  try {
    await generateSkillsManifest(process.cwd());
  } catch (_) {
    // Not fatal — MANIFEST.yaml will be updated on next install
  }
}

// ─── Story 3.4: BMAD Persona Customization Tooling ───────────────────────────

// Story 30.4 / FR244-FR247: 'bmm-demerzel' removed — Demerzel is deprecated for
// new installs (see lib/agents.js for the full rationale).
const CUSTOM_AGENTS = ['bmm-sre', 'bmm-devops', 'bmm-cyber', 'bmm-qa'];
const BUILTIN_AGENTS = ['bmm-pm', 'bmm-architect', 'bmm-dev', 'bmm-sm', 'bmm-tech-writer', 'bmm-ux-designer'];

const MANDATORY_CRITICAL_ACTIONS = {
  1: 'Read the skills MANIFEST at skills/MANIFEST.yaml (relative to project root)',
  2: 'For each skill marked always_load: true, read the skill file completely',
  3: 'Follow all skill directives during this session'
};

/**
 * Validate a BMAD agent name.
 * @param {string} agentName
 * @returns {{ valid: boolean, type?: 'custom'|'builtin', hint?: string }}
 */
function validateBmadAgent(agentName) {
  if (!agentName) {
    const all = [...CUSTOM_AGENTS, ...BUILTIN_AGENTS].join(', ');
    return { valid: false, hint: `Agent name is required. Available: ${all}` };
  }
  if (CUSTOM_AGENTS.includes(agentName)) {
    return { valid: true, type: 'custom' };
  }
  if (BUILTIN_AGENTS.includes(agentName)) {
    return { valid: true, type: 'builtin' };
  }
  const all = [...CUSTOM_AGENTS, ...BUILTIN_AGENTS].join(', ');
  return { valid: false, hint: `Unknown agent '${agentName}'. Available: ${all}` };
}

/**
 * Generate YAML content for a customize file.
 * @param {string} agentName
 * @param {object} data  Optional: { persona, menu, extraActions }
 * @param {'custom'|'builtin'} agentType
 * @returns {string}
 */
function generateCustomizeYaml(agentName, data, agentType) {
  const lines = [];
  lines.push(`# Customization file for ${agentName}`);
  lines.push('# Generated by ma-agents customize-agent');
  lines.push('');

  if (agentType === 'custom') {
    // Persona section (optional)
    if (data.persona) {
      lines.push('persona:');
      lines.push(`  role: ${yamlStr(data.persona.role)}`);
      lines.push(`  identity: ${yamlStr(data.persona.identity)}`);
      lines.push(`  communication_style: ${yamlStr(data.persona.communication_style)}`);
      if (Array.isArray(data.persona.principles) && data.persona.principles.length > 0) {
        lines.push('  principles:');
        data.persona.principles.forEach(p => lines.push(`    - ${yamlStr(p)}`));
      }
      lines.push('');
    }

    // Menu section (optional)
    if (Array.isArray(data.menu) && data.menu.length > 0) {
      lines.push('menu:');
      data.menu.forEach(item => {
        lines.push(`  - trigger: ${yamlStr(item.trigger)}`);
        lines.push(`    workflow: ${yamlStr(item.workflow)}`);
        lines.push(`    description: ${yamlStr(item.description)}`);
      });
      lines.push('');
    }
  }

  // Critical actions — mandatory 1-3 are immutable
  lines.push('critical_actions:');
  lines.push(`  1: "${MANDATORY_CRITICAL_ACTIONS[1]}"`);
  lines.push(`  2: "${MANDATORY_CRITICAL_ACTIONS[2]}"`);
  lines.push(`  3: "${MANDATORY_CRITICAL_ACTIONS[3]}"`);

  // Extra actions appended starting at 4 (custom agents only)
  if (agentType === 'custom' && data.extraActions) {
    const keys = Object.keys(data.extraActions).map(Number).sort((a, b) => a - b);
    for (const k of keys) {
      if (k >= 4) {
        lines.push(`  ${k}: ${yamlStr(data.extraActions[k])}`);
      }
    }
  }

  lines.push('');
  return lines.join('\n');
}

/**
 * Write a customize YAML file to the agents directory.
 * @param {string} agentName
 * @param {string} yamlContent
 * @param {string} agentsDir
 */
function writeCustomizeFile(agentName, yamlContent, agentsDir) {
  fs.mkdirSync(agentsDir, { recursive: true });
  const filePath = path.join(agentsDir, `${agentName}.customize.yaml`);
  fs.writeFileSync(filePath, yamlContent, 'utf8');
}

/**
 * Load existing customization file content, or null if not found.
 * @param {string} agentName
 * @param {string} agentsDir
 * @returns {string|null}
 */
function loadExistingCustomization(agentName, agentsDir) {
  const filePath = path.join(agentsDir, `${agentName}.customize.yaml`);
  if (!fs.existsSync(filePath)) return null;
  return fs.readFileSync(filePath, 'utf8');
}

/**
 * CLI handler for the customize-agent command.
 * @param {string[]} args  CLI arguments after 'customize-agent'
 */
async function handleCustomizeAgent(args) {
  const agentName = args[0];
  const yesFlag = args.includes('--yes');

  if (!agentName) {
    console.error(chalk.red('Error: Agent name is required'));
    console.error(chalk.gray('  Hint: Usage: npx ma-agents customize-agent <agent-name>'));
    process.exit(1);
  }

  const validation = validateBmadAgent(agentName);
  if (!validation.valid) {
    console.error(chalk.red(`Error: Unknown agent '${agentName}'`));
    console.error(chalk.gray(`  Hint: ${validation.hint}`));
    process.exit(1);
  }

  const agentsDir = path.join(process.cwd(), 'lib', 'bmad-extension', 'agents');

  if (yesFlag) {
    const yaml = generateCustomizeYaml(agentName, {}, validation.type);
    writeCustomizeFile(agentName, yaml, agentsDir);
    console.log(chalk.green(`Customization file generated for ${agentName} (non-interactive mode)`));
    return;
  }

  // Interactive: generate file with defaults
  const yaml = generateCustomizeYaml(agentName, {}, validation.type);
  writeCustomizeFile(agentName, yaml, agentsDir);
  console.log(chalk.green(`Customization file generated for ${agentName}`));
}

// ─── Story 3.5: Specialized Agent Development Tooling ────────────────────────

const BMM_AGENT_NAME_PATTERN = /^bmm-[a-z][a-z0-9]*(-[a-z0-9]+)*$/;
const ALL_KNOWN_AGENTS = new Set([...CUSTOM_AGENTS, ...BUILTIN_AGENTS]);

/**
 * Validate and normalize a BMAD agent name for creation.
 * Auto-prepends 'bmm-' if missing. Checks for conflicts.
 * @param {string} name  Raw agent name from user
 * @returns {{ valid: boolean, name?: string, normalized?: boolean, error?: string, hint?: string }}
 */
function validateAgentName(name) {
  if (!name) {
    return { valid: false, error: 'Agent name is required', hint: 'Usage: npx ma-agents create-agent <agent-name>' };
  }

  // Auto-prepend bmm- if missing
  let normalized = false;
  let agentName = name;
  if (!agentName.startsWith('bmm-')) {
    agentName = `bmm-${agentName}`;
    normalized = true;
  }

  // Validate pattern
  if (!BMM_AGENT_NAME_PATTERN.test(agentName)) {
    return {
      valid: false,
      error: `Agent name '${agentName}' is not valid`,
      hint: 'Use kebab-case with bmm- prefix, e.g. bmm-my-role'
    };
  }

  // Check against known agents (builtin + custom)
  if (ALL_KNOWN_AGENTS.has(agentName)) {
    return {
      valid: false,
      error: `Agent '${agentName}' already exists`,
      hint: 'Use customize-agent to modify it, or choose a different name'
    };
  }

  return { valid: true, name: agentName, normalized };
}

/**
 * Generate a template-filled YAML for a new custom agent.
 * @param {string} agentName
 * @returns {string}
 */
function generateAgentTemplate(agentName) {
  const lines = [];
  lines.push(`# Customization file for ${agentName}`);
  lines.push('# Generated by ma-agents create-agent');
  lines.push('# Edit this file to define your agent persona, menu, and actions');
  lines.push('');
  lines.push('persona:');
  lines.push(`  role: "<Role title for ${agentName}>"`);
  lines.push('  identity: "<Expert description of this agent\'s expertise and focus.>"');
  lines.push('  communication_style: "<How this agent communicates — tone, style, priorities.>"');
  lines.push('  principles:');
  lines.push('    - "<Core principle 1>"');
  lines.push('    - "<Core principle 2>"');
  lines.push('');
  lines.push('menu:');
  lines.push('  - trigger: <command-trigger>');
  lines.push('    workflow: workflows/<workflow-name>/workflow.md');
  lines.push('    description: "<Description of this workflow>"');
  lines.push('');
  lines.push('critical_actions:');
  lines.push(`  1: "${MANDATORY_CRITICAL_ACTIONS[1]}"`);
  lines.push(`  2: "${MANDATORY_CRITICAL_ACTIONS[2]}"`);
  lines.push(`  3: "${MANDATORY_CRITICAL_ACTIONS[3]}"`);
  lines.push('');
  return lines.join('\n');
}

/**
 * Create a new specialized BMAD agent customize file.
 * @param {string} agentName  Validated (normalized) agent name
 * @param {string} [agentsDir]  Target directory (defaults to <cwd>/lib/bmad-extension/agents)
 * @returns {{ success: boolean, filePath?: string, error?: string, hint?: string }}
 */
function createBmadAgent(agentName, agentsDir) {
  const baseDir = agentsDir || path.join(process.cwd(), 'lib', 'bmad-extension', 'agents');
  const filePath = path.join(baseDir, `${agentName}.customize.yaml`);

  // Prevent path traversal
  if (!isWithinDir(filePath, baseDir)) {
    return { success: false, error: `Invalid agent name '${agentName}'`, hint: 'Agent names must use bmm- prefix and lowercase kebab-case' };
  }

  if (fs.existsSync(filePath)) {
    return {
      success: false,
      error: `Agent '${agentName}' already exists at ${filePath}`,
      hint: 'Use customize-agent to modify it, or choose a different name'
    };
  }

  try {
    fs.mkdirSync(baseDir, { recursive: true });
    const yaml = generateAgentTemplate(agentName);
    fs.writeFileSync(filePath, yaml, 'utf8');
  } catch (err) {
    return {
      success: false,
      error: `Failed to create agent '${agentName}': ${err.message}`,
      hint: 'Check directory permissions and try again'
    };
  }

  return { success: true, filePath };
}

/**
 * CLI handler for the create-agent command.
 * @param {string[]} args  CLI arguments after 'create-agent'
 */
async function handleCreateAgent(args) {
  const rawName = args[0];
  const yesFlag = args.includes('--yes');

  if (!rawName) {
    console.error(chalk.red('Error: Agent name is required'));
    console.error(chalk.gray('  Hint: Usage: npx ma-agents create-agent <agent-name>'));
    process.exit(1);
  }

  const validation = validateAgentName(rawName);
  if (!validation.valid) {
    console.error(chalk.red(`Error: ${validation.error}`));
    console.error(chalk.gray(`  Hint: ${validation.hint}`));
    process.exit(1);
  }

  const agentName = validation.name;

  if (validation.normalized) {
    console.log(chalk.gray(`  Agent name normalized to '${agentName}'`));
  }

  const agentsDir = path.join(process.cwd(), 'lib', 'bmad-extension', 'agents');

  // Check for file conflict (beyond known agent lists)
  const filePath = path.join(agentsDir, `${agentName}.customize.yaml`);
  if (fs.existsSync(filePath)) {
    console.error(chalk.red(`Error: Agent '${agentName}' already exists`));
    console.error(chalk.gray('  Hint: Use customize-agent to modify it, or choose a different name'));
    process.exit(1);
  }

  const result = createBmadAgent(agentName, agentsDir);

  if (!result.success) {
    console.error(chalk.red(`Error: ${result.error}`));
    console.error(chalk.gray(`  Hint: ${result.hint}`));
    process.exit(1);
  }

  const displayPath = path.join('lib', 'bmad-extension', 'agents', `${agentName}.customize.yaml`);
  console.log(chalk.green(`Agent '${agentName}' created at ${displayPath}`));
  console.log(chalk.gray('  Next steps:'));
  console.log(chalk.gray('  1. Review and refine the persona in the .customize.yaml file'));
  console.log(chalk.gray('  2. Run \'npx ma-agents install\' to deploy the extension module'));
  console.log(chalk.gray('  3. Run \'npx bmad-method install --action recompile\' to activate the agent'));
  console.log(chalk.gray('  4. The agent will appear in the BMAD agent menu'));
}

module.exports = {
  validateSkillName, createSkill, handleCreateSkill,
  validateSkill, handleValidateSkill,
  setMandatory, handleSetMandatory,
  validateBmadAgent, generateCustomizeYaml, writeCustomizeFile, loadExistingCustomization, handleCustomizeAgent,
  validateAgentName, createBmadAgent, handleCreateAgent,
  kebabToTitleCase
};
