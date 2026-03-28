# Epic 16: Multi-Repository Project Layout -- Adversarial Review

**Review Date:** 2026-03-28
**Scope:** Stories 16.1, 16.2, 16.3, 16.4
**Verdict:** Significant issues found -- not ready for dev without corrections

---

## Findings

### Story 16.1: Repository Layout Wizard

1. **Wrong prompt library referenced throughout the story.** The Dev Notes, code sample, and Key Implementation Constraint #1 all reference `inquirer` as the prompt library. The actual codebase uses `prompts` (the `prompts` npm package), not `inquirer`. See `bin/cli.js` line 3: `const prompts = require('prompts');` and `lib/installer.js` line 4. The `inquirer` package is never imported anywhere. The code sample uses `prompt({ type: 'list', ... })` which is `inquirer` syntax; `prompts` uses `type: 'select'` with `choices` as `{ title, value }` objects, not `{ name, value }`. The entire code pattern reference is wrong.

2. **Story says to modify `cli.js` (root of project) but the actual file is at `bin/cli.js`.** The Dev Notes state "Primary file to modify: `cli.js` (root of project)" and the code sample says "In cli.js -- new wizard section after agent selection." The file is actually `bin/cli.js`. There is no `cli.js` at the project root. A developer would spend time looking for a file that does not exist at the stated location.

3. **No git URL validation whatsoever.** AC #3 and Task 3.1 accept any string as a git URL. There is no validation that the URL is a plausible git remote. There is also no protection against command injection -- the URL is interpolated directly into an `execSync()` shell command. A malicious or mistyped URL containing shell metacharacters (e.g., `; rm -rf /`) would execute arbitrary commands. This is a **security vulnerability**. At minimum, the URL and path should be validated and shell-escaped, not merely quoted.

4. **AC #5 (Local path) allows confirming a non-existent path, but consequences are undefined.** Task 2.3-2.4 say if the user confirms a non-existent path, store it anyway. But Story 16.2 will write this path into config.yaml, Story 16.3 stamps it into project-context.md, and Story 16.4 expects BMAD workflows to read from it. What happens when every downstream consumer tries to use a path that does not exist? There is no acceptance criterion for how the system should behave when a configured path is invalid at runtime.

5. **No acceptance criterion or task for handling git authentication failures.** Task 3.7 says "Handle clone failure gracefully -- catch error, display message, ask user to retry or skip." But "skip" is undefined. If the user skips a failed clone, what is the state of the layout object? Is the mode still `remote` with no valid local path? Is it silently downgraded to `same`? The skip behavior is not specified and would leave the layout object in an inconsistent state.

### Story 16.2: Config Storage and Cross-Reference File

6. **Story 16.2 writes to `_bmad/core/config.yaml`, but BMAD workflows read from `_bmad/bmm/config.yaml`.** Every single workflow.yaml in the codebase uses `config_source: "{project-root}/_bmad/bmm/config.yaml"`, and SKILL.md extension files also instruct agents to "Load and read `{project-root}/_bmad/bmm/config.yaml`." The story writes `knowledgebase_path` and `sprint_management_path` to `_bmad/core/config.yaml`, but no workflow or agent reads from that file for operational config. Unless BMAD workflows are modified to also read `_bmad/core/config.yaml` (not specified anywhere in these four stories), the paths written will be invisible to consumers. This is a **fundamental architectural disconnect**.

7. **Stale `project-layout.yaml` problem is unaddressed.** Task 3.2 explicitly says "leave it in place (do not delete -- user may switch back)." This means if a user switches from multi-repo to single-repo, a stale `project-layout.yaml` with old paths remains. Agents reading that file (per Story 16.4 AC #4) would use outdated paths. There is no mechanism to mark the file as inactive, no version or validity check, and no AC addressing how consumers should handle the stale-file scenario.

8. **String manipulation for YAML merge is fragile and underspecified.** Task 1.5 says "Preserve existing config.yaml content -- append/merge, do not overwrite" and Task 1.6 says use "string manipulation or regex." But there is no specification for what happens when `knowledgebase_path` already exists in the file from a previous run. Append would create duplicates. Find/replace needs a defined regex. The story does not specify whether existing values should be updated in place or appended, nor does it provide the regex pattern.

### Story 16.3: Project-Context Multi-Repo Section

9. **Contradiction between AC #3 (idempotency) and existing codebase behavior.** AC #3 says "When project-context.md already exists, the file is NOT modified." But the existing codebase in `installer.js` already DOES modify an existing `project-context.md` via `updateProjectContextManifestPaths()` which replaces content between marker comments. The story's blanket "do NOT modify" rule contradicts the established pattern and means users who install multi-repo on an existing project will NEVER get the Repository Layout section unless they manually edit it or regenerate from scratch (losing customizations).

10. **Template location uncertainty and missing test updates.** Dev Notes say "Generator function: in `installer.js` or related module (find via Epic 13 implementation)" -- the hedge "or related module" suggests the author was not sure. More critically, Task 3.2 modifies the public API signature of `generateProjectContext()` (an exported function). There is no mention of updating tests in `test/generate-project-context.test.js` or checking for other callers of this function.

### Story 16.4: Validate Cross-Repo Path Resolution

11. **Story is built on an unverified assumption with no definition of done if it fails.** The Expected Outcome says "Most likely outcome: BMAD workflow path resolution is driven by `config.yaml` values that ma-agents sets." But workflows use `output_folder: "{config_source}:output_folder"` which reads from `_bmad/bmm/config.yaml` -- a completely different key name and config file. There are zero references to `knowledgebase_path` or `sprint_management_path` anywhere in workflow files. This story is framed as "validation" but the gap it will inevitably discover should have been scoped as implementation work, not punted to a validation story that might produce a "gap analysis document" with no timeline for resolution.

12. **No acceptance criteria for what constitutes a passing validation.** The ACs describe expected behaviors, but Task 4 says "If BMAD workflows don't natively support configurable output paths, document changes needed." So the story passes even if nothing works? There is no AC that defines the minimum passing bar. A validation story without a pass/fail criterion is a research spike wearing a validation costume.

### Cross-Story Issues

13. **Three sources of truth, no precedence specification.** Story 16.2 stores paths in `config.yaml`. Story 16.3 stamps paths into `project-context.md`. Story 16.4 says agents discover paths from `project-layout.yaml` OR `config.yaml`. There are now three sources of truth for the same information, and no specification for which takes precedence when they disagree.

14. **No CI/CD path for multi-repo configuration.** AC #7 of Story 16.1 says `--yes` mode defaults to single-repo, and Dev Notes say "multi-repo is interactive-only configuration." This means there is no way to configure multi-repo in an automated pipeline -- ever. For a feature targeting DevOps engineers (Story 16.2's persona), making it impossible to automate is a significant gap. There should be environment variables or CLI arguments for headless multi-repo setup.

15. **Zero automated test coverage across all four stories.** Stories 16.1-16.3 introduce new functions and modify an existing exported function. There is an existing test file that will break when the function signature changes. None of the three implementation stories include any task for writing or updating unit tests. Story 16.4's tasks are all manual audits. The epic ships with zero automated regression coverage.
