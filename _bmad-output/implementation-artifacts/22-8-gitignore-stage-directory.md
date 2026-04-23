# Story 22.8: Gitignore the Plugin Stage Directory

Status: backlog

## Story

As a **developer using ma-agents**,
I want `.ma-agents-plugin-stage/` ignored by git automatically,
So that transient install artifacts never get committed accidentally.

## Acceptance Criteria

1. **Given** the ma-agents installer runs in a target project, **When** the install completes, **Then** the project's `.gitignore` contains the line `.ma-agents-plugin-stage/` (or `.ma-agents-plugin-stage` — both forms ignore the directory).

2. **Given** a target project with no existing `.gitignore`, **When** the installer runs, **Then** a `.gitignore` is created with the single entry.

3. **Given** a target project with an existing `.gitignore`, **When** the installer runs, **Then**:
   - All existing entries are preserved verbatim
   - The new entry is appended (or recognized as already present and skipped)
   - The file ends with a single trailing newline

4. **Given** the installer is run multiple times, **When** I read the resulting `.gitignore`, **Then** the `.ma-agents-plugin-stage/` entry appears exactly once — it is never duplicated.

5. **Given** the ma-agents repo itself, **When** I read its own `.gitignore`, **Then** `.ma-agents-plugin-stage/` is listed (so dev-local test installs in the repo don't accidentally commit the stage directory).

6. **Given** test coverage, **When** the test suite runs, **Then** a test verifies:
   - A scratch project with an existing `.gitignore` retains all original entries
   - The new entry is appended exactly once
   - Re-running the installer is a no-op for the `.gitignore`

## Tasks / Subtasks

### Task 1: Identify the existing gitignore-management code (AC: 3, 4)

- [ ] 1.1 Locate where the installer manages `.gitignore` for prior policies (FR58/FR59 — `_bmad-output` is intentionally NOT gitignored, which means there's likely an opposite pattern: ensure-NOT-present logic). Find that code.
- [ ] 1.2 If a generic gitignore-management helper exists (e.g., `ensureGitignoreEntry(line)` and `ensureGitignoreNotPresent(line)`), reuse the ensure-present helper for this story
- [ ] 1.3 If no generic helper exists, plan a small one in Task 2

### Task 2: Implement append-idempotent helper (AC: 1, 2, 3, 4)

- [ ] 2.1 Add (or reuse) a function:
  ```js
  function ensureGitignoreEntry(projectRoot, entry) {
    const gitignorePath = path.join(projectRoot, '.gitignore');
    let content = '';
    if (fs.existsSync(gitignorePath)) {
      content = fs.readFileSync(gitignorePath, 'utf8');
    }
    const lines = content.split('\n').map(l => l.trim());
    if (lines.includes(entry) || lines.includes(entry + '/')) {
      return; // already present
    }
    if (content && !content.endsWith('\n')) {
      content += '\n';
    }
    content += entry + '\n';
    fs.writeFileSync(gitignorePath, content, 'utf8');
  }
  ```
- [ ] 2.2 Call this from the installer's setup phase: `ensureGitignoreEntry(projectRoot, '.ma-agents-plugin-stage/')`

### Task 3: Update the ma-agents repo's own .gitignore (AC: 5)

- [ ] 3.1 Edit `.gitignore` in the ma-agents repo root — add `.ma-agents-plugin-stage/` if not already present
- [ ] 3.2 Commit

### Task 4: Test (AC: 6)

- [ ] 4.1 Add a test (e.g., `test/gitignore-stage-dir.test.js`) that:
  - Creates a scratch directory with a pre-populated `.gitignore` containing two arbitrary entries
  - Invokes the gitignore helper for `.ma-agents-plugin-stage/`
  - Asserts the original two entries are preserved verbatim
  - Asserts `.ma-agents-plugin-stage/` is appended
  - Invokes the helper a second time
  - Asserts the file is unchanged (no duplicate)
- [ ] 4.2 Add a test for the create-if-missing case (no `.gitignore` exists initially)
- [ ] 4.3 Run `npm test` and confirm both new tests pass

## Dev Notes

### Why this story is small

The work is mechanical — append a single line idempotently. The tiny scope makes it a perfect candidate for a parallel agent: it can land alongside Story 22.6 with no coordination cost.

### Reuse the existing gitignore-management pattern if present

FR58/FR59 already established that the installer manages `.gitignore` (specifically: it ensures `_bmad-output` is NOT listed, the opposite operation). Look for that code and follow the same idiom — both for code consistency and because there may already be a tested helper to extend.

### Why project-local stage path matters

NFR53 specifies the stage is project-local. That means it lives inside `<project>/.ma-agents-plugin-stage/`, which means git sees it. Without this story, every install run leaves a folder in the project tree that shows up in `git status`. Annoying at best, dangerous at worst (someone commits it).

### Reference Files

- `lib/installer.js` — likely home of gitignore-management code
- `.gitignore` (ma-agents repo root) — needs the entry
- `test/gitignore-stage-dir.test.js` — new test file

### PRD Traceability

- **NFR53:** Plugin stage directory not part of delivered installation; listed in installer-managed `.gitignore` to prevent accidental commit

## Change Log

| Date | Version | Author | Description |
|------|---------|--------|-------------|
| 2026-04-13 | 1.0.0 | (pending) | Story drafted as part of Epic 22 |
