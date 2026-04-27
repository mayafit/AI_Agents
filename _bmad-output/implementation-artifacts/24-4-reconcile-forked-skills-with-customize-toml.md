# Story 24.4: Absorb Upstream Workflow Capabilities (quick-dev, checkpoint-preview)

Status: backlog

## Story

As a **ma-agents maintainer**,
I want to evaluate whether v6.5.0's `bmad-quick-dev` and `bmad-checkpoint-preview` skills — now customize.toml-capable — add capabilities worth absorbing into the ma-agents plugin bundle,
So that ma-agents users benefit from upstream workflow improvements where they integrate naturally with our sprint-status.yaml schema and AiAudit.md conventions.

## Acceptance Criteria

1. **Given** Story 24.2 absorb assessment table is complete, **When** the decision for `bmad-quick-dev` is reviewed, **Then** the skill is either added to `lib/bmad-extension/skills/` with a MANIFEST.yaml entry, or documented as out of scope with rationale — and no partial implementation is left in place.

2. **Given** Story 24.2 absorb assessment table is complete, **When** the decision for `bmad-checkpoint-preview` is reviewed, **Then** the same outcome applies: added to the plugin or documented as out of scope.

3. **Given** any skill is added, **When** `scripts/build-plugin.js` runs, **Then** the new skill is present in `lib/bmad-extension-plugin/` output.

4. **Given** any skill is added, **When** a scratch install completes with `--tools claude-code`, **Then** the new skill lands in `.claude/skills/` and is accessible.

5. **Given** the existing 4 custom workflow skills (`bmad-sprint-planning`, `bmad-sprint-status`, `bmad-dev-story`, `bmad-code-review`), **When** this story closes, **Then** they are unchanged — this story does not touch them. They are custom workflows, not upstream forks, and are not being reconciled here.

6. **Given** `npm test`, **When** run after any additions, **Then** exit code 0.

## Tasks / Subtasks

### Task 1: Read Story 24.2 absorb assessment table (prerequisite)

- [ ] 1.1 Open Story 24.2 Dev Notes — locate the absorb assessment table
- [ ] 1.2 Note the decision for `bmad-quick-dev`: "add" or "out of scope"
- [ ] 1.3 Note the decision for `bmad-checkpoint-preview`: "add" or "out of scope"
- [ ] 1.4 If both are "out of scope" — this story is done; mark done with finding documented

### Task 2: Add bmad-quick-dev (conditional on Task 1 decision)

- [ ] 2.1 Copy `bmad-quick-dev/` from `node_modules/bmad-method` to `lib/bmad-extension/skills/bmad-quick-dev/`
- [ ] 2.2 Add a `MANIFEST.yaml` entry (description, applies_when conditions)
- [ ] 2.3 Run `scripts/build-plugin.js` — confirm skill appears in plugin output
- [ ] 2.4 Scratch install — confirm skill lands in `.claude/skills/`

### Task 3: Add bmad-checkpoint-preview (conditional on Task 1 decision)

- [ ] 3.1 Copy `bmad-checkpoint-preview/` from `node_modules/bmad-method` to `lib/bmad-extension/skills/bmad-checkpoint-preview/`
- [ ] 3.2 Add a `MANIFEST.yaml` entry
- [ ] 3.3 Run `scripts/build-plugin.js` — confirm skill appears in plugin output
- [ ] 3.4 Scratch install — confirm skill lands in `.claude/skills/`

### Task 4: Verify existing custom workflow skills are untouched (AC: 5)

- [ ] 4.1 `git diff lib/bmad-extension/skills/bmad-sprint-planning/` — confirm no changes
- [ ] 4.2 `git diff lib/bmad-extension/skills/bmad-sprint-status/` — confirm no changes
- [ ] 4.3 `git diff lib/bmad-extension/skills/bmad-dev-story/` — confirm no changes
- [ ] 4.4 `git diff lib/bmad-extension/skills/bmad-code-review/` — confirm no changes

### Task 5: Run test suite (AC: 6)

- [ ] 5.1 `npm test` — exit 0

## Dev Notes

### Critical framing: these are NOT upstream forks

The 4 ma-agents workflow skills (`bmad-sprint-planning`, `bmad-sprint-status`, `bmad-dev-story`, `bmad-code-review`) are entirely custom — they were written for ma-agents' sprint-status.yaml schema, AiAudit.md integration, and worktree-based development model. They have no upstream equivalent to "migrate away from." They are not touched in this story.

This story is only about additive absorption: do the 2 newly customize.toml-capable upstream skills offer something useful?

### What this story does NOT do

- Does NOT modify the 4 custom workflow skills in any way
- Does NOT migrate anything to customize.toml (wrong tool for custom workflows)
- Does NOT add on_complete hooks (Story 24.7)

### Per-skill decision table (filled in by Story 24.2)

| Skill | Integration points found | Decision | Rationale |
|-------|--------------------------|----------|-----------|
| bmad-quick-dev | (filled by 24.2) | (filled by 24.2) | (filled by 24.2) |
| bmad-checkpoint-preview | (filled by 24.2) | (filled by 24.2) | (filled by 24.2) |

### Reference Files

- Story 24.2 Dev Notes — absorb assessment table (prerequisite)
- `node_modules/bmad-method` — upstream v6.5.0 skill sources
- `lib/bmad-extension/skills/` — plugin skill source directory
- `MANIFEST.yaml` — skill registry
- `scripts/build-plugin.js` — plugin build script

## Change Log

| Date | Version | Author | Description |
|------|---------|--------|-------------|
| 2026-04-26 | 1.0.0 | (pending) | Story drafted as part of Epic 24 planning |
| 2026-04-27 | 1.1.0 | (pending) | Completely rewritten — scope changed from "reconcile 4 forked skills" to "absorb quick-dev and checkpoint-preview". The 4 custom workflow skills are not upstream forks and are not being reconciled. Per adversarial review finding 6. |
