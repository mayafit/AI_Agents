# Domain Research Report: Roo Code Integration

**Date:** 2026-03-31
**Author:** Mary (Business Analyst)
**Status:** Complete

---

## Executive Summary

Roo Code is a VS Code extension forked from Cline that provides a multi-mode AI coding assistant with deep extensibility. This report analyzes Roo Code's architecture, extension points, and configuration model to determine how the ma-agents / BMAD-METHOD project should add support for it.

**Key Finding:** The upstream `bmad-method` npm package already has partial Roo Code support (`roo` in `platform-codes.yaml`), but the `ma-agents` project lacks the corresponding agent entry in `agents.js`, IDE config files, and installer integration. Roo Code's unique features (custom modes, rules directories, slash commands, skills) offer opportunities for deeper BMAD integration beyond what other IDEs receive.

---

## 1. Roo Code Architecture Overview

### 1.1 What Is Roo Code

- **Type:** VS Code extension (AI coding assistant)
- **Origin:** Fork of Cline (formerly Claude Dev by Saoud Rizwan)
- **Tech Stack:** TypeScript (98.7%), pnpm monorepo, Turbo build
- **Repository:** https://github.com/RooCodeInc/Roo-Code
- **Documentation:** https://docs.roocode.com

### 1.2 Core Extension Points

| Extension Point | Location | Format | BMAD Mapping |
|----------------|----------|--------|-------------|
| **Custom Modes** | `.roomodes` (project) or `custom_modes.yaml` (global) | YAML/JSON | BMAD agent personas |
| **Rules/Instructions** | `.roo/rules/`, `.roo/rules-{modeSlug}/` | Markdown/Text | BMAD planning instructions |
| **Slash Commands** | `.roo/commands/` (project) or `~/.roo/commands/` (global) | Markdown with optional YAML frontmatter | BMAD workflows / agent launchers |
| **Skills** | `.roo/skills/`, `.roo/skills-{modeSlug}/` | `SKILL.md` in directories | ma-agents skills (direct mapping) |
| **Custom Tools** (experimental) | `.roo/tools/{name}.ts` | TypeScript with `defineCustomTool` | No direct BMAD mapping |
| **MCP Servers** | `.roo/mcp.json` (project) or VS Code settings (global) | JSON config | External tool integration |
| **Cross-Agent Skills** | `.agents/skills/` (lower priority than `.roo/`) | Same as Skills | Interop with other AI agents |
| **Agent Rules** | `AGENTS.md` or `AGENT.md` at workspace root | Markdown | Auto-loaded; cross-agent standard |

---

## 2. Roo Code Custom Modes

### 2.1 Schema

```yaml
customModes:
  - slug: "my-mode"           # Required: kebab-case identifier (/^[a-zA-Z0-9-]+$/)
    name: "My Mode"            # Required: display name (supports emoji)
    description: "Short text"  # Optional: shown in mode selector
    roleDefinition: |          # Required: core identity, injected at system prompt start
      You are an expert...
    whenToUse: |               # Optional: guidance for orchestration/auto-switching
      Use this mode when...
    customInstructions: |      # Optional: behavioral guidelines appended near end of prompt
      Always prefer...
    groups:                    # Optional: tool permission groups
      - read                   # Simple string = full access
      - - edit                 # Tuple = restricted access
        - fileRegex: '\.(js|ts)$'
          description: "JS/TS files only"
      - command
      - mcp
```

### 2.2 Built-in Modes

| Mode | Slug | Purpose |
|------|------|---------|
| Code | `code` | Everyday coding |
| Architect | `architect` | Systems planning |
| Ask | `ask` | Explanations/docs |
| Debug | `debug` | Issue isolation |
| Orchestrator | `orchestrator` | Multi-mode coordination |

### 2.3 BMAD Opportunity

BMAD agent personas (PM, Analyst, Architect, Dev, QA, SM, UX Designer, Tech Writer) can be mapped to Roo Code custom modes with:
- `roleDefinition` containing the agent persona
- `groups` restricting tools per role (e.g., Analyst = read-only)
- `whenToUse` enabling orchestrator-driven mode switching
- `customInstructions` with BMAD-specific behavioral rules

### 2.4 Configuration Precedence

1. Project modes (`.roomodes`) override global
2. Global modes (`custom_modes.yaml`, then legacy JSON)
3. Built-in defaults

---

## 3. Rules & Custom Instructions

### 3.1 Directory Structure

```
project-root/
├── .roo/
│   ├── rules/                    # Workspace-wide rules (all modes)
│   │   ├── 01-general.md
│   │   └── 02-coding-style.md
│   ├── rules-code/               # Mode-specific rules
│   │   └── 01-code-rules.md
│   ├── rules-architect/
│   │   └── 01-arch-rules.md
│   ├── commands/                  # Slash commands
│   │   └── review.md
│   └── skills/                    # Skills (SKILL.md directories)
│       ├── my-skill/
│       │   └── SKILL.md
│       └── MANIFEST.yaml          # ma-agents would generate this
├── .roomodes                      # Project custom modes
├── .roorules                      # Fallback: single-file general rules
├── .roorules-code                 # Fallback: single-file mode rules
└── .rooignore                     # File exclusion patterns
```

### 3.2 Loading Order (System Prompt Injection)

1. Global mode-specific rules: `~/.roo/rules-{modeSlug}/`
2. Workspace mode-specific rules: `.roo/rules-{modeSlug}/`
3. Fallback: `.roorules-{modeSlug}` (only if no directory content)
4. Global general rules: `~/.roo/rules/`
5. Workspace general rules: `.roo/rules/`
6. Fallback: `.roorules` (only if no directory content)
7. Legacy: `.clinerules` / `.clinerules-{modeSlug}` (backward compat)

### 3.3 File Handling

- Recursive directory reading
- Alphabetical order by filename
- Skips system files (`.DS_Store`, `*.bak`, `*.tmp`, etc.)
- Supports symlinks (5-depth cycle detection)

---

## 4. Slash Commands

### 4.1 Definition Format

```markdown
---
description: Comprehensive security review
argument-hint: <file or directory to review>
mode: architect
---
# Security-First Code Review

Review this code for security vulnerabilities...
```

### 4.2 Key Properties

- **Storage:** `.roo/commands/` (project) or `~/.roo/commands/` (global)
- **Format:** Markdown with optional YAML frontmatter
- **Naming:** Filename becomes command name (auto-slugified)
- **Fields:** `description`, `argument-hint`, `mode` (optional)
- **Project overrides global** for same-name commands

### 4.3 BMAD Mapping

BMAD agent launchers and workflow triggers can be deployed as Roo Code slash commands in `.roo/commands/`. This is the equivalent of `.claude/commands/` for Claude Code.

---

## 5. Skills System

### 5.1 Resolution Priority

1. `.roo/skills-{modeSlug}/` (project, mode-specific)
2. `.roo/skills/` (project, generic)
3. `.agents/skills-{modeSlug}/` (project, mode-specific)
4. `.agents/skills/` (project, generic)
5. `~/.roo/skills-{modeSlug}/` (global, mode-specific)
6. `~/.roo/skills/` (global, generic)

### 5.2 Format

- Directory-per-skill with `SKILL.md` as main file
- Exactly matches the ma-agents skill format
- `bmad-method` already generates skills to `.roo/skills/` via config-driven installer

---

## 6. Existing Support in Upstream

### 6.1 bmad-method Package (platform-codes.yaml)

```yaml
roo:
  name: "Roo Code"
  preferred: false
  category: ide
  description: "Enhanced Cline fork"
  installer:
    legacy_targets:
      - .roo/commands
    target_dir: .roo/skills
    template_type: default
    skill_format: true
```

This means: when `bmad-method` runs `bmad install --ide roo`, it generates BMAD skills in `.roo/skills/` using the default template and SKILL.md directory format. The `legacy_targets` cleanup for `.roo/commands` indicates a previous version used commands instead of skills.

### 6.2 ma-agents Package (agents.js)

**NOT PRESENT.** The `agents.js` file has entries for claude-code, gemini, copilot, kilocode, cline, cursor, antigravity, and opencode -- but NOT roo-code.

### 6.3 Project Configuration (_bmad/_config/manifest.yaml)

```yaml
ides:
  - claude-code
  - gemini
  - cline
  - cursor
  - antigravity
```

Roo Code is NOT listed.

---

## 7. Gap Analysis

### 7.1 What Already Works

- bmad-method can generate BMAD skills to `.roo/skills/` via `platform-codes.yaml`
- The config-driven installer handles cleanup, skill directory creation, and SKILL.md generation
- Template rendering uses the `default` template type (same as Cursor, Cline, etc.)

### 7.2 What's Missing

| Gap | Impact | Effort |
|-----|--------|--------|
| No `roo-code` entry in `agents.js` | ma-agents CLI can't target Roo Code | Low |
| No IDE config in `_bmad/_config/ides/` | BMAD installer doesn't recognize Roo Code | Low |
| No agent customization YAML | No BMAD persona customization for Roo Code | Low |
| No `.roomodes` generation | BMAD agents not available as Roo Code modes | Medium |
| No `.roo/rules/` generation | BMAD planning instructions not injected | Medium |
| No `.roo/commands/` generation | BMAD workflows not available as slash commands | Medium |
| No Cline-to-Roo migration | Users with existing Cline setup can't migrate | Medium |
| FR34 doesn't list Roo Code | PRD needs updating | Low |
| No `roo-code` template in bmad-method | Uses default, may miss Roo-specific features | Low |

### 7.3 Roo Code-Specific Opportunities (Beyond Standard IDE Support)

1. **Custom Modes as Agent Personas** -- Roo Code's mode system is a near-perfect mapping for BMAD agent personas. Each BMAD agent (PM, Analyst, Architect, Dev, QA, SM) could become a Roo Code custom mode with:
   - Role-appropriate tool permissions (e.g., Analyst = read-only, Dev = full access)
   - Orchestrator `whenToUse` for automated mode switching during BMAD workflows
   - Mode-specific rules in `.roo/rules-{modeSlug}/`

2. **Slash Commands as Workflow Launchers** -- Every BMAD workflow (create-prd, sprint-planning, code-review, etc.) could be a Roo Code slash command, making them instantly accessible from the chat input.

3. **Cline Migration Path** -- Since Roo Code is a Cline fork, users with existing `.clinerules` and `.cline/` configs should get a migration path.

---

## 8. Concept Mapping: BMAD to Roo Code

| BMAD Concept | Roo Code Equivalent | Implementation |
|-------------|---------------------|----------------|
| Agent Persona (PM, Analyst, etc.) | Custom Mode in `.roomodes` | Generate `.roomodes` YAML with BMAD agent definitions |
| Agent Launcher Command | Slash Command in `.roo/commands/` | Generate `.md` files with frontmatter + activation instructions |
| Skill (SKILL.md) | Skill in `.roo/skills/` | Direct copy (already supported by bmad-method) |
| Planning Instruction | Rules in `.roo/rules/` | Generate MANIFEST instruction as rule file |
| BMAD Workflow | Slash Command with `mode` field | Generate `.md` per workflow with target mode |
| Agent Customization | `.roomodes` roleDefinition override | Merge from `_bmad/_config/agents/roo-code.customize.yaml` |
| Cline legacy config | `.clinerules` fallback | Roo Code natively supports `.clinerules` fallback |

---

## 9. Recommended Approach

### Phase 1: Standard IDE Support (Stories 18.1-18.3)
Add Roo Code as a supported IDE in ma-agents following the exact same pattern as existing IDEs (agents.js entry, IDE config, manifest update).

### Phase 2: Roo-Specific Features (Stories 18.4-18.6)
Generate `.roomodes` with BMAD agent modes, deploy planning instructions to `.roo/rules/`, and generate slash commands for BMAD workflows.

### Phase 3: Migration & Polish (Stories 18.7-18.8)
Cline-to-Roo migration path and end-to-end validation.

---

## 10. Sources

- [Roo Code GitHub](https://github.com/RooCodeInc/Roo-Code)
- [Roo Code Docs - Custom Modes](https://docs.roocode.com/features/custom-modes)
- [Roo Code Docs - Custom Instructions](https://docs.roocode.com/features/custom-instructions)
- [Roo Code Docs - Slash Commands](https://docs.roocode.com/features/slash-commands)
- [Roo Code Docs - Skill Tool](https://docs.roocode.com/advanced-usage/available-tools/skill)
- [Roo Code Docs - Tool Use Overview](https://docs.roocode.com/advanced-usage/available-tools/tool-use-overview)
- Internal analysis: `lib/agents.js`, `lib/installer.js`, `_bmad/_config/manifest.yaml`
- Upstream: `bmad-method/tools/cli/installers/lib/ide/platform-codes.yaml`
