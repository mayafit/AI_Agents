# Addendum — BMAD Knowledge Atlas

Downstream-relevant depth captured during brief creation. Feeds the PRD, architecture, and epic/story work. It is not part of the 1–2 page brief.

## Architecture pipeline (8 stages, one pre-bundled engine)

1. **Entry / CLI** — invoked by the `/bmad-knowledge` skill (or, later, an optional hook). Resolves project root + `_bmad-output`.
2. **Scanner / Loader** — enumerates doc files by type, tolerant of missing types.
3. **Parser / Entity Extractor** — frontmatter (gray-matter) + body (markdown-it tokens / regex) → entities + raw cross-refs. Optional `knowledge-graph.json` reader when F17 output is present.
4. **Graph Model Builder** — normalized nodes + typed edges; node identity `file-id#anchor` (aligned with F17).
5. **Cross-link Transformer** — rewrite entity tokens → anchors; compute backlinks.
6. **Diagram Generator** — emit Mermaid for traceability spine / epic→story tree / sprint-status / dependency views.
7. **Static Site Emitter** — static HTML per doc + graph home; inline force-graph + mermaid + search index + graph data as JS variables (never `fetch` — `file://` origin is null → CORS-blocked).
8. **Hook Adapter** (deferred) — incremental-regen entrypoint for optional BMAD-skill auto-refresh.

Repo placement (ma-agents): engine under `lib/knowledge-atlas/` (TS → esbuild bundle at release); skill at `.claude/skills/bmad-knowledge/`; shared refresh util mirroring/extending F17 `emitToGraph`; install wiring adds bundle + skill + MANIFEST registration.

## Knowledge manifest — the keystone

Per-file record: `{ path, contentHash, type, entities[], edges[], summary?, modelEnrichment? }`, plus `meta` and a normalized `nodes/edges` graph (superset of F17 `knowledge-graph.json`).

Three jobs:
1. **Diff anchor** — content hash per file (mtime serves only as a cheap pre-filter; mtime alone is unreliable across git checkout/pull). On re-run: hash all files → process only added/changed/removed; detect deletions (in-manifest-but-gone) and renames.
2. **Discovery↔rendering contract** — discovery runs at command time (model present) and writes the manifest; the pre-bundled renderer reads it and needs no model. Resolves the air-gap tension.
3. **F17 graph data** — is, and supersets, `knowledge-graph.json` (`meta/nodes/edges`).

Open decision: manifest **git-committed** (shared, reproducible, saves teammates/CI the recompute — leaning this way) vs **gitignored** (pure local cache).

## Discovery model — deterministic-first, model-assisted second

- **Deterministic parsers** handle the stable BMAD vocabulary (`FR###`, `NFR##`, `F##`, `Epic N`, `Story N.M`, `bug-<slug>`, `P#-#`, `AC #`, statuses). ~90% of the graph; fast, reproducible, free, air-gappable. **This is the v1 scope.**
- **Model-assisted (deferred)** — only for (a) non-standard/brownfield doc classification, (b) prose-level semantic relationships (a retro discussing a story without writing "Story N.M"), and (c) human-readable summaries. **Output is cached in the manifest keyed by content hash** → unchanged files cost zero tokens; cost scales with change, not project size.
- Implication: first-ingest and changed files need the model present; a model-less rebuild falls back to deterministic-only, but the committed manifest carries prior enrichment forward.

## Entity vocabulary (link targets) — confirmed from repo scan

| Entity | Token | Source |
|---|---|---|
| Functional Req | `FR###` (FR1–FR210) | prd.md / epics.md |
| Non-Functional Req | `NFR##` | prd.md / epics.md |
| Capability Area | `F##` → Epic# | prd.md |
| Epic | `Epic ##` | epics.md |
| Story | `Story N.M` / `NN-M-slug.md` | sprint-status.yaml + story files |
| Bug | `bug-<slug>` | implementation-artifacts/ |
| Arch Decision | `P#-#` (e.g. P5-5) | architecture.md |
| Retrospective | `epic-N-retrospective.md` | implementation-artifacts/ |
| Status | backlog→ready-for-dev→in-progress→review→done | sprint-status.yaml |

Existing cross-ref prose patterns: "FR207, NFR56"; "Blocked by: Story 27.1"; "Architecture Decision P5-5"; "Added Epic 27, Story 27.1–27.7"; "shipped v3.13.0 (commit 090c6bd #115)".

Folder layout: `_bmad-output/planning-artifacts/{prd.md, epics.md, architecture.md, product-brief-*, briefs/}`; `_bmad-output/implementation-artifacts/{sprint-status.yaml, NN-M-slug.md, bug-*.md, epic-N-retrospective.md, done/}`; `_bmad-output/project-context.md`.

## Technology decision (rejected alternatives)

- **Chosen:** pre-bundled custom engine — markdown-it 14 (custom entity-linker rule) → graph as inlined JS var → **force-graph 1.51** (MIT, ~56KB, d3-force + onNodeClick) + **mermaid 11.16** standalone → bundled via esbuild. Borrows Quartz's technique (remark/rehype-style entity transformer + backlink computation) but owns the bundle.
- **Quartz v5** — best off-the-shelf (native wikilinks/backlinks, graph view, bundled offline mermaid, ~30-line entity transformer), but designed as a per-repo build project, not a generator pointed at arbitrary folders. Embedding it in ma-agents for an air-gapped, run-on-any-project tool would require a per-project `npm install` (dies offline) or vendoring the full node_modules. Rejected for the embed + air-gap constraints.
- **Docusaurus** — the only traditional SSG that bundles mermaid, but no native wikilinks/backlinks and only a community D3 graph. Rejected (would mean reassembling Quartz).
- **MkDocs Material** — maintenance mode; mermaid via CDN by default (silent offline failure). Rejected.
- **Hugo** — no graph view; inline-text render hooks don't fire (can't auto-link FRs). Rejected.
- **Obsidian Publish** — paid/hosted, not air-gappable. **Foam** — authoring only, no site. **Backstage/TechDocs** — full server + DB, cannot function as static HTML. All rejected.

Air-gap traps to enforce: vendor mermaid locally; embed graph data as a JS var, never fetch; self-host any font origin.

## Design reference & visual-quality bar

Reference artifact (saved): `design-reference/elteye-rules-engine-report.html` — a user-provided Claude+BMAD-generated analyst report that sets the quality bar.

What to copy from it:
- **Design-system CSS via custom-property tokens**: `--ink/--paper/--surface`, semantic status colors (`--ok/--warn/--gap` each with a paired `-wash` background), teal accent + sand secondary.
- **Type system**: mono "eyebrow" labels (uppercase, letter-spaced), balanced headings (`text-wrap:balance`), ~64–68ch measure, tabular-nums for numbers.
- **Spacing rhythm**: `section{padding:40px 0;border-top}`; consistent vertical cadence.
- **Component kit**: hero, verdict/callout, status pills/badges, two-column cards, numbered pipeline, swimlane rows, scatter-gather, capability matrix (colored dots), syntax-highlighted code blocks (span classes), data tables with hover.
- **Polish**: responsive collapse (~680px), `prefers-reduced-motion`, ARIA labels on every diagram, horizontal-scroll wrappers for wide tables/diagrams.

Critical technical lesson: **zero external dependencies** — no CDN, no web fonts (system stack), **no JS libraries at all**; diagrams hand-built with CSS grid/flex/SVG. This is the air-gap gold standard and proves "wow" quality needs no heavy runtime.

**Zero-dependency-first rendering principle** (→ NFR67, FR230): curated views (home/health, reading, traceability spine, epic→story trees, sprint/status board, matrices) render as self-contained HTML/CSS/SVG with no runtime JS lib. Reserve bundled libs for where interactivity/authored diagrams truly require them: **force-graph** (interactive graph view) and **Mermaid** (authored diagrams in docs). Auto-generated structural diagrams should prefer hand-built CSS/SVG (artifact style) over Mermaid.

**Calibration — auto-generated vs hand-authored narrative**: v1 guarantees the *design-system polish, structure, and interlinking* of the reference. It does NOT auto-write the reference's editorial *narrative* (verdict, "what this means", worked examples) — that maps to the deferred **model-assisted enrichment tier** (summaries / analysis cards), not v1.

## Sealed offline packaging (→ NFR65)

Two dependency surfaces must both be sealed for on-prem/disconnected use:
1. **View-time** (generated site): all JS/CSS/fonts inlined or vendored; graph data embedded as JS var (never fetched). Already FR225/NFR58.
2. **Install + generate-time** (the engine): the engine AND all its libraries (force-graph, mermaid, markdown/parse libs, search, esbuild/build tooling, fonts/icons) ship **inside the ma-agents distribution** as pre-built/vendored assets. Installing ma-agents and generating/viewing an Atlas on a disconnected network must need no npm/git/CDN/host. Ship the engine as a pre-built bundle committed to the package (like `build:plugin`) so the consuming project never runs `npm install`. Verified by extending the existing offline-install gate (cf. NFR2/NFR50/NFR54/NFR57) to exercise Atlas generation + viewing with egress blocked.

## Key constraints / NFR seeds

- Fully air-gapped at generate-time AND view-time; no server to view.
- No per-project npm install; engine pre-bundled by ma-agents.
- Non-destructive — outputs only to a dedicated, git-ignorable folder (e.g. `_bmad-output/knowledge-site/`).
- Cross-platform incl. Windows path + CRLF safety (known ma-agents gotcha).
- BMAD-version resilient — tolerate schema drift / missing docs; degrade gracefully, never crash.
- Security — static output; sanitize rendered HTML; no execution of doc content.

## Open questions for PRD/architecture

1. Merge sequencing with in-flight Epic 19 stories 19-1…19-4 (emitToGraph) — does Atlas extend them or land as a new sub-epic of F17?
2. Manifest commit policy (committed vs gitignored).
3. Hook mechanism for the deferred auto-refresh (settings.json PostToolUse/Stop vs in-skill call vs file-watcher).
4. Output folder name + gitignore default (`_bmad-output/knowledge-site/`).
5. Concrete v1 success-metric targets.
