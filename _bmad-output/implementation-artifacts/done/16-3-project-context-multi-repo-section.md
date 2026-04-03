# Story 16.3: Project-Context Multi-Repo Section

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an **AI agent**,
I want project-context.md to include the configured repository paths,
So that I know where to read and write planning and sprint artifacts.

## Acceptance Criteria

1. When multi-repo is configured with knowledgebase at `/path/to/kb` and sprint at `/path/to/sprint`, the generated project-context.md includes a "Repository Layout" section with both paths and usage instructions (FR118)
2. When single-repo mode is configured, the "Repository Layout" section is omitted entirely from project-context.md — no empty headers, no leftover blank lines (NFR34 backward compatibility)
3. When project-context.md already exists, the installer uses the **marker-based update pattern** (like the existing `ma-agents:manifest-paths` pattern) to insert or update the Repository Layout section between `<!-- ma-agents:repo-layout-start -->` and `<!-- ma-agents:repo-layout-end -->` markers. If markers don't exist yet, append the section with markers at the end of the "AI Agent Mandatory Rules" block. The file is NOT regenerated from scratch (preserves user customizations)
4. The `project-context.template.md` template is updated with a `{{REPO_LAYOUT_SECTION}}` placeholder that resolves to the section content (with markers) or empty string
5. When the layout config object is undefined or missing fields, the generator returns empty string (no crash)
6. All paths in the generated section use forward slashes (backslashes normalized before markdown insertion)

## Tasks / Subtasks

- [x] Task 1: Update project-context template (AC: #1, #2, #4)
  - [x] 1.1-1.5 Added `{{REPO_LAYOUT_SECTION}}` placeholder; clean removal for single-repo

- [x] Task 2: Implement Repository Layout section generator (AC: #1, #2, #5, #6)
  - [x] 2.1-2.7 `generateRepoLayoutSection(layout)` with guards, markers, mixed config, path normalization

- [x] Task 3: Integrate with project-context generator (AC: #1, #2, #4, #5)
  - [x] 3.1-3.5 Added `layout` parameter to `generateProjectContext()`, backward-compatible

- [x] Task 4: Implement marker-based update for existing files (AC: #3)
  - [x] 4.1-4.7 `updateProjectContextRepoLayout()` with marker update/insert, integrated into installWizard

- [x] Task 5: Write/update unit tests (AC: #1-#6)
  - [x] 5.1-5.7 12 new tests added to generate-project-context.test.js (27 total, all pass)

## Dev Notes

### CRITICAL: Marker-Based Update Pattern (Not "Never Modify")

The adversarial review correctly identified that the original AC ("never modify existing project-context.md") contradicts the codebase's established pattern. The existing `updateProjectContextManifestPaths()` function in `lib/installer.js` already modifies existing files using HTML comment markers:

```markdown
<!-- ma-agents:manifest-paths-start -->
  content here
<!-- ma-agents:manifest-paths-end -->
```

This story uses the SAME pattern with `<!-- ma-agents:repo-layout-start -->` / `<!-- ma-agents:repo-layout-end -->` markers. This allows:
- Fresh generation: placeholder replaced in template
- Existing files: content between markers updated in place
- User customizations outside markers: preserved

### Generator Function Location (Confirmed)

The generator function is `generateProjectContext()` in `lib/installer.js` (lines 143-200). It is an exported function with existing tests in `test/generate-project-context.test.js`. Adding the `layout` parameter changes the public API — tests MUST be updated.

### Template Section Format

```markdown
<!-- ma-agents:repo-layout-start -->
### Repository Layout
- **Knowledgebase:** {{KNOWLEDGEBASE_PATH}}
- **Sprint Management:** {{SPRINT_MANAGEMENT_PATH}}
- When creating or reading planning artifacts, use the knowledgebase path
- When creating or reading sprint/story artifacts, use the sprint management path
<!-- ma-agents:repo-layout-end -->
```

### Key Implementation Constraints

1. **Marker-based updates**: Use `<!-- ma-agents:repo-layout-start/end -->` markers — same pattern as manifest paths
2. **Clean omission**: When single-repo, no markers, no section, no blank lines — truly omitted
3. **Backward-compatible API**: `generateProjectContext(root, agents, layout)` — `layout` defaults to `null`, existing callers unaffected
4. **Normalize backslashes**: All paths get `.replace(/\\/g, '/')` before markdown insertion — backslashes break markdown rendering
5. **No new dependencies**: String template replacement, consistent with existing approach
6. **Template file**: `lib/templates/project-context.template.md` (confirmed)
7. **Existing test file**: `test/generate-project-context.test.js` — MUST be updated

### NFR Compliance

| NFR | How This Story Addresses It |
|-----|----------------------------|
| NFR34 | Single-repo: section omitted entirely — no visible change to existing project-context.md |
| NFR37 | Agents get explicit path instructions — no hardcoded `_bmad-output/` assumptions |

### Dependencies

- **Story 16.2** provides the config values that determine whether multi-repo is active
- **Epic 13** (project-context auto-generation) provides the template and generator function this story modifies

### Project Structure Notes

- Template file: `lib/templates/project-context.template.md`
- Generator function: `generateProjectContext()` in `lib/installer.js` (lines 143-200)
- Update function: `updateProjectContextManifestPaths()` in `lib/installer.js` — use as pattern reference
- Existing tests: `test/generate-project-context.test.js`
- Output: `_bmad-output/project-context.md`

### References

- [Source: _bmad-output/planning-artifacts/architecture.md — Decision P2-10, project-context integration, lines 884-895]
- [Source: _bmad-output/planning-artifacts/epics.md — Story 16.3, lines 2054-2085]
- [Source: _bmad-output/planning-artifacts/prd.md — FR118, line 583]
- [Source: _bmad-output/planning-artifacts/prd.md — NFR34, NFR37, lines 657-660]
- [Source: lib/installer.js — generateProjectContext(), updateProjectContextManifestPaths()]
- [Source: test/generate-project-context.test.js — existing tests to update]

## Dev Agent Record

### Agent Model Used
Claude Opus 4.6 (1M context)

### Debug Log References
None.

### Completion Notes List
- Added `{{REPO_LAYOUT_SECTION}}` placeholder to `lib/templates/project-context.template.md`
- Implemented `generateRepoLayoutSection(layout)` in `lib/installer.js` — generates markdown with markers for multi-repo, empty string for single-repo
- Updated `generateProjectContext()` to accept optional `layout` parameter (backward-compatible)
- Implemented `updateProjectContextRepoLayout()` for marker-based updates to existing project-context.md
- Integrated into `installWizard()` — calls `updateProjectContextRepoLayout()` after skill installation
- 12 new tests added to `test/generate-project-context.test.js`, all 27 pass

### Change Log
- 2026-03-28: Implemented story 16.3 — project-context multi-repo section

### File List
- lib/installer.js (modified — generateRepoLayoutSection, updateProjectContextRepoLayout, generateProjectContext layout param)
- lib/templates/project-context.template.md (modified — added REPO_LAYOUT_SECTION placeholder)
- bin/cli.js (modified — import updateProjectContextRepoLayout, call after skill install)
- test/generate-project-context.test.js (modified — 12 new tests)
- _bmad-output/implementation-artifacts/sprint-status.yaml (modified)
- _bmad-output/implementation-artifacts/16-3-project-context-multi-repo-section.md (modified)
