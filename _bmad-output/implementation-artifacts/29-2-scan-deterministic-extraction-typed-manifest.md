# Story 29.2: Authoritative Scan + Deterministic Entity Extraction → Typed Knowledge Manifest

Status: ready-for-dev

## Story

As **the Atlas engine**,
I scan a project's `_bmad-output`, deterministically extract the BMAD entity vocabulary, and build a **typed knowledge manifest** that is the single source of truth for rendering and a superset of `knowledge-graph.json`,
so that every view is driven by one consistent, incrementally-rebuildable model. (FR216, FR217, FR218, FR221, FR224, FR228, FR232)

This is the **discovery half** of the pipeline (Decision P5-7). It extends `buildManifest()` (seam established in 29.1) to actually scan, extract, and persist. The rendering half (29.3/29.4) consumes the manifest and needs no model and no filesystem access.

## Acceptance Criteria

1. **Given** a project `_bmad-output` tree
   **When** the scanner runs
   **Then** it enumerates all BMAD document types — planning artifacts (`product-brief*`, `*prd*`, `*architecture*`, `*epic*`, `briefs/`), implementation artifacts (stories `NN-M-slug.md`, `bug-*.md`, `epic-N-retrospective.md`, `sprint-status.yaml`, plus `done/` subfolder), `project-context.md`, and phase/stage reports — and **tolerates missing types without failing** (a project with only a PRD still produces a manifest).

2. **Given** each document
   **When** extraction runs (deterministic regex/parse, NO model)
   **Then** it extracts the entity vocabulary from frontmatter and body: `FR###`, `NFR##`, `F##`, `Epic N`, `Story N.M` (and `NN-M-slug`), `bug-<slug>`, `P#-#`, retrospectives (`epic-N-retrospective`), and lifecycle statuses (`backlog`/`ready-for-dev`/`in-progress`/`review`/`done`). Frontmatter YAML is parsed (js-yaml, bundled); body tokens are matched with anchored, well-tested regexes.

3. **Given** the extracted entities
   **When** the graph is built
   **Then** nodes are typed by kind (`capability`, `requirement`, `nfr`, `epic`, `story`, `bug`, `arch-decision`, `retrospective`) and edges typed by relationship (`implements`, `derives-from`/`refines`, `blocks`/`depends-on`, `validates`, `addressed-by`, `shipped-in`). Node identity uses the **P3-1 `file-id#anchor` scheme** (reuse the heading→anchor slug algorithm), so the manifest's `nodes`/`edges` are schema-compatible with — and a superset of — `knowledge-graph.json`.

4. **Given** a generate run
   **When** it completes
   **Then** the manifest is persisted as JSON under the output folder (`_bmad-output/knowledge-site/manifest.json`): a `meta` block (project, generatedAt, version, counts), a per-file record array (`{ path, contentHash, type, entities[], edges[] }`), and the normalized `nodes`/`edges` graph. The JSON is deterministic (sorted keys / stable ordering, LF, trailing newline).

5. **Given** a prior manifest exists
   **When** the engine re-runs
   **Then** change detection is by **content hash** (mtime only a pre-filter); only added/changed/removed files are reprocessed; deletions (in-manifest-but-gone) and renames (same content hash, new path) are reconciled against the prior manifest. The result is identical to a from-scratch build (incremental ≡ full).

6. **Given** `_bmad-output/knowledge-graph.json` is present
   **When** the manifest is built
   **Then** its nodes/edges are read and merged on `file-id#anchor` identity (**scan wins for on-disk truth**); when absent, the scan alone yields an equivalent manifest. (Full reconciliation hardening + provenance is Story 29.5 — keep this merge additive and identity-stable.)

7. **Given** identical inputs on different platforms
   **When** the manifest is generated
   **Then** output is **deterministic and cross-platform**: identical inputs produce identical manifests across Linux/Windows; Windows paths are normalized to POSIX-style forward-slash `file-id`s; CRLF inputs are normalized to LF **before hashing** (no CRLF-induced hash churn).

8. **Given** the test suite
   **When** `npm test` runs on Linux/CI and Windows
   **Then** it is green; tests cover: extraction of EACH entity type; tolerant scan of a missing-doc fixture; content-hash incremental diff (changed/added/removed/renamed); and `knowledge-graph.json` merge. The 29.1 smoke test still passes (manifest is additive).

## Tasks / Subtasks

### Task 1: Manifest types (AC: 3, 4) — extend `src/types.ts`
- [ ] 1.1 Add node/edge/manifest types WITHOUT breaking the 29.1 seam (extend `KnowledgeManifest`, don't replace). Suggested:
  ```ts
  export type NodeKind = 'capability'|'requirement'|'nfr'|'epic'|'story'|'bug'|'arch-decision'|'retrospective';
  export type EdgeKind = 'implements'|'derives-from'|'refines'|'blocks'|'depends-on'|'validates'|'addressed-by'|'shipped-in';
  export interface GraphNode { id: string; /* file-id#anchor */ kind: NodeKind; label: string; title?: string; status?: string; fileId: string; anchor?: string; }
  export interface GraphEdge { from: string; to: string; kind: EdgeKind; }
  export interface FileRecord { path: string; /* POSIX, relative to projectRoot */ contentHash: string; type: DocType; entities: string[]; edges: GraphEdge[]; }
  export type DocType = 'product-brief'|'prd'|'architecture'|'epics'|'brief'|'story'|'bug'|'retrospective'|'sprint-status'|'project-context'|'report'|'knowledge-graph'|'unknown';
  ```
  Extend `KnowledgeManifest` with `version: number`, `files: FileRecord[]`, `nodes: GraphNode[]`, `edges: GraphEdge[]`, `counts: Record<string, number>`. Keep `projectTitle/generatedAt/projectRoot/bmadOutputDir`.

### Task 2: Scanner (AC: 1, 7) — `src/scan/scanner.ts`
- [ ] 2.1 Enumerate files under `_bmad-output` recursively (include `done/`, `briefs/`, `planning-artifacts/`, `implementation-artifacts/`). EXCLUDE the output folder itself (`knowledge-site/`) and `knowledge-graph.html`. Tolerate a missing `_bmad-output` (return empty file list, manifest still valid).
- [ ] 2.2 Classify each file into a `DocType` by path + filename pattern (e.g. `sprint-status.yaml`→`sprint-status`; `NN-M-*.md`→`story`; `bug-*.md`→`bug`; `epic-N-retrospective.md`→`retrospective`; `*prd*`→`prd`; etc.). Unknown md files → `report`/`unknown` (still scanned, tolerated).
- [ ] 2.3 Compute a **POSIX-normalized relative path** (`path.relative(projectRoot, abs).split(path.sep).join('/')`) as the stable `file-id` base. Deterministic ordering: sort the file list by this path.

### Task 3: Content hashing + CRLF safety (AC: 5, 7) — `src/scan/hash.ts`
- [ ] 3.1 `contentHash(absPath)` = SHA-256 (Node `crypto`) of the file content with **CRLF normalized to LF first** (`buf.toString('utf-8').replace(/\r\n/g,'\n')`), so a Windows checkout and a Linux checkout of the same logical file hash identically. mtime is used ONLY as a cheap pre-filter, never as the identity.

### Task 4: Entity extraction (AC: 2, 3) — `src/extract/`
- [ ] 4.1 Frontmatter: split the leading `---\n…\n---` block (regex) and parse with `js-yaml` (`import * as yaml from 'js-yaml'` — esbuild inlines it into the sealed bundle; do NOT add a runtime dependency to the consuming project). Tolerate malformed YAML (skip, record nothing, never throw).
- [ ] 4.2 Body token regexes (anchored, unit-tested): `FR\d+`, `NFR\d+`, `\bF\d+\b` (capability), `Epic \d+`, `Story \d+\.\d+`, story-key `\d+-\d+-[a-z0-9-]+`, `bug-[a-z0-9-]+`, `P\d+-\d+` (arch decision), `epic-\d+-retrospective`, statuses. Capture the entity tokens per file (`FileRecord.entities`).
- [ ] 4.3 Reuse the **P3-1 heading→anchor slug algorithm** for `anchor` (lowercase, strip non-alnum→`-`, collapse dashes) so anchors match `knowledge-graph.json` and VSCode link resolution. Document the algorithm in code; add a focused unit test. (If a P3-1 reference implementation is not in the repo — Epic 19 is unmerged — implement the GitHub-style slug used by VSCode markdown anchors and note it.)

### Task 5: Graph builder (AC: 3, 6) — `src/graph/build.ts`
- [ ] 5.1 Materialize typed `GraphNode`s with `id = fileId#anchor` (the definition site of each entity — e.g. an `FR123` node is anchored at its definition in the PRD; a `Story 29.2` node at its story file). Deduplicate by id.
- [ ] 5.2 Derive typed `GraphEdge`s from co-occurrence + frontmatter relationships: story `implements` FR/NFR it references; epic→story membership (`derives-from`/contains); `blocks`/`depends-on` from "Blocked by"/"Depends on" prose; retro `validates`/`addressed-by`; "shipped vX" → `shipped-in`. Keep the mapping table explicit and tested. Edges reference node ids; dangling edges (to an unknown id) are recorded but flagged for the 29.4 orphan/gap view — do not drop silently.
- [ ] 5.3 Stable ordering: sort nodes by id, edges by `(from,to,kind)`, before persisting (determinism).

### Task 6: Manifest persistence + incremental diff (AC: 4, 5) — `src/manifest/`
- [ ] 6.1 `loadPriorManifest(outDir)` reads `manifest.json` if present (tolerate absent/corrupt → treat as no prior).
- [ ] 6.2 Incremental: build the new file list with hashes; for unchanged files (same path+hash) reuse the prior `FileRecord` (skip re-extraction); reprocess added/changed; drop removed; detect rename (hash present in prior under a different path). Assert `incremental ≡ full` in tests.
- [ ] 6.3 `writeManifest(outDir, manifest)` → `manifest.json` with **stable key order** and LF + trailing newline. Use a deterministic serializer (sort object keys) so byte output is reproducible.
- [ ] 6.4 Wire into `generate()`: after `buildManifest()` returns the rich manifest, persist it to `<outDir>/manifest.json` and bump `GenerateResult.fileCount` accordingly. The 29.1 `index.html` render still works (it only reads `projectTitle`/`generatedAt` for now; 29.3 will consume the rich fields).

### Task 7: knowledge-graph.json merge (AC: 6) — `src/graph/reconcile.ts`
- [ ] 7.1 If `<bmadOutputDir>/knowledge-graph.json` exists, parse its `nodes`/`edges` (P3-1 shape: `meta/nodes/edges`). Union into the scan graph on `file-id#anchor` id; **scan wins** on any field conflict for an id present in both. Nodes/edges present only in the JSON are kept (provenance-tagged minimally; full provenance is 29.5). Absent file → scan-only manifest (unchanged).

### Task 8: Tests (AC: 8) — `test/knowledge-atlas-manifest.test.js`
- [ ] 8.1 Fixtures under `test/fixtures/knowledge-atlas/`: extend the `minimal-project` and add a `rich-project` (PRD with FR/NFR, epics with Epic/Story, a story file, a bug file, a retrospective, sprint-status.yaml, a `knowledge-graph.json`) and a `missing-docs-project` (only a PRD).
- [ ] 8.2 Tests: each entity type extracted; tolerant scan of missing-docs fixture; content-hash incremental diff (mutate/add/remove/rename a file in a temp copy, assert reprocessing set + `incremental ≡ full`); CRLF vs LF copies hash identically; `knowledge-graph.json` merge (scan-wins) and absence (scan-only equivalent); cross-platform `file-id` is POSIX. Use `SOURCE_DATE_EPOCH` pin. Generate into a TEMP COPY (never mutate committed fixtures).
- [ ] 8.3 Append `&& node test/knowledge-atlas-manifest.test.js` to `package.json` `scripts.test`. Keep the 29.1 smoke test green. Rebuild `atlas.cjs` (`npm run build:atlas`) and confirm the bundle-drift smoke test passes.

## Dev Notes

### Where you are in the pipeline
You are the **discovery half**. Extend `buildManifest()` in `generate.ts` (currently returns a 4-field stub) into a full scan→extract→graph→reconcile orchestration, factored into `src/scan/`, `src/extract/`, `src/graph/`, `src/manifest/`. The **rendering half (`renderHtml`) must not be made to depend on the filesystem** — it consumes only the manifest. Do not break the 29.1 seam or the determinism contract (`resolveTimestamp`, `SOURCE_DATE_EPOCH`).

### Sealed packaging — no new consuming-project deps
`js-yaml` (and any parser) gets **bundled into `atlas.cjs` by esbuild** (`import` it; esbuild inlines). Do NOT add anything that requires the consuming project to `npm install`. After any `src/` change, re-run `npm run build:atlas` and commit `dist/atlas.cjs` (the smoke bundle-drift test enforces this). Keep `minify:false`. Markdown *rendering* libs (markdown-it) are a 29.3 concern — 29.2 needs only YAML + regex.

### Determinism is an invariant (NFR62), not a nicety
- Hash on CRLF-normalized content.
- `file-id` is POSIX forward-slash, relative to projectRoot.
- Sort everything (files, nodes, edges, object keys) before serialization.
- No `Date.now()`/`Math.random()` anywhere in discovery; timestamp only from `resolveTimestamp`.
- Manifest JSON: stable key order, LF, trailing newline. A from-scratch build and an incremental rebuild of the same tree must be byte-identical.

### Node identity / anchors (P3-1)
Reuse the `file-id#anchor` scheme. Epic 19 (which defined P3-1's emitToGraph + `knowledge-graph.json`) is NOT merged, so there is no in-repo reference implementation — implement the GitHub/VSCode markdown heading-slug algorithm (lowercase; remove punctuation except `-` and spaces; spaces→`-`; collapse repeats) and document that 29.5 will reconcile against the real `knowledge-graph.json` shape. Keep identity STABLE so a later `emitToGraph` rollout needs no Atlas change.

### Entity vocabulary + folder layout (from brief addendum — confirmed by repo scan)
| Entity | Token | Source |
|---|---|---|
| Functional Req | `FR###` | prd.md / epics.md |
| Non-Functional Req | `NFR##` | prd.md / epics.md |
| Capability | `F##` → Epic# | prd.md |
| Epic | `Epic ##` | epics.md |
| Story | `Story N.M` / `NN-M-slug.md` | sprint-status.yaml + story files |
| Bug | `bug-<slug>` | implementation-artifacts/ |
| Arch Decision | `P#-#` | architecture.md |
| Retrospective | `epic-N-retrospective.md` | implementation-artifacts/ |
| Status | backlog→ready-for-dev→in-progress→review→done | sprint-status.yaml |

Layout: `_bmad-output/planning-artifacts/{prd.md,epics.md,architecture.md,product-brief-*,briefs/}`; `_bmad-output/implementation-artifacts/{sprint-status.yaml,NN-M-slug.md,bug-*.md,epic-N-retrospective.md,done/}`; `_bmad-output/project-context.md`. Cross-ref prose patterns: "FR207, NFR56"; "Blocked by: Story 27.1"; "Architecture Decision P5-5"; "shipped v3.13.0".

### Windows/CRLF + suite-health gotcha (known)
`npm test` can exit nonzero on Windows from PRE-EXISTING MIL-498 template CRLF drift and regenerates `.agents/`. Distinguish pre-existing failures from regressions you introduce; CI/Linux is source of truth. Your new tests must pass on both. Do NOT leave `.agents/`/`AGENTS.md`/temp-build-dir pollution in the working tree for the coordinator to commit.

### Files expected
```
lib/knowledge-atlas/src/types.ts                 (extend)
lib/knowledge-atlas/src/generate.ts              (buildManifest orchestration + persist)
lib/knowledge-atlas/src/scan/{scanner.ts,hash.ts}
lib/knowledge-atlas/src/extract/{frontmatter.ts,entities.ts,slug.ts}
lib/knowledge-atlas/src/graph/{build.ts,reconcile.ts}
lib/knowledge-atlas/src/manifest/{persist.ts,incremental.ts}
lib/knowledge-atlas/dist/atlas.cjs               (rebuild + commit)
test/knowledge-atlas-manifest.test.js
test/fixtures/knowledge-atlas/{rich-project,missing-docs-project}/...
```
Modified: `package.json` (test chain).

### References
- Story 29.1 (the seam you extend): `_bmad-output/implementation-artifacts/29-1-engine-skeleton-packaging-skill-entrypoint.md` and `lib/knowledge-atlas/src/{generate.ts,types.ts}`.
- Architecture Decision P5-7 (manifest = single source of truth, superset of knowledge-graph.json, discovery↔rendering contract) — `architecture.md` ~line 2528.
- Epic 29 / Story 29.2 — `epics.md` ~line 5132.
- Brief addendum (manifest keystone, discovery model, entity vocabulary) — `briefs/brief-knowledge-atlas-2026-06-27/addendum.md`.
- FR216/217/218/221/224/228/232.

## Dev Agent Record
### Agent Model Used
_to be filled by dev agent_
### Completion Notes List
### File List
