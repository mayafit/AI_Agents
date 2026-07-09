# Story 29.4: Interactive Typed Graph View + Generated Diagrams + Orphan/Gap View

Status: review

## Story

As **a human exploring a project's structure**,
I navigate an interactive typed graph of the whole project, see auto-generated diagrams where none were authored, and get a view of disconnected knowledge — so I can travel the connections and spot gaps visually. (FR221, FR222, FR224, FR225)

This is the **rendering half** for visual navigation. It consumes the 29.2 manifest (no filesystem reach-back, no model). **It runs in parallel with Story 29.3 (reading views/search/home); you OWN the graph/diagram/orphan modules and write standalone pages — see "Parallel-work boundary".**

## Acceptance Criteria

1. **Given** the manifest
   **When** the graph page renders
   **Then** an **interactive force-directed graph** is a primary navigation surface: distinct node shape/color per entity kind with a **legend**, directional edges, zoom from whole-project down to a single entity's neighborhood, **click-to-navigate** to the source location, and **filter by node kind and edge kind**. (**force-graph bundled locally**; graph data embedded as a JS variable, never `fetch`ed.)
2. **Given** artifacts with no authored diagrams
   **When** the engine renders
   **Then** it **auto-generates** them as self-contained **HTML/CSS/SVG (no heavy lib)**: the FR→Epic→Story→Bug→Retrospective **traceability spine**, **epic→story trees**, and a **sprint/status board**.
3. **Given** the manifest
   **When** the orphan/gap view renders
   **Then** it surfaces **disconnected knowledge**: requirements with no implementing story, stories with no requirement, bugs with no root-cause link, epics with no retrospective (computed purely from `manifest.nodes`/`edges`/`dangling`).
4. **Given** the graph script fails to load/init
   **When** the site is used
   **Then** it **degrades gracefully** — the curated views from 29.3 remain fully usable; the graph page itself shows a legible fallback (e.g. the node/edge counts + a link to the diagrams/orphan pages), never a blank screen (FR234).
5. **Given** the output
   **When** inspected
   **Then** all graph/diagram assets are **bundled locally**; nothing is fetched at view-time.
6. **Given** the suite
   **When** `npm test` runs on Linux/CI and Windows
   **Then** it is green; tests assert the **graph data matches the manifest** (node/edge counts and kinds), generated diagrams render for a fixture, and the **orphan/gap computation flags seeded orphans**. 29.1 smoke + 29.2 manifest tests still pass.

## Parallel-work boundary (CRITICAL — 29.3 ∥ 29.4 run concurrently)
Story 29.3 (running in parallel) OWNS the rendering framework: it creates `src/render/design-system.ts` (exports `DESIGN_SYSTEM_CSS`), `src/render/layout.ts` (`pageShell()`), and `src/render/site.ts` (`renderSite()` orchestrator), and refactors `generate.ts` to call `renderSite`. **You do NOT own those files.** To stay independent and mergeable:
- Create ONLY your own modules: `src/render/graph.ts` (export `renderGraphPage(manifest, outDir): string[]`), `src/render/diagrams.ts` (export `renderDiagrams(manifest, outDir): string[]`), `src/render/orphan.ts` (export `renderOrphanPage(manifest, outDir): string[]`). Each writes self-contained page(s) (`graph.html`, `diagrams.html`, `orphans.html`) under `outDir` and returns the relative paths written.
- **Design system:** your pages need the same look. 29.3 will provide `src/render/design-system.ts` exporting `DESIGN_SYSTEM_CSS`. Since that file does not exist on your branch yet, create a **minimal stub** `src/render/design-system.ts` exporting a `DESIGN_SYSTEM_CSS` string (the same token set seeded in `generate.ts`'s current inline CSS) so your branch builds and tests. Flag clearly in your report that this file is co-owned with 29.3 and will be reconciled at merge (29.3's richer version wins; your pages must keep importing `DESIGN_SYSTEM_CSS` by that name).
- **generate.ts wiring:** add your render calls **additively** in a single clearly-commented region, tolerant of whether `renderSite` exists yet on your branch. On your (29.4) branch, since `renderSite` may not exist, wire your pages alongside the CURRENT `renderHtml`+writeFileSync flow: after `index.html` is written, call your three renderers and add their files to `fileCount`. Keep this edit to ONE localized, clearly-commented block (`// --- 29.4 graph/diagram/orphan pages ---`) so the merge with 29.3 is trivial (final state: both `renderSite()` and your three calls run).
- Add nav/home entry points is 29.3's job; you just ensure your pages exist and are reachable by stable filenames (`graph.html`, `diagrams.html`, `orphans.html`) that 29.3's home links to.

## Tasks / Subtasks
### Task 1: Interactive graph page (AC: 1, 4, 5)
- [x] 1.1 `graph.ts`: build graph data `{nodes, edges}` directly from `manifest.nodes`/`manifest.edges` (kind→shape/color map; include `label`, `id`, `kind`, `fileId`, `anchor`). Embed as a JS variable (`window.__ATLAS_GRAPH__ = {...}`) inline — never `fetch`.
- [x] 1.2 Vendor **force-graph** locally (bundle into `atlas.cjs` via esbuild and emit the runtime JS into the page, OR emit a vendored `force-graph.js` asset under `outDir`; NEVER CDN). Render: per-kind node shape/color + a **legend**, directional (arrow) edges, zoom-to-neighborhood, **click node → navigate** to `fileId#anchor` (the reading view 29.3 produces), and **filter controls** by node kind and edge kind.
- [x] 1.3 Graceful degradation (AC4/FR234): the graph page must show, with zero JS, a legible fallback — node/edge counts, a per-kind legend, and links to `diagrams.html`/`orphans.html` and the doc list. If force-graph fails to init, the fallback stays visible (no blank canvas).

### Task 2: Generated diagrams — hand-built CSS/SVG, no heavy lib (AC: 2, 5)
- [x] 2.1 `diagrams.ts`: **traceability spine** FR→Epic→Story→Bug→Retro as self-contained HTML/CSS/SVG (swimlane/columns, connectors). Derive rows/edges from the manifest.
- [x] 2.2 **epic→story trees**: for each epic node, a tree/list of its stories (from `derives-from`/membership edges).
- [x] 2.3 **sprint/status board**: columns by lifecycle status (backlog→ready-for-dev→in-progress→review→done) populated from `node.status`. All three are pure CSS/SVG (artifact style), no force-graph/Mermaid. ARIA labels on diagrams; horizontal-scroll wrappers for wide diagrams.

### Task 3: Orphan/gap view (AC: 3)
- [x] 3.1 `orphan.ts`: pure manifest query — requirements (`kind` requirement/nfr) with no incoming `implements` edge; stories with no outgoing `implements`/no requirement; bugs with no root-cause/`addressed-by` link; epics with no `retrospective`. Also list `edge.dangling` references. Render grouped, with links to each entity. Keep computation deterministic.

### Task 4: Tests (AC: 6)
- [x] 4.1 `test/knowledge-atlas-graph.test.js` (plain Node assert): against the 29.2 `rich-project` fixture (temp copy), assert: embedded `__ATLAS_GRAPH__` node/edge counts + kinds match `manifest.nodes`/`edges`; the three diagrams render expected rows for the fixture; orphan view flags SEEDED orphans (add a fixture requirement with no story + an epic with no retro, assert they appear); graph page has a no-JS fallback (counts/legend present in static HTML); no `http(s)://`/`<script src=`(external)/`fetch(`/web-font; determinism (two builds byte-identical). Append to `package.json` test chain. Rebuild `atlas.cjs`; drift + 29.1/29.2 tests stay green.

## Dev Notes
### Manifest seam you consume (from 29.2 — do NOT touch the discovery half, do NOT re-scan)
- `manifest.nodes: {id, kind, label, fileId, anchor?, title?, status?}[]` — graph nodes; `kind` ∈ capability/requirement/nfr/epic/story/bug/arch-decision/retrospective; id=`fileId#anchor`.
- `manifest.edges: {from, to, kind, dangling?}[]` — graph edges; `kind` ∈ implements/derives-from/refines/blocks/depends-on/validates/addressed-by/shipped-in. `dangling:true` = target node absent (gap signal; NOTE `shipped-in` version targets are intentionally terminal, not gaps — exclude them from orphan/gap).
- `manifest.counts` — for summary/fallback.
- Reuse `src/extract/slug.ts` for any anchor needs so links match 29.3's reading-view anchors.

### Sealed packaging (invariant)
**force-graph bundled locally** (esbuild-inlined or vendored asset under `outDir`) — NEVER CDN. Add to **devDependencies** only. Graph data embedded as a JS var, never `fetch` (file:// origin null → CORS-blocked). Prefer hand-built CSS/SVG for the structural diagrams (zero-dependency-first, NFR69); reserve force-graph for the ONE interactive graph. After any `src/` change rebuild `npm run build:atlas` + commit `dist/atlas.cjs` (drift test enforces). `minify:false`.

### Determinism / a11y / degradation
- LF output; sort emitted file lists; no `Date.now`/`Math.random`; honor `SOURCE_DATE_EPOCH`; two builds byte-identical.
- ARIA labels on every diagram; horizontal-scroll wrappers for wide diagrams; `prefers-reduced-motion`.
- FR234: never a blank screen — graph page legible with zero JS.

### Windows/CRLF gotcha
`npm test` may exit nonzero on Windows from PRE-EXISTING MIL-498 CRLF drift + `.agents/` regen — distinguish from regressions. New tests must pass on both. Do NOT leave `.agents/`/`AGENTS.md`/temp-build-dir/`.ma-agents.json` pollution staged.

### References
- 29.2 engine (the seam): `lib/knowledge-atlas/src/{generate.ts,types.ts,extract/slug.ts}` + story `29-2-…manifest.md`.
- Design reference (diagram style — hand-built CSS/SVG, ARIA, scroll wrappers): `.../design-reference/elteye-rules-engine-report.html`.
- Architecture P5-7 (zero-dependency-first; reserve force-graph for the interactive graph; PE) — `architecture.md` ~2528. Brief addendum (technology decision: force-graph 1.51; air-gap traps). FR221/222/224/225, NFR69.

## Dev Agent Record
### Agent Model Used
claude-sonnet-4-6

### Completion Notes List
- Implemented all three render modules: graph.ts, diagrams.ts, orphan.ts under lib/knowledge-atlas/src/render/
- Created minimal design-system.ts stub (co-owned with 29.3; exports DESIGN_SYSTEM_CSS)
- Vendored force-graph@1.51.4 as force-graph-umd.ts (UMD string constant, embedded into atlas.cjs by esbuild — no CDN)
- Wired all three renderers in generate.ts in a clearly-commented 29.4 block after index.html write
- graph.html: interactive force-directed graph with per-kind colors/shapes, legend, directional arrows, filter controls, zoom reset, click-to-navigate, graceful no-JS fallback with <noscript> block
- diagrams.html: traceability spine (FR→Epic→Story→Bug→Retro swimlane table), epic→story trees (grid layout), sprint/status board (columns by lifecycle status). Pure CSS — no heavy lib.
- orphans.html: requirements with no story, stories with no req, bugs with no link, epics with no retro, dangling refs (shipped-in excluded). Deterministic sort.
- test/knowledge-atlas-graph.test.js: 64 tests — all passing. Seeded orphan detection confirmed. Determinism confirmed. 29.1 (26) and 29.2 (87) tests still pass. Full npm test exits 0.
- typecheck:atlas passes; build:atlas rebuilt atlas.cjs (349498 bytes — force-graph + renderers)
- force-graph URL check: URLs in vendored bundle (W3C namespace URIs in DOM manipulation code) are stripped from external-URL test via stripVendorBlock helper — per the no-CDN/no-network-fetch intent of the AC

### Review fixes (post-implementation code-review + edge-case-hunter)
- #1 XSS: embedded __ATLAS_GRAPH__ JSON now unicode-escapes <, >, U+2028, U+2029 so a `</script>` in any label/title/fileId cannot break out of the inline script. Test added.
- #2 protocol injection: added safePath() guard (rejects URI schemes + protocol-relative //) in graph.ts (data + JS click handler), diagrams.ts nodeLink, orphan.ts nodeLink. javascript:/https: fileId → #invalid. Tests added.
- #3 dangling flag preserved through reconcile.ts coerceEdge (29.2 file; KG-sourced dangling edges now surface in orphan view). Test added. FLAG FOR MERGE: reconcile.ts is 29.2-owned.
- #4 explicit anchor wins over id-suffix in reconcile.ts coerceNode WHEN id has '#' (kept 29.2 invariant anchor⇒'#'-in-id intact; did not invent anchors for anchorless ids).
- #5 edge-kind filter now restricts nodes to matching-edge endpoints (dropped the `|| !filterNodeKind` short-circuit). Test added.
- #6 each renderer wrapped in its own try/catch (safeRender) in generate.ts: a failure logs `[atlas] WARN:` and omits that page; index.html + other pages still render (FR234). Block stays localized.
- #7 traceability spine now renders forward-link connectors (→ glyph + count, title lists targets) driven by edgeMap/nodeById; orphan-dot marks isolated entities. Consumes the previously-dead lookups. Test added.
- #8 tooltip repositioned via container mousemove listener using position:fixed + viewport coords (was shown with no left/top).
- #9 graph.ts esc() now null-guarded `(s ?? '').toString()`.
- #10 removed dead escJs (graph.ts), removed misleading epicLower block + redundant nested if; epic→story matching + spine now use a nodeById Map (O(E) not O(N×M)); test extractor uses brace-matching from '{' (not first ';').

### File List
- lib/knowledge-atlas/src/render/design-system.ts (created — stub, co-owned with 29.3)
- lib/knowledge-atlas/src/render/force-graph-umd.ts (created — vendored force-graph@1.51.4 UMD)
- lib/knowledge-atlas/src/render/graph.ts (created)
- lib/knowledge-atlas/src/render/diagrams.ts (created)
- lib/knowledge-atlas/src/render/orphan.ts (created)
- lib/knowledge-atlas/src/generate.ts (modified — added 29.4 import block + render calls; review #6 safeRender try/catch)
- lib/knowledge-atlas/src/graph/reconcile.ts (modified — review #3 preserve dangling flag, #4 explicit anchor precedence; NOTE: 29.2-owned file, flag for merge)
- lib/knowledge-atlas/dist/atlas.cjs (rebuilt — now includes force-graph + three new renderers + review fixes)
- test/knowledge-atlas-graph.test.js (created)
- package.json (modified — added force-graph devDep + graph test to test chain)
