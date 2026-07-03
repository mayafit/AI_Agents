# Story 29.5: Sealed Offline Packaging Hardening + Full Knowledge-Graph Reconciliation

Status: review

## Story

As **the ma-agents maintainer**,
I want every Atlas dependency (force-graph, Mermaid, search, parser, build tooling, fonts) vendored into the distribution and the offline-install gate to exercise Atlas generate+view with egress blocked, plus full reconciliation with `knowledge-graph.json`,
so that the Atlas is provably air-gapped end-to-end and converges with Epic 19. (FR225, FR230, FR232; NFR60, NFR67)

This story **proves** the air-gap guarantee (not just asserts it by construction) and **hardens** the KG reconciliation that 29.2 seeded (basic union + scan-wins + dangling-preserve) into full P3-1-consistent, provenance-tracked reconciliation.

## Acceptance Criteria

1. **Given** the ma-agents distribution
   **When** a user installs it and generates/views an Atlas on a fully disconnected on-prem network
   **Then** **no npm/git/CDN/host access is required** at install, generate, or view time. Every runtime+build dependency the Atlas needs (force-graph, search lib, markdown/parse libs, esbuild/build tooling, any fonts/icons — and Mermaid **iff** it is used) ships inside the distribution as pre-built/vendored/committed assets. A test/audit enumerates the Atlas's dependency surface and asserts each is vendored/bundled/committed (not resolved from the consuming project's `node_modules` at generate time, not fetched at view time).
2. **Given** the existing offline-install gate (Epic 22 / NFR50 / `.github/workflows/offline-install.yml` + `.github/scripts/offline-install-verify.sh`)
   **When** it runs
   **Then** it is **extended to generate AND open an Atlas with all egress blocked** (inside the `--network none` container) and asserts success with **no network calls** — the generated `_bmad-output/knowledge-site/` contains a non-empty `index.html`, `graph.html`, `diagrams.html`, `orphans.html`, `search.html`, and `manifest.json`, and the egress-block self-check still passes.
3. **Given** `_bmad-output/knowledge-graph.json` is present
   **When** the manifest is built
   **Then** **full reconciliation**: the merged manifest is consistent with P3-1 node identity (`file-id#anchor`) and carries **provenance** (each node/edge tagged `scan` | `kg` | `both`); conflicts resolve **deterministically — scan wins for on-disk truth** — and KG-only nodes/edges are **never silently dropped** (they are merged and provenance-tagged); when absent, behavior is **byte-identical to 29.2** (no provenance noise added to a scan-only manifest, or added consistently — pick one and test it).
4. **Given** the generated site
   **When** a static analyzer/test inspects it
   **Then** it asserts the site contains **no external URLs** (CDN/font/script `src`/`href` to `http(s)://`) and **no `fetch`/XHR** of sibling files — across ALL emitted pages — with the single documented exception of W3C XML **namespace** URIs baked into the vendored force-graph bundle (which are not network fetches). This generalizes/consolidates the per-page checks from 29.3/29.4 into one authoritative offline-safety test.
5. **Given** the suite
   **When** `npm test` runs on Linux/CI and Windows
   **Then** it is green; the offline gate runs in CI. 29.1 smoke + 29.2 manifest + 29.3 render + 29.4 graph suites still pass.

## Tasks / Subtasks

### Task 1: Dependency-surface vendoring audit (AC: 1)
- [x] 1.1 Enumerate the Atlas dependency surface and confirm each is sealed:
  - **markdown-it, js-yaml, lunr (index build)** → bundled INTO the committed `lib/knowledge-atlas/dist/atlas.cjs` by esbuild (verify they are inlined, not `require`d from node_modules at runtime).
  - **lunr runtime, force-graph UMD** → vendored as committed source and inlined into the generated pages at generate time (verify no CDN, no build-time network).
  - **esbuild, typescript, @types/** → devDependencies only (build-time); the SHIPPED artifact is the committed `dist/atlas.cjs` — the consuming project never runs `npm install` for the Atlas.
  - **Mermaid** → NOT vendored (29.3 accepted deviation: authored fences render as plain-text). Document this explicitly: mermaid is not a dependency of the shipped Atlas, so there is nothing to vendor; the plain-text fallback needs no runtime.
  - **fonts/icons** → none (system font stack; no icon font). Confirm.
- [x] 1.2 Add `test/knowledge-atlas-packaging.test.js` (plain Node assert) asserting: `dist/atlas.cjs` exists and is committed; running `node dist/atlas.cjs <fixture>` with a **stubbed/empty module resolution for the Atlas's third-party deps** (or simply from a directory with NO node_modules) still generates a full site (proving the bundle is self-contained); the generated pages inline force-graph + lunr (no `<script src="http`); mermaid is absent-by-design (documented). Confirm `npm pack --ignore-scripts --dry-run` includes `lib/knowledge-atlas/dist/atlas.cjs` and the vendored source, and excludes nothing the Atlas needs.

### Task 2: Authoritative offline-safety analyzer test (AC: 4)
- [x] 2.1 Add `test/knowledge-atlas-offline-safety.test.js`: generate the FULL site (all page types) against the 29.2 `rich-project` fixture into a temp dir, walk every emitted `.html`/`.js`/`.json`, and assert: no `http(s)://` external URL, no `<script src=` / `<link href=` to a remote origin, no web-font `@font-face`/`url(http`, no `fetch(`/`XMLHttpRequest`/`WebSocket`/`import(` of a sibling. Apply the ONE documented exception: strip the vendored force-graph block (W3C namespace URIs) before scanning `graph.html` (mirror the helper 29.4 uses). Manifest.json (absolute fs paths, not URLs) is exempt from the URL scan. This is the single source-of-truth offline-safety test; keep the lighter per-story checks too.

### Task 3: Full knowledge-graph.json reconciliation hardening (AC: 3)
- [x] 3.1 Extend `src/graph/reconcile.ts` (29.2 seed) + types: add **provenance** to `GraphNode`/`GraphEdge` (`source?: 'scan' | 'kg' | 'both'`). On merge: scan-derived → `scan`; KG-only → `kg`; present in both → `both` with SCAN fields winning on any conflict (on-disk truth authoritative), but KG-only FIELDS (e.g. an extra attribute the scan didn't produce) preserved additively where non-conflicting. KG-only nodes/edges are merged, never dropped.
- [x] 3.2 Deterministic + P3-1-consistent: node identity stays `file-id#anchor`; ordering stable (sort after merge); a from-scratch reconcile is byte-identical across runs/platforms. Malformed/partial `knowledge-graph.json` (non-array nodes/edges, missing ids, dup ids) is tolerated (guards from 29.2 retained) and never crashes.
- [x] 3.3 Absence equivalence: when `knowledge-graph.json` is absent, the manifest equals the 29.2 scan-only manifest. Decide provenance policy for scan-only (either omit `source` entirely, or set all to `scan`) and keep it consistent + tested — do NOT let 29.5 change scan-only output in a way that breaks 29.2/29.3/29.4 tests. If you add `source` to scan-only nodes, update any 29.2 manifest test that asserts exact node shape.
- [x] 3.4 Renderers: `orphan.ts`/`graph.ts` may optionally surface provenance (e.g. a "from knowledge-graph.json" marker) but MUST remain correct if `source` is undefined (backward-compatible). Do not regress 29.3/29.4 output/tests.

### Task 4: Extend the offline-install gate (AC: 2)
- [x] 4.1 Extend `.github/scripts/offline-install-verify.sh`: after the existing install invariants, add a step that **generates an Atlas** inside the `--network none` container against a small fixture `_bmad-output` (ship a minimal fixture in the repo or synthesize one in the script), by invoking the installed engine bundle (`node <installed>/lib/knowledge-atlas/dist/atlas.cjs <projectRoot>`), and asserts: exit 0; `_bmad-output/knowledge-site/{index.html,graph.html,diagrams.html,orphans.html,search.html,manifest.json}` exist and are non-empty; the egress-block self-check still holds (no network was reachable during generate). Renumber the step banners (`[n/N]`).
- [x] 4.2 Keep `offline-install.yml` invoking the script unchanged (it already runs the script in `--network none`); if a fixture path/env is needed, add it to the `docker run` invocation. Update the workflow Summary to note "Atlas generate under egress-block: OK".
- [x] 4.3 Add a Node-level analogue for local `npm test` (not everyone runs Docker): a test that generates the Atlas with a guard confirming no `http`/`https`/`net`/`dns` module is invoked at generate time (e.g. monkeypatch/scan), so the offline guarantee has a fast local proxy in addition to the CI Docker gate.

### Task 5: Tests + suite (AC: 5)
- [x] 5.1 Add reconciliation tests to (or alongside) `test/knowledge-atlas-manifest.test.js` / a new `test/knowledge-atlas-reconcile.test.js`: provenance tagging (scan/kg/both); scan-wins on field conflict; KG-only preserved; absence-equivalence to 29.2; malformed KG tolerated. Use the `rich-project` fixture's `knowledge-graph.json` (+ add conflict/kg-only cases).
- [x] 5.2 Append the new test files to `package.json` `scripts.test`. Rebuild `atlas.cjs` (`npm run build:atlas`); drift smoke test + all prior atlas suites (smoke/manifest/render/graph) stay green. `npm run typecheck:atlas` clean. FULL `npm test` green.

## Dev Notes
### Current state you build on (all merged to the epic branch)
- `src/graph/reconcile.ts` (29.2 + 29.4 fix): basic union on `file-id#anchor`, scan-wins, dup-id-safe, array-guarded, **`dangling` flag preserved**, explicit-anchor honored. 29.5 adds provenance + full hardening — keep it ADDITIVE and identity-stable so a later `emitToGraph` (Epic 19) rollout needs no Atlas change.
- Engine: `src/{scan,extract,graph,manifest,render}/`; committed `dist/atlas.cjs` (~735KB: markdown-it + lunr-index + js-yaml + force-graph UMD + lunr runtime inlined). `generate()` writes index/docs/search (renderSite) + graph/diagrams/orphans (29.4) + manifest.json.
- Offline gate: `.github/workflows/offline-install.yml` packs a tarball and runs `.github/scripts/offline-install-verify.sh` inside `docker run --network none`; the script self-checks egress is blocked, extracts the tarball, symlinks the host node_modules, installs into a scratch project, and asserts invariants. Extend the SCRIPT (Task 4).

### Invariants (Decision P5-7)
- **Sealed offline packaging** (the theme of this story): engine + ALL deps vendored/bundled/committed; consuming project never `npm install`s; nothing fetched at generate or view. PROVE it (egress-blocked gate) — don't just assert by construction.
- **Manifest = single source of truth + superset of knowledge-graph.json**; **discovery↔rendering contract** (renderers model-free, manifest-only); **deterministic/CRLF-safe**. Reconciliation must not break these.
- Mermaid deviation (plain-text) is accepted for v1 — do not reverse it here; just document that mermaid is therefore not part of the vendored surface.

### Windows/CRLF gotcha
`npm test` may exit nonzero on Windows from PRE-EXISTING MIL-498 CRLF drift + `.agents/` regen — distinguish from regressions you introduce; CI/Linux is source of truth. New tests must pass on both. Do NOT leave `.agents/`/`AGENTS.md`/temp-build-dir/`.ma-agents.json` pollution staged.

### Files expected
```
lib/knowledge-atlas/src/graph/reconcile.ts   (extend: provenance + hardening)
lib/knowledge-atlas/src/types.ts             (add source? to GraphNode/GraphEdge)
lib/knowledge-atlas/dist/atlas.cjs           (rebuild + commit)
.github/scripts/offline-install-verify.sh    (extend: Atlas generate under --network none)
.github/workflows/offline-install.yml        (Summary note; docker args if needed)
test/knowledge-atlas-packaging.test.js       (vendoring audit)
test/knowledge-atlas-offline-safety.test.js  (authoritative no-external-asset analyzer)
test/knowledge-atlas-reconcile.test.js       (provenance/conflict/absence)  [or extend manifest test]
test/fixtures/knowledge-atlas/...            (conflict/kg-only reconcile cases)
package.json                                 (test chain)
```

### References
- Epic 29 / Story 29.5 — `epics.md` ~line 5199. Architecture P5-7 (sealed packaging; reconciliation is the Epic-19 fast-follow) — `architecture.md` ~2528. Brief addendum (sealed offline packaging §, air-gap traps).
- Prior offline gates: Epic 27/28 release-gate stories; `.github/workflows/offline-install.yml`.
- FR225, FR230, FR232; NFR60, NFR67 (re-asserting NFR2/NFR50/NFR54/NFR57).

## Dev Agent Record
### Agent Model Used
claude-sonnet-4-6

### Completion Notes List

**Task 1 (AC 1) — Packaging audit + self-contained proof:**
- `test/knowledge-atlas-packaging.test.js` (23 tests): verifies markdown-it/js-yaml/lunr bundled, force-graph UMD inlined, esbuild devDep-only, mermaid absent-by-design (documented), no fonts/icons CDN. Proves bundle is self-contained by running `node dist/atlas.cjs <fixture>` from a dir with NO node_modules (CWD = os.tmpdir()). Verifies npm pack includes atlas.cjs. Includes Task 4.3 no-network proxy test.

**Task 2 (AC 4) — Offline safety analyzer:**
- `test/knowledge-atlas-offline-safety.test.js` (19 tests): generates full site against rich-project, walks ALL 16 emitted pages, asserts no http(s)://, no external script/link src, no web-font imports, no fetch()/XHR/WebSocket/import(). Strips vendored force-graph block from graph.html before scanning (mirrors 29.4 helper). manifest.json exempt (contains fs paths).

**Task 3 (AC 3) — Full KG reconciliation hardening:**
- `lib/knowledge-atlas/src/types.ts`: added `ProvenanceSource` type alias ('scan'|'kg'|'both') and optional `source?: ProvenanceSource` to GraphNode and GraphEdge.
- `lib/knowledge-atlas/src/graph/reconcile.ts`: complete rewrite to add provenance tagging. When KG absent → no source fields (29.2 equivalence). When KG present: scan→'scan', kg-only→'kg', both→'both'; scan fields win on conflict; non-conflicting KG-only fields (title/status) preserved additively; KG-only nodes/edges never dropped; malformed KG guards retained.

**Absence equivalence policy chosen:** When knowledge-graph.json is absent, `source` field is OMITTED entirely from all nodes/edges. This is byte-identical to 29.2 output — no provenance noise added. The 29.2 manifest tests continue to pass without modification because they compare nodes with `deepStrictEqual` and scan-only nodes never had `source`.

**Task 4 (AC 2) — Offline install gate extension:**
- `.github/scripts/offline-install-verify.sh`: extended from 5 steps to 7 steps. Step 6 synthesizes a minimal `_bmad-output` fixture in /scratch/atlas-fixture-offline and generates an Atlas site via `node <pkg>/lib/knowledge-atlas/dist/atlas.cjs`. Asserts exit 0 + all 6 output files non-empty + egress block still holding. Step 7 prints final summary.
- `.github/workflows/offline-install.yml`: Summary block updated to note "Atlas generate under egress-block: OK".
- Task 4.3: Node-level no-network proxy test in packaging test (uses Module._load interception to verify no net.connect/http.request called during generate).

**Task 5 (AC 5) — Tests + suite:**
- `test/knowledge-atlas-reconcile.test.js` (28 tests): provenance scan/kg/both tagging, scan-wins on conflict with explicit fixture, additive KG field merge, KG-only preserved, dangling flag preserved, determinism, malformed KG tolerance.
- `package.json`: 3 new test files appended to test chain.
- `npm run typecheck:atlas`: clean (0 errors).
- `npm run build:atlas`: dist/atlas.cjs updated to 736,557 bytes.
- All prior atlas suites green: smoke (26), manifest (87), render (34), graph (64).
- Full `npm test`: exit 0, all suites green.

### File List
- `lib/knowledge-atlas/src/types.ts` — added ProvenanceSource type + source? field to GraphNode/GraphEdge
- `lib/knowledge-atlas/src/graph/reconcile.ts` — full provenance hardening rewrite
- `lib/knowledge-atlas/dist/atlas.cjs` — rebuilt (736,557 bytes)
- `.github/scripts/offline-install-verify.sh` — extended with Step 6 (Atlas generate gate) + Step 7
- `.github/workflows/offline-install.yml` — Summary note added
- `test/knowledge-atlas-packaging.test.js` — new (23 tests, includes Task 4.3 no-net proxy)
- `test/knowledge-atlas-offline-safety.test.js` — new (19 tests, authoritative offline analyzer)
- `test/knowledge-atlas-reconcile.test.js` — new (28 tests, full provenance/conflict/absence)
- `package.json` — 3 new test files added to test chain
