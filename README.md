# ma-agents

A universal NPX tool to install AI coding agent skills. Write skills once, install them across Claude Code, Gemini, Copilot, Cline, Cursor, and Kilocode.

## Quick Start

```bash
# Interactive wizard
npx ma-agents

# Direct install
npx ma-agents install code-review claude-code

# Install a skill to multiple agents at once
npx ma-agents install code-review claude-code copilot cline
```

## How It Works

Skills are written in a **unified generic format** and stored in this package. When you install a skill, the installer:

1. Reads the skill's `SKILL.md` (or agent-specific template if available)
2. Injects YAML frontmatter from `skill.json` (the single source of metadata)
3. Copies the skill and its resources into the target agent's directory
4. Renames resource directories to match the agent's native structure (e.g., `references/` becomes `docs/` for Cline)

```
Generic (this repo)                    Installed Output
───────────────────                    ────────────────
skills/code-review/
├── skill.json        ──────────►     Injected as YAML frontmatter
├── SKILL.md          ──────────►     .claude/skills/code-review/SKILL.md
├── scripts/          ──────────►     .claude/skills/code-review/scripts/
└── references/       ──────────►     .claude/skills/code-review/references/
```

## Supported Agents

| Agent | Project Path | Template |
|-------|-------------|----------|
| Claude Code | `.claude/skills/` | `claude-code` |
| Google Gemini | `.gemini/skills/` | `generic` |
| GitHub Copilot | `.github/copilot/skills/` | `generic` |
| Cursor | `.cursor/skills/` | `generic` |
| Cline | `.cline/skills/` | `cline` |
| Kilocode | `.kilocode/skills/` | `generic` |

## Available Skills

| Skill | Description |
|-------|-------------|
| `code-review` | Comprehensive code reviews following industry best practices and security guidelines |
| `commit-message` | Generates conventional commit messages from code changes |
| `test-generator` | Generates comprehensive unit and integration tests |
| `git-workflow-skill` | Worktree-based feature branch workflow for parallel multi-agent development |
| `skill-creator` | Guide for creating skills that extend AI agent capabilities |
| `vercel-react-best-practices` | 57 actionable performance rules for React and Next.js projects |
| `create-hardened-docker-skill` | Creates production-ready hardened Docker configurations (CIS, OWASP, NIST) |
| `verify-hardened-docker-skill` | Security verification for Docker configurations against CIS/OWASP/NIST |
| `js-ts-security-skill` | Security verification for JS/TS codebases against OWASP Top 10 2025 |

List all skills:
```bash
npx ma-agents list
```

## CLI Usage

```
npx ma-agents                              Interactive wizard
npx ma-agents install                      Interactive install wizard
npx ma-agents install <skill> <agents...>  Install directly
npx ma-agents list                         List available skills
npx ma-agents agents                       List supported agents
npx ma-agents help                         Show help
```

### Install Options

```bash
# Default: installs to project-level paths (current directory)
npx ma-agents install code-review claude-code

# Install to global/user-level paths
npx ma-agents install code-review claude-code --global

# Install to a custom directory
npx ma-agents install code-review claude-code --path ./my-skills
```

### Installation Scope

By default, skills install at **project level** (relative to where the command is run):

| Agent | Project Path |
|-------|-------------|
| Claude Code | `.claude/skills/<skill-name>/SKILL.md` |
| Gemini | `.gemini/skills/<skill-name>/SKILL.md` |
| Copilot | `.github/copilot/skills/<skill-name>/SKILL.md` |
| Cursor | `.cursor/skills/<skill-name>/SKILL.md` |
| Cline | `.cline/skills/<skill-name>/SKILL.md` |
| Kilocode | `.kilocode/skills/<skill-name>/SKILL.md` |

Use `--global` to install to user-level directories instead.

## Skill Structure

Every skill follows a unified structure. See [SKILLS_STRUCTURE.md](SKILLS_STRUCTURE.md) for full documentation.

```
skills/<skill-name>/
├── skill.json              # Metadata — single source of truth (required)
├── SKILL.md                # Main instructions in pure Markdown (required)
├── claude-code.md          # Claude Code-specific template (optional)
├── cline.md                # Cline-specific template (optional)
├── generic.md              # Generic template for other agents (optional)
├── template.md             # Output template for the agent (optional)
├── scripts/                # Executable scripts (optional)
├── references/             # Documentation and reference material (optional)
├── examples/               # Sample outputs (optional)
├── hooks/                  # Git hooks or other hook scripts (optional)
└── assets/                 # Config files, templates, resources (optional)
```

### Key Design Decisions

- **`skill.json` is the single source of truth** for metadata (`name`, `description`). YAML frontmatter is injected automatically at install time — you never write it in source files.
- **Template priority**: The installer looks for `<agent-template>.md` first (e.g., `claude-code.md`), then `generic.md`, then falls back to `SKILL.md`.
- **Resource mapping**: Some agents use different directory names. For example, Cline expects `docs/` instead of `references/` and `templates/` instead of `assets/`. The installer handles this mapping automatically.

## Creating a New Skill

### 1. Create the skill directory

```bash
mkdir -p skills/my-skill
```

### 2. Create `skill.json`

```json
{
  "name": "My Skill",
  "description": "What this skill does in one sentence",
  "version": "1.0.0",
  "author": "Your Name",
  "tags": ["category", "keywords"]
}
```

### 3. Create `SKILL.md`

Write pure Markdown instructions. Do **not** add YAML frontmatter — the installer injects it from `skill.json`.

```markdown
# My Skill

## Purpose
What problem this skill solves.

## Instructions
Step-by-step instructions for the agent.

## Rules
Constraints the agent must follow.

## Output Format
What the agent should produce.
```

### 4. Add optional resources

```bash
mkdir -p skills/my-skill/scripts      # Executable scripts
mkdir -p skills/my-skill/references    # Documentation
mkdir -p skills/my-skill/examples      # Sample outputs
```

### 5. (Optional) Create agent-specific templates

If a skill needs different instructions for different agents:

```bash
# Claude Code gets tailored instructions
skills/my-skill/claude-code.md

# Cline gets its own version
skills/my-skill/cline.md

# All other agents use SKILL.md
```

### 6. Test

```bash
npx ma-agents list                          # Verify it appears
npx ma-agents install my-skill claude-code  # Test installation
```

## Adding a New Agent

Edit [lib/agents.js](lib/agents.js) and add a new entry to the `agents` array:

```javascript
{
  id: 'my-agent',
  name: 'My Agent',
  description: 'My Agent Description',
  getProjectPath: () => path.join(process.cwd(), '.my-agent', 'skills'),
  getGlobalPath: () => {
    const platform = os.platform();
    if (platform === 'win32') {
      return path.join(os.homedir(), 'AppData', 'Roaming', 'MyAgent', 'skills');
    } else if (platform === 'darwin') {
      return path.join(os.homedir(), 'Library', 'Application Support', 'MyAgent', 'skills');
    } else {
      return path.join(os.homedir(), '.config', 'my-agent', 'skills');
    }
  },
  fileExtension: '.md',
  template: 'generic',
  // Optional: rename resource directories to match agent's native structure
  resourceMap: {
    'references': 'docs',
    'assets': 'templates'
  }
}
```

### Agent Configuration Fields

| Field | Required | Description |
|-------|----------|-------------|
| `id` | Yes | Unique kebab-case identifier (used in CLI) |
| `name` | Yes | Display name shown to users |
| `description` | Yes | Brief description |
| `getProjectPath` | Yes | Returns project-level skills directory |
| `getGlobalPath` | Yes | Returns global/user-level skills directory (platform-specific) |
| `fileExtension` | Yes | File extension for skill files (usually `.md`) |
| `template` | Yes | Template ID — determines which `.md` file to look for first |
| `resourceMap` | No | Maps generic directory names to agent-specific names |

## Project Structure

```
ma-agents/
├── bin/
│   └── cli.js                  # CLI entry point (wizard + commands)
├── lib/
│   ├── agents.js               # Agent configurations and paths
│   └── installer.js            # Skill discovery, frontmatter injection, installation
├── skills/
│   ├── code-review/            # 9 bundled skills
│   ├── commit-message/
│   ├── create-hardened-docker-skill/
│   ├── git-workflow-skill/
│   ├── js-ts-security-skill/
│   ├── skill-creator/
│   ├── test-generator/
│   ├── vercel-react-best-practices/
│   └── verify-hardened-docker-skill/
├── SKILLS_STRUCTURE.md         # Full skill authoring documentation
├── package.json
└── README.md
```

## Development

```bash
# Clone the repository
git clone https://github.com/mayafit/AI_Agents.git
cd AI_Agents

# Install dependencies
npm install

# Run locally
node bin/cli.js

# Test skill listing
node bin/cli.js list

# Test agents listing
node bin/cli.js agents
```

## Programmatic API

```javascript
const { installSkill, listSkills, listAgents } = require('ma-agents');

// List all available skills
const skills = listSkills();

// List all supported agents
const agents = listAgents();

// Install a skill programmatically
await installSkill('code-review', ['claude-code', 'copilot'], '', 'project');
```

## Contributing

Contributions welcome:

- **New skills** — Follow the structure in [SKILLS_STRUCTURE.md](SKILLS_STRUCTURE.md)
- **New agents** — Add to [lib/agents.js](lib/agents.js) with both project and global paths
- **Bug fixes** and improvements

## License

MIT
