# Story 13.1: Create Project-Context Template and Generator Function

Status: done

## Story

As a **Chief Architect**,
I want a standalone project-context template and a `generateProjectContext()` function in the installer,
So that a constitutional document can be generated with correct platform-specific content at install time.

## Acceptance Criteria

1. `lib/templates/project-context.template.md` exists as a standalone file (not an inline string in code) containing all mandatory rule sections (NFR24)
2. The template contains a `## AI Agent Mandatory Rules` section with:
   - Pre-task rules: read MANIFEST.yaml (`{{MANIFEST_PATHS_LIST}}` placeholder), load all `always_load: true` skills, select task-relevant skills (FR80)
   - Git workflow rules: create fresh worktree per mission (not just a branch), all work in worktree, conventional commits, PR to main, worktree cleanup post-merge (FR80)
   - Full 8-step mission lifecycle documented in sequence (FR83)
3. The template contains `{{MANIFEST_PATHS_LIST}}` exactly once — no hardcoded platform paths anywhere in the template source (NFR22)
4. The template contains the machine-readable version comment `<!-- ma-agents-template-version: 1.0 -->` on line 2 (NFR25)
5. The template contains inline expansion comments referencing `bmad-generate-project-context`, `bmad-retrospective`, and manual additions (FR85)
6. The template contains empty `## Technology Stack` and `## Project-Specific Rules` placeholder sections with TODO comments
7. `generateProjectContext(projectRoot, installedAgents)` is implemented in `installer.js` — `installedAgents` receives ALL agents from the project manifest, not just those installed in the current run
8. The function reads the template from `TEMPLATE_PATH` constant (resolved via `path.join(__dirname, 'templates', 'project-context.template.md')`, not hardcoded inline)
9. The function resolves relative MANIFEST.yaml paths for each agent: `agent.skillsDir + '/MANIFEST.yaml'` — relative to project root, no `path.resolve()` or absolute prefixes (NFR22 for generated output)
10. The function replaces `{{MANIFEST_PATHS_LIST}}` with a markdown bullet list: one `  - \`<path>\`` line per agent (FR81, FR82)
11. The function returns the stamped content string — it does NOT write any file (writing is Story 13.2's responsibility)
12. When `installedAgents` is empty, `{{MANIFEST_PATHS_LIST}}` is replaced with `  - (no agents installed — run ma-agents to install skills)`
13. When the template file cannot be read (missing, permission error), the function throws an `Error` with message including the template path and the underlying cause — it never swallows errors silently
14. With one installed platform, the returned content contains exactly one MANIFEST path entry (FR81)
15. With multiple installed platforms, the returned content contains one entry per platform in the order they appear in the manifest (FR82)

## Tasks / Subtasks

- [x] Task 1: Create `lib/templates/` directory and template file (AC: #1-#4)
  - [x] 1.1 Create `lib/templates/` directory in the project
  - [x] 1.2 Create `lib/templates/project-context.template.md` with the full template structure (see Dev Notes for exact content)
  - [x] 1.3 Verify template contains `{{MANIFEST_PATHS_LIST}}` placeholder
  - [x] 1.4 Verify template contains all three mandatory rule sections: pre-task, git workflow, mission lifecycle
  - [x] 1.5 Verify template contains expansion guidance comments
  - [x] 1.6 Verify template contains empty Technology Stack and Project-Specific Rules sections

- [x] Task 2: Implement `generateProjectContext()` in `installer.js` (AC: #5-#9)
  - [x] 2.1 Add `TEMPLATE_PATH` constant near top of `installer.js`: `const TEMPLATE_PATH = path.join(__dirname, 'templates', 'project-context.template.md')`
  - [x] 2.2 Implement `async function generateProjectContext(projectRoot, installedAgents)`:
    - [x] 2.2.1 Read template file with `await fs.readFile(TEMPLATE_PATH, 'utf8')`
    - [x] 2.2.2 Map `installedAgents` to manifest paths: `agent.skillsDir + '/MANIFEST.yaml'` (relative paths — no `path.join(projectRoot, ...)`)
    - [x] 2.2.3 Format paths as markdown list: `  - \`${path}\``
    - [x] 2.2.4 Replace `{{MANIFEST_PATHS_LIST}}` in template with formatted list
    - [x] 2.2.5 Return stamped content string
  - [x] 2.3 Wrap `fs.readFile` in try/catch — if template file missing, throw clear error: `"project-context template not found at ${TEMPLATE_PATH} — ma-agents installation may be corrupted"`

- [x] Task 3: Unit tests (AC: all)
  - [x] 3.1 Test: single platform → one MANIFEST path in output (AC: #14)
  - [x] 3.2 Test: multiple platforms → correct count of paths in manifest order (AC: #15)
  - [x] 3.3 Test: all relative paths — no absolute path segments in output (AC: #9)
  - [x] 3.4 Test: `{{MANIFEST_PATHS_LIST}}` placeholder fully replaced — not present in output (AC: #10)
  - [x] 3.5 Test: empty agents array → fallback message appears, no error thrown (AC: #12)
  - [x] 3.6 Test: missing template file → Error thrown with path in message (AC: #13)
  - [x] 3.7 Test: template version comment present in output (AC: #4, NFR25)
  - [x] 3.8 Test: function does NOT call fs.writeFile or fs.pathExists (AC: #11 — pure content generator)

## Dev Notes

### Template File Content

`lib/templates/project-context.template.md` should contain:

```markdown
# Project Context
<!-- Generated by ma-agents at install time — this is a living document -->
<!--
  EXPAND THIS FILE over time:
  - After architecture phase: run /bmad-generate-project-context
  - After each sprint:        run /bmad-retrospective (includes context update step)
  - Manually:                 add conventions you notice agents getting wrong
-->

## AI Agent Mandatory Rules

### Pre-Task (EVERY task, no exceptions)

1. Read the MANIFEST.yaml for your platform:
{{MANIFEST_PATHS_LIST}}
2. Load ALL skills marked `always_load: true` completely before doing anything
3. Select additional skills relevant to the specific task type

### Git Workflow (ALL file-changing tasks)

1. Create a fresh worktree: `git worktree add ../<project>-<branch> -b <branch>`
2. ALL work happens inside that worktree — never in the main working tree
3. Use conventional commits: `feat/fix/chore/docs/refactor`
4. Open a PR to main — never commit directly to main, never auto-merge
5. After human approval and merge: `git worktree remove ../<project>-<branch>`

### Agent Mission Lifecycle

1. **Pre-flight:** Read MANIFEST.yaml, load always_load skills, select task skills
2. **Worktree:** `git worktree add` creates fresh, isolated working surface
3. **Implementation:** Execute task within the worktree
4. **Self-review:** Run `code-review` skill on own output before opening PR
5. **PR:** Conventional commit + PR opened — clear title and description
6. **Human review gate:** Await approval — do NOT auto-merge under any circumstance
7. **Merge + cleanup:** After approval: merge, `git worktree remove`, delete branch
8. **Post-mission:** Update story status to done, append session to AiAudit.md

## Technology Stack
<!-- TODO: Populated after architecture phase via /bmad-generate-project-context -->
<!-- Run: /bmad-generate-project-context to auto-detect your stack -->

## Project-Specific Rules
<!-- TODO: Grows through retrospectives and manual additions -->
<!-- Run: /bmad-retrospective after each sprint to surface new conventions -->
```

### Architecture Compliance

- **Decision P2-7** (Project Context Auto-Generation): This story implements the template creation and generator function. Story 13.2 handles pipeline integration (writing the file).
- **NFR22** (Relative paths only): `agent.skillsDir` values in the agent registry are already relative project paths (e.g., `.claude/skills`). Appending `/MANIFEST.yaml` keeps them relative. Do NOT resolve to absolute paths.
- **NFR24** (Template as separate file): The template MUST be a file in `lib/templates/`, not a template literal in installer.js code.

### Source Tree Components to Touch

| File | Change |
|------|--------|
| `lib/templates/project-context.template.md` | CREATE — new template file |
| `lib/installer.js` | ADD — `TEMPLATE_PATH` constant + `generateProjectContext()` function |

### Agent Registry `skillsDir` Values

From `lib/agents.js`, the relevant `skillsDir` values for path resolution:
- Claude Code: `.claude/skills`
- Cursor: `.cursor/skills`
- Cline: `.cline/skills`
- Copilot: `.github/copilot/skills`
- Gemini: `.gemini/skills`
- Kilocode: `.kilocode/skills`
- OpenCode: `.opencode/skills`
- Antigravity: `.antigravity/skills`

Verify actual values by reading `lib/agents.js` before implementation.

### Testing Standards

Epic 7 test suite is not yet complete. Manual verification is acceptable. If tests/installer.test.js exists, add unit tests there. Otherwise document manual test steps.

### Epic 13 Cross-Story Context

**Story 13.1** (this): Create template file and generator function — returns stamped content string
**Story 13.2**: Call `generateProjectContext()` in install pipeline, handle file write + idempotency
**Story 13.3**: Update all 11 BMAD agent `critical_actions` to load project-context.md
**Story 13.4**: Add expansion trigger to retrospective workflow

## Dev Agent Record

### Agent Model Used
claude-sonnet-4-6

### Debug Log References
- Test 3.1/3.2 initially failed: template itself contains "MANIFEST.yaml" in header text. Fixed test helper to count only backtick-wrapped path entries (`/MANIFEST.yaml`) not all occurrences of "MANIFEST.yaml".
- Tests 3.6 and 3.8 raced when Promise.all ran them in parallel (3.6 temporarily renames template file). Fixed by running tests sequentially with async/await instead of Promise.all over parallel promises.
- `skillsDir` property added to all agent definitions in `lib/agents.js` (not in original source tree spec) — required for `agent.skillsDir + '/MANIFEST.yaml'` pattern. All relative paths derived from agent definitions match the Dev Notes table.

### Completion Notes List
- `lib/templates/project-context.template.md` created with all mandatory rule sections, version comment on line 2, `{{MANIFEST_PATHS_LIST}}` placeholder (exactly once), expansion guidance comments, and empty Technology Stack / Project-Specific Rules sections.
- `TEMPLATE_PATH` constant added near top of `lib/installer.js`.
- `generateProjectContext(projectRoot, installedAgents)` implemented: reads template, maps agents to relative MANIFEST paths via `agent.skillsDir`, replaces placeholder, returns content string. Throws descriptive Error on missing template.
- `skillsDir` property added to all 12 agent definitions in `lib/agents.js` for clean relative-path access.
- `generateProjectContext` and `_TEMPLATE_PATH` exported from `lib/installer.js`.
- 9 unit tests written in `test/generate-project-context.test.js` covering all 8 ACs. All pass. Full regression suite (84 tests) passes with no regressions.

### File List
- `lib/templates/project-context.template.md` — CREATED
- `lib/installer.js` — MODIFIED (TEMPLATE_PATH constant, generateProjectContext function, exports)
- `lib/agents.js` — MODIFIED (skillsDir property added to all 12 agent definitions)
- `test/generate-project-context.test.js` — CREATED

## Change Log
- 2026-03-19: Story created (Epic 13, Story 13.1)
- 2026-03-20: Story implemented — template file created, generateProjectContext() implemented, 9 unit tests passing, no regressions
