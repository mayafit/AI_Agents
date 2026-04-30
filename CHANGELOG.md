# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
