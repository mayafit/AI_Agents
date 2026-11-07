# Story 36.3 — Target Pin Plumbing: `bmadRef`, `BMAD_TARGET_REF`, v7 snapshot, uv guard inversion, Node engines

Status: backlog
Blocked on: 36-1 (needs GO-36.3/36.4/36.5 and AC12's tea/cis tags)
Wave: 1 (parallel with 36.4, 36.5)

**FR:** FR280 (target pin), FR271 am. (one line: v7 at a pinned commit, recorded in `package.json` `bmadRef` and `BMAD_TARGET_REF`), FR279 (Node engines), FR277 (uv + Python 3.11; NFR74 rewritten). **NFR:** NFR2, NFR58 (snapshot is self-contained for the offline bundle). **Decision inputs:** P5-11.5 (pinned SHA, bumped deliberately), P5-11.6 (uv); 32.3 and 32.2 Dev Notes (reused where still true).

## Story

As the **ma-agents maintainer**,
I want the v7 target recorded in one place, a snapshot of the upstream `skills/` tree built from exactly that commit, and the uv policy guard pointing the v7 way,
so that every later story binds to one SHA, a pin bump is one deliberate edit with a rebuilt snapshot, and the test suite enforces `uv run` instead of forbidding it.

## Context

Today the target is a version, in two places: `package.json:35` (`"bmad-method": "6.10.0"`) and `lib/bmad.js:2830` (`const BMAD_TARGET_VERSION = '6.10.0'`). Note: 3.18.1 is on **6.10.0** — Epic 32's bump to 6.12.4 was cancelled before it started — so "the 3.x line on 6.12.4" in the proposal reads "on 6.10.0" in code. `BMAD_TARGET_VERSION` is used only in two log lines, `lib/bmad.js:1000` and `:1193`, and pinned by `test/bmad-version-bump.test.js:540-543`. The cache builder resolves the npm package (`scripts/build-bmad-cache.js:95`, `require.resolve('bmad-method/package.json')`), reads its registry, and clones each module's branch head (`:363`, `git clone --depth 1 --branch <branch>`; `branch` defaults to `main` at `:266`), deriving `pinTag` with `git describe --tags --exact-match` (`:398`); `KNOWN_BUNDLED_MODULES` is `['tea','bmb','cis']` (`:60`). Its output manifest records `bmadMethodVersion: "6.10.0"` and `registrySchema: "package-root-v68"` (`lib/bmad-cache/cache-manifest.json:3-4`). v7 has no npm package and no registry: the target is a git commit of `bmad-code-org/BMAD-METHOD`, and bmb is replaced by `bmod-toolsmith` inside that repository.

The uv guards: `test/uv-transition-resilience.test.js:194` fails if any `lib/`, `scripts/`, `bin/` `.js` file contains the substring `uv run`; `:208` fails if any `lib/bmad-extension/skills/**/*.md` contains it; the header (`:24-27`) states control-plane Python "is never migrated to `uv run`". The one owned skill calling a shared script is `lib/bmad-extension/skills/bmad-dev-epic/SKILL.md:135` (`python3 {project-root}/_bmad/scripts/resolve_customization.py …`). `package.json:57-58` declares `"node": ">=16.0.0"`.

**The 3.x line keeps working.** `ma-agents install` on this line still drives the v6 bmad-method installer until Story 39.4 deletes it. This story adds the v7 target beside it; it does not remove the `bmad-method` dependency, `lib/bmad-cache/`, or the v6 builder path.

## Acceptance Criteria

Tags: **[v7-carries]** = holds through GA (only the SHA changes); **[pre-release-only]** = scaffolding specific to the preview.

1. **`bmadRef` is the single source.** [v7-carries] `package.json` gains `"bmadRef": { "repo": "bmad-code-org/BMAD-METHOD", "sha": "e734d3ac3c0f4ea31cc2c2bbbe79e86e54f2cae6", "modules": { "tea": "<tag>", "cis": "<tag>" } }` with the tags from `36-1-gate-findings.md` AC12 (or `modules: {}` with the FALLBACK recorded). `sha` is a full 40-hex SHA (asserted); a branch or tag name is rejected by the test.
2. **`BMAD_TARGET_REF` replaces `BMAD_TARGET_VERSION`.** [v7-carries] `lib/bmad.js:2830` becomes `BMAD_TARGET_REF`, derived from `package.json` `bmadRef` at load (not restated as a literal); the two log sites (`:1000`, `:1193`) print the short SHA. `test/bmad-version-bump.test.js:540-543` is rewritten to assert `BMAD_TARGET_REF.sha === require('../package.json').bmadRef.sha` and that no `BMAD_TARGET_VERSION` identifier remains under `lib/` or `bin/`.
3. **Snapshot at the SHA.** [v7-carries] `scripts/build-bmad-cache.js` gains a v7 path (flag or sub-command; name recorded) that fetches `bmadRef.repo` at exactly `bmadRef.sha` (`git init` + `git fetch --depth 1 origin <sha>` + `git checkout FETCH_HEAD`), asserts `git rev-parse HEAD` equals the pin, and copies `skills/` into a new snapshot directory (path recorded, e.g. `lib/bmad-v7-cache/`; never `lib/bmad-cache/`). tea and cis are fetched at their `bmadRef.modules` tags and `git describe --tags --exact-match HEAD` must equal the tag (the `:398` check kept as a post-fetch assertion). `snapshot-manifest.json` records repo, SHA, the `bmod-method` record version, per-module tag + SHA, file count and a tree hash.
4. **Snapshot verified by an outside authority.** [v7-carries] `test/bmad-v7-snapshot.test.js` asserts: manifest SHA equals `package.json` `bmadRef.sha`; `skills/bmad/scripts/{render_skill,resolve_config,resolve_customization,setup,validate_manifests,migrate_v6}.py` and `skills/bmad-agent-po/scripts/tickets.py` exist; the tree hash recomputed from disk equals the manifest's. A snapshot built from a different SHA fails the test.
5. **v6 path untouched.** [pre-release-only] The v6 builder path (`:95`, `:266`, `:363`) and `lib/bmad-cache/` are unchanged; `test/build-bmad-cache-reader.test.js`, `test/bundle-filter-set-equality.test.js` and `test/bundled-module-pins.test.js` pass unmodified. The `bmad-method` dependency at `package.json:35` stays until 39.4 (recorded in the Verification record so 36.6's CHANGELOG states it).
6. **Node engines (FR279).** [v7-carries] `package.json:57-58` `engines.node` becomes `>=20.12.0` (or the floor 36.1 AC1 recorded for the Skills CLI, whichever is higher). A test asserts the range is not looser than that floor, read from the snapshot or the vendored `skills` package metadata — not from a literal in the test.
7. **Skill guard inverted (FR277).** [v7-carries] The `:208` test is replaced by its inverse over `lib/bmad-extension/skills/**/*.md` **and** `skills/**/*.md`: every line invoking `_bmad/scripts/<name>.py` or `_bmad/<code>/scripts/<name>.py` must use `uv run --no-cache` (the form upstream uses, `skills/bmad-build/SKILL.md:12` @`e734d3a`); `python`, `python3`, `py -3` or a bare path fails with file:line. The scanned set is asserted non-empty and to contain `bmad-dev-epic/SKILL.md`.
8. **Control-plane guard narrowed to execution.** [v7-carries] The `:194` test fails only on a `spawn` / `exec` / `execFile` / `execSync` call whose command or argv contains `uv`; message strings that mention `uv run` pass. Two in-test fixtures prove it: `execSync('uv run x.py')` fails, `console.log('… uv run …')` passes. The header (`:24-27`) is rewritten to the FR277 boundary (skill guidance: `uv run --no-cache`; installer JS: never executes uv) and cites FR277 / P5-11.6. The NFR59(a)/(b) tests at `:123`, `:138`, `:156`, `:167` pass unchanged.
9. **`bmad-dev-epic` migrated.** [pre-release-only — the skill is rewritten as `ma-ops-dev-epic` in 37.3] `lib/bmad-extension/skills/bmad-dev-epic/SKILL.md:135` reads `uv run --no-cache {project-root}/_bmad/scripts/resolve_customization.py --skill {skill-root} --key workflow`; the hand-merge fallback paragraph gains "`uv` unavailable or Python < 3.11". `npm run build:plugin` regenerates `lib/bmad-extension-plugin/`; the Bundle Drift Guard passes.
10. **Mutation-checked.** (m1) `bmadRef.sha` changed by one hex digit without rebuilding → AC4 red; (m2) builder fetches the default branch instead of the SHA → AC3 HEAD assertion red; (m3) `SKILL.md:135` reverted to `python3` → AC7 red; (m4) an `execSync('uv …')` planted in `lib/` → AC8 red; (m5) `engines.node` set to `>=18` → AC6 red.

## Tasks / Subtasks

- [ ] T1 `bmadRef` in `package.json`; `BMAD_TARGET_REF` in `lib/bmad.js`; re-pin `bmad-version-bump` (AC1, AC2)
- [ ] T2 v7 snapshot path in `build-bmad-cache.js`; build it; manifest (AC3)
- [ ] T3 `test/bmad-v7-snapshot.test.js`; add to chain (AC4); confirm v6 tests untouched (AC5)
- [ ] T4 Engines + test (AC6)
- [ ] T5 Invert and narrow the uv guards; rewrite the header (AC7, AC8)
- [ ] T6 `bmad-dev-epic` Step 1; `npm run build:plugin` (AC9)
- [ ] T7 Mutants m1–m5 (AC10)

## Dev Notes

- `git fetch --depth 1 origin <sha>` works on GitHub for any reachable commit; if a proxy blocks it, fall back to a full clone + `git checkout <sha>` and record it. Never fetch `main`.
- Snapshot size: the full `skills/` tree is large; it ships in the npm package only if 36.6 decides so. Until then add the directory to `.npmignore`/`files` exclusions and record the decision — 39.1 owns what the offline bundle carries.
- Regenerated plugin trees must be committed with the skill change or the Bundle Drift Guard (`.github/workflows/bundle-drift.yml`) fails (memory: plugin bundle drift on version bumps).
- The `persona` skills (`ma-agent-*`) call no shared script today; AC7 covers them anyway. 37.3 rewrites them; do not migrate their config reads here.
- `scripts/build-wheelhouse.py` from 36.2 reads this story's snapshot path; agree the path on the epic branch.
- Windows: the builder deletes fetched trees; on EBUSY close editors/AV and re-run (3.18.1's retry fix covers bmad-method's deletes, not this script).

## Testing

`test/bmad-v7-snapshot.test.js` (new), `test/bmad-version-bump.test.js` (re-pinned), `test/uv-transition-resilience.test.js` (inverted), engines test; all in the chain. Run each directly on Windows too.

## Out of scope

- Removing the `bmad-method` npm dependency, `lib/bmad-cache/` or v6 orchestration (39.4).
- Bundling the snapshot for offline install (39.1); the wheelhouse (36.2).
- Owned-TOML validation (36.4); `AGENTS.md` (36.5).

## Verification record

`bmadRef`: … ; snapshot path + tree hash: … ; tea/cis tags: … ; engines floor + source: … ; suite: … ; mutants m1–m5: … ; unverified: …
