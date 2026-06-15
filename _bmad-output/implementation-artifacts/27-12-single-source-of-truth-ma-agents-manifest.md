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

## Deferral note

**Implemented: the minimum-change alternative. Deferred: the preferred root-authoritative redesign.**

What was done (Epic 27 follow-up commit):

- `lib/profile.js` — added a profile-only root bootstrap (`bootstrapRootManifest`)
  that emits ONLY `manifestVersion` + a `scope: 'project-root'` discriminator. Both
  `setProfile` and `setBmadModules` now use it instead of
  `ensureManifest(root, null, 'project')`. The root `.ma-agents.json` therefore no
  longer carries the empty `skills: {}` / `agents: []` shape it never owned or
  back-filled — it can no longer masquerade as a (empty) skill inventory. It stores
  profile/settings only (`profile`, `bmadModules`, plus any preserved custom fields).
- `lib/installer.js` (`getStatus`) — added a defensive guard: any manifest carrying
  `scope === 'project-root'` is explicitly skipped as an inventory source. The
  per-agent skills manifests (`<tool>/skills/.ma-agents.json`) remain the
  authoritative inventory, which is what `getStatus`/`uninstall`/reconcile already
  read via each agent's `getProjectPath()`.
- Tests updated to the new profile-only root schema: `profile.test.js` (6.4, 6.16),
  `bmad-module-selection.test.js` (27.13 round-trip). No assertions were weakened —
  they were re-pointed at the intended new shape. `ensureManifest`'s per-agent
  create branch (and its 27.9 null-guard) is unchanged and still tested (6.17).

Why the preferred redesign was deferred:

- The "preferred" option makes the project-root `.ma-agents.json` the single
  authoritative manifest (profile + agents + skills) and reduces per-agent dirs to
  `MANIFEST.yaml` only, with `installSkill` recording skills into the root. That is a
  cross-cutting change to skill recording, status, uninstall, reconcile, retired/rename
  migration, and per-agent manifest readers — exactly the broad-breakage rewrite the
  story flagged. The minimum-change alternative removes the masquerade defect (the
  concrete bug: root reports `skills: {}` while skills are installed) without that risk.

Verification: no production reader consults the project-root `.ma-agents.json` for a
skills inventory (`readManifest` is only ever called with per-agent install paths;
`getManifestAgents` is only applied to per-agent manifests). The latent defect was the
root file's *shape* inviting misuse — that shape is now gone, and `getStatus` ignores
the root-scoped manifest defensively.

Follow-up (not done here): if the team later wants a single authoritative root
manifest, that is the larger redesign above and should be scoped as its own story.
