# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
