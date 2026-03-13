# Story 8.3: Create BMAD Extension Module Structure

Status: ready-for-dev

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

- [ ] Task 0: Verify extension directory survives BMAD recompile (AC: #4) — DO FIRST
  - [ ] 0.1: Create a test directory at `_bmad/extensions/test-probe/` with a dummy file
  - [ ] 0.2: Run `npx bmad-method install --yes --modules bmm --tools none`
  - [ ] 0.3: Check if `_bmad/extensions/test-probe/` still exists after recompile
  - [ ] 0.4: If YES → proceed with extension module architecture as designed (Task 4.6 places deployment BEFORE workflows)
  - [ ] 0.5: If NO → deploy extension AFTER recompile in `applyCustomizations()` (same pattern as workflows at bmad.js lines 128-133). Update Task 4.6 placement accordingly.
  - [ ] 0.6: Document the result in Dev Agent Record for future reference

- [ ] Task 1: Create `lib/bmad-extension/` directory structure (AC: #1)
  - [ ] 1.1: Create directory `lib/bmad-extension/`
  - [ ] 1.2: Create directory `lib/bmad-extension/agents/`
  - [ ] 1.3: Create `lib/bmad-extension/module.yaml` with contents:
    ```yaml
    extends-module: bmm
    name: ma-agents-skills
    description: MA-Agents skill enforcement extension for BMM agents
    ```
  - [ ] 1.4: Create `lib/bmad-extension/module-help.csv` — empty CSV with header row (or minimal content; this file must exist for BMAD extension compatibility)

- [ ] Task 2: Create full `.customize.yaml` for 4 custom agents (AC: #2)
  - [ ] 2.1: Create `lib/bmad-extension/agents/bmm-sre.customize.yaml` — migrate content from `lib/bmad-customizations/bmm-sre.customize.yaml` and append critical_actions block
  - [ ] 2.2: Create `lib/bmad-extension/agents/bmm-devops.customize.yaml` — migrate content from `lib/bmad-customizations/bmm-devops.customize.yaml` and append critical_actions block
  - [ ] 2.3: Create `lib/bmad-extension/agents/bmm-cyber.customize.yaml` — migrate content from `lib/bmad-customizations/bmm-cyber.customize.yaml` and append critical_actions block
  - [ ] 2.4: Create `lib/bmad-extension/agents/bmm-mil498.customize.yaml` — migrate content from `lib/bmad-customizations/bmm-mil498.customize.yaml` and append critical_actions block
  - [ ] 2.5: Each file must include a critical_actions block with the agent-specific MANIFEST path:
    ```yaml
    critical_actions:
      1: "Read the skills MANIFEST at {project-root}/_bmad/skills/<agent-slug>/MANIFEST.yaml"
      2: "For each skill marked always_load: true, read the skill file completely"
      3: "Follow all skill directives during this session"
    ```
    Where `<agent-slug>` is `sre`, `devops`, `cyber`, or `mil498` respectively per file. These match the `getProjectPath()` in agents.js.

- [ ] Task 3: Create minimal `.customize.yaml` for 7 built-in agents (AC: #3)
  - [ ] 3.1: Create `lib/bmad-extension/agents/bmm-pm.customize.yaml` with ONLY critical_actions
  - [ ] 3.2: Create `lib/bmad-extension/agents/bmm-architect.customize.yaml` with ONLY critical_actions
  - [ ] 3.3: Create `lib/bmad-extension/agents/bmm-dev.customize.yaml` with ONLY critical_actions
  - [ ] 3.4: Create `lib/bmad-extension/agents/bmm-qa.customize.yaml` with ONLY critical_actions
  - [ ] 3.5: Create `lib/bmad-extension/agents/bmm-sm.customize.yaml` with ONLY critical_actions
  - [ ] 3.6: Create `lib/bmad-extension/agents/bmm-tech-writer.customize.yaml` with ONLY critical_actions
  - [ ] 3.7: Create `lib/bmad-extension/agents/bmm-ux-designer.customize.yaml` with ONLY critical_actions
  - [ ] 3.8: Each file contains only:
    ```yaml
    critical_actions:
      1: "Read the skills MANIFEST at skills/MANIFEST.yaml (relative to project root)"
      2: "For each skill marked always_load: true, read the skill file completely"
      3: "Follow all skill directives during this session"
    ```
    Note: Built-in BMM agents don't have per-agent skill directories. They use the project-level skills directory.

- [ ] Task 4: Add extension deployment to `applyCustomizations()` in bmad.js (AC: #1, #4)
  - [ ] 4.1: In `lib/bmad.js`, after the recompile step (line 126), add a new stage to deploy the extension module
  - [ ] 4.2: Define extension source: `path.join(__dirname, 'bmad-extension')`
  - [ ] 4.3: Define extension target: `path.join(projectRoot, BMAD_DIR, 'extensions', 'ma-agents-skills')`
  - [ ] 4.4: Copy the entire `lib/bmad-extension/` directory to the target location using `fs.copy()`
  - [ ] 4.5: Log: `chalk.cyan('    + Deployed BMAD extension module: ma-agents-skills')`
  - [ ] 4.6: Place this deployment AFTER the recompile (stage 2, line 126) but before workflows (stage 3, line 128) — extensions survive recompile because they live in the `extensions/` directory, not in `bmm/`

- [ ] Task 5: Migrate existing customizations into extension module (AC: #2)
  - [ ] 5.1: The 4 custom agent `.customize.yaml` files in `lib/bmad-customizations/` (bmm-sre, bmm-devops, bmm-cyber, bmm-mil498) get migrated INTO `lib/bmad-extension/agents/` with critical_actions appended
  - [ ] 5.2: KEEP the existing `.customize.yaml` files in `lib/bmad-customizations/` for the 4 custom agents. Do NOT remove them in this story — they provide backward compatibility during the transition. Removal deferred to a future cleanup story.
  - [ ] 5.3: Do NOT change `applyCustomizations()` stage 1 (lines 76-91) in this story. Both paths coexist: old path deploys persona/menu to `_config/agents/`, extension module adds `critical_actions`. They are complementary, not duplicative.
  - [ ] 5.4: The non-BMAD `.customize.yaml` files (claude-code, cline, cursor, gemini, antigravity, generic) remain in `lib/bmad-customizations/` — they are NOT part of the extension module

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

### Debug Log References

### Completion Notes List

### File List
