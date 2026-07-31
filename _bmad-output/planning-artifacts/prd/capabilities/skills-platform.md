# Skills Platform — Management, Portability & Enforcement

> **Shard** of the [PRD index](../../prd.md). Content is verbatim from the
> pre-split document; the index carries the front matter, registers and reading order.
>
> Capabilities F1 (Skill Management & Portability), F2 (Skill Enforcement),
> F15 (Developer Infrastructure).
> 
> FR204–FR206 (Git Workflow Guardrails, "all profiles") were physically located
> inside the Local-LLM / On-Prem section between FR176 and FR177. They are
> governed by Architecture Decision P5-4 and constrain the enforcement
> instruction block, so they are placed here. IDs and text are unchanged.

---

## Functional Requirements

### Skill Management & Portability

- FR1: Engineers can install one or more skills into any supported AI agent with a single command
- FR2: Engineers can uninstall previously installed skills from an agent
- FR3: Engineers can view the list of all available skills with descriptions and categories
- FR4: Engineers can view the installation status of skills for a specific agent
- FR5: Engineers can upgrade skills when a newer version is available, with upgrade detection
- FR6: Engineers can install skills in non-interactive mode for CI/CD pipeline automation
- FR7: Engineers can install skills across multiple agents simultaneously from one manifest
- FR34: Engineers can target any of the supported IDE agents (Claude Code, Cursor, Cline, Copilot, Gemini, Kilocode, OpenCode) for skill installation
- FR35: Engineers can target BMAD specialized agents (SRE, DevOps, Cyber, MIL-STD-498) for persona installation
- FR36: Skills produce functionally equivalent behavior regardless of which agent they are installed into
- FR37: Engineers can switch between AI agents and retain the same methodology framework
- FR38: The system translates skill content into each agent's native configuration format automatically
- FR44: Engineers can install and use skills in air-gapped environments without internet access
- FR45: Engineers can use ma-agents on Windows, macOS, and Linux
- FR46: Engineers can use ma-agents with on-premise AI agents running against local models
- FR47: The system tracks installed skill versions per agent via manifest for upgrade/downgrade detection

### Skill Enforcement

- FR51: The installer injects the planning instruction at the TOP of agent instruction files, not the bottom — ensuring highest priority during LLM context processing
- FR52: The installer deploys a BMAD extension module (`extends-module: bmm`) that injects skill-loading `critical_actions` into BMAD agents — skills are loaded before any menu or workflow executes
- FR53: All 11 BMAD agents (4 custom: SRE, DevOps, Cyber, MIL-498 + 7 built-in: bmad-master, analyst, architect, dev, pm, qa, sm) include skill-loading `critical_actions` — custom agents via `.customize.yaml` files, built-in agents via the BMAD extension module
- FR54: Per-agent enforcement mechanisms are implemented where the agent supports them (e.g., Claude Code hooks that verify manifest was read)
- FR55: Context persistence strategies ensure skills survive LLM context compression and session restoration (via BMAD sidecar memory or equivalent)

#### Git Workflow Guardrails (all profiles)

- FR204: The installer composes a dedicated instruction-block fragment — `lib/templates/instruction-block-git.template.md` — and appends it to the universal block within the `<!-- MA-AGENTS-START -->` markers in every per-tool instruction injection target (`CLAUDE.md`, `.cline/clinerules.md`, `.roo/rules/00-ma-agents.md`, `AGENTS.md`). The git template is profile-independent — it ships in every install (standard and on-prem) because git discipline applies regardless of which LLM the agent runs against. The composer is the existing `composeInstructionBlock({ profile, projectRoot })` in `lib/installer.js`; no new injection target, no new marker pair, no change to user content outside the markers
- FR205: The git template body codifies the worktree-based rules that today live only in `skills/git-workflow-skill/SKILL.md` (and partially in `lib/templates/project-context.template.md` lines 22–29) — sources reachable only via indirection that fails when the model skips the manifest read or no BMAD agent is active. Specifically the template states, in plain rule form: (1) every file-changing task must run inside a fresh git worktree on a feature branch — never directly on `main`, `dev`, `master`, or the configured trunk branch; (2) commit messages must follow Conventional Commits with prefix in `{feat, fix, chore, docs, refactor, test, ci}`; (3) integration into the trunk happens via a pull request — never via direct push, never via auto-merge without explicit human approval; (4) the agent self-runs the `code-review` skill on its own output before opening the PR; (5) after merge the worktree is removed (`git worktree remove`) and the feature branch deleted. The template references `skills/git-workflow-skill/SKILL.md` and `skills/git-workflow-skill/scripts/start-feature.sh` / `finish-feature.sh` for the scripted procedure but is self-sufficient as a first-context-window rule. The template must not mention any local-LLM-specific concept (`/no_think`, `str_replace_editor`, `~/.claude/`) — those belong only in the on-prem template
- FR206: Composition order within the `<!-- MA-AGENTS-START -->` marker block is fixed and deterministic: `[universal block]` → `[git block]` → `(profile === 'on-prem' ? [on-prem block] : '')`. The marker-block idempotency contract from FR176 is preserved — re-running the installer with the same profile and project state produces byte-identical content inside the markers, and content outside the markers is preserved untouched. If `lib/templates/instruction-block-git.template.md` is missing on disk the composer throws a clear error, matching the existing error pattern for a missing on-prem template

### Developer Infrastructure

- FR73: The 4 core modules (cli.js, installer.js, agents.js, bmad.js) have automated regression tests that verify architectural contracts (pipeline ordering, additive-only operations, template resolution, command routing)
