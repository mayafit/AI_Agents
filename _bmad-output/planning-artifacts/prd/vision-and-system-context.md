# Vision & System Context

> **Shard** of the [PRD index](../prd.md). Content is verbatim from the
> pre-split document; the index carries the front matter, registers and reading order.

---

## Executive Summary

> ***Install AND enforce — agent-agnostic methodology enforcement for enterprise software engineering, now with guaranteed skill compliance, bug management, and unified sprint-status management.***

ma-agents is an enterprise development methodology platform that enables software organizations to adopt AI coding agents at scale without sacrificing engineering rigor, traceability, or standards compliance. Built around the BMAD-METHOD framework, it delivers a complete software development lifecycle — from systems engineering and requirements through architecture, implementation, testing, and production — as portable, agent-agnostic skill packages.

The platform solves two critical organizational challenges. First, as AI coding assistants proliferate (Claude Code, Copilot, Gemini, Cursor, Cline, OpenCode, and on-prem alternatives), engineering teams fragment into tool-specific silos with inconsistent practices. Second, **installed skills are not reliably enforced** — agents install skills but then ignore them during operation, with planning instructions losing priority in context, BMAD workflows operating in isolation from the skill system, and no enforcement mechanism ensuring compliance. ma-agents eliminates both by decoupling engineering methodology from any single AI tool and ensuring that installed skills are actually followed — standards are defined once, installed once, and enforced uniformly across all agents.

### What Makes This Special

The core insight is convergence: AI agents need governance, and engineering methodology needs AI-native delivery. ma-agents sits at this intersection as the **governance and standards layer** for AI-assisted development.

- **Install AND enforce** — 28+ codified engineering skills install identically across 12 target agents with automatic translation to each agent's native format. Skills are not merely available — they are enforced via BMAD `critical_actions`, top-priority instruction injection, and per-agent enforcement hooks
- **Full SDLC coverage via BMAD-METHOD** — integrated workflows spanning product discovery, requirements, architecture, sprint planning, implementation, QA, and retrospectives, orchestrated by specialized AI personas (PM, Architect, Developer, QA, Scrum Master, Tech Writer)
- **Enterprise-grade specialized agents** — purpose-built personas for defense/enterprise needs: SRE (Alex), DevOps (Amit), Cyber Analyst (Yael), MIL-STD-498 Expert (Joseph), and SQA Engineer (Gadi) with operational playbooks and compliance workflows. Migrated to native BMAD 6.2.0 skill-based architecture: each agent is a full skill folder (`SKILL.md`, `prompts/`, `resources/`, `scripts/`) with internal commands replacing legacy `.customize.yaml` injection, and all 34 operational workflows (11 MIL-498 DIDs + 9 SRE + 6 DevOps + 8 Cyber) packaged as proper BMAD skill packages
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

3. **BMAD-METHOD Integration** — Install/update/customize/recompile pipeline. Bundled bmad-method v6.2.0 as a direct npm dependency with pre-cloned external modules (bmb, cis, tea). Single unified wizard UX with explicit parameter passing to bmad-method. CI/CD compatible non-interactive mode. — **In Development**

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

18. **Software Quality Assurance (SQA)** — Dedicated SQA agent (Gadi) providing structured quality workflows for software projects: a multi-dimensional Project Audit (code-to-story traceability, stories-to-architecture/PRD alignment, process compliance, sprint health, release state) and an IEEE/ISO/IEC 12207 lifecycle process compliance assessment with compliance matrix, gap analysis, and backlog story generation for identified gaps. — **Planned**

19. **Local-LLM / On-Prem Agent Tuning** — Adapts the ma-agents installed configuration to the realities of disconnected, air-gapped enterprise networks running local non-Claude LLMs (e.g., Nemotron Super 49B). Two layers: (a) **Universal guardrails** shipped to all installs — richer per-tool config (`.roomodes` with BMAD-mode file-regex restrictions, expanded `AGENTS.md`/`.cline/clinerules.md`/`CLAUDE.md` injection) that enforces "text response vs. file creation" discipline and BMAD phase boundaries at the tool's application layer, not just via prompt; (b) **On-prem profile** opt-in via install-time prompt (persisted in `.ma-agents.json`) — adds local-LLM-specific guardrails (`/no_think` planning prefix, no-home-dir-writes, no `str_replace_editor` warning, reasoning-mode guidance, phase-aware persona prompt prefixes). Also ships a reference vLLM deployment doc (tool-call-parser, context length, quantization) for the inference-serving side, which the installer does not manage. — **Planned**

20. **BMAD 6.3.0 Plugin Migration** — Ships the BMAD extension as a Claude-Plugin-compatible package (`.claude-plugin/marketplace.json`) installed via BMAD's PluginResolver using a local file path, preserving the air-gapped guarantee while replacing post-install manifest surgery with pre-install plugin staging. Skill renames (bmad-ma-agent-* → ma-agent-*), retirement of bmad-init / bmad-agent-qa / bmad-agent-sm / bmad-agent-quick-flow-solo-dev in alignment with upstream consolidation. — **Planned**

21. **BMAD v6.6.0 Integration** — Upgrade bmad-method to v6.6.0, guard the installer against the `--tools none` breaking change, and adopt upstream reliability improvements. (Planned)

22. **Cline Workflow Generation** — After BMAD installs or updates when Cline is a selected tool, the installer auto-generates `.clinerules/workflows/<skill-name>.md` wrapper files for every BMAD skill in `.cline/skills/`. Per Cline's documentation, `.clinerules/` is a directory that Cline reads recursively; `.clinerules/workflows/` is a subdirectory within it for slash-command workflows. The installer ensures `.clinerules` is a directory (migrating any legacy flat-file installation), then generates wrappers. BMAD skills ship with Claude Code-style YAML frontmatter that Cline does not natively parse; the generated wrappers are the adapter layer that makes skills callable via Cline's native `/workflow-name` invocation mechanism. Skills with a `workflow.md` receive a delegation wrapper; self-contained skills (SKILL.md only) receive a wrapper that reads SKILL.md with a frontmatter-ignore instruction. The Cline instruction block is injected into `.cline/clinerules.md` — the single source of truth for Cline instruction injection. Triggered on install, update, and migration. — **Shipped**

23. **BMAD v6.8.0 Integration** — Upgrade bmad-method from v6.6.0 to v6.8.0. BMAD 6.7.0 retired the in-package module-registry YAML (`tools/installer/modules/registry-fallback.yaml`) and 6.8.0 ships the external-module list as a relocated YAML file `bmad-modules.yaml` at the package root (same parser shape, new path); `build-bmad-cache.js`'s candidate-path list no longer finds the registry, so the offline bundled-module build breaks — the core work is a small reader change (add the new path, swap the `built_in` filter for a `type`-based one) plus a fail-loud guard. The bundled set is **tea, bmb, cis, gds, wds** (every `type: bmad-org` module); `automator` (`type: experimental`) is excluded; `bmm`/`core` are built-in. Secondary: reconcile the generated Cline workflow wrappers against renamed/retired upstream skills (so no `.clinerules/workflows/*.md` points at a deleted skill), bump the pin, rebuild cache + plugin, and verify the offline install. The upstream skill renames/retirements/PRD-unification (bmad-create-ux-design→bmad-ux, bmad-distillator→bmad-spec) are inherited via passthrough — ma-agents owns none of those skill bodies. — **Planned**

24. **BMAD v6.9.0 Integration** — Upgrade bmad-method from v6.8.0 to v6.9.0. Unlike the v6.8.0 bump (which relocated the module-registry YAML and broke the offline cache reader), v6.9.0 leaves the registry path **and** schema unchanged — verified against the v6.9.0 source via a shallow clone of the tag and a `gh` tag-to-tag compare, with Story 28.1 re-confirming against the npm-installed `bmad-method@6.9.0` before downstream work — so `build-bmad-cache.js` needs no reader change and the 6.8.0 break does not recur. The one behavioral change that touches the wrapper is in the BMAD installer: the legacy `python3`-presence probe is replaced by a `uv` environment check that warns-but-does-not-block (identical CLI flags and exit codes; new stdout text plus a "uv recommended" banner). ma-agents must stay resilient to that stdout change and must **not** migrate its own control-plane Python to `uv` — BMAD's uv standardization governs BMAD-installed skills (which ma-agents does not own); ma-agents control-plane scripts (the activation steps that invoke `python3 {project-root}/_bmad/scripts/resolve_customization.py`, plus `build-bmad-cache.js`'s Python peers) deliberately stay on the `python` interpreter. The ma-agents-owned `ml-experiment`/`ml-infra`/`ml-eda` skills' `uv run python` guidance is explicitly exempt — it runs the user's ML-project scripts in the user's uv env, not ma-agents tooling. The new upstream core skill `bmad-forge-idea`, the `bmad-architecture` lean-spine rewrite (with `bmad-create-architecture` retained as a forwarding shim until BMAD v7), the canonical `memlog.py` working-memory primitive, and the new installer platform targets (hermes-agent, CodeWhale) are inherited via passthrough — the existing Cline-wrapper reconciliation surfaces/retires wrappers automatically and ma-agents adopts neither new platform by default. Scope: pin bump, installer-output resilience plus the uv scoping boundary, cache + plugin rebuild, and offline-install verification. — **Planned**

25. **BMAD v6.10.0 Integration** — Upgrade bmad-method from v6.9.0 to v6.10.0, and — riding the same bump — add custom marketplace source installation and deprecate the Demerzel (ML Scientist) agent. Unlike the reader-neutral v6.9.0 bump, v6.10.0 is not bundle-neutral: it introduces `bmad-loop` (the unattended-dev orchestrator succeeding the now-`deprecated` `bmad-automator`) as a new `type: bmad-org` module carrying two new registry traits — `marketplace-plugin: true` (its skills resolve from `.claude-plugin/marketplace.json` via the plugin resolver, not a single module-definition dir) and, on `bmad-automator`, `deprecated: true`. The registry PATH and parse schema are unchanged (the new fields are additive/optional), but because `build-bmad-cache.js` bundles every `type: bmad-org` module — and the thin-cache guard only catches a set *smaller* than {tea, bmb, cis, gds, wds} — a naive pin bump would silently pull `bmad-loop` into the offline bundle and, via the "default `--modules` = all bundled" rule, risk installing a Python/tmux/hooks orchestrator by default onto air-gapped machines. The fix is a small filter change (exclude `marketplace-plugin` and `deprecated` modules), keeping the bundled set exactly **tea, bmb, cis, gds, wds**. `bmad-loop` stays an explicit opt-in (installable via the new custom marketplace source), never force-bundled — ma-agents' own `bmad-dev-epic` remains the default, air-gapped, zero-setup epic orchestrator. Passthrough: `bmad-investigate` is retired and the other upstream skill changes (`bmad-dev-auto`, `bmad-loop-setup`, party-mode anti-consensus, edge-case-hunter, elicitation methods, `bmad-help` TOML config) are inherited via the existing Cline-wrapper reconciliation (ma-agents owns none of those bodies); the Windows-local-custom-path installer fix (upstream #2511) directly benefits ma-agents' own `--custom-source` staging. **Custom marketplace source** — after module selection the installer offers to install additional BMAD extensions from a user-supplied marketplace repository (local path or intra-perimeter Git URL such as on-prem GitLab); ma-agents reuses BMAD's own `CustomModuleManager` to enumerate the marketplace's declared extensions, presents them in ma-agents' wizard multiselect, and installs the user-selected subset — authentication via the host's ambient git credentials (SSH/helper), with zero token handling. **Demerzel deprecation** — the `ma-agent-ml` agent (skill + its `bmm-demerzel` registration) and the 12 `ml-*` skills are removed from the shipped bundle for new installs while existing installs are left untouched with a one-time notice; the replacement is published in the org's local marketplace, so no in-tool migration is performed (supersedes the deferred FR193 Memory-agent conversion). Scope: pin bump, cache-filter change + fail-loud guard, custom marketplace source, Demerzel deprecation, cache + plugin rebuild, offline-install verification. — **Planned**

26. **Global Installation & Federated Knowledge Stores** — Install scope becomes an interactive choice in the wizard (project or global for the user account), with a global install covering BMAD modules and agents rather than skipping them, and a lightweight per-project bind step supplying the project-scoped answers a global install cannot know. Project knowledge splits into two independently located stores — **system requirements** (product brief, PRD) and **software requirements** (architecture, UX, epics) — each asked for separately at install time and each choosing its own backend, `file-system` or `confluence`. The Confluence backend asks for a space and a root page (blank generates one named for the project) and activates only when a Confluence MCP is present, following the same detection pattern the sprint skills use for Jira. Bindings move from the per-machine gitignored `config.yaml` into the committed `_bmad-output/project-layout.yaml`, which becomes authoritative and is written on every install — so a globally installed skill can resolve a project's knowledge from the project root alone, and a team shares one set of locations. Supersedes FR111 and FR117; unblocks the long-deferred Confluence work in Epic 14 Story 14.2. — **Planned**

Any artifact can reference any other regardless of hierarchy — a story's AC may derive from the epic, an architecture decision, and a UX design simultaneously. A central `files` table maps short file IDs to arbitrary file pointers (relative paths, absolute paths, Confluence URLs, or any document reference). Nodes are addressable anchors within registered files (`file-id#heading`), edges are directional typed relationships with full provenance (creator name, AI agent identifier, date, label). Stored as LLM-friendly JSON at `_bmad-output/knowledge-graph.json`. Rendered as an interactive graph in VSCode webview (browser fallback) via `_bmad-output/knowledge-graph.html`. `open-graph` skill surfaces the visualization from any BMAD session. A **Knowledge Atlas** visualization tier extends this with a scan-first, self-contained static knowledge *site* over all BMAD artifacts — auto cross-linking every entity, a typed graph view, document reading views with rendered and auto-generated diagrams, orphan/gap detection, and offline search; generated on demand via `bmad-knowledge`, pre-bundled in ma-agents, fully air-gapped, and reconciling with `knowledge-graph.json` when present. — **Planned**

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
- Knowledge Atlas — deferred tiers beyond the deterministic v1: model-assisted discovery/enrichment (brownfield doc classification, prose-level relationship extraction, AI summaries) cached in the manifest; auto-refresh BMAD-skill hooks (optional sugar over the authoritative scan); Confluence target mode; timeline/sprint-axis and "what changed since last sprint" diff views; an agent-facing query API over the manifest

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
