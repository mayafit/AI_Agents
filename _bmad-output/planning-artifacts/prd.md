---
stepsCompleted: ['step-01-init', 'step-02-discovery', 'step-02b-vision', 'step-02c-executive-summary', 'step-03-success', 'step-04-journeys', 'step-05-domain', 'step-06-innovation', 'step-07-project-type', 'step-08-scoping', 'step-09-functional', 'step-10-nonfunctional', 'step-11-polish', 'step-12-complete', 'step-e-01-discovery', 'step-e-02-review', 'step-e-03-edit', 'step-e-01-discovery', 'step-e-02-review', 'step-e-03-edit-2026-03-24', 'step-e-01-discovery', 'step-e-02-review', 'step-e-03-edit-2026-03-25', 'step-e-01-discovery', 'step-e-02-review', 'step-e-03-edit-2026-04-07', 'step-e-01-discovery', 'step-e-02-review', 'step-e-03-edit-2026-04-08', 'step-e-01-discovery', 'step-e-02-review', 'step-e-03-edit-2026-05-01', 'step-e-01-discovery', 'step-e-02-review', 'step-e-03-edit-2026-05-01b']
workflowStatus: 'complete'
completedDate: '2026-03-05'
lastEdited: '2026-11-07'
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
**Date:** 2026-03-05 | **Last Edited:** 2026-11-07

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

**Totals** (recomputed by script from the shard contents 2026-11-07, fence-aware): **301 FR definition
lines** covering **300 distinct FR IDs** — FR35 is defined twice (Known Issues #1), so definitions
exceed distinct IDs by one. Of those 300 distinct IDs, **299 are live and 1 is retired** (FR266,
retired at P5-9 before implementation, ID never reused); "live" counts superseded IDs kept as
history, as before. High-water mark **FR302**; FR77 and FR78
were never defined (Known Issues #2), so the high-water mark overstates the ID count by two.
**87 NFR definitions covering 87 distinct NFR IDs**, no duplicates and no gaps, high-water mark
**NFR87**. 12 capability files covering the PRD's 29 declared capability areas. Every ID except
FR35 appears in exactly one file.

**F27 — BMAD v6.12.4 Integration (latest-only)** lives in
[bmad-platform-currency](prd/capabilities/bmad-platform-currency.md) (FR275–FR279) and **F28 —
Extension Decomposition & Thin Installer** in
[bmad-integration-and-bundling](prd/capabilities/bmad-integration-and-bundling.md) (FR268–FR274,
NFR85). Both files specify the ma-agents 3.x line, which installs bmad-method 6.10.0 (FR271) and
does not implement FR268–FR279 apart from FR271.

**F29 — ma-agents 4.x on BMAD v7** lives in
[ma-agents-v7-line](prd/capabilities/ma-agents-v7-line.md) (FR280–FR302, NFR84, NFR86, NFR87). It
states the two product lines, and specifies ma-agents 4.x as four BMAD v7 modules in one repository,
`ma-bmad-extensions` — `ma-ops` (agents, ops workflows, MIL-STD-498, `ma-ops-dev-epic`),
`ma-standards` (coding standards, review, git workflow, `ma-standards-apply`), `ma-knowledge`
(Knowledge Atlas) and `ma-atlassian` (Jira ticket store and Confluence overlay) — plus a thin
offline installer, the npm package `ma-agents` 4.x, that installs a pinned BMAD v7 commit and the
selected modules from a self-contained bundle.

F29 holds the package map skill by skill, the installer's commands, wizard, flags, install
sequence, bundle, uninstall and upgrade from 3.x, the Atlassian bind target table and Jira
type/status maps, the qualification gate that governs the on-prem release, and the CI gates
(NFR84), version line (NFR86) and 3.x upgrade test (NFR87). Architecture: P5-11.

**F26 — Global Installation & Federated Knowledge Stores** spans two capability files: the install-scope thread lives in
[bmad-integration-and-bundling](prd/capabilities/bmad-integration-and-bundling.md)
(FR248–FR253, NFR76–NFR78) and the knowledge-store / Confluence thread in
[project-knowledge-and-repository-layout](prd/capabilities/project-knowledge-and-repository-layout.md)
(FR254–FR267, NFR79–NFR83). It supersedes FR111 and FR117.

---

## F26 — thesis, glossary and open items

F26 spans two capability files, so its scope story lives here.

**Thesis.** *Where a project's knowledge lives is a property of the project, not of the machine
it was installed on and not of the install scope.* Every F26 requirement follows from that: the
bindings become committed rather than per-machine (FR263), the per-machine config becomes a
generated artifact (FR264), a globally installed skill resolves knowledge from the project root
alone (NFR83), and install scope stops dictating knowledge location (FR251, FR252).

**Glossary.** F26 introduces five terms; *store* and *backend* are overloaded words elsewhere in
software, so they are pinned here.

| Term | Definition |
|---|---|
| **store** | A named, independently located collection of planning artifacts. F26 defines exactly two: system requirements and software requirements. A store is not a repository and not a directory — it is a binding of a set of artifacts to a location and a backend |
| **system requirements store** | The store holding what the system must do independently of how it is built: product brief and PRD (FR255) |
| **software requirements store** | The store holding how the system is built: architecture, UX designs, epics (FR256) |
| **backend** | The mechanism through which a store's artifacts are read and written — `file-system` or `confluence` (FR257). Each store chooses its own |
| **binding** | The recorded association of one store to its backend and location, persisted in `_bmad-output/project-layout.yaml` (FR263) |
| **project-bind step** | The per-project operation that collects project-scoped answers and writes the bindings, for use when ma-agents was installed globally (FR252) |

**Assumptions.** Inferred during the update, not directly confirmed:

- `[ASSUMPTION]` The sprint-management question (FR112) stays a **third, separate** question and
  is not folded into either store. F26 was described as splitting *knowledge*; sprint state is
  tracked separately today and is left that way.
- ~~`[ASSUMPTION]` `implementation_artifacts` is not a third store~~ — **RESOLVED 2026-08-01**:
  confirmed by decision, now stated as FR267. Story files follow `sprint_management_path`, not
  either knowledge store, because a story is sprint execution state rather than a requirement.
- `[ASSUMPTION]` One Confluence space per store is sufficient; a store does not need to span
  spaces.
- `[ASSUMPTION]` The two stores are the right cut. If a project wants brief and PRD in different
  places, F26 does not support that.

**Non-goals for F26.** Excluded deliberately, so downstream work does not assume them:

- `[NON-GOAL]` Any local mirror or cache of a Confluence-backed store, and therefore any sync or
  conflict resolution. Settled at P5-9: an unreachable Confluence host is a misconfiguration, not
  a working mode, so FR262 fails loud and FR266 was retired before implementation
- `[NON-GOAL]` Per-artifact Confluence page templates or enforced page hierarchy beyond the root
  page of FR260
- `[NON-GOAL]` Migrating existing projects automatically. FR265 offers migration; it never
  performs it unprompted
- `[NON-GOAL]` A store spanning multiple Confluence spaces, or more than two stores
- `[NON-GOAL]` Any backend other than `file-system` and `confluence` (no SharePoint, Notion, Git
  wiki)

**Open items.** Four raised, two closed; the remaining two are carried by P5-9 and neither blocks epic creation:

1. ~~Where do `implementation_artifacts` (story files) live?~~ **CLOSED 2026-08-01** — they
   follow `sprint_management_path`, per FR267. Consistent with existing FR120. The binding schema
   therefore stays at two stores plus a sprint-management location
2. **`[NOTE FOR PM]` FR250 spike outcome** gates how much of the global-install thread is
   deliverable. If bmad-method v6.10.0 cannot install user-level, FR249 shrinks to its
   degradation path
3. ~~Mirror synchronisation semantics (FR266)~~ **CLOSED at P5-9 2026-08-01** — moot. The
   mirror was retired once its air-gap justification was examined: air-gapped means no internet,
   not no network, and an intra-perimeter Confluence is reachable. FR262 fails loud instead
4. **`[NOTE FOR PM]` Confluence page structure** — which artifact becomes which child page under
   the root page. Deferred to P5-9

## Capability register

| Capability file | PRD capability areas | FRs | NFRs | Architecture |
|---|---|---|---|---|
| [skills-platform.md](prd/capabilities/skills-platform.md) | F1 Skill Management & Portability · F2 Skill Enforcement · F15 Developer Infrastructure | 25 | — | [skills-platform.md](architecture/decisions/skills-platform.md) |
| [bmad-integration-and-bundling.md](prd/capabilities/bmad-integration-and-bundling.md) | F3 BMAD-METHOD Integration (+ Bundled Install) · F4 BMAD Extension Architecture · **F26** (install scope) · **F28** Extension Decomposition & Thin Installer | 29 | NFR16–21, 76–78, 85 | [bmad-integration-and-bundling.md](architecture/decisions/bmad-integration-and-bundling.md) |
| [bmad-platform-currency.md](prd/capabilities/bmad-platform-currency.md) | F27 BMAD v6.12.4 · F25 v6.10.0 · F24 v6.9.0 · F23 v6.8.0 · F21 v6.6.0 · F20 6.3.0 · F5 6.2.0 | 57 | NFR29–33, 50–59, 70–75 | [bmad-platform-currency.md](architecture/decisions/bmad-platform-currency.md) |
| [ma-agents-v7-line.md](prd/capabilities/ma-agents-v7-line.md) | **F29** ma-agents 4.x on BMAD v7 | 23 | NFR84, 86–87 | [bmad-integration-and-bundling.md](architecture/decisions/bmad-integration-and-bundling.md) (P5-11) |
| [agent-personas-and-ide-targets.md](prd/capabilities/agent-personas-and-ide-targets.md) | F6 Specialized Agent Personas · F14 OpenCode Support · F22 Cline Workflow Generation | 9 | — | [agent-personas-and-ide-targets.md](architecture/decisions/agent-personas-and-ide-targets.md) |
| [methodology-and-sdlc-workflows.md](prd/capabilities/methodology-and-sdlc-workflows.md) | F7 MIL-STD-498 · F8 SDLC Workflows · F9 Bug Management · F16 Methodology Onboarding | 27 | — | — |
| [sprint-and-backlog-management.md](prd/capabilities/sprint-and-backlog-management.md) | F10 Sprint & Backlog Management | 20 | **none** | [sprint-and-backlog-management.md](architecture/decisions/sprint-and-backlog-management.md) |
| [project-knowledge-and-repository-layout.md](prd/capabilities/project-knowledge-and-repository-layout.md) | F11 Project Knowledge & Context · F12 Multi-Repository Layout · **F26** (knowledge stores, Confluence) | 36 | NFR22–25, 34–37, 79–83 | [project-knowledge-and-repository-layout.md](architecture/decisions/project-knowledge-and-repository-layout.md) |
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
| [vision-and-system-context.md](prd/vision-and-system-context.md) | Executive Summary, System Overview (capability areas with status, Future Directions), Success Criteria. *Its System Overview lists 26 areas; F27–F29 are not in it (29 declared). Open item: it needs text for F27–F29.* |
| [user-journeys.md](prd/user-journeys.md) | 7 persona journeys + journey requirements summary |
| [domain-constraints-and-innovation.md](prd/domain-constraints-and-innovation.md) | Compliance & standards, technical constraints, integration requirements, risk mitigations, innovation patterns, developer-tool requirements |
| [changelog.md](prd/changelog.md) | 31-entry revision history, evicted from the front matter |

## Finding a requirement by ID

FR and NFR IDs are **not** ordered by capability — they were assigned chronologically as
capabilities were added, so a number tells you nothing about where it lives. These spans are
exact and machine-derived from the shard contents (no approximation, no "partial" ranges):

| FR IDs | Capability file | Count |
|---|---|---|
| FR1–FR7, FR34–FR38, FR44–FR47, FR51–FR55, FR73, FR204–FR206 | [skills-platform](prd/capabilities/skills-platform.md) | 25 |
| FR8–FR12, FR74–FR76, FR104–FR106, FR123–FR127, FR248–FR253, FR268–FR274 | [bmad-integration-and-bundling](prd/capabilities/bmad-integration-and-bundling.md) | 29 |
| FR94–FR103, FR107–FR110, FR182–FR198, FR207–FR214, FR235–FR247, FR275–FR279 | [bmad-platform-currency](prd/capabilities/bmad-platform-currency.md) | 57 |
| FR280–FR302 | [ma-agents-v7-line](prd/capabilities/ma-agents-v7-line.md) | 23 |
| FR13–FR33, FR60–FR64, FR72 | [methodology-and-sdlc-workflows](prd/capabilities/methodology-and-sdlc-workflows.md) | 27 |
| FR35, FR42, FR56–FR57, FR199–FR203 | [agent-personas-and-ide-targets](prd/capabilities/agent-personas-and-ide-targets.md) | 9 |
| FR65–FR71, FR128–FR140 | [sprint-and-backlog-management](prd/capabilities/sprint-and-backlog-management.md) | 20 |
| FR58–FR59, FR79–FR86, FR111–FR122, FR254–FR267 | [project-knowledge-and-repository-layout](prd/capabilities/project-knowledge-and-repository-layout.md) | 36 |
| FR87–FR93 | [agent-activity-dashboard](prd/capabilities/agent-activity-dashboard.md) | 7 |
| FR141–FR157, FR215–FR234 | [knowledge-graph-and-atlas](prd/capabilities/knowledge-graph-and-atlas.md) | 37 |
| FR158–FR171 | [quality-assurance](prd/capabilities/quality-assurance.md) | 14 |
| FR172–FR181 | [on-prem-and-local-llm](prd/capabilities/on-prem-and-local-llm.md) | 10 |
| FR39–FR41, FR43, FR48–FR50 | [general-functional-requirements](prd/general-functional-requirements.md) | 7 |

| NFR span | File |
|---|---|
| NFR1–NFR15 | general-quality-attributes |
| NFR16–NFR21, NFR76–NFR78, NFR85 | bmad-integration-and-bundling |
| NFR84, NFR86–NFR87 | ma-agents-v7-line |
| NFR22–NFR25, NFR34–NFR37, NFR79–NFR83 | project-knowledge-and-repository-layout |
| NFR26–NFR28 | agent-activity-dashboard |
| NFR29–NFR33, NFR50–NFR59, NFR70–NFR75 | bmad-platform-currency |
| NFR38–NFR41, NFR60–NFR69 | knowledge-graph-and-atlas |
| NFR42–NFR43 | quality-assurance |
| NFR44–NFR49 | on-prem-and-local-llm |

## Related documents

- [architecture.md](architecture.md) — architecture index + decision register (P2-1 … P5-11; next free ID P5-12)
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
   ordered **newest first**. The installed version of the 3.x line is stated by FR271
   (bmad-method 6.10.0).
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
   FR267 as high-water mark overstates the distinct-ID count by two.
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
