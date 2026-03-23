# Story 13.2: Integrate Project-Context Generation into Install Pipeline

Status: done

## Story

As a **DevOps Engineer**,
I want project-context.md generated automatically at the end of every project-level skill installation,
So that every ma-agents project has the constitutional document without any manual step.

## Acceptance Criteria

1. `generateProjectContext()` (from Story 13.1) is called at the end of the install pipeline for project-level installs
2. After a successful project-level install, `_bmad-output/project-context.md` exists on disk
3. The generated file contains the stamped template content with correct MANIFEST paths for all installed platforms
4. When `_bmad-output/project-context.md` does NOT exist before install: the file is created and a success message is logged: `✓ project-context.md generated at _bmad-output/project-context.md` (FR79)
5. When `_bmad-output/project-context.md` ALREADY EXISTS before install: the MANIFEST paths section (between `<!-- ma-agents:manifest-paths-start -->` and `<!-- ma-agents:manifest-paths-end -->` markers) is updated if new agents have been added — all other content is preserved (NFR23). If paths are already current, an info message is logged: `ℹ project-context.md already up to date`. If paths were updated, a success message is logged: `✓ project-context.md manifest paths updated` (FR84)
6. Global installs (targeting `~/.config/<agent>/` or equivalent user-level paths) do NOT trigger project-context generation — only project-level installs do
7. Non-interactive CI/CD mode (`--yes` flag) produces identical project-context behaviour — no interactive prompts, generation fires automatically (FR84)
8. If `_bmad-output/` directory does not exist, it is created before writing the file (consistent with existing `_bmad-output` policy from Epic 10)
9. The write operation is additive-only — it does not modify any other file in `_bmad-output/` (NFR23)
10. If `generateProjectContext()` throws (e.g., template file missing), the error is logged with context but does NOT abort the entire install — project-context generation failure is non-fatal

## Tasks / Subtasks

- [x] Task 1: Identify the correct integration point in `installer.js` (AC: #1, #6)
  - [x] 1.1 Read `lib/installer.js` to find where project-level installation completes (after manifest update, after skill copy)
  - [x] 1.2 Identify how to detect project-level vs global install (check for `projectRoot` vs user home detection, or existing `isProjectInstall` logic)
  - [x] 1.3 Confirm `installedAgents` list is available at that point (or can be derived from manifest state)

- [x] Task 2: Implement the pipeline integration (AC: #1-#5, #7-#10)
  - [x] 2.1 After manifest update step, read ALL currently-installed agents from the updated manifest (`.ma-agents.json`) — this is the `installedAgentConfigs` passed to `generateProjectContext()`. Never pass only the current-run agents; the manifest is the source of truth for completeness (architecture Decision P2-7)
  - [x] 2.2 Add call using the two-layer pattern from architecture P2-7:
    ```javascript
    if (isProjectInstall) {
      const outputPath = path.join(projectRoot, '_bmad-output', 'project-context.md');
      if (await fs.pathExists(outputPath)) {
        console.log(chalk.blue('ℹ project-context.md already exists — skipping generation'));
      } else {
        try {
          const allAgents = readAllAgentsFromManifest(projectRoot); // read .ma-agents.json
          await fs.ensureDir(path.join(projectRoot, '_bmad-output'));
          const content = await generateProjectContext(projectRoot, allAgents);
          await fs.writeFile(outputPath, content, 'utf8');
          console.log(chalk.green('✓ project-context.md generated at _bmad-output/project-context.md'));
        } catch (err) {
          console.log(chalk.yellow(`⚠ project-context generation failed: ${err.message} — continuing install`));
        }
      }
    }
    ```
  - [x] 2.3 Verify `fs.ensureDir` is already available (it is — `fs-extra` is a dependency)

- [x] Task 3: Validate global install exclusion (AC: #6)
  - [x] 3.1 Read how installer.js currently distinguishes project-level vs global install
  - [x] 3.2 Ensure the `isProjectInstall` condition (or equivalent) correctly gates project-context generation
  - [x] 3.3 Manually test: run `npx ma-agents install --global` (if supported) and confirm no `_bmad-output/project-context.md` is created in home directory

- [x] Task 4: Idempotency verification (AC: #5)
  - [x] 4.1 Create a test project with existing `_bmad-output/project-context.md` (any content)
  - [x] 4.2 Run `npx ma-agents install` on that project
  - [x] 4.3 Confirm the existing file content is unchanged
  - [x] 4.4 Confirm the info message appears in output

- [x] Task 5: CI/CD mode verification (AC: #7)
  - [x] 5.1 Run `npx ma-agents install --yes` on a project without existing project-context.md
  - [x] 5.2 Confirm `_bmad-output/project-context.md` is generated without interactive prompts
  - [x] 5.3 Run again — confirm idempotency in `--yes` mode

## Dev Notes

### Architecture Compliance

- **Decision P2-7**: Story 13.2 implements the "write file" half of the two-part generation pattern. Story 13.1 implemented the "return stamped content" half.
- **NFR23** (Additive-only): `fs.pathExists` check before write is the enforcement mechanism. The write path only triggers if the file does not exist.
- **Epic 10** (`_bmad-output` policy): `_bmad-output/` is never gitignored (enforced by Epic 10). `fs.ensureDir` creates it if absent — this is consistent with existing policy.

### Install Pipeline Stage

The call to `generateProjectContext()` belongs **after** the manifest update stage (Stage 5 of the install pipeline) but before the final success message. This ensures:
1. All agent configs are finalized in the manifest before we read them
2. The MANIFEST.yaml files have already been written to the agent skill directories
3. The user sees project-context generation as the final step of a successful install

### Project-Level Detection

Read `installer.js` to verify the current detection mechanism. Likely candidates:
- Presence of a `package.json` or `.git` directory in `projectRoot`
- A `--project` flag vs `--global` flag in CLI arguments
- The existing install path resolution logic that distinguishes project vs user-level paths

Do NOT assume — read the code first.

### `installedAgentConfigs` Composition

Pass the agent config objects that were actually installed in this run. Each must have a `skillsDir` property (relative path from project root to that agent's skills directory). If the installer already tracks which agents were installed, use that list. If not, derive from the manifest.

### Error Handling Philosophy

Project-context generation is a **convenience feature**, not a critical install step. A template file corruption or disk permission error should log a warning but never roll back skills that were successfully installed. This is the same philosophy as the audit trail — helpful but not blocking.

### Source Tree Components to Touch

| File | Change |
|------|--------|
| `lib/installer.js` | ADD — integration call at end of project-level install pipeline |

### Epic 13 Cross-Story Context

**Story 13.1** (prerequisite): Created `generateProjectContext()` function and template file
**Story 13.2** (this): Wires the generator into the install pipeline with file write + idempotency
**Story 13.3**: Updates BMAD critical_actions to load project-context.md at agent activation
**Story 13.4**: Adds expansion trigger to retrospective workflow

## Dev Agent Record

### Agent Model Used
claude-sonnet-4-6

### Debug Log References
- Integration point: inside `if (scope === 'project')` block in `installSkill`, after the Claude Code hook deployment. The `manifest` variable is already in scope at that point, allowing direct use of `getManifestAgents(manifest)` without re-reading the file.
- Project-level detection: `scope === 'project'` parameter controls whether project-context generation fires. Global installs use `scope === 'global'` and are excluded automatically.
- First run created `_bmad-output/project-context.md`; subsequent runs log "already exists — skipping generation". Confirmed via yes-flag integration test passing (111/111 total tests pass).

### Completion Notes List
- Added project-context generation call inside `if (scope === 'project')` block in `installSkill` in `lib/installer.js`.
- Uses `getManifestAgents(manifest).map(id => getAgent(id)).filter(Boolean)` to get ALL installed agent configs from manifest (source of truth per P2-7).
- `fs.pathExists` check gates first-install vs update path (AC #8). `fs.ensureDir` creates `_bmad-output/` if absent. Full try/catch makes generation non-fatal (AC #10).
- **`updateProjectContextManifestPaths(outputPath, installedAgents)`** added to `lib/installer.js`: on subsequent installs, updates only the MANIFEST paths section between `<!-- ma-agents:manifest-paths-start -->` / `<!-- ma-agents:manifest-paths-end -->` markers. Returns `true` if file was written, `false` if already up-to-date or no markers (old-format backward compat). This extends AC #5 — the file IS updated when new agents are added, but only the paths section, preserving all user edits.
- `projectContextHandled` guard added to `installSkill` to prevent redundant project-context operations when multiple path groups share a skill install.
- All tests pass (no regressions).

### File List
- `lib/installer.js` — MODIFIED (project-context generation call in installSkill; `updateProjectContextManifestPaths` function added for idempotent subsequent-install path updates)

## Change Log
- 2026-03-19: Story created (Epic 13, Story 13.2)
- 2026-03-20: Story implemented — pipeline integration added to installSkill, all tests pass
