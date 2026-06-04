---
type: bug
severity: medium
title: Local-path repo layout creates nested _bmad-output/<…>-artifacts/ inside user-supplied folder
---

# Bug: Local-path repo layout creates nested _bmad-output/<…>-artifacts/ inside user-supplied folder

**Severity:** medium
**Affected Component:** ma-agents repo-layout wizard / config writer (bin/cli.js writeRepoLayoutConfig)

## Reproduction Steps

1. Run `npx ma-agents@3.12.2 install` in a fresh project.
2. When asked "Where is your knowledgebase managed?", pick **Local path**.
3. Enter a path you intend to use as the knowledgebase folder (e.g. `D:\foo\planning`).
4. Complete the rest of the wizard.
5. Inspect `_bmad/bmm/config.yaml` — observe `planning_artifacts: "D:/foo/planning/_bmad-output/planning-artifacts"`.
6. Inspect the filesystem — observe that bmad-method created `D:\foo\planning\_bmad-output\planning-artifacts\` inside the user-supplied folder.

## Expected Behavior

The user-supplied path IS the artifacts folder. No nested `_bmad-output/planning-artifacts/` subtree should be created inside it. After the wizard completes:

- `_bmad/bmm/config.yaml` contains `planning_artifacts: "D:/foo/planning"` (literal).
- bmad-method creates planning artifacts directly at `D:\foo\planning\<artifact>.md` going forward.

The wizard prompt phrasing — *"Where is your knowledgebase managed?"* + *"Enter local path for knowledgebase:"* — implies the answer is the literal location, not a parent of generated structure.

## Actual Behavior

`bin/cli.js writeRepoLayoutConfig` (lines 519, 532, 533 in 3.12.2) appended `/_bmad-output/planning-artifacts` (and `/_bmad-output/implementation-artifacts` for sprint management) to any non-`.` path:

```js
const planningArtifacts = kbPath === '.' ? '_bmad-output/planning-artifacts' : `${kbPath}/_bmad-output/planning-artifacts`;
const implArtifacts = spPath === '.' ? '_bmad-output/implementation-artifacts' : `${spPath}/_bmad-output/implementation-artifacts`;
```

This forced a nested directory tree inside the user-supplied folder, contradicting the prompt's apparent meaning.

## Root Cause Hypothesis

The original Epic 16 multi-repo design treated the user-supplied path as a **project-root-equivalent** for the external knowledgebase repo, expecting the canonical `_bmad-output/...` layout to be reproduced inside it. But the wizard prompt was never updated to surface that interpretation, so users (reasonably) read the prompt as "this folder IS the planning artifacts folder". Implementation drifted from prompt phrasing.

## Affected Files

- bin/cli.js (writeRepoLayoutConfig, collectLocalPath)
- test/cross-repo-validation.test.js
- test/portable-paths.test.js

## Suggested Fix

1. In `writeRepoLayoutConfig`, drop the `/_bmad-output/<…>-artifacts/` suffix when the path is non-`.`. Treat the user-supplied path as the literal artifacts directory:
   ```js
   const planningArtifacts = kbPath === '.' ? '_bmad-output/planning-artifacts' : kbPath;
   const implArtifacts = spPath === '.' ? '_bmad-output/implementation-artifacts' : spPath;
   ```
2. In `collectLocalPath`, clarify the prompt text so the contract is explicit: *"this is the literal folder; no extra subdirectories will be created"*.
3. Same-repo (mode `same`, path `.`) continues to use the canonical `_bmad-output/...` layout — no change to existing same-repo installs.
4. Update `cross-repo-validation.test.js` and `portable-paths.test.js` to expect literal paths.
5. Document the breaking change for existing multi-repo users in CHANGELOG migration notes.

## Status

review

## Implementation Notes

- The change is **breaking for existing multi-repo installs** that already wrote `<kbPath>/_bmad-output/planning-artifacts/` to `config.yaml` and committed artifacts there. Existing config files are not rewritten on upgrade — only new installs or layout-wizard re-runs pick up the new contract. Migration: move artifacts up one level and re-run `npx ma-agents config layout`.
- Same-repo case (`mode: same, path: .`) is intentionally unchanged because in single-repo mode there's no separate folder semantics to honor — `_bmad-output/...` at the project root is the established convention and reverting it would break existing single-repo installs.
- Prompt text wording matters: *"this is the literal folder; no extra subdirectories will be created"* is deliberately verbose so first-time users understand the contract before typing a path.

## Acceptance Criteria Status

- [x] AC1 — Local kb path produces `planning_artifacts: <path>` (literal) in `config.yaml`
- [x] AC2 — Local sprint mgmt path produces `implementation_artifacts: <path>` (literal)
- [x] AC3 — Same-repo (`mode: same`) preserves the canonical `_bmad-output/...` layout
- [x] AC4 — Wizard prompt text reflects the literal-folder contract
- [x] AC5 — Existing tests updated to match new contract; full test suite passes for affected files

## File List

- `bin/cli.js` — dropped suffix concatenation in `writeRepoLayoutConfig`; updated `collectLocalPath` prompt text
- `test/cross-repo-validation.test.js` — assertions updated for literal path expectation
- `test/portable-paths.test.js` — assertion updated for literal portable path expectation

## Change Log

- 2026-05-08 (3.12.3): Local-path repo layout no longer creates a nested `_bmad-output/<…>-artifacts/` subtree inside user-supplied folders. The path provided in the wizard is now the literal artifacts directory.

## Notes

- Created via `create-bug-story` workflow (manual file creation; bug surfaced from a user report after 3.12.2 install on a multi-repo layout)
- Discoverable by sprint workflows via glob: `_bmad-output/implementation-artifacts/bug-*.md`
