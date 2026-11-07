# Decisions no longer in force, kept verbatim as history

## From decisions/bmad-integration-and-bundling.md

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

## From decisions/sprint-and-backlog-management.md

#### P2-11 amendment (2026-10-31, P5-10): the tracker hook contract **[SUPERSEDED 2026-11-07 by P5-11.4 / FR289]**

> *Superseded 2026-11-07 by Decision P5-11 (Sprint Change Proposal 2026-11-07). BMAD v7 has no `sprint-status.yaml` and retires `bmad-sprint-planning`; `ma-sprint` is not carved (P5-11.8). In the v7 line Jira is a Sofia (`bmad-agent-po`) ticket-store definition selected through `_bmad/custom/ticketing-store-config.toml`, with transitions on Sofia's `board_*` hooks (P5-11.4, FR289) — there is no per-skill tracker hook, adapter reference or `tracker = "file-system"` key. P2-11 itself is unchanged and remains the contract for the 3.x line. The amendment text below is kept as history.*

The backend-routing block (`mcp-detection-pattern-spec.md`) no longer lives inside each sprint skill. From P5-10:

- **`ma-sprint` skills expose a hook, not a branch.** Each skill's `customize.toml` declares `[workflow] tracker = "file-system"` and an `activation_steps_prepend` slot. The skill body implements file-system behaviour only and reads `{workflow.tracker}` at activation.
- **The Jira branch is one adapter reference** (`ma-atlassian/references/jira-tracker.md`): the routing block, the identity clause (`assignee = currentUser()`, shared-account STOP), the entity mapping to the canonical schema (§6.3) and the retry / switch-to-file-system failure contract — moved verbatim from the 13 skills, maintained once.
- **Binding is by override.** `ma-atlassian`'s setup skill writes a marker-delimited `_bmad/custom/<skill>.toml` for each installed target: `tracker = "jira"` plus a prepend step that loads the adapter reference. Removing the override (or the module) returns the skill to file-system behaviour with no edit.
- **Upstream skills are bound the same way.** `bmad-sprint-planning` (v6.12, `sprint_plan.py` core — preserves `project_key`, `tracking_system`, `story_location`), `bmad-build`, `bmad-build-auto`, `bmad-code-review`, `bmad-correct-course`, `bmad-retrospective`, `bmad-walkthrough`. ma-agents' shadow `bmad-sprint-planning` / `bmad-sprint-status` / `bmad-dev-story` are deleted; `v6-shims/` are never bound.
- **Unknown tracker value** keeps §2.5's fall-back-to-file-system semantics (unchanged — this is sprint state, not a knowledge store; contrast FR262).
- **`project_key`, `tracking_system`** continue to be written to `sprint-status.yaml` by whichever skill initialises it; the Atlassian module's config questions (Jira URL, project key) feed them via the binding generated from `project-layout.yaml` (P5-9), not via the ma-agents wizard.

## From structure-and-boundaries.md

### Target Structure after P5-10 (2026-10-31 — Epics 33–35) **[SUPERSEDED 2026-11-07 by P5-11]**

> *Superseded by "Target Structure after P5-11" above (Sprint Change Proposal 2026-11-07): the marketplace / `module.yaml` / `shared/` layout below is v6-shaped and was never built. Kept as history.*

The tree above is the **current** single-package layout and remains accurate until Epic 33 lands. The target is two repositories:

```
ma-bmad-extensions/                       — NEW repository: the five BMAD extensions
├── .claude-plugin/marketplace.json       — one plugin per module (discovery mode → installer picker)
├── shared/                               — canonical text rendered into consuming skills at build
│   ├── tracker-routing.md                — (was pasted in 13 sprint skills)
│   └── knowledge-store-preflight.md      — (was pasted in 17 skills)
├── modules/
│   ├── ma-ops-agents/                    — module.yaml (code, module_version) + module-help.csv
│   │   ├── ma-agent-{sre,devops,cyber,sqa}/
│   │   ├── sre-*/ devops-*/ cyber-*/ sqa-*/
│   │   ├── mil498-*/                     — templates moved into each skill's assets/
│   │   ├── create-hardened-docker-skill/ verify-hardened-docker-skill/ docker-*/ self-signed-cert/
│   │   └── bmad-dev-epic/                — orchestrates bmad-build / build-auto / code-review / review / walkthrough
│   ├── ma-sprint/
│   │   ├── add-sprint/ … sprint-status-view/ create-bug-story/ story-status-lookup/
│   │   └── (each: customize.toml with [workflow] tracker = "file-system" + activation_steps_prepend)
│   ├── ma-atlassian/
│   │   ├── module.yaml                   — config questions: jira_url, jira_project_key, confluence_space, confluence_root_page
│   │   ├── ma-atlassian-setup/           — generates _bmad/custom/<skill>.toml overrides from the version-keyed target table
│   │   │   ├── references/jira-tracker.md
│   │   │   ├── references/confluence-store.md
│   │   │   ├── references/targets.yaml   — {bmad-method version → skill → roles}
│   │   │   └── scripts/                  — binding stamp, page tree, publish-hook generator (from lib/confluence-*.js + bin/cli.js)
│   │   ├── my-next-issue/ bind/ confluence-plan/ confluence-record-root-page/
│   ├── ma-knowledge/
│   │   └── bmad-knowledge/scripts/atlas.cjs
│   └── ma-standards/
│       ├── cpp-*/ csharp-*/ python-*/ js-ts-*/ cmake-*/ logging-*/ opentelemetry-*/ vercel-react-*/
│       ├── code-documentation/ git-workflow-skill/ code-review/ commit-message/ ai-audit-trail/ test-*/ …
│       └── ma-standards-setup/           — injects the always-load rule block into per-tool instruction files
├── scripts/build.js                      — renders shared/, validates every SKILL.md, emits per-module digests
└── test/                                 — per-module: manifest enumeration, drift gate, offline PluginResolver passthrough

ma-agents/                                — THIS repository after Epic 35: the thin offline installer
├── bin/cli.js                            — wizard (scope, profile, tools, modules), stage-and-invoke, IDE injection only
├── lib/{installer,agents,bmad,profile,reconfigure,uninstall}.js
├── lib/bmad-cache/                       — bmm built-in; tea / bmb / cis at the v6.12.4 registry pins
├── lib/extensions/                       — pinned copies of modules/* from one ma-bmad-extensions tag (staged as N --custom-source paths)
├── lib/templates/                        — instruction-block templates
└── test/                                 — installer, injection, offline gate (uv in the loop)
```

Removed from `ma-agents` by Epic 35: `lib/bmad-extension/`, `lib/bmad-extension-plugin/`, `skills/`, `lib/knowledge-atlas/`, `lib/confluence-*.js`, `lib/custom-marketplace.js`, `lib/bmad-workflows/`, `lib/mil498-templates/`, `mil498/`, and the `bind` / `confluence-*` CLI commands.

## From implementation-patterns.md

### Phase 5 Extension Decomposition Patterns (2026-10-31, P5-10) **[SUPERSEDED 2026-11-07 by P5-11]**

> *Superseded by "Phase 5 v7 Module Patterns" above (Sprint Change Proposal 2026-11-07). The rules below assume v6 mechanics (`shared/` generation, per-module `module_version`, version-keyed overlay, `v6-shims/`). Kept as history; do not apply them to Epics 36–39.*

**All AI Agents Working on Epics 32–35 MUST:**
- **Shared text is generated, never depended on.** A block two modules both need (tracker routing, knowledge-store preflight) has one source under `shared/` in the extension repo and is rendered into each consuming skill at build. Never load it across modules at run time; never hand-edit a rendered copy.
- **Extension scripts are in-skill.** Anything an extension needs at run time (binding stamp, Confluence page tree, publish-hook generator, Atlas engine) lives under that skill's `scripts/` and is invoked as `uv run {skill-root}/scripts/x.py` or `node {skill-root}/scripts/x.cjs`. Never `require('ma-agents/…')`, never `require.resolve` a package.
- **Skill directory names are unique across all six packages.** Prefix by family (`sre-`, `cyber-`, `mil498-`, `ma-agent-`, …). IDE skill folders are flat and bmad-method ≥ 6.10 aborts on duplicate leaf names.
- **Overlays bind through `_bmad/custom/<skill>.toml` only**, marker-delimited, idempotent, version-keyed by the installed bmad-method, excluding `v6-shims/`, and reporting every unbound target by name. No overlay edits a skill document.
- **One upstream version.** Target the pinned bmad-method only; when upstream retires a skill, repoint to its successor in the same change — never carry both names.
- **`persistent_facts` are explicit.** Upstream ships them empty; every owned `customize.toml` states its own (e.g. `file:{project-root}/**/project-context.md`).
- **Version per module.** Bump `module_version` in the module you changed; never bump a sibling.

**Phase 5 Anti-Patterns:**
- A `ma-core` / shared-runtime module that other extensions import — it recreates the monolith's coupling.
- Passing `--shims` to bmad-method, or binding a `v6-shims/` name as an overlay target.
- Putting config questions in the ma-agents wizard that belong to a module's `module.yaml`.
- Adding skill content to the `ma-agents` npm package after Epic 35.
