# Story 22.5: Plugin Manifests — `.claude-plugin/marketplace.json` and `skills/module.yaml`

Status: backlog

## Story

As a **BMAD installer**,
I want the ma-agents extension to ship as a BMAD-Builder-compliant plugin with the canonical manifest files,
So that I can resolve and install it via `--custom-source <local-path>` using the PluginResolver local-file strategy.

## Acceptance Criteria

1. **Given** `lib/bmad-extension/.claude-plugin/marketplace.json.template`, **When** I read it, **Then** it defines the marketplace manifest fields per BMAD Builder spec: plugin name, version (sourced from `package.json` or stamped at build time), description, author, modules array (with the ma-skills module entry pointing at `skills/module.yaml`), and any required compatibility fields (BMAD min version, target tools list).

2. **Given** the marketplace manifest content, **When** I read it, **Then** it is NOT Claude-specific — it includes a `compatible_tools` (or equivalent) array enumerating `claude-code, copilot, cline, roo-code, kilocode`, and a top-of-file comment documents that the wrapper filename `.claude-plugin/` is a shared BMAD convention (not a Claude-only binding) per BMAD Builder docs.

3. **Given** `lib/bmad-extension/skills/module.yaml`, **When** I read it, **Then** it contains: `code: ma-skills`, `description`, `module_version`, and any required v6.3.0 schema fields. The previous `lib/bmad-extension/module.yaml` location is removed (BMAD 6.2.2+ canonical location is `skills/module.yaml`).

4. **Given** Story 22.4's build script, **When** it runs, **Then** it reads the template + `skills/module.yaml` from source and emits `lib/bmad-extension-plugin/.claude-plugin/marketplace.json` and `lib/bmad-extension-plugin/skills/module.yaml` with the resolved content.

5. **Given** a clean scratch project and the bundled plugin, **When** I run `npx bmad-method install --custom-source <abs-path-to>/lib/bmad-extension-plugin --tools claude-code --yes --directory <scratch-dir>`, **Then** the install completes with exit code 0 and produces a `.claude/skills/` directory inside the scratch project containing the ma-agents skills (e.g., `.claude/skills/ma-agent-cyber/SKILL.md` exists).

6. **Given** the same scratch project setup, **When** I run the same command with `--tools copilot`, **Then** the install completes with exit code 0 and produces `.github/copilot/skills/` with the same skills (multi-tool parity smoke; full coverage in Story 22.10).

7. **Given** a release that ships a structural change to skills (skill added, removed, renamed, or its `bmad-skill-manifest.yaml` modified), **When** the release is cut, **Then** `module_version` in `skills/module.yaml` is bumped (semantic versioning at the maintainer's discretion: patch for fixes, minor for additive changes, major for breaks).

## Tasks / Subtasks

### Task 1: Research the canonical schema (AC: 1, 3)

- [ ] 1.1 Inspect upstream BMAD Builder examples for `.claude-plugin/marketplace.json` — capture the exact schema (required fields, optional fields, type expectations)
- [ ] 1.2 Inspect upstream BMAD module examples for `skills/module.yaml` v6.3.0 — capture the exact schema
- [ ] 1.3 Document both schemas in the story's Dev Notes for reviewer reference

### Task 2: Author the marketplace.json template (AC: 1, 2)

- [ ] 2.1 Create `lib/bmad-extension/.claude-plugin/marketplace.json.template` (or `.json` if no resolution is needed)
- [ ] 2.2 Populate fields:
  ```json
  {
    "_comment": "BMAD Builder convention: this filename is shared across skills-capable platforms, not Claude-specific. See https://bmad-builder-docs.bmad-method.org/explanation/",
    "name": "ma-agents",
    "version": "<sourced from package.json at build time>",
    "description": "ma-agents BMAD extension — enterprise SDLC personas (Yael, Amit, Alex, Demerzel, Gad) plus MIL-STD-498, SRE, DevOps, Cyber, ML, and SQA workflow skills",
    "author": "Alon Mayaffit",
    "compatible_tools": ["claude-code", "copilot", "cline", "roo-code", "kilocode"],
    "modules": [
      {
        "code": "ma-skills",
        "path": "skills/module.yaml"
      }
    ],
    "bmad_min_version": "6.3.0"
  }
  ```
  (Adjust field names to match the actual BMAD Builder schema captured in Task 1)
- [ ] 2.3 If versioning is templated (e.g., `${version}`), ensure Story 22.4's build script resolves it from `package.json`

### Task 3: Move and update module.yaml (AC: 3)

- [ ] 3.1 Move `lib/bmad-extension/module.yaml` → `lib/bmad-extension/skills/module.yaml`
- [ ] 3.2 Update content to match v6.3.0 schema:
  ```yaml
  code: ma-skills
  description: ma-agents extension module providing enterprise SDLC personas and workflows
  module_version: <semver>
  # any required v6.3.0 fields
  ```
- [ ] 3.3 Update Story 22.4's build script if it referenced the old `module.yaml` path

### Task 4: Update Story 22.4 build script integration (AC: 4)

- [ ] 4.1 In `scripts/build-plugin.js`:
  - Read `lib/bmad-extension/.claude-plugin/marketplace.json.template`
  - Resolve any template variables (e.g., `${version}` from `package.json`)
  - Write resolved content to `lib/bmad-extension-plugin/.claude-plugin/marketplace.json`
  - Copy `lib/bmad-extension/skills/module.yaml` to `lib/bmad-extension-plugin/skills/module.yaml`
- [ ] 4.2 Re-run `npm run build:plugin` and verify the output

### Task 5: Smoke-test against bmad-method install (AC: 5, 6)

- [ ] 5.1 Create a scratch project: `mkdir /tmp/scratch-claude && cd /tmp/scratch-claude && git init`
- [ ] 5.2 Run: `npx bmad-method install --custom-source $(realpath <ma-agents>/lib/bmad-extension-plugin) --tools claude-code --yes --directory .`
- [ ] 5.3 Verify exit code 0
- [ ] 5.4 Verify `.claude/skills/ma-agent-cyber/SKILL.md` exists
- [ ] 5.5 Repeat for `--tools copilot` against a separate scratch dir
- [ ] 5.6 Verify `.github/copilot/skills/ma-agent-cyber/SKILL.md` exists

### Task 6: Document the multi-tool convention (AC: 2)

- [ ] 6.1 In the marketplace.json template's top-level `_comment` field, link to the BMAD Builder docs that explicitly state the format works for any skills-capable platform
- [ ] 6.2 Add a paragraph to `README.md` (or `docs/`) explaining that ma-agents ships as a BMAD plugin and works with multiple coding-assistant tools

### Task 7: Establish version-bump convention (AC: 7)

- [ ] 7.1 Document the `module_version` bump policy in `CONTRIBUTING.md` (or equivalent):
  - Patch: bug fixes within existing skills
  - Minor: skill added, additive change
  - Major: skill removed, renamed, or breaking change to skill behavior
- [ ] 7.2 Add a release-checklist item: confirm `module_version` reflects the change since the prior release

## Dev Notes

### The `.claude-plugin/` filename is not a Claude binding

Per BMAD Builder docs (https://bmad-builder-docs.bmad-method.org/how-to/distribute-your-module/):
> "This format works for any skills-capable platform, not just Claude, we just utilize the claude file as a convention to support any skills based platform."

The filename was adopted from Anthropic's published plugin spec because it was the closest thing to an open standard. Multi-tool routing is handled by BMAD's own installer based on the `--tools` flag — content inside the plugin is tool-agnostic.

### v6.3.0 module location

BMAD 6.2.2 moved module definitions from `src/module.yaml` to `skills/module.yaml`. v6.3.0 keeps that location. Our move (Task 3) tracks upstream — there is no in-between location that works for both old and new.

### What this story does NOT do

- Does NOT modify `lib/bmad.js` (Story 22.6)
- Does NOT delete `applyCustomizations()` (Story 22.6)
- Does NOT add CI gates (Stories 22.9, 22.10)
- Does NOT update config read paths (Story 22.7)

This story produces the manifests; subsequent stories use them.

### Reference Files

- `lib/bmad-extension/.claude-plugin/marketplace.json.template` — created by this story
- `lib/bmad-extension/skills/module.yaml` — moved/created by this story
- `lib/bmad-extension/module.yaml` — removed by this story
- `scripts/build-plugin.js` — extended in Task 4
- BMAD Builder docs: https://bmad-builder-docs.bmad-method.org/explanation/
- Architecture: Decision P4-1, "Plugin manifests" subsection

### PRD Traceability

- **FR182:** Plugin packaging with `.claude-plugin/marketplace.json`
- **FR183:** `skills/module.yaml` location (BMAD 6.2.2+)
- **FR192:** Multi-tool coverage (smoke-tested here, fully covered in Story 22.10)

## Change Log

| Date | Version | Author | Description |
|------|---------|--------|-------------|
| 2026-04-13 | 1.0.0 | (pending) | Story drafted as part of Epic 22 |
