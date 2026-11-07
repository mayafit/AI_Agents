# Implementation Patterns & Consistency Rules

> **Shard** of the [Architecture index](../architecture.md). Content is verbatim from the
> pre-split document; the index carries the front matter, registers and reading order.
>
> The operative constraints for anyone implementing a story: naming, structure,
> format, process and enforcement patterns, plus the Phase 2 additions.
> READ THIS BEFORE WRITING CODE.

---

## Implementation Patterns & Consistency Rules

### Critical Conflict Points

6 areas where AI agents working on the ma-agents codebase could make incompatible choices:

### Naming Patterns

**File & Module Naming:**
- Source files: `kebab-case.js` (e.g., `cli.js`, `installer.js`, `agents.js`)
- Skill directories: `kebab-case` (e.g., `security-skill`, `cpp-best-practices`)
- BMAD agents: `kebab-case` with role prefix (e.g., `bmm-sre`, `bmm-devops`, `cis-storyteller`)
- Templates: `<agent-name>.md` matching the agent registry key exactly

**Code Naming:**
- Functions: `camelCase` (e.g., `installSkills`, `getAgentPath`, `applyCustomizations`)
- Variables: `camelCase` (e.g., `skillList`, `agentConfig`, `manifestData`)
- Constants: `UPPER_SNAKE_CASE` only for true constants (e.g., `MANIFEST_VERSION`)
- No class-based patterns — the codebase uses plain functions and objects

**JSON/YAML Fields:**
- `skill.json`: `snake_case` keys (e.g., `always_load`, `skill_name`) — established convention
- `.ma-agents.json` manifest: `camelCase` keys — established convention
- `config.yaml`: `snake_case` keys — BMAD convention

### Structure Patterns

**Project Organization (established, do not restructure):**
```
bin/cli.js          — CLI entry point and command routing
lib/installer.js    — Core installation engine
lib/agents.js       — Agent registry and configuration
lib/bmad.js         — BMAD integration subsystem
skills/             — Skill library (self-contained directories)
index.js            — Programmatic API exports
```

**Skill Directory Structure (mandatory for all new skills):**
```
skills/<skill-name>/
  skill.json          — metadata SSoT (REQUIRED)
  SKILL.md            — canonical content (REQUIRED)
  templates/           — agent-specific templates (optional)
    claude-code.md
    generic.md
  references/          — supporting docs (optional)
  assets/              — templates/configs (optional)
```

**Where tests go:** `tests/` directory at project root, mirroring source structure (e.g., `tests/installer.test.js`). Co-located tests are not used.

### Format Patterns

**Console Output:**
- User-facing messages: plain text with chalk colors (green=success, yellow=warning, red=error)
- Progress indicators: simple line-by-line output, no spinners or progress bars
- List output: indented with `  - ` prefix
- No emoji in CLI output unless explicitly requested

**Error Messages:**
- Format: `Error: <what went wrong>` followed by `  Hint: <how to fix>` on next line
- Never expose stack traces to users — log to debug only
- Always suggest a recovery action when possible

**Skill Metadata (skill.json):**
```json
{
  "name": "skill-name",
  "version": "1.0.0",
  "description": "One-line description",
  "category": "one of: security|architecture|testing|documentation|workflow|language",
  "tags": ["tag1", "tag2"],
  "always_load": false
}
```

### Process Patterns

**Adding a New Agent:**
1. Add configuration object to `agents.js` registry array
2. Define: name, category, platform paths, instruction file, resource map
3. No changes to `installer.js` or other modules (NFR13)
4. Test: install a skill targeting the new agent, verify file placement

**Adding a New Skill:**
1. Create skill directory under `skills/`
2. Add `skill.json` (metadata) and `SKILL.md` (content) — both required
3. Optionally add `templates/<agent>.md` for agent-specific content
4. No changes to installer or any other module (NFR14)
5. Test: `npx ma-agents list` shows the skill, install works for target agents

**Modifying the Install Pipeline:**
1. Changes to `installer.js` must preserve the 5-stage pipeline order
2. Manifest writes must remain atomic (read → validate → write)
3. All file operations must use `path.join()` — never string concatenation for paths
4. New operations must be additive-only unless explicitly implementing uninstall

**Modifying BMAD Integration:**
1. Changes to `bmad.js` must preserve the 6-stage pipeline order
2. YAML configs always before recompile, workflows/templates/agents always after
3. Never skip the recompile step — downstream customizations depend on it

### Enforcement Guidelines

**All AI Agents Working on This Codebase MUST:**
- Use `path.join()` for all file path construction — never `/` or `\\` concatenation
- Preserve existing module boundaries — no merging modules or moving functions between files without explicit instruction
- Keep the codebase dependency-minimal — no new npm dependencies without explicit approval
- Follow the established 4-module architecture — new functionality goes into the most relevant existing module or a new module if genuinely needed

**Anti-Patterns (Never Do):**
- Adding TypeScript, build steps, or transpilation
- Importing external frameworks (Express, Commander, etc.)
- Creating class hierarchies — use plain functions and objects
- Hardcoding agent names or skill names in installer logic
- Using `process.platform` checks outside of `agents.js` — platform awareness is centralized there

### Phase 2 Implementation Patterns (2026-03-11)

#### Injection Strategy Patterns

**Markdown Injection (TOP placement):**
```
<!-- MA-AGENTS-START -->
<injected skill-loading instructions>
<!-- MA-AGENTS-END -->
```
- `skipPatterns: ['---']` means skip the entire delimited block (e.g., YAML frontmatter between `---` pairs), not just the delimiter line
- **Update scenario:** Find existing `MA-AGENTS-START` → `MA-AGENTS-END` block, replace in-place at the same position
- **New injection:** Insert block after skipped headers, before all other content
- Injection logic in `installer.js` is format-agnostic — all format knowledge lives in `agents.js` via `injectionStrategy`

**JSON Injection (OpenCode):**
- No comment markers — JSON doesn't support comments
- **Detection:** ma-agents entries in the `instructions` array are identified by a known prefix (e.g., entries containing `[ma-agents]` tag)
- **Update scenario:** Filter out existing ma-agents entries from `instructions` array, then append fresh entries
- **New file:** Create `opencode.json` with complete ma-agents configuration
- **Existing file:** Read → parse → merge `instructions` array (additive-only, NFR18) → preserve all other keys → write back
- Uses same read-validate-write pattern as manifest management (NFR7)

#### Extension Module Authoring Patterns

**Built-in Agent `.customize.yaml` (critical_actions only):**
```yaml
# MA-AGENTS: skill enforcement for bmm-<role>
critical_actions:
  1: "Read the skills MANIFEST at {project-root}/skills/MANIFEST.yaml"
  2: "For each skill marked always_load: true, read the skill file completely"
  3: "Follow all skill directives during this session"
```

**Custom Agent `.customize.yaml` (full customization):**
```yaml
# MA-AGENTS: full customization for bmm-<role>
persona: |
  <persona content>
menu:
  <menu entries>
critical_actions:
  1: "Read the skills MANIFEST at {project-root}/skills/MANIFEST.yaml"
  2: "For each skill marked always_load: true, read the skill file completely"
  3: "Follow all skill directives during this session"
  4: "<agent-specific action if needed>"
```

**Rules:**
- Always use YAML block style (not flow style)
- Always quote action string values
- `critical_actions` 1-3 are identical across all 11 agents — treat as a template constant
- Custom agents MAY add actions 4+ for agent-specific needs
- Built-in agents MUST NOT include persona or menu overrides — only `critical_actions`

#### Extension Workflow Patterns

- Each workflow directory: `workflows/<workflow-name>/workflow.md`
- Follows existing BMAD workflow conventions (same structure as `_bmad/bmm/workflows/`)
- `module-help.csv` entries follow BMAD's established CSV schema for phase registration
- NFR19 compliance is automatic — BMAD's registration system supports both menu and slash command invocation for all registered workflows
- No custom invocation handling needed

#### `_bmad-output` Gitignore Patterns

- **During install:** If `_bmad-output` is found in `.gitignore`, remove that line
- **New installs:** Never add `_bmad-output` to `.gitignore`
- **User notification:** Print `"_bmad-output is now tracked as project knowledge (not gitignored)"`
- **Backward compatibility:** Existing projects with `_bmad-output` in `.gitignore` get it removed on next install/update

#### `auto-bug-detection` Skill Pattern

- Standard skill schema: `skill.json` + `SKILL.md` + optional `templates/`
- `always_load: true` — bug detection active for all agents by default
- Passive enforcement model — skill content instructs agents on detection/reporting behavior
- BMAD `critical_actions` ensure the skill is loaded; the skill itself defines what the agent does with it
- Follows all existing skill authoring patterns from Phase 1

#### Phase 2 Enforcement Additions

**All AI Agents Working on Phase 2 Features MUST:**
- Never put format-awareness logic in `installer.js` — all agent format knowledge belongs in `agents.js` via `injectionStrategy`
- Use `<!-- MA-AGENTS-START -->` / `<!-- MA-AGENTS-END -->` markers for all markdown injections — no other marker format
- Keep `critical_actions` 1-3 identical across all 11 agent customize files — divergence breaks the enforcement model
- Use additive-only merge for `opencode.json` — never remove or overwrite existing user configuration

**Phase 2 Anti-Patterns:**
- Hardcoding injection positions (line numbers, byte offsets) instead of using skip pattern parsing
- Creating per-agent injection logic in `installer.js` instead of driving behavior from `agents.js` registry
- Modifying bmad-method core files instead of using extension module APIs (NFR17 violation)
- Adding `_bmad-output` to `.gitignore` (reverses F3 intent)
- Fetching bmad-method via `npx` instead of using the npm dependency copy (breaks air-gap, NFR20 violation)
- Letting bmad-method auto-fetch external modules without pre-populating the cache first (breaks air-gap)
- Including `.git/` directories in `lib/bmad-cache/` — wastes package size, not needed for installation

### ma-agents 4.x module patterns

These rules apply to every skill in the `ma-bmad-extensions` repository and to the `ma-agents` 4.x installer (Decision P5-11).

**Module rules (`ma-bmad-extensions`):**
- **Configuration through `resolve_config.py`.** A skill reads every setup answer it needs with one `uv run {project-root}/_bmad/scripts/resolve_config.py --project-root {project-root} --key … --key …` call at activation (`core.output_folder`, `modules.<code>.<key>`), and customization only through `resolve_customization.py`. It opens no configuration file directly.
- **A `bmod.toml` in every member.** Each member skill carries `[skill]` with `bmod = "bmod-<code>"` and `source` equal to its record's `update_source`, and appears in the record's `skills` list. `validate_manifests.py` passes before a change lands.
- **One version line.** All four records carry the same `version`; a change to any module bumps it.
- **Overrides are marker blocks.** Anything a module writes into a file it does not own sits between its own start/end markers (`# ma-atlassian:start` / `# ma-atlassian:end` in TOML; `<!-- ma-standards:start -->` / `<!-- ma-standards:end -->` in Markdown). Writing is idempotent; a key the user already set is reported as a collision and left alone; removal deletes only the module's own blocks.
- **`retired.toml` in the same change.** Renaming or removing an owned skill adds the `renamed` or `removed` entry to its module's `retired.toml` in the same change. A retired name, ours or upstream's, is never reused.
- **`migration-<n>.toml` for every on-disk change.** A release that changes the files a previous release left in a project ships a numbered migration with `module`, `from`, `to`, `title`, `summary`, `detect`, `guide` and `checklist`. A migration backs up before it writes, is safe to re-run, and writes a report.
- **PEP 723 headers.** Every Python script declares its dependencies inline; `bundle build` enumerates the wheelhouse from these headers and `uv run --no-cache` resolves only from it offline.
- **Node scripts in `[skill] scripts`.** A JavaScript script is listed in its skill's `[skill] scripts`, installed by setup to `_bmad/<code>/scripts/`, run with `node`, and requires nothing outside its own folder and Node's standard library.
- **Self-contained modules.** Any reference text a module needs is authored in that module. `required_skills` names only `bmad` core; a `recommended_skills` entry for another of our modules carries its `source`, and the skill checks for it at run time and continues without it.
- **Names.** Owned skills use their family prefix (`ma-agent-`, `sre-`, `cyber-`, `devops-`, `sqa-`, `mil498-`, `ma-ops-`, `ma-standards-`, `ma-knowledge-`, `ma-atlassian-`, or the standards skill's own name) and are unique across the repository and the bundled upstream snapshot.
- **Status through the plan file.** A skill that changes a story's status does it through `bmad-build`'s `story-<slug>-plan.md`; it reads epics and stories through `tickets.py`.
- **One core commit.** Skills are tested against `bmadRef.core` only; an upstream rename or retirement is repointed in the same change.
- **Inputs from 3.x projects are read only by migrations.** 3.x project files (`sprint-status.yaml`, `project-layout.yaml`, `_bmad/bmm/config.yaml`, the 3.x override markers) are named only inside `migration-<n>.toml` files; a CI check enforces it.

**Installer rules (`ma-agents` 4.x):**
- Install only from verified bundle items or from sources the user named (`--source`); verify every item against `manifest.json` before using it.
- Set `UV_PYTHON`, `UV_FIND_LINKS`, `UV_OFFLINE=1` and `UV_NO_CACHE=1` for every `uv` call, and write the same settings to the scope's `uv.toml`. Spawn uv only through one runner module, always as `uv run --no-cache` with an argv array; a test fails on any other uv execution site.
- Drive setup through `setup.py --module-answers`; when that fails, print `bmad setup <code>` per module and exit non-zero.
- Write only the `ma-agents` marker block, `.ma-agents.json`, the runtime folder and the answers file.

**Anti-patterns:**
- A skill opening `_bmad/config.toml`, `_bmad/custom/*.toml` or another module's files instead of calling the resolver scripts.
- An owned skill named `bmad-*`.
- One of our modules in `required_skills`; a skill that fails because a recommended skill is absent.
- A script that loads code from another skill or from an npm package by path.
- A module writing outside its markers, or overwriting a user-set key.
- The installer writing `_bmad/custom/`, editing skill content, or touching the `ma-standards` block.
- Using a uv cache as the offline package source (`uv run --no-cache` ignores it).
- Network access during an install from the bundle or during a skill activation.
- A skill keeping its own ordering or status model beside `tickets.toml` and the plan files.
