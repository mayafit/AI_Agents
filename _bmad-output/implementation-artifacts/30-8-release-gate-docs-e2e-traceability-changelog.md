# Story 30.8: Release-gate Deliverables — Docs, Offline E2E Verification, FR/NFR Traceability, CHANGELOG + Semver Recommendation

Status: review

## Story

As the **ma-agents maintainer closing Epic 30 (BMAD v6.10.0 Integration)**,
I want a documentation pass covering the three shipped threads (bundle-filter
safety, opt-in custom marketplace source, non-destructive Demerzel
deprecation), a full FR235-FR247/NFR70-NFR75 traceability matrix, the
strongest offline verification this sandbox can run (plus a runbook for the
one proof that genuinely needs a clean-Windows `--network none` Docker box),
and a CHANGELOG entry with a semver recommendation,
So that Epic 30 has a human-reviewable release gate before the orchestrator
cuts the version and opens the integration PR.

**Depends on:** 30.1 (gate PASS), 30.2 (bundle filter), 30.3 (pin bump +
offline verify), 30.4 (Demerzel deprecation), 30.5 (spike), 30.6a/30.6b
(custom marketplace enumerate/wizard/stage/install), 30.7 (persist/reconcile),
30.9 (Cline registry refactor) — all merged on `feature/epic-30`.

**FR/NFR:** all of FR235-FR247, NFR70-NFR75 (traceability only — no new
product code is introduced by this story beyond documentation).

## Acceptance Criteria

1. **Docs** — README (matching existing doc style) documents: (a) the
   `--bmad-custom-source` flag + the interactive wizard flow (Y/N prompt →
   enumerate → ma-agents' own multiselect → subset install → persistence in
   `.ma-agents.json` → re-enumerate/reconcile on update); (b) the Demerzel/ML
   deprecation notice (new installs only; existing installs untouched; how to
   opt back in via a custom marketplace source; supersedes FR193); (c) the
   `bmad-loop` opt-in-only status (never bundled by default; installable only
   via a custom marketplace source; `bmad-dev-epic` remains the default
   air-gapped orchestrator).
2. **FR/NFR traceability matrix** — `epic-runs/epic-30/30-8-traceability.md`
   maps every FR235-FR247 and NFR70-NFR75 to the landed story/stories and the
   file(s)/test(s) that satisfy it, flagging anything not fully covered.
3. **Offline E2E verification** — `epic-runs/epic-30/30-8-offline-e2e.md`
   proves, without hanging: (a) the cache/bundle resolves to exactly
   `{tea,bmb,cis,gds,wds}` with `bmad-loop` absent at the live-installed
   6.10.0, by re-running the real closed-allowlist filter against the real
   registry (reusing the 30.3 approach); (b) `build:plugin` is drift-clean.
   The full clean-Windows `docker --network none` E2E is documented as a
   runbook for a human to run, with the CRLF position-13 caveat noted.
4. **CHANGELOG** — a v-next entry (placeholder version header) describing
   the three Epic 30 threads plus the 30.9 Cline refactor, with a semver
   recommendation in this story's hand-off (not executed here).

## Tasks / Subtasks

### Task 1: Gather ground truth (AC: 1-4)
- [x] 1.1 Read the run-ledger, all `30-*.md` story specs, PRD FR235-247/
      NFR70-75, architecture P5-8, current README/CHANGELOG/package.json.
- [x] 1.2 Cross-check documented behavior against the actual shipped source
      (`bin/cli.js`, `lib/bmad.js`, `lib/custom-marketplace.js`,
      `lib/profile.js`, `scripts/build-bmad-cache.js`) — not from the spec
      prose alone.

### Task 2: Docs (AC: 1)
- [x] 2.1 Add a "BMAD v6.10.0 Integration" subsection under the existing
      BMAD-METHOD Integration doc block: custom marketplace source flow,
      `--bmad-custom-source` flag + examples, persistence/reconcile-on-update,
      NFR71 on-prem/pass-through warning.
- [x] 2.2 Add the Demerzel deprecation notice to the Specialized BMAD Agents
      section (existing Demerzel row annotated, not silently deleted — it
      still describes existing installs).
- [x] 2.3 Document `bmad-loop`'s opt-in-only status next to the bundled-module
      list.
- [x] 2.4 Add a "What's New" README entry for the pending release.

### Task 3: Traceability matrix (AC: 2)
- [x] 3.1 One row per FR235-FR247/NFR70-NFR75: story, file(s), test(s),
      coverage verdict.
- [x] 3.2 Flag any requirement without a dedicated automated test (found:
      FR243 and NFR75 are architecturally satisfied but lack a dedicated
      positive/diff regression test — documented as a gap, not blocking).

### Task 4: Offline E2E verification (AC: 3)
- [x] 4.1 Re-run `test/bmad-version-bump.test.js` and
      `test/bundle-filter-set-equality.test.js` (targeted, no bare
      `npm test`) against the live installed `bmad-method@6.10.0` in this
      worktree — both green, resolved set exactly the five, `bmad-loop`
      absent.
- [x] 4.2 Re-run `test/staging-6-10-0-regression.test.js`,
      `test/demerzel-deprecation-notice.test.js`,
      `test/demerzel-ml-removal-drift.test.js`,
      `test/custom-marketplace-persist-reconcile.test.js` — all green.
- [x] 4.3 Run `node scripts/build-plugin.js` then `git diff --exit-code --
      lib/bmad-extension-plugin/` — drift-clean.
- [x] 4.4 Write the clean-Windows `docker --network none` E2E runbook (not
      executed here — no Docker in this sandbox) with the CRLF position-13
      caveat.

### Task 5: CHANGELOG + semver recommendation (AC: 4)
- [x] 5.1 Add `## [UNRELEASED]` entry summarizing all three threads + 30.9.
- [x] 5.2 Recommend MINOR (3.16.0 -> 3.17.0) in the hand-off — feature
      additive, no breaking change to existing installs, no `npm version` run.

### Task 6: Self-review (inline)
- [x] 6.1 Code-review pass: doc accuracy vs. shipped behavior (flag names,
      function names, prompt wording) — verified by grep/read of source, not
      assumed from story prose.
- [x] 6.2 Edge-case pass: traceability completeness — every FR/NFR has at
      least one row; gaps called out explicitly rather than glossed over.

## Dev Notes

- This story is documentation + verification only. No `lib/`, `bin/`,
  `scripts/`, or `test/` source files are modified — the only shipped-code
  evidence gathered here is by *running* existing tests, never editing them.
- `CHANGELOG.md`'s version header is left as `## [UNRELEASED]` deliberately —
  bumping `package.json`'s `version`, `git tag`, and `npm publish` are the
  orchestrator's human-gated actions per the epic run-ledger.
- The full `docker --network none` clean-Windows E2E was NOT executed in this
  sandbox (no Docker daemon available to this worktree's shell) — the runbook
  in `30-8-offline-e2e.md` is written for a human/CI runner to execute
  verbatim before the release is cut.

## Change Log

| Date | Change |
|------|--------|
| 2026-07-12 | Story created and executed in worktree `feature/epic-30-story-30-8`. |
