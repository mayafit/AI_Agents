# Story 30.3: Bump the Pin 6.9.0 -> 6.10.0, Rebuild Cache+Plugin Deterministically, Offline Install = Exactly Five

Status: review

## Story

As a **ma-agents maintainer completing the BMAD v6.10.0 integration**,
I want the `bmad-method` dependency bumped from `6.9.0` to `6.10.0`, the bundled
offline cache and extension plugin rebuilt deterministically against the live
install, and the Story 30.2 closed-allowlist filter + two-sided set-EQUALITY
guard proven end-to-end at 6.10.0 (not just against 30.2's hand-written
fixtures),
So that ma-agents ships the v6.10.0 upstream improvements while the offline
install remains exactly `{tea, bmb, cis, gds, wds}` with the new, air-gap-hostile
`bmad-loop` module absent, and the two genuinely-new 6.10.0 staging behaviors
(`isLocalSourcePath`, `_copyResolvedSkills` fail-loud) are confirmed neutral for
ma-agents' own staged plugin.

**Depends on Story 30.1** (the v6.10.0 confirmation gate — PASS) and **Story
30.2** (the closed-allowlist filter + set-EQUALITY guard, landed at 6.9.0 so it
could be validated independently of this bump).

**FR:** FR235 (carried forward — the safety spine this story exercises against
the real target version). **NFR:** NFR73, NFR2/NFR54/NFR57 (air-gapped
self-containment), NFR56 (superseded for this cache by NFR73, reasserted here).

## Context (from the 30.1 GATE and the 30.2 spec — do not re-investigate)

- The 30.1 gate confirmed live against `bmad-method@6.10.0`: registry PATH and
  SCHEMA unchanged vs 6.9.0 (additive-only new fields); `bmad-loop` is
  `type: bmad-org` + `marketplace-plugin: true`; `bmad-automator` is
  `type: experimental` + `deprecated: true`.
- The 30.2 story already closed `scripts/build-bmad-cache.js`'s filter to a
  closed allowlist (`KNOWN_BUNDLED_MODULES = ['tea','bmb','cis','gds','wds']`)
  and added the two-sided `diffBundleSet()` guard — landed at the 6.9.0 pin so
  it could ship independently. This story's entire job is the pin bump plus
  proving that machinery holds against the REAL 6.10.0 install, not a fixture.
- The 30.1 gate also identified two upstream behaviors genuinely NEW at 6.10.0
  that touch ma-agents' `--custom-source` staging flow: `isLocalSourcePath()`
  (upstream #2511, widens local-path detection to Windows forms) and
  `_copyResolvedSkills()` fail-loud guards (empty marketplace-plugin resolution;
  duplicate skill-leaf names) in `official-modules.js`. Neither requires an
  ma-agents code change — both are regression-verified against ma-agents' real
  staged plugin bundle.

## Acceptance Criteria

1. **Given** `package.json`, **When** I inspect `dependencies`, **Then**
   `bmad-method` reads exactly `6.10.0` (no caret/tilde), `package-lock.json`
   and `node_modules/bmad-method/package.json` agree, and `lib/bmad.js`'s
   `BMAD_TARGET_VERSION` and `lib/bmad-extension/.claude-plugin/marketplace.json.template`'s
   `bmad_min_version` are updated in lockstep (per the established
   `plugin-manifests` convention).

2. **Given** the bump, **When** I run `npm run build:bmad-cache` against the
   live-installed 6.10.0 registry, **Then** it exits 0 and resolves **exactly**
   `{tea, bmb, cis, gds, wds}` — `bmad-loop` is absent despite being
   `type: bmad-org` in the live registry (the 30.2 closed-allowlist filter
   proven end-to-end, not just via fixture), and `cache-manifest.json` records
   `bmadMethodVersion: "6.10.0"` with `registrySchema` unchanged
   (`package-root-v68`).

3. **Given** the rebuild, **When** I run `npm run build:plugin`, **Then**
   `lib/bmad-extension-plugin/` is regenerated and committed verbatim, the diff
   is reviewed line-by-line (expected: only the `bmad_min_version` bump), and
   the CI Bundle Drift Guard (`.github/workflows/bundle-drift.yml`, which
   re-runs `build:plugin` and diffs against HEAD) passes against the committed
   state.

4. **Given** the clean-box offline-install claim, **When** the resolved/bundled
   set is asserted against the live 6.10.0 install, **Then** it is proven to be
   exactly the five allowlisted codes, `bmad-loop`/`bmad-automator` excluded —
   verified two ways: (a) the actual `npm run build:bmad-cache` run against the
   live install, and (b) a dedicated live-install assertion
   (`test/bmad-version-bump.test.js`) that reads the installed
   `bmad-modules.yaml`, confirms `bmad-loop`'s shape
   (`bmad-org`+`marketplace-plugin:true`) and `bmad-automator`'s
   (`experimental`+`deprecated:true`), and runs the real closed-allowlist reader
   against it to assert the resolved set equals `{tea,bmb,cis,gds,wds}` with no
   drift. (Full `--network none` clean-Windows Docker E2E is Story 30.8's job —
   this is the strongest LOCAL offline verification: no network reachable
   during the assertion itself, reading only the already-installed package.)

5. **Given** the two NEW 6.10.0 staging behaviors the gate identified, **When**
   I regression-verify them against ma-agents' own staged plugin
   (`lib/bmad-extension-plugin/`, built by `build:plugin`), **Then**:
   - `CustomModuleManager.parseSource()` classifies the literal
     `--custom-source` argument `lib/bmad.js`'s `stagePlugin()` produces
     (`./${PLUGIN_STAGE_DIR_NAME}`) as `type: 'local'`, and the widened 6.10.0
     forms (`.\`-relative, `..\`-relative, Windows-absolute) are ALSO
     recognized without regressing the POSIX forms already relied upon.
   - The real `PluginResolver` (from the installed 6.10.0 package) resolves
     ma-agents' generated `marketplace.json` plugin entry to a NON-EMPTY skill
     set with UNIQUE leaf (basename) names, and the real
     `OfficialModules._copyResolvedSkills()` completes end-to-end against that
     resolution with no throw — proving the two 6.10.0 fail-loud guards do not
     trip on ma-agents' actual bundle.
   - The duplicate-leaf fail-loud guard is confirmed to still fire (regression
     insurance) by feeding `_copyResolvedSkills()` a synthetic resolution with
     a repeated skill path.

6. **Given** all changes, **When** the affected test files are run DIRECTLY
   (never bare `npm test` — pre-existing Windows CRLF/MIL-498 template drift
   halts it at file position 13, unrelated to this story), **Then**
   `test/bmad-version-bump.test.js`, `test/bundle-filter-set-equality.test.js`,
   `test/staging-6-10-0-regression.test.js` (new), `test/plugin-manifests.test.js`,
   `test/build-plugin.test.js`, and `test/build-bmad-cache-reader.test.js` are
   all green.

## Tasks / Subtasks

### Task 1: Bump the pin (AC: 1)

- [x] 1.1 `package.json`: `"bmad-method": "6.9.0"` -> `"6.10.0"`.
- [x] 1.2 `npm install` (`--ignore-scripts` to avoid triggering `prepare`
      — the atlas/plugin rebuilds are done explicitly in Task 2/3); confirm
      `node_modules/bmad-method/package.json` reads `6.10.0`.
- [x] 1.3 `lib/bmad.js`: `BMAD_TARGET_VERSION = '6.9.0'` -> `'6.10.0'`.
- [x] 1.4 `lib/bmad-extension/.claude-plugin/marketplace.json.template`:
      `bmad_min_version` `6.9.0` -> `6.10.0`.

### Task 2: Rebuild the cache deterministically (AC: 2, 4)

- [x] 2.1 `npm run build:bmad-cache`; confirm exit 0, resolved set is exactly
      `tea, bmb, cis, gds, wds` (bmad-loop absent — incremental-update logic
      skipped re-cloning all five since their upstream HEAD SHAs were
      unchanged, which is itself the byte-stability/determinism proof).
- [x] 2.2 Confirm `cache-manifest.json` `bmadMethodVersion: "6.10.0"`,
      `registrySchema: "package-root-v68"` (unchanged).

### Task 3: Rebuild the plugin, confirm drift-clean (AC: 3)

- [x] 3.1 `npm run build:plugin`; regenerate
      `lib/bmad-extension-plugin/.claude-plugin/marketplace.json`.
- [x] 3.2 Read the diff line-by-line: the only change is `bmad_min_version`
      `6.9.0` -> `6.10.0` — no unexplained drift.
- [x] 3.3 Commit the regenerated bundle; the Bundle Drift Guard
      (`git diff --exit-code -- lib/bmad-extension-plugin/` after a fresh
      `build:plugin`) is clean post-commit.

### Task 4: Live offline-install verification (AC: 4)

- [x] 4.1 Rework the `test/bmad-version-bump.test.js` AC3-style live-install
      gate: assert `bmad-loop`'s shape (`bmad-org` + `marketplace-plugin:true`)
      and `bmad-automator`'s (`experimental` + `deprecated:true`) against the
      LIVE registry, then run the real `normalizeModules()` reader against that
      live YAML and assert the resolved set is exactly the five with
      `bmad-loop` excluded.
- [x] 4.2 Assert `cache-manifest.json`'s module keys are exactly the five
      (`bmad-loop` never appears).

### Task 5: Regression-verify the two NEW 6.10.0 staging behaviors (AC: 5)

- [x] 5.1 New `test/staging-6-10-0-regression.test.js`: drive the real,
      installed `CustomModuleManager.parseSource()` against ma-agents'
      literal `--custom-source` argument and the widened 6.10.0 local-path
      forms (`.\`, `..\`, Windows-absolute), plus a POSIX-form regression
      check and a false-positive guard (a real URL must NOT be misclassified
      local).
- [x] 5.2 Same file: drive the real `PluginResolver` + `OfficialModules`
      against ma-agents' actual generated `lib/bmad-extension-plugin/`
      bundle — non-empty resolution, unique leaf names, `_copyResolvedSkills`
      completes with no throw; plus a synthetic duplicate-leaf case proving
      the throw still fires, and an empty-skills-array case proving
      `PluginResolver.resolve()` still returns `[]`.
- [x] 5.3 Register the new test file in `package.json`'s `test` script (after
      `bmad-version-bump.test.js`).

### Task 6: Full verification (AC: 6)

- [x] 6.1 Run each affected test file directly (never bare `npm test`); all
      green.
- [x] 6.2 Self-review (code-review + edge-case-hunter) before hand-off.

## Dev Notes

- **Why the cache rebuild "skipped" every module.** `build-bmad-cache.js`'s
  incremental-update check compares the cached `commitSha` against
  `git ls-remote`'s current HEAD for each module's branch; all five were
  already at the latest `main` HEAD from the prior (6.9.0-era) rebuild, so
  the 6.10.0 rebuild reused the existing clones byte-for-byte and only updated
  `cache-manifest.json`'s `bmadMethodVersion`/`generated` fields. This IS the
  determinism proof this story's AC asks for — a rebuild that reclones
  identical upstream content is trivially byte-stable; `--force` was
  deliberately NOT used (it would only re-clone, not change which modules
  qualify — that decision is made by `normalizeModules()` against the live
  registry, which is what actually matters here).
- **The offline-install proof, precisely.** The full `--network none`
  clean-Windows Docker E2E (Story 30.8) is out of scope here. This story's
  proof is two-layered and BOTH exercise the real, installed 6.10.0 package
  with no network reachable during the assertion: (1) the actual
  `npm run build:bmad-cache` run (which DOES touch the network for
  `git ls-remote`/clone, but resolves its bundle *decision* purely from the
  locally-installed `bmad-modules.yaml`) resolved exactly the five; (2) the
  `test/bmad-version-bump.test.js` live-install gate re-derives the same
  result by reading the installed YAML directly and running the pure reader
  function — no clone, no `git ls-remote`, fully offline.
- **Why `test/staging-6-10-0-regression.test.js` is a new file, not an
  extension of `bmad-version-bump.test.js`.** The two upstream behaviors it
  covers (`isLocalSourcePath`, `_copyResolvedSkills`) are orthogonal to the
  registry/cache-manifest contract `bmad-version-bump.test.js` owns — they
  live in `custom-module-manager.js`/`official-modules.js`/`plugin-resolver.js`,
  not `build-bmad-cache.js`. Keeping them separate also means a future bump
  story can retire this file's assertions independently once #2511 /
  fail-loud stop being "new" (though as of 6.10.0 they remain accurate).
- **Scope boundary — no ma-agents code change required for #2511 or the
  fail-loud guards.** Both are neutral-to-beneficial for ma-agents' existing
  staging arg and generated plugin shape (Task 5 proves this, not asserts it
  by inspection alone). If a future story ever changes `stagePlugin()`'s
  argument format or the plugin's skill layout, `test/staging-6-10-0-regression.test.js`
  is the regression net that would catch a fail-loud trip early.
- **CHANGELOG.md not touched.** Following the Story 30.2 precedent (also an
  Epic 30 sub-story that did not touch `CHANGELOG.md` or the ma-agents package
  `version` field), the epic-level user-facing changelog entry and version cut
  land at the epic's release-gate story, not at each individual integration
  step.

## Change Log

| Date | Change |
|------|--------|
| 2026-07-12 | Story created and implemented in worktree `feature/epic-30-story-30-3`. |
