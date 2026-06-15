---
type: bug
severity: medium
title: No durable BMAD-module exclude — GDS (and any deselected module) reinstalls on every run
epic: 27
---

# Bug: BMAD module selection not persisted; deselected modules return

**Status:** ready-for-dev
**Severity:** medium
**Verdict:** ARCHITECTURE
**Affected Component:** `bin/cli.js` (`selectBmadModules` ~834-880); `lib/bmad.js` (`getInstallableBmadModules` ~494-513, `resolveBmadModules` ~545-563); `lib/profile.js` (manifest storage)

## Summary

The user decided **not** to install the GDS module, yet `D:\Code\Workshop\_bmad`
contains a full `gds/` module and `config.toml [modules.gds]`. Deselecting a module is
only honored for a single invocation; on any later install/reconfigure that does not
re-pass the flag, the module returns.

## Root Cause

`selectBmadModules` (`bin/cli.js:834-880`) has three branches. The **default** branch
(`:878-879`) returns `installable.map(m => m.id)` — install **every** non-retired
module unconditionally. Per-run deselection exists (`--bmad-modules bmm,tea,bmb,cis,wds`
or the bare-flag multiselect), but the choice is **never persisted** to
`.ma-agents.json`, so it does not survive subsequent runs.

## Immediate Workaround (for the user's Workshop install, no code needed)

```
npx ma-agents --bmad-modules bmm,tea,bmb,cis,wds   # omits gds
```

(Fixing GDS also eliminates bug 27-14 and the stray `skills/*-artifacts` dirs — the
bmb→gds output-folder contamination only occurs when bmb and gds are co-installed.)

## Why ARCHITECTURE

Single-run deselection is already supported, so this is not a missing-feature coding
bug. Making an exclusion **stick** is a design decision: where to store the selected
set, and how `update`/`reconfigure` honor it.

## Proposed Direction

Persist the selected BMAD module set into `.ma-agents.json` (alongside `profile`, via
`lib/profile.js`). Default `selectBmadModules` to the persisted set when present,
instead of "install everything." Optionally add a local `disabled` flag in
`cache-manifest.json` for org-wide defaults. Add a test that a deselected module stays
absent across a second install.
