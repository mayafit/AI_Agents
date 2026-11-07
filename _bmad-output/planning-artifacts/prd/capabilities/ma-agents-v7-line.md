# ma-agents 4.x on BMAD v7

> **Shard** of the [PRD index](../../prd.md). The index carries the front matter, registers and
> reading order.
>
> Capability **F29 — ma-agents 4.x on BMAD v7**. Requirements FR280–FR302, NFR84, NFR86, NFR87.
> Architecture: P5-11.

---

## Purpose

ma-agents 4.x delivers the organisation's agents, skills, coding standards, Knowledge Atlas and
Jira/Confluence integration as BMAD v7 modules, and installs them together with a pinned BMAD v7 on
machines that have no internet access. It serves three purposes: an offline on-prem install; the
organisation's own agents and skills; Jira and Confluence as the team's systems of record.

Every module installs and works on a vanilla BMAD v7 project without the ma-agents installer, and no
module requires another of our modules. The installer adds what a disconnected machine lacks: a
bundle of every artefact the install needs, a single wizard, headless setup and IDE instruction
injection.

## Product lines

| Line | Content | Status |
|---|---|---|
| ma-agents 3.x | monolithic npm package; installs bmad-method 6.10.0 and the `ma-skills` module; sprint skills over `sprint-status.yaml`; Confluence two-store binding | maintenance only, from branch `maint/3.x` (cut at `v3.18.1`); the supported on-prem release until the 4.x GA gate passes |
| ma-agents 4.x | thin offline installer (npm `ma-agents` 4.x) + `ma-bmad-extensions` modules on BMAD v7 | pre-release (dist-tag `next`) until the GA gate; then the on-prem release |

BMAD target of 4.x: upstream `bmad-code-org/BMAD-METHOD` at the commit recorded in `package.json`
`bmadRef.core` (initial value `e734d3ac3c0f4ea31cc2c2bbbe79e86e54f2cae6`). `bmadRef` also records
`skillsCli` (npm `skills` version, initial `1.7.6`), the `tea` and `cis` tags, and `extensions`
(the bundled `ma-bmad-extensions` tag).

The 3.x line is specified by the other capability files of this PRD. This file specifies the 4.x line.

## Package map

Repository `ma-bmad-extensions`, layout `skills/<name>/`, one version line. It holds four modules.
Each module record lives in `skills/bmod-<code>/`; each member skill lives in `skills/<name>/`.

### bmod-ma-ops (code `ma-ops`)

- **Agents** (in `roster.toml`, group `ops`): `ma-agent-sre` Alex, `ma-agent-cyber` Yael,
  `ma-agent-devops` Amit, `ma-agent-sqa` Gadi.
- **Workflows:** `sre-check-deployment-status`, `sre-check-secrets`, `sre-check-system-status`,
  `sre-day-2-ops`, `sre-deployment-strategies`, `sre-fix-deployments`, `sre-gitops-status`,
  `cyber-generate-certs`, `cyber-immunity-estimation`, `cyber-security-audit`, `cyber-vault-secrets`,
  `cyber-verify-docker-users`, `cyber-verify-image-signature`, `cyber-vulnerability-scan`,
  `devops-configure-infrastructure`, `devops-disconnected-deployment`, `devops-docker-compose-setup`,
  `devops-manage-helm`, `devops-sign-docker-image`, `sqa-audit`, `sqa-ieee12207`,
  `sqa-requirements-quality`, `mil498-ocd`, `mil498-requirement-quality`, `mil498-sdd`, `mil498-sdp`,
  `mil498-srs`, `mil498-ssdd`, `mil498-sss`, `mil498-std`, `create-hardened-docker-skill`,
  `docker-hardening-verification`, `docker-image-signing`, `verify-hardened-docker-skill`,
  `self-signed-cert`, **`ma-ops-dev-epic`** (orchestrates an epic from the ticket tree through
  `bmad-build` / `bmad-build-auto` / `bmad-code-review` / `bmad-review` / `bmad-walkthrough`; reads
  epics and stories with `tickets.py`; writes story status only through `bmad-build`'s plan file).
- **`retired.toml`:** `renamed = [{ from = "bmad-dev-epic", to = "ma-ops-dev-epic" }]`.
- **`migration-1.toml`** (3.x → 4.x): moves `sprint-status.yaml` `backlog:` entries to
  `{output_folder}/backlog/<type>-<slug>.md`; archives `sprints:` to `archive-v6/sprints.yaml` with a
  report; runs after upstream `bmad migrate method`.
- **Config questions:** none. `ma-ops-dev-epic`'s model tiers and publish settings are defaults in
  its `customize.toml`.
- **`required_skills`:** `bmad` (core). **`recommended_skills`:** `bmad-build`, `bmad-agent-po`,
  `git-workflow-skill`, `code-review` (the last two from `bmod-ma-standards`, declared with `source`;
  if absent, `ma-ops-dev-epic` reports it and runs without the worktree/review steps).

### bmod-ma-standards (code `ma-standards`)

- **Skills:** `cpp-best-practices`, `cpp-concurrency-safety`, `cpp-const-correctness`,
  `cpp-memory-handling`, `cpp-modern-composition`, `cpp-robust-interfaces`, `csharp-best-practices`,
  `python-best-practices`, `python-dependency-mgmt`, `python-security-skill`,
  `js-ts-dependency-mgmt`, `js-ts-security-skill`, `vercel-react-best-practices`,
  `cmake-best-practices`, `logging-best-practices`, `opentelemetry-best-practices`,
  `code-documentation`, `code-review`, `test-generator`, `test-accompanied-development`,
  `git-workflow-skill`, `commit-message`, `auto-bug-detection`, `ai-audit-trail`,
  `document-revision-history`, `skill-creator`, `project-context-expansion`, `open-presentation`
  (+ the training deck under `assets/`), **`ma-standards-apply`** (writes the ma-standards block into
  `AGENTS.md`, `CLAUDE.md`, `.clinerules`, `.roomodes`, `.github/copilot-instructions.md` between
  `<!-- ma-standards:start/end -->` markers; idempotent; `remove` sub-command).
- **Config questions:** none. **`retired.toml`:** empty.
- `auto-bug-detection` files a detected defect through `bmad-agent-po` ("file a bug") when that
  skill is installed, and otherwise reports the defect in the conversation.

### bmod-ma-knowledge (code `ma-knowledge`)

- **Skill:** `ma-knowledge-atlas` (Knowledge Atlas HTML site generated from the initiative store
  under `core.output_folder`; engine bundled in `assets/atlas.cjs`, run with `node`).
- **Config question:** `atlas_output` (default `{project-root}/_bmad-output/knowledge-atlas`).
- **`retired.toml`:** `renamed = [{ from = "bmad-knowledge", to = "ma-knowledge-atlas" }]`.

### bmod-ma-atlassian (code `ma-atlassian`) — overlay

- **Skills:** `ma-atlassian-bind` (sub-commands `bind`, `unbind`, `status`),
  `ma-atlassian-confluence-plan` (preview of the page tree an initiative would publish),
  `ma-atlassian-confluence-record-root-page`.
- **Scripts** (JavaScript, run with `node`; declared in `[skill] scripts`): publish engine, page
  tree, override generator, collision check.
- **Store starter:** `config/jira-onprem-ticketing.toml`.
- **Config questions, bind table, destinations and migration:** see [Atlassian overlay](#atlassian-overlay).

### Tracked skills with no 4.x module

| Skill | 4.x replacement |
|---|---|
| `add-sprint`, `add-to-sprint`, `close-sprint`, `cleanup-done`, `modify-sprint`, `remove-from-sprint`, `prioritize-backlog`, `generate-backlog`, `sprint-status-view`, `story-status-lookup`, `my-next-issue`, `create-bug-story` | `bmad-agent-po` with the configured ticket store (FR296) |
| `bmad-sprint-planning`, `bmad-sprint-status`, `bmad-dev-story` | upstream `bmad-agent-po` and `bmad-build` (FR287) |

## Installer

`ma-agents` 4.x is an npm package that carries no skill content of its own. Node ≥ 20.12.

### Commands

| Command | Behaviour |
|---|---|
| `install` | runs the wizard (or the flags) and the install sequence below |
| `update` | re-runs the install sequence for the modules recorded in `skills-lock.json` from the package's bundle, then `bmad migrate` for any module whose version changed |
| `status` | prints installer version, `ma-bmad-extensions` version, `bmadRef.core`, Skills CLI version, install scope, installed modules, and `ma-atlassian-bind status` when `ma-atlassian` is installed |
| `uninstall` | see [Uninstall](#uninstall) |
| `bundle build` | maintainer command; assembles `bundle/` and `bundle/manifest.json` (FR299) |

### Wizard

All questions have flags for `--yes`.

1. Install scope: `project` | `global`.
2. Coding tools, mapped to Skills CLI `--agent` values. A tool with no Skills CLI target is reported
   and skipped.
3. Modules: `core-tools` and `method` always; `toolsmith`, `founder`, `tea`, `cis`, `ma-ops`,
   `ma-standards`, `ma-knowledge`, `ma-atlassian` selectable. Default selection: `core-tools`,
   `method`, `ma-ops`, `ma-standards`, `ma-knowledge`.
4. Per-module config answers, from each selected record's `[[bmod.config_questions]]`.
5. Additional module sources: a local folder or a Git URL, repeated (FR297).
6. IDE instruction injection: yes/no.

### Flags

`--yes`, `--scope`, `--tools a,b`, `--modules a,b`, `--answers <toml>`, `--source <path|url>`
(repeatable), `--bundle <dir>` (default: the package's own `bundle/`), `--no-inject`.

`--answers` takes a TOML file with one table per module code (`[ma-atlassian]`, `[ma-knowledge]`, …)
whose keys are that module's config question keys. With `--yes`, a question with no answer takes
its declared default; a question with no default and no answer stops the install with the
question's key.

### Install sequence

1. Verify the bundle manifest (SHA-256 per item); stop on any mismatch.
2. Copy the host platform's runtime (uv, Python 3.11, wheelhouse) to `<project-root>/.ma-agents/runtime/`
   (scope `project`) or `~/.ma-agents/runtime/` (scope `global`); export `UV_PYTHON`, `UV_FIND_LINKS`,
   `UV_OFFLINE=1`, `UV_NO_CACHE=1` for the installer's own uv calls and write the same settings to a
   `uv.toml` in the install scope, so later skill activations find the runtime without the installer.
   The installer spawns uv only through one runner module, always as `uv run --no-cache`.
3. `npx skills@<bundled> add <bundle>/bmad-method --skill … -y --agent <tool>`.
4. The same for each selected module source.
5. Write the answers file.
6. `uv run --no-cache <bmad>/scripts/setup.py --project-root . --skill <bmad> --module-answers <file>`.
7. Inject the `<!-- ma-agents:start/end -->` block (lists installed modules and the `bmad` entry
   point), unless `--no-inject`.
8. `status`.

With scope `global`, steps 3–4 install at user level (Skills CLI global mode) and steps 5–7 run for
the project in the current directory; `bmad setup <code>` sets up further projects.

### Bundle

`bundle/manifest.json` records a SHA-256 per item. Contents:

- BMAD-METHOD `skills/` at `bmadRef.core` (records `core-tools`, `method`, `toolsmith`, `founder`).
- The `tea` and `cis` repositories at `bmadRef.tea` / `bmadRef.cis`. A repository whose tag carries
  no bmod record is omitted from the bundle and the omission is recorded in the manifest.
- `ma-bmad-extensions` at its tag.
- The `skills` CLI tarball.
- `uv` binaries and python-build-standalone 3.11 for linux-x64 and win-x64.
- A wheelhouse for those two platforms covering every PEP 723 dependency declared in the bundled
  scripts (enumerated by `bundle build`).

### Uninstall

`uninstall` removes the skills it installed (per `skills-lock.json`) and the injected
`ma-agents` block. On a 3.x project it also removes the `ma-skills` module and the tool directories
listed in `.ma-agents.json` (manifest-aware). It never removes files it did not install.

### Upgrade from 3.x

`install` on a 3.x project makes a backup of the project's `_bmad/`, `_bmad-output/` and IDE
instruction files, runs uninstall of the 3.x parts, installs 4.x, then hands off to
`bmad migrate method` followed by our module migrations (FR294).

### IDE instruction blocks

The installer owns the `ma-agents` block; `ma-standards-apply` owns the `ma-standards` block; they
never touch each other's markers (FR301).

### Versioning

Installer `4.x` semver; `ma-bmad-extensions` has its own semver (one version line, recorded as
`bmadRef.extensions`); upstream is `bmadRef.core`, `skillsCli`, `tea`, `cis`. `bmadRef` ties the
three lines; `status` prints all (FR302).

## Atlassian overlay

`ma-atlassian` connects the upstream planning and build skills to Jira and Confluence without
editing them. It writes marker-delimited overrides and a ticket-store selection; removing it with
`unbind` returns every target to upstream behaviour.

### Config questions

Answers are stored by `bmad setup`: team-scoped keys in `_bmad/custom/config.toml`, user-scoped
keys (the two MCP server names) in `_bmad/custom/config.user.toml`. No answer holds a credential.

| Key | Default | Scope | Meaning |
|---|---|---|---|
| `jira_site` | — | team | Jira Server/Data Center base URL |
| `jira_project_key` | — | team | default Jira project key |
| `jira_mcp_server` | empty | user | name of the MCP server that reaches Jira; empty = REST with ambient credentials |
| `confluence_site` | — | team | Confluence Server/Data Center base URL |
| `confluence_mcp_server` | empty | user | name of the MCP server that reaches Confluence; empty = REST with ambient credentials |
| `planning_space` | — | team | space key of the planning destination |
| `planning_root_page` | empty | team | root page of the planning destination; empty = a page named for the project, recorded by `ma-atlassian-confluence-record-root-page` |
| `tickets_space` | `planning_space` | team | space key of the tickets destination |
| `tickets_root_page` | empty | team | root page of the tickets destination; empty as for `planning_root_page` |

### Destinations

| Destination | Content |
|---|---|
| planning | PRD, architecture, UX, brief, PRFAQ, facilitate outputs |
| tickets | initiative, epic and story files, build plans |

Published pages mirror the initiative store layout under the destination's root page.

### Bind target table

Slot per upstream skill, fixed for the pinned core; `ma-atlassian-bind status` re-checks the slot
exists.

| Target | Section | Key | Role |
|---|---|---|---|
| bmad-prd, bmad-architecture, bmad-facilitate | `[workflow]` | `external_handoffs` | publish to planning destination |
| same three | `[workflow]` | `external_sources` | read Confluence before drafting |
| bmad-ux, bmad-product-brief, bmad-prfaq | `[workflow]` | `on_complete` | publish to planning destination |
| bmad-build, bmad-build-auto, bmad-code-review, bmad-retrospective | `[workflow]` | `activation_steps_prepend` | read the ticket's Confluence page |
| bmad-agent-po | `[agent]` | `persistent_facts` | Jira identity clause + type/status map |
| bmad-agent-po | `[workflow]` | `board_after`, `store_after` | publish ticket pages after board/store changes |

Overrides are marker-delimited blocks (`# ma-atlassian:start` / `# ma-atlassian:end`) in
`_bmad/custom/<skill>.toml`; bind never writes outside its markers, refuses with a report when the
key already holds a user value, and `unbind` removes only its blocks.

### Jira store

`bmad-agent-po` reads a store that has no starter in its own `config/` folder from the project file
alone, so bind writes the whole starter `config/jira-onprem-ticketing.toml` into
`_bmad/custom/ticketing-store-config.toml` between its markers, with `store = "jira-onprem"` and the
`jira_site`, `jira_project_key` and `jira_mcp_server` answers filled in. Keys a project sets outside
the markers win, so a project changes a map entry there.

| BMad type | Jira work type |
|---|---|
| initiative | empty (the initiative stays local) |
| epic | Epic |
| story | Story |
| spike | Task, plus label `spike` |
| bug | Bug |

| BMad state | Jira status |
|---|---|
| backlog | To Do |
| in-progress | In Progress |
| review | In Review |
| done | Done |
| dropped | Done, resolution Won't Do |

### Migration from 3.x

`bmod-ma-atlassian/migration-1.toml` (3.x → 4.x): reads `project-layout.yaml` and the 3.x
Confluence override markers in `_bmad/custom/*.toml`, writes the module answers (team keys to
`config.toml`, user keys to `config.user.toml`), runs `ma-atlassian-bind bind`, deletes the old
markers, and reports every key it mapped, asked for or could not map. When the 3.x binding names
two requirement stores, it asks which becomes the planning destination.

---

## Functional Requirements

### Platform target and offline runtime

- FR280: **Target commit.** ma-agents 4.x is built and tested against exactly one upstream BMAD-METHOD commit, recorded in `package.json` `bmadRef.core`; `bmadRef` also records the Skills CLI version (`skillsCli`), the `tea` and `cis` tags and the bundled `ma-bmad-extensions` tag (`extensions`). The bundle (FR299), the bind target table (FR290) and the CI gates (NFR84) use these values. A different commit is adopted only by a release that updates `bmadRef` and re-runs the qualification gate (FR281)
- FR281: **Qualification gate.** A qualification gate records a pass or fail verdict per `bmadRef.core` commit; it passes when NFR84, NFR87 and the offline install of FR282 pass at that commit. Releases on a commit that is not an upstream GA tag publish under npm dist-tag `next` with a semver pre-release suffix. The on-prem release of 4.x requires a gate pass on an upstream GA tag; until then ma-agents 3.x is the on-prem release
- FR282: **Offline runtime.** The bundle ships `uv`, a Python 3.11 interpreter and a wheelhouse for linux-x64 and win-x64 covering every PEP 723 dependency declared by the bundled scripts. The installer copies the host platform's runtime to `.ma-agents/runtime/` in the install scope, exports `UV_PYTHON`, `UV_FIND_LINKS`, `UV_OFFLINE=1` and `UV_NO_CACHE=1` for its own uv calls (made only through one runner module, always `uv run --no-cache`) and writes the same settings to a `uv.toml` in the install scope, so that with no network every bundled skill activates and `render_skill.py`, `resolve_config.py`, `resolve_customization.py`, `tickets.py` and `setup.py` run with `uv run --no-cache`
- FR283: **Skills CLI.** The bundle carries the `skills` npm package at `bmadRef.skillsCli`; the installer runs it from the bundle and installs every module with `skills add <bundle path> --skill … -y --agent <tool>`, attempting no network access
- FR284: **Headless setup.** The installer runs BMAD setup non-interactively: it writes the collected answers to a TOML file and calls `setup.py --module-answers <file>` under `uv run --no-cache`. When that call fails, the installer exits non-zero and prints the exact `bmad setup <code>` command for each selected module

### Module packaging

- FR285: **Repository layout.** `ma-bmad-extensions` holds each module record in `skills/bmod-<code>/` (`bmod.toml`, `help/help.md`, `retired.toml`, `roster.toml` where the module has agents, `migration-<n>.toml` files) and each member skill in `skills/<name>/` with a `bmod.toml` `[skill]` table (`bmod`, `source`, `scripts`). Upstream `validate_manifests.py` passes in CI
- FR286: **Roster and help.** `bmod-ma-ops/roster.toml` lists Alex (`ma-agent-sre`), Yael (`ma-agent-cyber`), Amit (`ma-agent-devops`) and Gadi (`ma-agent-sqa`) in group `ops`, each with name, title, icon and a one-line persona; Gadi carries the MIL-STD-498 and SQA workflows. Every module ships `help/help.md` listing each of its skills with one line on what it does and when to use it, so the `bmad` skill can route a request to it
- FR287: **Naming.** No owned skill carries the `bmad-` prefix, which upstream reserves. The first release records two renames: `bmad-dev-epic` → `ma-ops-dev-epic` in `bmod-ma-ops/retired.toml` and `bmad-knowledge` → `ma-knowledge-atlas` in `bmod-ma-knowledge/retired.toml`; a retired name is never reused. The 3.x skills `bmad-sprint-planning`, `bmad-sprint-status` and `bmad-dev-story` have no 4.x counterpart (upstream `bmad-agent-po` and `bmad-build` provide those functions) and the upgrade (FR294) removes them
- FR288: **Config reads.** Owned skills read configuration only through `uv run {project-root}/_bmad/scripts/resolve_config.py` (`core.*`, `modules.<code>.*`) and customization only through `resolve_customization.py`. A CI test fails when an owned skill reads a configuration key or file that the pinned BMAD commit does not define
- FR295: **Complete module assignment.** Every tracked skill is assigned to exactly one module as listed in the [Package map](#package-map), or is listed under "Tracked skills with no 4.x module" with its replacement. A CI test enumerates the tracked skills and fails on a skill that is in no module, in two modules, or in a module not named by the package map

### Tracking and Atlassian

- FR289: **Jira as a ticket store.** `bmod-ma-atlassian` ships `config/jira-onprem-ticketing.toml`, a ticket-store starter for Jira Server and Data Center reached through the MCP server named by `jira_mcp_server` or, when that answer is empty, through the Jira REST API with the host's ambient credentials. `ma-atlassian-bind` selects it by writing the whole starter into `_bmad/custom/ticketing-store-config.toml` between its markers, with `store = "jira-onprem"` and the site, project key and MCP server name from the setup answers; keys set outside the markers win. The type and status maps are those of [Jira store](#jira-store); the Jira identity clause and the maps reach `bmad-agent-po` as `persistent_facts`. Jira transitions run through `bmad-agent-po`'s board verbs; no other skill carries Jira routing text
- FR290: **Confluence publish and read.** `ma-atlassian-bind` writes one override per row of the [bind target table](#bind-target-table): publish to the planning destination from `bmad-prd`, `bmad-architecture`, `bmad-facilitate` (`external_handoffs`) and `bmad-ux`, `bmad-product-brief`, `bmad-prfaq` (`on_complete`); read Confluence before drafting in `bmad-prd`, `bmad-architecture`, `bmad-facilitate` (`external_sources`); read the ticket's Confluence page at activation of `bmad-build`, `bmad-build-auto`, `bmad-code-review`, `bmad-retrospective` (`activation_steps_prepend`); publish ticket pages to the tickets destination after `bmad-agent-po` board and store changes (`board_after`, `store_after`). The table is fixed for `bmadRef.core`. Published pages mirror the initiative store layout under the destination's root page
- FR291: **Bind and unbind.** `ma-atlassian-bind` is idempotent and keyed per target (skill, section, key). It writes only between `# ma-atlassian:start` / `# ma-atlassian:end` markers in `_bmad/custom/<skill>.toml`; when the key already holds a user-authored value it leaves the file unchanged and reports the target and key. `unbind` removes only its own marker blocks and the ticket-store selection it wrote. `status` reports, per target, bound / not installed / slot missing, and the two destinations. A target absent on disk is reported, not failed. The user re-runs `bind` after any module install or `bmad setup`
- FR292: **Epic orchestration.** `ma-ops-dev-epic` reads epics and stories only through `tickets.py` and writes story status only through `bmad-build`'s plan file; for each story it runs `bmad-build` or `bmad-build-auto`, then `bmad-code-review`, `bmad-review` and `bmad-walkthrough`. No owned skill reads or writes a sprint tracker file. Its model tiers and publish settings are `customize.toml` defaults. When `git-workflow-skill` or `code-review` is not installed it reports so and runs without the worktree and review steps
- FR293: **Knowledge-store configuration.** The initiative store lives under `core.output_folder`; Confluence locations are the `modules.ma-atlassian.*` answers (FR300). Both are setup answers committed with the project in `_bmad/custom/config.toml`, read through `resolve_config.py` at activation, and independent of install scope. No skill keeps a second record of a store location
- FR296: **Sprint functions.** The 4.x line ships none of `add-sprint`, `add-to-sprint`, `close-sprint`, `cleanup-done`, `modify-sprint`, `remove-from-sprint`, `prioritize-backlog`, `generate-backlog`, `sprint-status-view`, `story-status-lookup`, `my-next-issue`, `create-bug-story`. Their functions are provided by `bmad-agent-po` with the configured ticket store, including the Jira store (FR289): "what's next" for `my-next-issue`; "file a bug" for `create-bug-story`; the board for sprint planning, prioritisation, status views and story status lookup. `bmod-ma-ops/migration-1.toml` carries 3.x backlog and sprint data over (FR294), and the upgrade report lists each removed skill with the `bmad-agent-po` request that replaces it
- FR300: **Confluence configuration model.** Confluence content goes to two destinations: planning (PRD, architecture, UX, brief, PRFAQ, facilitate outputs) and tickets (initiative, epic and story files, build plans). `ma-atlassian` asks the nine config questions of [Config questions](#config-questions) (`jira_site`, `jira_project_key`, `jira_mcp_server`, `confluence_site`, `confluence_mcp_server`, `planning_space`, `planning_root_page`, `tickets_space`, `tickets_root_page`); `tickets_space` defaults to `planning_space`; the two MCP server names are user-scoped, the rest team-scoped. No answer holds a credential. `ma-atlassian-bind status` reports both destinations (space, root page) and every bound target

### Installation, upgrade and versioning

- FR294: **Migrations and upgrade.** Every user-visible change to on-disk files between two 4.x releases ships as a `migration-<n>.toml` that `bmad migrate` runs. `install` on a 3.x project backs up `_bmad/`, `_bmad-output/` and the IDE instruction files, uninstalls the 3.x parts, installs 4.x, then runs `bmad migrate method` followed by `bmod-ma-ops/migration-1.toml` and `bmod-ma-atlassian/migration-1.toml` (inputs and outputs in the [Package map](#package-map) and [Migration from 3.x](#migration-from-3x)). Each migration is idempotent: a re-run on a migrated or partly migrated project completes the remaining steps and leaves completed ones unchanged. A migration never overwrites an existing file; a name collision gets a numeric suffix and a report line. Each migration writes a report under `{output_folder}` listing every input read, every file written or archived, and every collision
- FR297: **Adding modules.** Any BMAD v7 module installs with `npx skills add <source> --skill …` followed by `bmad setup <code>`, with or without the ma-agents installer; that includes every module of `ma-bmad-extensions`, installed online from a tag or from a local folder. The installer offers additional module sources through the wizard and `--source` (repeatable): a local folder offline, or a Git URL online (including an intra-perimeter Git host, authenticated by the host's ambient git configuration; the installer stores no credentials). An additional module's config questions join the wizard. Bundled modules record `update_source` as `file:`; a Git-hosted install records `https://`. Installing without the installer requires Node ≥ 20.12, `uv` and Python ≥ 3.11
- FR298: **Installer surface.** The `ma-agents` 4.x package provides the commands `install`, `update`, `status`, `uninstall` and `bundle build`, the wizard questions, the flags and the install sequence of [Installer](#installer), and declares `engines.node` `>=20.12.0`. The wizard and the `--yes` path run the same code with the same answers file, so an interactive install and a `--yes` install with equal answers produce the same result. `uninstall` removes only what the installer installed (per `skills-lock.json`) and the `ma-agents` block; on a 3.x project it also removes the `ma-skills` module and the tool directories listed in `.ma-agents.json`
- FR299: **Bundle contents and manifest.** The bundle holds the items of [Bundle](#bundle), each recorded in `bundle/manifest.json` with its SHA-256, source and version. `install` verifies the manifest before any other step. `bundle build` is deterministic: the same `bmadRef` and `ma-bmad-extensions` tag produce a byte-identical bundle and manifest
- FR301: **IDE injection ownership.** Two marker blocks, two owners: the installer writes only the `<!-- ma-agents:start/end -->` block (installed modules and the `bmad` entry point); `ma-standards-apply` writes only the `<!-- ma-standards:start/end -->` block. Neither touches the other's markers or user prose, and upstream skills that write their own blocks are a third, independent writer. An integration test runs all three writers on the same `AGENTS.md` in both orders and asserts each block and the user prose survive
- FR302: **Version and compatibility record.** `package.json` `bmadRef` records `core`, `skillsCli`, `tea`, `cis` and `extensions` (the bundled `ma-bmad-extensions` tag). `ma-agents status` prints the installer version, the `ma-bmad-extensions` version, the core commit and the Skills CLI version, then the output of `bmad status`. Every module declares `required_skills = [{ skill = "bmad", version = <core version> }]`, where the core version is the version of the `bmad` skill at `bmadRef.core`

## Quality Attributes (Non-Functional Requirements)

### ma-agents 4.x

- NFR84: **Per-module CI gates.** For each module: upstream `validate_manifests.py` passes; the module installs alone from a local folder and from a tag into a vanilla BMAD v7 project at `bmadRef.core`, with `bmad setup <code>` driven by `--module-answers`; `bmad status` reports it current; every skill activates offline with the bundled runtime (FR282). Skill names are unique across our repository and the bundled upstream snapshot
- NFR86: **One version line.** Every `bmod.toml` record in `ma-bmad-extensions` carries the same version; a change in any module bumps that shared version; modules remain independently installable (FR297). The installer bundles one `ma-bmad-extensions` tag
- NFR87: **Upgrade test.** CI upgrades a ma-agents 3.18.x project fixture (sprint data, Confluence binding, IDE instruction files) to 4.x and asserts that no artefact is lost: the backup holds every pre-upgrade file, every backlog entry and sprint appears in the migrated store or the archive, the Confluence answers and overrides are present, and each migration report lists every input it read
