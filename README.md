# ma-agents

A universal NPX tool to install AI coding agent skills. Write skills once, install them across Claude Code, Gemini, Copilot, Cline, Cursor, and Kilocode.

## Quick Start

```bash
# Interactive wizard (Install All / Custom Select / Update / Uninstall)
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
5. **Generates `MANIFEST.yaml`**: A central discovery file for the agent to find all installed skills.
6. **Updates Instructions**: Injects planning hints into agent files (e.g., `CLAUDE.md`, `.clinerules`) to ensure the agent uses the skills.

```
Generic (this repo)                    Installed Output
───────────────────                    ────────────────
skills/code-review/
├── skill.json        ──────────►     Injected as YAML frontmatter
├── SKILL.md          ──────────►     .claude/skills/code-review/SKILL.md
├── scripts/          ──────────►     .claude/skills/code-review/scripts/
└── references/       ──────────►     .claude/skills/code-review/references/
                                       + Generated MANIFEST.yaml
                                       + Updated Agent Instructions (CLAUDE.md, etc.)
```

## Supported Agents

| Agent | Project Path | Template | Instruction File |
|-------|-------------|----------|------------------|
| Claude Code | `.claude/skills/` | `claude-code` | `CLAUDE.md` |
| Google Gemini | `.gemini/skills/` | `generic` | - |
| GitHub Copilot | `.github/copilot/skills/` | `generic` | - |
| Cursor | `.cursor/skills/` | `generic` | - |
| Cline | `.cline/skills/` | `cline` | `.clinerules` |
| Kilocode | `.kilocode/skills/` | `generic` | - |

## Available Skills (22)

| Skill ID | Domain | Description |
| :--- | :--- | :--- |
| **General** | | |
| `code-review` | Quality | Comprehensive reviews following best practices and security guidelines |
| `commit-message` | Git | Generates conventional commit messages from code changes |
| `test-generator` | Testing | Generates comprehensive unit and integration tests |
| `test-accompanied-development` | Quality | Enforces "test-alongside" policy for every public method |
| `code-documentation` | Quality | Enforces PEP 257, Doxygen, JSDoc, and XML standards |
| `skill-creator` | Meta | Guide for creating new skills to extend agent capabilities |
| **Security** | | |
| `python-security-skill` | Python | OWASP Top 10 2025 aligned guardrails for Python |
| `js-ts-security-skill` | JS/TS | Security verification for JS/TS codebases (OWASP aligned) |
| `create-hardened-docker-skill` | Docker | Creates production-ready hardened Docker (CIS/NIST) |
| `verify-hardened-docker-skill` | Docker | Security verification for Docker configurations |
| **Dependencies** | | |
| `python-dependency-mgmt` | Python | Best practices for `uv` (lockfiles/sync) and `pip` |
| `js-ts-dependency-mgmt` | JS/TS | Stability and security for NPM, Yarn, and PNPM |
| **Modern C++** | | |
| `cpp-memory-handling` | C++ | RAII, smart pointers, and safe buffer management |
| `cpp-robust-interfaces` | C++ | Contract-based design and strong typing (C++14+) |
| `cpp-modern-composition` | C++ | Replaces C-style patterns with STL and Ranges |
| `cpp-const-correctness` | C++ | Immutability-by-default and `constexpr` logic |
| `cpp-concurrency-safety` | C++ | RAII locking and task-based parallelism |
| `cmake-best-practices` | Build | Target-based, property-oriented CMake patterns |
| **Architecture** | | |
| `logging-best-practices` | Logic | Standardized structured logging (JSON) across domains |
| `opentelemetry-best-practices` | Logic | Distributed tracing and semantic conventions |
| `vercel-react-best-practices` | Web | 57 Performance rules for React and Next.js |
| `git-workflow-skill` | Git | Worktree-based feature branch workflow |

## Automated Skill Discovery

`ma-agents` features an automated discovery system that ensures installed skills are actually used by the agent without manual configuration.

### 1. The Manifest (`MANIFEST.yaml`)
Every installation automatically generates a `MANIFEST.yaml` in the skills directory. It contains:
- **Skill IDs and Paths**: Where to find the instructions.
- **`applies_when` Conditions**: Hints about when a skill should be loaded (e.g., "when writing public APIs").
- **`always_load` Flags**: Mandatory skills that should always be in context.

### 2. Instruction Injection
The installer automatically updates agent-specific instruction files (like `CLAUDE.md` or `.clinerules`) with a "Planning Instruction" block. This block tells the agent to:
1. Consult the `MANIFEST.yaml` before starting a task.
2. Select and read only the relevant skills for the current context.

---

## CLI Usage

```bash
npx ma-agents                              # Launch interactive wizard
npx ma-agents install                      # Interactive install wizard
npx ma-agents status                       # Show installed skills and paths
npx ma-agents list                         # List all available skills
npx ma-agents agents                       # List supported agents
npx ma-agents uninstall <skill> <agents>   # Direct uninstall
```

### The Interactive Wizard
The easiest way to manage your skills is to simply run `npx ma-agents`. The wizard will guide you through:
- **Install All**: One-click setup for the entire 22-skill suite.
- **Custom Select**: Granularly choose specific skills and agents.
- **Update**: Add or remove skills from an existing installation.
- **Clean Reinstall**: Wipe the slate and start fresh.
- **Uninstall All**: Remove all ma-agents artifacts from the project.

### Install Options (Direct)
```bash
# Default: installs to project-level paths (current directory)
npx ma-agents install code-review claude-code

# Install to global/user-level paths
npx ma-agents install code-review claude-code --global

# Install to a custom directory
npx ma-agents install code-review claude-code --path ./my-skills
```

## Requirements

### Global Requirements
- **Node.js**: v16+ (npx support)
- **Git**: Required for git-related skills and version detection.
- **Bash**: Most skill scripts require a bash-compliant shell.

### Skill-Specific Requirements
- **Python Security/Deps**: `pip`, `uv` (recommended), `pip-audit`.
- **JS/TS Security/Deps**: `npm`, `yarn`, or `pnpm`.
- **C++ Skills**: C++14+ compiler recommended.
- **Docker Skills**: `docker`, `docker-compose`, `trivy` (for scanning).
- **Git Workflow**: `gh` (GitHub CLI) for PR automation.

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
│   ├── code-review/            # 22 bundled skills across 5 domains
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
