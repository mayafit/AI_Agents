---
stepsCompleted: [1]
inputDocuments: []
session_topic: 'BMAD Knowledge Layer — a static, interconnected, visual knowledge-graph site generated over BMAD markdown/Confluence outputs'
session_goals: 'Brainstorm the feature; research BMAD structure + enabling tech; converge to FR/NFR + architecture + ma-agents embedding'
selected_approach: 'Progressive Flow (guided diverge -> converge), delivery form = static generated site'
techniques_used: []
ideas_generated: []
context_file: ''
---

# Brainstorming Session Results

**Facilitator:** Claude (BMAD Brainstorming)
**Participant:** Alon
**Date:** 2026-06-27

## Session Overview

**Topic:** A "Knowledge Layer" that sits *above* BMAD's md-based (or Confluence-based) artifacts — a single project knowledge home from which all documents (planning, implementation, sprint-status, retrospectives, bugs) are browsable with rich visual representation, smooth scrolling, rendered diagrams, and **bidirectional cross-linking by entity** (FR → PRD definition; retro → story/bug; epics ↔ stories ↔ bugs ↔ FR/NFR). The whole knowledge graph is traversable.

**Goals:**
1. Brainstorm the feature (diverge).
2. Research how BMAD structures knowledge today + candidate technologies.
3. Converge to functional + non-functional requirements, architecture, and how it embeds into ma-agents as a BMAD-respecting capability.

### Session Setup
- **Mode:** Guided diverge → converge (Progressive Flow).
- **Delivery form (decided):** Static generated site — self-contained, air-gap friendly, generated from existing outputs at "build" time.
- **Research:** Two background agents launched — (a) map BMAD on-disk knowledge structure & skill conventions; (b) survey static knowledge-graph site technologies.

---

## Research Findings (background agents)

### A. BMAD knowledge structure on disk (KEY: overlaps existing planned work)
- **Existing capability F17 "BMAD Knowledge Graph" → Epic 19.** Story 19.1 `emitToGraph()` (status ready-for-dev) defines a shared utility all skills emit to, producing `_bmad-output/knowledge-graph.json` (`meta/files/nodes/edges`). Plans reference `knowledge-graph.html` via an `/open-graph` skill; node identity = `file-id#anchor` (e.g. `prd.md#functional-requirements`). NOT generated yet at v3.13.1.
- **Folder layout:** `_bmad-output/planning-artifacts/{prd.md, epics.md, architecture.md, product-brief-*}`; `_bmad-output/implementation-artifacts/{sprint-status.yaml, NN-M-slug.md stories, bug-*.md, epic-N-retrospective.md, done/}`; `_bmad-output/project-context.md`.
- **Stable entity vocabulary (link targets):** `FR###`, `NFR##`, `F##` (capability area→Epic), `Epic ##`, `Story N.M` (+ `NN-M-slug.md`), `bug-<slug>`, `P#-#` (arch decision), `epic-N-retrospective.md`, statuses backlog→ready-for-dev→in-progress→review→done.
- **Cross-ref patterns already in prose:** "FR207, NFR56"; "Blocked by: Story 27.1"; "Architecture Decision P5-5"; "Added Epic 27, Story 27.1–27.7"; "shipped v3.13.0 (commit 090c6bd #115)".
- **Diagrams:** none currently authored (no Mermaid). → "diagrams visible" implies we should *auto-generate* graphs (traceability, epic→story trees, sprint state) rather than only render authored ones.
- **Skill conventions:** skill = folder with `SKILL.md` (name+description frontmatter), optional `workflow.md`+`steps/`, `scripts/`, `resources/`. Reference: `bmad-index-docs` generates a flat `index.md` (no cross-linking/graph) — the closest existing thing.

### B. Static knowledge-graph site technology survey
- **Primary recommendation: Quartz v5** (jackyzha0/quartz). Only off-the-shelf tool natively satisfying all hard reqs: self-contained static build, native wikilinks + **automatic backlinks**, built-in d3-force **graph view**, **bundled offline Mermaid**, FlexSearch. Killer feature: clean **remark/rehype transformer pipeline** — the `FR-012/Story 7.3/bug-x → canonical link` step is a ~30-line transformer (`mdast-util-find-and-replace`); because they become real links, backlinks ("what references this FR?") come free. Set `fontOrigin: selfHosted` for air-gap. Stack: Node ≥22.
- **Runner-up: pure custom generator** — markdown-it 14 (custom entity-linker rule) → emit graph as an **inlined JS var** (never `fetch()` — `file://` origin is null, CORS-blocked) → render with **force-graph 1.51** (MIT, ~56KB) + **mermaid 11.16** standalone → bundle with esbuild. Choose for full control over BMAD-specific node typing (epics/stories/bugs as distinct shapes/colors) and the traceability spine.
- **Rejected:** Hugo (no graph view; inline-text render hooks don't fire → can't auto-link FRs); MkDocs Material (maintenance mode; Mermaid via CDN by default = silent offline failure); Docusaurus (no native wikilinks/backlinks; community-only graph); Obsidian Publish (paid/hosted, not air-gappable); Foam (authoring only, no site); Backstage/TechDocs (full server+DB, "cannot function as static HTML").
- **Air-gap traps flagged:** vendor Mermaid locally; embed graph data as JS var not fetched JSON.

---

## SCOPE CORRECTION (decisive)

This is **NOT** documenting the current (ma-agents) project. It is a **new reusable ma-agents FEATURE**: a Knowledge Layer capability that, for **any** project using ma-agents + BMAD, generates & serves an interconnected visual knowledge site **over that project's BMAD outputs**, available **at any point during work**. Must be **embedded into ma-agents installation AND into BMAD skills** (so artifacts feed/refresh it as work proceeds).

### Locked decisions
- **Rendering:** Quartz v5 platform + one custom typed force-graph "traceability" view.
- **Primary user:** human onboarding & review (new engineers, PMs, stakeholders).
- **Delivery:** static, self-contained, air-gap-friendly site generated per project.

### Newly-central design axes (the real heart of the feature)
1. **Distribution / install:** the generator + its deps must ship with ma-agents and run in **air-gapped** installs (ma-agents' offline guarantee). → Quartz needs Node≥22 + npm toolchain; tension vs lighter vendored/custom generator. KEY TRADE-OFF.
2. **Freshness / hook model:** on-demand build vs auto-refresh after every BMAD skill run vs watch mode. How does it stay current?
3. **Access model:** a skill/command (e.g. `/bmad-knowledge`) that (re)builds + opens the site for the current project; persistent served site vs open index.html vs VS Code webview.
4. **Skill embedding:** how BMAD skills participate — emit to graph (reuse F17 `emitToGraph`) vs post-write regeneration trigger vs pure on-demand re-parse.

## CONVERGED CONCEPT — "BMAD Knowledge Atlas"

A reusable ma-agents capability: a **pre-bundled, offline static-site engine** that renders any project's BMAD `_bmad-output` as an interconnected, navigable knowledge graph + reading site, **auto-refreshed as BMAD skills run**, opened **on demand** via a skill.

### Locked decisions (recap)
- Reusable ma-agents FEATURE over ANY project's BMAD outputs (not documenting ma-agents itself).
- Engine: **pre-bundled custom JS engine** shipped in ma-agents (built at release like `build:plugin`); zero per-project npm install; fully air-gapped.
- Output: **self-contained static site** (HTML + inlined JS: force-graph + mermaid; data as JS vars, never fetched).
- Primary user: **human onboarding & review**.
- Freshness: **scan-first + manifest-based diff** (REVISED — see below). Hooks demoted to optional sugar; scan is authoritative.
- Access: **skill/command** (`/bmad-knowledge`) builds + opens the project's site.
- Data backbone: **hybrid** — parse markdown today; reconcile with F17 `knowledge-graph.json` when present (shared node-identity scheme).

## Ideation Log

_(append-only; ideas captured as they emerge through dialogue)_

### Functional Requirements (draft)
- KA-FR1: Ship an ma-agents skill `/bmad-knowledge` (+ `open` intent) that, in any ma-agents+BMAD project, generates and opens a self-contained knowledge site from `_bmad-output`.
- KA-FR2: Scanner discovers all BMAD doc types (product-brief, prd, epics, architecture, stories `NN-M-slug.md`, `bug-*.md`, `epic-N-retrospective.md`, `sprint-status.yaml`, phase/stage reports, project-context) — tolerant of missing types.
- KA-FR3: Extract entity vocabulary from frontmatter + body: `FR###`, `NFR##`, `F##`, `Epic N`, `Story N.M`, `bug-<slug>`, `P#-#`, `AC #`, retrospectives, statuses.
- KA-FR4: Auto-linkify every entity token occurrence into a hyperlink to its canonical definition/location.
- KA-FR5: Compute + display backlinks ("referenced by") per entity.
- KA-FR6: Build a TYPED graph — nodes {Capability, FR, NFR, Epic, Story, Bug, ArchDecision, Retro, Sprint}, edges {refines, implements, blocks, depends-on, validated-by, archived-in, addressed-by-retro, shipped-in}.
- KA-FR7: Interactive force-directed graph home view: zoom, filter by node type, click-to-navigate, neighborhood focus, distinct shapes/colors per type.
- KA-FR8: Document reading views — smooth scroll, TOC, status badges, rendered Mermaid.
- KA-FR9: Auto-GENERATE diagrams where none authored: traceability spine (FR→Epic→Story→Bug→Retro), epic→story trees, sprint/status board, dependency graph.
- KA-FR10: Status overlays on entities (implemented? in review? has open bug? orphaned?).
- KA-FR11: Orphan/gap detection view (FR with no story; story with no FR; bug with no root-cause; epic with no retro).
- KA-FR12: Project knowledge "home" page (summary + entry points + health snapshot).
- KA-FR13: Offline full-text search (FlexSearch/lunr, bundled).
- KA-FR14: Auto-refresh integration — BMAD skill artifact writes trigger (incremental) regeneration.
- KA-FR15: Reconcile with F17 `knowledge-graph.json` when present; else parse markdown.
- KA-FR16: Engine bundle ships with ma-agents installation (bundled/offline).
- KA-FR17 (stretch): Confluence target mode — emit interconnected pages to Confluence when configured.
- KA-FR18 (stretch): Sprint/timeline axis view ("knowledge over time") + "what changed since last sprint" diff.

### Non-Functional Requirements (draft)
- KA-NFR1: Fully air-gapped at generate-time AND view-time — no network, no CDN; vendor all deps; data embedded as JS vars (no `fetch` under `file://`).
- KA-NFR2: View-time requires no server — open `index.html` directly.
- KA-NFR3: No per-project `npm install`; engine pre-bundled by ma-agents.
- KA-NFR4: Non-destructive — never mutates source artifacts; outputs to dedicated, git-ignorable folder (e.g. `_bmad-output/knowledge-site/`).
- KA-NFR5: Performance — full build in seconds for typical projects (hundreds of entities); scale to thousands; incremental rebuild for hook mode.
- KA-NFR6: Cross-platform incl. Windows path + CRLF safety (known ma-agents gotcha).
- KA-NFR7: BMAD-version resilient — tolerate schema drift / missing docs; degrade gracefully, never crash.
- KA-NFR8: Maintainable — entity-parsing rules centralized + config-driven.
- KA-NFR9: Security — static output; sanitize rendered HTML; no execution of doc content.
- KA-NFR10: Reasonable bundle footprint for the air-gapped package.
- KA-NFR11: Accessible, readable typography; responsive.

### Architecture (draft)
Pipeline (all inside one pre-bundled engine):
1. **Entry/CLI** (invoked by skill or hook) → resolves project root + `_bmad-output`.
2. **Scanner/Loader** → enumerate doc files by type (tolerant).
3. **Parser/Entity Extractor** → frontmatter (gray-matter) + body regex/AST (markdown-it tokens) → entities + raw cross-refs; PLUS optional `knowledge-graph.json` reader.
4. **Graph Model Builder** → normalized nodes + typed edges (shared node-identity `file-id#anchor` aligned with F17).
5. **Cross-link Transformer** → rewrite entity tokens → anchors; compute backlinks.
6. **Diagram Generator** → emit Mermaid for traceability/epic-tree/sprint/dependency views.
7. **Site Emitter** → static HTML per doc + graph home; inline force-graph + mermaid + search index + graph data as JS vars.
8. **Hook Adapter** → incremental regen entrypoint for BMAD skill integration.

Repo placement (ma-agents): engine under `lib/knowledge-atlas/` (TS→bundled JS via esbuild at release); skill at `.claude/skills/bmad-knowledge/`; shared refresh util mirroring F17 `emitToGraph`; install wiring adds the bundle + skill.

Embedding into BMAD:
- **Installation:** bundle + skill deployed with ma-agents; registered in MANIFEST.
- **Skill hooks:** post-write refresh — either a settings.json hook (PostToolUse/Stop) or a shared `refreshKnowledgeAtlas()` call appended to BMAD skill outputs; reuse/extend F17 emission so skills feed the same graph.
- **Respect BMAD:** read-only over artifacts; phase-agnostic; node-identity converges with F17 so the two merge.

### REVISED APPROACH — scan-first, manifest-centric (supersedes hook-first freshness)
Rationale: hooks are forward-only/event-driven → blind to (1) cold-start/brownfield, (2) version upgrades into existing-knowledge projects, (3) out-of-band/human/git-pull edits, (4) skill-coupling fragility. A scan is authoritative; a hook is a guess.

Design:
- `/bmad-knowledge` SCANS `_bmad-output` → builds a **knowledge manifest** → generates site. Subsequent calls: load manifest, **diff by content hash** (mtime only as pre-filter), process only added/changed/removed (+detect deletions/renames), update manifest + regenerate affected pages/graph.
- **Hooks demoted to optional sugar**: a hook may simply invoke the same command for live refresh; correctness never depends on it.
- **Manifest does 3 jobs:** (1) diff anchor for incremental builds; (2) the discovery↔rendering CONTRACT — discovery runs at command-time (model present) and writes the manifest; the pure pre-bundled renderer reads it and needs NO model (resolves air-gap tension); (3) IS / supersets F17 `knowledge-graph.json` (`meta/nodes/edges`) → converges with Epic 19.
- **Discovery = deterministic-first + model-assisted second:** regex/AST parse the stable BMAD vocabulary (~90%, free, reproducible); model used only for non-standard/brownfield doc classification, prose-level semantic relationships, and human-readable summaries. **Model output cached in manifest keyed by content hash** → unchanged files cost zero tokens; cost scales with change, not project size.
- Implication: first-ingest/changed files need the model present; model-less rebuild falls back to deterministic-only, but the **committed manifest** carries enrichment forward.
- **Decision pending:** manifest git-committed (shared/reproducible; lean) vs gitignored (pure local cache).

### Revised/added requirements
- KA-FR14 (REVISED): Primary freshness = scan + manifest diff via `/bmad-knowledge`; hook auto-invoke is optional.
- KA-FR19: Build & persist a **knowledge manifest** (per-file: content hash, type, entities, edges, cached model enrichment, summary) as basis of generation.
- KA-FR20: On re-run, diff manifest by content hash → incremental regeneration; detect added/changed/removed/renamed.
- KA-FR21: Discovery is deterministic-first with bounded model-assisted enrichment; enrichment cached by hash.
- KA-FR22: Manifest aligns with / supersets F17 `knowledge-graph.json` (shared node identity).

### Open questions / risks
- Hook mechanism: settings.json hook vs in-skill call vs file-watcher — which is robust + least intrusive cross-platform?
- Relationship to F17/Epic 19: is Knowledge Atlas the official viz tier of F17, or a sibling capability? (Recommend: position as the viz/site tier OF F17.)
- Bundle size vs feature richness for air-gapped package.
- Confluence mode scope (defer to stretch/separate epic).
- Incremental-rebuild complexity vs full-rebuild simplicity for v1.
