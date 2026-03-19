---
stepsCompleted: ['step-01-init', 'step-02-discovery', 'step-02b-vision', 'step-02c-executive-summary', 'step-03-success', 'step-04-journeys', 'step-05-domain', 'step-06-innovation', 'step-07-project-type', 'step-08-scoping', 'step-09-functional', 'step-10-nonfunctional', 'step-11-polish', 'step-12-complete', 'step-e-01-discovery', 'step-e-02-review', 'step-e-03-edit']
workflowStatus: 'complete'
completedDate: '2026-03-05'
lastEdited: '2026-03-19'
editHistory:
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
**Date:** 2026-03-05 | **Last Edited:** 2026-03-15

## Executive Summary

> ***Install AND enforce — agent-agnostic methodology enforcement for enterprise software engineering, now with guaranteed skill compliance, bug management, and realistic sprint workflows.***

ma-agents is an enterprise development methodology platform that enables software organizations to adopt AI coding agents at scale without sacrificing engineering rigor, traceability, or standards compliance. Built around the BMAD-METHOD framework, it delivers a complete software development lifecycle — from systems engineering and requirements through architecture, implementation, testing, and production — as portable, agent-agnostic skill packages.

The platform solves two critical organizational challenges. First, as AI coding assistants proliferate (Claude Code, Copilot, Gemini, Cursor, Cline, OpenCode, and on-prem alternatives), engineering teams fragment into tool-specific silos with inconsistent practices. Second, **installed skills are not reliably enforced** — agents install skills but then ignore them during operation, with planning instructions losing priority in context, BMAD workflows operating in isolation from the skill system, and no enforcement mechanism ensuring compliance. ma-agents eliminates both by decoupling engineering methodology from any single AI tool and ensuring that installed skills are actually followed — standards are defined once, installed once, and enforced uniformly across all agents.

### What Makes This Special

The core insight is convergence: AI agents need governance, and engineering methodology needs AI-native delivery. ma-agents sits at this intersection as the **governance and standards layer** for AI-assisted development.

- **Install AND enforce** — 28+ codified engineering skills install identically across 12 target agents with automatic translation to each agent's native format. Skills are not merely available — they are enforced via BMAD `critical_actions`, top-priority instruction injection, and per-agent enforcement hooks
- **Full SDLC coverage via BMAD-METHOD** — integrated workflows spanning product discovery, requirements, architecture, sprint planning, implementation, QA, and retrospectives, orchestrated by specialized AI personas (PM, Architect, Developer, QA, Scrum Master, Tech Writer)
- **Enterprise-grade specialized agents** — purpose-built personas for defense/enterprise needs: SRE (Alex), DevOps (Amit), Cyber Analyst (Yael), and MIL-STD-498 Expert (Joseph) with operational playbooks and skill-loading `critical_actions`
- **Bug management** — Agents autonomously detect problems in delivered code and propose bug issues. BMAD extension workflows generate structured bug stories. Bugs live in the backlog alongside stories for realistic sprint planning
- **Realistic sprint management** — Sprints defined by capacity (number of items), with flat backlogs containing both stories and bugs, multi-criteria prioritization, and workflows to add/modify/manage sprints
- **BMAD-native extension architecture** — All BMAD-facing enhancements use official BMAD Builder extension points (`extends-module`, `critical_actions`, `module-help.csv`). Zero bmad-method core modifications. Extensions survive BMAD updates
- **Environment agnostic** — supports on-prem, public cloud, and air-gapped deployments through universal skill format and multi-agent targeting
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

### Technical Success

- Skills install correctly across all 12 supported agents with proper format translation
- Skill compliance rate >90% for `always_load: true` skills (baseline: ~0%)
- On-prem, public cloud, and air-gapped deployment scenarios all function without degradation
- BMAD-METHOD integration works end-to-end: install, update, customize, recompile
- BMAD extension module (`extends-module: bmm`) survives `npx bmad-method install --action update` without losing functionality
- Manifest system tracks versions reliably for upgrade/downgrade detection across multi-agent installs
- All 11 BMAD agents (4 custom + 7 built-in) have `critical_actions` for skill loading on activation

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

Dana manages project phases, timelines, and deliverables. She uses BMAD's PM persona to structure the project into phases with clear milestones and release gates. She generates the SDP (Software Development Plan) using the MIL-STD-498 workflow, defining deliverables per phase, resource allocation, and acceptance criteria. She manages sprints through the new sprint workflows: adding sprints with defined capacity, assigning stories and bugs from the flat backlog using multi-criteria prioritization, and modifying sprint composition as priorities shift. She tracks sprint status with `/bmad-bmm-sprint-status` — which now shows real sprint definitions with assigned items rather than just epic lists — and uses `/bmad-bmm-retrospective` at epic boundaries. Her SDP aligns with the systems engineer's SSS and the product manager's epics. Throughout her workflow, installed skills (git-workflow, audit-trail) are enforced automatically via BMAD `critical_actions`.

**Capabilities revealed:** SDP generation, project phase planning, milestone/deliverable tracking, sprint management (add/modify/assign), realistic sprint status, retrospectives, cross-role document alignment, skill enforcement

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

Alon defines the enterprise development methodology and builds the tooling to enforce it. He uses ma-agents to package organizational engineering standards as portable skills, customizes BMAD agent personas to fit the organization's processes, and develops new specialized agents (SRE, Cyber, MIL-STD-498) for roles specific to defense. He selects which skills are mandatory (`always_load: true`), authors custom skills using the skill-creator, and runs `npx ma-agents` across projects to ensure uniform methodology adoption. He architects the BMAD extension module (`extends-module: bmm`) that injects skill enforcement via `critical_actions`, designs bug management and sprint workflows using `bmad-bmb-create-workflow`, and ensures all extensions survive BMAD updates. He uses the full BMAD workflow — from brainstorming through architecture to implementation — to develop ma-agents itself. He ensures `_bmad-output` is committed to version control as project knowledge.

**Capabilities revealed:** Skill authoring and governance, BMAD extension module architecture, agent persona customization with `critical_actions`, methodology definition, enterprise-wide deployment, custom agent development, bug/sprint workflow design, BMAD self-application

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
- **BMAD Builder extension architecture** — All BMAD-facing enhancements (skill enforcement, bug workflows, sprint workflows) must use official BMAD Builder extension points (`extends-module`, `critical_actions`, `module-help.csv`). Zero bmad-method core modifications. Extensions created via `bmad-bmb-create-agent` and `bmad-bmb-create-workflow`

### Risk Mitigations

- **Methodology drift** — Risk: teams customize skills locally and diverge from the enterprise standard. Mitigation: `always_load: true` for mandatory skills, manifest-based version tracking, centralized skill distribution
- **Agent compatibility breakage** — Risk: AI agent vendors change their configuration format. Mitigation: agent-specific template system with resource mapping allows format changes without rewriting skills
- **BMAD version conflicts** — Risk: BMAD updates overwrite ma-agents customizations. Mitigation: BMAD extension module with independent identity survives updates; `extends-module` mechanism ensures extensions persist across `npx bmad-method install --action update`
- **Skill enforcement failure** — Risk: agents install skills but ignore them during operation. Mitigation: multi-layered enforcement — top-priority instruction injection, BMAD `critical_actions` on agent activation, per-agent hooks (Claude Code), and context persistence research

## Innovation & Novel Patterns

### Detected Innovation Areas

- **Methodology-as-Code paradigm** — Engineering standards and SDLC practices are codified as portable skill packages rather than wiki pages, training decks, or tribal knowledge. Skills are versioned, installable, and enforceable — treating methodology like software
- **Install AND Enforce paradigm** — The first cross-agent skill system that doesn't just install skills but ensures agents actually use them. Multi-layered enforcement: top-priority instruction injection, BMAD `critical_actions` on agent activation, per-agent hooks, and context persistence. Moves from advisory ("please read the manifest") to enforced ("skills loaded before any workflow executes")
- **Agent-agnostic governance layer** — No existing tool provides a standards enforcement layer across multiple AI coding agents. ma-agents creates a new product category: the methodology middleware between organizations and their AI tools
- **BMAD-native extension architecture** — Uses official BMAD Builder extension points to inject enforcement, workflows, and agent behaviors without modifying the BMAD core. Demonstrates that complex cross-cutting concerns (skill enforcement, bug management, sprint workflows) can be delivered as extension modules that survive upstream updates
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
- Ship BMAD extension module (`extends-module: bmm`) that injects skill-loading into agent `critical_actions` — executed before any menu or workflow
- Update all 4 BMAD agent `.customize.yaml` files (SRE, DevOps, Cyber, MIL-498) with skill-loading `critical_actions`
- Research and implement per-agent enforcement mechanisms (Claude Code hooks, other agent equivalents)
- Research and implement context persistence strategies (BMAD sidecar memory via `hasSidecar`/`sidecar-folder`, skill state restoration)

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

**F6: Bundled BMAD Installation**
- Bundle `bmad-method` v6.0.4 as a direct npm dependency inside ma-agents (not fetched via `npx` at install time)
- Bundle pre-cloned external BMAD modules (bmb, cis, tea, gds) inside ma-agents npm package under `lib/bmad-cache/`
- Before calling bmad-method install, pre-populate `~/.bmad/cache/external-modules/` from bundled cache — bmad-method's `cloneExternalModule()` skips git clone when cache directory exists
- Pin to bmad-method v6.0.4 for initial release; version upgrade is a deliberate, tested operation
- Replace `npx bmad-method install` calls in `bmad.js` with direct invocation of the vendored dependency via `execSync('node <resolved-path> install ...')` where the path is resolved using `require.resolve('bmad-method/tools/bmad-npx-wrapper.js')`

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

### Phase 3 — Growth (Next)

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

**Technical Risks:** BMAD extension compatibility and OpenCode JSON injection are the primary unknowns for Phase 2. Both can be prototyped early. Bundled BMAD installation (F6) is well-understood — bmad-method's cache mechanism (`~/.bmad/cache/external-modules/`) has been confirmed to support pre-populated caches. Visual Studio integration remains an unknown for Phase 3.

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

- FR65: The backlog is a flat list containing both stories and bugs, not grouped by epic
- FR66: Sprint capacity is defined by number of items (stories + bugs), configured by the Scrum Master during sprint planning
- FR67: Story/bug prioritization supports multiple criteria beyond epic precedence
- FR68: A BMAD extension workflow enables adding a new sprint with defined capacity and iteration identifier
- FR69: A BMAD extension workflow enables adding stories and bugs to a sprint from the backlog
- FR70: A BMAD extension workflow enables changing/modifying a sprint (reorder items, swap items, adjust capacity)
- FR71: Sprint status displays real sprint definitions with assigned items, not just a list of epics

### Bundled BMAD Installation (Phase 2)

- FR74: The ma-agents npm package bundles bmad-method v6.0.4 as a direct dependency — no `npx` download at install time
- FR75: The ma-agents npm package bundles pre-cloned BMAD external modules (bmb, cis, tea, gds) under `lib/bmad-cache/` — no git clone at install time
- FR76: Before invoking bmad-method install, the installer pre-populates `~/.bmad/cache/external-modules/` from the bundled cache so bmad-method finds modules locally

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
- NFR17: All BMAD-facing changes must use official BMAD Builder extension APIs only (`extends-module`, `critical_actions`, `module-help.csv`, `bmad-bmb-create-agent`, `bmad-bmb-create-workflow`) — zero bmad-method core modifications
- NFR18: OpenCode JSON instruction injection must not corrupt existing `opencode.json` configuration — JSON config merging must be additive-only
- NFR19: Bug and sprint extension workflows must function identically whether invoked via BMAD agent menu or direct slash command

### Bundled Installation (Phase 2)

- NFR20: The bundled BMAD cache must be version-pinned (v6.0.4 initial) — upgrading the bundled version is a deliberate, tested release operation, not an automatic fetch
- NFR21: The bundled installation produces deterministic `_bmad/` output from the included cache. The resulting directory structure is reproducible given the same ma-agents package version.

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
