# Story 4.2: Visual Studio Skill Template Format

Status: Cancelled

<!-- Cancelled 2026-06-20: Epic 4 (Visual Studio Agent Integration) closed with no implementation.
     Visual Studio agent support was de-scoped; this story is cancelled, not deferred. No code shipped. -->


<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->
<!-- Dependency: Story 4-1 must be completed first (research findings determine this story's implementation) -->

## Story

As an **engineer**,
I want skills to install correctly into Visual Studio with proper format translation,
So that my VS AI assistant receives the same methodology content as other agents.

## Acceptance Criteria

1. **Given** a skill with no VS-specific template exists
   **When** installed to the VS agent
   **Then** the `SKILL.md` fallback content is used (standard template resolution chain)
   **And** the content is valid for VS's expected format

2. **Given** VS requires a format different from standard markdown
   **When** a skill needs VS-specific content
   **Then** a `visual-studio.md` (or format-appropriate) template can be added to the skill
   **And** the template resolution chain picks it up automatically

3. **Given** skills are installed to both VS and other agents simultaneously
   **When** the install completes
   **Then** each agent receives the correct format (VS-specific or fallback)
   **And** the manifest tracks both installations independently

4. **Given** the VS agent has resource mapping rules
   **When** a skill with `references/` or `assets/` is installed
   **Then** supporting files are mapped to the correct VS directories per the resource map

## Tasks / Subtasks

- [ ] Task 1: Determine VS template requirements (AC: #1, #2)
  - [ ] 1.1: Based on Story 4-1 research, determine if VS needs a format different from standard markdown
  - [ ] 1.2: If VS uses markdown (like most agents): no template format work needed — SKILL.md fallback works
  - [ ] 1.3: If VS needs a different format: define the template transformation requirements
  - [ ] 1.4: Determine the template filename: likely `visual-studio.md` matching the agent registry key
- [ ] Task 2: Define resource mapping for VS (AC: #4)
  - [ ] 2.1: Based on Story 4-1 research, determine where VS expects supporting files (references/, assets/)
  - [ ] 2.2: **Only if VS uses non-standard directory names**: add `resourceMap` to the VS agent entry in `lib/agents.js`. Currently only `cline` has a resourceMap (maps `references` → `docs`, `assets` → `templates` at `agents.js:122-125`). Example:
    ```javascript
    resourceMap: {
      'references': 'docs',
      'assets': 'templates'
    }
    ```
  - [ ] 2.3: If VS uses standard directory names (`references/`, `assets/`), **omit `resourceMap` entirely** — do not set to null/empty (follow pattern of the other 10 agents that have no resourceMap)
- [ ] Task 3: Test template resolution for VS (AC: #1, #2, #3)
  - [ ] 3.1: Install a skill WITHOUT a VS template — verify SKILL.md fallback works
  - [ ] 3.2: If VS-specific template created: install a skill WITH a VS template — verify template is used
  - [ ] 3.3: Install skills to VS + another agent simultaneously — verify both get correct content
  - [ ] 3.4: Verify manifest tracks VS installations correctly
- [ ] Task 4: Create VS-specific templates for critical skills (AC: #2) — if needed
  - [ ] 4.1: If VS needs format-specific templates, create them for high-priority skills (e.g., `git-workflow-skill`, `code-documentation`)
  - [ ] 4.2: If VS uses standard markdown, this task is a no-op — SKILL.md fallback is sufficient

## Dev Notes

### Epic Scope Note

This story covers template format verification — a scope not in the original epics (which defined 4.2 as "Add Visual Studio Agent to Registry"). The registry addition is handled in Story 4-1. This story focuses on ensuring the template resolution chain works correctly for the VS agent.

### Architecture Compliance

- **Template resolution chain:** `templates/<agent-id>.md` -> `templates/generic.md` -> `SKILL.md`. The template filename must match the agent's `id` field in `agents.js` (e.g., if VS agent has `id: 'visual-studio'`, then template is `templates/visual-studio.md`). The `template` field on the agent config specifies which template to use as default (e.g., `template: 'generic'`). [Source: architecture.md#Extensibility-Model]
- **Adding a new agent target must not require changes to existing skills** (NFR11). The SKILL.md fallback ensures all existing skills work with VS out of the box.
- **Resource mapping** is optional per-agent in the registry. Only `cline` currently uses it. The installer reads resourceMap from agents.js if present and remaps directory names accordingly. [Source: architecture.md#Module-Boundaries, lib/agents.js:122-125]

### Dependency on Story 4-1

This story **cannot be implemented** until Story 4-1's research is complete. The research determines:
1. Whether VS needs a different format (markdown vs JSON vs other)
2. Where VS expects skill files (directory paths)
3. How resources (references, assets) are mapped
4. What the template filename should be

**If VS uses `.github/copilot-instructions.md`** (same as VS Code Copilot):
- This story is minimal — the existing `copilot` agent template format already works
- Resource mapping may already be defined in the `copilot` agent entry
- The main work is verifying the existing template chain works for VS

**If VS has a unique configuration mechanism:**
- Template format definition is needed
- Resource mapping must be researched and configured
- Some skills may need VS-specific templates

### Most Likely Scenario

VS Copilot likely shares the `.github/copilot-instructions.md` mechanism with VS Code. In this case:
- All existing skills work via SKILL.md fallback (no VS templates needed)
- Skills with `copilot.md` templates work for both VS and VS Code
- This story becomes primarily a verification/testing story

### Critical Guardrails

- **Do not modify existing skills** unless VS genuinely needs a different format [Source: NFR11]
- **Only modify `lib/agents.js`** for resource mapping updates [Source: architecture.md, NFR13]
- **Use `path.join()` for all paths** [Source: architecture.md#Enforcement-Guidelines]
- **No new npm dependencies** [Source: architecture.md#Anti-Patterns]

### Project Structure Notes

- Files to modify: `lib/agents.js` (resource map update for VS agent — may already be done in 4-1)
- Files to create: VS-specific templates in individual skills ONLY if research shows VS needs them
- No changes to installer logic, CLI, or BMAD modules

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Epic-4] — Story 4.2 definition
- [Source: _bmad-output/planning-artifacts/prd.md#IDE-Agent-Integration-Model] — Agent integration points table
- [Source: _bmad-output/planning-artifacts/architecture.md#Extensibility-Model] — Template resolution priority chain
- [Source: _bmad-output/planning-artifacts/architecture.md#Module-Boundaries] — agents.js resource mapping
- [Source: _bmad-output/planning-artifacts/prd.md#NFR11] — New agents don't require changes to existing skills
- [Source: lib/agents.js] — Agent registry with resource maps
- [Source: _bmad-output/implementation-artifacts/4-1-vs-agent-registry-entry.md] — Prerequisite story

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
