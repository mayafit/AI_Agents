# Bug: Jira backend ignored on first run — sprint-status.yaml seeded as file-system

Status: done

## Summary

When a user selects Jira during `ma-agents` installation, the wizard correctly writes
`sprint_backend: jira` to `_bmad/bmm/config.yaml`. However, all 13 sprint management
skills default to `file-system` when `sprint-status.yaml` does not yet exist (first run).
This means the Jira backend is silently ignored on the very first skill invocation that
creates the file, and the installation is effectively stuck on file-system.

## Root Cause

The Backend Routing block step 1 in all 13 skills reads:

> "If the field is absent or the file does not exist, default to `file-system`."

This fallback does not consult `_bmad/bmm/config.yaml`. When `sprint-status.yaml` is
absent (before `bmad-sprint-planning` seeds it), the skill has no way to discover that
the user configured Jira at install time.

## Fix

Update step 1 in the routing block of all 13 skills (IDE + extension copies) to:

> "If the field is absent or the file does not exist, read `sprint_backend` from
> `_bmad/bmm/config.yaml`. Use that value if present, otherwise default to `file-system`."

This ensures skills bootstrap correctly from the install-time config when no
`sprint-status.yaml` exists yet.

## Files Changed

- `skills/*/SKILL.md` — 12 IDE skill files (all with backend routing block)
- `lib/bmad-extension/skills/*/SKILL.md` (or `workflow.md`) — 12 extension skill files
- `lib/bmad-extension-plugin/` — rebuilt plugin bundle
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — bug registered

## Change Log

- 2026-05-01: Identified during v3.9.0 user testing. Fixed routing block fallback in all
  24 skill files to consult `_bmad/bmm/config.yaml` before defaulting to `file-system`.
