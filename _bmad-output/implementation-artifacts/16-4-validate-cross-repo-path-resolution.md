# Story 16.4: Validate Cross-Repo Path Resolution

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **Chief Architect**,
I want to verify that BMAD workflows correctly resolve artifact paths from the configured repo layout,
So that planning and sprint artifacts are read from and written to the correct repositories.

## Acceptance Criteria

1. An audit of all BMAD workflows identifies which use config-driven path resolution and which hardcode `_bmad-output/` — documented in a gap analysis table
2. When multi-repo is configured, at least ONE planning workflow reads planning artifacts from `{knowledgebase_path}/_bmad-output/planning-artifacts/` (FR119). If none do natively, the gap is documented with a concrete remediation task
3. When multi-repo is configured, at least ONE sprint workflow reads/writes sprint artifacts from `{sprint_management_path}/_bmad-output/implementation-artifacts/` (FR120). If none do natively, the gap is documented with a concrete remediation task
4. When single-repo is configured, all workflows behave identically to pre-Epic-16 behavior — verified by running a workflow in both modes and diffing output structure (NFR34)
5. Source-of-truth precedence is documented: `_bmad/bmm/config.yaml` is PRIMARY (runtime), `project-layout.yaml` is INFORMATIONAL (agent discovery), `project-context.md` is INSTRUCTIONAL (agent rules)
6. If workflows DO support config-driven paths: at least 3 end-to-end tests pass (planning read, sprint write, single-repo unchanged)
7. If workflows do NOT support config-driven paths: a backlog item is created with specific workflow files, line numbers, and required changes — NOT just a "gap analysis document"
8. External repo paths are validated for accessibility: directory exists and is readable (`fs.accessSync` with `R_OK`)

## Tasks / Subtasks

- [ ] Task 1: Audit BMAD workflow path resolution (AC: #1)
  - [ ] 1.1 Scan all workflow.yaml files in `_bmad/bmm/workflows/` for path variable patterns
  - [ ] 1.2 Check `config_source` references — currently all point to `_bmad/bmm/config.yaml`
  - [ ] 1.3 Check how `planning_artifacts` and `implementation_artifacts` variables are resolved:
    - Do they read from config.yaml? (e.g., `planning_artifacts: "{config_source}:planning_artifacts"`)
    - Or are they hardcoded? (e.g., `planning_artifacts: "_bmad-output/planning-artifacts"`)
  - [ ] 1.4 Grep for literal `_bmad-output/` strings in workflow files, SKILL.md files, and instruction files — each instance is a potential hardcoded path
  - [ ] 1.5 Create gap analysis table:

    | Workflow | Path Source | Hardcoded? | Config Key Used | Change Needed |
    |----------|-----------|-----------|----------------|---------------|
    | create-story | config.yaml | No | planning_artifacts | None |
    | ... | ... | ... | ... | ... |

- [ ] Task 2: Test config-driven path resolution (AC: #2, #3, #6)
  - [ ] 2.1 Set up test scenario: create temp directories for knowledgebase and sprint repos
  - [ ] 2.2 Write `knowledgebase_path` and `sprint_management_path` to `_bmad/bmm/config.yaml` pointing to temp dirs
  - [ ] 2.3 Run a planning workflow (e.g., `validate-prd`) — verify it reads from the configured knowledgebase path
  - [ ] 2.4 Run a sprint workflow (e.g., `create-story`) — verify it reads/writes from the configured sprint path
  - [ ] 2.5 If workflows read from config: document the resolution chain that works
  - [ ] 2.6 If workflows ignore config: document exactly which files and lines need changes

- [ ] Task 3: Verify single-repo backward compatibility (AC: #4)
  - [ ] 3.1 Set both paths to `"."` in config.yaml
  - [ ] 3.2 Run the same workflows as Task 2
  - [ ] 3.3 Verify output goes to current project's `_bmad-output/` — no behavioral change
  - [ ] 3.4 Diff output structure between pre-Epic-16 behavior and post-Epic-16 single-repo

- [ ] Task 4: Verify agent discovery paths (AC: #5, #8)
  - [ ] 4.1 Verify agents can read `_bmad-output/project-layout.yaml` to discover cross-repo paths
  - [ ] 4.2 Verify agents can read `_bmad/bmm/config.yaml` for the same information
  - [ ] 4.3 Document precedence: config.yaml is primary; project-layout.yaml is informational for agents that can't load BMAD config
  - [ ] 4.4 Test path accessibility: `fs.accessSync(configuredPath, fs.constants.R_OK)` — log clear error if path is inaccessible
  - [ ] 4.5 Test with knowledgebase path that lacks `_bmad-output/planning-artifacts/` directory — verify clear error message

- [ ] Task 5: Create remediation or confirmation artifacts (AC: #1-#8)
  - [ ] 5.1 **If paths resolve correctly**: Create `_bmad-output/implementation-artifacts/16-4-validation-report.md` confirming all tests pass
  - [ ] 5.2 **If gaps found**: Create concrete backlog items (not just a report) with:
    - Specific workflow file path and line number
    - Current hardcoded value
    - Required change (read from config key X)
    - Which FR/NFR the change satisfies
  - [ ] 5.3 If backlog items are needed, add them to sprint-status.yaml as new stories (e.g., `16-5-workflow-path-resolution-fix`)
  - [ ] 5.4 Update epic-16 sprint comments to reflect any added scope

## Dev Notes

### This Is a Validation Story WITH Defined Pass/Fail Criteria

Unlike a pure research spike, this story has concrete pass/fail acceptance criteria:

- **PASS**: Workflows resolve paths from config → end-to-end tests confirm → validation report created
- **PARTIAL PASS**: Workflows don't resolve from config → gaps documented with specific file/line remediation tasks added to backlog
- **FAIL**: Unable to determine how workflows resolve paths → should not happen given Task 1's audit approach

### Known Config Resolution Pattern

BMAD workflow.yaml files use this pattern:
```yaml
config_source: "{project-root}/_bmad/bmm/config.yaml"
planning_artifacts: "{config_source}:planning_artifacts"
implementation_artifacts: "{config_source}:implementation_artifacts"
```

The `{config_source}:field_name` syntax reads the value of `field_name` from the config file. If `_bmad/bmm/config.yaml` contains `planning_artifacts: "_bmad-output/planning-artifacts"`, workflows use that value.

**The key question**: Can we add `knowledgebase_path` and `sprint_management_path` to config.yaml and have workflows use them? This depends on whether workflows can be modified to derive `planning_artifacts` from `knowledgebase_path` — or if we need to change `planning_artifacts` itself to point to the external path.

**Most likely resolution**: Story 16.2 writes `planning_artifacts: "{knowledgebase_path}/_bmad-output/planning-artifacts"` and `implementation_artifacts: "{sprint_management_path}/_bmad-output/implementation-artifacts"` directly into `_bmad/bmm/config.yaml`. This means the existing `{config_source}:planning_artifacts` pattern in workflows "just works" without workflow modifications. **This approach should be validated in Task 2.**

### Source of Truth Precedence (Cross-Story)

| File | Role | Authority | When to Use |
|------|------|-----------|-------------|
| `_bmad/bmm/config.yaml` | Runtime config | PRIMARY | Workflows and agents resolving paths at execution time |
| `_bmad-output/project-layout.yaml` | Agent discovery | INFORMATIONAL | Agents in code repo that need to find external repos without loading BMAD config |
| `_bmad-output/project-context.md` | Agent rules | INSTRUCTIONAL | Agent constitutional doc — stamps paths as operating rules |

If these disagree, `_bmad/bmm/config.yaml` wins. Story 16.2 writes to config.yaml; Stories 16.2 and 16.3 write the other two files from the same source data.

### What to Do When Gaps Are Found

Do NOT just write a "gap analysis document" and close the story. Instead:
1. Create specific, actionable backlog stories
2. Add them to sprint-status.yaml
3. Include file paths, line numbers, and the exact change needed
4. Estimate scope: is this a 1-line config change or a multi-file workflow refactor?

### NFR Compliance

| NFR | How This Story Verifies It |
|-----|---------------------------|
| NFR34 | Single-repo mode: all workflows behave identically to pre-Epic-16 behavior |
| NFR37 | Audit verifies no workflow hardcodes `_bmad-output/` — all use config values |
| NFR9 | Path resolution verified on Windows (forward slash normalization) |

### Dependencies

- **Stories 16.1, 16.2, 16.3** must be complete — this story validates their output
- **BMAD workflows** — understanding how they resolve `config_source` variables is the core of this story

### Project Structure Notes

- Workflow configs: `_bmad/bmm/workflows/*/workflow.yaml` — check `config_source` and path variables
- BMAD config: `_bmad/bmm/config.yaml` (confirmed: this is where workflows read from)
- Cross-reference: `_bmad-output/project-layout.yaml`

### References

- [Source: _bmad-output/planning-artifacts/architecture.md — Decision P2-10, path resolution section, lines 873-901]
- [Source: _bmad-output/planning-artifacts/epics.md — Story 16.4, lines 2087-2117]
- [Source: _bmad-output/planning-artifacts/prd.md — FR119-FR122, lines 584-587]
- [Source: _bmad-output/planning-artifacts/prd.md — NFR34, NFR37, lines 657-660]
- [Source: _bmad/bmm/workflows/4-implementation/create-story/workflow.yaml — config_source pattern]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
