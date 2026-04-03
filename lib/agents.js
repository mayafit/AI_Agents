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
    injectionStrategy: { position: 'top', skipPatterns: ['---'] }
  },
  {
    id: 'copilot',
    name: 'GitHub Copilot',
    version: '1.0.0',
    category: 'ide',
    description: 'GitHub Copilot Agent Mode',
    skillsDir: '.github/copilot/skills',
    getProjectPath: () => path.join(process.cwd(), '.github', 'copilot', 'skills'),
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
    instructionFiles: ['.github/copilot/copilot.md'],
    injectionStrategy: { position: 'top', skipPatterns: ['---'] }
  },
  {
    id: 'kilocode',
    name: 'Kilocode',
    version: '1.0.0',
    category: 'ide',
    description: 'Kilocode AI Assistant',
    skillsDir: '.kilocode/skills',
    getProjectPath: () => path.join(process.cwd(), '.kilocode', 'skills'),
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
    instructionFiles: ['.cline/clinerules.md', '.clinerules'],
    injectionStrategy: { position: 'top', skipPatterns: ['---'] }
  },
  {
    id: 'roo-code',
    name: 'Roo Code',
    version: '1.0.0',
    category: 'ide',
    description: 'Roo Code AI Assistant (Enhanced Cline fork)',
    skillsDir: '.roo/skills',
    getProjectPath: () => path.join(process.cwd(), '.roo', 'skills'),
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
    instructionFiles: ['.roo/rules/00-ma-agents.md'],
    injectionStrategy: { position: 'top', skipPatterns: ['---'] }
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
    injectionStrategy: { position: 'top', skipPatterns: ['---'] }
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
    injectionStrategy: { position: 'top', skipPatterns: ['---'] }
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
    injectionStrategy: { position: 'json-merge', targetKey: 'instructions' }
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
    id: 'bmm-mil498',
    name: 'MIL-STD-498 Expert',
    version: '2.0.0',
    category: 'bmad',
    description: 'MIL-STD-498 Documentation Expert',
    skillsDir: '_bmad/skills/mil498',
    getProjectPath: () => path.join(process.cwd(), '_bmad', 'skills', 'mil498'),
    getGlobalPath: () => null,
    fileExtension: '.md',
    template: 'generic',
    instructionFiles: ['_bmad/bmm/agents/mil498.md'],
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

module.exports = {
  getAgent,
  getAllAgents,
  getAgentsByCategory
};
