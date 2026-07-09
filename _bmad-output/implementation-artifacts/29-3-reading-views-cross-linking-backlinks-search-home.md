# Story 29.3: Reading Views + Entity Cross-Linking + Backlinks + Offline Search + Home (Zero-Dependency Render)

Status: review

## Story

As **a human onboarding to or reviewing a project**,
I open the Atlas and read every document with smooth navigation, click any entity token to jump to its definition, see what references it, search across all knowledge offline, and start from a project home with a health snapshot — all at analyst-report visual quality. (FR219, FR220, FR223, FR226, FR227, FR229, FR233, FR234)

This is the **rendering half** for reading. It consumes the 29.2 manifest (no filesystem reach-back, no model) and turns the single `index.html` into a multi-page, cross-linked, searchable static site at the design-reference quality bar. **It runs in parallel with Story 29.4 (graph/diagrams/orphan view); you OWN the rendering framework — see "Parallel-work boundary".**

## Acceptance Criteria

1. **Given** the manifest
   **When** the renderer runs
   **Then** it produces per-document **reading views** with smooth scrolling, a table of contents, and entity **status badges**; authored Mermaid code fences are rendered (Mermaid bundled locally, never CDN).
2. **Given** any document
   **When** rendered
   **Then** every occurrence of an entity token (`FR###`, `NFR##`, `Epic N`, `Story N.M`, `bug-*`, `P#-#`, …) is a hyperlink to that entity's canonical location (`fileId#anchor`).
3. **Given** an entity
   **When** its page/section renders
   **Then** it displays its **backlinks** ("referenced by") — every location across all documents that references it (computed from `manifest.edges` where `edge.to === node.id`).
4. **Given** the site
   **When** opened
   **Then** a project **home** page summarizes the project with entry points and a **health snapshot** (entity counts by kind, statuses, orphan counts — read from `manifest.counts` and a dangling/orphan scan).
5. **Given** the site
   **When** the user searches
   **Then** **offline full-text search** across all knowledge works with no network (bundled index/library — FlexSearch or lunr — vendored, index embedded as a JS variable, never `fetch`ed).
6. **Given** the rendered output
   **When** inspected
   **Then** it uses a **curated design system** (typography scale, semantic color tokens incl. status colors, spacing rhythm, reusable components: cards, status pills, tables, syntax-highlighted code, callouts), is responsive to mobile, uses **system fonts only**, has ARIA on structural elements, and honors `prefers-reduced-motion`. The quality bar is the design-reference artifact, not a default markdown render.
7. **Given** a missing/failed script
   **When** the site loads
   **Then** **progressive enhancement** holds: reading views, home, and link-navigation remain legible and navigable as static HTML/CSS; the site never shows a blank screen (FR234).
8. **Given** the output
   **When** inspected
   **Then** it is **self-contained**: all CSS/JS/search-index embedded locally; graph/search data embedded as JS variables (never `fetch`ed under `file://`). Rendered markdown→HTML is **sanitized**; document content is never executed (NFR64).
9. **Given** the suite
   **When** `npm test` runs on Linux/CI and Windows
   **Then** it is green; tests assert entity links resolve to real anchors, backlinks are symmetric, search returns expected hits offline, HTML is sanitized, and determinism holds. 29.1 smoke + 29.2 manifest tests still pass.

## Parallel-work boundary (CRITICAL — 29.3 ∥ 29.4 run concurrently)
You **OWN the rendering framework**. Establish it cleanly so Story 29.4 (graph/diagrams/orphan, running in parallel) can add pages with minimal overlap:
- Refactor `generate.ts`: replace the inline `renderHtml(manifest)` + single `writeFileSync` with a single call `const written = renderSite(manifest, outDir);` (import from `./render/site`). `renderSite(manifest, outDir): string[]` writes ALL pages/assets under `outDir` and returns the sorted list of relative paths written. Set `fileCount = written.length + 1` (manifest.json). Keep the existing guards/determinism/`writeManifest` call intact.
- Create `src/render/design-system.ts` exporting `DESIGN_SYSTEM_CSS` (extract + greatly expand the inline CSS currently in `generate.ts`, modeled on the design reference). **This module is the shared design contract** — 29.4 will import `DESIGN_SYSTEM_CSS` from it. Keep the export name stable.
- Create `src/render/layout.ts` exporting a `pageShell({title, body, nav, manifest})` helper (consistent `<head>`, nav, footer, ARIA) reused by all pages.
- Your page modules: `src/render/site.ts` (orchestrator + home), `src/render/document.ts` (reading view), `src/render/linkify.ts` (entity tokenization→links + sanitize), `src/render/backlinks.ts`, `src/render/search.ts` (index build + embedded UI).
- Do NOT create `graph.ts`/`diagrams.ts`/`orphan.ts` (29.4 owns those). `renderSite` should tolerate their absence now and include them later (29.4 wires its pages into `generate.ts` additively after your `renderSite` call). Expect a trivial `generate.ts` merge with 29.4 — keep your edit to a single localized region.

## Tasks / Subtasks
### Task 1: Rendering framework + design system (AC: 6, 7, 8)
- [x] 1.1 `design-system.ts`: CSS-custom-property tokens (`--ink/--paper/--surface/--surface-alt/--ok/--warn/--gap/--ink-wash/--accent/--accent-dk/--border/--radius`, + status colors with `-wash` backgrounds), type scale (mono eyebrow labels, balanced headings, ~64–68ch measure, tabular-nums), spacing rhythm, components (hero, card, status pill/badge, table w/ hover, syntax-highlighted code spans, callout), responsive collapse (~680px), `prefers-reduced-motion`, system font stack. NO external URLs/web fonts.
- [x] 1.2 `layout.ts`: `pageShell()` — self-contained `<head>` (inline `<style>` = DESIGN_SYSTEM_CSS), skip-link, `<nav>` with ARIA, main, footer. Every page legible with zero JS (PE baseline).
- [x] 1.3 `site.ts`: `renderSite(manifest, outDir)` orchestrator — writes `index.html` (home), one reading view per document, and `search` assets; returns written relative paths sorted. Wire into `generate.ts` per the boundary above.

### Task 2: Reading views + Mermaid (AC: 1, 8)
- [x] 2.1 `document.ts`: render each `manifest.files` doc to a reading view — markdown→HTML via **markdown-it** (bundled via esbuild; sanitize output), TOC from headings (reuse the 29.2 slug algorithm for anchors so links match), entity status badges from `node.status`.
- [~] 2.2 Render authored ```mermaid fences with **mermaid** (vendored locally, init from embedded script; never CDN). If mermaid fails, show the fenced code as plain text (PE). **DEVIATION (accepted for v1):** implemented as the plain-text fallback ONLY — authored fences render as a styled `.mermaid-block` figure (diagram source visible), with NO mermaid runtime bundled/vendored (see Dev Notes "Deviation (mermaid)"). No CDN, no script, no blank screen. Full client-side mermaid deferred (would add ~3.5MB to the drift-guarded atlas.cjs for a feature no fixture uses).
- [x] 2.3 Sanitize all rendered HTML (no inline event handlers, no `<script>` from doc content, escape/strip dangerous tags) — NFR64. Never execute document content.

### Task 3: Cross-linking + backlinks (AC: 2, 3)
- [x] 3.1 `linkify.ts`: tokenize rendered text and turn each entity occurrence into `<a href="<relativePathTo fileId>#<anchor>">`. Must NOT linkify inside code spans (reuse/mirror 29.2's code-span handling) and must not double-link. Resolve targets via `manifest.nodes` (id = `fileId#anchor`).
- [x] 3.2 `backlinks.ts`: for each node, gather `manifest.edges` where `edge.to === node.id`; render a "Referenced by" list on the entity's section/page with links back to each source. Assert symmetry in tests (a link A→B implies B lists A as backlink).

### Task 4: Home + health snapshot (AC: 4)
- [x] 4.1 Home page: project title, entry points (docs list, search, and a placeholder/nav slot for the 29.4 graph page — link to `graph.html` if present, else omit gracefully), and a health snapshot: counts by node kind (from `manifest.counts`), status distribution, and orphan count (nodes with no edges / `edge.dangling`). Keep the orphan computation a pure manifest read.

### Task 5: Offline search (AC: 5, 8)
- [x] 5.1 `search.ts`: build a search index over docs + entities at generate time; vendor **FlexSearch** or **lunr** (bundle via esbuild OR emit a vendored JS asset under `outDir`); embed the index as a JS variable (`window.__ATLAS_SEARCH__ = {...}`), never `fetch`. Search UI box on every page (PE: degrades to a visible "search requires JS" note + the full doc list remains navigable).

### Task 6: Tests (AC: 9)
- [x] 6.1 `test/knowledge-atlas-render.test.js` (plain Node assert): against the 29.2 `rich-project` fixture (copy to temp), assert: every entity link `href` resolves to a real `fileId#anchor` present in the site; backlinks symmetric; search index contains expected tokens and a query returns the expected doc offline; rendered HTML is sanitized (inject a `<script>`/`onerror=` into a fixture doc and assert it's neutralized); no `http(s)://`/`<script src=`/`fetch(`/web-font in output; PE (strip/disable JS → home+reading+links still present, no blank screen); determinism (two builds byte-identical). Append to `package.json` test chain. Rebuild `atlas.cjs`; smoke bundle-drift + 29.2 manifest tests stay green.

## Dev Notes
### Manifest seam you consume (from 29.2 — do NOT touch the discovery half)
- `manifest.files: {path, contentHash, type, entities[], edges[], statuses[]}[]` (sorted by path) — your document list + raw markdown is read from `path` under `projectRoot`. NOTE: reading the original markdown to render is allowed in the rendering half ONLY via the paths the manifest already enumerated (the manifest is the source of truth for WHAT exists; you may read those files' bytes to render them). Do not re-scan/re-discover.
- `manifest.nodes: {id, kind, label, fileId, anchor?, title?, status?}[]` (sorted by id) — entity index for links/badges. id = `fileId#anchor`.
- `manifest.edges: {from, to, kind, dangling?}[]` — backlinks = edges where `to===node.id`.
- `manifest.counts: Record<string,number>` — `files`, `nodes`, `edges`, `nodes.<kind>` for the health snapshot.
- Anchor/slug algorithm: reuse `src/extract/slug.ts` (`entityToSlug`/`headingToSlug`) so your TOC + link anchors match node ids.

### Sealed packaging (invariant)
markdown-it, mermaid, and the search lib are **bundled into `atlas.cjs` by esbuild** (or emitted as vendored local assets under `outDir`) — NEVER CDN, never a consuming-project `npm install`. Add them to **devDependencies** (build-time) only; esbuild inlines runtime usage. Graph/search data embedded as JS vars, never `fetch` (file:// origin is null → CORS-blocked). After any `src/` change rebuild `npm run build:atlas` + commit `dist/atlas.cjs` (drift test enforces). Keep `minify:false`.

### Determinism / a11y / safety
- LF output; sort emitted file lists; no `Date.now`/`Math.random`; honor `SOURCE_DATE_EPOCH`. Two builds of the same fixture must be byte-identical.
- Sanitize markdown→HTML (NFR64). System fonts only. ARIA on nav/landmarks. `prefers-reduced-motion`. PE: no blank screen if JS fails.

### Windows/CRLF gotcha
`npm test` may exit nonzero on Windows from PRE-EXISTING MIL-498 CRLF drift + `.agents/` regen — distinguish from regressions you introduce. Your new tests must pass on both. Do NOT leave `.agents/`/`AGENTS.md`/temp-build-dir/`.ma-agents.json` pollution staged.

### References
- 29.2 engine (the seam): `lib/knowledge-atlas/src/{generate.ts,types.ts,extract/slug.ts}` + story `29-2-…manifest.md`.
- Design reference (quality bar): `_bmad-output/planning-artifacts/briefs/brief-knowledge-atlas-2026-06-27/design-reference/elteye-rules-engine-report.html` — copy its tokens/components/polish.
- Architecture P5-7 (zero-dependency-first rendering, sanitization, PE) — `architecture.md` ~2528. Brief addendum (design reference, calibration). FR219/220/223/226/227/229/233/234, NFR64/69.

## Dev Agent Record
### Agent Model Used
Claude Opus 4.8 (1M context) — bmad-dev-story

### Completion Notes List
- Established the rendering framework owned by 29.3. `generate.ts` now calls
  `const written = renderSite(manifest, outDir)` in ONE localized region;
  guards/determinism/`writeManifest` preserved; `fileCount = written.length + 1`.
- `design-system.ts` exports the stable `DESIGN_SYSTEM_CSS` (shared contract for
  29.4) plus `STATUS_COLORS`/`STATUS_WASH_COLORS`: token set, status colors with
  `-wash` backgrounds, type scale, components (hero, card, status pill, table,
  code, callout, TOC, backlinks, doc-list, search UI), ~680px responsive
  collapse, `prefers-reduced-motion`, system fonts only, zero external URLs.
- `layout.ts` `pageShell({title, body, nav?, manifest, pageType?, scripts?})`:
  inlined `<style>`, skip-link, ARIA nav, PE-safe `<form>` search box, main,
  footer. Home passes NO scripts (keeps index.html JS/`src=`-free — 29.1 smoke).
- Reading views (`document.ts`): markdown-it → HTML, TOC via `headingToSlug`,
  heading-id anchors, status badges, entity linkify, sanitize, backlinks, and a
  self-contained plain-text mermaid figure. Also emits invisible entity-anchor
  targets so every `fileId#anchor` cross-link resolves on-page.
- Cross-linking (`linkify.ts`): entity tokens → `<a class="entity-link">`; never
  inside `<code>/<pre>/<a>`; resolves only to nodes whose fileId is a rendered
  doc page (kg-only nodes like `legacy-source` are not linked → no dead links).
  `sanitizeHtml` strips `<script>`, event handlers, `javascript:`,
  iframe/object/embed/form (NFR64).
- Backlinks (`backlinks.ts`): edges where `to===node.id`, deduped+sorted,
  "Referenced by" list; test proves symmetry with manifest edges.
- Home + health snapshot (`site.ts`): counts by kind, status distribution,
  orphan count (pure manifest read: nodes with no non-dangling edge). Links to
  `graph.html` ONLY if 29.4 has already written it; omits gracefully otherwise.
- Offline search (`search.ts`): lunr index built at generate time and embedded
  as `window.__ATLAS_SEARCH__` (never fetched); lunr RUNTIME vendored into the
  bundle at build time (`scripts/build-atlas.js` injects `__ATLAS_LUNR_JS__`,
  banner-stripped so no `http(s)://` leaks) and inlined into search.html. PE:
  no-JS note + full document list.
- Shared path helper `paths.ts` (`filePathToSlug`, `hrefToNode`) is the single
  source of truth for doc-page slugs/hrefs across site/linkify/backlinks/search.
- **Deviation (mermaid):** rendered as the story's explicitly-permitted
  plain-text fallback (styled `.mermaid-block` figure) rather than shipping the
  3.5 MB mermaid v11 ESM browser bundle. Committing 3.5 MB into `atlas.cjs` for
  a feature no fixture exercises would violate the zero-dependency-first /
  "heavy libs only where needed" invariant and bloat the drift-guarded bundle.
  No CDN, no fetch, no blank screen. `mermaid` was removed from devDependencies
  (unused at runtime). markdown-it + lunr remain devDependencies (build-time,
  esbuild-inlined). If full client-side mermaid is later required, it can be
  vendored as a build-time-injected asset the same way lunr is.
- Validation: `npm run typecheck:atlas` clean; `npm run build:atlas` updates
  `dist/atlas.cjs` (bundle-drift guard green). New `knowledge-atlas-render.test.js`
  27/27 pass; 29.1 smoke 26/26; 29.2 manifest 87/87. FULL `npm test` exits 0 (no
  pre-existing CRLF/`.agents` drift surfaced this run). Install/test pollution
  (`.agents/` regen, `AGENTS.md` backup, temp build dirs, `.ma-agents.json`)
  reverted/removed; working tree contains only intended changes.

### 29.4 integration seam (how graph/diagrams/orphans hook in)
- Import `DESIGN_SYSTEM_CSS` (and optionally `STATUS_COLORS`) from
  `./render/design-system.js`; build pages with `pageShell(...)` from
  `./render/layout.js` for a consistent shell/nav/footer/ARIA.
- Use `filePathToSlug`/`hrefToNode`/`docPageRelPath` from `./render/paths.js` so
  graph/orphan links target the same `docs/<slug>.html#anchor` pages.
- Wire 29.4 pages into `generate.ts` ADDITIVELY: write `graph.html` /
  `diagrams.html` / `orphans.html` into `outDir` BEFORE (or by extending) the
  `renderSite` call. `renderSite` already detects `graph.html` via
  `fs.existsSync(outDir/graph.html)` and adds the Home nav link when present, so
  writing graph.html before `renderSite` runs makes the home link appear
  automatically. Alternatively add pages after and append their relative paths
  to the returned list; keep `fileCount = written.length + 1`.
- The `generate.ts` edit is a single localized region → trivial merge with 29.4.

### File List
**Created (Story 29.3):**
- `lib/knowledge-atlas/src/render/design-system.ts`
- `lib/knowledge-atlas/src/render/layout.ts`
- `lib/knowledge-atlas/src/render/paths.ts`
- `lib/knowledge-atlas/src/render/linkify.ts`
- `lib/knowledge-atlas/src/render/backlinks.ts`
- `lib/knowledge-atlas/src/render/search.ts`
- `lib/knowledge-atlas/src/render/document.ts`
- `lib/knowledge-atlas/src/render/site.ts`
- `test/knowledge-atlas-render.test.js`

**Modified:**
- `lib/knowledge-atlas/src/generate.ts` (call `renderSite`; remove inline CSS/renderHtml)
- `scripts/build-atlas.js` (vendor lunr runtime as `__ATLAS_LUNR_JS__`, banner-stripped)
- `package.json` (devDeps: +markdown-it, +@types/markdown-it, +lunr; append render test to test chain)
- `package-lock.json` (dependency lock updates)
- `lib/knowledge-atlas/dist/atlas.cjs` (rebuilt committed bundle)

### Review fixes (edge-case-hunter, 2026-07-03)
- **[HIGH] Search-index `</script>` XSS** (`search.ts`): index + docs are now
  emitted via `JSON.stringify(...).replace(/</g,'\\u003c')`, so a `</script>`
  in any label/body can no longer break out of the embedded `<script>` (stays
  valid JSON, parses identically). Test added.
- **[HIGH] `vbscript:` href bypass** (`linkify.ts`): replaced the scheme
  denylist with a strict `isSafeUrl` ALLOWLIST — only relative/anchor/query
  URLs and `mailto:`/`tel:` pass; javascript:/vbscript:/data:/file:/any scheme
  are dropped. Test added.
- **[SHOULD] Silent lunr-missing degrade** (`build-atlas.js`): now `fail()`s
  (exit 1) if `lunr.min.js` is absent or empty after banner strip, enforcing the
  sealed-search invariant at build time.
- **[SHOULD] Slug collision** (`paths.ts`/`site.ts`): added deterministic
  `buildSlugMap(fileIds)`/`resolveSlug` — distinct fileIds that share a base
  slug get `-2`/`-3` suffixes; page writer, linkify, backlinks, search + no-JS
  fallback all derive the SAME map (search docs carry a resolved `page` field so
  the client links directly, no re-slugify). No doc silently overwritten. Test
  added (two colliding paths → two distinct pages).
- **[LOW] TOC anchor mismatch** (`document.ts`): `extractToc` now strips only
  backtick delimiters (keeps inline-code text) so its slug matches the heading
  id emitted by `addHeadingAnchors`.
- **[LOW] Dangling-source backlinks** (`backlinks.ts`): dangling refs (and
  sources with no rendered page) render as non-clickable muted text
  (`.backlink-dangling`, `aria-disabled`) — never a 404 link.
- **[LOW] Self-backlink** (`backlinks.ts`): `gatherBacklinks` skips
  `edge.from === nodeId` so a node is never listed as referencing itself.
- Re-validated: typecheck clean; `build:atlas` rebuilds dist/atlas.cjs; render
  30/30, smoke 26/26, manifest 87/87; FULL `npm test` exits 0. `generate.ts`
  renderSite edit remains one localized region; `renderSite` still
  `fs.existsSync`-detects `graph.html`. No `.agents/`/`AGENTS.md`/temp-build/
  `.ma-agents.json` pollution left.

### Change Log
- 2026-07-03 — Story 29.3 implemented: reading views, entity cross-linking,
  backlinks, offline lunr search, home + health snapshot, shared design system /
  layout / path framework. Status → review.
- 2026-07-03 — Addressed edge-case-hunter review: 2 HIGH (search-index XSS,
  vbscript href), 2 SHOULD (lunr-missing fail-loud, slug-collision map), 3 LOW
  (TOC anchor, dangling/self backlinks). Tests added; full suite green.
- 2026-07-03 — Addressed code-review: MF-1 (thread baseHref through pageShell so
  reading-view nav/search links are "../"-prefixed — no more docs/index.html
  404s), MF-2 (backlink fromRel now uses resolveSlug → docs/<slug>.html, not the
  raw manifest path; removes spurious ../.. in backlink hrefs — NOT fully
  covered by the batch-1 slug-map rework, the raw-path bug was separate), SF-1
  (search index now stores article-only plain text via
  renderDocumentPage → {html, articleText}; no nav/footer/TOC boilerplate),
  SF-3 (symmetry test now asserts exact sibling href, no ".."), SF-2 (rewrote
  stale mermaid JSDoc to describe the plain-text fallback actually shipped),
  N-1 (removed the unused duplicate renderSearchBoxHtml in search.ts; layout.ts
  is the single definition). Task 2.2 re-marked [~] (accepted deviation).
  Render 34/34, smoke 26/26, manifest 87/87; full npm test green.
