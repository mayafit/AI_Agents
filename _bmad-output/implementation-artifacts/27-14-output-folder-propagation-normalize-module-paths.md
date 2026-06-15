---
type: bug
severity: high
title: Custom output folder does not propagate to all modules — bmb's skills/ default bleeds into gds artifact paths
epic: 27
---

# Bug: Output-folder not propagated to every module (upstream suffix-match contamination)

**Status:** ready-for-dev
**Severity:** high
**Verdict:** ARCHITECTURE + UPSTREAM (bmad-method) — ma-agents can only avoid or work around
**Affected Component:** upstream `bmad-method` `tools/installer/modules/official-modules.js` (`resolveConfigValue` ~1765-1801); ma-agents `lib/bmad.js` (`buildBmadArgs` ~725-735, module co-install) and post-install config handling

## Summary / Requirement

Requirement: when the user selects a custom output folder at install time, **every**
module's artifact paths must use it — not leave some pinned to `_bmad-output` or, worse,
`skills/`.

Observed: `[modules.bmm]` correctly uses `{output_folder}` but `[modules.gds]` resolves
`planning_artifacts`/`implementation_artifacts` to `{project-root}/skills/...` regardless
of `[core] output_folder`, creating stray empty `skills/planning-artifacts` and
`skills/implementation-artifacts` dirs.

## Root Cause

ma-agents passes the chosen output folder once, correctly, as `--output-folder`
(`lib/bmad.js:725-727`); it does NOT generate per-module paths. The corruption is in
**upstream bmad-method** `resolveConfigValue` (`official-modules.js:1769-1776`): when
resolving the `{output_folder}` token it falls back to a **suffix match** over all
collected answers — `answerKey.endsWith('_output_folder')`. The bmb answer key
`bmb_bmad_builder_output_folder` ends with `_output_folder`, and modules resolve
alphabetically (bmb before gds), so gds's `{output_folder}` resolves to bmb's
`{project-root}/skills` value. bmm escapes only because it resolves before bmb.

The ma-agents gds cache template is **correct** (`lib/bmad-cache/gds/src/module.yaml:35`
= `{output_folder}/planning-artifacts`); nothing in ma-agents injects `skills/`.

## Why ARCHITECTURE/UPSTREAM

The faulty resolution lives in vendored bmad-method code; ma-agents' exposure is the
design choice to co-install bmb + gds in one pass. It cannot be cleanly fixed by editing
ma-agents' own logic alone.

## Proposed Direction (pick per risk)

1. **Avoid (preferred, ties to 27-13):** don't co-install bmb + gds (persisted exclude).
   Eliminates the contamination entirely for this user.
2. **Work around (robust, ma-agents-owned):** add a post-install pass that re-reads
   `_bmad/config.toml` + each `_bmad/<mod>/config.yaml` and rewrites any module artifact
   path whose output-folder segment ≠ `[core] output_folder`, repointing it at the
   canonical `{output_folder}/...`. Add a test covering a custom `--output-folder` with
   bmb+gds both installed, asserting gds paths track the custom folder.
3. **Upstream:** file/patch bmad-method to require an exact `output_folder` /
   `core_output_folder` key instead of the `endsWith` suffix match.

> Fix agent: implement option 2 (post-install normalization) as the durable code fix;
> reference option 1 as the operational workaround; record option 3 as an upstream
> follow-up. Do NOT edit vendored `node_modules/bmad-method` in this repo.
