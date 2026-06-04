# Story 26.1: Add Git Instruction-Block Template and Wire It Into the Composer

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an engineer running any coding agent (Claude Code, Cline, Roo Code, OpenCode, Cursor, Kilocode, Copilot, Gemini) inside a ma-agents-installed project, I want the worktree-based git workflow rules to appear in my agent's first-loaded instruction file, so that the agent cannot plausibly commit directly to `main` or `dev`, skip the PR step, or write a non-conventional commit message — even if it never opens the manifest or `skills/git-workflow-skill/SKILL.md`.

## Metadata

- **Epic:** Epic 26 — Inline Git Workflow Guardrails in Per-Tool Instruction Block (Phase 5)
- **Size:** Small
- **Priority:** High (closes a foundational guardrail gap demonstrated in the field)
- **FR Coverage:** FR204, FR205, FR206. Cross-references FR174, FR176 (existing universal-block contract).
- **Architecture Decision:** P5-4 (redundancy across the inline template layer and the `lib/templates/project-context.template.md` BMAD-agent activation path is intentional).
- **Execution order:** 26.1 → 26.2.
- **Dependencies:** Epic 21 (universal + on-prem layered guardrails — already done). No code dependency on Epics 22–25.

## Acceptance Criteria

**Given** the new template `lib/templates/instruction-block-git.template.md`
**When** the file is read
**Then** it contains, under a single `## Git Workflow (ALL file-changing tasks)` heading:
- A "create a fresh worktree before any file change" rule that names the command shape `git worktree add ../<project>-<branch> -b <branch>` and references `skills/git-workflow-skill/scripts/start-feature.sh` for the scripted form
- A "never commit directly to `main` / `dev` / `master` / the trunk branch" rule, with the explicit naming of those four branches
- A Conventional Commits rule listing the seven allowed prefixes: `feat`, `fix`, `chore`, `docs`, `refactor`, `test`, `ci`
- A "PR is the only path into the trunk" rule that names `gh pr create` as the integration mechanism and prohibits auto-merge without explicit human approval
- A "self-run the `code-review` skill before opening the PR" rule
- A "after merge: `git worktree remove` and delete the feature branch" cleanup rule
- A pointer to the full procedure at `skills/git-workflow-skill/SKILL.md` and to `scripts/start-feature.sh` / `finish-feature.sh`
- A single explanatory sentence stating that these rules apply to every file-changing task regardless of size — there is no "small fix exemption"
**And** the template body contains no reference to any local-LLM-specific concept (`/no_think`, `str_replace_editor`, `~/.claude/`, `%APPDATA%`) — those belong only in the on-prem template

**Given** the existing composer `composeInstructionBlock({ profile, projectRoot })` in `lib/installer.js` (lines 115–138)
**When** it is invoked for profile=`standard`
**Then** the returned string contains, in this exact order: the universal block body, then the git block body — and nothing else
**And** the same call for profile=`on-prem` returns the universal block body, then the git block body, then the on-prem block body — in that exact order
**And** if `lib/templates/instruction-block-git.template.md` is missing on disk, the composer throws a clear error message identifying the missing template (matching the existing `on-prem profile selected but instruction-block-onprem.template.md is missing` pattern)

**Given** any agent with markdown instruction injection (Claude Code, Cline, Roo Code, OpenCode, Cursor, Kilocode, Copilot, Gemini)
**When** the installer runs (any profile)
**Then** the composed block — including the git body — is rendered between the `<!-- MA-AGENTS-START -->` / `<!-- MA-AGENTS-END -->` markers in that agent's instruction file
**And** content outside the markers is preserved byte-for-byte (FR176 contract)

**Given** the same profile and same project state
**When** the installer runs twice in a row
**Then** the content within the marker block is byte-identical between runs (FR176 idempotency contract)

## Tasks / Subtasks

- [x] Author the new template `lib/templates/instruction-block-git.template.md` (AC: #1)
  - [x] Use a single `## Git Workflow (ALL file-changing tasks)` heading
  - [x] Include all eight required bullet rules verbatim in intent (worktree, no-direct-commit, conventional prefixes, PR-only, self-run code-review, post-merge cleanup, full-procedure pointer, no-small-fix-exemption sentence)
  - [x] Keep the body free of any local-LLM-specific concept (`/no_think`, `str_replace_editor`, `~/.claude/`, `%APPDATA%`)
- [x] Wire the template into the composer in `lib/installer.js` (AC: #2)
  - [x] Add `GIT_INSTRUCTION_TEMPLATE_PATH` constant next to the existing `UNIVERSAL_INSTRUCTION_TEMPLATE_PATH` / `ONPREM_INSTRUCTION_TEMPLATE_PATH` at `lib/installer.js:14-15`
  - [x] Read the template via the same `fs.readFileSync` pattern
  - [x] Concatenate in order: `universal + git + (profile==='on-prem' ? on-prem : '')` — modify the existing composer in place, no new function
  - [x] Throw a clear missing-template error matching the existing on-prem pattern
- [x] Confirm marker-block rendering and idempotency are preserved across all four per-tool injection targets (AC: #3, #4)

## Dev Notes

- The composer is at `lib/installer.js:115-138`. Add a new template path constant `GIT_INSTRUCTION_TEMPLATE_PATH` next to the existing `UNIVERSAL_INSTRUCTION_TEMPLATE_PATH` and `ONPREM_INSTRUCTION_TEMPLATE_PATH` constants at `lib/installer.js:14-15`. Read the template via the same `fs.readFileSync` pattern. Concatenate in the order: `universal + git + (profile==='on-prem' ? on-prem : '')`. No new function — modify the existing composer in place
- No changes to `lib/templates/instruction-block-universal.template.md` — it must stay git-neutral so a future profile may opt out of the git layer without forking the universal block
- No changes to `skills/git-workflow-skill/SKILL.md` — the skill remains the procedural reference; the inline template is the rule summary
- No changes to `lib/templates/project-context.template.md` — its `## Git Workflow` section (lines 22–29) is retained for the BMAD-agent activation path; redundancy across layers is intentional (see Architecture Decision P5-4)
- The CLI subcommand `npx ma-agents reconfigure` (FR180) already re-runs profile-dependent stamping — existing installs pick up the new git block on the next `install` or `reconfigure` run automatically; no migration script is required

### Project Structure Notes

- New file: `lib/templates/instruction-block-git.template.md`
- Modified file: `lib/installer.js` (composer at lines 115–138; new constant at lines 14–15)
- Explicitly out of scope (do not touch): `lib/templates/instruction-block-universal.template.md`, `skills/git-workflow-skill/SKILL.md`, `lib/templates/project-context.template.md`

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Epic 26]
- [Source: _bmad-output/planning-artifacts/epics.md#Story 26.1: Add Git Instruction-Block Template and Wire It Into the Composer]
- FR204, FR205, FR206; cross-references FR174, FR176; Architecture Decision P5-4

## Dev Agent Record

### Agent Model Used

Claude Opus 4.8 (1M context) — claude-opus-4-8[1m]

### Debug Log References

- `npm test` (full suite): the only failures are 7 pre-existing MIL-498 byte-identity checks in `test/migration.test.js` (`mil498-*/template.md` vs `lib/mil498-templates/*.md`) caused by a line-ending/content divergence already present in this worktree's baseline (e.g. `.agents/skills/mil498-ocd/template.md` 11073B vs `lib/mil498-templates/OCD.md` 11242B). They are unrelated to Story 26.1 — this story touches only `lib/installer.js` and the new git template.
- Affected test files pass fully: `test/instruction-block.test.js` 14/14, `test/onprem-layer.test.js` 12/12.

### Completion Notes List

- Created `lib/templates/instruction-block-git.template.md` with a single `## Git Workflow (ALL file-changing tasks)` heading containing all eight required rules: worktree-first (`git worktree add ../<project>-<branch> -b <branch>` + `scripts/start-feature.sh`), never-commit-to-`main`/`dev`/`master`/trunk, Conventional Commits with all seven prefixes (`feat`, `fix`, `chore`, `docs`, `refactor`, `test`, `ci`), PR-only via `gh pr create` with no auto-merge without human approval, self-run `code-review` before PR, post-merge `git worktree remove` + branch delete, pointer to `skills/git-workflow-skill/SKILL.md` and `scripts/start-feature.sh`/`finish-feature.sh`, and a no-"small fix exemption" sentence. Body contains none of the on-prem-only literals (`/no_think`, `str_replace_editor`, `~/.claude/`, `%APPDATA%`).
- Added `GIT_INSTRUCTION_TEMPLATE_PATH` constant at `lib/installer.js:15` next to the universal/on-prem constants, and exported it from `module.exports`.
- Modified `composeInstructionBlock` in place (no new function): reads the git template via `fs.readFileSync`, throws `instruction-block-git.template.md is missing` if absent (mirrors the on-prem pattern), and composes in the exact order `universal + git + (on-prem ? on-prem : '')`, each piece trailing-whitespace-normalized and joined by a single blank line so the standard output is `universal + git` and on-prem is `universal + git + on-prem`. Trailing-whitespace normalization preserved for FR176/NFR46 byte-identity.
- Verified via the composer: standard contains universal→git ordering with on-prem absent; on-prem contains universal→git→on-prem ordering; both profiles idempotent (byte-identical across calls); missing-template throw confirmed.

### File List

- `lib/templates/instruction-block-git.template.md` (new)
- `lib/installer.js` (modified — new `GIT_INSTRUCTION_TEMPLATE_PATH` constant, composer wiring, export)

## Change Log

- 2026-06-04 — Story 26.1 implemented: added git instruction-block template and wired it into `composeInstructionBlock` (universal + git + optional on-prem). All ACs met; instruction-block and onprem-layer suites green.
- 2026-06-04 — Post-review hardening (non-blocking): made the git-template load in `composeInstructionBlock` match the universal read — `fs.readFileSync` wrapped in try/catch surfacing a path-identifying "ma-agents installation may be corrupted" error (covers missing/EISDIR/permission cases), plus an empty/whitespace-only guard so the git guardrails can never silently vanish. Happy-path output bytes unchanged (FR176/NFR46 idempotency preserved); both affected suites still green.
