# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [3.15.0] - 2026-07-09

Knowledge Atlas — **stable release** (Epic 29, FR215–234 / NFR60–69), consolidating the
beta.0–beta.2 prereleases. A pre-bundled, fully-offline static-site generator invoked by
the `bmad-knowledge` skill: authoritative scan → typed manifest → per-document reading
views + interactive typed graph + generated diagrams + orphan/gap view + offline search,
all self-contained (no CDN/network, `file://`-safe) and deterministic. Includes
config-aware knowledge-source discovery (scans the folders defined in `_bmad/bmm/config.yaml`),
reference-edge extraction so planning-centric projects produce a connected graph with
working backlinks, and resolution of authored inter-document markdown cross-links. Sealed
air-gap packaging, sanitized output, cross-platform byte-identical builds. See the beta
entries below for the detailed per-story changelog. No breaking change to the public CLI → MINOR.

## [3.15.0-beta.2] - 2026-07-09

Knowledge Atlas beta.2 — fixes authored inter-document links (found in real-project
testing). Author-written markdown cross-links between source docs (e.g.
`[roadmap](roadmap.md#…)`, `[domain model](domain-model.md)`) were emitted verbatim
and, because reading views are written flat under `docs/<slug>.html`, resolved to a
nonexistent `docs/roadmap.md` → broken links. The renderer now rewrites an authored
relative doc-link (resolved against the source doc's directory) to the corresponding
rendered page, preserving `#fragment` and handling spaced/`.MD` filenames and
`../`/subdir traversal; non-scanned targets are left untouched. Verified on a real
project: 18 → 0 broken links. No breaking change to the public CLI.

## [3.15.0-beta.1] - 2026-07-07

Knowledge Atlas beta.1 — fixes from real-project (Prophesee) testing of beta.0:

- **Broken links fixed:** the traceability spine, interactive graph, and orphan/gap
  view linked entities by their raw source path (`…/foo.md#anchor`) instead of the
  rendered page, so every click opened an empty page. All three now resolve to the
  real `docs/<slug>.html` page (link-integrity test guards it).
- **Config-aware knowledge-source discovery (Story 29.7):** the engine now reads
  `_bmad/bmm/config.yaml` and scans the project's configured knowledge folders
  (`planning_artifacts` / `implementation_artifacts` / `knowledgebase_path`) in
  addition to `_bmad-output` — resolving `{project-root}` and stripping wrapping
  quotes. Projects with no such config are unchanged (byte-identical). `.git`,
  `node_modules`, and hidden files/dirs are excluded; stale output is purged on
  regen (guarded so it can never delete a configured source).
- **Reference-edge extraction (Story 29.8):** planning-centric projects (dense PRD
  with few/no story files) previously produced a disconnected graph with no
  backlinks. The engine now derives `references` edges from the docs/sections that
  mention an entity, so the graph connects and "Referenced by" populates
  (Prophesee: 0 → 317 edges). Gap/orphan detection stays keyed on semantic edges,
  so a merely-referenced requirement is still flagged as unimplemented.

Beta.0 users should reinstall (the manifest version bumped, forcing a clean
re-extraction). No breaking change to the public CLI.

## [3.15.0-beta.0] - 2026-07-03

Knowledge Atlas — Epic 29 beta prerelease (FR215–234 / NFR60–69). Adds a
pre-bundled, offline-first static-site generator (`bmad-knowledge` skill) that
scans a project's `_bmad-output` and produces a fully self-contained knowledge
site with zero runtime dependencies. No breaking change to the public CLI
surface → MINOR; beta prerelease pending cross-platform CI sign-off.

### Added

- **Knowledge Atlas engine** (`lib/knowledge-atlas/dist/atlas.cjs`, ~737 KB committed
  bundle, FR215/FR230): scan → manifest → reading views → interactive graph → orphan/gap
  report, all in a single sealed CJS artifact. The bundle is vendored into the
  ma-agents distribution so consuming projects never run `npm install` for the Atlas.

- **`bmad-knowledge` skill** (FR215/FR230): registered in `skills/bmad-knowledge/`,
  `lib/bmad-extension/skills/bmad-knowledge/`, `module-help.csv`, and
  `marketplace.json.template`/built plugin bundle (skill count 62). Invokes the
  committed `atlas.cjs` against the project's `_bmad-output` to generate or refresh
  the knowledge site.

- **Six-page site output** (FR216–222): `index.html` (home + health snapshot),
  `search.html` (offline lunr full-text search), `graph.html` (interactive
  force-graph visualization), `diagrams.html` (Mermaid diagram viewer),
  `orphans.html` (orphaned/gap entities), and per-document reading views under
  `docs/`. All pages are fully self-contained (no CDN, no network fetch,
  `file://`-safe).

- **Manifest system** (FR223–226): incremental `manifest.json` with stable key
  ordering, schema-version guard, POSIX-relative paths (no machine-specific
  absolute paths), and LF normalization. Cross-platform byte-identical across
  Linux and Windows.

- **Offline packaging + air-gap seal** (NFR60/NFR61/NFR67): lunr browser runtime
  vendored at build time; `offline-install-verify.sh` generates and verifies an
  Atlas under `--network none`; `offline-install.yml` CI gate.

- **Determinism** (NFR62): pinned `SOURCE_DATE_EPOCH`, sorted entities, LF output,
  relativized manifest paths, CRLF-tolerant scanner — same `_bmad-output` produces
  byte-identical output on Linux and Windows from any absolute project path.

- **Graceful degradation** (NFR63/FR234): per-renderer try/catch in `generate.ts`
  (one failing page never aborts the run), tolerant scanner (binary/zero-byte/unknown
  docs skipped), bad-YAML frontmatter tolerated. Disabled-JS baseline: every page
  is legible and navigable without executing any script.

- **Output sanitization** (NFR64): `sanitizeHtml()` in `linkify.ts` — allowlist-based
  tag/attribute filter strips `<script>`, `<iframe>`, `onerror=`, `javascript:`/
  `vbscript:`/`data:` schemes from all document-rendered HTML.

- **Graph reconciliation** (NFR65): `reconcileWithKgJson()` merges the auto-extracted
  graph with hand-curated `knowledge-graph.json` if present.

- **Test suites** (Story 29.1–29.6, 315+ assertions):
  `knowledge-atlas-{smoke,manifest,render,graph,packaging,offline-safety,reconcile,
  determinism,degradation,realproject}.test.js`

- **Release gate** (Story 29.6): bundle-drift check (build-to-temp, never mutates
  committed `dist/atlas.cjs`), cross-platform determinism gate (two-path byte-identity
  + CRLF≡LF), graceful-degradation gate (malformed docs + disabled-JS baseline),
  NFR64 consolidated safety assertion, and real-project smoke against the ma-agents
  repo's own `_bmad-output`.

### Fixed

- **Bundle-drift test flaw** (Story 29.6 AC 8): the prior drift check rebuilt
  `atlas.cjs` in place and restored committed bytes in a `finally` — this mutated
  the working tree during the test run and allowed a stale committed bundle to pass.
  Rewritten to build to a temp path and byte-compare against the committed file,
  never writing to `dist/atlas.cjs`.

## [3.14.1] - 2026-06-30

Cosmetic patch: rename the SQA & Standards Expert persona **Gad → Gadi**. Display-name
only — no change to the agent id (`bmm-qa`), skill folder/name (`ma-agent-sqa`), install
dir (`_bmad/skills/sqa/`), report-file naming, or memory path. No CLI/API surface change → PATCH.

### Changed

- **Renamed SQA persona `Gad` → `Gadi`** (#126) across the installed agent registry
  (`lib/agents.js`), BMAD persona customization (`bmm-qa.customize.yaml`), the `ma-agent-sqa`
  agent skill (`SKILL.md` + manifest `displayName`), the `sqa-audit` / `sqa-ieee12207` /
  `sqa-requirements-quality` workflow report footers, `module-help.csv`, the plugin
  `marketplace.json` description, and the README. Specification docs (`prd.md`,
  `architecture.md`) updated in place with new revision-history entries; the change was
  driven through the `bmad-correct-course` workflow and delivered under the standalone story
  `rename-sqa-persona-gad-to-gadi`. Completed Epic 20/22 records and `done/*` history left intact.
- Regenerated the bundled extension plugin (`lib/bmad-extension-plugin/`) and the
  `.agents/skills/` standalone mirror to carry the new display name.

## [3.14.0] - 2026-06-27

BMAD v6.9.0 integration (Epic 28). A lean, feature-inheriting bump: the v6.9.0 module
registry path **and** schema are unchanged from v6.8.0 (verified against the npm-installed
package), so the offline cache reader needed no change; the only upstream behavioral change
that touches the wrapper — the installer's `python3`→`uv` environment check — is
warn-don't-block, and ma-agents already decides success/failure off the `execSync` exit
status, never installer stdout. No breaking change to the public CLI surface → MINOR.

### Changed

- **Bumped bmad-method 6.8.0 → 6.9.0** (FR211, supersedes FR208) and rebuilt the bundled
  offline cache (`bmadMethodVersion: 6.9.0`, `registrySchema` unchanged at `package-root-v68`)
  and the ma-agents extension plugin. Upstream v6.9.0 additions are inherited via passthrough:
  the `bmad-forge-idea` core idea-validation skill, the `bmad-architecture` lean-spine rewrite
  (with `bmad-create-architecture` retained as a forwarding shim until BMAD v7), the canonical
  `memlog.py` working-memory primitive, party-mode/brainstorming enhancements, the Astro 6
  security upgrade, and the WSL-runs-Windows-Node installer guard. `scripts/build-bmad-cache.js`
  is untouched — the registry did not relocate as it did at v6.8.0.

### Added

- **uv-transition resilience + python-scoping regression guards** (`test/uv-transition-resilience.test.js`,
  FR212/FR213/NFR59): pin that v6.9.0's warn-don't-block `uv` check cannot break the install path
  (the decision rides on the `execSync` exit status, never installer stdout), and that ma-agents
  control-plane Python stays on `python`/`python3` and is never migrated to `uv run`. The
  `ml-experiment`/`ml-infra`/`ml-eda` skills' `uv run python` guidance — which runs the user's
  ML-project scripts in the user's own `uv` env — is the documented, intentional exception.
- **Passthrough-reconciliation guards** (`test/passthrough-reconciliation-6-9-0.test.js`, FR214):
  the existing `deployClineWorkflows` reconcile generates a `bmad-forge-idea` Cline wrapper and
  tolerates the `bmad-architecture`/`bmad-create-architecture` shim pair with no dangling wrapper.
  The new `hermes-agent` and `CodeWhale` installer platforms are intentionally **not** added to
  ma-agents' platform registry (deferred per Decision P5-6(d); passthrough already deploys
  upstream support).

## [3.13.2] - 2026-06-26

Skill-discovery fixes surfaced by a real multi-agent install (cline + GitHub Copilot),
root-caused against source. No breaking change to the public CLI surface → PATCH.

### Fixed

- **SKILL.md frontmatter `name` now matches the skill folder id (#120)**: the installer
  injected `skill.json`'s human-readable display name (e.g. `Git Workflow`) as the
  generated SKILL.md frontmatter `name`, while the directory uses the kebab id
  (`git-workflow-skill`). Strict validators such as cline require the frontmatter name
  to match the containing directory, so 31 of 44 standalone skills failed to load.
  `performInstall` now emits `name: <skillId>` for every agent target; `skill.json`
  keeps its display name for listings/wizard UI.
- **GitHub Copilot now discovers installed skills (#121)**: the skill-bootstrap
  instruction (the "read `.agents/skills/MANIFEST.yaml`" block) was written to
  `.github/copilot/copilot.md`, a path Copilot does not read. It now lands in
  `.github/copilot-instructions.md` — the repository custom-instructions file Copilot
  actually loads (VS Code, Visual Studio, github.com), as the PRD specifies. Skills were
  installed correctly under `.agents/skills/` all along; only the bootstrap pointer was
  misplaced.

## [3.13.1] - 2026-06-15

Epic 27 follow-ups (stories 27.8–27.16) — fixes surfaced by an adversarial review of a
real `D:\Code\Workshop` install, root-caused against source. No breaking change to the
public CLI surface → PATCH.

### Fixed

- **verify-manifest SessionStart hook now works in real installs (27.8)**: the hook is
  copied into the target's `.claude/hooks/verify-manifest.js` and the command points
  there, instead of the dead `$CLAUDE_PROJECT_DIR/lib/...` package-relative path that
  only resolved inside the ma-agents dev repo. Legacy command strings are migrated on
  upgrade and the copied file is removed on uninstall.
- **Malformed `agents: [null]` in the project-root manifest (27.9)**: `ensureManifest`'s
  create branch now guards a null `agentId`, writing `agents: []` instead of `[null]`.
- **Mixed CRLF/LF in the composed instruction block (27.10)**: `composeInstructionBlock`
  normalizes EOL at the single return point; instruction-block templates pinned to
  `eol=lf` via `.gitattributes`.
- **Regenerated `_bmad/` tree left tracked (27.11)**: the installer now ignores `_bmad/`
  in `.gitignore` (via a new `ensureBmadDirIgnored` mirroring the plugin-stage helper);
  `_bmad-output/` remains intentionally tracked.
- **Custom output folder not propagated to every module (27.14)**: a post-install pass
  normalizes module artifact paths whose output-folder segment diverged from
  `[core] output_folder` — working around an upstream `bmad-method` `endsWith('_output_folder')`
  suffix-match that bled bmb's `skills/` default into gds artifact paths. (Upstream patch
  tracked separately; vendored code untouched.)
- **`.agents/skills` missing the standalone catalog + `MANIFEST.yaml` (27.16)**: when a
  BMAD-populated `.agents/skills` exists but no `.agents`-targeting agent was selected,
  the standalone catalog and `MANIFEST.yaml` are now backfilled so the dir is consistent.

### Changed

- **BMAD module selection is now persisted (27.13)**: the selected module set is recorded
  in `.ma-agents.json`, so a deselected module (e.g. `gds`) stays excluded across
  subsequent installs/reconfigures instead of silently returning. No persisted set →
  install-all fallback (back-compat).
- **Config path convention unified (27.15)**: `writeRepoLayoutConfig` emits the
  `{project-root}/`-prefixed form (matching `config.toml`) instead of adding a third
  bare-relative variant.
- **Project-root `.ma-agents.json` is now profile-only (27.12)**: it stores only
  profile/settings (no empty `skills: {}` / `agents: []` shape it never owned); per-agent
  skills manifests remain the authoritative inventory and `getStatus` skips the
  root-scoped manifest. (Minimum-change fix; full single-manifest redesign deferred.)

## [3.13.0] - 2026-06-13

BMAD-METHOD **v6.8.0** integration (Epic 27). Inherits upstream v6.8.0 features and
reworks the bundled-module-registry reader to follow the registry's relocation, while
preserving the air-gapped install guarantee (NFR57/NFR50). No breaking change to the
ma-agents public CLI surface → MINOR bump.

### Changed

- **Bumped `bmad-method` 6.6.0 → 6.8.0** and rebuilt the bundled offline cache and the
  plugin bundle against it. `lib/bmad.js` `BMAD_TARGET_VERSION` is now `6.8.0`. The
  bundled module set is unchanged in membership — `tea`, `bmb`, `cis`, `gds`, `wds`
  (all `type: bmad-org`) — and `wds` (Whiteport Design Studio) is an **active** module
  at 6.8.0, not retired.
- **Relocated-registry reader (FR207, P5-5)**: `scripts/build-bmad-cache.js` now reads
  the bundled module registry from its v6.8.0 package-root location
  (`bmad-modules.yaml`), trying candidate paths in order (package-root v6.8.0 →
  `tools/installer/modules/registry-fallback.yaml` → legacy
  `tools/cli/external-official-modules.yaml`) and reporting which schema it found. The
  bundle decision now keys on the registry's `type: bmad-org` field (case-insensitive,
  trimmed) instead of the pre-6.8.0 `built_in` flag; `type: experimental` (e.g.
  `automator`) is excluded, and `branch` defaults to `main` (the 6.8.0 schema omits it).

### Added

- **Thin-cache fail-loud guard (FR208, NFR56)**: `build-bmad-cache.js` aborts the build
  — before writing any `cache-manifest.json` — if the registry resolves *fewer* than the
  known bundled set (`tea, bmb, cis, gds, wds`) or contains duplicate module codes. The
  registry path has now moved twice across bmad-method versions, so silent degradation to
  a partial/empty cache is a recurring risk; the guard converts that into a loud,
  actionable failure instead of shipping a broken offline bundle that "looks" successful.
- **Cline workflow-wrapper reconciliation (FR209)**: `deployClineWorkflows` now removes
  stale `.clinerules/workflows/*.md` wrappers whose backing `.cline/skills/<name>/` no
  longer exists (e.g. after an upstream skill rename/retirement), so Cline's `/`-menu
  stops offering dead workflows. Deletion is scoped strictly to ma-agents-generated
  wrappers via a conservative content fingerprint (`isGeneratedClineWrapper`);
  user-authored files are never touched, and the operation is idempotent.

### Fixed

- **Offline `file://` origin URL hardened (release-gate review)**: `restoreGitDir` now
  builds the local origin URL with `url.pathToFileURL()` instead of string concatenation,
  producing a well-formed `file:///C:/...` (three-slash) URL on Windows and
  percent-encoding paths that contain spaces or other reserved characters. The git call
  switched from `execSync` (shell-interpolated) to `execFileSync` (arg array), matching
  the rest of the codebase. This is the URL bmad-method's `cloneExternalModule()` uses to
  satisfy `git fetch origin` offline; the previous `file://C:/...` form happened to work
  with current git but was RFC-malformed and fragile on spaced paths.
- **`wds` module description corrected**: was labelled "Web Dev Studio — retired
  upstream"; it is in fact "Whiteport Design Studio" and an active `type: bmad-org` clone
  at v6.8.0. The install wizard's module-selection prompt now shows the correct name and
  no longer implies the module is retired.

### Verification (Epic 27 release gate, Story 27.7)

- **Offline install gate (NFR57/NFR50) — PASSED.** Ran the repo's CI offline harness
  (`offline-install-verify.sh`) inside a Docker container with `--network none`
  (kernel network-namespace isolation). Egress was proven blocked, then
  `ma-agents install` completed successfully and pre-populated **all five** bundled
  modules (bmb, cis, gds, tea, wds) from the v6.8.0 cache with **zero network calls** on
  the install path; bmad-method reported BMad Core v6.8.0 and WDS installed, and all
  post-install invariants held.
- **Cross-platform suite — GREEN.** Full `npm test` chain passes on Windows; the fixes
  are EOL-robust so Linux/CI parity holds (the CRLF suite-health confounder was resolved
  in Story 27.5, not waived).
- **PluginResolver / skill-enumeration passthrough** verified against v6.8.0 (Story 27.6).
- **Plugin bundle** rebuilt at `3.13.0` via the build-time `${version}` placeholder (no
  literal embedded); `plugin-manifests.test.js` and `build-plugin.test.js` green.

## [3.12.3] - 2026-05-08

### Bug Fixes

- **Repo-layout local path no longer creates a nested `_bmad-output/<…>-artifacts/`
  subtree**: When the user picks "Local path" for knowledgebase or sprint
  management and provides e.g. `D:\foo\planning`, prior versions wrote
  `planning_artifacts: "D:/foo/planning/_bmad-output/planning-artifacts"`,
  causing bmad-method to create that nested directory inside the user's
  knowledgebase folder. The wizard prompt phrasing ("Where is your
  knowledgebase managed?") implies the answer IS the artifacts folder, not
  a parent — the install behavior now matches that interpretation.
  - `bin/cli.js writeRepoLayoutConfig`: drops the
    `/_bmad-output/<…>-artifacts/` suffix when the user-supplied path is
    not `.`. Single-repo (mode `same`, path `.`) continues to use the
    canonical `_bmad-output/...` layout — no change to existing same-repo
    installs.
  - `bin/cli.js collectLocalPath`: prompt text clarified to
    *"this is the literal folder; no extra subdirectories will be
    created"* so the contract is explicit.

### Tests

- `test/cross-repo-validation.test.js` and `test/portable-paths.test.js`:
  updated assertions to expect literal paths rather than the previous
  `<path>/_bmad-output/<...>-artifacts` form.

### Migration Notes

- **Breaking for projects that previously configured a multi-repo layout
  and committed artifacts to `<kbPath>/_bmad-output/planning-artifacts/`**.
  Existing `_bmad/bmm/config.yaml` files are not rewritten on upgrade —
  only **new installs** or runs through the layout wizard pick up the new
  contract. To migrate an existing project: move the contents of
  `<kbPath>/_bmad-output/planning-artifacts/` up into `<kbPath>/`, then
  re-run the layout wizard (`npx ma-agents config layout`). Same for
  sprint management.

## [3.12.2] - 2026-05-05

### Bug Fixes

- **Offline install regression in 3.12.1**: 3.12.1's "install all bundled modules
  by default" fix exposed a latent bug: bmad-method's `cloneExternalModule()`
  resolves the latest stable tag from GitHub's API, and on an air-gapped machine
  it falls back to reading `<moduleCacheDir>/.bmad-channel.json` — a marker file
  ma-agents never wrote when pre-populating the cache. Result: a fresh offline
  install of any external module (bmb, cis, gds, tea) failed at the first
  module with `Could not resolve stable tag for '<module>'`. (Pre-3.12.1 the bug
  was masked because ma-agents only ever requested `--modules bmm`, which ships
  built into bmad-method and skips the external-cache resolution.)
  - `lib/bmad.js`: added `ensureCacheMarker(moduleDir, manifestEntry)` that
    writes a `.bmad-channel.json` matching bmad-method's `writeChannelMarker()`
    schema (`channel: 'stable'`, `version` from manifest branch, `sha` from
    manifest commitSha). Called from `prePopulateBmadCache` after each module
    copy (and on the skip path, to repair caches left wedged by 3.12.1).
    Existing markers are never overwritten.

### Tests

- `test/bmad-module-selection.test.js`: 5 new tests for `ensureCacheMarker`
  covering schema correctness, idempotency, and no-op safety on missing
  manifest data. Total 33 tests, all passing.

## [3.12.1] - 2026-05-05

### Bug Fixes

- **BMAD module install — restore originally-intended default (FR123)**: Fixed a
  defect where the install pipeline hardcoded `['bmm']` as the BMAD module list,
  stranding the bundled `tea`, `bmb`, `cis`, and `gds` modules in
  `~/.bmad/cache/external-modules/`. The originally-intended behavior — install
  every non-retired module from the cache manifest — is now the default. Users
  can scope down with `--bmad-modules <csv>` (e.g. `--bmad-modules tea,bmb`) or
  open a multiselect prompt with bare `--bmad-modules`. `bmm` is force-included
  in every path. Retired modules (currently `wds`) are filtered out.
  - `bin/cli.js`: replaced four hardcoded `['bmm']` literals with a new
    `selectBmadModules()` helper; added `--bmad-modules` optional-value flag
    parsing in `parseFlags()`; updated `--help` and examples.
  - `lib/bmad.js`: added `BMAD_MODULE_DESCRIPTIONS`, `getInstallableBmadModules()`,
    `getInstalledBmadModules()`, `resolveBmadModules()` helpers and exported them.
  - `_bmad-output/planning-artifacts/{prd,architecture}.md`: refined FR123 and
    the parameter-mapping table to make the `--modules` default explicit.

### Tests

- `test/bmad-module-selection.test.js`: 28 new tests covering the helpers, both
  `--bmad-modules` flag forms (CSV and bare), and validation.

## [3.12.0] - 2026-05-02

### Bug Fixes

- **Cline `.clinerules` directory invariant (Story 25.4)**: Fixed a bug where ma-agents
  created `.clinerules` as a flat file (a duplicate of `.cline/clinerules.md`), which
  caused an ENOTDIR error when `deployClineWorkflows()` tried to create `.clinerules/workflows/`.
  Changes:
  - `lib/agents.js`: removed `.clinerules` from Cline `instructionFiles` — `.cline/clinerules.md`
    is the single injection target.
  - `lib/installer.js`: `checkClinerulesDualFileDrift()` now no-ops when `.clinerules`
    is a directory (correct Cline structure); only fires for legacy file installs.
  - `lib/bmad.js`: `deployClineWorkflows()` migrates a legacy `.clinerules` file to a
    directory before generating `workflows/` — ensures smooth upgrade from v3.11.0 installs.

### Tests

- `test/clinerules.test.js`: 13 tests updated to cover directory invariant, single-file
  injection, legacy migration, and drift-check no-op.

## [3.11.0] - 2026-05-02

### New Features

- **Cline workflow generation (Epic 25 / Story 25.3)**: After BMAD installs, updates,
  or migrates when Cline is a selected tool, `deployClineWorkflows()` now scans
  `.cline/skills/` and writes a `.clinerules/workflows/<skill-name>.md` wrapper for
  every installed skill. Cline users can type `/` in chat to browse and invoke all
  BMAD skills via Cline's native slash-command system. Two wrapper strategies:
  - Skills with `workflow.md` get a delegation wrapper pointing to that file.
  - SKILL.md-only skills get a read wrapper with a frontmatter-ignore instruction.
  No-op when Cline is not among the selected tools. (`lib/bmad.js`)

## [3.10.0] - 2026-05-01

### Bug Fixes

- **Jira backend first-run fix (Story 25.1)**: Fixed a bug where the Jira backend
  (`tracking_system: jira`) was ignored on the first run after install. Sprint skills
  now correctly detect and activate the Jira backend on initial invocation. (`lib/bmad.js`)

### Dependencies

- **BMAD v6.6.0**: Bundled bmad-method updated to v6.6.0, including upstream persona
  and workflow improvements.

## [3.9.0] - 2026-04-30

### New Features

- **Jira sprint backend selection at install time (Epic 14 / Stories 16.1, 16.2)**:
  The `ma-agents` wizard now offers Jira as a 4th option for sprint management
  (alongside the existing file-system options). When selected, the wizard collects
  the Jira URL and project key, writes `sprint_backend: jira`, `jira_url`, and
  `jira_project_key` to `_bmad/bmm/config.yaml`, and skips creating a local
  `sprint-status.yaml` path. (`bin/cli.js`)

- **Skill-level Jira routing in all 13 sprint management skills (Epic 14 / Stories 17.22, 14.3, 14.4)**:
  Every sprint management skill now begins with a `## Backend Routing` section that
  reads `tracking_system` from `sprint-status.yaml` and routes accordingly:
  - `file-system` → existing file-based workflow unchanged
  - `jira` → skill-specific Jira operation executed via whatever Jira-capable tool
    is available in the agent context (MCP server, plugin, or native integration)

  On Jira failure the skill pauses and offers the user:
  - *(a) Retry* — re-attempt the Jira operation
  - *(b) Switch to file management* — permanently writes `tracking_system: file-system`
    to `sprint-status.yaml` and `sprint_backend: file-system` to config, then
    completes the operation locally

  Skills covered: `add-sprint`, `add-to-sprint`, `remove-from-sprint`,
  `sprint-status-view`, `cleanup-done`, `bmad-sprint-planning`, `modify-sprint`,
  `bmad-dev-story`, `bmad-sprint-status`, `close-sprint`, `prioritize-backlog`,
  `generate-backlog`, `story-status-lookup`.

- **Jira operation descriptions specification (Epic 14 / Story 14.1)**:
  `mcp-detection-pattern-spec.md` Section 6.2 now contains per-skill Jira operation
  description tables, canonical field mapping (14 fields), and bulk-write limitations
  for `bmad-sprint-planning` and `generate-backlog`.

### Epic Completions

- **Epic 5 (Bundled BMAD Installation)** fully closed. Stories 5.5 (`buildBmadArgs()`
  explicit parameter passing, 34 unit tests) and 5.6 (space-in-path verification)
  confirmed delivered and marked done.
- **Epic 14 (Jira Backend Integration)** — Stories 14.1, 14.3, 14.4 done.
  Story 14.2 (Confluence) deferred pending PRD definition of `knowledge_backend`.

## [3.8.1] - 2026-04-29

### Bug Fixes

- **Routing alignment for copilot, roo-code, kilocode (bmad-method 6.5.0)**:
  `bmad-method 6.5.0` moved the `github-copilot`, `roo`, and `kilo` platform
  `target_dir` values from tool-specific paths (`.github/skills`, `.roo/skills`,
  `.kilocode/skills`) to the shared `.agents/skills/` directory. `lib/agents.js`
  `skillsDir`, `lib/bmad.js` `TOOL_SKILL_DIRS`, multi-tool smoke workflow, and
  smoke verifier `FLAGSHIP_DIRS` are now aligned to `.agents/skills/` for these
  three platforms. Persona skills (`ma-agent-*`) now land correctly in all five
  flagship tools under CI.
- **Migration**: `OBSOLETE_TOOL_SKILL_DIRS` extended with `.github/skills`,
  `.roo/skills`, and `.kilocode/skills` entries so stale directories from 3.8.0
  installs are automatically cleaned up on the next `ma-agents install`.
- **Invariant E (smoke test)**: Updated to skip scoping checks when two tools
  share the same directory (the shared `.agents/skills/` case).

## [3.8.0] - 2026-04-28

### Bug Fixes

- **B1 — `--agent` flag scoping**: `--agent <name>` now correctly scopes the install
  to the selected tool only. Previously, passing `--agent claude-code --yes` would
  still install skills into all registered tools. The guard `if (selectedAgentIds.length === 0)`
  in the wizard ensures the pre-selected agent is never overwritten by the
  "all agents" fallback path. (`bin/cli.js`)
- **B2 — Stale `.github/copilot/skills/` cleanup**: Added `OBSOLETE_TOOL_SKILL_DIRS`
  registry and `migrateObsoleteToolDirs()` to `lib/installer.js`. On every install/upgrade,
  the legacy `.github/copilot/skills/` directory (written by the pre-F2b routing) is
  automatically removed when the replacement `.github/skills/` directory has content.
  If the replacement is absent or empty, the obsolete directory is preserved with a
  warning. The migration is idempotent and runs before the skill install loop. (`lib/installer.js`)

### Dependency Upgrade

- Bumped `bmad-method` from `6.3.0` to `6.5.0` (exact pin). This release brings the
  42-platform baseline and confirmed TOML/YAML coexistence for config files.
- All 46 `fs-extra` call sites in `lib/installer.js` audited — confirmed safe. `ma-agents`
  invokes `bmad-method` exclusively via CLI subprocess; there is no direct `fs-extra`
  API surface shared between packages at runtime.
- `BMAD_TARGET_VERSION` in `lib/bmad.js` updated from `'6.3.0'` to `'6.5.0'`.

### Assessment Findings (no action required in this release)

- **`.agents/skills/` cross-tool standard (Story 24.11)**: None of the 5 registered tools
  (Claude Code, Copilot, Cline, Roo Code, Kilocode) migrated exclusively to `.agents/skills/`.
  Per-tool routing in `lib/agents.js` remains unchanged. This is why the semver bump is
  **minor** (3.7.0 → 3.8.0) rather than major — no existing user installation is broken.
- **Plugin resolver (Story 24.8)**: Bundle resolves via Strategy 1 (module.yaml at the
  common parent directory). No `package.json` at plugin root is required by `bmad-method`
  v6.5.0. Bundle-drift check is clean; CI gates healthy.
- **`customize.toml` on_complete hooks (Story 24.7)**: `customize.toml` is not processed
  by BMAD's `--custom-source` pipeline in v6.5.0. The hooks are defined in the file but
  not yet executed end-to-end. Deferred — no user-visible change.
- **`persistent_facts` spike (Story 24.12)**: The `persistent_facts` field is not present
  in the published `bmad-method` npm package (it exists only in the upstream monorepo HEAD).
  The marker-injection layer (`MA-AGENTS-START / MA-AGENTS-END`) remains the correct
  mechanism for persisting agent instructions. No change to installation behavior.

### Tests Added

- `test/agent-scope.test.js` — 6 regression tests for B1: verifies that installing with
  `agentIds: ['claude-code']` only writes to `.claude/skills/` and leaves `.cline/skills/`,
  `.roo/skills/`, `.kilocode/skills/`, `.github/skills/` untouched.
- `test/obsolete-tool-dirs.test.js` — 8 tests for B2: covers remove / preserve / noop /
  idempotency / frozen-registry / content-intact / recursive-removal scenarios.

---

## [3.7.0] - 2026-04-10

Epic 22 features and remediations. See commit `9dec9c5` for full details.
