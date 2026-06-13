# Story 27.3: Update Registry-Schema Tests + Add Thin-Cache Fail-Loud Regression Tests

Status: review

## Story

As the **ma-agents maintainer**,
I want the test suite to pin the relocated-YAML module-source contract and to fail loudly if a future BMAD release moves the registry again or resolves a thin set,
So that the offline guarantee is protected by a gate rather than discovered by an air-gapped user.

**Blocked by:** Story 27.2 (the reworked reader must exist).

**FR/NFR:** NFR56, supports FR207.

## Acceptance Criteria

1. **Given** the reworked reader, **When** `test/bmad-version-bump.test.js` is updated, **Then** the assertions pinning the `'v63'`/`'legacy'` registry schema are replaced with a tag for the relocated package-root YAML source, and the `built_in`-flag filter assertion is replaced with the `type`-based filter (include `type: bmad-org`, exclude `type: experimental`). The bmm/core exclusion invariant is retained (now via the registry not listing them).

2. **Given** v6.8.0 reality, **When** the two existing `wds`-as-retired tests are revisited, **Then** they are **inverted**: the test `'wds module is NOT in the v6.6.0 upstream registry (retired)'` (~line 128) is rewritten to assert `wds` IS in the v6.8.0 registry (`type: bmad-org`) and is bundled; the test `'retired upstream modules (e.g. wds) are flagged in manifest when retained'` (~line 192) is rewritten — `wds` is now a normal live clone, not a retained relic.

3. **Given** a deficient-source fixture, **When** the builder runs, **Then** a new test asserts the **thin-cache fail-loud** contract (NFR56): a resolved `type: bmad-org` set smaller than the known set (or no source at all) ⇒ non-zero exit and no `cache-manifest.json`.

4. **Given** v6.8.0, **When** the bundled-set test runs, **Then** it asserts codes **tea, bmb, cis, gds, wds** present; `automator` absent (experimental); `bmm`/`core` absent from the externally-cloned set.

5. **Given** the test suite, **When** it runs, **Then** module-source resolution is exercised against fixtures/the installed package (no live clones, no network) — consistent with the air-gapped CI gate.

6. **Given** all changes, **When** `npm test` runs on Linux/CI, **Then** it is green (pre-existing unrelated failures documented separately, per repo convention).

## Tasks / Subtasks

### Task 1: Update schema + filter assertions (AC: 1)

- [x] 1.1 Replace `'v63'`/`'legacy'` schema assertions with the relocated-YAML source tag
- [x] 1.2 Replace the `built_in`-flag filter assertion with the `type`-based filter (bmad-org include / experimental exclude); retain bmm/core exclusion

### Task 2: Invert the wds tests (AC: 2)

- [x] 2.1 Rewrite `'wds module is NOT in the v6.6.0 upstream registry (retired)'` (~line 128) → assert wds present (`type: bmad-org`) and bundled at v6.8.0
- [x] 2.2 Rewrite `'retired upstream modules (e.g. wds) are flagged in manifest when retained'` (~line 192) → wds is a normal clone, not a retained relic

### Task 3: Thin-cache fail-loud + bundled-set tests (AC: 3, 4, 5)

- [x] 3.1 Add a fail-loud test: fixture with a deficient `type: bmad-org` set ⇒ non-zero exit, no manifest written
- [x] 3.2 Assert the bundled set: tea/bmb/cis/gds/wds present; automator/bmm/core absent
- [x] 3.3 Ensure resolution runs without network (fixtures or installed package)

### Task 4: Green suite (AC: 6)

- [x] 4.1 Run `npm test`; document any pre-existing unrelated failures

## Dev Agent Record

### Context

Stacked on Story 27.2 (`feat/27-2-relocated-registry-reader`, PR #110). The 27.2
reader (`scripts/build-bmad-cache.js`) was the contract under test; this story
only rewrote `test/bmad-version-bump.test.js` — no production code changed.

### Implementation summary

All edits are in `test/bmad-version-bump.test.js`:

- **AC1** — Replaced the pre-6.8.0 `registry-fallback.yaml`-path / `built_in`-flag
  assertions with fixture-driven assertions over the exported reader:
  `locateRegistry` tags the relocated package-root `bmad-modules.yaml` as
  `package-root-v68` (and never `v63`/`legacy`); `REGISTRY_CANDIDATES[0]` is the
  package-root path; `normalizeModules` keeps `type: bmad-org` and drops
  `type: experimental`. The bmm/core exclusion invariant is retained structurally
  (untyped / non-`bmad-org` entries are dropped).
- **AC2** — Inverted both wds tests. The ~line-128 "wds NOT in registry (retired)"
  assertion now asserts wds IS present at v6.8.0 (`type: bmad-org`, correct URL)
  and normalizes to a plain `{branch,code,name,url}` clone with no
  `retiredUpstream` flag. The old "retired … flagged when retained" test (which
  read the live 6.6.0 manifest) was removed — its inverted, fixture-driven
  replacement lives in the Task 2 block, and keeping the old one would directly
  contradict it.
- **AC3/AC5/NFR56** — Added a thin-cache fail-loud regression and a
  registry-missing regression. Both spawn the REAL build script end-to-end
  against a FAKE bmad-method package under a temp root (a copy of the script so
  its `CACHE_DIR` resolves under the temp tree; fs-extra supplied via `NODE_PATH`
  → real node_modules). A deficient `type: bmad-org` set exits non-zero with a
  "thin module set"/"Missing:" message and writes no `cache-manifest.json`; a
  missing relocated YAML exits non-zero with a "no module registry YAML found"
  message and writes no manifest. No network, no live clone (the guards abort
  before any `git clone`).
- **AC4** — Bundled-set assertion: tea/bmb/cis/gds/wds present; automator
  (experimental) absent; bmm/core absent; `KNOWN_BUNDLED_MODULES` pinned.

A prior agent timed out mid-run having drafted the AC1/AC2/AC3/AC4 test bodies
but **without** defining the `makeFakeBmadEnv`/`runScript`/`SCRIPT_PATH`/
`REAL_NODE_MODULES` harness those bodies call (a `ReferenceError` at runtime) and
**without** removing the contradictory old retired-wds test. This session added
the missing fail-loud harness (mirroring the 27.2 reader test's proven
NODE_PATH/temp-root approach) and removed the stale test.

### File List

- `test/bmad-version-bump.test.js` (modified)
- `_bmad-output/implementation-artifacts/27-3-update-registry-schema-tests-fail-loud.md` (status + record)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (27.3 → review)

### Test results

- `node test/bmad-version-bump.test.js` → **33 passed, 0 failed** (incl. the two
  fail-loud spawn tests, inverted wds tests, bundled-set test).
- `node test/build-bmad-cache-reader.test.js` (27.2, untouched) → 15 passed, 0
  failed — no duplication/overlap regression.
- Full `npm test` (`&&`-chained) reached `reconfigure.test.js` (#34) and halted on
  the **pre-existing** failure `8.8 ClinerulesDualFileDriftError` ("scriptedPrompts
  exhausted"). Categorized failures:
  - (a) MIL-498 Windows CRLF drift — did not halt the chain early this run
    (suites 1–33 passed through); resolved by 27.5.
  - (b) Pre-existing unrelated: `reconfigure.test.js` 8.8 and
    `obsolete-tool-dirs.test.js` b2-t1 — both confirmed unchanged vs base
    (`scripts/build-bmad-cache.js` and both test files identical to
    `feat/27-2-relocated-registry-reader`).
  - (c) None — no failure attributable to this story's edits.

## Dev Notes

- Reuse the existing `bmad-version-bump.test.js` "Task 2" structure where practical.
- The fail-loud test should drive the negative path without a genuinely broken bmad-method install — point the resolver at a fixture with a deficient module set.
- Mind the Windows CRLF gotcha; evaluate the clean baseline on a normalized/CI environment, but note 27.5/27.7 require the CRLF drift actually resolved (not waived) before release.
