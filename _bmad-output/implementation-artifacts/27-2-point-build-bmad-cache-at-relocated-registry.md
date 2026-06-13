# Story 27.2: Point build-bmad-cache.js at the Relocated v6.8.0 Registry (Type Filter + Fail-Loud)

Status: review

## Story

As a **ma-agents user installing in an air-gapped environment**,
I want a complete bundled cache (bmm/core filtered as built-in; tea, bmb, cis, gds, **wds** cloned; automator excluded) built from BMAD v6.8.0,
So that offline installs of the full module set keep working after the upstream registry relocated to package-root `bmad-modules.yaml`.

**Blocked by:** Story 27.1 (the relocated path + type filter must be confirmed and recorded as P5-5 first).

**FR/NFR:** FR207, NFR56.

## Acceptance Criteria

1. **Given** the confirmation in 27.1, **When** `scripts/build-bmad-cache.js` is updated, **Then** it adds the package-root `bmad-modules.yaml` path to `REGISTRY_CANDIDATES` and reuses/adapts `parseModulesYaml()` — the YAML parser is NOT replaced.

2. **Given** the reworked reader, **When** modules are normalized, **Then** the output shape is unchanged (`{ code, url, name, branch }`; `branch` defaults to `main` since the new YAML omits it). The filter is changed from the now-removed `built_in` flag to the `type` field: **include `type: bmad-org`, exclude `type: experimental`**. `bmm`/`core` are absent from the registry and never cloned. There is no `wds`-retired/skip path — `wds` is a normal `type: bmad-org` clone.

3. **Given** a deficient source, **When** the build runs, **Then** it fails loud (NFR56): if the resolved `type: bmad-org` set is smaller than the known bundled set (tea, bmb, cis, gds, wds), or no module source can be located/parsed, it exits non-zero with an actionable message and writes **no** partial/empty `cache-manifest.json`.

4. **Given** bmad-method v6.8.0, **When** `npm run build:bmad-cache` runs (network-permitting), **Then** it produces cache entries for **tea, bmb, cis, gds, wds**; `automator` is absent (experimental); `bmm`/`core` are absent (built-in); `cache-manifest.json` `bmadMethodVersion` reads `6.8.0`.

5. **Given** the new source, **When** the manifest is written, **Then** the `registrySchema` field is a tag for the relocated package-root YAML source, rather than the now-impossible `v63`/`legacy` values.

6. **Given** the change, **When** existing offline behaviors are exercised, **Then** `.git`→`_git_preserved`, the incremental SHA skip, and the `--force` retention stash all still function. (The AC #7 retained-module logic no longer applies to `wds` — it is now a live registry clone.)

## Tasks / Subtasks

### Task 1: Add the relocated path + type filter (AC: 1, 2, 5)

- [x] 1.1 Add package-root `bmad-modules.yaml` to `REGISTRY_CANDIDATES` (resolve relative to the bmad-method package dir via `locateBmadMethodDir()`)
- [x] 1.2 Confirm `parseModulesYaml()` reads the `modules:` map + `type` field (adapt only if needed)
- [x] 1.3 In `normalizeModules()`, replace the `built_in` exclusion with: keep `type: bmad-org`, drop `type: experimental`; keep the `MODULE_CODE_PATTERN` and URL guards
- [x] 1.4 Update the `registrySchema` manifest tag for the relocated source

### Task 2: Thin-cache fail-loud guard (AC: 3)

- [x] 2.1 Define the known bundled set (tea, bmb, cis, gds, wds); if the resolved `bmad-org` set is smaller, or empty, `console.error` + `process.exit(1)` BEFORE any manifest write
- [x] 2.2 Ensure no partial/empty `cache-manifest.json` is left on the failure path

### Task 3: Verify against v6.8.0 (AC: 4, 6)

- [x] 3.1 With `bmad-method@6.8.0` installed, run `npm run build:bmad-cache`; confirm tea/bmb/cis/gds/wds cloned, automator/bmm/core absent, `bmadMethodVersion: 6.8.0`
- [x] 3.2 Confirm `_git_preserved`, incremental skip, and `--force` retention still work

## Dev Notes

- This is a path + filter change, not a parser rewrite — expect a small diff localized to `REGISTRY_CANDIDATES` and `normalizeModules()`.
- The pin bump itself is Story 27.5; develop against a locally-installed `bmad-method@6.8.0` or coordinate ordering with 27.5.

## Dev Agent Record

### Summary

Pointed `scripts/build-bmad-cache.js` at the relocated v6.8.0 registry and swapped the
module filter, keeping the diff small and localized to `REGISTRY_CANDIDATES`,
`locateRegistry()`, `normalizeModules()`, and the `main()` guard. The YAML parser was
NOT replaced — `parseModulesYaml()` already captures the `type` field, so only its
docblock changed.

### Reader change

- **`REGISTRY_CANDIDATES`** is now an ordered list of `{ parts, schema }` objects. The
  relocated package-root `bmad-modules.yaml` (`schema: 'package-root-v68'`) is tried
  first, resolved relative to the bmad-method package dir via `locateBmadMethodDir()`.
  The two older paths (`registry-fallback`, `legacy`) are retained as diagnostics only;
  they carry the pre-`type` schema and resolve zero bundled modules, so a downgrade
  below 6.8.0 trips the fail-loud guard with an actionable message instead of silently
  shipping an empty cache.
- **`registrySchema` tag**: the relocated source flows `package-root-v68` into the
  manifest (replaces the now-impossible `v63`/`legacy`). (AC5)
- **Filter swap**: `normalizeModules()` now keeps only `type: bmad-org` (case-insensitive,
  trimmed) and drops everything else (`experimental` automator; untyped `bmm`/`core`
  which are absent from the registry anyway). The `MODULE_CODE_PATTERN` and `code`/`url`
  guards are kept. Output shape stays `{ code, url, name, branch }` with `branch`
  defaulting to `main`. There is no `wds`-retired/skip path — `wds` is a live `bmad-org`
  clone. (AC2)
- **Thin-cache fail-loud guard (NFR56)**: `main()` defines
  `KNOWN_BUNDLED_MODULES = [tea, bmb, cis, gds, wds]`; if the resolved `bmad-org` set is
  missing any of them (or no source can be located/parsed — `locateRegistry` already
  exits non-zero), it `console.error`s an actionable message and `process.exit(1)`
  BEFORE any manifest write, so no partial/empty `cache-manifest.json` is left. A
  duplicate-code guard was added alongside (review finding) so colliding `code` values
  fail loud rather than overwrite the same cache dir. (AC3)
- A `require.main === module` guard exports the pure reader functions when the script is
  required (for unit tests) and runs `main()` only when executed directly.

### Live verification (AC4) — pin bump deferred to 27.5

Installed `bmad-method@6.8.0` into an isolated scratch dir (NOT the worktree, NOT saved)
and ran the updated script. It resolved exactly **tea, bmb, cis, gds, wds**, excluded
**automator** (experimental) / **bmm** / **core** (built-in, absent from registry), and
produced a manifest with `bmadMethodVersion: 6.8.0` and `registrySchema: package-root-v68`.
Per story scope, the `package.json`/`package-lock` pin bump, the regenerated
`lib/bmad-cache/*`, and the manifest content churn are **Story 27.5's** job and were NOT
committed here — the committed diff is only the reader change, the new test, the
`npm test` wiring, and the story/sprint-status updates.

### Tests

- New `test/build-bmad-cache-reader.test.js` (15 tests, all pass, network-free): a
  6.8.0-shaped `parseModulesYaml` fixture (unquoted url, `type`, ignored extra fields);
  the `normalizeModules` type filter (bmad-org in / experimental out, branch default,
  shape, wds-live, path-traversal code rejection); exported-constant checks;
  `locateRegistry` `package-root-v68` tag (AC5); and end-to-end spawn tests for the
  fail-loud guard (deficient set, duplicate codes, missing YAML) each asserting non-zero
  exit AND no manifest written. Wired into the `npm test` chain in `package.json`.
- `test/bmad-version-bump.test.js` was NOT edited — its OLD-contract assertions are
  Story 27.3's to rewrite.

### Review

`bmad-code-review` (Blind Hunter + Acceptance Auditor) and `bmad-review-edge-case-hunter`
were run on the diff. No MUST-FIX correctness or acceptance bugs. Two NICE findings were
fixed (duplicate-code guard; corrected the now-misleading "fallback doesn't explode"
comment + broadened the guard's error text). The hand-rolled parser's indentation
brittleness was triaged WONTFIX — the story forbids replacing the parser, the 6.8.0
shape parses correctly (verified live), and a dropped required module is caught by the
fail-loud guard.
