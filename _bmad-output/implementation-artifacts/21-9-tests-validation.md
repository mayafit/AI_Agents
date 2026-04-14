# Story 21.9: Tests and Validation

Status: backlog

## Story

As a **chief architect**,
I want automated regression tests for the profile system and the universal/on-prem instruction-block injection,
So that future changes to installer or templates do not silently regress on-prem support or break standard installs.

## Acceptance Criteria

1. A consolidated integration test file `test/onprem-injection.test.js` exists covering the cross-story Epic 21 contracts that per-story tests do not own:
   - **(a) NFR44 — standard profile cleanliness:** A full standard-profile install on a fresh project produces zero occurrences of the strings `/no_think`, `str_replace_editor`, `~/.claude/`, or `Never create files in` (the on-prem rule prefix) across all generated instruction files (`CLAUDE.md`, `.clinerules`, `.cline/clinerules.md`, `.roo/rules/00-ma-agents.md`, `AGENTS.md`, `.roomodes`).
   - **(b) On-prem profile completeness:** A full on-prem-profile install produces all on-prem strings in the expected files (`.roomodes` `customInstructions`, `AGENTS.md`, `.clinerules`, `CLAUDE.md` injection block).
   - **(c) NFR46 — idempotency:** Two consecutive installs with the same profile produce byte-identical content within ma-agents-owned regions (marker blocks for markdown files, owned slugs for `.roomodes`) across all per-tool files.
   - **(d) `.roomodes` slug-collision behavior:** Pre-existing user-defined `customModes` with non-conflicting slugs are preserved through reinstall; conflicting slugs are overwritten with a console warning naming the slug.
   - **(e) NFR47 enforcement contract:** The four ma-agents BMAD modes' `fileRegex` patterns reject the expected code-file extensions and accept the expected planning-file extensions. `bmad-architect` regex matrix tested against `.ts`, `.py`, `.js`, `.go` (rejected) and `.md`, `.xml`, `.drawio` (accepted). Same shape of test for `bmad-pm`, `bmad-techlead`.
   - **(f) Profile switch round-trip:** Install standard → switch to on-prem (via the Story 21.10 reconfigure command, or — until 21.10 lands — by editing `.ma-agents.json` directly and re-running install) → switch back to standard. Final state must match the original standard install (byte-identical for ma-agents-owned regions). User content outside markers preserved across all switches.
2. The full test suite (`npm test`) passes after Story 21.9 — no regressions in any pre-Epic-21 tests.
3. A short test-coverage table is added to the PR body listing each Epic 21 NFR (44, 45, 46, 47) and the test(s) that cover it. Any uncovered NFR is flagged as an open issue, not silently shipped.
4. The integration tests use temporary directories (`fs.mkdtempSync(os.tmpdir() + ...)` per test) to avoid touching the repo's own `.ma-agents.json` or instruction files.
5. **Standard-profile baseline fixture (byte-for-byte).** Commit `test/fixtures/standard-profile-baseline/` containing the expected byte-for-byte generated output for a canonical `npx ma-agents install --yes` run against a canonical empty-project fixture (also committed under `test/fixtures/empty-project/`). At a minimum the baseline fixture includes the rendered `CLAUDE.md`, `.clinerules`, `.roo/rules/00-ma-agents.md`, `AGENTS.md`, `.roomodes`, and `.ma-agents.json`. The test harness runs the installer against a scratch temp dir seeded with the empty-project fixture and diffs the result against this baseline byte-for-byte. Any drift in universal-block content, template rendering, or `.roomodes` rendering surfaces as a test failure pointing at the exact file and diff region. This replaces the vague "diff against pre-Epic-21 baseline" language in NFR44 with a concrete, version-controlled artifact.
6. **End-to-end installer harness (exercises the actual binary).** The test harness at `test/onprem-injection.test.js` (or a sibling file) exercises the actual installer entry point (`node bin/cli.js install --yes` via `child_process.spawnSync` or equivalent, OR a direct programmatic call to the exported top-level install function that matches what the CLI does — no internal-only helpers) against a scratch tmpdir for BOTH profiles (`standard` and `on-prem`), snapshots the generated filesystem tree, and diffs it against per-profile fixtures (`test/fixtures/standard-profile-baseline/` for standard, `test/fixtures/onprem-profile-baseline/` for on-prem). This is distinct from — and additional to — unit-level template-rendering tests. Unit tests can pass while end-to-end install breaks (wiring bugs, file-path bugs, profile-resolution bugs); this AC closes that gap.

## Tasks / Subtasks

- [ ] Task 1: Create `test/onprem-injection.test.js` per AC #1 (a)–(f)
  - [ ] 1.1 Helper: scaffold a fresh test project in a temp dir with all 7 markdown-injection agents + Roo Code + OpenCode selected
  - [ ] 1.2 Helper: run the installer programmatically (not via CLI subprocess if possible — call exported `installSkill` with profile option)
  - [ ] 1.3 Helper: read all generated instruction files and return as `{ filename → content }` map
  - [ ] 1.4 Test (a): standard install — assert no on-prem strings anywhere
  - [ ] 1.5 Test (b): on-prem install — assert on-prem strings present in expected files
  - [ ] 1.6 Test (c): idempotency — two installs, byte-equal content
  - [ ] 1.7 Test (d): `.roomodes` slug-collision matrix
  - [ ] 1.8 Test (e): `fileRegex` accept/reject matrix for all 4 BMAD modes
  - [ ] 1.9 Test (f): standard → on-prem → standard round-trip
- [ ] Task 2: Run full `npm test` — verify no regressions (AC #2)
- [ ] Task 3: PR body coverage table (AC #3)
  - [ ] 3.1 Tabulate NFR44, NFR45, NFR46, NFR47 → covering test name(s)
  - [ ] 3.2 Confirm NFR45 (CI/CD compatibility) is covered by `test/profile.test.js` (Story 21.1) tests for `--yes` defaulting and persisted-value precedence (no CLI flag exists)
- [ ] Task 4: Commit baseline fixtures (AC #5)
  - [ ] 4.1 Create `test/fixtures/empty-project/` — minimal canonical project seed (README.md, package.json, nothing else that affects install output)
  - [ ] 4.2 Generate and commit `test/fixtures/standard-profile-baseline/` by running the installer once against the empty-project fixture with `--yes` (standard profile) and capturing all generated files
  - [ ] 4.3 Generate and commit `test/fixtures/onprem-profile-baseline/` via the same pattern with profile=on-prem persisted in `.ma-agents.json`
  - [ ] 4.4 Document regeneration procedure in a `test/fixtures/README.md` so future dev knows how to refresh when templates intentionally change
- [ ] Task 5: End-to-end installer harness (AC #6)
  - [ ] 5.1 Harness scaffolds a scratch tmpdir, copies the `empty-project` fixture into it, and invokes the installer entry point for each profile
  - [ ] 5.2 After each install, walk the scratch dir and diff every file against the corresponding baseline fixture; any diff is a test failure naming the file and showing the diff hunk
  - [ ] 5.3 Run for both `standard` and `on-prem` profiles sequentially (not in parallel — shared template files)

## Dev Notes

### Architecture Compliance

- **Decision P3-3** — This story closes the testing gap for cross-story contracts. Per-story tests cover their own scope; this story covers integration-level NFRs.
- **NFR44, NFR45, NFR46, NFR47** — explicit coverage required.

### Source Tree Components to Touch

| File | Change |
|------|--------|
| `test/onprem-injection.test.js` | CREATE |

### Dependencies

- Stories 21.1 through 21.8 all merged.

### Out of Scope

- Adding new per-story unit tests (those are owned by their respective stories)
- Performance benchmarks
- Manual QA scripts

### Notes on Test Isolation

The existing `test/generate-project-context.test.js` (from Epic 13) used `Promise.all` and hit a race because two tests temporarily renamed the template file. Run `test/onprem-injection.test.js` tests sequentially (`for...of` with `await`) — never parallel — because they share template files and depend on full-install state.

## Dev Agent Record

### Agent Model Used
_(to be filled by dev agent)_

### Debug Log References
_(to be filled)_

### Completion Notes List
_(to be filled)_

### File List
_(to be filled)_

## Change Log
- 2026-04-14: Story created (Epic 21, Story 21.9)
- 2026-04-14: Removed prescriptive `--profile=` flag references from test (f) description and Task 3.2 (flag retired; profile switch deferred to Story 21.10 reconfigure). Aligned with P0 spec-alignment PR #34.
- 2026-04-14: Added ACs #5 and #6 for standard-profile byte-for-byte fixture baseline and end-to-end installer harness (Findings #14, #18, corrective plan step 3). Replaces the vague "diff against pre-Epic-21 baseline" language in NFR44 with concrete committed fixtures and a harness that exercises the actual installer entry point, not just template-rendering internals.
- 2026-04-14: E2E fixture scaffolding committed (corrective-plan step 7): `test/fixtures/empty-project/` seed, placeholder baseline dirs, pending `test/onprem-injection.test.js` harness (exits 0 until Story 21.9 implementation), regeneration README. Baselines are captured by Story 21.9 implementation per `test/fixtures/README.md`.
