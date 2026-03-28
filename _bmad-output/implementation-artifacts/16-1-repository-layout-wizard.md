# Story 16.1: Repository Layout Wizard

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **Chief Architect**,
I want the installer to ask where the knowledgebase and sprint management are managed during installation,
So that the project layout is configured correctly for multi-repo environments.

## Acceptance Criteria

1. When the user runs `npx ma-agents install`, the wizard asks "Where is your knowledgebase managed?" with options: Current repository (default), Local path, Remote git repository (FR111)
2. The wizard asks "Where is your sprint management managed?" with the same options (FR112)
3. When the user selects "Remote git repository", the wizard asks for the git URL and local destination path for cloning. If the destination already exists and is a directory, it displays its contents summary and asks the user to confirm. If it exists but is a file, it warns and re-prompts (FR113)
4. When the user selects "Remote git repository" and the destination does not exist, it clones the repository to that path using `execFileSync` (not `execSync`) to prevent command injection (FR114)
5. When the user selects "Local path", the wizard validates the path exists and is a directory. If it does not exist, it alerts the user and asks to confirm or correct. If confirmed, logs a warning that the path must exist before agents run (FR115)
6. When the user selects "Current repository" for both concerns, no additional configuration is needed — single-repo mode preserved (FR116)
7. In `--yes` flag (CI/CD mode), the wizard checks env vars `MA_KNOWLEDGEBASE_PATH` and `MA_SPRINT_PATH`. If set, uses those paths (mode=local). If not set, defaults to "Current repository" (mode=same). Multi-repo is configurable headlessly via env vars (FR127 integration)
8. Git clone uses `execFileSync('git', ['clone', gitUrl, destPath])` with `{ timeout: 120000, env: { ...process.env, GIT_TERMINAL_PROMPT: '0' } }` for space-safety, injection prevention, and hang protection
9. Empty/whitespace-only inputs for git URL or destination path are rejected with re-prompt
10. If a clone fails, any partially-created destination directory is cleaned up before offering retry. If user skips, the concern falls back to `same` mode with a warning logged

## Tasks / Subtasks

- [ ] Task 1: Add `collectRepoLayout()` function to `bin/cli.js` (AC: #1, #2, #6, #7)
  - [ ] 1.1 Create `collectRepoLayout(flags)` async function in `bin/cli.js`
  - [ ] 1.2 Implement the knowledgebase prompt using `prompts` library (type: `'select'`, choices as `{ title, value }` objects — matching existing wizard patterns)
  - [ ] 1.3 Implement the sprint management prompt with same choices
  - [ ] 1.4 Return layout object: `{ knowledgebase: { mode, path, gitUrl? }, sprintManagement: { mode, path, gitUrl? } }`
  - [ ] 1.5 When mode is `same`, set `path: '.'`
  - [ ] 1.6 In `--yes` mode: check `process.env.MA_KNOWLEDGEBASE_PATH` and `process.env.MA_SPRINT_PATH`. If set, use `{ mode: 'local', path: path.resolve(envValue) }`. If not set, use `{ mode: 'same', path: '.' }`
  - [ ] 1.7 If both concerns resolve to the same external path, log info: "Both concerns point to same external repository"

- [ ] Task 2: Implement "Local path" flow (AC: #5, #9)
  - [ ] 2.1 Prompt user for local path string; reject empty/whitespace-only input with re-prompt
  - [ ] 2.2 Resolve to absolute path via `path.resolve(process.cwd(), localPath)`
  - [ ] 2.3 Check `fs.existsSync(resolved)`: if exists, verify `fs.statSync(resolved).isDirectory()` — if it's a file, warn and re-prompt
  - [ ] 2.4 If path does not exist: display warning with `chalk.yellow()`, ask user to confirm or provide corrected path
  - [ ] 2.5 If confirmed non-existent: store resolved path, log warning that path must exist before agents run
  - [ ] 2.6 If not confirmed, re-prompt for the path (loop)
  - [ ] 2.7 Warn if resolved path is inside the current repo (`resolved.startsWith(process.cwd())`) — nested repos cause git confusion

- [ ] Task 3: Implement "Remote git repository" flow (AC: #3, #4, #8, #9, #10)
  - [ ] 3.1 Prompt user for git URL string; reject empty/whitespace-only input with re-prompt
  - [ ] 3.2 Prompt user for local destination path; reject empty/whitespace-only input with re-prompt
  - [ ] 3.3 Resolve destination to absolute path via `path.resolve()`
  - [ ] 3.4 If destination exists and is a file (not directory): warn with `chalk.red()` and re-prompt
  - [ ] 3.5 If destination exists and is a directory: display summary with `chalk.blue()` (file count, whether it's a git repo), ask user to confirm using existing directory
  - [ ] 3.6 If destination does not exist: run `execFileSync('git', ['clone', gitUrl, destPath], { timeout: 120000, env: { ...process.env, GIT_TERMINAL_PROMPT: '0' } })` — prevents injection, hangs, and SSH key prompts
  - [ ] 3.7 On clone failure: if `destPath` was created by the failed clone (didn't exist before), remove it (`fs.rmSync(destPath, { recursive: true, force: true })`). Then offer retry or skip
  - [ ] 3.8 If user skips after failure: fall back to `{ mode: 'same', path: '.' }`, log warning with `chalk.yellow('Falling back to current repository for {concern}')`
  - [ ] 3.9 Warn if destination resolves inside current repo

- [ ] Task 4: Integrate into wizard flow (AC: #1-#10)
  - [ ] 4.1 Call `collectRepoLayout(flags)` in `installWizard()` AFTER agent selection (after ~line 333) and BEFORE scope selection (~line 336)
  - [ ] 4.2 Pass the returned layout object forward to the installation pipeline context
  - [ ] 4.3 Store layout in the installation context so subsequent steps (config write, project-context) can access it
  - [ ] 4.4 Verify `--yes` mode without env vars bypasses all repo layout prompts (defaults to same)
  - [ ] 4.5 Verify `--yes` mode with env vars creates local-mode layout without prompts

- [ ] Task 5: Write unit tests (AC: #1-#10)
  - [ ] 5.1 Test `collectRepoLayout()` with `--yes` flag returns both as `same` mode
  - [ ] 5.2 Test `collectRepoLayout()` with `--yes` + env vars returns local mode with resolved paths
  - [ ] 5.3 Test local path validation: existing dir accepted, existing file rejected, non-existent warned
  - [ ] 5.4 Test remote flow: `execFileSync` called with correct args array (not string interpolation)
  - [ ] 5.5 Test clone failure: partial directory cleanup, skip fallback to same mode
  - [ ] 5.6 Test empty/whitespace input rejection for URL and path
  - [ ] 5.7 Test nested-repo warning when path is inside cwd

## Dev Notes

### Architecture Decision P2-10

This story implements the installation wizard portion of architecture decision P2-10 (Multi-Repository Project Layout). The wizard goes in `bin/cli.js` as a new section AFTER the agent selection prompts.

### CRITICAL: Correct Prompt Library

The codebase uses the `prompts` npm package, NOT `inquirer`. See `bin/cli.js` line 3: `const prompts = require('prompts');`. Key syntax differences:
- List/select prompts use `type: 'select'` (not `'list'`)
- Choices use `{ title: 'Display text', value: 'value' }` (not `{ name, value }`)
- Import: `const prompts = require('prompts');`

### Code Pattern Reference (Corrected)

```javascript
// In bin/cli.js — new wizard section after agent selection
async function collectRepoLayout(flags) {
  // CI/CD mode: check env vars first, then default
  if (flags.yes) {
    const kbPath = process.env.MA_KNOWLEDGEBASE_PATH;
    const sprintPath = process.env.MA_SPRINT_PATH;
    return {
      knowledgebase: kbPath
        ? { mode: 'local', path: path.resolve(kbPath) }
        : { mode: 'same', path: '.' },
      sprintManagement: sprintPath
        ? { mode: 'local', path: path.resolve(sprintPath) }
        : { mode: 'same', path: '.' },
    };
  }

  const layout = { knowledgebase: null, sprintManagement: null };
  for (const concern of ['knowledgebase', 'sprintManagement']) {
    const { mode } = await prompts({
      type: 'select',
      name: 'mode',
      message: `Where is your ${concern} managed?`,
      choices: [
        { title: 'Current repository (default)', value: 'same' },
        { title: 'Local path', value: 'local' },
        { title: 'Remote git repository', value: 'remote' },
      ]
    });
    // ... mode-specific handling
  }
  return layout;
}
```

### SECURITY: Command Injection Prevention

**NEVER** use `execSync()` with string interpolation for git clone. The git URL is user-provided and could contain shell metacharacters. Use `execFileSync` which passes arguments as an array, bypassing shell interpretation:

```javascript
// WRONG — command injection via URL
execSync(`git clone "${gitUrl}" "${destPath}"`);

// CORRECT — arguments passed as array, no shell
const { execFileSync } = require('child_process');
execFileSync('git', ['clone', gitUrl, destPath], {
  timeout: 120000,
  env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
  stdio: 'inherit'
});
```

### Clone Failure Cleanup

If a clone fails partway through, the destination directory may contain a partial/corrupt clone. Before offering retry, check if the directory was created by the clone attempt and remove it:

```javascript
const existedBefore = fs.existsSync(destPath);
try {
  execFileSync('git', ['clone', gitUrl, destPath], { ... });
} catch (err) {
  if (!existedBefore && fs.existsSync(destPath)) {
    fs.rmSync(destPath, { recursive: true, force: true });
  }
  // offer retry or skip
}
```

### Key Implementation Constraints

1. **`prompts` library** (NOT `inquirer`): Use `type: 'select'` with `{ title, value }` choices — match existing `bin/cli.js` patterns
2. **File location**: `bin/cli.js` (NOT `cli.js` at project root — there is no such file)
3. **`execFileSync` for git clone**: Array args, no shell, prevents injection
4. **Clone timeout**: 120 seconds, matching existing `GIT_TERMINAL_PROMPT: '0'` pattern in `lib/bmad.js`
5. **Cross-platform paths**: `path.resolve()` for normalization — do NOT use hardcoded separators
6. **No new dependencies**: Use `fs`, `path`, `child_process` (already available), `chalk` (already imported), `prompts` (already imported)
7. **CI/CD env vars**: `MA_KNOWLEDGEBASE_PATH` and `MA_SPRINT_PATH` enable headless multi-repo setup

### NFR Compliance

| NFR | How This Story Addresses It |
|-----|----------------------------|
| NFR34 | Default "Current repository" preserves single-repo behavior — no change for existing users |
| NFR35 | Git clone uses user-provided URL — works with internal GitLab, local network repos |
| NFR9 | `path.resolve()` for cross-platform path handling |

### Story Scope Boundary

This story ONLY implements the wizard collection. It does NOT write to config.yaml or create `project-layout.yaml` — that is Story 16.2. This story returns the layout object to the caller.

### Project Structure Notes

- Primary file to modify: `bin/cli.js`
- Wizard section placement: after agent selection (~line 333), before scope selection (~line 336)
- The layout object is passed forward through the installation pipeline

### References

- [Source: _bmad-output/planning-artifacts/architecture.md — Decision P2-10, lines 792-901]
- [Source: _bmad-output/planning-artifacts/epics.md — Story 16.1, lines 1972-2008]
- [Source: _bmad-output/planning-artifacts/prd.md — FR111-FR116, FR127, lines 574-598]
- [Source: _bmad-output/planning-artifacts/prd.md — NFR34-NFR37, lines 655-660]
- [Source: bin/cli.js — installWizard(), prompts library usage]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
