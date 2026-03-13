# Story 2.3: Create Python Best Practices Skill

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **Python engineer**,
I want a Python coding standards and best practices skill available in ma-agents,
So that my AI coding agent follows our organization's Python methodology consistently.

## Acceptance Criteria

1. **Given** the Python skill directory exists at `skills/python-best-practices/`
   **When** the skill is listed via `npx ma-agents list`
   **Then** it appears with category "language" and description referencing Python standards

2. **Given** the Python skill is installed to any supported agent
   **When** the agent receives the skill content
   **Then** it contains Python coding standards, PEP 8 conventions, type hinting patterns, and packaging best practices
   **And** the content covers Python 3.10+ modern patterns

3. **Given** all three language skills (C++, C#, Python) are installed
   **When** the manifest is checked via `npx ma-agents status`
   **Then** all three appear with correct versions and installation status per agent

## Tasks / Subtasks

- [ ] Task 1: Create skill directory and metadata (AC: #1)
  - [ ] 1.1: Create directory `skills/python-best-practices/`
  - [ ] 1.2: Create `skill.json` with: name "Python Best Practices", version "1.0.0", category "language", description referencing Python coding standards for 3.10+, author "ma-agents", tags ["python", "coding-standards", "best-practices", "pep8", "type-hints"], always_load false
  - [ ] 1.3: Verify `npx ma-agents list` shows the new skill with correct metadata
- [ ] Task 2: Author SKILL.md content (AC: #2)
  - [ ] 2.1: Write comprehensive Python coding standards covering: PEP 8 naming conventions (snake_case functions/variables, PascalCase classes, UPPER_SNAKE constants), code organization (module structure, `__init__.py` patterns, `__all__` exports)
  - [ ] 2.2: Include type hinting patterns: function annotations, variable annotations, generics (`list[str]` not `List[str]` for 3.10+), `TypeAlias`, `TypeVar`, `Protocol`, `ParamSpec`, `TypeGuard`, `Self` (3.11), `type` statement (3.12)
  - [ ] 2.3: Include modern Python patterns: structural pattern matching (`match/case` 3.10), exception groups and `except*` (3.11), f-string improvements (3.12), `__slots__` usage, dataclasses vs attrs vs Pydantic guidance, walrus operator (`:=`)
  - [ ] 2.4: Include packaging best practices: `pyproject.toml` (not setup.py), dependency management (pip-tools, poetry, uv), virtual environments, `src/` layout convention
  - [ ] 2.5: Include async patterns: `asyncio` conventions, `async for`/`async with`, `TaskGroup` (3.11), structured concurrency, avoid mixing sync and async
  - [ ] 2.6: Cross-reference existing Python skills where they provide deeper coverage (see Dev Notes)
- [ ] Task 3: Verify installation across agents and manifest status (AC: #2, #3)
  - [ ] 3.1: Install to at least 2 different agents (e.g., claude-code and cursor)
  - [ ] 3.2: Verify SKILL.md fallback works when no agent-specific template exists
  - [ ] 3.3: Install all 3 language skills (cpp-best-practices, csharp-best-practices, python-best-practices) and verify `npx ma-agents status` shows all three with correct versions

## Dev Notes

### Architecture Compliance

- **Skill schema contract:** Every skill MUST have `skill.json` (metadata SSoT) + `SKILL.md` (canonical content). No other files are required. [Source: architecture.md#Data-Architecture]
- **Directory naming:** `kebab-case` for skill directories [Source: architecture.md#Naming-Patterns]
- **No installer changes needed:** Adding a new skill requires ONLY the skill package files — the installer discovers skills by scanning the directory. [Source: architecture.md#Extensibility-Model, NFR14]
- **Template resolution:** `templates/<agent-name>.md` -> `templates/generic.md` -> `SKILL.md` (fallback). For this skill, `SKILL.md` alone is sufficient.

### Relationship to Existing Python Skills

2 domain-specific Python skills already exist in the library:

| Existing Skill | Focus | Relationship |
|---------------|-------|-------------|
| `python-security-skill` | OWASP 2025 aligned security (always_load: true) | Deep-dive on security — cross-reference from best-practices |
| `python-dependency-mgmt` | Dependency/supply chain security | Deep-dive on dependency security — cross-reference |

**This skill is the umbrella** — it covers broad Python coding standards, type hinting, modern patterns, and packaging, while referencing the security-focused skills for deeper coverage. It should NOT duplicate content from existing skills. Use cross-references like:
```markdown
> For Python security best practices (OWASP 2025), see the `python-security-skill`.
> For dependency security and supply chain protection, see the `python-dependency-mgmt` skill.
```

### skill.json Schema

```json
{
  "name": "Python Best Practices",
  "description": "Comprehensive Python coding standards covering PEP 8 conventions, type hinting (3.10+), modern patterns (match/case, exception groups), async, and packaging best practices. Cross-references security-focused Python skills.",
  "version": "1.0.0",
  "category": "language",
  "author": "ma-agents",
  "tags": ["python", "coding-standards", "best-practices", "pep8", "type-hints", "python3.10", "python3.11", "python3.12"],
  "always_load": false
}
```

### SKILL.md Content Pattern

Follow the **policy-based pattern** used by existing Python skills (e.g., `python-security-skill/SKILL.md`):
- Lead with language context and Python version scope (3.10+)
- Use numbered policies with **Rule** -> **Action** format
- Include tables for naming convention mappings and modern pattern guidance
- Cross-reference sibling Python skills
- Keep under 500 lines — split to `references/` if needed
- **No YAML frontmatter** — metadata comes from skill.json only

### Python 3.10+ Coverage Priorities

The skill must cover **Python 3.10+ modern patterns** per AC #2:

**Python 3.10:** Structural pattern matching (`match/case`), `ParamSpec`, `TypeAlias`, union types with `X | Y` syntax, `TypeGuard`
**Python 3.11:** Exception groups (`ExceptionGroup`, `except*`), `Self` type, `TaskGroup` for structured concurrency, `tomllib`, `StrEnum`
**Python 3.12:** `type` statement for type aliases, f-string improvements (nested quotes, backslashes), `@override` decorator, per-interpreter GIL (awareness)
**Python 3.13 (awareness):** Free-threaded mode (`--disable-gil`), improved error messages — mention as forward-looking but don't make it a requirement

### Type Hinting Evolution Table

Include a version-aware type hinting table — high value for AI agents:

| Pattern | Old (pre-3.10) | Modern (3.10+) |
|---------|---------------|----------------|
| Union types | `Union[str, int]` | `str \| int` |
| Optional | `Optional[str]` | `str \| None` |
| List type | `List[str]` | `list[str]` |
| Dict type | `Dict[str, int]` | `dict[str, int]` |
| Tuple type | `Tuple[str, ...]` | `tuple[str, ...]` |
| Type alias | `MyType = list[str]` | `type MyType = list[str]` (3.12) |

### Packaging Guidance: Modern Stack

The packaging section should recommend the modern toolchain:
- **`pyproject.toml`** over `setup.py`/`setup.cfg` — PEP 621 compliant
- **`uv`** as the recommended fast package manager (Astral, Rust-based)
- **`src/` layout** as the default project structure
- **`ruff`** for linting and formatting (replaces flake8 + black + isort)
- **`mypy` or `pyright`** for type checking

### Critical Guardrails

- **No installer code changes** — only skill package files [Source: architecture.md, NFR14]
- **kebab-case** directory name: `python-best-practices` [Source: architecture.md#Naming-Patterns]
- **snake_case** keys in skill.json [Source: architecture.md#JSON/YAML-Fields]
- **No emoji** in SKILL.md content [Source: architecture.md#Format-Patterns]
- **Do not duplicate** content from existing Python skills — cross-reference instead
- **Cross-agent equivalence** — content must be language-focused, not agent-specific (FR36)

### AC #3: Cross-Skill Manifest Verification

This story's AC #3 is a cross-cutting acceptance criterion that validates all 3 Epic 2 skills together. It should be tested AFTER stories 2-1 and 2-2 are also complete. If implementing stories in order, this AC can only be fully verified as the last step of story 2-3. If stories are implemented in parallel, coordinate manifest verification at the end.

### Project Structure Notes

- New directory: `skills/python-best-practices/`
- New files: `skill.json`, `SKILL.md`
- Optional: `references/` directory if content exceeds 500 lines
- No changes to any existing files or modules

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Epic-2] — Story 2.3 definition and acceptance criteria
- [Source: _bmad-output/planning-artifacts/prd.md#FR36] — FR36: Functionally equivalent behavior across agents
- [Source: _bmad-output/planning-artifacts/prd.md#FR39] — FR39: Skill authoring format
- [Source: _bmad-output/planning-artifacts/architecture.md#Data-Architecture] — Skill schema contract
- [Source: _bmad-output/planning-artifacts/architecture.md#Extensibility-Model] — Template resolution priority
- [Source: _bmad-output/planning-artifacts/architecture.md#Naming-Patterns] — Naming conventions
- [Source: skills/python-security-skill/] — Existing Python security skill (cross-reference target)
- [Source: skills/python-dependency-mgmt/] — Existing Python dependency skill (cross-reference target)

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
