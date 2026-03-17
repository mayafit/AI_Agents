# Story 8.3: Create BMAD Extension Module Structure

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **Chief Architect**,
I want the installer to deploy a BMAD extension module (extends-module: bmm) with critical_actions for skill loading,
So that all BMAD agents automatically load skills on activation.

## Acceptance Criteria

1. **Given** `npx ma-agents install` runs with BMAD,
   **When** BMAD pipeline completes,
   **Then** `lib/bmad-extension/module.yaml` exists with `extends-module: bmm`,
   **And** `module-help.csv` exists,
   **And** `agents/` contains 11 `.customize.yaml` files

2. **Given** 4 custom agents (SRE, DevOps, Cyber, MIL-498),
   **When** `.customize.yaml` deployed,
   **Then** each has full customization: persona, menu, AND critical_actions steps 1-3

3. **Given** 7 built-in BMM agents (PM, Architect, Dev, QA, SM, Tech Writer, UX Designer),
   **When** `.customize.yaml` deployed,
   **Then** each has ONLY critical_actions steps 1-3 (no persona/menu overrides)

4. **Given** extension module deployed,
   **When** `npx bmad-method install --action update` runs,
   **Then** extension survives update (NFR16)

## Tasks / Subtasks

- [x] Task 0: Verify extension directory survives BMAD recompile (AC: #4) — DO FIRST
  - [x] 0.1: Create a test directory at `_bmad/extensions/test-probe/` with a dummy file
  - [x] 0.2: Run `npx bmad-method install --yes --modules bmm --tools none`
  - [x] 0.3: Check if `_bmad/extensions/test-probe/` still exists after recompile
  - [x] 0.4: If YES → proceed with extension module architecture as designed (Task 4.6 places deployment BEFORE workflows)
  - [x] 0.5: If NO → deploy extension AFTER recompile in `applyCustomizations()` (same pattern as workflows at bmad.js lines 128-133). Update Task 4.6 placement accordingly.
  - [x] 0.6: Document the result in Dev Agent Record for future reference

- [x] Task 1: Create `lib/bmad-extension/` directory structure (AC: #1)
  - [x] 1.1: Create directory `lib/bmad-extension/`
  - [x] 1.2: Create directory `lib/bmad-extension/agents/`
  - [x] 1.3: Create `lib/bmad-extension/module.yaml` with contents:
    ```yaml
    extends-module: bmm
    name: ma-agents-skills
    description: MA-Agents skill enforcement extension for BMM agents
    ```
  - [x] 1.4: Create `lib/bmad-extension/module-help.csv` — empty CSV with header row (or minimal content; this file must exist for BMAD extension compatibility)

- [x] Task 2: Create full `.customize.yaml` for 4 custom agents (AC: #2)
  - [x] 2.1: Create `lib/bmad-extension/agents/bmm-sre.customize.yaml` — migrate content from `lib/bmad-customizations/bmm-sre.customize.yaml` and append critical_actions block
  - [x] 2.2: Create `lib/bmad-extension/agents/bmm-devops.customize.yaml` — migrate content from `lib/bmad-customizations/bmm-devops.customize.yaml` and append critical_actions block
  - [x] 2.3: Create `lib/bmad-extension/agents/bmm-cyber.customize.yaml` — migrate content from `lib/bmad-customizations/bmm-cyber.customize.yaml` and append critical_actions block
  - [x] 2.4: Create `lib/bmad-extension/agents/bmm-mil498.customize.yaml` — migrate content from `lib/bmad-customizations/bmm-mil498.customize.yaml` and append critical_actions block
  - [x] 2.5: Each file must include a critical_actions block with the agent-specific MANIFEST path:
    ```yaml
    critical_actions:
      1: "Read the skills MANIFEST at {project-root}/_bmad/skills/<agent-slug>/MANIFEST.yaml"
      2: "For each skill marked always_load: true, read the skill file completely"
      3: "Follow all skill directives during this session"
    ```
    Where `<agent-slug>` is `sre`, `devops`, `cyber`, or `mil498` respectively per file. These match the `getProjectPath()` in agents.js.

- [x] Task 3: Create minimal `.customize.yaml` for 7 built-in agents (AC: #3)
  - [x] 3.1: Create `lib/bmad-extension/agents/bmm-pm.customize.yaml` with ONLY critical_actions
  - [x] 3.2: Create `lib/bmad-extension/agents/bmm-architect.customize.yaml` with ONLY critical_actions
  - [x] 3.3: Create `lib/bmad-extension/agents/bmm-dev.customize.yaml` with ONLY critical_actions
  - [x] 3.4: Create `lib/bmad-extension/agents/bmm-qa.customize.yaml` with ONLY critical_actions
  - [x] 3.5: Create `lib/bmad-extension/agents/bmm-sm.customize.yaml` with ONLY critical_actions
  - [x] 3.6: Create `lib/bmad-extension/agents/bmm-tech-writer.customize.yaml` with ONLY critical_actions
  - [x] 3.7: Create `lib/bmad-extension/agents/bmm-ux-designer.customize.yaml` with ONLY critical_actions
  - [x] 3.8: Each file contains only:
    ```yaml
    critical_actions:
      1: "Read the skills MANIFEST at skills/MANIFEST.yaml (relative to project root)"
      2: "For each skill marked always_load: true, read the skill file completely"
      3: "Follow all skill directives during this session"
    ```
    Note: Built-in BMM agents don't have per-agent skill directories. They use the project-level skills directory.

- [x] Task 4: Add extension deployment to `applyCustomizations()` in bmad.js (AC: #1, #4)
  - [x] 4.1: In `lib/bmad.js`, after the recompile step (line 126), add a new stage to deploy the extension module
  - [x] 4.2: Define extension source: `path.join(__dirname, 'bmad-extension')`
  - [x] 4.3: Define extension target: `path.join(projectRoot, BMAD_DIR, 'extensions', 'ma-agents-skills')`
  - [x] 4.4: Copy the entire `lib/bmad-extension/` directory to the target location using `fs.copy()`
  - [x] 4.5: Log: `chalk.cyan('    + Deployed BMAD extension module: ma-agents-skills')`
  - [x] 4.6: Place this deployment AFTER the recompile (stage 2, line 126) but before workflows (stage 3, line 128) — extensions survive recompile because they live in the `extensions/` directory, not in `bmm/`

- [x] Task 5: Migrate existing customizations into extension module (AC: #2)
  - [x] 5.1: The 4 custom agent `.customize.yaml` files in `lib/bmad-customizations/` (bmm-sre, bmm-devops, bmm-cyber, bmm-mil498) get migrated INTO `lib/bmad-extension/agents/` with critical_actions appended
  - [x] 5.2: KEEP the existing `.customize.yaml` files in `lib/bmad-customizations/` for the 4 custom agents. Do NOT remove them in this story — they provide backward compatibility during the transition. Removal deferred to a future cleanup story.
  - [x] 5.3: Do NOT change `applyCustomizations()` stage 1 (lines 76-91) in this story. Both paths coexist: old path deploys persona/menu to `_config/agents/`, extension module adds `critical_actions`. They are complementary, not duplicative.
  - [x] 5.4: The non-BMAD `.customize.yaml` files (claude-code, cline, cursor, gemini, antigravity, generic) remain in `lib/bmad-customizations/` — they are NOT part of the extension module

## Dev Notes

### Architecture Compliance

- **Extension module pattern:** The `extends-module: bmm` declaration tells BMAD this module extends BMM. Extensions in the `extensions/` directory survive BMAD `--action update` operations (NFR16)
- **No core modifications:** The extension adds to BMAD agents without modifying core BMM files (NFR17)
- **Module placement:** All extension files live in `lib/bmad-extension/` (shipped with the ma-agents npm package) and get deployed to `{projectRoot}/_bmad/extensions/ma-agents-skills/` at install time
- **Naming:** Agent filenames use kebab-case (`bmm-sre.customize.yaml`)

### Critical Guardrails

- Do NOT place extension files directly in `_bmad/bmm/` — they will be wiped on BMAD recompile
- Do NOT add persona/menu overrides to the 7 built-in agent customizations — only critical_actions
- Do NOT modify the 4 `.md` agent template files (sre.md, devops.md, cyber.md, mil498.md) — they stay in `lib/bmad-customizations/` and continue to be copied to `_bmad/custom/agents/` and `_bmad/bmm/agents/`
- The `{project-root}` token in critical_actions IS a verified BMAD convention — used extensively in workflow.yaml files and agent .md templates throughout the codebase. BMAD resolves it at runtime.
- Use `path.join()` for all path construction in bmad.js

### Project Structure Notes

- **New directory:** `lib/bmad-extension/` with `module.yaml`, `module-help.csv`, and `agents/` subdirectory
- **New files (14 total):**
  - `lib/bmad-extension/module.yaml`
  - `lib/bmad-extension/module-help.csv`
  - `lib/bmad-extension/agents/bmm-sre.customize.yaml`
  - `lib/bmad-extension/agents/bmm-devops.customize.yaml`
  - `lib/bmad-extension/agents/bmm-cyber.customize.yaml`
  - `lib/bmad-extension/agents/bmm-mil498.customize.yaml`
  - `lib/bmad-extension/agents/bmm-pm.customize.yaml`
  - `lib/bmad-extension/agents/bmm-architect.customize.yaml`
  - `lib/bmad-extension/agents/bmm-dev.customize.yaml`
  - `lib/bmad-extension/agents/bmm-qa.customize.yaml`
  - `lib/bmad-extension/agents/bmm-sm.customize.yaml`
  - `lib/bmad-extension/agents/bmm-tech-writer.customize.yaml`
  - `lib/bmad-extension/agents/bmm-ux-designer.customize.yaml`
- **File to modify:** `lib/bmad.js` — add extension deployment stage to `applyCustomizations()`
- **Existing files (reference):**
  - `lib/bmad-customizations/bmm-sre.customize.yaml` — source for migration
  - `lib/bmad-customizations/bmm-devops.customize.yaml` — source for migration
  - `lib/bmad-customizations/bmm-cyber.customize.yaml` — source for migration
  - `lib/bmad-customizations/bmm-mil498.customize.yaml` — source for migration

### Dependencies
- **Depends on:** Story 8.1 (injection logic) and Story 8.2 (registry metadata)
- **Recommended order:** 8.1 → 8.2 → 8.3

### References

- [Source: lib/bmad.js#L59-L164] — `applyCustomizations()` 6-stage pipeline
- [Source: lib/bmad-customizations/bmm-sre.customize.yaml] — Existing SRE customization (persona + menu)
- [Source: lib/bmad-customizations/bmm-cyber.customize.yaml] — Existing Cyber customization (persona + menu)

## Dev Agent Record

### Agent Model Used
Claude Opus 4.6 (1M context)

### Debug Log References
- Task 0 probe test: `_bmad/extensions/test-probe/` SURVIVED BMAD recompile — extensions/ directory is safe for deployment

### Completion Notes List
- Task 0: Verified `_bmad/extensions/` survives `npx bmad-method install` recompile. Proceeded with designed architecture (deployment before workflows).
- Task 1: Created `lib/bmad-extension/` with `module.yaml` (extends-module: bmm), `module-help.csv` (header row), and `agents/` subdirectory.
- Task 2: Created 4 custom agent `.customize.yaml` files with full persona + menu (migrated from `lib/bmad-customizations/`) plus `critical_actions` steps 1-3 with agent-specific MANIFEST paths.
- Task 3: Created 7 built-in agent `.customize.yaml` files with ONLY `critical_actions` steps 1-3 referencing project-level `skills/MANIFEST.yaml`.
- Task 4: Added extension deployment stage 3 to `applyCustomizations()` in `lib/bmad.js` — after recompile, before workflows. Uses `fs.copy()` and `path.join()`.
- Task 5: Migration complete — existing `lib/bmad-customizations/` files preserved for backward compatibility, non-BMAD files untouched, stage 1 unchanged.
- Tests: 22 new tests in `test/bmad-extension.test.js` covering all 4 ACs. All pass. Regression suite (instruction-injection: 24/24, agent-injection-strategy: 8/8) all pass. Pre-existing yes-flag.test.js failure (test 6.4) unrelated to this story.

### Change Log
- 2026-03-17: Story 8.3 implemented — BMAD extension module structure with 14 new files, bmad.js deployment stage, and 22 tests.

### File List
- lib/bmad-extension/module.yaml (new)
- lib/bmad-extension/module-help.csv (new)
- lib/bmad-extension/agents/bmm-sre.customize.yaml (new)
- lib/bmad-extension/agents/bmm-devops.customize.yaml (new)
- lib/bmad-extension/agents/bmm-cyber.customize.yaml (new)
- lib/bmad-extension/agents/bmm-mil498.customize.yaml (new)
- lib/bmad-extension/agents/bmm-pm.customize.yaml (new)
- lib/bmad-extension/agents/bmm-architect.customize.yaml (new)
- lib/bmad-extension/agents/bmm-dev.customize.yaml (new)
- lib/bmad-extension/agents/bmm-qa.customize.yaml (new)
- lib/bmad-extension/agents/bmm-sm.customize.yaml (new)
- lib/bmad-extension/agents/bmm-tech-writer.customize.yaml (new)
- lib/bmad-extension/agents/bmm-ux-designer.customize.yaml (new)
- lib/bmad.js (modified — added extension deployment stage 3)
- test/bmad-extension.test.js (new)
- _bmad-output/implementation-artifacts/sprint-status.yaml (modified — status update)
- _bmad-output/implementation-artifacts/8-3-create-bmad-extension-module.md (modified — task completion, dev record)
