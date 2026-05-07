---
type: bug
severity: high
title: Offline install fails for bundled modules — bmad-method tries to resolve stable tag from GitHub API
---

# Bug: Offline install fails for bundled modules — bmad-method tries to resolve stable tag from GitHub API

**Severity:** high
**Affected Component:** ma-agents BMAD cache pre-population (lib/bmad.js prePopulateBmadCache)

## Reproduction Steps

1. Disconnect a machine from the network (or block egress to github.com).
2. Run `npx ma-agents@3.12.1 install --yes --agent claude-code` on a fresh project.
3. Observe the install log: cache pre-population reports all 5 modules copied to `~/.bmad/cache/external-modules/`.
4. bmad-method install fails with:
   ```
   Could not resolve stable tag for 'bmb' (failed to resolve ...). Check your network connection, or rerun with --next=bmb / --pin bmb=<tag> to skip the tag lookup.
   ```
   Source: `node_modules/bmad-method/tools/installer/modules/external-manager.js:302`.

## Expected Behavior

Offline installs of any combination of bundled BMAD modules (bmm, bmb, cis, gds, tea) succeed end-to-end with no network access, using the pre-populated cache shipped in the npm tarball. This is one of ma-agents' core value props (NFR54: "preserve the air-gapped self-containment guarantee end-to-end").

## Actual Behavior

The install aborts at the first external module (bmb) because bmad-method's `cloneExternalModule()` function tries to resolve the latest stable git tag from the GitHub API, fails with a network error, then tries to fall back to the `.bmad-channel.json` marker in the cached module dir — but the marker was never written by ma-agents.

Pre-3.12.1 the bug was masked because ma-agents only ever requested `--modules bmm` (bmm ships built into bmad-method itself, no external-cache resolution). 3.12.1's "install all bundled modules by default" fix exposed the latent bug.

## Root Cause Hypothesis

bmad-method 6.6.0's offline fallback path (external-manager.js:270-292) reads `<moduleCacheDir>/.bmad-channel.json` to learn what ref to use when the GitHub API call fails:

```js
const cachedMarker = await readChannelMarker(path.join(moduleCacheDir, '.bmad-channel.json'));
if (cachedMarker?.channel && (await fs.pathExists(moduleCacheDir))) {
    // use cached version, no network needed
    return moduleCacheDir;
}
// else: throw "Could not resolve stable tag for '<module>'"
```

ma-agents' `prePopulateBmadCache` copies each module's source tree (including `_git_preserved/` → `.git/`) but never writes this marker. The marker is bmad-method's own convention — written automatically after a successful online clone (line 419), but ma-agents bundles the modules out-of-band and never writes one.

## Affected Files

- lib/bmad.js (prePopulateBmadCache)
- test/bmad-module-selection.test.js (existing — extend with marker tests)

## Suggested Fix

1. Add an `ensureCacheMarker(moduleDir, manifestEntry)` helper in `lib/bmad.js` that writes `<moduleDir>/.bmad-channel.json` with the schema bmad-method's `writeChannelMarker()` produces:
   ```json
   {
     "channel": "stable",
     "version": "<branch from cache-manifest.json, defaults to 'main'>",
     "sha":     "<commitSha from cache-manifest.json>",
     "writtenAt": "<iso timestamp>"
   }
   ```
2. The helper must NOT overwrite an existing marker — that would clobber a user's online-resolved channel/version.
3. The helper must no-op if the manifest entry is missing or has no `commitSha` (no fabricated values).
4. In `prePopulateBmadCache`, after each module is copied (or on the skip path), call `ensureCacheMarker(dst, manifest.modules[mod])`. Apply on skip path too, since prior ma-agents versions wrote modules to the cache without markers and left users wedged.
5. Channel value defaults to `stable` because that's bmad-method's own default when a registry entry has no `default_channel` field (external-manager.js:133).
6. Add tests covering: write-correct-schema, do-not-overwrite, no-op-on-missing-manifest, no-op-on-missing-commitSha, fallback-to-main-when-no-branch.

## Status

review

## Implementation Notes

- The bundled cache tarball already contains complete `_git_preserved/` directories per module (verified via `tar tzf`): `objects/pack/*.pack` for git objects, `HEAD`, `refs/heads/main`, `packed-refs`. Nothing was missing from the package — only the marker file.
- `restoreGitDir()` at lib/bmad.js:2543 already runs after each copy and rewrites origin to a local `file://` URL. Combined with the new marker, offline installs now have everything they need: bmad-method reads the marker → uses cached dir → done.
- Channel chosen as `stable` because that's bmad-method's registry default. Writing `next` would risk triggering different downstream behavior (next-channel modules track main HEAD; ours are pinned to a specific commit).

## Acceptance Criteria Status

- [x] AC1 — `prePopulateBmadCache` writes `.bmad-channel.json` for every cached module
- [x] AC2 — Marker schema matches bmad-method's `writeChannelMarker()` output
- [x] AC3 — Existing markers are never overwritten (preserves user state)
- [x] AC4 — Missing manifest entry / commitSha is a graceful no-op
- [x] AC5 — Tests cover all five branches

## File List

- `lib/bmad.js` — added `ensureCacheMarker()` helper; wired into `prePopulateBmadCache`; exported helper
- `test/bmad-module-selection.test.js` — added 5 async tests for the new helper; introduced `testAsync()` runner alongside the sync `test()`

## Change Log

- 2026-05-05 (3.12.2): Fixed offline-install regression in 3.12.1. ma-agents now writes `.bmad-channel.json` for every cached BMAD module so bmad-method's offline fallback path resolves without network access. Restores NFR54 air-gapped self-containment.

## Notes

- Created via `create-bug-story` workflow (manual file creation; the bug surfaced from a user report on a disconnected install)
- Discoverable by sprint workflows via glob: `_bmad-output/implementation-artifacts/bug-*.md`
