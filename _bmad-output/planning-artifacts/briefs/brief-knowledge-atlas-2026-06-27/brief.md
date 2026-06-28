---
title: "Product Brief: BMAD Knowledge Atlas"
status: ready
created: 2026-06-27
updated: 2026-06-27
---

# Product Brief: BMAD Knowledge Atlas

## Executive Summary

BMAD produces a rich trail of project knowledge — product briefs, PRDs, architecture decisions, epics, stories, bugs, sprint status, retrospectives — but it lives as a pile of loosely-coupled markdown files. The *connections* between those documents (an FR implemented by a story, a story blocked by another, a bug addressed in a retro, an architecture decision that justifies an epic) are the most valuable part of the knowledge and the first thing lost. Today you cannot click from `FR-012` to where it is defined, or ask "which FRs have no implementing story?"

**Knowledge Atlas** is a reusable ma-agents capability that turns any BMAD project's `_bmad-output` into an interconnected, visual, navigable knowledge site — generated **offline**, shipped **inside ma-agents**, and opened **on demand** while you work. It auto-links every BMAD entity (`FR###`, `NFR##`, `Epic N`, `Story N.M`, `bug-*`, `P#-#`) across all documents, computes backlinks, renders a typed knowledge graph you can travel, and surfaces gaps (orphaned FRs, storyless requirements). It is the **visualization and cross-linking tier of the planned F17 / Epic 19 Knowledge Graph** — producing and rendering that graph rather than competing with it.

Why now: BMAD adoption has reached the point where the volume of artifacts outpaces anyone's ability to hold the connections in their head, and the F17 graph backbone is already on the roadmap, ready for a visualization layer to make it usable by humans.

## The Problem

As a BMAD project matures, its knowledge fragments:

- **No traceability.** A reviewer reading a retro that mentions "Story 27.3" must manually hunt the file. An FR in the PRD gives no hint which story implements it or whether a bug touches it. The FR→Epic→Story→Bug→Retro spine exists only in people's memory.
- **Onboarding is archaeology.** A new engineer dropped onto Epic 7 has to open a dozen files in sequence and reconstruct how they relate. There is no "show me everything about this epic, then let me walk outward."
- **Gaps are invisible.** An FR with no implementing story, a story with no FR, a bug with no root-cause link — these silently exist. Nothing surfaces them.
- **Diagrams are absent.** BMAD artifacts are narrative + code; there is little visual representation of structure, status, or flow.
- **The cost compounds.** Every fragmented lookup is friction; multiplied across reviewers, PMs, and the agents themselves, it slows every planning and review cycle and lets quality gaps hide.

Existing tooling does not close the gap: `bmad-index-docs` produces a flat link list with no cross-linking or graph, and the F17 graph backbone has no human-facing visualization yet.

## The Solution

A single command — `/bmad-knowledge` — that **scans** the project's `_bmad-output`, builds a **knowledge manifest**, and **generates and opens** a self-contained static site:

- **Everything cross-linked.** Every entity token (`FR-012`, `Story 7.3`, `bug-...`, `P5-5`) becomes a hyperlink to its canonical location, anywhere it appears. Each entity shows its **backlinks** ("referenced by").
- **A graph you travel.** An interactive, typed force-directed graph is the home view — nodes shaped/colored by type (FR, NFR, Epic, Story, Bug, Arch Decision, Retro), edges typed (implements, blocks, refines, addressed-by, validated-by). Zoom from whole-project to one entity's neighborhood; click to navigate.
- **Readable documents.** Smooth-scrolling reading views with status badges and rendered Mermaid diagrams.
- **Generated diagrams.** Where none are authored, the Atlas draws them: the traceability spine, epic→story trees, the sprint/status board.
- **Gaps surfaced.** An orphan/gap view lists requirements with no story, stories with no requirement, bugs with no root cause.
- **Offline search** across all knowledge.

It is **scan-first**: a scan is authoritative, so it works on existing brownfield knowledge, survives version upgrades, and catches out-of-band edits. The **manifest** is the keystone — a per-file record (content hash, type, entities, edges) that (1) drives incremental rebuilds via content-hash diff, (2) serves as the contract between model-assisted discovery and the deterministic renderer, and (3) is a superset of F17's `knowledge-graph.json`.

## What Makes This Different

- **Connections are the product, not a feature.** Unlike a docs site or wiki, the Atlas makes the *relationships* first-class — traceability and gap-detection, not just prettier pages.
- **Scan-first robustness.** Correctness never depends on a hook firing. It indexes knowledge that predates the feature and changes made outside any skill — the failure mode of event-driven approaches.
- **Native to BMAD's vocabulary.** It understands the entity grammar BMAD already uses (`FR###`, `Epic N`, `Story N.M`, `P#-#`), so linking and the typed graph are BMAD-aware, not generic note-links.

Honest read: the moat is **fit + execution**, not a novel algorithm. Off-the-shelf tools (Quartz, Docusaurus, MkDocs) each fail at least one hard constraint — air-gapped generate-on-any-folder, BMAD-typed graph, or entity cross-linking. The differentiator is a purpose-built engine that satisfies all of them and ships inside the BMAD workflow.

## Who This Serves

- **Primary — humans onboarding & reviewing.** New engineers building a mental model fast; PMs/leads doing health checks ("which FRs are unimplemented? what did the last retro flag?"); reviewers tracing a change to its requirements. They need browsing, traceability, gap-spotting, and status-at-a-glance.
- **Secondary — the BMAD agents themselves** `[ASSUMPTION]`. The manifest/graph doubles as a structured context source a future skill can query ("everything linked to FR-012"). Not optimized for in v1, but the data model is built to allow it later.
- **Tertiary — ma-agents maintainers.** A reusable capability that strengthens the platform's planning/review story across every consuming project.

## Success Criteria

- **Time-to-find-a-connection.** From any FR/story/bug, reach its related entities in ≤1–2 clicks; measurable drop in onboarding-to-context time `[ASSUMPTION: target to be set]`.
- **Traceability coverage.** High % of entities correctly cross-linked; orphans surfaced and countable, trending down as projects use the gap view.
- **Adoption.** `/bmad-knowledge` is run regularly per active project; teams keep the site open during work.
- _(Tracked as a hard constraint rather than a headline metric: 100% air-gapped generation success; full build in seconds; incremental re-run cost scales with change, not project size.)_

## Scope

**In (v1 — deterministic core):**
- `/bmad-knowledge` skill: scan `_bmad-output` → build manifest → generate + open self-contained static site.
- Deterministic entity extraction + auto cross-linking + backlinks.
- Typed interactive graph view; document reading views with rendered Mermaid; offline search.
- Generated diagrams (traceability spine, epic→story tree, sprint/status board).
- Orphan/gap detection view.
- Manifest with content-hash diff for incremental re-runs.
- Pre-bundled, fully offline engine shipped with ma-agents.

**Out (deferred to later releases):**
- Model-assisted discovery/enrichment (brownfield classification, prose-level relationships, AI summaries) — manifest is built to absorb it later.
- Auto-refresh BMAD skill hooks (optional sugar; scan remains authoritative).
- Confluence target mode.
- Timeline/sprint-axis view and "what changed since last sprint" diff.
- Agent-facing query API over the manifest.

## Relationship to F17 / Epic 19

Knowledge Atlas is positioned as the **visualization tier of F17 (BMAD Knowledge Graph)**, extending Epic 19. It converges on the `knowledge-graph.json` node identity (`file-id#anchor`): when that file is present, the Atlas consumes it; when it is not (today, pre-Epic-19 completion), the Atlas's scan produces an equivalent manifest. This keeps one graph model in ma-agents and lets the two efforts reinforce each other. `[ASSUMPTION: exact merge sequencing with in-flight Epic 19 stories 19-1…19-4 to be settled in the PRD/architecture step.]`

## Vision

Knowledge becomes something you *travel*, not excavate. Every BMAD project ships with a living atlas of itself: open it and the whole project is one connected, visual, queryable map — requirements wired to the stories that fulfill them, bugs to the retros that learned from them, decisions to the epics they shaped. Over 2–3 years it grows from a human reading layer into the shared knowledge substrate that both people and agents navigate — the canonical way to *see* a BMAD project, online or air-gapped, at any moment of the work.
