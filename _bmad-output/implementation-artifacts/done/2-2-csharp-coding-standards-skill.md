# Story 2.2: Create C# Best Practices Skill

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **C# engineer**,
I want a C# coding standards and best practices skill available in ma-agents,
So that my AI coding agent follows our organization's C# methodology consistently.

## Acceptance Criteria

1. **Given** the C# skill directory exists at `skills/csharp-best-practices/`
   **When** the skill is listed via `npx ma-agents list`
   **Then** it appears with description referencing C# standards and tags including "csharp"
   **And** `skill.json` contains valid metadata including `applies_when` conditions for C#/.NET contexts

2. **Given** the C# skill is installed to any supported agent
   **When** the agent receives the skill content
   **Then** it contains C# coding standards, .NET patterns, async/await best practices, and LINQ guidelines
   **And** the content covers modern C# language features (C# 10+) applicable to .NET 6 through .NET 8+

3. **Given** the skill follows the standard skill schema contract
   **When** installed across multiple agents
   **Then** the installed content is identical across all target agents (SKILL.md fallback, no agent-specific templates)
   **And** content is language-focused, not agent-specific (FR36)

## Tasks / Subtasks

- [x] Task 1: Create skill directory and metadata (AC: #1)
  - [x] 1.1: Create directory `skills/csharp-best-practices/`
  - [x] 1.2: Create `skill.json` with all required fields (see skill.json Schema section below). Must include `applies_when` array for skill discovery and `always_load: true` (this is the only C# skill — it must auto-load in C# contexts).
  - [x] 1.3: Verify `npx ma-agents list` shows the new skill with correct metadata
- [x] Task 2: Author SKILL.md content (AC: #2)
  - [x] 2.1: Write C# coding standards covering: naming conventions (PascalCase types/methods, camelCase locals/params, _camelCase private fields), code organization (namespace per folder, one type per file). Target practical density — prioritize high-value rules over exhaustive coverage. If content naturally exceeds 500 lines, use `references/` directory for supplementary material.
  - [x] 2.2: Include async/await best practices: async all the way, avoid async void (except event handlers), ConfigureAwait guidance, cancellation token propagation, ValueTask vs Task guidance
  - [x] 2.3: Include LINQ guidelines: when to use query vs method syntax, deferred execution awareness, materialization points, performance considerations for large collections
  - [x] 2.4: Include modern C# language features (C# 10/11/12): primary constructors, collection expressions, raw string literals, required members, file-scoped types, global usings, nullable reference types (NRT) enforcement. Note: these features span .NET 6–8 — scope is "modern C#" not strictly ".NET 8 only."
  - [x] 2.5: Include error handling patterns: exception hierarchy, Result pattern, problem details for APIs, global exception handling middleware
  - [x] 2.6: Include dependency injection overview: constructor injection, service lifetimes (Singleton/Scoped/Transient). Keep to language-level patterns only — defer framework-specific DI patterns (IOptions, keyed services, middleware) to a future `csharp-aspnet-patterns` skill to avoid overlap.
  - [x] 2.7: Include testing patterns: Arrange-Act-Assert structure, framework-agnostic conventions. Present xUnit as one common choice but acknowledge MSTest and NUnit as alternatives. Avoid prescribing specific assertion or mocking libraries — mention FluentAssertions, NSubstitute, Moq as popular options without mandating them.
  - [x] 2.8: Optionally create `examples/` directory with representative code samples, consistent with peer language skills
- [x] Task 3: Verify installation across agents (AC: #3)
  - [x] 3.1: Install to at least 2 different agents (e.g., claude-code and cursor)
  - [x] 3.2: Verify installed content is identical across agents (SKILL.md fallback is the only path)
  - [x] 3.3: Verify `generateSkillsManifest()` produces correct MANIFEST.yaml entries — check that `applies_when` conditions and `always_load` flag are present in the generated manifest

## Dev Notes

### Architecture Compliance

- **Skill schema contract:** Every skill MUST have `skill.json` (metadata SSoT) + `SKILL.md` (canonical content). Optional directories: `examples/`, `references/`, `scripts/`, `hooks/`, `assets/`. [Source: architecture.md#Data-Architecture]
- **Directory naming:** `kebab-case` for skill directories [Source: architecture.md#Naming-Patterns]
- **No installer changes needed:** Adding a new skill requires ONLY the skill package files — the installer discovers skills by scanning the `skills/` directory via `listSkills()`. [Source: architecture.md#Extensibility-Model, NFR14]
- **Template resolution:** `<agent-name>.md` (highest) -> `generic.md` -> `SKILL.md` (lowest/fallback). Templates are flat files at the skill root — there is NO `templates/` subdirectory. For this skill, `SKILL.md` alone is sufficient.

### Greenfield — No Existing C# Skills

Unlike C++ (6 existing domain skills) and Python (2 existing domain skills), **no C# skills currently exist** in the library. This skill is the first C# entry.

**Implications of being the only C# skill:**
- It must be self-contained — no sibling skills to cross-reference. Content should be more detailed than the C++ umbrella skill which can defer to 6 companions.
- `always_load: true` is important — without it, and without other C# skills, there is no C# guidance unless the developer explicitly requests it.
- Scope boundaries should be drawn clearly for future skills. This skill covers **language-level** patterns. Framework-specific patterns (ASP.NET Core middleware, EF Core, Blazor, etc.) should be deferred to future skills like `csharp-aspnet-patterns` or `csharp-ef-core`.

### skill.json Schema

Follow the pattern from existing skills. The `applies_when` field is **critical** — it tells the manifest generator and planning instruction when to load this skill:
```json
{
  "name": "C# Best Practices",
  "description": "Comprehensive C# coding standards covering modern C# (C# 10-12), async/await, LINQ, dependency injection basics, nullable reference types, and testing conventions.",
  "version": "1.0.0",
  "author": "ma-agents",
  "tags": ["csharp", "c#", "dotnet", ".net", "coding-standards", "best-practices", "net8"],
  "applies_when": [
    "writing c# code",
    "creating new c# files or classes",
    "reviewing c# code style or conventions",
    "working with .net projects",
    "setting up a c# project"
  ],
  "always_load": true
}
```

**Note on `category` field:** Omitted — no existing skill uses it, and `listSkills()` doesn't read or filter by it. Can be backfilled if category support is added later.

**Note on `always_load: true`:** As the only C# skill in the library, this must auto-load. Without it, AI agents have no C# guidance unless the developer knows to request it by name. This matches the pattern of other "primary" language skills like `cmake-best-practices` and `cpp-modern-composition`.

### SKILL.md Content Pattern

Follow the **policy-based pattern** used by existing language skills:
- Lead with language context and scope — specify "modern C# (C# 10+)" rather than ".NET 8+" to match the actual feature coverage
- Use numbered policies with **Rule** -> **Action** format
- Include tables for naming convention mappings (see Naming Convention Table below)
- Consider creating an `examples/` directory with representative code samples, consistent with peer language skills
- Target practical density — if content exceeds 500 lines, split supplementary material to `references/`
- **No YAML frontmatter** — metadata comes from skill.json only

### Modern C# Coverage Priorities

The skill covers **modern C# language features** across recent .NET versions. The scope is "modern C#" (C# 10+), not strictly ".NET 8 only":

**C# 12 (.NET 8):** Primary constructors, collection expressions (`[1, 2, 3]`), default lambda parameters, alias any type, inline arrays
**C# 11 (.NET 7):** Raw string literals, required members, file-scoped types, generic math, list patterns
**C# 10 (.NET 6):** Global usings, file-scoped namespaces, record structs, extended property patterns
**Foundational:** Nullable reference types (NRT), pattern matching, records, init-only properties, top-level statements

**Language-level framework patterns (include):** System.Text.Json, IHttpClientFactory, basic DI (constructor injection, service lifetimes)
**Framework-specific patterns (defer to future skills):** Minimal APIs, middleware pipelines, IOptions/IOptionsSnapshot, Health Checks, OpenTelemetry, EF Core — these belong in a future `csharp-aspnet-patterns` or `csharp-ef-core` skill

### Naming Convention Table

Include a comprehensive naming table — this is the highest-value section for AI agents:

| Element | Convention | Example |
|---------|-----------|---------|
| Namespace | PascalCase, match folder | `MyApp.Services` |
| Class/Struct/Record | PascalCase | `CustomerService` |
| Interface | IPascalCase | `ICustomerService` |
| Method | PascalCase | `GetCustomerAsync` |
| Property | PascalCase | `FirstName` |
| Local variable | camelCase | `customerCount` |
| Parameter | camelCase | `customerId` |
| Private field | _camelCase | `_logger` |
| Constant | PascalCase | `MaxRetryCount` |
| Enum | PascalCase (singular) | `OrderStatus` |
| Async method | suffix `Async` | `SaveAsync` |

### Testing Patterns — Framework Agnosticism

Task 2.7 covers testing patterns. This is an area where opinionated prescriptions cause problems — many C# teams use different frameworks. The SKILL.md should:
- Present **Arrange-Act-Assert** as the universal pattern
- Mention xUnit, NUnit, and MSTest as the three major frameworks without mandating one
- Reference FluentAssertions, Shouldly, NSubstitute, Moq as popular options, not requirements
- Focus on test structure, naming conventions, and practices that are framework-agnostic

### Critical Guardrails

- **No installer code changes** — only skill package files [Source: architecture.md, NFR14]
- **kebab-case** directory name: `csharp-best-practices` [Source: architecture.md#Naming-Patterns]
- **snake_case** keys in skill.json [Source: architecture.md#JSON/YAML-Fields]
- **No emoji** in SKILL.md content [Source: architecture.md#Format-Patterns]
- **Cross-agent equivalence** — content must be language-focused, not agent-specific (FR36)
- **Must include `applies_when`** in skill.json — without it, the skill won't appear in generated MANIFEST.yaml with load conditions, making it invisible to automatic skill selection
- **Language vs. framework boundary** — keep DI, error handling, and testing content at the language level. Defer ASP.NET Core middleware, EF Core, Blazor patterns to future skills.

### Project Structure Notes

- New directory: `skills/csharp-best-practices/`
- New files: `skill.json`, `SKILL.md`
- Optional: `examples/` directory for representative code samples
- Optional: `references/` directory if content exceeds 500 lines
- No changes to any existing files or modules

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Epic-2] — Story 2.2 definition and acceptance criteria
- [Source: _bmad-output/planning-artifacts/prd.md#FR36] — FR36: Functionally equivalent behavior across agents
- [Source: _bmad-output/planning-artifacts/prd.md#FR39] — FR39: Skill authoring format
- [Source: _bmad-output/planning-artifacts/architecture.md#Data-Architecture] — Skill schema contract
- [Source: _bmad-output/planning-artifacts/architecture.md#Extensibility-Model] — Template resolution priority
- [Source: _bmad-output/planning-artifacts/architecture.md#Naming-Patterns] — Naming conventions
- [Source: skills/python-security-skill/] — Representative policy-based skill pattern (includes applies_when)
- [Source: skills/cpp-memory-handling/] — Representative language skill structure (includes applies_when, examples/)
- [Source: lib/installer.js `function listSkills`] — Skill discovery mechanism
- [Source: lib/installer.js `function generateSkillsManifest`] — MANIFEST.yaml generation (consumes applies_when, always_load)

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

None — implementation was straightforward skill package authoring.

### Completion Notes List

- Created `skills/csharp-best-practices/skill.json` with all required fields: name, description, version, author, tags (including "csharp"), applies_when (5 conditions), always_load: true.
- Created `skills/csharp-best-practices/SKILL.md` covering: naming conventions table, code organization, nullable reference types, modern C# features (primary constructors, collection expressions, raw strings, pattern matching, records and record structs, file-scoped types), async/await, LINQ, error handling (Result pattern + exception hierarchy), dependency injection (service lifetimes), and testing (AAA pattern, framework-agnostic).
- Skipped `examples/` directory (task 2.8 was optional; SKILL.md code blocks are sufficient for AI agent consumption).
- Task 2.5 (error handling): Global exception handling middleware is explicitly deferred to a future `csharp-aspnet-patterns` skill — it is an ASP.NET Core framework-specific pattern, not a language-level concern. The language-level obligation (ensuring exceptions carry sufficient data to produce a ProblemDetails response) is covered in Section 7.
- Installed to claude-code agent: `.claude/skills/csharp-best-practices/SKILL.md` and updated MANIFEST.yaml.
- Installed to cursor agent: `.cursor/skills/csharp-best-practices/SKILL.md` and updated MANIFEST.yaml.
- Verified installed content is byte-for-byte identical across both agents (SKILL.md fallback path only).
- Verified generated MANIFEST.yaml entries include `applies_when` conditions and `always_load: true`.
- All 9 existing regression tests passed.
- **Code review fixes applied (2026-03-19):** Added Section 4.6 (file-scoped types, C# 11 `file` modifier); expanded Section 4.5 to cover `record struct` and `readonly record struct`; replaced EF Core `FirstOrDefaultAsync` in async example with framework-agnostic `_repository.GetByIdAsync`; replaced ASP.NET Core `builder.Services` in DI example with `IServiceCollection`; clarified Section 7 middleware deferral boundary.

### File List

- skills/csharp-best-practices/skill.json (new)
- skills/csharp-best-practices/SKILL.md (new)
- .claude/skills/csharp-best-practices/SKILL.md (new — installed)
- .claude/skills/MANIFEST.yaml (modified — new entry added)
- .claude/CLAUDE.md (modified — planning instruction updated)
- .cursor/skills/csharp-best-practices/SKILL.md (new — installed)
- .cursor/skills/MANIFEST.yaml (modified — new entry added)
- .cursor/cursor.md (modified — planning instruction updated)
- _bmad-output/implementation-artifacts/sprint-status.yaml (modified — status updated)
- _bmad-output/implementation-artifacts/2-2-csharp-coding-standards-skill.md (modified — tasks checked, status updated)

### Change Log

- 2026-03-19: Implemented Story 2.2 — Created C# Best Practices skill package (`skill.json` + `SKILL.md`), installed to claude-code and cursor agents, verified cross-agent content equivalence and MANIFEST.yaml generation.
- 2026-03-19: Code review fixes — Added file-scoped types (§4.6), record struct guidance (§4.5), replaced framework-coupled code examples in §5 and §8, documented middleware deferral in §7 and completion notes.
