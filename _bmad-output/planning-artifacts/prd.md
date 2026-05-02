---
stepsCompleted: ['step-01-init', 'step-02-discovery', 'step-02b-vision', 'step-02c-executive-summary', 'step-03-success', 'step-04-journeys', 'step-05-domain', 'step-06-innovation', 'step-07-project-type', 'step-08-scoping', 'step-09-functional', 'step-10-nonfunctional', 'step-11-polish', 'step-12-complete', 'step-e-01-discovery', 'step-e-02-review', 'step-e-03-edit', 'step-e-01-discovery', 'step-e-02-review', 'step-e-03-edit-2026-03-24', 'step-e-01-discovery', 'step-e-02-review', 'step-e-03-edit-2026-03-25', 'step-e-01-discovery', 'step-e-02-review', 'step-e-03-edit-2026-04-07', 'step-e-01-discovery', 'step-e-02-review', 'step-e-03-edit-2026-04-08', 'step-e-01-discovery', 'step-e-02-review', 'step-e-03-edit-2026-05-01', 'step-e-01-discovery', 'step-e-02-review', 'step-e-03-edit-2026-05-01b']
workflowStatus: 'complete'
completedDate: '2026-03-05'
lastEdited: '2026-05-01'
editHistory:
  - date: '2026-05-01'
    changes: 'Bug fix: corrected all PRD references that treated .clinerules as a flat file. Per Cline official docs, .clinerules/ is a directory Cline reads recursively; .clinerules/workflows/ is its subdirectory for slash-command workflows. Instruction injection for Cline uses .cline/clinerules.md as the single source of truth — .clinerules must never appear in instructionFiles. Updated: Capability Area 19 (guardrail template reference), Capability Area 22 (directory clarification + migration note), IDE/Agent Integration table Cline row, Implementation Considerations (Cline workflow generation), FR174 (injection target corrected to .cline/clinerules.md), FR176 (injection file list corrected; .clinerules directory note added), FR181 (removed .clinerules from uninstall scope; corrected count to 4 injection files). Added FR202: deployClineWorkflows migration guard — detects legacy .clinerules flat file, removes it, creates directory. Added FR203: agents.js instructionFiles must list only .cline/clinerules.md for Cline.'
  - date: '2026-05-01'
    changes: 'Added F22: Cline Workflow Generation capability area (Shipped). FR199–FR201: after every BMAD install/update/migration where Cline is selected, deployClineWorkflows scans .cline/skills/ and generates .clinerules/workflows/<skill-name>.md wrappers for all BMAD skills — delegation wrappers for skills with workflow.md, read+frontmatter-ignore wrappers for SKILL.md-only skills. Updated Cline row in IDE/Agent Integration table. Added Cline implementation consideration. Added Journey Requirements Summary row for Cline workflow invocation.'
  - date: '2026-05-01'
    changes: 'Added F21: BMAD v6.6.0 Integration capability area. FR196: buildBmadArgs guard — when no IDE tools are selected for a fresh install, the BMAD installation step must be skipped rather than invoking bmad-method with --tools none (rejected by v6.6.0 for fresh --yes installs). FR197: bmad-method pin bumped to v6.6.0. NFR55: automated test must assert buildBmadArgs never emits --tools none and that the install flow skips BMAD when bmadTools array is empty. Also documents --set/--list-options non-interactive config flags (FR198) and notes project_name config auto-migration is transparent (no user action required).'
  - date: '2026-04-14'
    changes: 'Added FR181 (Profile Uninstall subcommand) and NFR49 (uninstall preservation contract) to support Epic 21 corrective work. Closes adversarial-review Finding #17 — no uninstall / rollback path. Full spec in Epic 21 Story 21.11.'
  - date: '2026-04-14'
    changes: 'Added FR180 (Profile Reconfigure subcommand) and NFR48 (profile history audit) to support Epic 21 corrective work. Closes adversarial-review Findings #5 and #7 — no escape hatch for persisted profile, CI-default silent-downgrade. Full spec in Epic 21 Story 21.10.'
  - date: '2026-04-14'
    changes: 'Spec correction: removed `--profile=` CLI flag from FR173 and NFR45. Profile is user-facing (install-time prompt, persisted) or team-facing (committed `.ma-agents.json`) — not per-invocation. On-prem CI/CD served by committing the persisted `.ma-agents.json`, not a flag.'
  - date: '2026-04-13'
    changes: 'Added F19: Local-LLM / On-Prem Agent Tuning capability area (Planned). Added FR172–FR179: install-time profile prompt (on-prem vs standard) with persistence in `.ma-agents.json`; universal per-tool guardrail templates shipped to all profiles (.roomodes with BMAD-mode file-regex restrictions, expanded AGENTS.md/.clinerules/CLAUDE.md injection enforcing text-vs-file discipline and BMAD phase boundaries); on-prem-only layered guardrails (no-home-dir-writes, no str_replace_editor, /no_think planning prefix, reasoning-mode guidance); BMAD persona phase-aware prompt prefixes when profile=on-prem; reference deployment doc for vLLM serving (tool-call-parser, max-model-len, quantization). Added NFR44–NFR47: profile isolation (standard install unchanged), CI/CD compatibility via --yes defaulting to standard, idempotent per-tool template stamping, application-layer phase enforcement via .roomodes file-regex (not solely prompt-based).'
  - date: '2026-04-13'
    changes: 'Added F20: BMAD 6.3.0 Plugin Migration capability area (Planned). Added FR182–FR192 covering plugin-based extension packaging via .claude-plugin/marketplace.json, PluginResolver local-file strategy for air-gapped installs, replacement of post-install manifest surgery with pre-install local plugin staging, skill renames (bmad-ma-agent-* → ma-agent-*), retirement of bmad-init / bmad-agent-qa (Quinn) / bmad-agent-sm (Bob) / bmad-agent-quick-flow-solo-dev (Barry) in alignment with upstream consolidation into Amelia, config path move to _bmad/bmm/config.yaml, spec-wip.md → spec-{slug}.md awareness, and multi-tool verification against non-Claude install targets (Copilot, Cline). Added FR193–FR195 for a deferred follow-up epic converting Demerzel and Gad to Memory-agent format while keeping Yael/Amit/Alex stateless. Added NFR50–NFR54: offline install gate with egress blocking, pre-install plugin staging determinism, multi-tool install parity, non-persistence of plugin stage directory, retention of air-gapped self-containment guarantee. Bumped bmad-method pin from 6.2.0 to 6.3.0 in FR74 and NFR20. Executive Summary updated: BMAD-native extension bullet expanded to note v6.3.0 plugin packaging.'
  - date: '2026-04-29'
    changes: 'Redesigned Jira integration (FR139, FR140, Epic 14). New model: install-time sprint backend selection (file-system or Jira). When Jira is selected, all sprint skills operate against Jira using whatever tool the agent has available — tool-agnostic, works with any Jira MCP server or integration. On Jira failure, skills ask the user to retry or switch to file management; switching updates the configuration permanently. Removed all "does not build REST adapter" language from requirements and epics — documents describe what IS built, not what is not.'
  - date: '2026-04-28'
    changes: 'Pivoted Jira integration from custom REST adapter to MCP-first capability detection with graceful fallback (FR139, FR140, Epic 14). Superseded by 2026-04-29 revision.'
  - date: '2026-04-08'
    changes: 'Added F18: Software Quality Assurance (SQA) capability area (Planned). Added SQA agent (Gad) to Executive Summary specialized agents bullet. Added Test Engineer (Oren) journey reference to SQA workflows. Extended Specialized Agent Personas FR35 to include SQA. Added FR158–FR171: SQA agent persona and menu, Project Audit workflow (full/partial scope selection, 5 audit dimensions: code-to-story traceability, stories-to-architecture/PRD alignment, process compliance, sprint health, release state, written report output), IEEE/ISO/IEC 12207 compliance workflow (full/partial scope selection, 23 process areas across 4 groups, COMPLIANT/PARTIAL/NON-COMPLIANT/NOT-APPLICABLE/ORGANIZATION-SCOPE ratings, compliance matrix report, gap-driven backlog story creation). Added NFR42–NFR43: audit report reproducibility, air-gapped IEEE 12207 workflow.'
  - date: '2026-04-07'
    changes: 'Added F17: BMAD Knowledge Graph capability area (Planned). Added non-hierarchical knowledge graph innovation pattern. Extended Executive Summary with knowledge graph bullet. Added 3 measurable outcomes to Success Criteria. Extended Yael, Noam, and Alon journeys with graph navigation use cases. Added knowledge graph row to Journey Requirements Summary. Added FR141–FR157: graph data model (nodes as file-id#anchor, typed any-to-any directed edges with provenance including AI agent identity), files table for file-pointer-agnostic document registration (relative path/absolute path/URL), LLM-optimized JSON format with meta/files/nodes/edges structure, automatic skill emission with non-hierarchical multi-source edge support, VSCode-native navigation with browser fallback, interactive visualization with filtering and full provenance tooltips, air-gapped self-contained renderer. Added NFR38–NFR41: render performance, LLM-parseable format contract, additive-only emission, air-gapped renderer. Fixed 5 implementation leakage items from validation: removed force-directed algorithm specifics, checkbox UI specifics, internal write mechanism, VSCode URI scheme, and CSS/JS inlining mechanism.'
  - date: '2026-04-03'
    changes: 'Restructured PRD to remove phase-based organization. Replaced phased scoping with System Overview (Current Baseline, Capability Areas with status indicators, Future Directions). Regrouped Functional Requirements and Non-Functional Requirements by capability area instead of phase. Removed all Phase 1/2/3/4 labels, MVP Strategy & Philosophy, MVP Feature Set, Risk Mitigation Strategy subsection. Content preserved and redistributed into capability-based structure.'
  - date: '2026-04-03'
    changes: 'Adversarial review fixes: FR129 now explicitly names the `remove-from-sprint` BMAD extension workflow. Executive Summary updated to include remove-from in sprint workflow list. F10 sprint management repository path updated from stale `_bmad-output/sprints/` to `sprint-status.yaml` and `_bmad-output/implementation-artifacts/`. FR137 close-sprint verified to already specify all three disposition options (move to next sprint, return to backlog, per-item decision). No FR count reference found in PRD — no correction needed.'
  - date: '2026-04-03'
    changes: 'Redesigned F5 from Realistic Sprint Management to Unified Sprint-Status Management. Consolidated three-file pattern (backlog.yaml, sprints/sprint-N.yaml, sprint-status.yaml) into single sprint-status.yaml with epics/backlog/sprints sections. Added unified schema specification (FR133-FR135), movement semantics (FR136), sprint close lifecycle (FR137), done archival (FR138), Jira adapter readiness (FR139-FR140). Reorganized FR65-FR71 and FR128-FR132 under new sub-sections (Unified Data Model, Movement Semantics, Sprint Lifecycle, Done Archival, Jira Adapter). Updated Executive Summary, Success Criteria, Measurable Outcomes, Dana and Noam journeys, Journey Summary table, FR26, FR32 for unified sprint-status alignment.'
  - date: '2026-03-25'
    changes: 'Added F9: BMAD 6.2.0 Agent Architecture Migration with FR94-FR110, NFR29-NFR33. Added F10: Multi-Repository Project Layout with FR111-FR122, NFR34-NFR37. Updated F6 to programmatic setup skill invocation (replaces silent install), added FR123-FR127 for unified wizard UX and CI/CD compatibility. Updated Executive Summary, Success Criteria, Alon journey, Journey Summary, Integration Requirements, Innovation, Risk Mitigations, F1 description, and NFR17 for 6.2.0 alignment. Removed @next installation method.'
  - date: '2026-03-24'
    changes: 'Upgraded bmad-method pin from v6.0.4 to v6.2.0. Added wds to bundled external modules. Added Agent Activity Dashboard with FR87-FR93 and NFR26-NFR28. Updated Executive Summary, Success Criteria, Dana and Alon journeys, and Journey Summary table for new capabilities.'
  - date: '2026-03-19'
    changes: 'Added Project Context Auto-Generation. Added FR77-FR84 and NFR22-NFR24. Covers platform-agnostic project-context.md generation at install time with manifest path resolution, mission lifecycle documentation, idempotency, expansion triggers, and BMAD critical_actions integration.'
  - date: '2026-03-15'
    changes: 'Adversarial review fixes: FR53 updated from 4 to 11 BMAD agents (added 7 built-in). FR72 moved to current scope (Epic 6 in-progress). Removed "Methodology presentation bundled with installation" from future scope. F6 description corrected from require() to execSync+require.resolve invocation pattern. Updated Technical Success to reflect 11 agents.'
  - date: '2026-03-15'
    changes: 'Reorganized F6 as Bundled BMAD Installation (merged Epic 13 into Epic 5). Removed standalone binary concept (Node.js+npm always available). Removed --offline flag (bundled is the only mode). Deleted FR77, FR78. Rewrote NFR21 for deterministic bundled output. Reorganized FRs by concern, removing date-based section headers. Swept stale references to standalone binary, --offline, Epic 13.'
  - date: '2026-03-15'
    changes: 'Added F6: Self-Contained BMAD Installation. Moved to current scope (urgent). Added FR74-FR78, NFR20-NFR21. Pins bmad-method v6.0.4 for bundling. Bundles external modules (bmb, cis, tea) as pre-cloned cache inside ma-agents npm package.'
  - date: '2026-03-11'
    changes: 'Added 5 features: Skill Enforcement Architecture, OpenCode Agent Support, _bmad-output policy, Bug Management System, Realistic Sprint Management. Added FR51-FR71 and NFR16-NFR19.'
inputDocuments: ['docs/index.md', 'docs/project-overview.md', 'docs/architecture.md', 'docs/source-tree-analysis.md', 'docs/development-guide.md', 'README.md', 'CONTRIBUTING.md', 'DEVELOPMENT.md', 'QUICK_START.md', 'SKILLS_STRUCTURE.md', '_bmad-output/planning-artifacts/product-brief-agents-2026-03-08.md']
workflowType: 'prd'
documentCounts:
  briefs: 1
  research: 0
  brainstorming: 0
  projectDocs: 5
classification:
  projectType: 'developer_tool_methodology_platform'
  domain: 'software_engineering_development_methodology'
  complexity: 'medium-high'
  projectContext: 'brownfield_documented_as_greenfield'
---

# Product Requirements Document - agents

**Author:** Alon
**Date:** 2026-03-05 | **Last Edited:** 2026-04-03

## Executive Summary

> ***Install AND enforce — agent-agnostic methodology enforcement for enterprise software engineering, now with guaranteed skill compliance, bug management, and unified sprint-status management.***

ma-agents is an enterprise development methodology platform that enables software organizations to adopt AI coding agents at scale without sacrificing engineering rigor, traceability, or standards compliance. Built around the BMAD-METHOD framework, it delivers a complete software development lifecycle — from systems engineering and requirements through architecture, implementation, testing, and production — as portable, agent-agnostic skill packages.

The platform solves two critical organizational challenges. First, as AI coding assistants proliferate (Claude Code, Copilot, Gemini, Cursor, Cline, OpenCode, and on-prem alternatives), engineering teams fragment into tool-specific silos with inconsistent practices. Second, **installed skills are not reliably enforced** — agents install skills but then ignore them during operation, with planning instructions losing priority in context, BMAD workflows operating in isolation from the skill system, and no enforcement mechanism ensuring compliance. ma-agents eliminates both by decoupling engineering methodology from any single AI tool and ensuring that installed skills are actually followed — standards are defined once, installed once, and enforced uniformly across all agents.

### What Makes This Special

The core insight is convergence: AI agents need governance, and engineering methodology needs AI-native delivery. ma-agents sits at this intersection as the **governance and standards layer** for AI-assisted development.

- **Install AND enforce** — 28+ codified engineering skills install identically across 12 target agents with automatic translation to each agent's native format. Skills are not merely available — they are enforced via BMAD `critical_actions`, top-priority instruction injection, and per-agent enforcement hooks
- **Full SDLC coverage via BMAD-METHOD** — integrated workflows spanning product discovery, requirements, architecture, sprint planning, implementation, QA, and retrospectives, orchestrated by specialized AI personas (PM, Architect, Developer, QA, Scrum Master, Tech Writer)
- **Enterprise-grade specialized agents** — purpose-built personas for defense/enterprise needs: SRE (Alex), DevOps (Amit), Cyber Analyst (Yael), MIL-STD-498 Expert (Joseph), and SQA Engineer (Gad) with operational playbooks and compliance workflows. Migrated to native BMAD 6.2.0 skill-based architecture: each agent is a full skill folder (`SKILL.md`, `prompts/`, `resources/`, `scripts/`) with internal commands replacing legacy `.customize.yaml` injection, and all 34 operational workflows (11 MIL-498 DIDs + 9 SRE + 6 DevOps + 8 Cyber) packaged as proper BMAD skill packages
- **Bug management** — Agents autonomously detect problems in delivered code and propose bug issues. BMAD extension workflows generate structured bug stories. Bugs live in the backlog section of `sprint-status.yaml` alongside stories for unified sprint planning
- **Unified sprint-status management** — All sprint, backlog, and epic data consolidated into a single `sprint-status.yaml` file with movement semantics (items move between backlog and sprints, never duplicated), done archival (completed items removed and archived), sprint close lifecycle, and install-time Jira backend selection. Sprints defined by capacity, flat backlogs containing both stories and bugs, multi-criteria prioritization, and workflows to add/modify/close/remove-from sprints
- **Agent activity visibility** — Real-time dashboard showing all active AI agents: type, assigned story, worktree, branch, and status, auto-refreshing every 30 seconds from existing project file structures
- **BMAD-native extension architecture** — All BMAD-facing enhancements use official BMAD Builder extension points. With 6.2.0 migration, the extension module adopts the native `module.yaml` identity pattern (`code`, `description`, `module_version`) with setup skill and `module-help.csv` capability registration. With 6.3.0 migration, the extension ships as a Claude-Plugin-compatible package (`.claude-plugin/marketplace.json`) and is installed via BMAD's PluginResolver using a local file path — preserving the air-gapped guarantee while replacing post-install manifest surgery with pre-install plugin staging. Zero bmad-method core modifications. Extensions survive BMAD updates via the anti-zombie config pattern
- **Environment agnostic** — supports on-prem, public cloud, and air-gapped deployments through universal skill format and multi-agent targeting
- **Multi-repository project layout** — Supports enterprise project structures where planning knowledge, sprint management, and code live in separate repositories. The installer discovers repository locations (local or remote), clones as needed, and stamps paths into project-context.md so agents resolve artifact reads/writes to the correct repository without manual path management
- **Non-hierarchical knowledge graph** — All BMAD-generated artifacts form a living any-to-any knowledge graph. An acceptance criterion in a story may reference the epic that scoped it, the architecture decision that constrained it, and the UX design that shaped it — simultaneously, with no assumption of hierarchy. A central files table maps short file IDs to arbitrary file pointers (relative paths, absolute paths, Confluence URLs, any document reference), so nodes can address any artifact regardless of where it lives. Maintained automatically by skills, stored as LLM-friendly JSON, and visualized as an interactive graph in VSCode. Every edge carries full provenance: creator name, AI agent identifier, and date
- **Project knowledge preservation** — `_bmad-output` is version-controlled project knowledge (planning artifacts, implementation artifacts), never gitignored

**Classification:** Developer Tool / Methodology Platform | Software Engineering domain | Medium-High complexity | Brownfield (v2.19.2), documented as greenfield PRD

## System Overview

### Current Baseline

ma-agents is a shipping product (v2.19.2+) providing a universal skill installer with 27+ skills across 5 domains, multi-agent manifest (v1.1.0) with version tracking and upgrade detection, BMAD-METHOD install/update/customize/recompile pipeline, interactive wizard and direct CLI modes, cross-platform support (Windows, macOS, Linux), and air-gapped operation for static skill content. All 7 user roles (Systems Engineer through Chief Architect) can install skills and BMAD workflows via `npx ma-agents`. Skills install correctly across IDE agents and BMAD specialized agents. MIL-STD-498 document generation workflows are operational for 11 DIDs.

### Capability Areas

Each capability area represents a permanent part of the product that is enhanced over time. Status indicators reflect the current state of each area.

**Status legend:** **Shipped** — fully delivered and in production use | **In Development** — actively being built | **Planned** — designed but not yet started | **Exploratory** — under consideration, no commitment

1. **Skill Management & Portability** — Universal skill installer, multi-agent targeting across 12 agents, format translation to each agent's native configuration. Manifest-based version tracking for upgrade/downgrade detection across multi-agent installs. — **Shipped**

2. **Skill Enforcement** — Top-priority instruction injection, BMAD `critical_actions` on agent activation, per-agent enforcement hooks (Claude Code hooks, others as available), context persistence strategies. Moves from advisory to enforced compliance. — **In Development**

3. **BMAD-METHOD Integration** — Install/update/customize/recompile pipeline. Bundled bmad-method v6.2.0 as a direct npm dependency with pre-cloned external modules (bmb, cis, tea, gds, wds). Single unified wizard UX with explicit parameter passing to bmad-method. CI/CD compatible non-interactive mode. — **In Development**

4. **BMAD Extension Architecture** — Module identity via `module.yaml` (`code`, `description`, `module_version`), setup skill for config management, `module-help.csv` capability registration, anti-zombie config pattern. All BMAD-facing enhancements use official BMAD Builder extension points with zero bmad-method core modifications. — **In Development**

5. **BMAD 6.2.0 Agent Architecture Migration** — Rebuilding the 4 custom agents (SRE, DevOps, Cyber, MIL-498) from legacy `.customize.yaml` + XML definitions to native 6.2.0 skill-based agent folders (`SKILL.md`, `prompts/`, `resources/`, `scripts/`). Converting all 34 operational workflows to SKILL.md packages. Dual-layer elimination. In-place migration via installer with rollback. — **In Development**

6. **Specialized Agent Personas** — SRE (Alex), DevOps (Amit), Cyber Analyst (Yael), MIL-STD-498 Expert (Joseph) with operational playbooks. Each agent is a full BMAD 6.2.0 skill folder with internal commands, resources, and scripts. — **In Development**

7. **MIL-STD-498 Document Generation** — 11 DID workflows (SSS, SSDD, OCD, SDP, SRS, SDD, STD, STR, IDD, IRS, HRS) as BMAD skill packages with progressive disclosure step files for compliance-critical sequential document generation. — **In Development**

8. **SDLC Workflows** — PRD creation/editing/validation, architecture, UX design, sprint planning, code review, automated E2E test generation, retrospectives, implementation readiness checks — orchestrated by specialized AI personas. — **Shipped**

9. **Bug Management** — Auto-detection skill instructs coding agents to propose bug issues for delivered code. BMAD extension workflow generates structured bug stories. Bugs exist as standalone backlog items with full lifecycle. — **In Development**

10. **Sprint & Backlog Management** — Unified `sprint-status.yaml` as single source of truth with three sections (epics, backlog, sprints). Movement semantics, done archival, sprint close lifecycle, capacity-based sprints, multi-criteria prioritization. BMAD extension workflows to add/modify/close/remove-from sprints. Install-time backend selection: file-system (default) or Jira. — **In Development**

11. **Project Knowledge & Context** — `_bmad-output` as version-controlled project knowledge (never gitignored). Auto-generated `project-context.md` as constitutional document for AI agents with manifest path resolution, mission lifecycle documentation, idempotency, and BMAD `critical_actions` integration. — **In Development**

12. **Multi-Repository Project Layout** — Enterprise project structures where planning knowledge, sprint management, and code live in separate repositories. Installer discovers repository locations, clones as needed, stamps paths into config and project-context.md. Cross-reference file for agent context bridging. — **In Development**

13. **Agent Activity Dashboard** — Real-time CLI dashboard showing all active AI agents: type, assigned story, worktree, branch, and status. Auto-refresh, filtering, session history. Data derived from existing project file structures. — **Planned**

14. **OpenCode Agent Support** — 12th agent target (7th IDE agent) with JSON-based instruction injection via `opencode.json` instructions array. Skills path: `.opencode/skills/`. Config merging (not replacement). — **In Development**

15. **Developer Infrastructure** — Automated regression tests for the 4 core modules (cli.js, installer.js, agents.js, bmad.js) verifying architectural contracts. — **In Development**

16. **Methodology Onboarding** — Methodology presentation bundled with BMAD installation, deployed to `_bmad-output/methodology/` for team onboarding. — **In Development**

17. **BMAD Knowledge Graph** — Dynamic any-to-any knowledge graph built automatically from BMAD-generated artifacts.

18. **Software Quality Assurance (SQA)** — Dedicated SQA agent (Gad) providing structured quality workflows for software projects: a multi-dimensional Project Audit (code-to-story traceability, stories-to-architecture/PRD alignment, process compliance, sprint health, release state) and an IEEE/ISO/IEC 12207 lifecycle process compliance assessment with compliance matrix, gap analysis, and backlog story generation for identified gaps. — **Planned**

19. **Local-LLM / On-Prem Agent Tuning** — Adapts the ma-agents installed configuration to the realities of disconnected, air-gapped enterprise networks running local non-Claude LLMs (e.g., Nemotron Super 49B). Two layers: (a) **Universal guardrails** shipped to all installs — richer per-tool config (`.roomodes` with BMAD-mode file-regex restrictions, expanded `AGENTS.md`/`.cline/clinerules.md`/`CLAUDE.md` injection) that enforces "text response vs. file creation" discipline and BMAD phase boundaries at the tool's application layer, not just via prompt; (b) **On-prem profile** opt-in via install-time prompt (persisted in `.ma-agents.json`) — adds local-LLM-specific guardrails (`/no_think` planning prefix, no-home-dir-writes, no `str_replace_editor` warning, reasoning-mode guidance, phase-aware persona prompt prefixes). Also ships a reference vLLM deployment doc (tool-call-parser, context length, quantization) for the inference-serving side, which the installer does not manage. — **Planned**

20. **BMAD 6.3.0 Plugin Migration** — Ships the BMAD extension as a Claude-Plugin-compatible package (`.claude-plugin/marketplace.json`) installed via BMAD's PluginResolver using a local file path, preserving the air-gapped guarantee while replacing post-install manifest surgery with pre-install plugin staging. Skill renames (bmad-ma-agent-* → ma-agent-*), retirement of bmad-init / bmad-agent-qa / bmad-agent-sm / bmad-agent-quick-flow-solo-dev in alignment with upstream consolidation. — **Planned**

21. **BMAD v6.6.0 Integration** — Upgrade bmad-method to v6.6.0, guard the installer against the `--tools none` breaking change, and adopt upstream reliability improvements. (Planned)

22. **Cline Workflow Generation** — After BMAD installs or updates when Cline is a selected tool, the installer auto-generates `.clinerules/workflows/<skill-name>.md` wrapper files for every BMAD skill in `.cline/skills/`. Per Cline's documentation, `.clinerules/` is a directory that Cline reads recursively; `.clinerules/workflows/` is a subdirectory within it for slash-command workflows. The installer ensures `.clinerules` is a directory (migrating any legacy flat-file installation), then generates wrappers. BMAD skills ship with Claude Code-style YAML frontmatter that Cline does not natively parse; the generated wrappers are the adapter layer that makes skills callable via Cline's native `/workflow-name` invocation mechanism. Skills with a `workflow.md` receive a delegation wrapper; self-contained skills (SKILL.md only) receive a wrapper that reads SKILL.md with a frontmatter-ignore instruction. The Cline instruction block is injected into `.cline/clinerules.md` — the single source of truth for Cline instruction injection. Triggered on install, update, and migration. — **Shipped**

Any artifact can reference any other regardless of hierarchy — a story's AC may derive from the epic, an architecture decision, and a UX design simultaneously. A central `files` table maps short file IDs to arbitrary file pointers (relative paths, absolute paths, Confluence URLs, or any document reference). Nodes are addressable anchors within registered files (`file-id#heading`), edges are directional typed relationships with full provenance (creator name, AI agent identifier, date, label). Stored as LLM-friendly JSON at `_bmad-output/knowledge-graph.json`. Rendered as an interactive graph in VSCode webview (browser fallback) via `_bmad-output/knowledge-graph.html`. `open-graph` skill surfaces the visualization from any BMAD session. — **Planned**

### Future Directions

The following capabilities extend the existing architecture. They are aspirational enhancements with no delivery dates or commitments.

- Visual Studio agent integration (identified gap — investigation needed into VS-specific AI agent configuration)
- Additional language-specific skills (C++, C#, Python standards beyond current coverage)
- Expanded skill authoring tooling for organizational skill creators
- Expanded BMAD agent personas for additional enterprise roles
- Per-role skill assignment (different skills for different team roles)
- Organization-wide skill governance: central registry, approval workflows, compliance tracking
- Cross-project methodology analytics: adoption, consistency, coverage metrics
- Community skill marketplace
- Skill versioning with organizational override policies

## Success Criteria

### User Success

- Engineers install skills and BMAD workflows with a single `npx` command — no manual configuration
- Engineers switch between AI agents (Claude Code, Copilot, Cursor, Cline, Gemini, OpenCode, on-prem tools) and retain the same methodology, skills, and workflow context
- New team members onboard with consistent engineering practices enforced through skills, not tribal knowledge
- Specialized roles (SRE, DevOps, Cyber, MIL-STD-498) have purpose-built agent personas with operational playbooks
- Installed skills are actually followed by agents — users never need to manually remind agents to read the manifest or follow skill directives (zero-reminder workflow)
- Agents autonomously propose bug issues when they detect problems in already-delivered code
- Sprint workflows use a single `sprint-status.yaml` as the source of truth — flat backlogs, capacity-based sprints, multi-criteria prioritization, movement semantics, done archival, and sprint close lifecycle
- Projects that separate planning knowledge, sprint management, and code across repositories are fully supported — agents automatically resolve artifact paths to the correct repository
- Engineers can open the BMAD knowledge graph from any BMAD session and navigate from any artifact node directly to the source document location — zero manual cross-reference maintenance required

### Technical Success

- Skills install correctly across all 12 supported agents with proper format translation
- Skill compliance rate >90% for `always_load: true` skills (baseline: ~0%)
- On-prem, public cloud, and air-gapped deployment scenarios all function without degradation
- BMAD-METHOD integration works end-to-end: install, update, customize, recompile
- BMAD extension module survives `npx bmad-method install --action update` without losing functionality — extensions maintain independent identity via `module.yaml` code field and anti-zombie pattern
- Manifest system tracks versions reliably for upgrade/downgrade detection across multi-agent installs
- All 11 BMAD agents (4 custom + 7 built-in) have skill loading on activation
- All 4 custom agents (SRE, DevOps, Cyber, MIL-498) function as native BMAD 6.2.0 skill-based agents — standard skill folder structure, SKILL.md entrypoints, internal commands via `prompts/`
- All 34 operational workflows (11 MIL-498 DIDs + 9 SRE + 6 DevOps + 8 Cyber) are proper BMAD 6.2.0 skill packages — no legacy YAML/XML workflow dependencies
- Installer performs seamless in-place migration from 6.0.4 to 6.2.0 patterns during normal installation without user intervention
- Agent activity dashboard reflects current agent state within 60 seconds of last file system change
- Knowledge graph accurately reflects all traceability relationships emitted during the project lifecycle — no manual graph maintenance required, verified by confirming edge count matches artifact generation events

### Measurable Outcomes

- All 12 target agents produce functionally equivalent output from the same skill source
- Same skill produces identical behavioral enforcement across Claude Code, Cursor, Cline, OpenCode, and all BMAD agents
- Full SDLC coverage: systems engineering → requirements → architecture → implementation → QA → production
- Zero manual steps required for skill format adaptation per agent
- Bug and sprint workflows function as BMAD extensions without requiring bmad-method updates — unified `sprint-status.yaml` replaces fragmented multi-file sprint tracking
- End-to-end traceability chain from PRD requirement to implementation story is navigable in the knowledge graph for every shipped feature — verifiable by traversing the graph from any story node to its originating PRD requirement

## User Journeys

### 1. Systems Engineer — Eli

Eli is a systems engineer responsible for defining what the system does before anyone writes code. He works with stakeholders to capture operational concepts, system requirements, and interface definitions. He runs `npx ma-agents` to install BMAD with the MIL-STD-498 module and starts with `/bmad-bmm-create-prd` to structure the product concept, then uses the MIL-STD-498 workflows to generate the SSS (System/Subsystem Specification) and SSDD (System/Subsystem Design Description). He also uses the OCD workflow to produce the Operational Concept Description. His deliverables feed downstream to architects and product managers. When requirements change, he uses `/bmad-bmm-edit-prd` and the BMAD validation workflows to ensure traceability is maintained across documents.

**Capabilities revealed:** MIL-STD-498 document generation (SSS, SSDD, OCD), requirements traceability, operational concept workflows, document validation, inter-role handoff

### 2. Project Manager — Dana

Dana manages project phases, timelines, and deliverables. She uses BMAD's PM persona to structure the project into phases with clear milestones and release gates. She generates the SDP (Software Development Plan) using the MIL-STD-498 workflow, defining deliverables per phase, resource allocation, and acceptance criteria. She manages sprints through the unified sprint-status workflows: adding sprints with defined capacity, moving stories and bugs from the backlog section into sprints using multi-criteria prioritization, and modifying sprint composition as priorities shift. She closes sprints using the close-sprint workflow — done items are archived, remaining items are moved to the next sprint or returned to the backlog. She tracks sprint status with `/bmad-bmm-sprint-status` — which reads the single `sprint-status.yaml` file showing real sprint definitions with assigned items, epic status, and unassigned backlog — and uses `/bmad-bmm-retrospective` at epic boundaries. During active sprints she monitors the agent activity dashboard (`npx ma-agents dashboard`) to see which agents are working on which stories, their current branch and worktree, and whether any are blocked or awaiting review. Her SDP aligns with the systems engineer's SSS and the product manager's epics. Throughout her workflow, installed skills (git-workflow, audit-trail) are enforced automatically via BMAD `critical_actions`.

**Capabilities revealed:** SDP generation, project phase planning, milestone/deliverable tracking, unified sprint management (add/modify/close sprint, movement semantics, done archival), sprint status from single source of truth, agent activity dashboard, retrospectives, cross-role document alignment, skill enforcement

### 3. Product Manager — Noam

Noam translates system requirements into development work. He uses BMAD's PM persona to create the PRD, break it into epics and stories with `/bmad-bmm-create-epics-and-stories`, and run sprint planning with `/bmad-bmm-sprint-planning`. During sprint planning, the Scrum Master asks Noam to define sprint capacity (number of items), and stories are moved from the backlog section of `sprint-status.yaml` into the sprint using multi-criteria prioritization — not just epic precedence. Bugs reported by developers are added to the backlog section alongside stories and prioritized into sprints. The single `sprint-status.yaml` file is the source of truth for all sprint and backlog state. He generates the SRS (Software Requirements Specification) and SDD (Software Design Description) from project artifacts using the MIL-STD-498 workflows. His stories are implementation-ready, containing acceptance criteria, technical context, and test expectations. He validates PRDs and checks implementation readiness before handoff to development. He uses `/open-graph` to see which PRD requirements already have outbound edges to architecture decisions and epics — requirements with no outbound edges are highlighted as coverage gaps before sprint planning begins.

**Capabilities revealed:** PRD creation/validation, epics & stories, unified sprint planning with single `sprint-status.yaml`, capacity-based sprints, movement semantics, bug prioritization, SRS/SDD generation, implementation readiness checks, story lifecycle management, knowledge graph PRD coverage analysis

### 4. Architect — Yael

Yael defines the technical architecture, UX design, technology stack, and integration points. She uses `/bmad-bmm-create-architecture` to document decisions and `/bmad-bmm-create-ux-design` for UX specifications. She generates IDD (Interface Design Description), IRS (Interface Requirements Specification), HRS (Hardware Requirements Specification), and architecture documents, as well as SRS for the technical requirements. She validates that architecture aligns with the PRD and epics using `/bmad-bmm-check-implementation-readiness`. She installs architecture-specific skills (logging, OpenTelemetry, Vercel/React best practices) to ensure the development team follows her architectural decisions through their AI agents. She uses `/open-graph` to visualize the knowledge graph and verify that every architecture decision node links back to a PRD requirement — orphaned architecture nodes with no inbound edges from the PRD surface traceability gaps before epics are written.

**Capabilities revealed:** Architecture creation/validation, UX design, IDD/IRS/HRS generation, implementation readiness, architecture skill enforcement, technology stack documentation, knowledge graph traceability verification

### 5. Test Engineer — Oren

Oren defines test plans and generates test documentation. He uses the MIL-STD-498 workflows to produce the STD (Software Test Description) and STR (Software Test Report) from architecture and story specifications. He uses `/bmad-bmm-qa-automate` to generate automated E2E tests from implemented features, and reviews code with `/bmad-bmm-code-review` during the story cycle. During code reviews, his BMAD agent suggests generating bug issues when problems are found in already-delivered features — bugs are proposed to Oren for confirmation, then added to the backlog for sprint prioritization. He installs the test-generator and test-accompanied-development skills to ensure developers write tests alongside code. The `auto-bug-detection` skill ensures that any coding agent encountering defects in released code proposes a structured bug report.

**Capabilities revealed:** STD/STR generation, automated test generation, code review with bug detection, bug story generation, test-alongside enforcement, test plan documentation

### 6. DevOps Engineer — Amit

Amit manages CI/CD pipelines, repository structure, and deployment configurations. He uses the DevOps agent persona with its operational playbooks to define deployment strategies (canary, blue-green, rolling), configure infrastructure (PV/PVC, load balancers), and manage Helm charts. His DevOps BMAD agent now has `critical_actions` that load the skills MANIFEST on activation — Docker hardening, image signing, git-workflow, and security verification skills are enforced automatically during every BMAD session, not just when Amit remembers to invoke them. He configures the git-workflow-skill to standardize branching and PR processes across the team. In air-gapped environments, he ensures the full skill and BMAD stack works offline.

**Capabilities revealed:** DevOps agent persona with skill enforcement via `critical_actions`, deployment playbooks, Docker security skills, git workflow enforcement, air-gapped operation, infrastructure configuration

### 7. Chief Architect — Alon (Methodology Owner)

Alon defines the enterprise development methodology and builds the tooling to enforce it. He uses ma-agents to package organizational engineering standards as portable skills, customizes BMAD agent personas to fit the organization's processes, and develops new specialized agents (SRE, Cyber, MIL-STD-498) for roles specific to defense. He selects which skills are mandatory (`always_load: true`), authors custom skills using the skill-creator, and runs `npx ma-agents` across projects to ensure uniform methodology adoption. He architects the BMAD extension module using BMAD 6.2.0's native `module.yaml` identity pattern with setup skill, designs bug management and sprint workflows, and ensures all extensions survive BMAD updates via the anti-zombie config pattern. When upgrading from earlier ma-agents versions (bundling bmad-method 6.0.4), Alon relies on the installer to perform in-place migration — rebuilding the 4 custom agents from `.customize.yaml` + XML definitions to native 6.2.0 skill-based agent folders (`SKILL.md`, `prompts/`, `resources/`, `scripts/`), converting all 34 operational workflows from legacy formats to proper SKILL.md packages, and cleaning up legacy artifacts automatically. He uses BMAD Builder's Agent Builder to create and maintain the 4 custom agents and Workflow Builder to create and maintain the 34 operational workflows — both tools produce standard skill folder output with lint gate validation. He uses the full BMAD workflow — from brainstorming through architecture to implementation — to develop ma-agents itself. He monitors the agent activity dashboard to maintain governance visibility across all active agents — verifying that agents are operating on the correct stories, branches, and worktrees in accordance with the git-workflow-skill. He configures multi-repository project layouts during installation — separating the knowledgebase (planning artifacts) and sprint management (stories, sprints, backlog) into dedicated repositories while keeping implementation code in the main repo. All BMAD workflows automatically resolve to the correct repository paths, and agents operating in the code repo discover planning context and story specs via the cross-reference file. He ensures `_bmad-output` is committed to version control as project knowledge. He monitors the knowledge graph via `/open-graph` to maintain governance visibility across artifact traceability — confirming that all architecture decisions have inbound edges from documented PRD requirements and all epics trace to architecture nodes. Orphaned nodes surface planning gaps before implementation begins. He verifies that the graph's provenance metadata (creator, agent, date) accurately reflects which agents performed which design decisions.

**Capabilities revealed:** Skill authoring and governance, BMAD 6.2.0 module architecture with `module.yaml` and setup skill, agent building via BMAD Builder (skill folder output), workflow building via Workflow Builder, 6.0.4→6.2.0 migration via installer, multi-repository project layout configuration, methodology definition, enterprise-wide deployment, custom agent development, bug/sprint workflow design, agent activity dashboard governance, knowledge graph traceability governance, BMAD self-application

### Journey Requirements Summary

| Capability Area | Driven By |
|----------------|-----------|
| MIL-STD-498 document generation (SSS, SSDD, OCD, SDP, SRS, SDD, STD, STR, IDD, IRS, HRS) | Eli, Dana, Noam, Yael, Oren |
| PRD/Epic/Story lifecycle | Noam, Yael |
| Architecture & UX design workflows | Yael |
| Unified sprint-status management (add/modify/close sprint, movement semantics, done archival) | Dana, Noam |
| Bug management (detection, story generation, backlog integration) | Oren, Dana, Noam |
| Skill enforcement via `critical_actions` and top-priority injection | All (enforced), Alon (architecture) |
| Automated test generation & code review with bug detection | Oren |
| DevOps playbooks & deployment workflows | Amit |
| Docker/security skill enforcement | Amit, Oren |
| BMAD extension module architecture | Alon |
| Skill authoring & governance | Alon |
| Agent persona customization | Alon |
| Cross-agent methodology portability (12 agents incl. OpenCode) | All |
| Cline workflow wrappers — BMAD skills callable via `/workflow-name` | Alon (methodology owner), all Cline users |
| Air-gapped / on-prem operation | Amit, Alon |
| Inter-role document traceability | Eli → Noam → Yael → Oren (full chain) |
| `_bmad-output` as version-controlled project knowledge | All |
| Agent activity dashboard (real-time per-agent status, worktree, branch, story) | Dana, Noam, Alon |
| BMAD 6.2.0 migration (agent rebuild, workflow conversion, module update, legacy cleanup) | Alon |
| BMAD Builder agent/workflow creation and maintenance | Alon |
| Multi-repository project layout (knowledgebase, sprint mgmt, code separation) | Alon, Dana, Noam |
| Knowledge graph — automatic traceability, graph visualization, document navigation | Noam, Yael, Alon |

## Domain-Specific Requirements

### Compliance & Standards

- **MIL-STD-498** — Primary documentation standard for defense software deliverables. ma-agents must generate compliant DIDs (SSS, SSDD, OCD, SDP, SRS, SDD, STD, STR, IDD, IRS, HRS) that pass organizational review gates
- **Enterprise SDLC governance** — The methodology must align with organizational software development policies, including phase-gate reviews, traceability requirements, and configuration management
- **Audit trail** — AI agent activities should be trackable (ai-audit-trail skill) to demonstrate that methodology was followed during development

### Technical Constraints

- **Air-gapped / disconnected environments** — Skills and BMAD workflows must install and function fully offline. No runtime dependency on external registries or cloud services
- **On-prem AI agents** — Must support AI tools deployed internally (Cline, Cursor running against local models) alongside public cloud agents (Claude Code, Copilot, Gemini)
- **No data exfiltration** — Skills must not transmit project data externally. Skill content is static instructions, not data-collection mechanisms
- **Cross-platform** — Must work on Windows, macOS, and Linux (already supported via Node.js + platform-aware paths)

### Integration Requirements

- **Git-based workflows** — All development artifacts (skills, BMAD workflows, project docs, `_bmad-output`) must be version-controlled and work within existing git branching strategies
- **`_bmad-output` as project knowledge** — The `_bmad-output` folder (planning artifacts, implementation artifacts) is version-controlled project knowledge, never gitignored. This folder holds system knowledge critical to project continuity
- **CI/CD pipeline compatibility** — `npx ma-agents install` must be scriptable for automated setup in CI/CD pipelines without interactive prompts (`--yes`, `--force` flags)
- **BMAD-METHOD ecosystem** — First-class integration with BMAD's install, update, recompile, and customize pipeline. Changes to BMAD must not break ma-agents and vice versa
- **BMAD Builder extension architecture** — All BMAD-facing enhancements (skill enforcement, bug workflows, sprint workflows, custom agents) must use official BMAD Builder extension points. With 6.2.0: module identity via `module.yaml` (`code`, `description`, `module_version`), capability registration via `module-help.csv`, config management via setup skill writing to `config.yaml`/`config.user.yaml`. Agents built via BMAD Agent Builder (produces skill folders). Workflows built via BMAD Workflow Builder (produces SKILL.md packages). Zero bmad-method core modifications

### Risk Mitigations

- **Methodology drift** — Risk: teams customize skills locally and diverge from the enterprise standard. Mitigation: `always_load: true` for mandatory skills, manifest-based version tracking, centralized skill distribution
- **Agent compatibility breakage** — Risk: AI agent vendors change their configuration format. Mitigation: agent-specific template system with resource mapping allows format changes without rewriting skills
- **BMAD version conflicts** — Risk: BMAD updates overwrite ma-agents customizations. Mitigation: BMAD 6.2.0 module with independent `code` identity in `module.yaml` survives updates; anti-zombie config pattern ensures setup re-runs are safe; module setup skill cleans stale entries before writing new values
- **BMAD 6.0.4→6.2.0 migration** — Risk: legacy agent patterns (`.customize.yaml`, XML definitions, YAML workflows) break when BMAD removes the legacy workflow engine. Mitigation: installer performs atomic in-place migration preserving customizations; NFR29 guarantees all-or-nothing migration; rollback on failure. Fresh installations deploy directly in 6.2.0 format
- **Skill enforcement failure** — Risk: agents install skills but ignore them during operation. Mitigation: multi-layered enforcement — top-priority instruction injection, BMAD `critical_actions` on agent activation, per-agent hooks (Claude Code), and context persistence research

## Innovation & Novel Patterns

### Detected Innovation Areas

- **Methodology-as-Code paradigm** — Engineering standards and SDLC practices are codified as portable skill packages rather than wiki pages, training decks, or tribal knowledge. Skills are versioned, installable, and enforceable — treating methodology like software
- **Install AND Enforce paradigm** — The first cross-agent skill system that doesn't just install skills but ensures agents actually use them. Multi-layered enforcement: top-priority instruction injection, BMAD `critical_actions` on agent activation, per-agent hooks, and context persistence. Moves from advisory ("please read the manifest") to enforced ("skills loaded before any workflow executes")
- **Agent-agnostic governance layer** — No existing tool provides a standards enforcement layer across multiple AI coding agents. ma-agents creates a new product category: the methodology middleware between organizations and their AI tools
- **BMAD-native extension architecture** — Uses official BMAD Builder extension points to inject enforcement, workflows, and agent behaviors without modifying the BMAD core. With 6.2.0, the extension module adopts native module identity (`module.yaml` with `code` field), setup skill for config management, and agents/workflows as standard skill folders. Demonstrates that complex cross-cutting concerns (skill enforcement, bug management, sprint workflows, specialized agents) can be delivered as extension modules that survive upstream updates via the anti-zombie config pattern
- **Bug-as-first-class-entity in AI development** — Agents autonomously detect defects in delivered code and propose structured bug reports to users. This closes the loop between code review and issue tracking within the AI agent workflow
- **Structured skill format as implicit DSL** — The skill.json + SKILL.md + agent template system with frontmatter injection and resource mapping constitutes a domain-specific authoring format for packaging engineering practices into agent-consumable instructions
- **Non-hierarchical SDLC knowledge graph** — Unlike traceability matrices that assume a strict parent-child hierarchy, this graph supports any-to-any relationships. A story's acceptance criterion can simultaneously reference the epic that scoped it, the architecture decision that constrained it, and the UX design that specified it — without any of these being "the" canonical source. A central files table maps short file IDs to arbitrary file pointers (relative paths, absolute paths, Confluence URLs, any document reference), so the graph is not bound to files in the repository. Relationships are first-class typed directed edges with full provenance (creator, AI agent, date). Built automatically by skills as they generate artifacts — no human cross-referencing required. The result is a living, queryable, visual map where influence flows in any direction: jumping from a node in the graph to the exact heading in any referenced document

### Validation Approach

- Skills produce functionally equivalent agent behavior across all 12 targets — same methodology input, same engineering output regardless of agent
- Skill compliance rate measurably improves from ~0% to >90% for `always_load: true` skills
- Organizations can add/remove AI agents without rewriting methodology — portability is provable by installing on a new agent type (e.g., OpenCode)
- Skill authoring is accessible to engineering leads, not just toolsmiths — the format is markdown-based, not code-heavy
- BMAD extension module survives upstream updates — testable by running `npx bmad-method install --action update`

### Risk Mitigation

- **Paradigm adoption risk** — New categories require education. Mitigation: the tool works immediately via `npx` without requiring buy-in to the full paradigm; teams can start with one skill and expand
- **Format lock-in risk** — If the skill format becomes a bottleneck. Mitigation: format is deliberately simple (JSON metadata + markdown content), making migration or evolution straightforward
- **Competitive moat risk** — AI agent vendors may build their own methodology features. Mitigation: agent-agnostic positioning means ma-agents benefits from more agents, not fewer; vendor features would need to be cross-agent to compete

## Developer Tool Specific Requirements

### Project-Type Overview

ma-agents is a Node.js CLI tool that distributes language-aware engineering methodology packages across AI coding agents. The tool runtime is JavaScript/Node.js; the skill content spans language-neutral practices and language-specific standards for C++, C#, Node.js, JavaScript, and Python, with more languages expected as the organization's needs grow.

### Language Matrix

| Layer | Languages / Formats |
|-------|-------------------|
| Tool runtime | Node.js (JavaScript) |
| Skill content — language-neutral | Architecture, security, documentation, workflow, testing methodology |
| Skill content — language-specific | C++, C#, Node.js, JavaScript, Python (current and planned) |
| Skill authoring format | JSON (metadata) + Markdown (content) + YAML (manifests) |
| Agent configuration targets | Agent-native formats (markdown instructions, YAML config, JSON rules) |

### Installation Methods

| Method | Status | Notes |
|--------|--------|-------|
| `npx ma-agents` | Current — primary | Zero-install via npm registry, interactive wizard + direct CLI modes. Bundles all BMAD components |
| `npx ma-agents install --yes --force` | Current — CI/CD | Non-interactive scriptable mode for pipeline automation |

### IDE / Agent Integration Model

ma-agents does not integrate as an IDE extension. Instead, it injects skill content into each agent's native configuration directory:

| Agent | Integration Point |
|-------|------------------|
| Claude Code | `.claude/` directory, `CLAUDE.md` instruction injection (top-priority placement) |
| Cursor | `.cursor/rules/` directory |
| Cline | `.cline/` directory with resource mapping (references→docs, assets→templates); instruction injection into `.cline/clinerules.md` (single source of truth); `.clinerules/` directory (Cline reads all `.md`/`.txt` files inside it); `.clinerules/workflows/` subdirectory for auto-generated skill invocation wrappers |
| Copilot | `.github/copilot-instructions.md` |
| Gemini | `.gemini/` directory |
| Kilocode | `.kilocode/rules/` directory |
| OpenCode | `.opencode/skills/` directory, `opencode.json` instructions array (JSON-based injection, configs merge not replace) |
| Antigravity | `_bmad/skills/` directory |
| Visual Studio | **Gap — solution needed.** No current integration path for Visual Studio's AI assistant (GitHub Copilot in VS). Requires investigation into VS-specific agent configuration |

### Documentation & Methodology Resources

| Resource | Status |
|----------|--------|
| README, QUICK_START, DEVELOPMENT, CONTRIBUTING | Current — developer-facing |
| SKILLS_STRUCTURE | Current — skill authoring reference |
| Methodology presentation | In development — will be bundled with installation to onboard teams on the enterprise methodology |
| PRD (this document) | In progress |

### Implementation Considerations

- **Cline workflow generation** — BMAD installs skills to `.cline/skills/` using Claude Code-style YAML frontmatter that Cline does not natively interpret. Per Cline's documentation, `.clinerules/` is a **directory** that Cline reads recursively (all `.md` and `.txt` files inside it); `.clinerules/workflows/` is a subdirectory within it for slash-command workflows, resolved as `/workflow-name`. Instruction injection into Cline uses `.cline/clinerules.md` as the **single source of truth** — the installer writes the ma-agents instruction block exclusively to this file; no instruction content is written to `.clinerules` or its subdirectories. After every BMAD install, update, or migration where Cline is a selected tool, the installer ensures `.clinerules` exists as a directory (removing any legacy flat-file at that path first if present), then scans `.cline/skills/` and generates a `.clinerules/workflows/<skill-name>.md` wrapper for each skill subdirectory. Wrappers are two-variant: skills with a `workflow.md` receive a delegation wrapper; skills with only SKILL.md receive a read wrapper with a frontmatter-ignore instruction. Without these wrappers, BMAD skills are present on disk but unreachable via Cline's slash-command invocation system
- **OpenCode integration** uses JSON-based instruction injection (`opencode.json` instructions array) rather than markdown comment blocks. The installer must handle JSON config merging (OpenCode configs merge, not replace) and skill path resolution for `.opencode/skills/`
- **Visual Studio integration** is an identified gap. The team needs to investigate how Visual Studio exposes AI agent configuration (Copilot Chat extensions, `.editorconfig`-adjacent patterns, or VS-specific instruction files) and determine the appropriate injection mechanism
- **Bundled BMAD installation** bundles bmad-method and external modules inside the npm package, pre-populating bmad-method's cache. Node.js and npm are always available in target environments
- **Language-specific skill growth** — the skill format must accommodate language-specific content (coding standards, patterns, linting rules) without requiring changes to the core installer when new languages are added

## Functional Requirements

### Skill Management & Portability

- FR1: Engineers can install one or more skills into any supported AI agent with a single command
- FR2: Engineers can uninstall previously installed skills from an agent
- FR3: Engineers can view the list of all available skills with descriptions and categories
- FR4: Engineers can view the installation status of skills for a specific agent
- FR5: Engineers can upgrade skills when a newer version is available, with upgrade detection
- FR6: Engineers can install skills in non-interactive mode for CI/CD pipeline automation
- FR7: Engineers can install skills across multiple agents simultaneously from one manifest
- FR34: Engineers can target any of the supported IDE agents (Claude Code, Cursor, Cline, Copilot, Gemini, Kilocode, OpenCode) for skill installation
- FR35: Engineers can target BMAD specialized agents (SRE, DevOps, Cyber, MIL-STD-498) for persona installation
- FR36: Skills produce functionally equivalent behavior regardless of which agent they are installed into
- FR37: Engineers can switch between AI agents and retain the same methodology framework
- FR38: The system translates skill content into each agent's native configuration format automatically
- FR44: Engineers can install and use skills in air-gapped environments without internet access
- FR45: Engineers can use ma-agents on Windows, macOS, and Linux
- FR46: Engineers can use ma-agents with on-premise AI agents running against local models
- FR47: The system tracks installed skill versions per agent via manifest for upgrade/downgrade detection

### Skill Enforcement

- FR51: The installer injects the planning instruction at the TOP of agent instruction files, not the bottom — ensuring highest priority during LLM context processing
- FR52: The installer deploys a BMAD extension module (`extends-module: bmm`) that injects skill-loading `critical_actions` into BMAD agents — skills are loaded before any menu or workflow executes
- FR53: All 11 BMAD agents (4 custom: SRE, DevOps, Cyber, MIL-498 + 7 built-in: bmad-master, analyst, architect, dev, pm, qa, sm) include skill-loading `critical_actions` — custom agents via `.customize.yaml` files, built-in agents via the BMAD extension module
- FR54: Per-agent enforcement mechanisms are implemented where the agent supports them (e.g., Claude Code hooks that verify manifest was read)
- FR55: Context persistence strategies ensure skills survive LLM context compression and session restoration (via BMAD sidecar memory or equivalent)

### BMAD-METHOD Integration

- FR8: Engineers can install the BMAD-METHOD framework alongside skills in a single workflow
- FR9: Engineers can update an existing BMAD installation to a newer version
- FR10: Engineers can apply organization-specific customizations to BMAD that persist across updates
- FR11: Engineers can register MIL-STD-498 workflows into an existing BMAD installation
- FR12: Engineers can trigger BMAD recompile after customization changes

### Bundled Installation

- FR74: The ma-agents npm package bundles bmad-method v6.3.0 as a direct dependency — no `npx` download at install time
- FR75: The ma-agents npm package bundles pre-cloned BMAD external modules (bmb, cis, tea, gds, wds) under `lib/bmad-cache/` — no git clone at install time
- FR76: Before invoking bmad-method install, the installer pre-populates `~/.bmad/cache/external-modules/` from the bundled cache so bmad-method finds modules locally
- FR123: The ma-agents installer collects all BMAD-relevant configuration during its own interactive wizard — selected platforms/agents, user name, project path, module selections — and passes them to bmad-method as explicit CLI flags (`--tools`, `--modules`, `--directory`, `--user-name`, `--communication-language`, `--document-output-language`, `--output-folder`, `--custom-content`), replacing the current silent install approach
- FR124: bmad-method performs its full configuration using the explicit parameters passed by ma-agents — the `--yes` flag suppresses prompts for parameters already supplied via flags, but does not skip configuration steps
- FR125: When bmad-method introduces new CLI parameters that ma-agents has not mapped, the `--yes` flag causes bmad-method to apply its own sensible defaults for those parameters — ensuring no configuration is missed even as bmad-method evolves
- FR126: The user experiences a single unified installation wizard — bmad-method runs non-interactively with full explicit parameters, with no separate BMAD interactive prompt appearing during the ma-agents installation flow
- FR127: In non-interactive mode (`--yes --force`), ma-agents uses its own defaults for all parameters and passes them to bmad-method via the same explicit flag mechanism — identical code path as interactive mode with pre-determined answers, ensuring CI/CD installations produce identical BMAD configuration as interactive ones

### BMAD Extension Architecture

- FR104: The BMAD extension module is restructured with a proper BMAD 6.2.0 `module.yaml` containing `code` (module identifier), `description`, and `module_version` fields — replacing the legacy `extends-module: bmm` pattern in the current `lib/bmad-extension/module.yaml`
- FR105: A module setup skill is created that writes module configuration to `config.yaml` (shared, git-committed), `config.user.yaml` (personal, gitignored), and `module-help.csv` (capability registry) — following the BMAD 6.2.0 anti-zombie pattern where re-running setup removes all existing entries for the module's code before writing new values
- FR106: The dual-layer agent definition pattern — base config in `lib/bmad-customizations/bmm-{agent}.customize.yaml` + extended config in `lib/bmad-extension/agents/bmm-{agent}.customize.yaml` — is consolidated into a single authoritative agent skill folder per agent under the module's `agents/` directory

### BMAD 6.2.0 Agent Architecture Migration

#### Agent Conversion

- FR94: Each custom agent (SRE, DevOps, Cyber, MIL-498) is rebuilt as a BMAD 6.2.0 skill-based agent with a standard skill folder structure: `SKILL.md` (identity, persona, activation, menu triggers), `prompts/` (internal commands), `resources/` (reference data and memory), `scripts/` (deterministic operations with tests)
- FR95: Agent capabilities currently defined as `critical_actions` in `.customize.yaml` files are migrated to internal commands in the agent's `prompts/` directory — each `critical_action` becomes a prompt file that executes on agent activation
- FR96: Agent persona, identity, communication style, and activation sequence are defined in the agent's `SKILL.md` frontmatter and body — replacing legacy XML `<agent>` definitions currently in `_bmad/custom/agents/*.md`
- FR97: Agent menu items and command routing are defined via SKILL.md frontmatter trigger phrases and `prompts/` directory dispatch — replacing legacy XML `<menu-handlers>` with BMAD 6.2.0 dynamic routing (Progressive Disclosure Layer 3)

#### MIL-498 Workflow Conversion

- FR98: All 11 MIL-STD-498 DID workflows (SSS, SSDD, OCD, SDP, SRS, SDD, STD, STR, IDD, IRS, HRS) are converted from YAML format (`workflow.yaml` + `instructions.md` pairs) to BMAD 6.2.0 SKILL.md packages classified as Complex Workflow skill type — each workflow gets its own skill folder with `SKILL.md` entrypoint, `prompts/` for step files, and `templates/` for DID output blocks
- FR99: MIL-498 workflow instructions currently in separate `instructions.md` files are restructured as progressive disclosure step files in `prompts/` (Layer 4) — preserving strict sequential execution required for compliance-critical document generation while benefiting from reduced context loading per step
- FR100: MIL-498 workflow template output checkpoints (currently implemented via the legacy `<template-output>` XML tags in `workflow.xml`) are reimplemented as skill-level user confirmation gates within step files — preserving the same pause-and-confirm behavior for document section approval

#### SRE / DevOps / Cyber Workflow Conversion

- FR101: SRE operational playbooks (health-check, fix-deployments, performance-opt, check-deployment-status, check-secrets, day-2-ops, deployment-strategies, gitops-status — 9 workflows) are each packaged as BMAD 6.2.0 skill packages with `SKILL.md` entrypoint. Workflows with multi-step interactive processes use Complex Workflow type; single-pass playbooks use Simple Workflow type
- FR102: DevOps operational playbooks (configure-infrastructure, optimize-pipelines, manage-helm, disconnected-deployment, docker-compose-setup, sign-docker-image — 6 workflows) are each packaged as BMAD 6.2.0 skill packages with `SKILL.md` entrypoint
- FR103: Cyber security playbooks (vulnerability-scan, security-audit, threat-modeling, generate-certs, immunity-estimation, vault-secrets, verify-docker-users, verify-image-signature — 8 workflows) are each packaged as BMAD 6.2.0 skill packages with `SKILL.md` entrypoint

#### Upgrade Path

- FR107: The installer detects the installed BMAD version and performs in-place migration from 6.0.4 agent patterns (`.customize.yaml`, XML agent definitions, YAML workflows) to 6.2.0 skill-based patterns during normal `npx ma-agents` installation — no separate upgrade command required
- FR108: During migration, the installer preserves user customizations applied to agent personas, menu items, or workflow parameters by extracting customization values from existing files and applying them to the new SKILL.md-based structure
- FR109: After successful migration, the installer removes legacy artifacts: old `.customize.yaml` files in `lib/bmad-customizations/` and `lib/bmad-extension/agents/`, XML agent definitions in `_bmad/custom/agents/`, YAML workflow files in `lib/bmad-workflows/mil498/`, and the `_bmad-custom-backup-temp/` directory
- FR110: For fresh installations (no existing BMAD), the installer deploys directly in 6.2.0 skill-based format — no legacy artifacts are created

### BMAD 6.3.0 Plugin Migration

#### Plugin Packaging

- FR182: The ma-agents extension module is repackaged as a BMAD-Builder-compliant plugin with a `.claude-plugin/marketplace.json` manifest at the bundle root. The marketplace wrapper is format-convention only — the plugin content is tool-agnostic and routes to any `--tools` target supported by the BMAD installer (Claude Code, Copilot, Cline, Roo Code, KiloCode, and future additions)
- FR183: Module definitions move to `skills/module.yaml` (aligned with BMAD 6.2.2+) and the extension is renamed out of the reserved `bmad-*` namespace — all skills previously named `bmad-ma-agent-*` are renamed to `ma-agent-*` and the module code is updated accordingly. Skill IDs in `MANIFEST.yaml`, registration CSVs, and internal references are swept to match
- FR184: The bundled plugin is assembled at build time into `lib/bmad-extension-plugin/` by a build script, and is distributed inside the ma-agents npm tarball alongside `lib/bmad-cache/` — the end user's installation never fetches the plugin from a network source

#### Plugin Staging & Installation Flow

- FR185: During `npx ma-agents install`, the installer stages the bundled plugin to a project-local directory (`<project>/.ma-agents-plugin-stage/`) before invoking bmad-method, then passes that local path to bmad-method via `--custom-source <local-path>` — exercising BMAD's PluginResolver local-file strategy with no network access required
- FR186: The plugin stage directory is removed after successful bmad-method installation — it is not persisted in the project tree and is not committed to version control. A partial/failed install leaves the stage intact for diagnostic inspection
- FR187: The installer ceases post-install manifest surgery (`applyCustomizations()` in `lib/bmad.js`) — the code path that parses `_bmad/_config/manifest.yaml` and `files-manifest.csv`, filters for hardcoded module names, and injects custom agent YAML into `_bmad/_config/custom/agents/` is removed. BMAD's own installer handles all placement via the plugin manifest

#### Config & Path Updates

- FR188: All ma-agents reads of BMAD configuration are redirected from `_bmad/_config/*` to the canonical v6.3.0 path `_bmad/bmm/config.yaml`, matching the removal of the `bmad-init` skill and BMAD's shift to direct file reads by agents
- FR189: Any ma-agents tooling or skill that previously referenced the singleton `spec-wip.md` is updated to enumerate `spec-{slug}.md` files and filter by the new `status` frontmatter field (aligning with upstream #2214)

#### Upstream Persona Consolidation

- FR190: The `bmad-init`, `bmad-agent-qa` (Quinn), `bmad-agent-sm` (Bob), and `bmad-agent-quick-flow-solo-dev` (Barry) skills are retired from the ma-agents MANIFEST — `bmad-init` because the upstream skill was removed, the three persona skills because they merged into the unified Amelia Developer agent in BMAD 6.3.0. Retirement includes MANIFEST.yaml entries, skill source files, and any agent-catalog references
- FR191: Documentation and training materials are updated to reflect the Amelia-unified Developer persona — references to Quinn, Bob, and Barry in user-facing docs are either rewritten to reference Amelia or removed

#### Multi-Tool Verification

- FR192: The plugin install flow is smoke-tested against at least two non-Claude `--tools` targets during release verification (minimum: Copilot + Cline; recommended: also Roo Code and KiloCode to exercise the disconnected-friendly IDE set) — each target must produce a functional skill installation with no tool-specific plugin repackaging

#### Deferred Memory-Agent Conversion (follow-up epic)

- FR193: In a follow-up epic after 6.3.0 lands, the Demerzel (ML Scientist) persona is restructured as a BMAD Builder Memory-agent with memory files at `_bmad/memory/ma-agent-ml/` (PERSONA.md, CREED.md, BOND.md, MEMORY.md, CAPABILITIES.md, INDEX.md) and a lean bootloader `SKILL.md` — driven by the explicit cross-session memory requirement in `ml-advise` (search past experiments, retrospectives, TechSpecs)
- FR194: In the same follow-up epic, the Gad (SQA Engineer) persona is restructured as a Memory-agent at `_bmad/memory/ma-agent-sqa/` to accumulate audit findings, IEEE 12207 compliance history, and bug-pattern observations across sessions
- FR195: Yael (Cyber), Amit (DevOps), and Alex (SRE) remain stateless agents — each invocation is task-scoped with no persistent cross-session memory requirement. Converting them would add maintenance cost with no workflow benefit

### BMAD v6.6.0 Integration

- FR196: When no IDE-category agents are selected during a fresh BMAD install, the installer must skip the BMAD invocation entirely rather than passing `--tools none` to bmad-method. Selecting zero IDE targets is a valid configuration (e.g., pure non-BMAD installs) and must not produce an error
- FR197: The bundled bmad-method version pin (FR74) is upgraded from v6.5.0 to v6.6.0. On first run after the upgrade, bmad-method automatically migrates any affected internal configuration fields; no user action is required and the install command output is unchanged
- FR198: The installer CLI defers exposure of the `--set <module>.<key>=<value>` and `--list-options [module]` flags introduced by bmad-method v6.6.0. These are available as bmad-method pass-through flags and may be surfaced in a future story when CI/Docker non-interactive config use cases are validated

### Specialized Agent Personas (MIL-STD-498 / SRE / DevOps / Cyber)

- FR35: Engineers can target BMAD specialized agents (SRE, DevOps, Cyber, MIL-STD-498, SQA) for persona installation
- FR42: The Chief Architect can develop new specialized agent personas for enterprise-specific roles

### MIL-STD-498 Document Generation

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

### SDLC Workflow Execution

- FR24: Product managers can create PRDs through guided collaborative workflows
- FR25: Product managers can break PRDs into epics and user stories
- FR26: Product managers can run sprint planning from epics — generating or refreshing the unified `sprint-status.yaml` with epic status, backlog, and sprint sections
- FR27: Architects can create architecture documents through guided workflows
- FR28: Architects can create UX design specifications
- FR29: Engineers can check implementation readiness across PRD, architecture, and epics
- FR30: Engineers can run code reviews against established standards
- FR31: Test engineers can generate automated E2E tests from feature specifications
- FR32: Project managers can track sprint status and surface risks — reading from the unified `sprint-status.yaml` file
- FR33: Teams can run retrospectives at epic boundaries

### Bug Management

- FR60: Bugs are structured entities with required fields: problem description, reproduction steps, bug type, version found, environment constraints, severity, and status
- FR61: A BMAD extension workflow (deployed via `extends-module: bmm`) generates a structured bug story from a bug report
- FR62: The `auto-bug-detection` skill instructs coding agents to propose a bug issue to the user when they detect a problem in already-delivered code (story done, code merged, released version)
- FR63: During BMAD code-review workflows, agents suggest generating bug issues when relevant problems are found in delivered features
- FR64: Bugs exist in the backlog as standalone items — never assigned to an epic

### Sprint & Backlog Management — Unified Sprint-Status

#### Unified Data Model

- FR65: All sprint, backlog, and epic status data is managed in a single `sprint-status.yaml` file with three sections: `epics` (epic-level status tracking), `backlog` (items not assigned to any sprint), and `sprints` (sprint entities with their assigned items). The separate `backlog.yaml` and per-sprint `sprints/sprint-N.yaml` files are eliminated — there is one file, one source of truth
- FR66: Sprint capacity is defined by number of items (stories + bugs), configured by the Scrum Master during sprint planning
- FR67: Story/bug prioritization supports multiple criteria beyond epic precedence — criteria include severity, business value, dependencies, type, and age
- FR128: Bugs are a story type in the backlog — they have the same lifecycle as stories (backlog → ready-for-dev → in-progress → review → done) plus bug-specific fields (problem description, reproduction steps, severity, version found)
- FR133: The `sprint-status.yaml` file includes top-level metadata: `generated` (creation timestamp), `last_updated` (last modification timestamp), `project` (project name), `project_key` (short identifier), `tracking_system` (`file-system` or `jira`), and `story_location` (path to story `.md` files, default `_bmad-output/implementation-artifacts`)
- FR134: Each item in the backlog or sprint sections carries a consistent structure: `id` (story/bug identifier), `type` (`story` or `bug`), `epic` (parent epic number or null for bugs), `title`, `priority` (numeric), `status` (backlog / ready-for-dev / in-progress / review / done / canceled), and `severity` (null for stories, critical/high/medium/low for bugs)
- FR135: Each sprint entity in the `sprints` section carries: `name`, `status` (planning / active / closed), `capacity`, optional `start` and `end` dates, and an `items` list containing the assigned stories and bugs

#### Unified Sprint-Status Schema

The canonical `sprint-status.yaml` schema is:

```yaml
generated: "2026-04-03T12:00:00Z"
last_updated: "2026-04-03T12:00:00Z"
project: ProjectName
project_key: KEY
tracking_system: file-system    # or "jira"
story_location: _bmad-output/implementation-artifacts

epics:
  epic-1:
    status: in-progress          # planning | in-progress | done
    retrospective: null          # optional — path or summary after epic completion

backlog:                         # Stories/bugs NOT assigned to any sprint
  - id: "3-1-story-name"
    type: story
    epic: 3
    title: "Story Title"
    priority: 1
    status: backlog
    severity: null

sprints:
  sprint-1:
    name: "Foundation Sprint"
    status: active               # planning | active | closed
    capacity: 21
    start: "2026-04-03"
    end: "2026-04-14"
    items:                       # Stories/bugs MOVED here from backlog
      - id: "1-2-story-name"
        type: story
        epic: 1
        title: "Story Title"
        priority: 2
        status: in-progress
        severity: null
```

#### Movement Semantics

- FR69: A BMAD extension workflow enables moving stories and bugs from the `backlog` section into a sprint's `items` list — the item is removed from `backlog` and added to the target sprint. Items are never duplicated across sections
- FR129: A BMAD extension workflow (`remove-from-sprint`) enables removing stories or bugs from a sprint's `items` list and moving them back to the `backlog` section of `sprint-status.yaml` — the item is removed from the sprint and returned to the backlog without changing its status
- FR136: When moving items between sprints (e.g., during sprint close), items are removed from the source sprint's `items` list and added to the destination sprint's `items` list — maintaining the invariant that each item exists in exactly one location

#### Sprint Lifecycle

- FR68: A BMAD extension workflow enables adding a new sprint with defined capacity, iteration identifier, optional start/end dates, and initial status of `planning`
- FR70: A BMAD extension workflow enables changing/modifying a sprint (reorder items, swap items, adjust capacity, update dates, change status)
- FR137: A BMAD extension workflow enables closing a sprint. The close workflow executes the following lifecycle:
  1. Items with status `done` are removed from the sprint's `items` list and their `.md` files are archived to a `done/` subfolder
  2. Items with status `canceled` are removed from the sprint's `items` list and their `.md` files are archived to a `done/canceled/` subfolder
  3. Remaining items (in-progress, blocked, backlog, ready-for-dev) are presented to the user with three options: (a) move all to the next sprint, (b) return all to backlog, or (c) decide per item — the user can assign each remaining item individually to the next sprint or to the backlog
  4. The sprint's status is set to `closed`
- FR71: Sprint status displays the unified `sprint-status.yaml` contents — real sprint definitions with assigned items, epic status, and the unassigned backlog — not just a list of epics

#### Done Archival

- FR130: When a story or bug reaches "done" status, it is removed from `sprint-status.yaml` entirely — done items do not clutter the active status view
- FR131: When a story or bug reaches "done" status, its story `.md` file is moved from the active stories directory to a `done/` subfolder — preserving the artifact while keeping the active directory clean
- FR138: The `generate-backlog` skill regenerates the `backlog` section of `sprint-status.yaml` from epics and bug stories, preserving items that are already assigned to sprints (items in any sprint's `items` list are not duplicated into the backlog)

#### Sprint Backend Selection

- FR139: During installation, the installer wizard prompts the user to select a sprint management backend: (a) **local file-system** — `sprint-status.yaml` at the default project path, (b) **remote git repository** — a git URL that is cloned to a local path; `sprint-status.yaml` is read from the cloned repo, (c) **custom filesystem path** — a user-specified path to a `sprint-status.yaml` file, or (d) **Jira** — requires the user to provide a Jira server URL and project key. The selection is stored in `_bmad/bmm/config.yaml` under `sprint_backend`. The `tracking_system` field in `sprint-status.yaml` reflects the active backend (`file-system` or `jira`).
- FR140: When `tracking_system: jira` is active, all sprint management skills operate against Jira as the source of truth for all issue types — stories, epics, bugs, and sprints. Skills use whatever Jira-capable tool the agent has available (any MCP server, plugin, or integration that can communicate with the configured Jira instance). On failure, the skill pauses and presents the user with two options: retry the Jira operation, or switch to file management. If the user chooses to switch, the skill updates `tracking_system` to `file-system` in `sprint-status.yaml` and continues the operation using the local file. The switch is permanent.

### Project Knowledge & Context

- FR58: The installer does not add `_bmad-output` to `.gitignore` — this folder is tracked as version-controlled project knowledge
- FR59: The `_bmad-output` policy is documented in README and installation guidance
- FR79: At project-level installation, the installer generates `_bmad-output/project-context.md` if one does not already exist — providing agents with a constitutional document that governs their behavior throughout the project lifecycle
- FR80: The generated project-context.md contains platform-agnostic mandatory AI agent operating rules: read MANIFEST.yaml before every task, load all `always_load: true` skills, and use the git-workflow-skill with fresh worktrees per mission (not just branches)
- FR81: The skills manifest path(s) in project-context.md are resolved at install time to the actual installed path for each target platform — no hardcoded agent-specific directory references (e.g., not `.claude/skills/MANIFEST.yaml` literally, but the actual resolved path for the platform being installed)
- FR82: When multiple platforms are installed simultaneously, project-context.md lists all MANIFEST.yaml paths for all installed platforms so any agent can find the correct path for its environment
- FR83: The generated project-context.md documents the full agent mission lifecycle in sequence: (1) pre-flight skill loading, (2) fresh worktree creation via `git worktree add`, (3) implementation, (4) self-review using the code-review skill, (5) PR creation with conventional commit, (6) human review gate — agent does not auto-merge, (7) merge and worktree cleanup, (8) post-mission updates (story status + AiAudit.md)
- FR84: Project-context generation is idempotent — if `_bmad-output/project-context.md` already exists when the installer runs, it is left untouched and generation is skipped without error
- FR85: The generated project-context.md includes inline expansion guidance comments directing users to `bmad-generate-project-context` (post-architecture), `bmad-retrospective` (post-sprint), and manual updates as the living document evolves
- FR86: The BMAD extension module updates `critical_actions` for all BMM agents (4 custom + 7 built-in) and bmad-master (12 total) to load `_bmad-output/project-context.md` during agent initialization — alongside MANIFEST.yaml. CIS module agents are explicitly excluded as project-context governance rules (git workflow, dev lifecycle) do not apply to creative/innovation sessions.

### Multi-Repository Project Layout

- FR111: During installation, the installer asks the user where the project knowledgebase is managed — options: current repository (default), local path, or remote git repository
- FR112: During installation, the installer asks the user where sprint management is managed — options: current repository (default), local path, or remote git repository
- FR113: When the user selects "remote" for either concern, the installer asks for the git URL and a local destination path for cloning. If the destination directory already exists, the installer displays its contents summary and asks the user to confirm before proceeding — it never overwrites an existing directory
- FR114: When the user selects "remote" and the local destination does not exist, the installer clones the repository to the specified path
- FR115: When the user selects "local path" for either concern, the installer validates that the path exists. If it does not exist, the installer alerts the user and asks them to confirm the path or provide a corrected one — it does not silently create the directory
- FR116: When the user selects "current repository" (default) for both concerns, the installer operates in single-repo mode with no additional configuration — preserving current behavior for projects that manage everything in one repository
- FR117: The knowledgebase and sprint management paths are stored in `config.yaml` as shared project configuration fields (`knowledgebase_path`, `sprint_management_path`) — available to all BMAD workflows and agents at runtime
- FR118: The generated `project-context.md` includes the configured knowledgebase and sprint management paths as mandatory agent operating rules — agents are instructed to resolve all planning artifact reads/writes to `{knowledgebase_path}` and all sprint artifact reads/writes to `{sprint_management_path}`
- FR119: All BMAD workflows that produce planning artifacts (PRD creation/editing/validation, architecture creation, UX design, research, product briefs) resolve their output directory from the configured `{knowledgebase_path}` rather than assuming the current working directory
- FR120: All BMAD workflows that produce or consume sprint artifacts (sprint planning, story creation, story status lookup, sprint status via `sprint-status.yaml`, bug management, retrospectives) resolve their paths from the configured `{sprint_management_path}`
- FR121: When the agent activity dashboard is implemented, it resolves story status files and sprint data from the configured `{sprint_management_path}` — correctly reading agent activity across repositories
- FR122: In multi-repo mode, the installer creates a lightweight cross-reference file in the code repository (`_bmad-output/project-layout.yaml`) documenting the knowledgebase and sprint management paths — so agents activated in the code repo can discover where planning and sprint data live without re-running installation

### Cline Workflow Generation

- FR199: When Cline is among the selected tools for a BMAD install, update, or migration, the installer invokes `deployClineWorkflows(projectRoot, tools)` after the BMAD operation completes — scanning `.cline/skills/` for all BMAD-installed skill subdirectories and generating a `.clinerules/workflows/<skill-name>.md` wrapper file for each one. Per Cline's official documentation, `.clinerules/` is a **directory** that Cline reads recursively; all `.md` and `.txt` files inside it are processed as rules. `.clinerules/workflows/` is a subdirectory within it for slash-command workflow definitions
- FR200: For skills that contain a `workflow.md` file, the generated wrapper delegates to that file — allowing Cline to execute the full BMAD workflow document via its native `/workflow-name` invocation. For self-contained skills (SKILL.md only), the wrapper instructs Cline to read SKILL.md while ignoring its YAML frontmatter, which Cline does not natively parse
- FR201: Cline workflow wrappers are regenerated on every qualifying install, update, and migration run — ensuring wrappers stay in sync when skills are added, updated, or removed by BMAD
- FR202: Before generating `.clinerules/workflows/` entries, the installer checks whether `.clinerules` exists as a flat file (a legacy incorrect installation artifact). If a flat file is detected at `.clinerules`, the installer removes it and proceeds to create `.clinerules/` as a proper directory. This migration is silent — no user prompt required. Instruction content previously written to the `.clinerules` flat file must not be re-injected there; `.cline/clinerules.md` is the sole injection target for Cline instruction blocks. The `checkClinerulesDualFileDrift` guard in `installer.js` must no-op when `.clinerules` is already a directory
- FR203: The Cline `instructionFiles` list in `agents.js` must include only `.cline/clinerules.md` as the instruction injection target — `.clinerules` must not appear in this list. `.cline/clinerules.md` is the single source of truth for the Cline instruction block; writing the same instruction content to both `.clinerules` and `.cline/clinerules.md` is a duplicate and is forbidden

### OpenCode Agent Support

- FR56: Engineers can target OpenCode for skill installation with skills placed in `.opencode/skills/`
- FR57: The installer injects skill references into `opencode.json` via the instructions array using JSON config merging (not replacement)

### Agent Activity Dashboard

- FR87: Project managers can invoke a real-time dashboard displaying the current activity of all active AI agents in the project via `npx ma-agents dashboard`
- FR88: The dashboard displays per-agent details: agent type, assigned story identifier, active git worktree path, current branch, and current status (implementing / reviewing / awaiting-review / idle)
- FR89: Dashboard data refreshes automatically at a configurable interval (default: 30 seconds) without requiring manual reload — elapsed time since last refresh is visible
- FR90: Project managers can filter the dashboard by agent type, story identifier, branch, or status category
- FR91: The dashboard distinguishes active agents (in-progress work), agents awaiting human review (PR open, no merge), and idle agents (no current worktree assignment)
- FR92: Project managers can view completed session history per agent: agent type, story identifier, branch, duration, and outcome (merged / abandoned / pending)
- FR93: Dashboard data is derived exclusively from existing project file structures (`_bmad-output/` activity logs, git worktree state, story status files) — no additional persistent data store is required

### Developer Infrastructure

- FR73: The 4 core modules (cli.js, installer.js, agents.js, bmad.js) have automated regression tests that verify architectural contracts (pipeline ordering, additive-only operations, template resolution, command routing)

### Methodology Onboarding

- FR72: A methodology presentation is bundled with BMAD installation and deployed to `_bmad-output/methodology/`, providing team onboarding content for BMAD-METHOD without separate training materials

### Skill Authoring & Governance

- FR39: The Chief Architect can author new skills using the skill format (skill.json + SKILL.md + agent templates)
- FR40: The Chief Architect can designate skills as mandatory (`always_load: true`) for organizational enforcement
- FR41: The Chief Architect can customize BMAD agent personas to fit organizational processes
- FR43: The system generates MANIFEST.yaml from installed skills for agent consumption

### Audit & Traceability

- FR48: The system maintains an audit trail of AI agent activities via the ai-audit-trail skill
- FR49: Document generation workflows maintain traceability across inter-role handoffs (SSS → SRS → SDD → STD)
- FR50: Engineers can validate PRDs and other documents against established standards

### BMAD Knowledge Graph

#### Graph Data Model

- FR141: Every addressable heading anchor in any registered document is a graph node. Node identity uses `file-id#heading-anchor` syntax, where `file-id` is a short identifier defined in the graph's `files` table (e.g., `prd#fr24`). The `files` table maps each `file-id` to a file pointer — which may be a relative path, absolute path, URL (e.g., Confluence page), or any other document reference. Nodes require no manual creation — they are derived from document structure at emit time and registered against the files table
- FR142: Each graph edge is a directed typed relationship from a source node to a target node. Edges are not constrained to hierarchical parent-child relationships — any node may reference any other node regardless of document type or position in the artifact chain. Edge fields: `from` (source node id), `to` (target node id), `type` (one of: `implements`, `derives-from`, `validates`, `traces-to`, `refines`, `informed-by`), `label` (optional human-readable description), `created_by` (user name from BMAD config), `agent` (AI agent identifier — e.g., `claude-code`, `cursor`, `copilot`), `created_at` (ISO 8601 timestamp). No edge field may be null except `label`
- FR143: The graph maintains a bidirectional index: for every node, both its outbound edges (what it references) and inbound backlinks (what references it) are queryable — enabling "what influenced this AC?" and "what was derived from this architecture decision?" without scanning all edges. A single node may have inbound edges from multiple unrelated documents simultaneously

#### JSON Format

- FR144: The knowledge graph is stored as a single JSON file at `_bmad-output/knowledge-graph.json`. The top-level structure is `{ "meta": {...}, "files": {...}, "nodes": [...], "edges": [...] }` — flat, no nesting beyond two levels, using string keys throughout. This structure is optimized for LLM read/write: any model can register a file, add a node, or add an edge by appending to the appropriate section without parsing complex schemas
- FR145: The `files` table is a JSON object mapping short file IDs to file pointer objects: `{ "prd": { "pointer": "_bmad-output/planning-artifacts/prd.md", "title": "PRD", "pointer_type": "relative_path" }, "arch": { "pointer": "_bmad-output/planning-artifacts/architecture.md", "title": "Architecture", "pointer_type": "relative_path" }, "ux-conf": { "pointer": "https://confluence.example.com/page/456", "title": "UX Design", "pointer_type": "url" } }`. `pointer_type` is one of: `relative_path`, `absolute_path`, `url`. This decouples node identity from file location — files can live anywhere
- FR146: Each node object: `{ "id": "file-id#anchor", "file": "file-id", "anchor": "anchor", "title": "Human readable heading text", "type": "requirement|architecture|epic|story|design|test" }`
- FR147: Each edge object: `{ "id": "unique-edge-id", "from": "file-id#anchor", "to": "file-id#anchor", "type": "implements|derives-from|validates|traces-to|refines|informed-by", "label": "optional", "created_by": "name", "agent": "agent-id", "created_at": "ISO8601" }`
- FR148: The `meta` object carries: `{ "schema_version": "1.0", "project": "project-name", "generated": "ISO8601", "last_updated": "ISO8601", "node_count": N, "edge_count": N, "file_count": N }`. All counts are updated on every write — enabling quick integrity checks without parsing the full arrays

#### Automatic Skill Emission

- FR149: BMAD skills that generate or update planning artifacts (create-prd, create-architecture, create-epics-and-stories, create-story, dev-story, bmad-create-ux-design) automatically append nodes and edges to `knowledge-graph.json` upon artifact completion — no user prompt required. If the file does not exist, the skill creates it with the correct schema
- FR150: Before emitting nodes, the skill registers the source document in the `files` table if not already present — assigning a short file ID and recording the pointer and pointer type. Skills may emit edges referencing any previously registered file, not only files in the project repository. This allows a story skill to reference a Confluence UX spec or an external architecture document as an edge target, as long as that file has been registered in the `files` table
- FR151: When a skill emits edges, it resolves source and target nodes from all artifacts that influenced the output — not only the direct parent in the artifact hierarchy. A story skill may emit `derives-from` edges to the epic, `informed-by` edges to architecture sections, and `informed-by` edges to UX design nodes simultaneously. Edge types are determined by the nature of the influence: architecture sections addressing PRD requirements emit `implements`; epics breaking down PRD features emit `derives-from`; stories implementing epics emit `traces-to`; external documents that shaped a decision emit `informed-by`; validation workflows emit `validates`
- FR152: Skills never create duplicate nodes or files entries. Before appending, the skill checks if a node with the same `id` already exists — if so, updates `title` only and skips insertion. Before appending an edge, the skill checks for an existing edge with matching `from`, `to`, and `type` — if found, updates `created_at` and `agent` only. Before adding a file, the skill checks if a file-id already exists — if so, updates `pointer` and `title` only

#### Visualization & Navigation

- FR153: The `open-graph` skill generates or refreshes `_bmad-output/knowledge-graph.html` from `knowledge-graph.json` and opens it. When a VSCode environment is detected, the skill opens the file inside the editor. In non-VSCode environments, the skill opens the file in the system default browser
- FR154: The rendered graph is an interactive visualization. Nodes are labeled with their `title`. Edge direction is shown with arrowheads. Node color encodes `type` (requirement, architecture, epic, story, design, test — 6 distinct colors with a legend). Clicking a node navigates to the source document at the exact heading anchor — using VSCode's native document navigation when available, or displaying a copyable document link otherwise. For nodes whose `files` entry has `pointer_type: url`, clicking opens the URL in the browser
- FR155: Hovering over an edge displays a tooltip showing: edge `type`, `label` (if set), `created_by`, `agent`, and `created_at` — full provenance visible without leaving the graph
- FR156: The graph supports filtering by node type and edge type via interactive controls in the visualization panel. Selecting a node highlights all its direct neighbors and their connecting edges, dimming everything else — isolating all influences on any artifact regardless of which documents they come from
- FR157: The `knowledge-graph.html` renderer functions without network access and without a local server — no external CDN, font, or script dependencies

### Software Quality Assurance (SQA)

#### SQA Agent Persona

- FR158: Quality engineers can activate the SQA Agent (Gad) — a purpose-built persona specializing in structured quality assurance workflows: project auditing, process compliance verification, and standards conformance assessment
- FR159: On activation, Gad presents a numbered menu of available quality workflows with keyboard shortcuts and trigger phrases. Menu items include: Project Audit, IEEE/ISO/IEC 12207 Compliance, and Dismiss Agent. Chat mode is available for ad-hoc quality questions

#### Project Audit Workflow

- FR160: Gad's Project Audit workflow begins by asking whether to run a full audit (all five dimensions) or a partial audit (user selects which dimensions by number) — execution only begins after the user confirms scope
- FR161: The Code-to-Stories Traceability dimension reads done and in-progress items from `sprint-status.yaml` and verifies that each story has traceable code evidence; it also surfaces significant code changes with no backing story, flagging each finding with its story ID and traceability status
- FR162: The Stories-to-Architecture/PRD Alignment dimension maps each epic to its corresponding PRD section, verifies that stories do not introduce architectural decisions contradicting `architecture.md`, and identifies PRD requirements with no corresponding epic or story — producing a PRD coverage table (COVERED / MISSING / PARTIAL) and an architecture compliance issue list
- FR163: The Process Compliance dimension evaluates development process adherence: commit message format conventions, feature-branch discipline (changes not committed directly to main), test file presence alongside new implementation files, and code review evidence — producing a process checklist with PASS / FAIL / UNKNOWN per item
- FR164: The Sprint Health dimension reads all sprints from `sprint-status.yaml` and reports: completion percentage per sprint, overdue items, stalled in-progress items, blockers, and backlog grooming health (prioritization, epic linkage, item clarity)
- FR165: The Release State dimension evaluates release readiness by mapping done stories to declared release scope, identifying blocking items preventing release, and reporting deployment environment status as provided by the user
- FR166: After all selected dimensions execute, Gad produces a written audit report saved to `{output_folder}/sqa-audit-report-{YYYY-MM-DD}.md`. The report includes an executive summary, per-dimension findings tables with PASS / WARNING / FAIL severity, a prioritized action-item list, and a skipped-dimension list with required artifacts for each skip

#### IEEE/ISO/IEC 12207 Compliance Workflow

- FR167: Gad's IEEE/ISO/IEC 12207 compliance workflow begins by presenting the four process groups and asking whether to evaluate all groups or selected ones — evaluation only begins after the user confirms scope
- FR168: The workflow evaluates 23 process areas across four IEEE/ISO/IEC 12207:2017 process groups: Technical Processes (11 areas: Business Analysis, Stakeholder Requirements, Software Requirements, Architecture, Design, System Analysis, Implementation, Integration, Verification, Validation, Transition), Technical Management Processes (8 areas: Project Planning, Project Assessment, Decision Management, Risk Management, Configuration Management, Information Management, Measurement, Quality Assurance), Agreement Processes (2 areas: Acquisition, Supply), and Organizational Enabling Processes (2 areas: Life Cycle Model Management, Knowledge Management)
- FR169: Each evaluated process area receives a compliance rating: COMPLIANT (evidence satisfies process intent), PARTIAL (some evidence, gaps remain), NON-COMPLIANT (no evidence or clear violation), NOT APPLICABLE (process not relevant to this project type), or ORGANIZATION-SCOPE (verifiable only at organizational level, not from project artifacts). Ratings are derived from available project artifacts: `prd.md`, `architecture.md`, `sprint-status.yaml`, test files, git history, and changelog
- FR170: The workflow produces a compliance matrix report saved to `{output_folder}/sqa-ieee12207-report-{YYYY-MM-DD}.md`. The report includes an executive summary, per-group compliance matrices (clause, process area, compliance rating, key evidence, gaps), a gap analysis separating critical gaps from partial compliance items, a prioritized recommended-action table, and a compliance summary table with counts per group and an overall compliance percentage
- FR171: After any SQA workflow that identifies gaps, Gad offers to create structured bug or story entries in the project backlog for each P1 (critical) gap — invoking the `create-bug-story` workflow for each accepted item

### Local-LLM / On-Prem Agent Tuning

#### Install Profile

- FR172: During `npx ma-agents install` (interactive wizard and direct install), the installer prompts the user to choose between two profiles: **standard** (Claude on web, Anthropic API, or other frontier hosted models) and **on-prem** (air-gapped network running a local LLM such as Nemotron Super 49B). The chosen profile is persisted as `"profile"` in `.ma-agents.json` so subsequent installs do not re-prompt
- FR173: `--yes` (non-interactive / CI/CD mode) defaults the profile to `standard` when no value is persisted, and does not prompt. For on-prem CI/CD, teams run the installer once interactively to persist `"profile": "on-prem"` in `.ma-agents.json` and commit that file; subsequent CI runs honor the persisted value. No CLI flag is exposed for profile — the choice is user-facing (interactive prompt) or team-facing (committed `.ma-agents.json`), not a per-invocation flag

#### Universal Per-Tool Guardrail Templates (all profiles)

- FR174: For every supported IDE/agent target, the installer ships expanded per-tool configuration that enforces "respond in text vs. create files" discipline and BMAD phase boundaries — applied regardless of profile. Specifically: an expanded `<!-- MA-AGENTS-START -->` injection block in `CLAUDE.md`, `.cline/clinerules.md`, and `.roo/rules/00-ma-agents.md`; an expanded `AGENTS.md` template for OpenCode covering the same rules; and a new `.roomodes` file for Roo Code defining four BMAD modes (`bmad-pm`, `bmad-architect`, `bmad-techlead`, `bmad-dev`) each with appropriate `fileRegex` restrictions enforcing phase boundaries at the application layer
- FR175: The `.roomodes` template restricts file edit access by BMAD phase — `bmad-pm` and `bmad-architect` may only edit `.md` (and diagram extensions); `bmad-techlead` may only edit `.md`, `.json`, `.yaml`; only `bmad-dev` has full edit + command access. These restrictions are enforced by Roo Code's `FileRestrictionError`, not solely by prompt instructions
- FR176: Per-tool template stamping is additive — when an existing `AGENTS.md`, `.cline/clinerules.md`, `.roo/rules/00-ma-agents.md`, `.roomodes`, or `CLAUDE.md` is present, the installer merges via the existing marker pattern (`<!-- MA-AGENTS-START -->` / `<!-- MA-AGENTS-END -->`) without overwriting user content outside the markers. For `.roomodes` (YAML), additive merge preserves any user-defined `customModes` entries that do not conflict with ma-agents BMAD modes by slug. Note: `.clinerules` is treated as a directory — the installer does not write instruction content to it; instruction injection for Cline uses `.cline/clinerules.md` exclusively

#### On-Prem Profile Layered Guardrails

- FR177: When the active profile is `on-prem`, the installer layers additional local-LLM guardrails into the same per-tool instruction blocks: explicit "never create files in `~/.claude/` or any user home directory" rule; explicit "do NOT reference or use `str_replace_editor` or other Claude Code tools that may not exist" rule; a `/no_think` reasoning-OFF directive prefix for planning-phase prompts; and reasoning-mode / temperature guidance per BMAD phase
- FR178: When profile is `on-prem`, BMAD agent persona customizations under `lib/bmad-customize/` gain a phase-aware system-prompt prefix — planning-phase agents (PM John, Architect Winston, SM Bob, Analyst Mary, Tech Writer Paige, UX Sally, SQA Gad) receive a reasoning-OFF / text-response directive; the implementation agent (Dev Amelia) receives a reasoning-ON / careful-implementation directive. These prefixes are not applied when profile is `standard`. (Note: the former quick-flow Dev persona `bmm-quick-flow-solo-dev` (Barry) was consolidated into Amelia in BMAD v6.3.0 per Story 22.3.)

#### Reference Deployment Documentation

- FR179: A reference deployment document for on-prem inference servers ships under `docs/deployment/vllm-nemotron.md` covering recommended vLLM flags (`--enable-auto-tool-choice`, `--tool-call-parser qwen3_coder`, `--max-model-len 32768`, `--enforce-eager`), quantization choices (BF16/FP8/NVFP4), reasoning-mode behavior, and per-phase sampling parameters. This is documentation only — the ma-agents installer does not manage the inference server
- FR180: The installer CLI exposes a `npx ma-agents reconfigure` subcommand that re-runs the profile-selection prompt with the currently-persisted value as the default, and — if the user changes the value — re-stamps all profile-dependent artifacts (instruction-block injection files, `.roomodes`, BMAD persona customize output). Each overwritten marker-block region is backed up to `<target>.backup-<ISO-timestamp>`. A history entry is appended to `.ma-agents.json::profileHistory` (new append-only field, capped at 20 entries). `--yes` is explicitly rejected for this subcommand to prevent accidental CI-triggered profile changes.
- FR181: The installer CLI exposes a `npx ma-agents uninstall --profile-artifacts` subcommand that removes all ma-agents-owned profile-dependent content from a project: marker-block content (and markers) in the 4 instruction-injection files (`CLAUDE.md`, `.cline/clinerules.md`, `.roo/rules/00-ma-agents.md`, `AGENTS.md`); the 4 ma-agents-owned `customModes` slugs in `.roomodes` (`bmad-pm`, `bmad-architect`, `bmad-techlead`, `bmad-dev`); and the `profile` field in `.ma-agents.json`. Note: `.clinerules` is a directory (not an instruction-injection file) — it is not in the uninstall scope; the `.clinerules/workflows/` subdirectory contains auto-generated wrappers that are regenerated on each install. User content outside markers and user-defined `.roomodes` slugs are preserved untouched. Audit-trail fields (`profileHistory`, `roomodesOverwriteLog`) are preserved; a new `{ from, to: null, source: "uninstall" }` entry is appended to `profileHistory`. Each removed file or region is backed up to `<target>.backup-<ISO-timestamp>`. `--yes` is supported for CI use (decommissioning scripts) — the opposite of `reconfigure`'s `--yes` rejection, because uninstall is removal (no hidden content swap) whereas reconfigure is content replacement.

## Non-Functional Requirements

### Security & Data Protection

- NFR1: Skills must not transmit project data externally — all content is static instruction delivery, not data collection
- NFR2: Installation process must function fully offline for air-gapped environments
- NFR3: Skill content must be inspectable (plain text markdown/JSON) — no obfuscated or compiled instructions
- NFR4: BMAD customizations must not be overwritten by updates without explicit user action

### Integration Reliability

- NFR5: Skill installation must not corrupt or remove existing agent configurations — additive-only operations
- NFR6: Agent format translation must produce valid configuration for each target agent's expected format
- NFR7: Manifest operations (read/write/update) must be atomic — no partial manifest states on failure
- NFR8: BMAD install/update/customize pipeline must execute steps in strict order with rollback on failure

### Portability & Compatibility

- NFR9: CLI must produce identical results on Windows, macOS, and Linux for the same inputs
- NFR10: Skills authored once must install without modification across all supported agents
- NFR11: Adding a new agent target must not require changes to existing skills — only a new template mapping
- NFR12: The tool must function with Node.js LTS versions (current and previous)

### Maintainability

- NFR13: Adding a new agent to the registry must require only a configuration entry, not code changes to the installer core
- NFR14: Adding a new skill must require only the skill package files (skill.json + SKILL.md + templates), not installer modifications
- NFR15: Skill format must remain backward-compatible — older skills must install correctly with newer tool versions

### BMAD Extension Compatibility

- NFR16: The BMAD extension module must survive `npx bmad-method install --action update` without losing functionality — extensions maintain independent identity and persist across BMAD updates
- NFR17: All BMAD-facing changes must use official BMAD Builder extension APIs only — `module.yaml` (module identity), `module-help.csv` (capability registration), setup skill (config management), Agent Builder (agent creation), Workflow Builder (workflow creation), skill folder standard (SKILL.md + prompts/ + resources/ + scripts/) — zero bmad-method core modifications
- NFR18: OpenCode JSON instruction injection must not corrupt existing `opencode.json` configuration — JSON config merging must be additive-only
- NFR19: Bug and sprint extension workflows must function identically whether invoked via BMAD agent menu or direct slash command. All sprint workflows must read/write the unified `sprint-status.yaml` file — no workflow may create or depend on separate `backlog.yaml` or per-sprint YAML files

### Bundled Installation

- NFR20: The bundled BMAD cache must be version-pinned (v6.3.0 current) — upgrading the bundled version is a deliberate, tested release operation, not an automatic fetch
- NFR21: The bundled installation produces deterministic `_bmad/` output from the included cache. The resulting directory structure is reproducible given the same ma-agents package version.

### Sprint Management

- FR132: (reserved — see FR65-FR71, FR128-FR140 for all sprint management requirements)

### Agent Activity Dashboard

- NFR26: The dashboard shall reflect agent state changes within 60 seconds of the triggering file system event — measured from file write completion to next dashboard render cycle
- NFR27: The dashboard shall render status for up to 20 concurrently active agents in under 2 seconds — measured by wall-clock time from refresh trigger to complete output display
- NFR28: Dashboard data collection shall be read-only against existing project file structures — no writes to `_bmad-output/` or git state during dashboard operation, verified by absence of new file system writes during a dashboard session

### Multi-Repository Layout

- NFR34: Multi-repo configuration must be backward-compatible — projects that do not configure external repositories must function identically to current single-repo behavior with no degradation or additional prompts on subsequent runs
- NFR35: Remote repository cloning during installation must work in air-gapped environments when the user provides a local network git URL (e.g., internal GitLab) — no assumption of public internet access
- NFR36: The `project-layout.yaml` cross-reference file must be deterministic — running the installer multiple times with the same multi-repo configuration produces an identical file
- NFR37: All BMAD workflows must resolve artifact paths through the configured layout — no workflow may hardcode `_bmad-output/` as a relative path assumption. Path resolution must use the config values, falling back to current directory only when config specifies single-repo mode

### BMAD 6.2.0 Migration

- NFR29: The migration from 6.0.4 to 6.2.0 agent patterns must be atomic — either all 4 agents and their workflows migrate successfully or the installation rolls back to the pre-migration state with no partial conversions
- NFR30: All 4 migrated agents must produce functionally equivalent behavior after migration — same menus, same workflows, same outputs as before migration. Verified by exercising each agent's full menu and confirming all commands route correctly
- NFR31: Migrated agent skill folders must conform to BMAD Builder's lint gate standards — `scan-path-standards.py` (path conventions, no `{skill-root}`, proper prefixes) and `scan-scripts.py` (portability, agentic design) pass without critical violations
- NFR32: All 23 converted workflows (11 MIL-498 + 9 SRE + 6 DevOps + 8 Cyber = 34 total; corrected: 11+9+6+8=34) produce identical output artifacts as their pre-migration equivalents — same document structure, same section headers, same template variables, verified by diff comparison of generated outputs
- NFR33: The module setup skill's anti-zombie cleanup must be idempotent — running `npx ma-agents` multiple times produces the same `config.yaml`, `config.user.yaml`, and `module-help.csv` state regardless of prior runs

### BMAD 6.3.0 Migration

- NFR50: The bundled plugin install flow must complete successfully with all outbound network egress blocked — verified by running `npx ma-agents install` inside a container or VM with egress firewall rules blocking all destinations, or equivalent CI job with network disabled, on every release candidate. Zero network calls are permitted during the install path, including optional telemetry, update checks, or marketplace registry probes
- NFR51: The pre-install plugin staging step must be deterministic — given the same ma-agents package version, the staged `<project>/.ma-agents-plugin-stage/` directory contents are byte-identical across runs and across machines, enabling reproducible-build verification
- NFR52: Multi-tool install parity — the same bundled plugin, without tool-specific repackaging or variant bundles, must produce a functional skill installation when bmad-method is invoked with `--tools claude-code`, `--tools copilot`, `--tools cline`, `--tools roo-code`, and `--tools kilocode`. Verified via smoke install against each target during release verification (FR192)
- NFR53: The plugin stage directory (`<project>/.ma-agents-plugin-stage/`) is not part of the delivered installation — it exists only during the install pipeline and is removed on success. It must be listed in the ma-agents-generated `.gitignore` entries for projects that do not already ignore it, to prevent accidental commit of transient artifacts
- NFR54: The 6.3.0 migration must preserve the air-gapped self-containment guarantee end-to-end — the ma-agents npm tarball must contain all plugin assets, all BMAD cache modules (including any new 6.3.0 bundled modules), and all dependencies sufficient for offline install. No code path in the installer may require access to `github.com`, `marketplace.bmad-method.org`, npm registry, or any external host after the tarball is on disk

### BMAD v6.6.0 Integration

- NFR55: Automated tests must assert: (a) the bmad-method invocation command never contains `--tools none` regardless of which code path assembles it; (b) the install flow silently skips BMAD invocation when the derived `bmadTools` array is empty; (c) existing installs with non-empty tools lists are unaffected — satisfies FR196

### BMAD Knowledge Graph

- NFR38: The `open-graph` skill shall render a graph of up to 500 nodes and 1000 edges in under 3 seconds from file load to interactive display — measured from skill invocation to first interactive frame in the renderer
- NFR39: `knowledge-graph.json` must remain parseable and writable by any LLM without schema documentation. Validated by requiring that a model with no prior knowledge of the format can correctly register a file, add a node, and add an edge given only the existing file content as context — no external schema reference required
- NFR40: Skill emission of files, nodes, and edges must be additive-only — skills never delete or overwrite existing entries, only append or update non-provenance fields. Existing provenance data (creator, agent, date) on an edge is never modified by subsequent runs
- NFR41: The `knowledge-graph.html` renderer must function in air-gapped environments with no network access and without a local server — verified by loading the file with network access blocked and confirming full interactive functionality

### Project Context Generation

- NFR22: The project-context *template* (`lib/templates/project-context.template.md`) must contain no hardcoded platform-specific paths or agent directory names — path-specific content is stamped at generation time, not embedded in the template source
- NFR23: Project-context generation is additive-only — the installer never modifies or deletes an existing `_bmad-output/project-context.md` regardless of its content or age
- NFR24: The project-context template is maintained as a standalone file (`lib/templates/project-context.template.md`), not as an inline string in installer code — allowing the template to be updated independently of installer logic
- NFR25: The generated project-context.md includes a machine-readable generator version comment (e.g., `<!-- ma-agents-template-version: 1.0 -->`). When a future ma-agents version detects a lower template version in an existing file, it logs a warning suggesting the user run `/bmad-generate-project-context` to refresh — it never auto-overwrites

### Software Quality Assurance (SQA)

- NFR42: SQA audit findings driven by project artifacts (prd.md, architecture.md, epics.md, sprint-status.yaml) must be deterministic — re-running a workflow on unchanged artifacts must not introduce variance from execution alone. Findings that depend on user-provided inputs (git log output, deployment environment status) may differ across runs only when the user provides different data; this is expected behavior, not a defect.
- NFR43: The IEEE/ISO/IEC 12207 compliance workflow must not require internet access — all evaluation logic, process area definitions, and rating criteria are embedded in the skill; no external standard document download or network call is made during execution

### Local-LLM / On-Prem Agent Tuning

- NFR44: On-prem profile guardrails must not regress standard profile behavior — when the persisted or supplied profile is `standard`, no `/no_think` directives, `str_replace_editor` warnings, or other local-LLM-specific instructions are present in any generated instruction file. Verified by diffing standard-profile install output against the pre-Epic-20 baseline
- NFR45: The profile prompt must be non-blocking in CI/CD — `--yes` defaults the profile to `standard` without prompting; in interactive mode the prompt appears once and the answer is persisted in `.ma-agents.json`; subsequent runs honor the persisted value without re-prompting. On-prem CI/CD is served by committing `.ma-agents.json` with `"profile": "on-prem"` to the repo — no per-invocation flag is provided
- NFR46: Per-tool template stamping must be idempotent — re-running `npx ma-agents install` with the same profile against the same project produces byte-identical instruction-file content within the marker blocks (only the marker block is rewritten; user content outside is untouched)
- NFR47: BMAD planning-mode file restrictions in the generated `.roomodes` must enforce phase boundaries at the application layer, not solely via prompt — verified by attempting a `.ts`/`.py` edit while in `bmad-architect` mode and confirming Roo Code rejects with `FileRestrictionError`
- NFR48: Profile changes via `ma-agents reconfigure` must leave an auditable forensic trail — `.ma-agents.json::profileHistory` is append-only (capped at 20 entries to prevent unbounded growth), and each entry records `date`, `from` (previous profile), `to` (new profile), and `source` (always `reconfigure` for entries produced by this subcommand; future sources — e.g., a direct `install --profile-override` if ever added — would use a distinct source identifier)
- NFR49: Uninstall must preserve user content and audit trails — after `ma-agents uninstall --profile-artifacts`, (a) every file that contained user content outside ma-agents markers must still contain that content byte-for-byte; (b) `.roomodes` must retain all user-defined `customModes` entries untouched; (c) `.ma-agents.json::profileHistory` and `.ma-agents.json::roomodesOverwriteLog` must be preserved in full; (d) no file created by the user (outside marker blocks and outside ma-agents-owned `.roomodes` slugs) may be deleted. Verified by per-file diff test in `test/uninstall.test.js` against a pre-uninstall snapshot.
