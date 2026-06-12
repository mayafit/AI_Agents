# Story 27.2: Point build-bmad-cache.js at the Relocated v6.8.0 Registry (Type Filter + Fail-Loud)

Status: backlog

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

- [ ] 1.1 Add package-root `bmad-modules.yaml` to `REGISTRY_CANDIDATES` (resolve relative to the bmad-method package dir via `locateBmadMethodDir()`)
- [ ] 1.2 Confirm `parseModulesYaml()` reads the `modules:` map + `type` field (adapt only if needed)
- [ ] 1.3 In `normalizeModules()`, replace the `built_in` exclusion with: keep `type: bmad-org`, drop `type: experimental`; keep the `MODULE_CODE_PATTERN` and URL guards
- [ ] 1.4 Update the `registrySchema` manifest tag for the relocated source

### Task 2: Thin-cache fail-loud guard (AC: 3)

- [ ] 2.1 Define the known bundled set (tea, bmb, cis, gds, wds); if the resolved `bmad-org` set is smaller, or empty, `console.error` + `process.exit(1)` BEFORE any manifest write
- [ ] 2.2 Ensure no partial/empty `cache-manifest.json` is left on the failure path

### Task 3: Verify against v6.8.0 (AC: 4, 6)

- [ ] 3.1 With `bmad-method@6.8.0` installed, run `npm run build:bmad-cache`; confirm tea/bmb/cis/gds/wds cloned, automator/bmm/core absent, `bmadMethodVersion: 6.8.0`
- [ ] 3.2 Confirm `_git_preserved`, incremental skip, and `--force` retention still work

## Dev Notes

- This is a path + filter change, not a parser rewrite — expect a small diff localized to `REGISTRY_CANDIDATES` and `normalizeModules()`.
- The pin bump itself is Story 27.5; develop against a locally-installed `bmad-method@6.8.0` or coordinate ordering with 27.5.
