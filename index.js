/**
 * ma-agents - Programmatic API
 *
 * This module exports the core functionality for use as a library.
 * For CLI usage, use: npx ma-agents
 */

const { installSkill, uninstallSkill, getStatus, listSkills, listAgents, readManifest, getInstalledSkillInfo, compareSemver } = require('./lib/installer');
const { getAgent, getAllAgents } = require('./lib/agents');

module.exports = {
  installSkill,
  uninstallSkill,
  getStatus,
  listSkills,
  listAgents,
  readManifest,
  getInstalledSkillInfo,
  compareSemver,
  getAgent,
  getAllAgents
};
