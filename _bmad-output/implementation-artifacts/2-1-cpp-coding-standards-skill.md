# Story 2.1: Create C++ Best Practices Skill

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **C++ engineer**,
I want a C++ coding standards and best practices skill available in ma-agents,
So that my AI coding agent follows our organization's C++ methodology consistently.

## Acceptance Criteria

1. **Given** the C++ skill directory exists at `skills/cpp-best-practices/`
   **When** the skill is listed via `npx ma-agents list`
   **Then** it appears with description referencing C++ standards and tags including "cpp"
   **And** `skill.json` contains valid metadata including `applies_when` conditions for C++ contexts

2. **Given** the C++ skill is installed to any supported agent
   **When** the agent receives the skill content
   **Then** it contains C++ coding standards, naming conventions, memory management patterns, and best practices
   **And** the content is applicable to modern C++ (C++17/20/23)
   **And** cross-references to domain-specific C++ skills are informational (e.g., "if installed, see...")

3. **Given** the skill directory contains `skill.json` and `SKILL.md`
   **When** installed across multiple agents
   **Then** the `SKILL.md` canonical content is used (no agent-specific templates exist for this skill)
   **And** the installed content is identical across all target agents

## Tasks / Subtasks

- [ ] Task 1: Create skill directory and metadata (AC: #1)
  - [ ] 1.1: Create directory `skills/cpp-best-practices/`
  - [ ] 1.2: Create `skill.json` with all required fields (see skill.json Schema section below). Must include `applies_when` array for skill discovery and `always_load: true` (this is the umbrella C++ skill).
  - [ ] 1.3: Verify `npx ma-agents list` shows the new skill with correct metadata
- [ ] Task 2: Author SKILL.md content (AC: #2)
  - [ ] 2.1: Write C++ coding standards covering: naming conventions, code organization, modern C++ idioms. Target practical density — prioritize high-value rules over exhaustive coverage. If content naturally exceeds 500 lines, use `references/` directory for supplementary material.
  - [ ] 2.2: Include memory management best practices — cross-reference existing `cpp-memory-handling` skill using informational language ("if the `cpp-memory-handling` skill is installed, it provides detailed RAII/smart pointer patterns"). Do NOT assume sibling skills are co-installed.
  - [ ] 2.3: Include modern C++ patterns: structured bindings, std::optional, std::variant, constexpr, concepts (C++20), ranges (C++20), modules awareness (C++20/23)
  - [ ] 2.4: Include error handling patterns: exceptions vs error codes, std::expected (C++23), noexcept guidelines
  - [ ] 2.5: Include build and compilation guidelines: warning levels, sanitizers, compiler flags. Cross-reference `cmake-best-practices` skill for CMake-specific guidance.
  - [ ] 2.6: Cross-reference all 6 existing C++ related skills using conditional language (see Dev Notes — Relationship to Existing C++ Skills)
  - [ ] 2.7: Optionally create `examples/` directory with representative code samples, consistent with peer C++ skills which all include `examples/`
- [ ] Task 3: Verify installation across agents (AC: #3)
  - [ ] 3.1: Install to at least 2 different agents (e.g., claude-code and cursor)
  - [ ] 3.2: Verify installed content is identical across agents (SKILL.md fallback is the only path)
  - [ ] 3.3: Verify `generateSkillsManifest()` produces correct MANIFEST.yaml entries — check that `applies_when` conditions and `always_load` flag are present in the generated manifest

## Dev Notes

### Architecture Compliance

- **Skill schema contract:** Every skill MUST have `skill.json` (metadata SSoT) + `SKILL.md` (canonical content). Optional directories: `examples/`, `references/`, `scripts/`, `hooks/`, `assets/`. [Source: architecture.md#Data-Architecture]
- **Directory naming:** `kebab-case` for skill directories [Source: architecture.md#Naming-Patterns]
- **No installer changes needed:** Adding a new skill requires ONLY the skill package files — the installer discovers skills by scanning the `skills/` directory via `listSkills()`. [Source: architecture.md#Extensibility-Model, NFR14]
- **Template resolution:** `<agent-name>.md` (highest) -> `generic.md` -> `SKILL.md` (lowest/fallback). Templates are flat files at the skill root — there is NO `templates/` subdirectory. For this skill, `SKILL.md` alone is sufficient.

### Relationship to Existing C++ Skills

**6** C++ related skills already exist in the library:

| Existing Skill | Focus | `always_load` | Relationship |
|---------------|-------|--------------|-------------|
| `cpp-memory-handling` | RAII, smart pointers, no raw new/delete | false | Deep-dive — cross-reference |
| `cpp-const-correctness` | Const semantics | false | Deep-dive — cross-reference |
| `cpp-concurrency-safety` | Thread safety patterns | false | Deep-dive — cross-reference |
| `cpp-modern-composition` | Composition over inheritance | **true** | Deep-dive — cross-reference |
| `cpp-robust-interfaces` | Interface design patterns | false | Deep-dive — cross-reference |
| `cmake-best-practices` | CMake build system | **true** | Build — cross-reference from Task 2.5 |

**This skill is the umbrella** — it covers broad C++ coding standards and naming conventions, while referencing the domain-specific skills for deeper coverage. It should NOT duplicate content from existing skills.

**Cross-reference pattern:** Because sibling skills may not be co-installed, use conditional language:
```markdown
> For detailed memory management patterns, see the `cpp-memory-handling` skill if installed.
> It covers RAII, smart pointer selection, and ownership transfer patterns.
```
This ensures the reference is still informative even when the referenced skill is absent.

### skill.json Schema

Follow the pattern from existing skills (e.g., `cpp-memory-handling/skill.json`). The `applies_when` field is **critical** — it tells the manifest generator and planning instruction when to load this skill:
```json
{
  "name": "C++ Best Practices",
  "description": "Comprehensive C++ coding standards covering naming conventions, modern C++ idioms (C++17/20/23), error handling, and build guidelines. Cross-references domain-specific C++ skills for deep-dives.",
  "version": "1.0.0",
  "author": "ma-agents",
  "tags": ["c++", "cpp", "coding-standards", "best-practices", "modern-cpp", "c++17", "c++20", "c++23"],
  "applies_when": [
    "writing c++ code",
    "creating new c++ files or classes",
    "reviewing c++ code style or conventions",
    "setting up a c++ project"
  ],
  "always_load": true
}
```

**Note on `category` field:** The architecture specifies `category` as part of the skill.json schema, but NO existing skill in the codebase uses it and `listSkills()` doesn't read or filter by it. Omitted here to match actual runtime behavior. If category support is added later, it can be backfilled.

**Note on `always_load: true`:** This is the umbrella C++ skill. Peer skills like `cpp-modern-composition` and `cmake-best-practices` already use `always_load: true`. As the primary entry point for C++ guidance, this skill should also auto-load to ensure AI agents always have baseline C++ standards available.

### SKILL.md Content Pattern

Follow the **policy-based pattern** used by existing C++ skills (e.g., `cpp-memory-handling/SKILL.md`):
- Lead with language context and scope
- Use numbered policies with **Rule** -> **Action** format
- Include tables for mappings (e.g., naming convention table)
- Cross-reference sibling skills using conditional language (see above)
- Existing C++ skills all include an `examples/` directory — consider adding one for consistency
- Target practical density over exhaustive coverage — if content exceeds 500 lines, split supplementary material to `references/`
- **No YAML frontmatter** — metadata comes from skill.json only

### Modern C++ Coverage Priorities

The skill content must be applicable to **C++17/20/23** per AC #2. Key areas:

**C++17:** structured bindings, `std::optional`, `std::variant`, `if constexpr`, fold expressions, `std::filesystem`
**C++20:** concepts, ranges, coroutines, modules, `std::format`, three-way comparison (`<=>`)
**C++23:** `std::expected`, `std::print`, deducing this, `std::flat_map`/`std::flat_set`

### Critical Guardrails

- **No installer code changes** — only skill package files [Source: architecture.md, NFR14]
- **kebab-case** directory name: `cpp-best-practices` [Source: architecture.md#Naming-Patterns]
- **snake_case** keys in skill.json [Source: architecture.md#JSON/YAML-Fields]
- **No emoji** in SKILL.md content [Source: architecture.md#Format-Patterns]
- **Do not duplicate** content from existing C++ skills — cross-reference with conditional language instead
- **Must include `applies_when`** in skill.json — without it, the skill won't appear in generated MANIFEST.yaml with load conditions, making it effectively invisible to automatic skill selection

### Project Structure Notes

- New directory: `skills/cpp-best-practices/`
- New files: `skill.json`, `SKILL.md`
- Optional: `examples/` directory (all peer C++ skills include one)
- Optional: `references/` directory if content exceeds 500 lines
- No changes to any existing files or modules

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Epic-2] — Epic 2 story definitions
- [Source: _bmad-output/planning-artifacts/prd.md#FR36] — FR36: Functionally equivalent behavior across agents
- [Source: _bmad-output/planning-artifacts/prd.md#FR39] — FR39: Skill authoring format
- [Source: _bmad-output/planning-artifacts/architecture.md#Data-Architecture] — Skill schema contract
- [Source: _bmad-output/planning-artifacts/architecture.md#Extensibility-Model] — Template resolution priority
- [Source: _bmad-output/planning-artifacts/architecture.md#Naming-Patterns] — Naming conventions
- [Source: skills/cpp-memory-handling/] — Existing C++ memory handling skill (reference pattern for skill.json with applies_when)
- [Source: skills/cmake-best-practices/] — Existing CMake skill (6th C++ related skill, uses always_load: true)
- [Source: skills/python-security-skill/] — Representative policy-based skill pattern
- [Source: lib/installer.js `function listSkills`] — Skill discovery mechanism
- [Source: lib/installer.js `function generateSkillsManifest`] — MANIFEST.yaml generation (consumes applies_when, always_load)

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
