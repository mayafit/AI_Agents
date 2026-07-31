# Project Knowledge, Context & Repository Layout

> **Shard** of the [PRD index](../../prd.md). Content is verbatim from the
> pre-split document; the index carries the front matter, registers and reading order.
>
> Capabilities F11 (Project Knowledge & Context) and F12 (Multi-Repository
> Project Layout) — where planning knowledge lives and how agents find it.
> Architecture: P2-7, P2-10.

---

## Functional Requirements

### Project Knowledge & Context

- FR58: The installer does not add `_bmad-output` to `.gitignore` — this folder is tracked as version-controlled project knowledge
- FR59: The `_bmad-output` policy is documented in README and installation guidance
- FR79: At project-level installation, the installer generates `_bmad-output/project-context.md` if one does not already exist — providing agents with a constitutional document that governs their behavior throughout the project lifecycle
- FR80: The generated project-context.md contains platform-agnostic mandatory AI agent operating rules: read MANIFEST.yaml before every task, load all `always_load: true` skills, and use the git-workflow-skill with fresh worktrees per mission (not just branches)
- FR81: The skills manifest path(s) in project-context.md are resolved at install time to the actual installed path for each target platform — no hardcoded agent-specific directory references (e.g., not `.claude/skills/MANIFEST.yaml` literally, but the actual resolved path for the platform being installed)
- FR82: When multiple platforms are installed simultaneously, project-context.md lists all MANIFEST.yaml paths for all installed platforms so any agent can find the correct path for its environment
- FR83: The generated project-context.md documents the full agent mission lifecycle in sequence: (1) pre-flight skill loading, (2) fresh worktree creation via `git worktree add`, (3) implementation, (4) self-review using the code-review skill, (5) PR creation with conventional commit, (6) human review gate — agent does not auto-merge, (7) merge and worktree cleanup, (8) post-mission updates (story status + AiAudit.md)
- FR84: Project-context generation is idempotent — if `_bmad-output/project-context.md` already exists when the installer runs, it is left untouched and generation is skipped without error
- FR85: The generated project-context.md includes inline expansion guidance comments directing users to `bmad-generate-project-context` (post-architecture), `bmad-retrospective` (post-sprint), and manual updates as the living document evolves
- FR86: The BMAD extension module updates `critical_actions` for all BMM agents (4 custom + 7 built-in) and bmad-master (12 total) to load `_bmad-output/project-context.md` during agent initialization — alongside MANIFEST.yaml. CIS module agents are explicitly excluded as project-context governance rules (git workflow, dev lifecycle) do not apply to creative/innovation sessions.

### Multi-Repository Project Layout

- FR111: During installation, the installer asks the user where the project knowledgebase is managed — options: current repository (default), local path, or remote git repository
- FR112: During installation, the installer asks the user where sprint management is managed — options: current repository (default), local path, or remote git repository
- FR113: When the user selects "remote" for either concern, the installer asks for the git URL and a local destination path for cloning. If the destination directory already exists, the installer displays its contents summary and asks the user to confirm before proceeding — it never overwrites an existing directory
- FR114: When the user selects "remote" and the local destination does not exist, the installer clones the repository to the specified path
- FR115: When the user selects "local path" for either concern, the installer validates that the path exists. If it does not exist, the installer alerts the user and asks them to confirm the path or provide a corrected one — it does not silently create the directory
- FR116: When the user selects "current repository" (default) for both concerns, the installer operates in single-repo mode with no additional configuration — preserving current behavior for projects that manage everything in one repository
- FR117: The knowledgebase and sprint management paths are stored in `config.yaml` as shared project configuration fields (`knowledgebase_path`, `sprint_management_path`) — available to all BMAD workflows and agents at runtime
- FR118: The generated `project-context.md` includes the configured knowledgebase and sprint management paths as mandatory agent operating rules — agents are instructed to resolve all planning artifact reads/writes to `{knowledgebase_path}` and all sprint artifact reads/writes to `{sprint_management_path}`
- FR119: All BMAD workflows that produce planning artifacts (PRD creation/editing/validation, architecture creation, UX design, research, product briefs) resolve their output directory from the configured `{knowledgebase_path}` rather than assuming the current working directory
- FR120: All BMAD workflows that produce or consume sprint artifacts (sprint planning, story creation, story status lookup, sprint status via `sprint-status.yaml`, bug management, retrospectives) resolve their paths from the configured `{sprint_management_path}`
- FR121: When the agent activity dashboard is implemented, it resolves story status files and sprint data from the configured `{sprint_management_path}` — correctly reading agent activity across repositories
- FR122: In multi-repo mode, the installer creates a lightweight cross-reference file in the code repository (`_bmad-output/project-layout.yaml`) documenting the knowledgebase and sprint management paths — so agents activated in the code repo can discover where planning and sprint data live without re-running installation

## Quality Attributes (Non-Functional Requirements)

### Project Context Generation

- NFR22: The project-context *template* (`lib/templates/project-context.template.md`) must contain no hardcoded platform-specific paths or agent directory names — path-specific content is stamped at generation time, not embedded in the template source
- NFR23: Project-context generation is additive-only — the installer never modifies or deletes an existing `_bmad-output/project-context.md` regardless of its content or age
- NFR24: The project-context template is maintained as a standalone file (`lib/templates/project-context.template.md`), not as an inline string in installer code — allowing the template to be updated independently of installer logic
- NFR25: The generated project-context.md includes a machine-readable generator version comment (e.g., `<!-- ma-agents-template-version: 1.0 -->`). When a future ma-agents version detects a lower template version in an existing file, it logs a warning suggesting the user run `/bmad-generate-project-context` to refresh — it never auto-overwrites

### Multi-Repository Layout

- NFR34: Multi-repo configuration must be backward-compatible — projects that do not configure external repositories must function identically to current single-repo behavior with no degradation or additional prompts on subsequent runs
- NFR35: Remote repository cloning during installation must work in air-gapped environments when the user provides a local network git URL (e.g., internal GitLab) — no assumption of public internet access
- NFR36: The `project-layout.yaml` cross-reference file must be deterministic — running the installer multiple times with the same multi-repo configuration produces an identical file
- NFR37: All BMAD workflows must resolve artifact paths through the configured layout — no workflow may hardcode `_bmad-output/` as a relative path assumption. Path resolution must use the config values, falling back to current directory only when config specifies single-repo mode
