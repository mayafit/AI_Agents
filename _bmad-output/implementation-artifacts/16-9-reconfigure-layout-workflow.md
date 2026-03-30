# Story 16.9: Reconfigure Layout Workflow

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **user who needs to change my repo layout after installation**,
I want a dedicated workflow to reconfigure where knowledgebase and sprint management are located,
So that I can change from single-repo to multi-repo (or vice versa) without re-running the full installer.

## Problem Context

After installation, if a user wants to change their repo layout (e.g., move from single-repo to multi-repo, change the remote URL, switch from local to remote), the only option is to re-run the entire `ma-agents` installer. There is no targeted reconfigure command. Re-running the installer risks the config-loss bug (Story 16.5) and forces the user through all installation steps just to change a path.

## Acceptance Criteria

1. **Given** the user runs `ma-agents config layout` (or `ma-agents reconfigure-layout`), **When** the command starts, **Then** it reads and displays the current layout configuration from `project-layout.yaml` and `config.yaml`
2. **Given** the current layout is displayed, **When** the user chooses to modify it, **Then** the same repo layout wizard prompts from Story 16.1 are presented — pre-populated with current values
3. **Given** the user completes the reconfiguration, **When** new paths are confirmed, **Then** `writeRepoLayoutConfig()` and `writeProjectLayoutYaml()` are called to update all config files
4. **Given** multi-repo layout is configured, **When** reconfiguration completes, **Then** `updateProjectContextRepoLayout()` is called to update `project-context.md`
5. **Given** the user runs `ma-agents config layout --show`, **Then** it only displays the current configuration (read-only mode, no prompts)
6. **Given** CI/CD mode (`--yes`), **When** env vars are set, **Then** the reconfiguration applies the env var values without prompts (same env var pattern as Story 16.1/16.8)
7. **Given** the reconfiguration changes from multi-repo to single-repo, **When** the update completes, **Then** `project-layout.yaml` is deleted and `config.yaml` is updated to single-repo defaults
8. **Given** the reconfiguration changes the knowledgebase to a new remote repo, **When** the clone completes, **Then** the old path reference is updated but the old clone directory is NOT deleted (user's responsibility)

## Tasks / Subtasks

- [x] Task 1: Add `config layout` subcommand to CLI
  - [x] 1.1 Register `config layout` in the CLI command routing in `bin/cli.js`
  - [x] 1.2 Support `--show` flag for read-only display
  - [x] 1.3 Support `--yes` flag for headless reconfiguration via env vars

- [x] Task 2: Implement `showCurrentLayout()` function
  - [x] 2.1 Read `project-layout.yaml` if it exists; fall back to `config.yaml` fields
  - [x] 2.2 Display formatted output: mode, path, gitUrl for each concern
  - [x] 2.3 If no multi-repo config found, display "Single-repo layout (default)"

- [x] Task 3: Implement reconfigure flow
  - [x] 3.1 Call `readExistingLayout()` (from Story 16.5) to get current config
  - [x] 3.2 Call `collectRepoLayout(flags, existingLayout)` to present pre-populated wizard
  - [x] 3.3 Call `writeRepoLayoutConfig(newLayout)` to update config.yaml
  - [x] 3.4 Call `writeProjectLayoutYaml(newLayout)` to update/create/delete project-layout.yaml
  - [x] 3.5 Call `updateProjectContextRepoLayout(outputPath, newLayout)` to update project-context.md

- [x] Task 4: Create BMAD workflow/skill for agent-accessible reconfiguration
  - [x] 4.1 Create a skill file that agents can invoke when the user says "reconfigure layout" or "change repo layout"
  - [x] 4.2 The skill instructs the agent to run `npx ma-agents config layout` or guide the user through the process
  - [x] 4.3 Register in MANIFEST.yaml

- [x] Task 5: Write unit tests
  - [x] 5.1 Test `--show` flag displays current layout without modifying anything
  - [x] 5.2 Test reconfigure from single-repo to multi-repo writes all config files
  - [x] 5.3 Test `--yes` preserves existing layout when no env vars set
  - [x] 5.4 Test `--yes` mode applies env vars for reconfiguration
  - [x] 5.5 Test CLI routing: config without subcommand errors

## Dev Notes

### CLI Routing

The project uses a simple command handler pattern in `bin/cli.js`. Add a new handler for the `config` command with `layout` subcommand. Pattern:

```javascript
async function handleConfigLayout(args) {
  const { yesFlag, showFlag } = parseFlags(args);
  if (showFlag) {
    await showCurrentLayout();
    return;
  }
  // ... reconfigure flow
}
```

### Dependencies

- **Story 16.5** (`readExistingLayout`) — required for reading current config
- **Story 16.7** (`toPortablePath`) — used when writing updated paths
- **Story 16.8** (`CI/CD remote env vars`) — for headless reconfiguration

This story should be implemented last in the sequence: 16.5 -> 16.7 -> 16.8 -> 16.6 -> 16.9

### Reuse Existing Functions

This story does NOT duplicate any wizard logic. It reuses:
- `readExistingLayout()` (Story 16.5)
- `collectRepoLayout()` (Story 16.1, modified by 16.5)
- `writeRepoLayoutConfig()` (Story 16.2)
- `writeProjectLayoutYaml()` (Story 16.2)
- `updateProjectContextRepoLayout()` (Story 16.3)

### References

- [Source: bin/cli.js — existing command handlers ~line 800+]
- [Source: Adversarial Review Finding #10 — no reconfigure command]

## Dev Agent Record

### Implementation Plan
- Added `config layout` CLI subcommand with `--show` (read-only) and `--yes` (headless) flags
- `showCurrentLayout()` reads existing layout via `readExistingLayout()` and displays formatted output
- `handleConfigLayout()` reuses existing functions: `readExistingLayout()`, `collectRepoLayout()`, `writeRepoLayoutConfig()`, `writeProjectLayoutYaml()`, `updateProjectContextRepoLayout()`
- Created `reconfigure-layout` SKILL.md for agent-accessible reconfiguration
- Help text updated to show new command

### Completion Notes
- All 5 tasks implemented with 6 dedicated tests
- Full regression suite passes
- Zero new duplicated logic — all write/read functions reused from Stories 16.1-16.8
- SKILL.md provides agent instructions for `/reconfigure-layout`
- CLI handles: `config layout`, `config layout --show`, `config layout --yes`

## File List

- `bin/cli.js` — Added `showCurrentLayout()`, `handleConfigLayout()`, `config layout` CLI routing, updated help text, updated exports
- `.claude/skills/reconfigure-layout/SKILL.md` — New: reconfigure-layout skill
- `.claude/skills/MANIFEST.yaml` — Added reconfigure-layout entry
- `test/config-layout.test.js` — New: 6 tests for showCurrentLayout, handleConfigLayout, CLI routing
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — Updated 16-9 status
- `_bmad-output/implementation-artifacts/16-9-reconfigure-layout-workflow.md` — Story file updated

## Change Log

- 2026-03-28: Implemented `config layout` CLI command for targeted repo layout reconfiguration. 6 tests added.
