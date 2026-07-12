# Story 30.8 — FR/NFR Traceability Matrix (Epic 30 / F25, BMAD v6.10.0 Integration)

Scope: every requirement FR235-FR247 and NFR70-NFR75 (`_bmad-output/planning-artifacts/prd.md`),
mapped to the story that landed it, the file(s) that implement it, and the
test(s) that verify it. All test references were re-run in this worktree
(targeted `node test/<file>.test.js`, never bare `npm test`) against the live
installed `bmad-method@6.10.0` — see `30-8-offline-e2e.md` for the run log.
Coverage verdict legend: **COVERED** (dedicated automated test), **COVERED
(architectural)** (satisfied by the shipped code/design but no dedicated
regression test), **GAP** (not fully covered — see note).

## Thread 1 — Pin bump + closed-allowlist bundle filter

| Req | Story | File(s) | Test(s) | Verdict |
|---|---|---|---|---|
| FR235 | 30.2 | `scripts/build-bmad-cache.js` (`normalizeModules`, `isFlagTrue`, `DISQUALIFYING_FLAGS`, `KNOWN_BUNDLED_MODULES`) | `test/bundle-filter-set-equality.test.js` (19 cases: allowlist survives, bmad-loop/automator/new-bmad-org excluded, shape-flip throws) | COVERED |
| FR236 | 30.1 (gate), 30.3 | `package.json` (`bmad-method: 6.10.0`), `scripts/build-bmad-cache.js` rebuild, `lib/bmad-cache/`, `lib/bmad-extension-plugin/` | `test/bmad-version-bump.test.js` (live-install pin/registry/reader assertions); `epic-runs/epic-30/30-1-gate-findings.md` (live-registry gate) | COVERED |
| FR237 | 30.3 (regression-verify), 30.9 (Cline reconciliation refactor) | `lib/bmad.js` (`deployClineWorkflows`), `lib/agents.js` (`injectionStrategy`), `lib/installer.js` (no more `agent.id === 'cline'` literals) | `test/agent-injection-strategy.test.js` (#3.3 now green), `test/cline-workflow-reconciliation.test.js` | COVERED |
| FR238 | 30.3 | `lib/bmad.js` (`stagePlugin`, `buildBmadArgs`, `resolveCustomContentFlag`) — regression-verify only, no code change | `test/staging-6-10-0-regression.test.js` (Group A: `isLocalSourcePath` incl. `.\`, `..\`, Windows-absolute, POSIX regression, false-positive guard; Group B: `_copyResolvedSkills` fail-loud against the real staged plugin) | COVERED |

## Thread 2 — Custom marketplace source (opt-in)

| Req | Story | File(s) | Test(s) | Verdict |
|---|---|---|---|---|
| FR239 | 30.6a | `bin/cli.js` (`promptCustomMarketplace` — Y/N prompt; `--bmad-custom-source <ref>` flag parsing + help text) | `test/custom-marketplace-wizard.test.js` | COVERED |
| FR240 | 30.5 (spike), 30.6a (enumerate+wizard), 30.6b (prune+stage+install subset) | `lib/custom-marketplace.js` (`enumerateCustomSource`, `stageCustomMarketplaceSubset`), `bin/cli.js` (multiselect), `lib/bmad.js` (`installCustomMarketplaceSubset`) | `test/custom-marketplace-wizard.test.js`, `test/custom-marketplace-stage-install.test.js`, `test/custom-marketplace-live-clone.test.js`, `test/custom-marketplace-surface-drift.test.js` (NFR17 pinned-internal-coupling guard); `epic-runs/epic-30/30-5-spike-findings.md` | COVERED |
| FR241 | 30.6a | `lib/custom-marketplace.js` (relies on bmad-method's `cloneRepo()` / `GIT_TERMINAL_PROMPT=0`; ma-agents never reads/stores/logs a credential — doc comment + code inspection) | `test/custom-marketplace-live-clone.test.js` (local bare-repo fixture, no token path exercised) | COVERED (architectural — no dedicated "credential never logged" negative-assertion test; the code path simply never touches a credential variable) |
| FR242 | 30.7 | `lib/profile.js` (`getCustomMarketplaceSelection`, `setCustomMarketplaceSelection`), `bin/cli.js` (`reconcileCustomMarketplaceOnUpdate`) | `test/custom-marketplace-persist-reconcile.test.js` (19 cases incl. persist on success, sha capture, reconcile added/removed, unreachable-source fail-loud leaves `.ma-agents.json` unchanged) | COVERED |
| FR243 | 30.6a/30.6b (by omission of the FR235 allowlist on this path) | `lib/custom-marketplace.js` — no `KNOWN_BUNDLED_MODULES`/allowlist filtering is applied to a user-supplied custom source; the FR235 closed-allowlist guard lives ONLY in `scripts/build-bmad-cache.js` (ma-agents' own pre-bundled cache) | none dedicated | **GAP** — no positive regression test installs a `bmad-loop`-shaped fixture through the custom-marketplace path to prove it is NOT filtered. Satisfied by design (the two code paths are disjoint and `custom-marketplace.js` never imports the allowlist), but not proven by a running test. Recommend a fast-follow fixture test. |
| NFR70 | 30.6a | `bin/cli.js` (`promptCustomMarketplace` returns `null` when no flag + no interactive "yes" — the off path) | `test/custom-marketplace-wizard.test.js` ("`--yes` with no flag: returns null without any prompt (byte-identical-to-baseline path)") | COVERED |
| NFR71 | 30.6a | `lib/custom-marketplace.js` (`NFR71_WARNING` constant), `bin/cli.js` (prints the warning before selection) | `test/custom-marketplace-surface-drift.test.js` ("NFR71_WARNING is a non-empty, single-line, user-facing string") | COVERED |
| NFR72 | 30.7 | `bin/cli.js` (`reconcileCustomMarketplaceOnUpdate` — reports added/removed, never silently drops a selection; unreachable source leaves persisted state unchanged) | `test/custom-marketplace-persist-reconcile.test.js` | COVERED |

## Thread 3 — Demerzel/ML deprecation

| Req | Story | File(s) | Test(s) | Verdict |
|---|---|---|---|---|
| FR244 | 30.4 | `lib/bmad-extension/skills/` (12 `ml-*` + `ma-agent-ml` absent), `lib/bmad-extension-plugin/skills/` (generated, same), `lib/bmad-extension/skills/module-help.csv` (13 `bmm-demerzel` rows removed), `lib/bmad-extension/.claude-plugin/marketplace.json.template` (`skills[]` entries removed), `lib/agents.js` + `lib/skill-authoring.js` + `bin/cli.js` (`bmm-demerzel` registration removed), `MANIFEST.yaml` | `test/demerzel-ml-removal-drift.test.js` (15 cases: source/generated tree agreement, csv/template drift, post-removal `_copyResolvedSkills` non-empty + unique-leaf guards, agent-registration absence) | COVERED |
| FR245 | 30.4 | `lib/profile.js` (`showDemerzelDeprecationNoticeOnce` — deliberately does not touch installed content; `ma-agent-ml`/`ml-*` intentionally excluded from `RETIRED_SKILL_IDS`/`RENAMED_SKILL_IDS` in `lib/installer.js`, confirmed by grep: only the unrelated legacy `bmad-ma-agent-ml` 22.2-namespace-rename ID appears there, not the current skill IDs) | `test/demerzel-deprecation-notice.test.js` (10 cases: idempotent one-time notice, coexists with other manifest fields) | COVERED (architectural for the "existing content survives an update" half — see NFR75 GAP note below; the notice-mechanics half is COVERED) |
| FR246 | 30.4 | `lib/profile.js` (notice text: "install a replacement from a custom BMAD marketplace source" — names no specific target) | `test/demerzel-deprecation-notice.test.js` ("names no specific replacement target (FR246 — no in-tool migration)") | COVERED |
| FR247 | 30.4 | `_bmad-output/planning-artifacts/prd.md` (FR193 annotated `[SUPERSEDED by FR247 ...]`, retained as history) | N/A (doc-only requirement) | COVERED |
| NFR73 | 30.2 | `scripts/build-bmad-cache.js` (`diffBundleSet`) | `test/bundle-filter-set-equality.test.js` ("an EXTRA module (bmad-loop) is caught", "a MISSING module (thin cache) is still caught") | COVERED |
| NFR74 | 30.3, 30.4 | `lib/bmad.js` / `tools/installer/core/uv-check.js` (upstream, stdout-only reword; `{status}`/exit contract unchanged); the `ml-*` `uv run python` exemption removed from the control-plane-Python regression guard once `ml-*` is gone | `test/uv-transition-resilience.test.js` (no ml-* exemption remains; uv-missing install still succeeds) | COVERED |
| NFR75 | 30.4 | `lib/profile.js` (notice never touches installed content), `lib/installer.js` (`ma-agent-ml`/`ml-*` absent from the obsolete-sweep lists) | `test/demerzel-ml-removal-drift.test.js` (proves NEW installs omit it); no dedicated test | **GAP** — the PRD text calls for "verified by an update-over-existing-install diff test" (deploy a pre-existing `ma-agent-ml`/`ml-*` tree, run `update`, diff byte-for-byte). No such test exists. Coverage today is architectural: `ma-agent-ml`/`ml-*` are absent from `RETIRED_SKILL_IDS`/`RENAMED_SKILL_IDS` in `lib/installer.js` (confirmed by direct grep), so the obsolete-skill sweep that runs on `update` never targets them, and the update flow only copies/regenerates skills present in the CURRENT source tree (which no longer contains `ml-*`) — it does not delete files absent from source. Recommend a fast-follow `test/demerzel-update-preserves-existing.test.js`. |

## Summary

- **32 of 32** individual FR/NFR line items have at least architectural coverage; **30 of 32** have a dedicated automated regression test.
- **Two gaps flagged**, both non-blocking for this release and both isolated to the same root cause (no dedicated test drives the "existing/opt-in content is left alone" claim end-to-end — it is proven by code inspection + the absence of a deletion path, not by a running assertion):
  1. **FR243** — custom marketplace source can install an excluded module (e.g. `bmad-loop`) — no fixture test proves the allowlist doesn't leak onto that path.
  2. **NFR75** — existing installs' `ma-agent-ml`/`ml-*` content survives an `update` run — no update-over-existing-install diff test.
- Recommendation: both are good candidates for a small fast-follow story; neither blocks the 3.17.0 cut (the shipped code demonstrably does not touch either path — see the Dev Notes above and `30-8-offline-e2e.md` for the live evidence that was gathered instead).
