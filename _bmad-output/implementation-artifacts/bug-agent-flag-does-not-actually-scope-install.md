---
type: bug
severity: low
status: review
title: --agent flag does not actually scope the install
---

# Bug: `--agent` flag does not actually scope the install

**Severity:** low
**Affected Component:** CLI argument handling — `bin/cli.js` + the install pipeline that consumes the flag

## Reproduction Steps

1. Run an install scoped to a single tool:
   ```bash
   mkdir -p /tmp/agent-scope-repro && cd /tmp/agent-scope-repro && git init -q
   (cd /tmp/agent-scope-repro && node <repo>/bin/cli.js install --yes --force --agent claude-code)
   ```
2. Inspect what was deployed:
   ```bash
   ls -la /tmp/agent-scope-repro/.claude/skills/ 2>/dev/null && echo "claude-code present"
   ls -la /tmp/agent-scope-repro/.cline/skills/ 2>/dev/null && echo "cline present (unexpected)"
   ls -la /tmp/agent-scope-repro/.roo/skills/ 2>/dev/null && echo "roo-code present (unexpected)"
   ls -la /tmp/agent-scope-repro/.kilocode/skills/ 2>/dev/null && echo "kilocode present (unexpected)"
   ls -la /tmp/agent-scope-repro/.github/skills/ 2>/dev/null && echo "copilot present (unexpected)"
   ```

## Expected Behavior

`--agent <name>` scopes the install to a single tool target. Only that tool's skill directory is populated; other tools' skill directories are NOT created or modified.

This matches the spirit of the flag's name and how Story 22.10's multi-tool smoke matrix invokes it (the matrix expects per-tool isolation so a regression in one tool's routing doesn't hide behind another tool's success).

## Actual Behavior

`--agent <name>` is accepted by the CLI but does NOT hard-scope the install. The install pipeline runs the full multi-agent flow regardless of which agent was passed, populating ALL configured tools' skill directories.

The Story 22.10 multi-tool-smoke verifier accommodates this by asserting only the requested tool's output, not the absence of other tools' content. Comment at `.github/scripts/multi-tool-smoke-verify.sh:~154-159` documents the workaround: "The comment admits `--agent` does NOT hard-scope, so all tools are installed every run. Wasted CI minutes and partially invalidates the per-tool signal."

## Root Cause Hypothesis

Either:
1. The `--agent` flag is parsed in `bin/cli.js` but the parsed value is never passed down to the install pipeline (silent no-op)
2. The install pipeline does not branch on the agent value (legacy logic from before `lib/agents.js` was multi-tool-aware)
3. The flag is treated as informational metadata rather than a scoping filter

Likely (2) — the install pipeline iterates `getAllAgents()` unconditionally rather than filtering by the `--agent` value.

## Affected Files

- `bin/cli.js` — flag parsing and pass-down to the install pipeline
- `lib/bmad.js` — `installBmad`, `updateBmad` entry points; need to accept and honor the agent filter
- `lib/installer.js` — `installSkill` and similar; should respect a per-call agent scope
- `lib/agents.js` — `getAllAgents()` may need a sibling `getAgent(name)` or a filter parameter
- `.github/scripts/multi-tool-smoke-verify.sh` — workaround comment can be removed once fixed
- `.github/workflows/multi-tool-smoke.yml` — runtime savings: matrix jobs skip work for un-targeted tools

## Suggested Fix

1. Trace the `--agent` flag from `bin/cli.js` through to its consumer (or absence of one). Confirm the no-op hypothesis with a quick log injection.
2. Pass the agent name (or undefined for "all") into `installBmad` / `updateBmad` / `runMigration`.
3. In the install loop, filter `getAllAgents()` by the requested name when one is provided.
4. Add a regression test:
   - Install with `--agent claude-code` against a scratch project
   - Assert ONLY `.claude/skills/` is populated; assert `.cline/skills/`, `.roo/skills/`, `.kilocode/skills/`, `.github/skills/` are absent
5. Update the multi-tool-smoke verifier to use the now-real scoping (drop the workaround comment, expect per-tool isolation).
6. Document the flag behavior in the README / `--help` output.

**Scope estimate:** small to medium — flag pass-down + filter + regression test + verifier cleanup. ~150 LOC.

## Why low severity

- The current behavior is "over-installs" not "under-installs" — every tool gets the full skill set on every run, which is functionally fine for end users (just wasteful)
- No data loss, no security implication, no broken feature
- CI runtime is the main concrete cost (5x the necessary work in the matrix); end-user installs are rarely scoped this way
- Surfaced during Story 22.10 multi-tool smoke; the verifier already compensates

## Notes

- Created via `create-bug-story` workflow
- Discovered during Story 22.10 (PR #66) and confirmed in the Epic 22 adversarial review
- Discoverable by sprint workflows via glob: `_bmad-output/implementation-artifacts/bug-*.md`
- To add to a sprint, run `/add-to-sprint`

## Dev Notes

### Project Structure Notes

Key files for this fix:

- `bin/cli.js` — `parseArgs()` at line ~232 parses `--agent` into `agentFlag`; `installWizard` receives `preselectedAgents` (line ~1158-1162). The bug: `agentFlag` is wired into the skills-only install path (line ~1212 `const targetAgents = agentFlag ? [agentFlag] : agentIds`) but the BMAD install path (`installBmad`/`updateBmad`) receives `bmadTools` built from `selectedAgentIds` — the full set, not filtered by `agentFlag`.
- `lib/installer.js` — `installSkill(skillId, agentIds, ...)` — `agentIds` is the correct filter point; the function already iterates only the passed agent IDs via `getAgent(agentId)` loop. The bug is in how `agentIds` gets populated upstream.
- `lib/agents.js` — `getAllAgents()` returns all 13 registered agents; `getAgent(id)` returns a single agent. The filtering should happen in the caller (cli.js), not here.
- `lib/bmad.js` — `installBmad(modules, tools)` and `updateBmad(modules, tools)` accept a `tools` array; when `agentFlag` is set this should be `[getBmadPlatformCode(agentFlag)]` only.

Naming conventions:
- Agent ID strings: `claude-code`, `copilot`, `cline`, `roo-code`, `kilocode` (from `lib/agents.js` registry)
- `getBmadPlatformCode(agentId)` maps ma-agents IDs to BMAD platform codes (e.g., `roo-code` → `roo`, `copilot` → `github-copilot`)
- The `agentFlag` variable in cli.js stores the raw `--agent` value (an agent ID)

### Testing Requirements

Existing tests to check before submitting:
- `test/yes-flag.test.js` — covers `--yes` flag behavior including multi-agent paths
- `test/routing-parity.test.js` — verifies per-tool routing consistency
- `test/integration-verification.test.js` — end-to-end install verification

New test required by this fix:
- Add a test case (in `test/yes-flag.test.js` or a new `test/agent-scope.test.js`) that:
  1. Calls `installSkill` with `agentIds: ['claude-code']` against a scratch temp directory
  2. Asserts `.claude/skills/` is populated
  3. Asserts `.cline/skills/`, `.roo/skills/`, `.kilocode/skills/`, `.github/skills/` are NOT created
  4. Asserts `.ma-agents.json` `agents` array contains only `claude-code`

How to run tests: `npm test` in `d:\Code\agents` (runs all ~50 test files sequentially)

### What this story does NOT do

- Does NOT change how multi-agent installs (no `--agent` flag) work
- Does NOT modify `lib/agents.js` registry entries or `skillsDir` values
- Does NOT address the stale copilot directory cleanup (Bug B2)
- Does NOT add `.agents/skills/` routing (Story 24.11)

## Dev Agent Record

### Agent Model Used
claude-sonnet-4-6

### Debug Log References
(none — fix was straightforward, no debug logs needed)

### Completion Notes List
- Fixed `installWizard` Step 2 in `bin/cli.js`: when `--agent` flag pre-selects agents, `yesFlag=true` no longer overwrites `selectedAgentIds` with all agents. The guard `if (selectedAgentIds.length === 0)` ensures the pre-selected agent(s) are honoured.
- Updated `.github/scripts/multi-tool-smoke-verify.sh`: removed the "known limitation" workaround comment in Step 3; added Invariant E that asserts other flagship tools' skill dirs are absent after a scoped install.
- Added `test/agent-scope.test.js` with 6 assertions covering: target dir created, 4 other dirs absent, manifest agents array contains only the target agent.
- Added `test/agent-scope.test.js` to `package.json` test script.
- Minor note: `bash` associative arrays (`declare -A`) require bash 4+; macOS ships bash 3.2 by default. The CI environment uses ubuntu-latest which has bash 5, so Invariant E in the shell script is safe. (Minor finding — not blocking.)

### File List
- `bin/cli.js` — Bug B1 fix: guard in Step 2 preserves preselectedAgents when yesFlag=true
- `.github/scripts/multi-tool-smoke-verify.sh` — removed workaround comment; added Invariant E (scoping regression guard)
- `test/agent-scope.test.js` — new: 6 regression tests for agent-scoped install
- `package.json` — added agent-scope.test.js to test script
- `_bmad-output/implementation-artifacts/bug-agent-flag-does-not-actually-scope-install.md` — status → review
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — status → review
