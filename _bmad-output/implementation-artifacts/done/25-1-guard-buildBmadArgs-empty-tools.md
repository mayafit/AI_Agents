# Story 25.1: Guard buildBmadArgs Against Empty Tools on Fresh Installs

Status: done

## Story

As a **ma-agents user who installs without selecting any IDE agents**,
I want the BMAD install/update step to be silently skipped rather than invoked with `--tools none`,
So that a zero-tool selection is a clean no-op rather than a failing or undefined bmad-method invocation.

## Acceptance Criteria

1. **Given** `bmadTools` is empty and `!bmadInstalled`, **When** the installer reaches the BMAD install block in `bin/cli.js`, **Then** the BMAD install step is silently skipped (no bmad-method invocation, no error, no warning).

2. **Given** `bmadTools` is empty and `bmadInstalled` is true, **When** the installer reaches the BMAD update block in `bin/cli.js`, **Then** the BMAD update step is silently skipped.

3. **Given** any code path that calls `buildBmadArgs()`, **When** `bmadTools` is non-empty, **Then** `buildBmadArgs()` behavior is completely unchanged — `--tools <list>` is emitted as before.

4. **Given** `bmadTools` is non-empty, **When** the BMAD install or update step runs, **Then** existing behavior is fully preserved (no regression).

5. **Given** a new test case for the call-site guard, **When** `npm test` is run, **Then** the new test passes, asserting that when no IDE agents are in `selectedAgentIds`, neither `installBmad` nor `updateBmad` is called.

## Tasks / Subtasks

### Task 1: Locate the call sites in bin/cli.js (AC: 1, 2)

- [ ] 1.1 Open `bin/cli.js` and navigate to lines 1056–1106 — the BMAD install/update flow
- [ ] 1.2 Identify the four call sites where `bmadTools` is declared and immediately used:
  - Line ~1059: fresh-install `yesFlag` path — `const bmadTools = ...; await bmad.installBmad(...)`
  - Line ~1074: fresh-install interactive path — `const bmadTools = ...; await bmad.installBmad(...)`
  - Line ~1084: update `yesFlag` path — `const bmadTools = ...; await bmad.updateBmad(...)`
  - Line ~1099: update interactive path — `const bmadTools = ...; await bmad.updateBmad(...)`
- [ ] 1.3 Confirm that skipping the block produces no error, no warning, and no output side-effect
- [ ] 1.4 Confirm that `buildBmadArgs()` in `lib/bmad.js` is NOT changed — the guard is purely at the call site

### Task 2: Apply the guard (AC: 1, 2, 3, 4)

- [ ] 2.1 Edit `bin/cli.js`: hoist `bmadTools` to a single declaration immediately after line 1051 (`const bmadInstalled = bmad.isBmadInstalled();`):
  ```js
  const bmadTools = selectedAgentIds.filter(id => bmadToolsFilter.includes(id)).map(id => getBmadPlatformCode(id));
  ```
- [ ] 2.2 Edit `bin/cli.js`: wrap the entire 1056–1106 block (`if (!bmadInstalled) { ... } else { ... }`) with a single outer guard:
  ```js
  if (bmadTools.length > 0) {
    // existing if (!bmadInstalled) { ... } else { ... } block
  }
  ```
- [ ] 2.3 Edit `bin/cli.js`: remove the four inline `const bmadTools = ...` declarations at the original call sites (lines ~1059, ~1074, ~1084, ~1099) — they are now redundant since `bmadTools` is hoisted
- [ ] 2.4 Verify that the `else` / continuation logic (if any) after the BMAD block is unaffected
- [ ] 2.5 Run `node bin/cli.js --help` — confirm CLI still loads with no syntax errors

### Task 3: Add test for the call-site guard (AC: 5)

- [ ] 3.1 Add a new test to `test/build-bmad-args.test.js` or a new `test/bmad-empty-tools-guard.test.js` titled "Call-site guard: empty bmadTools skips invocation"
- [ ] 3.2 Write a test that uses mock/spy on the bmad module functions to verify that when no IDE agents are in `selectedAgentIds`, neither `bmad.installBmad` nor `bmad.updateBmad` is called
  - Do NOT modify `buildBmadArgs()` itself — the guard is at the caller in `bin/cli.js`
  - Use spy/mock patterns on `bmad.installBmad` and `bmad.updateBmad` directly
- [ ] 3.3 Confirm the existing test at line 87 of `test/build-bmad-args.test.js` ("buildBmadArgs uses --tools none when no tools selected") still passes — `buildBmadArgs()` itself is unchanged; the guard is at the caller

### Task 4: Run test suite (AC: 3, 4, 5)

- [ ] 4.1 Run `npm test` — all tests must pass (exit 0)
- [ ] 4.2 Confirm the new test passes
- [ ] 4.3 Confirm existing `build-bmad-args.test.js` tests are all green (especially the `--tools none` tests — they test `buildBmadArgs()` behavior, not the call-site guard)

## Dev Notes

### What this story does NOT change

- `lib/bmad.js` — `buildBmadArgs()` is unchanged. It still produces `--tools none` when `tools` is empty or undefined. That behavior is correct for unit tests of the function itself. The fix is upstream of this call.
- `lib/bmad.js` line 609 — the problematic line `parts.push('--tools', ctx.tools && ctx.tools.length > 0 ? ctx.tools.join(',') : 'none')` is intentionally left as-is. Changing it would break the contract of `buildBmadArgs()` (it must always emit `--tools`). The correct fix is to never call `buildBmadArgs()` at all when the user has selected zero tools.

### Why the guard is at the call site

The root cause of the bug is that `bin/cli.js` calls `buildBmadArgs()` and then spawns the bmad-method child process even when `bmadTools` is empty. The user never selected any IDE agent tools. In this case, there is nothing for bmad-method to install — skipping the invocation entirely is the correct behavior. Adding a guard inside `buildBmadArgs()` would be the wrong layer; `buildBmadArgs()` is a pure function that constructs a command string from a context object. It does not decide whether to invoke bmad-method.

### Key files and locations

- **`bin/cli.js`** lines 1056–1106 — BMAD install/update flow. The correct fix is:
  1. Hoist `bmadTools` to a single declaration after line 1051 (`const bmadInstalled = bmad.isBmadInstalled();`)
  2. Wrap the entire lines 1056–1106 block with `if (bmadTools.length > 0) { ... }`
  3. Remove the 4 inline `const bmadTools = ...` declarations at lines ~1059, ~1074, ~1084, ~1099 (they become redundant)
- **`lib/bmad.js`** line 609 — `parts.push('--tools', ...)` — do NOT change this line.
- **`test/build-bmad-args.test.js`** or **`test/bmad-empty-tools-guard.test.js`** — add the call-site guard test; mock/spy `bmad.installBmad` and `bmad.updateBmad` directly to assert neither is called when `selectedAgentIds` contains no IDE agents.

### Files to Change

**`bin/cli.js`** — the change pattern is:

```
// BEFORE (current structure, lines 1039–1106):
if (installScope === 'project') {
  const bmadToolsFilter = agents.filter(a => a.category === 'ide').map(a => a.id);
  // ... (yesFlag unsupported warnings, lines 1042–1050)
  const bmadInstalled = bmad.isBmadInstalled();            // line 1051
  if (!bmadInstalled) {                                    // line 1056
    if (yesFlag) {
      const bmadTools = selectedAgentIds.filter(...).map(...);  // ← inline, line 1059
      const success = await bmad.installBmad(['bmm'], bmadTools);
    } else {
      // prompts ...
      if (installBmad) {
        const bmadTools = selectedAgentIds.filter(...).map(...);  // ← inline, line 1074
        const success = await bmad.installBmad(['bmm'], bmadTools);
      }
    }
  } else {                                                 // line 1081
    if (yesFlag) {
      const bmadTools = selectedAgentIds.filter(...).map(...);  // ← inline, line 1084
      const success = await bmad.updateBmad(['bmm'], bmadTools);
    } else {
      // prompts ...
      if (updateBmad) {
        const bmadTools = selectedAgentIds.filter(...).map(...);  // ← inline, line 1099
        const success = await bmad.updateBmad(['bmm'], bmadTools);
      }
    }
  }                                                        // line 1106
}

// AFTER (corrected structure):
if (installScope === 'project') {
  const bmadToolsFilter = agents.filter(a => a.category === 'ide').map(a => a.id);
  // ... (yesFlag unsupported warnings)
  const bmadInstalled = bmad.isBmadInstalled();
  const bmadTools = selectedAgentIds.filter(id => bmadToolsFilter.includes(id)).map(id => getBmadPlatformCode(id));  // ← HOISTED
  if (bmadTools.length > 0) {                              // ← NEW OUTER GUARD
    if (!bmadInstalled) {
      if (yesFlag) {
        // bmadTools already in scope — no redeclaration
        const success = await bmad.installBmad(['bmm'], bmadTools);
      } else {
        // prompts ...
        if (installBmad) {
          // bmadTools already in scope — no redeclaration
          const success = await bmad.installBmad(['bmm'], bmadTools);
        }
      }
    } else {
      if (yesFlag) {
        // bmadTools already in scope — no redeclaration
        const success = await bmad.updateBmad(['bmm'], bmadTools);
      } else {
        // prompts ...
        if (updateBmad) {
          // bmadTools already in scope — no redeclaration
          const success = await bmad.updateBmad(['bmm'], bmadTools);
        }
      }
    }
  }  // end if (bmadTools.length > 0)
}
```

### Existing test that must remain passing

Line 87 of `test/build-bmad-args.test.js`:
```js
test('buildBmadArgs uses --tools none when no tools selected', () => {
  const result = bmad.buildBmadArgs({
    projectRoot: '/test',
    modules: ['bmm'],
    tools: [],
    action: 'install',
  });
  assert.ok(result.includes('--tools none'), `Expected --tools none in: ${result}`);
});
```
This test documents the contract of `buildBmadArgs()` — it SHOULD still pass after this story, because we are not changing `buildBmadArgs()`.

### New test to add (sketch)

```js
// ---- Story 25.1: Call-site guard — empty bmadTools must not invoke installBmad/updateBmad ----

console.log('\nStory 25.1: Call-site guard for empty bmadTools');

test('installBmad is not called when bmadTools is empty', () => {
  // Spy on bmad.installBmad and bmad.updateBmad.
  // Simulate the hoisted guard logic: only enter the install/update block if bmadTools.length > 0.
  let installCalled = false;
  let updateCalled = false;
  const origInstall = bmad.installBmad;
  const origUpdate = bmad.updateBmad;
  bmad.installBmad = async (...args) => { installCalled = true; return origInstall(...args); };
  bmad.updateBmad  = async (...args) => { updateCalled  = true; return origUpdate(...args);  };

  const bmadTools = [];  // no IDE agents selected
  if (bmadTools.length > 0) {
    // This block must NOT be entered
    bmad.installBmad(['bmm'], bmadTools);
  }

  bmad.installBmad = origInstall;
  bmad.updateBmad  = origUpdate;
  assert.strictEqual(installCalled, false, 'installBmad must NOT be called when bmadTools is empty');
  assert.strictEqual(updateCalled,  false, 'updateBmad must NOT be called when bmadTools is empty');
});

test('installBmad IS called when bmadTools is non-empty', () => {
  let installCalled = false;
  const origInstall = bmad.installBmad;
  bmad.installBmad = async (...args) => { installCalled = true; return Promise.resolve(true); };

  const bmadTools = ['claude-code'];
  if (bmadTools.length > 0) {
    bmad.installBmad(['bmm'], bmadTools);
  }

  bmad.installBmad = origInstall;
  assert.strictEqual(installCalled, true, 'installBmad MUST be called when bmadTools is non-empty');
});
```

### PRD Traceability

- **FR196:** The ma-agents npm package bundles bmad-method as a direct dependency; fresh installs with zero tools must not fail
- **FR197:** The BMAD install step is a no-op when no IDE agent tools are selected
- **NFR55:** No silent failures — skipping BMAD invocation when bmadTools is empty is the expected behavior

### What this story does NOT do

- Does NOT bump bmad-method version (Story 25.2)
- Does NOT change the bmad-cache (Story 25.2)
- Does NOT change `buildBmadArgs()` function behavior
- Does NOT add new CLI flags or user-visible output

## Change Log

| Date | Version | Author | Description |
|------|---------|--------|-------------|
| 2026-05-01 | 1.0.0 | (pending) | Story drafted as part of Epic 25 planning (Stage 3) |
| 2026-05-01 | 1.0.1 | (stage-3-fix) | Correction 1: line range updated 1056–1085 → 1056–1106; Correction 2: guard approach corrected — hoist bmadTools + single outer guard; remove 4 inline declarations |
| 2026-05-01 | 1.1.0 | Claude Code | Implementation complete: hoisted bmadTools declaration, wrapped install/update block with `if (bmadTools.length > 0)` guard, added test/bmad-empty-tools-guard.test.js (4 tests, all pass). Pre-existing routing-parity test failures (4) confirmed unrelated to this story. |

## Completion Note

Implementation completed 2026-05-01. Changes applied to `bin/cli.js` lines 1051-1107: `bmadTools` declaration hoisted to line 1052, entire install/update block wrapped with `if (bmadTools.length > 0)`, four redundant inline `const bmadTools` declarations removed. New test file `test/bmad-empty-tools-guard.test.js` added with 4 passing tests. All Story 25.1 acceptance criteria met.
