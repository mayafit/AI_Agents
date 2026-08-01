# Project Knowledge, Context & Repository Layout

> **Shard** of the [PRD index](../../prd.md). Content is verbatim from the
> pre-split document; the index carries the front matter, registers and reading order.
>
> Capabilities F11 (Project Knowledge & Context) and F12 (Multi-Repository
> Project Layout) — where planning knowledge lives and how agents find it.
> Architecture: P2-7, P2-10.
>
> Also carries the **federated knowledge store** thread of F26 — FR254–FR267,
> NFR79–NFR83. Architecture: P5-9 (proposed). F26 supersedes FR111 (single
> knowledgebase question) and FR117 (bindings in the per-machine `config.yaml`);
> both are retained below as history and marked accordingly.

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

- FR111: During installation, the installer asks the user where the project knowledgebase is managed — options: current repository (default), local path, or remote git repository. **[SUPERSEDED by FR254 — the single knowledgebase question is replaced by two independent store questions]**
- FR112: During installation, the installer asks the user where sprint management is managed — options: current repository (default), local path, or remote git repository
- FR113: When the user selects "remote" for either concern, the installer asks for the git URL and a local destination path for cloning. If the destination directory already exists, the installer displays its contents summary and asks the user to confirm before proceeding — it never overwrites an existing directory
- FR114: When the user selects "remote" and the local destination does not exist, the installer clones the repository to the specified path
- FR115: When the user selects "local path" for either concern, the installer validates that the path exists. If it does not exist, the installer alerts the user and asks them to confirm the path or provide a corrected one — it does not silently create the directory
- FR116: When the user selects "current repository" (default) for both concerns, the installer operates in single-repo mode with no additional configuration — preserving current behavior for projects that manage everything in one repository
- FR117: The knowledgebase and sprint management paths are stored in `config.yaml` as shared project configuration fields (`knowledgebase_path`, `sprint_management_path`) — available to all BMAD workflows and agents at runtime. **[SUPERSEDED by FR263 — `config.yaml` lives under the gitignored `_bmad/` tree, so these values are per-machine and diverge across a team; the committed `project-layout.yaml` becomes authoritative and `config.yaml` is generated from it]**
- FR118: The generated `project-context.md` includes the configured knowledgebase and sprint management paths as mandatory agent operating rules — agents are instructed to resolve all planning artifact reads/writes to `{knowledgebase_path}` and all sprint artifact reads/writes to `{sprint_management_path}`
- FR119: All BMAD workflows that produce planning artifacts (PRD creation/editing/validation, architecture creation, UX design, research, product briefs) resolve their output directory from the configured `{knowledgebase_path}` rather than assuming the current working directory
- FR120: All BMAD workflows that produce or consume sprint artifacts (sprint planning, story creation, story status lookup, sprint status via `sprint-status.yaml`, bug management, retrospectives) resolve their paths from the configured `{sprint_management_path}`
- FR121: When the agent activity dashboard is implemented, it resolves story status files and sprint data from the configured `{sprint_management_path}` — correctly reading agent activity across repositories
- FR122: In multi-repo mode, the installer creates a lightweight cross-reference file in the code repository (`_bmad-output/project-layout.yaml`) documenting the knowledgebase and sprint management paths — so agents activated in the code repo can discover where planning and sprint data live without re-running installation

### Federated Knowledge Stores (F26)

- FR254: During installation the installer asks **separately** for two knowledge stores, in the same style FR111 used for the single knowledgebase: a **system requirements store** and a **software requirements store**. Each question is independent — answering one does not constrain the other — and each accepts the same location options plus a backend choice (FR257). This supersedes FR111. The sprint-management question (FR112) is unchanged and remains a third, separate question
- FR255: The **system requirements store** holds the artifacts that define *what the system must do* independently of how it is built: the product brief and the PRD (including, for a sharded PRD, its index and all shards)
- FR256: The **software requirements store** holds the artifacts that define *how the system is built*: the architecture document, UX designs, and epics
- FR257: Each store independently selects its own **backend** — `file-system` or `confluence`. The two stores may differ: a project may keep system requirements in Confluence for stakeholder visibility while software requirements stay in git alongside the code, or any other combination
- FR258: When a store selects the `file-system` backend, the installer collects its location using the existing semantics of FR113–FR116 — current repository (default), local path, or remote git repository — including the existing confirmation, validation and clone behaviour, applied per store
- FR259: When a store selects the `confluence` backend, the installer asks which **Confluence space** the store lives in
- FR260: When a store selects the `confluence` backend, the installer asks for a **root page** under which that store's artifacts are created. If the answer is left blank, ma-agents generates a root page named for the project (`{project_name}`) and uses it — the user is told the page name that was created
- FR261: The Confluence backend is **MCP-conditional**, exactly as the Jira sprint backend is. A store configured for `confluence` performs Confluence reads and writes only when a Confluence MCP server is available at runtime; detection, routing and failure handling follow the canonical pattern in `mcp-detection-pattern-spec.md` rather than a second bespoke mechanism. This closes the blocker that has kept Epic 14 Story 14.2 deferred
- FR262: When a store is configured for `confluence` but no Confluence MCP is available at runtime, skills fall back to that store's local mirror (FR266) rather than failing, and report: which store was affected, its configured space, that the mirror was used instead, and that writes made against the mirror are not yet in Confluence. No BMAD workflow becomes unusable because an MCP is absent
- FR266: Every `confluence`-backed store has a **local mirror** on the file system holding the current content of that store's artifacts. The mirror is what BMAD skills read when the MCP is unavailable (FR262) and is what makes a Confluence-backed store usable on a disconnected network at all. Mirror location follows the same options FR258 offers for the `file-system` backend. Synchronisation semantics — direction, trigger, and conflict resolution when both Confluence and the mirror have changed — are deliberately left to Architecture Decision P5-9; this requirement establishes only that the mirror exists, that it is authoritative for offline reads, and that divergence from Confluence is reported rather than silently reconciled. **[NOTE FOR PM: added during the Finalize reviewer gate — FR262 originally referenced a mirror that no requirement established, which would have forced an engineer to invent it and would have broken the air-gap claim in NFR80]**
- FR263: `_bmad-output/project-layout.yaml` becomes the **authoritative, always-written** record of where a project's knowledge lives, carrying the backend and location of both stores plus sprint management. It is written on every install and every bind (FR252), not only in multi-repo or Jira mode as FR122 specified. Because `_bmad-output/` is deliberately tracked (FR58), these bindings are committed and shared by the whole team — superseding FR117, under which they lived in the per-machine gitignored `config.yaml`
- FR264: The per-machine `_bmad/bmm/config.yaml` continues to expose the resolved paths that skills read today (`knowledgebase_path`, `sprint_management_path`, `planning_artifacts`, `implementation_artifacts`), but is **generated from `project-layout.yaml`** rather than written directly from install answers. Existing skill path-resolution is therefore unchanged — no skill needs to learn a new config location
- FR265: A project whose `project-layout.yaml` predates F26, or which has only the FR117 single `knowledgebase_path`, is read as both stores pointing at that one location. Migration is offered, never forced: the user is told the project is using the legacy single-store layout and how to split it, and everything keeps working until they do

- FR267: Story files and other implementation artifacts (`implementation_artifacts`) belong to **neither** knowledge store — they follow `sprint_management_path` alongside `sprint-status.yaml`, because a story is sprint execution state rather than a requirement. This confirms and does not change FR120, which already resolves story creation and status through `{sprint_management_path}`. The consequence for F26 is that the binding schema carries exactly two stores plus a sprint-management location, and that a project moving its knowledge stores does not move its stories

## Quality Attributes (Non-Functional Requirements)

### Federated Knowledge Stores (F26)

- NFR79: ma-agents stores **no Confluence credentials** anywhere on disk — authentication is entirely the MCP server's responsibility — and `project-layout.yaml` records only the space key and root page identity. Both conditions are directly verifiable, and together they are what makes the file committable
- NFR80: Configuring a Confluence store must not compromise air-gapped operation. Installation, skill loading and every file-system-backed workflow must complete with no network access; only the Confluence-backed reads and writes themselves require connectivity, and their absence degrades per FR262 rather than failing the run
- NFR81: `project-layout.yaml` must remain deterministic under the two-store model — the same answers produce an identical file, extending NFR36 to the new fields
- NFR82: Splitting one knowledge location into two must be backward-compatible. Projects that never configure a second store behave exactly as they do today, with no additional prompts on subsequent runs and no change to resolved artifact paths (extends NFR34)
- NFR83: Store bindings must be resolvable by a skill that was installed globally and has no install-time knowledge of the project — resolution depends only on the project root and the committed `project-layout.yaml`, never on per-machine install state

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
