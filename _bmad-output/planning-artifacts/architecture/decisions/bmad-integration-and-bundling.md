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

### Decision P5-10: Extension Decomposition, Overlay Mechanism & Thin Offline Installer — latest-only bmad-method (FR268–FR278, NFR84–NFR85) (2026-10-31)

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

