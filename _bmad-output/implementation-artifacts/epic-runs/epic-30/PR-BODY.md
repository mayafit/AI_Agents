# feat(epic-30): BMAD v6.10.0 Integration

Adopts `bmad-method` v6.9.0 → **v6.10.0** in the air-gapped bundle while preserving deterministic, exactly-five offline modules and zero core modifications — and adds an opt-in custom marketplace-source install path plus a non-destructive Demerzel (ML Scientist) deprecation.

Planning: PRD **F25 / FR235–FR247 / NFR70–NFR75**; Architecture **Decision P5-8**. Sprint tracking + run ledger: `_bmad-output/implementation-artifacts/epic-runs/epic-30/`.

## Three threads

1. **6.10.0 bundle safety** — v6.10.0 adds `bmad-loop` as a `type: bmad-org` marketplace-plugin and marks `bmad-automator` deprecated. The old filter would force-bundle `bmad-loop` onto air-gapped boxes. Fixed with a **closed-by-default allowlist** (only `{tea,bmb,cis,gds,wds}`), a **two-sided set-EQUALITY guard** (`diffBundleSet`, fails on missing AND extra), and a **shape-flip HALT**. `bmad-loop` is opt-in only; ma-agents' own `bmad-dev-epic` remains the default air-gapped orchestrator.
2. **Opt-in custom marketplace source** — `--bmad-custom-source` + wizard: enumerate (thin, version-pinned `CustomModuleManager` adapter) → multiselect → prune → stage locally → install subset via `./`-relative `--custom-source --yes` (reuses existing staging; no hand-rolled git) → persist + reconcile on update. Ambient creds only, no token handling; fails loud when unreachable.
3. **Non-destructive Demerzel deprecation** — removes `ma-agent-ml` + 12 `ml-*` + `bmm-demerzel` for **new** installs (source + generated plugin tree + `module-help.csv` + `marketplace.json.template` + `agents.js`/`skill-authoring.js`/`cli.js`); **existing installs untouched** (installer sweep lists unchanged); idempotent one-time notice. Supersedes FR193.

## Stories

| Story | Status | e2e | Fixes | Notes |
|-------|--------|-----|-------|-------|
| 30.1 Gate — live 6.10.0 registry | ✅ merged | n/a (spike) | 0 | **PASS** — all 4 P5-8 assumptions verified live |
| 30.2 Closed allowlist + set-equality guard | ✅ merged | pass | 0 | fail-closed proven; pin left 6.9.0 |
| 30.3 Bump → 6.10.0 + offline verify | ✅ merged | pass | 1 | exactly-5, bmad-loop absent (2 offline proofs) |
| 30.4 Deprecate Demerzel (non-destructive) | ✅ merged | pass | 1 | existing installs untouched; 6.10.0 fail-loud guarded |
| 30.5 Spike — subset install | ✅ merged | n/a (spike) | 0 | enumerate-then-stage-locally; CustomModuleManager pinned-internal |
| 30.6a Enumerate + wizard multiselect | ✅ merged | pass | 1 | offline live-clone test (local bare repo) |
| 30.6b Prune + stage + install subset | ✅ merged | pass | 0 | FR238 fail-loud guard; Cline reconcile |
| 30.7 Persist + re-enumerate/reconcile | ✅ merged | pass | 1 | caught real gate bug (isUpdate→bmadInstalled) |
| 30.8 Release-gate docs/E2E/traceability | ✅ merged | pass | 0 | README + traceability + offline runbook + CHANGELOG |
| 30.9 Cline registry refactor (folded in) | ✅ merged | pass | 0 | removed installer.js cline literal; #3.3 green |

## Review & gate

- **Epic adversarial review (Opus):** NO blocking findings. 1 major + 4 minor — **all remediated** (commit `cb71093`): NFR75 preservation-invariant guard test, FR243 allowlist-non-leak test, stale wds-retired assertion fixed, SHA-pin honesty documented, 9 epic test files registered in the `npm test` chain.
- **Package-integrity gate:** `npm run build:plugin` ✓ · bundle-drift ✓ clean · 19/19 touched+new test files green · **zero baseline reds remaining**.
- **Test discipline:** run per-file (bare `npm test` halts at the long-standing MIL-498 CRLF position-13 on Windows — pre-existing, not this epic). No CI workflow runs the unit suite; the offline-install / bundle-drift / multi-tool-smoke workflows are the automated gates.

## Beta

- Published (or ready): **`ma-agents@3.17.0-beta.0`** on dist-tag `beta`. Install to test: `npm i ma-agents@beta` (or `@3.17.0-beta.0`).
- Semver: **MINOR** (feature-additive; no breaking change to existing installs or CLI contract). Final `3.17.0` cut on merge.

## Blocked / follow-up (nothing hidden)

- **None blocking.** Fast-follow (optional, non-blocking): the FR243 & NFR75 gaps are now guarded by tests added in this PR; a full clean-Windows `docker --network none` E2E is documented as a runbook (`30-8-offline-e2e.md`) but was not executed in the dev sandbox (no Docker daemon) — recommend running it in CI/offline before the final `3.17.0` cut.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
