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

### Phase 5 v7 Module Patterns (2026-11-07, P5-11)

**All AI Agents Working on Epics 36–39 MUST:**
- **One config read path.** A carved skill reads configuration with one `uv run {project-root}/_bmad/scripts/resolve_config.py --key …` call per skill activation (`core.output_folder`, `modules.<code>.<key>`) and customization only through `resolve_customization.py` (FR288). Never open `_bmad/custom/config.toml` or a module file directly.
- **Every member skill carries a `bmod.toml` stub.** A `[skill]` table with `bmod = "<code>"`, `source = …`, `scripts = …`, matching its module record's `skills` list; `validate_manifests.py` must pass before a commit lands (FR285).
- **One version line.** All `bmod.toml` records in `ma-bmad-extensions` carry the same version; a change in any module bumps the shared version (NFR86).
- **Overrides are marker-delimited and keyed per target.** `ma-atlassian-bind` writes only inside its own markers in `_bmad/custom/<skill>.toml` and `ticketing-store-config.toml`; each entry is keyed by (skill, section, key, insertion slot); bind and unbind are idempotent; an existing user value produces a fail-loud collision report, never an overwrite; an absent target is reported, not failed (FR291).
- **`retired.toml` discipline.** Every rename or removal of an owned skill is recorded in the owning module's `retired.toml` in the same change; a retired name is never reused, ours or upstream's (FR287).
- **A `migration-<n>.toml` for every on-disk change.** Any user-visible change to files a release leaves on disk ships with a numbered migration that `bmad migrate` runs (FR294). No silent layout changes between releases.
- **PEP 723 headers on every Python script.** Each script declares its dependencies inline so the offline wheelhouse can be enumerated at build and `uv run --no-cache` resolves from the bundle (FR282). JavaScript scripts (the Confluence engine, Atlas) run with `node` and require nothing outside their skill.
- **Target the pinned SHA only.** Test against the upstream commit in `bmadRef` / `BMAD_TARGET_REF`; when upstream renames or retires a skill, repoint in the same change and never carry both names (FR271, FR280).
- **Dependencies point upstream only.** `required_skills` names only `bmad` core at the pin; `recommended_skills` may name upstream skills; a reference to a sibling module's skill is a fail-soft message in the skill body, never a manifest entry (P5-11.3).

**Phase 5 v7 Anti-Patterns:**
- Reading `_bmad/bmm/config.yaml`, `project-layout.yaml` or the removed v6 keys (`user_name`, `communication_language`, `document_output_language`, `planning_artifacts`, `implementation_artifacts`).
- Generated shared text rendered into several modules from one source — each module carries its own copy of any reference it needs.
- An owned skill named with the `bmad-` prefix.
- A sibling module in `required_skills` or `recommended_skills`.
- Any carved skill reading or writing `sprint-status.yaml`, or orchestrating `bmad-dev-story` / `bmad-create-story` / `bmad-sprint-planning` (none exist in v7).
- Relying on a pre-seeded uv cache offline (`--no-cache` ignores it) instead of the wheelhouse.

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
