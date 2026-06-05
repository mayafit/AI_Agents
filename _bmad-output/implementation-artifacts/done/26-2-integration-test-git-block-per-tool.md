# Story 26.2: Integration Test — Git Block Stamped Into All Four Per-Tool Injection Targets

Status: ready-for-dev

<!-- Note: The epic spec annotates this story's status as "ready-for-dev (blocked on 26.1)". Story 26.2 depends on the git instruction-block template and composer wiring delivered by Story 26.1; it cannot pass until 26.1 lands. -->

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As the chief architect,
I want an integration test that asserts the git workflow rules land in `CLAUDE.md`, `.cline/clinerules.md`, `.roo/rules/00-ma-agents.md`, and `AGENTS.md` for both `standard` and `on-prem` profiles,
so that a future refactor of the composer, the per-tool stamping in `lib/installer.js`, or the agents registry in `lib/agents.js` cannot silently drop git rules from any one tool's instruction file.

## Acceptance Criteria

**Given** a clean fixture project with no pre-existing `<!-- MA-AGENTS-START -->` marker-block content in any target
**When** `npx ma-agents install --yes` runs with all four primary tool targets selected (Claude Code, Cline, Roo Code, OpenCode) and profile=`standard`
**Then** all four target files (`CLAUDE.md`, `.cline/clinerules.md`, `.roo/rules/00-ma-agents.md`, `AGENTS.md`) contain, inside the `<!-- MA-AGENTS-START -->` / `<!-- MA-AGENTS-END -->` markers:
- The heading `## Git Workflow (ALL file-changing tasks)`
- A reference to `git worktree add`
- A reference to "Conventional Commits" (or the literal prefix list `feat`, `fix`, `chore`, `docs`, `refactor`, `test`, `ci`)
- A reference to `gh pr create` or the phrase "open a PR"
- A reference to `skills/git-workflow-skill/SKILL.md`
- An explicit `never commit directly to main` / `dev` / `master` rule

**Given** the same fixture project after the first install completes
**When** the installer runs a second time with the same flags
**Then** the marker-block content in every target is byte-identical to the first run (idempotency)
**And** any text written outside the markers between runs is preserved byte-for-byte

**Given** a fixture project with profile=`on-prem`
**When** the installer runs
**Then** every target file contains the git block AND the on-prem block within the marker
**And** the git block appears in the marker before the on-prem block (composition order from FR206)

**Given** the test runs in CI
**When** `npm test` executes
**Then** the new test file `test/instruction-block-git.test.js` (or an extension of an existing instruction-block test) is included in the run
**And** the test executes without network access (no air-gapped regression — NFR44/NFR45 contract)

## Tasks / Subtasks

- [x] Set up the fixture project and test scaffold (AC: 1, 4)
  - [x] Reuse the existing fixture pattern from `test/onprem-injection.test.js` if present; otherwise create a fixture under `test/fixtures/git-block/`
  - [x] Create `test/instruction-block-git.test.js` (or extend an existing instruction-block test) so it is picked up by `npm test`
  - [x] Ensure the fixture and test perform no network calls and do not depend on a real `gh` binary, real GitHub remote, or any network call
- [x] Assert the git block lands in all four primary targets for profile=`standard` (AC: 1)
  - [x] Run `npx ma-agents install --yes` with Claude Code, Cline, Roo Code, OpenCode selected, profile=`standard`
  - [x] For each of `CLAUDE.md`, `.cline/clinerules.md`, `.roo/rules/00-ma-agents.md`, `AGENTS.md`, read via `fs.readFileSync` and assert (substring/regex on the marker-block region) the six required content elements: the `## Git Workflow (ALL file-changing tasks)` heading, `git worktree add`, Conventional Commits / prefix list, `gh pr create` or "open a PR", `skills/git-workflow-skill/SKILL.md`, and the never-commit-directly-to-main/dev/master rule
- [x] Assert idempotency and out-of-marker preservation (AC: 2)
  - [x] Run the installer a second time with the same flags
  - [x] Assert the marker-block content in every target is byte-identical to the first run
  - [x] Assert text written outside the markers between runs is preserved byte-for-byte
- [x] Assert on-prem composition order (AC: 3)
  - [x] Run the installer against a fixture with profile=`on-prem`
  - [x] Assert every target contains the git block AND the on-prem block within the marker
  - [x] Assert the git block appears before the on-prem block (composition order from FR206)

## Dev Notes

This is an integration test story. It does not change product behavior; it locks in the per-tool stamping guarantees delivered by Story 26.1. **Status is `ready-for-dev` but blocked on Story 26.1** — the git instruction-block template (`lib/templates/instruction-block-git.template.md`) and the composer wiring in `lib/installer.js` must exist before this test can pass.

**Size:** Small
**Priority:** High

### Technical Notes (verbatim from epic spec)

- Reuse the existing fixture pattern from `test/onprem-injection.test.js` if present; otherwise create a fixture under `test/fixtures/git-block/`
- Assert per-target file via `fs.readFileSync` + substring/regex on the marker-block region; do not parse markdown
- Cursor, Kilocode, Copilot, Gemini are not in the per-target assertion list because they reuse the same composed marker-block content; covering the four primary marker-block targets (Claude Code, Cline, Roo Code, OpenCode) is the architectural boundary
- The fixture must NOT depend on a real `gh` binary, real GitHub remote, or any network call — assertions are on the stamped instruction-file content, not on git or PR behavior

### Epic Context (Epic 26 — Inline Git Workflow Guardrails in Per-Tool Instruction Block, Phase 5)

- **Goal:** Inline the worktree / Conventional Commits / no-direct-merge-to-`main` rules into the universal `<!-- MA-AGENTS-START -->` block stamped into every coding agent's context file (`CLAUDE.md`, `.cline/clinerules.md`, `.roo/rules/00-ma-agents.md`, `AGENTS.md`). Today these rules live only in `skills/git-workflow-skill/SKILL.md` (always_load) and `lib/templates/project-context.template.md` (BMAD-agent activation path) — both reachable only via indirection that fails when the model skips the manifest read or when no BMAD agent is active. Adversarial review of the Workshop install (2026-05-24) confirmed the gap is reproducible on a fresh, correctly-installed project.
- **Dependencies:** Epic 21 (universal + on-prem layered guardrails — already done). No code dependency on Epics 22–25.
- **Execution order:** 26.1 → 26.2.
- **FR Coverage:** FR204, FR205, FR206. Cross-references FR174, FR176 (existing universal-block contract).
- **Out of scope:**
  - Modifying `skills/git-workflow-skill/SKILL.md` — the skill stays the procedural reference; the inline template is the rule summary.
  - Adding a Claude Code `PreToolUse` hook to gate `git commit` against `main`/`dev`. Documented as a deferred follow-up; would layer on top of the inline rule without rework.
  - Backfilling git rules into `lib/templates/project-context.template.md` — its `## Git Workflow (ALL file-changing tasks)` section at lines 22–29 already covers the BMAD-agent path; redundancy across the two layers is intentional (see Architecture Decision P5-4).
  - Cross-tool variation in rule wording — the same template body is stamped verbatim into all four marker-block targets.

### Project Structure Notes

- Test file target: `test/instruction-block-git.test.js` (or an extension of an existing instruction-block test) — must be included in the `npm test` run.
- Fixture: reuse `test/onprem-injection.test.js` fixture pattern if present; otherwise create `test/fixtures/git-block/`.
- Source under test (delivered by Story 26.1): `lib/installer.js` composer `composeInstructionBlock({ profile, projectRoot })` and per-tool stamping; `lib/templates/instruction-block-git.template.md`; agents registry `lib/agents.js`.
- Marker-block targets asserted: `CLAUDE.md`, `.cline/clinerules.md`, `.roo/rules/00-ma-agents.md`, `AGENTS.md`.
- Air-gapped requirement: no network access, no real `gh` binary, no GitHub remote (NFR44/NFR45 contract).

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 26.2: Integration Test — Git Block Stamped Into All Four Per-Tool Injection Targets] (lines 4783–4823)
- [Source: _bmad-output/planning-artifacts/epics.md#Epic 26: Inline Git Workflow Guardrails in Per-Tool Instruction Block (Phase 5)] (lines 4722–4737)
- [Source: _bmad-output/planning-artifacts/epics.md#Story 26.1] (lines 4738–4781) — upstream dependency
- FR Coverage: FR204, FR205, FR206 (cross-references FR174, FR176); NFR44, NFR45 (air-gapped). Architecture Decision P5-4 (intentional redundancy across guardrail layers).

## Dev Agent Record

### Agent Model Used

Claude Opus 4.8 (1M context) — Amelia (bmad-dev-story workflow).

### Debug Log References

- `node test/instruction-block-git.test.js` → 4 passed, 0 failed.
- Verified 26.1 dependency is merged: `lib/installer.js::composeInstructionBlock` appends the git block (universal + git + on-prem) and `lib/templates/instruction-block-git.template.md` is present with all six required content elements.

### Completion Notes List

- New integration test `test/instruction-block-git.test.js` reuses the existing harness pattern (mktemp/cleanup, `_testUpdateAgentInstructions` + `stampExtraInstructionTemplates`, `extractMarkerBlock`) from `test/onprem-injection.test.js`. No new fixture file was needed — temp project dirs are created per-test.
- Asserts the composed git block in ALL FOUR primary marker-block targets: `.claude/CLAUDE.md`, `.cline/clinerules.md`, `.roo/rules/00-ma-agents.md`, `AGENTS.md` (opencode → AGENTS.md via extraInstructionTemplates).
  - Note: the spec lists `CLAUDE.md`; the claude-code agent actually writes `.claude/CLAUDE.md` (confirmed by existing tests). The test asserts the real path.
- Six content checks per target: `## Git Workflow (ALL file-changing tasks)` heading, `git worktree add`, Conventional Commits / 7-prefix list, `gh pr create` / "open a PR", `skills/git-workflow-skill/SKILL.md`, and the explicit never-commit-directly-to-`main`/`dev`/`master` rule.
- Idempotency: second install yields byte-identical marker-block content per target; out-of-marker user text appended after `MA-AGENTS-END` is preserved byte-for-byte; exactly one marker block remains.
- on-prem (FR206): every target contains both the git block and the on-prem block, with the git heading appearing before the on-prem `/no_think` guardrail inside the marker.
- Air-gapped (NFR44/NFR45): assertions are content-only; no process spawn, no socket, no real `gh`/`git`/network.
- Wired into CI: appended `&& node test/instruction-block-git.test.js` to the `"test"` script in `package.json` (after `agents-md.test.js`), grouped with the other instruction-block tests. Only that one script line changed.
- Source under test was NOT modified (26.1 composer is already merged/reviewed).

### File List

- `test/instruction-block-git.test.js` (new)
- `package.json` (modified — `test` script chain only)
