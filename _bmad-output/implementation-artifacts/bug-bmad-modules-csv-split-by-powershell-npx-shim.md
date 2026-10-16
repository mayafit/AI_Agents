---
type: bug
severity: low
title: --bmad-modules bmm,bmb,cis fails from PowerShell — the npx.ps1 shim splits an unquoted comma list into separate arguments
---

# Bug: `--bmad-modules bmm,bmb,cis` fails from PowerShell

**Status:** review
**Severity:** low
**Affected Component:** `bin/cli.js` (help text; `parseFlags` `--bmad-modules` branch)

## Summary

In PowerShell, an unquoted `a,b,c` is an array literal. When it's passed to a
**PowerShell script**, which is what `npx` resolves to on Windows
(`C:\Program Files\nodejs\npx.ps1`), the shim forwards it to node as separate
arguments. ma-agents then receives:

```
["install", "--bmad-modules", "bmm", "bmb", "cis"]
```

`parseFlags` takes `bmm` as the module list and leaves `bmb` and `cis` as
positionals, which the install command treats as a skill id and agents, so the
run fails. Quoting the list (`"bmm,bmb,cis"`) arrives intact. Bare
`--bmad-modules` (the interactive prompt) is unaffected.

Verified 2026-10-16 through a forwarding `.ps1` mirroring `npx.ps1`:
unquoted → `["install","--bmad-modules","bmm","bmb","cis"]`, quoted →
`["install","--bmad-modules","bmm,bmb,cis"]`. Calling `node.exe` directly
keeps the commas, which is why this only shows through the shim.

Reported 2026-10-13 from `D:\Code\Workshop`: `npx ma-agents install
--bmad-modules bmm,bmb,cis` failed while bare `--bmad-modules` succeeded.

## Fix (this change)

The help text quotes the example and explains why
(`npx ma-agents install --yes --bmad-modules "bmm,tea,bmb"`).

## Follow-up (not done here)

The parser could make this robust: after `--bmad-modules <value>`, also take
following positionals that are known module ids (`getInstallableBmadModules`).
That's deferred because a bare token after the flag is ambiguous with the
existing `install <skill> <agents...>` positional form.

CODE FIX (help text); NO PRD amendment.
