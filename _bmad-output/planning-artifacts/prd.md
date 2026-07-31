---
stepsCompleted: ['step-01-init', 'step-02-discovery', 'step-02b-vision', 'step-02c-executive-summary', 'step-03-success', 'step-04-journeys', 'step-05-domain', 'step-06-innovation', 'step-07-project-type', 'step-08-scoping', 'step-09-functional', 'step-10-nonfunctional', 'step-11-polish', 'step-12-complete', 'step-e-01-discovery', 'step-e-02-review', 'step-e-03-edit', 'step-e-01-discovery', 'step-e-02-review', 'step-e-03-edit-2026-03-24', 'step-e-01-discovery', 'step-e-02-review', 'step-e-03-edit-2026-03-25', 'step-e-01-discovery', 'step-e-02-review', 'step-e-03-edit-2026-04-07', 'step-e-01-discovery', 'step-e-02-review', 'step-e-03-edit-2026-04-08', 'step-e-01-discovery', 'step-e-02-review', 'step-e-03-edit-2026-05-01', 'step-e-01-discovery', 'step-e-02-review', 'step-e-03-edit-2026-05-01b']
workflowStatus: 'complete'
completedDate: '2026-03-05'
lastEdited: '2026-07-31'
editHistoryLocation: 'prd/changelog.md'
inputDocuments: ['docs/index.md', 'docs/project-overview.md', 'docs/architecture.md', 'docs/source-tree-analysis.md', 'docs/development-guide.md', 'README.md', 'CONTRIBUTING.md', 'DEVELOPMENT.md', 'QUICK_START.md', 'SKILLS_STRUCTURE.md', '_bmad-output/planning-artifacts/product-brief-agents-2026-03-08.md']
workflowType: 'prd'
documentCounts:
  briefs: 2
  research: 0
  brainstorming: 1
  projectDocs: 5
classification:
  projectType: 'developer_tool_methodology_platform'
  domain: 'software_engineering_development_methodology'
  complexity: 'medium-high'
  projectContext: 'brownfield_documented_as_greenfield'
---

# Product Requirements Document - agents

**Author:** Alon
**Date:** 2026-03-05 | **Last Edited:** 2026-07-31

> **This is the PRD index.** The PRD was decomposed on 2026-07-31 (it was a single 184 KB /
> 1,011-line file). Content is verbatim; this file carries the front matter and the registers.
>
> **The unit of decomposition is the capability, not document order.** Each capability file
> holds that capability's functional requirements *and* its quality attributes together, so a
> single read gives you everything constraining one part of the system. Requirements that
> constrain everything are factored out into two system-wide files.
>
> **Capability files are named to match the architecture.** Working on capability *X*? Read
> `prd/capabilities/X.md` and `architecture/decisions/X.md` — same filename, both sides of the
> contract.

**Totals:** 246 FR definitions covering **245 distinct IDs** (high-water mark FR247; FR35 is
defined twice — Known Issues #1) · 75 NFRs, all distinct (high-water mark NFR75) · 11
capability domains covering the PRD's 25 declared capability areas. Every ID except FR35
appears in exactly one file, and the counts match the pre-split document exactly.

---

## Capability register

| Capability file | PRD capability areas | FRs | NFRs | Architecture |
|---|---|---|---|---|
| [skills-platform.md](prd/capabilities/skills-platform.md) | F1 Skill Management & Portability · F2 Skill Enforcement · F15 Developer Infrastructure | 25 | — | [skills-platform.md](architecture/decisions/skills-platform.md) |
| [bmad-integration-and-bundling.md](prd/capabilities/bmad-integration-and-bundling.md) | F3 BMAD-METHOD Integration (+ Bundled Install) · F4 BMAD Extension Architecture | 16 | NFR16–21 | [bmad-integration-and-bundling.md](architecture/decisions/bmad-integration-and-bundling.md) |
| [bmad-platform-currency.md](prd/capabilities/bmad-platform-currency.md) | F25 v6.10.0 *(current)* · F24 v6.9.0 · F23 v6.8.0 · F21 v6.6.0 · F20 6.3.0 · F5 6.2.0 | 52 | NFR29–33, 50–59, 70–75 | [bmad-platform-currency.md](architecture/decisions/bmad-platform-currency.md) |
| [agent-personas-and-ide-targets.md](prd/capabilities/agent-personas-and-ide-targets.md) | F6 Specialized Agent Personas · F14 OpenCode Support · F22 Cline Workflow Generation | 9 | — | [agent-personas-and-ide-targets.md](architecture/decisions/agent-personas-and-ide-targets.md) |
| [methodology-and-sdlc-workflows.md](prd/capabilities/methodology-and-sdlc-workflows.md) | F7 MIL-STD-498 · F8 SDLC Workflows · F9 Bug Management · F16 Methodology Onboarding | 27 | — | — |
| [sprint-and-backlog-management.md](prd/capabilities/sprint-and-backlog-management.md) | F10 Sprint & Backlog Management | 20 | **none** | [sprint-and-backlog-management.md](architecture/decisions/sprint-and-backlog-management.md) |
| [project-knowledge-and-repository-layout.md](prd/capabilities/project-knowledge-and-repository-layout.md) | F11 Project Knowledge & Context · F12 Multi-Repository Layout | 22 | NFR22–25, 34–37 | [project-knowledge-and-repository-layout.md](architecture/decisions/project-knowledge-and-repository-layout.md) |
| [agent-activity-dashboard.md](prd/capabilities/agent-activity-dashboard.md) | F13 Agent Activity Dashboard | 7 | NFR26–28 | — |
| [knowledge-graph-and-atlas.md](prd/capabilities/knowledge-graph-and-atlas.md) | F17 Knowledge Graph + Knowledge Atlas | 37 | NFR38–41, 60–69 | [knowledge-graph-and-atlas.md](architecture/decisions/knowledge-graph-and-atlas.md) |
| [quality-assurance.md](prd/capabilities/quality-assurance.md) | F18 Software Quality Assurance (SQA) | 14 | NFR42–43 | [quality-assurance.md](architecture/decisions/quality-assurance.md) |
| [on-prem-and-local-llm.md](prd/capabilities/on-prem-and-local-llm.md) | F19 Local-LLM / On-Prem Agent Tuning | 10 | NFR44–49 | [on-prem-and-local-llm.md](architecture/decisions/on-prem-and-local-llm.md) |

### System-wide requirements

| File | Contents | FRs | NFRs |
|---|---|---|---|
| [general-functional-requirements.md](prd/general-functional-requirements.md) | Skill Authoring & Governance · Audit & Traceability — the two FR sections the PRD never declared as capability areas | 7 | — |
| [general-quality-attributes.md](prd/general-quality-attributes.md) | Security & Data Protection · Integration Reliability · Portability & Compatibility · Maintainability | — | 15 |

### System context

| File | Contents |
|---|---|
| [vision-and-system-context.md](prd/vision-and-system-context.md) | Executive Summary, System Overview (all 25 capability areas with status, Future Directions), Success Criteria |
| [user-journeys.md](prd/user-journeys.md) | 7 persona journeys + journey requirements summary |
| [domain-constraints-and-innovation.md](prd/domain-constraints-and-innovation.md) | Compliance & standards, technical constraints, integration requirements, risk mitigations, innovation patterns, developer-tool requirements |
| [changelog.md](prd/changelog.md) | 28-entry revision history, evicted from the front matter |

## Finding a requirement by ID

FR and NFR IDs are **not** ordered by capability — they were assigned chronologically as
capabilities were added, so a number tells you nothing about where it lives. These spans are
exact and machine-derived from the shard contents (no approximation, no "partial" ranges):

| FR IDs | Capability file | Count |
|---|---|---|
| FR1–FR7, FR34–FR38, FR44–FR47, FR51–FR55, FR73, FR204–FR206 | [skills-platform](prd/capabilities/skills-platform.md) | 25 |
| FR8–FR12, FR74–FR76, FR104–FR106, FR123–FR127 | [bmad-integration-and-bundling](prd/capabilities/bmad-integration-and-bundling.md) | 16 |
| FR94–FR103, FR107–FR110, FR182–FR198, FR207–FR214, FR235–FR247 | [bmad-platform-currency](prd/capabilities/bmad-platform-currency.md) | 52 |
| FR13–FR33, FR60–FR64, FR72 | [methodology-and-sdlc-workflows](prd/capabilities/methodology-and-sdlc-workflows.md) | 27 |
| FR35, FR42, FR56–FR57, FR199–FR203 | [agent-personas-and-ide-targets](prd/capabilities/agent-personas-and-ide-targets.md) | 9 |
| FR65–FR71, FR128–FR140 | [sprint-and-backlog-management](prd/capabilities/sprint-and-backlog-management.md) | 20 |
| FR58–FR59, FR79–FR86, FR111–FR122 | [project-knowledge-and-repository-layout](prd/capabilities/project-knowledge-and-repository-layout.md) | 22 |
| FR87–FR93 | [agent-activity-dashboard](prd/capabilities/agent-activity-dashboard.md) | 7 |
| FR141–FR157, FR215–FR234 | [knowledge-graph-and-atlas](prd/capabilities/knowledge-graph-and-atlas.md) | 37 |
| FR158–FR171 | [quality-assurance](prd/capabilities/quality-assurance.md) | 14 |
| FR172–FR181 | [on-prem-and-local-llm](prd/capabilities/on-prem-and-local-llm.md) | 10 |
| FR39–FR41, FR43, FR48–FR50 | [general-functional-requirements](prd/general-functional-requirements.md) | 7 |

| NFR span | File |
|---|---|
| NFR1–NFR15 | general-quality-attributes |
| NFR16–NFR21 | bmad-integration-and-bundling |
| NFR22–NFR25, NFR34–NFR37 | project-knowledge-and-repository-layout |
| NFR26–NFR28 | agent-activity-dashboard |
| NFR29–NFR33, NFR50–NFR59, NFR70–NFR75 | bmad-platform-currency |
| NFR38–NFR41, NFR60–NFR69 | knowledge-graph-and-atlas |
| NFR42–NFR43 | quality-assurance |
| NFR44–NFR49 | on-prem-and-local-llm |

## Related documents

- [architecture.md](architecture.md) — architecture index + decision register (P2-1 … P5-8)
- [epics.md](epics.md) — epics and stories
- [../implementation-artifacts/sprint-status.yaml](../implementation-artifacts/sprint-status.yaml) — delivery status; the authority on what actually shipped

## What the decomposition changed

Content is verbatim and every FR/NFR ID was preserved exactly once (246 FRs, 75 NFRs — the
pre-split counts). Only these organisational changes were made:

1. **The FR/NFR silo split was dissolved.** The two top-level `## Functional Requirements` and
   `## Non-Functional Requirements` headings are gone; their sections now sit with the
   capability they constrain, functional and non-functional side by side.
2. **The six BMAD version threads became one capability.** F5, F20, F21, F23, F24 and F25 were
   six co-equal capability areas, but the project supports exactly one bmad-method version at a
   time — each thread superseded the last. They are now one *platform currency* capability
   ordered **newest first**, so the current state (v6.10.0) is at the top and the history
   follows.
3. **FR204–FR206 moved to skills-platform.** They sat inside the Local-LLM / On-Prem section
   between FR176 and FR177, but their own subsection is titled "Git Workflow Guardrails (all
   profiles)" and Architecture Decision P5-4 governs them. Text and IDs unchanged.
4. **Revision history evicted from the front matter** to [changelog.md](prd/changelog.md).

## Known issues surfaced by the decomposition

Recorded, deliberately **not** fixed — no requirement text or ID was altered.

1. **FR35 is defined twice, with divergent text.** Both the *Skill Management & Portability*
   and *Specialized Agent Personas* sections define an FR35; the second adds SQA to the agent
   list, the first does not. This pre-dates the decomposition (the two definitions were 126
   lines apart in the single-file PRD), but the split makes it more dangerous: the copies now
   live in
   [skills-platform.md](prd/capabilities/skills-platform.md) and
   [agent-personas-and-ide-targets.md](prd/capabilities/agent-personas-and-ide-targets.md),
   so a reader of one will not see the other. One of them needs a new ID.
2. **FR77 and FR78 are never defined.** The sequence skips them with no recorded reason, so
   FR247 as high-water mark overstates the count by two.
3. **F10 Sprint & Backlog Management has 20 FRs and zero NFRs.** Its NFR section exists but
   defines no quality attributes at all — no performance, reliability or scale constraint on
   the sprint model.
4. **Capability statuses lag delivery.** F23 (v6.8.0), F24 (v6.9.0) and F25 (v6.10.0) are
   marked *Planned*, yet Epics 27, 28 and 30 shipped them in v3.13.0, v3.13.1 and v3.17.0.
   Treat [sprint-status.yaml](../implementation-artifacts/sprint-status.yaml) as the delivery
   authority.
5. **Supersession is prose-only.** Retirement is narrated ("supersedes FR208", "Superseded
   by …") with no machine-readable status field, so live and dead requirements cannot be
   separated without reading all 246. This bites hardest in
   [bmad-platform-currency.md](prd/capabilities/bmad-platform-currency.md), where most of the
   52 FRs describe versions no longer installed.
6. **Two FR sections were never declared as capability areas** — Skill Authoring & Governance
   (FR39–43) and Audit & Traceability (FR48–50). They are held in
   [general-functional-requirements.md](prd/general-functional-requirements.md) pending a
   decision on whether they are real capabilities.
7. **Five capability areas have no architecture decision** — F7 (MIL-STD-498), F8 (SDLC
   Workflows), F9 (Bug Management), F13 (Agent Activity Dashboard) and F16 (Methodology
   Onboarding) are covered by no P#-# decision. That is 34 FRs with no recorded design, which
   is why `methodology-and-sdlc-workflows` and `agent-activity-dashboard` have no matching
   architecture file.
