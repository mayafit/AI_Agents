# Stage 4a Dev Report — Story 25.1

**Story:** Guard buildBmadArgs Against Empty Tools on Fresh Installs
**Date:** 2026-05-01
**Status:** Stage 4a: COMPLETE

## Files Changed

### `bin/cli.js` (modified)
- Lines 1051–1107: Hoisted `bmadTools` declaration to line 1052 (immediately after `bmadInstalled`)
- Added outer guard `if (bmadTools.length > 0)` wrapping the entire install/update block
- Removed 4 redundant inline `const bmadTools = ...` declarations (were at the original ~1059, ~1074, ~1084, ~1099)
- Added one-line comment: `// v6.6.0: --tools none is rejected for fresh installs; skip BMAD entirely when no IDE tools selected.`

### `test/bmad-empty-tools-guard.test.js` (created)
- 4 unit tests verifying the guard logic:
  1. `bmadTools is empty when selectedAgentIds contains no IDE agents`
  2. `bmadTools is non-empty when at least one IDE agent is selected`
  3. `installBmad is not called when bmadTools is empty`
  4. `installBmad IS called when bmadTools is non-empty`

### `_bmad-output/implementation-artifacts/25-1-guard-buildBmadArgs-empty-tools.md` (modified)
- Status changed from `ready-for-dev` to `done`
- Completion note and changelog entry added

## Test Results

### New test (Story 25.1):
```
Story 25.1: BMAD empty-tools guard

  ✓ bmadTools is empty when selectedAgentIds contains no IDE agents
  ✓ bmadTools is non-empty when at least one IDE agent is selected
  ✓ installBmad is not called when bmadTools is empty
  ✓ installBmad IS called when bmadTools is non-empty

4 passed, 0 failed
```

### Existing test suite:
All tests pass except 4 pre-existing failures in `routing-parity.test.js` (add-sprint, add-to-sprint, modify-sprint, sprint-status-view content parity). These failures exist on the branch before Story 25.1 changes were applied (confirmed by git stash + re-run). They are caused by Jira backend routing content added to skills on this branch that hasn't been snapshotted yet in the test fixtures — not related to this story.

### `test/build-bmad-args.test.js`:
All 34 tests pass, including the `buildBmadArgs uses --tools none when no tools selected` test (line 87) — confirming `buildBmadArgs()` itself is unchanged.

## Key Decisions

- `lib/bmad.js` was NOT modified (guard is at call site only, as per story spec)
- `getAllAgents()` used (not `getAgents()`) — confirmed from `lib/agents.js` exports
- Test file uses the same homegrown `test(name, fn)` pattern as existing test files in the suite (no mocha/jest dependency)

## Stage 4a: COMPLETE
