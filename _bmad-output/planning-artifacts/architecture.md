---
stepsCompleted: ['step-01-init', 'step-02-context', 'step-03-starter', 'step-04-decisions', 'step-05-patterns', 'step-06-structure', 'step-07-validation', 'step-08-complete']
phase2StepsCompleted: ['step-02-context', 'step-04-decisions', 'step-05-patterns', 'step-06-structure', 'step-07-validation', 'step-08-complete']
phase2CompletedAt: '2026-03-11'
phase2cStepsCompleted: ['step-02-context', 'step-04-decisions', 'step-06-structure', 'step-07-validation', 'step-08-complete']
phase2cCompletedAt: '2026-03-26'
editHistoryLocation: 'architecture/changelog.md'
inputDocuments: ['_bmad-output/planning-artifacts/prd.md', 'docs/index.md', 'docs/project-overview.md', 'docs/architecture.md', 'docs/source-tree-analysis.md', 'docs/development-guide.md', 'README.md']
workflowType: 'architecture'
status: 'complete'
completedAt: '2026-03-07'
project_name: 'agents'
user_name: 'Alon'
date: '2026-03-05'
lastEdited: '2026-11-07'
---

# Architecture Decision Document

_This document builds collaboratively through step-by-step discovery. Sections are appended as we work through each architectural decision together._

> **This is the architecture index.** The document was decomposed on 2026-07-31 (it was a
> single 223 KB / 2,625-line file). Content is verbatim; this file carries the front matter and
> the decision register.
>
> **Decisions are grouped by the capability they constrain, not by the phase they were made
> in.** Each file in `architecture/decisions/` shares its filename with the matching PRD
> capability file, so working on capability *X* means reading `prd/capabilities/X.md` and
> `architecture/decisions/X.md`.
>
> **Before the split, the decision log could not be found by scanning headings.** P3-1 … P5-1
> were filed under an H2 called *Architecture Validation Results*, and P5-2 … P5-8 were nested
> inside an H2 titled *"P5-1 Addendum: .agents/skills Cross-Tool Standard Assessment (Story
> 24.11)"*. An agent looking for architectural decisions found the Phase 2 set and stopped.

**Totals:** 25 numbered decisions (P2-1 … P5-11) plus 4 unnumbered Phase 1 decisions.
**Next free decision ID: P5-12.**

---

## Decision register

| ID | Decision | Requirements | Notes | File |
|---|---|---|---|---|
| P5-11 | BMAD v7 target — bmod modules, Sofia-native Jira, Confluence via handoff slots, Skills-CLI offline installer | FR271 (am.), FR280–FR294, NFR84 (am.), NFR86; FR268–FR270/FR274 amended; FR272/FR273/FR275/FR276 superseded; NFR85 superseded; NFR74 amended | 2026-11-07 · **F27 + F28 (current)** · supersedes P5-10 and the P2-11 amendment; target BMAD v7 @ pinned SHA, GA re-gate · Epics 36–39 | [bmad-integration-and-bundling](architecture/decisions/bmad-integration-and-bundling.md) |
| P5-10 | Extension decomposition, overlay mechanism & thin offline installer — latest-only bmad-method | FR268–FR278, NFR84–NFR85; FR236 superseded; FR213/NFR74 inverted; FR239–FR243 retired | **SUPERSEDED 2026-11-07 by P5-11** (never implemented; Epics 32–35 cancelled) · 2026-10-31 · **F27 + F28** · supersedes P2-3/P2-9 (single module), P4-1 (single plugin), P5-6(c) (uv boundary); amends P2-6, P2-11, P5-9 · Epics 32–35 | [bmad-integration-and-bundling](architecture/decisions/bmad-integration-and-bundling.md) |
| P5-9 | Federated knowledge stores, binding authority & global install scope | FR248–FR265, FR267, NFR76–NFR83 | 2026-08-02 · supersedes FR111/FR117 · retires FR266 · **F26** | [project-knowledge-and-repository-layout](architecture/decisions/project-knowledge-and-repository-layout.md) |
| P5-8 | BMAD v6.10.0 — bundle filter, custom marketplace source, Demerzel deprecation | FR235–FR247, NFR70–NFR75 | 2026-07-09 · **current version** · retains the P5-5 reader | [bmad-platform-currency](architecture/decisions/bmad-platform-currency.md) |
| P5-7 | BMAD Knowledge Atlas — static knowledge-site visualization tier | FR215–FR234, NFR60–NFR69 | 2026-06-28 · extends P3-1 | [knowledge-graph-and-atlas](architecture/decisions/knowledge-graph-and-atlas.md) |
| P5-6 | BMAD v6.9.0 — pin bump (no reader change) + installer-output resilience | FR211–FR214, NFR58–NFR59 | 2026-06-27 | [bmad-platform-currency](architecture/decisions/bmad-platform-currency.md) |
| P5-5 | Module-registry reader rework for BMAD v6.8.0 | FR207–FR210, NFR56–NFR57 | 2026-06-08 | [bmad-platform-currency](architecture/decisions/bmad-platform-currency.md) |
| P5-4 | Inline git workflow guardrails in the universal per-tool instruction block | FR204–FR206 | 2026-05-24 | [skills-platform](architecture/decisions/skills-platform.md) |
| P5-3 | Cline workflow generation | FR199–FR203 *(inferred — this decision's heading states no range)* | | [agent-personas-and-ide-targets](architecture/decisions/agent-personas-and-ide-targets.md) |
| P5-2 | BMAD v6.6.0 integration | FR196–FR198, NFR55 | | [bmad-platform-currency](architecture/decisions/bmad-platform-currency.md) |
| P5-1 | BMAD v6.5.0 integration | FR199–FR210, NFR55–NFR58 | Carries two addenda (persistent_facts spike; `.agents/skills/` assessment) | [bmad-platform-currency](architecture/decisions/bmad-platform-currency.md) |
| P4-1 | BMAD v6.3.0 plugin migration | FR182–FR195, NFR50–NFR54 | | [bmad-platform-currency](architecture/decisions/bmad-platform-currency.md) |
| P3-3 | Local-LLM / on-prem agent tuning profile | FR172–FR179, NFR44–NFR47 | 2026-04-13 | [on-prem-and-local-llm](architecture/decisions/on-prem-and-local-llm.md) |
| P3-2 | Software Quality Assurance (SQA) agent — Gadi | FR158–FR171, NFR42–NFR43 | 2026-04-08 | [quality-assurance](architecture/decisions/quality-assurance.md) |
| P3-1 | BMAD knowledge graph | FR141–FR157, NFR38–NFR41 | 2026-04-07 · extended by P5-7 | [knowledge-graph-and-atlas](architecture/decisions/knowledge-graph-and-atlas.md) |
| P2-11 | Unified sprint-status file architecture | — | 2026-04-03, revised 2026-04-29 (Jira backend) · companion specs [sprint-status-schema.md](sprint-status-schema.md), [mcp-detection-pattern-spec.md](mcp-detection-pattern-spec.md) | [sprint-and-backlog-management](architecture/decisions/sprint-and-backlog-management.md) |
| P2-10 | Multi-repository project layout | FR111–FR122, NFR34–NFR37 | | [project-knowledge-and-repository-layout](architecture/decisions/project-knowledge-and-repository-layout.md) |
| P2-9 | BMAD 6.2.0 agent architecture migration | FR94–FR110, NFR29–NFR33 | Supersedes P2-3 | [bmad-platform-currency](architecture/decisions/bmad-platform-currency.md) |
| P2-8 | *does not exist* | — | Numbering gap, no recorded reason | — |
| P2-7 | Project context auto-generation | FR79–FR86, NFR22–NFR25 | Contains the project-context.md template as a fenced block — see the warning below | [project-knowledge-and-repository-layout](architecture/decisions/project-knowledge-and-repository-layout.md) |
| P2-6 | Bundled BMAD installation with explicit parameter passing | FR74–FR76, FR123–FR127, NFR20–NFR21 | | [bmad-integration-and-bundling](architecture/decisions/bmad-integration-and-bundling.md) |
| P2-5 | Pre-built extension workflows | FR61, FR68–FR70 | | [sprint-and-backlog-management](architecture/decisions/sprint-and-backlog-management.md) |
| P2-4 | `critical_actions` for all BMAD agents | FR52–FR53 | | [skills-platform](architecture/decisions/skills-platform.md) |
| P2-3 | BMAD extension module structure | FR52, NFR16–NFR17 | **Superseded by P2-9** | [bmad-integration-and-bundling](architecture/decisions/bmad-integration-and-bundling.md) |
| P2-2 | OpenCode JSON injection | FR56–FR57 | | [agent-personas-and-ide-targets](architecture/decisions/agent-personas-and-ide-targets.md) |
| P2-1 | Instruction injection priority | FR51 | | [skills-platform](architecture/decisions/skills-platform.md) |
| — | Data architecture | — | Phase 1, never assigned an ID | [system-architecture](architecture/system-architecture.md) |
| — | Extensibility model | — | Phase 1, never assigned an ID | [system-architecture](architecture/system-architecture.md) |
| — | Pipeline architecture | — | Phase 1, never assigned an ID | [system-architecture](architecture/system-architecture.md) |
| — | Infrastructure & deployment | — | Phase 1, never assigned an ID | [system-architecture](architecture/system-architecture.md) |

## System-level architecture

| File | Contents |
|---|---|
| [system-architecture.md](architecture/system-architecture.md) | Project context analysis, requirements overview, technical constraints, cross-cutting concerns, established technology foundation, the four unnumbered Phase 1 decisions, decision priority and impact analysis |
| [implementation-patterns.md](architecture/implementation-patterns.md) | **Read before writing code.** Naming, structure, format, process and enforcement patterns; critical conflict points; injection-strategy, extension-authoring, workflow, gitignore and auto-bug-detection patterns |
| [structure-and-boundaries.md](architecture/structure-and-boundaries.md) | Complete directory structure, architectural boundaries, requirements-to-structure mapping, integration points |
| [validation-and-readiness.md](architecture/validation-and-readiness.md) | Coherence validation, requirements coverage, implementation readiness, gap analysis, completeness checklist, readiness assessment |
| [changelog.md](architecture/changelog.md) | phase2b/3/4/5 revision history, evicted from the front matter |

## Warning for automated readers

`architecture/decisions/project-knowledge-and-repository-layout.md` contains Decision P2-7,
whose body includes a ```markdown fenced block showing the **generated `project-context.md`
template**. Inside that fence are lines that look like document structure but are not:

```
# Project Context
## AI Agent Mandatory Rules
## Technology Stack
## Project-Specific Rules
```

Decision P2-10 similarly contains a fenced `### Repository Layout`. A fence-blind heading scan
(`grep '^## '`) will report these as sections of the architecture document — they are template
content. **Parse markdown fence-aware.** The pre-split document contained 10 such
heading-lookalikes inside its 46 fenced blocks (92 fence delimiter lines).

## What the decomposition changed

Content is verbatim; every line of the pre-split document is accounted for. Only these
organisational changes were made:

1. **Decisions regrouped from phase to capability.** The `### Phase 2 / Phase 4 / Phase 5
   Architectural Decisions` grouping headings were dropped; each decision now sits in the file
   for the capability it constrains. Phase and date are preserved in the register above and in
   each decision's own heading.
2. **P5-2 … P5-8 un-nested** from the `## P5-1 Addendum: .agents/skills` H2 they were children
   of. The two addenda now sit under P5-1 as H4 subsections, where their titles say they belong.
3. **The Phase 3/4/5 decision log moved out of `## Architecture Validation Results`**, which
   now covers validation content only.
4. **Decision heading levels normalised** to `### Decision P#-#` throughout — they were split
   between H3 (P3-*, P5-2…P5-8) and H4 (P2-*, P4-1, P5-1).
5. **Revision history evicted from the front matter** to [changelog.md](architecture/changelog.md).

## Known issues surfaced by the decomposition

1. **Four Phase 1 decisions have no IDs** — data architecture, extensibility model, pipeline
   architecture, infrastructure & deployment. Nothing downstream can cite them the way it cites
   P2-1 or P5-8.
2. **P2-8 does not exist.** The sequence runs P2-7 → P2-9 with no recorded reason.
3. **Five capability areas have no architecture decision at all** — F7 (MIL-STD-498), F8 (SDLC
   Workflows), F9 (Bug Management), F13 (Agent Activity Dashboard), F16 (Methodology
   Onboarding). 34 FRs with no recorded design; `methodology-and-sdlc-workflows` and
   `agent-activity-dashboard` therefore have no matching decisions file.
4. **P5-1 claims FR199–FR210 and NFR55–NFR58**, overlapping P5-2 (FR196–FR198, NFR55), P5-3
   (FR199–FR203) and P5-5 (FR207–FR210). The v6.5.0 decision was written as a range that later
   decisions then subdivided; the register above lists them as written.

## Related documents

- [prd.md](prd.md) — PRD index + capability register
- [epics.md](epics.md) — epics and stories
- [../implementation-artifacts/sprint-status.yaml](../implementation-artifacts/sprint-status.yaml) — delivery status
