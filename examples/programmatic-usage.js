/**
 * Example: Using ai-agent-skills programmatically
 *
 * This example shows how to use the package as a library
 * instead of through the interactive CLI.
 */

const { installSkill, listSkills, listAgents, getAgent } = require('../index');

async function example() {
  console.log('=== AI Agent Skills - Programmatic Usage ===\n');

  // List all available skills
  console.log('Available Skills:');
  const skills = listSkills();
  skills.forEach(skill => {
    console.log(`  - ${skill.name}: ${skill.description}`);
  });

  // List all supported agents
  console.log('\nSupported Agents:');
  const agents = listAgents();
  agents.forEach(agent => {
    console.log(`  - ${agent.name}: ${agent.description}`);
  });

  // Get specific agent info
  console.log('\nClaude Code Agent Info:');
  const claudeAgent = getAgent('claude-code');
  console.log(`  Name: ${claudeAgent.name}`);
  console.log(`  Skills Path: ${claudeAgent.getSkillsPath()}`);
  console.log(`  File Extension: ${claudeAgent.fileExtension}`);

  // Install a skill for specific agents
  console.log('\nInstalling code-review skill for Claude Code and Cline...');
  try {
    await installSkill(
      'code-review',           // skill ID
      ['claude-code', 'cline'], // agent IDs
      ''                        // custom path (empty for default)
    );
    console.log('✓ Installation complete!');
  } catch (error) {
    console.error('✗ Installation failed:', error.message);
  }

  // Install with custom path
  console.log('\nInstalling to custom path...');
  try {
    await installSkill(
      'test-generator',
      ['claude-code'],
      './my-custom-skills'  // custom installation path
    );
    console.log('✓ Installation to custom path complete!');
  } catch (error) {
    console.error('✗ Installation failed:', error.message);
  }
}

// Run the example
example().catch(console.error);
