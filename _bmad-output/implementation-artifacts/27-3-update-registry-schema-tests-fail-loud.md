# Story 27.3: Update Registry-Schema Tests + Add Thin-Cache Fail-Loud Regression Tests

Status: backlog

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

- [ ] 1.1 Replace `'v63'`/`'legacy'` schema assertions with the relocated-YAML source tag
- [ ] 1.2 Replace the `built_in`-flag filter assertion with the `type`-based filter (bmad-org include / experimental exclude); retain bmm/core exclusion

### Task 2: Invert the wds tests (AC: 2)

- [ ] 2.1 Rewrite `'wds module is NOT in the v6.6.0 upstream registry (retired)'` (~line 128) → assert wds present (`type: bmad-org`) and bundled at v6.8.0
- [ ] 2.2 Rewrite `'retired upstream modules (e.g. wds) are flagged in manifest when retained'` (~line 192) → wds is a normal clone, not a retained relic

### Task 3: Thin-cache fail-loud + bundled-set tests (AC: 3, 4, 5)

- [ ] 3.1 Add a fail-loud test: fixture with a deficient `type: bmad-org` set ⇒ non-zero exit, no manifest written
- [ ] 3.2 Assert the bundled set: tea/bmb/cis/gds/wds present; automator/bmm/core absent
- [ ] 3.3 Ensure resolution runs without network (fixtures or installed package)

### Task 4: Green suite (AC: 6)

- [ ] 4.1 Run `npm test`; document any pre-existing unrelated failures

## Dev Notes

- Reuse the existing `bmad-version-bump.test.js` "Task 2" structure where practical.
- The fail-loud test should drive the negative path without a genuinely broken bmad-method install — point the resolver at a fixture with a deficient module set.
- Mind the Windows CRLF gotcha; evaluate the clean baseline on a normalized/CI environment, but note 27.5/27.7 require the CRLF drift actually resolved (not waived) before release.
