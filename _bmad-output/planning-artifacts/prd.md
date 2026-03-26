---
stepsCompleted: ['step-01-init', 'step-02-discovery', 'step-02b-vision', 'step-02c-executive-summary', 'step-03-success', 'step-04-journeys', 'step-05-domain', 'step-06-innovation', 'step-07-project-type', 'step-08-scoping', 'step-09-functional', 'step-10-nonfunctional', 'step-11-polish', 'step-12-complete', 'step-e-01-discovery', 'step-e-02-review', 'step-e-03-edit', 'step-e-01-discovery', 'step-e-02-review', 'step-e-03-edit-2026-03-24', 'step-e-01-discovery', 'step-e-02-review', 'step-e-03-edit-2026-03-25']
workflowStatus: 'complete'
completedDate: '2026-03-05'
lastEdited: '2026-03-25'
editHistory:
  - date: '2026-03-25'
    changes: 'Added F9: BMAD 6.2.0 Agent Architecture Migration (Phase 2) with FR94-FR110, NFR29-NFR33. Added F10: Multi-Repository Project Layout (Phase 2) with FR111-FR122, NFR34-NFR37. Updated F6 to programmatic setup skill invocation (replaces silent install), added FR123-FR127 for unified wizard UX and CI/CD compatibility. Updated Executive Summary, Success Criteria, Alon journey, Journey Summary, Integration Requirements, Innovation, Risk Mitigations, F1 description, and NFR17 for 6.2.0 alignment. Removed @next installation method.'
  - date: '2026-03-24'
    changes: 'Upgraded bmad-method pin from v6.0.4 to v6.2.0 (F6, FR74, NFR20). Added wds to bundled external modules (F6, FR75). Added F8: Agent Activity Dashboard (Phase 2) with FR87-FR93 and NFR26-NFR28. Updated Executive Summary, Success Criteria, Dana and Alon journeys, and Journey Summary table for new capabilities.'
  - date: '2026-03-19'
    changes: 'Added F7: Project Context Auto-Generation. Added FR77-FR84 and NFR22-NFR24. Covers platform-agnostic project-context.md generation at install time with manifest path resolution, mission lifecycle documentation, idempotency, expansion triggers, and BMAD critical_actions integration.'
  - date: '2026-03-15'
    changes: 'Adversarial review fixes: FR53 updated from 4 to 11 BMAD agents (added 7 built-in). FR72 moved from Phase 3 to Phase 2 (Epic 6 in-progress). Removed "Methodology presentation bundled with installation" from Phase 3 list. F6 description corrected from require() to execSync+require.resolve invocation pattern. Updated Technical Success to reflect 11 agents.'
  - date: '2026-03-15'
    changes: 'Reorganized F6 as Bundled BMAD Installation (merged Epic 13 into Epic 5). Removed standalone binary concept (Node.js+npm always available). Removed --offline flag (bundled is the only mode). Deleted FR77, FR78. Rewrote NFR21 for deterministic bundled output. Reorganized FRs by concern, removing date-based section headers. Swept stale references to standalone binary, --offline, Epic 13.'
  - date: '2026-03-15'
    changes: 'Added F6: Self-Contained BMAD Installation. Moved from Phase 3 to Phase 2 (urgent). Added FR74-FR78, NFR20-NFR21. Pins bmad-method v6.0.4 for bundling. Bundles external modules (bmb, cis, tea) as pre-cloned cache inside ma-agents npm package.'
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
**Date:** 2026-03-05 | **Last Edited:** 2026-03-25

## Executive Summary

> ***Install AND enforce — agent-agnostic methodology enforcement for enterprise software engineering, now with guaranteed skill compliance, bug management, and realistic sprint workflows.***

ma-agents is an enterprise development methodology platform that enables software organizations to adopt AI coding agents at scale without sacrificing engineering rigor, traceability, or standards compliance. Built around the BMAD-METHOD framework, it delivers a complete software development lifecycle — from systems engineering and requirements through architecture, implementation, testing, and production — as portable, agent-agnostic skill packages.

The platform solves two critical organizational challenges. First, as AI coding assistants proliferate (Claude Code, Copilot, Gemini, Cursor, Cline, OpenCode, and on-prem alternatives), engineering teams fragment into tool-specific silos with inconsistent practices. Second, **installed skills are not reliably enforced** — agents install skills but then ignore them during operation, with planning instructions losing priority in context, BMAD workflows operating in isolation from the skill system, and no enforcement mechanism ensuring compliance. ma-agents eliminates both by decoupling engineering methodology from any single AI tool and ensuring that installed skills are actually followed — standards are defined once, installed once, and enforced uniformly across all agents.

### What Makes This Special

The core insight is convergence: AI agents need governance, and engineering methodology needs AI-native delivery. ma-agents sits at this intersection as the **governance and standards layer** for AI-assisted development.

- **Install AND enforce** — 28+ codified engineering skills install identically across 12 target agents with automatic translation to each agent's native format. Skills are not merely available — they are enforced via BMAD `critical_actions`, top-priority instruction injection, and per-agent enforcement hooks
- **Full SDLC coverage via BMAD-METHOD** — integrated workflows spanning product discovery, requirements, architecture, sprint planning, implementation, QA, and retrospectives, orchestrated by specialized AI personas (PM, Architect, Developer, QA, Scrum Master, Tech Writer)
- **Enterprise-grade specialized agents** — purpose-built personas for defense/enterprise needs: SRE (Alex), DevOps (Amit), Cyber Analyst (Yael), and MIL-STD-498 Expert (Joseph) with operational playbooks. Migrated to native BMAD 6.2.0 skill-based architecture: each agent is a full skill folder (`SKILL.md`, `prompts/`, `resources/`, `scripts/`) with internal commands replacing legacy `.customize.yaml` injection, and all 34 operational workflows (11 MIL-498 DIDs + 9 SRE + 6 DevOps + 8 Cyber) packaged as proper BMAD skill packages
- **Bug management** — Agents autonomously detect problems in delivered code and propose bug issues. BMAD extension workflows generate structured bug stories. Bugs live in the backlog alongside stories for realistic sprint planning
- **Realistic sprint management** — Sprints defined by capacity (number of items), with flat backlogs containing both stories and bugs, multi-criteria prioritization, and workflows to add/modify/manage sprints
- **Agent activity visibility** — Real-time dashboard showing all active AI agents: type, assigned story, worktree, branch, and status, auto-refreshing every 30 seconds from existing project file structures
- **BMAD-native extension architecture** — All BMAD-facing enhancements use official BMAD Builder extension points. With 6.2.0 migration, the extension module adopts the native `module.yaml` identity pattern (`code`, `description`, `module_version`) with setup skill and `module-help.csv` capability registration. Zero bmad-method core modifications. Extensions survive BMAD updates via the anti-zombie config pattern
- **Environment agnostic** — supports on-prem, public cloud, and air-gapped deployments through universal skill format and multi-agent targeting
- **Multi-repository project layout** — Supports enterprise project structures where planning knowledge, sprint management, and code live in separate repositories. The installer discovers repository locations (local or remote), clones as needed, and stamps paths into project-context.md so agents resolve artifact reads/writes to the correct repository without manual path management
- **Project knowledge preservation** — `_bmad-output` is version-controlled project knowledge (planning artifacts, implementation artifacts), never gitignored

**Classification:** Developer Tool / Methodology Platform | Software Engineering domain | Medium-High complexity | Brownfield (v2.19.2), documented as greenfield PRD

## Success Criteria

### User Success

- Engineers install skills and BMAD workflows with a single `npx` command — no manual configuration
- Engineers switch between AI agents (Claude Code, Copilot, Cursor, Cline, Gemini, OpenCode, on-prem tools) and retain the same methodology, skills, and workflow context
- New team members onboard with consistent engineering practices enforced through skills, not tribal knowledge
- Specialized roles (SRE, DevOps, Cyber, MIL-STD-498) have purpose-built agent personas with operational playbooks
- Installed skills are actually followed by agents — users never need to manually remind agents to read the manifest or follow skill directives (zero-reminder workflow)
- Agents autonomously propose bug issues when they detect problems in already-delivered code
- Sprint workflows reflect realistic project management: flat backlogs, capacity-based sprints, multi-criteria prioritization
- Projects that separate planning knowledge, sprint management, and code across repositories are fully supported — agents automatically resolve artifact paths to the correct repository

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

### Measurable Outcomes

- All 12 target agents produce functionally equivalent output from the same skill source
- Same skill produces identical behavioral enforcement across Claude Code, Cursor, Cline, OpenCode, and all BMAD agents
- Full SDLC coverage: systems engineering → requirements → architecture → implementation → QA → production
- Zero manual steps required for skill format adaptation per agent
- Bug and sprint workflows function as BMAD extensions without requiring bmad-method updates

## User Journeys

### 1. Systems Engineer — Eli

Eli is a systems engineer responsible for defining what the system does before anyone writes code. He works with stakeholders to capture operational concepts, system requirements, and interface definitions. He runs `npx ma-agents` to install BMAD with the MIL-STD-498 module and starts with `/bmad-bmm-create-prd` to structure the product concept, then uses the MIL-STD-498 workflows to generate the SSS (System/Subsystem Specification) and SSDD (System/Subsystem Design Description). He also uses the OCD workflow to produce the Operational Concept Description. His deliverables feed downstream to architects and product managers. When requirements change, he uses `/bmad-bmm-edit-prd` and the BMAD validation workflows to ensure traceability is maintained across documents.

**Capabilities revealed:** MIL-STD-498 document generation (SSS, SSDD, OCD), requirements traceability, operational concept workflows, document validation, inter-role handoff

### 2. Project Manager — Dana

Dana manages project phases, timelines, and deliverables. She uses BMAD's PM persona to structure the project into phases with clear milestones and release gates. She generates the SDP (Software Development Plan) using the MIL-STD-498 workflow, defining deliverables per phase, resource allocation, and acceptance criteria. She manages sprints through the new sprint workflows: adding sprints with defined capacity, assigning stories and bugs from the flat backlog using multi-criteria prioritization, and modifying sprint composition as priorities shift. She tracks sprint status with `/bmad-bmm-sprint-status` — which now shows real sprint definitions with assigned items rather than just epic lists — and uses `/bmad-bmm-retrospective` at epic boundaries. During active sprints she monitors the agent activity dashboard (`npx ma-agents dashboard`) to see which agents are working on which stories, their current branch and worktree, and whether any are blocked or awaiting review. Her SDP aligns with the systems engineer's SSS and the product manager's epics. Throughout her workflow, installed skills (git-workflow, audit-trail) are enforced automatically via BMAD `critical_actions`.

**Capabilities revealed:** SDP generation, project phase planning, milestone/deliverable tracking, sprint management (add/modify/assign), realistic sprint status, agent activity dashboard, retrospectives, cross-role document alignment, skill enforcement

### 3. Product Manager — Noam

Noam translates system requirements into development work. He uses BMAD's PM persona to create the PRD, break it into epics and stories with `/bmad-bmm-create-epics-and-stories`, and run sprint planning with `/bmad-bmm-sprint-planning`. During sprint planning, the Scrum Master asks Noam to define sprint capacity (number of items), and stories are assigned from the flat backlog using multi-criteria prioritization — not just epic precedence. Bugs reported by developers are added to the backlog alongside stories and prioritized into sprints. He generates the SRS (Software Requirements Specification) and SDD (Software Design Description) from project artifacts using the MIL-STD-498 workflows. His stories are implementation-ready, containing acceptance criteria, technical context, and test expectations. He validates PRDs and checks implementation readiness before handoff to development.

**Capabilities revealed:** PRD creation/validation, epics & stories, realistic sprint planning with capacity and backlog, bug prioritization, SRS/SDD generation, implementation readiness checks, story lifecycle management

### 4. Architect — Yael

Yael defines the technical architecture, UX design, technology stack, and integration points. She uses `/bmad-bmm-create-architecture` to document decisions and `/bmad-bmm-create-ux-design` for UX specifications. She generates IDD (Interface Design Description), IRS (Interface Requirements Specification), HRS (Hardware Requirements Specification), and architecture documents, as well as SRS for the technical requirements. She validates that architecture aligns with the PRD and epics using `/bmad-bmm-check-implementation-readiness`. She installs architecture-specific skills (logging, OpenTelemetry, Vercel/React best practices) to ensure the development team follows her architectural decisions through their AI agents.

**Capabilities revealed:** Architecture creation/validation, UX design, IDD/IRS/HRS generation, implementation readiness, architecture skill enforcement, technology stack documentation

### 5. Test Engineer — Oren

Oren defines test plans and generates test documentation. He uses the MIL-STD-498 workflows to produce the STD (Software Test Description) and STR (Software Test Report) from architecture and story specifications. He uses `/bmad-bmm-qa-automate` to generate automated E2E tests from implemented features, and reviews code with `/bmad-bmm-code-review` during the story cycle. During code reviews, his BMAD agent suggests generating bug issues when problems are found in already-delivered features — bugs are proposed to Oren for confirmation, then added to the backlog for sprint prioritization. He installs the test-generator and test-accompanied-development skills to ensure developers write tests alongside code. The `auto-bug-detection` skill ensures that any coding agent encountering defects in released code proposes a structured bug report.

**Capabilities revealed:** STD/STR generation, automated test generation, code review with bug detection, bug story generation, test-alongside enforcement, test plan documentation

### 6. DevOps Engineer — Amit

Amit manages CI/CD pipelines, repository structure, and deployment configurations. He uses the DevOps agent persona with its operational playbooks to define deployment strategies (canary, blue-green, rolling), configure infrastructure (PV/PVC, load balancers), and manage Helm charts. His DevOps BMAD agent now has `critical_actions` that load the skills MANIFEST on activation — Docker hardening, image signing, git-workflow, and security verification skills are enforced automatically during every BMAD session, not just when Amit remembers to invoke them. He configures the git-workflow-skill to standardize branching and PR processes across the team. In air-gapped environments, he ensures the full skill and BMAD stack works offline.

**Capabilities revealed:** DevOps agent persona with skill enforcement via `critical_actions`, deployment playbooks, Docker security skills, git workflow enforcement, air-gapped operation, infrastructure configuration

### 7. Chief Architect — Alon (Methodology Owner)

Alon defines the enterprise development methodology and builds the tooling to enforce it. He uses ma-agents to package organizational engineering standards as portable skills, customizes BMAD agent personas to fit the organization's processes, and develops new specialized agents (SRE, Cyber, MIL-STD-498) for roles specific to defense. He selects which skills are mandatory (`always_load: true`), authors custom skills using the skill-creator, and runs `npx ma-agents` across projects to ensure uniform methodology adoption. He architects the BMAD extension module using BMAD 6.2.0's native `module.yaml` identity pattern with setup skill, designs bug management and sprint workflows, and ensures all extensions survive BMAD updates via the anti-zombie config pattern. When upgrading from earlier ma-agents versions (bundling bmad-method 6.0.4), Alon relies on the installer to perform in-place migration — rebuilding the 4 custom agents from `.customize.yaml` + XML definitions to native 6.2.0 skill-based agent folders (`SKILL.md`, `prompts/`, `resources/`, `scripts/`), converting all 34 operational workflows from legacy formats to proper SKILL.md packages, and cleaning up legacy artifacts automatically. He uses BMAD Builder's Agent Builder to create and maintain the 4 custom agents and Workflow Builder to create and maintain the 34 operational workflows — both tools produce standard skill folder output with lint gate validation. He uses the full BMAD workflow — from brainstorming through architecture to implementation — to develop ma-agents itself. He monitors the agent activity dashboard to maintain governance visibility across all active agents — verifying that agents are operating on the correct stories, branches, and worktrees in accordance with the git-workflow-skill. He configures multi-repository project layouts during installation — separating the knowledgebase (planning artifacts) and sprint management (stories, sprints, backlog) into dedicated repositories while keeping implementation code in the main repo. All BMAD workflows automatically resolve to the correct repository paths, and agents operating in the code repo discover planning context and story specs via the cross-reference file. He ensures `_bmad-output` is committed to version control as project knowledge.

**Capabilities revealed:** Skill authoring and governance, BMAD 6.2.0 module architecture with `module.yaml` and setup skill, agent building via BMAD Builder (skill folder output), workflow building via Workflow Builder, 6.0.4→6.2.0 migration via installer, multi-repository project layout configuration, methodology definition, enterprise-wide deployment, custom agent development, bug/sprint workflow design, agent activity dashboard governance, BMAD self-application

### Journey Requirements Summary

| Capability Area | Driven By |
|----------------|-----------|
| MIL-STD-498 document generation (SSS, SSDD, OCD, SDP, SRS, SDD, STD, STR, IDD, IRS, HRS) | Eli, Dana, Noam, Yael, Oren |
| PRD/Epic/Story lifecycle | Noam, Yael |
| Architecture & UX design workflows | Yael |
| Realistic sprint management (add/modify/assign, capacity-based) | Dana, Noam |
| Bug management (detection, story generation, backlog integration) | Oren, Dana, Noam |
| Skill enforcement via `critical_actions` and top-priority injection | All (enforced), Alon (architecture) |
| Automated test generation & code review with bug detection | Oren |
| DevOps playbooks & deployment workflows | Amit |
| Docker/security skill enforcement | Amit, Oren |
| BMAD extension module architecture | Alon |
| Skill authoring & governance | Alon |
| Agent persona customization | Alon |
| Cross-agent methodology portability (12 agents incl. OpenCode) | All |
| Air-gapped / on-prem operation | Amit, Alon |
| Inter-role document traceability | Eli → Noam → Yael → Oren (full chain) |
| `_bmad-output` as version-controlled project knowledge | All |
| Agent activity dashboard (real-time per-agent status, worktree, branch, story) | Dana, Noam, Alon |
| BMAD 6.2.0 migration (agent rebuild, workflow conversion, module update, legacy cleanup) | Alon |
| BMAD Builder agent/workflow creation and maintenance | Alon |
| Multi-repository project layout (knowledgebase, sprint mgmt, code separation) | Alon, Dana, Noam |

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
| `npx ma-agents` | Current — primary | Zero-install via npm registry, interactive wizard + direct CLI modes. Bundles all BMAD components (Phase 2 F6) |
| `npx ma-agents install --yes --force` | Current — CI/CD | Non-interactive scriptable mode for pipeline automation |

### IDE / Agent Integration Model

ma-agents does not integrate as an IDE extension. Instead, it injects skill content into each agent's native configuration directory:

| Agent | Integration Point |
|-------|------------------|
| Claude Code | `.claude/` directory, `CLAUDE.md` instruction injection (top-priority placement) |
| Cursor | `.cursor/rules/` directory |
| Cline | `.cline/` directory with resource mapping (references→docs, assets→templates) |
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
| Methodology presentation | Planned — will be bundled with installation to onboard teams on the enterprise methodology |
| PRD (this document) | In progress |

### Implementation Considerations

- **OpenCode integration** uses JSON-based instruction injection (`opencode.json` instructions array) rather than markdown comment blocks. The installer must handle JSON config merging (OpenCode configs merge, not replace) and skill path resolution for `.opencode/skills/`
- **Visual Studio integration** is an identified gap. The team needs to investigate how Visual Studio exposes AI agent configuration (Copilot Chat extensions, `.editorconfig`-adjacent patterns, or VS-specific instruction files) and determine the appropriate injection mechanism
- **Bundled BMAD installation** (Phase 2 F6) bundles bmad-method and external modules inside the npm package, pre-populating bmad-method's cache. Node.js and npm are always available in target environments
- **Language-specific skill growth** — the skill format must accommodate language-specific content (coding standards, patterns, linting rules) without requiring changes to the core installer when new languages are added

## Project Scoping & Phased Development

### MVP Strategy & Philosophy

**MVP Approach:** Platform MVP — the product's value is the ecosystem of skills, agents, and workflows it enables across the organization's AI tooling.

**Current Baseline (v2.19.2):** The MVP is delivered. The scoping below defines the boundary between what exists and what's planned.

### MVP Feature Set (Phase 1 — Current)

**Core User Journeys Supported:**
- All 7 roles (Systems Engineer through Chief Architect) can install skills and BMAD workflows via `npx ma-agents`
- Skills install correctly across 6 IDE agents + 5 BMAD specialized agents
- MIL-STD-498 document generation workflows operational for 11 DIDs

**Must-Have Capabilities (Delivered):**
- Universal skill installer with 27 skills across 5 domains
- Multi-agent manifest (v1.1.0) with version tracking and upgrade detection
- BMAD-METHOD install/update/customize/recompile pipeline
- Interactive wizard + direct CLI modes
- Cross-platform support (Windows, macOS, Linux)
- Air-gapped operation for static skill content

### Phase 2 — Enforcement & Extension (Current Release)

**Architectural Constraint:** All features implemented exclusively through ma-agents installer code (`lib/`, `bin/`, `skills/`), BMAD extension module (`module.yaml` with `extends-module: bmm`, `module-help.csv`), and BMAD customization files (`.customize.yaml`, extension workflows via `bmad-bmb-create-workflow`). Zero modifications to the bmad-method package.

**F1: Skill Enforcement Architecture**
- Move `<!-- MA-AGENTS-START -->` instruction injection to the TOP of agent instruction files (highest priority position)
- Ship BMAD extension module that injects skill-loading into agent activation — skills are loaded before any menu or workflow executes
- Ensure all 4 custom BMAD agents include skill-loading activation logic — implementation mechanism updated by F9 (skill-loading moves from `.customize.yaml` `critical_actions` to internal commands in agent `prompts/` directory under 6.2.0 architecture)
- Research and implement per-agent enforcement mechanisms (Claude Code hooks, other agent equivalents)
- Research and implement context persistence strategies (BMAD sidecar memory, skill state restoration)

**F2: OpenCode Agent Support**
- Add OpenCode as the 12th supported agent (7th IDE agent) in `lib/agents.js`
- Skills path: `.opencode/skills/`
- Instruction injection: JSON-based (`opencode.json` instructions array)
- Template: `generic` (assess if agent-specific template is needed)

**F3: `_bmad-output` as Project Knowledge**
- Establish and document policy: `_bmad-output` is version-controlled, never gitignored
- Update installer to not add `_bmad-output` to `.gitignore`
- Document in README and installation guidance

**F4: Bug Management System**
- Define bug entity structure: problem description, reproduction steps, bug type, version found, environment constraints, severity, status
- New BMAD extension workflow (created via `bmad-bmb-create-workflow`, deployed with `extends-module: bmm`): generate a bug story from a bug report
- New ma-agents skill: `auto-bug-detection` — instructs coding agents that when they find a problem in already-delivered code (story done, code merged, released version), they propose creating a bug issue to the user for confirmation
- During BMAD code-review workflows, agents suggest generating bug issues when relevant problems are found
- Bugs exist in the backlog as standalone items — never part of an epic

**F5: Realistic Sprint Management**
- All sprint workflows created via `bmad-bmb-create-workflow` and deployed as BMAD extension (no bmad-method changes)
- Backlog: flat list containing both stories and bugs, not grouped by epic
- Sprint capacity: defined by number of stories/bugs, configured by Scrum Master during sprint planning
- Prioritization: multiple criteria beyond epic precedence
- Sprint composition: dev stories + bugs; not every story must belong to an epic
- New BMAD extension workflows: add a sprint, add stories/bugs to a sprint from backlog, change/modify a sprint
- Updated sprint status: shows real sprint definitions with assigned items, not just epic lists

**F6: Bundled BMAD Installation with Programmatic Setup**
- Bundle `bmad-method` v6.2.0 as a direct npm dependency inside ma-agents (not fetched via `npx` at install time)
- Bundle pre-cloned external BMAD modules (bmb, cis, tea, gds, wds) inside ma-agents npm package under `lib/bmad-cache/`
- Before calling bmad-method install, pre-populate `~/.bmad/cache/external-modules/` from bundled cache — bmad-method's `cloneExternalModule()` skips git clone when cache directory exists — ensuring fully offline/air-gapped installation
- Pin to bmad-method v6.2.0; version upgrade is a deliberate, tested operation
- Replace `npx bmad-method install` calls in `bmad.js` with direct invocation of the vendored dependency via `execSync('node <resolved-path> install ...')` where the path is resolved using `require.resolve('bmad-method/tools/bmad-npx-wrapper.js')`
- **Explicit parameter passing (replaces silent install):** ma-agents collects all installation parameters during its own interactive wizard (selected platforms/agents, user name, project path, module selections) and passes them to bmad-method as explicit CLI flags (`--tools`, `--modules`, `--directory`, `--user-name`, `--communication-language`, `--document-output-language`, `--output-folder`, `--custom-content`). The `--yes` flag is added to suppress prompts for parameters already provided — it no longer means "skip everything." bmad-method performs its full configuration using the explicit parameters, ensuring nothing is missed. If bmad-method introduces new CLI parameters that ma-agents hasn't mapped, `--yes` causes bmad-method to apply its own defaults rather than skipping
- **Single wizard UX:** The user experiences one unified installation flow through ma-agents. bmad-method runs non-interactively with full explicit parameters — no second wizard prompt ever appears
- **CI/CD compatibility:** In non-interactive mode (`--yes --force`), ma-agents uses its own defaults for all parameters and passes them to bmad-method via the same explicit flag mechanism — identical code path, just with pre-determined answers

**F7: Project Context Auto-Generation**
- At project-level installation, generate `_bmad-output/project-context.md` if it does not exist — a platform-agnostic constitutional document for AI agents (FR79)
- Generator function returns stamped content; install pipeline handles file write and idempotency check (two-layer design)
- Resolve actual MANIFEST.yaml paths per installed platform from manifest at generation time — list all currently-installed platform paths (FR81, FR82)
- Mandate: read MANIFEST.yaml, load always_load skills, use git worktrees per mission, follow 8-step agent lifecycle (FR80, FR83)
- Generation is idempotent — skip if file already exists; never overwrite (FR84, NFR23)
- Include inline expansion comments + machine-readable template version comment for future upgrade detection (FR85, NFR25)
- Update BMAD extension module `critical_actions` for 12 BMM+master agents to load project-context.md at activation; CIS agents explicitly excluded (FR86)
- Template maintained as `lib/templates/project-context.template.md` — no platform paths in template source (NFR22, NFR24)
- Document generation behavior in README and installation guidance (Story 13.5)

**F9: BMAD 6.2.0 Agent Architecture Migration**

The 4 custom agents (SRE/Alex, DevOps/Amit, Cyber/Yael, MIL-498/Joseph) were built using pre-6.2.0 BMAD patterns: `.customize.yaml` files with `critical_actions` injection, XML `<agent>` definitions in `_bmad/custom/agents/*.md`, and MIL-498 workflows running on the legacy YAML/XML workflow engine (`_bmad/core/tasks/workflow.xml`). BMAD 6.2.0 removes the legacy workflow engine entirely and standardizes on skills-based architecture where agents ARE skills — full skill folders with `SKILL.md`, `prompts/`, `resources/`, and `scripts/`. This feature migrates all 4 custom agents and their workflows to the native BMAD 6.2.0 architecture.

- **Agent conversion:** Each of the 4 custom agents is rebuilt as a BMAD skill-based agent with a standard skill folder structure (`SKILL.md` for identity/persona/activation, `prompts/` for internal commands replacing menu handlers, `resources/` for reference data, `scripts/` for deterministic operations). Agent capabilities currently defined as `critical_actions` in `.customize.yaml` files are migrated to internal commands in the agent's `prompts/` directory. Legacy XML `<agent>` definitions in `_bmad/custom/agents/*.md` are replaced by the agent's `SKILL.md` activation section. Agent menu items and command routing move from XML `<menu-handlers>` to SKILL.md frontmatter triggers and `prompts/` routing
- **MIL-498 workflow conversion:** All 11 MIL-STD-498 DID workflows (SSS, SSDD, OCD, SDP, SRS, SDD, STD, STR, IDD, IRS, HRS) are converted from YAML format (`workflow.yaml` + `instructions.md`) to BMAD 6.2.0 SKILL.md packages. Each workflow is classified as a Complex Workflow skill type with progressive disclosure (Layer 4: step files for sequential compliance-critical document generation). Workflow instructions currently in separate `instructions.md` files are integrated into the SKILL.md structure with step files in `prompts/`
- **SRE/DevOps/Cyber workflow conversion:** SRE operational playbooks (9 workflows), DevOps playbooks (6 workflows), and Cyber security playbooks (8 workflows) — currently standalone `.md` files in `lib/bmad-workflows/{agent}/` — are packaged as proper BMAD 6.2.0 skill packages (Simple Workflow or Complex Workflow type depending on complexity). Each workflow gets its own skill folder with `SKILL.md` entrypoint
- **Module architecture update:** The BMAD extension module identity is updated from the legacy `extends-module: bmm` with dual-layer `.customize.yaml` agent definitions to a proper BMAD 6.2.0 module with `module.yaml` containing `code`, `description`, and `module_version` fields. A module setup skill is added that writes module configuration to `config.yaml`, `config.user.yaml`, and `module-help.csv` following the BMAD 6.2.0 anti-zombie pattern (re-running setup is always safe, cleans stale config before writing)
- **Upgrade path via installer:** The installer detects an existing BMAD installation's version and performs in-place migration from 6.0.4 agent patterns to 6.2.0 skill-based patterns during normal `npx ma-agents` installation — no separate upgrade command. User customizations applied to agent personas, menu items, or workflow parameters are preserved and carried forward into the new SKILL.md-based structure. Legacy artifacts (old `.customize.yaml` files, XML agent definitions, YAML workflow files) are cleaned up after successful migration
- **Dual-layer elimination:** The current dual-layer agent definition pattern — base config in `lib/bmad-customizations/bmm-{agent}.customize.yaml` + extended config in `lib/bmad-extension/agents/bmm-{agent}.customize.yaml` — is consolidated into a single authoritative agent skill folder per agent. This removes the confusing split where base persona was in one file and `critical_actions` were in another

**F10: Multi-Repository Project Layout**

Enterprise projects commonly separate planning knowledge, sprint management, and implementation code across distinct repositories. The installer must support this layout so that BMAD workflows and AI agents read/write artifacts to the correct repository locations.

- **Knowledgebase repository:** Where planning artifacts live — PRD, architecture docs, product briefs, research, UX specifications, `_bmad-output/planning-artifacts/`. May be the current code repository (default) or a separate dedicated repository
- **Sprint management repository:** Where sprint execution artifacts live — sprint plans, story files, epic files, backlog items, bug stories, `_bmad-output/sprints/`. May be the current code repository (default) or a separate dedicated repository
- **Installation flow:** During installation, the installer asks the user for each concern (knowledgebase, sprint management):
  1. Is this managed locally or in a remote repository?
  2. If **remote**: ask for the git URL, then ask for the local destination path for cloning. If the destination already exists locally, confirm with the user before proceeding (do not overwrite). Clone if confirmed and not present
  3. If **local**: ask for the local path. Validate the path exists — if it does not, alert the user and ask them to confirm or correct
  4. If **same as code repo** (default): no additional configuration needed — single-repo mode, current behavior preserved
- **Config persistence:** Knowledgebase and sprint management paths are stored in `config.yaml` as shared project configuration, available to all BMAD workflows and agents
- **Project-context enforcement:** The generated `project-context.md` includes the knowledgebase and sprint management repository paths as mandatory agent operating rules — agents are instructed to resolve planning artifact reads/writes and sprint artifact reads/writes to the configured paths, not assume the current working directory
- **Cross-repo workflow resolution:** All BMAD workflows that produce planning artifacts (PRD creation/editing/validation, architecture, UX design, research, product briefs) resolve their output path from the configured knowledgebase path. All BMAD workflows that produce or consume sprint artifacts (sprint planning, story creation, sprint status, bug management, retrospectives) resolve paths from the configured sprint management path
- **Agent context bridging:** When an agent operates in a code repository that references external knowledgebase/sprint repos, the agent's project-context.md provides the cross-repo paths so the agent can locate planning context, story specifications, and sprint status without manual path discovery

### Phase 3 — Growth (Next)

- **F8: Agent Activity Dashboard** — CLI dashboard command showing real-time activity of all active AI agents across the project. Per-agent display: agent type, assigned story, active git worktree, branch, and status. Auto-refresh, filtering, and session history. Deferred from Phase 2 to Phase 3
- Visual Studio agent integration (identified gap)
- Additional language-specific skills (C++, C#, Python standards)
- Skill authoring tooling for organizational skill creators
- Expanded BMAD agent personas for additional enterprise roles

### Phase 4 — Expansion (Vision)

- Per-role skill assignment (different skills for different team roles)
- Organization-wide skill governance: central registry, approval workflows, compliance tracking
- Cross-project methodology analytics: adoption, consistency, coverage metrics
- Community skill marketplace
- Skill versioning with organizational override policies

### Risk Mitigation Strategy

**Technical Risks:** BMAD 6.2.0 migration (F9) is the highest-risk Phase 2 item — 4 agent rebuilds + 34 workflow conversions with atomic rollback requirement. Risk is mitigated by BMAD Builder's Agent Builder and Workflow Builder producing standardized output with lint gate validation. OpenCode JSON injection can be prototyped early. Bundled BMAD installation (F6) is well-understood — bmad-method's cache mechanism (`~/.bmad/cache/external-modules/`) has been confirmed to support pre-populated caches. Visual Studio integration remains an unknown for Phase 3.

**Adoption Risks:** Methodology drift across teams. Mitigated by skill enforcement architecture (Phase 2 F1) — moving from advisory to enforced compliance.

**Resource Risks:** Single developer (Chief Architect) drives core tooling. Knowledge concentration risk mitigated by comprehensive documentation (this PRD, architecture docs, skill authoring guides) and `_bmad-output` as version-controlled project knowledge.

## Functional Requirements

### Skill Management

- FR1: Engineers can install one or more skills into any supported AI agent with a single command
- FR2: Engineers can uninstall previously installed skills from an agent
- FR3: Engineers can view the list of all available skills with descriptions and categories
- FR4: Engineers can view the installation status of skills for a specific agent
- FR5: Engineers can upgrade skills when a newer version is available, with upgrade detection
- FR6: Engineers can install skills in non-interactive mode for CI/CD pipeline automation
- FR7: Engineers can install skills across multiple agents simultaneously from one manifest

### BMAD-METHOD Integration

- FR8: Engineers can install the BMAD-METHOD framework alongside skills in a single workflow
- FR9: Engineers can update an existing BMAD installation to a newer version
- FR10: Engineers can apply organization-specific customizations to BMAD that persist across updates
- FR11: Engineers can register MIL-STD-498 workflows into an existing BMAD installation
- FR12: Engineers can trigger BMAD recompile after customization changes

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
- FR26: Product managers can run sprint planning from epics
- FR27: Architects can create architecture documents through guided workflows
- FR28: Architects can create UX design specifications
- FR29: Engineers can check implementation readiness across PRD, architecture, and epics
- FR30: Engineers can run code reviews against established standards
- FR31: Test engineers can generate automated E2E tests from feature specifications
- FR32: Project managers can track sprint status and surface risks
- FR33: Teams can run retrospectives at epic boundaries

### Agent Targeting & Portability

- FR34: Engineers can target any of the supported IDE agents (Claude Code, Cursor, Cline, Copilot, Gemini, Kilocode, OpenCode) for skill installation
- FR35: Engineers can target BMAD specialized agents (SRE, DevOps, Cyber, MIL-STD-498) for persona installation
- FR36: Skills produce functionally equivalent behavior regardless of which agent they are installed into
- FR37: Engineers can switch between AI agents and retain the same methodology framework
- FR38: The system translates skill content into each agent's native configuration format automatically

### Skill Authoring & Governance

- FR39: The Chief Architect can author new skills using the skill format (skill.json + SKILL.md + agent templates)
- FR40: The Chief Architect can designate skills as mandatory (`always_load: true`) for organizational enforcement
- FR41: The Chief Architect can customize BMAD agent personas to fit organizational processes
- FR42: The Chief Architect can develop new specialized agent personas for enterprise-specific roles
- FR43: The system generates MANIFEST.yaml from installed skills for agent consumption

### Environment & Deployment

- FR44: Engineers can install and use skills in air-gapped environments without internet access
- FR45: Engineers can use ma-agents on Windows, macOS, and Linux
- FR46: Engineers can use ma-agents with on-premise AI agents running against local models
- FR47: The system tracks installed skill versions per agent via manifest for upgrade/downgrade detection

### Audit & Traceability

- FR48: The system maintains an audit trail of AI agent activities via the ai-audit-trail skill
- FR49: Document generation workflows maintain traceability across inter-role handoffs (SSS → SRS → SDD → STD)
- FR50: Engineers can validate PRDs and other documents against established standards

### Skill Enforcement (Phase 2)

- FR51: The installer injects the planning instruction at the TOP of agent instruction files, not the bottom — ensuring highest priority during LLM context processing
- FR52: The installer deploys a BMAD extension module (`extends-module: bmm`) that injects skill-loading `critical_actions` into BMAD agents — skills are loaded before any menu or workflow executes
- FR53: All 11 BMAD agents (4 custom: SRE, DevOps, Cyber, MIL-498 + 7 built-in: bmad-master, analyst, architect, dev, pm, qa, sm) include skill-loading `critical_actions` — custom agents via `.customize.yaml` files, built-in agents via the BMAD extension module
- FR54: Per-agent enforcement mechanisms are implemented where the agent supports them (e.g., Claude Code hooks that verify manifest was read)
- FR55: Context persistence strategies ensure skills survive LLM context compression and session restoration (via BMAD sidecar memory or equivalent)

### OpenCode Agent Support (Phase 2)

- FR56: Engineers can target OpenCode for skill installation with skills placed in `.opencode/skills/`
- FR57: The installer injects skill references into `opencode.json` via the instructions array using JSON config merging (not replacement)

### Project Knowledge (Phase 2)

- FR58: The installer does not add `_bmad-output` to `.gitignore` — this folder is tracked as version-controlled project knowledge
- FR59: The `_bmad-output` policy is documented in README and installation guidance

### Bug Management (Phase 2)

- FR60: Bugs are structured entities with required fields: problem description, reproduction steps, bug type, version found, environment constraints, severity, and status
- FR61: A BMAD extension workflow (deployed via `extends-module: bmm`) generates a structured bug story from a bug report
- FR62: The `auto-bug-detection` skill instructs coding agents to propose a bug issue to the user when they detect a problem in already-delivered code (story done, code merged, released version)
- FR63: During BMAD code-review workflows, agents suggest generating bug issues when relevant problems are found in delivered features
- FR64: Bugs exist in the backlog as standalone items — never assigned to an epic

### Sprint Management (Phase 2)

- FR65: The backlog is a flat list containing both stories and bugs, not grouped by epic — items are prioritized independently of their parent epic
- FR66: Sprint capacity is defined by number of items (stories + bugs), configured by the Scrum Master during sprint planning
- FR67: Story/bug prioritization supports multiple criteria beyond epic precedence — criteria include severity, business value, dependencies, type, and age
- FR68: A BMAD extension workflow enables adding a new sprint with defined capacity and iteration identifier
- FR69: A BMAD extension workflow enables moving stories and bugs from the backlog into a sprint
- FR70: A BMAD extension workflow enables changing/modifying a sprint (reorder items, swap items, adjust capacity)
- FR71: Sprint status displays real sprint definitions with assigned items, not just a list of epics
- FR128: Bugs are a story type in the backlog — they have the same lifecycle as stories (backlog → ready-for-dev → in-progress → review → done) plus bug-specific fields (problem description, reproduction steps, severity, version found)
- FR129: A BMAD extension workflow enables moving items from a sprint back to the backlog — removing them from the sprint without changing their status
- FR130: When a story or bug reaches "done" status, it is automatically removed from the sprint status file — done items do not clutter the active sprint view
- FR131: When a story or bug reaches "done" status, its story `.md` file is moved from the active stories directory to a `done/` subfolder — preserving the artifact while keeping the active directory clean
- FR132: Sprints are first-class entities defined as YAML files — each sprint has an iteration identifier, capacity, assigned item list, start/end context, and status (planning / active / closed)

### Agent Activity Dashboard (Phase 3 — deferred from Phase 2)

- FR87: Project managers can invoke a real-time dashboard displaying the current activity of all active AI agents in the project via `npx ma-agents dashboard`
- FR88: The dashboard displays per-agent details: agent type, assigned story identifier, active git worktree path, current branch, and current status (implementing / reviewing / awaiting-review / idle)
- FR89: Dashboard data refreshes automatically at a configurable interval (default: 30 seconds) without requiring manual reload — elapsed time since last refresh is visible
- FR90: Project managers can filter the dashboard by agent type, story identifier, branch, or status category
- FR91: The dashboard distinguishes active agents (in-progress work), agents awaiting human review (PR open, no merge), and idle agents (no current worktree assignment)
- FR92: Project managers can view completed session history per agent: agent type, story identifier, branch, duration, and outcome (merged / abandoned / pending)
- FR93: Dashboard data is derived exclusively from existing project file structures (`_bmad-output/` activity logs, git worktree state, story status files) — no additional persistent data store is required

### BMAD 6.2.0 Agent Architecture Migration (Phase 2)

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

#### Module Architecture Update

- FR104: The BMAD extension module is restructured with a proper BMAD 6.2.0 `module.yaml` containing `code` (module identifier), `description`, and `module_version` fields — replacing the legacy `extends-module: bmm` pattern in the current `lib/bmad-extension/module.yaml`
- FR105: A module setup skill is created that writes module configuration to `config.yaml` (shared, git-committed), `config.user.yaml` (personal, gitignored), and `module-help.csv` (capability registry) — following the BMAD 6.2.0 anti-zombie pattern where re-running setup removes all existing entries for the module's code before writing new values
- FR106: The dual-layer agent definition pattern — base config in `lib/bmad-customizations/bmm-{agent}.customize.yaml` + extended config in `lib/bmad-extension/agents/bmm-{agent}.customize.yaml` — is consolidated into a single authoritative agent skill folder per agent under the module's `agents/` directory

#### Upgrade Path

- FR107: The installer detects the installed BMAD version and performs in-place migration from 6.0.4 agent patterns (`.customize.yaml`, XML agent definitions, YAML workflows) to 6.2.0 skill-based patterns during normal `npx ma-agents` installation — no separate upgrade command required
- FR108: During migration, the installer preserves user customizations applied to agent personas, menu items, or workflow parameters by extracting customization values from existing files and applying them to the new SKILL.md-based structure
- FR109: After successful migration, the installer removes legacy artifacts: old `.customize.yaml` files in `lib/bmad-customizations/` and `lib/bmad-extension/agents/`, XML agent definitions in `_bmad/custom/agents/`, YAML workflow files in `lib/bmad-workflows/mil498/`, and the `_bmad-custom-backup-temp/` directory
- FR110: For fresh installations (no existing BMAD), the installer deploys directly in 6.2.0 skill-based format — no legacy artifacts are created

### Multi-Repository Project Layout (Phase 2)

- FR111: During installation, the installer asks the user where the project knowledgebase is managed — options: current repository (default), local path, or remote git repository
- FR112: During installation, the installer asks the user where sprint management is managed — options: current repository (default), local path, or remote git repository
- FR113: When the user selects "remote" for either concern, the installer asks for the git URL and a local destination path for cloning. If the destination directory already exists, the installer displays its contents summary and asks the user to confirm before proceeding — it never overwrites an existing directory
- FR114: When the user selects "remote" and the local destination does not exist, the installer clones the repository to the specified path
- FR115: When the user selects "local path" for either concern, the installer validates that the path exists. If it does not exist, the installer alerts the user and asks them to confirm the path or provide a corrected one — it does not silently create the directory
- FR116: When the user selects "current repository" (default) for both concerns, the installer operates in single-repo mode with no additional configuration — preserving current behavior for projects that manage everything in one repository
- FR117: The knowledgebase and sprint management paths are stored in `config.yaml` as shared project configuration fields (`knowledgebase_path`, `sprint_management_path`) — available to all BMAD workflows and agents at runtime
- FR118: The generated `project-context.md` includes the configured knowledgebase and sprint management paths as mandatory agent operating rules — agents are instructed to resolve all planning artifact reads/writes to `{knowledgebase_path}` and all sprint artifact reads/writes to `{sprint_management_path}`
- FR119: All BMAD workflows that produce planning artifacts (PRD creation/editing/validation, architecture creation, UX design, research, product briefs) resolve their output directory from the configured `{knowledgebase_path}` rather than assuming the current working directory
- FR120: All BMAD workflows that produce or consume sprint artifacts (sprint planning, story creation, story status lookup, sprint status, bug management, retrospectives) resolve their paths from the configured `{sprint_management_path}`
- FR121: When the agent activity dashboard (F8, Phase 3) is implemented, it resolves story status files and sprint data from the configured `{sprint_management_path}` — correctly reading agent activity across repositories
- FR122: In multi-repo mode, the installer creates a lightweight cross-reference file in the code repository (`_bmad-output/project-layout.yaml`) documenting the knowledgebase and sprint management paths — so agents activated in the code repo can discover where planning and sprint data live without re-running installation

### Bundled BMAD Installation (Phase 2)

- FR74: The ma-agents npm package bundles bmad-method v6.2.0 as a direct dependency — no `npx` download at install time
- FR75: The ma-agents npm package bundles pre-cloned BMAD external modules (bmb, cis, tea, gds, wds) under `lib/bmad-cache/` — no git clone at install time
- FR76: Before invoking bmad-method install, the installer pre-populates `~/.bmad/cache/external-modules/` from the bundled cache so bmad-method finds modules locally
- FR123: The ma-agents installer collects all BMAD-relevant configuration during its own interactive wizard — selected platforms/agents, user name, project path, module selections — and passes them to bmad-method as explicit CLI flags (`--tools`, `--modules`, `--directory`, `--user-name`, `--communication-language`, `--document-output-language`, `--output-folder`, `--custom-content`), replacing the current silent install approach
- FR124: bmad-method performs its full configuration using the explicit parameters passed by ma-agents — the `--yes` flag suppresses prompts for parameters already supplied via flags, but does not skip configuration steps
- FR125: When bmad-method introduces new CLI parameters that ma-agents has not mapped, the `--yes` flag causes bmad-method to apply its own sensible defaults for those parameters — ensuring no configuration is missed even as bmad-method evolves
- FR126: The user experiences a single unified installation wizard — bmad-method runs non-interactively with full explicit parameters, with no separate BMAD interactive prompt appearing during the ma-agents installation flow
- FR127: In non-interactive mode (`--yes --force`), ma-agents uses its own defaults for all parameters and passes them to bmad-method via the same explicit flag mechanism — identical code path as interactive mode with pre-determined answers, ensuring CI/CD installations produce identical BMAD configuration as interactive ones

### Developer Infrastructure (Phase 2)

- FR73: The 4 core modules (cli.js, installer.js, agents.js, bmad.js) have automated regression tests that verify architectural contracts (pipeline ordering, additive-only operations, template resolution, command routing)

### Methodology Onboarding (Phase 2)

- FR72: A methodology presentation is bundled with BMAD installation and deployed to `_bmad-output/methodology/`, providing team onboarding content for BMAD-METHOD without separate training materials

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

### BMAD Extension Compatibility (Phase 2)

- NFR16: The BMAD extension module must survive `npx bmad-method install --action update` without losing functionality — extensions maintain independent identity and persist across BMAD updates
- NFR17: All BMAD-facing changes must use official BMAD Builder extension APIs only — `module.yaml` (module identity), `module-help.csv` (capability registration), setup skill (config management), Agent Builder (agent creation), Workflow Builder (workflow creation), skill folder standard (SKILL.md + prompts/ + resources/ + scripts/) — zero bmad-method core modifications
- NFR18: OpenCode JSON instruction injection must not corrupt existing `opencode.json` configuration — JSON config merging must be additive-only
- NFR19: Bug and sprint extension workflows must function identically whether invoked via BMAD agent menu or direct slash command

### Bundled Installation (Phase 2)

- NFR20: The bundled BMAD cache must be version-pinned (v6.2.0 current) — upgrading the bundled version is a deliberate, tested release operation, not an automatic fetch
- NFR21: The bundled installation produces deterministic `_bmad/` output from the included cache. The resulting directory structure is reproducible given the same ma-agents package version.

### Agent Activity Dashboard (Phase 3 — deferred from Phase 2)

- NFR26: The dashboard shall reflect agent state changes within 60 seconds of the triggering file system event — measured from file write completion to next dashboard render cycle
- NFR27: The dashboard shall render status for up to 20 concurrently active agents in under 2 seconds — measured by wall-clock time from refresh trigger to complete output display
- NFR28: Dashboard data collection shall be read-only against existing project file structures — no writes to `_bmad-output/` or git state during dashboard operation, verified by absence of new file system writes during a dashboard session

### Multi-Repository Project Layout (Phase 2)

- NFR34: Multi-repo configuration must be backward-compatible — projects that do not configure external repositories must function identically to current single-repo behavior with no degradation or additional prompts on subsequent runs
- NFR35: Remote repository cloning during installation must work in air-gapped environments when the user provides a local network git URL (e.g., internal GitLab) — no assumption of public internet access
- NFR36: The `project-layout.yaml` cross-reference file must be deterministic — running the installer multiple times with the same multi-repo configuration produces an identical file
- NFR37: All BMAD workflows must resolve artifact paths through the configured layout — no workflow may hardcode `_bmad-output/` as a relative path assumption. Path resolution must use the config values, falling back to current directory only when config specifies single-repo mode

### BMAD 6.2.0 Migration (Phase 2)

- NFR29: The migration from 6.0.4 to 6.2.0 agent patterns must be atomic — either all 4 agents and their workflows migrate successfully or the installation rolls back to the pre-migration state with no partial conversions
- NFR30: All 4 migrated agents must produce functionally equivalent behavior after migration — same menus, same workflows, same outputs as before migration. Verified by exercising each agent's full menu and confirming all commands route correctly
- NFR31: Migrated agent skill folders must conform to BMAD Builder's lint gate standards — `scan-path-standards.py` (path conventions, no `{skill-root}`, proper prefixes) and `scan-scripts.py` (portability, agentic design) pass without critical violations
- NFR32: All 23 converted workflows (11 MIL-498 + 9 SRE + 6 DevOps + 8 Cyber = 34 total; corrected: 11+9+6+8=34) produce identical output artifacts as their pre-migration equivalents — same document structure, same section headers, same template variables, verified by diff comparison of generated outputs
- NFR33: The module setup skill's anti-zombie cleanup must be idempotent — running `npx ma-agents` multiple times produces the same `config.yaml`, `config.user.yaml`, and `module-help.csv` state regardless of prior runs

### Project Context Generation (Phase 2)

- FR79: At project-level installation, the installer generates `_bmad-output/project-context.md` if one does not already exist — providing agents with a constitutional document that governs their behavior throughout the project lifecycle
- FR80: The generated project-context.md contains platform-agnostic mandatory AI agent operating rules: read MANIFEST.yaml before every task, load all `always_load: true` skills, and use the git-workflow-skill with fresh worktrees per mission (not just branches)
- FR81: The skills manifest path(s) in project-context.md are resolved at install time to the actual installed path for each target platform — no hardcoded agent-specific directory references (e.g., not `.claude/skills/MANIFEST.yaml` literally, but the actual resolved path for the platform being installed)
- FR82: When multiple platforms are installed simultaneously, project-context.md lists all MANIFEST.yaml paths for all installed platforms so any agent can find the correct path for its environment
- FR83: The generated project-context.md documents the full agent mission lifecycle in sequence: (1) pre-flight skill loading, (2) fresh worktree creation via `git worktree add`, (3) implementation, (4) self-review using the code-review skill, (5) PR creation with conventional commit, (6) human review gate — agent does not auto-merge, (7) merge and worktree cleanup, (8) post-mission updates (story status + AiAudit.md)
- FR84: Project-context generation is idempotent — if `_bmad-output/project-context.md` already exists when the installer runs, it is left untouched and generation is skipped without error
- FR85: The generated project-context.md includes inline expansion guidance comments directing users to `bmad-generate-project-context` (post-architecture), `bmad-retrospective` (post-sprint), and manual updates as the living document evolves
- FR86: The BMAD extension module updates `critical_actions` for all BMM agents (4 custom + 7 built-in) and bmad-master (12 total) to load `_bmad-output/project-context.md` during agent initialization — alongside MANIFEST.yaml. CIS module agents are explicitly excluded as project-context governance rules (git workflow, dev lifecycle) do not apply to creative/innovation sessions.

### Project Context Non-Functional Requirements (Phase 2)

- NFR22: The project-context *template* (`lib/templates/project-context.template.md`) must contain no hardcoded platform-specific paths or agent directory names — path-specific content is stamped at generation time, not embedded in the template source
- NFR23: Project-context generation is additive-only — the installer never modifies or deletes an existing `_bmad-output/project-context.md` regardless of its content or age
- NFR24: The project-context template is maintained as a standalone file (`lib/templates/project-context.template.md`), not as an inline string in installer code — allowing the template to be updated independently of installer logic
- NFR25: The generated project-context.md includes a machine-readable generator version comment (e.g., `<!-- ma-agents-template-version: 1.0 -->`). When a future ma-agents version detects a lower template version in an existing file, it logs a warning suggesting the user run `/bmad-generate-project-context` to refresh — it never auto-overwrites
