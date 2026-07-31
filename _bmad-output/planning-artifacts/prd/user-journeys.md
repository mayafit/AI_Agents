# User Journeys

> **Shard** of the [PRD index](../prd.md). Content is verbatim from the
> pre-split document; the index carries the front matter, registers and reading order.

---

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
