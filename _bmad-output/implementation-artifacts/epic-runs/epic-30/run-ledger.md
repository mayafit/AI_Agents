# Run Ledger — Epic 30 (BMAD v6.10.0 Integration)

```
Epic:            30 — BMAD v6.10.0 Integration
Stories:         8 (30.1-30.8)   skipped(done): none
review_model:    claude-opus     exec_model: claude-sonnet   (tiers collapsed: no)
strategy:        waves            max_parallel: 3   fix_cap: 2
gates:           publish=on  pr=on   dist-tag=beta  bump=prerelease
test_gate:       npm run build:plugin + targeted subset (bare npm test CRLF pos-13 excluded)
approach:        GATE-FIRST — run Wave 1 only, then HALT & reassess before Waves 2-4
epic_worktree:   .worktrees/epic-30   branch: feature/epic-30 (off main @98e8290)
started:         2026-07-12
```

## Wave plan

```
Wave 1:  30.1 (GATE spike) | 30.4 (deprecate Demerzel, parallel) | 30.5 (SPIKE subset-install)   << COMPLETE
Wave 2:  30.2 (needs 30.1) | 30.6 (needs 30.5) [split candidate 6a/6b]
Wave 3:  30.3 (needs 30.2) | 30.7 (needs 30.6)
Wave 4:  30.8 (needs 30.3 + 30.4 + 30.7)
```

## Story states

| Story | Wave | Status | Fix rounds | Note |
|-------|------|--------|-----------|------|
| 30.1  | 1 | merged (epic branch) | 0 | GATE VERDICT **PASS** — all 4 P5-8 assumptions hold; break reproduced (bmad-loop force-bundled today). Commit d59d160. Findings: 30-1-gate-findings.md |
| 30.4  | 1 | merged (epic branch) | 1 | Deprecate Demerzel non-destructive. 7 commits (29b426a…d218096). e2e green; 6.10.0 fail-loud constraint test-guarded; installer.js untouched (NFR49). |
| 30.5  | 1 | merged (epic branch) | 0 | SPIKE — RECOMMEND enumerate-then-stage-locally (zero core mods, PoC passes). --modules can't subset custom source. CustomModuleManager pinned-internal (NFR17). Recommends 30.6→6a/6b split. Commit 89064e4. Findings: 30-5-spike-findings.md |
| 30.2  | 2 | pending | 0 | bundle filter + set-equality guard |
| 30.6  | 2 | pending | 0 | custom-source wizard (split 6a/6b pending user decision) |
| 30.3  | 3 | pending | 0 | bump 6.10.0 + offline verify |
| 30.7  | 3 | pending | 0 | persist/re-enumerate marketplace |
| 30.8  | 4 | pending | 0 | release gate: docs + offline E2E + semver |

## Wave 1 integration & gate outcome
- All 3 stories merged into `feature/epic-30` with `--no-ff` (merges 98bcda4, 33d1bf3, 377f998). No conflicts.
- Package-integrity gate on epic branch: **build:plugin ✓** (no bundle drift); affected test subset **green** after `npm install` in epic worktree (extension-module-restructure 34/34, plugin-manifests ✓, routing-parity 9/9, convert-agents-to-skills ✓, uv-transition-resilience 7/7, demerzel-ml-removal-drift 15/15, demerzel-deprecation-notice 10/10, build-plugin ✓, profile ✓).
- **Baseline failure (NOT an epic regression):** `test/agent-injection-strategy.test.js` assertion 3.3 (`installer.js` must contain no `cline`-specific conditional) fails on the epic branch AND reproduces identically on `main`. installer.js is byte-identical to base. → follow-up candidate bug, out of Epic 30 scope.
- 3 story worktrees removed post-merge; epic worktree retained.

## Log
- 2026-07-12 — Intake complete; config resolved (gate-first, opus/sonnet, 3/2, both gates on). Epic branch cut. bmad-method@6.10.0 confirmed published (npm latest).
- 2026-07-12 — Wave 1 complete: 30.1 PASS, 30.4 done, 30.5 spike done. Integrated + gate passed. HALT for gate-first reassessment (30.6 split decision + Waves 2-4 go/no-go).
