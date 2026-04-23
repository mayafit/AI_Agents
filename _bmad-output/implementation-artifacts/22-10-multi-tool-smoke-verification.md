# Story 22.10: Multi-Tool Smoke Verification

Status: backlog

## Story

As a **release manager**,
I want the plugin install flow smoke-verified against multiple `--tools` targets,
So that a regression in one tool's skill-directory routing is caught before release rather than by an end user.

## Acceptance Criteria

1. **Given** a new CI matrix workflow (e.g., `.github/workflows/multi-tool-smoke.yml`), **When** a PR is opened or a tag is pushed, **Then** the workflow runs automatically with at least three matrix entries: `claude-code`, `copilot`, `cline`.

2. **Given** an optional extension, **When** capacity allows, **Then** the matrix also includes `roo-code` and `kilocode` (the disconnected-friendly IDE set most likely used by ma-agents end users).

3. **Given** each matrix entry, **When** the job runs, **Then** it:
   - Checks out the repo, runs `npm install`, runs `npm pack`
   - Extracts the tarball into a scratch dir
   - Runs `npx ma-agents install --yes --force --tools <target> --directory <scratch>`
   - Asserts exit code 0
   - Asserts the target's expected skills directory exists and contains at least one ma-agents skill (e.g., `ma-agent-cyber/SKILL.md`)
   - Asserts the target's MANIFEST.yaml file (if the tool uses one) includes ma-agents skill IDs

4. **Given** any single tool's job fails, **When** the matrix completes, **Then** the workflow as a whole fails (no silent skip of the failing tool).

5. **Given** PRs that touch any of `lib/bmad.js`, `lib/agents.js`, `lib/bmad-extension/`, `lib/bmad-extension-plugin/`, or `scripts/build-plugin.js`, **When** the workflow's path filter is evaluated, **Then** the matrix runs.

6. **Given** documentation, **When** I read it, **Then** the supported `--tools` targets and their expected skill paths are listed (so contributors know what to expect):
   - `claude-code` → `.claude/skills/`
   - `copilot` → `.github/copilot/skills/`
   - `cline` → `.cline/skills/`
   - `roo-code` → `.roo/skills/`
   - `kilocode` → `.kilocode/skills/`

7. **Given** workflow output, **When** I view the run summary, **Then** each matrix entry produces a concise pass/fail line plus the count of skills installed at the target — useful at a glance during release verification.

## Tasks / Subtasks

### Task 1: Decide the matrix surface (AC: 1, 2)

- [ ] 1.1 Confirm the minimum matrix: `claude-code`, `copilot`, `cline`
- [ ] 1.2 Decide whether to also include `roo-code` and `kilocode` in the always-on matrix or as an extended matrix triggered only on release tags
- [ ] 1.3 Document the decision in the story's Dev Notes

### Task 2: Author the workflow (AC: 1, 3, 4)

- [ ] 2.1 Create `.github/workflows/multi-tool-smoke.yml` with structure:
  ```yaml
  name: Multi-Tool Smoke
  on:
    pull_request:
      paths:
        - 'lib/bmad.js'
        - 'lib/agents.js'
        - 'lib/bmad-extension/**'
        - 'lib/bmad-extension-plugin/**'
        - 'scripts/build-plugin.js'
    push:
      tags: ['v*']
  jobs:
    smoke:
      runs-on: ubuntu-latest
      strategy:
        fail-fast: false
        matrix:
          tool:
            - { name: claude-code, skills_dir: .claude/skills }
            - { name: copilot,     skills_dir: .github/copilot/skills }
            - { name: cline,       skills_dir: .cline/skills }
            # - { name: roo-code,    skills_dir: .roo/skills }      (extended matrix)
            # - { name: kilocode,    skills_dir: .kilocode/skills } (extended matrix)
      steps:
        - uses: actions/checkout@v4
        - uses: actions/setup-node@v4
          with: { node-version: '20' }
        - run: npm install
        - run: npm pack
        - name: Install with --tools ${{ matrix.tool.name }}
          run: |
            mkdir -p /tmp/scratch
            cd /tmp/scratch
            tar -xzf $GITHUB_WORKSPACE/ma-agents-*.tgz
            cd package
            npm install --no-audit --no-fund
            node bin/cli.js install --yes --force --tools ${{ matrix.tool.name }} --directory /tmp/scratch
        - name: Assert skills installed
          run: |
            test -d /tmp/scratch/${{ matrix.tool.skills_dir }}
            test -f /tmp/scratch/${{ matrix.tool.skills_dir }}/ma-agent-cyber/SKILL.md
            count=$(ls /tmp/scratch/${{ matrix.tool.skills_dir }} | wc -l)
            echo "Skills installed for ${{ matrix.tool.name }}: $count"
            echo "::notice title=${{ matrix.tool.name }}::installed $count skills at ${{ matrix.tool.skills_dir }}"
  ```
- [ ] 2.2 `fail-fast: false` ensures all matrix entries run even if one fails — so we see all failures in one PR cycle, not one at a time

### Task 3: Add MANIFEST assertion (AC: 3)

- [ ] 3.1 If the target tool maintains a MANIFEST.yaml in its skills directory, add an assertion that it lists at least one ma-agents skill ID:
  ```sh
  if [ -f /tmp/scratch/${{ matrix.tool.skills_dir }}/MANIFEST.yaml ]; then
    grep -q "ma-agent-cyber" /tmp/scratch/${{ matrix.tool.skills_dir }}/MANIFEST.yaml || (echo "MANIFEST does not list ma-agent-cyber" && exit 1)
  fi
  ```
- [ ] 3.2 Some tools may not generate MANIFEST.yaml — make the check conditional on the file's existence

### Task 4: Path filtering (AC: 5)

- [ ] 4.1 The `paths:` filter in Task 2.1 already implements this. Verify the filter list matches the architectural "Affects" list from Decision P4-1
- [ ] 4.2 Test the filter by opening a PR that touches one of the listed paths — confirm the workflow runs. Test by opening a PR that touches an unrelated file — confirm the workflow does NOT run

### Task 5: Document the contract (AC: 6)

- [ ] 5.1 Add a section to `CONTRIBUTING.md` (or `docs/multi-tool-support.md`) listing the supported tools and their skill paths
- [ ] 5.2 Reference `lib/agents.js` as the canonical source for tool registration (so the doc and code stay in sync)

### Task 6: Add summary output (AC: 7)

- [ ] 6.1 In the workflow, use `::notice` annotations (already shown in Task 2.1) so the matrix summary in PR view shows pass/fail + skill count per tool
- [ ] 6.2 Optionally add a job summary using `$GITHUB_STEP_SUMMARY` for a richer table view

### Task 7: Coordinate with Story 22.9 (AC: 1)

- [ ] 7.1 Decide whether to merge this matrix with the offline-install gate (Story 22.9) into a single combined matrix that crosses (offline × tool). See Story 22.9 Dev Notes for tradeoffs.
- [ ] 7.2 If keeping separate, ensure both workflows have non-overlapping triggers (or accept the duplication for clarity)

### Task 8: Initial run and stabilization (AC: 4)

- [ ] 8.1 Open a draft PR with the workflow, observe each matrix entry
- [ ] 8.2 Fix any tool-specific install failures (likely candidates: missing skills directory creation logic for a tool, MANIFEST.yaml format differences)
- [ ] 8.3 Verify the run completes within reasonable wall-clock time (5-10 minutes total for the matrix)

## Dev Notes

### Why this matters more than it looks

`lib/agents.js` registers many tools (Claude Code, Copilot, Cline, Roo Code, Kilocode, OpenCode, Cursor, Gemini). The plugin migration in Story 22.6 changes how content reaches each of those — instead of ma-agents writing files directly into each tool's directory, BMAD's installer does the routing based on `--tools`. A bug in BMAD's routing (or in our plugin's structure) might work for one tool and silently break another. This matrix is the safety net.

### The `lib/agents.js` registry is the source of truth

When adding a new tool to ma-agents, two updates are needed:
1. Register the tool in `lib/agents.js` (already standard practice)
2. Add a matrix entry to this workflow

Without (2), regressions in the new tool's install go undetected until end-user reports.

### Why include roo-code and kilocode

The user explicitly mentioned in conversation that ma-agents will likely be used most with non-Claude tools in disconnected environments. Roo Code and Kilocode are strong candidates. Including them in the matrix (even just for release tags) reduces the chance that the most-used target sees a regression.

### Reference Files

- `.github/workflows/multi-tool-smoke.yml` — created by this story
- `lib/agents.js` — the source-of-truth registry
- `CONTRIBUTING.md` or `docs/multi-tool-support.md` — documentation
- Architecture: Decision P4-1, "Multi-tool routing" subsection

### PRD Traceability

- **FR192:** Plugin install flow smoke-tested against at least two non-Claude `--tools` targets during release verification
- **NFR52:** Multi-tool install parity — same bundled plugin produces functional installation across `claude-code`, `copilot`, `cline`, `roo-code`, `kilocode`

## Change Log

| Date | Version | Author | Description |
|------|---------|--------|-------------|
| 2026-04-13 | 1.0.0 | (pending) | Story drafted as part of Epic 22 |
