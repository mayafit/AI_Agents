# ma-agents

A universal NPX tool to install AI coding agent skills. Write skills once, install them across Claude Code, Gemini, Copilot, Cline, Cursor, Kilocode, and Roo Code.

## What's New in v3.18.0

- **Two knowledge stores instead of one.** The install wizard now asks
  separately where your **system requirements** (product brief, PRD) and your
  **software requirements** (architecture, UX, epics) live. Each store answers
  independently and each picks its own backend. Sprint management is still a
  third, separate question, and story files still follow it — they belong to
  neither store.
- **A `confluence` backend for either store.** A store can live in a Confluence
  space instead of on the file system. It requires a Confluence-capable MCP
  server in your agent; with none, the affected skill **halts and says so**
  rather than quietly reading stale local files. No credentials are ever
  written to disk.
- **`_bmad-output/project-layout.yaml` is now the authoritative binding**, written
  on every install and committed with the project, so a whole team resolves the
  same store locations. `_bmad/bmm/config.yaml` is **generated from it** and
  carries a stamp of the binding it came from; a skill that finds the two
  disagreeing stops instead of resolving paths to where the stores used to be.
- **`ma-agents bind`** — a new command that binds an already-installed project to
  its knowledge stores without installing anything. Idempotent, and it never
  overwrites an existing `project-context.md`.
- **A global install now does no project-scoped work**, and `ma-agents status`
  reports the install scope. BMAD-METHOD remains per-project (bmad-method
  v6.10.0 has no user-level install); the installer says so and tells you the
  command that installs it into a project.
- **Nothing changes for an existing project that configures no second store** —
  same prompts, same resolved artifact paths, plus one new committed file.

## What's New in v3.17.1

- **ma-agents now show up in the Copilot agent picker** — the DevOps (Amit),
  Cyber (Yael), SQA (Gadi), and SRE (Alex) personas now appear in the GitHub
  Copilot agent-picker dropdown in VS Code alongside the core BMAD agents.
  They installed correctly before but were missing the `customize.toml`
  `[agent]` marker the installer uses to register a persona in the picker;
  each now ships one.

## What's New in v3.17.0

- **BMAD-METHOD v6.10.0** — bundled bmad-method updated to v6.10.0. The
  offline bundle stays exactly `{tea, bmb, cis, gds, wds}`; the new upstream
  `bmad-loop` module is deliberately excluded (never bundled, never installed
  by default) by a closed-allowlist filter with a two-sided fail-loud guard.
- **Custom marketplace source (opt-in)** — `--bmad-custom-source
  <path|url>` (or the install-time Y/N prompt) lets you enumerate and install
  a hand-picked subset of extensions from your own BMAD marketplace repo —
  the sanctioned way to add `bmad-loop` or any other excluded module. The
  source and your selection persist in `.ma-agents.json` and re-enumerate on
  every `update`. See "Custom Marketplace Source" below.
- **Demerzel (ML Scientist) deprecated** — `ma-agent-ml` and its 12 `ml-*`
  skills are no longer installed by default for new projects. Existing
  installs are completely untouched (non-destructive); a one-time notice
  explains how to opt back in via a custom marketplace source.

## What's New in v3.12.0

- **Cline `.clinerules` directory fix** — `.clinerules` is now correctly created as a directory (matching Cline's native structure), not as a file. This prevents ENOTDIR errors during workflow generation and ensures `.clinerules/workflows/` is always generated correctly. Legacy installs that had `.clinerules` as a file are automatically migrated on the next install or update.

## What's New in v3.11.0

- **Cline workflow generation** — when Cline is selected during install, update, or migration, ma-agents now auto-generates `.clinerules/workflows/<skill-name>.md` for every BMAD skill installed to `.cline/skills/`. Type `/` in Cline chat to browse and invoke all BMAD skills natively.

## What's New in v3.10.0

- **Jira backend first-run fix** — the Jira backend is now correctly detected and activated on the very first run after install, resolving a bug where `tracking_system` was ignored until a second invocation.
- **BMAD v6.6.0** — bundled bmad-method updated to v6.6.0.

## What's New in v3.9.0

- **Jira sprint backend** — the install wizard now offers Jira as a 4th sprint management option. Select Jira to provide your Jira URL and project key; credentials are stored in `_bmad/bmm/config.yaml`. All 13 sprint management skills automatically route operations to Jira or file-system based on `tracking_system` in `sprint-status.yaml`.
- **Skill-level Jira routing** — every sprint skill reads `tracking_system` and routes to the Jira backend via whatever Jira-capable tool is available in your agent context (MCP server, plugin, or native integration). Failure prompts offer retry or permanent switch to file management.
- **Routing alignment (3.8.1)** — copilot, roo-code, and kilocode persona skills now land in `.agents/skills/` to match `bmad-method 6.5.0`'s unified target directory.

See [CHANGELOG.md](CHANGELOG.md) for full release notes.

---

## Installation & Usage

`ma-agents` is designed to be run via `npx` in the root of your project.

### 1. Interactive Wizard (Recommended)
The wizard is the easiest way to set up or update your environment.
```bash
npx ma-agents
```

### 2. Direct Command Line
```bash
# Install specific skills to specific agents
npx ma-agents install code-review claude-code copilot

# Global installation (user-level)
npx ma-agents install code-review claude-code --global

# CI/CD: skip all prompts, use defaults
npx ma-agents install --yes

# Scope the entire install to one agent (skills, BMAD update, instruction block)
npx ma-agents install --yes --agent claude-code
```

## How It Works

Skills are written in a **unified generic format** and stored in this package. When you install a skill, the installer:

1. Reads the skill's `SKILL.md` (or agent-specific template if available)
2. Injects YAML frontmatter from `skill.json` (the single source of metadata)
3. Copies the skill and its resources into the target agent's directory
4. Renames resource directories to match the agent's native structure (e.g., `references/` becomes `docs/` for Cline)
5. **Generates `MANIFEST.yaml`**: A central discovery file for the agent to find all installed skills.
6. **Updates Instruction Blocks**: Stamps a universal planning-instruction block into every agent's instruction file (`CLAUDE.md`, `.clinerules`, `.cline/clinerules.md`, `.roo/rules/00-ma-agents.md`, `AGENTS.md`) between `<!-- MA-AGENTS-START -->` / `<!-- MA-AGENTS-END -->` markers. User content outside the markers is preserved. On-prem profile additionally stamps guardrails for local LLMs.
7. **BMAD Roo Code Modes**: Generates `.roomodes` with 4 BMAD planning-mode custom modes (`bmad-pm`, `bmad-architect`, `bmad-techlead`, `bmad-dev`), each with `fileRegex` restrictions that enforce planning-phase file access at the application layer.
8. **BMAD-METHOD Integration**: Automatically detects and integrates with [BMAD-METHOD](https://docs.bmad-method.org/), applying project-specific customizations and orchestration.

```
Generic (this repo)                    Installed Output
───────────────────                    ────────────────
skills/code-review/
├── skill.json        ──────────►     Injected as YAML frontmatter
├── SKILL.md          ──────────►     .claude/skills/code-review/SKILL.md
├── scripts/          ──────────►     .claude/skills/code-review/scripts/
└── references/       ──────────►     .claude/skills/code-review/references/
                                       + Generated MANIFEST.yaml
                                       + Updated Agent Instructions (CLAUDE.md, etc.)
```

## Project Knowledge: _bmad-output/

The `_bmad-output/` folder is **intentionally tracked in version control** as project knowledge. Do not add `_bmad-output/` to your `.gitignore`.

### What it contains

`_bmad-output/` holds all AI-generated planning artifacts produced by BMAD agents:

- **`planning-artifacts/`** — PRDs, architecture documents, UX designs
- **`implementation-artifacts/`** — Epics, user stories, sprint status, backlog
  - **`sprint-status.yaml`** — Unified single source of truth for all sprint and backlog state (epics map, backlog array, sprints map)
  - **`done/`** — Archived completed and cancelled stories and bugs
- **`methodology/`** — BMAD-METHOD training materials and onboarding presentation

### Why it is version-controlled

1. **Team alignment** — all team members see the same AI-generated plans and decisions
2. **AI context continuity** — AI agents need prior context across sessions to maintain consistency
3. **Decision history** — preserves the rationale and evolution of architectural and product decisions

### Installer behaviour

The `ma-agents` installer automatically removes `_bmad-output/` from `.gitignore` if it finds it there. This is intentional — if your IDE or tooling suggests adding `_bmad-output/` to `.gitignore`, you should decline. The folder is project knowledge, not build artefacts.

> **Do not add `_bmad-output/` to your `.gitignore`** — the installer will remove it automatically if it appears there.

---

## Knowledge Stores and the Project Binding

A project's knowledge lives in **two independent stores** plus a sprint-management
location. Where each one lives is recorded in
`_bmad-output/project-layout.yaml` — a committed file, so the whole team resolves
the same locations.

| Store | Holds | Config fields it generates |
|---|---|---|
| **System requirements** | product brief, PRD (index and all shards) | `system_requirements_path`, `system_requirements_backend`, `system_requirements_space_key` |
| **Software requirements** | architecture, UX designs, epics | `software_requirements_path`, `software_requirements_backend`, `software_requirements_space_key`, and the legacy `knowledgebase_path` / `planning_artifacts` |
| **Sprint management** | `sprint-status.yaml`, story files, bugs, retrospectives | `sprint_management_path`, `sprint_backend`, `implementation_artifacts` |

Story files and everything else under `implementation_artifacts` belong to
**neither** knowledge store — a story is sprint execution state, not a
requirement — so moving your knowledge stores does not move your stories.

### The install questions

The wizard asks three location questions, in this order:

1. **Where do the system requirements live?** — backend (`file-system` or
   `confluence`), then, for `file-system`, the same choices as before: current
   repository (default), a local path, or a remote git repository.
2. **Where do the software requirements live?** — the same question, answered
   independently. Answering one does not constrain the other.
3. **Where is sprint management?** — unchanged, including the Jira option.

`--yes` selects the single-repository, `file-system` default for both stores, so
CI and non-interactive installs are unaffected.

Separately, the wizard's existing **Installation Scope** question — *Project
level (current directory)* / *Global (user-level settings)* / *Custom path* —
is unchanged, and `--global` is still its non-interactive equivalent. What
changed is what a **global** answer does: it now performs **no project-scoped
work at all**. No `project-layout.yaml`, no `project-context.md`, and no
knowledge-store questions, because no project is in scope at that moment. Those
are deferred to `ma-agents bind`.

### The Confluence backend

Either store can select a `confluence` backend instead of `file-system`. The
wizard then asks for the **space** and for a **root page** under which that
store's artifacts live; leave the root page blank and ma-agents generates one
named for the project and tells you the name it used.

**A Confluence-backed store requires a Confluence-capable MCP server** in your
agent — an MCP server, plugin or native integration connected to the Confluence
instance hosting that space. This is the same MCP-conditional pattern the Jira
sprint backend already uses, not a second mechanism.

**ma-agents stores no Confluence credentials anywhere on disk.** Authentication
is entirely the MCP server's responsibility. `project-layout.yaml` records only
the space key and the root page's title and id — which is what makes the file
safe to commit.

**There is no local mirror and no cache.** A Confluence-backed store is read and
written through the MCP, and nothing is copied down. There is consequently
nothing to synchronise and nothing to fall out of date.

`ma-agents confluence-plan` prints the page tree a publish would produce for
this project — one page per markdown artifact, nested to mirror the source
folders — together with the operations a publish performs, in order. It
enumerates the plan and performs none of it. After a root page is created,
`ma-agents confluence-record-root-page` records the id Confluence assigned, so
later runs address the page directly.

### `ma-agents bind`

```bash
ma-agents bind          # bind this project to its knowledge stores
ma-agents bind --yes    # non-interactive, accept the existing/default answers
```

`bind` collects only the project-scoped answers — the two store bindings and
sprint management — and writes `_bmad-output/project-layout.yaml` plus
`project-context.md`. It **installs nothing**: no skills, no BMAD modules. It is
idempotent: re-running it against an already-bound project reports the existing
bindings and changes nothing unless you explicitly edit an answer, and it never
overwrites an existing `project-context.md`.

Use it when ma-agents was installed globally and you now want to use it in a
particular project, or when a project's binding is missing or needs to change.

### When things are wrong, skills stop rather than guess

Two failure modes are deliberately loud:

- **A Confluence-backed store with no Confluence MCP available.** The skill
  halts and names the affected store, its configured space, the fact that no
  Confluence MCP was detected, and how to configure one (or how to re-bind the
  store to the file system). It does **not** fall back to local files, does not
  continue with an empty result, and does not change your configured backend.
- **A stale generated config.** `_bmad/bmm/config.yaml` records which binding it
  was generated from. If the committed binding has moved since — usually after a
  `git pull` — the skill halts, names every store that moved and both of its
  locations, and tells you to run `ma-agents bind` to regenerate the config. The
  comparison is on **content, never timestamps**, so a fresh clone does not
  report false drift and a `git checkout` cannot hide real drift.

Both messages end by stating that nothing was read or written on your behalf.

### Deliberately not implemented

- **A local mirror of every Confluence-backed store (FR266) was RETIRED before
  implementation** and has no code, no cache, no sync direction, no sync trigger
  and no conflict-resolution path. It had been justified on air-gap grounds, but
  this product's air-gap requirement means *no internet* — no npm, git or CDN
  access — not *no network*: an enterprise Confluence inside the perimeter is
  reachable on an air-gapped network. With Confluence unreachability
  reclassified as a misconfiguration rather than a working mode, the fail-loud
  behaviour above removes the need for a mirror entirely. The release gate
  asserts the absence as a closed set rather than as a denylist. If you find no
  mirror here, that is the design — please do not helpfully add one. (P5-9.6)

### Known limitations of v3.18.0

These are stated here, in the shipped documentation, rather than only in the
repository's changelog — which is **not** part of the npm package.

- **Versions 3.7.0 through 3.17.1 could silently delete hand-authored skills.**
  When a tool's skills directory moved between versions, the installer removed
  the old directory recursively once the new one had content, destroying any
  skill you had written there yourself and reporting it as a successful
  cleanup. This affected `.github/copilot/skills`, `.github/skills`,
  `.roo/skills` and `.kilocode/skills`. **It is fixed in this version** — the
  sweep now removes only what ma-agents installed and preserves the directory
  if anything else remains — but deletions already made are not recoverable
  from ma-agents: no backup was written and nothing but the directory name was
  recorded. Check your version control if you kept such skills.
- **A file placed inside a skill directory ma-agents installed is still removed
  with it.** The sweep's unit is the skill directory, not the file. If you have
  edited a shipped skill in place, that edit is lost when the directory is
  swept. Keep your own skills in their own directories, which are preserved.

- **Every claim in this release about behaviour with a Confluence MCP *present*
  is mock-verified, not live.** No authorised Confluence MCP was available to
  the implementation or to any review, so the MCP-present branches were
  exercised against a stubbed tool context. The MCP-*absent* branch — the
  fail-loud path described above — is the default state and was exercised for
  real.
- **The publish trigger reaches the authoring skills through a file three
  parties can write.** `_bmad/custom/<skill>.toml` is written by ma-agents, by a
  human, and by the upstream `bmad-customize` skill. TOML forbids duplicate
  keys, and the upstream resolver treats a parse error in that layer as a
  *warning* — it returns an empty layer and **exits 0** — so a second writer
  adding its own `on_complete` silently discards the publish hook and every
  other override in the file. ma-agents refuses to write over a collision it can
  detect and `ma-agents status` names it, but **that check is a partial scanner,
  not a full TOML parser**: it can miss a malformation and stay silent. The
  durable fix belongs upstream in `resolve_customization.py`, which is replaced
  on every install, so it cannot be patched from here.
- **A bare non-ASCII-whitespace line authored by a user is not detected.** A
  line containing only U+00A0, U+2007 or U+3000 makes the file invalid to the
  real parser while ma-agents' reader accepts it; the customization layer is
  then dead at exit 0 with nothing reported. Such a file is already invalid
  before ma-agents touches it — this is a detection gap, not corruption. A
  byte-order mark in the same position *is* caught.
- **This release was verified on Windows only.** Linux and CI were never run, so
  every cross-platform claim is inference rather than a result.
- **`_bmad-output/project-layout.yaml` carries a `generated:` date**, so two
  runs of the same answers are byte-identical only within the same calendar day.
  `ma-agents bind` declines to rewrite the file on a no-edit re-run precisely so
  that this cannot present as a spurious change.
- **`bmad-knowledge` (the Knowledge Atlas) does not honour a Confluence-backed
  store.** It renders that store's section from whatever local files it finds,
  without saying so. It is a separate consumer from the routing-gated skills
  above and is tracked as a known defect.
- **A Confluence-backed *system* requirements store has no ma-agents-owned
  fail-loud gate.** The routing block ships in the skills that resolve
  *software* requirements; a system requirements store's consumers are upstream
  BMM workflows this package does not ship.
- **The repository's own test suite is not green on Windows**, and one failure
  is this release's: a conflict between the staleness-guard block embedded in
  the sprint workflow skills and an older lossless-conversion invariant. It is
  recorded and awaiting adjudication rather than patched. The suite was never
  run on Linux.

---

## Project Context

When you run `npx ma-agents install` at the project level, ma-agents automatically generates
`_bmad-output/project-context.md` — a constitutional document that governs how AI agents
behave in this project.

**What it contains:**
- Mandatory pre-task rules: which MANIFEST.yaml files to read, which skills to load
- Git workflow mandate: fresh worktrees per mission (not just branches)
- Agent mission lifecycle: 8-step sequence from pre-flight to post-mission cleanup

**It is safe to edit.** The installer never regenerates the file from scratch once it exists.
On reinstall, only the `## AI Agent Mandatory Rules` MANIFEST paths section is updated
if new agents have been added — all your custom edits are preserved. Edit it freely — it belongs to your project.

**Expand it over time:**
- After architecture phase: run `/bmad-generate-project-context` to auto-detect your stack
- After each sprint: run `/bmad-retrospective`, then `/project-context-expansion`
- Manually: add conventions you notice agents getting wrong

The file is version-controlled as part of `_bmad-output/` project knowledge. Commit it.

---

## 4.x line (BMAD v7) — not yet released

ma-agents 4.x targets BMAD v7 at BMAD-METHOD commit
`e734d3ac3c0f4ea31cc2c2bbbe79e86e54f2cae6` (`package.json` `bmadRef.core`), a preview-alpha
upstream commit. Until it is qualified on an upstream GA tag, the 3.x line
described in this README is the supported on-prem release; 4.x packages are
pre-releases on npm dist-tag `next`. 4.x needs Node.js ≥ 22.20.0 and, for the
v7 skills, uv + Python 3.11 + a wheelhouse ([docs/on-prem-runtime.md](docs/on-prem-runtime.md)).

### Known limitations of the 4.x line

These mirror the "Unreleased (4.x)" entry of the repository's changelog, which
is not part of the npm package.

- **cis is not bundled.** No tag of `bmad-module-creative-intelligence-suite`
  carries a v7 module record, so `bmadRef.cis` is empty and the bundle records
  cis as omitted; tea is bundled at `v4.0.1` (Story 36.1, FALLBACK).
- **v7 project-context adoption removes the ma-agents blocks from `CLAUDE.md`.**
  When `bmad-project-context` adopts a project, its default proposal deletes the
  `ma-agents` and `ma-standards` blocks from `CLAUDE.md` as duplicates of the
  `AGENTS.md` copies and reduces `CLAUDE.md` to `@AGENTS.md`; the next ma-agents
  install or update writes them back, and the next refresh flags them again. The
  `AGENTS.md` blocks survive byte-identical (Story 36.5 AC9; fix planned in 37.2
  and 39.2).
- **Update checks for `core-tools` and `method` report `could-not-check`.**
  Upstream `main` moved its module records after the pinned commit, so
  `setup.py --status` cannot read them online until `bmadRef.core` moves; offline
  every module reports `could-not-check`, which does not fail the command (Story
  36.1 AC7).
- **Offline token counting falls back.** `bmad-toolsmith` `count_tokens.py`
  reports `"method": "fallback"` offline, because `tiktoken` downloads its
  encoding at first use (Story 36.2).
- **A malformed customization is dropped silently on six upstream skills.**
  `bmad-prd`, `bmad-architecture`, `bmad-facilitate`, `bmad-ux`,
  `bmad-product-brief` and `bmad-prfaq` have no `workflow.md`, so a
  `_bmad/custom/<skill>.toml` that does not parse, or names an undeclared key,
  is not halted on; the skill falls back to its defaults (Story 36.4).
- **Not verified: Windows with the network adapter disabled.** The Windows
  offline runs used `UV_OFFLINE=1` and a black-hole proxy instead (Story 36.2).
- **Not verified: global install scope.** Only the project-scope `uv.toml`
  selected by `UV_CONFIG_FILE` was proven; the uv user configuration file was
  not exercised (Story 36.2).
- **Not verified by a syscall trace: no download when the interpreter is
  missing.** Shown by uv's verbose log inside `--network none` (Story 36.2).
- **Not implemented: a full-clone fallback for `bundle build`.** When a proxy
  refuses a fetch by commit, the build fails with git's error (Story 36.3).
- **The Skills CLI's dependency versions follow the registry on the build
  day.** Its ranges (`tar ^7.5.20`, `yaml ^2.8.3`) are resolved at build time,
  so a later build can pick newer patches and change `bundle/manifest.json`; the
  manifest records the exact set (Story 36.3).
- **Not verified offline: the contract validator's `--render` path.** It
  downloads `jinja2` through uv when online (Story 36.4).
- **Not verified in a human-driven session: the adoption run.** Story 36.5's two
  runs were fresh agent sessions executing the pinned skill with scripted user
  turns; Story 36.7 repeats it at GA in a real session.
- **Marker lines inside a fenced code block count as markers.** A
  `<!-- ma-agents:start -->` line quoted in a code fence in your own prose is
  matched by exact line equality (Story 36.5).
- **`npm test` does not pass on Windows.** The chain stops at pre-existing
  failures tracked as `bug-npm-test-windows-suite-health-chain`; the Linux CI job
  runs every file and gates on a known-failure allowlist (Story 36.6).

---

## On-Prem / Air-Gapped Deployment

**4.x line (BMAD v7):** every v7 skill activates with `uv run --no-cache`, so an air-gapped machine needs the offline runtime the 4.x bundle ships: uv, a Python 3.11 interpreter and a wheelhouse of the skill scripts' dependencies, plus Node.js ≥ 22.20. [docs/on-prem-runtime.md](docs/on-prem-runtime.md) lists the prerequisites, the runtime folder, the `uv.toml` keys and environment variables that point uv at it, the commands that check an installation, a troubleshooting table, and how to regenerate the wheelhouse. It applies to the 4.x line only; the rest of this section describes the 3.x line.

When running AI coding agents against a locally-hosted LLM (e.g., Nemotron Super 49B on vLLM), `ma-agents install` asks a one-time profile question at setup:

```
? Profile (standard / on-prem):
```

Your answer is persisted in `.ma-agents.json` under the `profile` field and is read on every subsequent install, update, or reconfigure. The manifest also records the `toolVersion` (ma-agents version) and `bmadVersion` (bundled bmad-method version) on every install, making it easy to verify what ran last. The `standard` profile produces the same output as always; the `on-prem` profile additionally stamps on-prem-specific guardrails into every agent's instruction block — including `/no_think` directives for planning personas, `str_replace_editor` prohibition, and home-directory write restrictions.

To change your profile after initial setup: `npx ma-agents reconfigure`
To remove all on-prem profile artifacts: `npx ma-agents uninstall --profile-artifacts`

### What the on-prem profile stamps

| File | What is added |
|------|--------------|
| `CLAUDE.md` | Universal instruction block + on-prem guardrails (inside `MA-AGENTS-START/END` markers) |
| `.roo/rules/00-ma-agents.md` | Same block for Roo Code |
| `.clinerules` + `.cline/clinerules.md` | Same block for Cline |
| `AGENTS.md` | Same block for OpenCode |
| `opencode.json` | Additive entry in `instructions[]` array |
| `.roomodes` | 4 BMAD planning modes with `fileRegex` phase enforcement |
| Deployed `bmad-agent-*/SKILL.md` (across `.claude/skills/`, `.cline/skills/`, `.github/skills/`, `.roo/skills/`, `.kilocode/skills/`) | Per-persona phase prefix injected via marker block: planning personas get `/no_think`; dev personas get careful-coding prefix |

The standard profile stamps the universal block only (no `/no_think`, no `str_replace_editor` prohibition, no home-dir restriction).

For vLLM server configuration, quantization tradeoffs, per-phase sampling parameters, and the `str_replace_editor` hallucination mitigation, see [`docs/deployment/vllm-nemotron.md`](docs/deployment/vllm-nemotron.md).

---

## Supported Coding Tools

Skills can be installed into any of these AI coding agents:

| Tool | Project Path | Template | Instruction File |
|------|-------------|----------|------------------|
| Claude Code | `.claude/skills/` | `claude-code` | `.claude/CLAUDE.md` |
| Google Gemini | `.gemini/skills/` | `generic` | `.gemini/gemini.md` |
| GitHub Copilot | `.agents/skills/` | `generic` | `.github/copilot-instructions.md` |
| Cursor | `.cursor/skills/` | `generic` | `.cursor/cursor.md` |
| Kilocode | `.kilocode/skills/` | `generic` | `.kilocode/kilocode.md` |
| Cline | `.cline/skills/` | `cline` | `.cline/clinerules.md` |
| Roo Code | `.roo/skills/` | `generic` | `.roo/rules/00-ma-agents.md` |
| Antigravity | `_bmad/skills/` | `generic` | `_bmad/bmm/agents/antigravity.md` |
| OpenCode | `.opencode/skills/` | `generic` | `opencode.json` |

## Specialized BMAD Agents

These domain-expert agents are installed alongside BMAD-METHOD and provide guided workflows through their agent menus:

| Agent | Persona | Skills Path | Instruction File |
|-------|---------|-------------|------------------|
| SRE Agent | Alex | `_bmad/skills/sre/` | `_bmad/bmm/agents/sre.md` |
| DevOps Agent | Amit | `_bmad/skills/devops/` | `_bmad/bmm/agents/devops.md` |
| Cyber Analyst | Yael | `_bmad/skills/cyber/` | `_bmad/bmm/agents/cyber.md` |
| ML Scientist | Demerzel | `_bmad/skills/demerzel/` | `_bmad/bmm/agents/demerzel.md` |
| SQA & Standards Expert | Gadi | `_bmad/skills/sqa/` | `_bmad/bmm/agents/qa.md` |

## Available Skills

### General-Purpose Skills (34)

These skills are installed into your coding tool of choice and provide reusable best-practice guidance:

| Skill ID | Domain | Description |
| :--- | :--- | :--- |
| **General** | | |
| `code-review` | Quality | Comprehensive reviews following best practices and security guidelines |
| `commit-message` | Git | Generates conventional commit messages from code changes |
| `test-generator` | Testing | Generates comprehensive unit and integration tests |
| `test-accompanied-development` | Quality | Enforces "test-alongside" policy for every public method |
| `code-documentation` | Quality | Enforces PEP 257, Doxygen, JSDoc, and XML standards |
| `skill-creator` | Meta | Guide for creating new skills to extend agent capabilities |
| `document-revision-history` | Documentation | Manages revision history tables at the beginning of generated documents |
| `ai-audit-trail` | Audit | Tracks AI agent session activity, time spent, and token usage |
| `open-presentation` | Methodology | Opens the BMAD-METHOD AI Development Training presentation (`/open-presentation`) |
| **Security** | | |
| `python-security-skill` | Python | OWASP Top 10 2025 aligned guardrails for Python |
| `js-ts-security-skill` | JS/TS | Security verification for JS/TS codebases (OWASP aligned) |
| `create-hardened-docker-skill` | Docker | Creates production-ready hardened Docker (CIS/NIST) |
| `verify-hardened-docker-skill` | Docker | Security verification for Docker configurations |
| **Dependencies** | | |
| `python-dependency-mgmt` | Python | Best practices for `uv` (lockfiles/sync) and `pip` |
| `js-ts-dependency-mgmt` | JS/TS | Stability and security for NPM, Yarn, and PNPM |
| **Modern C++** | | |
| `cpp-memory-handling` | C++ | RAII, smart pointers, and safe buffer management |
| `cpp-robust-interfaces` | C++ | Contract-based design and strong typing (C++14+) |
| `cpp-modern-composition` | C++ | Replaces C-style patterns with STL and Ranges |
| `cpp-const-correctness` | C++ | Immutability-by-default and `constexpr` logic |
| `cpp-concurrency-safety` | C++ | RAII locking and task-based parallelism |
| `cmake-best-practices` | Build | Target-based, property-oriented CMake patterns |
| **Architecture** | | |
| `logging-best-practices` | Logic | Standardized structured logging (JSON) across domains |
| `opentelemetry-best-practices` | Logic | Distributed tracing and semantic conventions |
| `vercel-react-best-practices` | Web | 57 Performance rules for React and Next.js |
| `git-workflow-skill` | Git | Worktree-based feature branch workflow |
| `self-signed-cert` | Security | Automated Root CA and self-signed certificate generation |
| `docker-image-signing` | Security | Automated cryptographic signing for Docker images |
| `docker-hardening-verification` | Security | Audits images for least-privilege and OpenShift compatibility |

### Agent Workflows (34)

These workflows are installed as part of the BMAD agent system and are invoked through the agent's menu (not installed individually):

| Workflow | Agent | Description |
| :--- | :--- | :--- |
| **Machine Learning (Demerzel)** | | |
| `ml-ideation` | ML Scientist | Frame ML research problem, produce Research Thesis and PRD |
| `ml-eda` | ML Scientist | Exploratory Data Analysis, establish baselines, produce EDA report |
| `ml-architecture` | ML Scientist | Model architecture, stack, and experiment tracking strategy |
| `ml-detailed-design` | ML Scientist | Implementation task breakdown (INF-* and EXP-* namespaces) |
| `ml-techspec` | ML Scientist | Lock experiment parameters and performance tiers before training |
| `ml-infra` | ML Scientist | Build ML infrastructure, manage dependencies, run smoke tests |
| `ml-experiment` | ML Scientist | Execute training experiments against locked TechSpec, log metrics |
| `ml-analysis` | ML Scientist | Evaluate experiment outcomes against TechSpec success tiers |
| `ml-hparam` | ML Scientist | Automated hyperparameter optimization (Optuna, W&B Sweeps, Ray Tune) |
| `ml-revision` | ML Scientist | Amend hypothesis and requirements based on experiment findings |
| `ml-advise` | ML Scientist | Search past experiments, surface findings and failure warnings |
| `ml-retrospective` | ML Scientist | Capture session learnings and update project context |
| **SQA & MIL-STD-498 (Gadi)** | | |
| `sqa-audit` | SQA & Standards Expert | Multi-dimensional project quality audit: code↔story traceability, stories↔architecture/PRD alignment, process compliance, sprint health, release state — saves audit report and optional remediation plan |
| `sqa-ieee12207` | SQA & Standards Expert | IEEE/ISO/IEC 12207:2017 compliance assessment across 23 process areas in 4 groups — produces compliance matrix, gap analysis, and optional remediation plan |
| `sqa-requirements-quality` | SQA & Standards Expert | Requirements quality audit against 14 criteria with scope selection (PRD FRs, NFRs, epics, stories) — per-requirement audit table, critical-fail detection, Overall Quality Score, and optional remediation plan |
| `mil498-srs` | SQA & Standards Expert | Generate Software Requirements Specification (SRS) per MIL-STD-498 DID |
| `mil498-sdd` | SQA & Standards Expert | Generate Software Design Description (SDD) per MIL-STD-498 DID |
| `mil498-sdp` | SQA & Standards Expert | Generate Software Development Plan (SDP) per MIL-STD-498 DID |
| `mil498-ocd` | SQA & Standards Expert | Generate Operational Concept Description (OCD) per MIL-STD-498 DID |
| `mil498-sss` | SQA & Standards Expert | Generate System/Subsystem Specification (SSS) per MIL-STD-498 DID |
| `mil498-std` | SQA & Standards Expert | Generate Software Test Description (STD) per MIL-STD-498 DID |
| `mil498-ssdd` | SQA & Standards Expert | Generate System/Subsystem Design Description (SSDD) per MIL-STD-498 DID |
| `mil498-requirement-quality` | SQA & Standards Expert | Evaluate requirements against 14 quality criteria — per-requirement audit table, Missing Elements report, and Overall Quality Score (MIL-STD-498 context) |
| **Sprint Management** | | |
| `bmad-sprint-planning` | Scrum Master | Bootstrap or refresh the unified `sprint-status.yaml` from epics and bug stories |
| `generate-backlog` | Scrum Master | Generate or refresh the `backlog` section of `sprint-status.yaml` from epics |
| `add-sprint` | Scrum Master | Add a new sprint entry to the `sprints` map with capacity and optional ISO dates |
| `add-to-sprint` | Scrum Master | Move backlog items into a sprint using atomic movement semantics |
| `remove-from-sprint` | Scrum Master | Return sprint items to the backlog with status reset and priority assignment |
| `modify-sprint` | Scrum Master | Update sprint metadata (name, capacity, dates, status transitions) |
| `sprint-status-view` | Scrum Master | Display formatted sprint progress, backlog, and epic status (read-only) |
| `bmad-sprint-status` | Scrum Master | Analyze sprint health, surface risk flags, and recommend next actions |
| `cleanup-done` | Scrum Master | Archive done/cancelled items — remove from `sprint-status.yaml` and move files to `done/` |
| `close-sprint` | Scrum Master | Full sprint closure — archive done items, disposition incomplete items, set sprint to closed |
| `prioritize-backlog` | Scrum Master | Reprioritize backlog using severity, business value, dependencies, type, and age |

## Automated Skill Discovery

`ma-agents` features an automated discovery system that ensures installed skills are actually used by the agent without manual configuration.

### 1. The Manifest (`MANIFEST.yaml`)
Every installation automatically generates a `MANIFEST.yaml` in the skills directory. It contains:
- **Skill IDs and Paths**: Where to find the instructions.
- **`applies_when` Conditions**: Hints about when a skill should be loaded (e.g., "when writing public APIs").
- **`always_load` Flags**: Mandatory skills that should always be in context.

### 2. Instruction Injection
The installer automatically updates agent-specific instruction files (like `CLAUDE.md` or `.clinerules`) with a "Planning Instruction" block. This block tells the agent to:
1. Consult the `MANIFEST.yaml` before starting a task.
2. Select and read only the relevant skills for the current context.

---

## CLI Usage

```bash
npx ma-agents                              # Launch interactive wizard
npx ma-agents install                      # Interactive install wizard
npx ma-agents install --yes                # Non-interactive, use defaults (CI/CD)
npx ma-agents install --yes --agent <id>   # Non-interactive, target one agent
npx ma-agents install --log                # Log all output to install_<datetime>.log
npx ma-agents install --global             # Install to user-level paths; no project-scoped work
npx ma-agents bind                         # Bind this project to its knowledge stores (installs nothing)
npx ma-agents bind --yes                   # Non-interactive bind
npx ma-agents status                       # Show installed skills, paths and the active install scope
npx ma-agents confluence-plan              # Print the page tree a Confluence publish would produce
npx ma-agents confluence-record-root-page  # Record the id Confluence assigned to a created root page
npx ma-agents list                         # List all available skills
npx ma-agents agents                       # List supported agents
npx ma-agents uninstall <skill> <agents>   # Direct uninstall
npx ma-agents reconfigure               # Re-run profile prompt and re-stamp all artifacts
npx ma-agents uninstall --profile-artifacts  # Remove on-prem profile content from all agent files
```

### The Update Process
Running `ma-agents` on a project where skills are already installed triggers the **Update Flow**:
1. **Detection**: Recognizes existing `.ma-agents.json` manifest.
2. **Selection**: Allows you to add new skills or remove existing ones.
3. **Synchronization**: 
   - Re-injects the latest instructions into `CLAUDE.md`, `.clinerules`, etc.
   - Regenerates the `MANIFEST.yaml` to reflect the current skill set.
   - Updates BMAD-METHOD personas and workflows to the latest versions if detected.
   - **Cleans up stale tool directories** — if a tool's skill path changed between releases (e.g., Copilot migrated from `.github/copilot/skills/` to `.github/skills/`), the old directory is automatically removed when the new one has content.

### BMAD-METHOD Integration
`ma-agents` bundles [BMAD-METHOD](https://docs.bmad-method.org/) **v6.10.0** to provide advanced orchestration and specialized personas.

#### Core Features
- **Auto-Detection**: Recognizes existing BMAD installations and prompts for silent updates.
- **Silent Setup**: Non-interactive installation/update of BMAD tailored to your project's agents.
- **Plugin Staging**: A pre-built plugin bundle (`lib/bmad-extension-plugin/`) is staged into `<project>/.ma-agents-plugin-stage/` and installed via `bmad-method --custom-source`, replacing the legacy post-install manifest-surgery flow.
- **Persona Overlays**: On-prem phase prefixes and user customizations are injected as marker-delimited blocks into the deployed `bmad-agent-*/SKILL.md` files across every supported tool's skills directory — idempotent on re-runs.
- **Advanced Agent Templates**: Deploys full XML-structured agent definitions directly into the BMAD system.

#### Bundled & Offline Installation (v2.20+)

`ma-agents` ships with everything needed to install BMAD without any network access at install time:

- **`bmad-method` is a direct npm dependency** — no runtime `npx bmad-method` fetch required. The correct version is pinned and bundled inside `node_modules/` when you `npm install ma-agents`.
- **External modules pre-bundled** — `lib/bmad-cache/` ships exactly 3 optional BMAD modules (`bmb`, `cis`, `tea`) inside the package itself. They are pre-populated to `~/.bmad/cache/external-modules/` before any install runs, so BMAD never needs to clone them from GitHub. The bundled set is a **closed allowlist** — a build-time guard fails loud if the resolved set is ever smaller (a thin cache) *or* larger (a silent upstream addition) than these three, so a new upstream module can never be force-bundled or installed by default. The two design-studio modules `gds` (Game Dev Studio) and `wds` (Whiteport Design Studio) are **not bundled and not installable by ma-agents** — they are not offered by the `--bmad-modules` multiselect, and obtaining either one requires network access to its upstream repository, so on an air-gapped machine neither is available. `bmad-loop` (BMAD's own unattended-dev orchestrator, added upstream at v6.10.0) is deliberately **excluded** from this bundle — see "BMAD-loop and other opt-in modules" below.
- **Plugin bundle pre-built** — `lib/bmad-extension-plugin/` ships as a deterministic, byte-stable bundle (built from `lib/bmad-extension/` via `scripts/build-plugin.js`). At install time it is staged into `<project>/.ma-agents-plugin-stage/` and consumed by `bmad-method install --custom-source`, so the install never touches the network for plugin assembly.
- **Deterministic installs** — same `ma-agents` version always produces the same `_bmad/` output, regardless of network conditions (NFR21). Bundle reproducibility is gated by a CI drift check.
- **Air-gapped friendly** — install from a tarball (`npm install ./ma-agents-x.y.z.tgz`) and run `npx ma-agents install` completely offline. Every PR runs an offline-install gate (`--network none` Docker) to enforce this guarantee (NFR54).

```
npm install ma-agents          # bundles bmad-method + 5 external modules
npx ma-agents install --yes    # fully offline BMAD install — no network needed
```

#### Custom Marketplace Source (opt-in)

After module selection, the installer offers to pull in extensions from **one**
additional BMAD marketplace repository — a local path or an intra-perimeter
Git URL (e.g. on-prem GitLab) pointing at a repo with a
`.claude-plugin/marketplace.json`. This is how a team plugs in extensions
ma-agents deliberately does not ship by default — including **`bmad-loop`**
(see below) or an internally-published replacement for a deprecated agent.

- **Interactive flow**: `Install additional BMAD extensions from a custom
  source? (y/N)` → if yes, enter the source → ma-agents **enumerates** the
  extensions the source declares (reusing bmad-method's own module
  discovery) → presents them in **ma-agents' own multiselect** (the
  single-wizard principle is preserved; `bmad-method` itself still runs
  non-interactively) → installs only the codes you picked.
- **Non-interactive equivalent**: `--bmad-custom-source <local-path-or-url>`.
  Under `--yes`, every declared extension is selected automatically (matching
  how `--bmad-modules`/skill selection behave under `--yes`).
- **Persistence + reconcile on update**: the marketplace source and your
  selected extension codes are saved in `.ma-agents.json`. On the next
  `update`, ma-agents automatically re-resolves the source and re-enumerates
  it, reporting anything newly published (not auto-installed — re-run the
  custom-source flow to add it) or no longer available (dropped from the
  installed selection) — it never silently changes what you already have.
- **Authentication**: ambient git only — your existing SSH keys or credential
  helper. ma-agents performs zero token handling and never stores or logs a
  credential.
- **On-prem posture**: no public-internet egress is required (an on-prem
  GitLab over SSH works with no extra configuration), but custom-source
  content is explicitly **outside** the sealed offline-bundle guarantee above
  — you are responsible for that source's own offline self-containment. The
  installer prints a one-line warning before you can select anything from it.

```bash
npx ma-agents install --yes --bmad-custom-source ./org-marketplace
npx ma-agents install --bmad-custom-source git@git.intra.example:team/bmad-marketplace.git
```

#### `bmad-loop` and other opt-in modules

BMAD-METHOD v6.10.0 added `bmad-loop`, an unattended Python/tmux/hooks
development-orchestrator module that requires a separate `bmad-loop-setup`
step and vendor-API sessions. It is **air-gap-hostile as a default** and
functionally overlaps ma-agents' own `bmad-dev-epic` orchestrator, so
`bmad-loop` is **never bundled and never installed by default** — it is
excluded by the same closed-allowlist guard described above. `bmad-dev-epic`
remains ma-agents' default air-gapped epic orchestrator.

`bmad-loop` (or any other module ma-agents excludes) can still be installed
as a deliberate, explicit opt-in through a **custom marketplace source** (see
above) — for example a locally-published copy of `bmad-loop` in your org's
marketplace repo. This is the sanctioned path for teams that want it; nothing
in the default install pulls it in silently.

#### Specialized BMAD Agents
1. **SRE Agent (Alex)**:
   - **Focus**: High availability, Kubernetes, Docker, and Podman.
   - **Capabilities**: Day 1/2 operations, GitOps (ArgoCD/Flux), and advanced deployment strategies (Canary, Blue-Green).
   - **Workflows**: System status, drift detection, and automated troubleshooting.
2. **DevOps Agent (Amit)**:
   - **Focus**: Build automation and multi-environment deployment.
   - **Capabilities**: Helm charts/umbrellas, Docker Compose, and infrastructure provisioning (PV/PVC/LB).
   - **On-Prem Support**: Specialized strategies for disconnected (air-gapped) environments.
3. **Cyber Analyst (Yael)**:
   - **Focus**: Cyber immunity, security auditing, and vulnerability management.
   - **Capabilities**: Immunity estimation (scoring), Vault secret management, and PKI automation.
   - **Integration**: Orchestrates ma-agents security skills for deep scans.
4. **Demerzel (ML Scientist)** — **DEPRECATED, no longer installed by default (v3.17.0+)**:
   - **Focus**: Hypothesis-driven machine learning lifecycle with scientific rigor.
   - **Capabilities**: EDA, architecture design, locked TechSpec contracts, experiment execution, failure-cost analysis.
   - **Workflows**: 12-stage ML lifecycle from ideation through retrospective, with mandatory review gates.
   - **Status**: `ma-agent-ml` and its 12 `ml-*` workflow skills are no longer
     part of the default bundle for **new** installs. This is **non-destructive**
     for everyone else — an **existing** install's `ma-agent-ml`/`ml-*` content
     (and anything you produced with it) is left completely untouched on update;
     there is no auto-removal and no prompt. You'll see a one-time notice the
     first time you install or update after upgrading ma-agents, and that's it.
     There is no in-tool migration path — if your team still needs ML
     workflows, install a replacement from your organization's own BMAD
     marketplace via the **custom marketplace source** described above
     (`--bmad-custom-source`).
5. **Gadi (SQA & Standards Expert)**:
   - **Focus**: Software quality assurance and defense documentation standards — a unified persona covering SQA auditing and MIL-STD-498 document generation.
   - **SQA Capabilities**: Multi-dimensional project quality audits, IEEE/ISO/IEC 12207:2017 compliance assessments (23 process areas, 4 groups), requirements evaluation against 14 established quality criteria (scope-selectable: PRD FRs, NFRs, epics, stories).
   - **MIL-STD-498 Capabilities**: Full Data Item Description (DID) generation for SRS, SDD, SDP, OCD, SSS, STD, and SSDD. Requirements quality review tailored to MIL-STD-498 structure and military-standard terminology (CSCI, HWCI, IRS).
   - **Remediation**: All audit and compliance workflows offer an optional remediation plan (`sqa-remediation-plan-{date}.md`) and per-finding `create-bug-story` integration for critical gaps.

#### Operational Workflows
The integration includes a suite of specialized playbooks:
- **GitOps & Deployment**: Canary releases, rolling updates, and sync monitoring.
- **Infrastructure**: PV/PVC management, Load Balancer configuration, and storage setup.
- **Security & Trust**: Vault secrets, certificate generation, and vulnerability scanning.
- **Diagnostics**: Advanced health checks across K8s, Docker, and Podman.

#### Sprint Management (v4.0+)

`ma-agents` includes a complete sprint management system built on a **unified `sprint-status.yaml`** — a single file that is the sole source of truth for all sprint and backlog state.

**Data Model:**

The entire sprint state lives in one file at `_bmad-output/implementation-artifacts/sprint-status.yaml`:

```yaml
# Metadata
generated: <ISO-8601>
last_updated: <ISO-8601>
project: <string>
project_key: <string>
tracking_system: file-system   # or "jira" (future)
story_location: _bmad-output/implementation-artifacts

# Three data sections
epics:
  epic-17:
    status: in-progress        # backlog | in-progress | done | on-hold | cancelled
    retrospective: optional

backlog:                       # ordered array — position = priority
  - id: "17-10-rework-generate-backlog"
    type: story                # story | bug
    epic: 17
    title: "Rework generate-backlog Skill"
    priority: 1                # denormalized index, kept in sync with array position
    status: ready-for-dev
    severity: null             # null for stories; critical|high|medium|low for bugs

sprints:
  sprint-1:
    name: "Sprint 1"
    status: active             # planning | active | closed
    capacity: 8
    start: "2026-04-01"
    end: "2026-04-14"
    items:
      - id: "17-10-rework-generate-backlog"
        type: story
        epic: 17
        title: "Rework generate-backlog Skill"
        status: in-progress
        severity: null         # no priority field — ordering is implicit in array position
```

**Workflows:**

| Command | Description |
|---------|-------------|
| `/bmad-sprint-planning` | Bootstrap or refresh the entire `sprint-status.yaml` from epics |
| `/generate-backlog` | Refresh the `backlog` section from epic/story definitions |
| `/add-sprint` | Add a new sprint entry to the `sprints` map |
| `/add-to-sprint` | Move backlog items into a sprint (atomic — removes from backlog, adds to sprint) |
| `/remove-from-sprint` | Return sprint items to the backlog (status reset to `ready-for-dev`) |
| `/modify-sprint` | Update sprint metadata (name, capacity, dates, status transitions) |
| `/sprint-status-view` | Display sprint progress, backlog, and epic status (read-only) |
| `/bmad-sprint-status` | Sprint health analysis with risk flags and recommendations |
| `/cleanup-done` | Archive done/cancelled items — remove from YAML, move files to `done/` |
| `/close-sprint` | Full sprint closure — archive done items, disposition incomplete items |
| `/prioritize-backlog` | Reorder backlog — full, quick-adjust, or AI-suggested modes |

**Key Design Principles:**
- **Single file, single truth**: all state lives in `sprint-status.yaml` — no separate backlog or sprint files
- **Movement semantics**: items exist in exactly one location (backlog OR a sprint, never both)
- **Forward-only transitions**: sprint status follows `planning → active → closed` with no reversals
- **Single-active-sprint constraint**: at most one sprint can have `status: active` at any time
- **Done item archival**: completed work is removed from the YAML entirely and files moved to `done/`
- **Priority as denormalized index**: backlog array order is authoritative; `priority` field mirrors position
- **Jira-ready**: `tracking_system: jira` routes all operations through a Jira adapter (Epic 14)

### Install Options (Direct)
```bash
# Default: installs to project-level paths (current directory)
npx ma-agents install code-review claude-code

# Install to global/user-level paths
npx ma-agents install code-review claude-code --global

# Install to a custom directory
npx ma-agents install code-review claude-code --path ./my-skills

# Skip all prompts, use defaults — ideal for CI/CD pipelines
npx ma-agents install --yes
npx ma-agents install --yes --global
npx ma-agents install --yes --agent claude-code

# Target a specific agent (skips agent selection prompt)
npx ma-agents install code-review --agent cursor

# Force overwrite without upgrade prompts
npx ma-agents install code-review claude-code --force
```

| Flag | Description |
|------|-------------|
| `--yes` | Skip all prompts, use defaults. Selects all detected agents, installs/updates BMAD automatically. |
| `--agent <name>` | Scope the entire install to one agent — skill selection, BMAD update, and instruction-block stamping all apply to that tool only. Run `npx ma-agents agents` for valid names. |
| `--force` | Skip upgrade prompts, always overwrite existing installations. |
| `--global` | Install to global/user-level paths instead of project-level. |
| `--path <dir>` | Custom installation directory. |
| `--log` | Log all console output to `install_<datetime>.log` in the current directory. |

## Requirements

### Global Requirements
- **Node.js**: v16+ (npx support)
- **Git**: Required for git-related skills and version detection.
- **Bash**: Most skill scripts require a bash-compliant shell.

### Skill-Specific Requirements
- **Python Security/Deps**: `pip`, `uv` (recommended), `pip-audit`.
- **JS/TS Security/Deps**: `npm`, `yarn`, or `pnpm`.
- **C++ Skills**: C++14+ compiler recommended.
- **Docker Skills**: `docker`, `docker-compose`, `trivy` (for scanning).
- **Git Workflow**: `gh` (GitHub CLI) for PR automation.

## Skill Structure

Every skill follows a unified structure. See [SKILLS_STRUCTURE.md](SKILLS_STRUCTURE.md) for full documentation.

```
skills/<skill-name>/
├── skill.json              # Metadata — single source of truth (required)
├── SKILL.md                # Main instructions in pure Markdown (required)
├── claude-code.md          # Claude Code-specific template (optional)
├── cline.md                # Cline-specific template (optional)
├── generic.md              # Generic template for other agents (optional)
├── template.md             # Output template for the agent (optional)
├── scripts/                # Executable scripts (optional)
├── references/             # Documentation and reference material (optional)
├── examples/               # Sample outputs (optional)
├── hooks/                  # Git hooks or other hook scripts (optional)
└── assets/                 # Config files, templates, resources (optional)
```

### Key Design Decisions

- **`skill.json` is the single source of truth** for metadata (`name`, `description`). YAML frontmatter is injected automatically at install time — you never write it in source files.
- **Template priority**: The installer looks for `<agent-template>.md` first (e.g., `claude-code.md`), then `generic.md`, then falls back to `SKILL.md`.
- **Resource mapping**: Some agents use different directory names. For example, Cline expects `docs/` instead of `references/` and `templates/` instead of `assets/`. The installer handles this mapping automatically.

## Creating a New Skill

### 1. Create the skill directory

```bash
mkdir -p skills/my-skill
```

### 2. Create `skill.json`

```json
{
  "name": "My Skill",
  "description": "What this skill does in one sentence",
  "version": "1.0.0",
  "author": "Your Name",
  "tags": ["category", "keywords"]
}
```

### 3. Create `SKILL.md`

Write pure Markdown instructions. Do **not** add YAML frontmatter — the installer injects it from `skill.json`.

```markdown
# My Skill

## Purpose
What problem this skill solves.

## Instructions
Step-by-step instructions for the agent.

## Rules
Constraints the agent must follow.

## Output Format
What the agent should produce.
```

### 4. Add optional resources

```bash
mkdir -p skills/my-skill/scripts      # Executable scripts
mkdir -p skills/my-skill/references    # Documentation
mkdir -p skills/my-skill/examples      # Sample outputs
```

### 5. (Optional) Create agent-specific templates

If a skill needs different instructions for different agents:

```bash
# Claude Code gets tailored instructions
skills/my-skill/claude-code.md

# Cline gets its own version
skills/my-skill/cline.md

# All other agents use SKILL.md
```

### 6. Test

```bash
npx ma-agents list                          # Verify it appears
npx ma-agents install my-skill claude-code  # Test installation
```

## Adding a New Agent

Edit [lib/agents.js](lib/agents.js) and add a new entry to the `agents` array:

```javascript
{
  id: 'my-agent',
  name: 'My Agent',
  description: 'My Agent Description',
  getProjectPath: () => path.join(process.cwd(), '.my-agent', 'skills'),
  getGlobalPath: () => {
    const platform = os.platform();
    if (platform === 'win32') {
      return path.join(os.homedir(), 'AppData', 'Roaming', 'MyAgent', 'skills');
    } else if (platform === 'darwin') {
      return path.join(os.homedir(), 'Library', 'Application Support', 'MyAgent', 'skills');
    } else {
      return path.join(os.homedir(), '.config', 'my-agent', 'skills');
    }
  },
  fileExtension: '.md',
  template: 'generic',
  // Optional: rename resource directories to match agent's native structure
  resourceMap: {
    'references': 'docs',
    'assets': 'templates'
  }
}
```

### Agent Configuration Fields

| Field | Required | Description |
|-------|----------|-------------|
| `id` | Yes | Unique kebab-case identifier (used in CLI) |
| `name` | Yes | Display name shown to users |
| `description` | Yes | Brief description |
| `getProjectPath` | Yes | Returns project-level skills directory |
| `getGlobalPath` | Yes | Returns global/user-level skills directory (platform-specific) |
| `fileExtension` | Yes | File extension for skill files (usually `.md`) |
| `template` | Yes | Template ID — determines which `.md` file to look for first |
| `resourceMap` | No | Maps generic directory names to agent-specific names |

## Project Structure

```
ma-agents/
├── bin/
│   └── cli.js                  # CLI entry point (wizard + commands)
├── lib/
│   ├── agents.js               # Agent configurations, paths, and extraInstructionTemplates
│   ├── installer.js            # Skill installation, instruction-block stamping, marker management
│   ├── bmad.js                 # BMAD-METHOD integration, recompile, persona phase prefix
│   ├── profile.js              # Profile persistence (getProfile / setProfile / resolveProfile / clearProfile)
│   ├── reconfigure.js          # ma-agents reconfigure — re-stamp profile-dependent artifacts
│   ├── uninstall.js            # ma-agents uninstall --profile-artifacts
│   ├── merge/
│   │   └── roomodes.js         # YAML merger for .roomodes slug collision / user-slug preservation
│   ├── templates/
│   │   ├── instruction-block-universal.template.md   # Universal planning-instruction block
│   │   ├── instruction-block-onprem.template.md      # On-prem guardrails append (profile=on-prem)
│   │   ├── roomodes.template.yaml                    # 4 BMAD Roo Code modes with fileRegex
│   │   ├── agents-md.template.md                     # AGENTS.md for OpenCode
│   │   ├── clinerules.template.md                    # .clinerules expansion for Cline
│   │   └── project-context.template.md               # project-context.md generation template
│   ├── bmad-customize/         # Source-of-truth: per-persona phase / on_prem_phase_prefix YAML (consumed by the post-install marker-block injector)
│   ├── bmad-cache/             # Pre-bundled BMAD external modules (bmb, cis, tea)
│   ├── bmad-customizations/    # BMAD persona templates (.md) and YAML configs
│   ├── bmad-extension/         # Extension source: sprint management, bug tracking, agent skills (hand-edited)
│   ├── bmad-extension-plugin/  # Generated plugin bundle (deterministic; built from bmad-extension/ via scripts/build-plugin.js)
│   ├── bmad-workflows/         # Specialized BMAD playbooks (SRE, Cyber, etc.)
│   └── mil498-templates/       # MIL-STD-498 DID library (SRS, SSS, SSDD, etc.)
├── scripts/
│   ├── build-bmad-cache.js     # Rebuilds lib/bmad-cache/ from upstream repos
│   └── build-plugin.js         # Rebuilds lib/bmad-extension-plugin/ from lib/bmad-extension/ (run on `npm run build:plugin` and via the prepare hook)
├── skills/
│   ├── code-review/            # 27 bundled skills across 5 domains
│   ├── commit-message/
│   ├── create-hardened-docker-skill/
│   ├── git-workflow-skill/
│   ├── js-ts-security-skill/
│   ├── skill-creator/
│   ├── test-generator/
│   ├── vercel-react-best-practices/
│   └── verify-hardened-docker-skill/
├── test/
│   └── yes-flag.test.js        # Tests for --yes / --agent flag behavior
├── docs/
│   └── validation/             # Manual validation reports (e.g., bundled install)
├── SKILLS_STRUCTURE.md         # Full skill authoring documentation
├── package.json
└── README.md
```

## Development

```bash
# Clone the repository
git clone https://github.com/mayafit/AI_Agents.git
cd AI_Agents

# Install dependencies
npm install

# Run locally
node bin/cli.js

# Test skill listing
node bin/cli.js list

# Test agents listing
node bin/cli.js agents

# Run tests
npm test

# Rebuild the bundled BMAD module cache (lib/bmad-cache/)
npm run build:bmad-cache
```

## Programmatic API

```javascript
const { installSkill, listSkills, listAgents } = require('ma-agents');

// List all available skills
const skills = listSkills();

// List all supported agents
const agents = listAgents();

// Install a skill programmatically
await installSkill('code-review', ['claude-code', 'copilot'], '', 'project');
```

## Contributing

Contributions welcome:

- **New skills** — Follow the structure in [SKILLS_STRUCTURE.md](SKILLS_STRUCTURE.md)
- **New agents** — Add to [lib/agents.js](lib/agents.js) with both project and global paths
- **Bug fixes** and improvements

## License

MIT
