# Skills Structure

How skills are organized in this package and how the installer translates a unified generic structure into agent-specific formats for each supported coding assistant.

---

## Generic Skill Folder Structure

Every skill in this package follows a single unified structure. This is the **authoring format** — what you create when adding a new skill to `skills/`.

```
skills/<skill-name>/
├── skill.json              # Metadata (required)
├── SKILL.md                # Main instructions (required)
├── template.md             # Output template for the agent to fill in (optional)
├── examples/               # Example outputs showing expected format (optional)
│   └── sample.md
├── scripts/                # Executable scripts the agent can run (optional)
│   └── validate.sh
├── references/             # Static documentation and context (optional)
│   └── api-docs.md
├── hooks/                  # Git hooks or other hook scripts (optional)
│   └── pre-commit
└── assets/                 # Templates, configs, and other resources (optional)
    └── config.yaml
```

### Required Files

#### `skill.json` (Single Source of Truth)

All skill metadata lives here. The installer uses it for listing, and **automatically injects** YAML frontmatter into the installed `.md` file at install time. You never write frontmatter manually.

```json
{
  "name": "My Skill",
  "description": "What this skill does in one sentence",
  "version": "1.0.0",
  "author": "Your Name",
  "tags": ["category", "keywords"]
}
```

| Field         | Required | Description                                |
|---------------|----------|--------------------------------------------|
| `name`        | Yes      | Human-readable display name                |
| `description` | Yes      | Brief description shown in the installer   |
| `version`     | Yes      | Semver version string                      |
| `author`      | No       | Author name or organization                |
| `tags`        | No       | Array of keywords for categorization       |

#### `SKILL.md`

The main instruction file. Write **pure Markdown instructions only** — no YAML frontmatter. The installer injects frontmatter from `skill.json` at install time so the target agent receives a properly formatted file.

```markdown
# My Skill

## Purpose
What problem this skill solves.

## Instructions
Step-by-step instructions for the agent.

## Rules
Constraints and requirements the agent must follow.

## Output Format
What the agent should produce.
```

> **Why no frontmatter in source files?** Many agents (Claude Code, Gemini, Copilot) expect YAML frontmatter with `name` and `description`. Rather than duplicating this across `skill.json` and every `.md` file, `skill.json` is the single source of truth. The installer reads it and injects the correct frontmatter during installation. If a source file already contains frontmatter, it is stripped and replaced.

### Optional Files and Directories

| Path            | Purpose                                                  |
|-----------------|----------------------------------------------------------|
| `template.md`   | A fill-in-the-blank template the agent uses for output   |
| `examples/`     | Sample outputs demonstrating the expected result format  |
| `scripts/`      | Shell scripts, Python scripts, or other executables      |
| `references/`   | Background documentation the agent can consult           |
| `assets/`       | Config files, templates, images, or other static resources |
| `hooks/`        | Git hooks or other hook scripts                          |

### Naming Conventions

- Skill folder: lowercase with hyphens (`code-review`, `git-workflow-skill`)
- SKILL.md: keep under 500 lines; move detailed content to `references/`
- Scripts: use descriptive names (`validate.sh`, `init_skill.py`)
- One skill per folder

---

## How the Installer Translates Skills

When a user runs `npx ma-agents install`, they select skills and target agents. The installer maps the generic structure to each agent's native format.

### Translation Flow

```
Generic Structure (this repo)          Installed Output
─────────────────────────────          ────────────────
skills/<skill-name>/
├── skill.json          ──────────►   Injected as YAML frontmatter into SKILL.md
├── SKILL.md            ──────────►   <agent-skills-dir>/<skill-name>/SKILL.md
├── template.md         ──────────►   <agent-skills-dir>/<skill-name>/template.md
├── examples/           ──────────►   <agent-skills-dir>/<skill-name>/examples/
├── scripts/            ──────────►   <agent-skills-dir>/<skill-name>/scripts/
├── references/         ──────────►   <agent-skills-dir>/<skill-name>/references/
└── assets/             ──────────►   <agent-skills-dir>/<skill-name>/assets/
```

The installed `SKILL.md` always gets YAML frontmatter injected from `skill.json`:
```yaml
---
name: My Skill
description: What this skill does in one sentence
---
# ... original Markdown content follows ...
```

The installer resolves the instruction file in this priority order:

1. **Agent-specific template** — `<agent-template>.md` (e.g., `claude-code.md`, `cline.md`)
2. **Generic template** — `generic.md`
3. **Fallback** — `SKILL.md`

This means you can optionally create agent-tailored versions of your instructions. If you only create `SKILL.md`, all agents get the same content.

### Template Priority Example

```
skills/code-review/
├── skill.json
├── SKILL.md              ← Fallback for any agent without a specific template
├── generic.md            ← Used by Gemini, Copilot, Cursor, Kilocode
├── claude-code.md        ← Used only by Claude Code
└── cline.md              ← Used only by Cline
```

---

## Agent-Specific Output Formats

Each agent has its own expected directory structure. The installer handles this translation automatically.

### Claude Code

**Install path:** `.claude/skills/<skill-name>/`

```
.claude/skills/
└── my-skill/
    ├── SKILL.md              ← Instructions with injected frontmatter
    ├── template.md           ← Output template (if exists)
    ├── examples/             ← Sample outputs (if exists)
    ├── scripts/              ← Executable scripts (if exists)
    ├── references/           ← Static documentation (if exists)
    └── assets/               ← Other resources (if exists)
```

Claude Code loads skills from `.claude/skills/` as subdirectories containing a `SKILL.md` with YAML frontmatter. Supports `template.md`, `examples/`, and `scripts/` natively.

### Google Gemini

**Install path:** `.gemini/skills/<skill-name>/`

```
.gemini/skills/
└── my-skill/
    ├── SKILL.md              ← Instructions with injected frontmatter
    ├── scripts/              ← Executable scripts (if exists)
    ├── references/           ← Static documentation (if exists)
    └── assets/               ← Templates and resources (if exists)
```

Gemini CLI follows the same SKILL.md specification as Claude Code. Skills are placed in `.gemini/skills/` as subdirectories with `SKILL.md` inside.

### GitHub Copilot

**Install path:** `.agents/skills/<skill-name>/`

```
.agents/skills/
└── my-skill/
    ├── SKILL.md              ← Instructions with injected frontmatter
    ├── scripts/              ← Executable scripts (if exists)
    ├── references/           ← Static documentation (if exists)
    └── examples/             ← Sample outputs (if exists)
```

Copilot uses the same SKILL.md specification (YAML frontmatter + Markdown). Since `bmad-method 6.5.0`, Copilot, Kilocode, and Roo Code all write to the shared `.agents/skills/` tree (the old `.github/copilot/skills/` path is migrated away automatically). Copilot's skill-bootstrap instructions live in `.github/copilot-instructions.md` — the only repository custom-instructions file it reads. Copilot also supports path-scoped instructions via `.github/instructions/*.instructions.md` files with `applyTo` glob patterns.

### Cursor

**Install path:** `.cursor/skills/<skill-name>/`

```
.cursor/skills/
└── my-skill/
    ├── SKILL.md              ← Instructions with injected frontmatter
    ├── scripts/              ← Executable scripts (if exists)
    └── references/           ← Static documentation (if exists)
```

Cursor natively uses `.mdc` (Markdown Component) files in `.cursor/rules/` with frontmatter fields like `description`, `globs`, and `alwaysApply`. The installer places skills in `.cursor/skills/` using the standard folder structure. For deeper Cursor integration, users can manually convert to `.mdc` format in `.cursor/rules/`.

**Cursor native `.mdc` format (for reference):**
```yaml
---
description: What this rule does
globs: "src/**/*.ts"
alwaysApply: false
---
# Rule body in Markdown
```

### Cline

**Install path:** `.cline/skills/<skill-name>/`

```
.cline/skills/
└── my-skill/
    ├── SKILL.md              ← Instructions with injected frontmatter
    ├── docs/                 ← Additional documentation (if exists)
    ├── templates/            ← Config/boilerplate files (if exists)
    └── scripts/              ← Utility scripts (if exists)
```

Cline loads skills from `.cline/skills/` using a progressive three-level system: metadata (name + description from frontmatter) loads at startup, full instructions load when triggered, and bundled files (`docs/`, `templates/`, `scripts/`) load on-demand. The `name` in frontmatter must match the directory name (kebab-case). Description should be under 1024 characters and specify trigger phrases.

**Resource directory mapping:** The installer maps `references/` → `docs/` and `assets/` → `templates/` for Cline, matching its native structure.

### Kilocode

**Install path:** `.agents/skills/<skill-name>/`

```
.agents/skills/
└── my-skill/
    ├── SKILL.md              ← Instructions with injected frontmatter
    ├── scripts/              ← Executable scripts (if exists)
    └── references/           ← Static documentation (if exists)
```

Kilocode natively uses `.kilocode/rules/` for generic rules and `.kilocode/rules-<mode>/` for mode-specific rules. Since `bmad-method 6.5.0`, the installer places Kilocode skills in the shared `.agents/skills/` tree (alongside Copilot and Roo Code); its instruction file remains `.kilocode/kilocode.md`. Kilocode also reads `.clinerules` as a fallback.

### Roo Code

**Install path:** `.agents/skills/<skill-name>/`

```
.agents/skills/
└── my-skill/
    ├── SKILL.md              ← Instructions with injected frontmatter
    ├── scripts/              ← Executable scripts (if exists)
    └── references/           ← Static documentation (if exists)
```

Roo Code (an enhanced Cline fork) uses the shared `.agents/skills/` tree since `bmad-method 6.5.0`. Its instruction file is `.roo/rules/00-ma-agents.md`, and the installer additionally stamps a `.roomodes` file at the project root with 4 BMAD planning modes whose `fileRegex` restrictions gate planning-phase edits at the IDE layer.

### Antigravity

**Install path:** `.antigravity/skills/<skill-name>/`

```
.antigravity/skills/
└── my-skill/
    ├── SKILL.md              ← Instructions with injected frontmatter
    ├── scripts/              ← Executable scripts (if exists)
    └── references/           ← Static documentation (if exists)
```

Antigravity (Google DeepMind) uses the standard folder structure under `.antigravity/skills/`; its instruction file is `.antigravity/antigravity.md`.

### OpenCode

**Install path:** `.opencode/skills/<skill-name>/`

```
.opencode/skills/
└── my-skill/
    ├── SKILL.md              ← Instructions with injected frontmatter
    ├── scripts/              ← Executable scripts (if exists)
    └── references/           ← Static documentation (if exists)
```

OpenCode uses the standard folder structure under `.opencode/skills/`. Instead of a single Markdown instruction file, OpenCode reads an `AGENTS.md` at the project root (stamped between markers) that is registered via an additive entry in the `instructions[]` array of `opencode.json`.

---

## Creating a New Skill

### Step 1: Create the Skill Folder

```bash
mkdir -p skills/my-new-skill
```

### Step 2: Create `skill.json`

```json
{
  "name": "My New Skill",
  "description": "Brief description of what this skill does",
  "version": "1.0.0",
  "author": "Your Name",
  "tags": ["relevant", "tags"]
}
```

### Step 3: Create `SKILL.md`

Write pure Markdown instructions. Do **not** add YAML frontmatter — the installer injects it from `skill.json` automatically.

```markdown
# My New Skill

## Purpose
Explain what problem this skill solves.

## When to Use
Describe the scenarios where this skill applies.

## Instructions
1. Step-by-step instructions for the agent
2. Be specific and actionable
3. Include examples where helpful

## Rules
- Constraints the agent must follow
- Quality standards to enforce
- Things to avoid

## Output Format
Describe the expected output format with examples.
```

### Step 4: Add Optional Resources

```bash
# Add scripts the agent can execute
mkdir -p skills/my-new-skill/scripts
# scripts/validate.sh, scripts/setup.py, etc.

# Add reference documentation
mkdir -p skills/my-new-skill/references
# references/api-docs.md, references/standards.md, etc.

# Add templates
# template.md — output template for the agent

# Add examples
mkdir -p skills/my-new-skill/examples
# examples/sample-output.md, etc.

# Add other assets
mkdir -p skills/my-new-skill/assets
# assets/config.yaml, assets/boilerplate.json, etc.
```

### Step 5: (Optional) Create Agent-Specific Templates

If a skill needs different instructions for different agents:

```bash
# Claude Code specific (uses 'claude-code' template)
skills/my-new-skill/claude-code.md

# Cline specific (uses 'cline' template)
skills/my-new-skill/cline.md

# All other agents use generic.md or SKILL.md
skills/my-new-skill/generic.md
```

### Step 6: Test

```bash
# Verify the skill appears in the list
npx ma-agents list

# Test installation
npx ma-agents install my-new-skill claude-code
```

---

## Template ID Mapping

Each agent has a `template` ID that determines which instruction file the installer looks for first.

| Agent          | Template ID    | Looks for (in order)                          |
|----------------|----------------|-----------------------------------------------|
| Claude Code    | `claude-code`  | `claude-code.md` → `generic.md` → `SKILL.md` |
| Google Gemini  | `generic`      | `generic.md` → `SKILL.md`                     |
| GitHub Copilot | `generic`      | `generic.md` → `SKILL.md`                     |
| Cursor         | `generic`      | `generic.md` → `SKILL.md`                     |
| Cline          | `cline`        | `cline.md` → `generic.md` → `SKILL.md`        |
| Kilocode       | `generic`      | `generic.md` → `SKILL.md`                     |
| Roo Code       | `generic`      | `generic.md` → `SKILL.md`                     |
| Antigravity    | `generic`      | `generic.md` → `SKILL.md`                     |
| OpenCode       | `generic`      | `generic.md` → `SKILL.md`                     |

---

## Installation Paths Summary

Default installation is **project-level** (relative to where `npx ma-agents` is run).

| Agent          | Project Path                          | Global Path                                              |
|----------------|---------------------------------------|----------------------------------------------------------|
| Claude Code    | `.claude/skills/`                     | `~/AppData/Roaming/Claude/skills/` (Win)                 |
| Google Gemini  | `.gemini/skills/`                     | `~/AppData/Roaming/Gemini/skills/` (Win)                 |
| GitHub Copilot | `.agents/skills/`                     | `~/AppData/Roaming/GitHub Copilot/skills/` (Win)         |
| Cursor         | `.cursor/skills/`                     | `~/AppData/Roaming/Cursor/User/skills/` (Win)            |
| Cline          | `.cline/skills/`                      | `~/AppData/.../saoudrizwan.claude-dev/skills/` (Win)     |
| Kilocode       | `.agents/skills/`                     | `~/AppData/Roaming/Kilocode/skills/` (Win)               |
| Roo Code       | `.agents/skills/`                     | `~/AppData/.../rooveterinaryinc.roo-cline/skills/` (Win) |
| Antigravity    | `.antigravity/skills/`                | `~/AppData/Roaming/Antigravity/skills/` (Win)            |
| OpenCode       | `.opencode/skills/`                   | `~/AppData/Roaming/opencode/skills/` (Win)               |

> Copilot, Kilocode, and Roo Code share the unified `.agents/skills/` project tree (since `bmad-method 6.5.0`).

Use `--global` flag to install to user-level paths instead:
```bash
npx ma-agents install my-skill claude-code --global
```

---

## Checklist for New Skills

- [ ] `skill.json` exists with `name`, `description`, `version`
- [ ] `SKILL.md` exists with pure Markdown (no YAML frontmatter — injected at install time)
- [ ] Instructions are clear, specific, and actionable
- [ ] Scripts are executable and have shebangs (`#!/bin/bash`, `#!/usr/bin/env python3`)
- [ ] Skill appears in `npx ma-agents list`
- [ ] Test install works for at least one agent
- [ ] (Optional) Agent-specific templates created where needed
- [ ] (Optional) References moved out of SKILL.md to keep it under 500 lines
