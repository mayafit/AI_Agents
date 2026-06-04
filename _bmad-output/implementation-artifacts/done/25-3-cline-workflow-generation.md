# Story 25.3: Cline Workflow Generation

Status: done

## Completion Note

Completed 2026-05-01. `deployClineWorkflows()` implemented in `lib/bmad.js` (lines 1381–1440) and called from all three BMAD entry points: `installBmad()` (line 755), `updateBmad()` (line 872), and `runMigration()` (line 953). Function exported at line 2561. Two wrapper strategies: delegate to `workflow.md` when present, otherwise read `SKILL.md` with frontmatter-ignore instruction. No-op when `'cline'` is not in `tools` array. FR199–FR201 satisfied. Architecture Decision P5-3 implemented.

## Story

As a **Cline user who has installed BMAD skills via ma-agents**,
I want `.clinerules/workflows/<skill-name>.md` wrapper files to be auto-generated for every installed BMAD skill,
So that I can invoke any BMAD skill via Cline's native `/` command menu without manually reading `SKILL.md`.

## Acceptance Criteria

1. **Given** `cline` is among the selected tools for a BMAD install, update, or migration, **When** the operation completes, **Then** `deployClineWorkflows(projectRoot, tools)` is invoked — scanning `.cline/skills/` for all BMAD-installed skill subdirectories and generating a `.clinerules/workflows/<skill-name>.md` wrapper file for each one. *(FR199)*

2. **Given** a skill directory at `.cline/skills/<skill-name>/` that contains a `workflow.md` file, **When** `deployClineWorkflows` processes that skill, **Then** the generated wrapper at `.clinerules/workflows/<skill-name>.md` delegates to `workflow.md` — instructing Cline to read and follow that file, enabling native `/workflow-name` invocation via the full BMAD workflow document. *(FR200)*

3. **Given** a skill directory at `.cline/skills/<skill-name>/` that contains only `SKILL.md` (no `workflow.md`), **When** `deployClineWorkflows` processes that skill, **Then** the generated wrapper instructs Cline to read `SKILL.md` while ignoring its YAML frontmatter block, which Cline does not natively parse. *(FR200)*

4. **Given** `cline` is NOT in the `tools` array, **When** `deployClineWorkflows` is called, **Then** it returns immediately without accessing the filesystem — non-Cline installs are completely unaffected. *(FR199)*

5. **Given** BMAD skills are added, updated, or removed across successive installs/updates/migrations, **When** each qualifying run completes, **Then** `deployClineWorkflows` regenerates all wrappers from the current state of `.cline/skills/` — keeping `.clinerules/workflows/` in sync. *(FR201)*

6. **Given** `.cline/skills/` does not yet exist (e.g., BMAD install did not run for this path), **When** `deployClineWorkflows` is called, **Then** it returns immediately without error. *(FR199)*

7. **Given** `.clinerules/workflows/` does not exist, **When** `deployClineWorkflows` generates its first wrapper, **Then** the directory is created automatically (`fs.ensureDir`). *(FR199)*

## Tasks / Subtasks

### Task 1: Implement deployClineWorkflows (AC: 1, 2, 3, 4, 6, 7)

- [x] 1.1 Add `async function deployClineWorkflows(projectRoot, tools = [])` to `lib/bmad.js`
- [x] 1.2 Early-return if `!tools.includes('cline')`
- [x] 1.3 Early-return if `.cline/skills/` does not exist (`fs.pathExists`)
- [x] 1.4 Ensure `.clinerules/workflows/` directory exists (`fs.ensureDir`)
- [x] 1.5 Read all subdirectories of `.cline/skills/` using `fs.readdir` with `withFileTypes: true`
- [x] 1.6 For each subdirectory that contains `SKILL.md`: parse YAML frontmatter to extract `name` and `description` fields; fall back to title-cased `skillName` if frontmatter is absent
- [x] 1.7 If `workflow.md` exists in the skill directory: generate delegation wrapper pointing to `workflow.md`
- [x] 1.8 If `workflow.md` is absent: generate wrapper that reads `SKILL.md` with frontmatter-ignore instruction
- [x] 1.9 Write wrapper to `.clinerules/workflows/<skill-name>.md`
- [x] 1.10 Log success count via `chalk.green` and Cline tip via `chalk.gray` when at least one wrapper is generated
- [x] 1.11 Export `deployClineWorkflows` from the module exports object

### Task 2: Wire call sites (AC: 1, 5)

- [x] 2.1 Call `await deployClineWorkflows(projectRoot, tools)` in `installBmad()` immediately after `deployMethodology()`
- [x] 2.2 Call `await deployClineWorkflows(projectRoot, tools)` in `updateBmad()` immediately after `deployMethodology()`
- [x] 2.3 Call `await deployClineWorkflows(projectRoot, tools)` in `runMigration()` immediately after `deployMethodology()`

## Dev Notes

### Architecture Decision

This story implements **Architecture Decision P5-3** from `_bmad-output/planning-artifacts/architecture.md`. Key design points:

- `deployClineWorkflows` is a **post-install step**, not part of the BMAD installer itself. It bridges the gap between BMAD's skill deposit location (`.cline/skills/`) and Cline's native slash-command discovery location (`.clinerules/workflows/`).
- The function is a **no-op** for non-Cline installs — the `tools.includes('cline')` guard on line 1382 ensures no filesystem access when Cline is not selected.
- **Two wrapper strategies** are used depending on the skill package contents:
  - Skills with `workflow.md` → delegation wrapper (preferred entry point, full workflow document)
  - Skills with `SKILL.md` only → read-and-ignore-frontmatter wrapper (YAML frontmatter is a Claude Code convention; Cline does not parse it natively)
- **Regeneration on every run** (not incremental): wrappers are rewritten on every qualifying install/update/migration, ensuring they stay in sync when the skill set changes.

### Implementation Location

- **`lib/bmad.js` line 1381** — `async function deployClineWorkflows(projectRoot, tools = [])`
- **`lib/bmad.js` line 755** — call site in `installBmad()`
- **`lib/bmad.js` line 872** — call site in `updateBmad()`
- **`lib/bmad.js` line 953** — call site in `runMigration()`
- **`lib/bmad.js` line 2561** — export entry `deployClineWorkflows`

### Wrapper Format

For skills **with** `workflow.md`:
```markdown
# <Display Name>

<description if present>

## Step 1: Read and follow the BMAD skill workflow
Read the file `.cline/skills/<skill-name>/workflow.md` and follow all instructions within it exactly.
```

For skills **without** `workflow.md` (SKILL.md only):
```markdown
# <Display Name>

<description if present>

## Step 1: Read and follow the BMAD skill instructions
Read the file `.cline/skills/<skill-name>/SKILL.md`. Ignore the YAML frontmatter block (the `---` delimited section at the top of the file). Follow all instructions in the body of that file exactly.
```

### Relationship to Existing Epics

- **Epic 21, Story 21.5** (Expanded `.clinerules` Template) — covers the instruction injection side (`.cline/clinerules.md` / `.clinerules`). This story covers the workflow discovery side (`.clinerules/workflows/`). The two are orthogonal and non-conflicting.
- **Epic 18** (Roo Code / Cline migration) — Story 18.7 notes that bmad-method's cleanup for Cline removes `.clinerules/workflows`. `deployClineWorkflows` re-populates it on every install/update, so migration runs that call the BMAD installer afterward will correctly repopulate. No conflict.
- **FR Coverage** — FR199–FR201 are new requirements added to the PRD in section "Cline Workflow Generation". This story is the sole implementor of all three.

### Files Changed

- **`lib/bmad.js`** — sole modified file. Three call sites wired, one function added (~60 lines), one export entry added.

## PRD Traceability

| Requirement | Description |
|-------------|-------------|
| FR199 | `deployClineWorkflows(projectRoot, tools)` invoked on install/update/migration when Cline is selected; scans `.cline/skills/` and generates `.clinerules/workflows/<skill-name>.md` wrappers |
| FR200 | Skills with `workflow.md` get delegation wrappers; SKILL.md-only skills get read-with-frontmatter-ignore wrappers |
| FR201 | Wrappers regenerated on every qualifying run — stay in sync when skills are added, updated, or removed |

## Architecture Traceability

| Decision | Description |
|----------|-------------|
| P5-3 | Post-install `deployClineWorkflows()` step bridging `.cline/skills/` to `.clinerules/workflows/`; two wrapper strategies; no-op for non-Cline installs; called from all three BMAD entry points |

## Change Log

| Date | Version | Author | Description |
|------|---------|--------|-------------|
| 2026-05-01 | 1.0.0 | Claude Code | Story created (retroactive) — implementation already complete in lib/bmad.js |
