# Story 24.7: Register on_complete Hooks via customize.toml in Plugin Bundle

Status: backlog

## Story

As a **ma-agents maintainer**,
I want to ship a `customize.toml` file in the ma-agents plugin bundle that registers AiAudit.md and cleanup-done as `on_complete` hook targets for the relevant BMAD workflows,
So that ma-agents users get automatic post-workflow audit entries without needing to manually invoke the ai-audit-trail skill — using BMAD's own hook mechanism, not ma-agents custom fork code.

## Acceptance Criteria

1. **Given** BMAD v6.4.0's `on_complete` hook support in `customize.toml` (#2290), **When** the ma-agents plugin bundle is installed, **Then** a `customize.toml` is present that registers at minimum the `bmad-dev-story` workflow with an `on_complete` hook referencing the AiAudit.md append pattern.

2. **Given** the `on_complete` hook is registered, **When** a scratch install completes and the hook schema is inspected, **Then** the TOML is valid per BMAD v6.5.0's schema (no parse errors, no unknown keys).

3. **Given** the `customize.toml`, **When** `scripts/build-plugin.js` runs, **Then** the file is included in `lib/bmad-extension-plugin/` output.

4. **Given** the `cleanup-done` skill hook is evaluated, **When** this story closes, **Then** a finding is documented: either (a) a `cleanup-done` `on_complete` entry is added to `customize.toml`, or (b) the finding explains why it is not hookable at this layer and defers to a follow-up.

5. **Given** the existing `bmad-dev-story` custom workflow skill in `lib/bmad-extension/skills/`, **When** this story closes, **Then** it is unchanged — no SKILL.md modifications are made.

6. **Given** `npm test`, **When** run after changes, **Then** exit code 0.

## Tasks / Subtasks

### Task 1: Read BMAD v6.5.0 on_complete hook schema (prerequisite)

- [ ] 1.1 Locate `on_complete` documentation in `node_modules/bmad-method` — find a reference `customize.toml` with `on_complete` entries
- [ ] 1.2 Note the required keys: workflow identifier, hook type, target skill/action
- [ ] 1.3 Confirm whether the hook fires for our custom workflow skill (`bmad-dev-story`) or only for upstream BMAD workflows

### Task 2: Draft customize.toml with AiAudit.md on_complete hook (AC: 1, 2)

- [ ] 2.1 Create `lib/bmad-extension/customize.toml` (or the correct location per BMAD's plugin schema)
- [ ] 2.2 Add `on_complete` entry for `bmad-dev-story` → AiAudit.md append action
- [ ] 2.3 Validate TOML syntax: `node -e "require('node:fs'); ..."` or use a TOML linter
- [ ] 2.4 Verify the file path is correct for the plugin bundle (inside `skills/` or at bundle root — check BMAD's custom-source resolution)

### Task 3: Evaluate cleanup-done hookability (AC: 4)

- [ ] 3.1 Review what `cleanup-done` needs to trigger: which workflows complete in a state that should invoke it?
- [ ] 3.2 Determine if those workflows have `on_complete` hook support in v6.5.0
- [ ] 3.3 If yes: add `on_complete` entry to `customize.toml`
- [ ] 3.4 If no: document finding in Dev Notes — "cleanup-done not hookable via on_complete at this layer; continue manual invocation pattern"

### Task 4: Wire into build script and verify bundle (AC: 3)

- [ ] 4.1 Confirm `scripts/build-plugin.js` copies `customize.toml` to plugin output
- [ ] 4.2 If not: add copy step to build script
- [ ] 4.3 Run `npm run build:plugin` — verify `customize.toml` is in `lib/bmad-extension-plugin/`

### Task 5: Confirm no SKILL.md changes (AC: 5)

- [ ] 5.1 `git diff lib/bmad-extension/skills/bmad-dev-story/` — confirm zero changes
- [ ] 5.2 `git diff lib/bmad-extension/skills/` — confirm no skill files modified

### Task 6: Run test suite (AC: 6)

- [ ] 6.1 `npm test` — exit 0

## Dev Notes

### Why Small, not Medium

BMAD v6.4.0 already wired `on_complete` hooks into 23 workflow terminal steps. The work here is shipping the right TOML config — not implementing hook machinery. If Task 1 reveals the hook schema is incompatible with our use case, the story closes with a documented finding and no code changes.

### Critical: do not modify SKILL.md files

The previous framing of this story suggested modifying the forked `bmad-dev-story` skill to wire hooks. That creates a new delta against upstream. The correct approach is a `customize.toml` entry that registers the hook externally — BMAD's hook dispatch handles the rest.

### Dependency on Story 24.12

Story 24.12 (persistent_facts spike) answers whether the entire marker-injection layer can be replaced by TOML. Do not add new marker-injection logic in this story regardless of what Task 1 finds. If `on_complete` hooks can't express what we need, document the gap for Story 24.12 to investigate — don't patch it with new injection code.

### Reference Files

- `node_modules/bmad-method` — on_complete hook schema reference
- `lib/bmad-extension/` — plugin source (customize.toml goes here)
- `scripts/build-plugin.js` — plugin build script
- `lib/bmad-extension-plugin/` — build output

## Change Log

| Date | Version | Author | Description |
|------|---------|--------|-------------|
| 2026-04-26 | 1.0.0 | (pending) | Story drafted as part of Epic 24 planning |
| 2026-04-27 | 1.1.0 | (pending) | Rewritten as Small — customize.toml config entry, not fork modification. No SKILL.md changes permitted. Per adversarial review findings 4, 5. |
