# Story 7.3: Add Tests for bmad.js Pipeline Ordering

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->
<!-- Dependency: Story 7-1 must be completed first (test framework setup) -->

## Story

As a **developer**,
I want tests verifying the BMAD pipeline executes stages in strict order,
So that customization ordering bugs are caught before release.

## Acceptance Criteria

1. **Given** tests exist for `bmad.js`
   **When** the test suite runs
   **Then** it verifies:
   - The 6-stage BMAD pipeline executes in correct order
   - YAML configs are applied before recompile
   - Workflows, templates, and agents are applied after recompile
   - Pipeline failure at any stage prevents subsequent stages from executing

## Tasks / Subtasks

- [ ] Task 1: Analyze bmad.js for testable functions (AC: #1)
  - [ ] 1.1: Map the 6-stage BMAD pipeline stages in `applyCustomizations()` (line 59)
  - [ ] 1.2: Identify which functions are exported vs internal
  - [ ] 1.3: Determine testability — `bmad.js` calls `npx bmad-method install` as a subprocess; tests must NOT trigger real BMAD installs
  - [ ] 1.4: Decide approach: test internal logic without triggering `child_process.exec` calls, or mock the exec calls
- [ ] Task 2: Create bmad.js tests (AC: #1)
  - [ ] 2.1: Create `tests/bmad.test.js`
  - [ ] 2.2: Test: `isBmadInstalled()` returns false for empty directory (use temp dir)
  - [ ] 2.3: Test: `isBmadInstalled()` returns true for directory containing `_bmad/` folder
  - [ ] 2.4: Test: exported functions exist (`installBmad`, `updateBmad`, `applyCustomizations`, `isBmadInstalled`, `registerMilWorkflows`)
  - [ ] 2.5: Test: `applyCustomizations()` processes config files in correct order (YAML configs before workflows/templates/agents)
  - [ ] 2.6: Test: customization file discovery — verify `fs.readdirSync` on `lib/bmad-customizations/` returns expected files
  - [ ] 2.7: Test: `lib/bmad-workflows/` directory exists and contains expected workflow content
  - [ ] 2.8: Test: `lib/mil498-templates/` directory exists and contains template files
- [ ] Task 3: Test pipeline ordering logic (AC: #1)
  - [ ] 3.1: Verify the `applyCustomizations()` function processes in this order:
    1. YAML config files (`.customize.yaml`)
    2. Recompile trigger
    3. Workflow customizations
    4. Template customizations
    5. Agent customizations
  - [ ] 3.2: Create a spy/tracker to verify execution order without triggering real file copies
  - [ ] 3.3: Test that the function signature matches expected parameters: `(projectRoot, modules, tools, selectedAgentIds)`

## Dev Notes

### Architecture Compliance

- **Test location:** `tests/bmad.test.js` [Source: architecture.md#Structure-Patterns]
- **Pipeline ordering is critical:** The 6-stage BMAD pipeline (NFR8) has strict ordering requirements. YAML configs MUST be applied before recompile, and workflows/templates/agents MUST be applied after. [Source: architecture.md#Pipeline-Architecture]
- **No real BMAD installs:** Tests must NOT call `npx bmad-method install` — this would modify the actual project's `_bmad/` directory. [Source: test isolation principle]

### bmad.js Module Structure

From [bmad.js:1-250](lib/bmad.js) — 250 lines, 5 exported functions:

```
isBmadInstalled(projectRoot)           — line 9  — checks for _bmad/ directory
installBmad(modules, tools, projectRoot) — line 13 — runs npx bmad-method install
updateBmad(modules, tools, projectRoot)  — line 36 — runs npx bmad-method update
applyCustomizations(projectRoot, ...)    — line 59 — 6-stage pipeline
registerMilWorkflows(projectRoot)        — line 170 — MIL-498 workflow registration
```

### Testing Challenge: Subprocess Calls

`installBmad()` and `updateBmad()` spawn child processes via `exec('npx bmad-method install ...')`. These functions are **not suitable for unit testing** without mocking `child_process`.

**Approach options:**
1. **Test only pure logic:** Focus on `isBmadInstalled()`, file discovery in `applyCustomizations()`, and function signatures. Skip subprocess-dependent functions.
2. **Mock child_process:** Intercept `exec` calls to verify command construction without executing. More complex but validates the pipeline.
3. **Hybrid:** Test what we can without mocking, defer subprocess testing to integration tests.

**Recommended:** Option 1 (pure logic) for this story. Focus on `isBmadInstalled()`, customization file discovery, and pipeline stage ordering verification.

### Pipeline Stage Ordering in applyCustomizations()

The function at line 59 applies customizations in this order:
1. Config YAML files → `lib/bmad-customizations/` configs
2. Recompile step → triggers BMAD recompile
3. Workflows → `lib/bmad-workflows/` content
4. Templates → `lib/mil498-templates/` content
5. Agent files → agent customize.yaml files

Verify ordering by checking the function's code flow, not by executing it.

### Critical Guardrails

- **Never trigger real BMAD installs** during tests — no `npx bmad-method` execution
- **Use temp directories** for `isBmadInstalled()` tests
- **No new npm dependencies** — use `node:test` and `node:assert` only
- **Do not modify `lib/bmad.js`** — tests validate existing behavior

### Project Structure Notes

- Files to create: `tests/bmad.test.js`
- No changes to `lib/` source files

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Epic-7] — Story 7.3 definition
- [Source: _bmad-output/planning-artifacts/architecture.md#Pipeline-Architecture] — BMAD 6-stage pipeline, NFR8
- [Source: lib/bmad.js] — BMAD module (250 lines, 5 exported functions)
- [Source: _bmad-output/implementation-artifacts/7-1-test-infrastructure-setup.md] — Prerequisite story

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
