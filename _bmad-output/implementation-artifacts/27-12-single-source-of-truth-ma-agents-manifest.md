---
type: bug
severity: high
title: Two .ma-agents.json files with two owners — project-root copy reports skills:{} while skills are installed
epic: 27
---

# Bug: Dual `.ma-agents.json` source-of-truth → empty `skills: {}`

**Status:** ready-for-dev
**Severity:** high
**Verdict:** ARCHITECTURE
**Affected Component:** `lib/installer.js` (`ensureManifest` ~400-420, `installSkill`/`performInstall` skill-recording ~1445-1464, readers ~1883-1894); `lib/profile.js` (`setProfile` ~57-96)

## Summary

`D:\Code\Workshop\.ma-agents.json` (project root) reports `"skills": {}` even though
209 skills are physically installed and the **per-agent** manifest
(`.claude/skills/.ma-agents.json`) correctly records them. The project-root manifest
is authoritative-looking but empty, so `status`/`uninstall`/reconcile that read it
under-report or mis-operate.

## Root Cause

Two distinct files share the same schema and are written by two subsystems with no
single source of truth:
- **Per-agent** `*/skills/.ma-agents.json` — populated by `installSkill` →
  `performInstall` (`lib/installer.js:1445-1464`), records each skill. Correct.
- **Project-root** `.ma-agents.json` — bootstrapped empty by `setProfile`
  (`lib/profile.js:79` → `ensureManifest(root, null, 'project')`,
  `lib/installer.js:402-409`) for profile storage only, and never back-filled.

Some readers (`lib/installer.js:1883-1894`) even `continue` past manifests with an
empty `skills` map — so the root file is silently skipped by some code and trusted by
other code. That inconsistency is the architectural defect.

## Why ARCHITECTURE (not a one-line fix)

The schema/ownership model is wrong: the same shape is emitted to two locations by
two owners. Resolving it requires a design decision on which file is authoritative.

## Proposed Direction (decide before implementing)

**Preferred:** make the project-root `.ma-agents.json` the single authoritative
manifest (profile + agents + skills); per-agent skills dirs keep only `MANIFEST.yaml`.
`installSkill` records skills into the root manifest.

**Minimum-change alternative:** have `setProfile`/`ensureManifest` at the root emit
ONLY `manifestVersion` + `profile` (not a `skills`/`agents` shape it does not own), so
the root file cannot masquerade as a skill inventory; make readers resolve per-agent
manifests as the inventory source.

> Implementation note for the fix agent: this touches `config-storage.test.js`,
> `config-layout.test.js`, `config-path-migration.test.js`. If the preferred redesign
> risks broad test breakage, implement the minimum-change alternative and record the
> deferral here rather than forcing a risky rewrite.
