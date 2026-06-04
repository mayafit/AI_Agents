---
type: bug
severity: high
status: done
title: .clinerules incorrectly created as a file instead of a directory in Cline installs
---

# Bug 25.4: `.clinerules` incorrectly created as a file instead of a directory in Cline installs

**Severity:** high
**Status:** done
**Parent Story:** [Story 25.3 — Cline Workflow Generation](25-3-cline-workflow-generation.md)
**Affected Component:** Cline install pipeline — `lib/agents.js`, `lib/installer.js`, `lib/bmad.js`

## Summary

Cline's official documentation states that `.clinerules` must be a **directory**. ma-agents was
writing it as a flat file (the instruction injection target), which:

1. Conflicts with Cline's expected directory structure
2. Duplicated content already stored in `.cline/clinerules.md` (single source of truth)
3. Caused `deployClineWorkflows` (Story 25.3) to fail with `ENOTDIR` when attempting to create
   `.clinerules/workflows/` inside what the filesystem believed was a regular file

This bug was discovered during testing of Story 25.3.

## Root Cause

Cline docs were misread during Epic 21 Story 21.5 (Expanded `.clinerules` Template). The instruction
injection target was implemented as a duplicate flat file at `.clinerules` rather than as a directory.
The actual single source for Cline instruction content is `.cline/clinerules.md`; `.clinerules` must
remain a directory so Cline can discover workflow slash-command wrappers inside it.

## Reproduction Steps

1. Install ma-agents with `cline` selected as a tool into a fresh project directory.
2. Observe that `.clinerules` is created as a **file** (containing the instruction block).
3. Attempt to run a BMAD update or migration — `deployClineWorkflows` tries to create
   `.clinerules/workflows/` and throws `ENOTDIR`.

## Expected Behavior

After a Cline install, the project directory structure is:

```
.cline/
  ├── clinerules.md     ← instruction block (single source of truth)
  └── skills/           ← BMAD skill packages
.clinerules/            ← DIRECTORY (not a file)
  └── workflows/        ← BMAD slash-command wrappers
```

`.clinerules` is a directory. `.cline/clinerules.md` is the sole instruction file.

## Actual Behavior

`.clinerules` was created as a **file** whose content duplicated `.cline/clinerules.md`.
`deployClineWorkflows` (Story 25.3) threw `ENOTDIR` when trying to `fs.ensureDir` a subdirectory
inside it.

## Acceptance Criteria

1. **Given** a fresh Cline install completes, **When** the filesystem is inspected, **Then**
   `.clinerules` is a directory (not a file).

2. **Given** `.clinerules` previously existed as a legacy file (pre-fix install), **When** an
   update or migration runs, **Then** the file is deleted, `.clinerules/` is created as a directory,
   and `deployClineWorkflows` succeeds without `ENOTDIR`.

3. **Given** a Cline install with BMAD enabled, **When** the install completes, **Then**
   `.cline/clinerules.md` is the single source of Cline instruction content — no instruction
   content is written to `.clinerules` directly.

4. **Given** `deployClineWorkflows` runs after the fix, **When** it creates workflow wrappers,
   **Then** `.clinerules/workflows/<skill-name>.md` files are created successfully with no
   filesystem errors.

5. **Given** `.clinerules` is already a properly-formed directory, **When** `checkClinerulesDualFileDrift`
   is called, **Then** it returns early without error (no false drift detection).

## Fix Applied

### `lib/agents.js`

Removed `.clinerules` from the Cline agent's `instructionFiles` array:

```js
// Before
instructionFiles: ['.cline/clinerules.md', '.clinerules']

// After
instructionFiles: ['.cline/clinerules.md']
```

`.clinerules` is a directory owned by Cline — it must not be treated as an instruction injection
target. `.cline/clinerules.md` is the single source.

### `lib/installer.js`

Added a directory guard to `checkClinerulesDualFileDrift`:

```js
// If .clinerules is already a directory, dual-file pattern is gone — return early
if (await fs.pathExists(clinerulesPath) && (await fs.stat(clinerulesPath)).isDirectory()) {
  return;
}
```

Prevents false drift detection when `.clinerules` is a directory (the correct post-fix state).

### `lib/bmad.js` — `deployClineWorkflows`

Added a migration step at the start of `deployClineWorkflows`:

```js
// Migrate: if .clinerules is a legacy file, delete it — content is in .cline/clinerules.md
const clinerulesPath = path.join(projectRoot, '.clinerules');
if (await fs.pathExists(clinerulesPath)) {
  const stat = await fs.stat(clinerulesPath);
  if (stat.isFile()) {
    await fs.remove(clinerulesPath);
  }
}
// Now safe to create .clinerules/workflows/ as a directory
await fs.ensureDir(path.join(projectRoot, '.clinerules', 'workflows'));
```

## Affected Files

- `lib/agents.js` — removed `.clinerules` from Cline `instructionFiles`
- `lib/installer.js` — added directory guard to `checkClinerulesDualFileDrift`
- `lib/bmad.js` — added legacy-file migration in `deployClineWorkflows`

## Notes

- Created via `create-bug-story` workflow
- Discovered during Story 25.3 testing (2026-05-01)
- Fix is already implemented and released as part of v3.10.0
- Discoverable by sprint workflows via glob: `_bmad-output/implementation-artifacts/bug-*.md`

## Change Log

| Date | Version | Author | Description |
|------|---------|--------|-------------|
| 2026-05-01 | 1.0.0 | Claude Code | Bug story created — fix already implemented in lib/agents.js, lib/installer.js, lib/bmad.js |
