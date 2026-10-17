---
type: bug
severity: medium
title: Install aborts with EBUSY when bmad-method's skill-dir cleanup hits a transient Windows file lock
---

# Bug: Install aborts with EBUSY when bmad-method's skill-dir cleanup hits a transient Windows file lock

**Status:** review
**Severity:** medium
**Affected Component:** `lib/bmad.js#buildChildSpawnEnv` (the env of every bmad-method invocation); new `lib/fs-retry-preload.js`

## Summary

Reported 2026-10-17 from `D:\Code\Workshop` on 3.18.1-beta.0, right after the
external-module pinning fix worked. All 6 modules installed, tea/bmb/cis at
their pinned releases, and `antigravity configured: 118 skills → .agent/skills`.
Then:

```
x  Installation failed: EBUSY: resource busy or locked, rmdir 'D:\Code\Workshop\_bmad\ma-skills\ma-agent-sqa'
BMAD installation failed: Command failed: node ...bmad-cli.js install --directory "D:\Code\Workshop" --modules bmm,tea,bmb,cis --tools antigravity --yes --custom-source "./.ma-agents-plugin-stage" --pin tea=v1.19.0 --pin bmb=v2.1.0 --pin cis=v0.2.1
```

A minute later the directory could be renamed freely, so the lock was
transient. Nothing in the install was wrong. The install died on a single
non-retried delete.

## Root Cause

After copying skills into the IDE directories, bmad-method 6.10.0 deletes the
`_bmad/<module>/<skill>` copies (`Installer._cleanupSkillDirs`,
`tools/installer/core/installer.js`) with fs-extra `remove`. fs-extra 11.3.3
calls `fs.rm(path, { recursive: true, force: true })`. Node's `fs.rm` *can*
retry EBUSY/EPERM/ENOTEMPTY/EMFILE/ENFILE with a linear backoff, but only when
asked: `maxRetries` defaults to 0. On Windows, a directory written moments
earlier is routinely held briefly by Defender real-time scanning, the Search
indexer or an editor's file watcher. Here `D:\Code\Workshop` was open in VS
Code. Any of these holds turns into an immediate fatal EBUSY.

**Reproduced deterministically:** a directory that is another process's cwd
can't be removed on Windows. A plain `fs.rm` fails with `EBUSY` in 1 ms. The
same call with `maxRetries` succeeds in about 630 ms once the holder exits.

## Fix

The fix doesn't modify bmad-method; it hardens the environment that
ma-agents gives the bmad-method child.

- `lib/fs-retry-preload.js` wraps `fs.rm`, `fs.rmSync` and `fs.promises.rm`.
  For **recursive** calls that didn't choose their own retry policy, it adds
  `maxRetries: 15, retryDelay: 100`, a linear backoff of about 12 s in total.
  All other calls are untouched.
- `buildChildSpawnEnv` appends `--require "<preload>"` to `NODE_OPTIONS`
  (`withFsRetryPreload`) and keeps the user's own `NODE_OPTIONS`. The path is
  written with forward slashes, because Node treats `\` as an escape inside a
  quoted `NODE_OPTIONS` value. All four bmad-method invocations (install,
  update, migration, custom-marketplace subset) build their env here.
- The preload runs before graceful-fs clones the fs module, so fs-extra's
  `remove` picks up the patched `fs.rm`.

## Verification

- `test/bmad-child-fs-retry.test.js` (6 tests, in the `npm test` chain). The
  end-to-end case spawns a child with `buildChildSpawnEnv()` that runs
  fs-extra `remove` on a directory held by a real cwd lock, and it succeeds.
  The Windows control without the preload fails with `EBUSY`, which proves
  the lock is real. Mutation-verified: dropping the preload from
  `buildChildSpawnEnv` fails the end-to-end case with `EBUSY`.
- A preload path containing a space loads correctly through quoted
  `NODE_OPTIONS`.
- A full `ma-agents install --yes --agent antigravity --bmad-modules
  bmm,tea,bmb,cis` from the branch into a scratch project exited 0 (pins and
  preload both active).

## Notes

- Out of scope, observed during the end-to-end run: `_bmad/ma-skills/my-next-issue/`
  survives the install because `my-next-issue` is missing from bmad-method's
  `_bmad/_config/skill-manifest.csv`, so `_cleanupSkillDirs` never visits it.
  The skill itself still reaches `.agent/skills/`. It's likely related to the
  `ma-skills/module-help.csv header does not match canonical schema` warning
  in the same install. That deserves its own bug.
- CODE FIX; NO PRD amendment.
