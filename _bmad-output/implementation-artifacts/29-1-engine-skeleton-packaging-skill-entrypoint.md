# Story 29.1: Knowledge Atlas Engine Skeleton + Sealed Packaging Pipeline + Skill Entrypoint (Gate)

Status: ready-for-dev

## Story

As a **ma-agents user on any project**,
I want to run a `bmad-knowledge` skill that invokes a pre-bundled Knowledge Atlas engine and produces a (minimal) self-contained output, with **no per-project dependency install** and **no network access**,
so that every later capability lands on a packaging spine that is air-gapped by construction. (FR215, FR230; NFR61, NFR67)

This is the **GATE** story for Epic 29. It establishes the engine package, the esbuild release-time bundling discipline (the "packaging spine"), the skill entrypoint in both deployment pipelines, the gitignore policy, and the smoke test. Stories 29.2–29.6 add modules *into the bundle that this story builds* — so the packaging discipline must be correct now, not deferred.

## Acceptance Criteria

1. **Given** a new engine source tree at `lib/knowledge-atlas/` (TypeScript)
   **When** the release-time build runs (`npm run build:atlas`, wired alongside `build:plugin` into `prepare`/`version`)
   **Then** it is bundled to a single committed JS artifact via esbuild (`lib/knowledge-atlas/dist/atlas.cjs`), and the consuming project **never runs `npm install` for the Atlas** — the engine and its (currently minimal) dependencies are vendored/bundled inside the ma-agents distribution.

2. **Given** a `bmad-knowledge` skill (BMAD-extension copy under `lib/bmad-extension/skills/bmad-knowledge/` + IDE copy under `skills/bmad-knowledge/`, mirroring the `open-graph` dual-pipeline pattern from Story 19.5)
   **When** the skill is invoked in a project
   **Then** it resolves the project root + `_bmad-output`, invokes the bundled engine, and opens the generated `index.html` (VSCode detection via `process.env.TERM_PROGRAM === 'vscode' || process.env.VSCODE_PID !== undefined`, with system-default-browser fallback `start`/`open`/`xdg-open`, exactly as Story 19.5 specifies).

3. **Given** the skill runs against a project
   **When** generation completes
   **Then** a self-contained `_bmad-output/knowledge-site/index.html` exists (in this story it may render only a project title + a "generated at" line) — proving the end-to-end pipeline — and output is written **only** under `_bmad-output/knowledge-site/`; **no source artifact is modified**.

4. **Given** a project root
   **When** the Atlas generates output
   **Then** `_bmad-output/knowledge-site/` is git-ignored by default via an `ensureKnowledgeSiteIgnored`-style step that mirrors `ensurePluginStageIgnored` in `lib/installer.js` (idempotent, non-fatal on failure, single canonical write site), AND the repo's own root `.gitignore` lists `_bmad-output/knowledge-site/`.

5. **Given** the engine bundle and skill
   **When** the generate step executes with egress blocked
   **Then** it succeeds with **no network access** — the engine imports only Node built-ins and esbuild-inlined modules; there is no `http`/`https`/`fetch`/`dns` call at generate time. (Full egress-blocked CI gate lands in 29.5; this story proves it by construction + a unit assertion.)

6. **Given** the new skill
   **When** the skill enumeration is built
   **Then** `bmad-knowledge` is registered in `lib/bmad-extension/module-help.csv` (phase `anytime`) and the IDE `skills/` MANIFEST flow, and surfaces in skill enumeration **without breaking existing entries** (skill-count assertions and `plugin-manifests`/`build-plugin` tests stay green).

7. **Given** the smoke test
   **When** `npm test` runs on Linux/CI and Windows
   **Then** it is green; a new smoke test asserts the engine produces a **non-empty** `index.html` for a fixture `_bmad-output`, and writes **nothing outside** `_bmad-output/knowledge-site/`.

## Tasks / Subtasks

### Task 1: Engine package skeleton (AC: 1, 3, 5)
- [ ] 1.1 Create `lib/knowledge-atlas/` with `src/` (TypeScript). Files:
  - `src/types.ts` — shared types (start a `KnowledgeManifest` interface stub; 29.2 fills it). Keep minimal but forward-looking.
  - `src/generate.ts` — `export function generate(opts: GenerateOptions): GenerateResult`. `GenerateOptions = { projectRoot: string; outDir?: string; now?: Date | string }`. Resolves `bmadOutputDir = <projectRoot>/_bmad-output`, `outDir = <bmadOutputDir>/knowledge-site`, derives a project title (from `<projectRoot>/package.json` name, else basename of projectRoot), writes a minimal self-contained `index.html`. Returns `{ outDir, indexPath, fileCount }`.
  - `src/cli.ts` — argv entrypoint: `node atlas.cjs <projectRoot> [--out <dir>]`; calls `generate`; prints the index path; exit 0 on success, non-zero with a clear message on failure.
  - `src/index.ts` — re-export `generate`, types.
- [ ] 1.2 `lib/knowledge-atlas/tsconfig.json` — `target: ES2020`, `module: CommonJS`, `strict: true`, `outDir`/`rootDir` not used for shipping (esbuild bundles), but enable `noEmit` typecheck path. Add a `typecheck` npm script.
- [ ] 1.3 **Determinism guard for the timestamp (NFR62 — critical):** the "generated at" line must NOT churn byte output across runs. Source it from `opts.now` if provided, else `process.env.SOURCE_DATE_EPOCH` (parsed as seconds) if set, else the current time. Tests and the 29.6 determinism gate pin it via `SOURCE_DATE_EPOCH`. Document this clearly in code — every later story keeps output deterministic under a pinned `SOURCE_DATE_EPOCH`.
- [ ] 1.4 The generated `index.html` is fully self-contained: inline `<style>`, no external URLs, no web fonts (system font stack), no `<script src>`. Seed the design-system CSS-custom-property tokens (`--ink/--paper/--surface/--ok/--warn/--gap` + washes, teal accent) from the design reference so 29.3 extends rather than replaces. Keep it small but already "analyst-report" quality, not a bare markdown dump.

### Task 2: esbuild bundling — the packaging spine (AC: 1, 5)
- [ ] 2.1 Add `esbuild` + `typescript` to `devDependencies` (only — they are build-time tooling, never a runtime/consuming-project dependency). Pin to the versions installed.
- [ ] 2.2 Create `scripts/build-atlas.js` (Node built-ins + a `require('esbuild')` from devDeps). It bundles `lib/knowledge-atlas/src/cli.ts` → `lib/knowledge-atlas/dist/atlas.cjs` with: `bundle: true`, `platform: 'node'`, `format: 'cjs'`, `target: 'node18'`, `minify: false` (keep diff-able, like build-plugin), `sourcemap: false`, LF line endings, deterministic output. Mirror `scripts/build-plugin.js` header-doc + determinism discipline (sorted inputs, stable output, no host-dependent content). Support `--verify` to print the SHA-256 of the bundle.
- [ ] 2.3 `package.json` scripts: add `"build:atlas": "node scripts/build-atlas.js"`. Update `"prepare"` and `"version"` to run BOTH plugin and atlas builds (e.g. `"prepare": "node scripts/build-plugin.js && node scripts/build-atlas.js"`; `"version": "node scripts/build-plugin.js && node scripts/build-atlas.js && git add lib/bmad-extension-plugin lib/knowledge-atlas/dist"`). Preserve existing behavior; don't drop the plugin build.
- [ ] 2.4 Commit the built `lib/knowledge-atlas/dist/atlas.cjs` (like the plugin bundle). Ensure `package.json` `files[]` already covers `lib/` (it does) so the bundle ships in the npm tarball.
- [ ] 2.5 **Bundle Drift discipline:** the committed `dist/atlas.cjs` must match a fresh `build:atlas`. Add a drift assertion to the smoke test (or a dedicated test) analogous to build-plugin drift: rebuild to a temp path and compare bytes. Document in the story that touching `src/` requires re-running `build:atlas` and committing.

### Task 3: `bmad-knowledge` skill — both pipelines (AC: 2, 3, 6)
- [ ] 3.1 BMAD-extension skill: `lib/bmad-extension/skills/bmad-knowledge/SKILL.md` + `bmad-skill-manifest.yaml` (`type: skill`, `name: bmad-knowledge`, `module: ma-skills`). Reference skill: `lib/bmad-extension/skills/open-graph/` does not exist (Epic 19 unmerged) — use `lib/bmad-extension/skills/add-to-sprint/` for the manifest/format and the Story 19.5 SKILL workflow text as the entrypoint pattern.
- [ ] 3.2 IDE skill: `skills/bmad-knowledge/skill.json` (`name`, `version: 1.0.0`, `description`, `category: workflow`, tags; NO `always_load`) + `skills/bmad-knowledge/SKILL.md`. Reference: `skills/story-status-lookup/`.
- [ ] 3.3 SKILL.md workflow logic (identical in both copies):
  1. Resolve project root + `_bmad-output`.
  2. Resolve the engine bundle path: prefer the installed ma-agents location, fall back to `lib/knowledge-atlas/dist/atlas.cjs` relative to the package. Document resolution clearly (the skill is deployed into consuming projects, so it must locate the bundle inside the installed ma-agents package — mirror how other extension skills locate their helper `.js`).
  3. Run `node <atlas.cjs> "<projectRoot>"`.
  4. Open `_bmad-output/knowledge-site/index.html` using the **exact** VSCode/browser detection block from Story 19.5 (`code "<path>"` in VSCode; else `start`/`open`/`xdg-open`).
- [ ] 3.4 Register in `lib/bmad-extension/module-help.csv`: add a `bmad-knowledge` row, phase `anytime`, mirroring the (planned) open-graph row format. Verify the resulting skill count and update any count assertion in tests.
- [ ] 3.5 Gitignore step (AC 4): add `ensureKnowledgeSiteIgnored(projectRoot)` to `lib/installer.js` mirroring `ensurePluginStageIgnored` (idempotent append of `_bmad-output/knowledge-site/` to project `.gitignore`, non-fatal on EACCES/EROFS). Wire it where `ensurePluginStageGitignoredForProject` is invoked in `lib/bmad.js`. Also add `_bmad-output/knowledge-site/` to this repo's own root `.gitignore`.

### Task 4: Smoke test + fixture (AC: 7)
- [ ] 4.1 Create a fixture `_bmad-output` under `test/fixtures/knowledge-atlas/minimal-project/` (a small `_bmad-output/` with a couple of planning + implementation markdown files and a `sprint-status.yaml`).
- [ ] 4.2 Create `test/knowledge-atlas-smoke.test.js` (plain Node assert, matching the repo's existing test style — no framework). Assert: (a) generate produces a non-empty `index.html`; (b) `index.html` contains the project title and is valid-ish HTML; (c) nothing is written outside `_bmad-output/knowledge-site/` (snapshot the fixture tree mtimes/contents before+after, or generate into a temp copy and diff); (d) output contains no `http://`/`https://`/`src=`/`fetch(` (offline-by-construction smoke); (e) bundle-drift: a fresh build of `atlas.cjs` to a temp file byte-matches the committed bundle. Use `SOURCE_DATE_EPOCH` to pin determinism.
- [ ] 4.3 Add `test/knowledge-atlas-smoke.test.js` to the `npm test` chain in `package.json` `scripts.test` (append `&& node test/knowledge-atlas-smoke.test.js`).
- [ ] 4.4 Generate against a temp **copy** of the fixture (never mutate the committed fixture) so the "writes nothing outside output folder" assertion is clean and the test is idempotent.

### Task 5: Verify integration (AC: 6, 7)
- [ ] 5.1 Run `npm run build:atlas` then `npm run build:plugin`; confirm both bundles build and the plugin build still passes (skill added to bundle).
- [ ] 5.2 Run the new smoke test and the `plugin-manifests` / `build-plugin` / `bmad-extension` tests; confirm green.
- [ ] 5.3 Run the engine end-to-end against this repo's own `_bmad-output` and confirm `index.html` opens with the project title.

## Dev Notes

### Architecture invariants you MUST honor (Decision P5-7)
- **Sealed offline packaging:** engine + ALL deps vendored/bundled in the ma-agents dist; consuming project never `npm install`s. esbuild bundle committed like `build:plugin`. No npm/git/CDN/host at install/generate/view.
- **Discovery↔rendering contract:** keep `generate.ts` structured so a later *discovery* half (29.2 scan→manifest) and a *pure model-free rendering* half are separable. For 29.1 the manifest is a stub, but do not bake assumptions that break that seam.
- **Zero-dependency-first rendering:** curated views are self-contained HTML/CSS/SVG; no runtime JS lib in 29.1 (force-graph/Mermaid/search land in 29.3/29.4 and must be vendored, never CDN). The 29.1 `index.html` has NO `<script>` at all.
- **Non-destructive isolated output:** write only under `_bmad-output/knowledge-site/`; never mutate source.
- **Deterministic, Windows/CRLF-safe:** LF output; timestamp pinned via `SOURCE_DATE_EPOCH`; identical inputs → identical bytes. Known repo gotcha: normalize CRLF→LF before any hashing (29.2 hashes; 29.1 just must not emit CRLF).

### Dual deployment pipeline (from Story 19.5 Dev Notes — authoritative)
Skills are created in BOTH:
1. **IDE skill source:** `skills/bmad-knowledge/{skill.json,SKILL.md}` — deployed by `lib/installer.js` to agent dirs. Reference: `skills/story-status-lookup/`.
2. **BMAD extension skill source:** `lib/bmad-extension/skills/bmad-knowledge/{SKILL.md,bmad-skill-manifest.yaml}` — deployed by `lib/bmad.js` to `_bmad/extensions/ma-agents-skills/`. Reference: `lib/bmad-extension/skills/add-to-sprint/`.
`module-help.csv` row uses phase `anytime`. The `build-plugin` step assembles `lib/bmad-extension/` → `lib/bmad-extension-plugin/`; rerun `npm run build:plugin` and commit the regenerated bundle (Bundle Drift Guard) — review the diff, don't blindly regen.

### esbuild discipline
- esbuild/typescript are **devDependencies** (build-time only). The runtime bundle `atlas.cjs` has no external runtime deps in 29.1. Later libs (force-graph, mermaid, search, markdown parser) get bundled INTO `atlas.cjs` or vendored as committed assets — never required from the consuming project's node_modules.
- Mirror `scripts/build-plugin.js`: Node-built-ins-first, deterministic, `--verify` SHA print, clear fail-fast errors, write only inside the output dir.

### Bundle resolution from an installed skill
The skill runs inside a *consuming* project, where ma-agents is installed (globally via npx or as a dep). The SKILL.md must locate `atlas.cjs` inside the installed ma-agents package, not assume a relative repo path. Look at how existing extension skills locate their sibling `.js` helpers and replicate. If a robust runtime resolution is non-trivial, the engine bundle path can be resolved via `require.resolve('ma-agents/lib/knowledge-atlas/dist/atlas.cjs')` or by walking up from the skill's own location — pick the approach consistent with the repo and document it.

### Windows/CRLF + test-suite health gotcha (known)
`npm test` can exit nonzero on Windows from PRE-EXISTING MIL-498 template CRLF drift (halts ~position 13) and regenerates `.agents/`. Distinguish pre-existing failures from regressions you introduce. CI/Linux is the source of truth for green. Your new smoke test MUST pass on both platforms; ensure it does not depend on CRLF/LF or on absolute paths.

### Files expected (seed — owned by code once it exists)
```
lib/knowledge-atlas/
  src/{types.ts,generate.ts,cli.ts,index.ts}
  tsconfig.json
  dist/atlas.cjs                ← committed build artifact
skills/bmad-knowledge/{skill.json,SKILL.md}                  ← IDE pipeline
lib/bmad-extension/skills/bmad-knowledge/{SKILL.md,bmad-skill-manifest.yaml}  ← BMAD ext
scripts/build-atlas.js
test/knowledge-atlas-smoke.test.js
test/fixtures/knowledge-atlas/minimal-project/_bmad-output/...
```
Modified: `package.json` (devDeps + scripts + test chain), `lib/bmad-extension/module-help.csv`, `lib/installer.js` (+ `ensureKnowledgeSiteIgnored`), `lib/bmad.js` (wire the call), root `.gitignore`, `lib/bmad-extension-plugin/` (regenerated bundle).

### References
- Architecture Decision P5-7 — `_bmad-output/planning-artifacts/architecture.md` (line ~2528).
- Epic 29 story defs — `_bmad-output/planning-artifacts/epics.md` (line ~5110).
- Brief addendum (pipeline, manifest schema, sealed packaging, design reference) — `_bmad-output/planning-artifacts/briefs/brief-knowledge-atlas-2026-06-27/addendum.md`.
- Design reference (visual quality bar) — `.../design-reference/elteye-rules-engine-report.html`.
- Dual-pipeline + VSCode detection pattern — `_bmad-output/implementation-artifacts/19-5-open-graph-skill.md`.
- Reference skills: `skills/story-status-lookup/`, `lib/bmad-extension/skills/add-to-sprint/`.
- Build/determinism reference: `scripts/build-plugin.js`. Gitignore helper: `lib/installer.js` (`ensurePluginStageIgnored`), wired in `lib/bmad.js` (`ensurePluginStageGitignoredForProject`).
- FR215 (skill + pipeline), FR230 (no per-project install / sealed), NFR61 (no per-project install), NFR67 (air-gapped generate+view).

## Dev Agent Record
### Agent Model Used
_to be filled by dev agent_
### Completion Notes List
### File List
