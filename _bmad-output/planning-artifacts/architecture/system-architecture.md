# System Architecture — Context, Foundation & Cross-Capability Decisions

> **Shard** of the [Architecture index](../architecture.md). Content is verbatim from the
> pre-split document; the index carries the front matter, registers and reading order.
>
> Project context, the established technology foundation, and the Phase 1
> thematic decisions that apply across every capability (data architecture,
> extensibility model, pipeline architecture, infrastructure & deployment).
> These four were never assigned decision IDs.

---

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
