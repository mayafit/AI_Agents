---
stepsCompleted: [1, 2, 3, 4, 'phase2-step-01', 'phase2-step-02', 'phase2-step-03', 'phase2-step-04']
workflowStatus: 'complete'
completedDate: '2026-03-08'
lastEdited: '2026-03-19'
phase2EditHistory:
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

### Cross-Epic Coordination: `bmad.js`

Three epics modify `bmad.js`. Implementation order matters:
1. **Epic 5** (Bundled BMAD) — changes invocation from `npx bmad-method` to vendored `node <resolved-path>`, adds cache pre-population before install
2. **Epic 6** (Methodology Onboarding) — adds methodology deployment step
3. **Epic 8** (Skill Enforcement) — adds extension module deployment

Stories in Epics 6 and 8 that touch `bmad.js` must build on Epic 5's vendored invocation pattern.

### Development Execution Order

1. **Epic 5** (Bundled BMAD Installation) — foundational, enables deterministic installation
2. **Epic 9** (OpenCode Agent) — independent, can parallel with Epic 5
3. **Epic 10** (Project Knowledge) — simple, no conflicts, can parallel
4. **Epic 8** (Skill Enforcement) — touches `bmad.js`, must follow Epic 5
5. **Epics 11, 12** (Bug/Sprint Management) — depend on Epic 8's extension module
6. **Epics 1-4, 6-7** (Phase 1 remaining) — can run in parallel throughout, Epic 6 coordinates with Epic 5 on `bmad.js`

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
