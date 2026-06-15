---
type: bug
severity: high
title: verify-manifest SessionStart hook points at $CLAUDE_PROJECT_DIR/lib/... which never exists in a target install
epic: 27
---

# Bug: Dead verify-manifest SessionStart hook in every real install

**Status:** ready-for-dev
**Severity:** high
**Verdict:** CODING
**Affected Component:** `lib/installer.js` (`deployClaudeCodeHook` / hook command string, lines ~1907-1951 and removal ~1968-1986)

## Summary

The Claude Code `SessionStart` hook stamped into `<target>/.claude/settings.json`
runs:

```
node "$CLAUDE_PROJECT_DIR/lib/hooks/claude-code/verify-manifest.js"
```

`$CLAUDE_PROJECT_DIR` is set by Claude Code to the **target project root**, so the
command resolves to `<target>/lib/hooks/claude-code/verify-manifest.js`. But the
installer **never copies `lib/hooks/` into the target** — the file ships inside the
npm package (`package.json` `files: ["lib/"]`) and at runtime lives under
`node_modules/ma-agents/lib/...` or the npx cache. The path therefore only resolves
in the **ma-agents dev repo** (where the project root coincidentally *is* the package
root). In every real install the hook fails on every session.

Evidence: `D:\Code\Workshop` (a real install) has no `lib/` directory; the hook is
dead there.

## Reproduction Steps

1. `npx ma-agents` into any project that is not the ma-agents repo itself.
2. Open the project in Claude Code.
3. Observe the SessionStart hook error: `Cannot find module .../lib/hooks/claude-code/verify-manifest.js`.

## Root Cause

`lib/installer.js:1928` (and the symmetric removal at `:1970`) hardcode the command
string assuming the package and the target project share a directory. They do not in
any `npx`/`node_modules` install.

## Proposed Fix

**Copy the hook into the target.** In `deployClaudeCodeHook`, copy
`lib/hooks/claude-code/verify-manifest.js` into a stable target location
(e.g. `<projectRoot>/.claude/hooks/verify-manifest.js`) and point the command at
`$CLAUDE_PROJECT_DIR/.claude/hooks/verify-manifest.js`. The hook is dependency-free,
so a self-contained copy is safe. The uninstall path (`:1970`) must also delete the
copied file. Add a regression test asserting the hook target exists on disk after a
non-dev-repo install.

## Notes

Referencing the package location via `$CLAUDE_PROJECT_DIR` is impossible, and an
absolute `node_modules` path is non-portable (breaks under npx cache) — the copy
approach is the correct fix.
