# Stage 3 Review Report — Stories 25.1 & 25.2
Date: 2026-05-01

---

## Story 25.1 Review

**Verdict: NEEDS FIX**

### Findings

#### Finding 1 (Minor inaccuracy — line range): bin/cli.js BMAD block extends past line 1085

The story states the BMAD install/update flow is at "lines 1056–1085". The actual block spans lines 1056–1106:

- Fresh-install branch (`!bmadInstalled`): lines 1056–1080
- Update branch (`bmadInstalled`): lines 1081–1106

Line 1085 is inside the `yesFlag` sub-branch of the update path; the interactive update sub-branch (`prompts()` → `if (updateBmad)`) extends through line 1106. The developer must guard the full block, not just up to 1085, or they will miss the interactive update path.

**Correction:** Replace "lines 1056–1085" with "lines 1056–1106" wherever the story references this range (Tasks 1.1, 1.2, Dev Notes).

#### Finding 2 (Structural nuance — important for correct implementation): `bmadTools` is declared inside each spawn sub-block, not before the outer `if (!bmadInstalled)` guard

The story instructs the developer to "wrap the fresh-install BMAD invocation block with `if (bmadTools.length > 0)`". This implies `bmadTools` exists before the wrap point. In the actual code, `bmadTools` is computed *inside* each invocation block:

```js
// Fresh-install, --yes path (line 1059):
const bmadTools = selectedAgentIds.filter(id => bmadToolsFilter.includes(id)).map(...);
const success = await bmad.installBmad(['bmm'], bmadTools);

// Fresh-install, interactive path (line 1074):
const bmadTools = selectedAgentIds.filter(id => bmadToolsFilter.includes(id)).map(...);
const success = await bmad.installBmad(['bmm'], bmadTools);
```

There are **four** invocation sites (two for install, two for update: one under `yesFlag`, one under `prompts()`). The guard cannot simply wrap the outer `!bmadInstalled` block with `if (bmadTools.length > 0)` because `bmadTools` is not in scope at that level.

**Correct implementation approach:** The guard must be placed after computing `bmadTools` at each call site, e.g.:

```js
const bmadTools = selectedAgentIds.filter(...).map(...);
if (bmadTools.length > 0) {
  const success = await bmad.installBmad(['bmm'], bmadTools);
  ...
}
```

This must be done at all four call sites. The story's current framing ("wrap the entire spawn block") is misleading and will lead to a `ReferenceError` if taken literally for the outer guard approach.

**Correction:** Tasks 1.2, 2.1, and 2.2 must be updated to describe guarding at the call site *after* computing `bmadTools`, and must note that there are four call sites (not two as implied — `yesFlag` and interactive paths, for both install and update).

#### Finding 3 (Test quality — minor): Proposed new test in Task 3 tests a local variable, not the actual CLI flow

The new test sketch (Dev Notes "New test to add") simulates the guard logic inline (`if (bmadTools.length > 0) { bmad.buildBmadArgs(...) }`) rather than exercising `bin/cli.js`. It verifies that the test author's inline guard works, not that the guard was actually placed in `cli.js`. This is acknowledged in the story ("Simulate the call-site guard logic directly") but weakens the AC 5 coverage.

This is not a blocker — the story explicitly allows this approach — but the developer should be aware the test does not provide regression protection against the guard being removed from `cli.js` in the future. **Not a required fix**, but recommended to note.

#### Finding 4 (Accurate): lib/bmad.js line 609

Confirmed accurate. Line 609 reads:
```js
parts.push('--tools', ctx.tools && ctx.tools.length > 0 ? ctx.tools.join(',') : 'none');
```
The story's instruction to leave this line unchanged is correct.

#### Finding 5 (Accurate): test/build-bmad-args.test.js line 87

Confirmed accurate. The `buildBmadArgs uses --tools none when no tools selected` test is at line 87 exactly as stated.

### Required Fixes Before Dev

1. Update line range "1056–1085" → "1056–1106" in Tasks 1.1, 1.2, and Dev Notes.
2. Revise Tasks 1.2, 2.1, 2.2 to describe the guard placement at four call sites (after each `const bmadTools = ...` line), not as an outer block wrap.

---

## Story 25.2 Review

**Verdict: READY**

### Findings

#### Finding 1 (Accurate): Current bmad-method pin is 6.5.0

`package.json` confirms `"bmad-method": "6.5.0"` (exact pin, no caret/tilde). Story baseline is correct.

#### Finding 2 (Accurate): BMAD_TARGET_VERSION location

`BMAD_TARGET_VERSION = '6.5.0'` is at line 1530 of `lib/bmad.js`. The story says "search for `BMAD_TARGET_VERSION` to find exact line" — correct; it does not claim a line number, which is appropriate given the constant's location could shift.

#### Finding 3 (Accurate): test/bmad-version-bump.test.js version pins

The file has multiple `6.5.0` assertions (lines 46, 48, 51, 55, 154, etc.). Story Task 3.1 correctly identifies this file as needing version updates from `6.5.0` → `6.6.0`.

#### Finding 4 (Accurate): build scripts confirmed

`package.json` scripts section confirms:
- `"build:bmad-cache": "node scripts/build-bmad-cache.js"` — matches Task 2.1.
- `"build:plugin": "node scripts/build-plugin.js"` — matches command sequence in Dev Notes.

#### Finding 5 (Important — confirmed coverage): plugin-manifests.test.js enforces strict equality between bmad_min_version and pinned bmad-method

The story mentions checking `test/plugin-manifests.test.js` for `bmad_min_version` assertions (Task 3.3). This is critical: the test at line 315 enforces `strictEqual(template.bmad_min_version, pinned)` — meaning if `package.json` is bumped to `6.6.0` without also updating `lib/bmad-extension/.claude-plugin/marketplace.json.template`, that test will fail. Story Task 5 already covers this (`marketplace.json.template` update). The sequencing is correct.

#### Finding 6 (Accurate): marketplace.json.template bmad_min_version

Confirmed: `lib/bmad-extension/.claude-plugin/marketplace.json.template` line 42 reads `"bmad_min_version": "6.5.0"`. Task 5.1 correctly targets this file.

#### Finding 7 (Minor gap — not a blocker): Story does not mention lib/bmad-extension/skills/module.yaml may not need version changes

Task 5.2 says to update a "schema version comment" in `lib/bmad-extension/skills/module.yaml`. This is a cosmetic comment update and does not affect test outcomes. If v6.6.0 does not change the schema comment convention, the developer may find nothing to change in that file. This is a low-risk task — skipping it if no relevant comment exists is fine. Not a required fix.

#### Finding 8 (Accurate): Dependency statement

Story correctly states it is blocked by Story 25.1 in the story header and in Dev Notes. The rationale (v6.6.0 stricter `--tools none` handling) is consistent with 25.1's fix.

---

## Overall Verdict

**FIX THEN PROCEED**

Story 25.1 has two required corrections before dev begins:
1. Line range 1056–1085 must be corrected to 1056–1106.
2. Task descriptions for applying the guard must clarify that there are four call sites and that the guard is placed after each local `bmadTools` computation, not as an outer block wrap around a scope where `bmadTools` does not yet exist.

Story 25.2 is ready for dev as written.

**Recommended action:** Apply the two corrections to Story 25.1, then both stories can proceed to development in order (25.1 → 25.2).

---

## Post-Review Fix Applied to Story 25.1 (2026-05-01)
- Correction 1: Line range updated to 1056–1106
- Correction 2: Guard approach corrected — hoist bmadTools + single outer guard; remove 4 inline declarations
Stage 3 Fix: COMPLETE
