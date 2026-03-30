---
stepsCompleted: [1, 2, 3, 4, 'phase2-step-01', 'phase2-step-02', 'phase2-step-03', 'phase2-step-04']
workflowStatus: 'complete'
completedDate: '2026-03-08'
lastEdited: '2026-03-26'
phase2EditHistory:
  - date: '2026-03-26'
    changes: 'Added Stories 5.5 (explicit parameter passing) and 5.6 (space-in-path fix) to Epic 5. Added Epic 15: BMAD 6.2.1 Agent Architecture Migration (8 stories: version bump, module restructure, 4 agent conversions, 11 MIL-498 workflow conversions, 23 SRE/DevOps/Cyber conversions, built-in agent separation, migration detection, validation). Added Epic 16: Multi-Repository Project Layout (4 stories: wizard, config+cross-ref, project-context section, validation). Updated FR coverage map with FR87-FR127. Updated development execution order with Phase A/B/C priority grouping. Updated cross-epic bmad.js coordination for 4 epics.'
  - date: '2026-03-20'
    changes: 'Added Epic 14: External Tooling Integration (Phase 3). 5 stories: analyst research for Jira (14.1) and Confluence/knowledge (14.2), architect abstraction layer design (14.3), and stub stories for Jira (14.4) and Confluence (14.5) implementations blocked on 14.3. Proposed FRs to be added to PRD after architecture is approved.'
  - date: '2026-03-19'
    changes: 'Added Epic 13: Project Context Auto-Generation (FR77-FR84, NFR22-NFR24). 4 stories: template+generator, install pipeline integration, BMAD critical_actions update, retrospective expansion trigger. Added FR77-FR84 to FR Coverage Map.'
  - date: '2026-03-15'
    changes: 'Adversarial review fixes: Removed deleted FR77/FR78 strikethrough lines and standalone binary strikethrough. Added FR44/FR45 to FR Coverage Map. Updated Epic 6 dependency note to reference Epic 5. Added determinism/git-fetch acceptance criteria and technical note to Story 5.3.'
  - date: '2026-03-15'
    changes: 'Deleted old Epic 5 (Self-Contained Installer / standalone binary). Renumbered Epic 13 (Self-Contained BMAD Installation) to Epic 5, renamed to Bundled BMAD Installation. Removed --offline flag story (13.4). Reordered remaining stories to fix circular dependency. Added cross-epic bmad.js coordination and development execution order sections. Updated FR Coverage Map.'
  - date: '2026-03-15'
    changes: 'Adding Epic 13: Self-Contained BMAD Installation (FR74-FR78, NFR20-NFR21). Marked as highest priority — first epic to develop.'
  - date: '2026-03-12'
    changes: 'Adding Phase 2 epics for FR51-FR71 (Skill Enforcement, OpenCode, Project Knowledge, Bug Management, Sprint Management)'
inputDocuments: ['_bmad-output/planning-artifacts/prd.md', '_bmad-output/planning-artifacts/architecture.md', '_bmad-output/planning-artifacts/implementation-readiness-report-2026-03-11.md']
---

# agents - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for agents, decomposing the requirements from the PRD and Architecture into implementable stories. Focus: implementation gaps identified in v2.19.2 gap analysis — Phase 1 remaining work and Phase 2 planned features.

## Requirements Inventory

### Functional Requirements

- FR1: Engineers can install one or more skills into any supported AI agent with a single command
- FR2: Engineers can uninstall previously installed skills from an agent
- FR3: Engineers can view the list of all available skills with descriptions and categories
- FR4: Engineers can view the installation status of skills for a specific agent
- FR5: Engineers can upgrade skills when a newer version is available, with upgrade detection
- FR6: Engineers can install skills in non-interactive mode for CI/CD pipeline automation
- FR7: Engineers can install skills across multiple agents simultaneously from one manifest
- FR8: Engineers can install the BMAD-METHOD framework alongside skills in a single workflow
- FR9: Engineers can update an existing BMAD installation to a newer version
- FR10: Engineers can apply organization-specific customizations to BMAD that persist across updates
- FR11: Engineers can register MIL-STD-498 workflows into an existing BMAD installation
- FR12: Engineers can trigger BMAD recompile after customization changes
- FR13: Systems engineers can generate SSS (System/Subsystem Specification) documents from project artifacts
- FR14: Systems engineers can generate SSDD (System/Subsystem Design Description) documents
- FR15: Systems engineers can generate OCD (Operational Concept Description) documents
- FR16: Project managers can generate SDP (Software Development Plan) documents
- FR17: Product managers can generate SRS (Software Requirements Specification) documents
- FR18: Product managers can generate SDD (Software Design Description) documents
- FR19: Architects can generate IDD (Interface Design Description) documents
- FR20: Architects can generate IRS (Interface Requirements Specification) documents
- FR21: Architects can generate HRS (Hardware Requirements Specification) documents
- FR22: Test engineers can generate STD (Software Test Description) documents
- FR23: Test engineers can generate STR (Software Test Report) documents
- FR24: Product managers can create PRDs through guided collaborative workflows
- FR25: Product managers can break PRDs into epics and user stories
- FR26: Product managers can run sprint planning from epics
- FR27: Architects can create architecture documents through guided workflows
- FR28: Architects can create UX design specifications
- FR29: Engineers can check implementation readiness across PRD, architecture, and epics
- FR30: Engineers can run code reviews against established standards
- FR31: Test engineers can generate automated E2E tests from feature specifications
- FR32: Project managers can track sprint status and surface risks
- FR33: Teams can run retrospectives at epic boundaries
- FR34: Engineers can target any of the supported IDE agents (Claude Code, Cursor, Cline, Copilot, Gemini, Kilocode, OpenCode) for skill installation
- FR35: Engineers can target BMAD specialized agents (SRE, DevOps, Cyber, MIL-STD-498) for persona installation
- FR36: Skills produce functionally equivalent behavior regardless of which agent they are installed into
- FR37: Engineers can switch between AI agents and retain the same methodology framework
- FR38: The system translates skill content into each agent's native configuration format automatically
- FR39: The Chief Architect can author new skills using the skill format (skill.json + SKILL.md + agent templates)
- FR40: The Chief Architect can designate skills as mandatory (`always_load: true`) for organizational enforcement
- FR41: The Chief Architect can customize BMAD agent personas to fit organizational processes
- FR42: The Chief Architect can develop new specialized agent personas for enterprise-specific roles
- FR43: The system generates MANIFEST.yaml from installed skills for agent consumption
- FR44: Engineers can install and use skills in air-gapped environments without internet access
- FR45: Engineers can use ma-agents on Windows, macOS, and Linux
- FR46: Engineers can use ma-agents with on-premise AI agents running against local models
- FR47: The system tracks installed skill versions per agent via manifest for upgrade/downgrade detection
- FR48: The system maintains an audit trail of AI agent activities via the ai-audit-trail skill
- FR49: Document generation workflows maintain traceability across inter-role handoffs (SSS → SRS → SDD → STD)
- FR50: Engineers can validate PRDs and other documents against established standards

### Functional Requirements (Phase 2 — added 2026-03-12)

- FR51: The installer injects the planning instruction at the TOP of agent instruction files, not the bottom — ensuring highest priority during LLM context processing
- FR52: The installer deploys a BMAD extension module (`extends-module: bmm`) that injects skill-loading `critical_actions` into BMAD agents — skills are loaded before any menu or workflow executes
- FR53: All 11 BMAD agents (4 custom + 7 built-in) include skill-loading `critical_actions` in their `.customize.yaml` files
- FR54: Per-agent enforcement mechanisms are implemented where the agent supports them (e.g., Claude Code hooks that verify manifest was read)
- FR55: Context persistence strategies ensure skills survive LLM context compression and session restoration (via BMAD sidecar memory or equivalent)
- FR56: Engineers can target OpenCode for skill installation with skills placed in `.opencode/skills/`
- FR57: The installer injects skill references into `opencode.json` via the instructions array using JSON config merging (not replacement)
- FR58: The installer does not add `_bmad-output` to `.gitignore` — this folder is tracked as version-controlled project knowledge
- FR59: The `_bmad-output` policy is documented in README and installation guidance
- FR60: Bugs are structured entities with required fields: problem description, reproduction steps, bug type, version found, environment constraints, severity, and status
- FR61: A BMAD extension workflow (deployed via `extends-module: bmm`) generates a structured bug story from a bug report
- FR62: The `auto-bug-detection` skill instructs coding agents to propose a bug issue to the user when they detect a problem in already-delivered code
- FR63: During BMAD code-review workflows, agents suggest generating bug issues when relevant problems are found in delivered features
- FR64: Bugs exist in the backlog as standalone items — never assigned to an epic
- FR65: The backlog is a flat list containing both stories and bugs, not grouped by epic
- FR66: Sprint capacity is defined by number of items (stories + bugs), configured by the Scrum Master during sprint planning
- FR67: Story/bug prioritization supports multiple criteria beyond epic precedence
- FR68: A BMAD extension workflow enables adding a new sprint with defined capacity and iteration identifier
- FR69: A BMAD extension workflow enables adding stories and bugs to a sprint from the backlog
- FR70: A BMAD extension workflow enables changing/modifying a sprint (reorder items, swap items, adjust capacity)
- FR71: Sprint status displays real sprint definitions with assigned items, not just a list of epics

### Functional Requirements (Phase 2 — added 2026-03-15)

- FR74: The ma-agents npm package bundles bmad-method v6.0.4 as a direct dependency — no `npx` download at install time
- FR75: The ma-agents npm package bundles pre-cloned BMAD external modules (bmb, cis, tea, gds) under `lib/bmad-cache/` — no git clone at install time
- FR76: Before invoking bmad-method install, the installer pre-populates `~/.bmad/cache/external-modules/` from the bundled cache so bmad-method finds modules locally

### Functional Requirements (Phase 2 — added 2026-03-26)

#### Bundled Installation Update (FR123-FR127)
- FR123: The installer passes all collected config to bmad-method as explicit CLI flags (`--tools`, `--modules`, `--directory`, `--user-name`, etc.)
- FR124: bmad-method performs full configuration using explicit parameters — `--yes` suppresses prompts for already-supplied flags only
- FR125: When bmad-method introduces new CLI params that ma-agents hasn't mapped, `--yes` causes bmad-method to apply defaults
- FR126: Single unified wizard — no separate BMAD interactive prompt
- FR127: CI/CD mode uses same explicit flag mechanism with pre-determined answers

#### BMAD 6.2.0 Agent Architecture Migration (FR94-FR110)
- FR94: Each custom agent (SRE, DevOps, Cyber, MIL-498) rebuilt as BMAD 6.2.0 skill-based agent (SKILL.md + bmad-skill-manifest.yaml)
- FR95: Agent capabilities migrated from `.customize.yaml` critical_actions to internal commands in agent SKILL.md
- FR96: Agent persona/identity defined in SKILL.md — replacing legacy XML `<agent>` definitions
- FR97: Agent menu/routing via SKILL.md triggers and dynamic routing — replacing XML `<menu-handlers>`
- FR98: All 11 MIL-498 DID workflows converted from YAML to SKILL.md Complex Workflow packages
- FR99: MIL-498 instructions restructured as progressive disclosure step files in prompts/
- FR100: MIL-498 template output checkpoints reimplemented as skill-level confirmation gates
- FR101: 9 SRE playbooks packaged as SKILL.md skill packages
- FR102: 6 DevOps playbooks packaged as SKILL.md skill packages
- FR103: 8 Cyber playbooks packaged as SKILL.md skill packages
- FR104: Extension module restructured with module.yaml `code` field
- FR105: Module setup skill created for config management (anti-zombie pattern)
- FR106: Dual-layer agent definition consolidated into single agent skill folder
- FR107: Installer detects BMAD version and performs in-place migration during normal installation
- FR108: Migration preserves user customizations
- FR109: Legacy artifacts removed after successful migration
- FR110: Fresh installations deploy directly in 6.2.0 format

#### Multi-Repository Project Layout (FR111-FR122)
- FR111: Installer asks where knowledgebase is managed (current repo / local / remote)
- FR112: Installer asks where sprint management is managed
- FR113: Remote option: ask git URL + local destination, confirm if exists
- FR114: Remote: clone if destination doesn't exist
- FR115: Local: validate path exists, alert if not
- FR116: Same-repo default: no additional config
- FR117: Paths stored in config.yaml (`knowledgebase_path`, `sprint_management_path`)
- FR118: project-context.md includes configured paths as mandatory agent rules
- FR119: Planning workflows resolve output from `{knowledgebase_path}`
- FR120: Sprint workflows resolve paths from `{sprint_management_path}`
- FR121: Dashboard (Phase 3) resolves from `{sprint_management_path}`
- FR122: Multi-repo mode creates `project-layout.yaml` cross-reference file

### NonFunctional Requirements

- NFR1: Skills must not transmit project data externally — all content is static instruction delivery, not data collection
- NFR2: Installation process must function fully offline for air-gapped environments
- NFR3: Skill content must be inspectable (plain text markdown/JSON) — no obfuscated or compiled instructions
- NFR4: BMAD customizations must not be overwritten by updates without explicit user action
- NFR5: Skill installation must not corrupt or remove existing agent configurations — additive-only operations
- NFR6: Agent format translation must produce valid configuration for each target agent's expected format
- NFR7: Manifest operations (read/write/update) must be atomic — no partial manifest states on failure
- NFR8: BMAD install/update/customize pipeline must execute steps in strict order with rollback on failure
- NFR9: CLI must produce identical results on Windows, macOS, and Linux for the same inputs
- NFR10: Skills authored once must install without modification across all supported agents
- NFR11: Adding a new agent target must not require changes to existing skills — only a new template mapping
- NFR12: The tool must function with Node.js LTS versions (current and previous)
- NFR13: Adding a new agent to the registry must require only a configuration entry, not code changes to the installer core
- NFR14: Adding a new skill must require only the skill package files (skill.json + SKILL.md + templates), not installer modifications
- NFR15: Skill format must remain backward-compatible — older skills must install correctly with newer tool versions

### NonFunctional Requirements (Phase 2 — added 2026-03-12)

- NFR16: The BMAD extension module must survive `npx bmad-method install --action update` without losing functionality
- NFR17: All BMAD-facing changes must use official BMAD Builder extension APIs only — zero bmad-method core modifications
- NFR18: OpenCode JSON instruction injection must not corrupt existing `opencode.json` configuration — additive-only
- NFR19: Bug and sprint extension workflows must function identically whether invoked via BMAD agent menu or direct slash command
- NFR20: The bundled BMAD cache must be version-pinned (v6.0.4 initial) — upgrading the bundled version is a deliberate, tested release operation
- NFR21: The bundled installation must produce a complete, deterministic `_bmad/` output from the bundled npm package

### NonFunctional Requirements (Phase 2 — added 2026-03-26)

- NFR29: Migration from 6.0.4 to 6.2.0 must be atomic — all succeed or rollback
- NFR30: Migrated agents must produce functionally equivalent behavior
- NFR31: Migrated agent skill folders must pass BMAD Builder lint gate
- NFR32: All 34 converted workflows must produce identical output artifacts
- NFR33: Module setup skill anti-zombie cleanup must be idempotent
- NFR34: Multi-repo config must be backward-compatible with single-repo mode
- NFR35: Remote repo cloning must work with internal git URLs (air-gapped)
- NFR36: project-layout.yaml must be deterministic
- NFR37: All BMAD workflows must resolve paths through config, no hardcoded `_bmad-output/`

### Additional Requirements

- Testing framework needs formalization — Node.js built-in test runner recommended per architecture
- Visual Studio agent integration mechanism needs investigation (VS Copilot Chat, .vs/ directory)
- Error code catalog — standardize currently ad-hoc error strings
- Structured logging for diagnostic purposes beyond console output
- Methodology presentation to be bundled with installation for team onboarding
- `--yes` flag support for non-interactive CI/CD mode (currently only `--force` exists)

### FR Coverage Map

| FR | Epic | Description |
|----|------|-------------|
| FR6 | Epic 1 | `--yes` flag for non-interactive CI/CD mode |
| FR36 | Epic 2 | Equivalent behavior for new language skills across agents |
| FR39 | Epic 2 & 3 | Skill authoring for new language skills + tooling |
| FR10 | Epic 2 | New language skills install across all agents |
| FR40 | Epic 3 | Mandatory skill designation for authored skills |
| FR41 | Epic 3 | BMAD persona customization tooling |
| FR42 | Epic 3 | Specialized agent development tooling |
| FR43 | Epic 3 | MANIFEST.yaml generation validation |
| FR34 (VS gap) | Epic 4 | Visual Studio agent target |
| FR38 (VS) | Epic 4 | VS format translation |
| All other Phase 1 FRs | Implemented | v2.19.2 baseline — no epic needed |
| FR51 | Epic 8 | TOP injection placement |
| FR52 | Epic 8 | BMAD extension module with critical_actions |
| FR53 | Epic 8 | All 11 BMAD agent critical_actions |
| FR54 | Epic 8 | Per-agent enforcement (Claude Code hooks) |
| FR55 | Epic 8 | Context persistence research |
| FR56 | Epic 9 | OpenCode skill installation path |
| FR57 | Epic 9 | OpenCode JSON injection |
| FR58 | Epic 10 | _bmad-output not gitignored |
| FR59 | Epic 10 | _bmad-output policy documentation |
| FR60 | Epic 11 | Bug entity structure |
| FR61 | Epic 11 | Bug story workflow |
| FR62 | Epic 11 | auto-bug-detection skill |
| FR63 | Epic 11 | Code-review bug detection |
| FR64 | Epic 11 | Bugs as standalone backlog items |
| FR65 | Epic 12 | Flat backlog (stories + bugs) |
| FR66 | Epic 12 | Sprint capacity by item count |
| FR67 | Epic 12 | Multi-criteria prioritization |
| FR68 | Epic 12 | Add sprint workflow |
| FR69 | Epic 12 | Add to sprint workflow |
| FR70 | Epic 12 | Modify sprint workflow |
| FR71 | Epic 12 | Sprint status with assigned items |
| FR72 | Epic 6 | Methodology presentation bundled with BMAD install |
| FR73 | Epic 7 | Automated regression tests for 4 core modules |
| FR74 | Epic 5 | Bundle bmad-method as dependency |
| FR75 | Epic 5 | Bundle pre-cloned external modules |
| FR76 | Epic 5 | Pre-populate bmad cache before install |
| FR44 | Epic 5 | Air-gapped environment support via bundled installation |
| FR45 | Implemented | Cross-platform support (Windows, macOS, Linux) |
| FR79 | Epic 13 | Generate project-context.md at project-level install |
| FR80 | Epic 13 | Mandatory rules: MANIFEST, always_load skills, git worktrees |
| FR81 | Epic 13 | Platform-aware manifest path resolution (from full manifest) |
| FR82 | Epic 13 | Multi-platform manifest path listing |
| FR83 | Epic 13 | Full 8-step agent mission lifecycle documented |
| FR84 | Epic 13 | Idempotent generation — skip if exists |
| FR85 | Epic 13 | Inline expansion comments + template version comment |
| FR86 | Epic 13 | BMAD critical_actions updated for 12 BMM+master agents |
| FR87-FR93 | Phase 3 | Agent Activity Dashboard (deferred) |
| FR94-FR97 | Epic 15 | Custom agent conversion to SKILL.md skill folders |
| FR98-FR100 | Epic 15 | MIL-498 workflow conversion to SKILL.md |
| FR101-FR103 | Epic 15 | SRE/DevOps/Cyber workflow conversion to SKILL.md |
| FR104-FR106 | Epic 15 | Module architecture update (module.yaml code field, setup skill) |
| FR107-FR110 | Epic 15 | Migration detection, upgrade path, legacy cleanup |
| FR111-FR116 | Epic 16 | Multi-repo wizard (local/remote/same prompts) |
| FR117-FR118 | Epic 16 | Config storage + project-context stamping |
| FR119-FR122 | Epic 16 | Cross-repo path resolution + project-layout.yaml |
| FR123-FR127 | Epic 5 | Explicit parameter passing replacing silent install |
| FR65 (rework) | Epic 17 | Flat backlog model (not epic-grouped) |
| FR66 (rework) | Epic 17 | Sprint capacity with first-class sprint entity |
| FR67 (rework) | Epic 17 | Multi-criteria prioritization |
| FR128 | Epic 17 | Bug as story type in backlog |
| FR129 | Epic 17 | Move items from sprint back to backlog |
| FR130 | Epic 17 | Done items removed from sprint status file |
| FR131 | Epic 17 | Done story files moved to done/ subfolder |
| FR132 | Epic 17 | Sprints as first-class YAML entities |

## Epic List

### Epic 1: CI/CD Non-Interactive Mode
Engineers can run `npx ma-agents install --yes` for fully automated, non-interactive skill installation in CI/CD pipelines without human prompts.
**FRs covered:** FR6
**NFRs addressed:** NFR9 (cross-platform identical results)

### Epic 2: Language-Specific Skill Expansion
Engineers working in C++, C#, and Python have dedicated coding standards and best practices skills installed through ma-agents, expanding the skill library with language-specific methodology content.
**FRs covered:** FR36, FR39, FR10
**NFRs addressed:** NFR10 (write-once skills), NFR14 (no installer changes for new skills)

### Epic 3: Skill Authoring Tooling
The Chief Architect has tooling to scaffold, validate, and test new skills, lowering the barrier for organizational skill creators and ensuring consistency across the skill library.
**FRs covered:** FR39, FR40, FR41, FR42, FR43
**NFRs addressed:** NFR14 (skill format contract), NFR15 (backward compatibility)

### Epic 4: Visual Studio Agent Integration
Engineers can target Visual Studio's AI assistant for skill installation, expanding agent coverage to the VS ecosystem and closing the last major agent gap.
**FRs covered:** FR34 (VS gap), FR38 (VS format translation)
**NFRs addressed:** NFR11 (new agent = template mapping only), NFR13 (config-driven registry)

### Epic 5: Bundled BMAD Installation
The ma-agents npm package bundles bmad-method and all external BMAD modules (bmb, cis, tea, gds) so that `npx ma-agents install` never performs runtime git clone or npm registry fetch for BMAD components. Installation is deterministic and works in air-gapped environments where the npm package is available.
**FRs covered:** FR74, FR75, FR76
**NFRs addressed:** NFR2 (offline operation), NFR20 (version pinning), NFR21 (deterministic output)
**Dependencies:** Coordination with Epics 6, 8 (shared `bmad.js` modifications). Epic 8 creates extension module deployment in `bmad.js`. Epic 6 adds methodology deployment step. All three epics modify `bmad.js` — implementation must coordinate merge order.
**Version pin:** bmad-method v6.0.4

### Epic 6: Methodology Onboarding Package
Teams receive a methodology presentation bundled with installation, enabling organizational onboarding to BMAD-METHOD without separate training materials.
**FRs covered:** FR72
**Standalone:** Adds content to existing install pipeline
**Phase 2 dependencies:** Epic 5 modifies `bmad.js` invocation pattern (must ship first). Epic 8 modifies `bmad.js` for extension module deployment — coordinate insertion point for methodology deployment step.

### Epic 7: Test Suite Foundation
Contributors have automated regression tests verifying architectural contracts across the 4 core modules (cli.js, installer.js, agents.js, bmad.js), catching pipeline ordering violations, registry inconsistencies, and template resolution bugs before release.
**FRs covered:** FR73 (developer infrastructure)
**NFRs verified:** NFR5 (additive-only), NFR7 (atomic manifests), NFR8 (strict pipeline ordering), NFR9 (cross-platform)
**Dependencies:** Testing framework architectural decision must be finalized before Story 7.1
**Test isolation:** All stories use temp directories for file operations; module-level tests use dependency injection or function-level mocking to avoid triggering real installs, BMAD operations, or file system side effects
**Coverage targets:** All public functions in the 4 modules; minimum one happy-path and one error-path test per function; template resolution edge cases (missing template, all fallbacks fail)

### Epic 8: Skill Enforcement Architecture (Phase 2)
Engineers' installed skills are reliably enforced by all agents — agents load and follow skills automatically without user reminders (zero-reminder workflow).
**FRs covered:** FR51, FR52, FR53, FR54, FR55
**NFRs addressed:** NFR16 (extension survives updates), NFR17 (zero core modifications)
**Note:** FR53 scope is all 11 BMAD agents per architecture decision P2-4 (4 custom full + 7 built-in minimal)

### Epic 9: OpenCode Agent Support (Phase 2)
Engineers can target OpenCode as the 12th supported agent for skill installation, with JSON-based instruction injection.
**FRs covered:** FR56, FR57
**NFRs addressed:** NFR18 (additive-only JSON merge), NFR13 (config-driven registry)

### Epic 10: Project Knowledge Preservation (Phase 2)
Engineers' planning and implementation artifacts (`_bmad-output`) are version-controlled project knowledge, never gitignored.
**FRs covered:** FR58, FR59

### Epic 11: Bug Management System (Phase 2)
Agents detect defects in already-delivered code and generate structured bug reports that enter the backlog for sprint prioritization.
**FRs covered:** FR60, FR61, FR62, FR63, FR64
**NFRs addressed:** NFR19 (menu + slash command invocation)
**Dependency:** Uses extension module from Epic 8 for workflow deployment

### Epic 12: Realistic Sprint Management (Phase 2)
Project managers work with flat backlogs containing stories and bugs, capacity-based sprints, and multi-criteria prioritization.
**FRs covered:** FR65, FR66, FR67, FR68, FR69, FR70, FR71
**NFRs addressed:** NFR19 (menu + slash command invocation)

### Epic 13: Project Context Auto-Generation (Phase 2)
At project-level installation, ma-agents generates `_bmad-output/project-context.md` — a platform-agnostic constitutional document that mandates skill loading, fresh-worktree git workflow, and the full agent mission lifecycle for all installed agents and BMAD workflows.
**FRs covered:** FR79, FR80, FR81, FR82, FR83, FR84, FR85, FR86
**NFRs addressed:** NFR22 (template has no hardcoded paths), NFR23 (additive-only), NFR24 (template as separate file), NFR25 (version comment for upgrade detection)
**Dependency:** Uses extension module from Epic 8 for critical_actions update; `_bmad-output/` policy from Epic 10
**Dependency:** Uses extension module from Epic 8 for workflow deployment

### Epic 17: Sprint Management Model Rework (Phase 2)
Sprint management is rebuilt with a proper data model: sprints as first-class entities, flat backlog with bugs as a story type, multi-criteria prioritization, bidirectional item movement (backlog ↔ sprint), and automatic done-item cleanup.
**FRs covered:** FR65, FR66, FR67, FR128, FR129, FR130, FR131, FR132 (plus rework of FR68-FR71 workflows to work with new model)
**NFRs addressed:** NFR19 (menu + slash command invocation)
**Dependencies:** Epic 11 (bug entity structure). Reworks Epic 12's workflow shells to use the new model.
**Note:** Epic 12 delivered workflow files but not the underlying sprint data model. This epic builds the model and rewires the workflows.

### Epic 15: BMAD 6.2.1 Agent Architecture Migration (Phase 2)
ma-agents upgrades from bmad-method 6.0.4 to 6.2.1, restructures the extension module to follow BMAD 6.2.0 module conventions (agents as skill folders, workflows as skill folders, module.yaml with code field), and provides an installer-driven migration path for existing installations.
**FRs covered:** FR94, FR95, FR96, FR97, FR98, FR99, FR100, FR101, FR102, FR103, FR104, FR105, FR106, FR107, FR108, FR109, FR110
**NFRs addressed:** NFR29 (atomic migration), NFR30 (functional equivalence), NFR31 (lint gate), NFR32 (output equivalence), NFR33 (anti-zombie idempotency)
**Dependencies:** Epic 5 must be complete first (explicit param passing is the foundation). Epic 8's extension module concept is restructured by this epic.

### Epic 16: Multi-Repository Project Layout (Phase 2)
Enterprise projects that separate planning knowledge, sprint management, and code across repositories are fully supported. The installer discovers repo locations, stores paths in config, and stamps them into project-context.md so agents resolve artifacts to the correct repository.
**FRs covered:** FR111, FR112, FR113, FR114, FR115, FR116, FR117, FR118, FR119, FR120, FR121, FR122
**NFRs addressed:** NFR34 (backward compat), NFR35 (air-gapped remote clone), NFR36 (deterministic), NFR37 (no hardcoded paths)
**Dependencies:** Epic 15 must be complete (module restructure). Epic 13 (project-context) provides the template that gains multi-repo section.

### Cross-Epic Coordination: `bmad.js`

Four epics modify `bmad.js`. Implementation order matters:
1. **Epic 5** (Bundled BMAD + Explicit Params) — changes invocation from `npx bmad-method` to vendored `node <resolved-path>` with explicit CLI flags, adds cache pre-population
2. **Epic 15** (6.2.1 Migration) — changes `--custom-content` deployment, adds migration detection, restructures extension module deployment
3. **Epic 6** (Methodology Onboarding) — adds methodology deployment step
4. **Epic 8** (Skill Enforcement) — adds extension module deployment (restructured by Epic 15)

Stories in Epics 6, 8, and 15 that touch `bmad.js` must build on Epic 5's vendored invocation + explicit parameter pattern.

### Development Execution Order

**Phase A — Installation Fixes (release version after completion):**
1. **Epic 5** (Bundled BMAD + Explicit Params) — fix installation bugs, explicit parameter passing → **release**

**Phase B — BMAD 6.2.1 Alignment (release version after completion):**
2. **Epic 15** (BMAD 6.2.1 Migration) — version bump, module restructure, agent/workflow conversion → **release**

**Phase C — Remaining Features:**
3. **Epic 17** (Sprint Management Model Rework) — reworks Epic 12, depends on Epic 11
4. **Epic 16** (Multi-Repo Layout) — depends on Epic 15 module restructure
5. **Epics 4, 7** (VS Integration, Test Suite) — on hold, can resume in parallel
6. **Epic 14** (External Tooling) — Phase 3, depends on Epics 12, 13

---

## Epic 5: Bundled BMAD Installation (Phase 2)

The ma-agents npm package bundles bmad-method and all external BMAD modules (bmb, cis, tea, gds) so that `npx ma-agents install` never performs runtime git clone or npm registry fetch for BMAD components. Installation is deterministic and works in air-gapped environments where the npm package is available.

### Story 5.1: Add bmad-method as Direct Dependency

As a **DevOps engineer**,
I want bmad-method included as a direct npm dependency in ma-agents,
So that BMAD installation does not require fetching bmad-method from the npm registry at runtime.

**Acceptance Criteria:**

**Given** `package.json` includes `"bmad-method": "6.0.4"` as a dependency
**When** `npm install` or `npm pack` is run
**Then** bmad-method v6.0.4 is installed in `node_modules/bmad-method/`

**Given** bmad-method is available in `node_modules/`
**When** `bmad.js` needs to invoke bmad-method
**Then** it uses `require.resolve('bmad-method/tools/bmad-npx-wrapper.js')` to find the local copy
**And** invokes it via `execSync('node <resolved-path> install ...')` instead of `execSync('npx bmad-method install ...')`

**Given** the vendored bmad-method is used
**When** any install, update, or recompile operation runs
**Then** the behavior is identical to the previous `npx bmad-method` invocation
**And** no npm registry network call is made for bmad-method

**Given** a project with an existing BMAD installation (installed via previous ma-agents version using `npx bmad-method`),
**When** the project upgrades to this version and runs `npx ma-agents install` or update,
**Then** existing `_bmad/` content is preserved, BMAD workflows continue to function, and no corruption occurs.

**Technical notes:**
- All 3 `execSync('npx bmad-method ...')` calls in `bmad.js` (lines 14, 37, 112) must be updated
- The resolved path must work cross-platform (use `path.join()`)

### Story 5.2: Create BMAD Cache Build Script

As a **Chief Architect**,
I want a build script that clones all BMAD external modules and their dependencies into `lib/bmad-cache/`,
So that the external modules can be bundled inside the ma-agents npm package for deterministic installation.

**Acceptance Criteria:**

**Given** the developer runs `npm run build:bmad-cache` on a connected machine
**When** the script executes
**Then** it clones each module listed in bmad-method's `external-official-modules.yaml` (bmb, cis, tea, gds) into `lib/bmad-cache/<module-code>/` using `git clone --depth 1`
**And** runs `npm install --omit=dev` inside each cloned module directory
**And** removes `.git/` directories from each cloned module to reduce package size
**And** creates a `lib/bmad-cache/cache-manifest.json` recording module versions, clone date, and source URLs

**Given** the script has already been run and `lib/bmad-cache/` exists
**When** the script is run again with `--force`
**Then** it removes the existing cache and rebuilds from scratch

**Given** the script is run without `--force` and `lib/bmad-cache/` exists
**When** a module's cached version matches the upstream HEAD
**Then** that module is skipped (incremental update)

**Given** the npm package is built with `npm pack`,
**When** the resulting tarball is inspected,
**Then** `lib/bmad-cache/` and all module directories are included in the package.

**Technical notes:**
- The script reads module definitions from bmad-method's `external-official-modules.yaml` (from the bmad-method npm dependency at `node_modules/bmad-method/`)
- The `.npmignore` or `package.json` `files` field must include `lib/bmad-cache/` to ensure it ships with the npm package
- Target bmad-method version: v6.0.4

### Story 5.3: Pre-populate BMAD External Module Cache

As a **DevOps engineer**,
I want the installer to pre-populate `~/.bmad/cache/external-modules/` from the bundled cache before invoking bmad-method,
So that bmad-method finds the external modules locally and skips git clone.

**Acceptance Criteria:**

**Given** `lib/bmad-cache/` contains pre-cloned modules (bmb, cis, tea, gds)
**When** the installer runs BMAD installation (install or update)
**Then** before invoking bmad-method, it copies each module from `lib/bmad-cache/<code>/` to `~/.bmad/cache/external-modules/<code>/`
**And** only copies if the target directory does not already exist (or `--force` is set)

**Given** the target cache directory `~/.bmad/cache/external-modules/bmb/` already exists
**When** the installer runs without `--force`
**Then** the existing cache is preserved (no overwrite)
**And** bmad-method uses the existing cached copy

**Given** the target cache directory exists
**When** the installer runs with `--force`
**Then** the existing cache is replaced with the bundled version

**Given** the cache is pre-populated from the bundled copy
**When** bmad-method's `cloneExternalModule()` runs
**Then** the installer sets `GIT_TERMINAL_PROMPT=0` in the child process environment to prevent interactive git prompts
**And** even if `git fetch` succeeds on a connected machine, the installation result remains deterministic because bmad-method uses the existing cache directory without overwriting bundled content

**Given** the cache is pre-populated
**When** bmad-method's `cloneExternalModule()` runs
**Then** it detects `fs.pathExists(moduleCacheDir)` is true
**And** attempts `git fetch` internally (succeeds silently on connected machines, fails silently in air-gapped environments — either way, the pre-populated cache is used)
**And** proceeds with the cached copy

**Technical notes:**
- Cache pre-population runs BEFORE any `bmad.installBmad()` or `bmad.updateBmad()` call
- Use `fs.copy()` (from fs-extra) for directory copy
- Create `~/.bmad/cache/external-modules/` directory structure if it doesn't exist
- This is the critical step that makes air-gapped BMAD installation work
- Note: bmad-method's internal git fetch on existing cache directories does a `git fetch` + `git reset --hard origin/main` only if fetch succeeds. To guarantee deterministic output per NFR20/NFR21, the pre-population step should set the cache directories as read-only or the installer should re-copy bundled cache after bmad-method completes. This is a design decision to resolve during implementation.

### Story 5.4: Validate Bundled Installation Completeness

As a **Chief Architect**,
I want to verify that installation from the bundled npm package produces a complete, functional BMAD environment,
So that deterministic installation is validated (NFR21).

**Acceptance Criteria:**

**Given** the ma-agents npm package is installed (via `npm install` or `npx`)
**When** `npx ma-agents install` is run with BMAD installation
**Then** the resulting `_bmad/` directory structure is complete
**And** all BMAD modules are present: core, bmm, bmb, cis, tea, gds
**And** all BMAD workflows, agents, and tasks function correctly
**And** all ma-agents customizations are applied (agent personas, MIL-STD-498 workflows, extension module)

**Given** the installation is complete
**When** the user runs any BMAD workflow (e.g., `/bmad-bmm-create-prd`)
**Then** the workflow executes correctly

**Given** the installation is complete
**When** the user runs `npx ma-agents status`
**Then** the status shows all installed skills and BMAD modules correctly

**Technical notes:**
- This is a validation/testing story, not a code implementation story
- Create a test procedure document verifying installation completeness
- Verify that no git clone or npm registry fetch occurs during BMAD installation
- Document any environment-specific considerations (e.g., cache-manifest.json dates)

### Story 5.5: Explicit Parameter Passing to bmad-method

As a **DevOps engineer**,
I want ma-agents to pass all collected installation parameters to bmad-method as explicit CLI flags,
So that BMAD is fully configured for all selected platforms (including OpenCode) without relying on the broken silent install mode.

**Acceptance Criteria:**

**Given** the user selects platforms during the ma-agents wizard (e.g., claude-code, cursor, opencode)
**When** bmad.js invokes bmad-method
**Then** it passes `--tools claude-code,cursor,opencode` explicitly
**And** bmad-method configures all selected platforms correctly

**Given** the user provides their name and language preference during the ma-agents wizard
**When** bmad.js invokes bmad-method
**Then** it passes `--user-name`, `--communication-language`, `--document-output-language`, and `--output-folder` as explicit flags
**And** bmad-method uses these values without prompting

**Given** all BMAD-relevant parameters are passed as explicit CLI flags
**When** the `--yes` flag is also included
**Then** bmad-method skips prompts only for parameters already supplied via flags
**And** applies its own defaults for any new parameters ma-agents hasn't mapped (FR125)
**And** no interactive BMAD prompt appears to the user (FR126)

**Given** the installer runs in CI/CD mode (`--yes --force`)
**When** bmad.js constructs the bmad-method command
**Then** it uses the same `buildBmadArgs()` function with pre-determined default answers
**And** produces identical BMAD configuration as interactive mode (FR127)

**Given** the extension module exists at `lib/bmad-extension/`
**When** bmad.js invokes bmad-method
**Then** it passes `--custom-content` with the quoted path to the extension module
**And** bmad-method validates the module.yaml and deploys the extension

**Given** bmad-method is invoked with `--action update` for existing installations
**When** the update completes
**Then** all explicit parameters are applied to the update
**And** existing customizations are preserved per bmad-method's update behavior

**Technical notes:**
- Create `buildBmadArgs(installContext)` function in `bmad.js` that constructs the full parameter list
- All path arguments must be quoted: `--directory "${projectRoot}"` (fixes space-in-path bug)
- The `--modules` flag always passes the full set: `bmm,bmb,cis,tea,gds`
- The `--custom-content` flag points to the extension module: `lib/bmad-extension/`
- Replaces all 3 existing `execSync('npx bmad-method ...')` calls
- Must work with bmad-method v6.0.4 CLI flag interface

### Story 5.6: Fix Space-in-Path Bug

As an **engineer**,
I want ma-agents installation to work in directories containing spaces,
So that I can install in any project location without path-related failures.

**Acceptance Criteria:**

**Given** the project is located at a path with spaces (e.g., `d:\My Projects\agents`)
**When** `npx ma-agents install` is run
**Then** the installation completes without errors
**And** all file paths are properly quoted in `execSync` calls

**Given** any `execSync` call in `bmad.js` that constructs shell commands with paths
**When** the path contains spaces, parentheses, or other shell-special characters
**Then** the path is enclosed in double quotes in the command string

**Given** `require.resolve()` returns a path with spaces
**When** the resolved path is used in an `execSync` call
**Then** the path is quoted: `execSync('node "${resolvedPath}" install ...')`

**Technical notes:**
- Audit all `execSync` calls in `bmad.js` for unquoted path interpolation
- The `buildBmadArgs()` function from Story 5.5 should handle quoting for all path arguments
- Test on Windows with paths like `C:\Users\John Smith\Documents\project`
- This is a bug fix — can be combined with Story 5.5 implementation since both touch the same code

---

## Epic 1: CI/CD Non-Interactive Mode

Engineers can run `npx ma-agents install --yes` for fully automated, non-interactive skill installation in CI/CD pipelines without human prompts.

### Story 1.1: Add --yes Flag for Non-Interactive Skill Installation

As a **DevOps engineer**,
I want to run `npx ma-agents install --yes` to skip all interactive prompts,
So that I can automate skill installation in CI/CD pipelines without human intervention.

**Acceptance Criteria:**

**Given** the CLI is invoked with `--yes` flag
**When** the install command executes
**Then** all interactive prompts (skill selection, agent selection, confirmations) are bypassed with default selections
**And** the installation completes without requiring stdin input
**And** exit code 0 is returned on success, non-zero on failure

**Given** the CLI is invoked with `--yes --force` flags together
**When** the install command executes
**Then** prompts are skipped AND existing files are overwritten
**And** the behavior is equivalent to answering "yes" to every prompt plus forcing overwrites

**Given** the CLI is invoked with `--yes` and a specific agent target (e.g., `--agent claude-code`)
**When** the install command executes
**Then** only the specified agent is targeted without prompting for agent selection
**And** all skills are installed to that agent without skill selection prompts

---

## Epic 2: Language-Specific Skill Expansion

Engineers working in C++, C#, and Python have dedicated coding standards and best practices skills installed through ma-agents, expanding the skill library with language-specific methodology content.

### Story 2.1: Create C++ Best Practices Skill

As a **C++ engineer**,
I want a C++ coding standards and best practices skill available in ma-agents,
So that my AI coding agent follows our organization's C++ methodology consistently.

**Acceptance Criteria:**

**Given** the C++ skill directory exists at `skills/cpp-best-practices/`
**When** the skill is listed via `npx ma-agents list`
**Then** it appears with category "language" and description referencing C++ standards

**Given** the C++ skill is installed to any supported agent
**When** the agent receives the skill content
**Then** it contains C++ coding standards, naming conventions, memory management patterns, and best practices
**And** the content is applicable to modern C++ (C++17/20/23)

**Given** the skill directory contains `skill.json`, `SKILL.md`, and optionally `templates/`
**When** no agent-specific template exists for a target agent
**Then** the `SKILL.md` canonical content is used as fallback per template resolution priority

### Story 2.2: Create C# Best Practices Skill

As a **C# engineer**,
I want a C# coding standards and best practices skill available in ma-agents,
So that my AI coding agent follows our organization's C# methodology consistently.

**Acceptance Criteria:**

**Given** the C# skill directory exists at `skills/csharp-best-practices/`
**When** the skill is listed via `npx ma-agents list`
**Then** it appears with category "language" and description referencing C# standards

**Given** the C# skill is installed to any supported agent
**When** the agent receives the skill content
**Then** it contains C# coding standards, .NET patterns, async/await best practices, and LINQ guidelines
**And** the content covers .NET 8+ modern patterns

**Given** the skill follows the standard skill schema contract
**When** installed across multiple agents
**Then** it produces functionally equivalent behavior regardless of target agent (FR36)

### Story 2.3: Create Python Best Practices Skill

As a **Python engineer**,
I want a Python coding standards and best practices skill available in ma-agents,
So that my AI coding agent follows our organization's Python methodology consistently.

**Acceptance Criteria:**

**Given** the Python skill directory exists at `skills/python-best-practices/`
**When** the skill is listed via `npx ma-agents list`
**Then** it appears with category "language" and description referencing Python standards

**Given** the Python skill is installed to any supported agent
**When** the agent receives the skill content
**Then** it contains Python coding standards, PEP 8 conventions, type hinting patterns, and packaging best practices
**And** the content covers Python 3.10+ modern patterns

**Given** all three language skills (C++, C#, Python) are installed
**When** the manifest is checked via `npx ma-agents status`
**Then** all three appear with correct versions and installation status per agent

---

## Epic 3: Skill Authoring Tooling

The Chief Architect has tooling to scaffold, validate, and test new skills, lowering the barrier for organizational skill creators and ensuring consistency across the skill library.

### Story 3.1: Skill Scaffolding Command

As a **Chief Architect**,
I want to run `npx ma-agents create-skill <skill-name>` to generate a new skill directory with all required files,
So that I can author new skills quickly without manually creating the directory structure.

**Acceptance Criteria:**

**Given** the user runs `npx ma-agents create-skill my-new-skill`
**When** the command executes
**Then** a directory `skills/my-new-skill/` is created with:
  - `skill.json` populated with name, version "1.0.0", empty description, default category, empty tags, `always_load: false`
  - `SKILL.md` with a template structure including frontmatter and placeholder content sections
  - `templates/` directory (empty, ready for agent-specific templates)
  - `references/` directory (empty)
  - `assets/` directory (empty)

**Given** a skill with the same name already exists
**When** the create-skill command is run
**Then** the command fails with an error message and does not overwrite the existing skill
**And** a hint suggests using a different name or removing the existing skill first

**Given** the skill name contains invalid characters (spaces, uppercase, special chars)
**When** the create-skill command is run
**Then** the command fails with an error explaining kebab-case naming requirement

### Story 3.2: Skill Validation Command

As a **Chief Architect**,
I want to run `npx ma-agents validate-skill <skill-name>` to check a skill for schema compliance,
So that I can catch skill format errors before distribution.

**Acceptance Criteria:**

**Given** the user runs `npx ma-agents validate-skill my-skill`
**When** the skill directory exists and contains valid files
**Then** the command reports "VALID" with a summary of skill metadata

**Given** the skill is missing `skill.json`
**When** the validate command runs
**Then** it reports "INVALID: missing required file skill.json"

**Given** the skill is missing `SKILL.md`
**When** the validate command runs
**Then** it reports "INVALID: missing required file SKILL.md"

**Given** the `skill.json` has missing or invalid fields (no name, no version, invalid category)
**When** the validate command runs
**Then** it reports each validation error with the field name and expected format

**Given** the skill has agent-specific templates in `templates/`
**When** the validate command runs
**Then** it verifies each template filename matches a known agent registry key
**And** warns about templates targeting unknown agents

### Story 3.3: Skill Test Install Command

As a **Chief Architect**,
I want to run `npx ma-agents test-skill <skill-name>` to perform a dry-run installation across all agents,
So that I can verify the skill installs correctly before publishing.

**Acceptance Criteria:**

**Given** the user runs `npx ma-agents test-skill my-skill`
**When** the command executes
**Then** it simulates installation to each supported agent without writing files
**And** reports which template would be used per agent (agent-specific, generic, or SKILL.md fallback)
**And** shows the resolved content that would be installed (with frontmatter injection)

**Given** a template has syntax errors or missing frontmatter
**When** the test-skill command runs
**Then** it reports the specific issue per agent target

**Given** the `--write` flag is provided
**When** the test-skill command runs
**Then** it writes the resolved output to a `test-output/` directory within the skill (gitignored) for manual review
**And** does NOT install to actual agent directories

---

## Epic 4: Visual Studio Agent Integration

Engineers can target Visual Studio's AI assistant for skill installation, expanding agent coverage to the VS ecosystem and closing the last major agent gap.

### Story 4.1: Research Visual Studio AI Agent Configuration

As a **Chief Architect**,
I want to understand how Visual Studio exposes AI agent configuration,
So that we can determine the correct injection mechanism for skill installation.

**Acceptance Criteria:**

**Given** Visual Studio has GitHub Copilot integration
**When** the integration mechanism is investigated
**Then** a technical note is produced documenting:
  - Where VS stores AI agent instructions (file paths, config directories)
  - What format VS expects (markdown, JSON, YAML, or other)
  - How VS Copilot Chat extensions handle custom instructions
  - Whether `.vs/` directory, `.editorconfig`, or another mechanism is used
  - Platform path differences (Windows-only or cross-platform VS Code distinction)

**Given** the research is complete
**When** the findings are documented
**Then** a clear recommendation exists for the agent registry configuration object fields

### Story 4.2: Add Visual Studio Agent to Registry

As an **engineer**,
I want Visual Studio listed as a target agent in ma-agents,
So that I can install skills into Visual Studio's AI assistant.

**Acceptance Criteria:**

**Given** the VS agent configuration is understood from Story 4.1
**When** a new agent object is added to `lib/agents.js`
**Then** it includes: name, category, platform paths, instruction file, and resource map
**And** no changes are needed to `installer.js` or other modules (NFR13)

**Given** the VS agent is registered
**When** `npx ma-agents list --agents` is run
**Then** Visual Studio appears in the agent list

**Given** a skill is installed targeting the VS agent
**When** the install completes
**Then** skill content is placed in the correct VS configuration directory
**And** the manifest tracks the VS agent installation

---

## Epic 6: Methodology Onboarding Package

Teams receive a methodology presentation bundled with installation, enabling organizational onboarding to BMAD-METHOD without separate training materials.

### Story 6.1: Bundle Methodology Presentation with Installation

As a **team lead**,
I want the BMAD-METHOD presentation included when ma-agents is installed,
So that new team members can learn the methodology without needing separate training materials.

**Acceptance Criteria:**

**Given** a methodology presentation file exists in the ma-agents package
**When** `npx ma-agents install` is run with BMAD installation
**Then** the presentation is copied to the project's BMAD output directory (e.g., `_bmad-output/methodology/`)
**And** the user is informed of the presentation location in the install summary

**Given** the presentation already exists in the target directory
**When** a subsequent install or update is run
**Then** the presentation is updated only if a newer version exists
**And** existing copies are not overwritten without the `--force` flag

### Story 6.2: Add Methodology Overview Command

As an **engineer**,
I want to run `npx ma-agents methodology` to see an overview of the BMAD-METHOD,
So that I can quickly understand the methodology without opening the full presentation.

**Acceptance Criteria:**

**Given** the user runs `npx ma-agents methodology`
**When** the command executes
**Then** a concise CLI summary of BMAD-METHOD is displayed:
  - What it is (one paragraph)
  - The SDLC phases covered
  - The agent personas available
  - Where to find the full presentation

**Given** BMAD is not installed in the current project
**When** the methodology command is run
**Then** it still displays the overview (it's part of ma-agents, not dependent on BMAD install)
**And** suggests running `npx ma-agents install` to get started

**Status: DEFERRED** — Story 6.2 is not in the current sprint plan. Epic 6's MVP is deliverable with Story 6.1 alone (methodology content is deployed to a known location). Story 6.2 (discoverability command) can be added via correct-course if desired after 6.1 ships. No implementation artifact file exists for this story.

---

## Epic 7: Test Suite Foundation

Contributors have automated regression tests verifying architectural contracts across the 4 core modules (cli.js, installer.js, agents.js, bmad.js), catching pipeline ordering violations, registry inconsistencies, and template resolution bugs before release.

**FRs covered:** FR73
**Dependencies:** Testing framework decision (Architecture, Phase 2 Decisions table) must be finalized before Story 7.1 begins. Epic 9 (OpenCode) affects agent count — tests must use dynamic assertions.
**Test isolation strategy:** All stories use temp directories for file I/O. Module tests use dependency injection or function-level stubs to prevent real BMAD operations, real installs, or real file system writes outside temp. Each story must document its isolation approach in its acceptance criteria.
**Coverage targets:** All exported/public functions in the 4 modules. Minimum one happy-path and one error-path assertion per function. Template resolution priority chain requires dedicated edge-case coverage (missing agent template, missing generic template, all fallbacks exhausted).
**Audience:** Contributors and maintainers — not end users. This epic protects internal code quality.

### Story 7.1: Set Up Test Framework and First Tests for agents.js

As a **contributor**,
I want a test framework configured with initial tests for the agent registry module,
So that agent configuration changes are verified automatically.

**Prerequisites:** Testing framework architectural decision finalized (Architecture, Phase 2 Decisions table). The chosen framework is used throughout — do not assume a specific framework in acceptance criteria.

**Acceptance Criteria:**

**Given** the chosen test framework is configured in `package.json`
**When** `npm test` is executed
**Then** tests run and report results with pass/fail counts

**Given** tests exist for `agents.js`
**When** the test suite runs
**Then** it verifies:
  - All agents returned by the registry are present with required fields (name, category, paths, instruction file) — assert dynamically against the registry, not a hardcoded count
  - Each agent has a valid `injectionStrategy` object with `position` defined
  - Platform path resolution returns valid paths for the current OS
  - Resource maps are defined for agents that need them (e.g., Cline)
  - No duplicate agent names exist in the registry
  - OpenCode agent (if registered) has `position: 'json-merge'` injection strategy

**Test isolation:** `agents.js` is a pure data + path module with no side effects — tests can call its functions directly without mocking. No file system writes occur.

### Story 7.2: Add Tests for installer.js Core Operations

As a **contributor**,
I want tests covering the installer engine's core operations,
So that skill installation, manifest management, and MANIFEST.yaml generation are protected against regressions.

**Acceptance Criteria:**

**Given** tests exist for `installer.js`
**When** the test suite runs
**Then** it verifies:
  - Skill discovery scans the `skills/` directory and finds all valid skills (assert count matches actual directory contents, not a hardcoded number)
  - MANIFEST.yaml generation produces valid YAML from installed skills
  - Manifest read/write operations are atomic (simulate write failure mid-operation — manifest remains in last valid state) (NFR7)

**Given** a test skill directory and a test agent config directory are set up in a temp directory
**When** install operations are tested
**Then** files are written to the temp directory, not actual agent config directories

**Template resolution priority chain (dedicated coverage):**

**Given** a test skill with all three template levels (agent-specific, generic, SKILL.md)
**When** resolution runs for an agent with an agent-specific template
**Then** the agent-specific template is selected

**Given** a test skill with only generic and SKILL.md (no agent-specific template)
**When** resolution runs
**Then** the generic template is selected

**Given** a test skill with only SKILL.md (no templates directory)
**When** resolution runs
**Then** SKILL.md is used as fallback

**Given** a test skill where SKILL.md is also missing or empty
**When** resolution runs
**Then** a clear error is raised (not a silent failure)

**Given** an agent that has no templates directory in the test skill
**When** resolution runs for that agent
**Then** the chain falls through correctly to generic → SKILL.md

**Additive-only verification (NFR5):**

**Given** a temp agent config directory with pre-existing files
**When** a skill install operation completes
**Then** all pre-existing files remain untouched — only new skill files are added
**And** no files are deleted or overwritten unless the same skill is being updated

**Test isolation:** All file operations target temp directories. Installer functions that call `agents.js` for path resolution are called with overridden paths pointing to temp. No real agent config directories are read or written.

### Story 7.3: Add Tests for bmad.js Pipeline Ordering

As a **contributor**,
I want tests verifying the BMAD pipeline executes stages in strict order,
So that customization ordering bugs are caught before release.

**Acceptance Criteria:**

**Stage ordering verification:**

**Given** `bmad.js` pipeline functions are instrumented with a call-order recorder (e.g., each stage function is wrapped to push its name onto an array)
**When** the full pipeline executes against a temp directory
**Then** the recorded call order is exactly:
  1. Install BMAD core files
  2. Apply YAML config customizations
  3. Trigger recompile
  4. Apply workflow customizations
  5. Apply template customizations
  6. Apply agent customizations
**And** no stage is skipped or reordered

**Stage failure halts pipeline:**

**Given** stage 2 (Apply YAML configs) is stubbed to throw an error
**When** the pipeline executes
**Then** stages 3–6 do not execute
**And** the error is propagated to the caller

**Given** stage 3 (Trigger recompile) is stubbed to throw an error
**When** the pipeline executes
**Then** stages 4–6 do not execute
**And** the error is propagated to the caller

**Given** stage 5 (Apply template customizations) is stubbed to throw an error
**When** the pipeline executes
**Then** stage 6 does not execute

**Note:** Testing failure at stages 2, 3, and 5 covers all three boundary types: pre-recompile failure, recompile failure, and post-recompile failure. If the pipeline uses a sequential executor pattern, these three cases are sufficient to prove halt-on-failure behavior.

**Test isolation:** Pipeline functions that perform file system operations are stubbed or pointed at temp directories. The recompile step must NOT trigger an actual BMAD recompile — stub it to record the call and return success (or throw, for failure tests). No real BMAD installation is required.

### Story 7.4: Add Tests for cli.js Command Routing

As a **contributor**,
I want tests covering CLI command parsing and routing,
So that command-line argument handling is verified automatically.

**Acceptance Criteria:**

**Command routing — dynamic verification:**

**Given** `cli.js` has a set of registered commands
**When** the test suite runs
**Then** every registered command routes to its expected handler function — assert against the actual command registry, not a hardcoded list
**And** unknown commands produce a helpful error message suggesting valid commands

**BMAD-specific commands:**

**Given** BMAD commands exist (e.g., install-bmad, update-bmad, or equivalent routing through `bmad.js`)
**When** BMAD commands are invoked
**Then** they route to `bmad.js` handler functions correctly
**Note:** Inspect `cli.js` to identify all command routes including BMAD-specific ones — do not assume only install/list/status/uninstall exist

**Flag parsing:**

**Given** CLI arguments include flags (`--yes`, `--force`, `--agent <name>`, `--help`, `--version`)
**When** arguments are parsed
**Then** boolean flags (`--yes`, `--force`) are extracted as `true`
**And** value flags (`--agent`) capture their argument
**And** `--help` triggers help output without executing a command
**And** `--version` displays the version from `package.json`

**Interactive vs non-interactive boundary:**

**Given** no `--yes` flag is provided and stdin is a TTY
**When** the CLI starts
**Then** it enters interactive wizard mode (inquirer-based)

**Given** `--yes` flag is provided
**When** the CLI starts
**Then** it skips all interactive prompts and uses defaults (CI/CD mode per FR6)

**Note:** These tests verify the boundary detection logic, not the full wizard flow. Assert that the correct code path is selected, not that inquirer renders correctly.

**Test isolation:** CLI tests stub the handler functions (`installer.js`, `bmad.js`) so that command routing is tested without triggering real installs or BMAD operations. Stdin/TTY detection is stubbed to test both interactive and non-interactive paths.

---

## Epic 8: Skill Enforcement Architecture (Phase 2)

**Goal:** Engineers' installed skills are reliably enforced by all agents — zero-reminder workflow.
**FRs covered:** FR51, FR52, FR53, FR54, FR55
**NFRs addressed:** NFR16 (extension survives updates), NFR17 (zero core modifications)

### Story 8.1: Move Instruction Injection to TOP Priority Position

As a **Chief Architect**,
I want the `<!-- MA-AGENTS-START -->` instruction block injected at the TOP of agent instruction files (after any file headers),
So that skills have the highest priority during LLM context processing and are not ignored.

**Acceptance Criteria:**

**Given** the installer runs for any markdown-based agent (Claude Code, Cursor, Copilot, etc.)
**When** the instruction block is injected into the agent's instruction file
**Then** the block is placed at the TOP of the file, after any file headers (e.g., YAML frontmatter delimited by `---`)
**And** the `skipPatterns` from the agent's `injectionStrategy` in `agents.js` are respected

**Given** an instruction file already has an `<!-- MA-AGENTS-START -->` block
**When** the installer runs again
**Then** the existing block is found and replaced in-place at its current position
**And** no duplicate blocks are created

**Given** an instruction file has no existing ma-agents block
**When** the installer injects for the first time
**Then** the block is inserted after skipped headers but before all other content

### Story 8.2: Add Agent-Aware Injection Strategy to Registry

As a **Chief Architect**,
I want each agent in `agents.js` to have an `injectionStrategy` property specifying format, position, and skip patterns,
So that the installer can inject instructions correctly for each agent's file format without hardcoding per-agent logic in `installer.js`.

**Acceptance Criteria:**

**Given** the `agents.js` registry
**When** any agent entry is reviewed
**Then** each agent has an `injectionStrategy` object with `position` and optional `skipPatterns`
**And** markdown agents have `position: 'top'` with appropriate skip patterns

**Given** `installer.js` performs injection
**When** it processes any agent
**Then** it reads `injectionStrategy` from the agent's registry entry
**And** all format-awareness logic lives in `agents.js`, not in `installer.js`

### Story 8.3: Create BMAD Extension Module Structure

As a **Chief Architect**,
I want the installer to deploy a BMAD extension module (`extends-module: bmm`) with `critical_actions` for skill loading,
So that all BMAD agents automatically load skills on activation before any menu or workflow executes.

**Acceptance Criteria:**

**Given** `npx ma-agents install` is run with BMAD installation
**When** the BMAD pipeline completes
**Then** `lib/bmad-extension/module.yaml` exists with `extends-module: bmm`
**And** `lib/bmad-extension/module-help.csv` exists with registered phases
**And** `lib/bmad-extension/agents/` contains 11 `.customize.yaml` files

**Given** the 4 custom agents (SRE, DevOps, Cyber, MIL-498)
**When** their `.customize.yaml` files are deployed
**Then** each contains full customization: persona, menu, and `critical_actions` steps 1-3 for skill loading

**Given** the 7 built-in BMM agents (PM, Architect, Dev, QA, SM, Tech Writer, UX Designer)
**When** their `.customize.yaml` files are deployed
**Then** each contains only `critical_actions` steps 1-3 for skill loading (no persona or menu overrides)

**Given** the extension module is deployed
**When** `npx bmad-method install --action update` is run
**Then** the extension module survives the update without losing functionality (NFR16)

### Story 8.4: Integration Verification

As a **Chief Architect**,
I want to verify that Stories 8.1, 8.2, and 8.3 work together end-to-end,
So that the skill enforcement architecture is validated as a complete pipeline before research stories proceed.

**Acceptance Criteria:**

**Given** Stories 8.1, 8.2, and 8.3 are all implemented
**When** `npx ma-agents install` runs for Claude Code
**Then** the MA-AGENTS block is injected at TOP of `.claude/CLAUDE.md` (after frontmatter)
**And** `injectionStrategy` from agents.js was read and used

**Given** install runs with BMAD
**When** BMAD pipeline completes
**Then** extension module is deployed with correct per-agent MANIFEST paths
**And** MA-AGENTS block is injected at TOP of BMAD agent .md files

**Given** a second install runs (update scenario)
**When** injection runs on files that already have MA-AGENTS blocks
**Then** blocks are replaced in-place (no duplicates)

### Story 8.5: Research and Implement Per-Agent Enforcement Hooks

As a **Chief Architect**,
I want per-agent enforcement mechanisms researched and implemented where agents support them,
So that skill compliance is enforced at multiple layers beyond instruction placement.

**Acceptance Criteria:**

**Given** Claude Code supports hooks (pre-tool-use, post-tool-use)
**When** enforcement hooks are researched
**Then** a technical note documents: hook types available, how they can verify manifest was read, implementation approach
**And** if feasible, a Claude Code hook is implemented that checks skill loading

**Given** other agents may have enforcement mechanisms
**When** the research is conducted
**Then** findings document which agents support hooks/verification and which don't
**And** recommendations for future implementation are provided

### Story 8.6: Research Context Persistence Strategies

As a **Chief Architect**,
I want context persistence strategies researched to ensure skills survive LLM context compression,
So that long sessions don't lose skill directives.

**Acceptance Criteria:**

**Given** BMAD supports sidecar memory (`hasSidecar`/`sidecar-folder`)
**When** context persistence is researched
**Then** a technical note documents: how sidecar memory works, whether it can store skill state, restoration patterns
**And** recommendations for implementation are provided

**Given** the research is complete
**When** findings are documented
**Then** a clear recommendation exists for whether to implement persistence now or defer to a future phase

---

## Epic 9: OpenCode Agent Support (Phase 2)

**Goal:** Engineers can target OpenCode as the 12th supported agent for skill installation with JSON-based instruction injection.
**FRs covered:** FR56, FR57
**NFRs addressed:** NFR18 (additive-only JSON merge), NFR13 (config-driven registry)

### Story 9.1: Register OpenCode Agent in Registry

As a **Chief Architect**,
I want OpenCode added to `agents.js` as the 12th agent with its configuration, skill directory, and JSON injection strategy,
So that the installer can target OpenCode using the same config-driven pattern as all other agents.

**Acceptance Criteria:**

**Given** the `agents.js` registry
**When** the OpenCode agent entry is added
**Then** it includes: `name: 'opencode'`, `category: 'ide'`, `configDir: '.opencode'`, `skillsDir: '.opencode/skills'`, `instructionFile: 'opencode.json'`
**And** `injectionStrategy` is `{ position: 'json-merge', targetKey: 'instructions' }`

**Given** the installer runs with `--agent opencode`
**When** agent resolution occurs
**Then** OpenCode is found in the registry and processed like any other agent
**And** no code changes to `installer.js` were needed (NFR13)

### Story 9.2: Implement JSON Merge Injection for OpenCode

As a **Chief Architect**,
I want the installer to support JSON-merge injection that creates or additively merges `opencode.json`,
So that skill instructions reach OpenCode without corrupting existing user configuration (NFR18).

**Acceptance Criteria:**

**Given** no `opencode.json` exists in the project
**When** the installer runs for OpenCode
**Then** a new `opencode.json` is created with the ma-agents `instructions` array entries tagged with `[ma-agents]`

**Given** an existing `opencode.json` with user-defined instructions and other configuration keys
**When** the installer runs for OpenCode
**Then** existing non-ma-agents instructions are preserved
**And** existing ma-agents entries (identified by `[ma-agents]` tag) are replaced with fresh entries
**And** all other JSON keys (not `instructions`) are preserved exactly as-is

**Given** an existing `opencode.json` with invalid JSON
**When** the installer attempts injection
**Then** a clear error message is displayed and the file is NOT modified
**And** the installer continues with other agents (non-fatal)

---

## Epic 10: Project Knowledge Preservation (Phase 2)

**Goal:** `_bmad-output` is version-controlled project knowledge, never gitignored.
**FRs covered:** FR58, FR59

### Story 10.1: Ensure _bmad-output Is Not Gitignored

As a **Chief Architect**,
I want the installer to remove `_bmad-output` from `.gitignore` if present and never add it,
So that planning artifacts are tracked as version-controlled project knowledge.

**Acceptance Criteria:**

**Given** a project with `_bmad-output` listed in `.gitignore`
**When** the installer runs (install or update)
**Then** the `_bmad-output` line is removed from `.gitignore`
**And** a message is displayed: `"_bmad-output is now tracked as project knowledge (not gitignored)"`

**Given** a project with no `_bmad-output` in `.gitignore`
**When** the installer runs
**Then** `.gitignore` is not modified for this concern

**Given** no `.gitignore` file exists
**When** the installer runs
**Then** no `.gitignore` is created for this purpose

**Given** the installer creates or updates `.gitignore` for other entries (e.g., `node_modules`, `_bmad/`)
**When** it writes the file
**Then** `_bmad-output` is never included in any gitignore entries

### Story 10.2: Document _bmad-output Policy in README and Installation Guidance

As a **Chief Architect**,
I want the `_bmad-output` folder policy documented in the README and installation guidance,
So that developers understand why `_bmad-output` is version-controlled and do not add it back to `.gitignore`.

**Acceptance Criteria:**

**Given** the project README
**When** a developer reads it
**Then** it contains a section explaining that `_bmad-output/` is intentionally tracked in version control as project knowledge
**And** the section explains what the folder contains (planning artifacts: PRDs, architecture, epics, stories, sprint plans)
**And** the section explains why it is tracked (team alignment, AI context continuity, project history)

**Given** the installation or getting-started documentation
**When** a developer sets up the tool
**Then** the guidance explicitly states that `_bmad-output/` must not be added to `.gitignore` and explains that the installer will remove it if found

**Dependency:** Story 10.1 (documents the installer behavior introduced there)

---

## Epic 11: Bug Management System (Phase 2)

**Goal:** Agents detect defects in already-delivered code and generate structured bug reports that enter the backlog for sprint prioritization.
**FRs covered:** FR60, FR61, FR62, FR63, FR64
**NFRs addressed:** NFR19 (menu + slash command invocation)
**Dependency:** Uses extension module from Epic 8 for workflow deployment

### Story 11.1: Create auto-bug-detection Skill

As a **Chief Architect**,
I want an `auto-bug-detection` skill that instructs agents to identify and report defects in already-delivered code,
So that bugs are caught proactively during all agent sessions.

**Acceptance Criteria:**

**Given** the `auto-bug-detection` skill is authored
**When** it is installed via ma-agents
**Then** `skills/auto-bug-detection/skill.json` exists with `always_load: true`
**And** `skills/auto-bug-detection/SKILL.md` contains detection criteria and reporting instructions

**Given** the skill is loaded by an agent via `critical_actions`
**When** the agent encounters a defect in already-delivered code during any session
**Then** the skill directives instruct the agent to report the defect using a structured format
**And** the skill distinguishes between bugs in delivered code vs. work-in-progress

**Given** the skill follows standard skill schema
**When** validated against skill.json contract
**Then** it passes all existing skill validation rules

### Story 11.2: Create Bug Story Extension Workflow

As a **Scrum Master**,
I want a BMAD extension workflow that creates structured bug stories from detected defects,
So that bugs enter the backlog with consistent format and are actionable for sprint planning.

**Acceptance Criteria:**

**Given** the `create-bug-story` workflow exists in `lib/bmad-extension/workflows/create-bug-story/workflow.md`
**When** invoked via BMAD agent menu or slash command (NFR19)
**Then** it guides the agent through creating a bug story with: title, reproduction steps, expected vs actual behavior, severity, affected component

**Given** a bug story is created
**When** it is saved
**Then** it exists as a standalone backlog item alongside user stories (FR64)
**And** it follows a consistent template format

**Given** the workflow is registered in `module-help.csv`
**When** a BMAD agent loads the extension module
**Then** the workflow appears in the agent's available workflows

### Story 11.3: Integrate Bug Detection into Code Review

As a **Developer**,
I want the code review workflow to include explicit bug detection checks,
So that defects in delivered code are caught during review and routed to the bug management system.

**Acceptance Criteria:**

**Given** a code review is in progress
**When** the `auto-bug-detection` skill is loaded (via `critical_actions`)
**Then** the reviewing agent evaluates delivered code for defects as part of the review
**And** detected bugs are flagged separately from code review feedback

**Given** a bug is detected during code review
**When** the reviewer documents it
**Then** the reviewer recommends creating a bug story via the `create-bug-story` workflow
**And** the bug is tracked independently from the story being reviewed

---

## Epic 12: Realistic Sprint Management (Phase 2)

**Goal:** Project managers work with flat backlogs containing stories and bugs, capacity-based sprints, and multi-criteria prioritization.
**FRs covered:** FR65, FR66, FR67, FR68, FR69, FR70, FR71
**NFRs addressed:** NFR19 (menu + slash command invocation)
**Dependency:** Uses extension module from Epic 8 for workflow deployment

### Story 12.1: Create Add Sprint Extension Workflow

As a **Scrum Master**,
I want an extension workflow to create new sprints with capacity limits,
So that sprint planning uses realistic capacity-based constraints rather than unbounded scope.

**Acceptance Criteria:**

**Given** the `add-sprint` workflow exists in `lib/bmad-extension/workflows/add-sprint/workflow.md`
**When** invoked via BMAD agent menu or slash command (NFR19)
**Then** it guides creation of a sprint with: sprint name/number, capacity (item count), start/end context
**And** the sprint is created as a trackable artifact

**Given** sprint capacity is defined by item count (FR66)
**When** a sprint is created
**Then** capacity is expressed as maximum number of items (stories + bugs)
**And** the workflow validates capacity is a positive integer

### Story 12.2: Create Add-to-Sprint Extension Workflow

As a **Scrum Master**,
I want an extension workflow to assign backlog items to a sprint using multi-criteria prioritization,
So that the highest-value items are selected within sprint capacity.

**Acceptance Criteria:**

**Given** the `add-to-sprint` workflow exists in `lib/bmad-extension/workflows/add-to-sprint/workflow.md`
**When** invoked via BMAD agent menu or slash command (NFR19)
**Then** it presents the flat backlog (stories + bugs) for selection (FR65)
**And** items can be assigned to a sprint

**Given** items are being prioritized for sprint assignment (FR67)
**When** the workflow guides prioritization
**Then** multiple criteria are considered (business value, technical dependencies, severity for bugs)
**And** the agent assists in ranking items within the sprint capacity

**Given** a sprint is at capacity
**When** an attempt is made to add another item
**Then** the workflow warns that capacity would be exceeded
**And** suggests removing an item or increasing capacity

### Story 12.3: Create Modify Sprint Extension Workflow

As a **Scrum Master**,
I want an extension workflow to modify existing sprints,
So that sprint scope can be adjusted when priorities change mid-sprint.

**Acceptance Criteria:**

**Given** the `modify-sprint` workflow exists in `lib/bmad-extension/workflows/modify-sprint/workflow.md`
**When** invoked via BMAD agent menu or slash command (NFR19)
**Then** it allows: adding items, removing items, changing capacity, updating sprint metadata

**Given** a sprint modification is requested
**When** items are added or removed
**Then** the sprint status reflects the updated item list and remaining capacity (FR71)

### Story 12.4: Update Sprint Status with Assigned Items

As a **Scrum Master**,
I want the sprint status workflow to show assigned items per sprint,
So that sprint progress is visible with all stories and bugs listed.

**Acceptance Criteria:**

**Given** the existing sprint status workflow
**When** it displays sprint information
**Then** it shows all assigned items (stories + bugs) with their current status (FR71)
**And** remaining capacity is visible
**And** bugs and stories are distinguishable in the listing

---

## Epic 13: Project Context Auto-Generation (Phase 2)

**Goal:** Every ma-agents project-level installation produces a platform-agnostic `_bmad-output/project-context.md` that acts as a constitutional document — mandating skill loading, fresh-worktree git workflow, and full mission lifecycle for all agents and BMAD workflows.
**FRs covered:** FR79, FR80, FR81, FR82, FR83, FR84, FR85, FR86
**NFRs addressed:** NFR22 (template has no hardcoded paths), NFR23 (additive-only), NFR24 (template as separate file), NFR25 (version comment for upgrade detection)
**Dependency:** Epic 8 (BMAD extension module with critical_actions infrastructure), Epic 10 (`_bmad-output/` version-controlled policy)

**Execution order:** 13.1 → 13.2 → 13.3 → 13.4 (prerequisite investigation required first) → 13.5

### Story 13.1: Create Project-Context Template and Generator Function

As a **Chief Architect**,
I want a standalone project-context template and a `generateProjectContext()` function in the installer,
So that a constitutional document can be generated with correct platform-specific content at install time.

**Acceptance Criteria:**

**Given** `lib/templates/project-context.template.md` is created (NFR24)
**When** a developer reads it
**Then** it contains all mandatory rule sections: pre-task MANIFEST loading, git worktree workflow, and full 8-step mission lifecycle (FR80, FR83)
**And** it contains a `{{MANIFEST_PATHS_LIST}}` placeholder — no hardcoded platform paths in the template source (NFR22)
**And** it contains a machine-readable template version comment `<!-- ma-agents-template-version: 1.0 -->` (NFR25)
**And** it contains inline expansion comments for `bmad-generate-project-context`, `bmad-retrospective`, and manual updates (FR85)
**And** it contains empty `## Technology Stack` and `## Project-Specific Rules` placeholder sections

**Given** `generateProjectContext(projectRoot, installedAgents)` is implemented in `installer.js`
**When** called with a project root and ALL agents from the project manifest (not just current-run agents)
**Then** it reads the template from `lib/templates/project-context.template.md`
**And** it resolves relative MANIFEST.yaml paths for each agent's `skillsDir` (relative to project root — no absolute paths)
**And** it replaces `{{MANIFEST_PATHS_LIST}}` with a formatted markdown bullet list of all resolved paths (FR81, FR82)
**And** it returns the stamped content string — it does NOT write any file (writing is Story 13.2's responsibility)
**And** when the template file is missing or unreadable it throws a descriptive Error with the cause

**Given** only one platform is installed
**When** paths are stamped
**Then** one MANIFEST path appears in the list (FR81)

**Given** multiple platforms are installed
**When** paths are stamped
**Then** all platform MANIFEST paths from the manifest appear in the list (FR82)

### Story 13.2: Integrate Generation into Install Pipeline

As a **DevOps Engineer**,
I want project-context.md generated automatically at the end of every project-level skill installation,
So that every ma-agents project has the constitutional document without any manual step.

**Acceptance Criteria:**

**Given** `npx ma-agents install` completes a project-level installation
**When** skills and/or BMAD have been installed
**Then** `generateProjectContext()` is called at the end of the install pipeline
**And** `_bmad-output/project-context.md` exists after installation

**Given** `_bmad-output/project-context.md` does not exist before installation
**When** the installer runs
**Then** the file is created with correct platform-stamped content (FR77, FR79)
**And** a success message is logged: `✓ project-context.md generated at _bmad-output/project-context.md`

**Given** `_bmad-output/project-context.md` already exists before installation (FR82, NFR23)
**When** the installer runs
**Then** the existing file is NOT modified or overwritten
**And** an info message is logged: `ℹ project-context.md already exists — skipping generation`

**Given** the install is a global install (targeting `~/.config/<agent>/`)
**When** the pipeline runs
**Then** project-context generation is skipped — no file is created (generation is project-level only)

**Given** the install is non-interactive CI/CD mode (`--yes` flag)
**When** the pipeline runs
**Then** project-context generation behaves identically to interactive mode — no interactive prompts required

### Story 13.3: Update BMAD Extension Critical_Actions to Load Project-Context

As a **Chief Architect**,
I want all BMAD agent `critical_actions` to load `_bmad-output/project-context.md` at activation,
So that BMAD workflow agents follow project-context rules in every session, not just IDE agents reading CLAUDE.md.

**Acceptance Criteria:**

**Given** all 11 agent `.customize.yaml` files in `lib/bmad-extension/agents/`
**When** updated for this story
**Then** each file's `critical_actions` includes a new step: `"If _bmad-output/project-context.md exists, read it completely"` — placed after the MANIFEST read step and before the skill-loading step (FR84)

**Given** a BMAD agent activates with the updated `critical_actions`
**When** `_bmad-output/project-context.md` exists in the project
**Then** the agent reads it as part of initialization and follows all rules therein
**And** the agent applies the git worktree mandate, mission lifecycle, and skill-loading rules from the file

**Given** a BMAD agent activates with the updated `critical_actions`
**When** `_bmad-output/project-context.md` does NOT exist (e.g., first install before generation, or global install)
**Then** the agent skips that step gracefully — the `if exists` phrasing ensures no error

**Given** `bmad.js` deploys the updated extension module
**When** `npx bmad-method install --action update` is run after deployment
**Then** the updated `critical_actions` survive the BMAD update (NFR16 — extension module independence)

**Dev Note:** The 4 custom agent customize files (SRE, DevOps, Cyber, MIL-498) have full persona + menu + critical_actions. The 7 built-in agent files (PM, Architect, Dev, QA, SM, Tech Writer, UX Designer, BMad Master) have critical_actions only. All 11 must be updated.

### Story 13.4: Add Project-Context Expansion Trigger to Retrospective Workflow

As a **Scrum Master**,
I want the BMAD retrospective workflow to include a project-context update step,
So that conventions and patterns discovered during a sprint are captured in the living document automatically.

**Acceptance Criteria:**

**Given** the retrospective workflow at `_bmad/bmm/workflows/bmad-retrospective/` (or equivalent extension path)
**When** a retrospective completes
**Then** the workflow includes a final step: *"Review `_bmad-output/project-context.md` — identify any new conventions, patterns, or agent failures from this sprint that should be captured. Propose specific additions to the `## Project-Specific Rules` section."*

**Given** the Scrum Master runs `/bmad-retrospective` after a sprint
**When** the retrospective reaches the expansion step
**Then** the agent presents the current `## Project-Specific Rules` section of project-context.md
**And** proposes additions based on patterns observed during the sprint
**And** waits for human confirmation before writing any changes to the file

**Given** `_bmad-output/project-context.md` does not exist when retrospective runs
**When** the expansion step executes
**Then** the step is skipped gracefully with a note: *"No project-context.md found — consider running the install or bmad-generate-project-context first."*

**Dev Note:** This story modifies a BMAD extension workflow. The retrospective workflow may live in `lib/bmad-extension/workflows/` (if it is a custom extension workflow) or in the installed `_bmad/bmm/workflows/` (if it is a built-in BMAD workflow). Investigate the actual location before implementation — if it is a built-in BMAD workflow, create an override or companion extension workflow rather than modifying the core. Never modify bmad-method core files (NFR17). **This story requires prerequisite investigation and should not be started until the workflow location is confirmed.**

### Story 13.5: Document Project-Context Generation in README and Installation Guidance

As a **DevOps Engineer**,
I want project-context generation documented in the README and QUICK_START guide,
So that users understand what the generated file is, why it appeared, and how to expand it over time.

**Acceptance Criteria:**

**Given** the README.md at project root
**When** updated for this story
**Then** it includes a "Project Context" section explaining: what `_bmad-output/project-context.md` is, when it is generated (project-level install only), that it is intentionally not overwritten on reinstall, and how to expand it (via `/bmad-generate-project-context` and retrospectives)

**Given** a user runs `npx ma-agents install` and sees `_bmad-output/project-context.md` appear
**When** they check the README
**Then** they find an explanation of the file without needing to search elsewhere

**Given** the QUICK_START.md guide
**When** updated
**Then** it mentions project-context.md as a post-install artifact with a pointer to the README for details

**Given** the generated project-context.md template (Story 13.1)
**When** reviewed alongside the README section
**Then** the expansion instructions in the README match the inline comments in the file — no contradictions between the two

---

## Epic 14: External Tooling Integration (Phase 3)

**Goal:** ma-agents can connect to external project management and knowledge management platforms (Jira, Confluence) as alternatives to the default file-system backends. The backend is configured at installation time via `project-context.md` or the root directives file (`CLAUDE.md` / equivalent), so agents and skills resolve data against the configured system without code changes.
**FRs covered:** Proposed — to be formally added to PRD after Story 14.3 architecture is approved
**Dependency:** Epic 12 (Sprint Management workflows), Epic 10 (Project Knowledge Preservation), Epic 13 (Project Context Auto-Generation — provides the config schema and installation pipeline)
**Phase:** 3 — analyst research and architecture design must complete before any implementation story is detailed
**Analyst + Architect required:** Yes — Stories 14.1, 14.2, and 14.3 are prerequisites for all implementation work

---

### Story 14.1: Analyst Research — Jira Sprint Management Integration

As a **Product Manager / Analyst**,
I want a research report on integrating Jira as a sprint management backend for ma-agents,
So that the architect has clear requirements before designing the abstraction layer.

**Acceptance Criteria:**

**Given** the current file-system sprint management model (`sprint-status.yaml`, story files)
**When** the analyst completes the research report
**Then** it documents: Jira REST API capabilities, authentication models (API token, OAuth, service account), field mapping (Jira status → ma-agents story status), rate limits, and offline/air-gapped scenarios
**And** it defines the proposed configuration schema to be set in `project-context.md` at installation time
**And** it identifies the minimum viable Jira integration scope (read story status) vs full bidirectional sync (write back story state)
**And** it covers both Jira Cloud and Jira Server/Data Center

**Given** the `story-status-lookup` skill (implemented in Epic 11 review cycle) has a reserved Jira extension point
**When** the report addresses credential handling
**Then** it proposes how credentials are stored (env vars vs `project-context.md` vs OS keychain)
**And** it clarifies what must be configured at install time vs at runtime

**Technical notes:**
- Output artifact: `_bmad-output/planning-artifacts/research-external-tooling-sprint-management.md`
- This report is the primary input for Story 14.3 (architecture design)
- Consider: what happens if Jira is unavailable mid-session (network failure, rate limit)?

---

### Story 14.2: Analyst Research — Knowledge Management Integration (Confluence)

As a **Product Manager / Analyst**,
I want a research report on integrating Confluence (and similar tools) as a knowledge management backend for ma-agents,
So that the architect can design a unified external tooling abstraction that covers both sprint and knowledge management.

**Acceptance Criteria:**

**Given** the current file-system knowledge model (markdown files in `_bmad-output/`)
**When** the analyst completes the research report
**Then** it documents: Confluence REST API capabilities, space/page model mapping to ma-agents artifact types (PRD, architecture, epics, retrospectives), read vs write requirements, and versioning model
**And** it identifies which ma-agents artifacts benefit most from Confluence sync and which should remain file-system-only
**And** it flags risks: bidirectional sync conflicts, Confluence markup vs markdown conversion, large attachment handling

**Given** agents read from knowledge artifacts during sessions
**When** the report covers the user experience
**Then** it proposes how agents know to read from Confluence vs the local file system
**And** it clarifies whether the integration is read-only, write-only, or bidirectional

**Technical notes:**
- Output artifact: `_bmad-output/planning-artifacts/research-external-tooling-knowledge-management.md`
- Input for Story 14.3 (architecture design)
- Consider other platforms (Notion, Obsidian vaults, SharePoint) — flag capability gaps vs Confluence

---

### Story 14.3: Architecture Design — External Tooling Abstraction Layer

As an **Architect**,
I want to design the abstraction layer that decouples ma-agents sprint and knowledge operations from their backend implementation,
So that future backends (Jira, Confluence, Linear, Notion) can be added without changing core workflows or skills.

**Acceptance Criteria:**

**Given** the research reports from Stories 14.1 and 14.2
**When** the architecture design is complete
**Then** it defines: backend interface contracts, the configuration schema in `project-context.md`, credential handling pattern, and how skills resolve their configured backend at runtime
**And** it specifies exactly how the `story-status-lookup` skill's Jira extension point (reserved during implementation) is fulfilled — including the configuration key names that `project-context.md` / root directives must contain
**And** it addresses: offline/air-gapped scenarios, partial configuration (only sprint management configured, or only knowledge management), and graceful degradation to file-system defaults

**Given** the installation pipeline (Epic 13)
**When** the architecture covers installation-time configuration
**Then** it defines which configuration questions are asked at install time vs deferred to first use
**And** it specifies how the installer writes the backend configuration into `project-context.md`

**Technical notes:**
- Output artifact: ADR in `_bmad-output/planning-artifacts/adr-external-tooling-abstraction.md`
- Stories 14.4 and 14.5 are fully blocked on this story
- After this story is approved, add formal FRs to the PRD and create detailed implementation stories for 14.4 and 14.5

---

### Story 14.4: Implement Jira Sprint Management Backend

*(Blocked on Stories 14.1 + 14.3 — full story spec to be written after architecture ADR is approved and FRs are added to PRD)*

---

### Story 14.5: Implement Confluence Knowledge Management Backend

*(Blocked on Stories 14.2 + 14.3 — full story spec to be written after architecture ADR is approved and FRs are added to PRD)*

---

## Epic 15: BMAD 6.2.1 Agent Architecture Migration (Phase 2)

ma-agents upgrades from bmad-method 6.0.4 to 6.2.1, restructures the extension module to follow BMAD 6.2.0 module conventions (agents as skill folders, workflows as skill folders, module.yaml with code field), converts all 34 operational workflows to SKILL.md packages, and provides an installer-driven migration path for existing installations.

### Story 15.1: Bump bmad-method to 6.2.1 and Update Cache

As a **Chief Architect**,
I want bmad-method updated from 6.0.4 to 6.2.1 and the cache build script updated to include wds,
So that the bundled BMAD installation uses the current stable version with all official modules.

**Acceptance Criteria:**

**Given** `package.json` currently pins `"bmad-method": "6.0.4"`
**When** the version is updated to `"6.2.1"`
**Then** `npm install` fetches bmad-method v6.2.1 into `node_modules/`
**And** `require.resolve('bmad-method/tools/bmad-npx-wrapper.js')` resolves correctly

**Given** the cache build script (`npm run build:bmad-cache`) currently clones 4 modules (bmb, cis, tea, gds)
**When** the script is updated
**Then** it clones 5 modules: bmb, cis, tea, gds, **wds** (bmad-whiteport-design-studio)
**And** `lib/bmad-cache/wds/` is populated with the cloned module and pre-installed dependencies

**Given** the bundled installation runs with bmad-method 6.2.1
**When** `npx ma-agents install` completes
**Then** the resulting `_bmad/` directory structure is valid for 6.2.1
**And** all BMAD workflows execute correctly against the 6.2.1 core

**Given** a project previously installed with bmad-method 6.0.4
**When** the new version runs `npx ma-agents install`
**Then** `buildBmadArgs()` passes `--action update` (detected from existing `_bmad/`)
**And** bmad-method 6.2.1 handles the upgrade from 6.0.4

**Technical notes:**
- Update `package.json`: `"bmad-method": "6.2.1"`
- Update `build:bmad-cache` script to read the updated `external-official-modules.yaml` from bmad-method 6.2.1 (which includes wds)
- Verify that bmad-method 6.2.1's CLI accepts the same flags used in `buildBmadArgs()` (Story 5.5)
- Test that `--custom-content` validation still works with our module.yaml

### Story 15.2: Restructure Extension Module for 6.2.0 Conventions

As a **Chief Architect**,
I want the extension module restructured to follow the BMAD 6.2.0 module pattern (verified from CIS module source),
So that `--custom-content` deployment works correctly and the module integrates natively with BMAD's module system.

**Acceptance Criteria:**

**Given** the current `lib/bmad-extension/module.yaml` contains `extends-module: bmm` but no `code` field
**When** the module.yaml is updated
**Then** it contains: `code: ma-skills`, `name`, `description`, and optionally `extends-module: bmm`
**And** `--custom-content lib/bmad-extension/` passes bmad-method's validation (requires `module.yaml` with `code` field)

**Given** the current module has `agents/*.customize.yaml` and `workflows/*/workflow.md`
**When** the module is restructured
**Then** all content moves under a `skills/` directory following the CIS pattern
**And** the old `agents/` and `workflows/` directories are removed from the module

**Given** the restructured module contains `module-help.csv`
**When** bmad-method processes the module
**Then** all 42 skills (4 agents + 38 workflows) are registered in the capability system

**Technical notes:**
- Create `lib/bmad-extension/skills/` directory
- Move and convert content in subsequent stories (15.3-15.5)
- The `module-help.csv` must list all skills with their type and trigger information
- Verify `--custom-content` deployment with the new structure by running a test installation

### Story 15.3: Convert 4 Custom Agents to Skill Folders

As a **Chief Architect**,
I want the 4 custom agents (SRE, DevOps, Cyber, MIL-498) converted from `.customize.yaml` files to BMAD 6.2.0 agent skill folders,
So that they are delivered as native module agents following the verified CIS pattern.

**Acceptance Criteria:**

**Given** each agent currently exists as a `.customize.yaml` file with persona, menu, and critical_actions
**When** the agent is converted
**Then** a skill folder is created at `lib/bmad-extension/skills/bmad-ma-agent-{role}/`
**And** it contains `SKILL.md` with the full agent definition (persona, menu, activation, critical_actions)
**And** it contains `bmad-skill-manifest.yaml` with `type: agent`, `name`, `displayName`, `role`, `identity`, `communicationStyle`, `principles`, `module: ma-skills`

**Given** the SRE agent (Alex) has persona fields, 9 menu items referencing SRE playbooks, and skill-loading critical_actions
**When** converted to `bmad-ma-agent-sre/SKILL.md`
**Then** the SKILL.md contains the complete persona, all menu items with trigger phrases, activation sequence, and critical_actions
**And** menu items reference the SRE workflow skills by their new skill names (e.g., `sre-health-check`)

**Given** the same conversion for DevOps (Amit), Cyber (Yael), and MIL-498 (Joseph)
**When** all 4 agents are converted
**Then** each has a valid skill folder under `lib/bmad-extension/skills/`
**And** the `bmad-skill-manifest.yaml` fields match the agent's established persona

**Given** the converted agents are deployed via `--custom-content`
**When** a user activates any of the 4 agents
**Then** the agent behaves identically to its pre-conversion behavior — same persona, same menu, same workflows (NFR30)

**Technical notes:**
- Source material: `lib/bmad-customizations/bmm-{agent}.customize.yaml` (base) + `lib/bmad-extension/agents/bmm-{agent}.customize.yaml` (extended) + `_bmad/custom/agents/{agent}.md` (XML definition)
- Consolidate all three sources into a single SKILL.md per agent
- Critical_actions in SKILL.md should use the BMAD 6.2.0 format observed in the customize docs
- After conversion, the old `.customize.yaml` files for custom agents are no longer needed (removed in Story 15.6)

### Story 15.4: Convert 11 MIL-498 Workflows to SKILL.md Packages

As a **MIL-STD-498 expert**,
I want all 11 DID workflows converted from legacy YAML format to BMAD 6.2.0 SKILL.md packages,
So that they function without the removed legacy workflow engine.

**Acceptance Criteria:**

**Given** each MIL-498 workflow currently exists as `workflow.yaml` + `instructions.md` in `lib/bmad-workflows/mil498/`
**When** converted to a SKILL.md package
**Then** a skill folder is created at `lib/bmad-extension/skills/mil498-{did}/` (e.g., `mil498-srs/`)
**And** it contains `SKILL.md` (workflow entrypoint with routing logic), `bmad-skill-manifest.yaml` (type: skill), `template.md` (DID output template), and `prompts/` (step files for progressive disclosure)

**Given** a MIL-498 workflow has sequential steps that must execute in strict order (compliance-critical)
**When** the workflow is converted
**Then** each step becomes a separate file in `prompts/` (Layer 4 progressive disclosure)
**And** the step files preserve the exact same sequence and content as the original instructions.md
**And** template output checkpoints (previously `<template-output>` XML tags) become explicit user confirmation gates in step files

**Given** all 11 DID workflows (SSS, SSDD, OCD, SDP, SRS, SDD, STD, STR, IDD, IRS, HRS) are converted
**When** a user invokes any DID workflow
**Then** it produces the same document output as before conversion (NFR32)
**And** the same pause-and-confirm behavior for document section approval is preserved

**Technical notes:**
- 11 workflows: mil498-sss, mil498-ssdd, mil498-ocd, mil498-sdp, mil498-srs, mil498-sdd, mil498-std, mil498-str, mil498-idd, mil498-irs, mil498-hrs
- These are Complex Workflow skill type — the most structured form in BMAD 6.2.0
- The step file naming should follow a consistent pattern: `01-discovery.md`, `02-requirements.md`, etc.
- Templates must be carried over verbatim — no content changes during conversion

### Story 15.5: Convert 23 SRE/DevOps/Cyber Workflows to SKILL.md Packages

As a **Chief Architect**,
I want all SRE, DevOps, and Cyber operational playbooks converted to SKILL.md skill packages,
So that they integrate with the BMAD 6.2.0 skill system consistently.

**Acceptance Criteria:**

**Given** SRE playbooks currently exist as standalone `.md` files in `lib/bmad-workflows/sre/` (9 workflows)
**When** each is converted to a SKILL.md package
**Then** a skill folder is created at `lib/bmad-extension/skills/sre-{workflow}/`
**And** it contains `SKILL.md` (wrapping the existing workflow content with proper frontmatter) and `bmad-skill-manifest.yaml` (type: skill)

**Given** DevOps playbooks in `lib/bmad-workflows/devops/` (6 workflows) and Cyber playbooks in `lib/bmad-workflows/cyber/` (8 workflows)
**When** converted following the same pattern
**Then** each gets its own skill folder under `lib/bmad-extension/skills/`

**Given** a multi-step workflow (e.g., `sre-health-check` with discovery → diagnosis → remediation)
**When** it is complex enough to benefit from progressive disclosure
**Then** it uses `prompts/` for step files (Complex Workflow type)
**Otherwise** single-pass playbooks remain as simple `SKILL.md` files (Simple Workflow type)

**Given** all 23 workflows are converted
**When** the agent menu references them
**Then** agents can invoke them by the new skill name
**And** the workflow behavior is identical to pre-conversion (NFR32)

**Technical notes:**
- 9 SRE: health-check, fix-deployments, performance-opt, check-deployment-status, check-secrets, day-2-ops, deployment-strategies, gitops-status, + 1 more
- 6 DevOps: configure-infrastructure, optimize-pipelines, manage-helm, disconnected-deployment, docker-compose-setup, sign-docker-image
- 8 Cyber: vulnerability-scan, security-audit, threat-modeling, generate-certs, immunity-estimation, vault-secrets, verify-docker-users, verify-image-signature
- Conversion is lighter than MIL-498 — existing .md content wraps into SKILL.md with frontmatter
- Also convert the 4 extension workflows (create-bug-story, add-sprint, modify-sprint, add-to-sprint) to skill format

### Story 15.6: Separate Built-in Agent Customizations

As a **Chief Architect**,
I want the `.customize.yaml` files for 8 built-in BMM agents moved from `lib/bmad-extension/agents/` to `lib/bmad-customize/`,
So that module-owned agents (in skill folders) are cleanly separated from customizations of other modules' agents.

**Acceptance Criteria:**

**Given** the 8 built-in agent `.customize.yaml` files (bmm-pm, bmm-architect, bmm-dev, bmm-qa, bmm-sm, bmm-tech-writer, bmm-ux-designer, core-bmad-master)
**When** moved to `lib/bmad-customize/`
**Then** each file contains only `critical_actions` (skill loading + project-context loading)
**And** no persona, menu, or other overrides are present

**Given** the `.customize.yaml` files use BMAD 6.2.0 syntax
**When** the critical_actions are written
**Then** they use array syntax (list of strings) per current BMAD documentation:
```yaml
critical_actions:
  - "Read the skills MANIFEST at {project-root}/skills/MANIFEST.yaml"
  - "For each skill marked always_load: true, read the skill file completely"
  - "If _bmad-output/project-context.md exists, read it completely"
  - "Follow all skill directives and project-context rules during this session"
```

**Given** `bmad.js` deploys these files
**When** installation runs
**Then** files are copied from `lib/bmad-customize/` to `_bmad/_config/agents/` AFTER `--custom-content` deploys the extension module

**Given** the old `lib/bmad-extension/agents/` directory contained both custom and built-in agent files
**When** the separation is complete
**Then** `lib/bmad-extension/agents/` no longer exists (custom agents are now in `skills/`, built-ins are in `lib/bmad-customize/`)

**Technical notes:**
- `bmad.js` needs two deployment steps: (1) `--custom-content lib/bmad-extension/` for the module, (2) file copy from `lib/bmad-customize/*.customize.yaml` to `_bmad/_config/agents/`
- The old `lib/bmad-customizations/` directory (base configs) is also eliminated — its content was merged into agent skill folders in Story 15.3

### Story 15.7: Migration Detection and Upgrade Path

As a **DevOps engineer**,
I want the installer to automatically detect and upgrade from 6.0.4 to 6.2.1 during normal installation,
So that I don't need a separate upgrade command and my existing customizations are preserved.

**Acceptance Criteria:**

**Given** an existing project with bmad-method 6.0.4 installed (detected from `_bmad/core/config.yaml` version field)
**When** `npx ma-agents install` runs with the new version
**Then** the installer detects the old version and logs: `"Upgrading BMAD from 6.0.4 to 6.2.1..."`
**And** passes `--action update` to bmad-method

**Given** the user had customized agent personas (e.g., changed SRE agent's name from Alex to Sasha)
**When** the migration runs
**Then** the installer backs up existing `_bmad/_config/agents/*.customize.yaml` before updating
**And** after the module deploys, it checks backed-up files for user-added `memories`, extra `critical_actions`, or persona overrides
**And** carries forward user customizations that don't conflict with the new structure

**Given** legacy artifacts exist (old `.customize.yaml` for custom agents in `_bmad/_config/agents/`, XML agent definitions in `_bmad/custom/agents/`, YAML workflow files)
**When** migration completes successfully
**Then** legacy artifacts are removed
**And** a migration log is printed listing what was cleaned up

**Given** the bmad-method update fails (e.g., file permission error, corrupted state)
**When** the error is caught
**Then** the installer restores backed-up `.customize.yaml` files
**And** logs the error with a recovery suggestion
**And** the project remains functional on the old version (NFR29)

**Given** a fresh project with no existing BMAD installation
**When** `npx ma-agents install` runs
**Then** it deploys directly in 6.2.1 format with skill-based agents and workflows
**And** no migration logic executes (FR110)

**Technical notes:**
- `detectMigrationNeed()` function reads `_bmad/core/config.yaml` for version
- Backup directory: `_bmad/_config/agents/.backup-pre-migration/`
- Customization merge is best-effort — if a user customized something that no longer exists in the new format, log a warning
- The migration sequence: back up → invoke bmad-method update → deploy new extension module → deploy built-in customizes → merge user customizations → clean up legacy

### Story 15.8: Validate Migrated Agents and Workflows

As a **Chief Architect**,
I want to verify that all migrated agents and workflows function identically to their pre-migration behavior,
So that functional equivalence (NFR30) and output equivalence (NFR32) are confirmed.

**Acceptance Criteria:**

**Given** all 4 custom agents have been converted to skill folders
**When** each agent is activated
**Then** the agent displays the same persona, same greeting, and same menu items as before
**And** every menu item routes to the correct workflow

**Given** all 11 MIL-498 workflows have been converted
**When** each DID workflow is invoked
**Then** it produces the same document structure with the same template sections
**And** the progressive disclosure step files execute in the same order

**Given** all 23 SRE/DevOps/Cyber workflows have been converted
**When** each playbook is invoked
**Then** it produces the same output as the pre-conversion `.md` version

**Given** the migrated extension module is deployed
**When** BMAD Builder lint gate scripts are run against the skill folders
**Then** `scan-path-standards.py` passes without critical violations
**And** `scan-scripts.py` passes without critical violations (NFR31)

**Technical notes:**
- This is a validation/testing story
- Create a checklist document: each agent menu item → expected behavior → actual behavior
- Compare MIL-498 DID output before/after conversion using diff
- Run BMAD Builder QO (Quality Optimize) if available against the module

---

## Epic 16: Multi-Repository Project Layout (Phase 2)

Enterprise projects that separate planning knowledge, sprint management, and code across repositories are fully supported. The installer discovers repo locations, stores paths in config, and stamps them into project-context.md so agents resolve artifacts to the correct repository.

### Story 16.1: Repository Layout Wizard

As a **Chief Architect**,
I want the installer to ask where the knowledgebase and sprint management are managed during installation,
So that the project layout is configured correctly for multi-repo environments.

**Acceptance Criteria:**

**Given** the user runs `npx ma-agents install`
**When** the wizard reaches the repository layout section
**Then** it asks: "Where is your knowledgebase managed?" with options: Current repository (default), Local path, Remote git repository
**And** it asks: "Where is your sprint management managed?" with the same options

**Given** the user selects "Remote git repository" for knowledgebase
**When** prompted for details
**Then** the wizard asks for the git URL
**And** asks for the local destination path for cloning
**And** if the destination already exists, displays its contents summary and asks the user to confirm (FR113)
**And** if the destination does not exist, clones the repository to that path (FR114)

**Given** the user selects "Local path" for sprint management
**When** prompted for the path
**Then** the wizard validates the path exists
**And** if it does not exist, alerts the user and asks to confirm or correct (FR115)

**Given** the user selects "Current repository" for both concerns
**When** the wizard completes
**Then** no additional configuration is needed — single-repo mode preserved (FR116)

**Given** the user runs with `--yes` flag (CI/CD mode)
**When** the wizard reaches the repository layout section
**Then** both concerns default to "Current repository" without prompting

**Technical notes:**
- New section in `cli.js` wizard, after agent selection
- Use existing inquirer prompts pattern
- `git clone` command must quote the URL and destination path for space-safety

### Story 16.2: Config Storage and Cross-Reference File

As a **DevOps engineer**,
I want the configured repo paths stored persistently and a cross-reference file created in the code repo,
So that agents and BMAD workflows can discover the correct paths without re-running installation.

**Acceptance Criteria:**

**Given** the user configured knowledgebase at `d:/Code/kb-repo` and sprint management at `d:/Code/sprint-repo`
**When** the installation completes
**Then** `_bmad/core/config.yaml` contains:
```yaml
knowledgebase_path: "d:/Code/kb-repo"
sprint_management_path: "d:/Code/sprint-repo"
```

**Given** multi-repo mode is configured
**When** the installation completes
**Then** `_bmad-output/project-layout.yaml` is created in the CODE repository containing:
```yaml
generated: '2026-03-26'
knowledgebase:
  mode: remote
  path: "d:/Code/kb-repo"
  gitUrl: "https://..."
sprint_management:
  mode: local
  path: "d:/Code/sprint-repo"
```

**Given** single-repo mode is configured (both set to "current repository")
**When** the installation completes
**Then** config.yaml contains `knowledgebase_path: "."` and `sprint_management_path: "."`
**And** no `project-layout.yaml` is created (NFR34)

**Given** the installation runs multiple times with the same multi-repo configuration
**When** `project-layout.yaml` is regenerated
**Then** the output is identical except for the `generated` date field (NFR36)

**Technical notes:**
- Write config values after bmad-method installation completes
- `project-layout.yaml` is generated by ma-agents installer, not by bmad-method
- The file is created in `_bmad-output/` which is version-controlled (per F3)

### Story 16.3: Project-Context Multi-Repo Section

As an **AI agent**,
I want project-context.md to include the configured repository paths,
So that I know where to read and write planning and sprint artifacts.

**Acceptance Criteria:**

**Given** multi-repo is configured with knowledgebase at `/path/to/kb` and sprint at `/path/to/sprint`
**When** project-context.md is generated (or regenerated)
**Then** it includes a "Repository Layout" section:
```markdown
### Repository Layout
- **Knowledgebase:** /path/to/kb
- **Sprint Management:** /path/to/sprint
- When creating or reading planning artifacts, use the knowledgebase path
- When creating or reading sprint/story artifacts, use the sprint management path
```

**Given** single-repo mode is configured
**When** project-context.md is generated
**Then** the "Repository Layout" section is omitted entirely (NFR34 backward compatibility)

**Given** project-context.md already exists when the installer runs
**When** multi-repo is configured for the first time
**Then** project-context.md is NOT modified (idempotency per FR84)
**And** the installer logs: "project-context.md exists — add Repository Layout section manually or run /bmad-generate-project-context"

**Technical notes:**
- Update `lib/templates/project-context.template.md` to include conditional multi-repo section
- Add `{{REPO_LAYOUT_SECTION}}` placeholder that resolves to the section or empty string
- The generator function needs the repo layout config as input alongside installedAgents

### Story 16.4: Validate Cross-Repo Path Resolution

As a **Chief Architect**,
I want to verify that BMAD workflows correctly resolve artifact paths from the configured repo layout,
So that planning and sprint artifacts are read from and written to the correct repositories.

**Acceptance Criteria:**

**Given** a multi-repo configuration where knowledgebase is at a different path than the code repo
**When** a BMAD planning workflow (e.g., `/bmad-bmm-create-prd`) runs
**Then** it reads existing planning artifacts from `{knowledgebase_path}/_bmad-output/planning-artifacts/`
**And** writes output to the same path

**Given** a multi-repo configuration where sprint management is at a different path
**When** a BMAD sprint workflow (e.g., `/bmad-bmm-sprint-planning`) runs
**Then** it reads/writes sprint artifacts from `{sprint_management_path}/_bmad-output/sprints/`

**Given** single-repo configuration
**When** any BMAD workflow runs
**Then** artifacts are read from and written to the current project's `_bmad-output/` as before (NFR34)

**Given** an agent is working in the code repository with multi-repo configured
**When** the agent needs planning context (e.g., reading the PRD during story implementation)
**Then** it discovers the knowledgebase path from `_bmad-output/project-layout.yaml` or `_bmad/core/config.yaml`
**And** reads the PRD from the knowledgebase repository

**Technical notes:**
- This is a validation/testing story
- Verify that BMAD workflows use config values for path resolution, not hardcoded `_bmad-output/`
- If BMAD workflows don't natively support configurable output paths, this story identifies the gap and documents what workflow changes are needed
- Test both directions: writing artifacts to external repo AND reading artifacts from external repo

### Story 16.5: Fix Config Lost on Update (Bug)

As a **user with a multi-repo layout configured**,
I want my repo layout configuration to be preserved when I update ma-agents,
So that I don't silently lose my multi-repo paths every time I add a skill or update agents.

**Acceptance Criteria:**

**Given** an existing installation with multi-repo layout configured in `project-layout.yaml`
**When** the user runs `ma-agents` again and selects "Update"
**Then** the repo layout prompts are pre-populated with the existing configuration

**Given** an update with `--yes` flag and no env vars
**When** `project-layout.yaml` exists with multi-repo paths
**Then** the existing layout is preserved instead of defaulting to single-repo

**Given** an update with `--yes` flag and env vars set
**When** `project-layout.yaml` also exists
**Then** the env vars take precedence over the file (explicit override wins)

**Technical notes:**
- BUG: `collectRepoLayout()` runs unconditionally on every install/update — no `isUpdate` guard
- Implement `readExistingLayout()` to parse `project-layout.yaml` and pre-populate prompts
- In `--yes` mode without env vars, preserve existing config from file
- Origin: Adversarial Review Finding #1

### Story 16.6: Repository Sync Check Skill

As a **developer using multi-repo layout**,
I want a skill that checks whether external repos are in sync and properly scaffolded,
So that I catch stale clones and missing directory structures before agents fail at runtime.

**Acceptance Criteria:**

**Given** a multi-repo layout is configured
**When** the user or agent runs the repo-sync-check skill
**Then** it reads config.yaml, checks each external path exists, verifies expected directory structure, and checks git sync status

**Given** an external path missing `_bmad-output/planning-artifacts/`
**When** the skill runs
**Then** it reports the missing structure and offers to scaffold it

**Given** an external git repo where local is behind remote
**When** the skill runs
**Then** it reports how many commits behind and advises `git pull`

**Given** a single-repo layout
**When** the skill runs
**Then** it reports "no external repos to check" and exits cleanly

**Technical notes:**
- Covers both scaffolding gap (external repo never initialized) and sync gap (no pull after clone)
- Read-only git operations: `git fetch`, `git rev-list --count`, `git status --porcelain`
- Implemented as a skill (not workflow) — short, self-contained check
- Origin: Adversarial Review Findings #3 and #4

### Story 16.7: Portable Path Storage

As a **team member cloning a project with multi-repo layout**,
I want stored paths to be relative rather than absolute,
So that `project-layout.yaml` and `config.yaml` work across different machines.

**Acceptance Criteria:**

**Given** a local multi-repo path that is relative to the project root
**When** the config is written
**Then** the path is stored as relative (e.g., `../kb-repo` instead of `d:/Code/kb-repo`)

**Given** a path that cannot be expressed as a relative path (cross-drive on Windows)
**When** the config is written
**Then** the absolute path is stored with a portability warning comment

**Given** stored relative paths
**When** `readExistingLayout()` reads them back
**Then** it resolves to absolute paths using `path.resolve(projectRoot, storedPath)`

**Technical notes:**
- Add `toPortablePath(absolutePath, projectRoot)` utility using `path.relative()`
- Update `writeProjectLayoutYaml()` and `writeRepoLayoutConfig()` to use portable paths
- Backward compatible: existing absolute paths still work when read back
- Origin: Adversarial Review Finding #7

### Story 16.8: CI/CD Remote Repository Mode

As a **CI/CD pipeline operator**,
I want to configure remote git repositories headlessly via env vars,
So that automated pipelines can set up multi-repo remote layouts without prompts.

**Acceptance Criteria:**

**Given** `--yes` flag and `MA_KNOWLEDGEBASE_GIT_URL` env var set
**When** `collectRepoLayout()` runs
**Then** it clones the repo to `MA_KNOWLEDGEBASE_PATH` and returns `mode: 'remote'`

**Given** git URL env var set but corresponding path env var missing
**When** `collectRepoLayout()` runs
**Then** it exits with error: "MA_KNOWLEDGEBASE_GIT_URL requires MA_KNOWLEDGEBASE_PATH"

**Given** clone destination already exists with `.git` directory
**When** clone is attempted
**Then** it skips cloning (idempotent for CI re-runs)

**Given** clone failure in CI mode
**When** the error occurs
**Then** it exits non-zero with clear error (no silent fallback to same mode)

**Technical notes:**
- New env vars: `MA_KNOWLEDGEBASE_GIT_URL`, `MA_SPRINT_GIT_URL`
- CI mode must fail loudly — no fallback to `same` on error
- Idempotent: existing valid clone at destination is reused
- Origin: Adversarial Review Finding #8

### Story 16.9: Reconfigure Layout Workflow

As a **user who needs to change repo layout after installation**,
I want a dedicated command and workflow to reconfigure repo layout,
So that I can change paths without re-running the full installer.

**Acceptance Criteria:**

**Given** the user runs `ma-agents config layout`
**When** the command starts
**Then** it displays current layout and presents the layout wizard pre-populated with current values

**Given** the user runs `ma-agents config layout --show`
**Then** it displays current configuration in read-only mode (no prompts)

**Given** reconfiguration completes
**When** new paths are confirmed
**Then** `config.yaml`, `project-layout.yaml`, and `project-context.md` are all updated

**Given** reconfiguration from multi-repo to single-repo
**When** update completes
**Then** `project-layout.yaml` is deleted and config reverts to single-repo defaults

**Technical notes:**
- Reuses all existing functions: `readExistingLayout()`, `collectRepoLayout()`, `writeRepoLayoutConfig()`, `writeProjectLayoutYaml()`, `updateProjectContextRepoLayout()`
- Also create a BMAD skill so agents can guide users to the command
- Depends on Stories 16.5, 16.7, 16.8
- Origin: Adversarial Review Finding #10

---

## Epic 17: Sprint Management Model Rework (Phase 2)

Sprint management is rebuilt with a proper data model: sprints as first-class entities, flat backlog with bugs as a story type, multi-criteria prioritization, bidirectional item movement (backlog ↔ sprint), and automatic done-item cleanup. Epic 12 delivered workflow shells — this epic builds the underlying model and rewires everything.

### Story 17.1: Sprint Entity Model

As a **Scrum Master**,
I want sprints defined as first-class YAML entities with capacity, assigned items, and status,
So that sprint planning is based on real sprint definitions, not just a flat status list.

**Acceptance Criteria:**

**Given** the Scrum Master creates a sprint
**When** the sprint is persisted
**Then** a YAML file is created at `{implementation_artifacts}/sprints/sprint-{id}.yaml` containing:
```yaml
id: sprint-3
name: "Sprint 3"
status: planning  # planning | active | closed
capacity: 6       # max items (stories + bugs)
start: "2026-04-01"
end: "2026-04-14"
items: []          # assigned story/bug IDs
```

**Given** a sprint has items assigned
**When** the sprint file is read
**Then** `items` contains an ordered list of story/bug IDs (e.g., `["5-5-explicit-parameter-passing", "5-6-fix-space-in-path-bug", "BUG-path-spaces"]`)
**And** the count of items never exceeds `capacity`

**Given** a sprint transitions from `planning` to `active`
**When** the sprint is activated
**Then** only one sprint can be `active` at a time
**And** the previous active sprint (if any) must be `closed` first

**Technical notes:**
- Sprint files live in `{implementation_artifacts}/sprints/` directory
- Sprint ID format: `sprint-{number}` (kebab-case)
- Rework the existing add-sprint workflow (Story 12.1) to write this YAML format instead of the old format

### Story 17.2: Flat Backlog Model

As a **Scrum Master**,
I want a flat backlog file listing all stories and bugs in priority order, independent of their parent epic,
So that sprint planning works from a single prioritized list, not epic-grouped sections.

**Acceptance Criteria:**

**Given** the backlog is generated from the epics document
**When** the backlog file is created at `{implementation_artifacts}/backlog.yaml`
**Then** it contains ALL stories and bugs as a flat ordered list:
```yaml
backlog:
  - id: "5-5-explicit-parameter-passing"
    type: story
    epic: 5
    title: "Explicit Parameter Passing"
    priority: 1
    status: backlog
  - id: "BUG-path-spaces"
    type: bug
    epic: null
    title: "Fix space-in-path bug"
    priority: 2
    status: backlog
    severity: high
```

**Given** a story is assigned to a sprint
**When** the backlog is viewed
**Then** the item shows `sprint: sprint-3` indicating its assignment
**And** it is still visible in the backlog (with sprint annotation) for reference

**Given** stories exist across multiple epics
**When** the backlog is ordered
**Then** ordering is by the `priority` field, not by epic number
**And** items from different epics can be interleaved based on priority

**Technical notes:**
- The backlog is the single source of truth for item priority
- Sprint-status.yaml continues to exist but is now derived from backlog + sprint files
- The `sprint-planning` workflow should regenerate the backlog from epics when run
- Items with status `done` are NOT included in the backlog (they're in the done archive)

### Story 17.3: Bug as Story Type

As a **Test Engineer**,
I want bugs to appear in the backlog alongside stories as a distinct type,
So that bugs are prioritized and assigned to sprints using the same workflow as stories.

**Acceptance Criteria:**

**Given** a bug is created via the bug-story workflow (Epic 11, FR61)
**When** the bug story file is created
**Then** it is added to the backlog with `type: bug`
**And** it includes bug-specific fields: `severity` (critical/high/medium/low), `version_found`, `bug_type`

**Given** bugs and stories coexist in the backlog
**When** the backlog is displayed or used for sprint planning
**Then** bugs are visually distinguished (type field) but sorted by the same priority field as stories
**And** a critical bug can be prioritized above any story

**Given** a bug follows the same lifecycle as a story
**When** the bug progresses through statuses
**Then** it uses the same flow: `backlog → ready-for-dev → in-progress → review → done`
**And** done bugs are archived the same way as done stories (FR130, FR131)

**Technical notes:**
- Bug story files follow the naming convention: `BUG-{kebab-case-title}.md`
- Bug entries in backlog.yaml have `type: bug` and `epic: null` (bugs don't belong to epics per FR64)
- The bug-story workflow (Epic 11) may need updating to write to the backlog file

### Story 17.4: Backlog-to-Sprint Workflow

As a **Scrum Master**,
I want a workflow to move items from the backlog into a sprint,
So that I can populate sprints by selecting prioritized items across epics.

**Acceptance Criteria:**

**Given** the backlog contains unassigned items (no `sprint` field)
**When** the Scrum Master invokes the assign-to-sprint workflow
**Then** it displays the active or planning sprint and its current capacity usage
**And** shows the top N unassigned backlog items in priority order
**And** the Scrum Master selects which items to add

**Given** the Scrum Master selects items for the sprint
**When** the items are assigned
**Then** each item's `sprint` field in backlog.yaml is set to the sprint ID
**And** the sprint file's `items` array is updated with the new IDs
**And** the workflow validates that capacity is not exceeded — warns if over capacity

**Given** the workflow is invoked via menu or slash command
**When** it executes
**Then** it works identically in both invocation modes (NFR19)

**Technical notes:**
- Reworks the existing add-to-sprint workflow (Story 12.2) to use the new backlog + sprint file model
- Must read backlog.yaml, filter unassigned items, present to user, update both backlog.yaml and sprint file

### Story 17.5: Sprint-to-Backlog Workflow

As a **Scrum Master**,
I want a workflow to move items from a sprint back to the backlog,
So that I can adjust sprint scope when priorities change without losing the item.

**Acceptance Criteria:**

**Given** a sprint has assigned items
**When** the Scrum Master invokes the remove-from-sprint workflow
**Then** it displays the sprint's currently assigned items
**And** the Scrum Master selects which items to remove

**Given** items are removed from the sprint
**When** the removal completes
**Then** the item's `sprint` field in backlog.yaml is cleared
**And** the item is removed from the sprint file's `items` array
**And** the item's status is NOT changed — it retains its current status (e.g., stays `ready-for-dev`)
**And** the item remains in the backlog at its current priority position

**Technical notes:**
- New workflow: `lib/bmad-extension/skills/remove-from-sprint/` (or update existing modify-sprint from Story 12.3)
- This is the inverse of Story 17.4

### Story 17.6: Done Item Cleanup

As a **Scrum Master**,
I want done stories and bugs automatically removed from the sprint status and their files moved to a done/ subfolder,
So that the active sprint view stays clean and the archive is organized.

**Acceptance Criteria:**

**Given** a story or bug status changes to `done`
**When** the sprint status is refreshed (via sprint-planning workflow or sprint-status workflow)
**Then** the done item is removed from sprint-status.yaml's `development_status` section
**And** the done item is removed from its sprint file's `items` array
**And** the sprint file's effective capacity increases by 1 (slot freed)

**Given** a story file exists at `{implementation_artifacts}/{story-id}.md`
**When** the story reaches `done` status
**Then** the file is moved to `{implementation_artifacts}/done/{story-id}.md`
**And** if the `done/` subfolder doesn't exist, it is created

**Given** a bug file exists at `{implementation_artifacts}/BUG-{title}.md`
**When** the bug reaches `done` status
**Then** the file is moved to `{implementation_artifacts}/done/BUG-{title}.md`

**Given** all items in a sprint reach `done` status
**When** the sprint is refreshed
**Then** the sprint status changes to `closed`
**And** the sprint file is preserved (historical record) but items array is empty

**Technical notes:**
- The `done/` subfolder already exists at `_bmad-output/implementation-artifacts/done/` — this story formalizes its use
- The sprint-planning and sprint-status workflows should trigger cleanup as part of their execution
- File move uses `fs.rename()` — not copy+delete
- The sprint-status.yaml `development_status` section should only show items that are NOT done

### Story 17.7: Multi-Criteria Prioritization Workflow

As a **Scrum Master**,
I want a workflow to reprioritize the backlog using multiple criteria,
So that sprint planning is based on business value, severity, and dependencies — not just epic order.

**Acceptance Criteria:**

**Given** the backlog contains stories and bugs
**When** the Scrum Master invokes the prioritize-backlog workflow
**Then** it presents each item with its current priority and metadata (type, epic, severity for bugs, dependencies)
**And** the Scrum Master can reorder items using criteria: severity, business value, dependencies, item type, age

**Given** the Scrum Master reorders items
**When** the new priority order is confirmed
**Then** backlog.yaml is updated with new `priority` values (sequential integers starting from 1)
**And** the reordering is logged with date and reason

**Given** items have dependencies (e.g., Story 15.2 depends on 15.1)
**When** the Scrum Master tries to prioritize the dependent item above its dependency
**Then** the workflow warns about the dependency conflict
**And** allows the Scrum Master to override or adjust

**Technical notes:**
- New workflow: `lib/bmad-extension/skills/prioritize-backlog/`
- The workflow should support both full reprioritization and quick adjustments (move single item up/down)
- Dependencies can be inferred from epic story ordering or explicitly stated in story files

### Story 17.8: Rework Sprint Status Display

As a **Project Manager**,
I want sprint status to show real sprint definitions with their assigned items and capacity usage,
So that I can see at a glance what's in each sprint and how much capacity remains.

**Acceptance Criteria:**

**Given** the sprint-status workflow is invoked
**When** the status is displayed
**Then** it shows:
```
Sprint 3 (active) — 4/6 items
  ● 5-5-explicit-parameter-passing [story] — in-progress
  ● 5-6-fix-space-in-path-bug [story] — backlog
  ○ BUG-path-spaces [bug, high] — ready-for-dev
  ● 15-1-bump-bmad-method [story] — backlog

Backlog — 12 unassigned items
  1. 15-2-restructure-extension-module [story]
  2. 15-3-convert-custom-agents [story]
  ...
```

**Given** done items have been cleaned up (Story 17.6)
**When** the sprint status is viewed
**Then** done items do NOT appear in the sprint or backlog sections
**And** a summary line shows: "X items completed this sprint"

**Given** the sprint-status.yaml file is generated
**When** it is written
**Then** it only contains non-done items in `development_status`
**And** sprint metadata is included in the header comments

**Technical notes:**
- Reworks the existing sprint-status workflow and the sprint-status-template.yaml
- The display format should work well for both human reading and LLM parsing
- sprint-status.yaml becomes a derived file: generated from backlog.yaml + sprint files
