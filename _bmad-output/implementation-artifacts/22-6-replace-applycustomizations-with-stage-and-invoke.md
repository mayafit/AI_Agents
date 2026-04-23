# Story 22.6: Replace `applyCustomizations()` with Stage-and-Invoke

Status: backlog

## Story

As a **ma-agents installer**,
I want the post-install manifest-surgery code path replaced with a pre-install local plugin staging flow,
So that ma-agents stops parsing BMAD's internal manifests and instead delegates placement to BMAD's own installer via `--custom-source`.

## Acceptance Criteria

1. **Given** the current `lib/bmad.js`, **When** the changes in this story are applied, **Then** the following code is REMOVED:
   - All manifest.yaml / files-manifest.csv hand-parsing logic — including the `fields[2]` CSV column indexing pattern at approximately line 252 and the hardcoded module-name filter `["custom", "bmb"]` at approximately line 205-283
   - All custom-agent YAML staging into `_bmad/_config/custom/agents/` at approximately line 296-346
   - The `applyCustomizations()` function and any callers of it
   - **Net deletion target:** at least 100 lines removed (architecture P4-1 estimates ~140)

2. **Given** the new staging flow, **When** I read the replacement code in `lib/bmad.js` (or a new helper file extracted from it), **Then** it implements:
   - Stage `lib/bmad-extension-plugin/` → `<project>/.ma-agents-plugin-stage/` via a recursive directory copy
   - Invoke `bmad-method install` with arguments: `--custom-source <abs-path-to-stage> --tools <selected> --modules <selected> --yes` (plus any other flags the existing buildBmadArgs() builds)
   - On exit code 0: remove `<project>/.ma-agents-plugin-stage/` recursively
   - On non-zero exit code: log the stage path and leave the directory in place for diagnostics; propagate the non-zero exit
   - **Replacement size target:** approximately 30-50 lines for the new helper

3. **Given** the staging step, **When** it copies `lib/bmad-extension-plugin/` to the stage directory, **Then** the result is a fresh full copy (not a symlink, not a hardlink). Verified by computing a SHA-256 over both directories and confirming a match.

4. **Given** a fresh scratch project, **When** I run `npx ma-agents install --yes --force --tools claude-code --directory <scratch>`, **Then** the install completes with exit code 0 and:
   - The scratch project has a populated `_bmad/` tree containing the ma-agents skills (e.g., `ma-agent-cyber` is present in the resulting BMAD module structure)
   - `<scratch>/_bmad/_config/custom/agents/` does NOT exist OR is empty (no custom agent YAML was written by ma-agents)
   - `<scratch>/.ma-agents-plugin-stage/` does NOT exist (cleanup succeeded)

5. **Given** the install completes successfully, **When** I read the installer's stdout, **Then** I see log lines confirming:
   - The plugin path that was staged (e.g., `Staged plugin: <abs-path>`)
   - The `--tools` argument that was passed (e.g., `Invoking bmad-method with --tools claude-code`)
   - Cleanup success (e.g., `Removed plugin stage directory`)

6. **Given** a deliberately broken install (e.g., the bundled plugin is missing or bmad-method exits non-zero), **When** I run the installer, **Then** the stage directory is left in place at `<scratch>/.ma-agents-plugin-stage/` and the installer exits non-zero with a message naming the stage path.

7. **Given** any existing tests that asserted on the legacy manifest-surgery behavior (e.g., a test that checks `_bmad/_config/custom/agents/` is populated), **When** the changes land, **Then** those tests are removed or rewritten to assert on the new flow's behavior.

8. **Given** the install runs against v6.3.0, **When** the BMAD installer is invoked, **Then** the `--custom-source` argument resolves via PluginResolver's local-file strategy and the plugin content is correctly placed in the target tool's skills directory.

## Tasks / Subtasks

### Task 1: Inventory the code to delete (AC: 1)

- [ ] 1.1 In `lib/bmad.js`, identify the exact line ranges for:
  - The manifest cleanup block (~line 205-283 per architecture P4-1)
  - The custom-agent staging block (~line 296-346)
  - The `applyCustomizations()` function definition
  - All callers of `applyCustomizations()`
- [ ] 1.2 Document line numbers and rough scope in the story's Dev Notes (line numbers shift as code lands; this is for the implementer's reference only)

### Task 2: Implement the staging helper (AC: 2, 3, 5)

- [ ] 2.1 Create a new helper function (in `lib/bmad.js` or a new file like `lib/plugin-stage.js`):
  ```js
  function stagePlugin(projectRoot) {
    const sourcePath = path.join(__dirname, '..', 'lib', 'bmad-extension-plugin');
    const stagePath = path.join(projectRoot, '.ma-agents-plugin-stage');
    // Recursive copy, no symlinks
    fsExtra.copySync(sourcePath, stagePath, { overwrite: true });
    // (Use Node built-in fs.cpSync if available — Node 16.7+; falls back to recursive copy via readdirSync + copyFileSync otherwise)
    return stagePath;
  }

  function cleanupStage(stagePath) {
    fs.rmSync(stagePath, { recursive: true, force: true });
  }
  ```
- [ ] 2.2 Use Node built-ins only (no `fs-extra`); rely on `fs.cpSync` (Node 16.7+) or implement a small recursive-copy helper
- [ ] 2.3 Add the log lines required by AC 5 (stage path, --tools, cleanup confirmation)

### Task 3: Wire staging into the install flow (AC: 2, 4, 6)

- [ ] 3.1 In whatever function currently invokes bmad-method (likely a wrapper around `runCommand()` in `lib/bmad.js`), add the staging step BEFORE the bmad-method invocation:
  ```js
  const stagePath = stagePlugin(projectRoot);
  args.push('--custom-source', stagePath);
  ```
- [ ] 3.2 Wrap the bmad-method invocation in try/finally to cleanup on success and leave-in-place on failure:
  ```js
  let installSucceeded = false;
  try {
    runCommand(bmadCmd, args);
    installSucceeded = true;
  } finally {
    if (installSucceeded) {
      cleanupStage(stagePath);
    } else {
      console.error(`Install failed. Stage directory left at: ${stagePath}`);
    }
  }
  ```
- [ ] 3.3 Ensure the `--tools` and `--modules` arguments are preserved from the existing `buildBmadArgs()` output

### Task 4: Delete the legacy code (AC: 1)

- [ ] 4.1 Remove `applyCustomizations()` and its callers from `lib/bmad.js`
- [ ] 4.2 Remove the manifest cleanup block (~line 205-283 in the pre-change file)
- [ ] 4.3 Remove the custom-agent YAML staging block (~line 296-346)
- [ ] 4.4 Remove any helper functions only called by the deleted code
- [ ] 4.5 Verify the line-count delta: at least 100 lines net removed

### Task 5: Update or remove tests (AC: 7)

- [ ] 5.1 Search `test/` for any test that imports `applyCustomizations` or asserts on `_bmad/_config/custom/agents/` content — remove or rewrite
- [ ] 5.2 Add new tests for the staging flow:
  - `stagePlugin` produces a byte-identical copy of the source bundle
  - `cleanupStage` removes the directory cleanly
  - Install succeeds with stage cleanup; install failure leaves stage in place

### Task 6: End-to-end install verification (AC: 4, 5, 6, 8)

- [ ] 6.1 With v6.3.0 baseline (Story 22.1) and bundled plugin (Story 22.4) in place, create a scratch project and run `npx ma-agents install --yes --force --tools claude-code`
- [ ] 6.2 Verify acceptance criteria 4, 5, 8 pass
- [ ] 6.3 Force a failure (e.g., temporarily move `lib/bmad-extension-plugin/` aside or pass an invalid `--directory`), re-run, verify AC 6 holds (stage directory survives)
- [ ] 6.4 Document any non-obvious bmad-method behavior observed during the install (helps future debugging)

## Dev Notes

### This is the largest code-touching story in Epic 22

Net effect: ~140 lines deleted, ~30-50 added. The deletion is the value — every line removed is a line that no longer needs to track upstream BMAD changes.

### Coordination required

Other epics (Epic 5 Story 5.5/5.6 in review, Epic 15 in flight) also touch `lib/bmad.js`. Land Story 22.1 (version bump) and confirm Epic 5's stories are merged before starting Story 22.6.

### Why project-local staging

NFR53 requires the stage directory be project-local (not user-home). Reasons:
- Self-contained: every install lives inside the target project
- Easy diagnostics: a failed install leaves the stage exactly where the user is working
- No persistent state: removed on success, no cleanup of user-home garbage

### Why fresh copy, not symlink

A symlink would mean modifications inside the stage propagate back to source. BMAD's installer may write into the staged plugin during processing — we want those writes isolated.

### Failure mode: leave the stage

If bmad-method fails, the user can:
- Inspect `.ma-agents-plugin-stage/` to see exactly what was about to be installed
- Re-run with the same stage by passing `--custom-source` directly to bmad-method (the bypass)
- Report a bug with the stage attached for reproducibility

This is a deliberate UX choice — silent cleanup on failure makes debugging much harder.

### Reference Files

- `lib/bmad.js` — the file to surgically modify
- `lib/bmad-extension-plugin/` — the bundle (produced by Story 22.4)
- `test/` — existing test suite that needs sweep
- Architecture: Decision P4-1, "New flow" subsection — algorithmic spec for this story

### PRD Traceability

- **FR185:** Plugin stage to project-local directory; pass `--custom-source` to bmad-method
- **FR186:** Stage removed after success; left in place after failure
- **FR187:** Removal of `applyCustomizations()` and manifest surgery
- **NFR54:** Air-gapped guarantee preserved end-to-end (no network access added by this change)

## Change Log

| Date | Version | Author | Description |
|------|---------|--------|-------------|
| 2026-04-13 | 1.0.0 | (pending) | Story drafted as part of Epic 22 |
