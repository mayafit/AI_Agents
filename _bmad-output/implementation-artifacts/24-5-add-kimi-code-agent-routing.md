# Story 24.5: Add Kimi Code Agent Routing

Status: backlog

## Story

As a **ma-agents user running Kimi Code**,
I want `ma-agents install --tools kimi-code` to deploy BMAD skills to `.kimi/skills/`,
So that Kimi Code users get the same BMAD workflow skills as Claude Code, Cline, Roo Code, KiloCode, and Copilot users.

## Acceptance Criteria

1. **Given** the `lib/agents.js` registry, **When** I inspect it after this story, **Then** it contains a Kimi Code entry with `code: 'kimi-code'` and `skillsDir: '.kimi/skills'`.

2. **Given** `--tools kimi-code` is passed to the installer, **When** the install runs, **Then** BMAD skills are deployed to `.kimi/skills/` in the target project directory.

3. **Given** `ma-agents --help` or the tool selection prompt, **When** I read the tool list, **Then** `kimi-code` appears as a valid option with an appropriate description.

4. **Given** the unit test suite, **When** I run `npm test`, **Then** a test covers Kimi Code routing and asserts `.kimi/skills/` is populated.

5. **Given** CI matrix coverage, **When** Story 24.9 is implemented, **Then** the `kimi-code` matrix entry in `multi-tool-smoke.yml` will assert `.kimi/skills/` is populated — this story only provides unit-level verification.

## Tasks / Subtasks

### Task 1: Add Kimi Code entry to lib/agents.js (AC: 1, 2)

- [ ] 1.1 Open `lib/agents.js` — inspect the existing agent registry entries (e.g., `claude-code`, `kilocode`, `copilot`)
- [ ] 1.2 Add a new entry for Kimi Code following the exact same shape as existing entries:
  - `code: 'kimi-code'`
  - `skillsDir: '.kimi/skills'`
  - `description:` (match tone of existing descriptions, e.g., "Kimi Code AI assistant")
  - Any other fields present in existing entries (e.g., `instructionsDir`, `fileExtension`) — set appropriately or null if Kimi uses the SKILL.md copy model only
- [ ] 1.3 Confirm the entry is in the exports / registry array that the installer iterates

### Task 2: Verify CLI help text includes kimi-code (AC: 3)

- [ ] 2.1 Open `bin/cli.js` — locate the `--tools` argument definition and tool selection list
- [ ] 2.2 Confirm `kimi-code` appears automatically from the registry, or add it explicitly if the list is hardcoded
- [ ] 2.3 Run `node bin/cli.js --help` and confirm `kimi-code` appears in the output

### Task 3: Add or extend unit test for Kimi routing (AC: 4)

- [ ] 3.1 Locate the existing multi-tool or agent routing test file (e.g., `test/agents.test.js` or `test/multi-tool-smoke.test.js`)
- [ ] 3.2 Add a test case: install with `--tools kimi-code` against a temp dir; assert `.kimi/skills/` exists and contains expected skill files
- [ ] 3.3 Run the new test in isolation — confirm it passes

### Task 4: Run full test suite (AC: 4)

- [ ] 4.1 Run `npm test` — exit code 0
- [ ] 4.2 Confirm no existing tests regressed

## Dev Notes

### Pattern reference

Kimi Code follows the SKILL.md copy model — same as all other tools except Copilot (which uses an mdx transformation). The closest analogous addition in the codebase is `kilocode` (added as the 5th tool). Copy that pattern exactly.

BMAD v6.4.0 upstream PR #2302 added `.kimi/skills/` as the canonical Kimi Code skill directory. The dir name is authoritative from upstream — do not deviate.

### What this story does NOT do

- Does NOT add Kimi to the CI multi-tool smoke matrix (Story 24.9)
- Does NOT add any instruction-injection for Kimi (Kimi follows SKILL.md copy model, no injection needed)
- Does NOT modify any SKILL.md content for Kimi-specific behavior

### Reference Files

- `lib/agents.js` — agent registry
- `bin/cli.js` — CLI entry point, tool list
- `test/` — existing agent routing tests
- BMAD v6.4.0 PR #2302 — Kimi Code upstream support

## Change Log

| Date | Version | Author | Description |
|------|---------|--------|-------------|
| 2026-04-26 | 1.0.0 | (pending) | Story drafted as part of Epic 24 planning |
