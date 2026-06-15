---
type: bug
severity: medium
title: ensureManifest create-branch writes agents:[null] when bootstrapped with a null agentId
epic: 27
---

# Bug: Malformed `agents: [null]` in bootstrapped project-root manifest

**Status:** ready-for-dev
**Severity:** medium
**Verdict:** CODING
**Affected Component:** `lib/installer.js` (`ensureManifest`, create branch ~lines 402-409)

## Summary

`D:\Code\Workshop\.ma-agents.json` contains `"agent": null` and `"agents": [null]`.
A literal `null` array element is malformed — code that iterates `agents` can stamp a
`null` target or throw.

## Root Cause

`setProfile()` (`lib/profile.js:79`) bootstraps the project-root manifest by calling
`ensureManifest(projectRoot, null, 'project')` before any agent is known. The
`ensureManifest` **create** branch (`lib/installer.js:404-409`) unconditionally does:

```js
agent: agentId,        // → null
agents: [agentId],     // → [null]
```

The **migrate/update** branch (`:416-420`) already guards with `if (agentId && ...)`,
but the create branch does not.

## Proposed Fix

Mirror the update-branch guard in the create branch:

```js
agent: agentId || null,
agents: agentId ? [agentId] : [],
```

This yields a valid empty `agents: []` when profile bootstrap runs before an agent is
selected. Add a unit test on `ensureManifest(root, null, 'project')` asserting
`agents === []`.

## Relationship

Sits on top of bug **27-12** (dual manifest source-of-truth). 27-12's fix may remove
the agents/skills shape from the root manifest entirely; this guard is still correct
defensively and should land regardless.
