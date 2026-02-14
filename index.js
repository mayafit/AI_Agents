/**
 * AI Agent Skills - Programmatic API
 *
 * This module exports the core functionality for use as a library.
 * For CLI usage, use: npx ai-agent-skills
 */

const { installSkill, listSkills, listAgents } = require('./lib/installer');
const { getAgent, getAllAgents } = require('./lib/agents');

module.exports = {
  // Installer functions
  installSkill,
  listSkills,
  listAgents,

  // Agent functions
  getAgent,
  getAllAgents
};
