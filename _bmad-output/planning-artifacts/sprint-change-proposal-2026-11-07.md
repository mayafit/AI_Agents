# Sprint Change Proposal — Re-plan the Extension Split against BMAD v7 (2026-11-07)

**Status:** APPROVED IN PRINCIPLE by the product owner on 2026-11-07 ("lets replan everything to be aligned with v7"); applied to the planning artifacts in the same branch.
**Supersedes:** `sprint-change-proposal-2026-10-31.md` (Decision P5-10, Epics 32–35, Stories 32.1–32.9). That proposal stays in the record as history; nothing from it was implemented.
**Workflow:** `bmad-correct-course`, batch mode. **Scope classification:** Major (fundamental replan; PM + Architect).
**Trigger evidence:** `adversarial-review-v7-alignment-2026-11-07.md` (19 findings) and the upstream facts in Section 1.

---

## Section 1 — Issue Summary

### Problem statement

The 2026-10-31 proposal re-planned ma-agents as five BMAD custom-source extensions plus a thin offline installer, all expressed in bmad-method **v6.12.4** mechanics: `module.yaml` + `module-help.csv` + `.claude-plugin/marketplace.json`, `npx bmad-method install --custom-source`, `sprint-status.yaml` as the tracker, upstream `bmad-sprint-planning` as an overlay target, and `_bmad/bmm/config.yaml` as the binding spine.

On 2026-11-07 a survey of upstream `bmad-code-org/BMAD-METHOD` showed that **`main` is already the v7 line**, v6.12 is frozen on branch `V6.12` for bug fixes only, and v7 GA is announced for mid-November 2026. v7 replaces every one of those mechanics. Executing the 10-31 plan would build four epics of deliverables that the v7 move deletes, and would put existing on-prem users through two migrations (monolith → v6 extensions → v7 modules).

### Decision (product owner, 2026-11-07)

- **Target BMAD v7 directly**, at a **pinned upstream commit**, bumped deliberately. Develop against the preview now.
- **Do not deploy the preview to on-prem users.** ma-agents 3.18.1 on bmad-method 6.12.4 stays the supported on-prem line until v7 GA has passed a qualification gate. The v7-based packages ship as a pre-release line until then.
- All earlier constraints stand: no dependency between our packages; three purposes preserved (offline on-prem install; our agents/skills; Jira + Confluence); MIL-STD-498 with Gadi; `bmad-dev-epic` kept; uv + Python 3.11 required; no parallel versions.

### Evidence (upstream `main` @ `e734d3ac3c0f4ea31cc2c2bbbe79e86e54f2cae6`, 2026-11-06)

| Fact | Where |
|---|---|
| v7 preview alpha; GA ETA mid-November 2026; v6.12 frozen on branch `V6.12` | `docs/start/install-bmad.md` |
| Install is `npx skills add <owner>/<repo>[#tag] --skill …` (Skills CLI = npm package `skills` 1.7.6, vercel-labs) then `bmad setup <code>`; no `bmad-method` npm installer, no `--custom-source`, no `marketplace.json` ("the current install path does not need it") | `docs/customize/add-modules.md`, `docs/toolsmith/migrate-an-old-module.md` |
| Module = `bmod-<code>/` record (`bmod.toml` `[bmod]` code/version/update_source/skills/required_skills/`[[bmod.config_questions]]`, `help/help.md`, `roster.toml`, `retired.toml`, `migration-<n>.toml`); each member skill carries `bmod.toml` `[skill] bmod=…, source=…, scripts=…`; one repo may hold several modules but all records share one version; `update_source` ∈ `github:` / `https://` / `file:` / `plugin:`; `file:` is the "local" channel | `docs/reference/module-files.md`, `skills/bmad/scripts/setup.py:31,1051-1066` |
| The validator does not enforce a skill-name prefix (its fixtures put `bmad-flow` in module `core-tools`); the prefix is a convention, and `bmad-` is reserved for upstream | `skills/bmad/scripts/tests/test_validate_manifests.py`, `docs/toolsmith/modules.md` |
| Config: `_bmad/custom/config.toml` (team) + `config.user.toml` (personal); read with `uv run _bmad/scripts/resolve_config.py --key modules.<code>.<key>` / `core.output_folder`; `user_name`, `communication_language`, `document_output_language`, `planning_artifacts`, `implementation_artifacts` no longer exist; `_bmad/bmm/config.yaml` is a `LEGACY_LEFTOVERS` entry that `bmad setup` offers to delete | `docs/toolsmith/migrate-an-old-module.md`, `skills/bmad/scripts/migrate_v6.py` |
| Setup has no headless or inline-argument mode; the agent-driven flow writes answers to a temp TOML and calls `setup.py --module-answers <file>` (internal contract) | `skills/bmad/references/setup.md` |
| Tracking: `epics.md` + `sprint-status.yaml` + story files are replaced by the initiative store `{output_folder}/initiative-<slug>/…/tickets/tickets.toml` (`tickets.py`) under Sofia `bmad-agent-po`; story status lives in `story-<slug>-plan.md` written by `bmad-build`; `bmad migrate method` (`bmod-method/migration-1.toml`) converts a v6 project and archives `sprint-status.yaml` unchanged | `docs/plan/set-up-the-ticket-tree.md`, `skills/bmod-method/migration-1.toml` |
| Sofia ships pluggable ticket stores: `config/{repo,github,jira,linear,notion,trello}-ticketing.toml`, layered by `_bmad/custom/ticketing-store-config.toml` (`[tickets] store/key/site`, `[verbs] setup/write/query`, `[tickets.types]`, `[tickets.status]`); the Jira starter is **Jira Cloud via `acli`**; "hooks are not integrated yet"; a team "may bring their own config file or url" | `skills/bmad-agent-po/config/jira-ticketing.toml`, `scripts/read_store.py` |
| Retired in v7, names never reusable: `bmad-sprint-planning`, `bmad-create-epics-and-stories`, `bmad-correct-course`, `bmad-spec`, `bmad-check-implementation-readiness`, `bmad-agent-tech-writer`, `bmad-index-docs`, `bmad-shard-doc`, `bmad-init`; renamed `bmad-help`→`bmad`, `bmad-ticket`→`bmad-agent-po`. No `bmad-sprint-status`, `bmad-dev-story`, `bmad-create-story` exist | `skills/bmod-method/retired.toml`, `skills/bmod-core-tools/retired.toml` |
| Customization hook keys survive: `[workflow] activation_steps_prepend/append`, `persistent_facts`, `on_complete`, `external_sources`, `external_handoffs` on `bmad-prd`, `bmad-architecture`, `bmad-facilitate`, `bmad-build`; Sofia uses `[agent] activation_steps_*`/`persistent_facts` plus named `[workflow] spec/tickets/refine/board/validate/replan/store_{before,after}` slots | `skills/*/customize.toml` |
| Every v7 skill activates with `uv run --no-cache … render_skill.py` (needs `jinja2`); `tickets.py` needs `pyyaml`. `--no-cache` ignores a pre-seeded uv cache, so offline needs a wheelhouse (`UV_FIND_LINKS` / `UV_OFFLINE`), not a warm cache | `skills/bmad-build/SKILL.md`, `skills/bmad/scripts/render_skill.py` |
| Toolsmith (`bmad-toolsmith`, module `bmod-toolsmith`) replaces bmb and has a migrate mode that converts a `module.yaml` module to bmod in place | `docs/toolsmith/migrate-an-old-module.md` |

---

## Section 2 — Impact Analysis

### Epic impact

| Epic (10-31 plan) | Disposition | Why |
|---|---|---|
| 32 — v6.12.4 currency, latest-only | **SUPERSEDED → Epic 36** | Two-thirds of its gate ACs test v6-only behaviour (`--shims`, `removals.txt`, `sprint_plan.py`, npm tarball layout). The surviving intent (qualify the upstream target, prove offline uv, retarget `bmad-dev-epic`, validate owned TOML, `AGENTS.md` two-writer test) moves to Epic 36 against the v7 commit. |
| 33 — Extension monorepo & carve-outs | **SUPERSEDED → Epic 37** | Same goal, different format: bmod records instead of `module.yaml` + marketplace; `npx skills add` instead of PluginResolver; roster + help files; `resolve_config.py` reads; `bmad-` prefix dropped from owned skills. |
| 34 — Sprint extension & Atlassian overlay | **SUPERSEDED → Epic 38** | `ma-sprint` is not carved (Section 4.1). Jira becomes a Sofia store definition plus board hooks; Confluence becomes `external_handoffs` / `on_complete` overrides plus `bmad-facilitate` slots. The per-skill prepend adapter and the version-keyed target table over `bmad-sprint-planning` are dropped. |
| 35 — Thin offline installer | **SUPERSEDED → Epic 39** | Nothing to stage from npm. The installer vendors a BMAD-METHOD `skills/` snapshot, the Skills CLI, our extension repo, uv + Python + wheelhouse, and drives `npx skills add <local path>` + `setup.py --module-answers`. |
| 31 — Two-store binding (done, v3.18.0) | **Retired in Phase 5 by Epic 38** | `project-layout.yaml` → generated `_bmad/bmm/config.yaml` → staleness stamp → preflight in 41 skill copies targets a file v7 deletes. Replaced by `[modules.ma-atlassian]` setup answers + `ticketing-store-config.toml` + `core.output_folder`. Epic 31 stays in history untouched. |
| 14.2 (closed 10-31) | unchanged | |

### Story impact

Stories 32.1–32.9 (status `ready-for-dev` / `backlog`, none started) are **cancelled**, not edited; their useful content is cited by the Epic 36 stories. The readiness report `implementation-readiness-epic-32.md` is annotated as superseded. Open items in `sprint-status.yaml` that the earlier adversarial review flagged (Epic 31 `review` stories, `bug-*` entries, Epic 19/23 stories) get a disposition table in Section 4.6.

### Artifact conflicts

| Artifact | Conflict | Resolution |
|---|---|---|
| PRD F27 (`bmad-platform-currency.md`) FR271, FR275, FR276 | Pin to 6.12.4; "latest qualified"; v6 catalog adoption | FR275/FR276 SUPERSEDED; FR271 AMENDED; new FR280–FR284 (Section 4.2) |
| PRD F28 (`bmad-integration-and-bundling.md`) FR268–FR274, NFR84, NFR85 | marketplace/`module.yaml` repo; per-module semver; overlay over `bmad-sprint-planning`; thin installer stages `bmad-method` | FR268, FR269, FR270, FR273, FR274 AMENDED in place with a dated note; NFR85 SUPERSEDED by NFR86; new FR285–FR294 |
| PRD F10 (`sprint-and-backlog-management.md`) NFR19 "all sprint workflows read/write the unified `sprint-status.yaml`" | v7 has no such file | NFR19 SUPERSEDED (delivery note; the v6 skills remain in the 3.x monolith until retirement) |
| PRD F26 (`project-knowledge-and-repository-layout.md`) FR254–FR267 | binding spine writes `_bmad/bmm/config.yaml` | Delivery note: superseded in the v7 line by FR293; untouched for 3.x |
| Architecture P5-10 | all eight sub-decisions are v6-shaped | **P5-10 SUPERSEDED by P5-11** (Section 4.3); P2-11 amendment (tracker hook contract) SUPERSEDED |
| `structure-and-boundaries.md` target tree | marketplace layout | replaced by the bmod layout |
| `implementation-patterns.md` Phase 5 patterns | drift gate over generated shared text; per-module version bump | replaced (Section 4.3) |
| `epics.md` Epics 32–35 | | annotated SUPERSEDED, not edited; Epics 36–39 appended |
| `sprint-status.yaml` | `epic-32..35`, `32-x` keys | set to `cancelled` with reason; `epic-36..39` + Epic 36 story keys added |

### Technical impact

- `lib/bmad.js`, `lib/installer.js`, `scripts/build-bmad-cache.js`, `bin/cli.js` (~6,300 lines) lose their `bmad-method` orchestration role; what survives in the thin installer is wizard, IDE injection, offline bundle staging and `npx skills add` / `setup.py` driving.
- `lib/confluence-publish-hook.js` (1,781) and `lib/confluence-page-tree.js` (925) move into `ma-atlassian` as skill scripts. Node is a v7 prerequisite (Skills CLI), so they may stay JavaScript; porting to Python is optional and not planned.
- The 41 pasted preflight blocks, `project-layout.yaml`, the generated-config path and the staleness stamp are deleted in the v7 line.
- Jira routing blocks in 13 sprint skills + identity clause: the skills are not carved; the identity clause and §6.3 entity mapping are re-expressed as a Sofia store config and `persistent_facts`.
- Test suite: PluginResolver passthrough tests, pinned 41/9-copy counts, `--custom-source` fixtures and `uv-transition-resilience` are replaced by `validate_manifests.py` runs, a per-module `npx skills add <local>` install test, and an offline `render_skill.py` run.

---

## Section 3 — Recommended Approach

**Chosen path: fundamental replan (Option 4 of the 10-31 proposal's missing alternative).** Author the carved modules in v7 shape from the first commit; no v6 compatibility output; `ma-agents` 3.x stays frozen on 6.12.4 as the on-prem line until GA qualification.

Rejected:
- *Execute Epics 32–35 then adapt.* Builds and deletes four epics of v6 mechanics; two user migrations; burns skill names into `retired.toml`.
- *Hybrid (author in v7 shape, generate `module.yaml`/`marketplace.json` for 6.12.4).* Keeps a generator alive for a branch upstream has frozen; doubles the install-test matrix. Only worth it if GA slips by months; revisit at the Epic 36 gate.
- *Wait for GA before any work.* Loses two to four weeks on work (carve-out, naming, roster, config reads, offline wheelhouse) that is stable across the preview.

**Risk:** the preview can move before GA. Mitigation: pin one SHA, re-run the Epic 36 gate on the GA tag before Epic 39 ships, and keep Sofia-store-dependent work (Epic 38) thin until GA. **Effort:** comparable to the 10-31 plan for Epics 36–37; smaller for 38–39. **Timeline:** Epic 36 can start now; Epic 39's release waits for GA.

---

## Section 4 — Detailed Change Proposals

### 4.1 Target package map (v7)

One Git repository, `ma-bmad-extensions`, flat `skills/` tree, **one version line** (v7 validator rule), installable per module or per skill with `npx skills add <org>/ma-bmad-extensions[#tag] --skill …`. Independent installability is preserved: each module's `required_skills` names only upstream `bmad` (core) and never a sibling module.

| Package | Form | Contents | Config questions (`[[bmod.config_questions]]`) |
|---|---|---|---|
| `bmod-ma-ops` (code `ma-ops`) | multi-skill module + `roster.toml` | agents `ma-agent-sre/cyber/devops/sqa` (Alex, Yael, Amit, Gadi); `sre-*`, `cyber-*`, `devops-*`, `sqa-*`, `mil498-*` workflows; **`ma-ops-dev-epic`** (renamed from `bmad-dev-epic`), rewritten against `bmad-build` / `bmad-build-auto` / `bmad-code-review` / `bmad-review` / `bmad-walkthrough`, reading epics and stories from the ticket tree via `tickets.py` | none (ticket tree comes from `core.output_folder`) |
| `bmod-ma-standards` (code `ma-standards`) | multi-skill module | coding-standard skills (`cpp-*`, `csharp-*`, `python-*`, `js-ts-*`, docker/cert/logging/otel), `code-review`, `test-generator`, `git-workflow-skill`, `commit-message`, `auto-bug-detection`, `skill-creator`, `project-context-expansion`, `open-presentation` + training deck; `AGENTS.md` / `.clinerules` / `.roomodes` injection as a `ma-standards-apply` skill | none |
| `bmod-ma-knowledge` (code `ma-knowledge`) | single- or multi-skill module | **`ma-knowledge-atlas`** (renamed from `bmad-knowledge`) over the v7 initiative store | `atlas_output` (default `{project-root}/_bmad-output/knowledge-atlas`) |
| `bmod-ma-atlassian` (code `ma-atlassian`) | multi-skill module (overlay) | `ma-atlassian-bind` (bind/unbind/status; generates marker-delimited `_bmad/custom/<skill>.toml` overrides and `ticketing-store-config.toml`); store starter `jira-onprem-ticketing.toml` (Jira Server/DC via MCP or REST; `acli` is Cloud-only); Confluence publish engine + page tree (scripts); `confluence-plan` / `confluence-record-root-page` as skills; identity clause and §6.3 entity mapping | `jira_site`, `jira_project_key`, `jira_mcp_server`, `confluence_site`, `confluence_space`, `confluence_root_page`, `confluence_mcp_server` |
| `ma-sprint` | **not carved in Phase 5** | `add-sprint`, `add-to-sprint`, `close-sprint`, `cleanup-done`, `modify-sprint`, `remove-from-sprint`, `prioritize-backlog`, `generate-backlog`, `sprint-status-view`, `story-status-lookup`, `my-next-issue`, `create-bug-story` all operate on `sprint-status.yaml` sections (`sprints:` capacity, `backlog:`) that v7 does not model. Sofia covers "what's next", "file a bug", board. **Open PO decision after GA:** an optional sprint-capacity layer over `tickets.toml` (labels or a sidecar) as a later single-skill module. Until then these skills live only in the 3.x monolith. |
| `ma-agents` (npm, thin offline installer) | Node CLI | wizard; offline bundle (BMAD-METHOD `skills/` snapshot at the pinned SHA, tea/cis module repos at their tags, `skills` CLI tarball, `ma-bmad-extensions` snapshot, uv binary, Python 3.11 standalone, PEP 723 wheelhouse enumerated at build); runs `npx skills add <local path> --skill …` per selected module, writes module answers and calls `setup.py --module-answers`; sets `UV_PYTHON` / `UV_FIND_LINKS` / `UV_OFFLINE`; IDE instruction injection; `status` / `uninstall` (removes the v6 `ma-skills` module and tool dirs via the manifest-aware sweep) | — |

Naming: **owned skills drop the `bmad-` prefix** (`bmad-dev-epic` → `ma-ops-dev-epic`; `bmad-knowledge` → `ma-knowledge-atlas`). Our `bmad-sprint-planning` / `bmad-sprint-status` / `bmad-dev-story` shadows are deleted (not carved). Other owned names are kept (prefix is a convention, not validated); each module's `retired.toml` starts empty and records any later rename.

Configuration: every carved skill reads config only through `uv run {project-root}/_bmad/scripts/resolve_config.py` (`core.output_folder`, `modules.<code>.<key>`) and customization through `resolve_customization.py`. No `user_name`, `communication_language`, `planning_artifacts`, `implementation_artifacts`, `_bmad/bmm/config.yaml`.

Dependencies: `required_skills = [{ skill = "bmad", version = "<pinned>", source = "github:bmad-code-org/BMAD-METHOD/skills" }]` per module; `recommended_skills` may name upstream skills a workflow builds on (`bmad-build`, `bmad-agent-po`); **never** a sibling module. Cross-module references found by the earlier review (`ma-ops-dev-epic` → `git-workflow-skill` / `code-review`; `auto-bug-detection` → `story-status-lookup`) become `recommended_skills` with a fail-soft message in the skill, or are removed.

### 4.2 PRD edits

**F27 `bmad-platform-currency.md`** (next free FR is FR280):
- FR271 **AMENDED**: "ma-agents targets exactly one bmad-method line: **BMAD v7 at a pinned upstream commit** recorded in `package.json` (`bmadRef`) and `BMAD_TARGET_REF`, bumped deliberately; no shims, no parallel versions. ma-agents 3.x on 6.12.4 is maintained for fixes only until FR281 passes."
- FR275, FR276 **SUPERSEDED** by FR280/FR282 (dated note; text kept).
- FR277 unchanged (uv + Python 3.11). FR278 unchanged (owned TOML validation). FR279 unchanged.
- **FR280** Target pin: the pinned upstream commit (initially `e734d3ac3c0f4ea31cc2c2bbbe79e86e54f2cae6`) is the only bmad-method the v7 line is tested against; the Epic 36 gate records its verdict per SHA.
- **FR281** GA qualification gate: no on-prem (offline bundle) release of the v7 line until the Epic 36 gate has been re-run and passed on the v7 GA tag; until then 3.18.x on 6.12.4 is the supported on-prem release.
- **FR282** Offline runtime bundle: the installer ships uv, a Python 3.11 interpreter and a wheelhouse covering every PEP 723 dependency declared by the vendored skills' scripts (enumerated at build; at least `jinja2`, `pyyaml`); an install under `--network none` must activate `render_skill.py`, `resolve_config.py`, `resolve_customization.py`, `tickets.py` and `setup.py` with `uv run --no-cache`.
- **FR283** Skills CLI: the installer vendors the `skills` npm package at a pinned version and installs modules with `npx skills add <local path> --skill …` from the bundle; no network access is attempted.
- **FR284** Headless setup: the installer drives `bmad setup` non-interactively through `setup.py --module-answers <file>` with answers collected by its own wizard; if that contract changes upstream, the installer prints the exact `bmad setup <code>` instruction instead of failing (fail-loud, documented fallback).
- NFR74 live clause rewritten: "all ma-agents-shipped skill scripts run through `uv run`; the installer's own CLI stays Node".

**F28 `bmad-integration-and-bundling.md`**:
- FR268 **AMENDED**: the five extensions become four v7 modules (`ma-ops`, `ma-standards`, `ma-knowledge`, `ma-atlassian`) plus the thin installer; `ma-sprint` is not carved (open PO decision after GA).
- FR269 **AMENDED**: each module installs on a vanilla v7 install with `npx skills add … --skill …` + `bmad setup <code>`, online, from a tag, or from a local folder.
- FR270 **AMENDED**: no dependency between our modules is declared in `required_skills`/`recommended_skills`; shared text is no longer generated (the preflight that needed it is retired by FR293); where two modules need the same reference text each carries its own copy.
- FR272 **SUPERSEDED** by FR289 (Jira is a Sofia store, not a per-skill routing block).
- FR273 **SUPERSEDED** by FR290/FR291.
- FR274 **AMENDED**: the thin installer's stage/invoke contract is FR282–FR284; it still performs IDE injection and no project-scoped work that a module's skill performs.
- **FR285** Repository layout: `ma-bmad-extensions` follows the v7 module layout (`skills/bmod-<code>/bmod.toml`, `help/help.md`, `roster.toml` where agents exist, `retired.toml`, `migration-<n>.toml`; member `bmod.toml` `[skill]` tables); `validate_manifests.py` passes in CI; all records share one version (**NFR86**, supersedes NFR85).
- **FR286** Roster and help: `bmod-ma-ops/roster.toml` lists Alex, Yael, Amit and Gadi with an "ops" group; every module ships `help/help.md` written for the `bmad` skill.
- **FR287** Naming: no owned skill carries the `bmad-` prefix; renames are recorded in the module's `retired.toml` and a retired name is never reused.
- **FR288** Config reads: carved skills read configuration only via `resolve_config.py` (`core.*`, `modules.<code>.*`) and customization via `resolve_customization.py`; a test greps for the removed v6 keys.
- **FR289** Jira as a Sofia store: `ma-atlassian` ships a `jira-onprem-ticketing.toml` store starter (Jira Server/DC through the configured MCP server or REST; types/status maps from §6.3; identity clause as `persistent_facts` on `bmad-agent-po`), selected by writing `_bmad/custom/ticketing-store-config.toml` from the module's setup answers; Jira transitions ride Sofia's `board_*` hooks; no per-skill Jira routing text.
- **FR290** Confluence publish/read: generated overrides set `external_handoffs` and `on_complete` on `bmad-prd`, `bmad-architecture`, `bmad-ux`, `bmad-product-brief`, `bmad-prfaq`, `bmad-facilitate`, and `external_sources` on `bmad-facilitate`, `bmad-build`, `bmad-build-auto`, `bmad-code-review`, `bmad-retrospective`; the page-tree mirror and staleness rules of F26 apply to the initiative store layout.
- **FR291** Bind/unbind: `ma-atlassian-bind` is idempotent, keyed per target (skill, section, key, insertion slot), honours an existing user-authored value (fail-loud report, never overwrite outside its markers), supports `unbind` (removes only its marker blocks), and is re-run by the user after any module install or `bmad setup`; a target absent on disk is reported, not failed.
- **FR292** Sprint model: no carved skill reads or writes `sprint-status.yaml`; `ma-ops-dev-epic` enumerates epics and stories through `tickets.py` and writes story status only through `bmad-build`'s plan file; a `bmod-ma-ops/migration-1.toml` moves 3.x `backlog:` entries into the store's `backlog/` folder and archives `sprints:` with a report.
- **FR293** Knowledge binding retired: the v7 line has no `project-layout.yaml`, generated `_bmad/bmm/config.yaml`, staleness stamp or preflight block; store locations come from `core.output_folder` and `modules.ma-atlassian.*`; `bmod-ma-atlassian/migration-1.toml` converts a 3.x binding (`project-layout.yaml`, Epic 31 override markers) into setup answers and new overrides.
- **FR294** Migrations: every user-visible change to on-disk files between ma-agents releases of the v7 line ships as a `migration-<n>.toml` that `bmad migrate` runs; the 3.x → v7 move is `bmad migrate method` (upstream) followed by our module migrations, and the thin installer's `uninstall` removes the v6 `ma-skills` module.
- NFR84 **AMENDED**: per-module CI runs `validate_manifests.py`, a clean `npx skills add <local repo> --skill bmod-<code> …` + `bmad setup <code>` with `--module-answers`, and an activation of each skill; unique leaf names across our repo and the pinned upstream snapshot.
- **NFR86** One version line per repository; a change in any module bumps the shared version; modules are still independently installable.

**F10** NFR19 delivery note: SUPERSEDED for the v7 line by FR292. **F26** delivery note on FR254–FR267: SUPERSEDED for the v7 line by FR293 (3.x unchanged).

`prd.md`: F27/F28 paragraphs updated; register rows; FR span to FR294; NFR span to NFR86; Last Edited 2026-11-07. `prd/changelog.md`: entry.

### 4.3 Architecture edits

- **Decision P5-11** (new, `decisions/bmad-integration-and-bundling.md`): "BMAD v7 Target — bmod Modules, Sofia-native Jira, Confluence via Handoff Slots, Skills-CLI Offline Installer (FR271 am., FR280–FR294, NFR84 am., NFR86) (2026-11-07)". Sub-decisions: P5-11.1 package map (4.1 table); .2 one repo, one version line, `file:`/`github:` update sources (on-prem Git host via `https://` is a gate-spike question); .3 no sibling dependency, `recommended_skills` for upstream only; .4 overlay = per-target override table + `ticketing-store-config.toml`, bind/unbind idempotent; .5 target = pinned SHA, GA gate; .6 uv + Python 3.11 + wheelhouse, `--no-cache` proof; .7 `ma-ops-dev-epic` retained, discovery via `tickets.py`; .8 `ma-sprint` not carved, PO decision post-GA; .9 binding spine retired; .10 sequencing 36 → 37 → 38 → 39, GA re-gate before 39 ships. Rejected: execute-then-adapt; hybrid generator; per-module repos (allowed later at zero install-path cost); porting the Confluence engine to Python. **P5-10 marked SUPERSEDED by P5-11**; P2-11 amendment marked SUPERSEDED.
- `architecture.md`: register row P5-11; totals 25; next free P5-12; P5-10 row annotated.
- `structure-and-boundaries.md`: "Target Structure after P5-11" replaces the P5-10 tree with the bmod layout and the installer bundle layout.
- `implementation-patterns.md`: "Phase 5 v7 Module Patterns": one `resolve_config.py` call per skill; `bmod.toml` member stubs; marker-delimited overrides with per-target slots; `retired.toml` discipline; `migration-<n>.toml` for every on-disk change; PEP 723 headers on every script; anti-patterns: reading `_bmad/bmm/config.yaml`, generated shared text, `bmad-` prefix, sibling `required_skills`.
- `architecture/changelog.md`: entry.

### 4.4 Epics (appended to `epics.md`; 32–35 annotated SUPERSEDED)

**Epic 36: v7 Gate — Pin, Prove Offline, Qualify (Phase 5).** Hard gate for 37–39. Waves:
- 36.1 Gate spike against the pinned SHA in a scratch project: `npx skills add` from a local folder and from a tag; `bmad setup` via `setup.py --module-answers`; `validate_manifests.py` on a minimal `bmod-ma-ops` fixture; prefix handling; `https://` update source for an on-prem Git host; `file:` channel behaviour on `bmad status`; Sofia store override from a custom `ticketing-store-config.toml`; `migrate_v6.py` on a copy of a real 3.18.1 project. Verdict GO/STOP per question → `epic-runs/epic-36/36-1-gate-findings.md`.
- 36.2 Offline runtime proof: uv + Python 3.11 standalone + wheelhouse; `uv run --no-cache` of `render_skill.py`, `resolve_config.py`, `resolve_customization.py`, `tickets.py`, `setup.py` under `--network none`; the recipe becomes `docs/on-prem-runtime.md` and a build script that enumerates PEP 723 deps from the snapshot.
- 36.3 Target pin plumbing: `package.json` `bmadRef`, `BMAD_TARGET_REF`, `build-bmad-cache.js` re-targeted to snapshot `skills/` at the SHA (+ tea/cis tags), Node engines ≥20.12 (FR279), `uv-transition-resilience` test inverted (FR277).
- 36.4 Owned-TOML validation (FR278) against v7 `customize.toml` shapes (`[agent]` vs `[workflow]`, Sofia slots).
- 36.5 `AGENTS.md` two-writer test against v7 `bmad-project-context` markers.
- 36.6 Release gate: verdict record; `npm test` chain health recorded honestly; Linux CI job with uv; semver for the 3.x line untouched; CHANGELOG "v7 line pre-release" note. **GA re-gate:** 36.1 + 36.2 re-run on the GA tag before Epic 39 ships (tracked as 36.7, blocked on GA).

**Epic 37: Carve-outs as v7 Modules (Phase 5).** `ma-bmad-extensions` repo: 37.1 scaffold (`skills/`, `validate_manifests.py` in CI, per-module install test, one version line); 37.2 `bmod-ma-standards` (+ `ma-standards-apply`, project-context-expansion, open-presentation + deck); 37.3 `bmod-ma-ops` (agents + roster + workflows + MIL-STD-498; `ma-ops-dev-epic` rewrite with `tickets.py` discovery and the `bmad-build` pipeline; `migration-1.toml` for 3.x `backlog:`/`sprints:`); 37.4 `bmod-ma-knowledge` (`ma-knowledge-atlas` over the initiative store); 37.5 config-read sweep (FR288) + `bmad-` prefix sweep (FR287) + cross-module reference audit (`recommended_skills` or removal); 37.6 release gate: each module installs alone on a vanilla v7 project from a local folder and from a tag, `bmad status` current, every skill activates offline with the Epic 36 runtime.

**Epic 38: Atlassian on Sofia and the Handoff Slots (Phase 5).** 38.1 spike: on-prem Jira through the Rovo/Atlassian MCP vs REST from `acli`-shaped verbs; Confluence MCP write path; what `bmad setup` answers can pre-fill `ticketing-store-config.toml`; 38.2 `jira-onprem-ticketing.toml` store starter + identity clause + §6.3 maps; 38.3 `ma-atlassian-bind` (override table, generator, bind/unbind/status, fail-loud collision report carrying Story 31.15's predicate); 38.4 Confluence engine relocation (publish hook, page tree, `confluence-plan`, `confluence-record-root-page`) as `ma-atlassian` scripts/skills, `external_handoffs`/`on_complete`/`external_sources` overrides; 38.5 `migration-1.toml` from 3.x binding (`project-layout.yaml`, Epic 31 markers) to setup answers + new overrides; 38.6 release gate: Jira story round-trip (create, transition, status read-back) on an on-prem Jira; Confluence publish of a PRD run; bind → unbind leaves no trace; coexistence with a user-authored override.

**Epic 39: Thin Offline Installer for v7 + Monolith Retirement (Phase 5).** 39.1 bundle builder (BMAD-METHOD snapshot, tea/cis, `skills` CLI tarball, `ma-bmad-extensions` snapshot, uv, Python, wheelhouse; manifest with SHAs); 39.2 install flow (`npx skills add <local>` per selection, `setup.py --module-answers`, env vars, IDE injection, `status`); 39.3 `uninstall` / upgrade from 3.x (`ma-skills` removal, `bmad migrate method` hand-off, our module migrations); 39.4 delete `lib/bmad-extension*`, the `ma-skills` module, `bin/cli.js` orchestration paths, `--custom-source` wizard (FR239–FR243 retired); 39.5 release gate on the **GA tag** (FR281): `--network none` end-to-end on a clean VM, multi-tool smoke, 3.18.1 → v7 upgrade on a real project copy, semver MAJOR (4.0.0) for the installer, CHANGELOG, retro.

Sequencing: 36 gates 37; 37 gates 38; 38 + 37 gate 39; 39.5 waits for GA. 37.1/37.2 may start once 36.1 records GO on the Skills-CLI and validator questions, even if 36.2 is still open.

### 4.5 Stories closed or reframed

| Story | Action |
|---|---|
| 32.1–32.9 | `cancelled` in `sprint-status.yaml` with "superseded by Epic 36 (SCP 2026-11-07)"; files untouched; the Epic 36 stories cite their reusable Dev Notes (`lib/bmad.js:2830`, `lib/agents.js:313`, `lib/uninstall.js:50`, pinned counts, Paige references). |
| `implementation-readiness-epic-32.md` | header note: SUPERSEDED; conditions C-1…C-10 void. |
| `bug-custom-marketplace-stage-survives-install…` | `cancelled` — moot under FR239–FR243 retirement (Epic 39.4). |
| `bug-npm-test-windows-suite-health-chain` | kept; cited by 36.6. |
| Epic 31 stories in `review` (31.14, 31.16), DS.1 `in-progress` | unchanged (3.x line); 31.16's manifest-aware sweep is reused by 39.3. |
| Epic 19 / Epic 23 `ready-for-dev` stories | unchanged; 23.2 (Gadi memory agent) is re-homed to `bmod-ma-ops` when picked up. |

### 4.6 Open decisions for the product owner

1. **`ma-sprint` after GA:** drop in favour of Sofia, or build a sprint-capacity layer over `tickets.toml`.
2. **Skill prefixes beyond `bmad-`:** keep `sre-`/`cyber-`/`mil498-`/unprefixed standards names (recommended; no validation cost), or rename everything to `ma-ops-`/`ma-std-` now.
3. **Confluence engine language:** keep JavaScript (recommended) or port to Python.
4. **Update source for on-prem:** `file:` (bundle) vs `https://<on-prem GitLab>`; decided by 36.1's finding.

---

## Section 5 — Implementation Handoff

**Scope:** Major. **Route to:** PM (John) for PRD edits and Epics 36–39; Architect (Winston) for P5-11; Scrum Master for `sprint-status.yaml` and the Epic 36 stories; SQA (Gadi) to audit the config-read, prefix and cross-reference sweeps in 37.5.

**Success criteria:** PRD/architecture/epics/sprint-status reflect Sections 4.1–4.5 with no remaining reference to `--custom-source`, `marketplace.json`, `module.yaml`, `sprint-status.yaml` or `_bmad/bmm/config.yaml` as a Phase 5 deliverable; Epics 32–35 and Stories 32.x annotated, not edited; Epic 36 stories authored and readiness-checked; the two adversarial reviews linked from the PR.

### Checklist status

- [x] Change trigger confirmed (upstream v7 survey, 19-finding review)
- [x] PRD, epics, architecture loaded; UX N/A
- [x] Epic impact assessed (32–35 superseded; 31 retired in the v7 line)
- [x] Artifact conflicts enumerated
- [x] Path chosen: fundamental replan; alternatives recorded
- [x] Edit proposals drafted (4.1–4.5)
- [!] PO decisions 4.6 pending (do not block Epic 36)
- [ ] Handoff applied (same branch, next commits)
