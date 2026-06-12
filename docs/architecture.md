# Architecture — ma-agents

**Generated:** 2026-03-04 | **Version:** 2.19.2

## 1. Executive Summary

ma-agents is a CLI tool that bridges the gap between AI coding assistants by providing a universal skill installation pipeline. The architecture is designed around three core concerns: **skill discovery** (finding and reading skill packages), **translation** (adapting generic skills to agent-specific formats), and **state management** (tracking installations via manifests for upgrade/downgrade detection).

## 2. Architecture Pattern

**Modular Pipeline Architecture** with a Registry-Based Plugin System.

```
User Input (CLI/API)
        │
        ▼
┌─────────────────┐
│   CLI Router     │  bin/cli.js — command parsing, interactive wizard
│   (Entry Point)  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐     ┌──────────────────┐
│  Installer       │────▶│  Agent Registry   │  lib/agents.js
│  Engine          │     │  (11 agents)      │  — paths, templates, resource maps
│  lib/installer.js│     └──────────────────┘
│                  │
│  • Skill listing │     ┌──────────────────┐
│  • Install flow  │────▶│  Skill Library    │  skills/
│  • Uninstall     │     │  (27 skills)      │  — skill.json + SKILL.md + resources
│  • Manifest mgmt │     └──────────────────┘
│  • Upgrade detect│
│  • MANIFEST.yaml │     ┌──────────────────┐
│  • Instruction   │────▶│  BMAD Integration │  lib/bmad.js
│    injection     │     │  — install/update  │  — customizations, workflows, templates
└─────────────────┘     │  — customize       │
                         └──────────────────┘
```

## 3. Core Components

### 3.1 CLI Router (`bin/cli.js`)

**Responsibility**: User-facing command interface.

**Commands**: `install`, `uninstall`, `status`, `list`, `agents`, `help`, `version`

**Key Flows**:
- **Interactive Mode** (no args): Presents wizard with install/status/list/agents options
- **Install Wizard**: Multi-step prompt flow — select skills → select agents (IDE + BMAD separately) → choose scope → BMAD integration → confirm → execute
- **Direct Install**: `npx ma-agents install <skill> <agents...> [--global] [--force] [--path <dir>]`
- **Update Flow**: Detects existing `.ma-agents.json`, offers update/reinstall/uninstall options, handles skill additions and agent deselections

**Design Decisions**:
- Agents are presented in two groups: IDE Coding Assistants and BMAD Method Agents
- The wizard pre-populates selections from existing installs during updates
- BMAD integration prompt appears after scope selection for project-level installs

### 3.2 Installer Engine (`lib/installer.js`)

**Responsibility**: Core installation logic, manifest management, skill discovery.

**Key Functions**:

| Function | Purpose |
|----------|---------|
| `listSkills()` | Scans `skills/` directory, reads `skill.json` metadata |
| `installSkill()` | Orchestrates install with upgrade detection, groups agents by path |
| `performInstall()` | Low-level: template selection → frontmatter injection → file copy → resource mapping |
| `uninstallSkill()` | Handles multi-agent manifests, only deletes files when no agents remain |
| `generateSkillsManifest()` | Writes `MANIFEST.yaml` with skill IDs, descriptions, `applies_when`, `always_load` |
| `updateAgentInstructions()` | Injects `<!-- MA-AGENTS-START -->` planning block into agent instruction files |
| `compareSemver()` | Simple 3-part semver comparison for upgrade detection |
| `getStatus()` | Reads manifests across all agents, reports installed skills |

**Installation Pipeline**:

```
1. Validate skill exists in skills/
2. Group agents by resolved install path (deduplication)
3. For each path group:
   a. Check existing manifest for version comparison
   b. If installed: prompt upgrade/skip/reinstall/remove (unless --force)
   c. Resolve template: <agent-template>.md → generic.md → SKILL.md
   d. Strip existing frontmatter, inject from skill.json
   e. Write SKILL.md to target directory
   f. Copy resource directories with agent-specific remapping
   g. Copy template.md if exists
   h. Update .ma-agents.json manifest
   i. Generate MANIFEST.yaml
   j. Inject planning instruction into agent instruction files
```

**Manifest System** (`.ma-agents.json`):
- Tracks installed skills with version, timestamps, installer version, agent version
- Supports multi-agent manifests (v1.1.0): multiple agents can share one install path
- Backward-compatible with v1.0.0 single-agent manifests
- Enables upgrade detection via semver comparison

### 3.3 Agent Registry (`lib/agents.js`)

**Responsibility**: Agent configuration — paths, templates, resource mappings.

**Schema per Agent**:

```javascript
{
  id: 'agent-id',           // Unique kebab-case identifier
  name: 'Display Name',     // Human-readable name
  version: '1.0.0',         // Agent config version (independent semver)
  category: 'ide' | 'bmad', // Agent category
  description: 'Brief...',  // Description for CLI display
  getProjectPath: () => ..., // Project-level skills directory
  getGlobalPath: () => ...,  // Global/user-level skills directory (platform-aware)
  fileExtension: '.md',      // Skill file extension
  template: 'generic',       // Template priority ID
  resourceMap: {},            // Optional: directory name remapping
  instructionFiles: []        // Files to inject planning instruction into
}
```

**Registered Agents** (11):

| ID | Category | Template | Resource Map |
|----|----------|----------|-------------|
| `claude-code` | ide | claude-code | — |
| `gemini` | ide | generic | — |
| `copilot` | ide | generic | — |
| `cursor` | ide | generic | — |
| `cline` | ide | cline | references→docs, assets→templates |
| `kilocode` | ide | generic | — |
| `antigravity` | ide | generic | — |
| `bmm-sre` | bmad | generic | — |
| `bmm-devops` | bmad | generic | — |
| `bmm-cyber` | bmad | generic | — |
| `bmm-mil498` | bmad | generic | — |

**Platform-Aware Paths**: Each agent's `getGlobalPath()` handles win32, darwin, and linux differently using `os.platform()` and `os.homedir()`.

### 3.4 BMAD Integration (`lib/bmad.js`)

**Responsibility**: Install, update, and customize BMAD-METHOD in target projects.

**Key Functions**:

| Function | Purpose |
|----------|---------|
| `isBmadInstalled()` | Checks for `_bmad/` directory |
| `installBmad()` | Resolves bmad-method via `require.resolve` and runs `node <resolved-path> install --yes` with module/tool flags |
| `updateBmad()` | Resolves bmad-method via `require.resolve` and runs `node <resolved-path> install --action update --yes` |
| `applyCustomizations()` | 6-step post-install customization pipeline |
| `registerMilWorkflows()` | Appends MIL-STD-498 entries to BMAD CSV registries |

**Customization Pipeline** (6 steps, order-critical):

```
1. Apply YAML customizations → _bmad/_config/agents/*.customize.yaml
2. Apply agent .md templates → _bmad/custom/agents/*.md
3. Recompile BMAD (node <resolved-path> install) — regenerates _bmad/bmm/ tree
4. Apply workflows → _bmad/bmm/workflows/ (AFTER recompile to persist)
5. Apply MIL-STD-498 templates → _bmad/bmm/templates/mil498/ (AFTER recompile)
6. Copy compiled agents → _bmad/bmm/agents/*.md (AFTER recompile)
7. Register MIL workflows → append to module-help.csv and bmad-help.csv
```

**Critical Order Dependency**: Steps 3-6 must run AFTER the BMAD recompile in step 3 because recompile regenerates the `_bmad/bmm/` tree and would wipe files placed there earlier.

### 3.5 Skill Library (`skills/`)

**Responsibility**: Bundled skill packages following the unified structure.

**Skill Structure**:

```
skills/<skill-name>/
├── skill.json              # Metadata (name, description, version, tags)
├── SKILL.md                # Main instructions (pure markdown, no frontmatter)
├── claude-code.md           # Agent-specific template (optional)
├── cline.md                 # Agent-specific template (optional)
├── generic.md               # Generic template (optional)
├── template.md              # Output template (optional)
├── scripts/                 # Executable scripts (optional)
├── references/              # Documentation (optional)
├── examples/                # Sample outputs (optional)
├── hooks/                   # Git hooks (optional)
└── assets/                  # Configs, templates (optional)
```

**Template Resolution Priority**: `<agent-template>.md` → `generic.md` → `SKILL.md`

**Skills by Domain** (27 total):
- **General** (7): code-review, commit-message, test-generator, test-accompanied-development, code-documentation, skill-creator, document-revision-history, ai-audit-trail
- **Security** (5): python-security-skill, js-ts-security-skill, create-hardened-docker-skill, verify-hardened-docker-skill, docker-image-signing, docker-hardening-verification
- **Dependencies** (2): python-dependency-mgmt, js-ts-dependency-mgmt
- **Modern C++** (6): cpp-memory-handling, cpp-robust-interfaces, cpp-modern-composition, cpp-const-correctness, cpp-concurrency-safety, cmake-best-practices
- **Architecture** (5): logging-best-practices, opentelemetry-best-practices, vercel-react-best-practices, git-workflow-skill, self-signed-cert

### 3.6 BMAD Cache & Offline Self-Containment (build-time)

**Responsibility**: Pre-vendor BMAD's external modules so installs never touch the network.

ma-agents bundles bmad-method as an npm dependency **and** pre-clones BMAD's external modules (`tea`, `bmb`, `cis`, `gds`) into `lib/bmad-cache/` at build time via `npm run build:bmad-cache` ([scripts/build-bmad-cache.js](../scripts/build-bmad-cache.js)). This is what lets `npx ma-agents install` run fully offline in air-gapped environments (NFR2/NFR50/NFR54) — the npm tarball already contains every module bmad-method would otherwise `git clone` from GitHub at install time.

**Module discovery**: the builder reads BMAD's bundled module registry to learn which external modules to clone. **The registry source has moved across BMAD versions** and the reader must track it:

| BMAD version | Module registry source | Format |
|--------------|------------------------|--------|
| ≤ 6.2.x | `tools/cli/external-official-modules.yaml` | YAML |
| 6.3.0 – 6.6.x | `tools/installer/modules/registry-fallback.yaml` | YAML |
| 6.8.0+ | `bmad-modules.yaml` (bmad-method **package root**) | YAML (`modules:` map; the in-package `registry-fallback.yaml` was retired in 6.7.0) |

The registry has stayed **YAML** throughout — only its path has moved. (`tools/installer/modules/official-modules.js` is unchanged loader code that reads this YAML; it does not contain the module list.) Modules are classified by a `type` field: `type: bmad-org` modules are bundled (**tea, bmb, cis, gds, wds**) and `type: experimental` modules are excluded (currently `automator`). `bmm`/`core` are built-in (loaded from bmad-method's local `module.yaml`, absent from the registry) and are never cloned. The reader for the current pin and its fail-loud contract are defined by Architecture Decision **P5-5** (Epic 27) in `_bmad-output/planning-artifacts/architecture.md`. A companion build step, `npm run build:plugin` ([scripts/build-plugin.js](../scripts/build-plugin.js)), assembles the ma-agents extension plugin bundle (`lib/bmad-extension-plugin/`) deterministically; a CI Bundle Drift Guard enforces that the committed bundle matches a fresh build.

> **Maintenance note:** because the registry path has now moved twice (YAML→YAML→YAML at three locations), the cache builder fails loud — if the resolved `type: bmad-org` set is smaller than the known bundled set, or no module source is found, it exits non-zero rather than producing a thin/empty cache, so a future BMAD registry move surfaces at build time, not as a broken air-gapped install.

## 4. Data Flow

### 4.1 Install Flow

```
User runs: npx ma-agents install code-review claude-code

1. cli.js parses args → handleInstall()
2. installer.installSkill('code-review', ['claude-code'])
3. Resolve install path: .claude/skills/
4. Check .ma-agents.json for existing version
5. performInstall():
   a. Find template: claude-code.md (exists) ✓
   b. Read source, strip frontmatter
   c. Inject frontmatter from skill.json
   d. Write to .claude/skills/code-review/SKILL.md
   e. Copy scripts/, references/ (no resourceMap remapping for claude-code)
6. Update .ma-agents.json manifest
7. Generate .claude/skills/MANIFEST.yaml
8. Inject planning block into .claude/CLAUDE.md
```

### 4.2 BMAD Integration Flow

```
User selects BMAD install during wizard

1. bmad.isBmadInstalled() → false
2. bmad.installBmad(['bmm', 'bmb'], ['claude-code'])
   → execSync('node <resolved-path> install --yes --modules bmm,bmb --tools claude-code')
   (where <resolved-path> = require.resolve('bmad-method/tools/bmad-npx-wrapper.js'))
3. bmad.applyCustomizations():
   a. Copy .customize.yaml files to _bmad/_config/agents/
   b. Copy agent .md templates to _bmad/custom/agents/
   c. Recompile BMAD (node <resolved-path> install)
   d. Copy workflows to _bmad/bmm/workflows/
   e. Copy MIL-498 templates to _bmad/bmm/templates/mil498/
   f. Copy compiled agents to _bmad/bmm/agents/
   g. Register MIL workflows in CSV registries
```

## 5. Key Design Decisions

### 5.1 Single Source of Truth for Metadata

`skill.json` is the only place skill metadata (name, description, version) lives. Frontmatter is **injected at install time**, never authored manually. This prevents metadata drift across multiple files.

### 5.2 Path Deduplication

When multiple agents share the same install path (e.g., agents with identical `getProjectPath()`), the installer groups them and performs the file operations **once**, then updates the manifest with all agent IDs. This prevents redundant file copies.

### 5.3 Multi-Agent Manifests

The `.ma-agents.json` manifest evolved from v1.0.0 (single `agent` field) to v1.1.0 (array `agents` field) to support shared install paths. The code includes backward-compatibility migration.

### 5.4 BMAD Post-Recompile Ordering

BMAD customizations follow a strict order: YAML configs and custom agents must be placed **before** recompile (so BMAD can use them), while workflows, templates, and compiled agents must be placed **after** recompile (to avoid being wiped by the regeneration).

### 5.5 Agent Instruction Injection

The installer uses `<!-- MA-AGENTS-START -->` / `<!-- MA-AGENTS-END -->` HTML comment markers to manage its injected planning block in agent instruction files. This allows idempotent updates without corrupting user content.

### 5.6 BMAD Agent File Protection

When an agent instruction file doesn't exist and the agent category is `bmad`, the installer **skips** creating it. BMAD agent files are full persona definitions — creating them with only the MA-AGENTS block would destroy the agent.

## 6. External Dependencies

| Dependency | Type | Purpose |
|------------|------|---------|
| `prompts` | npm | Interactive terminal prompts (select, multiselect, confirm, text) |
| `chalk` | npm | Terminal color/style formatting |
| `fs-extra` | npm | Extended fs operations (ensureDir, copy, outputFile, remove) |
| `bmad-method` | npm (local dep) | BMAD-METHOD installation and compilation (resolved via `require.resolve`, invoked as `node <resolved-path>`) |

## 7. Versioning Strategy

Three independent semver tracks:

| Scope | Location | Bump When |
|-------|----------|-----------|
| Package | `package.json` | CLI changes, new features, bug fixes |
| Skill | `skills/<name>/skill.json` | Skill content changes |
| Agent | `lib/agents.js` (per agent) | Agent config changes (paths, templates, resource maps) |

The installer compares skill versions between the package and installed manifests to offer upgrade/skip/downgrade options.
