---
type: bug
severity: high
title: External BMAD modules (tea, bmb, cis) float to upstream's latest release — TEA v2.0.x breaks every install that selects tea
---

# Bug: External BMAD modules float to upstream's latest release — TEA v2.0.x breaks every install that selects tea

**Status:** review
**Severity:** high
**Affected Component:** `lib/bmad.js` (`buildBmadArgs`, `ensureCacheMarker`, `prePopulateBmadCache`); `lib/bmad-cache/cache-manifest.json`; `scripts/build-bmad-cache.js`

## Summary

ma-agents pins `bmad-method` exactly (`package.json` `"bmad-method": "6.10.0"`,
`BMAD_TARGET_VERSION` in `lib/bmad.js`), but passes no channel or pin flags for
the external modules. bmad-method's default for an external module is the
`stable` channel, which `cloneExternalModule()` resolves to that module's
**latest stable tag at install time** via the GitHub API. The same ma-agents
release therefore installs whatever tea/bmb/cis releases exist on the day it
runs, none of which were tested with it.

TEA v2.0.0 (and later v2.0.1 and v2.0.2) moved to a plugin layout (`skills/bmad-tea/`,
`skills/bmod-tea/bmod.toml`, `.claude-plugin/marketplace.json`) and dropped
`src/module.yaml` entirely. bmad-method 6.10.0's registry still points tea at
`src/module.yaml`, so every online install that selects tea now fails. The ma-agents
code and the ma-agents release did not change.

## Reproduction Steps

1. Online machine, ma-agents 3.18.0, empty `~/.bmad/cache/external-modules/tea`.
2. `npx ma-agents install` (default module set includes tea).
3. Observe:

```
Error: Module 'tea' was downloaded but its module definition was not found.
Expected 'src/module.yaml' to exist in version v2.0.2, but it is missing.
The repository may have been restructured after this release was tagged.
Try reinstalling with `--next=tea` to use the latest main branch instead.
  at ExternalModuleManager.findExternalModuleSource (external-manager.js:577)
```

The suggested `--next=tea` does not help: `main` HEAD is past v2.0.2 and has
the same layout.

Reported from `D:\Code\Workshop` (2026-10-13). The cache at
`~/.bmad/cache/external-modules/tea` held `.bmad-channel.json`
`{ channel: "stable", version: "v2.0.2" }`, and `find -name module.yaml`
returned nothing.

## Expected Behavior

A given ma-agents release installs the same external-module releases it was
tested with, online or offline, regardless of what upstream has published since.

## Actual Behavior

- **Online:** resolves to upstream's newest stable tag (tea v2.0.2, bmb v2.2.2,
  cis v0.3.2 on 2026-10-13). bmb and cis still work by luck. tea breaks.
- **Offline:** falls back to the bundled cache (tea v1.19.0, bmb ≈ v2.1.0, cis
  v0.2.1), so online and offline installs of the same release diverge.
- **Bundled cache bypassed:** `cache-manifest.json` already recorded the tested
  commit for each module, but it was used only to write the offline-fallback
  marker. Online, bmad-method overwrote the pre-populated cache with the newer
  clone, and `prePopulateBmadCache` then skipped it on later runs
  ("Cached module exists, skipping"), so the broken clone persisted.

## Root Cause

ma-agents never told bmad-method which release of each external module to use.
bmad-method 6.10.0 supports this through `--pin CODE=TAG` (repeatable;
`tools/installer/modules/channel-plan.js`, precedence `--pin > --next > --channel >
registry default > stable`). ma-agents didn't pass it.

## Fix

1. **`pinTag` per bundled module** in `lib/bmad-cache/cache-manifest.json`:
   the release the bundled cache was built from: tea `v1.19.0` (exact,
   `8734d51`), cis `v0.2.1` (exact, `07a8dd0`), bmb `v2.1.0` (the cached
   `e6935f2` is 2 commits ahead, touching only `CHANGELOG.md` and
   `.claude-plugin/marketplace.json`; GitHub compare `v2.1.0...e6935f2`).
2. **`buildBmadArgs` passes `--pin <id>=<tag>`** for every selected module
   that has a pin (`getBundledModulePins()`). It skips unselected modules,
   because bmad-method warns on those, and never pins `bmm`. This covers all
   four call sites: install, update, migration, and custom-marketplace subset.
3. **Offline-safe cache stamping.** With `--pin`, bmad-method wipes and
   re-clones a cache whose marker is on a different channel, which an
   air-gapped host can't survive. `ensureCacheMarker` therefore writes
   `{ channel: "pinned", version: <pinTag> }` and creates the tag locally
   (`ensureLocalTag`), so bmad-method's
   `git fetch origin tag <pinTag>` resolves against the cache itself (origin
   = `file://` self, see `restoreGitDir`).
4. **Self-heal stale caches.** `prePopulateBmadCache` replaces a cached module
   whose marker isn't pinned at the manifest's tag (`cacheDiffersFromPin`).
   This repairs machines already holding the broken tea v2.0.2 clone.
5. **Cache builder** (`scripts/build-bmad-cache.js`) records `pinTag` from
   `git describe --tags --exact-match HEAD`. It warns when HEAD isn't a
   release, and the new test then fails the build.

## Verification

- `test/bundled-module-pins.test.js` (10 tests, wired into `npm test`). It is
  mutation-verified: dropping the pin loop fails 2 tests, and dropping the
  stale-cache replacement fails 1.
- End-to-end against real bmad-method 6.10.0 with a scratch HOME seeded with
  the user's actual tea v2.0.2 cache:
  - **Online:** `prePopulateBmadCache` printed
    `Replaced cached module: tea (not at pinned v1.19.0)`, and the install
    exited 0 with manifest tea `v1.19.0`, bmb `v2.1.0`, cis `v0.2.1`. All
    three were served from the cache; the origin stayed `file://`.
  - **Air-gapped:** same result (exit 0, same versions) with node DNS blocked
    (`https.get` and `fetch` → `ENOTFOUND`) and git limited to
    `GIT_ALLOW_PROTOCOL=file`.

## Notes

- Upgrading a bundled module is now a deliberate act: rebuild the cache from
  a release, and the builder records the new `pinTag`. Taking TEA v2.x needs
  a bmad-method version that understands its plugin layout. That's a
  separate decision, not part of this fix.
- **Behaviour change for already-floated projects:** a project that 3.18.0
  installed at a newer upstream release (e.g. `D:\Code\Workshop`: bmb
  `v2.2.2`, cis `v0.3.2`) is moved back to the pinned release (bmb `v2.1.0`,
  cis `v0.2.1`) on its next ma-agents install or update. This is intended:
  it returns the project to the tested set. Release notes should say so.
- gds and wds aren't bundled and aren't installable through ma-agents
  (FR75), so they need no pin.
- **Workaround for 3.18.0 users:** deselect tea (`--bmad-modules "bmm,bmb,cis"`,
  quoted in PowerShell, see
  `bug-bmad-modules-csv-split-by-powershell-npx-shim`) and delete
  `~/.bmad/cache/external-modules/tea`.
- CODE FIX; NO PRD amendment.
