---
type: bug
severity: low
title: composeInstructionBlock mixes LF segment joins over CRLF-authored templates
epic: 27
---

# Bug: Mixed CRLF/LF in the composed instruction block

**Status:** ready-for-dev
**Severity:** low
**Verdict:** CODING
**Affected Component:** `lib/installer.js` (`composeInstructionBlock`, lines ~116-170; joins at 159/166/169)

## Summary

The instruction block stamped into `.claude/CLAUDE.md`, `AGENTS.md`,
`.cline/clinerules.md`, and (JSON-escaped) `opencode.json` has CRLF line endings for
every line **inside** each segment but bare LF at the segment seams
(BMAD-discipline→Git-Workflow and Git-Workflow→On-Prem) and at the terminator.

## Root Cause

The three source templates are authored 100% CRLF, but `composeInstructionBlock`
concatenates them with literal `'\n\n'` and ends with `'\n'`
(`lib/installer.js:159,166,169`). Body lines stay CRLF; the hand-written joins are LF.

## Proposed Fix

Normalize EOL once at the end of `composeInstructionBlock`:

```js
return composed.replace(/\r\n/g, '\n') + '\n';
```

Pure-LF is the robust choice — downstream marker-merge already assumes LF, and it is
independent of how templates are checked out on Windows. Optionally add
`*.template.md text eol=lf` to `.gitattributes` for defense in depth. Add a test
asserting the composed block contains no `\r`.

## Relationship

This is the same EOL-drift family as bug `bug-npm-test-windows-suite-health-chain`;
fixing the composer EOL reduces Windows/Linux test divergence.
