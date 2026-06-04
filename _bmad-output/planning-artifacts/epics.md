---
stepsCompleted: [1, 2, 3, 4, 'phase2-step-01', 'phase2-step-02', 'phase2-step-03', 'phase2-step-04']
workflowStatus: 'complete'
completedDate: '2026-03-08'
lastEdited: '2026-04-07'
phase5EditHistory:
  - date: '2026-05-01'
    changes: 'Added Epic 25: BMAD v6.6.0 Integration (Phase 5). 2 stories (25.1-25.2): buildBmadArgs guard for --tools none breaking change, and bmad-method version bump + cache rebuild.'
phase4EditHistory:
  - date: '2026-04-13'
    changes: 'Added Epic 22: BMAD v6.3.0 Plugin Migration (Phase 4). 10 stories (22.1–22.10) covering version bump + cache rebuild, skill namespace rename sweep, legacy skill retirement (bmad-init/Quinn/Bob/Barry), build-plugin script, .claude-plugin/marketplace.json + skills/module.yaml, lib/bmad.js stage-and-invoke replacement, config path migration to _bmad/bmm/config.yaml, gitignore stage dir, CI offline install gate, multi-tool smoke verification. Added Epic 23: Memory-Agent Conversion for Demerzel and Gad (Phase 4 — deferred follow-up). 2 stories (23.1, 23.2). Added FR182–FR195 and NFR50–NFR54 to Requirements Inventory and FR Coverage Map. Updated Epic List and Development Execution Order.'
phase3EditHistory:
  - date: '2026-04-14'
    changes: 'Added Story 21.11: Profile Uninstall. Adds `ma-agents uninstall --profile-artifacts` to remove ma-agents-owned profile content while preserving user content and audit trails. Adds FR181 and NFR49. Closes adversarial-review Finding #17 (no uninstall / rollback). Execution order: 21.11 runs after 21.10 (both depend on full profile-dependent stamping from 21.6).'
  - date: '2026-04-14'
    changes: 'Added Story 21.10: Profile Reconfigure. Adds `ma-agents reconfigure` subcommand to change a previously-persisted profile and re-stamp all profile-dependent artifacts. Adds FR180 and NFR48. Closes adversarial-review Findings #5 (CI-default silent-downgrade) and #7 (no escape hatch once persisted). Execution order updated: 21.10 runs after 21.6 (depends on profile-dependent artifacts being layered first).'
  - date: '2026-04-13'
    changes: 'Added Epic 21: On-Prem / Local-LLM Tuning (Phase 3). 9 stories (21.1-21.9): install-time profile prompt + persistence, universal per-tool guardrail expansion, .roomodes template with BMAD-mode file-regex restrictions, expanded AGENTS.md (OpenCode), expanded .clinerules, on-prem layered guardrails, BMAD persona phase-aware prompt prefixes, vLLM reference deployment doc. Added FR172-FR179 and NFR44-NFR47 to Requirements Inventory and FR Coverage Map. Architecture Decision P3-3 covers design.'
  - date: '2026-04-07'
    changes: 'Added Epic 19: BMAD Knowledge Graph (Phase 3). 7 stories (19.1-19.7): core emitToGraph() library, graph emission for 7 BMAD skills (create-prd, create-architecture, create-epics-and-stories, create-story, validate-prd, dev-story, bmad-sprint-planning), open-graph skill with VSCode/browser detection, and interactive HTML renderer. Added FR141-FR157 to Requirements Inventory and FR Coverage Map. Added NFR38-NFR41. Updated Epic List and Development Execution Order. Fixed duplicate FR141 entry in Epic 17 coverage map (was remove-from-sprint, correctly FR129). Updated Roo Code Epic 18 proposed FRs to FR156-FR159 to avoid conflict with new Knowledge Graph FRs.'
phase2EditHistory:
  - date: '2026-04-03'
    changes: 'Major rework of Epic 17: Sprint Management Model Rework. Replaced 3-file model (backlog.yaml, sprints/sprint-N.yaml, sprint-status.yaml) with unified single sprint-status.yaml approach. Stories rewritten: 17.9 (unified schema), 17.10 (generate-backlog rework), 17.11 (add-to-sprint movement semantics), 17.12 (remove-from-sprint movement semantics), 17.13 (sprint-status-view single-source read), 17.14 (cleanup-done single-source), 17.15 (bmad-sprint-planning bootstrap), 17.16 (add-sprint section-based), 17.17 (modify-sprint section-based), 17.18 (bmad-dev-story cross-section update), 17.19 (story-status-lookup cross-section search), 17.20 (bmad-sprint-status structured sections), 17.21 (close-sprint new skill), 17.22 (Jira adapter pattern), 17.23 (migration/deprecation of old files). Added FR133-FR140. Updated FR Coverage Map. Updated Epic 17 description in Epic List. Updated Development Execution Order.'
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

### Functional Requirements (Phase 2 — added 2026-04-03)

#### Unified Sprint-Status Management (FR133-FR140)
- FR133: Sprint management uses a single unified `sprint-status.yaml` with three sections: `epics` (reference), `backlog` (unassigned items), and `sprints` (sprint definitions with assigned items)
- FR134: Stories and bugs MOVE between the `backlog` and `sprints` sections — an item exists in exactly one location at any time
- FR135: Each item carries its own `status` field, updated in-place within the section where it resides
- FR136: Items reaching `done` status are removed from `sprint-status.yaml` and archived to `done/` folder
- FR137: A close-sprint workflow transitions a sprint from `active` to `closed`, archiving all done items and returning incomplete items to backlog
- FR138: When `tracking_system` is configured as `jira`, sprint management skills perform operations against Jira using whatever Jira-capable tool the agent has available; on failure the skill asks the user to retry or switch to file management
- FR139: The unified schema replaces the previous three-file model (`backlog.yaml`, `sprints/sprint-N.yaml`, `sprint-status.yaml`) — deprecated files are migrated or removed
- FR140: All 12 sprint-related skills are reworked to operate against the single unified file

### Functional Requirements (Phase 3 — added 2026-04-07)

#### BMAD Knowledge Graph (FR141-FR157)
- FR141: Each node in the knowledge graph is identified by `file-id#heading-anchor` where `file-id` is a short stable key that resolves to a file pointer via the `files` table
- FR142: Each directed edge carries full provenance: `from` (node id), `to` (node id), `type` (edge type), `label` (human description), `created_by` (user), `agent` (AI agent identity), `created_at` (ISO timestamp); edge types include `implements`, `derives-from`, `validates`, `traces-to`, `refines`, `informed-by`
- FR143: The graph maintains a bidirectional index — for each node, the system can resolve both inbound (nodes that reference it) and outbound (nodes it references) edges in O(1) time
- FR144: The knowledge graph JSON file uses a flat four-section structure: `meta` (file statistics), `files` (file registry), `nodes` (node list), `edges` (edge list) — maximum two levels of nesting throughout
- FR145: The `files` section maps each `file-id` to an object with `pointer` (the file reference), `title` (display name), and `pointer_type` (one of: `relative_path`, `absolute_path`, `url`) — enabling nodes in the same graph to address local files, files in other repos, and external URLs (Confluence, Jira, etc.) uniformly
- FR146: Each node object carries: `id` (`file-id#anchor`), `file` (the `file-id` from the files table), `anchor` (the heading slug), `title` (human-readable heading text), `type` (document type: `prd`, `architecture`, `epic`, `story`, `decision`, `validation`)
- FR147: Each edge object carries: `from`, `to`, `type`, `label`, `created_by`, `agent`, `created_at` — all fields required, no optional fields
- FR148: The `meta` section carries: `schema_version`, `generated_at`, `project`, `file_count`, `node_count`, `edge_count`
- FR149: BMAD skills emit nodes and edges automatically on artifact completion — no user prompt, no opt-in — as a silent post-artifact step
- FR150: When emitting, if a file is not yet in the `files` table, it is registered automatically; external URLs (e.g., Confluence page) are registered with `pointer_type: url`
- FR151: Any node may derive from multiple source documents simultaneously — a story AC can carry `informed-by` edges from both the architecture and a UX design doc, not just from its parent epic
- FR152: The emit operation is additive-only: new nodes and edges are appended; existing nodes and edges are never deleted or overwritten; duplicate detection uses the full `(from, to, type)` triple for edges and `id` for nodes
- FR153: The `open-graph` skill detects the execution environment (VSCode vs. terminal) and opens `knowledge-graph.html` via the appropriate mechanism — VSCode webview API when inside VSCode, `open`/`start` shell command otherwise
- FR154: The visualization renders nodes as color-coded circles by document type and supports click-to-navigate (opens the source document at the specific heading anchor in the IDE or browser)
- FR155: Hovering over an edge displays a tooltip with the full provenance record: type, label, created_by, agent, created_at
- FR156: The visualization provides interactive filtering by node type and edge type, and highlights the immediate neighbors of any selected node
- FR157: The visualization has no external CDN, font, or script dependencies — all rendering code and graph data are self-contained in a single HTML file suitable for air-gapped environments

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

### NonFunctional Requirements (Phase 3 — added 2026-04-07)

- NFR38: The `open-graph` skill must render the knowledge graph visualization within 3 seconds for graphs up to 500 nodes and 1000 edges, measured from skill invocation to first interactive frame
- NFR39: The knowledge graph JSON format must be writable by any LLM without external schema — structure is self-describing; an LLM can add a new node or edge by copying an existing pattern with no external reference
- NFR40: The `emitToGraph()` operation must never delete or overwrite existing graph data — additive-only semantics are enforced at the function level, verified by the absence of delete/overwrite operations during emission
- NFR41: The knowledge graph visualization (`knowledge-graph.html`) must function fully without network access — verified by disabling network access and confirming the graph renders identically

### Functional Requirements (Phase 3 — added 2026-04-13)

#### Local-LLM / On-Prem Agent Tuning (FR172-FR179)
- FR172: Install-time profile prompt (on-prem vs standard) persisted as `"profile"` in `.ma-agents.json`
- FR173: `--yes` defaults to `standard` for CI/CD; on-prem CI/CD served by committing `.ma-agents.json` with persisted profile — no per-invocation CLI flag
- FR174: Universal per-tool guardrail templates shipped to all profiles — expanded `CLAUDE.md`/`.clinerules`/`.roo/rules/` injection, expanded `AGENTS.md` for OpenCode, new `.roomodes` for Roo Code with 4 BMAD modes
- FR175: `.roomodes` template restricts file edit access by BMAD phase via `fileRegex` (planning modes can only edit `.md`); enforced by Roo Code's `FileRestrictionError` at the application layer
- FR176: Per-tool template stamping is additive — merges via `<!-- MA-AGENTS-START -->` markers; preserves user content outside markers; `.roomodes` preserves non-conflicting user `customModes`
- FR177: When profile=on-prem, layered local-LLM guardrails are added — no-home-dir-writes, no `str_replace_editor`, `/no_think` planning prefix, reasoning-mode/sampling guidance
- FR178: When profile=on-prem, BMAD agent persona customizations gain a phase-aware system-prompt prefix (planning agents reasoning-OFF, implementation agents reasoning-ON); not applied when profile=standard
- FR179: Reference deployment doc `docs/deployment/vllm-nemotron.md` ships in the repo (vLLM flags, tool-call-parser, max-model-len, quantization, per-phase sampling) — documentation only, installer does not manage the inference server

### NonFunctional Requirements (Phase 3 — added 2026-04-13)

- NFR44: On-prem profile guardrails must not regress standard profile — when profile=standard, no on-prem-specific instructions appear in any generated file
- NFR45: Profile prompt is non-blocking in CI/CD — `--yes` defaults to `standard`; persisted answer not re-prompted on subsequent installs; on-prem CI/CD served via committed `.ma-agents.json`, not a flag
- NFR46: Per-tool template stamping is idempotent — re-running install with the same profile produces byte-identical content within marker blocks
- NFR47: BMAD planning-mode file restrictions in `.roomodes` enforced at the application layer (Roo Code `FileRestrictionError`), verified by attempting a code-file edit in `bmad-architect` mode and confirming rejection

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
| FR129 | Epic 17 | Move items from sprint back to backlog (remove-from-sprint skill) |
| FR130 | Epic 17 | Done items removed from sprint status file |
| FR131 | Epic 17 | Done story files moved to done/ subfolder |
| FR132 | Epic 17 | Sprints as first-class YAML entities |
| FR133 | Epic 17 | Unified sprint-status.yaml with three sections |
| FR134 | Epic 17 | Movement semantics — items move between backlog and sprint sections |
| FR135 | Epic 17 | In-place status updates on each item |
| FR136 | Epic 17 | Done items removed from file, archived to done/ |
| FR137 | Epic 17 | Close-sprint workflow for sprint lifecycle closure |
| FR138 | Epic 17 | generate-backlog skill regenerates backlog section from epics/bugs, preserving sprint-assigned items |
| FR139 | Epic 17 / Epic 16 | Install-time backend selection: wizard adds Jira as 4th option; stores jira_url + jira_project_key in config |
| FR140 | Epic 17 / Epic 14 | Tool-agnostic Jira operations for all 13 sprint skills; interactive retry/switch error handling on failure |
| FR141 | Epic 19 | Graph node identity: file-id#heading-anchor |
| FR142 | Epic 19 | Directed typed edges with full provenance (6 edge types) |
| FR143 | Epic 19 | Bidirectional index per node |
| FR144 | Epic 19 | Flat four-section JSON structure (meta/files/nodes/edges) |
| FR145 | Epic 19 | Files table with pointer_type (relative_path, absolute_path, url) |
| FR146 | Epic 19 | Node schema (id, file, anchor, title, type) |
| FR147 | Epic 19 | Edge schema (from, to, type, label, created_by, agent, created_at) |
| FR148 | Epic 19 | Meta schema (schema_version, generated_at, project, counts) |
| FR149 | Epic 19 | Automatic silent emission on artifact completion (7 BMAD skills) |
| FR150 | Epic 19 | Auto-registration of new files; external URL support |
| FR151 | Epic 19 | Non-hierarchical multi-source emission (any-to-any informed-by edges) |
| FR152 | Epic 19 | Additive-only emit; duplicate detection by (from,to,type) for edges and id for nodes |
| FR153 | Epic 19 | open-graph skill with VSCode/browser detection |
| FR154 | Epic 19 | Interactive visualization: color-coded nodes by type, click-to-navigate |
| FR155 | Epic 19 | Edge tooltip with full provenance record |
| FR156 | Epic 19 | Interactive filtering by node/edge type; neighbor highlight |
| FR157 | Epic 19 | No external dependencies — fully self-contained HTML (air-gap compatible) |
| FR158 | Epic 18 | Roo Code custom modes from BMAD agents (proposed — pending PRD addition) |
| FR159 | Epic 18 | Roo Code rules from BMAD instructions (proposed — pending PRD addition) |
| FR160 | Epic 18 | Roo Code slash commands from BMAD workflows (proposed — pending PRD addition) |
| FR161 | Epic 18 | Cline-to-Roo Code migration (proposed — pending PRD addition) |
| FR172 | Epic 21 | Install-time profile prompt + persistence in `.ma-agents.json` |
| FR173 | Epic 21 | `--yes` defaults to standard; on-prem CI/CD via committed `.ma-agents.json` (no CLI flag) |
| FR174 | Epic 21 | Universal per-tool guardrail templates (all profiles) |
| FR175 | Epic 21 | `.roomodes` BMAD-mode `fileRegex` restrictions enforced by Roo Code |
| FR176 | Epic 21 | Additive marker-based stamping; `.roomodes` slug-isolation |
| FR177 | Epic 21 | On-prem layered guardrails (`/no_think`, no-home-dir-writes, no `str_replace_editor`) |
| FR178 | Epic 21 | BMAD persona phase-aware system-prompt prefix (on-prem only) |
| FR179 | Epic 21 | vLLM reference deployment doc — documentation only |
| FR180 | Epic 21 | `ma-agents reconfigure` subcommand — re-runs profile prompt and re-stamps all profile-dependent artifacts. Closes no-escape-hatch gap. |
| FR181 | Epic 21 | `ma-agents uninstall --profile-artifacts` — removes ma-agents-owned profile content, preserves user content and audit trails. Closes no-uninstall gap. |

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

### Epic 12: Realistic Sprint Management (Phase 2) **[SUPERSEDED by Epic 17]**
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
Sprint management is redesigned around a **single unified `sprint-status.yaml`** file with three sections: `epics` (reference), `backlog` (unassigned items), and `sprints` (sprint definitions with assigned items). Stories and bugs MOVE between sections using movement semantics. Each item carries its own status, updated in-place. Done items are removed from the file and archived. A new close-sprint skill handles sprint lifecycle closure. A Jira adapter pattern enables the same data model to read/write from Jira API when `tracking_system` is configured as `jira`. All 12 sprint-related skills are reworked for the unified file, and the deprecated 3-file model is migrated/removed.
**FRs covered:** FR65, FR66, FR67, FR128, FR129, FR130, FR131, FR132, FR133, FR134, FR135, FR136, FR137, FR138, FR139, FR140 (plus rework of FR68-FR71 workflows to work with new model)
**NFRs addressed:** NFR19 (menu + slash command invocation)
**Dependencies:** Epic 11 (bug entity structure). Reworks Epic 12's workflow shells to use the new model. Story 17.22 is NOT blocked on Epic 14 — it embeds the Phase A placeholder routing structure; Epic 14 Story 14.3 is blocked on Story 17.22 (needs the routing structure already present in all 13 skills before it can fill in the Jira operation body).
**Note:** Epic 12 delivered workflow files but not the underlying sprint data model. This epic builds the unified model, rewires all workflows, and embeds the MCP detection stub (Section 4.1-A of `mcp-detection-pattern-spec.md`) in all 13 sprint skills.
**Skills affected:** Heavy rework (6): generate-backlog, add-to-sprint, remove-from-sprint, sprint-status-view, cleanup-done, bmad-sprint-planning. Moderate rework (3): add-sprint, modify-sprint, bmad-dev-story. Light rework (3): story-status-lookup, bmad-sprint-status, prioritize-backlog. New skill (1): close-sprint.

### Epic 21: On-Prem / Local-LLM Tuning (Phase 3)
The primary deployment scenario for ma-agents — air-gapped enterprise networks running local non-Claude LLMs (e.g., Nemotron Super 49B) — is made first-class. An install-time profile prompt (on-prem vs standard) drives a two-layer tuning model: (1) **universal** per-tool guardrail templates shipped to every install (`.roomodes` with BMAD-mode `fileRegex` restrictions, expanded `AGENTS.md`/`.clinerules`/`CLAUDE.md` injection enforcing text-vs-file discipline and BMAD phase boundaries), and (2) **on-prem-only** layered guardrails (`/no_think` planning prefix, no-home-dir-writes, no `str_replace_editor`, BMAD persona phase-aware prompt prefixes). A reference vLLM deployment doc ships under `docs/deployment/`. Implements the field-validated playbook from `optimizing-local-llm-coding-agents-bmad.md`.
**FRs covered:** FR172, FR173, FR174, FR175, FR176, FR177, FR178, FR179, FR180, FR181
**NFRs addressed:** NFR44 (profile isolation), NFR45 (CI/CD compatibility), NFR46 (idempotency), NFR47 (application-layer phase enforcement), NFR48 (profile-history audit trail), NFR49 (content removal preservation contract)
**Architecture:** Decision P3-3 (Local-LLM / On-Prem Agent Tuning Profile) in `_bmad-output/planning-artifacts/architecture.md`
**Dependencies:** Epic 9 (OpenCode JSON-merge injection — reused for AGENTS.md). Epic 18 (Roo Code agent registration — `.roomodes` ships into `.roo/`). Epic 15 (BMAD 6.2.1 module restructure — phase prefix integrates with customize-loader). Epic 13 (project-context generator — pattern reused for template stamping).
**New files:** `lib/profile.js`, `lib/templates/instruction-block-universal.template.md`, `lib/templates/instruction-block-onprem.template.md`, `lib/templates/roomodes.template.yaml`, `lib/templates/agents-md.template.md`, `lib/templates/clinerules.template.md`, `docs/deployment/vllm-nemotron.md`
**Files modified:** `bin/cli.js`, `lib/installer.js`, `lib/agents.js`, `lib/bmad-customize/*.customize.yaml` (additive phase prefix), customize-loader, README.md
**New tests:** `test/profile.test.js`, `test/onprem-injection.test.js`

### Epic 19: BMAD Knowledge Graph (Phase 3)
Every planning and implementation artifact generated by BMAD skills is automatically woven into a non-hierarchical knowledge graph stored as `_bmad-output/knowledge-graph.json`. Any-to-any directed relationships (not just parent-child traceability) are captured with full provenance. Engineers can open an interactive visualization of the entire project knowledge graph — navigating to any document at the specific heading where a concept is defined — via the `open-graph` skill.
**FRs covered:** FR141–FR157
**NFRs addressed:** NFR38 (render performance), NFR39 (LLM-writability), NFR40 (additive-only), NFR41 (air-gapped)
**Architecture:** Decision P3-1 (BMAD Knowledge Graph) in `_bmad-output/planning-artifacts/architecture.md`
**Dependencies:** Epic 15 (extension module structure) must be complete — `open-graph` skill deploys as a BMAD extension skill. Epic 17 complete (sprint skill structure settled before wiring emission).
**New skill:** `open-graph` (45th total skill) in `lib/bmad-extension/skills/open-graph/`
**Skills modified:** create-prd, create-architecture, create-epics-and-stories, create-story, validate-prd, dev-story, bmad-sprint-planning — each gains a silent `emitToGraph()` post-artifact call
**Output artifacts:** `_bmad-output/knowledge-graph.json` (graph data), `_bmad-output/knowledge-graph.html` (self-contained renderer)

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
3. **Epic 17** (Sprint Management Model Rework) — unified sprint-status.yaml, reworks Epic 12 workflows, depends on Epic 11. Story 17.22 ships the backend-routing structure in all 13 sprint skills — no Epic 14 dependency needed for the Phase A placeholder body. Epic 14 Story 14.3 later fills in the Jira operation instructions.
4. **Epic 16** (Multi-Repo Layout) — depends on Epic 15 module restructure. Stories 16.1 and 16.2 (wizard + config storage, enhanced with Jira option) should ship with Epic 17.
5. **Epics 4, 7** (VS Integration, Test Suite) — on hold, can resume in parallel
6. **Epic 14** (Jira Backend Integration) — Phase 3; extends what Story 17.22 stubbed. Execution: 14.1 (define Jira operation descriptions) → 14.3 (fill in Jira operation branch in all 13 skills) → 14.4 (error message guidance). Story 14.2 (Confluence) deferred until PRD defines `knowledge_backend` field.

**Phase D — Phase 3 Features:**
7. **Epic 19** (BMAD Knowledge Graph) — depends on Epic 15 (extension module structure) and Epic 17 (sprint skill structure settled). Story execution order: 19.1 (core library) → 19.2 (PRD emission) → 19.3 (architecture + epics emission) → 19.4 (story + remaining emission) → 19.5 (open-graph skill) → 19.6 (visualization renderer) → 19.7 (LLM contract validation + tests). Stories 19.2-19.4 can proceed in parallel once 19.1 is done.
8. **Epic 18** (Roo Code IDE Support) — no dependencies, can proceed independently at any point in Phase C or D.
9. **Epic 21** (On-Prem / Local-LLM Tuning) — depends on Epics 9, 13, 15, 18 (OpenCode JSON-merge, project-context template stamping pattern, customize-loader, Roo Code agent registration). Story execution: 21.1 (profile prompt + persistence) → 21.2 (universal instruction-block expansion) → 21.3 (`.roomodes` template + Roo Code stamping) + 21.4 (`AGENTS.md` template + OpenCode merge) + 21.5 (`.clinerules` template extension) — these three can run in parallel after 21.2 → 21.6 (on-prem layered guardrails) → 21.7 (BMAD persona phase prefix) → 21.8 (vLLM reference doc + README on-prem section) → 21.9 (tests + validation).

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

## Epic 12: Realistic Sprint Management (Phase 2) **[SUPERSEDED by Epic 17]**

> **DEPRECATION NOTICE:** Epic 12 delivered workflow shell files but NOT the underlying sprint data model. Epic 17 (Sprint Management Model Rework) builds the unified `sprint-status.yaml` model and rewires all workflows. All FR65-FR71 functionality is now delivered through Epic 17's reworked stories. Epic 12 stories below are retained for historical context only — do not implement them.

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

## Epic 14: Jira Backend Integration for Sprint Skills (Phase 3)

**Goal:** When teams select Jira as the sprint management backend (at install time or via config), all 13 sprint management skills perform their operations against Jira. Skills use whatever Jira-capable tool the agent has available. On failure, the skill asks the user to retry or switch to file management — the user's choice is persisted to config.
**FRs covered:** FR139, FR140 (revised 2026-04-29)
**Dependency:** Story 17.22 must ship first — it provides the backend-routing structure that Story 14.3 fills in with Jira operation logic. Story 14.1 must complete before Story 14.3. Story 14.2 (Confluence) is deferred — it requires a new PRD FR defining the `knowledge_backend` field before any implementation work can be scoped.
**Phase:** 3 — starts after Epic 17 Story 17.22 ships. Execution order: 14.1 → 14.3 (blocked on 14.1 + 17.22) → 14.4 (after 14.3). Story 14.2 is out-of-scope until PRD is updated.

---

### Story 14.1: Define Jira Operation Descriptions for Sprint Skills

As a **Project Manager / Analyst**,
I want a documented mapping from sprint management operations to clear natural-language Jira operation descriptions,
So that Story 14.3 can write skill instructions that correctly direct the agent to perform the right Jira action regardless of which Jira tool is available.

**Acceptance Criteria:**

**Given** the 13 sprint management skills and their file-system operations
**When** the analyst reviews each skill
**Then** they document, for each skill, the equivalent Jira operation in natural language (e.g., "create a Jira story in project {project_key}, linked to epic {epic_key}, with summary and description from the backlog item")
**And** the documentation covers all Jira issue types in scope: stories, epics, bugs, sprints

**Given** the operation descriptions are complete
**When** the mapping is reviewed
**Then** every sprint skill operation has a Jira equivalent description, or a documented "no direct Jira equivalent" note with a recommended workaround
**And** the Jira field mapping (sprint-status schema → Jira fields) is documented for each operation
**And** any operations involving bulk data (e.g., `generate-backlog`, `bmad-sprint-planning`) have documented partial-failure handling notes

**Given** the mapping is approved
**When** Story 14.3 begins
**Then** it uses this mapping as its primary input to write the Jira operation instructions in all 13 skill SKILL.md files

**Technical notes:**
- Output artifact: updated Section 6.2 of `_bmad-output/planning-artifacts/mcp-detection-pattern-spec.md`
- This story runs AFTER Epic 17 Story 17.22 ships
- This story does NOT modify any skill files — that is Story 14.3's job
- Operation descriptions must be tool-agnostic — no specific MCP server names or tool call syntax

---

### Story 14.2: Confluence MCP Integration — DEFERRED (out of scope)

*(Deferred pending PRD update. Confluence integration requires a new capability area and new PRD FRs defining:*
- *the `knowledge_backend` configuration field (which file it lives in, valid values, schema)*
- *which BMAD skills would read/write from Confluence vs local files*
- *whether integration is read-only, write-only, or bidirectional*

*Until those FRs are written and approved, no story can be scoped. This story is a placeholder — do not begin work on it.)*

---

### Story 14.3: Implement Jira Operation Branch in All 13 Sprint Skills

As a **Developer**,
I want each sprint management skill's SKILL.md to include clear Jira operation instructions for its operations,
So that when `tracking_system: jira` is active, the agent performs the correct Jira action using whatever Jira-capable tool it has available.

**Acceptance Criteria:**

**Given** the operation descriptions from Story 14.1
**When** the Jira branch is activated in a sprint skill
**Then** the skill instructs the agent to perform the required Jira operation in natural language (create issue, move issue to sprint, update status, query sprint items, etc.)
**And** the data model mapping (Jira Sprint → `sprints[]`, Jira Backlog → `backlog[]`, Jira Epic → `epics[]`, Jira status → canonical status vocabulary) is applied consistently across all skills

**Given** the Jira operation succeeds
**When** the skill processes the response
**Then** it maps the result back to the canonical sprint-status schema format and presents it in the standard BMAD format

**Given** the Jira operation fails (any error — tool unavailable, network error, API error)
**When** the failure occurs
**Then** the skill pauses and presents the user with: (a) Retry — attempt the Jira operation again, or (b) Switch to file management — update `tracking_system: file-system` in `sprint-status.yaml` and `sprint_backend` in `_bmad/bmm/config.yaml`, then complete the operation using the local file. The switch is permanent.

**Technical notes:**
- Blocked on Story 14.1 (Jira operation descriptions) AND Story 17.22 (backend-routing structure must already be in all 13 skills)
- Output: updated SKILL.md files for all 13 sprint skills — the `jira` branch body is filled in with skill-specific Jira operation instructions from the Story 14.1 mapping
- The file-system branch and all skill business logic are unchanged
- Operation instructions must remain tool-agnostic — no specific MCP server or tool names

---

### Story 14.4: Jira Onboarding Guidance — Error Messages and Setup Instructions

As a **Developer / User**,
I want the Jira failure message to give actionable guidance,
So that users know what to configure in their agent when a Jira operation cannot be completed.

**Acceptance Criteria:**

**Given** a Jira operation fails because no Jira-capable tool is available
**When** the skill presents the retry/switch prompt
**Then** the message includes guidance: the agent needs a Jira integration configured (MCP server, plugin, or native integration connected to the Jira instance configured at install time)

**Given** a Jira operation fails due to an API error (tool available but request failed)
**When** the skill presents the retry/switch prompt
**Then** the message includes the Jira error details so the user can diagnose the issue

**Given** the error messages in `mcp-detection-pattern-spec.md` Section 4.1-B
**When** this story is complete
**Then** the messages are updated with actionable guidance appropriate to each error type

**Technical notes:**
- Blocked on Story 14.3 — error messages are updated in the same 13 SKILL.md files after Story 14.3 completes. Output: updated error message text in `mcp-detection-pattern-spec.md` Section 4.1-B, and corresponding update to the 13 skill SKILL.md files (error message text only)
- Messages must remain tool-agnostic — refer to "a Jira-capable tool" rather than any specific MCP server or integration name

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
**And** it asks: "Where is your sprint management managed?" with options: Current repository (default), Local path, Remote git repository, Jira

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

**Given** the user selects "Jira" for sprint management
**When** prompted for Jira details
**Then** the wizard asks for the Jira server URL (e.g., `https://mycompany.atlassian.net`)
**And** asks for the Jira project key (e.g., `MYPROJ`)

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
- "Jira" is a fourth sprint management option alongside the existing three; knowledgebase does not get this option

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

**Given** the user selected "Jira" for sprint management with URL `https://mycompany.atlassian.net` and project key `MYPROJ`
**When** the installation completes
**Then** `_bmad/bmm/config.yaml` contains:
```yaml
sprint_backend: jira
jira_url: "https://mycompany.atlassian.net"
jira_project_key: "MYPROJ"
```
**And** `sprint_management_path` is not set in `_bmad/core/config.yaml` (no local path applies)
**And** Phase A sprint skills default to `_bmad-output/implementation-artifacts/sprint-status.yaml` relative to the project root, creating the file at that path if it does not exist

**Given** multi-repo mode is configured (file-system sprint management at external path)
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

**Given** Jira is selected for sprint management
**When** the installation completes
**Then** `_bmad-output/project-layout.yaml` contains:
```yaml
sprint_management:
  mode: jira
  jira_url: "https://mycompany.atlassian.net"
  jira_project_key: "MYPROJ"
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

Sprint management is redesigned around a **single unified `sprint-status.yaml`** file that replaces the previous three-file model (`backlog.yaml`, `sprints/sprint-N.yaml`, `sprint-status.yaml`). The unified file has three sections: `epics` (reference data from epics.md), `backlog` (unassigned items in priority order), and `sprints` (sprint definitions with their assigned items inline). Stories and bugs MOVE between the `backlog` and `sprints` sections — an item exists in exactly one location at any time. Each item carries its own `status` field, updated in-place. Done items are removed from the file and archived to `done/`. A new close-sprint skill handles sprint lifecycle closure. When `tracking_system` is `jira`, the same data model reads/writes from Jira API via an adapter pattern. All 12 sprint-related skills are reworked to operate against this single file. Epic 12 delivered workflow shells — this epic rebuilds the underlying model and rewires everything.

**Execution order:** 17.9 (schema) → 17.15 (bootstrap) → 17.10 (generate-backlog) → 17.16 (add-sprint) → 17.11 (add-to-sprint) → 17.12 (remove-from-sprint) → 17.13 (sprint-status-view) → 17.14 (cleanup-done) → 17.17 (modify-sprint) → 17.18 (bmad-dev-story) → 17.19 (story-status-lookup) → 17.20 (bmad-sprint-status) → 17.24 (prioritize-backlog rework) → 17.21 (close-sprint) → 17.22 (Jira adapter) → 17.23 (migration)

### Story 17.9: Unified sprint-status.yaml Schema

As a **Scrum Master**,
I want all sprint management data consolidated into a single `sprint-status.yaml` file with three structured sections,
So that there is one source of truth for epics, backlog, and sprints — eliminating data duplication across multiple files.

**Acceptance Criteria:**

**Given** the unified schema is defined
**When** `sprint-status.yaml` is created or updated
**Then** it contains exactly three top-level sections:
```yaml
epics:
  epic-5:
    status: in-progress
    retrospective: null
  epic-17:
    status: planning
    retrospective: null

backlog:
  - id: "15-2-restructure-extension-module"
    type: story
    epic: 15
    title: "Restructure Extension Module"
    priority: 1
    status: ready-for-dev
  - id: "BUG-path-spaces"
    type: bug
    epic: null
    title: "Fix space-in-path bug"
    priority: 2
    status: backlog
    severity: high

sprints:
  - id: sprint-3
    name: "Sprint 3"
    status: active        # planning | active | closed
    capacity: 6           # max items (stories + bugs)
    start: "2026-04-01"
    end: "2026-04-14"
    items:
      - id: "5-5-explicit-parameter-passing"
        type: story
        epic: 5
        title: "Explicit Parameter Passing"
        status: in-progress
      - id: "5-6-fix-space-in-path-bug"
        type: story
        epic: 5
        title: "Fix Space-in-Path Bug"
        status: review
```

**Given** an item is in the `backlog` section
**When** it is assigned to a sprint
**Then** it is REMOVED from `backlog` and ADDED to the target sprint's `items` array (FR134 — movement semantics)
**And** the item exists in exactly one location at any time

**Given** an item's status changes (e.g., `ready-for-dev` to `in-progress`)
**When** the status is updated
**Then** the `status` field is updated in-place on the item, wherever it currently resides (FR135)

**Given** an item reaches `done` status
**When** cleanup runs
**Then** the item is REMOVED from `sprint-status.yaml` entirely (FR136)
**And** archived to the `done/` folder

**Given** a sprint transitions from `planning` to `active`
**When** the sprint is activated
**Then** only one sprint can have `status: active` at a time
**And** the previous active sprint must be closed first

**Technical notes:**
- File location: `{sprint_management_path}/sprint-status.yaml` (resolves via config, defaults to `_bmad-output/implementation-artifacts/sprint-status.yaml`)
- The `epics` section is a MAP keyed by epic ID (e.g., `epic-5:`), with `status` and optional `retrospective` — derived data like title, story_count, done_count are computed from `backlog`/`sprints` sections at display time
- The `epics` section is reference data — regenerated from `epics.md` by the sprint-planning skill
- The `backlog` section contains ONLY items not assigned to any sprint
- The `sprints` section contains sprint definitions with their assigned items inline (no separate sprint files)
- Item schema: `id`, `type` (story|bug), `epic` (number|null), `title`, `status`, `priority` (in backlog only), plus optional `severity` for bugs
- Sprint schema: `id`, `name`, `status`, `capacity`, `start`, `end`, `items` array
- This replaces the old 3-file model: `backlog.yaml` (removed), `sprints/sprint-N.yaml` (removed), `sprint-status.yaml` (repurposed with new schema)

### Story 17.10: Rework generate-backlog Skill (Heavy Rework)

As a **Scrum Master**,
I want the `generate-backlog` skill to populate the `backlog` section of the unified `sprint-status.yaml`,
So that all unassigned stories and bugs are maintained in a single file rather than a separate `backlog.yaml`.

**Acceptance Criteria:**

**Given** the `generate-backlog` skill is invoked
**When** it parses the epics document
**Then** it writes all unassigned stories and bugs to the `backlog` section of `sprint-status.yaml` in priority order
**And** it updates the `epics` section with current epic metadata (title, status, story counts)
**And** it does NOT touch the `sprints` section — sprint-assigned items are preserved

**Given** items already exist in the `sprints` section of `sprint-status.yaml`
**When** the backlog is regenerated
**Then** items currently assigned to sprints are NOT duplicated in the `backlog` section
**And** new stories from `epics.md` that don't exist anywhere in `sprint-status.yaml` are added to `backlog`

**Given** a story exists in `backlog` but has been removed from `epics.md`
**When** the backlog is regenerated
**Then** the orphaned item is flagged with a warning but NOT automatically removed (human review required)

**Given** bugs exist as standalone story files (FR64)
**When** the backlog is regenerated
**Then** bugs are included in the `backlog` section with `type: bug` and `epic: null`
**And** bug-specific fields (`severity`, `version_found`, `bug_type`) are preserved

**Technical notes:**
- Reworks the existing `generate-backlog` skill to write to `sprint-status.yaml` `backlog` section instead of standalone `backlog.yaml`
- Must merge with existing `sprint-status.yaml` content (preserve `sprints` section)
- Priority ordering: bugs with `severity: critical` float to top, then by explicit `priority` field, then by epic order
- Items with status `done` are excluded (they live in `done/` archive)
- The old `backlog.yaml` file is no longer written (see Story 17.23 for migration)

### Story 17.11: Rework add-to-sprint Skill (Heavy Rework — Movement Semantics)

As a **Scrum Master**,
I want the `add-to-sprint` skill to MOVE items from the `backlog` section to a sprint's `items` array within the same file,
So that sprint assignment is a single-file atomic operation with movement semantics.

**Acceptance Criteria:**

**Given** the `backlog` section contains unassigned items
**When** the Scrum Master invokes `add-to-sprint`
**Then** it displays the target sprint (active or planning) and its current capacity usage (items.length / capacity)
**And** shows the top N unassigned items from the `backlog` section in priority order
**And** the Scrum Master selects which items to add

**Given** the Scrum Master selects items for the sprint
**When** the items are assigned
**Then** each selected item is REMOVED from the `backlog` array (FR134)
**And** ADDED to the target sprint's `items` array in the `sprints` section
**And** the item's `priority` field is dropped (priority only applies in backlog)
**And** the item's other fields (`id`, `type`, `epic`, `title`, `status`) are preserved

**Given** assigning items would exceed sprint capacity
**When** the assignment is attempted
**Then** the skill warns that capacity would be exceeded
**And** suggests removing items or increasing capacity before proceeding

**Given** the skill is invoked via menu or slash command
**When** it executes
**Then** it works identically in both invocation modes (NFR19)

**Technical notes:**
- Reworks the existing `add-to-sprint` skill (Story 12.2)
- Single file read-modify-write on `sprint-status.yaml`
- Must validate the target sprint exists and is in `planning` or `active` status
- Atomic operation: both the removal from backlog and addition to sprint happen in one file write

### Story 17.12: Rework remove-from-sprint Skill (Heavy Rework — Movement Semantics)

As a **Scrum Master**,
I want the `remove-from-sprint` skill to MOVE items from a sprint's `items` array back to the `backlog` section,
So that sprint scope adjustments are clean, reversible, single-file operations.

**Acceptance Criteria:**

**Given** a sprint has assigned items
**When** the Scrum Master invokes `remove-from-sprint`
**Then** it displays the sprint's currently assigned items with their statuses
**And** the Scrum Master selects which items to remove

**Given** items are removed from the sprint
**When** the removal completes
**Then** each selected item is REMOVED from the sprint's `items` array (FR134)
**And** ADDED back to the `backlog` array with a `priority` field set to position 1 (top of backlog — Scrum Master can reprioritize later)
**And** the item's `status` is NOT changed — it retains its current status (e.g., stays `ready-for-dev`)

**Given** a sprint's capacity was full (e.g., 6/6 items)
**When** an item is removed
**Then** the sprint's effective capacity usage decreases (e.g., 5/6)

**Technical notes:**
- Reworks the existing `remove-from-sprint` skill
- Single file read-modify-write on `sprint-status.yaml`
- This is the inverse of Story 17.11
- Removed items re-enter backlog at priority 1 by default; the Scrum Master should reprioritize after bulk removals

### Story 17.13: Rework sprint-status-view Skill (Heavy Rework — Single Source Read)

As a **Project Manager**,
I want the `sprint-status-view` skill to read all sprint data from the single `sprint-status.yaml` file,
So that sprint status display is fast and consistent with no cross-file reconciliation needed.

**Acceptance Criteria:**

**Given** the `sprint-status-view` skill is invoked
**When** it reads `sprint-status.yaml`
**Then** it displays a formatted view from the three sections:
```
=== Epics ===
Epic 5: Bundled BMAD Installation [in-progress] (2/6 done)
Epic 17: Sprint Management Model Rework [planning] (0/15 done)

=== Sprint 3 (active) — 4/6 items ===
  * 5-5-explicit-parameter-passing [story] — in-progress
  * 5-6-fix-space-in-path-bug [story] — review
  * BUG-path-spaces [bug, high] — ready-for-dev
  * 15-1-bump-bmad-method [story] — backlog

=== Backlog — 12 items ===
  1. 15-2-restructure-extension-module [story] — ready-for-dev
  2. 15-3-convert-custom-agents [story] — backlog
  ...
```

**Given** no `sprint-status.yaml` file exists
**When** the skill is invoked
**Then** it reports: "No sprint-status.yaml found. Run sprint planning to initialize."

**Given** the file contains multiple sprints (one active, others closed or planning)
**When** the status is displayed
**Then** the active sprint is shown first, followed by planning sprints, then a summary of closed sprints

**Technical notes:**
- Reworks the existing `sprint-status-view` skill
- Single file read — no cross-file reconciliation needed (previously had to merge backlog.yaml + sprint files + sprint-status.yaml)
- The display format should work well for both human reading and LLM parsing
- Does NOT write to the file — read-only operation

### Story 17.14: Rework cleanup-done Skill (Heavy Rework — Single Source)

As a **Scrum Master**,
I want the `cleanup-done` skill to scan the unified `sprint-status.yaml` for done items, remove them from the file, and archive their story files,
So that the active sprint view stays clean and done work is preserved in the archive.

**Acceptance Criteria:**

**Given** items with `status: done` exist in the `sprints` section of `sprint-status.yaml`
**When** the `cleanup-done` skill is invoked
**Then** each done item is REMOVED from its sprint's `items` array (FR136)
**And** the corresponding story/bug file is moved to `{implementation_artifacts}/done/` (FR131)
**And** if the `done/` subfolder doesn't exist, it is created

**Given** items with `status: done` exist in the `backlog` section (edge case — done but never sprint-assigned)
**When** the `cleanup-done` skill is invoked
**Then** those items are also REMOVED from the `backlog` array and their files archived

**Given** a story file exists at `{implementation_artifacts}/{story-id}.md`
**When** the story reaches `done` status and cleanup runs
**Then** the file is moved to `{implementation_artifacts}/done/{story-id}.md`

**Given** a bug file exists at `{implementation_artifacts}/BUG-{title}.md`
**When** the bug reaches `done` status and cleanup runs
**Then** the file is moved to `{implementation_artifacts}/done/BUG-{title}.md`

**Given** all items in a sprint reach `done` status and are cleaned up
**When** the sprint has zero remaining items
**Then** the sprint's `items` array is empty but the sprint definition is preserved (historical record)
**And** the skill suggests closing the sprint (see Story 17.21)

**Technical notes:**
- Reworks the existing `cleanup-done` skill
- Single file read-modify-write on `sprint-status.yaml`
- File move uses `fs.rename()` — not copy+delete
- The `done/` subfolder already exists at `_bmad-output/implementation-artifacts/done/` — this story formalizes its use
- Cleanup can be triggered explicitly or as part of sprint-status-view and sprint-planning workflows

### Story 17.15: Rework bmad-sprint-planning Skill (Heavy Rework — Bootstrap Unified File)

As a **Scrum Master**,
I want the `bmad-sprint-planning` skill to bootstrap or update the unified `sprint-status.yaml` from the epics document,
So that sprint planning always starts from a complete, consistent single file.

**Acceptance Criteria:**

**Given** no `sprint-status.yaml` exists (first-time setup)
**When** the Scrum Master invokes `bmad-sprint-planning`
**Then** it creates `sprint-status.yaml` with:
  - `epics` section populated from `epics.md` (all epics with title, status, story counts)
  - `backlog` section populated with all non-done stories and bugs in priority order
  - `sprints` section initialized as an empty array `[]`

**Given** `sprint-status.yaml` already exists
**When** the Scrum Master invokes `bmad-sprint-planning`
**Then** the `epics` section is refreshed from `epics.md` (new epics added, counts updated)
**And** new stories from `epics.md` that don't exist in `backlog` or any `sprints` section are added to `backlog`
**And** existing items in `backlog` and `sprints` sections are NOT modified (preserves status, priority, sprint assignments)
**And** done items are NOT reintroduced (they stay in the `done/` archive)

**Given** the sprint-planning workflow includes cleanup
**When** it detects items with `status: done` still in the file
**Then** it runs the cleanup-done logic (Story 17.14) as part of the planning workflow

**Technical notes:**
- Reworks the existing `bmad-sprint-planning` skill
- This is the primary bootstrap entry point for the unified file
- Must handle the merge carefully: new items go to backlog, existing items stay where they are
- The `epics` section is always fully regenerated (it's reference data, not user-managed)
- Should be run at the start of each sprint planning session

### Story 17.16: Rework add-sprint Skill (Moderate Rework — Section-Based)

As a **Scrum Master**,
I want the `add-sprint` skill to create a new sprint entry in the `sprints` section of `sprint-status.yaml`,
So that new sprints are defined within the unified file rather than as separate files.

**Acceptance Criteria:**

**Given** the Scrum Master invokes `add-sprint`
**When** the sprint details are provided (name, capacity, optional ISO start/end dates)
**Then** a new sprint entry is appended to the `sprints` array in `sprint-status.yaml`:
```yaml
sprints:
  - id: sprint-4
    name: "Sprint 4"
    status: planning
    capacity: 6
    start: "2026-04-15"
    end: "2026-04-28"
    items: []
```
**And** the sprint ID is auto-incremented from the highest existing sprint ID

**Given** a sprint with `status: planning` already exists
**When** a new sprint is created
**Then** the new sprint is also created with `status: planning` (multiple planning sprints are allowed)
**And** only one sprint can be `active` at a time

**Given** `sprint-status.yaml` does not exist
**When** `add-sprint` is invoked
**Then** the skill reports: "No sprint-status.yaml found. Run sprint planning first to initialize the file."

**Technical notes:**
- Reworks the existing `add-sprint` skill (Story 12.1)
- Writes to the `sprints` section of `sprint-status.yaml` instead of creating a separate `sprints/sprint-N.yaml` file
- Sprint ID format: `sprint-{number}` (kebab-case, auto-incremented)
- Capacity is defined by number of items (stories + bugs) per FR66

### Story 17.17: Rework modify-sprint Skill (Moderate Rework — Section-Based)

As a **Scrum Master**,
I want the `modify-sprint` skill to update sprint metadata within the `sprints` section of `sprint-status.yaml`,
So that sprint adjustments (capacity, dates, name, status) are made in the unified file.

**Acceptance Criteria:**

**Given** the Scrum Master invokes `modify-sprint` with a target sprint ID
**When** the sprint exists in the `sprints` section
**Then** the skill allows modification of: `name`, `capacity`, `start`, `end`, `status`
**And** the updated sprint is written back to `sprint-status.yaml`

**Given** the Scrum Master changes a sprint's `status` to `active`
**When** another sprint is already `active`
**Then** the skill warns that only one sprint can be active
**And** requires the existing active sprint to be closed first (or offers to close it)

**Given** the Scrum Master reduces capacity below the current item count
**When** the modification is attempted
**Then** the skill warns: "Sprint has N items but new capacity is M (M < N). Remove items first."
**And** does NOT apply the capacity change until items are removed

**Technical notes:**
- Reworks the existing `modify-sprint` skill (Story 12.3)
- Modifies the sprint entry in-place within the `sprints` array of `sprint-status.yaml`
- Status transitions: `planning` -> `active` -> `closed`. No backward transitions except via the Scrum Master explicitly overriding.

### Story 17.18: Rework bmad-dev-story Skill (Moderate Rework — Cross-Section Status Update)

As a **Developer**,
I want the `bmad-dev-story` skill to update story status in-place within `sprint-status.yaml` regardless of which section the story resides in,
So that development progress is reflected in the unified file without manual status updates.

**Acceptance Criteria:**

**Given** a developer starts working on a story via `bmad-dev-story`
**When** the story transitions from `ready-for-dev` to `in-progress`
**Then** the skill finds the item in `sprint-status.yaml` (searching both `backlog` and all `sprints[].items`)
**And** updates the item's `status` field in-place (FR135)

**Given** a developer completes a story
**When** the story transitions to `review` or `done`
**Then** the status is updated in-place in whichever section the item currently resides
**And** if the status becomes `done`, the cleanup-done logic can be triggered (or deferred to explicit cleanup)

**Given** the story ID is not found in `sprint-status.yaml`
**When** the skill attempts to update status
**Then** it reports: "Story {id} not found in sprint-status.yaml. It may have been archived to done/ or not yet added to the backlog."

**Technical notes:**
- Reworks the existing `bmad-dev-story` skill
- Must search across both `backlog` and all `sprints[].items` sections to find the item by `id`
- Write is a targeted update — only the `status` field changes, all other fields preserved
- Cross-section search is needed because a developer may work on a story whether or not it's sprint-assigned

### Story 17.19: Rework story-status-lookup Skill (Light Rework — Cross-Section Search)

As a **Developer**,
I want the `story-status-lookup` skill to search the unified `sprint-status.yaml` for any story's current status,
So that code can be classified as delivered or work-in-progress from a single data source.

**Acceptance Criteria:**

**Given** the `story-status-lookup` skill is invoked with a story ID
**When** the story exists in the `backlog` section of `sprint-status.yaml`
**Then** it returns the item's status and notes it is "in backlog (unassigned)"

**Given** the story exists in a sprint's `items` array
**When** the lookup completes
**Then** it returns the item's status and notes which sprint it is assigned to (e.g., "in sprint-3")

**Given** the story is not found in `sprint-status.yaml`
**When** the lookup checks the `done/` archive folder
**Then** it reports: "Story {id} is archived (done)" if the file exists in `done/`
**Or** reports: "Story {id} not found in sprint-status.yaml or done/ archive"

**Technical notes:**
- Reworks the existing `story-status-lookup` skill
- Single file search across `backlog` + all `sprints[].items` sections
- Fallback: check `done/` folder for archived stories
- The `always_load: true` flag in MANIFEST.yaml remains — this skill is loaded every session
- The Jira extension point reserved in this skill is activated by Story 17.22

### Story 17.20: Rework bmad-sprint-status Skill (Light Rework — Structured Sections)

As a **Project Manager**,
I want the `bmad-sprint-status` skill to produce a concise risk-focused summary from the structured sections of `sprint-status.yaml`,
So that sprint health and risks are surfaced quickly from the single source of truth.

**Acceptance Criteria:**

**Given** the `bmad-sprint-status` skill is invoked
**When** it reads the `sprints` section of `sprint-status.yaml`
**Then** it identifies the active sprint and calculates:
  - Items by status: how many `in-progress`, `review`, `ready-for-dev`, `backlog`
  - Capacity usage: items.length / capacity
  - Blocked items: items with `status: blocked` (if any)

**Given** the active sprint has items with concerning statuses
**When** the summary is generated
**Then** it flags risks:
  - "3 of 6 items still in `backlog` status — not yet started"
  - "Sprint at 100% capacity with 2 items in `ready-for-dev`"
  - "No items in `review` or `done` — sprint may be at risk"

**Given** the `epics` section contains epic-level data
**When** the summary is generated
**Then** it includes epic progress: "Epic 5: 2/6 done, Epic 17: 0/15 done"

**Technical notes:**
- Reworks the existing `bmad-sprint-status` skill
- Reads from the structured sections of `sprint-status.yaml` — no cross-file joins needed
- Output is optimized for LLM context (concise, structured) and human readability
- This is the quick-summary variant; `sprint-status-view` (Story 17.13) is the detailed view

### Story 17.21: New close-sprint Skill

As a **Scrum Master**,
I want a `close-sprint` skill that transitions a sprint from `active` to `closed`, archives all done items, and returns incomplete items to the backlog,
So that sprint closure is a clean, well-defined workflow.

**Acceptance Criteria:**

**Given** the Scrum Master invokes `close-sprint`
**When** an active sprint exists
**Then** the skill displays the sprint summary: total items, done count, incomplete count

**Given** the sprint has items with `status: done`
**When** the sprint is closed
**Then** all done items are REMOVED from the sprint's `items` array
**And** their story/bug files are moved to `{implementation_artifacts}/done/` (same as cleanup-done)

**Given** the sprint has incomplete items (status != `done`)
**When** the sprint is closed
**Then** the skill presents three options for handling incomplete items (FR137):
  (a) **Move all to the next sprint** — all incomplete items are MOVED from the current sprint's `items` array to the next sprint's `items` array (the next sprint must exist in `planning` status; if no next sprint exists, the skill prompts to create one or falls back to option b)
  (b) **Return all to backlog** — all incomplete items are MOVED from the sprint's `items` array back to the `backlog` section (FR134 — movement semantics), each receiving a `priority` value placing it at the top of the backlog (to be reprioritized)
  (c) **Decide per item** — the skill iterates through each incomplete item and asks whether to move it to the next sprint or return it to the backlog
**And** regardless of option chosen, each item's status is preserved (e.g., `in-progress` items stay `in-progress`)

**Given** all items have been archived or returned to backlog
**When** the sprint is fully processed
**Then** the sprint's `status` is set to `closed`
**And** the sprint's `items` array is empty `[]`
**And** the sprint definition is preserved in the `sprints` section (historical record)
**And** a summary is displayed: "Sprint N closed. X items archived, Y items returned to backlog."

**Given** no active sprint exists
**When** `close-sprint` is invoked
**Then** it reports: "No active sprint found. Nothing to close."

**Technical notes:**
- NEW skill: `lib/bmad-extension/skills/close-sprint/`
- Combines done-item archival (Story 17.14 logic) with incomplete-item return to backlog (Story 17.12 inverse)
- Single file read-modify-write on `sprint-status.yaml` plus file moves for archived stories
- After close-sprint, the Scrum Master typically runs `add-sprint` to create the next sprint

### Story 17.22: Add Backend Routing to All 13 Sprint Skills (tracking_system Switch)

As a **Project Manager**,
I want sprint management skills to check `tracking_system` and route operations to the correct backend,
So that teams using Jira as their sprint backend have skills that attempt Jira operations and handle failures interactively.

**Acceptance Criteria:**

**Given** `sprint-status.yaml` contains `tracking_system: file-system` (default or absent)
**When** any sprint management skill is invoked
**Then** it reads/writes `sprint-status.yaml` on the local file system (unchanged behavior)

**Given** `sprint-status.yaml` contains `tracking_system: jira`
**When** any sprint management skill is invoked
**Then** the skill outputs the placeholder message: "Jira tracking is configured (`tracking_system: jira`), but Jira operation support for this skill is not yet implemented (pending Epic 14 Story 14.3). Operating in file-system mode."
**And** the skill continues with file-system behavior (reads/writes `sprint-status.yaml` locally)
**And** the skill does NOT attempt any Jira operation — Jira is not the source of truth in Phase A

**Given** the backend-routing block is embedded in all 13 sprint skills with the Phase A placeholder `jira` branch body
**When** Epic 14 Story 14.3 later fills in the Jira operation instructions for each skill
**Then** only the `jira` branch body changes — the surrounding routing structure, file-system branch, and unknown-value fallback are unchanged

**Given** `sprint-status.yaml` contains an unknown `tracking_system` value
**When** any sprint management skill is invoked
**Then** it outputs: "Unsupported tracking system: `{value}`. Supported values are `file-system` and `jira`. Proceeding with file-system backend."
**And** it continues with file-system behavior

**Given** the backend-routing block is embedded in all 13 sprint skills
**When** Epic 14 Story 14.3 later fills in the Jira operation instructions for a skill
**Then** only the `jira` branch body changes — the routing structure, error handling, and file-system branch are unchanged

**Technical notes:**
- NOT blocked on Epic 14 — this story embeds the routing structure (Section 4.1-A of `mcp-detection-pattern-spec.md`); Epic 14 Story 14.3 fills in the Jira operation body for each skill
- The Phase A `jira` branch body is a placeholder: "Jira operation not yet implemented for this skill (pending Epic 14 Story 14.3). Proceeding with file-system." followed by file-system behavior
- Embed the routing structure verbatim in each skill's SKILL.md at the start of the workflow, before any numbered steps
- FR139 scope: install-time backend selection is stored in config; `tracking_system` field reflects the active backend. FR140 scope: all 13 skills must route on `tracking_system` and handle the interactive failure prompt
- Cross-reference: `mcp-detection-pattern-spec.md` is the canonical source for the routing structure templates

### Story 17.23: Migration and Deprecation of Old Files

As a **DevOps Engineer**,
I want the old three-file sprint model (`backlog.yaml`, `sprints/sprint-N.yaml`, `sprint-status.yaml` with old schema) automatically migrated to the unified `sprint-status.yaml`,
So that existing projects transition cleanly without data loss.

**Acceptance Criteria:**

**Given** a project has the old `backlog.yaml` file
**When** `bmad-sprint-planning` is run (Story 17.15) and `sprint-status.yaml` does not yet exist (or has the old schema)
**Then** the migration reads `backlog.yaml` and imports all items into the `backlog` section of the new unified `sprint-status.yaml`
**And** priority ordering from the old file is preserved

**Given** a project has old `sprints/sprint-N.yaml` files
**When** the migration runs
**Then** each sprint file is imported as an entry in the `sprints` section of `sprint-status.yaml`
**And** items referenced in old sprint files are matched to backlog items and moved to the sprint's `items` array

**Given** the old `sprint-status.yaml` exists with the old schema (flat `development_status` list)
**When** the migration detects the old format
**Then** it extracts item statuses from the old file and applies them to the corresponding items in the new schema
**And** the old file is backed up to `sprint-status.yaml.bak` before overwriting with the new schema

**Given** the migration completes successfully
**When** the new `sprint-status.yaml` is verified
**Then** the old files are removed:
  - `backlog.yaml` is deleted
  - `sprints/` directory is deleted (if empty after migration)
  - `sprint-status.yaml.bak` is preserved for 1 sprint cycle (manual deletion)

**Given** the migration encounters conflicts (e.g., item in old backlog with different status than old sprint-status)
**When** the conflict is detected
**Then** the migration logs the conflict and uses the most recent status (from sprint-status.yaml or sprint file, whichever was modified last)
**And** a migration report is generated listing all conflicts and resolutions

**Technical notes:**
- Migration runs as part of `bmad-sprint-planning` (Story 17.15) — not a separate skill
- Old schema detection: if `sprint-status.yaml` has a `development_status` top-level key (old) vs `epics`/`backlog`/`sprints` keys (new)
- The migration is idempotent — running it twice produces the same result
- After one successful migration, subsequent `bmad-sprint-planning` runs skip migration logic (new schema detected)

### Story 17.24: Rework `prioritize-backlog` Skill for Unified File

As a **Scrum Master**,
I want the `prioritize-backlog` skill to read and write the `backlog` section of the unified `sprint-status.yaml`,
So that backlog reprioritization works against the single source of truth instead of the deprecated standalone `backlog.yaml` file.

**Acceptance Criteria:**

**Given** the `prioritize-backlog` skill is invoked
**When** the unified `sprint-status.yaml` exists
**Then** it reads items from the `backlog` section only (items already assigned to a sprint keep their priority and are NOT reprioritized)

**Given** the Scrum Master reorders or adjusts priority values
**When** the reprioritization is applied
**Then** the skill writes updated `priority` values back to the `backlog` section of `sprint-status.yaml`
**And** all other sections (`epics`, `sprints`) are preserved unchanged

**Given** items exist in both `backlog` and `sprints` sections
**When** the skill displays items for prioritization
**Then** only `backlog` items are shown — sprint-assigned items are excluded from the prioritization view

**Given** the old `backlog.yaml` file exists but `sprint-status.yaml` also exists
**When** the skill is invoked
**Then** it operates on `sprint-status.yaml` only (the old file is ignored; see Story 17.23 for migration)

**Technical notes:**
- Reworks the existing `prioritize-backlog` skill to read/write `sprint-status.yaml` `backlog` section instead of standalone `backlog.yaml`
- Rework level: Light — the core prioritization logic (multi-criteria sorting, severity, business value, dependencies, type, age) remains unchanged; only the file I/O layer changes
- Single file read-modify-write on `sprint-status.yaml`
- Depends on Story 17.9 (unified schema definition)
- FRs: FR133 (unified file), FR134 (movement semantics — prioritization respects section boundaries)

---

## Epic 18: Roo Code IDE Support (Phase 2)

**Goal:** Full Roo Code integration — ma-agents skill installation, BMAD agent personas as custom modes, planning instructions as rules, and BMAD workflows as slash commands.
**FRs covered:** FR34 (extended to include Roo Code), FR36, FR38
**Proposed FRs:** FR158 (Roo Code custom modes from BMAD agents), FR159 (Roo Code rules from BMAD instructions), FR160 (Roo Code slash commands from BMAD workflows), FR161 (Cline-to-Roo migration) — renumbered from FR142-145; FR141-FR157 are now reserved for Epic 19 (Knowledge Graph)
**Research:** `_bmad-output/planning-artifacts/domain-research-roocode-2026-03-31.md`
**Dependency:** None (can proceed independently; upstream `bmad-method` already has `roo` in `platform-codes.yaml`)

### Story 18.1: Add Roo Code Agent Entry to ma-agents

As a **Chief Architect**,
I want Roo Code registered as a supported IDE in `lib/agents.js`,
So that ma-agents CLI can install skills into Roo Code's `.roo/skills/` directory.

**Acceptance Criteria:**

**Given** the `lib/agents.js` file
**When** a developer adds Roo Code support
**Then** a new entry is added with:
```javascript
{
  id: 'roo-code',
  name: 'Roo Code',
  version: '1.0.0',
  category: 'ide',
  description: 'Roo Code AI Assistant (Enhanced Cline fork)',
  skillsDir: '.roo/skills',
  getProjectPath: () => path.join(process.cwd(), '.roo', 'skills'),
  getGlobalPath: () => { /* VS Code globalStorage: Code/User/globalStorage/rooveterinaryinc.roo-cline/skills */ },
  fileExtension: '.md',
  template: 'generic',
  instructionFiles: ['.roo/rules/00-ma-agents.md'],
  injectionStrategy: { position: 'top', skipPatterns: ['---'] }
}
```

**Given** `ma-agents install --agent roo-code` is run
**When** a skill is selected
**Then** the skill is installed to `.roo/skills/{skill-id}/SKILL.md`
**And** a `MANIFEST.yaml` is generated in `.roo/skills/`

**Given** `ma-agents list --agent roo-code` is run
**When** the agent is targeted
**Then** skills and their status are displayed correctly

**Technical notes:**
- The `instructionFiles` points to `.roo/rules/00-ma-agents.md` (not a top-level instruction file) because Roo Code loads rules from the `.roo/rules/` directory, not a single instruction file
- The `00-` prefix ensures the ma-agents planning instruction loads first (alphabetical order)
- Unlike Cline, Roo Code does NOT use `.clinerules` as primary — it uses `.roo/rules/`
- Global path should use `RooCode` (matching VS Code extension storage conventions)

### Story 18.2: Create BMAD IDE Config and Manifest Entry

As a **Chief Architect**,
I want Roo Code recognized in the BMAD configuration system,
So that the BMAD installer includes Roo Code in IDE setup and customization flows.

**Acceptance Criteria:**

**Given** the BMAD configuration directory `_bmad/_config/ides/`
**When** Roo Code is added
**Then** a file `roo-code.yaml` is created:
```yaml
ide: roo-code
configured_date: 2026-03-31
last_updated: 2026-03-31
configuration:
  _noConfigNeeded: true
```

**Given** the BMAD manifest at `_bmad/_config/manifest.yaml`
**When** Roo Code is added
**Then** `roo-code` appears in the `ides` list:
```yaml
ides:
  - claude-code
  - gemini
  - cline
  - cursor
  - antigravity
  - roo-code
```

**Given** the agent customization directory `_bmad/_config/agents/`
**When** Roo Code is added
**Then** a file `roo-code.customize.yaml` is created with the standard customization template (persona, principles, menu overrides)

**Technical notes:**
- Follow the exact same pattern as existing IDE configs
- The customize.yaml should have the same structure as `cline.customize.yaml`

### Story 18.3: Update Installer to Handle Roo Code Rules Injection

As a **Chief Architect**,
I want the ma-agents installer to inject planning instructions into Roo Code's `.roo/rules/` directory,
So that the MANIFEST-based skill loading instruction is automatically applied when Roo Code starts.

**Acceptance Criteria:**

**Given** `ma-agents install --agent roo-code` runs
**When** skills are installed
**Then** a file `.roo/rules/00-ma-agents.md` is created with:
```markdown
<!-- MA-AGENTS-START -->
# AI Agent Skills - Planning Instruction

You have access to a library of skills in your skills directory. Before starting any task:

1. Read the skill manifest at .roo/skills/MANIFEST.yaml
2. Based on the task description, select which skills are relevant
3. Read only the selected skill files
4. Then proceed with the task

Always load skills marked with always_load: true.
Do not load skills that are not relevant to the current task.
<!-- MA-AGENTS-END -->
```

**Given** the file `.roo/rules/00-ma-agents.md` already exists with MA-AGENTS markers
**When** the installer runs again
**Then** the content between markers is updated in place (idempotent)

**Given** `ma-agents uninstall --agent roo-code` runs
**When** skills are removed
**Then** the `00-ma-agents.md` file is removed from `.roo/rules/`

**Technical notes:**
- The `updateAgentInstructions()` function in `installer.js` already handles marker-based injection — this story extends it to support directory-based instruction files (Roo Code puts rules in a directory, not a single file)
- The `00-` prefix ensures this loads before any user rules (alphabetical order)
- Must handle the case where `.roo/rules/` directory doesn't exist yet (create it)

### Story 18.4: Generate .roomodes with BMAD Agent Personas

As a **Chief Architect**,
I want the BMAD installer to generate a `.roomodes` file with BMAD agent personas as Roo Code custom modes,
So that users can switch between BMAD roles (PM, Analyst, Architect, Dev, QA, SM) directly from the Roo Code mode selector.

**Acceptance Criteria:**

**Given** the BMAD installer runs `bmad install --ide roo`
**When** agent artifacts are processed
**Then** a `.roomodes` file is generated in YAML format with BMAD agents as custom modes:
```yaml
customModes:
  - slug: bmad-analyst
    name: "Analyst (Mary)"
    description: "Strategic business analysis, market research, requirements elicitation"
    roleDefinition: |
      You are Mary, a Senior Business Analyst with deep expertise in market research,
      competitive analysis, and requirements elicitation...
    whenToUse: |
      Use this mode when conducting market research, creating product briefs,
      competitive analysis, or domain research.
    customInstructions: |
      Load and follow the BMAD agent activation protocol from
      {project-root}/_bmad/bmm/agents/analyst.md
    groups:
      - read
      - mcp
  - slug: bmad-pm
    name: "PM (Patricia)"
    ...
```

**Given** BMAD agent personas include tool restrictions
**When** the mode is generated
**Then** each mode's `groups` field reflects appropriate tool permissions:
- Analyst/PM/SM: `[read, mcp]` (no edit, no command)
- Architect: `[read, edit, mcp]` (can edit architecture docs)
- Dev: `[read, edit, command, mcp]` (full access)
- QA: `[read, edit, command, mcp]` (full access for test writing)

**Given** a `.roomodes` file already exists with user-defined modes
**When** the installer runs
**Then** BMAD modes (slug starting with `bmad-`) are replaced/updated
**And** user-defined modes are preserved untouched

**Technical notes:**
- This requires a new function in the Roo Code IDE handler (or config-driven installer extension)
- BMAD agent slugs use `bmad-` prefix for safe identification and cleanup
- The `roleDefinition` should be extracted from the agent's `<persona>` section
- The `customInstructions` should reference the full agent file path for runtime loading
- Read agent data from `_bmad/bmm/agents/*.md` at install time
- `.roomodes` supports both YAML and JSON — prefer YAML for readability

### Story 18.5: Deploy BMAD Workflows as Roo Code Slash Commands

As a **Chief Architect**,
I want BMAD workflows deployed as Roo Code slash commands in `.roo/commands/`,
So that users can trigger BMAD workflows (create-prd, sprint-planning, code-review, etc.) directly from the chat input.

**Acceptance Criteria:**

**Given** the BMAD installer runs for Roo Code
**When** workflow artifacts are processed
**Then** markdown files are created in `.roo/commands/` for each BMAD workflow:
```markdown
---
description: Create a PRD from scratch through guided collaborative workflow
mode: bmad-pm
---
You must fully embody the PM agent persona and follow all activation instructions.

<agent-activation CRITICAL="TRUE">
1. LOAD the FULL agent file from {project-root}/_bmad/bmm/agents/pm.md
2. READ its entire contents
3. FOLLOW every step in the <activation> section precisely
4. Execute the Create PRD menu item
</agent-activation>
```

**Given** a workflow has a natural target mode (e.g., create-prd → PM, create-architecture → Architect)
**When** the slash command is generated
**Then** the frontmatter `mode` field maps to the corresponding `bmad-*` custom mode (from Story 18.4)

**Given** slash commands are generated
**When** they are listed
**Then** all BMAD workflows appear as `/bmad-*` commands in Roo Code's command palette:
- `/bmad-create-prd`
- `/bmad-create-architecture`
- `/bmad-sprint-planning`
- `/bmad-code-review`
- `/bmad-create-story`
- `/bmad-dev-story`
- etc.

**Given** BMAD agent launchers exist
**When** slash commands are generated
**Then** each BMAD agent also gets a launcher slash command:
- `/bmad-analyst` → activates Analyst agent
- `/bmad-pm` → activates PM agent
- etc.

**Technical notes:**
- Slash command filenames become the command name (auto-slugified)
- Use `bmad-` prefix for all commands for clean namespacing
- The `mode` field triggers automatic mode switching when the command is run
- This leverages the same agent artifact data used by other IDEs (`.claude/commands/`, `.cursor/commands/`, etc.)
- The config-driven installer's `cleanup()` already handles `legacy_targets: [.roo/commands]` for removing old artifacts

### Story 18.6: Mode-Specific Rules for BMAD Agents

As a **Chief Architect**,
I want mode-specific BMAD rules deployed to `.roo/rules-{bmad-modeSlug}/` directories,
So that each BMAD agent mode receives its specific planning instructions and behavioral guidelines.

**Acceptance Criteria:**

**Given** the BMAD installer generates custom modes (Story 18.4)
**When** mode-specific rules are deployed
**Then** directories are created for each BMAD mode:
```
.roo/
├── rules/
│   └── 00-ma-agents.md          (from Story 18.3)
├── rules-bmad-analyst/
│   └── 01-analyst-instructions.md
├── rules-bmad-pm/
│   └── 01-pm-instructions.md
├── rules-bmad-architect/
│   └── 01-architect-instructions.md
├── rules-bmad-dev/
│   └── 01-dev-instructions.md
├── rules-bmad-qa/
│   └── 01-qa-instructions.md
└── rules-bmad-sm/
    └── 01-sm-instructions.md
```

**Given** a BMAD mode is activated in Roo Code
**When** the mode loads
**Then** both the general rules (`.roo/rules/`) AND the mode-specific rules (`.roo/rules-bmad-{slug}/`) are loaded into the system prompt

**Given** mode-specific rules already exist
**When** the installer re-runs
**Then** BMAD-generated rule files are updated in place
**And** user-added rule files in the same directory are preserved

**Technical notes:**
- Mode-specific rules complement the `customInstructions` in `.roomodes` — they provide additional context without bloating the mode definition
- Each rule file should contain the BMAD planning instruction specific to that agent's role
- Use `01-` prefix for BMAD rules to allow users to add `00-` or `02-` for their own rules
- Files should be prefixed with BMAD markers for clean identification and update

### Story 18.7: Cline-to-Roo Code Migration Path

As a **Developer**,
I want an automated migration from Cline to Roo Code configuration,
So that my existing BMAD/Cline setup transfers seamlessly when I switch to Roo Code.

**Acceptance Criteria:**

**Given** a project has Cline configuration (`.cline/skills/`, `.clinerules/`)
**When** the user runs `ma-agents migrate cline-to-roo`
**Then** skills from `.cline/skills/` are copied to `.roo/skills/`
**And** `.clinerules` content is converted to `.roo/rules/` files
**And** MANIFEST.yaml is regenerated for `.roo/skills/`
**And** a summary of migrated items is displayed

**Given** a project has both Cline and Roo Code configurations
**When** migration is attempted
**Then** the CLI warns about existing Roo Code config
**And** prompts the user to confirm overwrite or skip

**Given** the migration completes
**When** the user opens Roo Code
**Then** all previously-installed BMAD skills are available
**And** planning instructions are loaded from `.roo/rules/`

**Technical notes:**
- Roo Code natively supports `.clinerules` fallback, but migrating explicitly to `.roo/` is cleaner
- Migration should update the ma-agents manifest (`.ma-agents.json`) to replace `cline` with `roo-code` in the agents list
- The `bmad-method` installer's cleanup for Cline already removes `.clinerules/workflows` — migration should run before cleanup

### Story 18.8: End-to-End Validation and Test Coverage

As a **QA Engineer**,
I want comprehensive test coverage for the Roo Code integration,
So that all Roo Code integration points are validated and regression-protected.

**Acceptance Criteria:**

**Given** the Roo Code agent is registered in `agents.js`
**When** unit tests run
**Then** tests verify:
- `getAgent('roo-code')` returns the correct agent object
- `getProjectPath()` returns `.roo/skills` path
- `getGlobalPath()` returns OS-specific paths
- `fileExtension` is `.md`
- `template` is `generic`
- `instructionFiles` contains `.roo/rules/00-ma-agents.md`

**Given** the installer targets Roo Code
**When** integration tests run
**Then** tests verify:
- Skills are installed to `.roo/skills/{id}/SKILL.md`
- `MANIFEST.yaml` is generated in `.roo/skills/`
- Planning instructions are written to `.roo/rules/00-ma-agents.md`
- Idempotent re-runs update markers without duplicating content
- Uninstall removes skill directories and the ma-agents rule file

**Given** the `.roomodes` generation runs
**When** integration tests execute
**Then** tests verify:
- `.roomodes` is valid YAML
- Each BMAD mode has required fields: `slug`, `name`, `roleDefinition`
- BMAD mode slugs start with `bmad-`
- User modes are preserved during regeneration
- Tool group permissions match agent role expectations

**Given** slash commands are generated
**When** integration tests execute
**Then** tests verify:
- Files exist in `.roo/commands/` with correct naming
- Each file has valid YAML frontmatter
- The `mode` field references a valid BMAD mode slug
- Agent activation instructions reference valid agent file paths

**Technical notes:**
- Follow the existing test patterns in the project
- Tests should cover both install and uninstall flows
- Mock the file system for unit tests, use temp directories for integration tests

---

### Epic 18 — Cross-Epic Notes

**Relationship to Cline (Epic N/A):**
Roo Code is a fork of Cline. The existing Cline support (`id: 'cline'` in agents.js) should be preserved — they are separate IDEs. Story 18.7 provides an explicit migration path.

**Relationship to bmad-method upstream:**
The `bmad-method` npm package already has `roo` in `platform-codes.yaml` and can generate skills to `.roo/skills/`. Stories 18.4-18.6 extend this with Roo-specific features (modes, rules, commands) that go beyond the standard skill format.

**Development Execution Order:**
1. Story 18.1 (agents.js) — no dependencies
2. Story 18.2 (BMAD config) — no dependencies
3. Story 18.3 (installer rules injection) — depends on 18.1
4. Story 18.4 (.roomodes generation) — depends on 18.2
5. Story 18.5 (slash commands) — depends on 18.4
6. Story 18.6 (mode-specific rules) — depends on 18.4
7. Story 18.7 (Cline migration) — depends on 18.1, 18.3
8. Story 18.8 (validation/tests) — depends on all above

---

## Epic 19: BMAD Knowledge Graph (Phase 3)

Every planning and implementation artifact generated by BMAD skills is automatically woven into a non-hierarchical knowledge graph stored as `_bmad-output/knowledge-graph.json`. Any-to-any directed relationships (not just parent-child traceability) are captured with full provenance. Engineers can open an interactive visualization of the entire project knowledge graph — navigating to any document at the specific heading where a concept is defined — via the `open-graph` skill.

### Story 19.1: Knowledge Graph Core Library (`emitToGraph`)

As a **Chief Architect**,
I want a shared `emitToGraph()` utility function in the BMAD extension module,
So that all BMAD skills can emit nodes and edges to the knowledge graph using a single consistent API without duplicating file I/O logic.

**Acceptance Criteria:**

**Given** the function `emitToGraph(projectRoot, emission)` is called with a valid emission payload
**When** `_bmad-output/knowledge-graph.json` does not yet exist
**Then** the function creates the file with a valid four-section structure: `meta`, `files`, `nodes`, `edges`
**And** `meta` contains `schema_version: "1.0"`, `generated_at` (ISO timestamp), `project` (derived from package.json name or directory name), `file_count: 0`, `node_count: 0`, `edge_count: 0`
**And** `files`, `nodes`, `edges` are initialized as empty object, empty array, empty array respectively

**Given** `knowledge-graph.json` already exists with prior content
**When** `emitToGraph()` is called
**Then** it reads the existing file, appends new files/nodes/edges, updates counts in `meta`, and writes the result back atomically
**And** no existing nodes, edges, or file registrations are deleted or overwritten

**Given** an emission payload includes a `files` entry with `pointer_type: "relative_path"`
**When** that file-id does not yet exist in the `files` table
**Then** the file is registered: `files[file-id] = { pointer, title, pointer_type }`
**And** if the file-id already exists, registration is skipped (first-write-wins)

**Given** an emission payload includes a node with id `file-id#heading-anchor`
**When** a node with that id already exists in `nodes`
**Then** the node is not duplicated

**Given** an emission payload includes an edge with `(from, to, type)` triple
**When** an edge with the same `(from, to, type)` already exists in `edges`
**Then** the edge is not duplicated (provenance of the first edge is preserved)

**Given** the function writes the updated graph
**When** the write operation completes
**Then** `meta.file_count`, `meta.node_count`, `meta.edge_count` reflect the total counts in the file

**Technical notes:**
- Implement in `lib/bmad-extension/skills/` as a shared utility module (e.g., `lib/knowledge-graph/emit.js`)
- Heading anchor derivation: `heading.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-')` (GitHub slug algorithm)
- File path for graph: always `path.join(projectRoot, '_bmad-output', 'knowledge-graph.json')`
- Use synchronous file I/O (`fs.readFileSync` / `fs.writeFileSync`) — graph updates happen after artifact generation, not in hot paths
- JSON serialization: `JSON.stringify(graph, null, 2)` for human-readable output
- FRs: FR141, FR142, FR143, FR144, FR145, FR146, FR147, FR148
- NFRs: NFR39 (LLM-writability — flat structure, copy-pattern extension), NFR40 (additive-only)

### Story 19.2: Graph Emission — `create-prd` (Graph Seed)

As a **Product Manager**,
I want the `create-prd` skill to automatically seed the knowledge graph when a PRD is generated,
So that the PRD becomes the root of the project knowledge graph without any user action.

**Acceptance Criteria:**

**Given** the `create-prd` skill completes generation of `_bmad-output/planning-artifacts/prd.md`
**When** the artifact write step finishes
**Then** `emitToGraph()` is called silently as the final step — no user prompt, no output message
**And** the PRD file is registered in the `files` table as `{ pointer: "_bmad-output/planning-artifacts/prd.md", title: "Product Requirements Document", pointer_type: "relative_path" }` with file-id `prd`

**Given** the PRD contains top-level `##` headings (e.g., `## Executive Summary`, `## Functional Requirements`)
**When** emission runs
**Then** one node is emitted per heading: `{ id: "prd#executive-summary", file: "prd", anchor: "executive-summary", title: "Executive Summary", type: "prd" }`

**Given** the graph is seeded from a new PRD
**When** the `knowledge-graph.json` file is inspected
**Then** it contains no edges (PRD is the root — it does not reference other documents yet)
**And** `meta.node_count` equals the number of `##` headings in the PRD

**Given** `create-prd` runs on a project where `knowledge-graph.json` already exists
**When** emission runs
**Then** only new headings (not yet present as nodes) are added — re-runs are idempotent

**Technical notes:**
- Extract headings by scanning the generated markdown for `^## ` lines
- Emit only level-2 (`##`) headings as nodes — level-3+ create noise without adding navigation value
- The PRD seeding call is the only emission that produces zero edges — all other skills emit edges pointing back to PRD nodes
- FRs: FR149, FR150, FR151, FR152

### Story 19.3: Graph Emission — `create-architecture` and `create-epics-and-stories`

As a **Chief Architect** and **Product Manager**,
I want the `create-architecture` and `create-epics-and-stories` skills to emit traceability edges to the knowledge graph automatically,
So that every architectural decision and every epic traces back to the PRD sections that motivated it.

**Acceptance Criteria:**

**Given** the `create-architecture` skill completes generation of `_bmad-output/planning-artifacts/architecture.md`
**When** emission runs
**Then** the architecture file is registered as file-id `arch` with `pointer_type: "relative_path"`
**And** one node is emitted per `##` heading in architecture.md (type: `architecture`)
**And** for each architecture decision section (headings matching `## Decision` or similar), an `implements` edge is emitted: `{ from: "arch#decision-slug", to: "prd#relevant-fr-section", type: "implements", label: "implements PRD requirement", created_by: <user>, agent: <agent-id>, created_at: <timestamp> }`

**Given** the `create-architecture` skill is run when PRD nodes do not yet exist in the graph
**When** an edge references a PRD node that is not yet in `nodes`
**Then** a stub node is emitted for the referenced PRD heading so the edge is not orphaned
**And** the stub node carries `type: "prd"` and the correct `file` and `anchor` fields

**Given** the `create-epics-and-stories` skill completes updating `_bmad-output/planning-artifacts/epics.md`
**When** emission runs
**Then** the epics file is registered as file-id `epics` with `pointer_type: "relative_path"`
**And** one node is emitted per epic heading (type: `epic`)
**And** for each epic, a `derives-from` edge is emitted to the PRD Functional Requirements node: `{ from: "epics#epic-N-name", to: "prd#functional-requirements", type: "derives-from", ... }`
**And** where an epic was informed by an architecture decision, an `informed-by` edge is also emitted: `{ from: "epics#epic-N-name", to: "arch#decision-slug", type: "informed-by", ... }`

**Technical notes:**
- The `informed-by` edge is the non-hierarchical edge type — it captures cross-domain influence (an epic shaped by an architectural decision, not just a PRD section)
- Architecture decision headings can be detected by scanning for `## Decision` or `## P[0-9]-[0-9]` patterns (architecture doc convention)
- Epic headings can be detected by scanning for `## Epic [0-9]+:` pattern
- Emit after the file write step completes; `created_by` is read from BMAD config (user name); `agent` is the BMAD agent identity string from the skill context
- FRs: FR149, FR150, FR151, FR152

### Story 19.4: Graph Emission — `create-story`, `validate-prd`, `dev-story`, `bmad-sprint-planning`

As a **Developer** and **QA Engineer**,
I want individual story files and validation artifacts to emit traceability edges automatically,
So that the knowledge graph captures the full SDLC chain from PRD through architecture through epics through stories through implementation.

**Acceptance Criteria:**

**Given** the `create-story` skill generates a story file (e.g., `_bmad-output/implementation-artifacts/17-9-unified-sprint-status-schema.md`)
**When** emission runs
**Then** the story file is registered in the `files` table with `pointer_type: "relative_path"` and a file-id derived from the story number (e.g., `story-17-9`)
**And** a node is emitted for the story root heading (type: `story`)
**And** a `traces-to` edge is emitted from the story node to its parent epic node: `{ from: "story-17-9#story-title", to: "epics#epic-17-sprint-management", type: "traces-to", ... }`
**And** if the story's technical notes reference architecture decisions, `informed-by` edges are emitted from the story node to the relevant architecture nodes

**Given** the `validate-prd` skill completes a validation report
**When** emission runs
**Then** the validation report file is registered with file-id `validation-<date>`
**And** a `validates` edge is emitted from the validation report node to `prd#functional-requirements`: `{ type: "validates", label: "PRD validation report <date>", ... }`

**Given** `dev-story` completes implementation guidance for a story
**When** emission runs
**Then** an `informed-by` edge is emitted from the story node to `arch#implementation-notes` (or the most relevant architecture section)

**Given** `bmad-sprint-planning` completes sprint plan generation
**When** emission runs
**Then** sprint plan nodes are emitted and `derives-from` edges connect them to the relevant epic nodes

**Technical notes:**
- Story file-ids use the format `story-<epic-number>-<story-number>` (derived from the file path)
- The 7 skills emitting to the graph: `create-prd`, `create-architecture`, `create-epics-and-stories`, `create-story`, `validate-prd`, `dev-story`, `bmad-sprint-planning`
- All emission calls are identical in structure: call `emitToGraph(projectRoot, emission)` at the end of the artifact write step
- FRs: FR149, FR150, FR151, FR152

### Story 19.5: `open-graph` Skill

As an **Engineer**,
I want to run `/open-graph` in any BMAD agent,
So that the knowledge graph visualization opens in VSCode (as a webview) or in my default browser when outside VSCode — without any additional configuration.

**Acceptance Criteria:**

**Given** `open-graph` is invoked inside VSCode (detected via `process.env.TERM_PROGRAM === 'vscode'` or `process.env.VSCODE_PID !== undefined`)
**When** the skill runs
**Then** it generates `_bmad-output/knowledge-graph.html` (if not already current) from the JSON data
**And** opens the HTML file via VSCode's `vscode.env.openExternal(Uri.file(...))` API or equivalent open command

**Given** `open-graph` is invoked outside VSCode (standard terminal)
**When** the skill runs
**Then** it generates `knowledge-graph.html` from the current JSON data
**And** opens it using the platform-appropriate command: `start` (Windows), `open` (macOS), `xdg-open` (Linux)

**Given** `_bmad-output/knowledge-graph.json` does not exist
**When** `open-graph` is invoked
**Then** the skill informs the user that no knowledge graph data has been generated yet
**And** suggests running a BMAD planning skill to seed the graph

**Given** `knowledge-graph.html` already exists and is newer than `knowledge-graph.json`
**When** `open-graph` is invoked
**Then** the skill skips regeneration and opens the existing HTML directly

**Technical notes:**
- Skill location: `lib/bmad-extension/skills/open-graph/`
- Skill files: `SKILL.md` (agent instruction), `skill.json` (metadata), `generate-html.js` (HTML renderer generator)
- The `generate-html.js` script reads the JSON, inlines the data as a JavaScript literal, and writes the self-contained HTML file
- `always_load: false` — this is an on-demand skill, not a mandatory load
- Add `open-graph` to the BMAD extension module's MANIFEST.yaml
- FR: FR153

### Story 19.6: Interactive Visualization Renderer

As an **Engineer**,
I want the knowledge graph HTML file to render an interactive, navigable visualization of all project artifacts and their relationships,
So that I can explore cross-document traceability visually and jump directly to any document section from the graph.

**Acceptance Criteria:**

**Given** `knowledge-graph.html` is opened in a browser or VSCode webview
**When** the graph renders
**Then** each node appears as a circle color-coded by document type:
- `prd` → blue
- `architecture` → orange
- `epic` → green
- `story` → teal
- `decision` → purple
- `validation` → red
**And** directed edges are rendered as arrows with the edge type as a label
**And** the initial render completes within 3 seconds for graphs up to 500 nodes and 1000 edges (NFR38)

**Given** the user clicks a node
**When** the click handler fires
**Then** the node's source document opens at the specific heading anchor via the IDE's file protocol or a browser file URL

**Given** the user hovers over an edge
**When** the tooltip renders
**Then** it displays: edge type, label, created_by, agent, created_at (FR155)

**Given** the user selects a node
**When** the selection occurs
**Then** the immediate neighbors (one hop in either direction) are highlighted
**And** non-neighbor nodes and edges are dimmed (FR156)

**Given** the user uses the filter controls
**When** a node type or edge type is deselected
**Then** nodes and edges of that type are hidden from the visualization
**And** re-selecting them restores visibility (FR156)

**Given** the HTML file is opened in an air-gapped environment with no network access
**When** the page loads
**Then** the graph renders identically to a connected environment — no CDN requests, no external fonts, no script fetches (FR157, NFR41)

**Technical notes:**
- All JavaScript and CSS are inlined in the HTML file — no external dependencies
- Graph data is embedded as a `const GRAPH_DATA = {...}` literal at generation time (not fetched at runtime)
- Use SVG for node and edge rendering — no canvas required, simpler interaction model
- Pre-compute the first 100 physics ticks at generation time to arrive at a stable initial layout (avoids animation jitter on open)
- The renderer is approximately 300-500 lines of vanilla JS — no framework, no bundler
- Node positioning: simple force-directed simulation using Coulomb repulsion + spring attraction
- FRs: FR154, FR155, FR156, FR157
- NFRs: NFR38, NFR41

### Story 19.7: LLM-Writability Contract Validation and Integration Tests

As a **Chief Architect**,
I want the knowledge graph JSON format validated against the LLM-writability contract and covered by integration tests,
So that we can verify that any LLM can extend the graph by copying existing patterns, and that the additive-only semantics are enforced.

**Acceptance Criteria:**

**Given** a `knowledge-graph.json` file with one existing node and one existing edge
**When** an LLM is instructed to add a new node and a new edge by copying the existing patterns (no external schema provided)
**Then** the resulting JSON is valid and passes `emitToGraph()` ingestion without errors
**And** the existing node and edge are preserved unchanged (NFR40)

**Given** `emitToGraph()` is called with a node id that already exists in `nodes`
**When** the function completes
**Then** `nodes` contains exactly one entry with that id (no duplicate)
**And** the original node's fields are unchanged

**Given** `emitToGraph()` is called with an edge `(from, to, type)` triple that already exists
**When** the function completes
**Then** `edges` contains exactly one entry with that triple (no duplicate)
**And** the original edge's provenance (created_by, agent, created_at) is unchanged

**Given** a graph with 500 nodes and 1000 edges
**When** `emitToGraph()` adds one new node and one new edge
**Then** the operation completes in under 1 second

**Given** the full emission sequence is run (all 7 skills emit in order)
**When** the resulting `knowledge-graph.json` is inspected
**Then** all emitted nodes are present
**And** all emitted edges are present with correct provenance
**And** `meta.file_count`, `meta.node_count`, `meta.edge_count` are accurate

**Technical notes:**
- Tests live in `tests/knowledge-graph/` following the existing test structure
- Use temp directories for all file I/O in tests
- The LLM-writability test can use a fixture JSON and verify that extending it by hand-editing produces valid output
- Test the VSCode detection logic with environment variable mocks
- NFRs: NFR39 (LLM-writability), NFR40 (additive-only)

---

### Epic 19 — Cross-Epic Notes

**Relationship to Epic 15 (BMAD 6.2.1 Migration):**
The `open-graph` skill deploys as a BMAD extension skill following the 6.2.1 module structure established by Epic 15. Epic 15 must be complete before Story 19.5.

**Relationship to Epic 17 (Sprint Management):**
`bmad-sprint-planning` is one of the 7 skills that emit to the knowledge graph. Epic 17 must be complete (skill structure settled) before Story 19.4 wires in sprint planning emission.

**Relationship to Epic 7 (Test Suite):**
Story 19.7 integration tests follow the test infrastructure from Epic 7. Epic 7 is on hold, so Story 19.7 uses the existing Node.js test runner pattern directly.

**File outputs produced by this epic:**
```
_bmad-output/
├── knowledge-graph.json   ← graph data (generated by Stories 19.2-19.4)
└── knowledge-graph.html   ← self-contained renderer (generated by Story 19.5/19.6)

lib/
├── knowledge-graph/
│   └── emit.js            ← shared emitToGraph() utility (Story 19.1)
└── bmad-extension/
    └── skills/
        └── open-graph/    ← new BMAD extension skill (Story 19.5)
            ├── SKILL.md
            ├── skill.json
            └── generate-html.js
```

**Development Execution Order:**
1. Story 19.1 (core library) — no dependencies; establish before any emission story
2. Story 19.2 (create-prd emission) — depends on 19.1
3. Story 19.3 (create-architecture + create-epics-and-stories emission) — depends on 19.1; can run in parallel with 19.2
4. Story 19.4 (create-story + remaining emission) — depends on 19.1; can run in parallel with 19.2 and 19.3
5. Story 19.5 (open-graph skill) — depends on 19.1 (needs the generate-html logic)
6. Story 19.6 (visualization renderer) — depends on 19.5 (renderer is invoked by open-graph skill)
7. Story 19.7 (LLM contract validation + tests) — depends on all above

---

## Epic 20: Software Quality Assurance (SQA) Agent — Gad (Phase 3)

**Goal:** Deliver a dedicated Software Quality Assurance agent (Gad) that provides structured quality workflows for projects managed with the ma-agents/BMAD stack. The agent presents a menu of quality-focused workflows; the initial release includes a multi-dimensional Project Audit and an IEEE/ISO/IEC 12207 lifecycle process compliance assessment.

**Value:** Closes the quality verification gap in the BMAD lifecycle. Today there is no agent that looks across planning artifacts, sprint state, and process compliance together. Gad gives quality engineers and project managers a single entry point to answer "how healthy is this project, really?" and "does this project meet recognized lifecycle standards?"

**PRD Coverage:** FR158–FR171, NFR42–NFR43 (Architecture Decision P3-2)

**Status:** Planned

**Dependencies:**
- Epic 15 (BMAD 6.2.0 Agent Architecture Migration) must be complete — Gad's skills use the P2-9 BMAD 6.2.0 skill folder pattern
- Epic 11 (Bug Management System) must be complete — Story 20.3 invokes `create-bug-story` for gap remediation (FR171)

---

### Story 20.1 — SQA Agent Skill: Gad Persona and Menu

**As a** quality engineer,
**I want** to activate the Gad SQA agent from within a BMAD session,
**so that** I have a dedicated quality assurance persona with a structured menu of QA workflows available.

**Acceptance Criteria:**

1. `lib/bmad-extension/skills/bmad-ma-agent-sqa/SKILL.md` exists and fully defines the Gad agent persona: role, identity, communication style, and principles
2. `lib/bmad-extension/skills/bmad-ma-agent-sqa/bmad-skill-manifest.yaml` exists with `type: agent`, `name: bmad-ma-agent-sqa`, `displayName: Gad`, `title: Software Quality Assurance Expert`, and `module: ma-skills`
3. The SKILL.md activation sequence follows the standard BMAD 6.2.0 agent pattern: load config.yaml → greet user → display menu → wait for input → dispatch to skill
4. The menu includes at minimum: Redisplay Menu Help (MH), Chat (CH), Project Audit (AU → `sqa-audit`), IEEE 12207 Compliance (IC → `sqa-ieee12207`), Dismiss Agent (DA)
5. `lib/bmad-extension/module-help.csv` contains an entry for `bmad-ma-agent-sqa` in the `anytime` phase under module `ma-skills`
6. `lib/bmad-extension/skills/bmad-ma-agent-sqa/.gitkeep` exists
7. `test/extension-module-restructure.test.js` includes `bmad-ma-agent-sqa` in the expected agent skills array and passes

**Technical Notes:**
- Gad binds to the `bmm-qa` BMAD built-in agent persona — no new BMAD agent slot is created
- Communication style: clear, precise, structured; findings always include severity levels; observations distinguished from blocking issues
- No new BMAD agent host customization files needed — the `lib/bmad-customize/bmm-qa.customize.yaml` existing skill-enforcement hooks are sufficient

---

### Story 20.2 — Project Audit Workflow Skill

**As a** quality engineer,
**I want** Gad to run a structured project audit across multiple quality dimensions,
**so that** I can identify gaps in traceability, process compliance, sprint health, and release readiness in a single structured session.

**Acceptance Criteria:**

1. `lib/bmad-extension/skills/sqa-audit/SKILL.md` exists and implements the full five-step audit workflow:
   - Step 1: Scope selection — asks full vs. partial, lists all five dimensions by number, waits for user input
   - Step 2: Data collection — reads all required artifacts, reports which were found vs. missing before proceeding
   - Step 3: Executes only the selected dimensions (1–5 as described below)
   - Step 4: Compiles a full audit report in the specified format
   - Step 5: Saves the report to `{output_folder}/sqa-audit-report-{YYYY-MM-DD}.md` and confirms the path to the user
2. Dimension 1 (Code ↔ Stories): reads done/in-progress items from sprint-status.yaml, lists each story with traceability status, flags stories with no code evidence and code with no story
3. Dimension 2 (Stories ↔ Architecture/PRD): produces a PRD coverage table (COVERED / MISSING / PARTIAL per requirement) and an architecture compliance issue list
4. Dimension 3 (Process Compliance): evaluates commit convention adherence, branch discipline, test file presence, and code review evidence; produces a checklist with PASS / FAIL / UNKNOWN per item
5. Dimension 4 (Sprint Health): produces a per-sprint summary table (total, done, in-progress, not started, completion %) and flags stalled items, blockers, and backlog grooming issues
6. Dimension 5 (Release State): produces a READY / AT RISK / NOT READY release readiness summary, lists blocking items, and records deployment status per environment as provided by the user
7. Report format: executive summary → per-dimension findings with severity (FAIL / WARNING / PASS) → prioritized action items table → skipped dimensions with required artifacts
8. Severity aggregation: any FAIL → overall FAIL; no FAIL but any WARNING → WARNING; all PASS or SKIPPED → PASS
9. After saving the report, Gad asks the user if they want to drill into any finding or take action on issues (FR171 gap remediation offered for FAIL items)
10. `lib/bmad-extension/skills/sqa-audit/bmad-skill-manifest.yaml` exists with `type: skill`, `name: sqa-audit`, `module: ma-skills`
11. `lib/bmad-extension/module-help.csv` contains an entry for `sqa-audit` in the `4-implementation` phase under module `ma-skills`
12. `test/extension-module-restructure.test.js` includes `sqa-audit` in `expectedSqaSkills` and passes

**Technical Notes:**
- Required artifact reads: `_bmad/bmm/config.yaml` (resolve output_folder), `prd.md`, `architecture.md`, `epics.md`, `sprint-status.yaml`; optional: `project-context.md`
- Dimension skips gracefully when an artifact is missing — produces a SKIPPED entry in the report with the artifact path that was not found
- Report is saved as markdown; no HTML or external rendering required

---

### Story 20.3 — IEEE/ISO/IEC 12207 Compliance Workflow Skill

**As a** quality engineer or project manager,
**I want** Gad to evaluate the project's compliance with IEEE/ISO/IEC 12207:2017,
**so that** I have a structured compliance posture report with gap analysis and recommended corrective actions.

**Acceptance Criteria:**

1. `lib/bmad-extension/skills/sqa-ieee12207/SKILL.md` exists and implements the full five-step compliance workflow:
   - Step 1: Scope selection — presents the four process groups, asks full vs. selected, waits for user input
   - Step 2: Data collection — reads all required artifacts, reports found vs. missing
   - Step 3: Evaluates all 23 process areas in selected groups with per-area ratings
   - Step 4: Compiles the compliance matrix report in the specified format
   - Step 5: Saves the report to `{output_folder}/sqa-ieee12207-report-{YYYY-MM-DD}.md`, confirms path, and offers to create backlog stories for P1 gaps (FR171)
2. The four process groups and their process areas are correctly modeled in the SKILL.md:
   - Technical Processes (11 areas: 6.4.1–6.4.11)
   - Technical Management Processes (8 areas: 6.3.1–6.3.8)
   - Agreement Processes (2 areas: 6.1.1–6.1.2)
   - Organizational Enabling Processes (2 areas: 6.2.1, 6.2.7)
3. Each evaluated process area maps to specific project artifacts as evidence sources (e.g., 6.4.2 Stakeholder Requirements → prd.md; 6.3.5 Configuration Management → git history, CHANGELOG, version files)
4. Each area receives one of five ratings: COMPLIANT, PARTIAL, NON-COMPLIANT, NOT APPLICABLE, ORGANIZATION-SCOPE — with the rating justified by evidence found or absent
5. Report includes: executive summary, per-group compliance matrix (clause | process area | rating | key evidence | gaps), gap analysis (critical gaps vs. partial compliance), prioritized recommended-action table (priority, action, clause, effort), compliance summary table (counts per group + overall compliance percentage)
6. When the user confirms gap-to-story creation, Gad iterates over P1 (NON-COMPLIANT) gaps and offers to invoke `create-bug-story` for each — one story per gap
7. All evaluation logic and process area definitions are embedded in SKILL.md — no network access required (NFR43)
8. `lib/bmad-extension/skills/sqa-ieee12207/bmad-skill-manifest.yaml` exists with `type: skill`, `name: sqa-ieee12207`, `module: ma-skills`
9. `lib/bmad-extension/module-help.csv` contains an entry for `sqa-ieee12207` in the `4-implementation` phase under module `ma-skills`
10. `test/extension-module-restructure.test.js` includes `sqa-ieee12207` in `expectedSqaSkills` and passes

**Technical Notes:**
- The workflow is a compliance *posture* assessment, not a formal certification — it produces a structured report based on available project artifacts; it makes no claim of organizational-level ISO certification
- Organizational Enabling Processes (Group 4) are assessed from project artifacts only where possible; remaining items are automatically rated ORGANIZATION-SCOPE with a note explaining what organizational evidence would be needed
- Gap-to-story creation is optional and per-item — the user can accept or skip each P1 gap individually

---

### Story 20.4 — Test Suite Update for SQA Skills

**As a** developer,
**I want** the extension module restructure test to verify the SQA skills exist and are registered,
**so that** future changes that accidentally remove or misconfigure SQA skills are caught by the automated test suite.

**Acceptance Criteria:**

1. `test/extension-module-restructure.test.js` includes `expectedSqaSkills = ['sqa-audit', 'sqa-ieee12207']`
2. `bmad-ma-agent-sqa` is included in `expectedAgentSkills`
3. All skill directory count tests are updated to reflect the 3 new directories (agent + 2 workflow skills): total skill count is previous count + 3
4. All CSV row count tests are updated to reflect the 3 new `module-help.csv` entries: total CSV row count is previous count + 3
5. New test `'all 2 SQA skill directories exist'` verifies both `sqa-audit` and `sqa-ieee12207` directories exist in `lib/bmad-extension/skills/`
6. New test `'CSV has entries for all 2 SQA skills'` verifies both workflow skills are in `module-help.csv`
7. All tests in `test/extension-module-restructure.test.js` pass with 0 failures after these changes

**Technical Notes:**
- This story has no runtime behavior — it is test-only
- The `.gitkeep` files required in each new skill directory must be present for the existing `.gitkeep` coverage test to pass

---

### Epic 20 — Cross-Epic Notes

**Relationship to Epic 15 (BMAD 6.2.0 Agent Architecture Migration):**
Gad follows the SKILL.md-based agent pattern established by Epic 15. Epic 15 must be complete before Story 20.1 to ensure the agent folder structure and BMAD agent dispatch mechanism are stable.

**Relationship to Epic 11 (Bug Management System):**
Story 20.3 invokes `create-bug-story` for IEEE 12207 P1 gaps (FR171). Epic 11 must be complete — specifically Story 11.2 (BMAD extension workflow for bug story creation) — before this feature of Story 20.3 is active.

**Relationship to Epic 17 (Sprint Management Model Rework):**
Story 20.2 reads `sprint-status.yaml` for Sprint Health analysis. The unified schema established by Epic 17 (FR133–FR135) defines the file structure that the audit workflow depends on.

**File outputs produced by this epic:**
```
lib/
└── bmad-extension/
    └── skills/
        ├── bmad-ma-agent-sqa/
        │   ├── .gitkeep
        │   ├── SKILL.md
        │   └── bmad-skill-manifest.yaml
        ├── sqa-audit/
        │   ├── .gitkeep
        │   ├── SKILL.md
        │   └── bmad-skill-manifest.yaml
        └── sqa-ieee12207/
            ├── .gitkeep
            ├── SKILL.md
            └── bmad-skill-manifest.yaml

_bmad-output/                          (generated at runtime, not committed)
├── sqa-audit-report-{date}.md
└── sqa-ieee12207-report-{date}.md
```

**Development Execution Order:**
1. Story 20.4 (test suite update) — can be written first as a failing test to drive implementation
2. Story 20.1 (Gad agent skill) — no dependency on other Epic 20 stories; establishes the agent entry point
3. Story 20.2 (Project Audit workflow) — no dependency on 20.1 at the code level; can develop in parallel with 20.1
4. Story 20.3 (IEEE 12207 workflow) — no dependency on other Epic 20 stories; can develop in parallel with 20.1 and 20.2


---

## Epic 21: On-Prem / Local-LLM Tuning (Phase 3)

The primary deployment scenario for ma-agents is an air-gapped enterprise network running a local non-Claude LLM (e.g., Nemotron Super 49B) behind one of the supported coding agents (Claude Code, Cline, Roo Code, OpenCode). Field experience documented in `optimizing-local-llm-coding-agents-bmad.md` shows local LLMs misinterpret Claude-tuned system prompts: they create files when asked questions, dump output into `~/.claude/`, hallucinate Claude Code's `str_replace_editor` tool, skip BMAD planning to start coding, and overthink simple prompts because reasoning mode is on by default. This epic adapts the installer-generated configuration so on-prem installs activate the application-layer guardrails the host tools already provide (Roo Code `fileRegex` restrictions, OpenCode permission gating, Cline Architect mode discipline) and inject local-LLM-aware system prompts.

Two layers are introduced via a single install-time **profile** prompt persisted in `.ma-agents.json`:

- **Universal** (all profiles): expanded per-tool instruction injection enforcing text-vs-file discipline and BMAD phase boundaries; new `.roomodes` template defining 4 BMAD modes with `fileRegex` restrictions; expanded `AGENTS.md` for OpenCode; expanded `.clinerules`.
- **On-prem** (profile=on-prem only): `/no_think` planning prefix, no-home-dir-writes rule, no-`str_replace_editor` rule, BMAD persona phase-aware system-prompt prefixes.

Inference-server tuning (vLLM flags, quantization) ships as documentation only at `docs/deployment/vllm-nemotron.md` — the installer does not manage the serving stack.

### Story 21.1: Install-Time Profile Prompt and Persistence

As an **engineer running `npx ma-agents install`**,
I want the installer to ask whether this is an on-prem / air-gapped install once and remember my answer,
So that on-prem-specific guardrails activate without me having to remember a CLI flag, and I am not re-prompted on subsequent installs.

**Acceptance Criteria:**

**Given** `npx ma-agents install` runs interactively in a project with no existing `.ma-agents.json` profile entry
**When** the install wizard reaches the profile step
**Then** the user is shown the prompt:
```
? Is this an on-prem / air-gapped install using a local LLM (e.g. Nemotron)?
  > Yes — apply local-LLM guardrails (recommended for non-Claude models)
    No  — standard install (Claude on web, Anthropic API, etc.)
```
**And** the chosen value is persisted as `"profile": "on-prem"` or `"profile": "standard"` in `.ma-agents.json`

**Given** `.ma-agents.json` already contains a `"profile"` value from a previous install
**When** `npx ma-agents install` runs again
**Then** the prompt is NOT shown
**And** the persisted profile is used to drive instruction generation
**And** the resolved profile is logged once at the start of the install (e.g., `Using profile: on-prem (from .ma-agents.json)`)

**Given** `--yes` is passed and there is no persisted profile
**When** the installer runs
**Then** the profile defaults to `standard`
**And** no prompt is shown
**And** `standard` is persisted to `.ma-agents.json`

**Technical notes:**
- Implement a new module `lib/profile.js` exposing `getProfile(projectRoot)`, `setProfile(projectRoot, value)`, and `resolveProfile({ persisted, yesMode })`. All call sites (installer, customize-loader) go through this module — no direct reads/writes from elsewhere
- Wizard prompt uses the same prompt library already used by other install questions (consistent UX)
- `.ma-agents.json` schema gains an optional top-level `"profile"` field; absence is treated as unset, not as `standard` (forces explicit choice on first install)

---

### Story 21.2: Universal Per-Tool Instruction Block Expansion

As a **chief architect**,
I want the existing `<!-- MA-AGENTS-START -->` injection block to enforce text-vs-file discipline and BMAD phase boundaries for every install (regardless of profile),
So that all coding agents — even Claude on the web — stop dumping random files as responses and stop skipping BMAD planning to start coding.

**Acceptance Criteria:**

**Given** the universal instruction-block template `lib/templates/instruction-block-universal.template.md`
**When** the file is created
**Then** it includes (in addition to the current MANIFEST loading instruction):
- A "respond in TEXT vs. create FILES" rules section listing concrete keyword triggers (`create`, `write`, `generate`, `build`, `implement` → file action; `what do you think`, `how should we`, `discuss`, `opinion` → text response)
- An "if unsure, respond in text" default
- A "never create response.md or output.md as a reply" rule
- A BMAD phase discipline rule: respect the current phase declared in the conversation; do not skip ahead to implementation during planning
- A "confirm file paths before writing" rule

**Given** any agent with markdown instruction injection (Claude Code, Cline, Roo Code rules, Cursor, Kilocode, Copilot, Gemini)
**When** the installer runs (any profile)
**Then** the universal block content is rendered between `<!-- MA-AGENTS-START -->` / `<!-- MA-AGENTS-END -->` markers in that agent's instruction file
**And** content outside the markers is preserved byte-for-byte

**Given** the same profile and project state
**When** the installer runs twice in a row
**Then** the content within the marker block is byte-identical between runs (NFR46)

**Technical notes:**
- The injection function in `lib/installer.js` composes: `[universal block]` + `(profile === 'on-prem' ? [on-prem block] : '')`. Story 21.6 wires the on-prem layer; this story only requires the universal block render correctly with an empty on-prem layer
- The block must NOT mention `/no_think`, `str_replace_editor`, `~/.claude/`, or any local-LLM-specific concept — those belong in the on-prem template (Story 21.6)

---

### Story 21.3: `.roomodes` Template with BMAD Mode File-Regex Restrictions

As a **chief architect**,
I want a `.roomodes` file generated for Roo Code installs defining 4 BMAD modes with `fileRegex` restrictions per phase,
So that Roo Code's application-layer enforcement (`FileRestrictionError`) prevents agents from editing code files during planning phases — independent of whether the LLM follows the prompt.

**Acceptance Criteria:**

**Given** the template `lib/templates/roomodes.template.yaml`
**When** the file is created
**Then** it defines four `customModes`:
- `bmad-pm` — read + edit restricted to `\.md$`
- `bmad-architect` — read + edit restricted to `\.(md|xml|drawio)$`
- `bmad-techlead` — read + edit restricted to `\.(md|json|yaml|yml)$`
- `bmad-dev` — read + edit + command (full access)
**And** each mode has a `roleDefinition`, `whenToUse`, and `customInstructions` block matching the BMAD phase descriptions in the source playbook

**Given** the Roo Code agent is included in a `npx ma-agents install`
**When** the installer runs
**Then** `.roomodes` is written at the project root with the 4 BMAD modes
**And** if `.roomodes` already exists with user-defined `customModes`, those entries are preserved as long as their slugs do not collide with the 4 ma-agents BMAD slugs (FR176)
**And** colliding slugs are overwritten with the ma-agents version (with a console warning naming the slug)

**Given** the user is in `bmad-architect` mode in Roo Code after install
**When** the agent attempts to edit a `.ts` or `.py` file
**Then** Roo Code rejects the edit with `FileRestrictionError` (NFR47 — verified via integration test)

**Technical notes:**
- `lib/agents.js` for the Roo Code entry gains a new optional field `extraInstructionTemplates: [{ template: 'roomodes.template.yaml', target: '.roomodes', merger: 'yaml-customModes' }]`
- New YAML merger function `mergeRoomodes(existingYaml, templateYaml)` lives in `lib/installer.js` (or a new `lib/merge/roomodes.js` if size warrants)
- Slug collision handling: only the 4 ma-agents-owned slugs (`bmad-pm`, `bmad-architect`, `bmad-techlead`, `bmad-dev`) are managed by ma-agents; all other entries are preserved untouched

---

### Story 21.4: Expanded `AGENTS.md` Template for OpenCode

As an **OpenCode user installing ma-agents**,
I want a comprehensive `AGENTS.md` generated at my project root covering text-vs-file rules, BMAD phase discipline, and the project's BMAD output structure,
So that OpenCode's auto-loading of AGENTS.md gives the agent the same guardrails Roo Code gets via `.roomodes`.

**Acceptance Criteria:**

**Given** the template `lib/templates/agents-md.template.md`
**When** the file is created
**Then** it includes:
- The same text-vs-file rules from the universal block
- A "never create files in `~/.claude/` or any user home directory" rule (this is universal for AGENTS.md regardless of profile, because OpenCode + any model should respect it)
- A BMAD phase declaration section (Discovery/PM, Architecture, Tech Lead/Stories, Implementation) with phase-specific behavior rules
- The project BMAD output structure (`/docs/bmad/planning/`, `/docs/bmad/architecture/`, etc., adjusted to the project's actual `_bmad-output/` paths via stamping)

**Given** the OpenCode agent is included in `npx ma-agents install`
**When** the installer runs
**Then** `AGENTS.md` is written at the project root using the existing additive injection pattern (markers preserved if file exists)
**And** the `opencode.json::instructions[]` array gets `AGENTS.md` appended via the existing JSON-merge from Epic 9 if not already present (NFR18 still satisfied — additive only)

**Technical notes:**
- The phase declaration content is the same in both standard and on-prem profiles (universal layer); on-prem-specific bits (reasoning mode, `/no_think`) come via Story 21.6
- Reuses Epic 9's JSON-merge function unchanged

---

### Story 21.5: Expanded `.clinerules` Template

As a **Cline user**,
I want `.clinerules` to include BMAD phase discipline and text-vs-file rules,
So that Cline (which already supports `.clinerules` natively) gets the same universal guardrails.

**Acceptance Criteria:**

**Given** the template `lib/templates/clinerules.template.md`
**When** the file is created
**Then** it includes the universal text-vs-file rules and BMAD phase rules, formatted for the Cline `.clinerules` convention

**Given** Cline is included in `npx ma-agents install`
**When** the installer runs
**Then** `.clinerules` is written/updated at the project root using the marker-based additive injection
**And** existing user content outside markers is preserved

**Technical notes:**
- Cline currently writes to `.cline/clinerules.md` AND `.clinerules` (per `lib/agents.js`). This story keeps both in sync; both files contain the same expanded content

---

### Story 21.6: On-Prem Layered Guardrails

As an **engineer running an on-prem install**,
I want the installer to layer local-LLM-specific guardrails on top of the universal block when profile=on-prem,
So that Nemotron and other local LLMs stop hallucinating `str_replace_editor`, dumping files into `~/.claude/`, and overthinking planning prompts.

**Acceptance Criteria:**

**Given** the template `lib/templates/instruction-block-onprem.template.md`
**When** the file is created
**Then** it contains:
- A `/no_think` reasoning-OFF directive applied as a system-prompt prefix for planning-phase use
- A "NEVER create files in `~/.claude/` or any user home directory; all files go under the project directory" rule
- A "do NOT reference or use `str_replace_editor` or any Claude Code-specific tool that may not exist in this agent" rule
- Reasoning-mode and sampling guidance per BMAD phase (planning: reasoning OFF, low temperature; implementation: reasoning ON, moderate temperature)

**Given** profile=on-prem
**When** any agent's instruction-block injection runs
**Then** the universal block content is followed by the on-prem block content within the same `<!-- MA-AGENTS-START -->` markers

**Given** profile=standard
**When** any agent's instruction-block injection runs
**Then** the on-prem block is NOT present in the rendered output (NFR44 — verified by absence of the strings `/no_think`, `str_replace_editor`, `~/.claude/` in standard-profile output)

**Technical notes:**
- The `.roomodes`, `AGENTS.md`, and `.clinerules` files from Stories 21.3–21.5 also gain on-prem-specific sections gated by profile — concretely, the `customInstructions` block per Roo Code mode and the AGENTS.md "Critical Behavior Rules" section get the on-prem rules appended when profile=on-prem
- All on-prem additions are appended within ma-agents marker blocks or ma-agents-owned slugs only

---

### Story 21.7: BMAD Persona Phase-Aware Prompt Prefix (On-Prem Only)

As an **engineer running an on-prem install with the BMAD module**,
I want each BMAD agent persona to receive a phase-aware system-prompt prefix steering its reasoning mode appropriately,
So that planning agents (PM, Architect, SM) stop overthinking and producing files for discussion prompts, and implementation agents (Dev) keep their reasoning mode for careful coding.

**Acceptance Criteria:**

**Given** profile=on-prem
**When** the BMAD customize-loader composes a persona's system prompt from `lib/bmad-customize/{agent}.customize.yaml`
**Then** a phase-aware prefix is prepended:
- Planning personas (`bmm-pm` John, `bmm-architect` Winston, `bmm-sm` Bob, `bmm-analyst` Mary, `bmm-tech-writer` Paige, `bmm-ux-designer` Sally, `bmm-qa` Gad) — receive a `/no_think` + "respond in text for questions; create files only when explicitly asked" prefix
- Implementation personas (`bmm-dev` Amelia, `bmm-quick-flow-solo-dev` Barry) — receive a "think carefully before writing code; reference the story you are implementing" prefix

**Given** profile=standard
**When** the customize-loader composes a persona's system prompt
**Then** NO phase prefix is prepended (NFR44 — standard profile is byte-identical to pre-Epic-21 baseline for customize output)

**Given** the `lib/bmad-customize/*.customize.yaml` files are committed
**When** Story 21.7 is implemented
**Then** the YAML files themselves contain a new optional `on_prem_phase_prefix:` field (per agent) with the prefix text — the customize-loader reads this field only when profile=on-prem, so the YAML files remain valid for both profiles

**Technical notes:**
- Phase classification (planning vs. implementation) is encoded in the `.customize.yaml` via a simple `phase: planning|implementation` field, not derived from agent slug — keeps the loader stateless
- The phase prefix block is prepended to the persona's existing `critical_actions` / system-prompt content; all prior content is preserved

---

### Story 21.8: vLLM Reference Deployment Doc and README On-Prem Section

As a **DevOps engineer setting up the on-prem inference server**,
I want a single reference doc covering vLLM flags, tool-call-parser, context length, quantization, and per-phase sampling guidance,
So that I can configure Nemotron Super 49B (or similar) to behave correctly with the coding agents ma-agents installs.

**Acceptance Criteria:**

**Given** the file `docs/deployment/vllm-nemotron.md`
**When** the file is created
**Then** it covers:
- Recommended vLLM flags (`--enable-auto-tool-choice`, `--tool-call-parser qwen3_coder`, `--max-model-len 32768`, `--enforce-eager`, `--trust-remote-code`)
- Quantization tradeoffs (BF16 vs FP8 vs NVFP4) including VRAM and instruction-following quality impact
- Reasoning-mode behavior (`/no_think` system-prompt directive, default reasoning ON)
- Per-phase sampling parameters table (planning: temp 0.0, top_p 1.0; implementation: temp 0.6, top_p 0.95)
- The `str_replace_editor` hallucination warning and mitigation
- A complete sample launch command

**Given** the README is updated
**When** Story 21.8 completes
**Then** README has a new "On-Prem / Air-Gapped Deployment" section linking to the deployment doc and explaining the install-time profile prompt
**And** the deployment doc is NOT stamped into target projects by the installer (it is repo documentation only — FR179)

---

### Story 21.9: Tests and Validation

As a **chief architect**,
I want automated regression tests for the profile system and the universal/on-prem instruction-block injection,
So that future changes to installer or templates do not silently regress on-prem support or break standard installs.

**Acceptance Criteria:**

**Given** the test suite in `test/`
**When** Story 21.9 completes
**Then** the suite includes:
- `test/profile.test.js` — covers `getProfile`, `setProfile`, `resolveProfile` precedence (CLI flag > persisted > yes-default), persistence round-trip, missing-file handling
- `test/onprem-injection.test.js` — covers (a) standard profile produces no on-prem-specific strings; (b) on-prem profile produces both universal + on-prem content; (c) idempotency — two consecutive installs produce byte-identical marker-block content; (d) `.roomodes` slug-collision: ma-agents BMAD slugs overwrite, non-colliding user slugs preserved; (e) NFR47 enforcement contract — `bmad-architect` `fileRegex` rejects `.ts`/`.py` paths

**Given** all Epic 21 stories are merged
**When** the full test suite runs
**Then** all new tests pass
**And** existing tests in `test/` still pass (no regression)

**Technical notes:**
- NFR47 enforcement test does not require running Roo Code itself — verifies that the generated `.roomodes` `fileRegex` patterns match the expected restrictions (the actual `FileRestrictionError` is enforced by Roo Code at runtime; the contract under test is that we generate the correct restriction)

### Story 21.10: Profile Reconfigure

As an **engineer who needs to change a previously-persisted profile**,
I want a `ma-agents reconfigure` subcommand that re-runs the profile prompt and re-stamps all profile-dependent artifacts,
So that a CI-default `standard` profile or a mistaken interactive answer can be corrected without hand-editing `.ma-agents.json`.

**Acceptance Criteria:**

**Given** a project with `.ma-agents.json` containing `"profile": "standard"` (perhaps auto-persisted by a CI `--yes` run)
**When** the engineer runs `npx ma-agents reconfigure` interactively
**Then** the profile-selection prompt appears with the currently-persisted value as the default highlighted option
**And** the user can switch to `on-prem` and confirm

**Given** the user changes the profile from `standard` to `on-prem` (or vice versa)
**When** `reconfigure` proceeds after the confirmation prompt
**Then** all profile-dependent artifacts are re-stamped (instruction-block injection files, `.roomodes`, BMAD persona customize output)
**And** each to-be-overwritten marker-block region is backed up to `<target>.backup-<ISO-timestamp>`
**And** a history entry `{ date, from, to, source: "reconfigure" }` is appended to `.ma-agents.json::profileHistory` (new field, capped at 20 entries)

**Given** `--yes` is passed to `reconfigure`
**When** the command runs
**Then** it exits nonzero with the message `--yes is not valid for reconfigure — this command is interactive by design to prevent accidental CI-triggered profile changes.`
**And** no files are modified

**Given** the user-edited `.roomodes` ma-agents-owned slugs have diverged from the template
**When** `reconfigure` runs without `--force-roomodes-overwrite`
**Then** it aborts with `RoomodesSlugDivergenceError` per Story 21.3 AC #9

**Technical notes:**
- New CLI subcommand `reconfigure` in `bin/cli.js`
- New orchestrator module `lib/reconfigure.js` — composes prompt, injection re-stamp, backup, history append
- Reuses `lib/profile.js` (unchanged public contract); reuses injection helpers from `lib/installer.js`
- `.ma-agents.json` gains optional top-level `"profileHistory"` field (append-only, capped at 20)
- Detailed spec: `_bmad-output/implementation-artifacts/21-10-profile-reconfigure.md`

---

### Story 21.11: Profile Uninstall

As an **engineer migrating a project away from ma-agents or switching from on-prem to a different deployment model**,
I want a `ma-agents uninstall --profile-artifacts` subcommand that removes all ma-agents-owned profile-dependent content while preserving user content,
So that I can cleanly reverse the install without hand-editing every generated file or leaving dead guardrails that no longer reflect the project's actual deployment.

**Acceptance Criteria:**

**Given** a project with ma-agents-stamped content (marker blocks in CLAUDE.md/.clinerules/etc., ma-agents-owned slugs in `.roomodes`, `profile` set in `.ma-agents.json`)
**When** the engineer runs `npx ma-agents uninstall --profile-artifacts` interactively
**Then** the command lists every file and region it will modify and asks for confirmation
**And** after confirmation, all marker-block content (including the markers) is removed, `.roomodes` ma-agents-owned slugs are removed (user slugs preserved), and the `profile` field is cleared from `.ma-agents.json`

**Given** each to-be-removed file or region
**When** `uninstall --profile-artifacts` proceeds
**Then** a backup is written to `<target>.backup-<ISO-timestamp>` before removal

**Given** the `profileHistory` field from Story 21.10 or the `roomodesOverwriteLog` field from Story 21.3
**When** `uninstall --profile-artifacts` runs
**Then** both fields are PRESERVED (audit trails survive uninstall)
**And** a new entry `{ date, from: <previous>, to: null, source: "uninstall" }` is appended to `profileHistory`

**Given** `--yes` is passed to `uninstall --profile-artifacts`
**When** the command runs in CI
**Then** the confirmation prompt is skipped and the operation proceeds (unlike `reconfigure` where `--yes` is rejected — uninstall has legitimate CI use cases such as decommissioning scripts)

**Technical notes:**
- New CLI flag `--profile-artifacts` on the `uninstall` subcommand (creates the subcommand if not already present)
- New orchestrator module `lib/uninstall.js` exporting `uninstallProfileArtifacts(projectRoot, opts)`
- Expands `lib/profile.js` with a 4th export `clearProfile(projectRoot)` — see Dev Notes in the story spec for the Story 21.1 AC #1 contract-update decision
- Idempotent: second run is a no-op with friendly message
- Detailed spec: `_bmad-output/implementation-artifacts/21-11-profile-uninstall.md`

---

### Epic 21 — Cross-Epic Notes

- **bmad.js coordination:** Epic 21 does not modify `bmad.js`. The cross-epic `bmad.js` ordering note (Epics 5/15/6/8) is unaffected.
- **OpenCode JSON-merge (Epic 9) reuse:** Story 21.4 reuses Epic 9's `mergeOpencodeJson()` unchanged — additive append to `instructions[]`. NFR18 remains satisfied.
- **Roo Code agent registration (Epic 18) prerequisite — STATUS: satisfied.** Story 21.3 depends on Roo Code being registered in `lib/agents.js`. As of 2026-04-14, `lib/agents.js` already has the Roo Code entry (Story 18.1 was completed at the code level ahead of Epic 18's formal tracking). Story 21.3 is NOT blocked by Epic 18. The remaining Epic 18 stories (18.2-18.8) do not interact with Epic 21 and can proceed independently.
- **Customize-loader (Epic 15) prerequisite — STATUS: clarified.** Story 21.7 was originally scoped as if ma-agents owned a customize-loader. On audit (2026-04-14), `lib/bmad-customize/` contains only `*.customize.yaml` artifacts — the loader itself lives upstream in BMAD. Per the project's durable policy of overriding BMAD built-ins via extension rather than upstream PRs, Story 21.7's `phase: mixed` enum extension (added in corrective-plan step 3) will be implemented via the extension pattern: the `*.customize.yaml` files gain the `phase` field and, if BMAD's upstream loader rejects unknown values, the ma-agents extension intercepts the YAML at install time and produces two variants (`*.customize.yaml` and `*.customize.on-prem.yaml`) with the installer choosing based on the persisted profile. See Story 21.7 Dev Notes "Notes on Customize-Loader Discovery" for the decision branches the implementing dev will resolve during Task 1.
- **Knowledge graph (Epic 19) interaction:** None. Epic 21 does not emit graph nodes/edges.
---

## Epic 22: BMAD v6.3.0 Plugin Migration (Phase 4)

**Goal:** Migrate ma-agents from BMAD-METHOD v6.2.2 to v6.3.0, replacing the post-install manifest-surgery pattern (`applyCustomizations()` in `lib/bmad.js:205-346`) with a pre-install local plugin staging flow that uses BMAD's PluginResolver (local-file strategy). The air-gapped self-containment guarantee is preserved end-to-end via bundled plugin assembly at build time and project-local staging at install time. Multi-tool routing (Claude Code, Copilot, Cline, Roo Code, KiloCode) is preserved.

**Value:** Aligns ma-agents with the canonical BMAD v6.3.0 extension model, deletes ~140 lines of fragile manifest-parsing workarounds, vacates the upstream-reserved `bmad-*` skill prefix, and retires three persona skills (Quinn/Bob/Barry) that upstream consolidated into Amelia. Sets up the project to track future BMAD releases without re-implementing the same workarounds each time.

**PRD Coverage:** FR182–FR192 (Phase 4, in scope), NFR50–NFR54 (Architecture Decision P4-1)

**Out of scope:** FR193–FR195 (memory-agent conversion for Demerzel and Gad) — deferred to Epic 23.

**Status:** Planned

**Dependencies:**
- Epic 5 (Bundled BMAD Installation) must be complete — Epic 22 modifies the same bundled-cache + invocation pipeline
- Epic 15 (BMAD 6.2.0 Agent Architecture Migration) must be complete — Epic 22 builds on the v6.2.0 module/skill structure
- Epic 17 (Sprint Management Model Rework) and Epic 20 (SQA Agent — Gad) recommended complete — Epic 22's rename sweep touches every skill in the extension module

**Cross-epic touch:** `lib/bmad.js` is shared with Epic 5 (P2-6) and Epic 15 (P2-9). The replacement of `applyCustomizations()` in Story 22.6 supersedes those code paths — coordinate with any in-flight branches against `lib/bmad.js`.

---

### Story 22.1 — Bump bmad-method to 6.3.0 and Rebuild Cache

**As a** ma-agents maintainer,
**I want** the bundled bmad-method dependency upgraded from 6.2.2 to 6.3.0 and `lib/bmad-cache/` rebuilt against the new version,
**so that** all downstream stories in Epic 22 can rely on v6.3.0 module structure and behavior.

**Acceptance Criteria:**

1. `package.json` declares `"bmad-method": "6.3.0"` (exact pin, no caret/tilde)
2. `lib/bmad-cache/cache-manifest.json` records `bmadMethodVersion: 6.3.0`
3. `npm run build:bmad-cache` (or equivalent) completes without errors and produces an updated `lib/bmad-cache/` containing v6.3.0 module sources for `bmb`, `cis`, `tea`, `gds`, `wds`
4. `scripts/build-bmad-cache.js` is updated for any v6.3.0-only registry path changes (e.g., if `external-official-modules.yaml` moved location upstream)
5. `npm install` and `npm test` both pass against the new dependency
6. `_bmad/_config/manifest.yaml` (or wherever the runtime manifest lives) is regenerated and reflects 6.3.0 install metadata after running `npx ma-agents` against a scratch project

**Technical Notes:**
- This story does NOT yet wire up the plugin flow — Stories 22.4–22.6 do that. The intent here is to land the dependency bump cleanly with the existing (still-working in 6.3.0) `applyCustomizations()` path so subsequent stories have a stable baseline
- Expect the existing `applyCustomizations()` to either still work or fail in known ways against 6.3.0 — diagnose and capture findings in the story's Dev Notes for use by Story 22.6
- If 6.3.0 removes any cache module that ma-agents currently bundles, document the removal and confirm with the maintainer before deleting

**PRD Traceability:** FR74 (bumped pin), NFR20 (version pin convention)

---

### Story 22.2 — Skill Namespace Rename Sweep (`bmad-ma-agent-*` → `ma-agent-*`)

**As a** ma-agents maintainer,
**I want** all extension skills renamed out of the upstream-reserved `bmad-*` prefix into a `ma-agent-*` / `ma-*` namespace,
**so that** the extension module no longer collides with the BMAD Builder reserved namespace and the rename is complete before the plugin packaging story.

**Acceptance Criteria:**

1. The five custom-agent skill folders are renamed:
   - `lib/bmad-extension/skills/bmad-ma-agent-cyber/` → `lib/bmad-extension/skills/ma-agent-cyber/`
   - `lib/bmad-extension/skills/bmad-ma-agent-devops/` → `lib/bmad-extension/skills/ma-agent-devops/`
   - `lib/bmad-extension/skills/bmad-ma-agent-sre/` → `lib/bmad-extension/skills/ma-agent-sre/`
   - `lib/bmad-extension/skills/bmad-ma-agent-ml/` → `lib/bmad-extension/skills/ma-agent-ml/`
   - `lib/bmad-extension/skills/bmad-ma-agent-sqa/` → `lib/bmad-extension/skills/ma-agent-sqa/`
2. Each renamed `SKILL.md` updates its frontmatter `name` field and any internal trigger phrases that referenced the old name
3. Each renamed `bmad-skill-manifest.yaml` updates its `name:` field
4. `lib/bmad-extension/module-help.csv` is updated — every row referencing the old skill IDs now uses the new IDs; no row is dropped
5. `.claude/skills/MANIFEST.yaml` (and any other MANIFEST.yaml the installer reads) lists the new IDs only
6. All cross-references in other skills are swept: `Grep` for `bmad-ma-agent-` across the repo returns only doc/history mentions (PRD edit history, this epic file, retrospectives) — no live source references
7. `.ma-agents.json` schema is updated if it stores skill IDs; existing installations are migrated by the installer on next run (idempotent name-change handling)
8. `test/extension-module-restructure.test.js` `expectedAgentSkills` is updated to use new IDs and the test passes
9. Documentation references in `README.md`, `docs/`, and `_bmad-output/` (other than historical edit-history entries) are swept and updated

**Technical Notes:**
- This is a mechanical rename that touches many files — use a scripted sweep (e.g., a one-off Node script or `git mv` + sed) to avoid manual errors, then verify with `grep`
- Do NOT touch BMAD upstream skills that legitimately use the `bmad-` prefix (e.g., `bmad-init`, `bmad-create-prd`) — those are upstream-owned; only sweep our extension's `bmad-ma-agent-*` names
- The historical edit-history entries in PRD/architecture/epics.md refer to the *old* names accurately at the time they were written — leave them intact; do not rewrite history

**PRD Traceability:** FR183 (rename out of reserved namespace)

---

### Story 22.3 — Retire Legacy Skills (bmad-init, Quinn, Bob, Barry)

**As a** ma-agents maintainer,
**I want** the four upstream-removed/consolidated persona skills retired from the ma-agents catalog,
**so that** the MANIFEST stops advertising skills that no longer exist in BMAD v6.3.0 and our agent set tracks the upstream Amelia consolidation.

**Acceptance Criteria:**

1. `.claude/skills/MANIFEST.yaml` no longer contains entries for: `bmad-init`, `bmad-agent-qa`, `bmad-agent-sm`, `bmad-agent-quick-flow-solo-dev`
2. The corresponding skill source folders are removed from `lib/bmad-extension/skills/` and `skills/` (whichever pipelines they exist in)
3. Any `module-help.csv` rows referencing the four retired skills are removed
4. Any cross-references from other skills (e.g., a workflow that says "invoke bmad-agent-qa") are updated to invoke the BMAD Amelia Developer skill instead, or removed if the reference is no longer applicable
5. `bmad-init` callers — any ma-agents skill that previously expected `bmad-init` to populate config — are updated to read `_bmad/bmm/config.yaml` directly (this is also covered by Story 22.7 for non-skill code paths)
6. `README.md` and `docs/` references to Quinn (QA), Bob (SM), and Barry (quick-flow-solo-dev) are either rewritten to reference Amelia or removed
7. `_bmad-output/planning-artifacts/project-context.md` is regenerated (or manually swept) so the agent roster section reflects the retirement
8. Existing user installations: on next `npx ma-agents` run, the installer detects the retired skill IDs in `.ma-agents.json` and removes them cleanly (no orphaned files)

**Technical Notes:**
- Upstream consolidated Quinn (QA), Bob (Scrum Master), and Barry (quick-flow-solo-dev) into a single Amelia Developer agent in BMAD 6.3.0 (PRs #2177, #2179, #2186). Our retirement aligns the ma-agents catalog with that decision
- `bmad-init` was removed because v6.3.0 agents read `_bmad/bmm/config.yaml` directly (PR #2159) — there is no longer a config-loading skill to invoke

**PRD Traceability:** FR190 (retirement), FR191 (doc updates)

---

### Story 22.4 — Build Script for Plugin Assembly (`scripts/build-plugin.js`)

**As a** ma-agents maintainer,
**I want** a deterministic build script that assembles `lib/bmad-extension-plugin/` from `lib/bmad-extension/` source,
**so that** the bundled plugin is reproducible, diff-able, and ready to be staged at install time without per-install assembly logic.

**Acceptance Criteria:**

1. `scripts/build-plugin.js` exists and is invokable via `npm run build:plugin`
2. Running the script with no arguments produces `lib/bmad-extension-plugin/` containing:
   - `.claude-plugin/marketplace.json` (generated from `lib/bmad-extension/module.yaml` + a template; story 22.5 defines the schema)
   - `skills/module.yaml` (BMAD Builder canonical module-definition location)
   - `skills/module-help.csv` (copied from source)
   - One subfolder per skill in `lib/bmad-extension/skills/`, with `SKILL.md`, `bmad-skill-manifest.yaml`, and any `resources/`/`prompts/`/`templates/`/`scripts/` content preserved
3. Re-running the script is idempotent: byte-identical output for byte-identical input. Verified by computing a SHA-256 of the output tree before and after a second run
4. The script fails fast with a non-zero exit code if any required source file is missing (e.g., `lib/bmad-extension/module.yaml` absent)
5. The script does not write outside `lib/bmad-extension-plugin/` and does not modify any source file
6. `lib/bmad-extension-plugin/` is committed to the repo (so it ships in the npm tarball and is diff-able in PRs); the build step is run as part of `npm run prepare` (or equivalent prepublish hook) so a fresh clone produces a current bundle
7. `npm pack` (dry-run) shows `lib/bmad-extension-plugin/` included in the tarball file list

**Technical Notes:**
- Source-of-truth split: hand-edited content lives in `lib/bmad-extension/`; the plugin directory is generated. PRs that touch source must regenerate and commit the plugin, otherwise CI flags drift (Story 22.9 covers the CI check)
- Use only Node.js built-ins (no new dependencies) — keep the build step lightweight and offline-safe
- The marketplace.json content is defined in Story 22.5; this story builds the *plumbing* and emits a placeholder if 22.5 hasn't merged yet

**PRD Traceability:** FR184 (build-time bundling), NFR51 (deterministic staging)

---

### Story 22.5 — Plugin Manifests: `.claude-plugin/marketplace.json` and `skills/module.yaml`

**As a** BMAD installer,
**I want** the ma-agents extension to ship as a BMAD-Builder-compliant plugin with the canonical manifest files,
**so that** I can resolve and install it via `--custom-source <local-path>` using the PluginResolver local-file strategy.

**Acceptance Criteria:**

1. `lib/bmad-extension/.claude-plugin/marketplace.json.template` (source) defines the marketplace manifest fields per BMAD Builder spec: plugin name, version, description, author, modules array (with the ma-skills module entry pointing at `skills/module.yaml`), and any required compatibility fields (BMAD min version, target tools)
2. The template is NOT Claude-specific in content — it includes a `compatible_tools` array enumerating `claude-code, copilot, cline, roo-code, kilocode` (the wrapper filename `.claude-plugin/` is a shared BMAD convention, the contents are tool-agnostic)
3. `lib/bmad-extension/skills/module.yaml` (source) replaces the previous `lib/bmad-extension/module.yaml` location (BMAD 6.2.2+ moved module definitions to `skills/module.yaml`) and contains: `code: ma-skills`, `description`, `module_version`, and any required v6.3.0 schema fields
4. The build script (Story 22.4) reads both source files and emits the resolved files into `lib/bmad-extension-plugin/`
5. Running `npx bmad-method install --custom-source ./lib/bmad-extension-plugin --tools claude-code --yes --directory <scratch-dir>` against a clean scratch project successfully installs the plugin and produces a `.claude/skills/` directory containing the ma-agents skills
6. The same command with `--tools copilot` produces `.github/copilot/skills/` with the same skills (multi-tool parity smoke test — full coverage in Story 22.10)
7. `module_version` is bumped on every release that ships a structural change to skills

**Technical Notes:**
- The `.claude-plugin/marketplace.json` filename is BMAD-Builder convention (Anthropic's plugin spec was adopted as the open shared format) — per BMAD docs: "this format works for any skills-capable platform, not just Claude". Document this in the file's top-level comment so future maintainers don't assume it's Claude-only
- BMAD 6.2.2 moved the module definition from `src/module.yaml` to `skills/module.yaml`. v6.3.0 keeps that location

**PRD Traceability:** FR182 (plugin packaging), FR183 (skills/module.yaml location), FR192 (multi-tool coverage)

---

### Story 22.6 — Replace `applyCustomizations()` with Stage-and-Invoke

**As a** ma-agents installer,
**I want** the post-install manifest-surgery code path replaced with a pre-install local plugin staging flow,
**so that** ma-agents stops parsing BMAD's internal manifests and instead delegates placement to BMAD's own installer via `--custom-source`.

**Acceptance Criteria:**

1. The following code is REMOVED from `lib/bmad.js`:
   - All manifest.yaml / files-manifest.csv hand-parsing logic (`fields[2]` indexing, hardcoded module-name filters like `["custom", "bmb"]`)
   - All custom-agent YAML staging into `_bmad/_config/custom/agents/`
   - The `applyCustomizations()` function and its callers
   - Net deletion target: ≥ 100 lines (architecture P4-1 estimates ~140 lines)
2. A new helper (≤ ~50 lines) in `lib/bmad.js` (or `lib/installer.js`) implements the staging flow:
   - Stage `lib/bmad-extension-plugin/` → `<project>/.ma-agents-plugin-stage/` via a directory copy
   - Invoke `bmad-method install` with `--custom-source <stage-path> --tools <selected> --modules <selected> --yes`
   - On success: remove the stage directory
   - On failure: log the stage path and leave the directory in place for diagnostics
3. The stage copy is a fresh copy on every install (not a symlink) — `<project>/.ma-agents-plugin-stage/` is byte-identical to `lib/bmad-extension-plugin/` after the copy
4. `npx ma-agents install --yes --force` against a scratch project completes successfully and produces a `_bmad/` tree that contains the ma-agents skills in the correct module location, with no remaining custom-agent YAML in `_bmad/_config/custom/agents/`
5. The installer logs: which plugin path was staged, which `--tools` were passed to bmad-method, and (on success) confirmation that the stage directory was cleaned up
6. Existing manifest-cleanup tests (if any) are removed or rewritten to match the new flow

**Technical Notes:**
- Coordinate with any in-flight branches against `lib/bmad.js` — this is the largest code-touching story in the epic
- The stage directory location is project-local on purpose (NFR53): it keeps every install self-contained inside the target project, makes diagnostic inspection easy, and doesn't leave artifacts under user-home
- Failure mode: if bmad-method exits non-zero, leave the stage in place and surface the path to the user — they can re-run or report a bug with a reproducible stage

**PRD Traceability:** FR185, FR186, FR187 (staging flow + cleanup + surgery removal), NFR54 (air-gapped guarantee preserved)

---

### Story 22.7 — Migrate Config Reads to `_bmad/bmm/config.yaml`

**As a** ma-agents installer and skill,
**I want** every read of BMAD-canonical config redirected from `_bmad/_config/*` to `_bmad/bmm/config.yaml`,
**so that** ma-agents aligns with the v6.3.0 canonical config location and the removed `bmad-init` skill is no longer required.

**Acceptance Criteria:**

1. All ma-agents code that previously read `_bmad/_config/manifest.yaml` for canonical BMAD config values now reads `_bmad/bmm/config.yaml`
2. All ma-agents skills in `lib/bmad-extension/skills/` (and `skills/`) that previously declared a dependency on `bmad-init` or assumed config was loaded externally now read `_bmad/bmm/config.yaml` directly at the start of their workflow
3. Path resolution helpers (e.g., resolving `output_folder`, `story_location`) read from the new location
4. ma-agents-owned files that are NOT BMAD-canonical (`.ma-agents.json`, `_bmad-output/project-context.md`) are unaffected — those paths are unchanged
5. A grep for `_bmad/_config/` across the repo returns only references that are intentional (e.g., a backward-compatibility check or a comment explaining the move)
6. Backward compatibility: if `_bmad/bmm/config.yaml` does not exist but `_bmad/_config/manifest.yaml` does (an older install upgrading), the installer either migrates the old file in-place or invokes bmad-method to regenerate the new layout — never reads from the old path silently
7. Test coverage: at least one test asserts the new path is read and the old path is not

**Technical Notes:**
- This story is mostly grep-and-replace plus one migration shim. The grep target is small — only a few code paths and a dozen skills referenced the old location
- Gad's `sqa-audit` and `sqa-ieee12207` skills already read config — make sure they hit the new path post-migration

**PRD Traceability:** FR188 (config path migration)

---

### Story 22.8 — Gitignore the Stage Directory

**As a** developer using ma-agents,
**I want** `.ma-agents-plugin-stage/` ignored by git automatically,
**so that** transient install artifacts never get committed accidentally.

**Acceptance Criteria:**

1. The ma-agents installer ensures `.ma-agents-plugin-stage/` is listed in the target project's `.gitignore` — appended idempotently if not already present, never duplicated on re-run
2. If `.gitignore` does not exist in the target project, the installer creates one with the single entry
3. The installer never modifies any unrelated `.gitignore` line — append-only
4. The ma-agents repo's own `.gitignore` also lists `.ma-agents-plugin-stage/` (so dev-local test installs don't accidentally commit it)
5. Test: a scratch project with an existing `.gitignore` retains all original entries and gains exactly one new line for `.ma-agents-plugin-stage/`

**Technical Notes:**
- Use the same idempotent-append pattern as the existing `_bmad-output` gitignore-policy code (FR58/FR59) — add to the registry of patterns the installer manages, do not rewrite the whole file
- Keep this story tiny — it has a small surface area but is essential for NFR53 compliance

**PRD Traceability:** NFR53 (stage dir not persisted, gitignored)

---

### Story 22.9 — CI Offline Install Gate

**As a** release manager,
**I want** every release candidate verified by an install run with all outbound network egress blocked,
**so that** the air-gapped guarantee (NFR54) cannot regress without CI catching it.

**Acceptance Criteria:**

1. A new CI job (e.g., `.github/workflows/offline-install.yml`) runs on every PR and on every release tag
2. The job:
   - Builds the npm tarball via `npm pack`
   - Spins up a fresh container (or VM) with all outbound network egress blocked (firewall / iptables DROP / `--network none` Docker, depending on runner)
   - Extracts the tarball into the container
   - Runs `npx ma-agents install --yes --force --tools claude-code` in the container against a scratch project
   - Asserts: the install completes with exit code 0, the staged plugin was placed correctly, and no outbound connection was attempted (verified via firewall logs or a deny-all rule that fails the run on egress attempts)
3. The job fails (non-zero exit) on any of: install failure, egress attempt, missing skill in the resulting `_bmad/` tree
4. The job runs in under 5 minutes wall-clock
5. Documentation in `CONTRIBUTING.md` (or equivalent) describes how to reproduce the offline install locally (firewall command + `npm pack` + run instructions)
6. The job is required for merge to `main` (branch protection rule update)

**Technical Notes:**
- Egress-block strategies vary by CI runner — for GitHub Actions, `--network none` on a Docker step is the cleanest. For self-hosted runners, iptables is more portable
- This story does NOT cover multi-tool parity (Story 22.10) — keep this job focused on the egress-block dimension; multi-tool runs in a separate matrix

**PRD Traceability:** NFR50 (offline install gate), NFR54 (air-gapped preservation)

---

### Story 22.10 — Multi-Tool Smoke Verification

**As a** release manager,
**I want** the plugin install flow smoke-verified against multiple `--tools` targets,
**so that** a regression in one tool's skill-directory routing is caught before release rather than by an end user.

**Acceptance Criteria:**

1. A CI matrix job runs the plugin install against (at minimum) `--tools claude-code`, `--tools copilot`, and `--tools cline`. Recommended extension: also `roo-code` and `kilocode` to cover the disconnected-friendly IDE set
2. For each target, the job asserts:
   - `npx ma-agents install --yes --force --tools <target>` completes with exit code 0
   - The target's expected skills directory exists and contains at least one ma-agents skill (e.g., `ma-agent-cyber/SKILL.md`)
   - The MANIFEST file at the target location includes ma-agents skill IDs
3. The matrix runs as part of release verification (release tag) and on PRs that touch `lib/bmad.js`, `lib/agents.js`, `lib/bmad-extension/`, or `lib/bmad-extension-plugin/`
4. Job fails on any single tool's failure (no silent skip)
5. Documentation lists the target tools and the exact assertion per tool

**Technical Notes:**
- The expected skill paths per tool come from `lib/agents.js`:
  - claude-code → `.claude/skills/`
  - copilot → `.github/copilot/skills/`
  - cline → `.cline/skills/`
  - roo-code → `.roo/skills/`
  - kilocode → `.kilocode/skills/`
- This job validates FR192 (multi-tool smoke) and NFR52 (multi-tool parity with the same bundled plugin)
- Combine with Story 22.9 if practical: a matrix that crosses (egress blocked × tool) is a stronger gate than two independent jobs, but split into two if the runtime cost is too high

**PRD Traceability:** FR192, NFR52

---

### Epic 22 — Cross-Epic Notes

**Relationship to Epic 5 (Bundled BMAD Installation):**
Epic 5 established the bundled-cache + npm-tarball self-containment pattern. Epic 22 extends that pattern to a second bundled artifact (`lib/bmad-extension-plugin/`) and replaces the post-install code path that Epic 5 left in `lib/bmad.js`. Coordinate any in-flight Epic 5 stories (5.5, 5.6 are in review) before Story 22.6 lands.

**Relationship to Epic 15 (BMAD 6.2.0 Agent Architecture Migration):**
Epic 15 produced the v6.2.0 skill-folder agent structure that Epic 22 now repackages as a plugin. Epic 15 must be complete; Story 22.5 builds directly on the `module.yaml` schema introduced in Epic 15.

**Relationship to Epic 17 / Epic 20 (skill catalog growth):**
Story 22.2 (rename sweep) touches every custom skill in the extension module. Land Epic 17 and Epic 20 stories first to avoid rebasing the rename across in-flight branches.

**Source-of-truth split introduced:**
- Hand-edited source: `lib/bmad-extension/`
- Generated bundle: `lib/bmad-extension-plugin/` (committed for diff-ability and tarball inclusion)
- Build glue: `scripts/build-plugin.js` (Story 22.4)

**File outputs produced by this epic:**
```
lib/
├── bmad-extension/                               (existing — source of truth, sweeps in 22.2/22.5/22.7)
│   ├── module.yaml                               (REMOVED — moves to skills/module.yaml in 22.5)
│   ├── module-help.csv                           (UPDATED — entries renamed in 22.2, removed in 22.3)
│   ├── .claude-plugin/marketplace.json.template  (NEW — 22.5)
│   └── skills/
│       ├── module.yaml                           (NEW — 22.5)
│       ├── ma-agent-cyber/                       (RENAMED from bmad-ma-agent-cyber in 22.2)
│       ├── ma-agent-devops/                      (RENAMED in 22.2)
│       ├── ma-agent-sre/                         (RENAMED in 22.2)
│       ├── ma-agent-ml/                          (RENAMED in 22.2)
│       └── ma-agent-sqa/                         (RENAMED in 22.2)
├── bmad-extension-plugin/                        (NEW — generated by 22.4, committed)
│   ├── .claude-plugin/marketplace.json
│   ├── skills/module.yaml
│   ├── skills/module-help.csv
│   └── skills/ma-agent-*/                        (one per skill)
└── bmad.js                                       (UPDATED — 22.6 deletes ~140 lines, adds ~30)

scripts/
├── build-plugin.js                               (NEW — 22.4)
└── build-bmad-cache.js                           (UPDATED — 22.1)

.github/workflows/
├── offline-install.yml                           (NEW — 22.9)
└── multi-tool-smoke.yml                          (NEW — 22.10)
```

**Development Execution Order:**
1. Story 22.1 (version bump + cache rebuild) — must be first; everything else builds on a working 6.3.0 baseline
2. Story 22.3 (retire legacy skills) — small, low-risk, can land in parallel with 22.1
3. Story 22.2 (rename sweep) — must land before 22.4/22.5 since the plugin bundles renamed paths; avoid concurrent in-flight branches against extension skills
4. Story 22.5 (plugin manifests) — defines the manifest contract
5. Story 22.4 (build-plugin script) — emits the bundle from source per 22.5
6. Story 22.6 (stage-and-invoke replacement) — the main installer change; depends on 22.4 producing a bundled plugin
7. Story 22.7 (config path migration) — can run in parallel with 22.6
8. Story 22.8 (gitignore stage dir) — small follow-up, lands with or after 22.6
9. Story 22.9 (CI offline gate) — gating job, lands once the install flow is stable (after 22.6)
10. Story 22.10 (multi-tool smoke) — final verification, lands after 22.9

**Worktree-per-story:** Each story is small enough to execute in its own worktree per the git-workflow-skill mandatory policy. Stories 22.1, 22.3, 22.7, 22.8 are particularly suitable for parallel agents.

---

## Epic 23: Memory-Agent Conversion for Demerzel and Gad (Phase 4 — Deferred Follow-up)

**Goal:** Convert the Demerzel (ML Scientist) and Gad (SQA) personas from stateless agents to BMAD Builder Memory-agents, with persistent memory files at `_bmad/memory/<agent>/` and lean ~30-line bootloader `SKILL.md` files. Yael (Cyber), Amit (DevOps), and Alex (SRE) explicitly remain stateless.

**Value:** Demerzel's `ml-advise` workflow already requires cross-session memory of past experiments and retrospectives — making it a Memory-agent eliminates the workaround. Gad benefits from accumulated audit findings and IEEE 12207 compliance history across sessions. The other three agents have task-scoped workloads where Memory format adds maintenance cost without workflow benefit.

**PRD Coverage:** FR193, FR194, FR195

**Status:** Deferred — to start after Epic 22 lands and the v6.3.0 baseline is stable. Not in the current development sequence.

**Dependencies:**
- Epic 22 must be fully complete and merged

---

### Story 23.1 — Convert Demerzel (ma-agent-ml) to Memory-Agent

**Acceptance Criteria (high-level):**
1. `lib/bmad-extension/skills/ma-agent-ml/SKILL.md` is reduced to a ~30-line bootloader that loads memory files at activation
2. Memory files are created at `_bmad/memory/ma-agent-ml/`: `PERSONA.md`, `CREED.md`, `BOND.md`, `MEMORY.md`, `CAPABILITIES.md`, `INDEX.md`
3. The `ml-advise` workflow reads from `MEMORY.md` for cross-session context retrieval
4. All existing Demerzel workflows continue to function with no regression
5. Memory file content is initialized from the current monolithic SKILL.md content (no information loss)

**Status:** To be detailed when Epic 23 is activated

---

### Story 23.2 — Convert Gad (ma-agent-sqa) to Memory-Agent

**Acceptance Criteria (high-level):**
1. `lib/bmad-extension/skills/ma-agent-sqa/SKILL.md` is reduced to a ~30-line bootloader
2. Memory files are created at `_bmad/memory/ma-agent-sqa/`: same six-file structure as 23.1
3. Audit findings and IEEE 12207 compliance evaluations accumulate into `MEMORY.md` across sessions
4. Existing `sqa-audit` and `sqa-ieee12207` workflows continue to function with no regression
5. Memory file content is initialized from current monolithic SKILL.md content

**Status:** To be detailed when Epic 23 is activated

---

### Epic 23 — Cross-Epic Notes

**Why deferred:** v6.3.0 fully supports stateless agents. Memory-agent conversion is an authoring improvement, not a compatibility requirement. Splitting it from Epic 22 keeps Epic 22's scope focused on the migration itself.

**Why only Demerzel and Gad:**
- Demerzel: `ml-advise` skill explicitly requires search across past experiments, retrospectives, and TechSpecs — Memory format is the canonical fit
- Gad: SQA workflows accumulate findings (bug patterns, compliance history) across sessions — Memory format reduces re-discovery cost
- Yael, Amit, Alex: each invocation is task-scoped (run a scan, scaffold infra, check deployment) — no cross-session state requirement, conversion is pure overhead

---

## Epic 25: BMAD v6.6.0 Integration (Phase 5)

**Goal:** Upgrade bmad-method from v6.5.0 to v6.6.0. Fix the `--tools none` breaking change by guarding `buildBmadArgs()` against empty tool arrays on fresh installs, rebuild the bmad-cache, verify CI health, and cut a new ma-agents release.

**Dependencies:** Epic 24 must be fully complete (it is — all stories done, released as v3.9.0).

**Execution order:** 25.1 → 25.2 (25.1 must ship first so the guard is in place before the version bump exposes the breaking change in tests)

**FR Coverage:** FR196, FR197, FR198, NFR55

### Story 25.1: Guard buildBmadArgs Against Empty Tools on Fresh Installs

**Status:** ready-for-dev
**Size:** Small
**Priority:** Critical (breaking change)

**User Story:** As a ma-agents user who installs without selecting any IDE agents, I get a clean no-op for the BMAD step rather than a failing `--tools none` invocation.

**Acceptance Criteria:**
1. When `bmadTools` is empty and `!bmadInstalled`, the BMAD install step is silently skipped (no bmad-method invocation, no error)
2. When `bmadTools` is empty and `bmadInstalled`, the BMAD update step is silently skipped
3. `buildBmadArgs()` never produces a command string containing `--tools none`
4. Existing behavior for non-empty `bmadTools` arrays is unaffected
5. A new test in the test suite asserts AC 1–3

### Story 25.2: Bump bmad-method to v6.6.0 and Rebuild Cache

**Status:** ready-for-dev (blocked on 25.1)
**Size:** Small
**Priority:** High

**User Story:** As a ma-agents user, I get all upstream v6.6.0 bug fixes (--custom-source reliability, PluginResolver improvements) without any manual intervention.

**Acceptance Criteria:**
1. `package.json` `bmad-method` field updated from `6.5.0` to `6.6.0`
2. `npm update bmad-method` run and `package-lock.json` updated
3. `npm run build:bmad-cache` (or equivalent) run successfully — cache rebuilt with v6.6.0 content
4. All existing tests pass with the new version
5. `npm test` green
6. `project_name` config migration verified non-breaking (no ma-agents code change needed — bmad-method auto-migrates)

**FR195 explicitly documents that Yael, Amit, and Alex remain stateless — this is an architectural decision, not a backlog deferral.**

---

## Epic 26: Inline Git Workflow Guardrails in Per-Tool Instruction Block (Phase 5)

**Goal:** Inline the worktree / Conventional Commits / no-direct-merge-to-`main` rules into the universal `<!-- MA-AGENTS-START -->` block stamped into every coding agent's context file (`CLAUDE.md`, `.cline/clinerules.md`, `.roo/rules/00-ma-agents.md`, `AGENTS.md`). Today these rules live only in `skills/git-workflow-skill/SKILL.md` (always_load) and `lib/templates/project-context.template.md` (BMAD-agent activation path) — both reachable only via indirection that fails when the model skips the manifest read or when no BMAD agent is active. Adversarial review of the Workshop install (2026-05-24) confirmed the gap is reproducible on a fresh, correctly-installed project.

**Dependencies:** Epic 21 (universal + on-prem layered guardrails — already done). No code dependency on Epics 22–25.

**Execution order:** 26.1 → 26.2.

**FR Coverage:** FR204, FR205, FR206. Cross-references FR174, FR176 (existing universal-block contract).

**Out of scope:**
- Modifying `skills/git-workflow-skill/SKILL.md` — the skill stays the procedural reference; the inline template is the rule summary.
- Adding a Claude Code `PreToolUse` hook to gate `git commit` against `main`/`dev`. Documented as a deferred follow-up; would layer on top of the inline rule without rework.
- Backfilling git rules into `lib/templates/project-context.template.md` — its `## Git Workflow (ALL file-changing tasks)` section at lines 22–29 already covers the BMAD-agent path; redundancy across the two layers is intentional (see Architecture Decision P5-4).
- Cross-tool variation in rule wording — the same template body is stamped verbatim into all four marker-block targets.

### Story 26.1: Add Git Instruction-Block Template and Wire It Into the Composer

**Status:** ready-for-dev
**Size:** Small
**Priority:** High (closes a foundational guardrail gap demonstrated in the field)

**User Story:** As an engineer running any coding agent (Claude Code, Cline, Roo Code, OpenCode, Cursor, Kilocode, Copilot, Gemini) inside a ma-agents-installed project, I want the worktree-based git workflow rules to appear in my agent's first-loaded instruction file, so that the agent cannot plausibly commit directly to `main` or `dev`, skip the PR step, or write a non-conventional commit message — even if it never opens the manifest or `skills/git-workflow-skill/SKILL.md`.

**Acceptance Criteria:**

**Given** the new template `lib/templates/instruction-block-git.template.md`
**When** the file is read
**Then** it contains, under a single `## Git Workflow (ALL file-changing tasks)` heading:
- A "create a fresh worktree before any file change" rule that names the command shape `git worktree add ../<project>-<branch> -b <branch>` and references `skills/git-workflow-skill/scripts/start-feature.sh` for the scripted form
- A "never commit directly to `main` / `dev` / `master` / the trunk branch" rule, with the explicit naming of those four branches
- A Conventional Commits rule listing the seven allowed prefixes: `feat`, `fix`, `chore`, `docs`, `refactor`, `test`, `ci`
- A "PR is the only path into the trunk" rule that names `gh pr create` as the integration mechanism and prohibits auto-merge without explicit human approval
- A "self-run the `code-review` skill before opening the PR" rule
- A "after merge: `git worktree remove` and delete the feature branch" cleanup rule
- A pointer to the full procedure at `skills/git-workflow-skill/SKILL.md` and to `scripts/start-feature.sh` / `finish-feature.sh`
- A single explanatory sentence stating that these rules apply to every file-changing task regardless of size — there is no "small fix exemption"
**And** the template body contains no reference to any local-LLM-specific concept (`/no_think`, `str_replace_editor`, `~/.claude/`, `%APPDATA%`) — those belong only in the on-prem template

**Given** the existing composer `composeInstructionBlock({ profile, projectRoot })` in `lib/installer.js` (lines 115–138)
**When** it is invoked for profile=`standard`
**Then** the returned string contains, in this exact order: the universal block body, then the git block body — and nothing else
**And** the same call for profile=`on-prem` returns the universal block body, then the git block body, then the on-prem block body — in that exact order
**And** if `lib/templates/instruction-block-git.template.md` is missing on disk, the composer throws a clear error message identifying the missing template (matching the existing `on-prem profile selected but instruction-block-onprem.template.md is missing` pattern)

**Given** any agent with markdown instruction injection (Claude Code, Cline, Roo Code, OpenCode, Cursor, Kilocode, Copilot, Gemini)
**When** the installer runs (any profile)
**Then** the composed block — including the git body — is rendered between the `<!-- MA-AGENTS-START -->` / `<!-- MA-AGENTS-END -->` markers in that agent's instruction file
**And** content outside the markers is preserved byte-for-byte (FR176 contract)

**Given** the same profile and same project state
**When** the installer runs twice in a row
**Then** the content within the marker block is byte-identical between runs (FR176 idempotency contract)

**Technical notes:**
- The composer is at `lib/installer.js:115-138`. Add a new template path constant `GIT_INSTRUCTION_TEMPLATE_PATH` next to the existing `UNIVERSAL_INSTRUCTION_TEMPLATE_PATH` and `ONPREM_INSTRUCTION_TEMPLATE_PATH` constants at `lib/installer.js:14-15`. Read the template via the same `fs.readFileSync` pattern. Concatenate in the order: `universal + git + (profile==='on-prem' ? on-prem : '')`. No new function — modify the existing composer in place
- No changes to `lib/templates/instruction-block-universal.template.md` — it must stay git-neutral so a future profile may opt out of the git layer without forking the universal block
- No changes to `skills/git-workflow-skill/SKILL.md` — the skill remains the procedural reference; the inline template is the rule summary
- No changes to `lib/templates/project-context.template.md` — its `## Git Workflow` section (lines 22–29) is retained for the BMAD-agent activation path; redundancy across layers is intentional (see Architecture Decision P5-4)
- The CLI subcommand `npx ma-agents reconfigure` (FR180) already re-runs profile-dependent stamping — existing installs pick up the new git block on the next `install` or `reconfigure` run automatically; no migration script is required

### Story 26.2: Integration Test — Git Block Stamped Into All Four Per-Tool Injection Targets

**Status:** ready-for-dev (blocked on 26.1)
**Size:** Small
**Priority:** High

**User Story:** As the chief architect, I want an integration test that asserts the git workflow rules land in `CLAUDE.md`, `.cline/clinerules.md`, `.roo/rules/00-ma-agents.md`, and `AGENTS.md` for both `standard` and `on-prem` profiles, so that a future refactor of the composer, the per-tool stamping in `lib/installer.js`, or the agents registry in `lib/agents.js` cannot silently drop git rules from any one tool's instruction file.

**Acceptance Criteria:**

**Given** a clean fixture project with no pre-existing `<!-- MA-AGENTS-START -->` marker-block content in any target
**When** `npx ma-agents install --yes` runs with all four primary tool targets selected (Claude Code, Cline, Roo Code, OpenCode) and profile=`standard`
**Then** all four target files (`CLAUDE.md`, `.cline/clinerules.md`, `.roo/rules/00-ma-agents.md`, `AGENTS.md`) contain, inside the `<!-- MA-AGENTS-START -->` / `<!-- MA-AGENTS-END -->` markers:
- The heading `## Git Workflow (ALL file-changing tasks)`
- A reference to `git worktree add`
- A reference to "Conventional Commits" (or the literal prefix list `feat`, `fix`, `chore`, `docs`, `refactor`, `test`, `ci`)
- A reference to `gh pr create` or the phrase "open a PR"
- A reference to `skills/git-workflow-skill/SKILL.md`
- An explicit `never commit directly to main` / `dev` / `master` rule

**Given** the same fixture project after the first install completes
**When** the installer runs a second time with the same flags
**Then** the marker-block content in every target is byte-identical to the first run (idempotency)
**And** any text written outside the markers between runs is preserved byte-for-byte

**Given** a fixture project with profile=`on-prem`
**When** the installer runs
**Then** every target file contains the git block AND the on-prem block within the marker
**And** the git block appears in the marker before the on-prem block (composition order from FR206)

**Given** the test runs in CI
**When** `npm test` executes
**Then** the new test file `test/instruction-block-git.test.js` (or an extension of an existing instruction-block test) is included in the run
**And** the test executes without network access (no air-gapped regression — NFR44/NFR45 contract)

**Technical notes:**
- Reuse the existing fixture pattern from `test/onprem-injection.test.js` if present; otherwise create a fixture under `test/fixtures/git-block/`
- Assert per-target file via `fs.readFileSync` + substring/regex on the marker-block region; do not parse markdown
- Cursor, Kilocode, Copilot, Gemini are not in the per-target assertion list because they reuse the same composed marker-block content; covering the four primary marker-block targets (Claude Code, Cline, Roo Code, OpenCode) is the architectural boundary
- The fixture must NOT depend on a real `gh` binary, real GitHub remote, or any network call — assertions are on the stamped instruction-file content, not on git or PR behavior
