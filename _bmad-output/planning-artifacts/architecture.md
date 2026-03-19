---
stepsCompleted: ['step-01-init', 'step-02-context', 'step-03-starter', 'step-04-decisions', 'step-05-patterns', 'step-06-structure', 'step-07-validation', 'step-08-complete']
phase2StepsCompleted: ['step-02-context', 'step-04-decisions', 'step-05-patterns', 'step-06-structure', 'step-07-validation', 'step-08-complete']
phase2CompletedAt: '2026-03-11'
phase2bEditHistory:
  - date: '2026-03-19'
    changes: 'Added Decision P2-7: Project Context Auto-Generation (FR79-FR86, NFR22-NFR25). Two-layer design: generator returns content, pipeline writes. Platform paths sourced from full manifest. Critical_actions update for 12 BMM+master agents; CIS agents explicitly excluded. NFR25 adds template version comment for upgrade detection.'
  - date: '2026-03-15'
    changes: 'Added Decision P2-6: Bundled BMAD Installation. Added bmad-cache bundling architecture, bmad-method as npm dependency. Updated project structure, patterns, and validation.'
  - date: '2026-03-15'
    changes: 'Simplified P2-6: Removed --offline flag (bundled is the only mode), removed standalone binary option, removed Option B (vendored copy), renumbered Epic 13 to Epic 5. Swept all stale references.'
  - date: '2026-03-15'
    changes: 'Fixed stale counts in Project Context Analysis: FR count 50→76 (Phase 1+2 minus deleted FR77-FR78), NFR count 15→21 (original 15 + Phase 2 NFR16-NFR21).'
inputDocuments: ['_bmad-output/planning-artifacts/prd.md', 'docs/index.md', 'docs/project-overview.md', 'docs/architecture.md', 'docs/source-tree-analysis.md', 'docs/development-guide.md', 'README.md']
workflowType: 'architecture'
status: 'complete'
completedAt: '2026-03-07'
project_name: 'agents'
user_name: 'Alon'
date: '2026-03-05'
---

# Architecture Decision Document

_This document builds collaboratively through step-by-step discovery. Sections are appended as we work through each architectural decision together._

## Project Context Analysis

### Requirements Overview

**Functional Requirements:**
76 FRs across 14 capability areas (Phase 1: 50 FRs across 8 areas + Phase 2: 26 FRs across 6 areas, minus FR77-FR78 deleted). The architecture must support: (1) a content transformation pipeline that translates skills into agent-native formats, (2) a BMAD lifecycle management subsystem, (3) MIL-STD-498 document generation workflows delivered via BMAD, (4) manifest-based version tracking across multi-agent installs, and (5) skill authoring and governance capabilities.

**Non-Functional Requirements:**
21 NFRs across 6 categories driving architectural decisions (original 15 + Phase 2 NFR16-NFR21):
- **Security** — no data exfiltration, inspectable content, offline operation (NFR1-4)
- **Integration reliability** — additive-only installs, atomic manifest operations, strict pipeline ordering (NFR5-8)
- **Portability** — cross-platform identical results, write-once skills, extensible agent targets (NFR9-12)
- **Maintainability** — configuration-driven extensibility for agents and skills, backward compatibility (NFR13-15)

**Scale & Complexity:**
- Primary domain: CLI tool / build-time packaging pipeline
- Complexity level: Medium-High
- Estimated architectural components: 6 (CLI Router, Installer Engine, Agent Registry, BMAD Integration, Skill Library, Manifest Manager)

### Technical Constraints & Dependencies

- Node.js runtime (LTS versions) — no native dependencies
- Zero runtime component — install-time only execution
- Cross-platform file system operations (Windows, macOS, Linux)
- Air-gapped operation — no network calls during skill installation
- npm as primary distribution channel (bundled BMAD installation planned for Phase 2)

### Cross-Cutting Concerns Identified

- **Path normalization** — every module touches the file system; platform-aware path handling affects all components
- **Agent format translation** — the template resolution priority chain (agent-template.md → generic.md → SKILL.md) spans installer, agent registry, and skill library
- **Manifest consistency** — version tracking, upgrade detection, and multi-agent deduplication affect install, uninstall, and status operations
- **BMAD ordering constraints** — the 6-step customization pipeline (YAML configs before recompile, workflows/templates/agents after) cuts across BMAD integration and installer modules
- **Skill enforcement** — instruction injection priority, BMAD extension module deployment, and per-agent enforcement hooks span installer, BMAD integration, and agent registry

### Phase 2 Requirements Analysis (2026-03-11)

**New Functional Requirements (FR51-FR76):**
26 FRs across 6 capability areas. The architecture must additionally support: (6) instruction injection priority management (TOP placement, JSON injection for OpenCode), (7) a BMAD extension module that injects skill-loading `critical_actions` into BMAD agents, (8) bug entity management and auto-detection skills, (9) sprint management workflows as BMAD extensions, (10) bundled BMAD installation with bundled external modules.

**New Non-Functional Requirements (NFR16-NFR21):**
6 NFRs adding BMAD extension compatibility and bundled installation requirements:
- Extension module must survive BMAD updates (`extends-module` identity persistence) (NFR16)
- Zero bmad-method core modifications — extension APIs only (NFR17)
- OpenCode JSON injection must be additive-only — merge, not replace (NFR18)
- Extension workflows must work via both agent menu and direct slash command (NFR19)

**New Cross-Cutting Concern: Enforcement**
Skill enforcement touches multiple architectural boundaries:
- `installer.js` — instruction injection position (top vs bottom), JSON injection for OpenCode
- `agents.js` — OpenCode agent registration, enforcement hook configuration
- `bmad.js` — extension module deployment, `.customize.yaml` updates with `critical_actions`
- New artifact: BMAD extension module (`module.yaml`, `module-help.csv`, extension workflows)

**Architectural Impact Assessment:**
- 2 new injection strategies (TOP placement, JSON merge)
- 1 new shipped artifact type (BMAD extension module)
- 1 new agent (OpenCode) in registry
- 4 new BMAD extension workflows (bug story, add sprint, modify sprint, add items to sprint)
- 1 new skill (`auto-bug-detection`)
- 4 updated `.customize.yaml` files (SRE, DevOps, Cyber, MIL-498) with skill-loading `critical_actions`
- 1 new bundled dependency (bmad-method v6.0.4)
- 1 new build artifact directory (`lib/bmad-cache/` with 4 pre-cloned external modules)
- 0 new CLI flags (bundled installation is the default and only mode)

## Technology Foundation (Established)

### Primary Technology Domain

CLI tool / build-time packaging pipeline — established brownfield project (v2.19.2)

### Current Technology Stack

| Layer | Technology | Status |
|-------|-----------|--------|
| Runtime | Node.js (JavaScript ES modules) | Established |
| CLI interface | Custom argument parser + interactive wizard (inquirer) | Established |
| Distribution | npm registry via `npx ma-agents` | Established |
| File operations | Node.js fs (cross-platform path handling) | Established |
| Build tooling | None — no transpilation, no bundling | By design |
| Testing framework | Not formalized | Gap |
| Type system | None (plain JavaScript) | Current state |

### Rationale

- **No TypeScript:** Keeps the tool dependency-free and simple for air-gapped deployment. The codebase is small enough (~1,700 lines across 4 files) that type safety is manageable without a type system
- **No build step:** Skills and BMAD content are plain text (markdown/JSON/YAML). The installer is pure Node.js. No transpilation needed means simpler deployment and debugging
- **No framework:** The tool's job is file copying and text transformation — a framework would add complexity without value
- **Starter template: N/A** — brownfield project, technology decisions are established

## Core Architectural Decisions

### Decision Priority Analysis

**Critical Decisions (Established — Formalized Here):**
- Skill data flow and schema contract
- Agent extensibility model (configuration-driven registry)
- Install pipeline stage architecture
- Template resolution priority chain
- Manifest versioning contract

**Important Decisions (Shape Phase 2):**
- Bundled BMAD installer packaging approach
- Visual Studio agent integration mechanism
- Testing strategy formalization

**Deferred Decisions (Phase 3):**
- Central skill registry architecture
- Cross-project analytics collection
- Skill marketplace distribution model

### Data Architecture

**Skill Schema Contract:**
Every skill is a directory containing:
- `skill.json` — metadata SSoT (name, version, description, category, tags, always_load flag)
- `SKILL.md` — canonical skill content (fallback if no agent template exists)
- `templates/<agent-name>.md` — agent-specific content with frontmatter injection
- `references/` and `assets/` — optional supporting files (mapped per agent resource rules)

**Manifest Schema (v1.1.0):**
`.ma-agents.json` per project root tracks:
- `version` — manifest schema version
- `agents` — map of agent-name → installed skills with versions
- Supports multi-agent installs sharing one project directory

**Data Flow:** `skill.json` → installer reads metadata → resolves template (agent-specific → generic → SKILL.md) → injects frontmatter → copies to agent config directory → updates manifest → generates MANIFEST.yaml

### Extensibility Model

**Agent Registry (agents.js):**
- Each agent is a configuration object: name, category, platform paths, instruction file, resource map
- Adding a new agent = adding one object to the registry array (NFR13 satisfied)
- No installer code changes needed — the installer iterates the registry dynamically

**Skill Library:**
- Skills are self-contained directories under `skills/`
- Adding a new skill = adding the directory with skill.json + SKILL.md (NFR14 satisfied)
- The installer discovers skills by scanning the directory — no hardcoded skill list

**Template Resolution Priority:**
1. `templates/<agent-name>.md` — agent-specific (highest priority)
2. `templates/generic.md` — cross-agent fallback
3. `SKILL.md` — canonical content (lowest priority)

This chain satisfies NFR10 (write-once skills) and NFR11 (new agents need only a template mapping).

### Pipeline Architecture

**Install Pipeline (5 stages):**
1. **Discovery** — scan skill library, read skill.json metadata
2. **Selection** — user selects skills (interactive or --yes flag)
3. **Resolution** — resolve template per agent using priority chain
4. **Installation** — copy resolved content to agent config directory, inject frontmatter
5. **Manifest Update** — atomic write to .ma-agents.json, regenerate MANIFEST.yaml

**BMAD Pipeline (6 stages, strictly ordered per NFR8):**
1. Install BMAD core files
2. Apply YAML config customizations
3. Trigger recompile
4. Apply workflow customizations
5. Apply template customizations
6. Apply agent customizations

**Error Handling:** Each stage validates preconditions before execution. Manifest writes use read-modify-write with JSON validation before write (NFR7). Install operations are additive-only — existing files are not removed unless explicitly uninstalling (NFR5).

### Infrastructure & Deployment

**Current (Phase 1):**
- Distribution: npm registry, `npx ma-agents` (zero-install)
- CI/CD: `npx ma-agents install --yes --force` for non-interactive pipeline use
- Cross-platform: Node.js path.join/path.resolve for all file operations (NFR9)

**Phase 2 Decisions:**

| Decision | Options | Status |
|----------|---------|--------|
| Bundled BMAD installation | Bundle bmad-method as npm dependency + pre-clone external modules into `lib/bmad-cache/` | **DECIDED** (P2-6) — bmad-method v6.0.4 pinned, cache pre-population before install |
| Project context auto-generation | Generate `_bmad-output/project-context.md` at install time with platform-aware manifest paths | **DECIDED** (P2-7) — template-based, idempotent, all BMAD critical_actions updated |
| Visual Studio integration | VS Copilot Chat extensions, .vs/ directory, custom mechanism | Needs investigation — depends on VS AI agent config model |
| Testing framework | Node.js built-in test runner, Jest, Vitest | Needs decision — recommend Node.js built-in (no dependencies, aligns with minimal approach) |

### Decision Impact Analysis

**Implementation Sequence:**
1. Extensibility model → enables all skill/agent additions
2. Install pipeline stages → core user-facing workflow
3. BMAD pipeline ordering → enterprise integration reliability
4. Manifest contract → version tracking across all operations
5. (Phase 2) Testing framework → enables regression protection
6. (Phase 2) Bundled BMAD installation → air-gapped deployment
7. (Phase 2) Visual Studio integration → new agent target

**Cross-Component Dependencies:**
- Template resolution spans installer + agent registry + skill library
- Manifest operations span install + uninstall + status commands
- BMAD pipeline depends on installer for file operations but has its own ordering constraints

### Phase 2 Architectural Decisions (2026-03-11)

#### Decision P2-1: Instruction Injection Priority (FR51)

**Decision:** Agent-aware TOP injection with skip patterns

The agent registry in `agents.js` gains an `injectionStrategy` property per agent:

```javascript
{
  name: 'claude-code',
  instructionFile: 'CLAUDE.md',
  injectionStrategy: {
    position: 'top',
    skipPatterns: ['---']  // skip YAML frontmatter block if present
  }
}
```

**Behavior:**
- `installer.js` reads the target instruction file
- Parses file headers based on agent-specific `skipPatterns` (frontmatter, shebang, etc.)
- Injects `<!-- MA-AGENTS-START -->` block after any required file headers but before all other content
- If block already exists (update scenario), removes old block first then injects at top
- Format awareness is centralized in `agents.js` — installer logic is format-agnostic

**Rationale:** Different agents have different file header conventions. Placing the block before a required header would cause the agent to ignore it. The skip patterns keep format knowledge in the agent registry where it belongs.

**Affects:** `installer.js` (injection logic), `agents.js` (registry schema extension)

#### Decision P2-2: OpenCode JSON Injection (FR56-FR57)

**Decision:** Create-if-absent, merge-if-exists

**Behavior:**
- If no `opencode.json` exists: create with ma-agents configuration including `instructions` array pointing to skill files in `.opencode/skills/`
- If `opencode.json` exists: read, parse JSON, merge `instructions` array (append ma-agents entries, preserve all existing entries and keys), write back
- Merge is additive-only — never removes or overwrites existing configuration (NFR18)
- Uses the same read-validate-write pattern as manifest management (NFR7)

**OpenCode agent registry entry:**
```javascript
{
  name: 'opencode',
  category: 'ide',
  configDir: '.opencode',
  skillsDir: '.opencode/skills',
  instructionFile: 'opencode.json',
  injectionStrategy: {
    position: 'json-merge',
    targetKey: 'instructions'
  }
}
```

**Affects:** `agents.js` (new agent entry), `installer.js` (JSON injection path alongside markdown injection)

#### Decision P2-3: BMAD Extension Module Structure (FR52, NFR16-NFR17)

**Decision:** Consolidated extension module in `lib/bmad-extension/`

All BMAD extension content ships as a single module:

```
lib/bmad-extension/
  module.yaml                         — extends-module: bmm, module identity
  module-help.csv                     — phase registration for extension workflows
  workflows/
    create-bug-story/                 — bug story generation from bug report (FR61)
      workflow.md
    add-sprint/                       — add sprint with capacity (FR68)
      workflow.md
    modify-sprint/                    — change/modify sprint (FR70)
      workflow.md
    add-to-sprint/                    — add stories/bugs to sprint (FR69)
      workflow.md
  agents/
    # Custom agents (full customization: persona + menu + critical_actions)
    bmm-sre.customize.yaml
    bmm-devops.customize.yaml
    bmm-cyber.customize.yaml
    bmm-mil498.customize.yaml
    # Built-in BMM agents (critical_actions only — no persona/menu override)
    bmm-pm.customize.yaml
    bmm-architect.customize.yaml
    bmm-dev.customize.yaml
    bmm-qa.customize.yaml
    bmm-sm.customize.yaml
    bmm-tech-writer.customize.yaml
    bmm-ux-designer.customize.yaml
```

**Deployment:** `bmad.js` copies `lib/bmad-extension/` to the BMAD installation directory as a registered extension module. The existing `lib/bmad-customizations/` content migrates into this structure.

**Survival:** The `extends-module: bmm` declaration in `module.yaml` gives the extension an independent identity. BMAD updates (`npx bmad-method install --action update`) preserve extension modules (NFR16).

**Affects:** `bmad.js` (extension deployment), `lib/bmad-extension/` (new directory), `lib/bmad-customizations/` (migrated into extension)

#### Decision P2-4: `critical_actions` for All BMAD Agents (FR52-FR53)

**Decision:** Ship `critical_actions` for all 11 BMAD agents (4 custom + 7 built-in)

**`critical_actions` pattern for all agents:**
```yaml
critical_actions:
  1: "Read the skills MANIFEST at {project-root}/skills/MANIFEST.yaml"
  2: "For each skill marked always_load: true, read the skill file completely"
  3: "Follow all skill directives during this session"
```

**Custom agents** (SRE, DevOps, Cyber, MIL-498): Full `.customize.yaml` with persona, menu, AND `critical_actions`. These already exist — `critical_actions` are added.

**Built-in BMM agents** (PM, Architect, Dev, QA, SM, Tech Writer, UX Designer): Minimal `.customize.yaml` with ONLY `critical_actions`. No persona or menu overrides — preserves the built-in agent behavior while injecting skill loading.

**Scope expansion:** FR53 in PRD says "All 4 BMAD agents" but the architecture covers all 11 to close the enforcement gap for built-in agents too.

**Affects:** `lib/bmad-extension/agents/` (11 customize files), `bmad.js` (deployment)

#### Decision P2-5: Pre-built Extension Workflows (FR61, FR68-FR70)

**Decision:** Author workflows directly in `lib/bmad-extension/workflows/` as static content

4 workflows shipped as pre-built BMAD workflow files:
1. `create-bug-story` — generates a structured bug story from a bug report (FR61)
2. `add-sprint` — creates a new sprint with capacity and iteration ID (FR68)
3. `add-to-sprint` — assigns stories/bugs from backlog to a sprint (FR69)
4. `modify-sprint` — reorder, swap items, adjust capacity (FR70)

Workflows are registered in `module-help.csv` for phase discovery. They function identically whether invoked via BMAD agent menu or direct slash command (NFR19).

**Affects:** `lib/bmad-extension/workflows/` (4 workflow directories), `lib/bmad-extension/module-help.csv`

#### Decision P2-6: Bundled BMAD Installation (FR74-FR76, NFR20-NFR21)

**Decision:** Bundle bmad-method as npm dependency and pre-clone external modules inside the ma-agents npm package

**Problem:** bmad-method's external module installation uses `git clone` to fetch modules (bmb, cis, tea, gds) from GitHub into `~/.bmad/cache/external-modules/`. This fails in air-gapped environments. Additionally, `npx bmad-method` itself requires npm registry access. Since Node.js+npm is always available, bundling via npm dependency is the natural approach.

**Architecture:**

```
lib/
├── bmad-cache/                     — pre-cloned external module repos
│   ├── bmb/                        — bmad-builder module (full git repo snapshot)
│   │   ├── src/
│   │   ├── package.json
│   │   └── node_modules/           — pre-installed production dependencies
│   ├── cis/                        — bmad-creative-intelligence-suite
│   │   ├── src/
│   │   ├── package.json
│   │   └── node_modules/
│   ├── tea/                        — bmad-method-test-architecture-enterprise
│   │   ├── src/
│   │   ├── package.json
│   │   └── node_modules/
│   └── gds/                        — bmad-game-dev-studio
│       ├── src/
│       ├── package.json
│       └── node_modules/
```

**Mechanism — 2 steps in `bmad.js`:**

1. **Pre-populate cache:** Before calling bmad-method, copy `lib/bmad-cache/*` to `~/.bmad/cache/external-modules/` (only if target directory doesn't exist or `--force`). bmad-method's `cloneExternalModule()` checks `fs.pathExists(moduleCacheDir)` — if the cache directory exists, it skips git clone and uses the cached copy.

2. **Invoke bmad-method from npm dependency:** Add `bmad-method` as a direct npm dependency in `package.json` with a pinned version (`"bmad-method": "6.0.4"`). When `npm install` or `npm pack` runs, bmad-method is included in `node_modules/`. Invoke via `require.resolve('bmad-method/tools/bmad-npx-wrapper.js')`. This eliminates the npm registry dependency at runtime.

**Pre-cloned cache creation (build step):**
A new `npm run build:bmad-cache` script:
1. For each module in `external-official-modules.yaml`: `git clone --depth 1 <url> lib/bmad-cache/<code>/`
2. Run `npm install --omit=dev` in each cloned directory
3. Remove `.git/` directories to reduce package size
4. This script runs on a connected machine; the output is committed to the repo

**npm package size impact:**
- bmad-method: ~555 KB (v6.1.0 optimized, v6.0.4 may be larger)
- External modules: estimated 2-5 MB each with node_modules
- Total package size increase: ~10-20 MB — acceptable for enterprise/air-gapped use case

**Version pinning (NFR20):**
- `package.json` pins `bmad-method` to exact version: `"6.0.4"`
- `lib/bmad-cache/` modules are pinned at clone time
- Upgrading is a deliberate operation: update version pin, re-run `npm run build:bmad-cache`, test, release

**Affects:** `bmad.js` (cache pre-population + local invocation), `package.json` (new dependency), new `lib/bmad-cache/` directory, new build script

#### Decision P2-7: Project Context Auto-Generation (FR79-FR86, NFR22-NFR25)

**Decision:** Template-based generation at install time with platform-aware manifest path resolution and idempotency guard

**Problem:** BMAD agents and IDE agents installed via ma-agents have skills available but lack a *constitutional document* that mandates their use. The CLAUDE.md/platform-instruction-file contains the skill-loading rule, but: (1) it only fires reliably for the primary agent session — BMAD workflow-invoked agents may not inherit it; (2) it says nothing about worktree-based git workflows; (3) it has no platform-agnostic path to MANIFEST.yaml when multiple platforms are installed. The `project-context.md` concept from BMAD closes this gap — it is a living document loaded by BMAD workflows (`dev-story`, `code-review`, `create-architecture`, etc.) that acts as persistent behavioral governance across all sessions.

**Architecture:**

The template is maintained as a standalone file, not an inline string:

```
lib/
├── templates/
│   └── project-context.template.md   — canonical template (not embedded in code)
```

**Two-layer design — generator returns content, pipeline handles write:**

```javascript
// Layer 1: generateProjectContext() — pure content generator, no file I/O (Story 13.1)
// installedAgents = ALL agents present in the project manifest (not just current run)
// This ensures project-context.md always lists every installed platform's MANIFEST path.
async function generateProjectContext(projectRoot, installedAgents) {
  const template = await fs.readFile(TEMPLATE_PATH, 'utf8');

  // Resolve relative manifest paths per platform (FR81, FR82) — relative to project root
  const pathLines = installedAgents
    .map(agent => `  - \`${agent.skillsDir}/MANIFEST.yaml\``)
    .join('\n');

  return template.replace('{{MANIFEST_PATHS_LIST}}', pathLines || '  - (no agents installed)');
}

// Layer 2: install pipeline integration (Story 13.2)
// Idempotency guard + file write live here, not in the generator
async function writeProjectContextIfAbsent(projectRoot, installedAgents) {
  const outputPath = path.join(projectRoot, '_bmad-output', 'project-context.md');
  if (await fs.pathExists(outputPath)) {
    console.log(chalk.blue('ℹ project-context.md already exists — skipping generation'));
    return;
  }
  try {
    const content = await generateProjectContext(projectRoot, installedAgents);
    await fs.ensureDir(path.dirname(outputPath));
    await fs.writeFile(outputPath, content, 'utf8');
    console.log(chalk.green('✓ project-context.md generated at _bmad-output/project-context.md'));
  } catch (err) {
    console.log(chalk.yellow(`⚠ project-context generation failed: ${err.message} — continuing`));
  }
}
```

**Template structure (`lib/templates/project-context.template.md`):**

```markdown
# Project Context
<!-- Generated by ma-agents at install time — this is a living document -->
<!--
  EXPAND THIS FILE over time:
  - After architecture:  run /bmad-generate-project-context
  - After each sprint:  run /bmad-retrospective (includes context update step)
  - Manually:           add conventions you notice agents getting wrong
-->

## AI Agent Mandatory Rules

### Pre-Task (EVERY task, no exceptions)
1. Read the MANIFEST.yaml for your platform:
{{MANIFEST_PATHS_LIST}}
2. Load ALL skills marked `always_load: true` completely
3. Select additional skills relevant to the specific task

### Git Workflow (ALL file-changing tasks)
1. Create a fresh worktree: `git worktree add ../{{project}}-{{branch}} -b {{branch}}`
2. ALL work happens inside that worktree — never in the main working tree
3. Use conventional commits: feat/fix/chore/docs/refactor
4. Open a PR to main — never merge directly
5. After merge: `git worktree remove ../{{project}}-{{branch}}`

### Agent Mission Lifecycle
1. Pre-flight: manifest read, always_load skills loaded, task skills selected
2. Fresh worktree + feature branch created
3. Implementation executed
4. Self-review: run code-review skill on own output before PR
5. PR opened with conventional commit message
6. Human review gate: await approval — do NOT auto-merge
7. After merge: worktree removed, branch deleted
8. Post-mission: story status updated, AiAudit.md logged

## Technology Stack
<!-- TODO: Populated by /bmad-generate-project-context after architecture phase -->

## Project-Specific Rules
<!-- TODO: Grows through retrospectives and manual additions -->
```

**Platform path resolution (FR81-FR82):**

The `{{MANIFEST_PATHS_LIST}}` placeholder is replaced at generation time with the actual paths for each installed platform, sourced from the **full project manifest** (`.ma-agents.json`) — not just the agents installed in the current run. This ensures that if Claude Code was installed last week and Cursor today, project-context.md lists both paths. If only Claude Code is installed: `  - \`.claude/skills/MANIFEST.yaml\``. If both are installed, both appear. Paths are relative to project root (NFR22 applies to the template, not the generated output).

**`installedAgents` parameter contract:** Always pass all agents currently recorded in the project manifest. The generator reads `agent.skillsDir` from each entry. Never pass only the current-run agents — incomplete path lists break sessions on any excluded platform.

**BMAD critical_actions update (FR86):**

All **BMM agent** `.customize.yaml` files in `lib/bmad-extension/agents/` (12 total: 4 custom + 7 built-in + bmad-master) gain a new `critical_actions` entry after the MANIFEST step:

```yaml
critical_actions:
  1: "Read the skills MANIFEST at {project-root}/<platform>/skills/MANIFEST.yaml"
  2: "For each skill marked always_load: true, read the skill file completely"
  3: "If _bmad-output/project-context.md exists, read it completely"
  4: "Follow all skill directives and project-context rules during this session"
```

Step 3 uses `if exists` phrasing — graceful degradation for projects that have not yet generated project-context.

**CIS module agents (brainstorming-coach, creative-problem-solver, design-thinking-coach, innovation-strategist, presentation-master, storyteller) are deliberately excluded.** Project-context rules govern software development workflows (git worktrees, code review, mission lifecycle). CIS agents conduct creative and innovation sessions that are orthogonal to these rules. Including project-context in CIS sessions would add irrelevant noise to creative workflows. This is an explicit architecture decision, not an oversight.

**Idempotency (FR82, NFR23):**

`fs.pathExists(outputPath)` check before any write. If the file exists — regardless of content — generation is skipped. A log message notifies the user: `ℹ project-context.md already exists — skipping generation`.

**Global vs project-level install:**

Project-context generation fires only on project-level installs (where a `package.json` or `.git` directory is detected as the project root). Global installs (`~/.config/<agent>/`) do not generate project-context.

**Affects:** `installer.js` (new `generateProjectContext()` function called at end of install pipeline), new `lib/templates/project-context.template.md`, `lib/bmad-extension/agents/*.customize.yaml` (all 11 updated with step 3 in `critical_actions`)

#### Phase 2 Decision Impact Analysis

**Implementation Sequence:**
1. Agent registry extension (`agents.js`) — add OpenCode + `injectionStrategy` to all agents
2. Instruction injection refactor (`installer.js`) — TOP placement + JSON injection path
3. BMAD extension module creation (`lib/bmad-extension/`) — module.yaml, agents, workflows
4. Extension deployment (`bmad.js`) — deploy extension module during BMAD install
5. `auto-bug-detection` skill creation (`skills/auto-bug-detection/`)
6. `.gitignore` update logic (`installer.js`) — don't add `_bmad-output`
7. Bundled BMAD installation (`bmad.js`, `package.json`, `lib/bmad-cache/`) — bundle bmad-method as npm dependency + external modules, pre-populate cache
8. Project context auto-generation (`installer.js`, `lib/templates/project-context.template.md`, `lib/bmad-extension/agents/`) — generate constitutional document at install time, update all BMAD critical_actions

**New Cross-Component Dependencies:**
- `injectionStrategy` in `agents.js` drives `installer.js` injection behavior
- `bmad.js` deploys `lib/bmad-extension/` as a unit — all extension content moves together
- `critical_actions` in `.customize.yaml` reference `skills/MANIFEST.yaml` — depends on skill installation completing first

## Implementation Patterns & Consistency Rules

### Critical Conflict Points

6 areas where AI agents working on the ma-agents codebase could make incompatible choices:

### Naming Patterns

**File & Module Naming:**
- Source files: `kebab-case.js` (e.g., `cli.js`, `installer.js`, `agents.js`)
- Skill directories: `kebab-case` (e.g., `security-skill`, `cpp-best-practices`)
- BMAD agents: `kebab-case` with role prefix (e.g., `bmm-sre`, `bmm-devops`, `cis-storyteller`)
- Templates: `<agent-name>.md` matching the agent registry key exactly

**Code Naming:**
- Functions: `camelCase` (e.g., `installSkills`, `getAgentPath`, `applyCustomizations`)
- Variables: `camelCase` (e.g., `skillList`, `agentConfig`, `manifestData`)
- Constants: `UPPER_SNAKE_CASE` only for true constants (e.g., `MANIFEST_VERSION`)
- No class-based patterns — the codebase uses plain functions and objects

**JSON/YAML Fields:**
- `skill.json`: `snake_case` keys (e.g., `always_load`, `skill_name`) — established convention
- `.ma-agents.json` manifest: `camelCase` keys — established convention
- `config.yaml`: `snake_case` keys — BMAD convention

### Structure Patterns

**Project Organization (established, do not restructure):**
```
bin/cli.js          — CLI entry point and command routing
lib/installer.js    — Core installation engine
lib/agents.js       — Agent registry and configuration
lib/bmad.js         — BMAD integration subsystem
skills/             — Skill library (self-contained directories)
index.js            — Programmatic API exports
```

**Skill Directory Structure (mandatory for all new skills):**
```
skills/<skill-name>/
  skill.json          — metadata SSoT (REQUIRED)
  SKILL.md            — canonical content (REQUIRED)
  templates/           — agent-specific templates (optional)
    claude-code.md
    generic.md
  references/          — supporting docs (optional)
  assets/              — templates/configs (optional)
```

**Where tests go:** `tests/` directory at project root, mirroring source structure (e.g., `tests/installer.test.js`). Co-located tests are not used.

### Format Patterns

**Console Output:**
- User-facing messages: plain text with chalk colors (green=success, yellow=warning, red=error)
- Progress indicators: simple line-by-line output, no spinners or progress bars
- List output: indented with `  - ` prefix
- No emoji in CLI output unless explicitly requested

**Error Messages:**
- Format: `Error: <what went wrong>` followed by `  Hint: <how to fix>` on next line
- Never expose stack traces to users — log to debug only
- Always suggest a recovery action when possible

**Skill Metadata (skill.json):**
```json
{
  "name": "skill-name",
  "version": "1.0.0",
  "description": "One-line description",
  "category": "one of: security|architecture|testing|documentation|workflow|language",
  "tags": ["tag1", "tag2"],
  "always_load": false
}
```

### Process Patterns

**Adding a New Agent:**
1. Add configuration object to `agents.js` registry array
2. Define: name, category, platform paths, instruction file, resource map
3. No changes to `installer.js` or other modules (NFR13)
4. Test: install a skill targeting the new agent, verify file placement

**Adding a New Skill:**
1. Create skill directory under `skills/`
2. Add `skill.json` (metadata) and `SKILL.md` (content) — both required
3. Optionally add `templates/<agent>.md` for agent-specific content
4. No changes to installer or any other module (NFR14)
5. Test: `npx ma-agents list` shows the skill, install works for target agents

**Modifying the Install Pipeline:**
1. Changes to `installer.js` must preserve the 5-stage pipeline order
2. Manifest writes must remain atomic (read → validate → write)
3. All file operations must use `path.join()` — never string concatenation for paths
4. New operations must be additive-only unless explicitly implementing uninstall

**Modifying BMAD Integration:**
1. Changes to `bmad.js` must preserve the 6-stage pipeline order
2. YAML configs always before recompile, workflows/templates/agents always after
3. Never skip the recompile step — downstream customizations depend on it

### Enforcement Guidelines

**All AI Agents Working on This Codebase MUST:**
- Use `path.join()` for all file path construction — never `/` or `\\` concatenation
- Preserve existing module boundaries — no merging modules or moving functions between files without explicit instruction
- Keep the codebase dependency-minimal — no new npm dependencies without explicit approval
- Follow the established 4-module architecture — new functionality goes into the most relevant existing module or a new module if genuinely needed

**Anti-Patterns (Never Do):**
- Adding TypeScript, build steps, or transpilation
- Importing external frameworks (Express, Commander, etc.)
- Creating class hierarchies — use plain functions and objects
- Hardcoding agent names or skill names in installer logic
- Using `process.platform` checks outside of `agents.js` — platform awareness is centralized there

### Phase 2 Implementation Patterns (2026-03-11)

#### Injection Strategy Patterns

**Markdown Injection (TOP placement):**
```
<!-- MA-AGENTS-START -->
<injected skill-loading instructions>
<!-- MA-AGENTS-END -->
```
- `skipPatterns: ['---']` means skip the entire delimited block (e.g., YAML frontmatter between `---` pairs), not just the delimiter line
- **Update scenario:** Find existing `MA-AGENTS-START` → `MA-AGENTS-END` block, replace in-place at the same position
- **New injection:** Insert block after skipped headers, before all other content
- Injection logic in `installer.js` is format-agnostic — all format knowledge lives in `agents.js` via `injectionStrategy`

**JSON Injection (OpenCode):**
- No comment markers — JSON doesn't support comments
- **Detection:** ma-agents entries in the `instructions` array are identified by a known prefix (e.g., entries containing `[ma-agents]` tag)
- **Update scenario:** Filter out existing ma-agents entries from `instructions` array, then append fresh entries
- **New file:** Create `opencode.json` with complete ma-agents configuration
- **Existing file:** Read → parse → merge `instructions` array (additive-only, NFR18) → preserve all other keys → write back
- Uses same read-validate-write pattern as manifest management (NFR7)

#### Extension Module Authoring Patterns

**Built-in Agent `.customize.yaml` (critical_actions only):**
```yaml
# MA-AGENTS: skill enforcement for bmm-<role>
critical_actions:
  1: "Read the skills MANIFEST at {project-root}/skills/MANIFEST.yaml"
  2: "For each skill marked always_load: true, read the skill file completely"
  3: "Follow all skill directives during this session"
```

**Custom Agent `.customize.yaml` (full customization):**
```yaml
# MA-AGENTS: full customization for bmm-<role>
persona: |
  <persona content>
menu:
  <menu entries>
critical_actions:
  1: "Read the skills MANIFEST at {project-root}/skills/MANIFEST.yaml"
  2: "For each skill marked always_load: true, read the skill file completely"
  3: "Follow all skill directives during this session"
  4: "<agent-specific action if needed>"
```

**Rules:**
- Always use YAML block style (not flow style)
- Always quote action string values
- `critical_actions` 1-3 are identical across all 11 agents — treat as a template constant
- Custom agents MAY add actions 4+ for agent-specific needs
- Built-in agents MUST NOT include persona or menu overrides — only `critical_actions`

#### Extension Workflow Patterns

- Each workflow directory: `workflows/<workflow-name>/workflow.md`
- Follows existing BMAD workflow conventions (same structure as `_bmad/bmm/workflows/`)
- `module-help.csv` entries follow BMAD's established CSV schema for phase registration
- NFR19 compliance is automatic — BMAD's registration system supports both menu and slash command invocation for all registered workflows
- No custom invocation handling needed

#### `_bmad-output` Gitignore Patterns

- **During install:** If `_bmad-output` is found in `.gitignore`, remove that line
- **New installs:** Never add `_bmad-output` to `.gitignore`
- **User notification:** Print `"_bmad-output is now tracked as project knowledge (not gitignored)"`
- **Backward compatibility:** Existing projects with `_bmad-output` in `.gitignore` get it removed on next install/update

#### `auto-bug-detection` Skill Pattern

- Standard skill schema: `skill.json` + `SKILL.md` + optional `templates/`
- `always_load: true` — bug detection active for all agents by default
- Passive enforcement model — skill content instructs agents on detection/reporting behavior
- BMAD `critical_actions` ensure the skill is loaded; the skill itself defines what the agent does with it
- Follows all existing skill authoring patterns from Phase 1

#### Phase 2 Enforcement Additions

**All AI Agents Working on Phase 2 Features MUST:**
- Never put format-awareness logic in `installer.js` — all agent format knowledge belongs in `agents.js` via `injectionStrategy`
- Use `<!-- MA-AGENTS-START -->` / `<!-- MA-AGENTS-END -->` markers for all markdown injections — no other marker format
- Keep `critical_actions` 1-3 identical across all 11 agent customize files — divergence breaks the enforcement model
- Use additive-only merge for `opencode.json` — never remove or overwrite existing user configuration

**Phase 2 Anti-Patterns:**
- Hardcoding injection positions (line numbers, byte offsets) instead of using skip pattern parsing
- Creating per-agent injection logic in `installer.js` instead of driving behavior from `agents.js` registry
- Modifying bmad-method core files instead of using extension module APIs (NFR17 violation)
- Adding `_bmad-output` to `.gitignore` (reverses F3 intent)
- Fetching bmad-method via `npx` instead of using the npm dependency copy (breaks air-gap, NFR20 violation)
- Letting bmad-method auto-fetch external modules without pre-populating the cache first (breaks air-gap)
- Including `.git/` directories in `lib/bmad-cache/` — wastes package size, not needed for installation

## Project Structure & Boundaries

### Complete Project Directory Structure

```
ma-agents/
├── package.json                    — npm package config, version, bin entry
├── index.js                        — programmatic API exports
├── README.md                       — user-facing documentation
├── QUICK_START.md                  — getting started guide
├── DEVELOPMENT.md                  — contributor development guide
├── CONTRIBUTING.md                 — contribution guidelines
├── SKILLS_STRUCTURE.md             — skill authoring reference
├── LICENSE                         — project license
├── .gitignore                      — excludes node_modules, _bmad/, .claude/ (NOT _bmad-output — tracked as project knowledge per F3)
│
├── bin/
│   └── cli.js                      — CLI entry point, command routing, interactive wizard
│
├── lib/
│   ├── installer.js                — core install engine, manifest management, MANIFEST.yaml gen
│   ├── agents.js                   — agent registry (12 agents incl. OpenCode), platform paths, resource maps
│   ├── bmad.js                     — BMAD lifecycle: install, update, customize, recompile, bundled cache pre-population
│   ├── bmad-cache/                 — pre-cloned BMAD external modules (committed, built via build:bmad-cache)
│   │   ├── bmb/                    — bmad-builder (with pre-installed node_modules, no .git/)
│   │   ├── cis/                    — bmad-creative-intelligence-suite
│   │   ├── tea/                    — bmad-method-test-architecture-enterprise
│   │   └── gds/                    — bmad-game-dev-studio
│   └── bmad-extension/             — BMAD extension module (deployed to _bmad/ at install)
│       ├── module.yaml             — extends-module: bmm, module identity
│       ├── module-help.csv         — phase registration for extension workflows
│       ├── workflows/
│       │   ├── create-bug-story/   — bug story from bug report (FR61)
│       │   │   └── workflow.md
│       │   ├── add-sprint/         — new sprint with capacity (FR68)
│       │   │   └── workflow.md
│       │   ├── modify-sprint/      — change/modify sprint (FR70)
│       │   │   └── workflow.md
│       │   └── add-to-sprint/      — assign items to sprint (FR69)
│       │       └── workflow.md
│       └── agents/                 — .customize.yaml files for all 11 BMAD agents
│           ├── bmm-sre.customize.yaml       — full: persona + menu + critical_actions
│           ├── bmm-devops.customize.yaml    — full: persona + menu + critical_actions
│           ├── bmm-cyber.customize.yaml     — full: persona + menu + critical_actions
│           ├── bmm-mil498.customize.yaml    — full: persona + menu + critical_actions
│           ├── bmm-pm.customize.yaml        — minimal: critical_actions only
│           ├── bmm-architect.customize.yaml — minimal: critical_actions only
│           ├── bmm-dev.customize.yaml       — minimal: critical_actions only
│           ├── bmm-qa.customize.yaml        — minimal: critical_actions only
│           ├── bmm-sm.customize.yaml        — minimal: critical_actions only
│           ├── bmm-tech-writer.customize.yaml — minimal: critical_actions only
│           └── bmm-ux-designer.customize.yaml — minimal: critical_actions only
│
├── skills/                         — skill library (28 skills incl. auto-bug-detection, self-contained directories)
│   ├── <skill-name>/
│   │   ├── skill.json              — metadata SSoT
│   │   ├── SKILL.md                — canonical content
│   │   ├── templates/              — agent-specific templates (optional)
│   │   │   ├── claude-code.md
│   │   │   ├── cline.md
│   │   │   └── generic.md
│   │   ├── references/             — supporting docs (optional)
│   │   └── assets/                 — templates/configs (optional)
│   └── MANIFEST.yaml               — generated skill index for agent consumption
│
├── _bmad/                          — BMAD-METHOD installation (git-ignored, installed at runtime)
│   ├── core/                       — BMAD core workflows, tasks, agents
│   ├── bmm/                        — BMM module (workflows, config, templates)
│   │   ├── config.yaml             — project-specific BMM configuration
│   │   └── workflows/              — BMAD workflow library
│   └── _config/                    — BMAD configuration and catalog
│
├── _bmad-output/                   — BMAD workflow outputs (version-controlled as project knowledge, NOT git-ignored per F3)
│   ├── planning-artifacts/         — PRD, architecture, epics
│   └── implementation-artifacts/   — stories, specs
│
├── docs/                           — generated project documentation
│   ├── index.md                    — documentation master index
│   ├── project-overview.md         — executive summary
│   ├── architecture.md             — existing architecture reference
│   ├── source-tree-analysis.md     — annotated directory tree
│   └── development-guide.md        — setup and common tasks
│
└── tests/                          — test directory (Phase 2 — currently empty)
    ├── installer.test.js           — installer engine tests
    ├── agents.test.js              — agent registry tests
    ├── bmad.test.js                — BMAD integration tests
    └── cli.test.js                 — CLI command tests
```

### Architectural Boundaries

**Module Boundaries (4 modules, strict separation):**

| Module | Responsibility | Talks To | Never Touches |
|--------|---------------|----------|---------------|
| `cli.js` | Command parsing, user interaction, wizard flow | installer.js, agents.js, bmad.js | File system directly (delegates to installer) |
| `installer.js` | Skill install/uninstall, manifest CRUD, MANIFEST.yaml generation | agents.js (for paths/config) | BMAD lifecycle (delegates to bmad.js) |
| `agents.js` | Agent registry, platform path resolution, resource maps | Nothing (pure data + path functions) | Install logic, BMAD logic |
| `bmad.js` | BMAD install/update/customize/recompile pipeline | File system (fs operations) | Agent registry, skill install logic |

**Data Flow Boundaries:**
```
User Input → cli.js → installer.js → agents.js (path lookup) → file system
                    → bmad.js (if BMAD requested) → file system
                    → installer.js (manifest update) → .ma-agents.json
```

### Requirements to Structure Mapping

| FR Category | Primary Module | Directory |
|-------------|---------------|-----------|
| Skill Management (FR1-7) | `installer.js` | `skills/`, target agent directories |
| BMAD Integration (FR8-12) | `bmad.js` | `_bmad/` |
| MIL-STD-498 Generation (FR13-23) | BMAD workflows | `_bmad/bmm/workflows/` |
| SDLC Workflow Execution (FR24-33) | BMAD workflows | `_bmad/bmm/workflows/`, `_bmad/core/` |
| Agent Targeting (FR34-38) | `agents.js` + `installer.js` | `lib/agents.js`, `skills/*/templates/` |
| Skill Authoring (FR39-43) | `installer.js` (MANIFEST.yaml gen) | `skills/` |
| Environment & Deployment (FR44-47) | `agents.js` (paths) + `installer.js` (manifest) | Platform-specific agent directories |
| Audit & Traceability (FR48-50) | BMAD workflows | `_bmad/bmm/workflows/` |
| Skill Enforcement (FR51-55) | `installer.js` + `agents.js` + `bmad.js` | `lib/bmad-extension/agents/` |
| OpenCode Support (FR56-58) | `agents.js` + `installer.js` | `.opencode/`, `opencode.json` |
| Project Knowledge (FR59-60) | `installer.js` | `.gitignore` modification |
| Bug Management (FR61-65) | BMAD extension workflows + skill | `lib/bmad-extension/workflows/`, `skills/auto-bug-detection/` |
| Sprint Management (FR66-71) | BMAD extension workflows | `lib/bmad-extension/workflows/` |
| Bundled BMAD (FR74-FR76) | `bmad.js` + `lib/bmad-cache/` + `package.json` | `lib/bmad-cache/`, `bmad.js` |

### Integration Points

**Internal Communication:**
- `cli.js` calls `installer.js` functions directly (same process, no IPC)
- `installer.js` calls `agents.js` for path resolution and agent config lookup
- `cli.js` calls `bmad.js` directly for BMAD lifecycle operations
- No event bus, no message queue — synchronous function calls within one process

**External Integrations:**
- npm registry (distribution only — `npx` handles this, not our code)
- File system (the only external system the tool interacts with at runtime)
- No network calls, no APIs, no databases

## Architecture Validation Results

### Coherence Validation

**Decision Compatibility:** PASS
- Node.js runtime + plain JavaScript + no build step + no framework — all align. No conflicting technology choices
- 4-module architecture with strict boundaries maps cleanly to the extensibility model (config-driven agents + directory-scanned skills)
- Pipeline architectures (5-stage install, 6-stage BMAD) don't conflict — they operate on different data flows
- Phase 2: P2-1 (TOP injection) and P2-2 (JSON injection) are independent strategies driven by `agents.js` registry — no conflict
- Phase 2: P2-3 (extension module) uses BMAD's official `extends-module` API — compatible with existing BMAD pipeline (NFR17)
- Phase 2: P2-4 (`critical_actions`) depends on P2-3 for deployment — correct ordering in implementation sequence
- Phase 2: P2-5 (pre-built workflows) deploys via same extension module — no new deployment mechanism needed

**Pattern Consistency:** PASS
- Naming conventions (camelCase code, kebab-case files, snake_case skill.json) are consistent with established codebase
- Process patterns (adding agents, adding skills) directly support the extensibility model decisions
- Enforcement guidelines align with technology choices (no TypeScript, no frameworks, path.join everywhere)
- Phase 2: `injectionStrategy` in `agents.js` follows established pattern of centralizing agent knowledge there
- Phase 2: Extension module uses kebab-case naming consistent with existing conventions
- Phase 2: `auto-bug-detection` skill follows standard skill schema — no special-casing

**Structure Alignment:** PASS
- 4-module source structure maps 1:1 to module boundaries table
- Skills directory structure enforces the schema contract from Data Architecture
- Tests directory mirrors source structure per patterns decision
- Phase 2: `lib/bmad-extension/` sits alongside existing `lib/` modules — consistent with module organization
- Phase 2: 11 customize files map 1:1 to BMAD agent roster; 4 workflow directories map 1:1 to FRs

### Requirements Coverage Validation

**Functional Requirements Coverage:**

| FR Category | Architectural Support | Status |
|-------------|----------------------|--------|
| Skill Management (FR1-7) | Install pipeline + manifest manager | COVERED |
| BMAD Integration (FR8-12) | BMAD pipeline architecture | COVERED |
| MIL-STD-498 Generation (FR13-23) | BMAD workflows (delivered via BMAD, not ma-agents code) | COVERED |
| SDLC Workflows (FR24-33) | BMAD workflows | COVERED |
| Agent Targeting (FR34-38) | Agent registry + template resolution chain | COVERED |
| Skill Authoring (FR39-43) | Skill schema contract + MANIFEST.yaml generation | COVERED |
| Environment & Deployment (FR44-47) | Cross-platform paths + offline operation | COVERED |
| Audit & Traceability (FR48-50) | BMAD workflows + ai-audit-trail skill | COVERED |
| Skill Enforcement (FR51-55) | P2-1 + P2-3 + P2-4: injection strategies, extension module, critical_actions | COVERED |
| OpenCode Support (FR56-58) | P2-2: JSON injection + new agent registry entry | COVERED |
| Project Knowledge (FR59-60) | Gitignore pattern: remove `_bmad-output` from `.gitignore` | COVERED |
| Bug Management (FR61-65) | P2-5: extension workflow + `auto-bug-detection` skill | COVERED |
| Sprint Management (FR66-71) | P2-5: extension workflows (add/modify/add-to sprint) | COVERED |

**Non-Functional Requirements Coverage:**

| NFR | Architectural Support | Status |
|-----|----------------------|--------|
| NFR1-4 (Security) | No network calls, plain text content, additive-only ops | COVERED |
| NFR5-8 (Integration Reliability) | Pipeline ordering, atomic manifests, additive installs | COVERED |
| NFR9-12 (Portability) | path.join centralization, template resolution chain, Node LTS | COVERED |
| NFR13-15 (Maintainability) | Config-driven agent registry, directory-scanned skills, backward compat | COVERED |
| NFR16 (Extension Survival) | `extends-module: bmm` identity in module.yaml, independent of BMAD updates | COVERED |
| NFR17 (Zero Core Mods) | Extension module APIs only, no bmad-method core changes | COVERED |
| NFR18 (Additive JSON) | OpenCode JSON merge pattern: append to instructions array, preserve all keys | COVERED |
| NFR19 (Dual Invocation) | BMAD registration system supports both menu and slash command natively | COVERED |
| NFR20 (Version Pinning) | `package.json` pins bmad-method exact version, `lib/bmad-cache/` pinned at clone time | COVERED |
| NFR21 (Identical Output) | Same bmad-method version + same module cache = identical `_bmad/` output regardless of environment | COVERED |

### Implementation Readiness Validation

**Decision Completeness:** HIGH
- All Phase 1 decisions documented with rationale
- Phase 2 decisions P2-1 through P2-5 now decided and documented (instruction injection, OpenCode, extension module, critical_actions, extension workflows)
- Remaining Phase 2 items (Visual Studio integration, testing framework) still flagged as needs investigation
- No ambiguous or conflicting decisions

**Pattern Completeness:** HIGH
- All 6 Phase 1 conflict points addressed with concrete rules
- 5 Phase 2 conflict areas addressed (injection strategy, extension module authoring, extension workflows, gitignore, auto-bug-detection skill)
- Anti-patterns explicitly listed for both phases
- Process patterns cover the 4 most common modification scenarios

**Structure Completeness:** HIGH
- Full directory tree with annotations
- Module boundary table with explicit "Never Touches" column
- FR-to-module mapping table provides traceability

### Gap Analysis Results

**No Critical Gaps.** All 76 FRs and 21 NFRs have architectural support.

**Important Gaps (Phase 2 — Known and Flagged):**
- Testing framework not yet decided — blocks regression testing
- Visual Studio integration mechanism unknown — blocks new agent target

**Minor Gaps:**
- No formal error code catalog — errors are currently ad-hoc strings
- No formal logging strategy — console output patterns defined but no structured logging for diagnostics
- FR53 scope expansion (4 → 11 agents) — aligned across PRD, Architecture, and Epics (fixed 2026-03-15)

### Architecture Completeness Checklist

**Requirements Analysis**
- [x] Project context thoroughly analyzed
- [x] Scale and complexity assessed
- [x] Technical constraints identified
- [x] Cross-cutting concerns mapped

**Architectural Decisions**
- [x] Critical decisions documented with rationale
- [x] Technology stack fully specified
- [x] Pipeline architectures defined
- [x] Extensibility model formalized

**Implementation Patterns**
- [x] Naming conventions established
- [x] Structure patterns defined
- [x] Format patterns specified
- [x] Process patterns documented
- [x] Anti-patterns explicitly listed

**Project Structure**
- [x] Complete directory structure defined
- [x] Component boundaries established
- [x] Integration points mapped
- [x] Requirements to structure mapping complete

### Architecture Readiness Assessment

**Overall Status:** READY FOR IMPLEMENTATION

**Confidence Level:** High — brownfield project with established, working architecture being formalized

**Key Strengths:**
- Configuration-driven extensibility eliminates code changes for the most common operations (adding agents, adding skills)
- Strict pipeline ordering prevents the most dangerous class of bugs (BMAD customization loss)
- Cross-platform path centralization in agents.js prevents the most common class of platform bugs
- Simple, dependency-minimal architecture aligns with air-gapped deployment requirements

**Areas for Future Enhancement:**
- Testing framework decision and test suite creation (Phase 2)
- Error code standardization
- Structured logging for diagnostic purposes
- Visual Studio integration investigation
