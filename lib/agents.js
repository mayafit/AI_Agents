const os = require('os');
const path = require('path');

/**
 * Agent configurations
 * Each agent has:
 * - id: unique identifier
 * - name: display name
 * - category: 'ide' for AI coding assistants, 'bmad' for BMAD-METHOD agents
 * - description: brief description
 * - getProjectPath: function that returns the project-level skills directory (relative to cwd)
 * - getGlobalPath: function that returns the global/user-level skills directory
 * - fileExtension: the file extension for skill files
 * - template: the template type to use for this agent
 */

const agents = [
  {
    id: 'claude-code',
    name: 'Claude Code',
    version: '1.0.0',
    category: 'ide',
    description: 'Anthropic Claude Code CLI',
    skillsDir: '.claude/skills',
    getProjectPath: () => path.join(process.cwd(), '.claude', 'skills'),
    getGlobalPath: () => {
      const platform = os.platform();
      if (platform === 'win32') {
        return path.join(os.homedir(), 'AppData', 'Roaming', 'Claude', 'skills');
      } else if (platform === 'darwin') {
        return path.join(os.homedir(), 'Library', 'Application Support', 'Claude', 'skills');
      } else {
        return path.join(os.homedir(), '.config', 'claude', 'skills');
      }
    },
    fileExtension: '.md',
    template: 'claude-code',
    instructionFiles: ['.claude/CLAUDE.md'],
    injectionStrategy: { position: 'top', skipPatterns: ['---'] }
  },
  {
    id: 'gemini',
    name: 'Google Gemini',
    version: '1.0.0',
    category: 'ide',
    description: 'Google Gemini Code Assist',
    skillsDir: '.gemini/skills',
    getProjectPath: () => path.join(process.cwd(), '.gemini', 'skills'),
    getGlobalPath: () => {
      const platform = os.platform();
      if (platform === 'win32') {
        return path.join(os.homedir(), 'AppData', 'Roaming', 'Gemini', 'skills');
      } else if (platform === 'darwin') {
        return path.join(os.homedir(), 'Library', 'Application Support', 'Gemini', 'skills');
      } else {
        return path.join(os.homedir(), '.config', 'gemini', 'skills');
      }
    },
    fileExtension: '.md',
    template: 'generic',
    instructionFiles: ['.gemini/gemini.md'],
    injectionStrategy: { position: 'top', skipPatterns: ['---'] },
    // F2b — Story 22.10 designated the five flagship tools (claude-code,
    // copilot, cline, roo-code, kilocode) as the multi-tool smoke matrix.
    // Tools outside that set are deliberately not on the parity safety
    // net — they receive personas via the same BMAD pipeline (so the fix
    // generalizes), but their multi-tool smoke coverage is a separate
    // expansion decision (tracked outside F2b).
    nonFlagship: true
  },
  {
    id: 'copilot',
    name: 'GitHub Copilot',
    version: '1.0.0',
    category: 'ide',
    description: 'GitHub Copilot Agent Mode',
    // bmad-method 6.5.0 moved `github-copilot`, `roo`, and `kilo` platforms
    // from their tool-specific directories to the shared `.agents/skills/`
    // tree (see platform-codes.yaml). Aligning here keeps the smoke verifier
    // and all downstream consumers in sync with BMAD's actual write target.
    // The skill-bootstrap instructions MUST live in `.github/copilot-instructions.md`
    // — that is the only repository custom-instructions file GitHub Copilot reads
    // (VS Code, Visual Studio, github.com; per the PRD agent table). The earlier
    // `.github/copilot/copilot.md` path was never loaded by Copilot, so installed
    // skills were invisible to it.
    skillsDir: '.agents/skills',
    getProjectPath: () => path.join(process.cwd(), '.agents', 'skills'),
    getGlobalPath: () => {
      const platform = os.platform();
      if (platform === 'win32') {
        return path.join(os.homedir(), 'AppData', 'Roaming', 'GitHub Copilot', 'skills');
      } else if (platform === 'darwin') {
        return path.join(os.homedir(), 'Library', 'Application Support', 'GitHub Copilot', 'skills');
      } else {
        return path.join(os.homedir(), '.config', 'github-copilot', 'skills');
      }
    },
    fileExtension: '.md',
    template: 'generic',
    bmadPlatformCode: 'github-copilot',
    instructionFiles: ['.github/copilot-instructions.md'],
    injectionStrategy: { position: 'top', skipPatterns: ['---'] }
  },
  {
    id: 'kilocode',
    name: 'Kilocode',
    version: '1.0.0',
    category: 'ide',
    description: 'Kilocode AI Assistant',
    skillsDir: '.agents/skills',
    getProjectPath: () => path.join(process.cwd(), '.agents', 'skills'),
    getGlobalPath: () => {
      const platform = os.platform();
      if (platform === 'win32') {
        return path.join(os.homedir(), 'AppData', 'Roaming', 'Kilocode', 'skills');
      } else if (platform === 'darwin') {
        return path.join(os.homedir(), 'Library', 'Application Support', 'Kilocode', 'skills');
      } else {
        return path.join(os.homedir(), '.config', 'kilocode', 'skills');
      }
    },
    fileExtension: '.md',
    template: 'generic',
    bmadPlatformCode: 'kilo',
    instructionFiles: ['.kilocode/kilocode.md'],
    injectionStrategy: { position: 'top', skipPatterns: ['---'] }
  },
  {
    id: 'cline',
    name: 'Cline',
    version: '1.0.0',
    category: 'ide',
    description: 'Cline AI Assistant',
    skillsDir: '.cline/skills',
    getProjectPath: () => path.join(process.cwd(), '.cline', 'skills'),
    getGlobalPath: () => {
      const platform = os.platform();
      if (platform === 'win32') {
        return path.join(os.homedir(), 'AppData', 'Roaming', 'Code', 'User', 'globalStorage', 'saoudrizwan.claude-dev', 'skills');
      } else if (platform === 'darwin') {
        return path.join(os.homedir(), 'Library', 'Application Support', 'Code', 'User', 'globalStorage', 'saoudrizwan.claude-dev', 'skills');
      } else {
        return path.join(os.homedir(), '.config', 'Code', 'User', 'globalStorage', 'saoudrizwan.claude-dev', 'skills');
      }
    },
    fileExtension: '.md',
    template: 'cline',
    // Cline uses different directory names than the generic structure
    resourceMap: {
      'references': 'docs',
      'assets': 'templates'
    },
    instructionFiles: ['.cline/clinerules.md'],
    injectionStrategy: { position: 'top', skipPatterns: ['---'] }
  },
  {
    id: 'roo-code',
    name: 'Roo Code',
    version: '1.0.0',
    category: 'ide',
    description: 'Roo Code AI Assistant (Enhanced Cline fork)',
    skillsDir: '.agents/skills',
    getProjectPath: () => path.join(process.cwd(), '.agents', 'skills'),
    getGlobalPath: () => {
      const platform = os.platform();
      if (platform === 'win32') {
        return path.join(os.homedir(), 'AppData', 'Roaming', 'Code', 'User', 'globalStorage', 'rooveterinaryinc.roo-cline', 'skills');
      } else if (platform === 'darwin') {
        return path.join(os.homedir(), 'Library', 'Application Support', 'Code', 'User', 'globalStorage', 'rooveterinaryinc.roo-cline', 'skills');
      } else {
        return path.join(os.homedir(), '.config', 'Code', 'User', 'globalStorage', 'rooveterinaryinc.roo-cline', 'skills');
      }
    },
    fileExtension: '.md',
    template: 'generic',
    bmadPlatformCode: 'roo',
    instructionFiles: ['.roo/rules/00-ma-agents.md'],
    injectionStrategy: { position: 'top', skipPatterns: ['---'] },
    // Story 21.3 AC #3 — extra YAML template stamped at project root so Roo
    // Code's FileRestrictionError (NFR47) gates BMAD-mode edits at the IDE
    // layer. Processed by applyExtraInstructionTemplates in lib/installer.js.
    extraInstructionTemplates: [
      { template: 'roomodes.template.yaml', target: '.roomodes', merger: 'yaml-customModes' }
    ]
  },
  {
    id: 'cursor',
    name: 'Cursor',
    version: '1.0.0',
    category: 'ide',
    description: 'Cursor AI Editor',
    skillsDir: '.cursor/skills',
    getProjectPath: () => path.join(process.cwd(), '.cursor', 'skills'),
    getGlobalPath: () => {
      const platform = os.platform();
      if (platform === 'win32') {
        return path.join(os.homedir(), 'AppData', 'Roaming', 'Cursor', 'User', 'skills');
      } else if (platform === 'darwin') {
        return path.join(os.homedir(), 'Library', 'Application Support', 'Cursor', 'User', 'skills');
      } else {
        return path.join(os.homedir(), '.config', 'Cursor', 'User', 'skills');
      }
    },
    fileExtension: '.md',
    template: 'generic',
    instructionFiles: ['.cursor/cursor.md'],
    injectionStrategy: { position: 'top', skipPatterns: ['---'] },
    // F2b — see comment on `gemini` registry entry. Not on the Story 22.10
    // flagship-five matrix.
    nonFlagship: true
  },
  {
    id: 'bmm-sre',
    name: 'SRE Agent',
    version: '1.0.0',
    category: 'bmad',
    description: 'Specialized SRE Agent for BMAD-METHOD',
    skillsDir: '_bmad/skills/sre',
    getProjectPath: () => path.join(process.cwd(), '_bmad', 'skills', 'sre'),
    getGlobalPath: () => null,
    fileExtension: '.md',
    template: 'generic',
    instructionFiles: ['_bmad/bmm/agents/sre.md'],
    injectionStrategy: { position: 'top', skipPatterns: ['---'] }
  },
  {
    id: 'antigravity',
    name: 'Antigravity',
    version: '1.0.0',
    category: 'ide',
    description: 'Google Deepmind Antigravity Agent',
    skillsDir: '.antigravity/skills',
    getProjectPath: () => path.join(process.cwd(), '.antigravity', 'skills'),
    getGlobalPath: () => {
      const platform = os.platform();
      if (platform === 'win32') {
        return path.join(os.homedir(), 'AppData', 'Roaming', 'Antigravity', 'skills');
      } else if (platform === 'darwin') {
        return path.join(os.homedir(), 'Library', 'Application Support', 'Antigravity', 'skills');
      } else {
        return path.join(os.homedir(), '.config', 'antigravity', 'skills');
      }
    },
    fileExtension: '.md',
    template: 'generic',
    instructionFiles: ['.antigravity/antigravity.md'],
    injectionStrategy: { position: 'top', skipPatterns: ['---'] },
    // F2b — see comment on `gemini` registry entry. Not on the Story 22.10
    // flagship-five matrix.
    nonFlagship: true
  },
  {
    id: 'opencode',
    name: 'OpenCode',
    version: '1.0.0',
    category: 'ide',
    description: 'OpenCode AI Assistant',
    skillsDir: '.opencode/skills',
    getProjectPath: () => path.join(process.cwd(), '.opencode', 'skills'),
    getGlobalPath: () => {
      const platform = os.platform();
      if (platform === 'win32') {
        return path.join(os.homedir(), 'AppData', 'Roaming', 'opencode', 'skills');
      } else if (platform === 'darwin') {
        return path.join(os.homedir(), 'Library', 'Application Support', 'opencode', 'skills');
      } else {
        return path.join(os.homedir(), '.config', 'opencode', 'skills');
      }
    },
    fileExtension: '.md',
    template: 'generic',
    instructionFiles: ['opencode.json'],
    injectionStrategy: { position: 'json-merge', targetKey: 'instructions' },
    // Story 21.4 — OpenCode auto-loads AGENTS.md when the file is listed in
    // opencode.json::instructions[]. The extraInstructionTemplates field names
    // the template shipped at lib/templates/<template>, the target path
    // (relative to project root) to stamp, and the merger strategy. Processed
    // by updateAgentInstructions in lib/installer.js in addition to the JSON
    // merge above.
    extraInstructionTemplates: [
      { template: 'agents-md.template.md', target: 'AGENTS.md', merger: 'markdown-markers' }
    ],
    // F2b — see comment on `gemini` registry entry. Not on the Story 22.10
    // flagship-five matrix.
    nonFlagship: true
  },
  {
    id: 'bmm-devops',
    name: 'DevOps Agent',
    version: '1.0.0',
    category: 'bmad',
    description: 'Specialized DevOps Agent for BMAD-METHOD',
    skillsDir: '_bmad/skills/devops',
    getProjectPath: () => path.join(process.cwd(), '_bmad', 'skills', 'devops'),
    getGlobalPath: () => null,
    fileExtension: '.md',
    template: 'generic',
    instructionFiles: ['_bmad/bmm/agents/devops.md'],
    injectionStrategy: { position: 'top', skipPatterns: ['---'] }
  },
  {
    id: 'bmm-cyber',
    name: 'Cyber Analyst',
    version: '1.0.0',
    category: 'bmad',
    description: 'Specialized Cyber Security Analyst (Yael) for BMAD-METHOD',
    skillsDir: '_bmad/skills/cyber',
    getProjectPath: () => path.join(process.cwd(), '_bmad', 'skills', 'cyber'),
    getGlobalPath: () => null,
    fileExtension: '.md',
    template: 'generic',
    instructionFiles: ['_bmad/bmm/agents/cyber.md'],
    injectionStrategy: { position: 'top', skipPatterns: ['---'] }
  },
  {
    id: 'bmm-qa',
    name: 'SQA & Standards Expert (Gad)',
    version: '1.0.0',
    category: 'bmad',
    description: 'Software Quality Assurance and MIL-STD-498 Standards Expert (Gad)',
    skillsDir: '_bmad/skills/sqa',
    getProjectPath: () => path.join(process.cwd(), '_bmad', 'skills', 'sqa'),
    getGlobalPath: () => null,
    fileExtension: '.md',
    template: 'generic',
    instructionFiles: ['_bmad/bmm/agents/qa.md'],
    injectionStrategy: { position: 'top', skipPatterns: ['---'] }
  },
  {
    id: 'bmm-demerzel',
    name: 'ML Scientist (Demerzel)',
    version: '1.0.0',
    category: 'bmad',
    description: 'Machine Learning Lifecycle Agent (Demerzel)',
    skillsDir: '_bmad/skills/demerzel',
    getProjectPath: () => path.join(process.cwd(), '_bmad', 'skills', 'demerzel'),
    getGlobalPath: () => null,
    fileExtension: '.md',
    template: 'generic',
    instructionFiles: ['_bmad/bmm/agents/demerzel.md'],
    injectionStrategy: { position: 'top', skipPatterns: ['---'] }
  }
  // DEFERRED (Story 28.3 / Decision P5-6(d), FR214): BMAD v6.9.0 adds two new
  // installer platform targets — `hermes` (Hermes Agent) and `codewhale`
  // (CodeWhale). They are intentionally NOT added to this registry. Passthrough
  // already deploys upstream support via the BMAD installer; first-class adoption
  // would pull the full per-tool routing / instruction-injection / skill-
  // resolution stack into ma-agents for two platforms with no current demand.
  // Add them here in a dedicated future story if/when demand appears.
];

function getAgent(agentId) {
  return agents.find(a => a.id === agentId);
}

function getAllAgents() {
  return agents;
}

function getAgentsByCategory(category) {
  return agents.filter(a => a.category === category);
}

/**
 * Returns the bmad-method platform code for a given ma-agents agent ID.
 * Some agents use a different code in bmad-method's platform-codes.yaml
 * (e.g. ma-agents 'roo-code' → bmad-method 'roo').
 * Falls back to the agent ID itself if no override is defined.
 */
function getBmadPlatformCode(agentId) {
  const agent = getAgent(agentId);
  return (agent && agent.bmadPlatformCode) ? agent.bmadPlatformCode : agentId;
}

module.exports = {
  getAgent,
  getAllAgents,
  getAgentsByCategory,
  getBmadPlatformCode
};
