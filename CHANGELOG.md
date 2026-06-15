# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
