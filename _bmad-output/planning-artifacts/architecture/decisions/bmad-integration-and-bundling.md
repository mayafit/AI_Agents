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

### Decision P5-10: Extension Decomposition, Overlay Mechanism & Thin Offline Installer — latest-only bmad-method (FR268–FR278, NFR84–NFR85) (2026-10-31) **[SUPERSEDED 2026-11-07 by P5-11]**

> *Superseded 2026-11-07 by Decision P5-11 (Sprint Change Proposal 2026-11-07). Every P5-10 sub-decision was expressed in bmad-method v6.12.4 mechanics — `module.yaml` / `module-help.csv` / `marketplace.json`, `--custom-source` staging, a version-keyed overlay over `bmad-sprint-planning`, `sprint-status.yaml` and `_bmad/bmm/config.yaml` — which BMAD v7 replaces. Its purposes and constraints carry into P5-11; its mechanisms do not. Nothing from P5-10 was implemented (Epics 32–35 cancelled). The text below is kept unchanged as history.*

**Source:** Sprint Change Proposal 2026-10-31 (`sprint-change-proposal-2026-10-31.md`), input `bmad-6.11-6.12-impact-analysis.md`. **Epics 32–35.** Supersedes P2-3/P2-9's single-module structure and P4-1's single-plugin marketplace; reverses P5-6(c) (uv boundary); amends P2-6 (wizard owns BMAD config), P2-11 (routing pattern) and P5-9 (delivery vehicle for F26).

**Context.** ma-agents 3.18.1 ships 62 skills under one module code (`ma-skills`) behind a 6,300-line installer CLI. Upstream v6.11/v6.12 replaced the Phase-4 loop, merged the review family, retired the tech-writer agent, made `uv` + Python 3.11 mandatory and emptied `persistent_facts`. Under one module every upstream change is a change to all of ma-agents, and none of ma-agents' three purposes — offline packaging, our own agents/workflows, Atlassian integration — can be installed without the other two or on a plain bmad-method.

**Decision.**

**P5-10.1 — Six packages, one purpose each.**

| Package | Kind | Contents |
|---|---|---|
| `ma-agents` (npm, "offline installer") | installer | pinned `bmad-method`; bundled module cache (`bmm` built-in + `tea`/`bmb`/`cis` at the v6.12.4 registry pins); **pinned copies of the five extensions** vendored from one tag of the extension repository; stage-and-invoke passing N local `--custom-source` paths; IDE instruction-block injection; on-prem profile; Windows delete-retry. Nothing else. |
| `ma-ops-agents` | extension | Alex, Amit, Yael, Gadi; `sre-*`, `devops-*`, `cyber-*`, `sqa-*`; `mil498-*` + templates (Gadi's); Docker hardening / image signing / self-signed cert; `bmad-dev-epic` |
| `ma-sprint` | extension | `add-sprint`, `add-to-sprint`, `modify-sprint`, `remove-from-sprint`, `close-sprint`, `cleanup-done`, `generate-backlog`, `prioritize-backlog`, `sprint-status-view`, `create-bug-story`, `story-status-lookup`; file-system backend; tracker hook point |
| `ma-atlassian` | extension (overlay) | config questions; setup skill; Jira tracker adapter; Confluence store adapter; `my-next-issue`, `bind`, `confluence-plan`, `confluence-record-root-page` with binding-stamp, page-tree and publish-hook scripts in-skill |
| `ma-knowledge` | extension | `bmad-knowledge` + `atlas.cjs` as an in-skill script (relative path, never `require.resolve('ma-agents/…')`) |
| `ma-standards` | extension | coding standards, `git-workflow-skill`, `code-review`, `commit-message`, `ai-audit-trail`, `test-*`, `auto-bug-detection`, `document-revision-history`, `skill-creator`; a setup skill that injects the always-load rule block into the per-tool instruction files |

**P5-10.2 — One repository, one marketplace, N plugins, per-module versions.** The extensions live in one monorepo (`ma-bmad-extensions`): `.claude-plugin/marketplace.json` lists one plugin per module (`source: ./modules/<code>`), each module directory carries `module.yaml` + `module-help.csv` + `module_version` + its skill directories, and bmad-method's PluginResolver Strategy 1 resolves each exactly as it resolves `ma-skills` today. `shared/` holds canonical text (tracker-routing block, knowledge-store preflight) that a build step renders into every consuming skill; a prerelease gate fails if any rendered copy drifts from `shared/`. Versions are per module (NFR85). The Bundle Drift Guard and the offline PluginResolver passthrough test (Story 27.6 / 30.3) run **per module** (NFR84).

**P5-10.3 — No inter-extension dependency; no package path.** bmad-method reads no inter-module dependency field (`extends-module` is unread), so none is declared. An extension that needs another's behaviour at run time discovers it (P5-10.4) and halts loud if absent; it never `require`s it. No skill references `ma-agents/bin/cli.js` (FR270). Skill directory names are unique across all six packages because IDE skill folders are flat and bmad-method ≥ 6.10 aborts on duplicate leaf names.

**P5-10.4 — The overlay mechanism is the customization layer.** `ma-atlassian` reaches into other skills exclusively through the upstream-sanctioned `_bmad/custom/<skill>.toml` team override layer (the channel Story 31.15 already uses for the five authoring skills). Its setup skill: (a) reads the installed bmad-method version; (b) walks a **version-keyed target table** `{skill → roles}` where roles are `jira-read`, `jira-write`, `confluence-read`, `confluence-write`; (c) for each target present on disk, generates a marker-delimited override that sets the tracker/store hook and prepends the adapter reference; (d) skips absent targets and every `v6-shims/` entry; (e) reports every target or hook key it could not bind, by name, at exit ≠ 0. Adapter references carry the operations (the current Jira routing block and the Epic 31 preflight, moved verbatim); overrides carry only which roles apply. ma-sprint's skills expose the hook (`[workflow] tracker = "file-system"`, `activation_steps_prepend`) so they are bound the same way upstream skills are.

**P5-10.5 — Latest-only, no shims.** One upstream version at a time, the latest qualified (v6.12.4 at adoption). `--shims` is not passed; `v6-shims/` are never targets. Retired upstream workflows are replaced by their successors in every ma-agents enumeration and orchestrator: `bmad-dev-epic` orchestrates `bmad-build` / `bmad-build-auto` / `bmad-code-review` / `bmad-review` / `bmad-walkthrough`; our shadow copies of `bmad-dev-story`, `bmad-sprint-planning`, `bmad-sprint-status` are deleted (upstream's `sprint_plan.py` core preserves our schema keys). The impact analysis's §7 shim-transition route is **declined**: it would have meant two target tables and a scheduled shim-removal epic.

**P5-10.6 — `uv` + Python 3.11 are prerequisites (reverses P5-6(c)).** Upstream v6.11 made `uv run` the contract for the shared `_bmad/scripts/*.py`; the premise behind P5-6(c) is gone. ma-agents-owned skill guidance calls those scripts via `uv run`; on-prem/air-gapped images pre-seed `uv` and an interpreter; the offline gate runs with `uv` in the loop under `--network none`. Installer JavaScript stays interpreter-independent. The `test/uv-transition-resilience.test.js` guard is inverted, not deleted.

**P5-10.7 — `bmad-dev-epic` is retained.** It is agentic orchestration (parallel waves, model tiers, adversarial + package-integrity gate, gated publish); upstream `bmad-loop` is a software orchestrator with a different operating model and is not a replacement. FR235's "never bundle `bmad-loop`" stands.

**P5-10.8 — Sequencing.** Epic 32 (v6.12.4 currency, latest-only) is a **hard gate**: no carve-out starts before its release gate passes, because carving skills that still target the retired Phase-4 loop would port them twice. Then Epic 33 (monorepo; `ma-knowledge`, `ma-standards`, `ma-ops-agents` — the zero-coupling seams), Epic 34 (`ma-sprint` + `ma-atlassian` — the only phase with new design: hook points, adapter references, target table; release 2 adds `bmad-code-review → Jira transition` and `bmad-correct-course → Confluence write`, both new capability), Epic 35 (thin installer; remove custom-marketplace consumption, skill trees, `lib/bmad-extension*`; docs/training rewrite).

**Rejected alternatives.** *Carve by code seam (knowledge first, Atlassian last)* — rejected: it produced a `ma-core` module every other module depended on, violating P5-10.3. *Sprint skills inside the Atlassian module* — rejected once the overlay mechanism showed Atlassian need not own the skills it enhances. *Six repositories* — rejected: loses the single drift gate and shared-text generation for no installability gain. *Keep the installer as the integration point* — rejected: it is the component that cannot be installed on a plain bmad-method.

**Risks.** The overlay rides on upstream customization keys and skill identities, which churned twice in two months; mitigated by the version-keyed table and bind-time fail-loud validation (P5-10.4e). Confluence MCP-present paths remain mock-verified from Epic 31 until Epic 34 has a live Confluence tool. `uv` provisioning under `--network none` is a stated prerequisite, not a spike outcome — the Epic 32 gate proves it with a pre-seeded cache.

**Affects:** everything under `lib/bmad-extension/` (moves out), `bin/cli.js` (shrinks to installer + injection), `lib/bmad.js` (multi-path staging), `lib/custom-marketplace.js` (removed), `lib/confluence-*.js` (move into `ma-atlassian` scripts), `lib/knowledge-atlas/` (moves into `ma-knowledge`), `skills/` root tree (moves into `ma-standards`), `scripts/build-plugin.js` (generalised to N modules in the new repo), `test/` (per-module split), CI, README/QUICK_START/SKILLS_STRUCTURE/DEVELOPMENT, training deck.

### Decision P5-11: BMAD v7 Target — bmod Modules, Sofia-native Jira, Confluence via Handoff Slots, Skills-CLI Offline Installer (FR271 am., FR280–FR294, NFR84 am., NFR86) (2026-11-07)

**Source:** Sprint Change Proposal 2026-11-07 (`sprint-change-proposal-2026-11-07.md`), trigger evidence `adversarial-review-v7-alignment-2026-11-07.md` (19 findings) and an upstream survey of `bmad-code-org/BMAD-METHOD` `main` @ `e734d3ac3c0f4ea31cc2c2bbbe79e86e54f2cae6` (2026-11-06). **Epics 36–39.** **Supersedes P5-10** in full and the P2-11 amendment (tracker hook contract). Keeps P5-10's three purposes and the product-owner constraints: no dependency between our packages; offline on-prem install; our agents/skills; Jira + Confluence; MIL-STD-498 with Gadi; `bmad-dev-epic` kept; uv + Python 3.11 required; no parallel versions.

**Context.** P5-10 was written in bmad-method v6.12.4 mechanics — `module.yaml` + `module-help.csv` + `.claude-plugin/marketplace.json`, `npx bmad-method install --custom-source`, `sprint-status.yaml` as the tracker, an overlay over `bmad-sprint-planning`, and `_bmad/bmm/config.yaml` as the binding spine. On 2026-11-07 upstream `main` turned out to be the **v7 line** (preview alpha; GA announced for mid-November 2026; v6.12 frozen on branch `V6.12`). v7 replaces every one of those mechanics: modules are `bmod-<code>/` records installed with the Skills CLI (`npx skills add`, npm `skills` 1.7.6) and configured with `bmad setup <code>`; config is `_bmad/custom/config.toml` + `config.user.toml` read through `resolve_config.py`; tracking is Sofia's (`bmad-agent-po`) initiative ticket store; `bmad-sprint-planning`, `bmad-create-epics-and-stories`, `bmad-correct-course`, `bmad-spec`, `bmad-check-implementation-readiness`, `bmad-agent-tech-writer`, `bmad-index-docs`, `bmad-shard-doc` and `bmad-init` are retired with names never reusable; every skill activates with `uv run --no-cache … render_skill.py`. Executing P5-10 would have built four epics of deliverables the v7 move deletes and put on-prem users through two migrations. Nothing from P5-10 was implemented (Stories 32.1–32.9 never started).

**Decision.**

**P5-11.1 — Package map: four v7 modules plus the thin installer; `ma-sprint` not carved.**

| Package | Form | Contents | Config questions (`[[bmod.config_questions]]`) |
|---|---|---|---|
| `bmod-ma-ops` (code `ma-ops`) | multi-skill module + `roster.toml` | agents `ma-agent-sre/cyber/devops/sqa` (Alex, Yael, Amit, Gadi); `sre-*`, `cyber-*`, `devops-*`, `sqa-*`, `mil498-*` workflows; **`ma-ops-dev-epic`** (renamed from `bmad-dev-epic`) | none (ticket tree from `core.output_folder`) |
| `bmod-ma-standards` (code `ma-standards`) | multi-skill module | coding-standard skills (`cpp-*`, `csharp-*`, `python-*`, `js-ts-*`, docker/cert/logging/otel), `code-review`, `test-generator`, `git-workflow-skill`, `commit-message`, `auto-bug-detection`, `skill-creator`, `project-context-expansion`, `open-presentation` + training deck; `ma-standards-apply` (the `AGENTS.md` / `.clinerules` / `.roomodes` injection) | none |
| `bmod-ma-knowledge` (code `ma-knowledge`) | single- or multi-skill module | **`ma-knowledge-atlas`** (renamed from `bmad-knowledge`) over the v7 initiative store | `atlas_output` (default `{project-root}/_bmad-output/knowledge-atlas`) |
| `bmod-ma-atlassian` (code `ma-atlassian`) | multi-skill module (overlay) | `ma-atlassian-bind`; store starter `jira-onprem-ticketing.toml`; Confluence publish engine + page tree (scripts); `confluence-plan`, `confluence-record-root-page`; identity clause and §6.3 entity mapping | `jira_site`, `jira_project_key`, `jira_mcp_server`, `confluence_site`, `confluence_space`, `confluence_root_page`, `confluence_mcp_server` |
| `ma-sprint` | **not carved** | the twelve `sprint-status.yaml`-section skills stay in the 3.x monolith only (P5-11.8) | — |
| `ma-agents` (npm) | thin offline installer (Node CLI) | wizard; offline bundle; `npx skills add <local path>` per module; `setup.py --module-answers`; `UV_PYTHON` / `UV_FIND_LINKS` / `UV_OFFLINE`; IDE injection; `status` / `uninstall` | — |

Owned skills drop the `bmad-` prefix (reserved for upstream; the validator does not enforce a prefix, so this is our convention); other owned names are kept, and each module's `retired.toml` starts empty and records any later rename. Our shadow `bmad-sprint-planning` / `bmad-sprint-status` / `bmad-dev-story` are deleted, not carved (FR287).

**P5-11.2 — One repository, one version line, `file:` / `github:` update sources.** `ma-bmad-extensions` holds a flat `skills/` tree with one `bmod-<code>/` record per module (`bmod.toml`, `help/help.md`, `roster.toml` where agents exist, `retired.toml`, `migration-<n>.toml`) and a `bmod.toml` `[skill]` table in each member skill; upstream `validate_manifests.py` runs in CI (FR285). The v7 validator requires all records in one repository to share one version, so the repository has **one version line** (NFR86, superseding P5-10.2's per-module versions); independent installability is unaffected because install is per skill/module (`npx skills add … --skill`). `update_source` is `github:` for online users and `file:` for the offline bundle. Whether an on-prem Git host works as an `https://` update source is a gate-spike question (36.1), not assumed.

**P5-11.3 — No sibling dependency; `recommended_skills` for upstream only.** Each module's `required_skills` names only upstream `bmad` core at the pinned version (`source = "github:bmad-code-org/BMAD-METHOD/skills"`); `recommended_skills` may name upstream skills a workflow builds on (`bmad-build`, `bmad-agent-po`), **never** a sibling module. Cross-module references found by the review (`ma-ops-dev-epic` → `git-workflow-skill` / `code-review`; `auto-bug-detection` → `story-status-lookup`) become fail-soft runtime messages or are removed (37.5). Shared text is no longer generated — the preflight and routing block it served are retired by P5-11.4 and P5-11.9; a reference two modules need is copied into each.

**P5-11.4 — The overlay is a per-target override table plus `ticketing-store-config.toml`.** `ma-atlassian` reaches other skills only through surviving v7 customization keys. **Jira:** `ma-atlassian-bind` writes `_bmad/custom/ticketing-store-config.toml` selecting our `jira-onprem-ticketing.toml` starter (Jira Server/DC through the configured MCP server or REST; upstream's `acli` starter is Cloud-only) with `[tickets.types]` / `[tickets.status]` from §6.3, adds the identity clause as `persistent_facts` on `bmad-agent-po`, and rides Sofia's `board_*` / `store_{before,after}` slots for transitions (FR289). **Confluence:** marker-delimited `_bmad/custom/<skill>.toml` overrides set `on_complete` on `bmad-prd`, `bmad-architecture`, `bmad-ux`, `bmad-product-brief`, `bmad-prfaq`, `bmad-facilitate`, plus `external_handoffs` / `external_sources` where the target declares them (at the pinned commit: `bmad-prd`, `bmad-architecture`, `bmad-facilitate`); targets without a read slot (`bmad-build`, `bmad-build-auto`, `bmad-code-review`, `bmad-retrospective`) carry the Confluence-read role in `activation_steps_prepend`; the bind table records the slot per target (36.1 AC10) (FR290; aligned 2026-11-07 per readiness C-4). The table is keyed per **target** = (skill, section, key, insertion slot), not per upstream version. Bind and unbind are idempotent, touch only their own marker blocks, honour a user-authored value with a fail-loud collision report (Story 31.15's predicate carried over), and report — not fail on — an absent target; the user re-runs bind after any module install or `bmad setup` (FR291). Upstream states "hooks are not integrated yet" for the ticket stores, which is why Epic 38 stays thin until GA.

**P5-11.5 — Target = one pinned SHA; GA gate.** The v7 line targets exactly one upstream commit (initially `e734d3ac3c0f4ea31cc2c2bbbe79e86e54f2cae6`), recorded in `package.json` `bmadRef` and `BMAD_TARGET_REF` (replacing `BMAD_TARGET_VERSION` at `lib/bmad.js:2830`) and bumped deliberately (FR271 am., FR280). The Epic 36 gate records a verdict per SHA. No on-prem release of the v7 line until the gate is re-run and passed on the GA tag (FR281); until then the v7 packages are a pre-release line and ma-agents 3.x is the supported on-prem release (note: 3.18.1 still pins bmad-method 6.10.0 — the 6.12.4 bump P5-10 planned was never executed).

**P5-11.6 — uv + Python 3.11 + wheelhouse; `--no-cache` proof.** Every v7 skill activates with `uv run --no-cache … render_skill.py` (needs `jinja2`); `tickets.py` needs `pyyaml`. `--no-cache` ignores a pre-seeded uv cache, so P5-10's "pre-seeded cache" premise does not hold: the offline bundle carries the `uv` binary, a Python 3.11 standalone interpreter and a **wheelhouse** of every PEP 723 dependency declared by the vendored skills' scripts (enumerated at build), wired with `UV_PYTHON` / `UV_FIND_LINKS` / `UV_OFFLINE` (FR282). Proof: `render_skill.py`, `resolve_config.py`, `resolve_customization.py`, `tickets.py`, `setup.py` activate under `--network none` (36.2). The Skills CLI (`skills` 1.7.6) is vendored and invoked on local paths only (FR283); setup is driven through `setup.py --module-answers <file>`, an internal contract with a printed `bmad setup <code>` fallback if it changes (FR284). All ma-agents-shipped skill scripts run through `uv run`; the installer CLI stays Node (NFR74 am.).

**P5-11.7 — `ma-ops-dev-epic` retained; discovery via `tickets.py`.** The agentic orchestrator (parallel waves, model tiers, adversarial + package-integrity gate, gated publish) is kept, renamed out of the `bmad-` prefix, and rewritten against `bmad-build` / `bmad-build-auto` / `bmad-code-review` / `bmad-review` / `bmad-walkthrough`. It enumerates epics and stories from the initiative store through `tickets.py` and writes story status only through `bmad-build`'s `story-<slug>-plan.md` (FR292). No v7 `bmad-sprint-status`, `bmad-dev-story` or `bmad-create-story` exists to orchestrate. FR235's "never bundle `bmad-loop`" stands.

**P5-11.8 — `ma-sprint` not carved; PO decision after GA.** Its twelve skills (`add-sprint`, `add-to-sprint`, `close-sprint`, `cleanup-done`, `modify-sprint`, `remove-from-sprint`, `prioritize-backlog`, `generate-backlog`, `sprint-status-view`, `story-status-lookup`, `my-next-issue`, `create-bug-story`) operate on `sprint-status.yaml` sections (`sprints:` capacity, `backlog:`) that v7 does not model; Sofia covers "what's next", "file a bug" and the board. They remain in the 3.x monolith. `bmod-ma-ops/migration-1.toml` moves 3.x `backlog:` entries into the store's `backlog/` folder and archives `sprints:` with a report (FR292). The open decision — drop, or an optional sprint-capacity layer over `tickets.toml` as a later single-skill module — is taken after GA.

**P5-11.9 — Binding spine retired.** `project-layout.yaml` → generated `_bmad/bmm/config.yaml` → staleness stamp → preflight in 41 skill copies targets a file v7 deletes (`_bmad/bmm/config.yaml` is a `LEGACY_LEFTOVERS` entry `bmad setup` offers to remove). In the v7 line store locations come from `core.output_folder` and `modules.ma-atlassian.*`; every carved skill reads config only via `resolve_config.py` and customization via `resolve_customization.py` (FR288); `bmod-ma-atlassian/migration-1.toml` converts a 3.x binding (`project-layout.yaml`, Epic 31 override markers) into setup answers and new overrides (FR293). Every user-visible on-disk change between releases ships as a `migration-<n>.toml` run by `bmad migrate`; the 3.x → v7 move is `bmad migrate method` (upstream; archives `sprint-status.yaml` unchanged) followed by our module migrations (FR294). Epic 31 stays in history untouched.

**P5-11.10 — Sequencing.** Epic 36 (v7 gate: pin, offline proof, qualify) gates 37; 37 (carve-outs as v7 modules) gates 38; 37 + 38 gate 39 (thin installer + monolith retirement). 37.1/37.2 may start once 36.1 records GO on the Skills-CLI and validator questions, even if 36.2 is still open. **GA re-gate:** 36.1 + 36.2 are re-run on the GA tag (36.7, blocked on GA) before Epic 39 ships; 39.5's release gate runs on the GA tag.

**Rejected alternatives.** *Execute Epics 32–35, then adapt* — builds and deletes four epics of v6 mechanics, puts users through two migrations, and burns skill names into upstream `retired.toml`. *Hybrid generator* (author in v7 shape, generate `module.yaml` / `marketplace.json` for 6.12.4) — keeps a generator alive for a branch upstream has frozen and doubles the install-test matrix; worth revisiting only if GA slips by months (Epic 36 gate). *Per-module repositories* — no installability gain today because install is already per skill; allowed later at zero install-path cost. *Port the Confluence engine to Python* — Node is already a v7 prerequisite (Skills CLI), so `lib/confluence-publish-hook.js` (1,781 lines) and `lib/confluence-page-tree.js` (925) move as JavaScript skill scripts; a port is optional and not planned. *Wait for GA before any work* — loses two to four weeks on work (carve-out, naming, roster, config reads, offline wheelhouse) that is stable across the preview.

**Risks.** The preview can move before GA: mitigated by one pinned SHA, a per-SHA gate verdict and the GA re-gate (P5-11.10), and by keeping Sofia-store-dependent work (Epic 38) thin until GA because upstream ticket-store hooks are not yet integrated. `setup.py --module-answers` is an internal contract: mitigated by FR284's printed fallback. On-prem Jira is Server/DC while the upstream starter is Cloud (`acli`): our starter is new design, spiked in 38.1. Confluence MCP-present paths remain mock-verified from Epic 31 until 38.6 has a live tool. The `https://` update source for an on-prem Git host is unproven (36.1).

**Affects:** `package.json` (`bmadRef`, engines), `lib/bmad.js` (`BMAD_TARGET_VERSION` → `BMAD_TARGET_REF`; `bmad-method` orchestration removed), `lib/installer.js`, `bin/cli.js`, `scripts/build-bmad-cache.js` (re-targeted to snapshot upstream `skills/` at the SHA + tea/cis tags, then into the bundle builder), `lib/agents.js:313` and `lib/uninstall.js:50` (IDE injection; removal of the v6 `ma-skills` module), `lib/confluence-*.js` (into `bmod-ma-atlassian`), `lib/knowledge-atlas/` (into `bmod-ma-knowledge`), `lib/bmad-extension*` and the custom-marketplace feature (deleted; FR239–FR243 retired), the 41 preflight copies, `project-layout.yaml` handling and the staleness stamp (deleted in the v7 line), `test/` (PluginResolver passthrough, pinned 41/9-copy counts, `--custom-source` fixtures and `uv-transition-resilience` replaced by `validate_manifests.py`, per-module `npx skills add <local>` and offline `render_skill.py` tests), CI, docs and training deck.
