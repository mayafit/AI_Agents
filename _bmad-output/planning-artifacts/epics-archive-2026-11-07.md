# Epics no longer in force, kept verbatim as history

## Epic 32: BMAD v6.12.4 Currency — Latest-Only, No Shims (Phase 5)

*SUPERSEDED 2026-11-07 — cancelled before any story started; succeeded by **Epic 36** (v7 Gate — Pin, Prove Offline, Qualify) (Sprint Change Proposal 2026-11-07, `sprint-change-proposal-2026-11-07.md`; Decision P5-11 supersedes P5-10). BMAD v7 replaces the v6.12.4 mechanics this epic was written in. The text below is kept unchanged as history.*

**Goal:** Move ma-agents from bmad-method v6.10.0 to **v6.12.4 in one hop**, adopting the v6.12 skill catalog directly — no `--shims`, no parallel version support — and get the existing monolith green against it **before** any decomposition starts. Everything in Epics 33–35 carves skills that must already target the v6.12 pipeline; carving first would port them twice.

**Value:** Restores platform currency after two structural upstream releases (v6.11.0 Phase-4 replacement, review-family merge, `uv` mandate; v6.12.0 `persistent_facts` empty, `{diff_file}`, shims opt-in) and deletes three ma-agents skills that shadow upstream names now that upstream converged on our sprint schema.

**Source:** `bmad-6.11-6.12-impact-analysis.md` (source-verified delta; its §7 `--shims` route is declined per FR271 / P5-10.5). PRD F27 (FR275–FR278). Decision P5-10.5, P5-10.6.

**Dependencies:** Epic 30 (v6.10.0 — done), Epic 31 (done; its owned TOML and `AGENTS.md` writer are validated here). Release 3.18.1 already resolved two former blockers (`gds`/`wds` unbundled; `module-help.csv` on the current schema).

**Execution order:** Gate-first, mirroring Epics 27/28/30.
- Wave 0 — **32.1 gate spike** against a scratch `bmad-method@6.12.4`: registry path/schema; `--shims` semantics under `--yes` (to omit it deliberately); `uv run` under `--network none` with a pre-seeded cache; AGY `.agents/skills` collision; `removals.txt` behaviour on update; upstream `sprint_plan.py` schema vs ours. Verdict PASS/STOP → `epic-runs/epic-32/32-1-gate-findings.md`, plus a separate 32.4 GO/HOLD line driven by the `sprint_plan.py` schema verdict (readiness C-1).
- Wave 1 — 32.2 uv policy inversion (FR277: implement the already-applied FR213/NFR74/NFR59c supersession, invert `test/uv-transition-resilience.test.js`, `uv run` in owned skill guidance) ∥ 32.3 cache rebuild at the v6.12.4 pins (tea v1.27.2, cis v0.3.2, bmb) + `BMAD_TARGET_VERSION` + `package.json` pin.
- Wave 2 — 32.4 delete shadowed `bmad-dev-story` / `bmad-sprint-planning` / `bmad-sprint-status` (manifests, help rows, marketplace enumeration, Cline wrapper reconciliation) ∥ 32.5 rewrite `bmad-dev-epic` against `bmad-build` / `bmad-build-auto` / `bmad-code-review` / `bmad-review` / `bmad-walkthrough`.
- Wave 3 — 32.6 retired-name sweep (`bmad-create-story`, `bmad-dev-story`, `bmad-shard-doc`, `bmad-index-docs`, `bmad-agent-tech-writer`, `bmad-check-implementation-readiness`, research trio) across skills, `module-help.csv`, `MANIFEST.yaml`, docs, training deck — needs 32.4 + 32.5 merged (its zero-hit guard and the `.agents/skills/` regeneration depend on them; readiness C-5) ∥ 32.7 owned-TOML validation (FR278: parse, undefined vars, explicit `persistent_facts`, `{diff_file}`) ∥ 32.8 `AGENTS.md` two-writer integration test.
- Wave 4 — 32.9 release gate: offline install under `--network none` with `uv` in the loop; multi-tool smoke (NFR52); semver cut; CHANGELOG.

**FR Coverage:** FR271, FR275, FR276, FR277, FR278, FR279 (Node engines, added 2026-10-31 by the readiness review); supersedes FR236; inverts FR213, NFR74, NFR59(c). Re-asserts NFR2/NFR50/NFR57/NFR58 with `uv` in the loop.

**Out of scope:** any file move into the extension repository (Epic 33); overlay design (Epic 34); adding Polytoken/Grok/ZCode/AGY as first-class ma-agents targets (P5-6(d) stands); `bmad-loop` bundling (FR235 stands).

---

## Epic 33: Extension Monorepo & Clean Carve-outs (Phase 5)

*SUPERSEDED 2026-11-07 — cancelled before any story started; succeeded by **Epic 37** (Carve-outs as v7 Modules) (Sprint Change Proposal 2026-11-07, `sprint-change-proposal-2026-11-07.md`; Decision P5-11 supersedes P5-10). BMAD v7 replaces the v6.12.4 mechanics this epic was written in. The text below is kept unchanged as history.*

**Goal:** Stand up the `ma-bmad-extensions` repository — one `.claude-plugin/marketplace.json`, N plugins, per-module `module.yaml` + `module-help.csv` + `module_version`, `shared/` text rendered at build, drift gate and offline PluginResolver passthrough test **per module** — and carve out the three zero-coupling modules: `ma-knowledge`, `ma-standards`, `ma-ops-agents`.

**Value:** Proves the repository shape and the independent-installability contract (FR269, NFR84) on modules that touch no other module and no sprint or knowledge-store state, before the only phase with real design (Epic 34) begins.

**Dependencies:** Epic 32 release gate PASSED (hard gate, P5-10.8). Epic 29 (Atlas engine — done), Epic 20 (SQA — done), Epic 15 (skill-folder agents — done).

**Execution order:**
- Wave 0 — 33.1 repository scaffold: marketplace template with `${version}` per plugin, `modules/`, `shared/`, `scripts/build.js` generalised from `scripts/build-plugin.js` (sorted copy, SKILL.md fail-fast, symlink refusal, per-module SHA-256 digest), CI drift gate per module, offline passthrough test driving the real PluginResolver per module against the pinned bmad-method.
- Wave 1 — 33.2 `ma-knowledge`: move `bmad-knowledge` + `lib/knowledge-atlas/dist/atlas.cjs` into the skill's `scripts/`; replace `require.resolve('ma-agents/…')` with a relative path; port the 13 `knowledge-atlas-*` tests ∥ 33.3 `ma-standards`: move the root `skills/` tree; add `ma-standards-setup` (injects the always-load rule block into `AGENTS.md` / `.roomodes` / `.clinerules` / copilot instructions, marker-delimited, idempotent); port `instruction-block*`, `agents-md`, `roomodes`, `clinerules` tests.
- Wave 2 — 33.4 `ma-ops-agents`: move the four personas (`customize.toml` `[agent]` section intact — it is the persona-picker signal), the 22 family skills, `mil498-*` (templates relocated into each skill's `assets/`), Docker/cert skills and `bmad-dev-epic` (as rewritten in 32.5); unique leaf names verified; port `ma-agent-persona-picker`, `bmad-persona-phase-prefix`, `convert-agents-to-skills` tests.
- Wave 3 — 33.5 release gate: each of the three modules installs **alone** on a clean machine via `npx bmad-method install --custom-source <repo> --modules bmm --tools claude-code,copilot,cline,roo-code,kilocode --yes` with no ma-agents package present; first tags cut per module.

**FR Coverage:** FR268, FR269, FR270, NFR84, NFR85 (for the three modules). FR104–FR106 re-satisfied per module.

**Out of scope:** `ma-sprint`, `ma-atlassian` (Epic 34); any change to the `ma-agents` npm package beyond pointing its tests at the new repo (Epic 35). During this epic the npm package continues to ship the monolith — the two coexist until Epic 35.

---

## Epic 34: Sprint Extension & Atlassian Overlay (Phase 5)

*SUPERSEDED 2026-11-07 — cancelled before any story started; succeeded by **Epic 38** (Atlassian on Sofia and the Handoff Slots); `ma-sprint` is not carved (Sprint Change Proposal 2026-11-07, `sprint-change-proposal-2026-11-07.md`; Decision P5-11 supersedes P5-10). BMAD v7 replaces the v6.12.4 mechanics this epic was written in. The text below is kept unchanged as history.*

**Goal:** Deliver `ma-sprint` (backend-agnostic sprint and backlog skills with a tracker hook point) and `ma-atlassian` (an overlay that binds Jira and Confluence behaviour into every installed target — upstream and ours — through generated `_bmad/custom/<skill>.toml` overrides, asks its own config questions, and ships the F26 deliverables as in-skill scripts). This is the only epic with new design.

**Value:** Jira and Confluence become a BMAD extension anyone can add to a plain bmad-method install, covering the skills upstream added since the original Jira/Confluence work (`bmad-build`, `bmad-build-auto`, `bmad-walkthrough`, `bmad-review`, `bmad-deep-recon`, `bmad-project-context`); the routing text that is pasted into 13 (Jira) and 17 (preflight) skills is maintained once.

**Dependencies:** Epic 33 (repository, build, per-module tests — done). Epic 31 (all Confluence behaviour and its 14 `project-layout-*` tests — moved, not rewritten). Epic 17 Story 17.22 (routing pattern — moved into the adapter). Epic 14 Story 14.2 closed as superseded.

**Execution order:**
- Wave 0 — 34.1 **design spike**: the hook contract (P2-11 amendment) proven on one `ma-sprint` skill and one upstream skill (`bmad-sprint-planning` v6.12) with a hand-written override; the version-keyed target table format (`references/targets.yaml`); confirm every target's `customize.toml` exposes the keys the overlay needs at v6.12.4. STOP if an upstream target has no usable hook.
- Wave 1 — 34.2 `ma-sprint`: move the nine sprint/backlog skills + `create-bug-story` + `story-status-lookup`; strip the Jira block and the knowledge-store preflight into `shared/`-rendered hook-point stubs; file-system behaviour unchanged byte-for-byte on a file-system project ∥ 34.3 `ma-atlassian` adapters: `references/jira-tracker.md` (routing block + identity clause + §6.3 mapping + failure contract, verbatim from the skills) and `references/confluence-store.md` (Epic 31 preflight B1–B3, verbatim).
- Wave 2 — 34.4 `ma-atlassian-setup`: `module.yaml` config questions (`jira_url`, `jira_project_key`, `confluence_space`, `confluence_root_page`); generator walking the target table, marker-delimited idempotent overrides, shim exclusion, bind-time report of unbound targets/keys at exit ≠ 0 (FR273) ∥ 34.5 F26 scripts relocated: binding stamp, `project-layout.yaml` writer, generated-config derivation, Confluence page tree (`lib/confluence-page-tree.js`), publish-hook generator (`lib/confluence-publish-hook.js`) → `ma-atlassian-setup/scripts/`; `bind`, `confluence-plan`, `confluence-record-root-page`, `my-next-issue` as skills; the 17-skill preflight's exact-stamp check repointed from `ma-agents/bin/cli.js` to the in-skill script (FR270).
- Wave 3 — 34.6 port tests: 14 `project-layout-*`, `jira-identity-clause`, `release-gate-epic-31` subset; new tests for the target table (every v6.12.4 target present in the vendored upstream tree, no `v6-shims/` entry, every ma-sprint skill bound) ∥ 34.7 release gate (release 1): `ma-sprint` alone = file-system behaviour; `ma-sprint` + `ma-atlassian` on a Jira-bound project = today's behaviour; `ma-atlassian` alone on a plain bmad-method = upstream skills bound, ma-sprint targets reported absent (not failed).
- Wave 4 (release 2) — 34.8 `bmad-code-review → Jira transition` (new write path) ∥ 34.9 `bmad-correct-course → Confluence write` (new write path) ∥ 34.10 live Confluence MCP verification of the Epic 31 MCP-present branches (mock-verified until now — recorded in CHANGELOG 3.18.0 Known limitations).

**FR Coverage:** FR272, FR273 (new); FR139, FR140 (delivered as adapter); FR254–FR267, NFR79–NFR83 (delivery vehicle moved, text unchanged); FR268–FR270, NFR84–NFR85 for the two modules.

**Out of scope:** any backend other than `file-system`, `jira`, `confluence`; a Confluence mirror (FR266 stays retired); changing the unified sprint-status schema; Jira/Confluence config questions in the ma-agents wizard (they leave it in Epic 35).

---

## Epic 35: Thin Offline Installer (Phase 5)

*SUPERSEDED 2026-11-07 — cancelled before any story started; succeeded by **Epic 39** (Thin Offline Installer for v7 + Monolith Retirement) (Sprint Change Proposal 2026-11-07, `sprint-change-proposal-2026-11-07.md`; Decision P5-11 supersedes P5-10). BMAD v7 replaces the v6.12.4 mechanics this epic was written in. The text below is kept unchanged as history.*

**Goal:** Reduce the `ma-agents` npm package to its one remaining purpose — **offline, on-prem packaging** of bmad-method plus pinned copies of the five extensions — and remove every skill tree, extension source, Confluence/Atlas library and the custom-marketplace consumption feature from it.

**Value:** The air-gap promise is kept by one small package whose only job is to carry bytes and invoke the upstream installer; everything users actually run comes from the same extension repository online users install directly. Package size and the CLI shrink by an order of magnitude; the CI matrix shrinks to installer + injection + offline gate.

**Dependencies:** Epics 33 and 34 released (every extension tagged). Epic 21 (on-prem profile — done), Epic 26 (instruction-block guardrails — done).

**Execution order:**
- Wave 0 — 35.1 vendoring: `lib/extensions/` populated from one `ma-bmad-extensions` tag by a build script that records module versions in the cache manifest (NFR85); `stagePlugin()` generalised to stage N module directories and pass N local `--custom-source` paths (bmad-method ≥ 6.10 accepts Windows paths; relative POSIX form retained for safety).
- Wave 1 — 35.2 removals: `lib/bmad-extension/`, `lib/bmad-extension-plugin/`, `skills/`, `lib/knowledge-atlas/`, `lib/confluence-*.js`, `lib/custom-marketplace.js` (FR239–FR243 retired per FR274), `lib/bmad-workflows/`, `lib/mil498-templates/`, `mil498/`, the `bind` / `confluence-*` commands, the Jira/Confluence wizard questions (now module config); `package.json` `files[]`, `prepare`/`version` hooks and the test chain pruned ∥ 35.3 wizard retained surface: scope, profile, tools, module selection (`--bmad-modules`), extension selection (which of the five to stage — default all).
- Wave 2 — 35.4 offline release gate: the `npm pack --ignore-scripts` tarball installs all five extensions under `--network none` with `uv` pre-seeded; byte-identical `_bmad/<module>/` trees to an online `--custom-source <repo>@<tag>` install; multi-tool smoke (NFR52) ∥ 35.5 docs and training: README, QUICK_START, SKILLS_STRUCTURE, DEVELOPMENT, the training deck and `docs/` rewritten around six packages; the unmerged `docs/align-doc-set` branch rebased onto this and closed.
- Wave 3 — 35.6 semver **major** cut (4.0.0): the package no longer carries skills; CHANGELOG states what moved where and the exact `--custom-source` command for users who do not need offline packaging.

**FR Coverage:** FR274 (new); FR74–FR76, FR123–FR127 (bundled install, unchanged in intent); FR248–FR253 (install scope — unchanged); NFR20–NFR21, NFR77 re-asserted. Retires FR239–FR243.

**Out of scope:** retiring the on-prem profile or IDE injection (both stay — they are what the installer is for); adding new platform targets; any extension content change (belongs in the extension repository from here on).

### Epics 32–35 — Cross-Epic Notes

*SUPERSEDED 2026-11-07 — see "Epics 36–39 — Cross-Epic Notes" (Sprint Change Proposal 2026-11-07). Kept unchanged as history.*

- **Approval and sequencing record:** Sprint Change Proposal 2026-10-31 (`sprint-change-proposal-2026-10-31.md`), Decision P5-10. Epic 32 is a hard gate for 33; 33 for 34; 33 + 34 for 35. The gate is Epic 32's **release gate (32.9)**, not 32.1's spike verdict: no Epic 33 story (33.1–33.5) starts, and none overlaps any Epic 32 wave, before 32.9 records PASS (P5-10.8). *(Amended 2026-10-31, readiness C-3: an earlier clause letting 33.2/33.3 overlap 32's Waves 3–4 on a 32.1 PASS was removed — it contradicted P5-10.8.)*
- **Stories are not written here.** Per the correct-course handoff, `bmad-create-epics-and-stories` authors the story files for each epic in turn; the wave lists above are the scope contract they must cover.
- **Numbering:** `epics.md` previously topped out at Epic 31; `sprint-status.yaml` carries `epic-30` (shipped, never written into this file — pre-existing drift). 32–35 are unused in both files.
- **For future readers:** the session that produced this change first argued for a `ma-core` module and for Atlassian owning the sprint skills; both were rejected (P5-10 *Rejected alternatives*). Do not reintroduce them.
