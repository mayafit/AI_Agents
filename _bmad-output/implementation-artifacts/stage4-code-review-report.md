# Stage 4 Code Review Report — Epic 25 (v6.6.0 Integration)
Date: 2026-05-01
Reviewer: Code Review Agent

---

## Story 25.1 — Guard Review

**Verdict: NEEDS FIX**

### Findings

**PASS — `bmadTools` hoisted correctly.**
`bmadTools` is declared as a single `const` at line 1052, before the `if (bmadTools.length > 0)` guard at line 1058. The expression is identical to what was previously computed inline at each of the four original call sites:
```js
selectedAgentIds.filter(id => bmadToolsFilter.includes(id)).map(id => getBmadPlatformCode(id))
```
No semantic drift from the inline form.

**PASS — No duplicate `const bmadTools` declarations.**
`grep` over `bin/cli.js` confirms `bmadTools` appears exactly once as a declaration (line 1052) and four more times as references (lines 1062, 1076, 1085, 1099). There are no residual inline `const bmadTools = ...` declarations.

**PASS — `isBmadInstalled()` ordering.**
`bmadInstalled` is assigned at line 1051, `bmadTools` at line 1052, guard at line 1058. Both are computed before the guard. Correct.

**PASS — Outer guard wraps entire install/update block.**
Lines 1058–1106 form one `if (bmadTools.length > 0) { ... }` block that encloses both the `!bmadInstalled` branch (fresh install) and the `else` branch (update), in both the `yesFlag` and interactive sub-paths. No logic is orphaned outside the guard.

**PASS — Happy-path behavior unchanged.**
When `bmadTools.length > 0`, execution falls into the same logic tree that existed before (with identical calls to `installBmad` and `updateBmad`). No accidental indentation shifts or missing calls were found.

**FAIL — Guard comment is adequate but the test file is NOT included in the npm test script.**
The inline comment at line 1057 (`// v6.6.0: --tools none is rejected for fresh installs; skip BMAD entirely when no IDE tools selected.`) adequately explains the reason. However, `test/bmad-empty-tools-guard.test.js` is absent from the `"test"` script in `package.json`. The new test file will never run in CI.

---

## Story 25.2 — Version Bump Review

**Verdict: PASS**

### Findings

**PASS — `package.json` pins `bmad-method` at exact `6.6.0`.**
```json
"bmad-method": "6.6.0"
```
No caret, no tilde. Confirmed at line 33 of `package.json`.

**PASS — `lib/bmad.js` `BMAD_TARGET_VERSION` is `6.6.0`.**
Line 1530: `const BMAD_TARGET_VERSION = '6.6.0';`

**PASS — `test/bmad-version-bump.test.js` has no residual `6.5.0` references.**
All version assertions target `6.6.0`. The test title, inline comments, and `assert.strictEqual` calls are consistent. The file header documents the lineage correctly: "originally authored for Story 15.1 (6.2.2), rewritten for Story 22.1 (6.3.0), updated for Story 24.1 (6.6.0)." (The story attribution in the header reads "Story 24.1" rather than "Story 25.2", which is a minor documentation inaccuracy, not a correctness defect — the test body is correct for 6.6.0.)

**PASS — `buildBmadArgs()` in `lib/bmad.js` is unchanged.**
The function passes `--tools none` when the tools array is empty. This is the exact behavior that motivated the Story 25.1 guard — `buildBmadArgs` itself is correct; it is the call site that must not invoke it with an empty tools list. The guard in `bin/cli.js` is the right layer.

---

## Security Assessment

No security concerns. The guard is purely a skip-or-proceed boolean check on a derived array length. There is no user-controlled input path that could manipulate `bmadTools` to bypass the guard — it is derived from `selectedAgentIds` filtered against a statically computed `bmadToolsFilter` from the agent registry. No injection risk introduced.

---

## Overall Verdict

**REQUEST CHANGES**

One blocking issue must be resolved before merge.

---

## Required Actions Before Merge

### BLOCKING — Add `bmad-empty-tools-guard.test.js` to the test script in `package.json`

The new test file at `test/bmad-empty-tools-guard.test.js` is not referenced in the `"test"` script in `package.json`. As a result the guard logic has zero CI coverage and the tests will never run.

**Exact fix required** — in `package.json`, append the new test file to the end of the existing `"test"` script value:

```
&& node test/bmad-empty-tools-guard.test.js
```

The final entry in the test chain currently ends with `node test/obsolete-tool-dirs.test.js`. The new entry should be appended after it:

```
... && node test/obsolete-tool-dirs.test.js && node test/bmad-empty-tools-guard.test.js
```

### NON-BLOCKING — Minor doc inaccuracy in `bmad-version-bump.test.js` header

The file header still attributes the test to "Story 24.1" in the title and JSDoc comment block (`updated for Story 24.1 (6.6.0)`). This should reference Story 25.2. This does not affect correctness and can be fixed at discretion.
