---
type: bug
severity: medium
title: Installer never adds the regenerated _bmad/ tree to .gitignore
epic: 27
---

# Bug: Regenerated `_bmad/` tree left tracked in git

**Status:** ready-for-dev
**Severity:** medium
**Verdict:** CODING (narrow gap)
**Affected Component:** `lib/installer.js` (`.gitignore` handling: `ensurePluginStageIgnored` ~354-398; `ensureBmadOutputTracked` ~286-303)

## Summary

`D:\Code\Workshop\.gitignore` contains only `.ma-agents-plugin-stage/`. The installer
writes the `_bmad/` module tree which is documented in its own header as
"Installer-managed. Regenerated on every install — treat as read-only." Leaving it
tracked guarantees churn and merge conflicts on every reinstall.

## Root Cause

The installer touches `.gitignore` in exactly two narrow places:
- `ensurePluginStageIgnored` (`:354-398`) — appends only `.ma-agents-plugin-stage/`.
- `ensureBmadOutputTracked` (`:286-303`) — deliberately **removes** `_bmad-output`
  from `.gitignore` so artifacts stay tracked (intentional, do not change).

There is **no** handler that ignores the regenerated `_bmad/` tree.

## Scope / Non-goals

- `_bmad-output/` staying tracked is **intentional and correct** — do NOT ignore it.
- Target only `_bmad/` (and confirm whether transient `skills/*-artifacts` staging
  dirs should be ignored; defer if uncertain).

## Proposed Fix

Add a sibling helper `ensureBmadDirIgnored(projectRoot)` mirroring the exact
append-only, idempotent, EOL-preserving pattern of `ensurePluginStageIgnored`
(`:354-398`) that ensures `_bmad/` is present in `.gitignore`. Call it from the same
project-root site where the plugin-stage ignore is ensured
(`lib/bmad.js` ~824/922/1017). Add a test asserting `_bmad/` is ignored and
`_bmad-output/` is NOT, after install.
