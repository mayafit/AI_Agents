# Story 7.4: Add Tests for cli.js Command Routing

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->
<!-- Dependency: Story 7-1 must be completed first (test framework setup) -->

## Story

As a **developer**,
I want tests covering CLI command parsing and routing,
So that command-line argument handling is verified automatically.

## Acceptance Criteria

1. **Given** tests exist for `cli.js`
   **When** the test suite runs
   **Then** it verifies:
   - Known commands (install, list, status, uninstall) route correctly
   - Unknown commands produce helpful error messages
   - Flag parsing (`--yes`, `--force`, `--agent`) extracts values correctly
   - Help output is displayed for `--help` flag
   - Version output is displayed for `--version` flag

## Tasks / Subtasks

- [ ] Task 1: Analyze cli.js testability (AC: #1)
  - [ ] 1.1: Map the command routing in `main()` function (line 523)
  - [ ] 1.2: Identify `parseFlags(args)` function (line 107) — this is a pure function, directly testable
  - [ ] 1.3: Identify which functions can be tested without triggering interactive prompts or real installs
  - [ ] 1.4: Note: `cli.js` is the `bin` entry point — it calls `main()` on require. Tests must NOT require cli.js directly or it will execute. Import specific functions or test via subprocess.
- [ ] Task 2: Test flag parsing (AC: #1)
  - [ ] 2.1: Create `tests/cli.test.js`
  - [ ] 2.2: **Challenge:** `parseFlags()` is not exported — it's internal to cli.js. Options:
    - Option A: Export `parseFlags` from cli.js for testing (minor, safe change)
    - Option B: Test via subprocess: `node bin/cli.js --help` and verify output
    - Option C: Extract `parseFlags` to a shared utility (over-engineering for this story)
  - [ ] 2.3: If Option A: Test `parseFlags(['--yes'])` returns `{ yes: true }`
  - [ ] 2.4: If Option A: Test `parseFlags(['--force'])` returns `{ force: true }`
  - [ ] 2.5: If Option A: Test `parseFlags(['--agent', 'claude-code'])` returns `{ agent: 'claude-code' }`
  - [ ] 2.6: If Option A: Test `parseFlags([])` returns empty/default flags
- [ ] Task 3: Test CLI commands via subprocess (AC: #1)
  - [ ] 3.1: Test: `node bin/cli.js --help` exits 0 and outputs usage info
  - [ ] 3.2: Test: `node bin/cli.js --version` exits 0 and outputs version matching `package.json` version
  - [ ] 3.3: Test: `node bin/cli.js list` exits 0 and outputs skill/agent listings
  - [ ] 3.4: Test: `node bin/cli.js list --skills` exits 0 and outputs skill names
  - [ ] 3.5: Test: `node bin/cli.js list --agents` exits 0 and outputs agent names
  - [ ] 3.6: Test: `node bin/cli.js unknowncommand` exits non-zero or outputs help/error
  - [ ] 3.7: Use `child_process.execSync` or `child_process.exec` for subprocess testing
- [ ] Task 4: Test help and version output content (AC: #1)
  - [ ] 4.1: Test: help output contains key command names (install, list, status, uninstall)
  - [ ] 4.2: Test: version output matches `require('../package.json').version`

## Dev Notes

### Architecture Compliance

- **Test location:** `tests/cli.test.js` [Source: architecture.md#Structure-Patterns]
- **CLI entry point hazard:** `bin/cli.js` calls `main()` at the bottom of the file. Requiring it directly would trigger the CLI. Tests must either:
  1. Test via subprocess (`child_process.exec('node bin/cli.js ...')`)
  2. Or export specific functions and guard `main()` behind `require.main === module` check
- **No real installs:** CLI tests must not trigger `install` or `uninstall` operations

### cli.js Module Structure

From [cli.js:1-565](bin/cli.js) — 565 lines, key functions:

**Display functions (no side effects beyond console output):**
- `showHelp()` (line 13) — prints usage info
- `showSkills()` (line 42) — lists skills
- `showAgents()` (line 51) — lists agents
- `showStatus(args)` (line 70) — shows install status

**Parsing functions (pure logic, most testable):**
- `parseFlags(args)` (line 107) — extracts --yes, --force, --agent, --skill, --scope, --path flags

**Command handlers (orchestrate operations, harder to test):**
- `handleInstall(args)` (line 425) — install command handler
- `handleUninstall(args)` (line 453) — uninstall command handler
- `installWizard(...)` (line 130) — interactive install flow
- `interactiveMode()` (line 480) — interactive menu
- `main()` (line 523) — entry point, routes commands

### parseFlags() Function Detail

From [cli.js:107-127](bin/cli.js#L107-L127):
```javascript
function parseFlags(args) {
  // Parses: --yes, --force, --agent <name>, --skill <name>, --scope <scope>, --path <path>
  // Returns object with extracted values
}
```

This is the best candidate for direct unit testing if exported.

### Subprocess Testing Pattern

```javascript
const { execSync } = require('node:child_process');
const { describe, it } = require('node:test');
const assert = require('node:assert');

describe('CLI commands', () => {
  it('--help should exit 0 and show usage', () => {
    const output = execSync('node bin/cli.js --help', { encoding: 'utf-8' });
    assert.ok(output.includes('Usage'));
  });

  it('--version should show package version', () => {
    const output = execSync('node bin/cli.js --version', { encoding: 'utf-8' });
    const { version } = require('../package.json');
    assert.ok(output.includes(version));
  });
});
```

### Minimal Source Change Option

To test `parseFlags()` directly, a small change to `cli.js` may be needed:

```javascript
// At bottom of cli.js, replace direct main() call:
if (require.main === module) {
  main();
}

// And export testable functions:
module.exports = { parseFlags };
```

This is a minimal, safe change that enables direct testing while preserving CLI behavior. Discuss with reviewer if this is acceptable or if subprocess-only testing is preferred.

### Critical Guardrails

- **Never trigger real installs** — only test non-destructive commands (list, help, version, status)
- **No interactive prompts in tests** — avoid commands that trigger `prompts` library
- **subprocess tests must have timeout** — prevent hanging tests
- **No new npm dependencies** — use `node:test`, `node:assert`, `node:child_process`
- **Minimal changes to `bin/cli.js`** — only `require.main` guard and optional exports if needed

### Project Structure Notes

- Files to create: `tests/cli.test.js`
- Files to potentially modify: `bin/cli.js` (add `require.main` guard + export parseFlags — minimal change)
- No changes to `lib/` source files

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Epic-7] — Story 7.4 definition
- [Source: _bmad-output/planning-artifacts/architecture.md#Structure-Patterns] — Test directory structure
- [Source: bin/cli.js] — CLI module (565 lines, 10 functions, entry point)
- [Source: _bmad-output/implementation-artifacts/7-1-test-infrastructure-setup.md] — Prerequisite story

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
