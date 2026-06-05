# Epic 26 Retrospective — Inline Git Workflow Guardrails in Per-Tool Instruction Block (Phase 5)

**Date:** 2026-06-05
**Worktree / branch:** `ma-agents-epic-26-close` / `chore/close-epic-26`
**Status:** Complete — both stories done, all six PRs merged.

---

## 1. Epic Goal & Outcome

**Goal.** Inline the worktree / Conventional-Commits / no-direct-merge-to-trunk rules directly into the universal `<!-- MA-AGENTS-START -->` marker block stamped into every coding agent's first-loaded instruction file (`CLAUDE.md`, `.cline/clinerules.md`, `.roo/rules/00-ma-agents.md`, `AGENTS.md`).

**Why.** Before Epic 26, the most consequential rule in the system — never commit to `main`/`dev`, always work in a worktree, always PR — lived only in `skills/git-workflow-skill/SKILL.md` (`always_load: true`) and in `lib/templates/project-context.template.md` (BMAD-agent activation path). Both are reachable only through indirection that fails when the model skips the manifest read or no BMAD agent is active. An adversarial review of the Workshop install (2026-05-24, v3.12.3, Claude Code + Cline, on-prem) confirmed the gap was reproducible on a fresh, correctly-installed project. Cline in particular has no `SessionStart` hook equivalent to Claude Code's `verify-manifest.js`, so its only mandatory load is `.cline/clinerules.md` itself.

**Outcome.** Goal met. The git guardrails now ship in the first context window of all four primary marker-block targets, profile-independent (standard and on-prem), with composition order `universal → git → (on-prem?)`. A network-free integration test locks the guarantee in against future refactors of the composer, per-tool stamping, or the agents registry. No source outside the intended composer + new template was touched; the `git-workflow-skill`, the universal template, and `project-context.template.md` were deliberately left unchanged (redundancy across layers is intentional per Architecture Decision P5-4).

---

## 2. What Shipped (per FR)

- **FR204 — Inline git fragment in every per-tool block.** New template `lib/templates/instruction-block-git.template.md`; `composeInstructionBlock({ profile, projectRoot })` in `lib/installer.js` appends it unconditionally (both profiles). No new injection target, no new marker pair, no change to user content outside the markers. Cursor/Kilocode/Copilot/Gemini inherit the same composed content.
- **FR205 — Rule content.** Single `## Git Workflow (ALL file-changing tasks)` heading carrying: worktree-first (`git worktree add ../<project>-<branch> -b <branch>` + `scripts/start-feature.sh`); never-commit-to-`main`/`dev`/`master`/trunk; Conventional Commits with all seven prefixes (`feat`, `fix`, `chore`, `docs`, `refactor`, `test`, `ci`); PR-only via `gh pr create` with no auto-merge without human approval; self-run `code-review` before PR; post-merge `git worktree remove` + branch delete; pointer to `SKILL.md` and the helper scripts; explicit "no small-fix exemption" sentence. Verified free of on-prem-only literals (`/no_think`, `str_replace_editor`, `~/.claude/`, `%APPDATA%`).
- **FR206 — Deterministic composition & idempotency.** Fixed order `universal → git → on-prem`; each fragment trailing-whitespace-normalized and joined by a single blank line so first-insert and in-place-replace are byte-identical (FR176 / NFR46). Missing **or** empty/unreadable git template throws a clear, path-identifying error mirroring the on-prem pattern.
- **Test coverage (Story 26.2).** `test/instruction-block-git.test.js` asserts the six required content elements inside the markers across all four targets for both profiles, idempotency with byte-exact out-of-marker preservation, FR206 ordering (git before on-prem), plus three edge cases (stale pre-existing block replaced, marker-missing-closer, partial 2-of-4 install). Wired into the `npm test` chain. Air-gapped: no process spawn, no socket, no real `gh`/`git` (NFR44/NFR45).

---

## 3. What Went Well

- **Tight scope held.** A "Small/Small" two-story epic stayed small. The implementation touched exactly `lib/installer.js` + one new template; the test story touched one new test file + one `package.json` line. No scope creep into the skill or the universal template.
- **Architecture decision did the heavy lifting.** P5-4 pre-resolved the contentious questions (separate fragment vs. folding into universal; intentional redundancy with `project-context.md`; rejected the Claude-only hook approach). Implementation was nearly mechanical because the design was unambiguous.
- **Both review layers came back clean.** Per story, both `bmad-review-edge-case-hunter` and `code-review` returned **no blocking issues**. Minor should-fix items were folded in rather than deferred (see below).
- **Defensive hardening beyond the spec.** 26.1 made the git-template read as robust as the universal read (try/catch with a path-identifying "installation may be corrupted" error covering missing/EISDIR/permission), plus an empty/whitespace-only guard so the guardrails can never silently vanish. Happy-path output bytes unchanged.
- **Edge-case probing strengthened the test.** 26.2's review-driven extensions (stale block, missing closer, partial install) make the regression net materially stronger than the literal AC list.

---

## 4. What Was Hard / Surprises

1. **Pre-existing CI failure surfaced mid-epic (plugin-bundle drift).** The Bundle Drift Guard failed on PR #100 because `lib/bmad-extension-plugin/.claude-plugin/marketplace.json` was last regenerated at `version: 3.12.0` — the release bumps to 3.12.1 → 3.12.2 → 3.12.3 never re-ran `npm run build:plugin`. Epic-26-independent. Fixed cleanly in a separate PR (#101, one line) landed first so the Epic 26 PRs stayed scope-clean and #100 rebased onto updated `main`. Root cause is a **process gap in the release flow**, not a code bug.
2. **Marker-merge fragility discovered while testing the missing-closer edge case.** An orphan `START`-without-`END` is correctly treated as "not a valid block" and a fresh complete block is inserted alongside it (no nesting, no throw, no dropped content for the single-pass markdown path). But the probe showed that **double-stamping the json-merge `AGENTS.md` over that orphan can drop user content** — the test deliberately avoids re-running `stampExtraInstructionTemplates` for json-merge agents to sidestep it. Logged as a candidate follow-up bug; **not fixed** (out of Epic 26 scope).
3. **Windows worktree test gotcha (CRLF).** Running `npm test` inside a worktree *after* `npm install` regenerates `.agents/skills/**`, which trips a CRLF byte-comparison in `migration.test.js` (7 pre-existing MIL-498 `template.md` vs `lib/mil498-templates/*.md` byte-identity checks). The suite is green on a clean checkout. During dev this forced per-file verification (`node test/instruction-block-git.test.js`, `test/instruction-block.test.js`, `test/onprem-injection.test.js`) rather than trusting a full-suite run in the working worktree. Easy to misread as an Epic 26 regression; it is not.
4. **Spec path vs. real path mismatch.** The epic/AC text says `CLAUDE.md`, but the claude-code agent actually writes `.claude/CLAUDE.md`. The test correctly asserts the real path. Minor, but worth noting so future stories cite the real on-disk target.

---

## 5. Process Metrics

- **Stories:** 2 (26.1 implementation, 26.2 integration test). Execution order 26.1 → 26.2 respected (26.2 was blocked-on-26.1 and verified the dependency was merged before passing).
- **PRs:** 6 total — #97 story bootstrap; #98 26.1 impl; #99 26.1 close/archive; #100 26.2 test; #101 pre-existing bundle-drift fix (out-of-band); #102 26.2 close/archive. Net product code is small: 26.1 ≈ +208 lines, 26.2 ≈ +622 lines (almost entirely test).
- **Review outcomes:** 4 review passes (2 per story across edge-case-hunter + code-review) — **zero blocking issues**. Should-fix items folded in: 26.1 — clearer missing-template error + empty/EISDIR hardening; 26.2 — tighter AC2 byte-exact out-of-marker tail check + AC3 multi-literal (3-marker) on-prem assertion.
- **Out-of-scope items correctly deferred (not silently dropped):** Claude Code `PreToolUse` git-commit gate (documented follow-up); marker-merge double-stamp bug (candidate bug story); `project-context.template.md` backfill (intentionally redundant, left as-is).

---

## 6. Recommendations / Follow-ups

1. **File a bug story for the marker-merge double-stamp fragility.** Scope: double-stamping the json-merge `AGENTS.md` merger over an orphan `START`-without-`END` can drop user content. Reproduce with a fixture, decide the correct behavior (treat orphan opener as inert user text in the json-merge path too, or refuse + warn), and add a regression test. Priority: medium — it only triggers on malformed pre-existing input, but the failure mode (silent user-content loss) is severe.
2. **Close the release/bundle-drift process gap.** Add `npm run build:plugin` to the version-bump path so `marketplace.json` is regenerated on every release bump — either as a step in the release script / `version` npm lifecycle hook, or as a pre-push/CI guard that fails the bump if the bundle is stale. Prevents the Bundle Drift Guard from failing on unrelated PRs.
3. **Fix the worktree CRLF test-isolation issue.** Add a `.gitattributes` entry pinning line endings for the MIL-498 template pairs (`lib/mil498-templates/*.md` and the generated `.agents/skills/mil498-*/template.md`) so the byte-identity check in `migration.test.js` is stable regardless of checkout/regeneration. Alternatively, normalize line endings in that comparison, or document a "verify on a clean tree / per-file" note for worktree-based dev. Removes a recurring false-positive that masks real regressions.
4. **Use the real on-disk paths in future ACs.** Reference `.claude/CLAUDE.md` (not bare `CLAUDE.md`) so test authors don't have to reconcile spec text against `lib/agents.js`.
5. **Track the deferred `PreToolUse` git-commit gate.** It would enforce (not just instruct) the no-commit-to-trunk rule on Claude Code and layers on top of the inline rule without rework. Keep it visible in the backlog so it isn't lost.

---

## Proposed project-context.md updates

*(Proposal only — not written to `_bmad-output/project-context.md`. Apply via the `project-context-expansion` skill if accepted.)*

1. **Fix the Conventional-Commits prefix list (drift / correctness).** `project-context.md` line 26 currently lists only five prefixes — `feat/fix/chore/docs/refactor`. Epic 26 (FR205 and the shipped `instruction-block-git.template.md`) codifies **seven**: `feat`, `fix`, `chore`, `docs`, `refactor`, `test`, `ci`. Update line 26 to the seven-prefix list so the BMAD-agent activation path matches the inline universal-block guardrail. This is a real divergence between the two intentionally-redundant layers and should be reconciled toward the canonical seven.

2. **Add a Project-Specific Rule capturing the per-tool guardrail-layering invariant.** Under `## Project-Specific Rules`, note: "Git/PR guardrails are intentionally redundant across two layers — the inline `instruction-block-git.template.md` (universal path, every agent) and `project-context.md` (BMAD-agent activation path). When changing one, change the other; an integration test (`test/instruction-block-git.test.js`) locks the inline layer across all four marker-block targets." This encodes the lesson that the layers must be kept in sync.

3. **Add a testing/CI note (optional).** Under `## Project-Specific Rules`: "On Windows worktrees, `npm test` after `npm install` regenerates `.agents/skills/**` and can trip CRLF byte-identity checks in `migration.test.js`; verify per-file or on a clean checkout until `.gitattributes` pins those line endings." Persists the worktree gotcha so it doesn't re-surprise the next contributor.
