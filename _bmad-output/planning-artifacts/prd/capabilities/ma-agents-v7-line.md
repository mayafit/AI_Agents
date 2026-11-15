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
| ma-agents 4.x | thin offline installer (npm `ma-agents` 4.x) + `ma-bmad-extensions` modules on BMAD v7 | public beta since 2026-11-15: pre-releases `4.0.0-beta.N` (the installer's `package.json` and every `ma-bmad-extensions` record carry the same version, `4.0.0-beta.1` first) until the gate passes on a GA tag; a beta may be published to npm under dist-tag `beta` (nothing is published at `beta.1`); then `4.0.0` on `latest` as the on-prem release |

BMAD target of 4.x: upstream `bmad-code-org/BMAD-METHOD` at the commit recorded in `package.json`
`bmadRef.core` (initial value `e734d3ac3c0f4ea31cc2c2bbbe79e86e54f2cae6`). `bmadRef` also records
`skillsCli` (npm `skills` version, initial `1.7.6`), the `tea` tag (initial `v4.0.1`), the `cis` tag
(initial empty: no `cis` tag carries a bmod record, so the bundle omits `cis` and its manifest
records the omission), and `extensions` (the bundled `ma-bmad-extensions` tag; `""` until the
installer bundles one, then `v4.0.0-beta.1`, the first tag of that line).

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

Repository `ma-bmad-extensions` (`github:mayafit/ma-bmad-extensions`), a public GitHub repository,
layout `skills/<name>/`, one version line. It holds four modules. Each module record lives in
`skills/bmod-<code>/`; each member skill lives in `skills/<name>/`. `update_source` of every record
and `source` of every member are `github:mayafit/ma-bmad-extensions/skills`, in the repository and in
the bundle alike. The repository is public because `setup.py --status` reads a record's
`update_source` with an anonymous fetch; only a public repository yields the update states
`current`, `newer-available` and `pinned`.

Every record declares `required_skills = [{ skill = "bmad", version = "6.13.0", source = <core
source> }]`; `bmod-ma-ops` and `bmod-ma-atlassian` add `bmad-agent-po` and `bmad-build` from the same
source, because their skills call `tickets.py` and `bmad-build`. `<core source>` is the BMAD-METHOD
folder that holds `bmad` at `bmadRef.core`, read from the snapshot: `github:bmad-code-org/BMAD-METHOD/skills`
at the initial `bmadRef.core`; `github:bmad-code-org/BMAD-METHOD/skills/<module>` at a core commit
whose `skills/` holds one folder per module. No record names another of our modules in
`required_skills`.

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
  `git-workflow-skill`, `code-review`, `js-ts-security-skill`, `python-security-skill` (from
  `bmod-ma-standards`, declared with `source`; if absent, `ma-ops-dev-epic` reports it and runs
  without the worktree and review steps, and `cyber-vulnerability-scan` says so and scans with its
  own tools).

### bmod-ma-standards (code `ma-standards`)

- **Skills:** `cpp-best-practices`, `cpp-concurrency-safety`, `cpp-const-correctness`,
  `cpp-memory-handling`, `cpp-modern-composition`, `cpp-robust-interfaces`, `csharp-best-practices`,
  `python-best-practices`, `python-dependency-mgmt`, `python-security-skill`,
  `js-ts-dependency-mgmt`, `js-ts-security-skill`, `vercel-react-best-practices`,
  `cmake-best-practices`, `logging-best-practices`, `opentelemetry-best-practices`,
  `code-documentation`, `code-review`, `test-generator`, `test-accompanied-development`,
  `git-workflow-skill`, `commit-message`, `auto-bug-detection`, `ai-audit-trail`,
  `document-revision-history`, `skill-creator`, `project-context-expansion`, `open-presentation`
  (+ the training deck under `assets/`), **`ma-standards-apply`** (writes the ma-standards block
  between `<!-- ma-standards:start/end -->` markers; idempotent; `remove` sub-command). It always
  writes `AGENTS.md` (created when absent) and writes `CLAUDE.md`, `.clinerules` and
  `.github/copilot-instructions.md` only when they exist or are named. A `CLAUDE.md` whose every
  non-blank line is an `@<file>` import gets no block: the import loads `AGENTS.md`, which carries
  it, and the skip is reported. `.roomodes` gets a structural JSON `customModes` entry (slug
  `ma-standards`) when it exists as JSON; a YAML `.roomodes` is reported and left untouched;
  `.roomodes` is never created.
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

`ma-agents` 4.x is an npm package that carries no skill content of its own. Node ≥ 22.20, the
floor the bundled Skills CLI declares.

### Commands

| Command | Behaviour |
|---|---|
| `install` | runs the wizard (or the flags) and the install sequence below |
| `update` | re-runs the install sequence for the modules recorded in `.ma-agents/install.json` from the package's bundle (only pending config questions are asked), then prints "ask `bmad` to run `bmad migrate`" with the list of modules whose version changed; it never calls `npx skills update` or the Skills CLI `update` command, which need the network |
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
   `UV_FIND_LINKS`, `UV_OFFLINE=1`, `UV_NO_CACHE=1`. Write `python-preference = "only-managed"`,
   `python-downloads = "never"`, `find-links`, `offline = true`, `no-cache = true` to
   `<project-root>/.ma-agents/uv.toml` (project) or the uv user configuration file (global). A uv
   configuration file carries no Python install directory, so skill activations take
   `UV_PYTHON_INSTALL_DIR` from the environment, as the injected block states (step 8). The installer
   spawns uv only through one runner module, always as `uv run --no-cache`.
3. Copy `bundle/skills-cli/` (the `skills` package at `bmadRef.skillsCli` with its runtime
   dependencies) to `<scope>/.ma-agents/skills-cli/` and run
   `node <that>/<bin entry> add <bundle>/bmad-method --skill <name> … -y --agent <tool>` with
   `DISABLE_TELEMETRY=1` and `DO_NOT_TRACK=1` set and stdin closed. Every skill to install is passed
   with its own `--skill`: the module record and each of its members (a record alone installs no
   member; an `add` without `--skill` installs every skill of the source).
4. The same for each selected module source, again passing every member with `--skill`.
5. Run `setup.py --list-config-questions` (one `--root` per active skills folder). Answer each pending
   question from `--answers`, the wizard or its declared default, and write only those answers to a
   temporary file as `[modules."<code>"]` tables.
6. Run `setup.py --module-answers <file>` under `uv run --no-cache`; delete the file.
7. Record every skill, agent target and source added in `<scope>/.ma-agents/install.json`.
8. Inject the `<!-- ma-agents:start/end -->` block (lists installed modules, the `bmad` entry point
   and the `UV_CONFIG_FILE` and `UV_PYTHON_INSTALL_DIR` settings the coding tool applies for skill
   activations), unless `--no-inject`.
9. `status`.

With scope `global`, steps 3–4 install at user level (Skills CLI global mode) and steps 5–8 run for
the project in the current directory; `bmad setup <code>` sets up further projects.

### Bundle

`bundle/manifest.json` records a SHA-256 per item. Contents:

- BMAD-METHOD `skills/` at `bmadRef.core` (records `core-tools`, `method`, `toolsmith`, `founder`).
- The `tea` and `cis` repositories at `bmadRef.tea` / `bmadRef.cis`. A repository whose tag carries
  no bmod record is omitted from the bundle and the omission is recorded in the manifest.
- `ma-bmad-extensions` at `bmadRef.extensions`, files unchanged.
- The `skills` CLI at `bmadRef.skillsCli` with its runtime dependencies under `skills-cli/`: the tree
  `npm install --omit=dev --ignore-scripts` produces from the `skills` package, recorded in the
  manifest with its SHA-256.
- `uv` binaries and python-build-standalone 3.11 for linux-x64 and win-x64.
- A wheelhouse for those two platforms covering every PEP 723 dependency declared in the bundled
  scripts and the packages those dependencies require. The set is not a fixed list: `bundle build`
  derives it from every PEP 723 header of the snapshot and of our extension scripts
  (`--extra-skills`). At the initial `bmadRef.core` it holds `jinja2` and `markupsafe`
  (`render_skill.py`), `pyyaml` (`tickets.py`, the ma-ops migration script), `tiktoken` and
  `requests` (`bmad-toolsmith`) with the packages they require.

`bundle/` is git-ignored and listed in the npm package's `files`.

### Uninstall

`uninstall` removes exactly the skills `.ma-agents/install.json` lists, through the Skills CLI
`remove` command, and the injected `ma-agents` block. On a 3.x project it also removes the
`ma-skills` module (`_bmad/ma-skills/`), the 3.x `bmad-*` skill folders and the tool directories
listed in `.ma-agents.json`, which is read only on a 3.x project. It never removes files it did not
install.

### Upgrade from 3.x

`install` on a 3.x project copies `_bmad/`, the 3.x output folder, `.ma-agents.json` and every
instruction file the 3.x installer wrote (`AGENTS.md`, `CLAUDE.md`, `.clinerules`, `.roomodes`,
`.github/copilot-instructions.md`) to `.ma-agents-backup-<datetime>/`, runs uninstall of the 3.x
parts, installs 4.x, and ends by printing "ask `bmad` to run `bmad migrate`", which runs `method`'s
migration and then the `ma-ops` and `ma-atlassian` migrations (FR294). The 3.x `bmad-*` skill folders
and `_bmad/ma-skills/` are removed before the first Skills CLI `add`: the Skills CLI replaces a
same-named folder whole, several 3.x `bmad-*` folders share a name with a v7 skill, and `setup.py
--status` counts a leftover 3.x `bmad-*` folder as a module member. The Skills CLI leaves
`.ma-agents.json` and `MANIFEST.yaml` unchanged; the 3.x uninstall step is the only step that
removes 3.x files.

### IDE instruction blocks

The installer owns the `ma-agents` block; `ma-standards-apply` owns the `ma-standards` block;
upstream `bmad-project-context` owns its `<!-- bmad:context -->` / `<!-- /bmad:context -->` block.
None touches another's markers (FR301).

Target files: `ma-standards-apply` always writes `AGENTS.md` (created when absent) and writes
`CLAUDE.md`, `.clinerules` and `.github/copilot-instructions.md` only when they exist or are named;
`.roomodes` gets a structural JSON `customModes` entry (slug `ma-standards`) when it exists as JSON,
a YAML `.roomodes` is reported and left untouched, and `.roomodes` is never created. A `CLAUDE.md`
whose every non-blank line is an `@<file>` import gets no block from either writer: the import
loads `AGENTS.md`, which carries the block, and the skip is reported. The installer applies the
same import rule to its `ma-agents` block.

### Versioning

Installer `4.x` semver; `ma-bmad-extensions` has its own semver (one version line, tagged, recorded
as `bmadRef.extensions`); upstream is `bmadRef.core`, `skillsCli`, `tea`, `cis`. `bmadRef` ties the
three lines; `status` prints all (FR302). Beta pre-releases are `4.0.0-beta.N`: the installer's
`package.json` and every `ma-bmad-extensions` record carry the same version, `4.0.0-beta.1` since
2026-11-15, and the extension repository's first tag is `v4.0.0-beta.1`. A beta may be published to
npm under dist-tag `beta`; nothing is published at `beta.1`. `4.0.0` on `latest` follows the gate
pass on a GA tag (FR281).

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
| `[verbs]` `setup`, `write`, `query` | a REST form and an MCP form each; the MCP form is used when `mcp_server` is non-empty; `write` covers create, transition, assign and link |

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
an initiative. `guide` runs `uv run --no-cache _bmad/ma-ops/scripts/migrate_v6_backlog.py`, which
reads the archived copy and:

- writes each `backlog:` item that is not already a ticket-tree entry (matched by `v6_key`) to
  `{output_folder}/backlog/<type>-<slug>.md` carrying its `v6_key`, and writes the `sprints:` section
  to `archive-v6/sprints.yaml`; a tracker with no `backlog:` or no `sprints:` section is valid input,
  and the report states each absent section;
- sets to `dropped` the plan status of every entry whose 3.x status is `cancelled`, `wont-fix` or
  `optional`;
- resolves every collision on one (epic, id) deterministically and reports each: a
  `<N>-<M>-validation-report.md` file is a review record, archived under `archive-v6/` and never a
  story or its plan; a tracking key and a story file with the same `<N>-<M>` and different slugs are
  one story, joined by (N, M), with `v6_key` holding the tracking key; an epic with no `## Epic N:`
  heading in the epics file takes its story ids from the tracking keys; a story number with a letter
  suffix (`30-6a`, `30-6b`) keeps the suffix in its id;
- sets the plan `status` of every moved 3.x bug file to a value `tickets.py` accepts, so
  `tickets.py status backlog` exits 0;
- moves `_bmad/ma-skills/`, when present, to the initiative's `archive-v6/ma-skills/`;
- backs up every file it changes under a short-named folder at the project root, so that on Windows
  a backup path stays within the path-length limit (MAX_PATH) whenever its source path does.

It writes its report to `{output_folder}/migration-v6-v7/ma-ops-migration-1.md` listing every item
moved, skipped (with the matching entry) or not mapped, every status mapped and every collision
resolved. A re-run writes nothing already present.

---

## Functional Requirements

### Platform target and offline runtime

- FR280: **Target commit.** ma-agents 4.x is built and tested against exactly one upstream BMAD-METHOD commit, recorded in `package.json` `bmadRef.core`; `bmadRef` also records the Skills CLI version (`skillsCli`), the `tea` and `cis` tags and the bundled `ma-bmad-extensions` tag (`extensions`). The bundle (FR299), the bind target table (FR290) and the CI gates (NFR84) use these values. A different commit is adopted only by a release that updates `bmadRef` and re-runs the qualification gate (FR281)
- FR281: **Qualification gate.** A qualification gate records a pass or fail verdict per `bmadRef.core` commit; it passes when NFR84, NFR87 and the offline install of FR282 pass at that commit. Packages built on a commit that is not an upstream GA tag carry a semver beta pre-release suffix (`4.0.0-beta.N`) and may publish under npm dist-tag `beta`. The on-prem release of 4.x (`4.0.0` on dist-tag `latest`) requires a gate pass on an upstream GA tag; until then ma-agents 3.x is the on-prem release
- FR282: **Offline runtime.** The bundle ships `uv`, a Python 3.11 interpreter and a wheelhouse for linux-x64 and win-x64 covering every PEP 723 dependency declared by the bundled scripts, upstream's and our extension modules' alike, with the packages those dependencies require; `bundle build` derives the set from the PEP 723 headers, not from a fixed list (at the initial `bmadRef.core`: `jinja2`, `markupsafe`, `pyyaml`, `tiktoken`, `requests` and their dependencies). On Windows the interpreter is installed into the runtime with `uv python install --no-bin --no-registry`, so nothing is written outside the runtime folder. The installer copies the host platform's runtime to `.ma-agents/runtime/` in the install scope, exports `UV_PYTHON_INSTALL_DIR`, `UV_PYTHON_PREFERENCE=only-managed`, `UV_PYTHON_DOWNLOADS=never`, `UV_FIND_LINKS`, `UV_OFFLINE=1` and `UV_NO_CACHE=1` for its own uv calls, and writes `python-preference = "only-managed"`, `python-downloads = "never"`, `find-links`, `offline = true` and `no-cache = true` to `<project-root>/.ma-agents/uv.toml` (project scope) or the uv user configuration file (global scope), selected for skill activations by `UV_CONFIG_FILE`. A uv configuration file carries no Python install directory, so skill activations take `UV_PYTHON_INSTALL_DIR` from the environment; the injected `ma-agents` block names it beside `UV_CONFIG_FILE` (FR301). With no network every bundled skill activates and `render_skill.py`, `resolve_config.py`, `resolve_customization.py`, `tickets.py` and `setup.py` run with `uv run --no-cache`
- FR283: **Skills CLI.** The bundle carries the `skills` npm package at `bmadRef.skillsCli` with its runtime dependencies (the tree `npm install --omit=dev --ignore-scripts` produces); the installer copies it to `.ma-agents/skills-cli/` and runs its `add` command with `node` against the bundle path for every module, passing the module record and every member with its own `--skill` (`--skill <name> … -y --agent <tool>`), with stdin closed and `DISABLE_TELEMETRY=1` and `DO_NOT_TRACK=1` set, attempting no network access. A record alone installs no member, and an `add` without `--skill` installs every skill of the source
- FR284: **Headless setup.** The installer runs BMAD setup non-interactively: it lists the pending config questions with `setup.py --list-config-questions`, answers only those from `--answers`, the wizard or the declared defaults, writes them as `[modules."<code>"]` tables to a temporary file, calls `setup.py --module-answers <file>` under `uv run --no-cache`, and deletes the file. When that call fails, the installer exits non-zero and prints, for each selected module, the instruction to ask `bmad` to run `bmad setup <code>` and its scripted form

### Module packaging

- FR285: **Repository layout.** `ma-bmad-extensions` is a public GitHub repository, `github:mayafit/ma-bmad-extensions`, so that the anonymous update check of `setup.py --status` reads its records. It holds each module record in `skills/bmod-<code>/` (`bmod.toml`, `help/help.md`, `retired.toml`, `roster.toml` where the module has agents, `migration-<n>.toml` files) and each member skill in `skills/<name>/` with a `bmod.toml` `[skill]` table (`bmod`, `source`, `scripts`). Upstream `validate_manifests.py` passes in CI
- FR286: **Roster and help.** `bmod-ma-ops/roster.toml` lists Alex (`ma-agent-sre`), Yael (`ma-agent-cyber`), Amit (`ma-agent-devops`) and Gadi (`ma-agent-sqa`) in group `ops`, each with name, title, icon and a one-line persona; Gadi carries the MIL-STD-498 and SQA workflows. Every module ships `help/help.md` listing each of its skills with one line on what it does and when to use it, so the `bmad` skill can route a request to it
- FR287: **Naming.** No owned skill carries the `bmad-` prefix, which upstream reserves; a CI test fails on an owned skill named `bmad-*`. The first release records two renames: `bmad-dev-epic` → `ma-ops-dev-epic` in `bmod-ma-ops/retired.toml` and `bmad-knowledge` → `ma-knowledge-atlas` in `bmod-ma-knowledge/retired.toml`; a retired name is never reused. The 3.x skills `bmad-sprint-planning`, `bmad-sprint-status` and `bmad-dev-story` have no 4.x counterpart (upstream `bmad-agent-po` and `bmad-build` provide those functions) and the upgrade (FR294) removes them
- FR288: **Config reads.** Owned skills read configuration only through `uv run --no-cache {project-root}/_bmad/scripts/resolve_config.py` (`core.*`, `modules.<code>.*`) and customization only through `resolve_customization.py`. A CI test fails when an owned skill reads a configuration key or file that the pinned BMAD commit does not define
- FR295: **Complete module assignment.** Every tracked skill is assigned to exactly one module as listed in the [Package map](#package-map), or is listed under "Tracked skills with no 4.x module" with its replacement. A CI test enumerates the tracked skills and fails on a skill that is in no module, in two modules, or in a module not named by the package map. Every package-map skill is shipped by its module or marked pending by a named later epic in the package map (`pending = "<epic>"` on the module); the test fails on an unshipped skill with no such marker, on an empty marker, and on a marker on a module whose every skill ships
- FR303: **Contract validator.** Every owned `customize.toml` and every file `ma-atlassian-bind` writes resolves through the pinned `resolve_customization.py`, references no undefined variable, and names only slots defined at `bmadRef.core`. The validator fails on any key that the target's `customize.toml` does not declare, because `render_skill.py` halts the target skill on such a key; a CI test runs the validator on every owned skill and on bind's output for every target of the [bind target table](#bind-target-table)

### Tracking and Atlassian

- FR289: **Jira as a ticket store.** `ma-atlassian-bind` ships `config/jira-onprem-ticketing.toml`, a ticket-store starter for Jira Server and Data Center reached through the MCP server named by `jira_mcp_server` or, when that answer is empty, through the Jira REST API with the host's ambient credentials. `bind` selects it by writing the whole starter into `_bmad/custom/ticketing-store-config.toml` (keys and maps of [Jira store](#jira-store); `store = "jira-onprem"`; site, project key and MCP server name from the setup answers; `[verbs]` `setup`, `write` and `query`, each with a REST form and an MCP form, `write` covering create, transition, assign and link), writing only keys the file does not yet define. The Jira identity clause and the maps reach `bmad-agent-po` as `persistent_facts`. Jira transitions run through `bmad-agent-po`'s `write` verb; no other skill carries Jira routing text
- FR290: **Confluence publish and read.** `ma-atlassian-bind` writes one override per row of the [bind target table](#bind-target-table): publish to the planning destination from `bmad-prd`, `bmad-architecture`, `bmad-facilitate` (`external_handoffs`) and `bmad-ux`, `bmad-product-brief`, `bmad-prfaq` (`on_complete`); read Confluence before drafting in `bmad-prd`, `bmad-architecture`, `bmad-facilitate` (`external_sources`); read the ticket's Confluence page at activation of `bmad-build`, `bmad-build-auto`, `bmad-code-review`, `bmad-retrospective` (`activation_steps_prepend`); publish ticket pages to the tickets destination after `bmad-agent-po` board and store changes (`board_after`, `store_after`). The table is fixed for `bmadRef.core`. Published pages mirror the initiative store layout under the destination's root page
- FR291: **Bind and unbind.** `ma-atlassian-bind` is idempotent and keyed per target (skill, section, key). It writes in the [Override format](#override-format): each owned key inside its existing table, bracketed by its own comment markers; when the key already holds a user-authored value it leaves the file unchanged and reports the target and key; it never writes a key that the target's installed `customize.toml` does not declare, and reports that slot as missing; every file it touches stays valid TOML. `unbind` removes only the lines it wrote, including those in `ticketing-store-config.toml`. `status` reports, per target, bound / collision / not installed / slot missing, the two destinations, and any required answer that is empty. A target absent on disk is reported, not failed. The user re-runs `bind` after any module install or `bmad setup`
- FR292: **Epic orchestration.** `ma-ops-dev-epic` reads epics and stories only through `tickets.py`. With a tracker store (a store that holds ticket status outside the repository, such as Jira), it asks `bmad-agent-po` to sync ticket status from the tracker first and then calls `tickets.py next` with `--synced`, which `tickets.py` requires on a tracker store. For each story it asks `bmad-agent-po` to start the story, runs `bmad-build` or `bmad-build-auto`, then `bmad-code-review` and `bmad-review`, prepares a `bmad-walkthrough` for the user (attached to the story's result, not run unattended), and asks `bmad-agent-po` to mark the story done, so the configured store moves its card; it never edits a plan's status line. No owned skill reads or writes a sprint tracker file. Its model tiers are `customize.toml` defaults; `[workflow] on_epic_complete` (default empty) is a user instruction run after the epic-level review gate, and the skill publishes nothing by default. When `git-workflow-skill` or `code-review` is not installed it reports so and runs without the worktree and review steps
- FR293: **Knowledge-store configuration.** The initiative store lives under `core.output_folder`; Confluence locations are the `modules.ma-atlassian.*` answers (FR300). Both are setup answers in `_bmad/config.toml` (team overrides in `_bmad/custom/config.toml`, user keys in `_bmad/custom/config.user.toml`), read through `resolve_config.py` at activation, and independent of install scope. No skill keeps a second record of a store location
- FR296: **Sprint functions.** The 4.x line ships none of `add-sprint`, `add-to-sprint`, `close-sprint`, `cleanup-done`, `modify-sprint`, `remove-from-sprint`, `prioritize-backlog`, `generate-backlog`, `sprint-status-view`, `story-status-lookup`, `my-next-issue`, `create-bug-story`. Their functions are provided by `bmad-agent-po` with the configured ticket store, including the Jira store (FR289): "what's next" for `my-next-issue`; "file a bug" for `create-bug-story`; the board for sprint planning, prioritisation, status views and story status lookup. `bmod-ma-ops/migration-1.toml` carries 3.x backlog and sprint data over (FR294) as specified in [Migration from 3.x: tracking data](#migration-from-3x-tracking-data): an absent `backlog:` or `sprints:` section is valid input; the 3.x statuses `cancelled`, `wont-fix` and `optional` become `dropped`; every (epic, id) collision is resolved deterministically and reported; moved 3.x bug files carry a plan status `tickets.py` accepts. The migration report lists each removed skill with the `bmad-agent-po` request that replaces it
- FR300: **Confluence configuration model.** Confluence content goes to two destinations: planning (PRD, architecture, UX, brief, PRFAQ, facilitate outputs) and tickets (initiative, epic and story files, build plans). `ma-atlassian` asks the nine config questions of [Config questions](#config-questions) (`jira_site`, `jira_project_key`, `jira_mcp_server`, `confluence_site`, `confluence_mcp_server`, `planning_space`, `planning_root_page`, `tickets_space`, `tickets_root_page`), every one with default `""`; `jira_site`, `jira_project_key`, `confluence_site` and `planning_space` require a non-empty answer; an empty `tickets_space` means `planning_space`; the two MCP server names are user-scoped, the rest team-scoped. No answer holds a credential. `ma-atlassian-bind status` reports both destinations (space, root page) and every bound target
- FR305: **Atlas inputs.** `ma-knowledge-atlas` reads `initiative-*/` envelopes, `tickets/**/tickets.toml` entries and each `*-plan.md` `status` under `core.output_folder`, and no v6 configuration key. It renders the `initiative-*/` folders and `backlog/`; documents elsewhere under the output folder are not rendered. An absent `_bmad/method/scripts/tickets.py` is reported and the build continues with whatever `initiative-*/` folders exist. A CI fixture initiative renders every epic and story with its status

### Installation, upgrade and versioning

- FR294: **Migrations and upgrade.** Every user-visible change to on-disk files between two 4.x releases ships as a `migration-<n>.toml` with `detect` and `guide`, run by the user through `bmad migrate`; the deterministic part of each migration is a script declared in a member skill's `[skill] scripts` (`migrate_v6_backlog.py` in `ma-ops-dev-epic`, `migrate_binding.js` in `ma-atlassian-bind`), which the `guide` calls. `install` on a 3.x project makes the backup of [Upgrade from 3.x](#upgrade-from-3x), uninstalls the 3.x parts, installs 4.x, then prints the instruction to ask `bmad` to run `bmad migrate`, which runs `method`'s migration and then `bmod-ma-ops/migration-1.toml` and `bmod-ma-atlassian/migration-1.toml` ([Migration from 3.x: binding](#migration-from-3x-binding), [Migration from 3.x: tracking data](#migration-from-3x-tracking-data)). Each migration script is idempotent: a re-run on a migrated or partly migrated project completes the remaining steps and leaves completed ones unchanged. A script never overwrites an existing file; a name collision gets a numeric suffix and a report line. A script backs up under a short-named folder at the project root, so that on Windows a backup path stays within the path-length limit (MAX_PATH) whenever its source path does. Each script writes a report under `{output_folder}/migration-v6-v7/` listing every input read, every file written or archived, and every collision
- FR297: **Adding modules.** Any BMAD v7 module installs with `npx skills add <source> --skill …` followed by `bmad setup <code>`, with or without the ma-agents installer; that includes every module of `ma-bmad-extensions`, installed online from a tag of the public repository `github:mayafit/ma-bmad-extensions` or from a local folder. The `add` names the module record and every member with its own `--skill`. The installer offers additional module sources through the wizard and `--source` (repeatable): a local folder offline, or a Git URL online (including an intra-perimeter Git host, authenticated by the host's ambient git configuration; the installer stores no credentials). An additional module's config questions join the wizard. Every record keeps its `github:` `update_source`; online, `setup.py --status` reads it anonymously from the public repository; offline, it reports the update state as `could-not-check`, and the installer's `update` command uses `install.json` and the bundle and never calls `npx skills update`. Installing without the installer requires Node ≥ 22.20, npm, Git, `uv` and Python ≥ 3.11
- FR298: **Installer surface.** The `ma-agents` 4.x package provides the commands `install`, `update`, `status`, `uninstall` and `bundle build`, the wizard questions, the flags and the install sequence of [Installer](#installer), and declares `engines.node` `>=22.20.0`, the floor the bundled Skills CLI declares. The wizard and the `--yes` path run the same code with the same answers, so an interactive install and a `--yes` install with equal answers produce the same result. `update` never calls `npx skills update` or the Skills CLI `update` command. `uninstall` removes only what `install.json` lists and the `ma-agents` block; on a 3.x project it also removes the `ma-skills` module (`_bmad/ma-skills/`), the 3.x `bmad-*` skill folders and the tool directories listed in `.ma-agents.json`. The upgrade from 3.x removes the 3.x `bmad-*` skill folders and `_bmad/ma-skills/` before the first Skills CLI `add`
- FR299: **Bundle contents and manifest.** The bundle holds the items of [Bundle](#bundle), each recorded in `bundle/manifest.json` with its SHA-256, source and version, including the Skills CLI with its runtime dependencies. `install` verifies the manifest before any other step. `bundle build` is deterministic: the same `bmadRef` produces a byte-identical bundle and manifest
- FR301: **IDE injection ownership.** Three marker blocks, three owners: the installer writes only the `<!-- ma-agents:start/end -->` block (installed modules, the `bmad` entry point, the `UV_CONFIG_FILE` and `UV_PYTHON_INSTALL_DIR` settings); `ma-standards-apply` writes only the `<!-- ma-standards:start/end -->` block; upstream `bmad-project-context` writes its `<!-- bmad:context -->` / `<!-- /bmad:context -->` block. None touches another's markers or user prose. `ma-standards-apply` always writes `AGENTS.md` (created when absent) and writes `CLAUDE.md`, `.clinerules` and `.github/copilot-instructions.md` only when they exist or are named; `.roomodes` gets a structural JSON `customModes` entry (slug `ma-standards`) when it exists as JSON, a YAML `.roomodes` is reported and left untouched, and `.roomodes` is never created. A `CLAUDE.md` whose every non-blank line is an `@<file>` import gets no block from either writer (the import loads `AGENTS.md`, which carries the block; the skip is reported). An integration test runs the three writers on the same `AGENTS.md` in all six orders, re-runs each, and asserts every block and the user prose survive byte-identical
- FR302: **Version and compatibility record.** `package.json` `bmadRef` records `core`, `skillsCli`, `tea`, `cis` and `extensions`. `ma-agents status` prints the installer version, `bmadRef.extensions`, the core commit and the Skills CLI version, then the output of `setup.py --status`. Every module declares `required_skills = [{ skill = "bmad", version = "6.13.0", source = <core source> }, …]`, the version `bmod-method` declares at `bmadRef.core`; `<core source>` is the BMAD-METHOD folder that holds `bmad` at `bmadRef.core`, read from the snapshot (`github:bmad-code-org/BMAD-METHOD/skills` at the initial `bmadRef.core`, `github:bmad-code-org/BMAD-METHOD/skills/<module>` at a core commit whose `skills/` holds one folder per module), so a change of `bmadRef.core` that moves `bmad` changes every `required_skills` source, the bundle layout and the local-add path together
- FR304: **uv execution.** The installer spawns uv only through one runner module, always as `uv run --no-cache` with an argv array; a test fails on any other uv execution site in the installer's JavaScript

## Quality Attributes (Non-Functional Requirements)

### ma-agents 4.x

- NFR84: **Per-module CI gates.** For each module: upstream `validate_manifests.py` passes; the module installs alone from a local folder and from a tag into a BMAD v7 project with the `method` module at `bmadRef.core`, with setup driven by `setup.py --module-answers`; online, `setup.py --status` reports it `current`, read from the public repository `github:mayafit/ma-bmad-extensions`; every skill activates offline with the bundled runtime (FR282). Skill names are unique across our repository and the bundled upstream snapshot
- NFR86: **One version line.** Every `bmod.toml` record in `ma-bmad-extensions` carries the same version (`4.0.0-beta.1` at the first tag, `v4.0.0-beta.1`, the installer's version at the same date); a change in any module bumps that shared version; modules remain independently installable (FR297). The installer bundles one `ma-bmad-extensions` tag, `bmadRef.extensions`
- NFR87: **Upgrade test.** CI upgrades a ma-agents 3.18.x project fixture (sprint data, Confluence binding, IDE instruction files) to 4.x, runs the two migration scripts twice, and asserts that no artefact is lost: the backup holds every pre-upgrade file, every backlog entry and sprint appears in the migrated store or the archive, the Confluence answers and overrides are present, the second run changes nothing, and each migration report lists every input it read
