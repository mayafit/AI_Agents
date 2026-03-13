# Story 6.1: Bundle Methodology Presentation with Installation

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **team lead**,
I want the BMAD-METHOD presentation included when ma-agents is installed,
So that new team members can learn the methodology without needing separate training materials.

## Acceptance Criteria

1. **Given** a methodology presentation file exists in the ma-agents package
   **When** `npx ma-agents install` is run with BMAD installation
   **Then** the presentation is copied to the project's BMAD output directory (e.g., `_bmad-output/methodology/`)
   **And** the user is informed of the presentation location in the install summary

2. **Given** the presentation already exists in the target directory
   **When** a subsequent install or update is run
   **Then** the presentation is updated only if a newer version exists
   **And** existing copies are not overwritten without the `--force` flag
   **Note:** `--force` semantics are consistent with existing usage — `--force` means "overwrite/force operations" across the codebase (see Epic 1 Story 1.1: `--yes` skips prompts, `--force` forces overwrites). CI/CD pipelines using `--force` will intentionally get the latest methodology content.

3. **Given** BMAD is NOT installed (user only installed skills)
   **When** the install completes
   **Then** the methodology presentation is NOT copied (it's part of the BMAD bundle, not standalone skills)

4. **Given** the methodology content is bundled
   **When** the npm package is published
   **Then** the presentation files are included in the package (listed in `package.json` `files` or not excluded by `.npmignore`)
   **And** the package size increase is documented

5. **Given** ma-agents is upgraded to a newer version with updated methodology content
   **When** the user runs `npx ma-agents install` with BMAD (or `--action update`)
   **Then** the methodology version check from AC #2 applies — newer content is deployed, same-version content is skipped
   **And** this uses the same code path as the initial install (no separate update mechanism needed)

## Tasks / Subtasks

- [ ] Task 1: Create methodology presentation content (AC: #1)
  - [ ] 1.1: Author methodology presentation in `lib/methodology/` directory (markdown or PDF format)
  - [ ] 1.2: Include sections: What is BMAD-METHOD, SDLC phases covered, agent personas available, skill system overview, getting started guide
  - [ ] 1.2a: Content source: derive from existing README.md, QUICK_START.md, and BMAD-METHOD documentation. This is a compilation/curation task, not original authoring
  - [ ] 1.2b: Content review: Chief Architect (Alon) reviews and approves methodology content before merge. This is NOT a developer-authored document — the developer compiles from existing sources, Alon validates accuracy
  - [ ] 1.3: Add a `version.json` or version marker in the methodology directory for version comparison (AC: #2)
- [ ] Task 2: Add methodology deployment to BMAD install pipeline (AC: #1, #3)
  - [ ] 2.1: In `lib/bmad.js`, add methodology copy step during BMAD installation (after the main BMAD install completes)
  - [ ] 2.2: Copy `lib/methodology/` contents to `_bmad-output/methodology/` in the target project
  - [ ] 2.3: Use `fs-extra` `fs.copy()` consistent with existing BMAD content deployment patterns (see `bmad.js` lines 86, 102, 131, 138)
  - [ ] 2.4: Add install summary message: `chalk.green('Methodology presentation available at: _bmad-output/methodology/')`
  - [ ] 2.5: Only execute this step when BMAD installation is requested (not for skill-only installs)
- [ ] Task 3: Implement version-aware updates (AC: #2)
  - [ ] 3.1: On subsequent installs, compare version marker in source vs target
  - [ ] 3.2: If target version is same or newer, skip copy (print: "Methodology presentation is up to date")
  - [ ] 3.3: If target version is older, copy only if `--force` flag is present OR prompt user
  - [ ] 3.4: Follow the additive-only install pattern — never delete existing methodology files (NFR5)
- [ ] Task 4: Package inclusion (AC: #4)
  - [ ] 4.1: Verify `lib/methodology/` is included in npm package (check `package.json` files field or `.npmignore`)
  - [ ] 4.2: Measure package size increase and document it
  - [ ] 4.3: If presentation includes large files (PDF, images), consider compression or markdown-only format to minimize package size

## Dev Notes

### Architecture Compliance

- **BMAD pipeline extension:** Methodology deployment is a new step in the BMAD install pipeline. It should execute AFTER the existing 6-stage BMAD pipeline completes, not interrupt it. [Source: architecture.md#Pipeline-Architecture]
- **Additive-only:** Follow NFR5 — never remove existing files during install. Version comparison prevents unwanted overwrites. [Source: architecture.md#Error-Handling]
- **BMAD-conditional:** Only deploy when BMAD installation is requested. The `installBmad()` function in `bmad.js:13` is the entry point. [Source: lib/bmad.js:13]

### Existing BMAD Content Deployment Pattern

The `bmad.js` module already deploys content to target projects using `fs-extra`:

```javascript
// From bmad.js — existing pattern for copying content:
await fs.copy(path.join(sourceDir, file), path.join(configTargetDir, file));  // line 86
await fs.copy(workflowSourceDir, workflowTargetDir);  // line 131
await fs.copy(templateSourceDir, templateTargetDir);  // line 138
```

Follow this exact pattern for methodology deployment. The `fs-extra` dependency is already available.

### Methodology Content Format Decision

**Recommended: Markdown-only** — aligns with the project's plain-text philosophy:
- Small package size impact (~50-100KB for comprehensive markdown)
- Renders well in any editor or GitHub
- Can be converted to PDF/slides by the user if needed
- No binary files to manage

**Alternative: PDF** — better for formal presentation:
- Larger package size impact (~1-5MB per presentation)
- Not editable, less version-friendly
- Better visual presentation for team meetings

### `_bmad-output/methodology/` Target Directory

The `_bmad-output/` directory is version-controlled project knowledge (per architecture F3 decision — not gitignored). The methodology presentation becomes part of the project's knowledge base, committed alongside planning artifacts and implementation artifacts.

### Console Output Pattern

Follow existing console output conventions from `bmad.js`:
```
  ✓ Methodology presentation installed to _bmad-output/methodology/
  Hint: Share this with your team for BMAD-METHOD onboarding
```

Or if up to date:
```
  ✓ Methodology presentation is up to date (v1.0.0)
```

### Sprint Status Note: Story 6.2 Not in Sprint

Epic 6 Story 6.2 (Add Methodology Overview Command — `npx ma-agents methodology`) exists in the epics file but was not included in sprint planning. If 6-1 is completed, 6-2 can be added via correct-course if desired.

### Phase 2 Dependencies (Cross-Reference)

- **Epic 8 (BMAD extension module):** Story 6.1 modifies `lib/bmad.js`. Phase 2 also modifies `bmad.js` for extension module deployment. If Epic 8 ships first, the methodology deployment step must be added after the extension deployment step. Coordinate insertion point.
- **Content directory:** Methodology lives in `lib/methodology/` which is separate from `lib/bmad-extension/`. No conflict, but both are deployed by `bmad.js`.

### Critical Guardrails

- **Do NOT modify the BMAD 6-stage pipeline order** — methodology deployment is a post-pipeline step [Source: architecture.md#Pipeline-Architecture]
- **Only modify `lib/bmad.js`** for deployment logic [Source: architecture.md#Module-Boundaries]
- **Use `fs-extra` `fs.copy()`** — already a project dependency, no new deps needed [Source: package.json:31]
- **Use `path.join()` for all paths** [Source: architecture.md#Enforcement-Guidelines]
- **No new npm dependencies** [Source: architecture.md#Anti-Patterns]

### Project Structure Notes

- Files to create: `lib/methodology/` directory with presentation content
- Files to modify: `lib/bmad.js` (add methodology deployment step after BMAD install)
- No changes to `installer.js`, `agents.js`, or `cli.js`

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Epic-6] — Story 6.1 and 6.2 definitions
- [Source: _bmad-output/planning-artifacts/architecture.md#Pipeline-Architecture] — BMAD 6-stage pipeline
- [Source: _bmad-output/planning-artifacts/architecture.md#Anti-Patterns] — No new dependencies
- [Source: lib/bmad.js] — BMAD install pipeline, existing fs.copy patterns
- [Source: package.json] — fs-extra dependency, package configuration

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
