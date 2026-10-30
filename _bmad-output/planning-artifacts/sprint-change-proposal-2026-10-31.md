# Sprint Change Proposal — Break ma-agents into Independent BMAD Extensions

**Date:** 2026-10-31
**Prepared by:** Correct-Course workflow (user: Alon)
**Mode:** Batch
**Change scope classification:** **Major — fundamental replan (PM / Architect)**
**Baseline:** ma-agents 3.18.1 (`38ea256`), pinned to `bmad-method@6.10.0`; upstream at v6.12.4
**Companion input:** `bmad-6.11-6.12-impact-analysis.md` (branch `docs/bmad-6-11-6-12-impact-analysis`, unmerged) — the source-verified upstream delta this proposal builds on
**Applied 2026-10-31 (same PR, on the product owner's "go on"):** PRD F27/F28 (FR268–FR278, NFR84–NFR85), Decision P5-10, Epics 32–35, Story 14.2 closure, `sprint-status.yaml` registration. The ID ranges below were drafted as FR268–FR273 before the edits were applied; the final IDs are FR268–FR274 (F28, integration shard) and FR275–FR278 (F27, currency shard).

---

## Section 1 — Issue Summary

### Problem statement

ma-agents has grown into a single 62-skill BMAD module (`ma-skills`) wrapped in a 6,300-line installer CLI. Two forces now make that shape untenable:

1. **Upstream churn lands on everything at once.** BMAD-METHOD v6.11.0 and v6.12.0 (August–September 2026) cut the core skill catalog from fourteen to eight, replaced the Phase-4 implementation loop (`create-story` / `dev-story` → `build` / `build-auto`), merged six review skills into one, retired the tech-writer agent, moved customization to layered TOML, made `uv` + Python 3.11 a hard requirement, and shipped `persistent_facts` empty. Because every ma-agents skill shares one module and one installer, every one of those changes is a change to all of ma-agents.
2. **The package no longer matches its purposes.** ma-agents exists for three distinct reasons — (a) package and adapt BMAD for offline, on-prem installation; (b) enhance BMAD with our own agents, workflows and skills; (c) make the relevant BMAD workflows work against Jira and Confluence. Today a user who needs only (b) must install all of (a) and (c), and none of (b) or (c) can be installed on a plain `npx bmad-method install` without ma-agents.

### Decision (stakeholder, 2026-09-25 → 2026-10-30)

Break ma-agents into **independent BMAD custom-source extensions plus one thin offline installer**, with these constraints fixed by the product owner:

| Constraint | Decision |
|---|---|
| Dependencies between the extensions | **None.** Each installs alone on a vanilla BMAD. |
| Target bmad-method version | **Latest only (v6.12.4 at decision time).** No parallel version support, no `--shims` transition layer. Retired upstream workflows are replaced by their successors, not carried. |
| `uv` + Python 3.11 | **Accepted as a requirement**, including on on-prem images. Supersedes P5-6(c) / FR213 / NFR74. |
| `bmad-dev-epic` | **Kept.** It is agentic orchestration; upstream `bmad-loop` is a software orchestrator and is not a replacement. |
| MIL-STD-498 skills | Belong to Gadi (SQA) and ship with the ops agents. |
| Atlassian | An **overlay** that enhances whichever relevant BMAD workflows are installed (upstream and ours) to use Jira for sprint tracking and Confluence for knowledge, asking for URLs, project keys and space names at install. It must cover the skills upstream has added since the Jira/Confluence work was written. |

### Evidence

- Package shape: `lib/bmad-extension/skills/` carries one `module.yaml` (`code: ma-skills`) and 62 skill directories; `bin/cli.js` is 6,273 lines after Epic 31 (was ~2,100 before); `lib/bmad.js` 3,889; `lib/installer.js` 2,895; `lib/confluence-publish-hook.js` 1,781; `lib/confluence-page-tree.js` 925.
- Jira support is a routing block pasted into 13 ma-agents skills (`tracking_system` → `file-system` | `jira`), plus `my-next-issue` and the identity clause (`assignee = currentUser()`).
- Confluence support (Epic 31, v3.18.0): two-store binding spine (`project-layout.yaml` → generated `config.yaml` + staleness stamp), three CLI commands (`bind`, `confluence-plan`, `confluence-record-root-page`), generated `_bmad/custom/<skill>.toml` publish hooks for five upstream authoring skills, and a knowledge-store preflight block pasted into 17 skills.
- Upstream v6.12.4 (verified from the git tree at the tag): `module.yaml` + `module-help.csv` + `.claude-plugin/marketplace.json` + `plugin-resolver.js` are **unchanged** — the extension *format* survives; the skill *catalog* does not (see Section 2, Technical Impact).
- Three ma-agents skills shadow upstream names (`bmad-dev-story`, `bmad-sprint-planning`, `bmad-sprint-status`); at 6.12 two are `v6-shims/` forwards and the third was rebuilt around `sprint_plan.py` — which preserves `project_key`, `tracking_system`, `story_location`, i.e. upstream converged on our Epic 17 schema.
- 3.18.1 already resolved two items the earlier analysis listed as blockers: `gds`/`wds` are no longer bundled, and the `module-help.csv` header is on the current schema.

---

## Section 2 — Impact Analysis

### Epic impact

| Epic | Status | Impact |
|---|---|---|
| **31** Global Installation & Federated Knowledge Stores | done (v3.18.0) | Its Confluence deliverables (`bind`, page tree, publish hooks, preflight) **relocate** into the Atlassian extension as in-skill scripts. Not reopened. |
| **30** BMAD v6.10.0 Integration | done | Superseded by a v6.12.4 currency epic. `--shims` recommendation from the impact analysis is **declined** per the latest-only constraint. |
| **29** Knowledge Atlas | done | Engine relocates into `ma-knowledge`; the `require.resolve('ma-agents/…')` launch path must become a relative in-skill script path. |
| **22 / 27 / 28** plugin migration and currency epics | done | The `build-plugin` / marketplace staging pattern is retained and generalised to N plugins in one marketplace. |
| **20** SQA agent, **mil498** workflows | done | Move together into `ma-ops-agents`. |
| **17** Sprint model, **14** Jira backend | done / deferred | Jira routing text leaves the sprint skills and becomes the Atlassian adapter reference; sprint skills gain overlay hook points. Epic 14 Story 14.2 (Confluence MCP) is **closed as superseded** by Epic 31 + this proposal. |
| **DS.1** design-studio disposition | in-progress | Unaffected; already shipped in 3.18.0/3.18.1. |

**New epics required (numbering continues from 31):**

- **Epic 32 — BMAD v6.12.4 Currency (latest-only, no shims).** Pin bump, cache rebuild (tea v1.27.2, cis v0.3.2, bmb), uv/Python policy inversion, deletion of the three shadowed skills, `bmad-dev-epic` rewrite against `bmad-build` / `bmad-build-auto` / `bmad-code-review` / `bmad-review` / `bmad-walkthrough`, reference sweep for removed skills, `AGENTS.md` two-writer test, owned-TOML validation. **Gate for everything below.**
- **Epic 33 — Extension Monorepo and Clean Carve-outs.** New repository with one `marketplace.json` → N plugins, per-module `module.yaml` versions, shared-text generation, drift gate and offline passthrough test ported per module; carve `ma-knowledge`, `ma-standards`, then `ma-ops-agents`.
- **Epic 34 — Sprint Extension and Atlassian Overlay.** Strip Jira routing and knowledge-store preflight into adapter references; hook points in `ma-sprint`; Atlassian setup skill + target table + config questions; `bind` / `confluence-plan` / `confluence-record-root-page` / page-tree / publish-hook generator as in-skill scripts; second release adds the two new write paths (code-review → Jira transition, correct-course → Confluence).
- **Epic 35 — Thin Offline Installer.** Reduce the `ma-agents` npm package to: pinned `bmad-method`, module cache, pinned extension copies, stage-and-invoke, IDE rule injection, on-prem profile. Remove custom-marketplace consumption and all skill content from the package.

**Sequencing:** 32 → 33 → 34 → 35. Epic 32 is a hard gate: carving skills that still target the retired Phase-4 loop would port them twice.

### Story impact

No in-flight stories. All open work in `sprint-status.yaml` is done or cancelled; the backlog is empty. New stories are created under Epics 32–35 by `bmad-create-epics-and-stories`; this proposal does not author them.

### Artifact conflicts

**PRD** (`prd.md` + `prd/capabilities/*.md`):

- `bmad-integration-and-bundling.md` — **F4 BMAD Extension Architecture** currently describes one extension module; needs amending to N independent extensions + one installer. FR104–FR106 (extension module), FR123–FR127 (bundled install) amended; new FRs for "each extension installs on vanilla BMAD with `--custom-source`" and "no inter-extension dependency".
- `bmad-platform-currency.md` — **FR236** (pin at 6.10.0) superseded; **FR213 / NFR74 / NFR59c** (control-plane Python never `uv run`) **inverted**; new F27 capability thread "v6.12.4 (current)" at the top, latest-only policy stated as a requirement.
- `sprint-and-backlog-management.md` — FR65–FR71, FR128–FR140: sprint skills become backend-agnostic with hook points; Jira behaviour is specified as the overlay's adapter, not as a branch inside each skill.
- `project-knowledge-and-repository-layout.md` — F26 (FR254–FR267): no requirement text changes; the **delivery vehicle** changes from the ma-agents CLI to the Atlassian extension's scripts. Add a note that `bind` and the preflight no longer reference `ma-agents/bin/cli.js`.
- `agent-personas-and-ide-targets.md` / `quality-assurance.md` / `methodology-and-sdlc-workflows.md` — packaging note only: personas, SQA and MIL-STD-498 ship in `ma-ops-agents`.
- `vision-and-system-context.md` — System Overview gains the package map.

**Architecture** (`architecture.md` + `architecture/decisions/*.md`):

- New **Decision P5-10 — Extension decomposition and thin installer** (next free ID per the register). Supersedes P2-3/P2-9's single-module structure, P4-1's single-plugin marketplace, P5-6(c) (uv boundary), and the "ma-agents owns the wizard" assumption in P2-6 and P5-9. Records the overlay mechanism (generated `_bmad/custom/<skill>.toml` overrides + adapter references + version-keyed target table) as the only sanctioned way an extension reaches into another skill.
- `structure-and-boundaries.md` — directory structure rewritten for the monorepo and the slimmed npm package.
- `implementation-patterns.md` — add "shared text is generated, never depended on", "skill directory names unique across all extensions", "extension scripts are in-skill, run via `uv run` or `node`, never `require('ma-agents/...')`".
- `sprint-and-backlog-management.md` (P2-11) and `mcp-detection-pattern-spec.md` — the routing pattern becomes a reference the overlay installs, with the hook contract specified.

**UI/UX:** N/A — no UX artifacts in this project.

**Other artifacts:**

- `test/` — 101 files; the extension-contract tests (`plugin-manifests`, `build-plugin`, `v68-pluginresolver-enumeration-passthrough`, `bmad-extension`, `extension-module-restructure`) become per-module; the 14 `project-layout-*` and `jira-identity-clause` tests move with the Atlassian extension; custom-marketplace tests are removed with the feature.
- CI — Bundle Drift Guard and offline-install verify move to the monorepo and run per module; the npm package's CI shrinks to the installer.
- `README.md`, `QUICK_START.md`, `SKILLS_STRUCTURE.md`, `DEVELOPMENT.md`, training deck — rewritten around six packages. (The unmerged `docs/align-doc-set` branch should be rebased on top of this change, not merged ahead of it.)
- `.github/scripts/offline-install-verify.sh` — now exercises `--custom-source` with multiple local paths and `uv` under `--network none`.

### Technical impact

| Area | Change |
|---|---|
| Upstream catalog | Jira overlay targets at 6.12: `sprint-planning`, `build`, `build-auto`, `code-review`, `correct-course`, `retrospective`, `walkthrough`. Confluence targets: `prd`, `architecture`, `create-epics-and-stories`, `ux`, `product-brief`, `prfaq`, `spec`, `project-context`, `deep-recon`, `review`. All `v6-shims/` excluded so nothing binds twice. |
| Shadowed skills | `bmad-dev-story`, `bmad-sprint-planning`, `bmad-sprint-status` (ours) deleted. Upstream's `sprint_plan.py` core is adopted; our nine sprint/backlog skills that upstream has no equivalent for stay. |
| Runtime | Node ≥ 20.12 (upstream engines), `uv` + Python ≥ 3.11. In-skill scripts replace `bin/cli.js` for binding, page tree, publish hooks. |
| Customization keys | `persistent_facts` must be stated explicitly in every owned override; review overrides use `{diff_file}`. |
| Naming | Skill directory names unique across all six packages (IDE skill folders are flat; 6.10+ aborts on duplicate leaf names). |
| Offline | Air-gap guarantee covers `bmm`, `tea`, `bmb`, `cis` plus the vendored extension copies; `uv` must be pre-seeded on the image (now a stated prerequisite, not a spike). |

---

## Section 3 — Recommended Approach

**Option 1 — Direct adjustment:** Not viable. Adding stories to the existing single-module structure cannot deliver independent installability.

**Option 2 — Rollback:** Not viable. Nothing shipped is wrong; Epic 31's Confluence work is reused as-is, relocated.

**Option 3 — MVP / scope review:** **Selected, as a replan rather than a reduction.** The product's three purposes stay intact; what changes is the packaging that delivers them.

**Rationale:**

- Blast radius: with independent modules, an upstream rename reaches only the module that binds to it. Today it reaches all 62 skills.
- Installability: every extension works on a plain `npx bmad-method install --custom-source <src> --modules bmm`, online or offline, with or without the ma-agents installer.
- Deletion over defence: upstream converged on our sprint schema and now ships a scripted `sprint_plan.py`; adopting it removes three shadow skills and their routing copies.
- Latest-only keeps one code path. The `--shims` route from the impact analysis would have required maintaining two target tables and a scheduled shim-removal epic; the product owner has ruled it out.

**Effort:** High (four epics). **Risk:** Medium — the Atlassian overlay rides on upstream customization keys and skill identities, which have churned twice in two months; mitigated by the setup skill validating every target and hook key at bind time and failing loud. **Timeline impact:** Epic 32 is the only one with a hard dependency on upstream; 33–35 are internal restructuring and can run in overlapping waves once 32 is green.

**Trade-offs accepted:**

- Six packages to version and release instead of one. Mitigated by a monorepo with one drift gate and per-module versions.
- The Atlassian overlay cannot be enforced as a manifest dependency (bmad-method reads no inter-module dependency field); it discovers targets at bind time instead.
- Confluence MCP-present paths remain mock-verified from Epic 31 until a live Confluence tool is available to Epic 34.

---

## Section 4 — Detailed Change Proposals

### 4.1 Target package map

| Package | Kind | Contents | Depends on |
|---|---|---|---|
| `ma-agents-offline` | npm (`ma-agents`) | pinned `bmad-method` 6.12.4; module cache (`bmm` built-in, `tea` v1.27.2, `bmb`, `cis` v0.3.2); pinned copies of the five extensions; stage-and-invoke (`--custom-source <local paths>`); IDE rule injection; on-prem profile; Windows delete-retry | — |
| `ma-ops-agents` | extension | Alex (SRE), Amit (DevOps), Yael (Cyber), Gadi (SQA) and their 22 family skills; `mil498-*` (8) + templates; Docker hardening, image signing, self-signed certs; `bmad-dev-epic` | — |
| `ma-sprint` | extension | `add-sprint`, `add-to-sprint`, `modify-sprint`, `remove-from-sprint`, `close-sprint`, `cleanup-done`, `generate-backlog`, `prioritize-backlog`, `sprint-status-view`, `create-bug-story`, `story-status-lookup`; file-system backend; overlay hook points | — |
| `ma-atlassian` | extension (overlay) | `module.yaml` config questions (Jira URL, project key; Confluence space, root page); setup skill generating `_bmad/custom/<skill>.toml` for every installed target; Jira tracker adapter reference; Confluence store adapter reference; `my-next-issue`, `bind`, `confluence-plan`, `confluence-record-root-page` with page-tree, binding-stamp and publish-hook scripts in-skill | discovers targets at bind time; no install dependency |
| `ma-knowledge` | extension | `bmad-knowledge` + Atlas engine (`atlas.cjs`) as an in-skill script | — |
| `ma-standards` | extension | `cpp-*`, `csharp-*`, `python-*`, `js-ts-*`, `cmake-*`, `logging-*`, `opentelemetry-*`, `vercel-react-*`, `code-documentation`, `git-workflow-skill`, `code-review`, `commit-message`, `ai-audit-trail`, `test-*`, `auto-bug-detection`, `document-revision-history`, `skill-creator`; setup skill that injects the always-load rule block into `AGENTS.md` / `.roomodes` / `.clinerules` / copilot instructions | — |

Repository: one monorepo (`ma-bmad-extensions`), one `.claude-plugin/marketplace.json` listing five plugins (discovery mode → installer picker), one `module.yaml` + `module-help.csv` + version per module, `shared/` canonical text generated into each module at build with a prerelease gate that fails on drift.

### 4.2 PRD edits (in place)

```
prd/capabilities/bmad-integration-and-bundling.md
  F4 "BMAD Extension Architecture"
  OLD: ma-agents ships one extension module (ma-skills) staged as a local
       custom source by the ma-agents installer.
  NEW: ma-agents ships N independent extension modules from one marketplace
       repository. Each installs on an unmodified bmad-method via
       `--custom-source` with no dependency on any other extension or on the
       ma-agents installer. The installer is a thin offline packaging of the
       same extensions.
  + FR268 Each extension installs and operates on a vanilla bmad-method install.
  + FR269 No extension declares or requires another extension at install time.
  + FR270 The ma-agents npm package vendors pinned copies of the extensions and
          performs no project-scoped work the extensions' own setup skills perform.

prd/capabilities/bmad-platform-currency.md
  FR236  pin at v6.10.0            → SUPERSEDED: pin at v6.12.4 (F27, current)
  FR213 / NFR74 / NFR59c           → INVERTED: ma-agents-owned skills call shared
                                      `_bmad/scripts/*.py` via `uv run`; `uv` + Python 3.11
                                      are stated prerequisites, including on-prem.
  + FR271 ma-agents targets exactly one bmad-method version — the latest the team has
          qualified — and does not install or maintain upstream `v6-shims`.

prd/capabilities/sprint-and-backlog-management.md
  FR128–FR140 routing clause  → each sprint skill exposes a tracker hook point
                                 (default file-system); the Jira branch is specified
                                 once as the Atlassian adapter (FR272) and bound by
                                 override, not pasted per skill.

prd/capabilities/project-knowledge-and-repository-layout.md
  F26 delivery note: `bind`, the preflight and the publish-hook generator are
  delivered by the Atlassian extension's in-skill scripts; no skill references
  `ma-agents/bin/cli.js`. Requirement text unchanged.
  + FR273 The Atlassian overlay binds every installed target skill in a
          version-keyed table and reports targets or hook keys it could not bind.
```

### 4.3 Architecture edits

```
architecture.md register
  + P5-10 | Extension decomposition, overlay mechanism and thin installer
          | FR268–FR273, FR236 (superseded), FR213/NFR74 (inverted)
          | 2026-10-31 · supersedes P2-3/P2-9 (single module), P4-1 (single
            plugin), P5-6(c) (uv boundary); amends P2-6, P2-11, P5-9

architecture/decisions/bmad-integration-and-bundling.md
  + Decision P5-10 body: package map (4.1), monorepo layout, shared-text
    generation, per-module versioning, drift gate per module, offline vendoring.

architecture/decisions/sprint-and-backlog-management.md (P2-11)
  + "Hook contract": `[workflow] tracker = "file-system"`, `activation_steps_prepend`
    slot; adapter reference path; shim exclusion rule.

architecture/implementation-patterns.md
  + Shared text is generated, never depended on.
  + Skill directory names unique across all extensions.
  + Extension scripts are in-skill (`uv run` / `node`), never `require('ma-agents/…')`.
  + Overlay targets keyed by upstream version; bind-time validation fails loud.

architecture/structure-and-boundaries.md
  Directory structure: replace the single `lib/bmad-extension/` tree with the
  monorepo map and the slimmed `ma-agents` package.
```

### 4.4 Epics (new, appended to `epics.md`)

- **Epic 32 — BMAD v6.12.4 Currency, latest-only.** Gate spike (uv under `--network none` with pre-seeded cache; AGY `.agents/skills` collision; `removals.txt` handling on update), cache rebuild, pin bump, uv policy inversion + test-guard inversion, delete shadowed skills, rewrite `bmad-dev-epic` and `my-next-issue` "next steps" against the 6.12 catalog, owned-TOML validation, `AGENTS.md` two-writer test, release gate.
- **Epic 33 — Extension Monorepo and Clean Carve-outs.** Repo scaffold, N-plugin marketplace, per-module drift gate + passthrough test, `ma-knowledge` (relative script path), `ma-standards` (+ rule-injection setup skill), `ma-ops-agents` (+ mil498 templates relocated into skills, dev-epic).
- **Epic 34 — Sprint Extension and Atlassian Overlay.** Hook points in the nine sprint skills; adapter references; Atlassian `module.yaml` questions; setup skill + version-keyed target table + bind-time validation; relocate `bind` / `confluence-plan` / `confluence-record-root-page` / page tree / publish-hook generator to in-skill scripts; port the 15 Epic 31 tests. Release 2: code-review → Jira transition, correct-course → Confluence write, live-MCP verification.
- **Epic 35 — Thin Offline Installer.** Vendor pinned extension tag; multi-path `--custom-source` staging; remove custom-marketplace consumption, skill trees and `lib/bmad-extension*`; offline verify with `uv` in the loop; docs and training rewrite; close `docs/align-doc-set` by rebasing.

### 4.5 Stories closed or reframed

```
Epic 14 Story 14.2 (Confluence MCP Integration) — CLOSED: superseded by Epic 31 +
  Epic 34. Recorded, not deleted.
bmad-6.11-6.12-impact-analysis.md — ACCEPTED as Epic 32 input with one amendment:
  §7 "install with --shims" is declined (latest-only constraint); §8's "separate
  Phase-4 convergence epic" is folded into Epic 32.
```

---

## Section 5 — Implementation Handoff

**Scope: Major — fundamental replan.** Routed to **PM (John)** and **Architect (Winston)**.

| Role | Responsibility |
|---|---|
| PM | Apply the PRD edits in 4.2 in place (new FR268–FR273, supersessions, F27 thread); append Epics 32–35 to `epics.md`; close Story 14.2; register the four epics in `sprint-status.yaml` as `backlog`. |
| Architect | Write Decision P5-10 and the P2-11 hook contract; update `structure-and-boundaries.md` and `implementation-patterns.md`. |
| Developer | Nothing until Epic 32 stories exist. Epic 32 is the gate; no carve-out starts before its release gate passes. |
| SQA (Gadi) | Audit that no skill in any extension references `ma-agents/bin/cli.js`, a `v6-shims/` name, or a duplicate leaf directory name before each extension's first tag. |

**Success criteria**

1. `npx bmad-method install --custom-source <monorepo> --modules bmm --tools claude-code --yes` on a clean machine installs any single extension with no ma-agents package present.
2. The same five extensions install from the `ma-agents` npm package under `--network none`, `uv` pre-seeded.
3. No skill named identically in two packages; no `v6-shims/` target bound; the Atlassian setup skill reports every unbound target by name.
4. `bmad-dev-epic` runs an epic end-to-end against the 6.12 `build` pipeline.
5. All Epic 31 Confluence behaviour (bind, plan, record root page, publish hooks, fail-loud preflight) passes its ported tests from inside `ma-atlassian`.

**Handoff sequence:** merge this proposal → PM/Architect apply 4.2–4.4 (one PR per document) → `bmad-create-epics-and-stories` for Epic 32 → `bmad-sprint-planning` → Epic 32 gate spike.

---

### Checklist status

- §1 Trigger & Context — Done (strategic pivot; evidence in Section 1)
- §2 Epic Impact — Done (four new epics; 14.2 closed; no in-flight stories)
- §3 Artifact Analysis — Done (PRD, architecture, tests, CI, docs; UX N/A)
- §4 Path Forward — Done (Option 3, replan; Options 1–2 not viable)
- §5 Proposal Components — Done
- §6 Final Review & Handoff — **Action-needed:** approval of this proposal via PR review; `sprint-status.yaml` epic registration follows approval (6.4), not this PR.
