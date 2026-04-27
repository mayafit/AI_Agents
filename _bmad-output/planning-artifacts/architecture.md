---
stepsCompleted: ['step-01-init', 'step-02-context', 'step-03-starter', 'step-04-decisions', 'step-05-patterns', 'step-06-structure', 'step-07-validation', 'step-08-complete']
phase2StepsCompleted: ['step-02-context', 'step-04-decisions', 'step-05-patterns', 'step-06-structure', 'step-07-validation', 'step-08-complete']
phase2CompletedAt: '2026-03-11'
phase2cStepsCompleted: ['step-02-context', 'step-04-decisions', 'step-06-structure', 'step-07-validation', 'step-08-complete']
phase2cCompletedAt: '2026-03-26'
phase4EditHistory:
  - date: '2026-04-13'
    changes: 'Added Phase 4 Architectural Decisions section with Decision P4-1: BMAD v6.3.0 Plugin Migration (FR182-FR195, NFR50-NFR54). Captures the architectural inversion from post-install manifest surgery (current applyCustomizations in lib/bmad.js:205-346) to pre-install local plugin staging: ma-agents assembles a BMAD-Builder-compliant plugin (.claude-plugin/marketplace.json + skills/module.yaml) into lib/bmad-extension-plugin/ at build time, bundles it in the npm tarball, and on install stages it to <project>/.ma-agents-plugin-stage/ before invoking bmad-method with --custom-source <local-path>. Air-gapped guarantee preserved via PluginResolver local-file strategy. Multi-tool routing preserved via BMAD installer (--tools claude-code/copilot/cline/roo-code/kilocode). Skill namespace rename bmad-ma-agent-* → ma-agent-* to vacate reserved prefix. Removal of legacy skills (bmad-init, bmad-agent-qa Quinn, bmad-agent-sm Bob, bmad-agent-quick-flow-solo-dev Barry) following upstream persona consolidation into Amelia. Config read path moved from _bmad/_config/ to _bmad/bmm/config.yaml. Deferred follow-up: Demerzel and Gad converted to Memory-agent format; Yael/Amit/Alex remain stateless. Technology stack bumped from bmad-method v6.2.0 to v6.3.0.'
phase3EditHistory:
  - date: '2026-04-07'
    changes: 'Added Decision P3-1: BMAD Knowledge Graph (FR141-FR157, NFR38-NFR41). Three-layer design: (1) knowledge-graph.json with meta/files/nodes/edges structure — files table maps short file-ids to arbitrary pointers (relative path, absolute path, URL), nodes use file-id#anchor identity, edges carry 6 typed relationships including informed-by for non-hierarchical influence, full provenance (created_by, agent, created_at). (2) BMAD skill emission via read-modify-write emitToGraph() pattern — additive-only, 7 emitting skills tabulated with their edge types, heading-to-anchor slug algorithm documented, LLM-writability contract defined. (3) open-graph skill as new extension module skill — VSCode env detection, self-contained HTML renderer with inlined JS/CSS and embedded JSON data, SVG-based visualization, color-coded nodes, edge tooltips, filter controls, neighbor highlight, URL navigation for external files. Updated project structure tree (knowledge-graph.json/html in _bmad-output/, open-graph/ in extension module skills), skill count 44→45, requirements coverage tables, validation section.'
phase2bEditHistory:
  - date: '2026-04-03'
    changes: 'Added P2-11: Unified Sprint-Status File Architecture — single sprint-status.yaml replaces 3-file model (backlog.yaml + sprints/sprint-N.yaml + sprint-status.yaml). Movement semantics, atomic operations, close-sprint lifecycle, done archival, Jira adapter pattern. Updated P2-5 to include close-sprint and remove-from-sprint workflows (6 extension workflows, up from 4). Updated extension module structure trees, skill counts (44, up from 42), project structure, FR coverage tables, and validation sections. Added prioritize-backlog to skill integration map (13 skills). Fixed FR count to 141. Fixed sprint-status.yaml canonical path to implementation-artifacts/. Marked P2-3 as superseded by P2-9.'
  - date: '2026-03-26'
    changes: 'Revised P2-6: Explicit CLI parameter passing replaces silent install (FR123-FR127). Added P2-9: BMAD 6.2.0 Migration — agents as skill folders, 34 workflows as SKILL.md packages, module.yaml with code field, --custom-content deployment, .customize.yaml for 8 built-in agents only. Added P2-10: Multi-repo project layout — config-driven path resolution, project-layout.yaml cross-reference. Verified architecture against CIS module source and BMAD 6.2.0 customize docs. Updated project structure tree, implementation sequence, cross-component dependencies. Moved F8 Dashboard to Phase 3. Added wds to bmad-cache, bumped bmad-method pin to 6.2.0.'
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
141 FRs across 14 capability areas (Phase 1: 50 FRs across 8 areas + Phase 2: 91 FRs across 6 areas, minus FR77-FR78 deleted). The architecture must support: (1) a content transformation pipeline that translates skills into agent-native formats, (2) a BMAD lifecycle management subsystem, (3) MIL-STD-498 document generation workflows delivered via BMAD, (4) manifest-based version tracking across multi-agent installs, (5) skill authoring and governance capabilities, and (6) unified sprint-status management with movement semantics and tracking-system adapter pattern.

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
- 6 new BMAD extension workflows (bug story, add sprint, modify sprint, add items to sprint, remove from sprint, close sprint)
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

#### Decision P2-3: BMAD Extension Module Structure (FR52, NFR16-NFR17) **[SUPERSEDED by P2-9]**

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

**Decision:** Author workflows directly in `lib/bmad-extension/skills/` as static content

6 workflows shipped as pre-built BMAD skill files:
1. `create-bug-story` — generates a structured bug story from a bug report (FR61)
2. `add-sprint` — creates a new sprint entry in the unified `sprint-status.yaml` with capacity and iteration ID (FR68)
3. `add-to-sprint` — moves items from `backlog:` section to a sprint's `items:` in unified `sprint-status.yaml` (FR69)
4. `modify-sprint` — updates sprint metadata, reorder items, adjust capacity in unified `sprint-status.yaml` (FR70)
5. `close-sprint` — sprint close lifecycle: archive done items, handle canceled items, disposition remaining items (new — see P2-11)
6. `remove-from-sprint` — moves items from a sprint's `items:` back to `backlog:` section in unified `sprint-status.yaml`

All sprint management workflows operate on the unified `sprint-status.yaml` file (see P2-11 for data architecture). Workflows are registered in `module-help.csv` for phase discovery. They function identically whether invoked via BMAD agent menu or direct slash command (NFR19).

**Affects:** `lib/bmad-extension/skills/` (6 workflow directories), `lib/bmad-extension/module-help.csv`

#### Decision P2-6: Bundled BMAD Installation with Explicit Parameter Passing (FR74-FR76, FR123-FR127, NFR20-NFR21)

**Decision:** Bundle bmad-method as npm dependency, pre-clone external modules, and invoke bmad-method with explicit CLI parameters instead of silent mode

**Problem (original):** bmad-method's external module installation uses `git clone` to fetch modules (bmb, cis, tea, gds, wds) from GitHub into `~/.bmad/cache/external-modules/`. This fails in air-gapped environments. Additionally, `npx bmad-method` itself requires npm registry access.

**Problem (updated — FR123-FR127):** The current silent install (`--yes` flag) skips critical configuration: selected tools/platforms are not passed to bmad-method (OpenCode not configured even when selected in ma-agents), and paths with spaces break due to improper quoting in `execSync` calls. The fix is not to invoke setup skills programmatically — bmad-method already supports full parameterized invocation via CLI flags.

**Architecture — Bundling (unchanged):**

```
lib/
├── bmad-cache/                     — pre-cloned external module repos
│   ├── bmb/                        — bmad-builder module (full git repo snapshot)
│   │   ├── src/
│   │   ├── package.json
│   │   └── node_modules/           — pre-installed production dependencies
│   ├── cis/                        — bmad-creative-intelligence-suite
│   ├── tea/                        — bmad-method-test-architecture-enterprise
│   ├── gds/                        — bmad-game-dev-studio
│   └── wds/                        — bmad-whiteport-design-studio
```

**Architecture — Invocation (revised):**

ma-agents maps its collected installation answers to bmad-method CLI parameters:

```javascript
// In bmad.js — buildBmadArgs() constructs the full parameter list
function buildBmadArgs(installContext) {
  const bmadPath = require.resolve('bmad-method/tools/bmad-npx-wrapper.js');
  const args = [
    'node', `"${bmadPath}"`, 'install',
    '--directory', `"${installContext.projectRoot}"`,           // FR123: project path (quoted for spaces)
    '--modules', installContext.selectedModules.join(','),      // e.g., "bmm,bmb,cis,tea,gds,wds"
    '--tools', installContext.selectedTools.join(','),          // FR123: e.g., "claude-code,cursor,opencode"
    '--user-name', `"${installContext.userName}"`,              // FR123: from ma-agents wizard
    '--communication-language', installContext.commLang,        // FR123: default "English"
    '--document-output-language', installContext.docLang,       // FR123: default "English"
    '--output-folder', installContext.outputFolder,             // default "_bmad-output"
    '--custom-content', `"${installContext.extensionPath}"`,    // path to lib/bmad-extension/
    '--yes',                                                    // FR126: skip prompts for params already provided
  ];
  if (installContext.isUpdate) {
    args.push('--action', 'update');                            // FR107: upgrade detection
  }
  return args;
}
```

**Parameter mapping table (FR123):**

| ma-agents collects | bmad-method flag | Source |
|---|---|---|
| Project path | `--directory` | Detected from cwd / package.json / .git |
| Selected platforms (claude-code, cursor, opencode...) | `--tools` | Interactive wizard or `--yes` defaults |
| BMAD modules to install | `--modules` | Always "bmm,bmb,cis,tea,gds,wds" (full bundle) |
| User name | `--user-name` | Wizard prompt or system username |
| Communication language | `--communication-language` | Wizard prompt or "English" default |
| Document output language | `--document-output-language` | Wizard prompt or "English" default |
| Output folder | `--output-folder` | Always "_bmad-output" |
| Extension module | `--custom-content` | Always `lib/bmad-extension/` path |
| Fresh vs upgrade | `--action` | Detected: "install" if no `_bmad/`, "update" if exists |

**How this solves the three bugs:**
1. **OpenCode not configured** → `--tools` explicitly lists all selected platforms including opencode
2. **Spaces in paths** → all path arguments are quoted: `--directory "d:\My Projects\agents"`
3. **Silent install skips config** → `--yes` only suppresses prompts for parameters already supplied via flags — it doesn't skip configuration

**Default handling (FR125):** When bmad-method introduces new CLI parameters that ma-agents hasn't mapped, the `--yes` flag causes bmad-method to apply its own defaults for those parameters. No configuration is ever skipped — it's either explicitly provided by ma-agents or defaulted by bmad-method.

**Single wizard UX (FR126):** The user interacts only with ma-agents' wizard. bmad-method runs non-interactively with full explicit parameters. No second wizard prompt ever appears.

**CI/CD mode (FR127):** `npx ma-agents install --yes --force` → ma-agents uses its own defaults for all parameters → passes those defaults to bmad-method via the same `buildBmadArgs()` function → identical code path, just with pre-determined answers.

**Mechanism — 2 steps in `bmad.js` (cache + invoke):**

1. **Pre-populate cache:** Before calling bmad-method, copy `lib/bmad-cache/*` to `~/.bmad/cache/external-modules/` (only if target directory doesn't exist or `--force`). bmad-method's `cloneExternalModule()` checks `fs.pathExists(moduleCacheDir)` — if the cache directory exists, it skips git clone and uses the cached copy.

2. **Invoke bmad-method with explicit params:** `execSync(buildBmadArgs(installContext).join(' '))` — bmad-method is a direct npm dependency, resolved via `require.resolve()`. No `npx` download at runtime.

**Pre-cloned cache creation (build step):**
A new `npm run build:bmad-cache` script:
1. For each module in `external-official-modules.yaml`: `git clone --depth 1 <url> lib/bmad-cache/<code>/`
2. Run `npm install --omit=dev` in each cloned directory
3. Remove `.git/` directories to reduce package size
4. This script runs on a connected machine; the output is committed to the repo

**npm package size impact:**
- bmad-method: ~555 KB (v6.2.0 optimized — 91% smaller than 6.0.x)
- External modules: estimated 2-5 MB each with node_modules
- Total package size increase: ~10-20 MB — acceptable for enterprise/air-gapped use case

**Version pinning (NFR20):**
- `package.json` pins `bmad-method` to exact version: `"6.2.0"`
- `lib/bmad-cache/` modules are pinned at clone time
- Upgrading is a deliberate operation: update version pin, re-run `npm run build:bmad-cache`, test, release

**Affects:** `bmad.js` (cache pre-population + parameterized invocation), `package.json` (dependency pinned to 6.2.0), `lib/bmad-cache/` (5 modules incl. wds), build script

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

#### Decision P2-9: BMAD 6.2.0 Agent Architecture Migration (FR94-FR110, NFR29-NFR33)

**Decision:** Restructure the extension module to follow BMAD 6.2.0 module conventions — agents as skill folders, workflows as skill folders, `module.yaml` with `code` field, deployed via `--custom-content`

**Problem:** The 4 custom agents (SRE, DevOps, Cyber, MIL-498) are currently delivered via `.customize.yaml` files. BMAD 6.2.0 modules deliver agents as skills (`SKILL.md` + `bmad-skill-manifest.yaml` with `type: agent`). `.customize.yaml` is for END-USER customization of other modules' agents, not for delivering module-owned agents. Additionally, MIL-498 workflows use the legacy YAML/XML workflow engine which is removed in 6.2.0.

**Verified pattern (from CIS module source):**
- Agents in modules: `skills/<agent-name>/SKILL.md` + `bmad-skill-manifest.yaml` (type: agent)
- Workflows in modules: `skills/<workflow-name>/SKILL.md` + `bmad-skill-manifest.yaml` (type: skill)
- Module identity: `module.yaml` with `code` field
- Deployment: `--custom-content <module-path>`

**Revised extension module structure:**

```
lib/bmad-extension/
├── module.yaml                              — code: ma-skills, name, description
├── module-help.csv                          — capability registry for all agents + workflows
└── skills/
    │
    │ ── Agent Skills (type: agent) ──
    ├── bmad-ma-agent-sre/
    │   ├── SKILL.md                         — Alex: full agent instructions (persona, menu, activation, critical_actions)
    │   └── bmad-skill-manifest.yaml         — type: agent, displayName: Alex, role: SRE, module: ma-skills
    ├── bmad-ma-agent-devops/
    │   ├── SKILL.md                         — Amit: DevOps agent
    │   └── bmad-skill-manifest.yaml
    ├── bmad-ma-agent-cyber/
    │   ├── SKILL.md                         — Yael: Cyber Security Analyst
    │   └── bmad-skill-manifest.yaml
    ├── bmad-ma-agent-mil498/
    │   ├── SKILL.md                         — Joseph: MIL-STD-498 Expert
    │   └── bmad-skill-manifest.yaml
    │
    │ ── MIL-498 DID Workflows (type: skill, Complex Workflow) ──
    ├── mil498-sss/
    │   ├── SKILL.md                         — SSS generation entrypoint
    │   ├── bmad-skill-manifest.yaml         — type: skill
    │   ├── template.md                      — SSS DID template
    │   └── prompts/                         — step files (progressive disclosure)
    │       ├── 01-discovery.md
    │       ├── 02-requirements.md
    │       └── ...
    ├── mil498-ssdd/                          — SSDD generation
    ├── mil498-ocd/                           — OCD generation
    ├── mil498-sdp/                           — SDP generation
    ├── mil498-srs/                           — SRS generation
    ├── mil498-sdd/                           — SDD generation
    ├── mil498-std/                           — STD generation
    ├── mil498-str/                           — STR generation
    ├── mil498-idd/                           — IDD generation
    ├── mil498-irs/                           — IRS generation
    ├── mil498-hrs/                           — HRS generation
    │
    │ ── SRE Playbooks (type: skill) ──
    ├── sre-health-check/
    │   ├── SKILL.md                         — health check workflow
    │   └── bmad-skill-manifest.yaml
    ├── sre-fix-deployments/
    ├── sre-performance-opt/
    ├── sre-check-deployment-status/
    ├── sre-check-secrets/
    ├── sre-day-2-ops/
    ├── sre-deployment-strategies/
    ├── sre-gitops-status/
    │   └── (1 more — 9 SRE workflows total)
    │
    │ ── DevOps Playbooks (type: skill) ──
    ├── devops-configure-infrastructure/
    ├── devops-optimize-pipelines/
    ├── devops-manage-helm/
    ├── devops-disconnected-deployment/
    ├── devops-docker-compose-setup/
    ├── devops-sign-docker-image/
    │   └── (6 DevOps workflows total)
    │
    │ ── Cyber Playbooks (type: skill) ──
    ├── cyber-vulnerability-scan/
    ├── cyber-security-audit/
    ├── cyber-threat-modeling/
    ├── cyber-generate-certs/
    ├── cyber-immunity-estimation/
    ├── cyber-vault-secrets/
    ├── cyber-verify-docker-users/
    ├── cyber-verify-image-signature/
    │   └── (8 Cyber workflows total)
    │
    │ ── BMAD Extension Workflows (type: skill) ──
    ├── create-bug-story/                    — bug story from report (FR61)
    │   ├── SKILL.md
    │   └── bmad-skill-manifest.yaml
    ├── add-sprint/                          — new sprint entry in unified sprint-status.yaml (FR68)
    ├── modify-sprint/                       — update sprint metadata/items in unified file (FR70)
    ├── add-to-sprint/                       — move items from backlog to sprint in unified file (FR69)
    ├── close-sprint/                        — sprint close lifecycle: archive done, disposition remaining (P2-11)
    │   ├── SKILL.md
    │   └── bmad-skill-manifest.yaml
    └── remove-from-sprint/                  — move items from sprint back to backlog
        ├── SKILL.md
        └── bmad-skill-manifest.yaml
```

**Total skills in module:** 4 agents + 11 MIL-498 + 9 SRE + 6 DevOps + 8 Cyber + 6 extension workflows + 1 open-graph = **45 skills**

**`bmad-skill-manifest.yaml` patterns:**

Agent skill manifest:
```yaml
type: agent
name: bmad-ma-agent-sre
displayName: Alex
title: Site Reliability Engineer
icon: "🔧"
capabilities: "system availability, Kubernetes ops, SLO/SLA management, deployment strategies"
role: "Site Reliability Engineer"
identity: "Experienced SRE focused on system reliability and operational excellence"
communicationStyle: "Direct, data-driven, alert to risks"
principles: "Reliability first. Automate everything. Measure what matters."
module: ma-skills
```

Workflow skill manifest:
```yaml
type: skill
name: mil498-srs
module: ma-skills
```

**`module.yaml` update:**
```yaml
code: ma-skills
name: "MA-Agents Skills & Agents"
description: "Enterprise methodology enforcement, specialized agents, and operational workflows"
extends-module: bmm
default_selected: false
```

The `code` field is required for `--custom-content` deployment. `extends-module: bmm` is retained to indicate this module builds on BMM.

**Agent SKILL.md content:** Each agent's `SKILL.md` contains the full agent definition that was previously split across `.customize.yaml` + XML `<agent>` definition:
- Persona (role, identity, communication style, principles)
- Menu items with trigger phrases
- Activation sequence (including skill-loading critical_actions)
- References to the agent's workflow skills (e.g., SRE agent's menu references `sre-health-check`, `sre-fix-deployments`, etc.)

**Built-in BMM agent customization (7 agents + bmad-master):**
The 8 built-in BMM agents that ma-agents does NOT own still use `.customize.yaml` files — these are deployed by `bmad.js` to `_bmad/_config/agents/` AFTER `--custom-content` installs the module. These files add `critical_actions` for skill loading only (no persona/menu override):

```yaml
# MA-AGENTS: skill enforcement for bmm-pm
critical_actions:
  - "Read the skills MANIFEST at {project-root}/skills/MANIFEST.yaml"
  - "For each skill marked always_load: true, read the skill file completely"
  - "If _bmad-output/project-context.md exists, read it completely"
  - "Follow all skill directives and project-context rules during this session"
```

**Note:** In 6.2.0, `critical_actions` in `.customize.yaml` uses array syntax (list of strings), not numbered map syntax. Updated to match current BMAD documentation.

**Deployment sequence in `bmad.js`:**
1. Pre-populate `~/.bmad/cache/external-modules/` from `lib/bmad-cache/`
2. Invoke bmad-method with `--custom-content "lib/bmad-extension/"` — installs the module including 4 agents and all workflow skills
3. Deploy `.customize.yaml` files for 8 built-in BMM agents to `_bmad/_config/agents/`
4. Run `--action quick-update` to apply customizations

**MIL-498 workflow conversion detail (FR98-FR100):**
Each DID workflow converts from `workflow.yaml` + `instructions.md` (legacy engine) to:
- `SKILL.md` — workflow entrypoint with frontmatter triggers and routing logic
- `prompts/` — step files for progressive disclosure (Layer 4), preserving strict sequential execution
- `template.md` — DID output template (same content, new location)
- The legacy `<template-output>` checkpoints become explicit user confirmation gates in step files

**SRE/DevOps/Cyber workflow conversion detail (FR101-FR103):**
These workflows are already `.md` files. Conversion is lighter:
- Wrap existing `.md` content in `SKILL.md` with proper frontmatter
- Add `bmad-skill-manifest.yaml` with `type: skill`
- Multi-step workflows get `prompts/` for progressive disclosure
- Single-pass playbooks remain as simple `SKILL.md` files

**Migration detection and upgrade path (FR107-FR110):**

```javascript
// In bmad.js — detect BMAD version and migration need
function detectMigrationNeed(projectRoot) {
  const configPath = path.join(projectRoot, '_bmad', 'core', 'config.yaml');
  if (!fs.existsSync(configPath)) return { action: 'install', migrate: false };

  const config = yaml.load(fs.readFileSync(configPath, 'utf8'));
  const version = config?.version || '0.0.0';

  if (semver.lt(version, '6.2.0')) {
    return { action: 'update', migrate: true, fromVersion: version };
  }
  return { action: 'update', migrate: false };
}
```

**Migration steps (when upgrading from 6.0.4):**
1. Detect old version from `_bmad/core/config.yaml`
2. Back up existing `_bmad/_config/agents/*.customize.yaml` (user customizations to preserve)
3. Invoke bmad-method with `--action update` + `--custom-content` — bmad-method handles the core upgrade
4. Deploy new `.customize.yaml` files for built-in agents
5. Merge user customizations back: if user had added custom `memories` or extra `critical_actions` to any of the 4 custom agents, carry those forward into the new agent SKILL.md
6. Clean up legacy artifacts: old `.customize.yaml` files for custom agents (now replaced by module agent skills), XML agent definitions in `_bmad/custom/agents/`, YAML workflow files in `lib/bmad-workflows/mil498/`

**Rollback (NFR29):** If bmad-method update fails, `bmad.js` restores the backed-up `.customize.yaml` files and logs the error. The project remains on the old version. Full atomicity is achieved by backing up before and restoring on failure.

**Affects:** `lib/bmad-extension/` (complete restructure), `bmad.js` (migration detection, `--custom-content` deployment, `.customize.yaml` deployment for built-ins), `lib/bmad-workflows/` (migrated into extension module skills), `lib/bmad-customizations/` (eliminated — content moved to extension module)

#### Decision P2-10: Multi-Repository Project Layout (FR111-FR122, NFR34-NFR37)

**Decision:** Config-driven path resolution with `project-layout.yaml` cross-reference file

**Problem:** Enterprise projects separate planning docs, sprint management, and code across repositories. BMAD workflows that produce/consume artifacts need to resolve paths to the correct repository. Agents operating in the code repo need to discover where planning and sprint data live.

**Architecture:**

**Installation flow (FR111-FR116):**
```javascript
// In cli.js — new wizard section after agent selection
async function collectRepoLayout() {
  const layout = { knowledgebase: null, sprintManagement: null };

  for (const concern of ['knowledgebase', 'sprintManagement']) {
    const mode = await prompt({
      type: 'list',
      message: `Where is your ${concern} managed?`,
      choices: [
        { name: 'Current repository (default)', value: 'same' },
        { name: 'Local path', value: 'local' },
        { name: 'Remote git repository', value: 'remote' },
      ]
    });

    if (mode === 'same') {
      layout[concern] = { mode: 'same', path: '.' };
    } else if (mode === 'local') {
      const localPath = await prompt({ message: 'Local path:' });
      if (!fs.existsSync(localPath)) {
        console.log(chalk.yellow(`⚠ Path does not exist: ${localPath}`));
        const confirmed = await prompt({ type: 'confirm', message: 'Use this path anyway?' });
        if (!confirmed) continue; // re-ask
      }
      layout[concern] = { mode: 'local', path: path.resolve(localPath) };
    } else if (mode === 'remote') {
      const gitUrl = await prompt({ message: 'Git URL:' });
      const destPath = await prompt({ message: 'Local destination for cloning:' });
      if (fs.existsSync(destPath)) {
        console.log(chalk.blue(`ℹ Directory already exists: ${destPath}`));
        const confirmed = await prompt({ type: 'confirm', message: 'Use existing directory?' });
        if (!confirmed) continue;
      } else {
        execSync(`git clone "${gitUrl}" "${destPath}"`);
      }
      layout[concern] = { mode: 'remote', path: path.resolve(destPath), gitUrl };
    }
  }
  return layout;
}
```

**Config storage (FR117):**
Repo paths are written to `_bmad/core/config.yaml` (shared, git-committed) alongside existing BMAD config:

```yaml
# Added by ma-agents installer
knowledgebase_path: "d:/Code/agents-knowledgebase"    # or "." for same-repo
sprint_management_path: "d:/Code/agents-sprints"       # or "." for same-repo
```

These values are also passed to bmad-method via `--custom-content` module config or written directly after installation.

**Cross-reference file (FR122):**
In multi-repo mode, the installer creates `_bmad-output/project-layout.yaml` in the CODE repository:

```yaml
# Generated by ma-agents — do not edit manually
# Tells agents where to find planning and sprint data
generated: '2026-03-26'
knowledgebase:
  mode: remote  # or local, or same
  path: "d:/Code/agents-knowledgebase"
  gitUrl: "https://github.com/org/agents-knowledgebase.git"  # only if remote
sprint_management:
  mode: local
  path: "d:/Code/agents-sprints"
```

**Deterministic output (NFR36):** Same inputs → same file content. The `generated` date is the only varying field.

**BMAD workflow path resolution (FR119-FR120):**
BMAD workflows resolve artifact paths by reading config at runtime. The resolution chain:

1. Workflow reads `knowledgebase_path` from `_bmad/core/config.yaml` (or equivalent module config)
2. If value is `"."` → current repo (default, backward compatible)
3. If value is an absolute path → use that path
4. All planning artifact output goes to `{knowledgebase_path}/_bmad-output/planning-artifacts/`
5. Sprint tracking lives at `{sprint_management_path}/_bmad-output/implementation-artifacts/sprint-status.yaml` (unified file per P2-11)

**Implementation note:** The actual path resolution happens inside BMAD workflows, not in ma-agents code. ma-agents' job is to (1) collect the paths during installation, (2) store them in config, and (3) stamp them into `project-context.md`. BMAD workflows use the config values. This means no changes to `installer.js`, `agents.js`, or `bmad.js` beyond the wizard collection and config write.

**Project-context integration (FR118):**
The `project-context.template.md` gains a new section when multi-repo is configured:

```markdown
### Repository Layout
- **Knowledgebase:** {{KNOWLEDGEBASE_PATH}}
- **Sprint Management:** {{SPRINT_MANAGEMENT_PATH}}
- When creating or reading planning artifacts, use the knowledgebase path
- When creating or reading sprint/story artifacts, use the sprint management path
```

Single-repo mode omits this section entirely (NFR34 backward compatibility).

**CI/CD mode (FR127 integration):**
In `--yes` mode, both concerns default to "current repository" — no repo layout prompts. Multi-repo is interactive-only configuration.

**Affects:** `cli.js` (new wizard section), `_bmad/core/config.yaml` (new fields), `_bmad-output/project-layout.yaml` (new file), `lib/templates/project-context.template.md` (new section), BMAD workflows (path resolution from config — not ma-agents code changes)

#### Decision P2-11: Unified Sprint-Status File Architecture (2026-04-03)

**Decision:** Consolidate sprint/backlog management into a single `sprint-status.yaml` file with structured sections, movement semantics, and a tracking-system adapter pattern

**Problem:** The previous sprint management design used 3 separate files: `backlog.yaml` (flat prioritized story list), `sprints/sprint-N.yaml` (individual sprint entity files), and `sprint-status.yaml` (status tracking). Multiple files create consistency issues — dual-writes fail, status diverges across files, and users encounter contradictory data. Skills that read or write sprint data must cross-reference multiple sources, increasing complexity and error surface.

**Architecture — Unified File Schema:**

All sprint and backlog data lives in a single `sprint-status.yaml`:

```yaml
generated: "2026-04-03T12:00:00Z"
last_updated: "2026-04-03T12:00:00Z"
project: ProjectName
project_key: KEY
tracking_system: file-system    # or "jira" — see adapter pattern below
story_location: _bmad-output/implementation-artifacts

epics:
  epic-1:
    status: in-progress          # backlog → in-progress → done
    retrospective: optional      # link to retrospective artifact

backlog:
  - id: "3-1-story-name"
    type: story                  # story | bug
    epic: 3
    title: "Story Title"
    priority: 1
    status: backlog              # backlog → ready-for-dev → in-progress → review → done
    severity: null               # only for bugs: critical | high | medium | low

sprints:
  sprint-1:
    name: "Foundation Sprint"
    status: active               # planning → active → closed
    capacity: 21
    start: "2026-04-03"
    end: "2026-04-14"
    items:
      - id: "1-2-story-name"
        type: story
        epic: 1
        title: "Story Title"
        status: in-progress
        severity: null
```

**Core Design Principles:**

1. **Single file, atomic operations** — all reads and writes target one file, eliminating dual-write consistency bugs. Skills use read-modify-write with YAML validation before write.

2. **Movement semantics** — an item exists in exactly ONE section at any time: either `backlog:` or a specific sprint's `items:` list. Moving an item means removing it from the source section and appending it to the target section in a single atomic write. No item duplication, no cross-reference reconciliation.

3. **Status progression on items:**
   - `backlog` → `ready-for-dev` → `in-progress` → `review` → `done` (plus `on-hold` and `cancelled` — see schema spec)
   - Items in `backlog:` section typically have status `backlog`, but may have other statuses (e.g., `ready-for-dev` awaiting sprint assignment)
   - Items in a sprint's `items:` may have any status from `ready-for-dev` through `done`
   - Only items with status `ready-for-dev` may be added to a sprint via `add-to-sprint`

4. **Epic status in structured section:**
   - `backlog` → `in-progress` → `done`
   - Epic status is derived from constituent story progress but stored explicitly for fast lookup
   - Each epic key holds a map with `status` and optional `retrospective` link

5. **Sprint lifecycle states:**
   - `planning` → `active` → `closed`
   - Only one sprint may be `active` at a time
   - `planning` sprints can receive items via `add-to-sprint`
   - `closed` sprints are immutable — no item changes allowed

**Close-Sprint Lifecycle Workflow:**

The `close-sprint` skill implements a structured sprint closure:

1. **Done items → archive:** Items with status `done` are removed from the sprint's `items:` list. Their corresponding story files are moved from `{story_location}/` to `{story_location}/done/`.

2. **Canceled items → archive separately:** Items explicitly marked as canceled are removed and their story files moved to `{story_location}/done/` with a canceled notation.

3. **Remaining items → user decides:** For each item still in-progress, review, or ready-for-dev, the user is prompted:
   - Move to next sprint (if one exists in `planning` state)
   - Return to backlog (resets status to `backlog`, item moves to `backlog:` section)
   - Decide per-item (interactive item-by-item disposition)

4. **Sprint status → closed:** After all items are dispositioned, the sprint's `status` is set to `closed`. The sprint entry remains in the file as historical record (no deletion).

5. **Timestamps updated:** `last_updated` is refreshed. Sprint `end` date is set to actual close date if different from planned.

**Done Archival Pattern:**

When items are archived (removed from `sprint-status.yaml`):
- The item is deleted from the sprint's `items:` list
- The corresponding story file at `{story_location}/{id}.md` is moved to `{story_location}/done/{id}.md`
- No trace of the item remains in `sprint-status.yaml` — the `done/` folder is the archive
- This keeps the active file lean and focused on current work

**Jira Adapter Pattern:**

The `tracking_system` field switches between backends:

```yaml
tracking_system: file-system    # default — all operations read/write sprint-status.yaml
tracking_system: jira           # future — operations proxy to Jira API
```

- **`file-system` backend (current):** All 13 affected skills read/write `sprint-status.yaml` directly. The file is the single source of truth.
- **`jira` backend (future):** Skills detect `tracking_system: jira` and delegate to a Jira adapter module. The adapter translates unified data model operations (move item, update status, close sprint) into Jira API calls. The `sprint-status.yaml` schema is the canonical data contract — Jira responses are mapped into the same structure.
- **Same data model:** Both backends expose identical data shapes. Skills never branch on backend type for business logic — only the I/O layer differs.

**Skill Integration Map (13 skills affected):**

| Skill | Rework Level | Operation | Section(s) Touched |
|-------|-------------|-----------|-------------------|
| `generate-backlog` | Heavy | Writes items to `backlog:` section from epics | `backlog:`, `epics:` |
| `add-to-sprint` | Heavy | Moves item from `backlog:` to sprint `items:` | `backlog:`, `sprints:` |
| `remove-from-sprint` | Heavy | Moves item from sprint `items:` back to `backlog:` | `sprints:`, `backlog:` |
| `sprint-status-view` | Heavy | Reads single file, renders progress | All sections (read-only) |
| `cleanup-done` | Heavy | Scans for done items, archives, removes from file | `sprints:`, file system |
| `bmad-sprint-planning` | Heavy | Bootstraps unified file from epics data | Creates entire file |
| `add-sprint` | Moderate | Adds sprint entry to `sprints:` section | `sprints:` |
| `modify-sprint` | Moderate | Updates sprint entry in-place (metadata, items) | `sprints:` |
| `bmad-dev-story` | Moderate | Finds item across sections, updates status field | `backlog:` or `sprints:` |
| `story-status-lookup` | Light | Searches `backlog:` + all sprint `items:` for item | All sections (read-only) |
| `bmad-sprint-status` | Light | Reads structured sections for summary | All sections (read-only) |
| `prioritize-backlog` | Light | Reads/writes `backlog:` section to reorder items by priority criteria | `backlog:` |
| `close-sprint` | New | Full sprint close lifecycle (see above) | `sprints:`, `backlog:`, file system |

**Note on skill ownership:** Of the 13 affected skills, 6 are extension module skills delivered via `lib/bmad-extension/skills/` (add-sprint, add-to-sprint, remove-from-sprint, modify-sprint, close-sprint, cleanup-done) and 7 are existing BMAD/ma-agents skills being reworked (generate-backlog, sprint-status-view, bmad-sprint-planning, bmad-dev-story, story-status-lookup, bmad-sprint-status, prioritize-backlog).

**File Location Resolution:**

In single-repo mode, `sprint-status.yaml` lives at:
```
{sprint_management_path}/_bmad-output/implementation-artifacts/sprint-status.yaml
```

In multi-repo mode (P2-10), `sprint_management_path` from `_bmad/core/config.yaml` resolves to the sprint management repository. The file path is always `_bmad-output/implementation-artifacts/sprint-status.yaml` relative to that root.

**Migration from 3-file model:**

If a project has existing `backlog.yaml`, `sprints/sprint-N.yaml`, or the old `sprint-status.yaml`:
1. `bmad-sprint-planning` detects the legacy files and offers to migrate
2. Items from `backlog.yaml` are loaded into the `backlog:` section
3. Sprint entities from `sprints/sprint-N.yaml` are loaded into `sprints:` with their items
4. Status data from old `sprint-status.yaml` is used to set item statuses
5. Legacy files are renamed with `.legacy` suffix (not deleted — user can verify and remove)

**Affects:** All 13 skills listed in the integration map above, `sprint-status.yaml` (new unified file), `{story_location}/done/` (archive directory)

#### Phase 2 Decision Impact Analysis (Updated 2026-04-03)

**Implementation Sequence:**
1. Agent registry extension (`agents.js`) — add OpenCode + `injectionStrategy` to all agents
2. Instruction injection refactor (`installer.js`) — TOP placement + JSON injection path
3. Extension module restructure (`lib/bmad-extension/`) — 6.2.0 module pattern with `code` field, agents as skill folders, workflows as skill folders (P2-9)
4. MIL-498 workflow conversion — 11 YAML/XML workflows → SKILL.md packages with progressive disclosure step files (P2-9)
5. SRE/DevOps/Cyber workflow packaging — 23 `.md` workflows → SKILL.md skill packages (P2-9)
6. Extension deployment via `--custom-content` (`bmad.js`) — replaces manual copy (P2-9)
7. Built-in agent `.customize.yaml` deployment (`bmad.js`) — 8 files to `_bmad/_config/agents/` for critical_actions (P2-9)
8. Explicit parameter passing (`bmad.js`) — replace silent install with `buildBmadArgs()` (P2-6 rev)
9. `auto-bug-detection` skill creation (`skills/auto-bug-detection/`)
10. `.gitignore` update logic (`installer.js`) — don't add `_bmad-output`
11. Bundled BMAD installation (`bmad.js`, `package.json`, `lib/bmad-cache/`) — bmad-method v6.2.0 + 5 external modules (bmb, cis, tea, gds, wds)
12. Project context auto-generation (`installer.js`, `lib/templates/project-context.template.md`)
13. Multi-repo layout wizard (`cli.js`) — collect knowledgebase/sprint paths, write config + project-layout.yaml (P2-10)
14. Migration detection (`bmad.js`) — detect 6.0.4, back up, upgrade, merge customizations (P2-9)
15. Unified sprint-status file architecture — consolidate 3-file model into single `sprint-status.yaml`, update 13 skills (P2-11)
16. Close-sprint workflow skill — sprint close lifecycle with done archival and item disposition (P2-11)

**New Cross-Component Dependencies:**
- `injectionStrategy` in `agents.js` drives `installer.js` injection behavior
- `bmad.js` deploys `lib/bmad-extension/` via `--custom-content` — all extension content moves together
- `bmad.js` separately deploys `.customize.yaml` for 8 built-in agents AFTER `--custom-content`
- `critical_actions` in agent SKILL.md and `.customize.yaml` reference `skills/MANIFEST.yaml` — depends on skill installation completing first
- All sprint management skills read/write the unified `sprint-status.yaml` — single file eliminates cross-file consistency concerns
- `close-sprint` skill depends on `story_location` field in `sprint-status.yaml` to resolve archive paths
- `sprint-status.yaml` location depends on `sprint_management_path` from P2-10 multi-repo config
- Multi-repo config in `_bmad/core/config.yaml` is read by BMAD workflows at runtime — ma-agents writes it, BMAD workflows consume it
- `project-layout.yaml` in code repo enables agents to discover cross-repo paths without re-running installation

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
│   ├── bmad-extension/             — BMAD extension module (deployed via --custom-content)
│   │   ├── module.yaml             — code: ma-skills, extends-module: bmm
│   │   ├── module-help.csv         — capability registry for agents + workflows
│   │   └── skills/                 — all agents and workflows as BMAD 6.2.0 skills
│   │       ├── bmad-ma-agent-sre/           — agent skill: Alex (SRE)
│   │       │   ├── SKILL.md                 — full agent definition
│   │       │   └── bmad-skill-manifest.yaml — type: agent
│   │       ├── bmad-ma-agent-devops/        — agent skill: Amit (DevOps)
│   │       ├── bmad-ma-agent-cyber/         — agent skill: Yael (Cyber)
│   │       ├── bmad-ma-agent-mil498/        — agent skill: Joseph (MIL-498)
│   │       ├── mil498-sss/                  — MIL-498 DID workflow (Complex Workflow)
│   │       │   ├── SKILL.md
│   │       │   ├── bmad-skill-manifest.yaml — type: skill
│   │       │   ├── template.md
│   │       │   └── prompts/                 — step files
│   │       ├── mil498-ssdd/ ... mil498-hrs/ — (11 MIL-498 DID workflows total)
│   │       ├── sre-health-check/ ... sre-gitops-status/ — (9 SRE playbooks)
│   │       ├── devops-configure-infrastructure/ ... devops-sign-docker-image/ — (6 DevOps playbooks)
│   │       ├── cyber-vulnerability-scan/ ... cyber-verify-image-signature/ — (8 Cyber playbooks)
│   │       ├── create-bug-story/            — bug story from report (FR61)
│   │       ├── add-sprint/                  — new sprint entry in unified sprint-status.yaml (FR68)
│   │       ├── modify-sprint/               — update sprint metadata/items in unified file (FR70)
│   │       ├── add-to-sprint/               — move items from backlog to sprint in unified file (FR69)
│   │       ├── close-sprint/               — sprint close lifecycle: archive done, disposition remaining (P2-11)
│   │       ├── remove-from-sprint/         — move items from sprint back to backlog
│   │       └── open-graph/                 — generate knowledge-graph.html and open it (P3-1)
│   └── bmad-customize/             — .customize.yaml for built-in BMM agents (deployed to _bmad/_config/agents/)
│       ├── bmm-pm.customize.yaml            — critical_actions only
│       ├── bmm-architect.customize.yaml
│       ├── bmm-dev.customize.yaml
│       ├── bmm-qa.customize.yaml
│       ├── bmm-sm.customize.yaml
│       ├── bmm-tech-writer.customize.yaml
│       ├── bmm-ux-designer.customize.yaml
│       └── core-bmad-master.customize.yaml  — bmad-master critical_actions
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
│   ├── implementation-artifacts/   — stories, specs
│   │   ├── done/                   — archived done/canceled story files (P2-11 close-sprint)
│   │   └── sprint-status.yaml      — unified sprint/backlog tracking (P2-11 — single source of truth)
│   ├── knowledge-graph.json        — NEW: knowledge graph data (P3-1, version-controlled)
│   └── knowledge-graph.html        — NEW: self-contained renderer (P3-1, generated by open-graph skill)
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
| Bug Management (FR61-65) | BMAD extension workflows + skill | `lib/bmad-extension/skills/`, `skills/auto-bug-detection/` |
| Sprint Management (FR66-71) | BMAD extension workflows + unified `sprint-status.yaml` (P2-11) | `lib/bmad-extension/skills/`, `_bmad-output/implementation-artifacts/sprint-status.yaml` |
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
- Node.js runtime + plain JavaScript + no build step + no framework — all align
- 4-module architecture with strict boundaries maps cleanly to the extensibility model
- Pipeline architectures (5-stage install, 6-stage BMAD) don't conflict
- P2-1 (TOP injection) and P2-2 (JSON injection) are independent strategies driven by `agents.js` registry
- P2-6 rev (explicit params) + P2-9 (module restructure) work together: `--custom-content` deploys the restructured module, explicit params ensure correct tool/module selection
- P2-9 (agents as skills) + P2-4 (critical_actions) — clean separation: custom agents embed critical_actions in SKILL.md, built-in agents get critical_actions via `.customize.yaml`
- P2-10 (multi-repo) integrates cleanly: config values written at install time, consumed by BMAD workflows at runtime
- P2-11 (unified sprint-status) + P2-10 (multi-repo) — `sprint_management_path` resolves file location, unified file eliminates cross-repo dual-write risk
- P2-11 (unified sprint-status) + P2-5 (extension workflows) — all 6 sprint workflows target the same single file, movement semantics enforce item uniqueness
- bmad-method v6.2.0 pin aligns with skill-based module structure in P2-9

**Note:** P2-3 (Extension Module Structure, 2026-03-11) is now HISTORICAL — superseded by P2-9 which restructures the extension module to follow BMAD 6.2.0 conventions. P2-4 (critical_actions) references updated: custom agents' critical_actions now live in SKILL.md (not `.customize.yaml`); built-in agent customizations now live in `lib/bmad-customize/` (not `lib/bmad-extension/agents/`).

**Pattern Consistency:** PASS
- Agent skill naming (`bmad-ma-agent-sre`) follows verified CIS convention (`bmad-cis-agent-innovation-strategist`)
- Workflow skill naming (`mil498-srs`, `sre-health-check`) follows CIS convention (`bmad-cis-innovation-strategy`)
- `bmad-skill-manifest.yaml` uses same fields as CIS (type, name, displayName, module)
- `.customize.yaml` array syntax for critical_actions matches BMAD 6.2.0 documentation
- Naming conventions (camelCase code, kebab-case files, snake_case skill.json) remain consistent

**Structure Alignment:** PASS
- `lib/bmad-extension/skills/` mirrors CIS `src/skills/` pattern
- `lib/bmad-customize/` cleanly separates module-owned agents from built-in agent customizations
- `--custom-content` deployment replaces manual file copying — follows BMAD's official deployment mechanism
- Module boundary table still holds: `bmad.js` handles extension deployment + customize deployment

### Requirements Coverage Validation

**Functional Requirements Coverage:**

| FR Category | Architectural Support | Status |
|-------------|----------------------|--------|
| Skill Management (FR1-7) | Install pipeline + manifest manager | COVERED |
| BMAD Integration (FR8-12) | BMAD pipeline architecture | COVERED |
| MIL-STD-498 Generation (FR13-23) | BMAD workflows (via extension module skills) | COVERED |
| SDLC Workflows (FR24-33) | BMAD workflows | COVERED |
| Agent Targeting (FR34-38) | Agent registry + template resolution chain | COVERED |
| Skill Authoring (FR39-43) | Skill schema contract + MANIFEST.yaml generation | COVERED |
| Environment & Deployment (FR44-47) | Cross-platform paths + offline operation | COVERED |
| Audit & Traceability (FR48-50) | BMAD workflows + ai-audit-trail skill | COVERED |
| Skill Enforcement (FR51-55) | P2-1 + P2-9 + P2-4: injection strategies, agent SKILL.md, built-in .customize.yaml | COVERED |
| OpenCode Support (FR56-57) | P2-2: JSON injection + new agent registry entry | COVERED |
| Project Knowledge (FR58-59) | Gitignore pattern: remove `_bmad-output` from `.gitignore` | COVERED |
| Bug Management (FR60-64) | P2-5: extension workflow skill + `auto-bug-detection` skill | COVERED |
| Sprint Management (FR65-71) | P2-5 + P2-11: 6 extension workflow skills (add/modify/add-to/remove-from/close sprint) operating on unified `sprint-status.yaml` | COVERED |
| Agent Activity Dashboard (FR87-93) | Deferred to Phase 3 | N/A |
| Knowledge Graph (FR141-157) | P3-1: JSON graph file, files table, skill emission, open-graph skill, self-contained renderer | COVERED |
| Agent Conversion (FR94-97) | P2-9: agent skill folders with SKILL.md + bmad-skill-manifest.yaml | COVERED |
| MIL-498 Workflow Conversion (FR98-100) | P2-9: Complex Workflow skills with prompts/ step files | COVERED |
| SRE/DevOps/Cyber Conversion (FR101-103) | P2-9: skill packages with SKILL.md | COVERED |
| Module Architecture (FR104-106) | P2-9: module.yaml with code field, skills/ layout, dual-layer eliminated | COVERED |
| Upgrade Path (FR107-110) | P2-9: migration detection, backup, upgrade, merge, cleanup | COVERED |
| Multi-Repo Layout (FR111-122) | P2-10: wizard, config, project-layout.yaml, path resolution | COVERED |
| Bundled Install + Params (FR74-76, FR123-127) | P2-6 rev: buildBmadArgs(), explicit flags, --custom-content | COVERED |
| Knowledge Graph (FR141-157) | P3-1: `lib/bmad-extension/skills/open-graph/`, `_bmad-output/knowledge-graph.json`, emitting BMAD skills | COVERED |
| Developer Infrastructure (FR73) | Tests directory defined | COVERED |
| Methodology Onboarding (FR72) | Bundled presentation deployment | COVERED |
| Project Context (FR79-86) | P2-7: template-based generation, platform paths, critical_actions | COVERED |

**Non-Functional Requirements Coverage:**

| NFR | Architectural Support | Status |
|-----|----------------------|--------|
| NFR1-4 (Security) | No network calls, plain text content, additive-only ops | COVERED |
| NFR5-8 (Integration Reliability) | Pipeline ordering, atomic manifests, additive installs | COVERED |
| NFR9-12 (Portability) | path.join centralization, template resolution chain, Node LTS | COVERED |
| NFR13-15 (Maintainability) | Config-driven agent registry, directory-scanned skills, backward compat | COVERED |
| NFR16-19 (BMAD Extension) | Module identity via code field, zero core mods, additive JSON, dual invocation | COVERED |
| NFR20-21 (Bundled Install) | Version pinning to 6.2.0, deterministic bundled output | COVERED |
| NFR22-25 (Project Context) | Template-based, idempotent, version comment | COVERED |
| NFR26-28 (Dashboard) | Deferred to Phase 3 | N/A |
| NFR29 (Atomic migration) | P2-9: backup before, restore on failure | COVERED |
| NFR30 (Functional equivalence) | P2-9: same menus, same workflows in new format | COVERED |
| NFR31 (Lint gate compliance) | P2-9: follows verified CIS module pattern | COVERED |
| NFR32 (Output equivalence) | P2-9: same templates, same step files | COVERED |
| NFR33 (Anti-zombie idempotency) | Depends on bmad-method setup skill behavior | MINOR GAP |
| NFR34-37 (Multi-Repo) | P2-10: backward compat, air-gapped, deterministic, config-driven | COVERED |
| NFR38-41 (Knowledge Graph) | P3-1: pre-computed layout + SVG, copy-pattern JSON, additive-only emission, inlined self-contained HTML | COVERED |

### Decision P3-1: BMAD Knowledge Graph (FR141–FR157, NFR38–NFR41) (2026-04-07)

**Decision:** Static JSON graph file with a central files table, BMAD-skill-side emission, and a self-contained HTML renderer delivered as a BMAD extension skill

**Problem:** BMAD generates a rich chain of artifacts (PRD → Architecture → Epics → Stories) but the relationships between them exist only implicitly in document content. There is no machine-readable record of why a decision was made, what requirement drove an epic, or which UX design shaped an acceptance criterion. Existing solutions (traceability matrices, Jira links) are hierarchical, manually maintained, and opaque to agents. We need an any-to-any knowledge graph that:
- Is built automatically as BMAD skills execute — no human curation
- Supports non-hierarchical references (a story AC can reference the epic, an architecture section, and a UX design simultaneously)
- Is not bound to files in the project repository — external documents (Confluence pages, remote URLs) must be first-class nodes
- Is readable and writable by any LLM without a schema reference document
- Renders as an interactive visual graph accessible from VSCode or browser

**Architecture — Three-Layer Design:**

```
Layer 1: knowledge-graph.json        — the graph (data, version-controlled)
Layer 2: BMAD skill emission hooks   — populate the graph as artifacts are produced
Layer 3: knowledge-graph.html        — the renderer (self-contained, generated by open-graph skill)
```

**Layer 1: Graph File Schema**

`_bmad-output/knowledge-graph.json` — single file, flat structure, no nesting beyond 2 levels:

```json
{
  "meta": {
    "schema_version": "1.0",
    "project": "agents",
    "generated": "2026-04-07T10:00:00Z",
    "last_updated": "2026-04-07T10:00:00Z",
    "file_count": 4,
    "node_count": 127,
    "edge_count": 89
  },
  "files": {
    "prd": {
      "pointer": "_bmad-output/planning-artifacts/prd.md",
      "title": "PRD",
      "pointer_type": "relative_path"
    },
    "arch": {
      "pointer": "_bmad-output/planning-artifacts/architecture.md",
      "title": "Architecture",
      "pointer_type": "relative_path"
    },
    "ux-conf": {
      "pointer": "https://confluence.example.com/display/PROJ/UX+Design",
      "title": "UX Design (Confluence)",
      "pointer_type": "url"
    },
    "epics": {
      "pointer": "_bmad-output/planning-artifacts/epics.md",
      "title": "Epics",
      "pointer_type": "relative_path"
    }
  },
  "nodes": [
    {
      "id": "prd#functional-requirements",
      "file": "prd",
      "anchor": "functional-requirements",
      "title": "Functional Requirements",
      "type": "requirement"
    },
    {
      "id": "arch#decision-p3-1-bmad-knowledge-graph",
      "file": "arch",
      "anchor": "decision-p3-1-bmad-knowledge-graph",
      "title": "Decision P3-1: BMAD Knowledge Graph",
      "type": "architecture"
    }
  ],
  "edges": [
    {
      "id": "e-arch-p3-1-prd-fr141",
      "from": "arch#decision-p3-1-bmad-knowledge-graph",
      "to": "prd#fr141",
      "type": "implements",
      "label": "implements knowledge graph data model requirement",
      "created_by": "Alon",
      "agent": "claude-code",
      "created_at": "2026-04-07T10:00:00Z"
    }
  ]
}
```

**Files table design rationale:**
- `file-id` (e.g., `prd`, `arch`, `ux-conf`) is a short stable identifier chosen by the skill at registration time. Skills use kebab-case slugs derived from the document type or filename
- `pointer_type` is one of `relative_path`, `absolute_path`, `url` — drives both navigation (how to open the file) and display (external icon for URLs)
- `relative_path` pointers are relative to the project root (same root as `_bmad-output/`)
- Once a `file-id` is registered, it is permanent — skills reference it in node and edge `from`/`to` fields. Renaming a file updates the `pointer` field only, not the `file-id`

**Node and edge design rationale:**
- Anchors are derived from Markdown heading text using GitHub slug rules: lowercase, spaces → hyphens, punctuation stripped. This matches VSCode's internal link resolution — the same anchor used in `[text](file.md#anchor)` links
- Edge `type` vocabulary covers the full relationship space: `implements` (arch → req), `derives-from` (epic → req), `traces-to` (story → epic), `informed-by` (any cross-document influence without strict hierarchy), `validates` (review → artifact), `refines` (edit → earlier version)
- `informed-by` is the key non-hierarchical type — it records influence without asserting derivation or implementation
- Counts in `meta` are maintained by the writer. LLMs add the deltas after append; the counts enable quick integrity checks without array scanning

**LLM-writability contract (NFR39):**
The JSON is designed so that a model with no prior knowledge of the schema can correctly add an entry by observing the existing structure:
1. Read the `files` object — copy the pattern to register a new file
2. Read the `nodes` array — copy the pattern to add a new node
3. Read the `edges` array — copy the pattern to add a new edge
4. Update the three counts in `meta`

No external schema, no JSONSchema validation, no reserved keywords beyond the field names visible in the file.

**Layer 2: BMAD Skill Emission**

Skills emit to the graph as a post-artifact step — after writing the document, before returning to the user.

**Emission contract:**
```
1. Register source file in `files` if not present — assign file-id, set pointer and pointer_type
2. Register target file(s) in `files` if not present (for upstream artifacts referenced as edge targets)
3. For each heading in the produced artifact: add node if not already present (update title if exists)
4. For each relationship to an upstream artifact: add edge if not present (update created_at, agent if exists)
5. Update meta.file_count, meta.node_count, meta.edge_count, meta.last_updated
6. Atomic write: read current JSON → apply additions → write back
```

**Read-modify-write atomicity (FR149):** Each skill emits in a single read-modify-write cycle:
```javascript
// In each emitting skill — pseudocode pattern
async function emitToGraph(projectRoot, emission) {
  const graphPath = path.join(projectRoot, '_bmad-output', 'knowledge-graph.json');
  const graph = fs.existsSync(graphPath)
    ? JSON.parse(fs.readFileSync(graphPath, 'utf8'))
    : { meta: initMeta(), files: {}, nodes: [], edges: [] };

  // Register files
  for (const [fileId, fileEntry] of Object.entries(emission.files)) {
    if (!graph.files[fileId]) graph.files[fileId] = fileEntry;
    else { graph.files[fileId].pointer = fileEntry.pointer; graph.files[fileId].title = fileEntry.title; }
  }
  // Add nodes (no duplicates)
  for (const node of emission.nodes) {
    const existing = graph.nodes.find(n => n.id === node.id);
    if (!existing) graph.nodes.push(node);
    else existing.title = node.title;
  }
  // Add edges (no duplicates)
  for (const edge of emission.edges) {
    const existing = graph.edges.find(e => e.from === edge.from && e.to === edge.to && e.type === edge.type);
    if (!existing) graph.edges.push(edge);
    else { existing.created_at = edge.created_at; existing.agent = edge.agent; }
  }
  // Update counts
  graph.meta.file_count = Object.keys(graph.files).length;
  graph.meta.node_count = graph.nodes.length;
  graph.meta.edge_count = graph.edges.length;
  graph.meta.last_updated = new Date().toISOString();

  fs.writeFileSync(graphPath, JSON.stringify(graph, null, 2), 'utf8');
}
```

**Skills that emit (and what they emit):**

| Skill | Source Nodes | Target Nodes | Edge Types |
|---|---|---|---|
| `bmad-create-prd` | All PRD headings | — | — (seeds nodes only; upstream source) |
| `bmad-create-architecture` | All architecture decision headings | Corresponding PRD requirement headings | `implements` |
| `bmad-create-ux-design` | All UX section headings | Corresponding PRD requirement headings | `derives-from` |
| `bmad-create-epics-and-stories` | All epic headings | PRD feature headings; architecture decision headings | `derives-from`, `informed-by` |
| `bmad-create-story` | Story heading + AC headings | Epic heading; architecture section headings; UX section headings | `traces-to`, `informed-by` |
| `bmad-dev-story` | Story implementation notes | Story spec heading | `refines` |
| `bmad-validate-prd`, `bmad-code-review` | Validation report heading | Validated artifact heading | `validates` |

**Heading → anchor resolution:**
Skills derive anchors using the same slug algorithm as GitHub Markdown (lowercase, spaces → hyphens, strip non-alphanumeric except hyphens). This ensures `[text](file.md#anchor)` links constructed from graph data are valid clickable links in any Markdown renderer.

```javascript
function headingToAnchor(heading) {
  return heading
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}
// "Decision P3-1: BMAD Knowledge Graph" → "decision-p3-1-bmad-knowledge-graph"
```

**Non-hierarchical reference resolution:**
When a skill produces a story, it inspects all documents it was given as input — the epic, the architecture doc, any UX spec referenced in the task context — and emits `informed-by` edges for each. The skill does not assume a single upstream parent; all documents that shaped the output become edge targets. This makes the graph genuinely any-to-any rather than a tree with `derives-from` edges.

**Layer 3: open-graph Skill and Renderer**

The `open-graph` skill is a new BMAD extension skill in `lib/bmad-extension/skills/open-graph/`:
```
lib/bmad-extension/skills/open-graph/
├── SKILL.md                         — entrypoint: reads knowledge-graph.json, generates knowledge-graph.html, opens it
└── bmad-skill-manifest.yaml         — type: skill
```

**Renderer generation (FR153):**
The skill reads `_bmad-output/knowledge-graph.json` and generates `_bmad-output/knowledge-graph.html` — a fully self-contained single-file web application. All JavaScript and CSS are inlined (no `<script src>` or `<link href>` tags pointing to external resources). The graph visualization library (a lightweight force-simulation implementation, ~30KB minified) is embedded directly in the HTML.

**VSCode detection and opening (FR153):**
```javascript
// In open-graph SKILL.md — detection logic
const isVSCode = process.env.TERM_PROGRAM === 'vscode' || process.env.VSCODE_PID !== undefined;
if (isVSCode) {
  execSync(`code "${htmlPath}"`);  // opens in VSCode Simple Browser / Live Preview
} else {
  const openCmd = process.platform === 'win32' ? 'start' :
                  process.platform === 'darwin' ? 'open' : 'xdg-open';
  execSync(`${openCmd} "${htmlPath}"`);
}
```

**Renderer features (FR154–FR156):**
- **Graph canvas:** Nodes rendered as labeled circles, color-coded by `type` (6 colors: requirement=blue, architecture=orange, epic=purple, story=green, design=teal, test=red). Edges rendered as directed arrows with arrowheads indicating direction
- **Click to navigate:** Clicking a node constructs a navigation action based on the file's `pointer_type`:
  - `relative_path` / `absolute_path`: constructs `vscode://file/{absolute-path}#{anchor}` URI and navigates (VSCode opens directly to heading). Fallback: displays a copyable Markdown link `[title](file.md#anchor)`
  - `url`: opens the registered URL in a new browser tab (Confluence pages, external docs)
- **Edge tooltip (FR155):** Hovering over an edge line shows: type, label (if set), created_by, agent, created_at
- **Filtering (FR156):** Checkboxes above canvas for node types and edge types. Selecting a node highlights its direct neighbors and their edges, dims all others
- **Self-contained (FR157, NFR41):** No CDN dependencies, no `fetch()` calls, no WebSockets. The HTML file works identically offline, on an intranet, and in an air-gapped environment

**Renderer HTML structure:**
```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Knowledge Graph — {project}</title>
  <style>/* all CSS inlined */</style>
</head>
<body>
  <div id="controls"><!-- filter checkboxes --></div>
  <svg id="graph"><!-- D3-lite force simulation, fully inlined --></svg>
  <div id="tooltip"><!-- edge hover panel --></div>
  <script>
    const graphData = /* JSON.stringify(graph) embedded here at generation time */;
    /* all graph rendering logic inlined */
  </script>
</body>
</html>
```

The graph data is embedded as an inline JSON literal at generation time — not fetched at runtime. This makes the file fully portable: copy it anywhere and it renders correctly with no server.

**Performance contract (NFR38):**
Target: 500 nodes / 1000 edges render to first interactive frame in under 3 seconds. Achieved via:
- Force simulation with initial layout pre-computed for the first 100 ticks before display (no janky startup animation)
- Nodes and edges rendered as SVG elements (not Canvas) for interactive hit-testing without re-rendering
- Filtering implemented by CSS `display: none` on filtered elements — no re-layout on filter change

**Extension module integration:**
The `open-graph` skill is registered in `lib/bmad-extension/module-help.csv` in the `anytime` phase. Total extension module skill count increases from 44 to 45:

```
lib/bmad-extension/skills/open-graph/   — new (graph visualization)
```

**`_bmad-output` additions:**
```
_bmad-output/
├── knowledge-graph.json              — NEW: knowledge graph data (version-controlled)
└── knowledge-graph.html              — NEW: renderer (generated artifact, can gitignore or commit)
```

`knowledge-graph.json` is version-controlled project knowledge — tracked like `prd.md` and `architecture.md`. `knowledge-graph.html` is a generated artifact from it — teams may choose to gitignore it (it can always be regenerated from the JSON) or commit it for quick access. This is a project-level convention, not enforced by the installer.

**FR coverage for this decision:**

| FR | Coverage |
|---|---|
| FR141 (nodes as file-id#anchor) | `nodes` array schema with `file`, `anchor`, `id` fields |
| FR142 (edges with type + provenance) | `edges` array schema with all provenance fields; `informed-by` edge type added |
| FR143 (bidirectional index) | Renderer builds forward + backward adjacency maps from flat edges array at load time — no separate index storage needed |
| FR144 (meta/files/nodes/edges structure) | Top-level JSON structure |
| FR145 (files table with pointer_type) | `files` object with `pointer`, `title`, `pointer_type` |
| FR146 (node schema) | Node object fields |
| FR147 (edge schema) | Edge object fields |
| FR148 (meta schema with counts) | Meta object with `file_count`, `node_count`, `edge_count` |
| FR149 (automatic emission, atomic write) | `emitToGraph()` pattern with read-modify-write |
| FR150 (file registration, external URL support) | `files` table pre-registration in `emitToGraph()` |
| FR151 (non-hierarchical multi-source emission) | Skills inspect all input docs; `informed-by` type for non-strict influence |
| FR152 (no duplicates, provenance preservation) | Duplicate check in `emitToGraph()` — title updates allowed, provenance fields never overwritten on existing edges |
| FR153 (open-graph skill, VSCode/browser) | VSCode env detection + platform-appropriate open command |
| FR154 (interactive viz, node navigation) | Color-coded nodes, directed edges, VSCode URI navigation, URL tab opening |
| FR155 (edge tooltip with provenance) | Hover tooltip with all edge fields |
| FR156 (filtering, neighbor highlight) | Filter checkboxes + neighbor highlight |
| FR157 (no external dependencies) | All JS/CSS inlined; graph data embedded at generation time |

**NFR coverage:**

| NFR | Coverage |
|---|---|
| NFR38 (≤3s for 500/1000) | Pre-computed initial layout, SVG hit-testing, CSS-based filtering |
| NFR39 (LLM-writable without schema) | Flat structure with copy-the-pattern writability; examples embedded in meta and first entries |
| NFR40 (additive-only emission) | `emitToGraph()` never deletes; updates only title (nodes) and created_at/agent (edges) |
| NFR41 (air-gapped, no server) | Data embedded as JSON literal; no fetch/CDN/WebSocket |

**Affects:**
- `lib/bmad-extension/skills/open-graph/` (new skill — SKILL.md + bmad-skill-manifest.yaml)
- `lib/bmad-extension/module-help.csv` (new entry for open-graph in `anytime` phase)
- BMAD skills that emit: `bmad-create-architecture`, `bmad-create-epics-and-stories`, `bmad-create-story`, `bmad-dev-story`, `bmad-create-ux-design`, `bmad-validate-prd`, `bmad-code-review` (each gains an emit step in their workflow)
- `_bmad-output/knowledge-graph.json` (new version-controlled file, created on first skill emission)
- `_bmad-output/knowledge-graph.html` (new generated file, created/refreshed by open-graph skill)

### Decision P3-2: Software Quality Assurance (SQA) Agent — Gad (FR158–FR171, NFR42–NFR43) (2026-04-08)

**Problem:** The platform has no structured mechanism for auditing project quality across multiple dimensions (process compliance, traceability, standards conformance). Quality Engineers need purpose-built workflows to assess whether a project complies with its own planning artifacts and with recognized lifecycle standards such as IEEE/ISO/IEC 12207.

**Decision:** Add a fifth specialized agent persona — Gad, the SQA Engineer — built on the existing BMAD 6.2.0 skill-based agent pattern established by Epic 15. Gad uses the `bmm-qa` BMAD agent persona as its host and delivers quality workflows as discrete BMAD extension skills. Two workflows are defined for the initial release:

1. **Project Audit** (`sqa-audit`) — a five-dimension quality audit (code-to-story traceability, stories-to-architecture/PRD alignment, process compliance, sprint health, release state)
2. **IEEE/ISO/IEC 12207 Compliance** (`sqa-ieee12207`) — a 23-process-area compliance assessment against the international software lifecycle standard

**Architecture fit:**

| Concern | Resolution |
|---------|-----------|
| Agent host | Binds to `bmm-qa` — the existing BMAD built-in QA persona. No new BMAD agent slot required; agent count stays at 11. Specialized agent count grows from 4 to 5 |
| Skill structure | Follows P2-9 (BMAD 6.2.0 Agent Architecture Migration) — `lib/bmad-extension/skills/bmad-ma-agent-sqa/` (agent) + `lib/bmad-extension/skills/sqa-audit/` + `lib/bmad-extension/skills/sqa-ieee12207/` (workflows) |
| Read pattern | Workflows are read-only against project artifacts — no new file structures introduced. Inputs: `prd.md`, `architecture.md`, `epics.md`, `sprint-status.yaml`, test files, git history |
| Write pattern | Each workflow produces one markdown report in `{output_folder}` using the `sqa-{workflow}-report-{YYYY-MM-DD}.md` naming convention — consistent with other agent report outputs |
| Gap remediation | After any compliance workflow, Gad offers to invoke `create-bug-story` for each P1 gap — reusing existing bug story infrastructure (FR171) |
| Registration | Both workflow skills and the agent skill are registered in `module-help.csv` under the `ma-skills` module, consistent with the registration pattern for all other specialized agent skills |
| Test coverage | `test/extension-module-restructure.test.js` tracks the new skills in `expectedSqaSkills` and updates skill and CSV entry counts |

**Alternatives considered:**
- *Add quality workflows to the existing `bmm-qa` built-in agent directly:* Rejected — built-in agent modifications require BMAD upstream PRs, violating the override-via-extension policy (feedback memory).
- *Add audit capabilities to the existing Cyber agent (Yael):* Rejected — Cyber focuses on security threat modeling and hardening. SQA is a distinct discipline covering process compliance and traceability, warranting a dedicated persona.

**IEEE/ISO/IEC 12207 coverage model:**
The workflow embeds all process area definitions and rating criteria inline in `SKILL.md` (air-gapped, NFR43). It does not attempt to formally certify compliance — it produces a compliance posture report based on evidence available in project artifacts. Organization-scope processes (HR, infrastructure management) are flagged as such and not evaluated from artifacts alone.

**Files affected:**
- `lib/bmad-extension/skills/bmad-ma-agent-sqa/` (new — agent skill)
- `lib/bmad-extension/skills/sqa-audit/` (new — Project Audit workflow skill)
- `lib/bmad-extension/skills/sqa-ieee12207/` (new — IEEE 12207 compliance workflow skill)
- `lib/bmad-extension/module-help.csv` (new entries: `bmad-ma-agent-sqa`, `sqa-audit`, `sqa-ieee12207`)
- `test/extension-module-restructure.test.js` (updated skill counts: 58→61, CSV rows: 58→61, new `expectedSqaSkills` array)

---

### Decision P3-3: Local-LLM / On-Prem Agent Tuning Profile (FR172–FR179, NFR44–NFR47) (2026-04-13)

**Problem:** The primary deployment target for ma-agents is air-gapped enterprise networks where teams use AI coding agents (Claude Code, Cline, Roo Code, OpenCode) against on-prem LLMs such as Nemotron Super 49B — not Anthropic's Claude. Field experience documented in `optimizing-local-llm-coding-agents-bmad.md` (2026-04 conversation) shows local LLMs misinterpret Claude-tuned system prompts: they create files when asked questions, dump output into `~/.claude/`, hallucinate Claude Code's `str_replace_editor` tool, skip BMAD planning to start coding, and overthink simple prompts because reasoning mode is on by default. The agent host tools (Roo Code, Cline, OpenCode) actually expose strong guardrail mechanisms — file-regex restrictions, Plan/Architect modes, permission gating — but ma-agents does not currently generate the configuration that activates them. Standards-profile installs (Claude on web, Anthropic API) do not need local-LLM-specific guardrails (`/no_think`, `str_replace_editor` warnings) and arguably regress when those are present.

**Decision:** Introduce a two-layer install-time tuning model driven by a single user-facing choice — **profile** — captured during the install wizard and persisted in `.ma-agents.json`.

1. **Universal layer (all profiles):** Expand the existing per-tool instruction injection to enforce text-vs-file discipline and BMAD phase boundaries through richer templates — including a new `.roomodes` template for Roo Code that applies file-regex restrictions per BMAD phase. These guardrails benefit every install regardless of model, because they prevent premature implementation and out-of-scope writes that affect Claude users too.
2. **On-prem layer (profile=on-prem only):** Layer model-specific guardrails on top of the universal block — `/no_think` planning prefix, no-home-dir-writes rule, no-`str_replace_editor` rule, reasoning-mode/sampling guidance, BMAD persona phase-aware prompt prefixes.

The inference-server tuning (vLLM flags, quantization, context length) is documentation-only at `docs/deployment/vllm-nemotron.md` — the installer does not manage the serving stack.

**Architecture fit:**

| Concern | Resolution |
|---------|-----------|
| User-facing surface | One question added to the install wizard (`Is this an on-prem / air-gapped install using a local LLM?`). Persisted as `"profile": "on-prem"\|"standard"` in `.ma-agents.json`. `--yes` defaults to `standard` (no prompt) for CI/CD. No `--profile=` CLI flag is exposed — on-prem CI/CD is served by committing `.ma-agents.json` with the persisted value to the repo (same pattern repo-layout config already uses) |
| Universal injection extension | Existing marker-based injection in [lib/installer.js](lib/installer.js) is extended with richer content; agent registry in [lib/agents.js](lib/agents.js) gains an optional `extraInstructionTemplates` field per agent for tool-specific files (notably `.roomodes` for Roo Code) |
| Per-tool templates | New files under [lib/templates/](lib/templates/): `instruction-block-universal.template.md`, `instruction-block-onprem.template.md`, `roomodes.template.yaml`, `agents-md.template.md` (OpenCode), `clinerules.template.md` (Cline). The CLAUDE.md/`.clinerules`/`.roo/rules/` markdown injection composes universal + (optionally) on-prem block within the same `<!-- MA-AGENTS-START -->` markers. The `.roomodes` and `AGENTS.md` files are stamped as separate per-tool artifacts |
| Roo Code BMAD modes | The `.roomodes` template defines four custom modes (`bmad-pm`, `bmad-architect`, `bmad-techlead`, `bmad-dev`) with `groups` declaring `fileRegex` restrictions per BMAD phase. Enforcement happens at Roo Code's tool-call layer (`FileRestrictionError`) — not just in the prompt. This is the highest-leverage application-layer guardrail in the design |
| BMAD persona phase prefix | When profile=on-prem, [lib/bmad-customize/](lib/bmad-customize/) `*.customize.yaml` files gain an additional system-prompt prefix block keyed by phase. Planning personas (PM, Architect, SM, Analyst, Tech Writer, UX, SQA) get reasoning-OFF / text-response guidance; implementation personas (Dev Amelia, Solo Dev Barry) get reasoning-ON / careful-implementation guidance. The customize loader composes the prefix only when profile=on-prem; standard profile customizations are unchanged |
| Profile read site | A small new module [lib/profile.js](lib/profile.js) wraps profile read/write against `.ma-agents.json` with a single-source-of-truth API (`getProfile()`, `setProfile()`, `resolveProfile({ persisted, yesMode })`). All callers in installer/customize go through it |
| Log string formats | Canonical formats (pin these exactly): `Using profile: on-prem (from .ma-agents.json)` / `Using profile: standard (from .ma-agents.json)` / `Using profile: standard (from --yes default)` / `Using profile: <value> (from wizard)`. Tests and docs reference these strings verbatim |
| OpenCode JSON merge | OpenCode's existing JSON-merge injection into `opencode.json::instructions[]` is reused unchanged. The expanded `AGENTS.md` is added to the instructions array; on-prem block is appended only when profile=on-prem |
| Idempotency | Profile-driven content is rewritten only inside marker blocks (`<!-- MA-AGENTS-START -->`/`<!-- MA-AGENTS-END -->`) and inside ma-agents-owned `customModes` slugs in `.roomodes`. User content outside markers is preserved (NFR46) |
| Reference deployment doc | `docs/deployment/vllm-nemotron.md` ships in the repo, not under `lib/templates/`. It is not stamped into target projects. Linked from README's on-prem section |

**Alternatives considered:**
- *CLI flag only (`--profile=on-prem`), no interactive prompt:* Rejected — most users run the wizard, won't pass the flag, and would lose the on-prem guardrails entirely.
- *Both interactive prompt AND `--profile=` CLI flag as override:* Rejected (2026-04-14 correction) — the product-owner decision is that profile is user-facing or team-facing, not per-invocation. Teams with on-prem CI/CD commit `.ma-agents.json` with the persisted value to the repo; this is the same pattern already used for repo-layout config and avoids the operational footgun of a CI job forgetting the flag. The user-feedback model is "ask once, persist forever," matching the existing wizard pattern.
- *Default everyone to on-prem guardrails:* Rejected — `/no_think` and `str_replace_editor` warnings are noise for Claude-on-web users and regress that path. Universal layer goes to everyone; model-specific layer is opt-in.
- *Manage the vLLM serving stack from the installer (e.g., generate `serve-nemotron.sh`):* Rejected — the installer runs on engineer dev machines, not inference servers. Mixing concerns. Reference doc is sufficient.
- *Generate per-tool config purely via prompt instruction (no `.roomodes`):* Rejected — Roo Code's `fileRegex` restriction is application-layer enforcement that catches violations the prompt cannot. NFR47 makes this enforcement contract testable.

**Files affected:**
- `bin/cli.js` (new wizard prompt only; no CLI flag — correction applied 2026-04-14)
- `lib/installer.js` (read profile via `lib/profile.js`; compose universal + on-prem instruction blocks; stamp `.roomodes` and `AGENTS.md` per-tool artifacts)
- `lib/profile.js` (new — profile read/write API against `.ma-agents.json`)
- `lib/agents.js` (per-agent `extraInstructionTemplates` field for `.roomodes` and `AGENTS.md`)
- `lib/templates/instruction-block-universal.template.md` (new)
- `lib/templates/instruction-block-onprem.template.md` (new)
- `lib/templates/roomodes.template.yaml` (new — 4 BMAD modes with `fileRegex`)
- `lib/templates/agents-md.template.md` (new — OpenCode AGENTS.md)
- `lib/templates/clinerules.template.md` (new — extended Cline rules)
- `lib/bmad-customize/*.customize.yaml` (additive — phase-prefix block, applied only when profile=on-prem at customize-loader time)
- `lib/bmad-customize/customize-loader.js` (or equivalent — compose phase prefix when profile=on-prem)
- `docs/deployment/vllm-nemotron.md` (new — reference deployment guide; not stamped into projects)
- `README.md` (new on-prem section linking to the deployment guide and explaining the profile prompt)
- `test/profile.test.js` (new — read/write/resolve precedence)
- `test/onprem-injection.test.js` (new — standard vs on-prem produces correct instruction-block content; idempotency; `.roomodes` slug isolation)

---

### Phase 4 Architectural Decisions (2026-04-13)

#### Decision P4-1: BMAD v6.3.0 Plugin Migration (FR182–FR195, NFR50–NFR54)

**Context.** BMAD-METHOD v6.3.0 ships four breaking changes and a new authoring model:
1. Custom-content install removed (#2227) — replaced by marketplace/plugin installation via PluginResolver
2. `bmad-init` skill removed (#2159) — agents read `_bmad/bmm/config.yaml` directly
3. `spec-wip.md` singleton removed (#2214) — replaced by `spec-{slug}.md` with status field
4. Persona consolidation (#2177/#2179/#2186) — Barry, Quinn, Bob merged into unified Amelia

BMAD Builder adds a plugin packaging model: `.claude-plugin/marketplace.json` is a shared convention (documented as "works for any skills-capable platform, not just Claude"). PluginResolver supports five resolution strategies, including local file paths — which is the load-bearing fact for our air-gapped requirement.

**Decision.** Invert the current installer architecture from *post-install manifest surgery* to *pre-install local plugin staging*.

**Current flow (to be replaced, `lib/bmad.js:205-346`):**
1. Invoke `bmad-method install` with flags
2. Read `_bmad/_config/manifest.yaml` and `files-manifest.csv`
3. Filter manifest entries by hardcoded module-name whitelist (`["custom", "bmb"]`)
4. Parse CSV by column index, rewrite entries, remove stale ones
5. Inject custom agent YAML into `_bmad/_config/custom/agents/`
6. Stage workflow YAMLs

**New flow:**
1. Build time: assemble `lib/bmad-extension-plugin/` from `lib/bmad-extension/` sources via a build script — output contains `.claude-plugin/marketplace.json`, `skills/module.yaml`, `module-help.csv`, and all skill folders
2. Package publish: both `lib/bmad-cache/` and `lib/bmad-extension-plugin/` ship inside the ma-agents npm tarball (no network access at install time)
3. Install time: `bin/cli.js` → new staging helper copies `lib/bmad-extension-plugin/` → `<project>/.ma-agents-plugin-stage/`
4. Invoke `npx bmad-method install --custom-source <stage-path> --tools <selected> --modules <selected> --yes`
5. BMAD's own PluginResolver (local-file strategy) places content into the target tool's skill directory
6. On success, remove the stage directory; on failure, leave it for diagnostic inspection

**Module structure (new):**

```
lib/bmad-extension-plugin/                        — BUILD OUTPUT (generated)
├── .claude-plugin/
│   └── marketplace.json                          — plugin manifest (format-convention only)
├── skills/
│   ├── module.yaml                               — module identity (code, description, module_version)
│   ├── module-help.csv                           — capability registry
│   ├── ma-agent-cyber/                           — Yael (renamed from bmad-ma-agent-cyber)
│   │   ├── SKILL.md
│   │   ├── bmad-skill-manifest.yaml
│   │   └── resources/
│   ├── ma-agent-devops/                          — Amit
│   ├── ma-agent-sre/                             — Alex
│   ├── ma-agent-ml/                              — Demerzel (stateless in v6.3; memory-agent in follow-up)
│   ├── ma-agent-sqa/                             — Gad (stateless in v6.3; memory-agent in follow-up)
│   └── ...workflow skills (mil498-*, sre-*, cyber-*, devops-*, ml-*)...
```

**Source of truth.** Hand-edited source remains at `lib/bmad-extension/`. The plugin directory is generated — a new script `scripts/build-plugin.js` produces `lib/bmad-extension-plugin/` from source. Both the source and generated directories are committed to the repo (the generated dir ships in the tarball; committing it makes the build reproducible and diffable).

**Code paths deleted (`lib/bmad.js`):**
- Lines ~205-283 — manifest.yaml / files-manifest.csv hand-parsing and filtering (the `["custom", "bmb"]` whitelist, `fields[2]` CSV indexing)
- Lines ~296-346 — custom agent YAML staging into `_bmad/_config/custom/agents/`

Net deletion: ~140 lines. Replacement: ~30 lines for stage-and-invoke.

**Config read path.** Any code that currently reads `_bmad/_config/*` for BMAD-canonical values is redirected to `_bmad/bmm/config.yaml`. ma-agents-owned config (`.ma-agents.json`, `project-context.md`) is unaffected.

**Skill namespace rename.** All skills currently prefixed `bmad-ma-agent-*` are renamed to `ma-agent-*` to vacate the reserved `bmad-*` prefix. Sweep required in: `MANIFEST.yaml`, `lib/bmad-extension/skills/*/SKILL.md` trigger phrases, `module-help.csv`, `.ma-agents.json`, and all doc references.

**Legacy skill retirement.** Drop from MANIFEST.yaml and source tree:
- `bmad-init` — upstream removed
- `bmad-agent-qa` (Quinn) — merged into Amelia
- `bmad-agent-sm` (Bob) — merged into Amelia
- `bmad-agent-quick-flow-solo-dev` (Barry) — merged into Amelia

**Multi-tool routing.** No change to `lib/agents.js` registry. BMAD's own installer routes plugin content to the right skills directory based on `--tools` (`.github/copilot/skills/`, `.cline/skills/`, `.roo/skills/`, `.kilocode/skills/`, `.claude/skills/`). The `.claude-plugin/marketplace.json` name is a BMAD Builder convention, not a Claude-only binding (per BMAD Builder docs).

**Offline verification gate.** Add a CI job that runs `npm pack`, extracts the tarball into a clean container with egress blocked, and runs the installer end-to-end. Smoke-assert: plugin stages, bmad-method install completes, no outbound connections attempted. Gate every release candidate (NFR50).

**Deferred follow-up (not in this epic).** Convert Demerzel and Gad to Memory-agent format at `_bmad/memory/<agent>/` after 6.3.0 lands. Stateless format is valid for v6.3 — conversion is an authoring improvement, not a compat requirement.

**Rationale.**
- Deletes ~140 lines of fragile manifest-surgery code whose underlying mechanism no longer exists upstream
- Uses BMAD's own installer for placement — removes the ma-agents/BMAD coupling on manifest internals
- PluginResolver's local-file strategy is purpose-built for disconnected deployments — the air-gapped guarantee is preserved, not weakened
- Skill rename aligns with the reserved-prefix convention, avoiding future upstream collisions
- Legacy skill retirement tracks upstream consolidation — our catalog stops drifting from BMAD's canonical persona set

**Affects:**
- `package.json` (bmad-method 6.2.2 → 6.3.0)
- `lib/bmad.js` (~140 lines deleted, ~30 lines added)
- `lib/bmad-extension/` (source rename sweep)
- `lib/bmad-extension-plugin/` (new generated directory)
- `scripts/build-plugin.js` (new)
- `scripts/build-bmad-cache.js` (retarget to 6.3.0 module registry location)
- `lib/bmad-cache/` (rebuilt against 6.3.0)
- `MANIFEST.yaml` (4 skill removals, mass rename)
- `bin/cli.js` (stage-and-cleanup around bmad-method invocation)
- `.gitignore` (add `.ma-agents-plugin-stage/`)
- CI workflow (new offline install job)

**Out of scope (deferred):**
- Memory-agent conversion for Demerzel and Gad (FR193, FR194 — follow-up epic)
- Restructure of stateless agent SKILL.md bodies into BMAD Builder "Stateless Agent" conventions if it changes anything beyond frontmatter

---

### Implementation Readiness Validation

**Decision Completeness:** HIGH
- 11 Phase 2 decisions documented (P2-1 through P2-11, with P2-3 superseded by P2-9)
- 2 Phase 3 decisions documented (P3-1: BMAD Knowledge Graph — FR141-FR157, NFR38-NFR41; P3-2: SQA Agent — FR158-FR171, NFR42-NFR43)
- 1 Phase 4 decision documented (P4-1: BMAD v6.3.0 Plugin Migration — FR182-FR195, NFR50-NFR54)
- P2-6 rev includes code example with full parameter mapping table
- P2-9 includes verified module structure from CIS, manifest examples, migration detection code
- P2-10 includes wizard flow, config storage format, cross-reference file schema
- P2-11 includes unified YAML schema, movement semantics, close-sprint lifecycle, Jira adapter pattern, 13-skill integration map

**Pattern Completeness:** HIGH
- CIS module pattern verified against actual source code — not assumed
- Agent skill naming, manifest fields, module.yaml structure all confirmed
- `.customize.yaml` behavior (appends vs replaces) documented from BMAD 6.2.0 official docs
- `--custom-content` validation rules documented (requires module.yaml with code field)

**Structure Completeness:** HIGH
- Full directory tree updated with 44-skill extension module layout (42 + close-sprint + remove-from-sprint)
- `lib/bmad-customize/` separated from `lib/bmad-extension/`
- Module boundary table still accurate — `bmad.js` handles both extension and customize deployment
- `_bmad-output/` structure updated with `sprint-status.yaml` and `done/` archive directory

### Gap Analysis Results

**No Critical Gaps.** All 141 FRs and 37 NFRs have architectural support (excluding Phase 3 deferred items). P2-11 closes the sprint data consistency gap identified during skill development.

**Important Gaps:**
- Testing framework not yet decided — blocks regression testing
- Visual Studio integration mechanism unknown — blocks new agent target (Phase 3)
- P2-3 should be marked as HISTORICAL in the document to avoid confusion with P2-9

**Minor Gaps:**
- NFR33 (anti-zombie idempotency) depends on bmad-method behavior, not ma-agents architecture
- No formal error code catalog
- No formal logging strategy

### Architecture Completeness Checklist

**Requirements Analysis**
- [x] Project context thoroughly analyzed (141 FRs, 37 NFRs)
- [x] Scale and complexity assessed
- [x] Technical constraints identified
- [x] Cross-cutting concerns mapped (enforcement, multi-repo path resolution, 6.2.0 migration)

**Architectural Decisions**
- [x] Critical decisions documented with rationale (P2-1 through P2-10)
- [x] Technology stack fully specified (Node.js, bmad-method v6.3.0)
- [x] Pipeline architectures defined (5-stage install, 6-stage BMAD, 14-step Phase 2 implementation)
- [x] Extensibility model formalized (config-driven agents, directory-scanned skills, BMAD module pattern)
- [x] Module architecture verified against BMAD 6.2.0 source (CIS module reference)

**Implementation Patterns**
- [x] Naming conventions established (agent skills follow CIS naming)
- [x] Structure patterns defined (skill folders, manifest files)
- [x] Format patterns specified (YAML array syntax for critical_actions)
- [x] Process patterns documented (adding agents, skills, workflows)
- [x] Anti-patterns explicitly listed (both Phase 1 and Phase 2)

**Project Structure**
- [x] Complete directory structure defined (44-skill extension module)
- [x] Component boundaries established (extension module vs customize files)
- [x] Integration points mapped (--custom-content, config.yaml, project-layout.yaml)
- [x] Requirements to structure mapping complete (all FR groups mapped)

### Architecture Readiness Assessment

**Overall Status:** READY FOR IMPLEMENTATION

**Confidence Level:** High — architecture verified against BMAD 6.2.0 source code (CIS module pattern), official documentation (customize, non-interactive install), and bmad-method CLI flags

**Key Strengths:**
- Configuration-driven extensibility eliminates code changes for the most common operations
- BMAD 6.2.0 module pattern verified against actual CIS module source — not assumed
- Explicit CLI parameter passing solves 3 known installer bugs with minimal code
- Clean separation: module-owned agents (SKILL.md) vs. built-in agent customizations (.customize.yaml)
- Multi-repo support is config-driven with no installer code changes for BMAD workflow path resolution
- Air-gapped operation preserved through bundled cache + explicit params

**Areas for Future Enhancement:**
- Testing framework decision and test suite creation
- Error code standardization
- Structured logging for diagnostic purposes
- Visual Studio integration investigation (Phase 3)
- Agent Activity Dashboard architecture (Phase 3)

---

### Phase 5 Architectural Decisions (2026-04-26)

#### Decision P5-1: BMAD v6.4.0 Integration (FR196–FR210, NFR55–NFR58)

**Context.** BMAD-METHOD v6.4.0 ships two breaking changes and several features that touch ma-agents directly:

Breaking:
1. TOML-based customization (#2284, #2283) — `_bmad/custom/*.toml` replaces the briefly-introduced YAML-based customization. Flat schema with structural merge rules (scalars, tables, code-keyed arrays, append arrays). `persistent_facts` unified into the same model.
2. Four-file config architecture (#2285) — project-level config surface now consists of `_bmad/config.toml`, `config.user.toml`, `custom/config.toml`, and `custom/config.user.toml`.

Features with direct ma-agents impact:
- `customize.toml` support added to 6 dev-execution workflows: `bmad-dev-story`, `bmad-code-review`, `bmad-sprint-planning`, `bmad-sprint-status`, `bmad-quick-dev`, `bmad-checkpoint-preview` (#2308). ma-agents currently maintains SOURCE FORKS of the first four.
- `bmad-customize` skill — guided authoring of TOML overrides in `_bmad/custom/` (#2289).
- `on_complete` hooks wired into 23 workflow terminal steps (#2290) — candidate ride-on for ai-audit-trail and cleanup-done skills.
- GitHub API primary + raw CDN fallback in installer registry client (#2248).
- `fs-extra` removed from BMAD internals, replaced with native `node:fs` (#2253).
- Shared resolver now prefers `package.json > module.yaml > marketplace.json` (#2298).

Non-breaking improvements inherited for free: PRD scope-reduction guardrail (#1927), `bmad-create-story` UPDATE-file awareness (#2274), sprint-status sync from quick-dev (#2234), model parity enforcement for code-review subagents (#2236).

**Decision.** Two sub-decisions:

**Sub-decision A — TOML config format: COEXISTENCE.** The new `_bmad/config.toml` is BMAD's project-level config. `_bmad/bmm/config.yaml` remains the module-level config read by `bmad-init.py`. These serve different purposes: project-level config stores agent roster and install answers; module-level config stores bmad-init state that ma-agents reads. No change to `bmad-init.py` is required unless v6.4.0 moves module config to TOML. Story 24.1 spike verifies this. If module config migrates, Story 24.3 adds TOML read support to `bmad-init.py`.

**Sub-decision B — Override skill reconciliation: HYBRID, per-skill evaluation in Story 24.4.** Default strategy is to migrate forks to `customize.toml` overlays and delete the fork wherever our changes fit TOML's merge model (scalar override, table merge, append-array, code-keyed array entry). Retain source forks only where our changes exceed what TOML overlays can express. Story 24.4 makes the per-skill call and implements the chosen strategy for each of the 4 forked skills.

**New flow / component changes.**

The install flow is unchanged from P4-1 (local plugin staging via PluginResolver). v6.4.0 changes affect what goes *into* the plugin bundle, not how it is staged:
- `lib/bmad-extension-plugin/` rebuild: bump version, include `bmad-customize/` skill, remove 0–4 forked skill directories (per Story 24.4 outcome).
- `scripts/build-bmad-cache.js`: verify registry schema unchanged after #2248 (GitHub API primary + CDN fallback); adapt if needed.
- `lib/bmad.js`: verify no fs-extra dependency on BMAD internals after #2253.
- Resolver preference order (`package.json > module.yaml > marketplace.json`, #2298): verify plugin staging still resolves; no code change expected since we ship `module.yaml`.

**TOML customization layer.**

BMAD v6.4.0 introduces a new customization layer that sits *above* the plugin bundle in the configuration hierarchy:

```
_bmad/custom/config.toml          — project team overrides (committed)
_bmad/custom/config.user.toml     — individual developer overrides (gitignored)
_bmad/config.toml                 — project-level base config (BMAD-owned)
_bmad/config.user.toml            — per-user base config (BMAD-owned, gitignored)
lib/bmad-extension-plugin/        — ma-agents plugin bundle (installed by PluginResolver)
```

For skills where Story 24.4 chooses migration: ma-agents ships a `_bmad/custom/` TOML file as part of the plugin bundle (or as a post-install-stamped file). For skills where Story 24.4 retains forks: the fork in `lib/bmad-extension/skills/<skill>/` continues to ship as the authoritative SKILL.md.

**Code paths affected.**

| File | Change |
|------|--------|
| `package.json` | Bump `bmad-method: 6.3.0 → 6.4.0` |
| `lib/bmad.js` | Verify no fs-extra dependency; update `BMAD_TARGET_VERSION` constant |
| `scripts/build-bmad-cache.js` | Verify registry schema; adapt for #2248 if needed |
| `lib/bmad-extension/skills/` | Delete 0–4 forked SKILL.md files per Story 24.4; add `bmad-customize/` |
| `lib/bmad-extension-plugin/` | Rebuild against v6.4.0 |
| `MANIFEST.yaml` | Reflect skill additions/removals |

Potentially changed (Story 24.4 decides):
- `lib/bmad-extension/skills/bmad-sprint-planning/` — migrate to customize.toml or keep fork
- `lib/bmad-extension/skills/bmad-sprint-status/` — migrate to customize.toml or keep fork
- `lib/bmad-extension/skills/bmad-dev-story/` — migrate to customize.toml or keep fork
- `lib/bmad-extension/skills/bmad-code-review/` — migrate to customize.toml or keep fork

**Alternatives considered.**

Sub-decision A:
- *Migrate bmad-init.py to TOML immediately:* Rejected — the new `_bmad/config.toml` is a different file serving a different purpose. Migrating bmad-init.py without confirmed module-config movement is speculative churn.
- *Block v6.4.0 upgrade until full TOML migration is scoped:* Rejected — the resolver fix and bmad-customize skill are valuable; coexistence is low risk and keeps the upgrade unblocked.

Sub-decision B:
- *Migrate all 4 forks to customize.toml unconditionally:* Rejected — TOML overlays may not express all of our changes (e.g., structural reordering or conditional logic). Blanket migration could silently lose behavior. Per-skill evaluation in Story 24.4 is safer.
- *Retain all 4 forks unconditionally:* Rejected — this is the status quo cost that customize.toml was designed to eliminate. Where migration is safe, forks add ongoing maintenance burden and upgrade friction.

**Rationale.**
- Coexistence (Sub-A) is zero-risk and unblocks the upgrade without speculation about module-config movement.
- Hybrid per-skill evaluation (Sub-B) captures the maintenance savings where safe while preserving correctness where TOML overlays are insufficient.
- Verifying fs-extra removal and resolver preference change against ma-agents code is a spike task (Story 24.1), not a design assumption — findings update this decision if needed.

**Affects:**
- `package.json` (bmad-method 6.3.0 → 6.4.0)
- `lib/bmad.js` (BMAD_TARGET_VERSION constant; fs-extra verification)
- `scripts/build-bmad-cache.js` (registry schema verification / #2248 adaptation)
- `lib/bmad-extension/skills/` (0–4 fork deletions + bmad-customize addition)
- `lib/bmad-extension-plugin/` (rebuild)
- `MANIFEST.yaml` (skill additions/removals per 24.4 outcome)
- Architecture: this document (P5-1)

**Out of scope (deferred):**
- Channel-based install (`--channel` / `--pin` flags) — evaluate in follow-up epic
- Deep `on_complete` hook wiring for ai-audit-trail and cleanup-done — evaluate in Story 24.7
- Advanced TOML authoring patterns beyond what `bmad-customize` skill guides
- `bmad-init.py` TOML migration — conditional on Story 24.1 spike confirming module-config movement
