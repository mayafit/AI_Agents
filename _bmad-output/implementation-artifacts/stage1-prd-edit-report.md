# Stage 1: PRD Edit Report — BMAD v6.6.0 Integration

**Date:** 2026-05-01
**Branch:** fix/bug-jira-backend-ignored-on-first-run
**Target file:** `_bmad-output/planning-artifacts/prd.md`

## What Was Added

### Frontmatter updates
- `lastEdited` updated from `'2026-04-08'` to `'2026-05-01'`
- New `editHistory` entry prepended as first item in array (date: 2026-05-01), summarising F21, FR196–FR198, NFR55

### F21: BMAD v6.6.0 Integration (Functional Requirements)

Inserted as a new `### BMAD v6.6.0 Integration` section immediately after the existing BMAD 6.3.0 Plugin Migration section (after FR195, before `### Specialized Agent Personas`), at approximately line 494 in the updated file.

- **FR196** — buildBmadArgs guard: skip BMAD invocation entirely when no IDE tools are selected (fresh install); `--tools none` must never be passed to bmad-method v6.6.0
- **FR197** — bmad-method pin bumped from v6.5.0 to v6.6.0; `project_name` config migration from `[modules.bmm]` to `[core]` handled transparently by bmad-method, no user action required
- **FR198** — Optional thin pass-through of `--set <module>.<key>=<value>` and `--list-options [module]` flags for non-interactive CI/Docker configuration

### NFR55 (Non-Functional Requirements)

Inserted as a new `### BMAD v6.6.0 Integration` section immediately after NFR54 (end of BMAD 6.3.0 Migration NFR block), before `### BMAD Knowledge Graph`, at approximately line 841 in the updated file.

- **NFR55** — Automated tests must assert: (a) `buildBmadArgs()` never produces `--tools none`; (b) install flow skips BMAD invocation when `bmadTools` array is empty; (c) existing installs with non-empty tools lists are unaffected

## Insertion Points Used

| Item | Insertion Point |
|------|----------------|
| frontmatter `editHistory` | Prepended as first entry in `editHistory` array (line 7) |
| `lastEdited` | Line 5 — updated value |
| F21 / FR196–FR198 | After FR195 (end of Deferred Memory-Agent Conversion section), before `### Specialized Agent Personas` |
| NFR55 | After NFR54 (end of `### BMAD 6.3.0 Migration` NFR section), before `### BMAD Knowledge Graph` |

## Issues Encountered

None. All three insertion points were uniquely identifiable and edits applied cleanly.

## Stage 1: COMPLETE

## Post-Review Fixes Applied (2026-05-01)
- WARNING 1 resolved: F21 added to Capability Areas numbered list
- WARNING 2 resolved: FR197 rewritten without internal TOML key references
- INFO 3 resolved: FR198 explicitly deferred
- INFO 4 resolved: NFR55 header level corrected to H3
- INFO 5 resolved: FR196 citation added to NFR55
- INFO 6 resolved: NFR55(a) rewritten in behavioral terms
Stage 1 Fix: COMPLETE
