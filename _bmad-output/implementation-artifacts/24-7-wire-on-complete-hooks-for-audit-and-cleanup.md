# Story 24.7: Wire on_complete Hooks for AiAudit.md and Cleanup-Done Integration

Status: backlog

## Story

As a **ma-agents maintainer**,
I want to express the AiAudit.md append pattern and the cleanup-done skill trigger as `on_complete` hooks in a `customize.toml`, rather than requiring users to invoke them manually,
So that post-workflow audit and cleanup behavior fires automatically when supported BMAD workflows complete.

## Acceptance Criteria

1. **Given** a `customize.toml` in the ma-agents extension plugin, **When** I inspect it, **Then** at least one `on_complete` hook is defined for a pilot workflow (e.g., `bmad-dev-story`) pointing to the AiAudit.md append pattern.

2. **Given** a scratch install with the `customize.toml` deployed, **When** the pilot workflow completes in a test or manual run, **Then** the on_complete hook triggers the correct post-completion behavior (AiAudit.md append or equivalent).

3. **Given** the `cleanup-done` skill trigger is evaluated, **When** the evaluation is complete, **Then** either a second `on_complete` entry is added (if hookable at this layer) or a finding is documented in Dev Notes explaining why it is deferred and what condition would enable it.

4. **Given** the `customize.toml` is committed to the extension plugin, **When** I run `node scripts/build-plugin.js`, **Then** the plugin bundle includes the TOML file and the script exits 0.

5. **Given** all changes, **When** I run `npm test`, **Then** the test suite exits 0.

## Tasks / Subtasks

### Task 1: Read v6.4.0 on_complete schema (AC: 1)

- [ ] 1.1 Search `node_modules/bmad-method` for `on_complete` documentation — check CHANGELOG, README, and any example `customize.toml` files
- [ ] 1.2 Identify the schema: key name, target format, supported hook types, and which workflows support the hook in v6.4.0 (PR #2290 added hooks to 23 terminal steps)
- [ ] 1.3 Document the schema in Dev Notes for reference

### Task 2: Draft customize.toml with AiAudit.md on_complete hook for bmad-dev-story (AC: 1)

- [ ] 2.1 Determine the correct TOML path/location for the customize.toml in our plugin structure (e.g., `lib/bmad-extension-plugin/_bmad/custom/customize.toml` or `lib/bmad-extension/customize.toml`)
- [ ] 2.2 Write the on_complete hook entry for `bmad-dev-story` pointing to the AiAudit.md append pattern
- [ ] 2.3 Confirm the hook target path is correct for how AiAudit.md is deployed in a ma-agents install

### Task 3: Test hook behavior against scratch install (AC: 2)

- [ ] 3.1 Perform scratch install with the customize.toml deployed
- [ ] 3.2 Trigger the pilot workflow terminal step (manually or via test)
- [ ] 3.3 Verify on_complete hook fires and AiAudit.md is updated
- [ ] 3.4 If verification is not practical in a test harness — document the manual verification steps performed

### Task 4: Evaluate cleanup-done hookability (AC: 3)

- [ ] 4.1 Review `cleanup-done` skill behavior — does it run as a post-workflow action or is it user-invoked?
- [ ] 4.2 Check whether the on_complete hook supports invoking a skill rather than a file append
- [ ] 4.3 If hookable: add a second on_complete entry to `customize.toml` for cleanup-done
- [ ] 4.4 If not hookable: document the limitation and the condition under which it could be enabled in a future story

### Task 5: Verify plugin bundle and test suite (AC: 4, 5)

- [ ] 5.1 Run `node scripts/build-plugin.js` — exit code 0
- [ ] 5.2 Inspect bundle output — confirm `customize.toml` is included
- [ ] 5.3 Commit updated bundle if needed (bundle-drift CI check requires committed bundle matches script output)
- [ ] 5.4 Run `npm test` — exit code 0

## Dev Notes

### on_complete hook context

BMAD v6.4.0 PR #2290 wired `on_complete` hooks into all 23 workflow terminal steps. The hook mechanism allows a `customize.toml` to declare a callback (file path, skill invocation, or shell command — confirm from upstream docs) that fires when a workflow reaches its terminal state. This is the first time ma-agents can automate post-workflow behavior without user action.

### AiAudit.md pattern

The AiAudit.md pattern appends a session record to `AiAudit.md` after a BMAD workflow completes, capturing agent identity, timestamp, and a brief summary. This currently requires a manual user step. Wiring it as an on_complete hook eliminates the manual step.

### Pilot workflow selection

`bmad-dev-story` is chosen as the pilot because it is the most frequently run workflow and has a clear terminal state (story marked done). If the on_complete schema does not support `bmad-dev-story` in v6.4.0, choose the workflow with the broadest on_complete support from the PR #2290 list.

### What this story does NOT do

- Does NOT modify any SKILL.md files
- Does NOT replace the manual AiAudit.md invocation path (the hook is additive; manual invocation still works)
- Does NOT add on_complete hooks for all 23 workflows — pilot first, generalize in a future story

### Failure mode: schema incompatibility

If the on_complete schema proves incompatible with our AiAudit.md append semantics (e.g., the hook only supports skill invocations and not file appends, or vice versa), do not force an integration that breaks AiAudit semantics. Document the finding, describe the gap, and defer to a future story.

### Reference Files

- `node_modules/bmad-method` — on_complete schema, example customize.toml files
- `lib/bmad-extension-plugin/` — plugin bundle directory
- `scripts/build-plugin.js` — plugin bundler
- `lib/bmad-customizations/` — AiAudit.md template location
- BMAD v6.4.0 PR #2290 — on_complete hook implementation

## Change Log

| Date | Version | Author | Description |
|------|---------|--------|-------------|
| 2026-04-26 | 1.0.0 | (pending) | Story drafted as part of Epic 24 planning |
