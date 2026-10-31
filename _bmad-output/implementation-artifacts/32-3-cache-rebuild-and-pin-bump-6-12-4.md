# Story 32.3 — Pin Bump to bmad-method 6.12.4 and Cache Rebuild at the Upstream Module Pins

Status: ready-for-dev (do NOT start before Story 32.1 records PASS; consume its AC2 / AC7 findings)
Blocked on: 32-1
Wave: 1 (parallel with 32.2)

**FR:** FR275 (supersedes FR236), FR271, FR276 (no `--shims`), FR279 (Node engines). **NFR:** NFR2, NFR50, NFR57, NFR58 (offline bundle self-contained), NFR73 (two-sided bundle set equality, unchanged logic). **Decision inputs:** P5-10.5 (latest-only, no shims), P5-10.8 (gate-first).

## Story

As an **ma-agents user installing online or air-gapped**,
I want ma-agents to install exactly bmad-method 6.12.4 with `tea`, `cis` and `bmb` at the releases the 6.12.4 registry pins, from a cache built at those releases,
so that online and offline installs of the same ma-agents version land the same upstream bytes, and no upstream release cut after this ma-agents version can reach my install.

## Context

ma-agents pins bmad-method in two places — `package.json:35` (`"bmad-method": "6.10.0"`) and `lib/bmad.js:2830` (`BMAD_TARGET_VERSION = '6.10.0'`, the migration threshold used at `lib/bmad.js:1000` / `:1193`). The bundled offline cache is described by `lib/bmad-cache/cache-manifest.json` (`bmadMethodVersion: "6.10.0"`, `registrySchema: "package-root-v68"`, `pinTag` tea `v1.19.0`, bmb `v2.1.0`, cis `v0.2.1`). Release 3.18.1 added the pin mechanism (`bug-external-bmad-modules-float-to-upstream-latest`, PR #151): `getBundledModulePins()` (`lib/bmad.js:667`) reads each module's `pinTag` from the manifest and `buildBmadArgs()` (`lib/bmad.js:896`) emits `--pin <id>=<tag>` per selected module (`lib/bmad.js:935-939`), guarded by `test/bundled-module-pins.test.js`. **This story updates that mechanism; it must not bypass it.** The cache builder today clones each module's default branch head (`scripts/build-bmad-cache.js:363`, `git clone --depth 1 --branch <branch>`) and derives `pinTag` only if that head is exactly a release tag (`:398`, `git describe --tags --exact-match HEAD`); upstream `tea` `main` has moved to v2.x, so cloning `main` cannot yield the v1.27.2 the 6.12.4 registry pins. The plugin floor is `lib/bmad-extension/.claude-plugin/marketplace.json.template:42` (`"bmad_min_version": "6.10.0"`), and ma-agents' own `package.json:57-58` still declares `"node": ">=16.0.0"` while bmad-method 6.12.4 requires `>=20.12.0`.

## Acceptance Criteria

1. **Pin sites.** `package.json` dependency `bmad-method` is exactly `"6.12.4"` (no range); `BMAD_TARGET_VERSION === '6.12.4'`; `package-lock.json` resolves `node_modules/bmad-method` to `6.12.4`. Test (extend `test/bmad-version-bump.test.js`): reads `require('bmad-method/package.json').version` from the *installed* package — not from a constant in `lib/` — and asserts it equals both pin sites.
2. **Engines (FR279).** ma-agents `package.json` `engines.node` equals the string 32.1 AC1 recorded for bmad-method 6.12.4 (expected `>=20.12.0`). Test asserts ma-agents' range is not looser than the installed bmad-method's `engines.node` (compare against `require('bmad-method/package.json').engines.node`, not against a literal).
3. **Builder clones the registry pin.** `scripts/build-bmad-cache.js` reads the pin field 32.1 AC2 named from `bmad-modules.yaml` and clones that tag (`--branch <tag>`) when present; for a module the registry leaves unpinned (`bmb`), it clones the latest **stable release tag** (not `main` head) and records it. `pinTag` in the manifest equals the registry pin for tea/cis. Test: run the reader against the vendored 6.12.4 `node_modules/bmad-method/bmad-modules.yaml` and assert the planned `{code → tag}` map equals the registry's own pin values read independently in the test with `js-yaml`.
4. **Cache rebuilt.** `npm run build:bmad-cache -- --force` produces `lib/bmad-cache/{tea,bmb,cis}` with `cache-manifest.json` `bmadMethodVersion: "6.12.4"`, `pinTag` tea `v1.27.2`, cis `v0.3.2`, bmb = the tag recorded in AC3, and a `registrySchema` value matching 32.1's AC2 finding. Each cached module's own `module.yaml` (or plugin manifest) version is read from disk and matches its `pinTag` (outside authority: the cloned bytes, not the manifest).
5. **Allowlist logic intact.** `KNOWN_BUNDLED_MODULES` stays `['tea','bmb','cis']` (`scripts/build-bmad-cache.js:60`); `test/bundle-filter-set-equality.test.js` and `test/build-bmad-cache-reader.test.js` pass against the 6.12.4 registry (gds present-but-not-bundled, wds absent, `bmad-loop` / `bmad-automator` still excluded by FR235).
6. **Pins reach the install.** `test/bundled-module-pins.test.js` passes unmodified in logic, with its fixture tag strings updated; `buildBmadArgs({…modules:['bmm','tea','cis','bmb']})` emits `--pin tea=v1.27.2 --pin cis=v0.3.2 --pin bmb=<tag>` derived from the rebuilt manifest.
7. **No shims (negative, FR271/FR276).** `test/build-bmad-args.test.js` asserts the `buildBmadArgs` output, for every combination of `action` (install/update), `customSource` present/absent and `tools` empty/non-empty, contains no `--shims` token. A source-level check asserts the literal `--shims` appears nowhere under `lib/` or `bin/`.
8. **Plugin floor.** `marketplace.json.template` `bmad_min_version` is `"6.12.4"`; `npm run build:plugin` regenerates `lib/bmad-extension-plugin/.claude-plugin/marketplace.json`; `test/plugin-manifests.test.js` asserts `bmad_min_version` equals the `package.json` bmad-method pin (read from `package.json`, not restated).
9. **Version-string tests re-pinned honestly.** Every test that hard-codes `6.10.0` is updated: `test/bmad-version-bump.test.js`, `bundle-filter-set-equality`, `bundled-module-pins`, `demerzel-ml-removal-drift`, `extension-module-restructure`, `module-help-canonical-schema`, `v68-pluginresolver-enumeration-passthrough`. `test/staging-6-10-0-regression.test.js` is either renamed/re-targeted to 6.12.4 or kept with a comment stating which 6.10.0 behaviour it still guards; it is not silently left asserting a version nothing installs.
10. **Real install, offline smoke.** A scratch install from `npm pack --ignore-scripts` of this branch into a temp project (`--yes`, modules `bmm,tea,cis,bmb`, tool `claude-code`) exits 0 with DNS and git-https blocked, and `_bmad/_config/manifest.yaml` records bmad-method 6.12.4 and the three pinned module versions. If 32.1 AC7 showed a duplicate-leaf abort for our not-yet-deleted `bmad-sprint-planning`, this AC is recorded as **blocked-on-32.4** with the exact message instead of being forced green — the full gate is 32.9.

## Tasks / Subtasks

- [ ] T1 Pin sites + lockfile + engines (AC1, AC2)
- [ ] T2 Builder: read registry pin; clone tag; stable-tag fallback for unpinned; tests (AC3, AC5)
- [ ] T3 `npm run build:bmad-cache -- --force`; inspect cloned versions (AC4)
- [ ] T4 Pins → `buildBmadArgs`; `--shims` negative tests (AC6, AC7)
- [ ] T5 `bmad_min_version`; `npm run build:plugin` (AC8)
- [ ] T6 Re-pin the version-string tests (AC9)
- [ ] T7 Offline scratch install (AC10)

## Dev Notes

- Builder internals: `normalizeModules()` defaults `branch` to `main` (`scripts/build-bmad-cache.js:266`); `getRemoteHead(url, branch)` (`:324`) drives the incremental skip at `:344` — with a tag it should compare the tag's SHA, or `--force` must be documented as required on pin change. Keep the `git describe --exact-match` check as a post-clone assertion (tag cloned ⇒ HEAD is exactly that tag).
- Offline pinned fetch: 3.18.1 stamps cache markers `channel=pinned` + a local tag ref so `--pin` resolves against the `file://` self-origin offline (`ensureCacheMarker`, `cacheDiffersFromPin` — exercised in `test/bundled-module-pins.test.js:107-130`). Re-verify with the new tags; `prePopulateBmadCache` replaces off-pin caches, so an existing 3.18.x user's v1.19.0 tea cache self-heals.
- TEA is the risk: 3.18.1 pinned v1.19.0 because TEA v2.x dropped `src/module.yaml`. v1.27.2 is still on the v1 line — confirm on disk (AC4) that it carries the layout bmad-method 6.12.4 reads.
- Regenerated trees are large; `lib/bmad-cache/` and `lib/bmad-extension-plugin/` must be committed together with the template change or the Bundle Drift Guard (`.github/workflows/bundle-drift.yml`) fails (see memory: plugin bundle drift on version bumps).
- Node engines bump is user-visible (Node 16/18 users can no longer install) — note it for 32.9's CHANGELOG and semver argument; do not soften it here.
- Run `npm run build:atlas` only if `lib/knowledge-atlas/src/` changed (it should not).
- Windows: `build-bmad-cache` deletes cloned trees; 3.18.1's retry-on-lock fix covers bmad-method's own deletes, not this script — if `fs.removeSync` hits EBUSY, close editors/AV scans and re-run rather than adding retries here.

## Out of scope

- Deleting our shadowed skills (32.4); `bmad-dev-epic` rewrite (32.5); docs sweep (32.6).
- Adding `gds` back to the bundle, or any TEA v2.x adoption.
- Shipping a release (32.9).
- Extension-repo vendoring (Epic 35).

## Verification record

Suite: … ; mutants: (e.g. builder ignores registry pin → AC3 red; `--shims` pushed in update path → AC7 red) … ; offline smoke: … ; unverified: …
