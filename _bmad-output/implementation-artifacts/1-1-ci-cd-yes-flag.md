# Story 1.1: Add --yes Flag for Non-Interactive Skill Installation

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **DevOps engineer**,
I want to run `npx ma-agents install --yes` to skip all interactive prompts,
So that I can automate skill installation in CI/CD pipelines without human intervention.

## Acceptance Criteria

1. **Given** the CLI is invoked with `--yes` flag
   **When** the install command executes
   **Then** all interactive prompts (skill selection, agent selection, confirmations) are bypassed with default selections
   **And** the installation completes without requiring stdin input
   **And** exit code 0 is returned on success, non-zero on failure

2. **Given** the CLI is invoked with `--yes --force` flags together
   **When** the install command executes
   **Then** all interactive prompts are skipped with default selections (same as `--yes` alone)
   **And** existing skill files are overwritten without version comparison (the `--force` behavior)
   **Note:** `--yes` controls prompt skipping; `--force` controls file overwrite. They are orthogonal.

3. **Given** the CLI is invoked with `--yes` and a specific agent target (e.g., `--agent claude-code`)
   **When** the install command executes
   **Then** only the specified agent is targeted without prompting for agent selection
   **And** all skills are installed to that agent without skill selection prompts

## Tasks / Subtasks

- [ ] Task 1: Add `--yes` and `--agent` flag parsing to `parseFlags()` (AC: #1, #2, #3)
  - [ ] 1.1: Add `yesFlag` boolean extraction in `parseFlags()` function (search: `function parseFlags`). Same pattern as existing `forceFlag`.
  - [ ] 1.2: Add `--agent <name>` extraction in `parseFlags()`. Pattern: same as `--path` — extract next positional arg after `--agent` as the agent name. Return as `agentFlag`.
  - [ ] 1.3: Filter `--yes` and `--agent <name>` from positional args (same filter pattern as `--global` and `--force`)
  - [ ] 1.4: Validate `--agent` value: if `--agent` is present but no name follows, print `Error: --agent requires an agent name` / `Hint: Run "list" to see available agents` and exit 1
  - [ ] 1.5: Add `--yes` and `--agent <name>` to help text (search: `console.log.*Usage`)
- [ ] Task 2: Update `installWizard()` to bypass prompts when `--yes` is active (AC: #1)
  - [ ] 2.1: Accept `yesFlag` parameter in `installWizard()` signature (search: `async function installWizard`)
  - [ ] 2.2: Skip existing installation check prompt (search: `Existing installation detected`) — default to `'reinstall'` (clean slate, then install all). This avoids the `isUpdate` path which re-triggers skill selection prompts.
  - [ ] 2.3: Skip skill selection prompt (search: `install all available skills or choose`) — default to ALL skills. **Important:** when `yesFlag` is true, also skip when `isUpdate` is true — the `isUpdate` OR condition must not re-trigger prompts.
  - [ ] 2.4: Skip IDE agent selection prompt (search: `Select AI Coding Assistants`) — default to ALL detected IDE agents. If zero IDE agents detected, set to empty array (not an error — BMAD agents may still be selected).
  - [ ] 2.5: Skip BMAD agent selection prompt (search: `Select BMAD Method Agents`) — default to ALL BMAD agents
  - [ ] 2.6: After agent selection, if total `selectedAgentIds` is zero, print `Error: No agents detected` / `Hint: Ensure at least one supported IDE is present` and exit 1. This is expected CI/CD behavior — fail fast with a clear message rather than silently succeeding with nothing installed.
  - [ ] 2.7: Skip scope selection prompt (search: `Installation scope`) — default to `'project'` scope. Note: if `--global` or `--path` was already provided by the user, those take precedence and this prompt is already skipped by existing logic.
  - [ ] 2.8: Skip BMAD install/update prompts (search: `BMAD-METHOD not detected` / `BMAD-METHOD installation detected`) — default to YES. **Caution:** the BMAD tools filter (search: `['claude-code', 'cursor', 'cline', 'gemini', 'antigravity']`) is hardcoded; agents outside this list will not receive BMAD customizations. This is existing behavior, not a new concern, but log a warning if `selectedAgentIds` contains agents not in the filter list.
  - [ ] 2.9: Skip final confirmation prompt (search: `Proceed with installation`) — proceed immediately
- [ ] Task 3: Update `handleInstall()` to pass `yesFlag` and `agentFlag` through call chain (AC: #1, #2, #3)
  - [ ] 3.1: Extract `yesFlag` and `agentFlag` from parsed flags in `handleInstall()` (search: `async function handleInstall`)
  - [ ] 3.2: When `agentFlag` is present, validate it against known agents (call `listAgents()` and check). If invalid, print `Error: Unknown agent '<name>'` / `Hint: Run "list" to see available agents` and exit 1.
  - [ ] 3.3: Pass `yesFlag` to `installWizard()` call
  - [ ] 3.4: When `agentFlag` is present, pass it as `preselectedAgents: [agentFlag]` to `installWizard()`, which skips agent selection entirely (existing behavior when `preselectedAgents` is non-empty)
  - [ ] 3.5: Pass `yes: yesFlag` in options to `installSkill()` calls
- [ ] Task 4: Update `installSkill()` to honor `--yes` for upgrade/downgrade prompts (AC: #1)
  - [ ] 4.1: Accept `yes` in options destructuring (search: `async function installSkill`, then the `const { force` destructure)
  - [ ] 4.2: When `yes === true` and skill is already installed and `force` is false: skip upgrade/downgrade/same-version decision prompts (search: `What would you like to do?` inside `installSkill`). Default action: `'update'` (install the package version). This does NOT force file overwrites — it simply auto-selects "update" instead of prompting.
  - [ ] 4.3: When `yes === true`, pre-set `batchState.globalAction = 'update'` so all remaining skills in the batch also auto-update without prompts (search: `batchState`).
  - [ ] 4.4: Guard against accidental prompt execution: if `yes === true` and any `prompts()` call returns `undefined` (which happens when stdin is closed/piped), treat it as a fatal error — print `Error: Unexpected interactive prompt in non-interactive mode` and exit 1. This catches missed bypass paths.
- [ ] Task 5: Ensure proper exit codes (AC: #1)
  - [ ] 5.1: Verify `process.exit(0)` on successful non-interactive completion
  - [ ] 5.2: Verify `process.exit(1)` on any failure (no skills found, no agents detected, invalid `--agent` name, install errors)
  - [ ] 5.3: Ensure no dangling promises or unhandled rejections that could prevent clean exit
- [ ] Task 6: Automated tests (AC: #1, #2, #3)
  - [ ] 6.1: Unit test `parseFlags()` with `--yes`, `--yes --force`, `--yes --agent claude-code`, `--yes --agent` (missing name)
  - [ ] 6.2: Unit test `installWizard()` with `yesFlag=true`: mock `prompts` and assert it is NEVER called. Verify all defaults are applied correctly.
  - [ ] 6.3: Unit test `installSkill()` with `yes=true`: verify prompts are skipped and default action is `'update'`
  - [ ] 6.4: Integration test: run `npx ma-agents install --yes` with stdin piped from `/dev/null` and assert exit code 0, no stdin reads, and expected output
  - [ ] 6.5: Integration test: run `npx ma-agents install --yes --agent invalid-agent-name` and assert exit code 1 with error message
- [ ] Task 7: Manual smoke testing
  - [ ] 7.1: `npx ma-agents install --yes` — installs all skills to all detected agents, project scope
  - [ ] 7.2: `npx ma-agents install --yes --force` — same as above but overwrites existing files
  - [ ] 7.3: `npx ma-agents install --yes --agent claude-code` — installs all skills to Claude Code only
  - [ ] 7.4: `npx ma-agents install --yes --global` — installs all skills globally
  - [ ] 7.5: `echo '' | npx ma-agents install --yes` — verify zero stdin dependency

## Dev Notes

### Architecture Compliance

- **Module boundaries:** All CLI argument parsing stays in `bin/cli.js`. The `--yes` flag is parsed there and passed as an option to `lib/installer.js`. installer.js NEVER parses CLI args directly — it receives options objects. This is the established pattern with `--force`.
- **No new dependencies:** The `prompts` library is already used. When `--yes` is active, prompts are simply NOT called — no need for a mock or alternative prompting library.
- **Code style:** Plain JavaScript, camelCase for variables/functions, no classes. Follow exact patterns from existing `forceFlag` implementation.

### Key Implementation Pattern

The `--force` flag provides the exact model to follow:
1. **Parsed in `parseFlags()`** (search: `function parseFlags`) — boolean extraction from args array
2. **Passed through call chain** — `handleInstall()` → `installWizard()` / `installSkill()`
3. **Consumed in functions** — conditionally skip prompts based on flag value

The `--yes` flag follows this IDENTICAL pattern but covers a broader scope:
- `--force`: skips file-overwrite guards (the `if (installed && !force)` gate in `installSkill`)
- `--yes`: skips ALL interactive prompts (wizard + upgrade/downgrade), selecting sensible defaults
- `--yes --force`: skips ALL prompts AND forces file overwrites — the two flags are **orthogonal**

### Flag Semantics: `--yes` vs `--force`

These flags operate on different axes and MUST NOT be conflated:

| Flag | What it controls | Effect in `installSkill()` |
|------|-----------------|---------------------------|
| `--yes` | Prompt skipping | When a skill is already installed, auto-selects `'update'` action instead of prompting. Does NOT bypass version comparison — the version check still runs, it just auto-decides. |
| `--force` | File overwrite | Bypasses the entire `if (installed && !force)` block. Skips version comparison entirely and proceeds directly to file copy/overwrite. |
| `--yes --force` | Both | `--force` takes precedence in `installSkill()` (the `!force` gate means the prompt block is never entered, so `--yes` has no additional effect there). In `installWizard()`, `--yes` skips wizard prompts while `--force` is passed through for file operations. |

### Default Selections When --yes is Active

| Prompt | Default (--yes) | Code anchor (search string) |
|--------|----------------|---------------------------|
| Existing installation action | `'reinstall'` (clean slate + install all) | `Existing installation detected` |
| Skill selection | ALL skills | `install all available skills or choose` |
| IDE agent selection | ALL detected IDE agents | `Select AI Coding Assistants` |
| BMAD agent selection | ALL BMAD agents | `Select BMAD Method Agents` |
| Scope | `'project'` (unless `--global` or `--path`) | `Installation scope` |
| BMAD install/update | YES | `BMAD-METHOD not detected` / `BMAD-METHOD installation detected` |
| Final confirmation | YES (proceed) | `Proceed with installation` |
| Upgrade/downgrade decision | `'update'` (install package version) | `What would you like to do?` inside `installSkill` |

**Why `'reinstall'` for existing installation:** The `'update'` action sets `isUpdate = true`, which re-triggers the skill selection prompt (the guard is `selectedSkillIds.length === 0 || isUpdate`). Using `'reinstall'` avoids this interaction — it clears existing installs and proceeds to install all skills cleanly, which is the expected CI/CD behavior.

### Critical Guardrails

- **Never add TypeScript, build steps, or new dependencies** [Source: architecture.md#Anti-Patterns]
- **Use `path.join()` for all file paths** — no string concatenation [Source: architecture.md#Enforcement-Guidelines]
- **Preserve module boundaries** — CLI parsing in cli.js, install logic in installer.js [Source: architecture.md#Module-Boundaries]
- **Console output format:** plain text, chalk colors (green=success, yellow=warning, red=error), no emoji [Source: architecture.md#Format-Patterns]
- **Error format:** `Error: <what>` then `  Hint: <how to fix>` [Source: architecture.md#Format-Patterns]
- **Defensive prompt guard:** In `--yes` mode, if any `prompts()` call executes and returns `undefined` (which happens when stdin is closed/piped from `/dev/null`), this indicates a missed bypass. Treat as fatal: print error and exit 1. This prevents silent success-exit on incomplete operations.

### Interaction with --agent Flag

The `--agent <name>` flag is NOT currently parsed by `parseFlags()`. This story adds it as a first-class flag (Task 1.2) because AC #3 requires it for CI/CD usage.

**Parsing pattern:** Same as `--path` — extract the next positional arg after `--agent` as the agent name, splice both from positional args.

**Validation:** `handleInstall()` validates the agent name against `listAgents()` before passing to `installWizard()`. Invalid names produce `Error: Unknown agent '<name>'` / `Hint: Run "list" to see available agents` and exit 1.

**Interaction with `--yes`:** When `--agent` is present, it is passed as `preselectedAgents`, which already skips agent selection in the existing wizard logic. `--yes` is not required for `--agent` to work, but they combine naturally.

### Batch State Consideration

The installer has a `batchState` pattern (search: `batchState` in `installSkill`) for "apply decision to all remaining" during multi-skill installs. When `--yes` is active, pre-set `batchState.globalAction = 'update'` before the skill install loop. This ensures all skills auto-update without prompts, using the existing batch mechanism rather than bypassing prompts individually (cleaner, fewer code paths to maintain).

### BMAD Tools Filter Limitation

The BMAD integration code (search: `['claude-code', 'cursor', 'cline', 'gemini', 'antigravity']`) hardcodes a filter for which agents receive BMAD customizations. In `--yes` mode, if `selectedAgentIds` includes agents not in this list, those agents will not receive BMAD customizations. This is existing behavior, not introduced by this story, but in `--yes` mode a warning should be logged: `Warning: Agent '<name>' is not supported for BMAD customizations`.

### Project Structure Notes

- Files to modify: `bin/cli.js`, `lib/installer.js`
- Test files to create: `test/yes-flag.test.js` (or add to existing test file if one exists)
- No directory structure changes
- Alignment with unified project structure: confirmed — both files are established modules in the 4-module architecture

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Epic-1] — Epic 1 story definition and acceptance criteria
- [Source: _bmad-output/planning-artifacts/prd.md#FR6] — FR6: Non-interactive CI/CD mode requirement
- [Source: _bmad-output/planning-artifacts/prd.md#NFR9] — NFR9: Cross-platform identical results
- [Source: _bmad-output/planning-artifacts/architecture.md#Pipeline-Architecture] — Install pipeline 5 stages
- [Source: _bmad-output/planning-artifacts/architecture.md#Implementation-Patterns] — Naming, structure, format, process patterns
- [Source: _bmad-output/planning-artifacts/architecture.md#Module-Boundaries] — cli.js/installer.js/agents.js/bmad.js boundaries
- [Source: bin/cli.js `function parseFlags`] — Current parseFlags() implementation
- [Source: bin/cli.js `async function installWizard`] — Current installWizard() with all prompt locations
- [Source: lib/installer.js `async function installSkill`] — Current installSkill() with force flag pattern

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
