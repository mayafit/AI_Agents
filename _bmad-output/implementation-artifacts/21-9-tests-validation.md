# Story 21.9: Tests and Validation

Status: Draft

### Blockers (why not Ready)

Tasks are NOT unconditional — they branch on upstream artifacts and surfaced gaps. Story is Draft until blockers below clear:

1. **Upstream artifacts not on disk.** Stories 21.2, 21.3, 21.4, 21.5, 21.6, 21.7, 21.8 are all **status: backlog** per sprint-status.yaml. Task 1.2–1.8 explicitly HALT this story when prerequisites are missing. Ready requires at minimum 21.2, 21.3, 21.4, 21.5, 21.6, 21.7 merged (21.8 is doc-only and soft; 21.10 is soft).
2. **AC #6 implementation-path conditional.** Round-trip test path branches on Story 21.10 availability (reconfigure subcommand vs. direct `.ma-agents.json` edit). Resolve once 21.10 status is known.
3. **Open question on Story 21.7 loader branch (A vs B).** BF-O baseline capture shape differs between Branch A (post-deploy rewrite) and Branch B (dual-variant files). Cannot finalize Task 4.3 fixture layout until 21.7 lands its Branch decision in its Change Log.
4. **Test Coverage Gaps requiring in-story absorption** (see Dev Notes → Test Coverage Gaps). The gaps tagged as in-story-closeable (21.4 AC #5 append branch, 21.4 AC #9 exception, 21.5 AC #2 cross-file identity, 21.5 AC #9 manifest-path substitution, 21.6 AC #12 cross-profile fileRegex equality, 21.7 AC #4/#8 deployed-customize coverage, 21.8 AC #8 README presence) must be folded into Tasks 2/3/4 or filed as follow-up bug stories before promoting to Ready.

## Story

As a **chief architect**,
I want automated regression tests for the profile system and the universal/on-prem instruction-block injection,
So that future changes to installer or templates do not silently regress on-prem support or break standard installs.

## Acceptance Criteria

Numbered ACs derive from the Epic 21 Story 21.9 spec (`_bmad-output/planning-artifacts/epics.md` lines 4132–4152). ACs flagged **(gap-fill)** are additions this story introduces to make the epic spec concretely testable — they do not contradict the epic, they operationalize it.

1. A test file `test/onprem-injection.test.js` exists and covers the five sub-cases called out in the epic (lines 4144):
   - **(a)** Standard profile produces NO occurrences of the explicit literal strings `["/no_think", "str_replace_editor", "~/.claude/"]` (EXHAUSTIVE negative assertion set) anywhere in generated instruction files, per Story 21.6 AC #4 scope narrowing — covers NFR44. Reasoning-mode and sampling-parameter prose (e.g., `temperature`, `top_p`) are NOT in this negative set; they are verified positive-side only under the on-prem profile in sub-test (b).
   - **(b)** On-prem profile produces BOTH the universal block content AND the on-prem block content in the expected target files (CLAUDE.md / `.roo/rules/00-ma-agents.md` / `.clinerules` / `.cline/clinerules.md` / `AGENTS.md` / `.roomodes` `customInstructions`).
   - **(c)** Idempotency — two consecutive installs with the same profile produce byte-identical marker-block content across all ma-agents-stamped files — covers NFR46.
   - **(d)** `.roomodes` slug-collision: the four ma-agents-owned slugs (`bmad-pm`, `bmad-architect`, `bmad-techlead`, `bmad-dev`) overwrite existing entries with the same slug; non-colliding user slugs are preserved byte-for-byte.
   - **(e)** NFR47 enforcement contract: the generated `.roomodes` `fileRegex` patterns reject `.ts` and `.py` paths under `bmad-architect`. The test asserts the regex pattern, not a running Roo Code process (per epic technical note, line 4152).

2. `test/profile.test.js` already exists (delivered by Story 21.1, verified at `D:\Code\agents\test\profile.test.js`); Story 21.9 confirms it covers: `getProfile`, `setProfile`, `resolveProfile` precedence (persisted > yes-default > null), persistence round-trip, and missing-file handling. If any of those are missing, this story adds them rather than creating a second file.

3. After Story 21.9 merges, `npm test` passes with all new tests green AND all pre-Epic-21 tests still green (epic AC, lines 4146–4149) — no regressions.

4. **(gap-fill)** The integration tests isolate the repo's own `.ma-agents.json` by operating exclusively in per-test temp directories via `fs.mkdtempSync(path.join(os.tmpdir(), 'ma-agents-21-9-'))`. The test run must NOT mutate `D:\Code\agents\.ma-agents.json` or any file at the repo root. Tests run sequentially (`for...of` with `await`), never `Promise.all`, because the installer writes shared template-derived files (see existing race in `test/generate-project-context.test.js` — lessons learned).

5. **(gap-fill)** `fileRegex` matrix (NFR47, AC (e) expansion). For each of the four BMAD modes the test asserts accept/reject behavior against a pinned path set so implementation drift in the regex is caught:
   - `bmad-pm`: accepts `.md`; rejects `.ts`, `.py`, `.js`, `.go`, `.yaml`, `.json`, `.xml`, `.drawio`
   - `bmad-architect`: accepts `.md`, `.xml`, `.drawio`; rejects `.ts`, `.py`, `.js`, `.go`, `.yaml`, `.json`
   - `bmad-techlead`: accepts `.md`, `.json`, `.yaml`, `.yml`; rejects `.ts`, `.py`, `.js`, `.go`, `.xml`, `.drawio`
   - `bmad-dev`: accepts all of the above (full access — no `fileRegex` restriction, or `.*` equivalent)

6. **(gap-fill)** Profile switch round-trip. The test performs: install with `profile=standard` → switch to `on-prem` (by rewriting `.ma-agents.json` directly in the temp dir and re-running the installer entry point — Story 21.10's `reconfigure` subcommand is a dependency for a non-workaround path, but this story must not block on 21.10) → switch back to `standard`. The final state's ma-agents-owned regions must be byte-identical to the first standard-profile install. User content outside markers is preserved across all three installs.

7. **(gap-fill)** The test harness exercises the installer via its actual programmatic entry point — the exported top-level install function reachable from `bin/cli.js` — NOT via internal-only helpers. Unit-level template rendering tests are allowed and encouraged but are ADDITIONAL to the end-to-end harness; they do not replace it. Rationale: unit tests pass while wiring bugs (profile resolution, file-path routing, merger dispatch) silently break end-to-end install.

8. **(gap-fill)** A per-profile baseline fixture lives under `test/fixtures/`:
   - `test/fixtures/empty-project/` — minimal canonical project seed (`README.md`, `package.json`, no other files that affect install output). Already present (placeholder — see Change Log 2026-04-14 entry); Story 21.9 implementation populates/refreshes it if empty.
   - `test/fixtures/standard-profile-baseline/` — full rendered output for a canonical `install --yes` run against `empty-project` with standard profile.
   - `test/fixtures/onprem-profile-baseline/` — same for on-prem profile (seeded via a pre-written `.ma-agents.json` with `"profile": "on-prem"`).
   The harness diffs every generated file against its baseline byte-for-byte; any drift is a test failure naming the file and diff region. A regeneration procedure is documented in `test/fixtures/README.md` (already present; verify it covers both profiles and is accurate).

9. **(gap-fill)** PR body coverage table (added to the PR, not the story file) tabulates each Epic 21 NFR (NFR44, NFR45, NFR46, NFR47) → the specific test name(s) asserting it. If any NFR is uncovered, the gap is filed as a bug story — not silently shipped.

> **Open question:** AC #6 (profile switch round-trip) assumes the installer entry point is re-runnable in-process and that writing a new `"profile"` value to `.ma-agents.json` between runs is sufficient to trigger the profile-dependent re-stamping. If Story 21.10's `reconfigure` is merged first, prefer calling it; otherwise document the direct-edit approach and flag Story 21.10 as the preferred path in the test comment.

> **Open question:** Does the `bmad-dev` mode spec permit `fileRegex: '.*'` or omit `fileRegex` entirely? Story 21.3 spec says "full access" but doesn't pin the YAML shape. Defer to the template produced by Story 21.3; if ambiguous at implementation time, prefer omission (more permissive, matches Roo Code default).

> **Open question:** NFR45 (CI/CD `--yes` default to `standard`; non-TTY silent default) is already covered by `test/profile.test.js` (Story 21.1). This story does not duplicate that coverage — it only cites it in the NFR coverage table (AC #9). Confirm with reviewer that this non-duplication is acceptable.

## Tasks / Subtasks

- [ ] **Task 1: Verify prerequisite artifacts exist on disk** (precondition for all subsequent tasks)
  - [ ] 1.1 Verify `D:\Code\agents\lib\profile.js` exists and exports `getProfile`, `setProfile`, `resolveProfile` (Story 21.1)
  - [ ] 1.2 Verify `D:\Code\agents\lib\templates\instruction-block-universal.template.md` exists (Story 21.2) — **(new)** as of epic plan; verify before writing tests that consume it
  - [ ] 1.3 Verify `D:\Code\agents\lib\templates\roomodes.template.yaml` and `D:\Code\agents\lib\merge\roomodes.js` exist (Story 21.3) — **(new)**
  - [ ] 1.4 Verify `D:\Code\agents\lib\templates\agents-md.template.md` exists (Story 21.4) — **(new)**
  - [ ] 1.5 Verify `D:\Code\agents\lib\templates\clinerules.template.md` exists (Story 21.5) — **(new)**
  - [ ] 1.6 Verify `D:\Code\agents\lib\templates\instruction-block-onprem.template.md` exists (Story 21.6) — **(new)**
  - [ ] 1.7 Verify the eight `D:\Code\agents\lib\bmad-customize\bmm-*.customize.yaml` files have the Story 21.7 fields (`phase:`, `on_prem_phase_prefix:`)
  - [ ] 1.8 Verify `D:\Code\agents\docs\deployment\vllm-nemotron.md` exists and `README.md` has the on-prem section (Story 21.8) — **(new)** doc
  - [ ] 1.9 If any prerequisite is missing, HALT this story and surface the gap to the dev lead rather than stubbing around it

- [ ] **Task 2: Author `D:\Code\agents\test\onprem-injection.test.js`** (AC #1 a–e, #4, #5)
  - [ ] 2.1 Scaffold helper: create temp project in `os.tmpdir()` seeded from `test/fixtures/empty-project/` with all markdown-injection agents + Roo Code + OpenCode selected
  - [ ] 2.2 Helper: run installer programmatically via the exported top-level install function (AC #7)
  - [ ] 2.3 Helper: read generated instruction files into a `{ filename → content }` map
  - [ ] 2.4 Sub-test (a): standard install — assert zero occurrences of on-prem strings
  - [ ] 2.5 Sub-test (b): on-prem install — assert on-prem strings present in each expected file
  - [ ] 2.6 Sub-test (c): idempotency — run installer twice, diff marker-block content byte-for-byte
  - [ ] 2.7 Sub-test (d): `.roomodes` slug-collision — seed pre-existing `.roomodes` with one colliding and one non-colliding slug, run installer, assert overwrite + preserve semantics
  - [ ] 2.8 Sub-test (e) expansion: `fileRegex` accept/reject matrix per AC #5 for all four BMAD modes
  - [ ] 2.9 Assert no writes to the repo-root `.ma-agents.json` — use tmp dirs only (AC #4)

- [ ] **Task 3: Profile switch round-trip** (AC #6)
  - [ ] 3.1 Test: install standard → overwrite `.ma-agents.json` profile field to `on-prem` → re-run install → overwrite back to `standard` → re-run install
  - [ ] 3.2 Assert final standard-profile output matches the first standard-profile output (ma-agents-owned regions only); assert user-content regions outside markers unchanged at every step

- [ ] **Task 4: Baseline fixtures** (AC #8)
  - [ ] 4.1 If `test/fixtures/empty-project/` is empty or stale, populate with canonical minimal seed (`README.md`, `package.json` with no install-affecting scripts)
  - [ ] 4.2 Generate `test/fixtures/standard-profile-baseline/` by running the installer against the empty-project seed with standard profile, capturing all generated files under the baseline dir
  - [ ] 4.3 Generate `test/fixtures/onprem-profile-baseline/` via the same pattern after persisting `"profile": "on-prem"` to `.ma-agents.json` in the temp project
  - [ ] 4.4 Verify `test/fixtures/README.md` documents the regeneration procedure for both profiles; update if outdated
  - [ ] 4.5 Harness walks generated tmp dir and diffs every file against the corresponding baseline; any diff fails the test naming the file + diff hunk

- [ ] **Task 5: End-to-end harness** (AC #7)
  - [ ] 5.1 Harness invokes the installer entry point once per profile (sequential, not parallel)
  - [ ] 5.2 Snapshots the generated filesystem tree
  - [ ] 5.3 Diffs against the committed per-profile baseline fixture

- [ ] **Task 6: Profile unit-test coverage audit** (AC #2)
  - [ ] 6.1 Read `D:\Code\agents\test\profile.test.js` and confirm it covers: missing-file `getProfile`, round-trip `setProfile`/`getProfile`, `resolveProfile` precedence (three cases), non-I/O property of `resolveProfile`
  - [ ] 6.2 If any coverage is missing, add the test(s) to the same file; do NOT create a parallel file

- [ ] **Task 7: Run full `npm test` and produce NFR coverage table** (AC #3, #9)
  - [ ] 7.1 `npm test` — must be green end-to-end
  - [ ] 7.2 Author the NFR44/NFR45/NFR46/NFR47 → test-name table for the PR body
  - [ ] 7.3 Confirm NFR45 is satisfied by `test/profile.test.js` `--yes` + persisted-precedence tests (no separate test required)

- [ ] **Task 8: Documentation touch-up**
  - [ ] 8.1 If `test/fixtures/README.md` does not already document "how to regenerate baselines when templates change intentionally," add that section
  - [ ] 8.2 No other docs modified by this story (Story 21.8 owns the on-prem README/docs surface)

## Dev Notes

### Architecture Compliance

- **Decision P3-3** (`_bmad-output/planning-artifacts/architecture.md` §P3-3) — this story closes the testing gap for cross-story contracts. Per-story unit tests cover their own scope; Story 21.9 covers integration-level NFRs.
- **NFR44** (profile isolation — standard profile emits no on-prem-specific strings): verified by AC #1 sub-test (a) and the standard-profile baseline fixture diff (AC #8).
- **NFR46** (stamping idempotency — two installs produce byte-identical marker content): verified by AC #1 sub-test (c).
- **NFR47** (Roo Code `fileRegex` application-layer enforcement): verified by AC #1 sub-test (e) + the AC #5 matrix. Per epic technical note (line 4152), this story verifies the *generated regex*, not a running Roo Code `FileRestrictionError`.
- **NFR18** (OpenCode JSON-merge additive-only): this story does NOT add new NFR18 coverage — existing `test/opencode-json-merge.test.js` owns that NFR. Story 21.9 cites NFR18 in the PR coverage table (AC #9) and confirms the on-prem profile injection into `opencode.json::instructions[]` does not introduce a regression via the end-to-end harness diff against the baseline fixture (Tasks 4, 5).

### Prior-Story Artifacts the Test Suite Depends On (must exist on disk)

This story's tests consume artifacts produced by every other Epic 21 story. Task 1 verifies each before any test is authored. If any is missing the story HALTs — the tests cannot be stubbed in isolation without producing false confidence.

| Source story | Artifact(s) | Expected path | Consumer in 21.9 |
|---|---|---|---|
| 21.1 | `lib/profile.js` (getProfile/setProfile/resolveProfile) | `D:\Code\agents\lib\profile.js` (verified present) | AC #2, all tmp-project setup |
| 21.1 | `test/profile.test.js` | `D:\Code\agents\test\profile.test.js` (verified present) | AC #2 |
| 21.2 | Universal instruction-block template | `lib/templates/instruction-block-universal.template.md` **(new — Story 21.2)** | AC #1 (a), (b); baseline fixtures |
| 21.2 | `composeInstructionBlock` in `lib/installer.js` | `D:\Code\agents\lib\installer.js` (verified present; function new) | Tasks 2, 5 |
| 21.3 | `.roomodes` template + YAML merger | `lib/templates/roomodes.template.yaml` **(new)**, `lib/merge/roomodes.js` **(new)** | AC #1 (d), (e); AC #5 matrix |
| 21.3 | Roo Code entry `extraInstructionTemplates` in agents.js | `D:\Code\agents\lib\agents.js` (verified present; field new) | Task 2.7 |
| 21.4 | `AGENTS.md` template | `lib/templates/agents-md.template.md` **(new)** | AC #1 (b); baseline |
| 21.5 | `.clinerules` template | `lib/templates/clinerules.template.md` **(new)** | AC #1 (b); baseline |
| 21.6 | On-prem instruction-block template | `lib/templates/instruction-block-onprem.template.md` **(new)** | AC #1 (a), (b); NFR44 |
| 21.7 | Per-persona `phase:` + `on_prem_phase_prefix:` in 8 customize YAMLs | `lib/bmad-customize/bmm-*.customize.yaml` (files verified present; fields new) | On-prem baseline fixture (customize output) |
| 21.8 | vLLM doc + README section | `docs/deployment/vllm-nemotron.md` **(new)**, `README.md` on-prem section (modify) | Not directly test-consumed — cited in PR coverage table |
| 21.10 | `ma-agents reconfigure` subcommand | `bin/cli.js` (verified; flag new), `lib/reconfigure.js` **(new)** | AC #6 preferred path; if unmerged, fall back to direct `.ma-agents.json` edit |
| 21.11 | (not a dependency of 21.9 tests) | — | — |

### Source Tree Components to Touch

| File | Change | Verified? |
|---|---|---|
| `D:\Code\agents\test\onprem-injection.test.js` | MODIFY (placeholder harness exists — see Change Log 2026-04-14; Story 21.9 populates it) | verified present (placeholder, currently exits 0) |
| `D:\Code\agents\test\profile.test.js` | VERIFY / augment only if coverage gaps found | verified present |
| `D:\Code\agents\test\fixtures\empty-project\` | MODIFY / populate if empty | verified present (directory) |
| `D:\Code\agents\test\fixtures\standard-profile-baseline\` | POPULATE with generated files | verified present (directory) |
| `D:\Code\agents\test\fixtures\onprem-profile-baseline\` | POPULATE with generated files | verified present (directory) |
| `D:\Code\agents\test\fixtures\README.md` | VERIFY / update regeneration procedure | verified present |
| `D:\Code\agents\lib\profile.js` | READ-ONLY | verified present |
| `D:\Code\agents\lib\installer.js` | READ-ONLY (consumed programmatically) | verified present |
| `D:\Code\agents\lib\agents.js` | READ-ONLY | verified present |
| `D:\Code\agents\lib\templates\project-context.template.md` | READ-ONLY reference pattern | verified present |
| `D:\Code\agents\lib\bmad-customize\*.customize.yaml` | READ-ONLY (8 files) | verified present |
| `D:\Code\agents\bin\cli.js` | READ-ONLY (entry point located; not modified) | verified present |
| `D:\Code\agents\docs\deployment\vllm-nemotron.md` | NOT TOUCHED (Story 21.8 owns) | **(new — Story 21.8)** |

Legend: **(new)** = file does not yet exist on disk; will be created by the owning story. Story 21.9 cannot proceed on any `(new)` artifact that is still missing when it runs.

### Library and Pattern References

- Test framework: use the same node-test / mocha-style harness already in use across `D:\Code\agents\test\`. Verify by reading one existing file first (`test/profile.test.js` is the closest peer) before picking a style.
- Temp-dir isolation: `fs.mkdtempSync(path.join(os.tmpdir(), 'ma-agents-21-9-'))` — mirror the pattern in `test/profile.test.js`.
- Never run tests in parallel (`Promise.all`) against the installer — pre-existing race documented in `test/generate-project-context.test.js` (Epic 13).
- Byte-for-byte diffing: use `fs.readFileSync(..., 'utf-8')` + strict equality, or `Buffer.compare` for binary-safe files. For directory diffs, walk recursively and sort entries for stable comparison.

### NFR Coverage Map (for PR body — AC #9)

| NFR | Covered by |
|---|---|
| NFR44 (profile isolation) | `test/onprem-injection.test.js` sub-test (a); `test/fixtures/standard-profile-baseline/` diff |
| NFR45 (CI/CD non-blocking) | `test/profile.test.js` (existing — Story 21.1) — `--yes` defaulting + persisted-precedence tests |
| NFR46 (stamping idempotency) | `test/onprem-injection.test.js` sub-test (c) |
| NFR47 (application-layer file restriction) | `test/onprem-injection.test.js` sub-test (e) + AC #5 matrix |
| NFR18 (OpenCode JSON-merge additive) | `test/opencode-json-merge.test.js` (existing) + end-to-end harness diff |

### Test Isolation Notes

The existing `test/generate-project-context.test.js` (Epic 13) used `Promise.all` and hit a race because two tests temporarily renamed the template file. Run all tests in `test/onprem-injection.test.js` sequentially (`for...of` with `await`). Each temp dir is created fresh per test and is not shared.

### Test Coverage Gaps (surfaced by 21.2–21.8 AC enumeration)

The per-upstream-story AC mapping in the Testing section identifies every AC from Stories 21.2 through 21.8. ACs flagged **GAP** below are NOT covered by a test authored in Story 21.9 and are either (a) owned by the upstream story's own unit tests (UNIT), (b) documentation content not amenable to automation, or (c) genuine coverage gaps that should be filed as follow-up items. Story 21.9's contract per AC #9 is to surface — not silently absorb — every such gap.

- **21.2 AC #2** (placeholder-shape contract) — UNIT (Story 21.2 author's unit test).
- **21.2 AC #3** (composer on-prem-missing-throws error path) — UNIT.
- **21.2 AC #9** (BMAD agent file missing-skip branch) — UNIT.
- **21.2 AC #10** (upgrade-safety hand-edit detection + backup format) — UNIT (21.2 owns the contract; 21.9 does not exercise the drift/backup path).
- **21.3 AC #3** (`extraInstructionTemplates` static-registry field) — UNIT.
- **21.3 AC #5** (pure-function `mergeRoomodes` contract) — UNIT.
- **21.3 AC #6** (console-warning text exact match) — partial in OIT sub-test (d); UNIT owns the warning-text assertion.
- **21.3 AC #13** (Roo Code not installed → no write) — UNIT.
- **21.4 AC #2** (AGENTS.md template static-text shape) — UNIT.
- **21.4 AC #4** (OpenCode `extraInstructionTemplates` registry field) — UNIT.
- **21.4 AC #5 (append-to-unmarkered-existing-file branch)** — GAP, potentially testable in OIT sub-test (b) variant; surface as follow-up if Story 21.4 UNIT does not cover.
- **21.4 AC #9 exception** (legitimate `~/.claude/` in AGENTS.md Critical Behavior Rules under on-prem) — GAP; add positive assertion in OIT sub-test (b) on-prem branch so NFR44 narrowing is provable.
- **21.4 AC #10** (path stamping precedence `_bmad/bmm/config.yaml` vs defaults) — UNIT.
- **21.4 AC #11** (upgrade-safety drift inheritance from 21.2) — UNIT.
- **21.4 AC #12** (`instructionFiles` unchanged) — UNIT.
- **21.5 AC #2** (cross-file byte-identity of Cline files by construction) — GAP; add `assert.strictEqual(fs.readFileSync('.cline/clinerules.md'), fs.readFileSync('.clinerules'))` to OIT sub-test (b) to close in-story.
- **21.5 AC #6** (`ClinerulesDualFileDriftError` error-path) — UNIT.
- **21.5 AC #9** (`{{MANIFEST_PATH}}` resolves to `.cline/skills/MANIFEST.yaml`) — GAP; add explicit grep assertion in OIT sub-test (b) to close in-story.
- **21.6 AC #3** (template placeholder-free shape) — UNIT.
- **21.6 AC #9** (persona-prefix scope-out assertion) — UNIT (implicit; 21.7 owns positive side).
- **21.6 AC #12** (fileRegex unchanged between standard and on-prem renders) — GAP; extend OIT sub-test (e) to run under both profiles and assert regex equality.
- **21.7 AC #4** (deployed-output presence of new YAML fields — OR stripped per Branch B) — verify during BF-O capture; if customize deployed output is not walked by the baseline diff, surface as gap.
- **21.7 AC #5** (warning on invalid `phase:` value) — UNIT.
- **21.7 AC #8** (idempotency of deployed customize files) — GAP; extend OIT sub-test (c) to include `_bmad/_config/agents/*.customize.yaml` in the byte-identity hash set, OR verify it is walked by BF-O diff.
- **21.7 AC #10** (untouched-persona back-compat) — UNIT.
- **21.8 AC #2–#7** (doc content) — DOC REVIEW, not test-automatable.
- **21.8 AC #8** (README On-Prem section) — GAP; add `fs.readFileSync('README.md').includes('On-Prem / Air-Gapped Deployment')` assertion to 21.9 harness preconditions (Task 1.8) to close in-story.

**Follow-up action:** Per AC #9, gaps that are neither UNIT-owned nor doc-review-only (21.4 AC #5 append branch; 21.4 AC #9 exception; 21.5 AC #2 cross-file identity; 21.5 AC #9 manifest-path substitution; 21.6 AC #12 cross-profile fileRegex equality; 21.7 AC #4 and #8 deployed-customize coverage; 21.8 AC #8 README presence) MUST be either (a) absorbed into this story's OIT/harness tasks before merge, or (b) filed as bug stories against the owning Epic-21 story. The PR body coverage table (AC #9) names each resolution explicitly.

### Override-via-Extension Policy Reminder

Story 21.7's customize-loader field additions (`phase:`, `on_prem_phase_prefix:`) rely on the BMAD built-in override policy (the project policy is: "override BMAD built-ins via extension, never upstream PRs to bmad-method"). Story 21.9 tests must validate BOTH variants the loader may emit (per Epic Cross-Epic Notes line 4231): if Story 21.7's implementation produces `*.customize.on-prem.yaml` sibling files, the test harness diff against the on-prem baseline must include them. If it produces a single field-augmented file selected at install time, the diff is against the rendered output only. Confirm which branch Story 21.7 landed on before authoring the baseline fixture.

## Testing

- **Framework:** match existing `D:\Code\agents\test\` style. Verify first by reading `test/profile.test.js` — that is the Story-21.1 peer and the authoritative pattern for Epic 21 tests.
- **Isolation:** `fs.mkdtempSync` per test; sequential execution; zero writes to the repo root.
- **Fixtures:** `test/fixtures/empty-project/`, `test/fixtures/standard-profile-baseline/`, `test/fixtures/onprem-profile-baseline/` — regenerable per `test/fixtures/README.md`.
- **Entry point:** exported top-level install function (not internal helpers) — AC #7 non-negotiable.
- **Success criteria:** `npm test` green; all new sub-tests pass; pre-Epic-21 tests pass unchanged; PR body includes the NFR coverage table from the Dev Notes section above.

### Per-Upstream-Story AC → Test-File Mapping

Each AC from Stories 21.2 through 21.8 is enumerated below and mapped to the test file that asserts it. ACs not mapped to a test are surfaced as Test Coverage Gap entries under Dev Notes. Mapping key: **OIT** = `test/onprem-injection.test.js` (this story), **PT** = `test/profile.test.js` (Story 21.1, extended here), **BF-S** = `test/fixtures/standard-profile-baseline/` diff (AC #8), **BF-O** = `test/fixtures/onprem-profile-baseline/` diff (AC #8), **OJM** = `test/opencode-json-merge.test.js` (pre-existing), **UNIT** = per-story unit test under `test/` owned by the upstream story, **GAP** = no test in 21.9; see Test Coverage Gap list.

**Story 21.2 (Universal Instruction Block + composer):**
- 21.2 AC #1 (universal template file exists + content) → BF-S / BF-O (content appears in baseline); OIT sub-test (b).
- 21.2 AC #2 (`{{MANIFEST_PATH}}` single placeholder contract) → GAP (21.9 does not assert placeholder shape; owned by Story 21.2 UNIT).
- 21.2 AC #3 (composer function signature + on-prem-missing-throws) → GAP (error-path not exercised in 21.9; owned by Story 21.2 UNIT).
- 21.2 AC #4 (per-tool marker injection calls composer) → OIT sub-test (b); BF-S / BF-O.
- 21.2 AC #5 (all markdown-injection agents receive the block) → OIT sub-test (b); BF-S / BF-O.
- 21.2 AC #6 (idempotency — NFR46) → OIT sub-test (c).
- 21.2 AC #7 (profile isolation — NFR44) → OIT sub-test (a); BF-S.
- 21.2 AC #8 (OpenCode JSON-merge coexistence — NFR18) → OJM (existing) + BF-S / BF-O (instructions[] entry present).
- 21.2 AC #9 (BMAD agent instruction files unchanged in scope) → GAP (no negative assertion authored in 21.9; owned by Story 21.2 UNIT).
- 21.2 AC #10 (upgrade-safety hand-edit detection + backup) → GAP (drift/backup path not exercised in 21.9; owned by Story 21.2 UNIT).

**Story 21.3 (`.roomodes` template + YAML merger):**
- 21.3 AC #1 (four customModes entries present) → OIT sub-test (b); BF-S / BF-O.
- 21.3 AC #2 (customInstructions reuses composer output) → BF-O (on-prem content appears in customInstructions); OIT sub-test (b).
- 21.3 AC #3 (`roo-code` agent gains `extraInstructionTemplates`) → GAP (static agent-registry field; owned by Story 21.3 UNIT).
- 21.3 AC #4 (stamper wires extra template) → OIT sub-test (b) end-to-end; BF-S / BF-O.
- 21.3 AC #5 (mergeRoomodes contract — pure splicer) → GAP (pure-function unit test owned by Story 21.3 UNIT).
- 21.3 AC #6 (slug-collision warning emitted) → OIT sub-test (d) — asserts overwrite; GAP on the console-warning text match (surface if Story 21.3 UNIT does not cover).
- 21.3 AC #7 (fresh install creates `.roomodes`) → OIT sub-test (b); BF-S.
- 21.3 AC #8 (re-install preserves user customModes) → OIT sub-test (d).
- 21.3 AC #9 (NFR47 fileRegex contract) → OIT sub-test (e) + AC #5 matrix.
- 21.3 AC #10 (NFR46 idempotency for .roomodes) → OIT sub-test (c).
- 21.3 AC #11 (NFR44 standard profile — customInstructions has no on-prem strings) → OIT sub-test (a); BF-S.
- 21.3 AC #12 (NFR18 not regressed) → OJM (existing).
- 21.3 AC #13 (Roo Code not installed → no `.roomodes` write) → GAP (21.9 always selects Roo Code; owned by Story 21.3 UNIT).
- 21.3 AC #14 (markdown rules file `.roo/rules/00-ma-agents.md` unchanged in shape) → OIT sub-test (b); BF-S / BF-O.

**Story 21.4 (`AGENTS.md` template + OpenCode wiring):**
- 21.4 AC #1 (template file exists + content) → BF-S / BF-O.
- 21.4 AC #2 (static text, no placeholders) → GAP (source-file shape; owned by Story 21.4 UNIT).
- 21.4 AC #3 (composer output written via markdown-markers merger) → OIT sub-test (b).
- 21.4 AC #4 (OpenCode agent `extraInstructionTemplates` registered) → GAP (static registry field; owned by Story 21.4 UNIT).
- 21.4 AC #5 (markdown-markers merger behavior — create / replace / append) → OIT sub-test (b), (c) cover create + replace; GAP on the append-to-existing-unmarkered-file case.
- 21.4 AC #6 (`"AGENTS.md"` appended to `opencode.json::instructions[]`) → OJM (existing) + BF-S / BF-O.
- 21.4 AC #7 (`AGENTS.md` entry user-owned after first install — no re-append) → OIT sub-test (c) (idempotency catches double-append).
- 21.4 AC #8 (idempotency — NFR46) → OIT sub-test (c).
- 21.4 AC #9 (profile isolation — NFR44 with `~/.claude/` exception inside Critical Behavior Rules) → OIT sub-test (a) asserts the three literals absent in standard-profile render; GAP on the exception-carve-out assertion (the single legitimate `~/.claude/` occurrence under on-prem profile in AGENTS.md Critical Behavior Rules).
- 21.4 AC #10 (path stamping resolution precedence) → GAP (owned by Story 21.4 UNIT).
- 21.4 AC #11 (upgrade-safety hand-edit detection) → GAP (inherits Story 21.2 AC #10; owned by Story 21.2/21.4 UNIT).
- 21.4 AC #12 (OpenCode `instructionFiles` unchanged) → GAP (static registry; owned by Story 21.4 UNIT).

**Story 21.5 (`.clinerules` template extension):**
- 21.5 AC #1 (template file exists + content) → BF-S / BF-O.
- 21.5 AC #2 (universal text not hand-duplicated — single composer render) → OIT sub-test (b) + cross-file byte-identity check (GAP if not added).
- 21.5 AC #3 (both Cline files written via marker-based injection) → OIT sub-test (b); BF-S / BF-O.
- 21.5 AC #4 (user content outside markers preserved) → OIT sub-test (c), (d).
- 21.5 AC #5 (idempotency per file — NFR46) → OIT sub-test (c).
- 21.5 AC #6 (dual-file drift detection — `ClinerulesDualFileDriftError`) → GAP (error-path not exercised in 21.9; owned by Story 21.5 UNIT).
- 21.5 AC #7 (profile isolation — NFR44, both files) → OIT sub-test (a); BF-S.
- 21.5 AC #8 (on-prem profile appends on-prem content to both files) → OIT sub-test (b); BF-O.
- 21.5 AC #9 (`{{MANIFEST_PATH}}` resolves to `.cline/skills/MANIFEST.yaml`) → GAP (placeholder substitution result — add explicit assertion in OIT sub-test (b) or surface as gap; owned by Story 21.5 UNIT).

**Story 21.6 (on-prem layered guardrails):**
- 21.6 AC #1 (on-prem template file exists + four categories) → BF-O.
- 21.6 AC #2 (composer append wiring — on-prem layer) → OIT sub-test (b); BF-O.
- 21.6 AC #3 (on-prem template has no placeholders) → GAP (source-file shape; owned by Story 21.6 UNIT).
- 21.6 AC #4 (profile isolation — standard — NFR44, exhaustive three-literal set) → OIT sub-test (a); BF-S. **This AC pins the canonical negative set referenced by 21.9 AC #1(a).**
- 21.6 AC #5 (profile merge — on-prem includes both blocks in every agent) → OIT sub-test (b); BF-O.
- 21.6 AC #6 (`.roomodes` customInstructions on-prem augmentation — `/no_think` in each of four modes) → OIT sub-test (b); BF-O.
- 21.6 AC #7 (`AGENTS.md` on-prem augmentation inside Critical Behavior Rules anchor) → OIT sub-test (b); BF-O. Shape-A vs Shape-B decision deferred to Story 21.6 dev.
- 21.6 AC #8 (`.clinerules` / `.cline/clinerules.md` on-prem augmentation) → OIT sub-test (b); BF-O.
- 21.6 AC #9 (BMAD persona phase prefix NOT in scope for 21.6) → GAP (negative scope assertion; implicit via Story 21.7 test ownership).
- 21.6 AC #10 (idempotency — NFR46) → OIT sub-test (c); BF-O.
- 21.6 AC #11 (additive JSON-merge not regressed — NFR18) → OJM (existing) + BF-O.
- 21.6 AC #12 (Roo Code fileRegex not regressed — NFR47) → OIT sub-test (e) run under both profiles (GAP if not added — surface).
- 21.6 AC #13 (upgrade-safety on profile flip — deferred to 21.10) → Out of scope for 21.9; covered indirectly by AC #6 profile switch round-trip.

**Story 21.7 (BMAD persona phase prefix):**
- 21.7 AC #1 (planning-persona prefix content when on-prem) → BF-O (deployed `_bmad/_config/agents/*.customize.yaml`).
- 21.7 AC #2 (implementation-persona prefix content when on-prem) → BF-O.
- 21.7 AC #3 (standard-profile isolation — no prefix, byte-identical to pre-Epic-21) → BF-S; NFR coverage table.
- 21.7 AC #4 (YAML schema additions — `phase:` + `on_prem_phase_prefix:`) → Task 1.7 verifies source files have fields; GAP on actual deployed-output assertion if BF-O does not include customize-output files (verify during baseline capture).
- 21.7 AC #5 (`phase` field values enumerated — warning on invalid) → GAP (owned by Story 21.7 UNIT).
- 21.7 AC #6 (loader integration contract — no upstream PRs) → Policy, not test-verifiable; cite only.
- 21.7 AC #7 (prefix composition rule — prepend not replace) → BF-O (deployed customize file shape).
- 21.7 AC #8 (idempotency — NFR46) → OIT sub-test (c) extended to hash deployed customize files, or BF-O diff on second run (GAP if not added — surface).
- 21.7 AC #9 (standard-profile byte-identity to pre-Epic-21 baseline) → BF-S; NFR coverage table.
- 21.7 AC #10 (authoring back-compat for untouched personas) → GAP (out-of-scope-persona assertion; owned by Story 21.7 UNIT).
- 21.7 AC #11 (NFR47 non-regression) → OIT sub-test (e).
- 21.7 AC #12 (NFR18 non-regression) → OJM (existing).

**Story 21.8 (vLLM reference doc + README):**
- 21.8 AC #1 (doc file created at `docs/deployment/vllm-nemotron.md`) → Task 1.8 filesystem presence check; cited in NFR coverage table.
- 21.8 AC #2 (doc covers vLLM flags with rationale) → GAP (content review, not test-automatable; owned by Story 21.8 doc review).
- 21.8 AC #3 (doc covers quantization tradeoffs) → GAP (doc content; not test-automatable).
- 21.8 AC #4 (doc covers reasoning-mode behavior / `/no_think`) → GAP (doc content; not test-automatable).
- 21.8 AC #5 (per-phase sampling-parameters table) → GAP (doc content; not test-automatable).
- 21.8 AC #6 (`str_replace_editor` hallucination warning) → GAP (doc content; not test-automatable).
- 21.8 AC #7 (copy-paste-runnable `vllm serve` launch command) → GAP (doc content; not test-automatable).
- 21.8 AC #8 (README gains On-Prem / Air-Gapped Deployment section) → Task 1.8 filesystem grep check; GAP on automated presence assertion if not added to harness.
- 21.8 AC #9 (deployment doc NOT stamped into target projects — FR179) → BF-S / BF-O (absence of doc from installer output tree).

## Dependencies

### Upstream (must be merged before Story 21.9 can start)

- **Story 21.1** (`lib/profile.js`, `test/profile.test.js`) — **status: done** per sprint-status.yaml
- **Story 21.2** (universal instruction-block template + `composeInstructionBlock`) — **status: backlog**
- **Story 21.3** (`.roomodes` template + YAML merger + agents.js `extraInstructionTemplates`) — **status: backlog**
- **Story 21.4** (`AGENTS.md` template + OpenCode wiring) — **status: backlog**
- **Story 21.5** (`.clinerules` template) — **status: backlog**
- **Story 21.6** (on-prem instruction-block template) — **status: backlog**
- **Story 21.7** (BMAD persona phase prefix — 8 `*.customize.yaml` files) — **status: backlog**
- **Story 21.8** (vLLM doc + README section) — **status: backlog** (soft dependency; cited in coverage table, not directly test-consumed)
- **Story 21.10** (Profile Reconfigure — `ma-agents reconfigure` subcommand) — **status: backlog** (soft dependency; the AC #6 profile-switch round-trip test prefers calling `reconfigure` over direct `.ma-agents.json` editing when available. Test suite depends on 21.10's artifact (`lib/reconfigure.js`, `bin/cli.js` flag) existing; if 21.10 ships before 21.9 the test uses the canonical path, otherwise it falls back to direct edit with a TODO pointing at 21.10 per the Open question above.)

### Downstream (stories enabled by 21.9 completion)

- **Story 21.10** (Profile Reconfigure) — Story 21.9 is NOT a hard dependency, but 21.10 benefits from the baseline fixtures when authoring its own round-trip tests. Per sprint-status.yaml execution order (line 113), 21.9 runs before 21.10.
- **Story 21.11** (Profile Uninstall) — runs after 21.9 per execution order. Reuses isolation patterns established here.

### Soft / informational

- `_bmad-output/implementation-artifacts/sprint-status.yaml` (READ-ONLY in this story — DO NOT modify per user instruction override)

## Out of Scope

- Adding new per-story unit tests (those are owned by their respective stories — Stories 21.1–21.8, 21.10, 21.11)
- Performance benchmarks for installer speed
- Manual QA scripts
- Any test that requires a running Roo Code process (NFR47 regex contract is verified against the generated pattern, not runtime `FileRestrictionError` — per epic technical note line 4152)
- vLLM serving-stack tests (Story 21.8 ships vLLM as documentation only — FR179)
- BMAD upstream contributions (project policy: override via extension; never upstream PRs to bmad-method)
- Editing `.claude/skills/` — skill sources live in `lib/bmad-extension/skills/` or `skills/`; `.claude/skills/` is generated

## Change Log

- 2026-04-14: Story created (Epic 21, Story 21.9)
- 2026-04-14: Removed prescriptive `--profile=` flag references (flag retired per P0 spec-alignment PR #34)
- 2026-04-14: Added ACs for standard-profile byte-for-byte fixture baseline and end-to-end installer harness (Findings #14, #18)
- 2026-04-14: E2E fixture scaffolding committed (`test/fixtures/empty-project/`, placeholder baseline dirs, pending `test/onprem-injection.test.js` harness exits 0 until Story 21.9 implementation)
- 2026-04-15: Story rewritten to spec — Status=Ready, verbatim epic Story paragraph, ACs flag `(gap-fill)` additions, Tasks/Subtasks with exact absolute paths, Dev Notes cite NFR44/46/47/18, prior-story artifact dependency table enumerated, override-via-extension policy reminder added. Open questions raised for (a) Story 21.10 availability at test-author time, (b) `bmad-dev` `fileRegex` shape ambiguity, (c) NFR45 non-duplication with `test/profile.test.js`.
- 2026-04-15: Adversarial-review resolution pass. (1) AC #1(a) now pins the EXHAUSTIVE NFR44 negative literal set `["/no_think", "str_replace_editor", "~/.claude/"]` per Story 21.6 AC #4 scope narrowing (closes P1 #7); reasoning-mode / sampling prose is explicitly tested positive-side only. (2) Testing section expanded with per-upstream-story AC → test-file mapping covering every AC from Stories 21.2–21.8. (3) Dev Notes gains a Test Coverage Gaps subsection surfacing each GAP with ownership (UNIT vs in-story absorb vs doc-review). (4) Upstream dependencies now cite Story 21.10 (soft). (5) Status changed to Draft with explicit blockers — Tasks are conditional on upstream merge status and surfaced gaps. Canonical decision B (composer/merger/stamper terminology) verified consistent throughout.
