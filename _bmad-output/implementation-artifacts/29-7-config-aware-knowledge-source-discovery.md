# Story 29.7: Config-Aware Knowledge-Source Discovery

Status: review

## Story

As a **ma-agents user whose project keeps its BMAD knowledge in configured folders** (not only `_bmad-output`),
I want the Atlas to scan **every knowledge source defined in the project's BMAD setup** — the default `_bmad-output` **and/or** configured folders like `planning_artifacts` / `knowledgebase_path` — so the Atlas covers my actual knowledge, wherever the setup says it lives.

**Why:** real projects (e.g. Prophesee) set `_bmad/bmm/config.yaml` `planning_artifacts: "D:/…/prophesee-knowledge"` OUTSIDE `_bmad-output`. The current engine hard-scans `<root>/_bmad-output` only, so the PRD/architecture/requirements are invisible and the Atlas is empty of them. Post-fix, the Atlas must discover sources from config. (Follow-up to Epic 29; found on a real install.)

## Acceptance Criteria

1. **Given** a project with `_bmad/bmm/config.yaml`
   **When** the Atlas runs
   **Then** it discovers knowledge sources from config — `output_folder` (default `_bmad-output`), `planning_artifacts`, `implementation_artifacts`, `knowledgebase_path` — resolves each, and scans the **union** of all that exist (deduped). Documents from a configured external folder (e.g. `prophesee-knowledge/planning/prd.md`) appear in the manifest, are entity-extracted, and render as reading views with resolving links.
2. **Given** config values with `{project-root}` placeholders and/or surrounding quotes (real example: `planning_artifacts: "\"D:/Code/Prophesys/prophesee-knowledge\""`, `implementation_artifacts: "{project-root}/_bmad-output/implementation-artifacts"`)
   **When** they are resolved
   **Then** `{project-root}` → the project root, and surrounding/embedded quotes are stripped; the resolved absolute path is used. Malformed/missing config is tolerated (fall back to `<root>/_bmad-output` — unchanged behavior).
3. **Given** no `_bmad/bmm/config.yaml` (or no relevant keys)
   **When** the Atlas runs
   **Then** behavior is **identical to today**: scan `<root>/_bmad-output` only, with the SAME `fileId`s (relative-to-projectRoot). All existing fixtures/tests (which have no bmm config) produce byte-identical output. **This is a hard backward-compat requirement.**
4. **Given** sources scanned from multiple roots
   **When** `fileId`s are assigned
   **Then** identity is **deterministic and machine-independent**: a source UNDER the project root keeps its projectRoot-relative `fileId` (e.g. `_bmad-output/...`); a source OUTSIDE the project root uses `<source-basename>/<path-relative-to-source>` (e.g. `prophesee-knowledge/planning/prd.md`) — never an absolute path or `../`. Sources equal to / nested under another scanned source are deduped (e.g. `implementation_artifacts` under `_bmad-output`, or `planning_artifacts`==`knowledgebase_path`, are scanned once). Two external sources sharing a basename are disambiguated deterministically.
5. **Given** a re-run after docs were removed/renamed
   **When** the Atlas regenerates
   **Then** the output directory (`<output_folder>/knowledge-site/`) is **purged of stale generated files** before writing, so removed/renamed source docs leave no orphaned pages. (Non-destructive to SOURCE — only the generated site dir is cleared.)
6. **Given** the output location
   **When** the site is written
   **Then** it goes to `<projectRoot>/<output_folder>/knowledge-site/` (honor `output_folder` from config; default `_bmad-output`).
7. **Given** the suite
   **When** `npm test` runs (Linux/CI + Windows)
   **Then** green; new tests cover config discovery (quote/placeholder parsing, union+dedup, external-source fileId, backward-compat no-config, stale-output purge). All prior atlas suites (incl. link-integrity, determinism) stay green; determinism holds.

## Tasks / Subtasks

### Task 1: Config resolver (AC: 1, 2, 6) — `src/scan/config.ts` (new)
- [x] 1.1 `resolveKnowledgeSources(projectRoot): { sources: {absPath, fileIdPrefix}[], outputFolder }`:
  - Read `<projectRoot>/_bmad/bmm/config.yaml` via js-yaml (bundled). Tolerate absent/malformed → return `{ sources: [defaultOutputDir], outputFolder: '_bmad-output' }`.
  - Extract `output_folder` (default `_bmad-output`), `planning_artifacts`, `implementation_artifacts`, `knowledgebase_path`.
  - **Value normalization:** `String(v).trim()`, replace `{project-root}` (and `{project_root}`) with `projectRoot`, strip surrounding/embedded quotes: `.replace(/^["']+|["']+$/g, '')`, normalize separators. Resolve to absolute (relative values resolve from projectRoot).
  - Candidate sources = default `<projectRoot>/<output_folder>` + the three configured paths (that are set + exist). Compute each `fileIdPrefix` per Task 2 rules.
  - **Dedup:** drop any source whose abs path equals or is nested under another kept source (keep the broadest). Sort sources deterministically (by fileIdPrefix).

### Task 2: Multi-source scan + stable fileIds (AC: 1, 3, 4) — extend `src/scan/scanner.ts`
- [x] 2.1 Add `scanSources(sources: {absPath, fileIdPrefix}[], outDir): ScannedFile[]` that walks each source and produces `fileId = fileIdPrefix ? fileIdPrefix + '/' + relToSource : relToSource`. **fileIdPrefix rule:** for a source at `<projectRoot>/X` (under root), prefix = the projectRoot-relative path of the source (so `_bmad-output` → files get `_bmad-output/...`, IDENTICAL to today). For a source OUTSIDE projectRoot, prefix = `path.basename(source)` (e.g. `prophesee-knowledge`); if that basename is already used by another source, append `-2`/`-3` deterministically. Keep the existing per-file logic (POSIX, outDir-exclude with the no-trailing-slash fix, binary skip, CRLF/BOM hash, classifyFile). Sort merged results by fileId; dedup identical fileIds (first wins, deterministic).
- [x] 2.2 Keep the existing `scanFiles(projectRoot, bmadOutputDir, outDir)` working (or reimplement it as `scanSources([{absPath: bmadOutputDir, fileIdPrefix: relPath(projectRoot,bmadOutputDir)}], outDir)`) so nothing else breaks. `classifyFile` still keys off the fileId tail (path patterns) — verify external planning docs (e.g. `prophesee-knowledge/planning/prd.md`) classify correctly (prd/architecture/etc.); the `/planning/` and filename patterns should still match — adjust `classifyFile` patterns if they over-anchor on `planning-artifacts/`.

### Task 3: Wire into generate() (AC: 1, 5, 6) — `generate.ts`
- [x] 3.1 In `buildManifest`/`generate`: call `resolveKnowledgeSources(projectRoot)`; compute `outDir = <projectRoot>/<outputFolder>/knowledge-site`; scan via `scanSources(sources, outDir)`. Preserve the projectRoot absolute/exists guards + the outDir-escape guard (outDir still under projectRoot via output_folder).
- [x] 3.2 **Purge stale output (AC5):** before writing, remove the existing `knowledge-site/` dir contents (recreate empty), then write. Only the generated dir — never touch sources. Guard: only purge a dir literally named `knowledge-site` under `<output_folder>` (defensive: never rm anything else). **Post-review hardening (MUST-FIX #1):** the purge is skipped (with a stderr warning) whenever a configured knowledge source resolves AT or UNDER the output dir — such a source is also dropped from scanning in `resolveKnowledgeSources` with a warning, so a user knowledge folder living at that path is never destroyed. **(SHOULD-FIX #4):** only the DEFAULT `<output_folder>/knowledge-site` is purged; a caller-supplied `--out` override is intentionally NOT purged.
- [x] 3.3 The reconcile step still reads `knowledge-graph.json` from `<projectRoot>/<output_folder>/knowledge-graph.json` (or the default). Keep it working; absent → unchanged.

### Task 4: Skill doc (AC: 1) — `bmad-knowledge` SKILL.md (both copies)
- [x] 4.1 Note that the Atlas now scans the project's configured knowledge sources (from `_bmad/bmm/config.yaml`: `planning_artifacts`/`implementation_artifacts`/`knowledgebase_path`) in addition to `_bmad-output`, and writes the site under `<output_folder>/knowledge-site/`. The engine does the discovery — the skill still just passes the project root. Keep the injection-safe open step.

### Task 5: Tests (AC: 7) — `test/knowledge-atlas-config-scan.test.js` (new) + fixtures
- [x] 5.1 Fixture `config-project`: a project root with `_bmad/bmm/config.yaml` whose `planning_artifacts` points (quote-wrapped + a sibling absolute or a `{project-root}`-relative external dir) to an external `knowledge/` folder containing a PRD (with FR/NFR) + architecture (P#-#), and an `_bmad-output/implementation-artifacts/` with a story that references those FRs. Assert: external planning docs are scanned + classified (prd/architecture); FR/NFR/P#-# entities extracted from them; a story→FR `implements` edge spans the two sources; reading views + links resolve (reuse link-integrity checks). Use a `{project-root}`-relative external dir so the fixture is portable (no absolute machine path).
- [x] 5.2 Unit tests for the resolver: `{project-root}` substitution; quote-stripping (`"\"…\""` → `…`); missing config → default `_bmad-output` only; union+dedup (implementation_artifacts nested under _bmad-output scanned once; planning==knowledgebase deduped); external-source fileId = `<basename>/…` (no absolute/`..`); basename collision disambiguation.
- [x] 5.3 Backward-compat: the existing `rich-project`/`minimal-project` (no bmm config) produce **byte-identical** output to before (same fileIds). Determinism: two different projectRoot paths → byte-identical (external-source fileIds use basename, not absolute).
- [x] 5.4 Stale-output purge: generate; delete a source doc; regenerate; assert the removed doc's page is gone and no orphaned pages remain.
- [x] 5.5 Append the new test file to `package.json` `scripts.test`. Rebuild `atlas.cjs`; all prior atlas suites (smoke/manifest/render/graph/packaging/offline-safety/reconcile/determinism/degradation/realproject/link-integrity) + full `npm test` green.

## Dev Notes
### Current state you build on
- `scanFiles(projectRoot, bmadOutputDir, outDir)` (scanner.ts) walks one dir, fileId = relative-to-projectRoot, excludes outDir, skips binary, CRLF/BOM hash, `classifyFile(fileId)`.
- `generate.ts` hardcodes `bmadOutputDir = <root>/_bmad-output`, `outDir = <bmadOutputDir>/knowledge-site`, and does NOT purge outDir before writing (stale pages accumulate — real bug seen on Prophesee: 17 stale doc pages lingered after content moved).
- js-yaml is already bundled (used by frontmatter parsing) — reuse it for config.

### Real config to handle (Prophesee — the motivating case)
```
# _bmad/bmm/config.yaml
planning_artifacts: "\"D:/Code/Prophesys/prophesee-knowledge\""     # double-quoted, external, absolute
implementation_artifacts: "{project-root}/_bmad-output/implementation-artifacts"  # placeholder, nested under _bmad-output
knowledgebase_path: "\"D:/Code/Prophesys/prophesee-knowledge\""      # == planning_artifacts (dedup!)
output_folder: _bmad-output
```
Expected resolved source set: `{ <root>/_bmad-output (default), D:/Code/Prophesys/prophesee-knowledge }` — implementation_artifacts deduped (nested under _bmad-output), planning==knowledgebase deduped to one external source with fileIdPrefix `prophesee-knowledge`.

### Invariants (do NOT regress)
- **Backward-compat (AC3) is a hard gate**: no-config projects must produce byte-identical output/fileIds. Existing determinism/manifest/link-integrity suites must stay green unchanged.
- Determinism (NFR62): external-source fileIds use folder BASENAME + relpath (never absolute), sorted, LF, SOURCE_DATE_EPOCH. discovery↔rendering seam intact. Sealed/offline (no new dep; js-yaml already bundled).
- Non-destructive: purge ONLY the generated `knowledge-site/` dir; never a source.
- Windows/CRLF gotcha; don't leave `.agents/`/`AGENTS.md`/temp-build-dir/`.ma-agents.json` pollution staged. Rebuild + commit `dist/atlas.cjs` (drift test enforces it).

### Files expected
```
lib/knowledge-atlas/src/scan/config.ts        (new — resolveKnowledgeSources)
lib/knowledge-atlas/src/scan/scanner.ts       (add scanSources; keep scanFiles)
lib/knowledge-atlas/src/generate.ts           (config discovery + multi-source scan + purge outDir + output_folder)
lib/knowledge-atlas/src/types.ts              (source descriptor type if needed)
lib/knowledge-atlas/dist/atlas.cjs            (rebuild + commit)
lib/bmad-extension/skills/bmad-knowledge/SKILL.md + skills/bmad-knowledge/SKILL.md  (doc note)
test/knowledge-atlas-config-scan.test.js      (new) + test/fixtures/knowledge-atlas/config-project/...
package.json                                  (test chain)
```

### References
- Real project: `D:/Code/Prophesys/_bmad/bmm/config.yaml`. Epic 29 P5-7 (authoritative scan). BMAD config path convention (Epic 16 multi-repo layout; Story 27.15 config-path convention). FR216 (scan `_bmad-output` — now generalized to configured sources).

## Dev Agent Record
### Agent Model Used
Claude Opus 4.8 (claude-opus-4-8)

### Completion Notes List
- `resolveKnowledgeSources()` implements the exact normalization order from Task 1.1 (trim → `{project-root}`/`{project_root}` substitution → quote-strip → resolve-absolute), tolerating missing/malformed `_bmad/bmm/config.yaml` by falling back to the single default `_bmad-output` source.
- `scanSources()` is the single implementation now shared by both multi-source and single-source scanning; `scanFiles()` is a 3-line wrapper calling `scanSources()` with one source — this by-construction guarantees AC3 byte-identity (no-config path takes the identical code path as the original `scanFiles()`).
- Found and fixed a latent bug while implementing AC1: `render/document.ts::renderDocumentPage()` recovered a file's on-disk path via `path.join(projectRoot, fileRec.path)`, which is WRONG for a file scanned from a source outside `projectRoot` (fileId is `<basename>/<relPath>`, not projectRoot-relative). Added an optional `resolveAbsPath` fileId→absPath resolver (built by `generate()` from the same scan that already has the real absPath for every file) threaded through `renderSite()` → `renderDocumentPage()`, with a fallback to the historical `path.join(...)` behavior when omitted — so external-source reading views render their real content instead of "(File not found)".
- Stale-output purge (AC5) is ordered deliberately: `buildManifest()` reads the PRIOR `manifest.json` for the incremental diff BEFORE `generate()` purges `knowledge-site/`, so the incremental-extraction optimization (skip re-parsing unchanged files) is preserved; the purge only removes the previous run's WRITTEN pages right before the fresh render, guarded to only ever `rm` a directory literally named `knowledge-site`.
- `classifyFile()` needed no changes — its patterns are basename/substring-based (not anchored to `planning-artifacts/`), so external docs like `<basename>/planning/prd.md` classify correctly already.
- Manifest schema (`KnowledgeManifest`/`FileRecord`) was deliberately left unchanged — no `sources`/`absPath` field was added to anything that gets persisted to `manifest.json`, to avoid any risk of altering the no-config manifest shape (AC3).
- Backward-compat was proven two ways: (1) a scripted before/after byte-for-byte comparison of the pre-change committed `atlas.cjs` vs the new bundle across all 4 no-config fixtures (rich/minimal/degraded/missing-docs-project) — 100% byte-identical; (2) a permanent regression test asserting the exact fileId set for rich-project/minimal-project.
- New fixture pair `config-project` + `config-project-knowledge` (sibling dirs) mirrors the real Prophesee config shape (double-quote-wrapped external path, `{project-root}`-relative for portability, `implementation_artifacts` deliberately nested under the default source to exercise dedup).

### Adversarial-review remediation (post-first-pass; all NO-GO items fixed)
- **MUST-FIX #1 (data-loss purge):** `resolveKnowledgeSources` now drops any candidate source that resolves to the output dir (`<output_folder>/knowledge-site`) or nested under it, with a `[atlas] WARN: knowledge source <path> overlaps the output dir <outDir> — skipped` stderr warning, and returns a new `outputOverlap` flag. `generate()` skips the `fs.rmSync` purge whenever `outputOverlap` is set OR (defense-in-depth) any resolved source equals/lives under the actual outDir — printing a "refusing to purge … data-loss guard" warning. Net: generated pages are still purged in the normal case, but a real knowledge source at/under that path is never scanned-then-deleted. New regression test: source == `_bmad-output/knowledge-site` → user file survives two runs + is warned + not ingested.
- **MUST-FIX #2 (silent internal↔external fileId collision):** prefix disambiguation now considers ALL sources (internal under-root prefixes AND external basenames), not just external-vs-external. On any prefix collision, sources are processed in deterministic absPath order; the first keeps the bare prefix and each subsequent collider gets the lowest free `-N` suffix. Prevents `scanSources`' dedup-by-fileId from silently dropping a document. New test: internal `docs` + external basename `docs`, each with a file → BOTH present with distinct fileIds.
- **SHOULD-FIX #3 (walkDir exclusions — the real `.git` Prophesee bug):** `walkDir` now skips `.git`, `node_modules`, `.hg`, `.svn`, `.idea`, `.vscode`, `knowledge-site`, and ANY dot-directory, across all sources. Re-verified the 4 no-config fixtures remain byte-identical (they contain no such dirs). New test: a source with `.git/`, `node_modules/`, `.vscode/`, `.hidden-dir/` → none of their files/entities appear; real docs still do.
- **SHOULD-FIX #4 (doc):** noted (SKILL.md + Task 3.2) that `--out` overrides are intentionally excluded from the AC5 purge — only the default `<output_folder>/knowledge-site` is purged.
- **NICE-TO-HAVE #5:** config values are now validated as genuine strings before use (`typeof raw === 'string'`); a YAML list/number/bool/mapping value is ignored (falls back) instead of being `String()`-coerced into a bogus folder name.

### File List
- `lib/knowledge-atlas/src/scan/config.ts` (new) — `resolveKnowledgeSources()`
- `lib/knowledge-atlas/src/scan/scanner.ts` — added `scanSources()`; `scanFiles()` reimplemented on top of it
- `lib/knowledge-atlas/src/generate.ts` — config discovery, multi-source scan, stale-output purge, `output_folder` honored, fileId→absPath resolver wiring
- `lib/knowledge-atlas/src/render/document.ts` — `renderDocumentPage()` accepts an optional `resolveAbsPath` resolver (external-source rendering fix)
- `lib/knowledge-atlas/src/render/site.ts` — `renderSite()` accepts and forwards `resolveAbsPath`
- `lib/knowledge-atlas/src/types.ts` — added `KnowledgeSource` type
- `lib/knowledge-atlas/dist/atlas.cjs` — rebuilt (committed bundle)
- `lib/bmad-extension/skills/bmad-knowledge/SKILL.md` — doc note on config-aware discovery + `output_folder`
- `skills/bmad-knowledge/SKILL.md` — same doc note (CRLF-preserved copy)
- `lib/bmad-extension-plugin/skills/bmad-knowledge/SKILL.md` — regenerated via `npm run build:plugin` (mirrors the source above)
- `test/knowledge-atlas-config-scan.test.js` (new) — 27 tests covering AC1–AC6
- `test/fixtures/knowledge-atlas/config-project/` (new fixture)
- `test/fixtures/knowledge-atlas/config-project-knowledge/` (new fixture, external sibling source)
- `package.json` — appended the new test file to the `test` script chain
