---
type: bug
severity: medium
title: .agents/skills missing the 34 standalone skills and MANIFEST.yaml when no copilot/roo/kilo agent is selected
epic: 27
---

# Bug: `.agents/skills` partial population (dual-pipeline gap)

**Status:** ready-for-dev
**Severity:** medium
**Verdict:** ARCHITECTURE
**Affected Component:** `lib/installer.js` (`installSkill` path-grouping ~1288-1304, `generateSkillsManifest` ~441-473/1476); `lib/bmad.js` (PluginResolver invocation ~790-880); `lib/agents.js` (`getProjectPath` for copilot/kilo/roo ~84/108/160)

## Summary

In `D:\Code\Workshop`, `.claude/skills` and `.cline/skills` each have 209 entries WITH
`MANIFEST.yaml`; `.agents/skills` has only 175 — all BMAD-family skills, missing the 34
standalone non-BMAD skills (code-review, cpp-*, python-*, git-workflow-skill, …) AND
`MANIFEST.yaml`. The stamped instruction block still tells those agents to "Read the
skill manifest at .agents/skills/MANIFEST.yaml" — a file that does not exist. Real
correctness consequence.

## Root Cause

Two deployment pipelines write skills, and `.agents/skills` is fed by only one:
1. **Standalone skills** — ma-agents' own loop (`installSkill` → `performInstall` +
   `generateSkillsManifest`, `lib/installer.js:1288-1304,1476`). Also the ONLY writer of
   `MANIFEST.yaml`.
2. **BMAD-family skills** — bmad-method's PluginResolver via `--custom-source`
   (`lib/bmad.js:790-880`), which routes copilot/roo/kilo to the shared `.agents/skills/`.

The standalone loop only targets `.agents/skills` if an agent whose `getProjectPath()`
is `.agents/skills` (copilot/kilo/roo, `lib/agents.js:84/108/160`) is selected. Workshop
selected claude-code/cline/opencode only — so BMAD wrote 175 there but the standalone
loop and `generateSkillsManifest` never ran for that dir. Under `--yes` (all agents) the
dir would be fully populated, masking the gap.

> Note: opencode's 45 `skills/` + 175 `commands/` split is **by design** (different
> artifact kinds), and the absence of a deployed plugin bundle in the target is also
> by design (package-resident). Neither is part of this bug.

## Why ARCHITECTURE

No logic error — the code does what it is written to do. The flaw is a missing invariant
across two pipelines: "if a tool's skills dir was populated by BMAD, it must also carry
the full standalone catalog + MANIFEST.yaml." The `.agents/skills` dir looks installed
but is silently partial, with no warning.

## Proposed Direction

Make `.agents/skills` population pipeline-consistent. Minimum viable: after the standalone
loop, if `.agents/skills` exists on disk (BMAD created it) but no `.agents`-targeting
agent was selected, still run `performInstall` for the standalone catalog there and call
`generateSkillsManifest('.agents/skills')`; at minimum always emit `MANIFEST.yaml` into
any BMAD-populated tool dir and warn when the standalone catalog is absent. Add a test:
install with claude-code only, assert `.agents/skills` either is absent OR carries
MANIFEST.yaml (never BMAD-only without a manifest).
