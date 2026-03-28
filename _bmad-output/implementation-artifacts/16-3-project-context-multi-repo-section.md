# Story 16.3: Project-Context Multi-Repo Section

Status: ready-for-dev

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

- [ ] Task 1: Update project-context template (AC: #1, #2, #4)
  - [ ] 1.1 Open `lib/templates/project-context.template.md`
  - [ ] 1.2 Add `{{REPO_LAYOUT_SECTION}}` placeholder after the "Agent Mission Lifecycle" section and before "Technology Stack"
  - [ ] 1.3 When multi-repo: placeholder resolves to the full "Repository Layout" section wrapped in marker comments
  - [ ] 1.4 When single-repo: placeholder resolves to empty string
  - [ ] 1.5 Ensure the placeholder replacement doesn't leave double blank lines — replace `{{REPO_LAYOUT_SECTION}}\n\n` as a unit when empty

- [ ] Task 2: Implement Repository Layout section generator (AC: #1, #2, #5, #6)
  - [ ] 2.1 Create `generateRepoLayoutSection(layout)` function
  - [ ] 2.2 Guard: if `!layout?.knowledgebase || !layout?.sprintManagement` return `''`
  - [ ] 2.3 If both concerns are `same` mode: return `''` (section omitted)
  - [ ] 2.4 Normalize all paths: `.replace(/\\/g, '/')` before inserting into markdown
  - [ ] 2.5 Multi-repo output format (with markers):
    ```markdown
    <!-- ma-agents:repo-layout-start -->
    ### Repository Layout
    - **Knowledgebase:** /path/to/kb
    - **Sprint Management:** /path/to/sprint
    - When creating or reading planning artifacts, use the knowledgebase path
    - When creating or reading sprint/story artifacts, use the sprint management path
    <!-- ma-agents:repo-layout-end -->
    ```
  - [ ] 2.6 Mixed configuration: if one concern is `same`, show it as "current repository (default)" and only give path instructions for the external concern
  - [ ] 2.7 Example mixed output:
    ```markdown
    ### Repository Layout
    - **Knowledgebase:** /path/to/external/kb
    - **Sprint Management:** current repository (default)
    - When creating or reading planning artifacts, use the knowledgebase path
    ```

- [ ] Task 3: Integrate with project-context generator (AC: #1, #2, #4, #5)
  - [ ] 3.1 Open `lib/installer.js` and find `generateProjectContext(projectRoot, installedAgents)` function
  - [ ] 3.2 Add `layout` as a third parameter: `generateProjectContext(projectRoot, installedAgents, layout)`
  - [ ] 3.3 Call `generateRepoLayoutSection(layout)` to get section content
  - [ ] 3.4 Replace `{{REPO_LAYOUT_SECTION}}` placeholder with generated content or empty string
  - [ ] 3.5 Update ALL callers of `generateProjectContext()` to pass the layout parameter (or `null` for backward compatibility)

- [ ] Task 4: Implement marker-based update for existing files (AC: #3)
  - [ ] 4.1 Create `updateProjectContextRepoLayout(outputPath, layout)` function following the pattern of existing `updateProjectContextManifestPaths()`
  - [ ] 4.2 Read existing `_bmad-output/project-context.md`
  - [ ] 4.3 If markers `<!-- ma-agents:repo-layout-start -->` and `<!-- ma-agents:repo-layout-end -->` exist: replace content between them
  - [ ] 4.4 If markers don't exist AND multi-repo is configured: find the end of "AI Agent Mandatory Rules" section (before `## Technology Stack`) and insert the section with markers
  - [ ] 4.5 If markers don't exist AND single-repo: do nothing (no section needed)
  - [ ] 4.6 If file doesn't contain expected structure (heavily customized): log `chalk.blue('Could not auto-insert Repository Layout section — add manually or run /bmad-generate-project-context')` and skip
  - [ ] 4.7 Call this function from the installation pipeline when project-context.md already exists

- [ ] Task 5: Write/update unit tests (AC: #1-#6)
  - [ ] 5.1 Update existing tests in `test/generate-project-context.test.js` for new `layout` parameter
  - [ ] 5.2 Test `generateRepoLayoutSection()`: multi-repo returns section with markers, single-repo returns empty, null layout returns empty
  - [ ] 5.3 Test mixed config: one external + one same-repo
  - [ ] 5.4 Test path normalization: backslashes converted before markdown insertion
  - [ ] 5.5 Test marker-based update: existing markers updated, missing markers triggers insertion or warning
  - [ ] 5.6 Test backward compat: calling `generateProjectContext(root, agents)` without layout still works (no crash)
  - [ ] 5.7 Test no double blank lines when section is empty

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

### Debug Log References

### Completion Notes List

### File List
