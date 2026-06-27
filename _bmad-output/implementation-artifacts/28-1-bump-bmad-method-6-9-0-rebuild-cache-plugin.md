# Story 28.1: Bump bmad-method to v6.9.0 + Rebuild Cache and Plugin (Gate)

Status: review

## Story

As a **ma-agents user**,
I want all upstream v6.9.0 additions (`bmad-forge-idea`, the `bmad-architecture` rewrite, `memlog.py`, party-mode/brainstorming enhancements, the Astro 6 security upgrade, the WSL-runs-Windows-Node installer guard) inherited transparently via the version bump, and the bundled offline cache rebuilt from v6.9.0 with the full module set intact,
So that I get them with no manual intervention.

**Gate:** This is the hard gate for Epic 28 — no other story's verification is meaningful until the v6.9.0 tree is on disk. It is also the **hard registry-verification gate**: the v6.9.0 "registry unchanged" claim was verified out-of-tree (shallow tag clone + `gh` compare), so AC3 re-confirms it against the npm-installed `bmad-method@6.9.0` on disk before Stories 28.2/28.3 proceed. Stories 28.2 and 28.3 are blocked on this story; 28.4 depends on all three.

**FR/NFR:** FR211 (supersedes FR208's v6.8.0 pin), NFR58 (includes the new-`_bmad/scripts/*.py` offline-runnable surface).

## Acceptance Criteria

1. **Given** the feature branch, **When** I inspect `package.json`, **Then** `dependencies` declares `"bmad-method": "6.9.0"` (exact pin, no caret/tilde), and `package-lock.json` + `node_modules/bmad-method/package.json` show `6.9.0`.

2. **Given** `BMAD_TARGET_VERSION` in `lib/bmad.js` and `bmad_min_version` in `lib/bmad-extension-plugin/.claude-plugin/marketplace.json` (via its `marketplace.json.template`), **When** I inspect them, **Then** both read `6.9.0` (lockstep with the pin, per the `plugin-manifests` convention).

3. **Given** the bump (the P5-6 key contrast with Epic 27, and the **hard verification gate** for Epic 28 — the prior tag/`gh`-compare verification was out-of-tree, so this story re-confirms against the live install), **When** I confirm against the **npm-installed** `bmad-method@6.9.0` on disk, **Then** I locate the installed registry by resolving the package root via `require.resolve('bmad-method/package.json')` and joining the package-root path, and assert `bmad-modules.yaml` exists there with a `modules:` map carrying `type:` fields — i.e. the actual shipped contract, asserted offline against the live install, not only the existing hand-written `FIXTURE_V68` reader test. The path **and** schema must match v6.8.0 (same package-root **path**, same `modules:` map with `code`/`url`/`name`/`type`), and `scripts/build-bmad-cache.js` is changed **NOT at all** (no edit to `REGISTRY_CANDIDATES`, `parseModulesYaml()`, or the `type`-based filter). If the path or schema is found to differ, the bump **halts** and the discrepancy is escalated (guard against silent drift) rather than papered over.

4. **Given** the bump, **When** I run `npm run build:bmad-cache`, **Then** it exits 0 and resolves the full `type: bmad-org` bundled set — **tea, bmb, cis, gds, wds** — with `bmm`/`core` absent (built-in, never cloned) and `automator` absent (`type: experimental`); and the NFR56 thin-cache fail-loud guard is confirmed still intact (a resolved set smaller than the known set, or no locatable source, exits non-zero with no partial manifest).

5. **Given** the cache rebuild, **When** I inspect `lib/bmad-cache/cache-manifest.json`, **Then** `bmadMethodVersion` reads `6.9.0` and `registrySchema` is unchanged from v6.8.0 (`package-root-v68` carried forward, since the source path/schema did not move).

6. **Given** the bump, **When** I run `npm run build:plugin`, **Then** `lib/bmad-extension-plugin/` is regenerated and committed verbatim, the CI Bundle Drift Guard passes, and the regenerated diff is reviewed line-by-line to confirm it contains only the expected version bump + ma-agents-owned changes (no unexplained drift).

7. **Given** all changes, **When** I run `npm test`, **Then** it is green on Linux/CI; the version-pin assertions in `test/bmad-version-bump.test.js` are updated to `6.9.0` and a new assertion pins that the registry path + schema are unchanged versus v6.8.0; the stale Story-24.1 / `6.6.0` header/labels in that file (which already pin `6.8.0`) are refreshed to `6.9.0`; and `project_name`/config auto-migration is confirmed non-breaking (no ma-agents code change required).

8. **Given** the rebuilt cache, **When** I diff the rebuilt cache's per-module file lists against the prior (v6.8.0) cache, **Then** no unexpected `__pycache__`/`*.pyc` bloat was captured and no skill group ma-agents relies on was dropped by v6.9.0's empty-skill-group cleanup. (v6.9.0's installer filters `tests/`/`__pycache__/`/`*.pyc` from shipped scripts and cleans empty skill-group dirs, but ma-agents' cache build — git clone + `npm install --omit=dev` in `build-bmad-cache.js` — is a **separate path that does no pyc filtering**, so this must be verified, not assumed.)

9. **Given** v6.9.0's new core Python, **When** I inspect the shipped `_bmad/scripts/memlog.py` (installed from `src/scripts/memlog.py`) and any other new `_bmad/scripts/*.py`, **Then** each is confirmed `python3`/stdlib-runnable and does **not** require `uv` on the air-gapped image (the python/uv guard excludes `_bmad/`, so nothing else verifies it). This is a verified-not-assumed NFR58 surface item.

## Tasks / Subtasks

### Task 1: Bump the dependency (AC: 1, 2)

- [ ] 1.1 Edit `package.json` — `"bmad-method": "6.8.0"` → `"6.9.0"` (exact pin)
- [ ] 1.2 `npm install`; verify `node_modules/bmad-method/package.json` shows `6.9.0`
- [ ] 1.3 Update `BMAD_TARGET_VERSION = '6.9.0'` in `lib/bmad.js`
- [ ] 1.4 Update `marketplace.json.template` `bmad_min_version` 6.8.0 → 6.9.0 (lockstep with pin)

### Task 2: Re-verify the registry against the LIVE install — NO reader change (AC: 3)

- [ ] 2.1 Locate the installed registry by resolving `require.resolve('bmad-method/package.json')` + package-root join; assert `bmad-modules.yaml` exists there with a `modules:` map carrying `type:` fields (the actual shipped contract, asserted offline against the live install — not only the hand-written `FIXTURE_V68` reader test)
- [ ] 2.2 Confirm the live path + schema match v6.8.0 (same package-root path, same `code`/`url`/`name`/`type` shape)
- [ ] 2.3 Confirm `scripts/build-bmad-cache.js` requires **no** edit (REGISTRY_CANDIDATES, parseModulesYaml(), and the `type` filter all still resolve); do not touch the reader
- [ ] 2.4 If path/schema differs: halt and escalate (do not silently rework)

### Task 3: Rebuild cache + plugin (AC: 4, 5, 6)

- [ ] 3.1 `npm run build:bmad-cache`; confirm exit 0, set resolves tea/bmb/cis/gds/wds (automator/bmm/core excluded), thin-cache guard intact
- [ ] 3.2 Confirm `cache-manifest.json` `bmadMethodVersion: 6.9.0`, `registrySchema: package-root-v68` (unchanged)
- [ ] 3.3 `npm run build:plugin`; commit the regenerated `lib/bmad-extension-plugin/` verbatim
- [ ] 3.4 Read the regenerated bundle diff line-by-line; confirm only expected changes (Bundle Drift Guard passes)

### Task 4: Verify (AC: 7)

- [ ] 4.1 Update `test/bmad-version-bump.test.js` pin assertions to `6.9.0`; add an assertion that the registry path + schema are unchanged vs v6.8.0; refresh the stale Story-24.1 / `6.6.0` header/labels (which already pin `6.8.0`) to `6.9.0`
- [ ] 4.2 `npm test` green on Linux/CI
- [ ] 4.3 Scratch install; confirm `project_name`/config auto-migration non-breaking, no ma-agents code change needed

### Task 5: Cache hygiene + new-Python offline check (AC: 8, 9)

- [ ] 5.1 Diff the rebuilt cache's per-module file lists vs the prior v6.8.0 cache; confirm no unexpected `__pycache__`/`*.pyc` bloat and no skill group ma-agents relies on dropped by the empty-group cleanup
- [ ] 5.2 Confirm the shipped `_bmad/scripts/memlog.py` (and any new `_bmad/scripts/*.py`) is `python3`/stdlib-runnable and does not require `uv` on the air-gapped image

## Dev Notes

- Supersedes FR208's v6.8.0 pin (FR211).
- This is a pin bump, **not** a reader rework — the contrast with Story 27.1/27.2 is the whole point of P5-6 (registry path AND schema unchanged ⇒ no cache-reader change). Re-verification is a read-only confirmation gate, not a refactor.
- Carry the P5-5 reader, `type` filter, and thin-cache guard forward verbatim; `registrySchema` stays `package-root-v68` because the source did not relocate.
- Satisfy the Bundle Drift Guard by regenerating and reading the diff — not by blindly re-running `build:plugin` until green.
- Check `test/plugin-manifests.test.js` for any `bmad_min_version` assertion to update to `6.9.0`.
- The registry re-verify (AC3) must read the **live installed** registry via `require.resolve('bmad-method/package.json')` + package-root join and assert the shipped `bmad-modules.yaml` `modules:`/`type:` contract offline — the hand-written `FIXTURE_V68` reader test alone is not the gate.
- Cache hygiene (AC8): v6.9.0's BMAD **installer** filters `tests/`/`__pycache__/`/`*.pyc` and prunes empty skill-group dirs, but ma-agents' cache-build path (`build-bmad-cache.js`: git clone + `npm install --omit=dev`) does **not** inherit that installer pyc-filtering — diff the rebuilt cache against the prior one to catch `__pycache__`/`.pyc` bloat and any dropped skill group.
- New core Python (AC9): `src/scripts/memlog.py` ships in v6.9.0 (installs to `_bmad/scripts/memlog.py`) and does not exist in the repo today; the python/uv guard excludes `_bmad/`, so its offline/no-`uv` runnability must be confirmed here (or in 28.4), not assumed (NFR58 surface).
- Stale labels (AC7): `test/bmad-version-bump.test.js` still carries "Story 24.1 … 6.6.0" header/labels while pinning 6.8.0 — refresh them to 6.9.0 during the AC7 edit.
