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
    // Story 30.9 — registry-driven capability flags replace the previous
    // `agent.id === 'cline'` literal checks in lib/installer.js.
    // `dualFileDriftCheck` opts this agent into the legacy
    // `.cline/clinerules.md` vs `.clinerules`-file drift guard (Story 21.5
    // AC #6). `framingTemplate` names the fresh-file framing template
    // (relative to lib/templates/) used when creating the instruction file
    // from scratch (Story 21.5 AC #1/#2). Both are absent (falsy) on every
    // other agent — installer.js treats that as "skip this behavior".
    injectionStrategy: {
      position: 'top',
      skipPatterns: ['---'],
      dualFileDriftCheck: true,
      framingTemplate: 'clinerules.template.md'
    }
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
    // Bug `antigravity-path-divergence`: this used to read `.antigravity/skills`,
    // a path ma-agents invented from its own per-tool naming convention. Upstream
    // bmad-method maps the SAME tool to `.agent/skills`
    // (node_modules/bmad-method/tools/installer/ide/platform-codes.yaml, platform
    // `antigravity`, in a file whose header records the paths as "verified against
    // each tool's primary docs"; its global counterpart `~/.gemini/antigravity/skills`
    // shows the entry was researched rather than guessed). Because ma-agents
    // delegates part of the install to that installer, a single run produced TWO
    // trees — and `.agent/skills`, the one Antigravity actually reads, was named by
    // neither this registry nor lib/bmad.js, so every ma-agents post-deploy patch
    // (the on-prem phase prefix among them) silently skipped it. Measured in a real
    // on-prem project: .claude/.agents/.cline each carried the prefix on 6 personas,
    // .agent/skills on 0.
    // Upstream is the authority on which directory a tool reads, so we align —
    // exactly as copilot/roo-code/kilocode were aligned to `.agents/skills` when
    // bmad-method 6.5.0 moved them (see the copilot entry above). This is a
    // per-tool decision on per-tool evidence: the other three divergences in the
    // table are recorded in PLATFORM_PATH_DIVERGENCES below, deliberately unchanged.
    // Existing installs migrate via OBSOLETE_TOOL_SKILL_DIRS in lib/installer.js.
    skillsDir: '.agent/skills',
    getProjectPath: () => path.join(process.cwd(), '.agent', 'skills'),
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
    name: 'SQA & Standards Expert (Gadi)',
    version: '1.0.0',
    category: 'bmad',
    description: 'Software Quality Assurance and MIL-STD-498 Standards Expert (Gadi)',
    skillsDir: '_bmad/skills/sqa',
    getProjectPath: () => path.join(process.cwd(), '_bmad', 'skills', 'sqa'),
    getGlobalPath: () => null,
    fileExtension: '.md',
    template: 'generic',
    instructionFiles: ['_bmad/bmm/agents/qa.md'],
    injectionStrategy: { position: 'top', skipPatterns: ['---'] }
  },
  // Story 30.4 / Decision P5-8, FR244-FR247: the 'bmm-demerzel' (ML Scientist)
  // agent registration is REMOVED for new installs — Demerzel is deprecated
  // and its ma-agent-ml + 12 ml-* skills no longer ship in the BMAD-extension
  // plugin (lib/bmad-extension/skills/). Existing installs that already have
  // this content deployed are left untouched (NFR49) — see
  // lib/profile.js#showDemerzelDeprecationNoticeOnce for the one-time notice.
  // Supersedes FR193 (the deferred Demerzel -> Memory-agent conversion is
  // cancelled).
  // DEFERRED (Story 28.3 / Decision P5-6(d), FR214): BMAD v6.9.0 adds two new
  // installer platform targets — `hermes` (Hermes Agent) and `codewhale`
  // (CodeWhale). They are intentionally NOT added to this registry. Passthrough
  // already deploys upstream support via the BMAD installer; first-class adoption
  // would pull the full per-tool routing / instruction-injection / skill-
  // resolution stack into ma-agents for two platforms with no current demand.
  // Add them here in a dedicated future story if/when demand appears.
];

/**
 * Declared, deliberate divergences between this registry's project `skillsDir`
 * and bmad-method's `installer.target_dir` for the SAME tool
 * (`node_modules/bmad-method/tools/installer/ide/platform-codes.yaml`).
 * Keyed by bmad platform code (see `getBmadPlatformCode`).
 *
 * Why this exists (bug `antigravity-path-divergence`): the two tables had drifted
 * apart for four tools and nothing compared them outside the five flagships, so a
 * whole second skill tree appeared in real projects with no owner and no patcher.
 * `test/routing-parity.test.js` (section 5) now enumerates EVERY tool in BOTH
 * tables and fails on any divergence that is not declared here — and on any
 * declaration whose recorded paths have gone stale, so an entry cannot rot into
 * cover for a different divergence.
 *
 * Scope note — PROJECT paths only. `getGlobalPath()` follows a per-OS
 * application-data convention that differs from upstream's `global_target_dir`
 * for EVERY tool, claude-code included (`%APPDATA%/Claude/skills` vs
 * `~/.claude/skills`). That is a whole-table convention difference, not a
 * per-tool divergence, and is deliberately out of scope here.
 *
 * To add an entry you must record BOTH live paths and a real reason. To remove
 * one, align the paths — the test fails on a declaration whose paths now agree.
 */
const PLATFORM_PATH_DIVERGENCES = Object.freeze({
  gemini: Object.freeze({
    maSkillsDir: '.gemini/skills',
    bmadTargetDir: '.agents/skills',
    reason:
      "Upstream's `gemini` platform is the Gemini CLI, which reads the shared " +
      '`.agents/skills` tree; this registry entry targets Google Gemini Code Assist ' +
      '(the IDE extension — note its instruction file `.gemini/gemini.md`), a ' +
      'different product sharing the same code. Contained: upstream writes ' +
      '`.agents/skills`, which is already an IDE skillsDir in this registry, already ' +
      'a seed in lib/bmad.js TOOL_SKILL_DIRS, and already reconciled by bug 27.16 — ' +
      'so no tree goes unpatched. Realigning is a compatibility call for its own story.'
  }),
  cursor: Object.freeze({
    maSkillsDir: '.cursor/skills',
    bmadTargetDir: '.agents/skills',
    reason:
      'Cursor reads its own `.cursor/` workspace directory (this registry also stamps ' +
      '`.cursor/cursor.md` there); upstream routes it to the shared `.agents/skills` ' +
      'cross-tool tree instead. Contained for the same reason as `gemini`: upstream ' +
      "'s target is already a known, patched and reconciled tree. Kept deliberately " +
      'so this bug fix changes the write path of exactly one tool, on that tool’s evidence.'
  }),
  opencode: Object.freeze({
    maSkillsDir: '.opencode/skills',
    bmadTargetDir: '.agents/skills',
    reason:
      'OpenCode is wired here through `opencode.json::instructions[]` plus AGENTS.md ' +
      '(Story 21.4) against its own `.opencode/` tree; upstream routes it to the shared ' +
      '`.agents/skills`. Contained for the same reason as `gemini` and `cursor`: ' +
      "upstream's target is already a known, patched and reconciled tree. Realignment " +
      'would also have to move the instruction wiring, so it belongs in its own story.'
  })
});

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
  getBmadPlatformCode,
  PLATFORM_PATH_DIVERGENCES
};
