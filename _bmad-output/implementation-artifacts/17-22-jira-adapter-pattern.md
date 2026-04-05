# Story 17.22: Jira Adapter Pattern (tracking_system Switch) -- Design Specification

Status: ready-for-dev

## Agent Discussion: Scope Reframing

**Winston (Architect):** The original story was written as an implementation story -- it specified `FilesystemBackend` and `JiraBackend` objects, interface methods with code-level signatures, and tasks to modify all 13 skills to call `resolveBackend()`. That is wrong for two reasons. First, this project's "skills" are markdown instruction files (SKILL.md), not executable code modules. There is no runtime to host an adapter object. Skills are natural-language instruction sets that AI agents follow -- they cannot import or instantiate backend objects. Second, the actual Jira implementation (API calls, authentication, status mapping) is Epic 14 scope, specifically Story 14.4 (Implement Jira Sprint Management Backend), which is blocked on Story 14.3 (architecture ADR). This story should define the *pattern* that all skills follow: how they detect the backend, what conditional instruction paths they contain, and what the adapter contract looks like. It is a design specification, not a code implementation.

**John (PM):** Agreed. The deliverable for 17.22 should be a reference document -- similar to how Story 17.9 delivered `sprint-status-schema.md` as the canonical schema specification. This story delivers a canonical adapter pattern specification that: (a) documents the `tracking_system` detection logic every skill must include, (b) defines the adapter interface contract that Epic 14 must satisfy, (c) enumerates the operation categories each skill performs so the adapter knows what to implement, and (d) provides the skill-level instruction template that Stories 17.10-17.21 should embed. The acceptance criteria must be testable against the document itself, not against running code.

**Mary (Analyst):** The PRD references are FR138 (same data model, different storage backend), FR139 (tracking_system determines backend; `jira` config surfaces "not yet implemented" message), and FR140 (all sprint skills reworked for unified file). FR139 is key -- it explicitly states that skills must NOT fail when `tracking_system: jira` is configured; they should surface a clear message. That means every skill already being reworked (17.10-17.21, 17.24) needs a conditional check. The adapter pattern spec should provide the exact instruction text those skills embed. The epics.md also says 17.22 is blocked on Epic 14 Story 14.3 -- but the *design specification* is not blocked. Only the Jira *implementation* depends on 14.3. We can and should deliver the adapter pattern spec now, so all skills being reworked can include the right conditional paths.

## Story

As an **Architect**,
I want a canonical adapter pattern specification that defines how all 13 sprint management skills detect and switch between the `file-system` and `jira` backends based on the `tracking_system` field in `sprint-status.yaml`,
So that every skill reworked in Stories 17.10-17.21 and 17.24 includes the correct conditional instruction paths, and Epic 14 has a clear contract to implement against.

## Acceptance Criteria

1. **Given** the adapter pattern specification is complete,
   **When** a developer reads it,
   **Then** it defines the exact backend detection logic: read the `tracking_system` field from `sprint-status.yaml` metadata, branch on its value (`file-system` or `jira`), and for any unrecognized value, surface an error message identifying the unsupported backend.

2. **Given** the specification defines the adapter interface contract,
   **When** reviewed against the unified schema (Story 17.9),
   **Then** it enumerates every data operation category that skills perform: read operations (read full state, search for item, read sprint, read backlog), write operations (write full state, update item status in-place, move item between sections, add/remove items, archive items), and lifecycle operations (create sprint, close sprint, activate sprint),
   **And** each operation category maps to one or more of the 13 skills,
   **And** the contract specifies that all operations consume and produce data conforming to the sprint-status.yaml schema (Story 17.9 Sections 1-4).

3. **Given** the specification includes a skill instruction template,
   **When** the template is reviewed,
   **Then** it provides the exact markdown instruction block that each skill's SKILL.md should embed for backend detection,
   **And** the template includes: (a) a `tracking_system` check at workflow entry, (b) a `file-system` path that proceeds with local YAML read/write, (c) a `jira` path that outputs a clear "Jira backend is not yet implemented" message and halts gracefully (FR139), and (d) an `unknown` path that reports the unsupported backend value.

4. **Given** the specification maps all 13 skills to their operation categories,
   **When** reviewed against Stories 17.10-17.21 and 17.24,
   **Then** every skill is listed with: its story number, whether it is an IDE skill only or dual-pipeline (IDE + BMAD extension), and which operation categories it uses,
   **And** the mapping is consistent with the Skill Integration Map in the sprint-status schema (Story 17.9 Section 7).

5. **Given** the specification documents future Jira adapter requirements,
   **When** reviewed by the architect designing Story 14.3,
   **Then** it specifies: (a) the Jira adapter must implement every operation category from AC 2, (b) it must map Jira data to the canonical sprint-status.yaml schema, (c) it must handle authentication via configuration in `project-context.md` (credentials source deferred to Epic 14 research), (d) it must handle errors explicitly with no silent fallback to file-system, and (e) the adapter must be extensible for future backends (Linear, Azure DevOps) without changing skill instruction logic.

6. **Given** the specification documents integration with both deployment pipelines,
   **When** reviewed against the ma-agents deployment architecture,
   **Then** it confirms: (a) IDE skills (`skills/<name>/SKILL.md`) embed the backend detection instructions directly in each skill's workflow, (b) BMAD extension skills (`lib/bmad-extension/skills/<name>/SKILL.md`) embed the same detection instructions, (c) no shared "adapter module" file is needed because skills are markdown instruction documents executed by AI agents (not importable code), and (d) the `tracking_system` field is read from `sprint-status.yaml` which exists at a fixed path relative to the project root.

7. **Given** the specification is delivered as a reference document,
   **When** it is placed in the planning artifacts directory,
   **Then** it is located at `_bmad-output/planning-artifacts/adapter-pattern-spec.md`,
   **And** it follows the same reference document format as `sprint-status-schema.md` (Story 17.9 deliverable).

## Tasks / Subtasks

### Task 1: Define backend detection logic (AC: 1)

- [ ] 1.1 Document the `tracking_system` field location: top-level metadata in `sprint-status.yaml` (Section 1.1 of sprint-status-schema.md).
- [ ] 1.2 Document the detection algorithm: read the file, extract `tracking_system` value, branch on value.
- [ ] 1.3 Define the three valid branches: `file-system` (proceed with local YAML), `jira` (delegate to adapter or surface "not implemented"), unrecognized value (error with message).
- [ ] 1.4 Document the default behavior: if `tracking_system` is absent or empty, treat as `file-system`.
- [ ] 1.5 Document the detection timing: the check occurs at the START of every skill workflow, before any read/write operations.

### Task 2: Define the adapter interface contract (AC: 2)

- [ ] 2.1 Enumerate read operations:
  - `readFullState()` -- read entire sprint-status.yaml equivalent; returns the full data model (metadata + epics + backlog + sprints)
  - `findItem(id)` -- search backlog and all sprint items for an item by ID; returns item + location (backlog or sprint-N)
  - `readSprint(sprintId)` -- read a single sprint entity with its items
  - `readBacklog()` -- read the backlog array
  - `readEpics()` -- read the epics map
- [ ] 2.2 Enumerate write operations:
  - `writeFullState(data)` -- write the complete data model (used by bootstrap/regeneration skills)
  - `updateItemStatus(id, newStatus)` -- in-place status update on an item wherever it resides
  - `moveItemToSprint(id, targetSprintId)` -- atomic move from backlog to sprint (drops priority, validates status)
  - `moveItemToBacklog(id)` -- atomic move from sprint to backlog (adds priority, resets status)
  - `addItems(section, items)` -- add new items to backlog or sprint
  - `removeItems(section, itemIds)` -- remove items from backlog or sprint
  - `updateBacklogPriorities(orderedIds)` -- reorder backlog and renumber priorities
- [ ] 2.3 Enumerate lifecycle operations:
  - `createSprint(sprintData)` -- add a new sprint entry
  - `activateSprint(sprintId)` -- transition sprint from planning to active (enforcing single-active constraint)
  - `closeSprint(sprintId)` -- transition sprint from active to closed
  - `archiveItems(itemIds, archivePath)` -- remove items from file and move story files to done/
  - `updateEpics(epicsData)` -- refresh the epics section
- [ ] 2.4 Map each operation to the skills that invoke it (cross-reference table with all 13 skills).
- [ ] 2.5 Document that all operations consume and produce data conforming to the sprint-status.yaml schema (Story 17.9 Sections 1-4) -- the schema IS the data contract for all backends.
- [ ] 2.6 Document that operations enforce the schema invariants (single-location, in-place status update, single-active-sprint) regardless of backend.

### Task 3: Create the skill instruction template (AC: 3)

- [ ] 3.1 Write the exact markdown instruction block for backend detection that skills embed at the start of their workflow. The template should be:
  ```markdown
  ## Backend Detection

  Before performing any read or write operations:

  1. Read `sprint-status.yaml` and extract the `tracking_system` metadata field
  2. If `tracking_system` is `file-system` (or absent/empty): proceed with the File-System Backend instructions below
  3. If `tracking_system` is `jira`: **STOP** -- output the following message and halt:
     > "Jira backend is not yet implemented. The `tracking_system` field in sprint-status.yaml is set to `jira`, but Jira integration requires Epic 14 (External Tooling Integration). Set `tracking_system: file-system` to use local file management, or wait for Jira support."
  4. If `tracking_system` is any other value: **STOP** -- output:
     > "Unsupported tracking system: `{value}`. Supported values are `file-system` and `jira` (future)."
  ```
- [ ] 3.2 Document that this template must appear in every sprint management skill's SKILL.md, in both the IDE skill version and the BMAD extension version (where applicable).
- [ ] 3.3 Document that the template is placed BEFORE the skill's main workflow steps -- it is a gateway check, not an afterthought.
- [ ] 3.4 Document that when the Jira adapter is eventually implemented (Epic 14), the `jira` branch will be replaced with actual Jira adapter instructions instead of the "not implemented" message.

### Task 4: Create the skill-to-operation mapping table (AC: 4)

- [ ] 4.1 For each of the 13 skills, document:
  - Story number (17.10-17.21, 17.24)
  - Skill name
  - Pipeline: IDE-only or dual-pipeline (IDE + BMAD extension)
  - Operation categories used (from Task 2 enumeration)
  - Read/write classification (read-only, write, or mixed)
- [ ] 4.2 Verify the mapping is consistent with the Skill Integration Map in sprint-status-schema.md (Section 7).
- [ ] 4.3 Identify which operations are read-only (and thus simpler to adapt) vs which involve writes (and require careful Jira API mapping).

### Task 5: Document Jira adapter requirements for Epic 14 (AC: 5)

- [ ] 5.1 Document that the Jira adapter must implement every operation category from Task 2 (or document which operations are N/A for Jira and why).
- [ ] 5.2 Document the Jira data model mapping:
  - Jira Sprint --> `sprints[]` entry (with `items` populated from sprint backlog query)
  - Jira Board Backlog --> `backlog[]` entries
  - Jira Epic --> `epics[]` entry
  - Jira Issue Status --> canonical status vocabulary (`backlog`, `ready-for-dev`, `in-progress`, `review`, `done`, `on-hold`, `cancelled`)
- [ ] 5.3 Document that status mapping must be configurable (Jira workflow statuses vary by project).
- [ ] 5.4 Document error handling requirements:
  - Network errors: report error with connection details, do NOT fall back to file-system
  - Authentication failures (401/403): report credential issue, suggest checking config
  - Rate limits (429): report rate limit, include retry-after if available
  - Never fall back to file-system silently -- explicit fail with clear error message
- [ ] 5.5 Document credential configuration: deferred to Epic 14 research (Story 14.1) and architecture (Story 14.3). The adapter pattern spec does not prescribe credential storage -- it only requires that the adapter have access to credentials and that missing credentials cause a clear error at detection time.
- [ ] 5.6 Document extensibility: the adapter pattern must support future backends (Linear, Azure DevOps) by adding a new adapter implementation without changing any skill SKILL.md files. The `tracking_system` field gains a new valid value; the backend detection template gains a new branch.
- [ ] 5.7 Document that when `tracking_system: jira` is active, `sprint-status.yaml` is NOT the source of truth -- Jira is. The local file may exist as a read-only cache but is never written to by skills.

### Task 6: Document deployment pipeline integration (AC: 6)

- [ ] 6.1 Document that the adapter pattern does NOT create a shared module, library, or importable file. Skills are markdown instruction documents. The "adapter" is a pattern embedded in each skill's instructions, not a code artifact.
- [ ] 6.2 Document how the pattern integrates with Pipeline 1 (IDE skills):
  - Each skill at `skills/<name>/SKILL.md` includes the backend detection template from Task 3
  - The installer deploys these to all IDE agent directories unchanged
  - No changes to `lib/installer.js` -- the adapter pattern is in the skill content, not the deployment mechanism
- [ ] 6.3 Document how the pattern integrates with Pipeline 2 (BMAD extension skills):
  - Each BMAD extension skill at `lib/bmad-extension/skills/<name>/SKILL.md` includes the same backend detection template
  - The BMAD deployer copies these to `_bmad/extensions/ma-agents-skills/` unchanged
  - No changes to `lib/bmad.js` -- same principle
- [ ] 6.4 Document that IDE-only skills (e.g., `story-status-lookup` per Story 17.19) include the detection template in their single SKILL.md; dual-pipeline skills include it in both copies.
- [ ] 6.5 Document that `sprint-status.yaml` path resolution (`_bmad-output/implementation-artifacts/sprint-status.yaml` relative to project root, or via `sprint_management_path` config in multi-repo mode) is unchanged -- the adapter pattern does not affect file location logic.

### Task 7: Write the reference document (AC: 7)

- [ ] 7.1 Create `_bmad-output/planning-artifacts/adapter-pattern-spec.md` as the canonical adapter pattern specification.
- [ ] 7.2 Structure the document with numbered sections similar to `sprint-status-schema.md`:
  - Section 1: Overview and Purpose
  - Section 2: Backend Detection Logic
  - Section 3: Adapter Interface Contract (operation categories)
  - Section 4: Skill Instruction Template
  - Section 5: Skill-to-Operation Mapping Table
  - Section 6: Jira Adapter Requirements (for Epic 14)
  - Section 7: Deployment Pipeline Integration
  - Section 8: Future Backend Extensibility
- [ ] 7.3 Include cross-references to sprint-status-schema.md, architecture P2-11, PRD FR138-FR140, and Epic 14 stories.
- [ ] 7.4 Review the document against all acceptance criteria before marking complete.

## Dev Notes

### What This Story IS

This is a **design specification** story, not a skill implementation story. The deliverable is a canonical adapter pattern specification document that serves as the contract for: (a) all 13 skills being reworked to include backend detection, and (b) the future Jira adapter implementation in Epic 14. Think of it as the companion to Story 17.9's schema specification -- 17.9 defined *what the data looks like*, 17.22 defines *how skills access the data through different backends*.

### What This Story Is NOT

This story does NOT:
- Implement a Jira adapter (that is Epic 14, Story 14.4)
- Create any executable code, modules, or libraries
- Modify any existing skill files (Stories 17.10-17.21, 17.24 each embed the template themselves)
- Design the Jira authentication architecture (that is Epic 14, Story 14.3)
- Change any deployment pipeline logic (no changes to `lib/installer.js` or `lib/bmad.js`)

### Why This Is Not an Implementation Story

The original version of Story 17.22 specified code-level tasks: creating `FilesystemBackend` and `JiraBackend` objects, implementing `resolveBackend()` functions, and modifying 13 skills to call through backend interfaces. This fundamentally misunderstands the project's architecture:

1. **Skills are markdown, not code.** A SKILL.md file is a natural-language instruction set for AI agents. There is no runtime, no module system, no import mechanism. You cannot "implement a backend object" in a markdown file.

2. **The "adapter" is a conditional instruction pattern.** When a skill checks `tracking_system` and branches, it does so through prose instructions in the SKILL.md, not through a function call. The "interface" is a specification of what operations the Jira adapter must support, not a TypeScript interface.

3. **Each skill embeds the pattern independently.** There is no shared module to import. Each skill's SKILL.md contains its own copy of the backend detection instructions. This is consistent with how skills work in both deployment pipelines -- they are self-contained instruction documents.

4. **The Jira implementation is Epic 14 scope.** Story 14.3 designs the abstraction layer architecture. Story 14.4 implements the Jira backend. This story only defines the pattern and contract that bridges Epic 17 (current sprint skills) and Epic 14 (future Jira integration).

### Relationship to Story 17.9

Story 17.9 delivered `sprint-status-schema.md` -- the canonical YAML schema that defines the data model. Story 17.22 delivers `adapter-pattern-spec.md` -- the canonical adapter pattern that defines how skills access that data model through different backends. Together, they form the complete "interface specification" for the sprint management system:

| Specification | Story | Deliverable | Defines |
|---|---|---|---|
| Data model | 17.9 | `sprint-status-schema.md` | What the data looks like |
| Access pattern | 17.22 | `adapter-pattern-spec.md` | How skills read/write the data |

### The 13 Affected Skills and Their Pipelines

| Skill | Story | Pipeline | Read/Write | Notes |
|---|---|---|---|---|
| `generate-backlog` | 17.10 | IDE + BMAD | Write | Regenerates backlog + epics sections |
| `add-to-sprint` | 17.11 | IDE + BMAD | Write | Moves items backlog --> sprint |
| `remove-from-sprint` | 17.12 | IDE + BMAD | Write | Moves items sprint --> backlog |
| `sprint-status-view` | 17.13 | IDE + BMAD | Read-only | Renders sprint progress display |
| `cleanup-done` | 17.14 | IDE + BMAD | Write | Archives done items, removes from file |
| `bmad-sprint-planning` | 17.15 | IDE + BMAD | Write | Bootstraps entire sprint-status.yaml |
| `add-sprint` | 17.16 | IDE + BMAD | Write | Adds new sprint entry |
| `modify-sprint` | 17.17 | IDE + BMAD | Write | Updates sprint metadata/items |
| `bmad-dev-story` | 17.18 | IDE + BMAD | Write | Updates item status during development |
| `story-status-lookup` | 17.19 | IDE only | Read-only | Searches for item status (always_load) |
| `bmad-sprint-status` | 17.20 | IDE + BMAD | Read-only | Summarizes sprint health |
| `close-sprint` | 17.21 | IDE + BMAD | Write | Full sprint close lifecycle |
| `prioritize-backlog` | 17.24 | IDE + BMAD | Write | Reorders backlog items |

### Existing Jira Extension Point

The `story-status-lookup` skill (Story 17.19) already contains a "Future: Jira Backend" section that serves as a placeholder. This was created during the original skill implementation and represents the first instance of the adapter pattern. The adapter pattern spec (this story's deliverable) formalizes and generalizes this approach for all 13 skills.

Current placeholder in `skills/story-status-lookup/SKILL.md`:
```markdown
## Future: Jira Backend

When `sprint_management: jira` is set in the project context, this extension point applies:
- Jira base URL, project key, and credentials will be defined in the project context or environment config
- Query the Jira issue status API for the relevant issue key
- Map the Jira workflow status to delivered/WIP using a status mapping defined in the project context

**This backend is not yet implemented.**
```

The adapter pattern spec standardizes this approach so all skills use the same detection logic, the same message text, and the same future extension structure.

### Unified Schema Sections Touched

- **None directly.** This story does not modify `sprint-status.yaml`. It defines a pattern that other stories embed when they implement their skills.

### Deliverable Location

`_bmad-output/planning-artifacts/adapter-pattern-spec.md` -- a standalone reference document alongside `sprint-status-schema.md`.

### Cross-References

- **Story 17.9** (prerequisite): Defines the unified `sprint-status.yaml` schema. The adapter pattern uses this schema as its data contract. Deliverable: `sprint-status-schema.md`.
- **Stories 17.10-17.21, 17.24** (consumers): All 13 skills being reworked will embed the backend detection template from this specification.
- **Story 17.19** (existing pattern): `story-status-lookup` already has a Jira extension point placeholder that this specification formalizes.
- **Epic 14, Story 14.1** (downstream): Analyst research on Jira integration -- feeds into adapter requirements.
- **Epic 14, Story 14.3** (downstream): Architecture design for external tooling abstraction layer -- must satisfy the interface contract defined here.
- **Epic 14, Story 14.4** (downstream): Jira backend implementation -- implements the adapter operations defined here, replaces the "not yet implemented" message in all skills.
- **Architecture P2-11** (reference): Unified Sprint-Status File Architecture decision, including the Jira Adapter Pattern section.

### PRD Traceability

| Requirement | Description | How This Story Addresses It |
|---|---|---|
| FR138 | Same data model, different storage backend (tracking_system switch) | Defines the adapter pattern that enables this: same schema, different I/O layer |
| FR139 | `tracking_system` field determines backend; `jira` config surfaces "not yet implemented" message | Specifies the exact detection logic and message text for the `jira` branch |
| FR140 | All sprint skills reworked for unified file | Provides the backend detection template that all reworked skills must embed |
| FR133 | `sprint-status.yaml` metadata includes `tracking_system` field | Documents how skills read and interpret this field |

### Architecture Reference

- Architecture Decision P2-11: Unified Sprint-Status File Architecture, "Jira Adapter Pattern" subsection in `_bmad-output/planning-artifacts/architecture.md`
- Sprint-Status YAML Schema Reference: `_bmad-output/planning-artifacts/sprint-status-schema.md` (Section 5: Tracking System Adapter Contract)
- Epic 14: External Tooling Integration in `_bmad-output/planning-artifacts/epics.md`

### Project Structure Notes

- Adapter pattern spec location: `_bmad-output/planning-artifacts/adapter-pattern-spec.md`
- Schema spec location: `_bmad-output/planning-artifacts/sprint-status-schema.md`
- Sprint status file: `_bmad-output/implementation-artifacts/sprint-status.yaml`
- IDE skill source: `skills/<name>/skill.json` + `skills/<name>/SKILL.md`
- BMAD extension source: `lib/bmad-extension/skills/<name>/SKILL.md` + `bmad-skill-manifest.yaml`
- Install locations (never edit): `.claude/skills/`, `.cursor/skills/`, etc.
