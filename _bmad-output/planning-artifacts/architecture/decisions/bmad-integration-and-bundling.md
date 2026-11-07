# BMAD Integration & Offline Bundling — Architecture Decisions

> **Shard** of the [Architecture index](../../architecture.md). Content is verbatim from the
> pre-split document; the index carries the front matter, registers and reading order.
>
> Constrains prd/capabilities/bmad-integration-and-bundling.md.

---

## Decisions

### Decision P2-3: BMAD Extension Module Structure (FR52, NFR16-NFR17) **[SUPERSEDED by P2-9]**

**Decision:** Consolidated extension module in `lib/bmad-extension/`

All BMAD extension content ships as a single module:

```
lib/bmad-extension/
  module.yaml                         — extends-module: bmm, module identity
  module-help.csv                     — phase registration for extension workflows
  workflows/
    create-bug-story/                 — bug story generation from bug report (FR61)
      workflow.md
    add-sprint/                       — add sprint with capacity (FR68)
      workflow.md
    modify-sprint/                    — change/modify sprint (FR70)
      workflow.md
    add-to-sprint/                    — add stories/bugs to sprint (FR69)
      workflow.md
  agents/
    # Custom agents (full customization: persona + menu + critical_actions)
    bmm-sre.customize.yaml
    bmm-devops.customize.yaml
    bmm-cyber.customize.yaml
    bmm-mil498.customize.yaml
    # Built-in BMM agents (critical_actions only — no persona/menu override)
    bmm-pm.customize.yaml
    bmm-architect.customize.yaml
    bmm-dev.customize.yaml
    bmm-qa.customize.yaml
    bmm-sm.customize.yaml
    bmm-tech-writer.customize.yaml
    bmm-ux-designer.customize.yaml
```

**Deployment:** `bmad.js` copies `lib/bmad-extension/` to the BMAD installation directory as a registered extension module. The existing `lib/bmad-customizations/` content migrates into this structure.

**Survival:** The `extends-module: bmm` declaration in `module.yaml` gives the extension an independent identity. BMAD updates (`npx bmad-method install --action update`) preserve extension modules (NFR16).

**Affects:** `bmad.js` (extension deployment), `lib/bmad-extension/` (new directory), `lib/bmad-customizations/` (migrated into extension)

### Decision P2-6: Bundled BMAD Installation with Explicit Parameter Passing (FR74-FR76, FR123-FR127, NFR20-NFR21)

**Decision:** Bundle bmad-method as npm dependency, pre-clone external modules, and invoke bmad-method with explicit CLI parameters instead of silent mode

**Problem (original):** bmad-method's external module installation uses `git clone` to fetch modules (bmb, cis, tea, gds, wds) from GitHub into `~/.bmad/cache/external-modules/`. This fails in air-gapped environments. Additionally, `npx bmad-method` itself requires npm registry access.

**Problem (updated — FR123-FR127):** The current silent install (`--yes` flag) skips critical configuration: selected tools/platforms are not passed to bmad-method (OpenCode not configured even when selected in ma-agents), and paths with spaces break due to improper quoting in `execSync` calls. The fix is not to invoke setup skills programmatically — bmad-method already supports full parameterized invocation via CLI flags.

**Architecture — Bundling (unchanged):**

```
lib/
├── bmad-cache/                     — pre-cloned external module repos
│   ├── bmb/                        — bmad-builder module (full git repo snapshot)
│   │   ├── src/
│   │   ├── package.json
│   │   └── node_modules/           — pre-installed production dependencies
│   ├── cis/                        — bmad-creative-intelligence-suite
│   ├── tea/                        — bmad-method-test-architecture-enterprise
│   ├── gds/                        — bmad-game-dev-studio
│   └── wds/                        — bmad-whiteport-design-studio
```

**Architecture — Invocation (revised):**

ma-agents maps its collected installation answers to bmad-method CLI parameters:

```javascript
// In bmad.js — buildBmadArgs() constructs the full parameter list
function buildBmadArgs(installContext) {
  const bmadPath = require.resolve('bmad-method/tools/bmad-npx-wrapper.js');
  const args = [
    'node', `"${bmadPath}"`, 'install',
    '--directory', `"${installContext.projectRoot}"`,           // FR123: project path (quoted for spaces)
    '--modules', installContext.selectedModules.join(','),      // FR123: default bmm+tea+bmb+cis; gds/wds bundled but opt-in; override via --bmad-modules
    '--tools', installContext.selectedTools.join(','),          // FR123: e.g., "claude-code,cursor,opencode"
    '--user-name', `"${installContext.userName}"`,              // FR123: from ma-agents wizard
    '--communication-language', installContext.commLang,        // FR123: default "English"
    '--document-output-language', installContext.docLang,       // FR123: default "English"
    '--output-folder', installContext.outputFolder,             // default "_bmad-output"
    '--custom-content', `"${installContext.extensionPath}"`,    // path to lib/bmad-extension/
    '--yes',                                                    // FR126: skip prompts for params already provided
  ];
  if (installContext.isUpdate) {
    args.push('--action', 'update');                            // FR107: upgrade detection
  }
  return args;
}
```

**Parameter mapping table (FR123):**

| ma-agents collects | bmad-method flag | Source |
|---|---|---|
| Project path | `--directory` | Detected from cwd / package.json / .git |
| Selected platforms (claude-code, cursor, opencode...) | `--tools` | Interactive wizard or `--yes` defaults |
| BMAD modules to install | `--modules` | Default: `bmm,tea,bmb,cis`. The two design-studio modules `gds` and `wds` are **bundled but not installed** as part of an ma-agents installation — they ship in the offline cache and install without network access, but only when the user asks for them. (`automator` is `type: experimental` and is excluded from the bundle entirely.) Override: `--bmad-modules <csv>` for an explicit subset; `--bmad-modules` (bare) opens a multiselect prompt offering the bundled modules, `gds` and `wds` included. `bmm` is force-included in every path |
| User name | `--user-name` | Wizard prompt or system username |
| Communication language | `--communication-language` | Wizard prompt or "English" default |
| Document output language | `--document-output-language` | Wizard prompt or "English" default |
| Output folder | `--output-folder` | Always "_bmad-output" |
| Extension module | `--custom-content` | Always `lib/bmad-extension/` path |
| Fresh vs upgrade | `--action` | Detected: "install" if no `_bmad/`, "update" if exists |

**How this solves the three bugs:**
1. **OpenCode not configured** → `--tools` explicitly lists all selected platforms including opencode
2. **Spaces in paths** → all path arguments are quoted: `--directory "d:\My Projects\agents"`
3. **Silent install skips config** → `--yes` only suppresses prompts for parameters already supplied via flags — it doesn't skip configuration

**Default handling (FR125):** When bmad-method introduces new CLI parameters that ma-agents hasn't mapped, the `--yes` flag causes bmad-method to apply its own defaults for those parameters. No configuration is ever skipped — it's either explicitly provided by ma-agents or defaulted by bmad-method.

**Single wizard UX (FR126):** The user interacts only with ma-agents' wizard. bmad-method runs non-interactively with full explicit parameters. No second wizard prompt ever appears.

**CI/CD mode (FR127):** `npx ma-agents install --yes --force` → ma-agents uses its own defaults for all parameters → passes those defaults to bmad-method via the same `buildBmadArgs()` function → identical code path, just with pre-determined answers.

**Mechanism — 2 steps in `bmad.js` (cache + invoke):**

1. **Pre-populate cache:** Before calling bmad-method, copy `lib/bmad-cache/*` to `~/.bmad/cache/external-modules/` (only if target directory doesn't exist or `--force`). bmad-method's `cloneExternalModule()` checks `fs.pathExists(moduleCacheDir)` — if the cache directory exists, it skips git clone and uses the cached copy.

2. **Invoke bmad-method with explicit params:** `execSync(buildBmadArgs(installContext).join(' '))` — bmad-method is a direct npm dependency, resolved via `require.resolve()`. No `npx` download at runtime.

**Pre-cloned cache creation (build step):**
A new `npm run build:bmad-cache` script:
1. For each external module in BMAD's bundled module registry: `git clone --depth 1 <url> lib/bmad-cache/<code>/`. **The registry's PATH has moved across BMAD versions, but it has stayed YAML throughout** — `tools/cli/external-official-modules.yaml` (≤6.2.x) → `tools/installer/modules/registry-fallback.yaml` (6.3.0–6.6.x) → package-root `bmad-modules.yaml` (6.8.0; the in-package `registry-fallback.yaml` was retired in 6.7.0). The reader for the current pin is defined by Architecture Decision **P5-5**; modules are classified by a `type` field (include `type: bmad-org`, exclude `type: experimental`), `bmm`/`core` are built-in (absent from the registry) and never cloned, and `wds` is an active `bmad-org` module that is bundled
2. Run `npm install --omit=dev` in each cloned directory
3. Remove `.git/` directories to reduce package size
4. This script runs on a connected machine; the output is committed to the repo

**npm package size impact:**
- bmad-method: ~555 KB (v6.2.0 optimized — 91% smaller than 6.0.x)
- External modules: estimated 2-5 MB each with node_modules
- Total package size increase: ~10-20 MB — acceptable for enterprise/air-gapped use case

**Version pinning (NFR20):**
- `package.json` pins `bmad-method` to exact version: `"6.2.0"`
- `lib/bmad-cache/` modules are pinned at clone time
- Upgrading is a deliberate operation: update version pin, re-run `npm run build:bmad-cache`, test, release

**Affects:** `bmad.js` (cache pre-population + parameterized invocation), `package.json` (dependency pinned to 6.2.0), `lib/bmad-cache/` (5 modules incl. wds), build script

### Decision P5-9 (install-scope half) — see [project-knowledge-and-repository-layout.md](project-knowledge-and-repository-layout.md)

F26's install-scope thread (FR248–FR253, NFR76–NFR78) is decided in P5-9 alongside the binding architecture it depends on, because the two cannot be settled independently: a global install is only workable if a project can carry its own knowledge bindings. The install-scope rules are **P5-9.8**, with **P5-9.1–P5-9.4** supplying the binding mechanism they rely on.

Key consequence for this capability: the FR250 spike gates *how much* of global install ships, not *whether* the architecture holds. If bmad-method v6.10.0 cannot install user-level, ma-agents skills still install globally, BMAD stays project-scoped, and no part of P5-9.1–P5-9.7 changes.

### Decision P5-10 — archived; see archive-superseded-2026-11-07.md

### Decision P5-11: ma-agents 4.x: BMAD v7 modules, Atlassian overlay, thin offline installer (FR280–FR302, NFR84, NFR86, NFR87) (2026-11-07)

**Context — the platform.** ma-agents 4.x is a set of BMAD v7 modules plus a thin offline installer. BMAD v7 (upstream `bmad-code-org/BMAD-METHOD`) provides these mechanisms, and 4.x uses no others:

- **Module records.** A multi-skill module is a `bmod-<code>/` record folder holding `bmod.toml` (`[bmod]`: `code`, `version`, `update_source`, `skills`, `required_skills`, `recommended_skills`, install messages, `[[bmod.config_questions]]`), `help/help.md`, a stub `SKILL.md` that redirects to `bmad setup <code>`, and, where needed, `roster.toml` (agents and groups), `retired.toml` (`renamed`, `removed`) and `migration-<n>.toml`. Each member skill carries a `bmod.toml` with a `[skill]` table (`bmod`, `source`, optional `scripts`, `required_skills`, `recommended_skills`). `validate_manifests.py` checks manifests, membership, versions, retired names, help topics and the roster, and requires every record in one repository to carry the same version.
- **Install and setup.** Skills install with the Skills CLI (npm `skills`): `npx skills add <source> --skill <name>… -y --agent <tool>`, where `<source>` is a Git repository, a tag (`#<tag>`) or a local folder. `bmad setup <code>` asks the module's config questions and writes the answers; it runs `uv run --no-cache <bmad>/scripts/setup.py --project-root … --skill <bmad>`, which also takes `--module-answers <file>` for a run without prompts. `bmad status` reports each module's version, scope and update state. `bmad setup` installs a member's declared `scripts` to `_bmad/<code>/scripts/`.
- **Configuration and customization.** Answers live in `_bmad/config.toml` (owned by setup), `_bmad/custom/config.toml` (team, committed) and `_bmad/custom/config.user.toml` (personal); a skill reads them with one `resolve_config.py --key …` call (`core.*`, `modules.<code>.<key>`). A skill's `customize.toml` is overlaid by `_bmad/custom/<skill>.toml` and read through `resolve_customization.py`.
- **Activation.** Every skill activates through `uv run --no-cache … render_skill.py`; Python scripts declare their dependencies in PEP 723 headers.
- **Planning and tracking.** Work lives in the initiative store under `core.output_folder`: initiative, epic and story files indexed by `tickets.toml`, read and written by Sofia (`bmad-agent-po`) and `tickets.py`. `_bmad/custom/ticketing-store-config.toml` selects an external store through a starter TOML with `[tickets.types]` and `[tickets.status]` maps. `bmad-build` writes `story-<slug>-plan.md`, and the plan owns story status.
- **Migration.** `bmad migrate` runs every module's `migration-<n>.toml` in `<n>` order; `bmad migrate method` moves a v6 project into the initiative layout and archives its tracking sources unchanged under `archive-v6/`.
- **Names.** A retired skill name, ours or upstream's, is never reused.

**Context — product constraints.** No package depends on another of our packages. A full install works with no network on linux-x64 and win-x64 hosts. ma-agents ships its own agents (Alex, Yael, Amit, Gadi) and workflows, including MIL-STD-498. Jira Server/Data Center and Confluence on-prem are first-class. An agentic epic orchestrator ships. One BMAD core commit is supported at a time.

**Decision.**

**P5-11.1 — Package map (FR285, FR286, FR287, FR295).** One repository, four modules, one installer. Every skill tracked in the repository belongs to exactly one module; a CI test fails on an unassigned or doubly assigned skill.

| Module (code) | Member skills | Config questions | `retired.toml` at first release |
|---|---|---|---|
| `bmod-ma-ops` (`ma-ops`) | **Agents** (in `roster.toml`, group `ops`): `ma-agent-sre` Alex, `ma-agent-cyber` Yael, `ma-agent-devops` Amit, `ma-agent-sqa` Gadi. **Workflows:** `sre-check-deployment-status`, `sre-check-secrets`, `sre-check-system-status`, `sre-day-2-ops`, `sre-deployment-strategies`, `sre-fix-deployments`, `sre-gitops-status`, `cyber-generate-certs`, `cyber-immunity-estimation`, `cyber-security-audit`, `cyber-vault-secrets`, `cyber-verify-docker-users`, `cyber-verify-image-signature`, `cyber-vulnerability-scan`, `devops-configure-infrastructure`, `devops-disconnected-deployment`, `devops-docker-compose-setup`, `devops-manage-helm`, `devops-sign-docker-image`, `sqa-audit`, `sqa-ieee12207`, `sqa-requirements-quality`, `mil498-ocd`, `mil498-requirement-quality`, `mil498-sdd`, `mil498-sdp`, `mil498-srs`, `mil498-ssdd`, `mil498-sss`, `mil498-std`, `create-hardened-docker-skill`, `docker-hardening-verification`, `docker-image-signing`, `verify-hardened-docker-skill`, `self-signed-cert`, `ma-ops-dev-epic` | none | `renamed = [{ from = "bmad-dev-epic", to = "ma-ops-dev-epic" }]` |
| `bmod-ma-standards` (`ma-standards`) | `cpp-best-practices`, `cpp-concurrency-safety`, `cpp-const-correctness`, `cpp-memory-handling`, `cpp-modern-composition`, `cpp-robust-interfaces`, `csharp-best-practices`, `python-best-practices`, `python-dependency-mgmt`, `python-security-skill`, `js-ts-dependency-mgmt`, `js-ts-security-skill`, `vercel-react-best-practices`, `cmake-best-practices`, `logging-best-practices`, `opentelemetry-best-practices`, `code-documentation`, `code-review`, `test-generator`, `test-accompanied-development`, `git-workflow-skill`, `commit-message`, `auto-bug-detection`, `ai-audit-trail`, `document-revision-history`, `skill-creator`, `project-context-expansion`, `open-presentation` (training deck under its `assets/`), `ma-standards-apply` | none | empty |
| `bmod-ma-knowledge` (`ma-knowledge`) | `ma-knowledge-atlas` | `atlas_output` (default `{project-root}/_bmad-output/knowledge-atlas`, scope `team`) | `renamed = [{ from = "bmad-knowledge", to = "ma-knowledge-atlas" }]` |
| `bmod-ma-atlassian` (`ma-atlassian`) | `ma-atlassian-bind`, `ma-atlassian-confluence-plan`, `ma-atlassian-confluence-record-root-page` | the nine questions of P5-11.9 | empty |

`ma-agents` (npm, 4.x) is the installer of P5-11.10 and ships no skill content of its own.

Owned skill names never start with `bmad-`; that prefix belongs to upstream. Each module's `retired.toml` records every later rename or removal in the same release that makes it. `help/help.md` in each record describes the module's skills and their entry points; `bmod-ma-ops/roster.toml` gives each agent `code`, `skill`, `name`, `icon`, `title` and a two-sentence `persona`, and group `ops` holds all four.

**P5-11.2 — Repository and versioning (FR285, FR302, NFR86).** The repository `ma-bmad-extensions` holds a flat `skills/` folder: the four `bmod-<code>/` record folders and every member skill side by side, each member with its `[skill]` table. All four records carry one version (one semver line for the repository); a change to any module bumps it, and a tag marks each release. `update_source` and every member `source` are `github:<org>/ma-bmad-extensions/skills` in the repository. In the offline bundle, `bundle build` sets them to a `file:` source pointing at the bundled snapshot and re-runs `validate_manifests.py` on the snapshot; an organisation that mirrors the repository on its own Git host installs from `https://` (FR297). Each record declares `required_skills = [{ skill = "bmad", version = "<core version at bmadRef.core>", source = "github:bmad-code-org/BMAD-METHOD/skills" }]`.

Three version lines exist and `package.json` `bmadRef` ties them: the installer's own semver (4.x), the extension repository's semver and tag (`bmadRef.extensions`), and upstream (`bmadRef.core` commit, `bmadRef.skillsCli` npm `skills` version, `bmadRef.tea`, `bmadRef.cis` tags). `ma-agents status` prints installer version, extension version, core commit and Skills CLI version, then the output of `bmad status`.

**P5-11.3 — Inter-module independence (FR288, NFR84).** `required_skills` names only upstream `bmad` core. `recommended_skills` names upstream skills a module builds on and, where a workflow is better with one of our other modules, that skill with an explicit `source`; setup reports a missing recommendation and never insists. A skill that uses a recommended skill checks for it at run time, and when it is absent says so and continues without that step. Modules share no files: any reference text a module needs is authored in that module. A script never loads code from another skill or from an npm package by path; JavaScript and Python scripts resolve only files under their own skill or `_bmad/<code>/scripts/`. Every skill reads configuration only through `resolve_config.py` and customization only through `resolve_customization.py`. Skill names are unique across `ma-bmad-extensions` and the bundled upstream snapshot.

**P5-11.4 — Atlassian overlay (FR289, FR290, FR291).** `ma-atlassian` changes other skills only through their customization slots. Its bind targets are fixed for the pinned core:

| Target skills | Section | Key | Role |
|---|---|---|---|
| `bmad-prd`, `bmad-architecture`, `bmad-facilitate` | `[workflow]` | `external_handoffs` | publish the output to the planning destination |
| `bmad-prd`, `bmad-architecture`, `bmad-facilitate` | `[workflow]` | `external_sources` | read the matching Confluence pages before drafting |
| `bmad-ux`, `bmad-product-brief`, `bmad-prfaq` | `[workflow]` | `on_complete` | publish the output to the planning destination |
| `bmad-build`, `bmad-build-auto`, `bmad-code-review`, `bmad-retrospective` | `[workflow]` | `activation_steps_prepend` | read the ticket's Confluence page |
| `bmad-agent-po` | `[agent]` | `persistent_facts` | Jira identity clause and the type/status map |
| `bmad-agent-po` | `[workflow]` | `board_after`, `store_after` | publish ticket pages to the tickets destination after a board or store change |

`ma-atlassian-bind bind` writes each override as a block between `# ma-atlassian:start` and `# ma-atlassian:end` in `_bmad/custom/<skill>.toml`. It never writes outside its markers. When a key already holds a value the user wrote, it leaves the file unchanged and lists the collision in its report. A target that is not installed is reported and skipped. `unbind` removes only its own blocks. `status` lists both Confluence destinations, every target with its state (bound, collision, not installed), and re-checks that each slot exists in the installed skill's `customize.toml`; a missing slot is reported by skill, section and key. Bind and unbind are idempotent. The user re-runs `bind` after installing a module or running `bmad setup`.

**Jira** is a Sofia ticket store. `ma-atlassian-bind` ships the starter `config/jira-onprem-ticketing.toml`. Sofia reads a store that has no starter in her own `config/` folder from the project file alone, so bind writes the whole starter into `_bmad/custom/ticketing-store-config.toml`, with `store = "jira-onprem"` and the answers (`jira_site`, `jira_project_key`, `jira_mcp_server`) filled in, between its markers; keys the user sets outside the markers win. The starter reaches Jira Server/Data Center through the MCP server named in `jira_mcp_server`, or through the Jira REST API with the credentials already present in the user's environment when that answer is empty; ma-agents stores no credential. Default maps, which a project overrides key by key in its store config:

| BMAD type | Jira issue type |  | BMAD state | Jira status |
|---|---|---|---|---|
| initiative | (stays local) |  | backlog | To Do |
| epic | Epic |  | in-progress | In Progress |
| story | Story |  | review | In Review |
| spike | Task, label `spike` |  | done | Done |
| bug | Bug |  | dropped | Done, resolution Won't Do |

The identity clause (in `persistent_facts`) states: "my work" means `assignee = currentUser()`; when the authenticated account is a shared or service account, stop and ask for a personal identity.

**P5-11.5 — Target commit and GA gate (FR280, FR281, NFR84, NFR87).** 4.x targets exactly one upstream commit, `bmadRef.core` (initial value `e734d3ac3c0f4ea31cc2c2bbbe79e86e54f2cae6`). Changing it is a deliberate release step: update `bmadRef`, rebuild the bundle, re-run the qualification gate, and repoint any skill reference that upstream renamed or retired in the same change, never carrying both names. The qualification gate runs per commit and records its verdict per commit: the NFR84 per-module gates, the offline runtime proof of P5-11.6 and the NFR87 upgrade test. 4.x publishes on the npm dist-tag `next` until the gate passes on a commit that upstream tags as GA; only then does it publish as the on-prem release.

**P5-11.6 — Python runtime offline (FR282).** The bundle carries, for linux-x64 and win-x64, the `uv` binary, a python-build-standalone 3.11 interpreter and a wheelhouse of every PEP 723 dependency declared by a bundled script, upstream's and ours; `bundle build` enumerates the dependencies by reading the headers. The installer copies the host platform's runtime to a stable location in the install scope (`<project-root>/.ma-agents/runtime/` or `~/.ma-agents/runtime/`), and makes the same settings that `UV_PYTHON`, `UV_FIND_LINKS`, `UV_OFFLINE=1` and `UV_NO_CACHE=1` give its own setup call apply to later skill activations through a `uv.toml` in the install scope. `uv run --no-cache` ignores any uv cache, so the wheelhouse is the only package source offline. Proof, run in CI with no network: `render_skill.py`, `resolve_config.py`, `resolve_customization.py`, `tickets.py` and `setup.py` activate from the bundle on both platforms.

**P5-11.7 — Epic orchestration via the ticket tree (FR292).** `ma-ops-dev-epic` orchestrates one epic of the initiative store: it reads the epic and its stories with `tickets.py`, orders them into dependency waves from `tickets.toml` `after`, and runs each story through `bmad-build` (or `bmad-build-auto`), `bmad-code-review`, `bmad-review` and `bmad-walkthrough` with configurable model tiers, then an epic-level adversarial and package-integrity gate and a gated publish. It writes story status only through `bmad-build`'s plan file. Worktree handling and self-review use `git-workflow-skill` and `code-review` from `ma-standards` when installed (P5-11.3); without them it reports the gap and runs without those steps. It never bundles or invokes `bmad-loop`.

**P5-11.8 — Sprint functions via Sofia (FR296, FR294).** 4.x ships no sprint-file skills. Each 3.x sprint skill's function maps to the ticket tree:

| 3.x skill | 4.x equivalent |
|---|---|
| `my-next-issue` | Sofia "what's next" (with the Jira store: the identity clause applies) |
| `create-bug-story` | Sofia "file a bug" |
| `sprint-status-view`, `story-status-lookup` | Sofia's board; `tickets.py status`; the story's plan status |
| `generate-backlog`, `prioritize-backlog` | Sofia writes and orders entries in `tickets.toml` and `backlog/` |
| `add-sprint`, `modify-sprint`, `add-to-sprint`, `remove-from-sprint`, `close-sprint` | none; work is ordered by `tickets.toml` build order and `after`, and the board shows it |
| `cleanup-done` | none; done tickets stay in the tree and their plans hold status |

`auto-bug-detection` (in `ma-standards`) classifies code as delivered or in progress from the ticket store (`tickets.py`, plan status) and files a confirmed defect through Sofia "file a bug" when `bmad-agent-po` is installed; otherwise it writes the report and says that no store is available.

`bmod-ma-ops/migration-1.toml` (3.x → 4.x) runs after `bmad migrate method`. A 3.x project has a `sprint-status.yaml` with `backlog:` and `sprints:` sections; upstream's migration archives that file unchanged under the initiative's `archive-v6/`. Our migration reads the archived copy and writes each `backlog:` item that is not already a ticket-tree entry (matched by `v6_key`) to `{output_folder}/backlog/<type>-<slug>.md` carrying its `v6_key`; it writes the `sprints:` section to `archive-v6/sprints.yaml`; it writes its report to `{output_folder}/migration-v6-v7/ma-ops-migration-1.md` listing every item moved, skipped (with the matching entry) or not mapped. A re-run writes nothing already present.

**P5-11.9 — Confluence model (FR300, FR293, FR294).** Two Confluence destinations: **planning** (PRD, architecture, UX, brief, PRFAQ, facilitate outputs) and **tickets** (initiative, epic and story files, build plans). The module's config questions:

| Key | Default | Scope |
|---|---|---|
| `jira_site` | `""` | team |
| `jira_project_key` | `""` | team |
| `jira_mcp_server` | `""` (REST with ambient credentials) | user |
| `confluence_site` | `""` | team |
| `confluence_mcp_server` | `""` (REST with ambient credentials) | user |
| `planning_space` | `""` | team |
| `planning_root_page` | `""` | team |
| `tickets_space` | `""` (same as `planning_space`) | team |
| `tickets_root_page` | `""` | team |

Store locations come from `core.output_folder` and `modules.ma-atlassian.*` only. The publish engine, page tree, override generator and collision check are JavaScript scripts of `ma-atlassian-bind`, declared in its `[skill] scripts`, installed by setup to `_bmad/ma-atlassian/scripts/` and run with `node`. `ma-atlassian-confluence-plan` previews the page tree an initiative would publish, without writing. `ma-atlassian-confluence-record-root-page` records a created root page's id as the `planning_root_page` or `tickets_root_page` answer.

`bmod-ma-atlassian/migration-1.toml` (3.x → 4.x): a 3.x project has `project-layout.yaml` and override blocks between the 3.x ma-agents markers in `_bmad/custom/*.toml`. The migration reads them, writes the module answers to `_bmad/custom/config.toml` (team keys) and `_bmad/custom/config.user.toml` (user keys), deletes the 3.x marker blocks, runs `ma-atlassian-bind bind`, and reports every key it mapped, asked for or could not map. When the 3.x binding names two requirement stores, it asks which becomes the planning destination.

**P5-11.10 — Installer sequence and ownership (FR283, FR284, FR297, FR298, FR299, FR301, FR302, NFR87).** `ma-agents` 4.x is a Node CLI (Node ≥ 20.12) with the commands `install`, `update`, `status`, `uninstall` and `bundle build` (maintainer).

- **Wizard** (each question has a flag, so `--yes` runs without prompts): install scope (`project` | `global`); coding tools, each mapped in `lib/agents.js` to a Skills CLI `--agent` value (a tool with no Skills CLI target is reported, not installed); modules (`core-tools` and `method` always; `toolsmith`, `founder`, `tea`, `cis`, `ma-ops`, `ma-standards`, `ma-knowledge`, `ma-atlassian` selectable); each selected module's config answers, asked from its record's `[[bmod.config_questions]]`; additional module sources (a local folder or a Git URL, repeatable); IDE instruction injection (yes/no).
- **Flags:** `--yes`, `--scope`, `--tools a,b`, `--modules a,b`, `--answers <toml>`, `--source <path|url>` (repeatable), `--bundle <dir>` (default: the package's own `bundle/`), `--no-inject`.
- **Install sequence:** verify every item of `bundle/manifest.json` against its SHA-256 → place the runtime and export `UV_PYTHON`, `UV_FIND_LINKS`, `UV_OFFLINE=1`, `UV_NO_CACHE=1` (P5-11.6) → `npx skills@<bundled> add <bundle>/bmad-method --skill … -y --agent <tool>` → the same for each selected module source → write the answers file → `uv run --no-cache <bmad>/scripts/setup.py --project-root . --skill <bmad> --module-answers <file>` → inject the `<!-- ma-agents:start -->` / `<!-- ma-agents:end -->` block, which lists the installed modules and the `bmad` entry point → `status`. When `setup.py` rejects `--module-answers`, the installer prints the `bmad setup <code>` command for each module and exits non-zero.
- **Additional modules:** any v7 module installs the same way, offline from a local folder and online from a Git URL; the installer never inspects or rewrites its content.
- **Bundle** (`bundle/manifest.json` records each item with its SHA-256, `bmadRef` and the extension tag): BMAD-METHOD `skills/` at `bmadRef.core` (records `core-tools`, `method`, `toolsmith`, `founder`); the tea and cis repositories at `bmadRef.tea` / `bmadRef.cis`, omitted when no tag carries a bmod record and the omission recorded; `ma-bmad-extensions` at its tag; the Skills CLI tarball; the P5-11.6 runtime and wheelhouse. `bundle build` is deterministic: the same `bmadRef` and extension tag produce the same manifest.
- **Uninstall** removes the skills it installed (per `skills-lock.json`) and the `ma-agents` block. On a 3.x project it also removes the `ma-skills` module and the tool directories listed in `.ma-agents.json`, and nothing else.
- **Upgrade from 3.x:** `install` on a 3.x project backs up `_bmad/` and the output folder, uninstalls the 3.x parts, installs 4.x, then hands off to `bmad migrate method` followed by our module migrations (P5-11.8, P5-11.9). NFR87 tests this on a 3.18.x fixture.
- **IDE injection ownership:** the installer owns the `ma-agents` block; `ma-standards-apply` owns the `<!-- ma-standards:start -->` / `<!-- ma-standards:end -->` block in `AGENTS.md`, `CLAUDE.md`, `.clinerules`, `.roomodes` and `.github/copilot-instructions.md` (idempotent; `remove` sub-command). Neither writes inside the other's markers; an integration test runs both in either order and checks both blocks.
- The installer never writes `_bmad/custom/` and never edits skill content.

**Rejected alternatives.**

- *One repository per module.* Install is already per skill (`npx skills add … --skill`), so separate repositories add no installability, while they multiply release tags, CI and the bundle's version bookkeeping. One repository keeps one validator run and one version line.
- *Port the Confluence engine to Python.* Node is already required on every host (Skills CLI), the engine and page tree are about 2,700 lines of tested JavaScript, and a port adds a second implementation to qualify for no functional gain.
- *Ship on-prem against an upstream pre-release commit.* An untagged commit can change customization slots, the setup contract and the store format without notice; on-prem users cannot take a quick follow-up release. The pre-release channel (`next`) carries those commits; the on-prem release waits for a GA tag.
- *A sprint-capacity module over the ticket tree.* It would keep a second ordering and status model beside `tickets.toml` and the plan files, and every store adapter would have to honour both. Sofia's build order, `after` links and board cover the planning need.

**Risks.**

- Upstream changes slots, `setup.py` options or the store format between commits. Mitigation: one commit at a time, a per-commit gate verdict, `ma-atlassian-bind status` re-checks every slot, and the installer falls back to printed `bmad setup <code>` commands.
- The Jira Server/Data Center starter is our design; upstream starters target cloud services. Mitigation: the starter's maps are overridable per project, and the gate exercises it against a Server/Data Center instance.
- Confluence publishing with an MCP server is verified against recorded responses until a live on-prem Confluence is available to CI.
- Skill activations depend on `uv` finding the bundled interpreter and wheelhouse through the scope's `uv.toml`; the offline proof (P5-11.6) runs each activation from a fresh shell to catch a missing setting.
- Bundle size grows with two platforms' interpreters and wheelhouses; `bundle build` reports the size per item.

**Affects:** `package.json` (`bmadRef`, `engines.node`), `bin/cli.js` (commands and wizard), `lib/installer.js` (install sequence), `lib/agents.js` (tool → Skills CLI agent map, `ma-agents` block), `lib/uninstall.js`, the `bundle build` command and `bundle/`, the `ma-bmad-extensions` repository (four records, member skills, migrations), CI (NFR84 per-module gates, offline proof, NFR87 upgrade test), README, QUICK_START and the training deck.
