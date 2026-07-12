# Run Ledger — Epic 30 (BMAD v6.10.0 Integration)

```
Epic:            30 — BMAD v6.10.0 Integration
review_model:    claude-opus     exec_model: claude-sonnet   (tiers collapsed: no)
strategy:        waves            max_parallel: 3   fix_cap: 2
gates:           publish=on  pr=on   dist-tag=beta  bump=prerelease
test_gate:       npm run build:plugin + targeted subset (bare npm test CRLF pos-13 excluded)
approach:        GATE-FIRST (Wave 1) → user approved Waves 2-5; split 30.6→6a/6b; added 30.9
epic_worktree:   .worktrees/epic-30   branch: feature/epic-30 (off main @98e8290)
started:         2026-07-12
```

## Re-waved plan (post-reassessment)
```
Wave 1:  30.1 (gate) | 30.4 (Demerzel) | 30.5 (spike)          << MERGED
Wave 2:  30.2 (guard) | 30.6a (wizard) | 30.9 (cline refactor) << MERGED
Wave 3:  30.3 (bump 6.10.0) | 30.6b (stage+install subset)     << RUNNING
Wave 4:  30.7 (persist/re-enumerate)          [needs 30.6b]
Wave 5:  30.8 (release gate)                  [needs 30.3 + 30.4 + 30.7]
```

## Story states
| Story | Status | Fix rds | Note |
|-------|--------|---------|------|
| 30.1  | merged | 0 | GATE **PASS** — 4 P5-8 assumptions verified vs live 6.10.0. d59d160 |
| 30.4  | merged | 1 | Demerzel deprecated non-destructive; installer.js untouched; 6.10.0 fail-loud constraint test-guarded (46 skills). 7 commits |
| 30.5  | merged | 0 | SPIKE → enumerate-then-stage-locally (PoC passes); --modules can't subset; CustomModuleManager pinned-internal. 89064e4 |
| 30.2  | merged | 0 | Closed allowlist + shape-flip HALT + two-sided set-equality guard (diffBundleSet). Pin left 6.9.0. 59c6d19 |
| 30.6a | merged | 1 | Enumerate adapter + wizard multiselect; local-bare-repo clone test (offline). Handoff contract to 6b. 65d13b1 |
| 30.9  | merged | 0 | Cline registry refactor — installer.js cline literals → injectionStrategy fields; #3.3 now green, no Cline regression. fa41b5c |
| 30.3  | running | - | bump 6.9.0→6.10.0; rebuild cache/plugin; prove exactly-5 + bmad-loop absent at 6.10.0 |
| 30.6b | running | - | prune+stage+install subset; 6.10.0 fail-loud invariants (non-empty/unique leaves); Cline reconcile |
| 30.7  | pending | - | persist marketplace URL + selected codes + SHA pin; re-enumerate/reconcile |
| 30.8  | pending | - | release gate: docs + offline E2E + semver cut |

## Integration & gate log
- Wave 1 merged (98bcda4/33d1bf3/377f998); gate PASS (build ✓, only pre-existing cline failure — now fixed by 30.9).
- Wave 2 merged: 30.9 (agent-injection-strategy now fully green), 30.2 (guard tests 19/19; pin still 6.9.0), 30.6a (custom-marketplace tests green, build drift-clean).
- npm install run in epic worktree (worktrees lack node_modules); atlas.cjs prepare-churn reverted each time; temp build dirs cleaned.
- Recovery: 30.6a stalled once on a network git-clone in its live-clone test → recovered with a local bare-repo fixture (offline, timeouts).

## Log
- 2026-07-12 — Wave 1 gate-first: 30.1 PASS, 30.4/30.5 done, integrated. User approved Waves 2-5 (gated at publish/PR), 30.6→6a/6b split, 30.9 folded in.
- 2026-07-12 — Wave 2 complete + integrated (30.2/30.6a/30.9). Wave 3 spawned (30.3 bump, 30.6b subset-install).
