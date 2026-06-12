# Story 27.6: Verify PluginResolver / Module-Schema Compatibility + Per-Tool Skill-Enumeration Passthrough

Status: backlog

## Story

As a **ma-agents user on any supported tool**,
I want the ma-agents extension plugin to still install cleanly after the v6.8.0 bump, with the renamed/retired upstream skills correctly reflected wherever ma-agents enumerates the skill set,
So that no tool advertises a skill that no longer exists or omits one that now does.

**Blocked by:** Story 27.5 (the v6.8.0 deploy must exist to verify against).

**FR:** FR210 (passthrough boundary).

## Acceptance Criteria

1. **Given** bmad-method v6.8.0, **When** the ma-agents extension plugin (`module.yaml`, `module-help.csv`, `.claude-plugin/marketplace.json`) is installed, **Then** it installs without error under v6.8.0's PluginResolver — confirmed by a multi-tool smoke install (at least Claude Code + Cline).

2. **Given** the v6.8.0 skill set, **When** ma-agents-owned enumerations of BMAD skills are inspected (per-tool pointer files, MANIFEST routing, docs), **Then** they reflect the current skill set and contain no orphaned references to `bmad-create-ux-design` / `bmad-distillator` in ma-agents-owned files.

3. **Given** a real v6.8.0 deploy, **When** Story 27.4's Cline reconciliation runs, **Then** renamed/new skills get wrappers and retired ones do not (end-to-end verification).

4. **Given** the verification, **When** the offline-install path is exercised, **Then** no regression is observed (NFR57 — fully verified in 27.7).

## Tasks / Subtasks

### Task 1: PluginResolver / module-schema smoke (AC: 1)

- [ ] 1.1 Scratch install against `--tools claude-code`; confirm plugin installs cleanly
- [ ] 1.2 Scratch install against `--tools cline`; confirm plugin installs cleanly
- [ ] 1.3 Confirm `module.yaml` / `module-help.csv` / `marketplace.json` still satisfy v6.8.0's PluginResolver (no schema break since 6.6.0 baseline)

### Task 2: Enumeration passthrough audit (AC: 2)

- [ ] 2.1 Grep ma-agents-owned files for `bmad-create-ux-design` / `bmad-distillator`; confirm absent (or update if present)
- [ ] 2.2 Confirm new upstream skills appear via passthrough where ma-agents enumerates them

### Task 3: End-to-end Cline check (AC: 3, 4)

- [ ] 3.1 With Cline selected, confirm `.clinerules/workflows/` reflects the v6.8.0 skill set (27.4 behavior)
- [ ] 3.2 Smoke-check the offline path (full gate in 27.7)

## Dev Notes

- This is a verification/reconciliation story, not a re-authoring story — most skill content is upstream passthrough.
- Reuse the multi-tool smoke pattern from the Epic 22/24 verification stories.
