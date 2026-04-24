# Story 22.5: Plugin Manifests — `.claude-plugin/marketplace.json` and `skills/module.yaml`

Status: review

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

- [x] 1.1 Inspect upstream BMAD Builder examples for `.claude-plugin/marketplace.json` — capture the exact schema (required fields, optional fields, type expectations)
- [x] 1.2 Inspect upstream BMAD module examples for `skills/module.yaml` v6.3.0 — capture the exact schema
- [x] 1.3 Document both schemas in the story's Dev Notes for reviewer reference

### Task 2: Author the marketplace.json template (AC: 1, 2)

- [x] 2.1 Create `lib/bmad-extension/.claude-plugin/marketplace.json.template` (or `.json` if no resolution is needed)
- [x] 2.2 Populate fields:
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
- [x] 2.3 If versioning is templated (e.g., `${version}`), ensure Story 22.4's build script resolves it from `package.json`

### Task 3: Move and update module.yaml (AC: 3)

- [x] 3.1 Move `lib/bmad-extension/module.yaml` → `lib/bmad-extension/skills/module.yaml`
- [x] 3.2 Update content to match v6.3.0 schema:
  ```yaml
  code: ma-skills
  description: ma-agents extension module providing enterprise SDLC personas and workflows
  module_version: <semver>
  # any required v6.3.0 fields
  ```
- [x] 3.3 Update Story 22.4's build script if it referenced the old `module.yaml` path

### Task 4: Update Story 22.4 build script integration (AC: 4)

- [x] 4.1 In `scripts/build-plugin.js`:
  - Read `lib/bmad-extension/.claude-plugin/marketplace.json.template`
  - Resolve any template variables (e.g., `${version}` from `package.json`)
  - Write resolved content to `lib/bmad-extension-plugin/.claude-plugin/marketplace.json`
  - Copy `lib/bmad-extension/skills/module.yaml` to `lib/bmad-extension-plugin/skills/module.yaml`
- [x] 4.2 Re-run `npm run build:plugin` and verify the output

### Task 5: Smoke-test against bmad-method install (AC: 5, 6)

- [x] 5.1 Create a scratch project: `mkdir /tmp/scratch-claude && cd /tmp/scratch-claude && git init`
- [x] 5.2 Run: `npx bmad-method install --custom-source $(realpath <ma-agents>/lib/bmad-extension-plugin) --tools claude-code --yes --directory .`
- [x] 5.3 Verify exit code 0
- [x] 5.4 Verify `.claude/skills/ma-agent-cyber/SKILL.md` exists
- [x] 5.5 Repeat for `--tools copilot` against a separate scratch dir
- [x] 5.6 Verify `.github/copilot/skills/ma-agent-cyber/SKILL.md` exists

### Task 6: Document the multi-tool convention (AC: 2)

- [x] 6.1 In the marketplace.json template's top-level `_comment` field, link to the BMAD Builder docs that explicitly state the format works for any skills-capable platform
- [x] 6.2 Add a paragraph to `README.md` (or `docs/`) explaining that ma-agents ships as a BMAD plugin and works with multiple coding-assistant tools

### Task 7: Establish version-bump convention (AC: 7)

- [x] 7.1 Document the `module_version` bump policy in `CONTRIBUTING.md` (or equivalent):
  - Patch: bug fixes within existing skills
  - Minor: skill added, additive change
  - Major: skill removed, renamed, or breaking change to skill behavior
- [x] 7.2 Add a release-checklist item: confirm `module_version` reflects the change since the prior release

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

### Edge-case-hunter triage (17 findings)

The `bmad-review-edge-case-hunter` skill surfaced 17 findings during Story 22.5
review. Triage outcomes:

**Applied as must-fix in commit `harden(plugin-manifests): address edge-case-hunter findings`:**

1. **Finding 1 — `parseSimpleYaml` fragility.** Replaced the hand-rolled line
   splitter in `test/plugin-manifests.test.js` with `js-yaml` (already a
   dependency). Multi-line strings and quoted colons no longer break the parser.
2. **Finding 2 — `bmad_min_version` drift vs. pinned `bmad-method`.** Added a
   test that fails if `bmad_min_version` > the pinned `bmad-method` dependency
   in `package.json`. Added a `_comment` line explaining that forward-compat
   assumes upstream stays additive; breaking upstream changes require a
   lock-step bump.
3. **Finding 3 — Both `module.yaml` files existing (half-done migration).**
   Added a guard test. The legacy `lib/bmad-extension/module.yaml` was removed
   in `adc4a79`; the test prevents regressions.
4. **Finding 4 — `extends-module: bmm` resolvability.** Added a test that
   asserts `node_modules/bmad-method/src/bmm-skills/module.yaml` exists. v6.3.0
   parks bmm at `src/bmm-skills/`, not `src/modules/bmm/` — the test comment
   flags this for adaptation if upstream moves it.
5. **Finding 5 — `SKILL.md` presence per listed skill.** Extended the drift
   test to assert `SKILL.md` exists in every skill dir listed in the template.
6. **Finding 9 — Non-empty `name` in `module.yaml`.** Simple assertion guarding
   against blank/missing name. Already satisfied by the current file.
7. **Finding 8 — `_comment` type guard.** Added an early failure with a clear
   message if `_comment` is neither array nor string.

**Deferred — documented here for traceability, not blocking 22.5 scope:**

- **Finding 2 (`${var}` placeholder handling)** — Story 22.4's concern. The
  build script owns token substitution; 22.5 only guarantees the placeholder
  survives until build time.
- **Finding 6 (duplicate skill basename across paths)** — speculative; the
  current duplicate-path test is sufficient because every skill lives under a
  single `skills/` root.
- **Finding 7 (`source: "./"` interpretation)** — **deferred to Story 22.4**,
  but the template now carries a top-level `_comment` line documenting the
  convention: `"./"` means "the directory containing `.claude-plugin/`" (i.e.
  the plugin output root). See hand-off notes below.
- **Findings 11, 13, 14, 15, 16, 17** — Not blocking for 22.5 scope. Rationale:
  these concern downstream consumers (11: marketplace registration flows; 13:
  installer CLI ergonomics; 14: plugin discovery semantics; 15: tool-specific
  post-install; 16: cross-plugin dependency declaration; 17: migration from
  pre-v6.3.0 layouts). None affect the artifacts this story produces.

**No-op:**

- **Finding 10** — Naturally addressed because `lib/bmad-extension/module.yaml`
  was already deleted in commit `adc4a79` (verified via filesystem check and
  the `legacy ... is removed` test).

### Hand-off notes for Story 22.4 (`scripts/build-plugin.js`)

Story 22.5's template encodes contracts that 22.4 must honor at build time:

1. **`plugins[].source: "./"` interpretation (edge-case-hunter finding 7).**
   A `source` of `"./"` resolves to the directory containing `.claude-plugin/`
   — i.e. the plugin output root (`lib/bmad-extension-plugin/`). Skill paths
   of the form `"./skills/<name>"` are relative to that same root. The
   build script must preserve this convention in the resolved manifest. This
   is now documented inside `marketplace.json.template`'s `_comment` field.
2. **`${version}` placeholder.** The template keeps `plugins[0].version` as the
   literal string `"${version}"`. Story 22.4's build script must substitute
   this from `package.json` at build time. A test in `plugin-manifests.test.js`
   asserts the placeholder stays intact in the source template until 22.4
   lands.
3. **`bmad_min_version` forward-compat.** The template floor (`6.3.0`) matches
   the current `package.json` pin. If 22.4 introduces multi-version cache
   support, the build script must NOT rewrite `bmad_min_version` to something
   the project cannot satisfy.
4. **Skill drift detection.** The `skills[]` list in the template is the
   canonical source of truth; the drift test asserts every on-disk skill
   directory appears in the list, and vice versa. If 22.4's build step
   generates additional skills (it should not), update the template first so
   the drift test stays green.

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
| 2026-04-23 | 1.1.0 | dev-agent | Implemented manifests + module.yaml move; triaged 17 edge-case-hunter findings (7 applied, 9 deferred with notes, 1 no-op). Status: backlog → review. |
