const os = require('os');
const path = require('path');

/**
 * Agent configurations
 * Each agent has:
 * - id: unique identifier
 * - name: display name
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
    description: 'Anthropic Claude Code CLI',
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
    template: 'claude-code'
  },
  {
    id: 'gemini',
    name: 'Google Gemini',
    version: '1.0.0',
    description: 'Google Gemini Code Assist',
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
    template: 'generic'
  },
  {
    id: 'copilot',
    name: 'GitHub Copilot',
    version: '1.0.0',
    description: 'GitHub Copilot Agent Mode',
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
    template: 'generic'
  },
  {
    id: 'kilocode',
    name: 'Kilocode',
    version: '1.0.0',
    description: 'Kilocode AI Assistant',
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
    template: 'generic'
  },
  {
    id: 'cline',
    name: 'Cline',
    version: '1.0.0',
    description: 'Cline AI Assistant',
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
    }
  },
  {
    id: 'cursor',
    name: 'Cursor',
    version: '1.0.0',
    description: 'Cursor AI Editor',
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
    template: 'generic'
  }
];

function getAgent(agentId) {
  return agents.find(a => a.id === agentId);
}

function getAllAgents() {
  return agents;
}

module.exports = {
  getAgent,
  getAllAgents
};
