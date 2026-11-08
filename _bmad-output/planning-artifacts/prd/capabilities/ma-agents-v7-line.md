# ma-agents 4.x on BMAD v7

> **Shard** of the [PRD index](../../prd.md). The index carries the front matter, registers and
> reading order.
>
> Capability **F29 — ma-agents 4.x on BMAD v7**. Requirements FR280–FR305, NFR84, NFR86, NFR87.

---

## Purpose

ma-agents 4.x delivers the organisation's agents, skills, coding standards, Knowledge Atlas and
Jira/Confluence integration as BMAD v7 modules, and installs them together with a pinned BMAD v7 on
machines that have no internet access. It serves three purposes: an offline on-prem install; the
organisation's own agents and skills; Jira and Confluence as the team's systems of record.

Every module installs and works on a BMAD v7 project that has the `method` module, without the
ma-agents installer, and no module requires another of our modules. The installer adds what a
disconnected machine lacks: a bundle of every artefact the install needs, a single wizard, headless
setup and IDE instruction injection.

## Product lines

| Line | Content | Status |
|---|---|---|
| ma-agents 3.x | monolithic npm package; installs bmad-method 6.10.0 and the `ma-skills` module; sprint skills over `sprint-status.yaml`; Confluence two-store binding | maintenance only, from branch `maint/3.x` (cut at `v3.18.1`); the supported on-prem release until the 4.x qualification gate passes on an upstream GA tag |
| ma-agents 4.x | thin offline installer (npm `ma-agents` 4.x) + `ma-bmad-extensions` modules on BMAD v7 | pre-releases `4.0.0-next.N` on dist-tag `next` until the gate passes on a GA tag; then `4.0.0` on `latest` as the on-prem release |

BMAD target of 4.x: upstream `bmad-code-org/BMAD-METHOD` at the commit recorded in `package.json`
`bmadRef.core` (initial value `e734d3ac3c0f4ea31cc2c2bbbe79e86e54f2cae6`). `bmadRef` also records
`skillsCli` (npm `skills` version, initial `1.7.6`), the `tea` and `cis` tags, and `extensions`
(the bundled `ma-bmad-extensions` tag, initial `v1.0.0`).

The 3.x line is specified by the other capability files of this PRD. This file specifies the 4.x line.

## Vocabulary

`bmad setup <code>`, `bmad status` and `bmad migrate` are requests a user makes to the `bmad` skill
inside a coding tool, not shell commands. Their scripted forms, used by the installer and by CI, are
`uv run --no-cache <bmad>/scripts/setup.py --project-root . --skill <bmad>` with `--module <code>`,
`--status` and `--module-answers <file>`; `--list-config-questions` lists the pending questions.
Migrations have no scripted form: an agent follows a `migration-<n>.toml` after the user approves
its plan. Where this file says "the installer prints `bmad setup <code>`", it prints the instruction
"ask `bmad` to run `bmad setup <code>`" together with the scripted form.

## Package map

Repository `ma-bmad-extensions` (`github:mayafit/ma-bmad-extensions`), layout `skills/<name>/`, one
version line. It holds four modules. Each module record lives in `skills/bmod-<code>/`; each member
skill lives in `skills/<name>/`. `update_source` of every record and `source` of every member are
`github:mayafit/ma-bmad-extensions/skills`, in the repository and in the bundle alike.

Every record declares `required_skills = [{ skill = "bmad", version = "6.13.0", source =
"github:bmad-code-org/BMAD-METHOD/skills" }]`; `bmod-ma-ops` and `bmod-ma-atlassian` add
`bmad-agent-po` and `bmad-build` from the same source, because their skills call `tickets.py` and
`bmad-build`. No record names another of our modules in `required_skills`.

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
  epics and stories with `tickets.py`; starts and completes stories through `bmad-agent-po` board
  requests; declares `scripts/migrate_v6_backlog.py` in its `[skill] scripts`).
- **`retired.toml`:** `renamed = [{ from = "bmad-dev-epic", to = "ma-ops-dev-epic" }]`.
- **`migration-1.toml`** (3.x → 4.x): see [Migration from 3.x: tracking data](#migration-from-3x-tracking-data).
- **Config questions:** none. `ma-ops-dev-epic`'s model tiers and `[workflow] on_epic_complete`
  (default empty) are defaults in its `customize.toml`.
- **`required_skills`:** `bmad`, `bmad-agent-po`, `bmad-build` (upstream). **`recommended_skills`:**
  `git-workflow-skill`, `code-review` (from `bmod-ma-standards`, declared with `source`; if absent,
  `ma-ops-dev-epic` reports it and runs without the worktree and review steps).

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
- **Config questions:** none. **`retired.toml`:** empty. **`required_skills`:** `bmad`.
- `auto-bug-detection` classifies code as delivered or in progress from the ticket store and files a
  confirmed defect through `bmad-agent-po` ("file a bug") when that skill is installed; it checks
  for `_bmad/method/scripts/tickets.py` at activation and otherwise reports the defect in the
  conversation and says that no store is available.

### bmod-ma-knowledge (code `ma-knowledge`)

- **Skill:** `ma-knowledge-atlas` (Knowledge Atlas HTML site generated from the initiative store
  under `core.output_folder`; engine bundled in `assets/atlas.cjs`, run with `node`). It checks for
  `_bmad/method/scripts/tickets.py` at activation and reports its absence.
- **Config question:** `atlas_output`, default `""`, meaning `{output_folder}/knowledge-atlas`,
  resolved by the skill at activation.
- **`retired.toml`:** `renamed = [{ from = "bmad-knowledge", to = "ma-knowledge-atlas" }]`.
  **`required_skills`:** `bmad`.

### bmod-ma-atlassian (code `ma-atlassian`) — overlay

- **Skills:** `ma-atlassian-bind` (sub-commands `bind`, `unbind`, `status`; ships the store starter
  `config/jira-onprem-ticketing.toml`, the bind target table `references/bind-targets.toml`, and
  declares in its `[skill] scripts` the publish engine, page tree, override generator, collision
  check, all JavaScript run with `node`, and `scripts/migrate_binding.js`),
  `ma-atlassian-confluence-plan` (preview of the page tree an initiative would publish),
  `ma-atlassian-confluence-record-root-page`.
- **`retired.toml`:** empty. **`required_skills`:** `bmad`, `bmad-agent-po`, `bmad-build`.
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
| `update` | re-runs the install sequence for the modules recorded in `.ma-agents/install.json` from the package's bundle (only pending config questions are asked), then prints "ask `bmad` to run `bmad migrate`" with the list of modules whose version changed |
| `status` | prints installer version, `bmadRef.extensions`, `bmadRef.core`, `bmadRef.skillsCli`, install scope, installed modules (from `install.json`), the output of `setup.py --status`, and `ma-atlassian-bind status` when `ma-atlassian` is installed |
| `uninstall` | see [Uninstall](#uninstall) |
| `bundle build` | maintainer command; assembles `bundle/` and `bundle/manifest.json` (FR299) |

### Wizard

All questions have flags for `--yes`.

1. Install scope: `project` | `global`.
2. Coding tools, mapped to Skills CLI `--agent` values. A tool with no Skills CLI target is reported
   and skipped.
3. Modules: `core-tools` and `method` always; `toolsmith`, `founder`, `ma-ops`, `ma-standards`,
   `ma-knowledge`, `ma-atlassian` selectable; `tea` and `cis` selectable only when
   `bundle/manifest.json` lists them (otherwise the recorded omission is printed). Default selection:
   `core-tools`, `method`, `ma-ops`, `ma-standards`, `ma-knowledge`.
4. Per-module config answers, for the questions `setup.py --list-config-questions` reports as
   pending among each selected record's `[[bmod.config_questions]]`.
5. Additional module sources: a local folder or a Git URL, repeated (FR297).
6. IDE instruction injection: yes/no.

### Flags

`--yes`, `--scope`, `--tools a,b`, `--modules a,b`, `--answers <toml>`, `--source <path|url>`
(repeatable), `--bundle <dir>` (default: the package's own `bundle/`), `--no-inject`.

`--answers` is the installer's own input format: a TOML file with one table per module code
(`[ma-atlassian]`, `[ma-knowledge]`, …) whose keys are that module's config question keys. With
`--yes`, a pending question with no answer in the file takes its declared default. When
`ma-atlassian` is selected, `--yes` without a non-empty `jira_site`, `jira_project_key`,
`confluence_site` and `planning_space` stops the install naming the missing keys.

### Install sequence

1. Verify the bundle manifest (SHA-256 per item); stop on any mismatch.
2. Copy the host platform's runtime (uv, Python 3.11, wheelhouse) to `<project-root>/.ma-agents/runtime/`
   (scope `project`) or `~/.ma-agents/runtime/` (scope `global`). Export, for the installer's own uv
   calls, `UV_PYTHON_INSTALL_DIR`, `UV_PYTHON_PREFERENCE=only-managed`, `UV_PYTHON_DOWNLOADS=never`,
   `UV_FIND_LINKS`, `UV_OFFLINE=1`, `UV_NO_CACHE=1`. Write the same settings as
   `python-install-dir`, `python-preference = "only-managed"`, `python-downloads = "never"`,
   `find-links`, `offline = true`, `no-cache = true` to `<project-root>/.ma-agents/uv.toml` (project)
   or the uv user configuration file (global). The installer spawns uv only through one runner module,
   always as `uv run --no-cache`.
3. Unpack `bundle/skills-cli/skills-<skillsCli>.tgz` into `<scope>/.ma-agents/skills-cli/` and run
   `node <that>/<bin entry> add <bundle>/bmad-method --skill … -y --agent <tool>` with the Skills CLI
   telemetry opt-out variables set.
4. The same for each selected module source.
5. Run `setup.py --list-config-questions` (one `--root` per active skills folder). Answer each pending
   question from `--answers`, the wizard or its declared default, and write only those answers to a
   temporary file as `[modules."<code>"]` tables.
6. Run `setup.py --module-answers <file>` under `uv run --no-cache`; delete the file.
7. Record every skill, agent target and source added in `<scope>/.ma-agents/install.json`.
8. Inject the `<!-- ma-agents:start/end -->` block (lists installed modules, the `bmad` entry point
   and the `UV_CONFIG_FILE` setting the coding tool applies for skill activations), unless `--no-inject`.
9. `status`.

With scope `global`, steps 3–4 install at user level (Skills CLI global mode) and steps 5–8 run for
the project in the current directory; `bmad setup <code>` sets up further projects.

### Bundle

`bundle/manifest.json` records a SHA-256 per item. Contents:

- BMAD-METHOD `skills/` at `bmadRef.core` (records `core-tools`, `method`, `toolsmith`, `founder`).
- The `tea` and `cis` repositories at `bmadRef.tea` / `bmadRef.cis`. A repository whose tag carries
  no bmod record is omitted from the bundle and the omission is recorded in the manifest.
- `ma-bmad-extensions` at `bmadRef.extensions`, files unchanged.
- The `skills` CLI tarball `skills-cli/skills-<skillsCli>.tgz`.
- `uv` binaries and python-build-standalone 3.11 for linux-x64 and win-x64.
- A wheelhouse for those two platforms covering every PEP 723 dependency declared in the bundled
  scripts (enumerated by `bundle build`).

`bundle/` is git-ignored and listed in the npm package's `files`.

### Uninstall

`uninstall` removes exactly the skills `.ma-agents/install.json` lists, through the Skills CLI
`remove` command, and the injected `ma-agents` block. On a 3.x project it also removes the
`ma-skills` module and the tool directories listed in `.ma-agents.json`, which is read only on a 3.x
project. It never removes files it did not install.

### Upgrade from 3.x

`install` on a 3.x project copies `_bmad/`, the 3.x output folder, `.ma-agents.json` and every
instruction file the 3.x installer wrote (`AGENTS.md`, `CLAUDE.md`, `.clinerules`, `.roomodes`,
`.github/copilot-instructions.md`) to `.ma-agents-backup-<datetime>/`, runs uninstall of the 3.x
parts, installs 4.x, and ends by printing "ask `bmad` to run `bmad migrate`", which runs `method`'s
migration and then the `ma-ops` and `ma-atlassian` migrations (FR294).

### IDE instruction blocks

The installer owns the `ma-agents` block; `ma-standards-apply` owns the `ma-standards` block;
upstream `bmad-project-context` owns its `<!-- bmad:context -->` / `<!-- /bmad:context -->` block.
None touches another's markers (FR301).

### Versioning

Installer `4.x` semver; `ma-bmad-extensions` has its own semver (one version line, tagged, recorded
as `bmadRef.extensions`); upstream is `bmadRef.core`, `skillsCli`, `tea`, `cis`. `bmadRef` ties the
three lines; `status` prints all (FR302).

## Atlassian overlay

`ma-atlassian` connects the upstream planning and build skills to Jira and Confluence without
editing them. It writes owned keys into `_bmad/custom/<skill>.toml` files and a ticket-store
selection; removing it with `unbind` returns every target to upstream behaviour.

### Config questions

Setup writes team-scoped answers to `_bmad/config.toml` and user-scoped answers to
`_bmad/custom/config.user.toml`; a team overrides a key in `_bmad/custom/config.toml`. Every question
has the default `""`. No answer holds a credential.

| Key | Scope | Required | Meaning |
|---|---|---|---|
| `jira_site` | team | yes | Jira Server/Data Center base URL |
| `jira_project_key` | team | yes | default Jira project key |
| `jira_mcp_server` | user | no | name of the MCP server that reaches Jira; empty = REST with ambient credentials |
| `confluence_site` | team | yes | Confluence Server/Data Center base URL |
| `confluence_mcp_server` | user | no | name of the MCP server that reaches Confluence; empty = REST with ambient credentials |
| `planning_space` | team | yes | space key of the planning destination |
| `planning_root_page` | team | no | root page of the planning destination; empty = a page named for the project, recorded by `ma-atlassian-confluence-record-root-page` |
| `tickets_space` | team | no | space key of the tickets destination; empty = `planning_space` |
| `tickets_root_page` | team | no | root page of the tickets destination; empty as for `planning_root_page` |

A required key left empty leaves the module unbound: `ma-atlassian-bind status` reports
"unbound: missing answer <key>".

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

### Override format

Bind parses `_bmad/custom/<skill>.toml`, inserts each owned key into its existing `[workflow]` or
`[agent]` table (creating the table header only when absent), and brackets each owned key line with
the comment lines `# ma-atlassian:start <table>.<key>` and `# ma-atlassian:end`. A key the user
already set is a collision: bind leaves the file unchanged and reports the target and key. `unbind`
removes only the bracketed lines it wrote. The file stays valid TOML after every operation.

### Jira store

`bmad-agent-po` reads a store that has no starter in its own `config/` folder from the project file
alone, so bind writes the whole starter `config/jira-onprem-ticketing.toml` into
`_bmad/custom/ticketing-store-config.toml`, writing only keys the file does not yet define, each
bracketed as above. The store file keys:

| Key | Value |
|---|---|
| `[tickets] store` | `"jira-onprem"` |
| `[tickets] site` | `jira_site` |
| `[tickets] key` | `jira_project_key` |
| `[tickets] mcp_server` | `jira_mcp_server` |
| `[tickets.types]`, `[tickets.status]` | the maps below |
| `[verbs]` `setup`, `create`, `transition`, `query`, `assign`, `link` | a REST form and an MCP form each; the MCP form is used when `mcp_server` is non-empty |

A project changes a map entry in its store file.

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

The identity clause in `persistent_facts` states: "my work" means `assignee = currentUser()`; when
the authenticated account is a shared or service account, stop and ask for a personal identity.

### Migration from 3.x: binding

`bmod-ma-atlassian/migration-1.toml` (3.x → 4.x). `detect`: `_bmad-output/project-layout.yaml`
exists, or a `_bmad/custom/*.toml` contains the 3.x `MA-AGENTS-START` marker. `guide` runs
`node _bmad/ma-atlassian/scripts/migrate_binding.js`, which reads `project-layout.yaml` and the 3.x
override markers, writes the module answers through `setup.py --module-answers` (team keys to
`_bmad/config.toml`, user keys to `config.user.toml`), deletes the 3.x marker blocks, runs
`ma-atlassian-bind bind`, and writes a report listing every key it mapped, asked for or could not
map. When the 3.x binding names two requirement stores, it asks which becomes the planning
destination.

### Migration from 3.x: tracking data

`bmod-ma-ops/migration-1.toml` (3.x → 4.x). `detect`: `archive-v6/sprint-status.yaml` exists under
an initiative and contains a `backlog:` or `sprints:` key. `guide` runs
`uv run --no-cache _bmad/ma-ops/scripts/migrate_v6_backlog.py`, which reads the archived copy,
writes each `backlog:` item that is not already a ticket-tree entry (matched by `v6_key`) to
`{output_folder}/backlog/<type>-<slug>.md` carrying its `v6_key`, writes the `sprints:` section to
`archive-v6/sprints.yaml`, and writes its report to `{output_folder}/migration-v6-v7/ma-ops-migration-1.md`
listing every item moved, skipped (with the matching entry) or not mapped. A re-run writes nothing
already present.

---

## Functional Requirements

### Platform target and offline runtime

- FR280: **Target commit.** ma-agents 4.x is built and tested against exactly one upstream BMAD-METHOD commit, recorded in `package.json` `bmadRef.core`; `bmadRef` also records the Skills CLI version (`skillsCli`), the `tea` and `cis` tags and the bundled `ma-bmad-extensions` tag (`extensions`). The bundle (FR299), the bind target table (FR290) and the CI gates (NFR84) use these values. A different commit is adopted only by a release that updates `bmadRef` and re-runs the qualification gate (FR281)
- FR281: **Qualification gate.** A qualification gate records a pass or fail verdict per `bmadRef.core` commit; it passes when NFR84, NFR87 and the offline install of FR282 pass at that commit. Packages built on a commit that is not an upstream GA tag publish under npm dist-tag `next` with a semver pre-release suffix (`4.0.0-next.N`). The on-prem release of 4.x (`4.0.0` on dist-tag `latest`) requires a gate pass on an upstream GA tag; until then ma-agents 3.x is the on-prem release
- FR282: **Offline runtime.** The bundle ships `uv`, a Python 3.11 interpreter and a wheelhouse for linux-x64 and win-x64 covering every PEP 723 dependency declared by the bundled scripts. The installer copies the host platform's runtime to `.ma-agents/runtime/` in the install scope, exports `UV_PYTHON_INSTALL_DIR`, `UV_PYTHON_PREFERENCE=only-managed`, `UV_PYTHON_DOWNLOADS=never`, `UV_FIND_LINKS`, `UV_OFFLINE=1` and `UV_NO_CACHE=1` for its own uv calls, and writes the same settings to `<project-root>/.ma-agents/uv.toml` (project scope) or the uv user configuration file (global scope), selected for skill activations by `UV_CONFIG_FILE`. With no network every bundled skill activates and `render_skill.py`, `resolve_config.py`, `resolve_customization.py`, `tickets.py` and `setup.py` run with `uv run --no-cache`
- FR283: **Skills CLI.** The bundle carries the `skills` npm package tarball at `bmadRef.skillsCli`; the installer unpacks it under `.ma-agents/skills-cli/` and runs its `add` command with `node` against the bundle path for every module (`--skill … -y --agent <tool>`), with telemetry opted out, attempting no network access
- FR284: **Headless setup.** The installer runs BMAD setup non-interactively: it lists the pending config questions with `setup.py --list-config-questions`, answers only those from `--answers`, the wizard or the declared defaults, writes them as `[modules."<code>"]` tables to a temporary file, calls `setup.py --module-answers <file>` under `uv run --no-cache`, and deletes the file. When that call fails, the installer exits non-zero and prints, for each selected module, the instruction to ask `bmad` to run `bmad setup <code>` and its scripted form

### Module packaging

- FR285: **Repository layout.** `ma-bmad-extensions` holds each module record in `skills/bmod-<code>/` (`bmod.toml`, `help/help.md`, `retired.toml`, `roster.toml` where the module has agents, `migration-<n>.toml` files) and each member skill in `skills/<name>/` with a `bmod.toml` `[skill]` table (`bmod`, `source`, `scripts`). Upstream `validate_manifests.py` passes in CI
- FR286: **Roster and help.** `bmod-ma-ops/roster.toml` lists Alex (`ma-agent-sre`), Yael (`ma-agent-cyber`), Amit (`ma-agent-devops`) and Gadi (`ma-agent-sqa`) in group `ops`, each with name, title, icon and a one-line persona; Gadi carries the MIL-STD-498 and SQA workflows. Every module ships `help/help.md` listing each of its skills with one line on what it does and when to use it, so the `bmad` skill can route a request to it
- FR287: **Naming.** No owned skill carries the `bmad-` prefix, which upstream reserves. The first release records two renames: `bmad-dev-epic` → `ma-ops-dev-epic` in `bmod-ma-ops/retired.toml` and `bmad-knowledge` → `ma-knowledge-atlas` in `bmod-ma-knowledge/retired.toml`; a retired name is never reused. The 3.x skills `bmad-sprint-planning`, `bmad-sprint-status` and `bmad-dev-story` have no 4.x counterpart (upstream `bmad-agent-po` and `bmad-build` provide those functions) and the upgrade (FR294) removes them
- FR288: **Config reads.** Owned skills read configuration only through `uv run {project-root}/_bmad/scripts/resolve_config.py` (`core.*`, `modules.<code>.*`) and customization only through `resolve_customization.py`. A CI test fails when an owned skill reads a configuration key or file that the pinned BMAD commit does not define
- FR295: **Complete module assignment.** Every tracked skill is assigned to exactly one module as listed in the [Package map](#package-map), or is listed under "Tracked skills with no 4.x module" with its replacement. A CI test enumerates the tracked skills and fails on a skill that is in no module, in two modules, or in a module not named by the package map
- FR303: **Contract validator.** Every owned `customize.toml` and every file `ma-atlassian-bind` writes resolves through the pinned `resolve_customization.py`, references no undefined variable, and names only slots defined at `bmadRef.core`; a CI test runs the validator on every owned skill and on bind's output for every target of the [bind target table](#bind-target-table)

### Tracking and Atlassian

- FR289: **Jira as a ticket store.** `ma-atlassian-bind` ships `config/jira-onprem-ticketing.toml`, a ticket-store starter for Jira Server and Data Center reached through the MCP server named by `jira_mcp_server` or, when that answer is empty, through the Jira REST API with the host's ambient credentials. `bind` selects it by writing the whole starter into `_bmad/custom/ticketing-store-config.toml` (keys and maps of [Jira store](#jira-store); `store = "jira-onprem"`; site, project key and MCP server name from the setup answers), writing only keys the file does not yet define. The Jira identity clause and the maps reach `bmad-agent-po` as `persistent_facts`. Jira transitions run through `bmad-agent-po`'s board verbs; no other skill carries Jira routing text
- FR290: **Confluence publish and read.** `ma-atlassian-bind` writes one override per row of the [bind target table](#bind-target-table): publish to the planning destination from `bmad-prd`, `bmad-architecture`, `bmad-facilitate` (`external_handoffs`) and `bmad-ux`, `bmad-product-brief`, `bmad-prfaq` (`on_complete`); read Confluence before drafting in `bmad-prd`, `bmad-architecture`, `bmad-facilitate` (`external_sources`); read the ticket's Confluence page at activation of `bmad-build`, `bmad-build-auto`, `bmad-code-review`, `bmad-retrospective` (`activation_steps_prepend`); publish ticket pages to the tickets destination after `bmad-agent-po` board and store changes (`board_after`, `store_after`). The table is fixed for `bmadRef.core`. Published pages mirror the initiative store layout under the destination's root page
- FR291: **Bind and unbind.** `ma-atlassian-bind` is idempotent and keyed per target (skill, section, key). It writes in the [Override format](#override-format): each owned key inside its existing table, bracketed by its own comment markers; when the key already holds a user-authored value it leaves the file unchanged and reports the target and key; every file it touches stays valid TOML. `unbind` removes only the lines it wrote, including those in `ticketing-store-config.toml`. `status` reports, per target, bound / collision / not installed / slot missing, the two destinations, and any required answer that is empty. A target absent on disk is reported, not failed. The user re-runs `bind` after any module install or `bmad setup`
- FR292: **Epic orchestration.** `ma-ops-dev-epic` reads epics and stories only through `tickets.py`; for each story it asks `bmad-agent-po` to start the story, runs `bmad-build` or `bmad-build-auto`, then `bmad-code-review`, `bmad-review` and `bmad-walkthrough`, and asks `bmad-agent-po` to mark the story done, so the configured store moves its card; it never edits a plan's status line. No owned skill reads or writes a sprint tracker file. Its model tiers are `customize.toml` defaults; `[workflow] on_epic_complete` (default empty) is a user instruction run after the epic-level review gate, and the skill publishes nothing by default. When `git-workflow-skill` or `code-review` is not installed it reports so and runs without the worktree and review steps
- FR293: **Knowledge-store configuration.** The initiative store lives under `core.output_folder`; Confluence locations are the `modules.ma-atlassian.*` answers (FR300). Both are setup answers in `_bmad/config.toml` (team overrides in `_bmad/custom/config.toml`, user keys in `_bmad/custom/config.user.toml`), read through `resolve_config.py` at activation, and independent of install scope. No skill keeps a second record of a store location
- FR296: **Sprint functions.** The 4.x line ships none of `add-sprint`, `add-to-sprint`, `close-sprint`, `cleanup-done`, `modify-sprint`, `remove-from-sprint`, `prioritize-backlog`, `generate-backlog`, `sprint-status-view`, `story-status-lookup`, `my-next-issue`, `create-bug-story`. Their functions are provided by `bmad-agent-po` with the configured ticket store, including the Jira store (FR289): "what's next" for `my-next-issue`; "file a bug" for `create-bug-story`; the board for sprint planning, prioritisation, status views and story status lookup. `bmod-ma-ops/migration-1.toml` carries 3.x backlog and sprint data over (FR294), and the migration report lists each removed skill with the `bmad-agent-po` request that replaces it
- FR300: **Confluence configuration model.** Confluence content goes to two destinations: planning (PRD, architecture, UX, brief, PRFAQ, facilitate outputs) and tickets (initiative, epic and story files, build plans). `ma-atlassian` asks the nine config questions of [Config questions](#config-questions) (`jira_site`, `jira_project_key`, `jira_mcp_server`, `confluence_site`, `confluence_mcp_server`, `planning_space`, `planning_root_page`, `tickets_space`, `tickets_root_page`), every one with default `""`; `jira_site`, `jira_project_key`, `confluence_site` and `planning_space` require a non-empty answer; an empty `tickets_space` means `planning_space`; the two MCP server names are user-scoped, the rest team-scoped. No answer holds a credential. `ma-atlassian-bind status` reports both destinations (space, root page) and every bound target
- FR305: **Atlas inputs.** `ma-knowledge-atlas` reads `initiative-*/` envelopes, `tickets/**/tickets.toml` entries and each `*-plan.md` `status` under `core.output_folder`, and no v6 configuration key; a CI fixture initiative renders every epic and story with its status

### Installation, upgrade and versioning

- FR294: **Migrations and upgrade.** Every user-visible change to on-disk files between two 4.x releases ships as a `migration-<n>.toml` with `detect` and `guide`, run by the user through `bmad migrate`; the deterministic part of each migration is a script declared in a member skill's `[skill] scripts` (`migrate_v6_backlog.py` in `ma-ops-dev-epic`, `migrate_binding.js` in `ma-atlassian-bind`), which the `guide` calls. `install` on a 3.x project makes the backup of [Upgrade from 3.x](#upgrade-from-3x), uninstalls the 3.x parts, installs 4.x, then prints the instruction to ask `bmad` to run `bmad migrate`, which runs `method`'s migration and then `bmod-ma-ops/migration-1.toml` and `bmod-ma-atlassian/migration-1.toml` ([Migration from 3.x: binding](#migration-from-3x-binding), [Migration from 3.x: tracking data](#migration-from-3x-tracking-data)). Each migration script is idempotent: a re-run on a migrated or partly migrated project completes the remaining steps and leaves completed ones unchanged. A script never overwrites an existing file; a name collision gets a numeric suffix and a report line. Each script writes a report under `{output_folder}/migration-v6-v7/` listing every input read, every file written or archived, and every collision
- FR297: **Adding modules.** Any BMAD v7 module installs with `npx skills add <source> --skill …` followed by `bmad setup <code>`, with or without the ma-agents installer; that includes every module of `ma-bmad-extensions`, installed online from a tag or from a local folder. The installer offers additional module sources through the wizard and `--source` (repeatable): a local folder offline, or a Git URL online (including an intra-perimeter Git host, authenticated by the host's ambient git configuration; the installer stores no credentials). An additional module's config questions join the wizard. Every record keeps its `github:` `update_source`; offline, `setup.py --status` reports its update state as `could-not-check`, and the installer's `update` command uses `install.json` and the bundle. Installing without the installer requires Node ≥ 20.12, npm, Git, `uv` and Python ≥ 3.11
- FR298: **Installer surface.** The `ma-agents` 4.x package provides the commands `install`, `update`, `status`, `uninstall` and `bundle build`, the wizard questions, the flags and the install sequence of [Installer](#installer), and declares `engines.node` `>=20.12.0`. The wizard and the `--yes` path run the same code with the same answers, so an interactive install and a `--yes` install with equal answers produce the same result. `uninstall` removes only what `install.json` lists and the `ma-agents` block; on a 3.x project it also removes the `ma-skills` module and the tool directories listed in `.ma-agents.json`
- FR299: **Bundle contents and manifest.** The bundle holds the items of [Bundle](#bundle), each recorded in `bundle/manifest.json` with its SHA-256, source and version. `install` verifies the manifest before any other step. `bundle build` is deterministic: the same `bmadRef` produces a byte-identical bundle and manifest
- FR301: **IDE injection ownership.** Three marker blocks, three owners: the installer writes only the `<!-- ma-agents:start/end -->` block (installed modules, the `bmad` entry point, the `UV_CONFIG_FILE` setting); `ma-standards-apply` writes only the `<!-- ma-standards:start/end -->` block; upstream `bmad-project-context` writes its `<!-- bmad:context -->` / `<!-- /bmad:context -->` block. None touches another's markers or user prose. An integration test runs the three writers on the same `AGENTS.md` in all six orders, re-runs each, and asserts every block and the user prose survive byte-identical
- FR302: **Version and compatibility record.** `package.json` `bmadRef` records `core`, `skillsCli`, `tea`, `cis` and `extensions`. `ma-agents status` prints the installer version, `bmadRef.extensions`, the core commit and the Skills CLI version, then the output of `setup.py --status`. Every module declares `required_skills = [{ skill = "bmad", version = "6.13.0" }, …]`, the version `bmod-method` declares at `bmadRef.core`
- FR304: **uv execution.** The installer spawns uv only through one runner module, always as `uv run --no-cache` with an argv array; a test fails on any other uv execution site in the installer's JavaScript

## Quality Attributes (Non-Functional Requirements)

### ma-agents 4.x

- NFR84: **Per-module CI gates.** For each module: upstream `validate_manifests.py` passes; the module installs alone from a local folder and from a tag into a BMAD v7 project with the `method` module at `bmadRef.core`, with setup driven by `setup.py --module-answers`; `setup.py --status` reports it `current`; every skill activates offline with the bundled runtime (FR282). Skill names are unique across our repository and the bundled upstream snapshot
- NFR86: **One version line.** Every `bmod.toml` record in `ma-bmad-extensions` carries the same version; a change in any module bumps that shared version; modules remain independently installable (FR297). The installer bundles one `ma-bmad-extensions` tag, `bmadRef.extensions`
- NFR87: **Upgrade test.** CI upgrades a ma-agents 3.18.x project fixture (sprint data, Confluence binding, IDE instruction files) to 4.x, runs the two migration scripts twice, and asserts that no artefact is lost: the backup holds every pre-upgrade file, every backlog entry and sprint appears in the migrated store or the archive, the Confluence answers and overrides are present, the second run changes nothing, and each migration report lists every input it read
