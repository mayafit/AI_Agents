# On-Prem & Local-LLM Agent Tuning — Architecture Decisions

> **Shard** of the [Architecture index](../../architecture.md). Content is verbatim from the
> pre-split document; the index carries the front matter, registers and reading order.
>
> Constrains prd/capabilities/on-prem-and-local-llm.md.

---

## Decisions

### Decision P3-3: Local-LLM / On-Prem Agent Tuning Profile (FR172–FR179, NFR44–NFR47) (2026-04-13)

**Problem:** The primary deployment target for ma-agents is air-gapped enterprise networks where teams use AI coding agents (Claude Code, Cline, Roo Code, OpenCode) against on-prem LLMs such as Nemotron Super 49B — not Anthropic's Claude. Field experience documented in `optimizing-local-llm-coding-agents-bmad.md` (2026-04 conversation) shows local LLMs misinterpret Claude-tuned system prompts: they create files when asked questions, dump output into `~/.claude/`, hallucinate Claude Code's `str_replace_editor` tool, skip BMAD planning to start coding, and overthink simple prompts because reasoning mode is on by default. The agent host tools (Roo Code, Cline, OpenCode) actually expose strong guardrail mechanisms — file-regex restrictions, Plan/Architect modes, permission gating — but ma-agents does not currently generate the configuration that activates them. Standards-profile installs (Claude on web, Anthropic API) do not need local-LLM-specific guardrails (`/no_think`, `str_replace_editor` warnings) and arguably regress when those are present.

**Decision:** Introduce a two-layer install-time tuning model driven by a single user-facing choice — **profile** — captured during the install wizard and persisted in `.ma-agents.json`.

1. **Universal layer (all profiles):** Expand the existing per-tool instruction injection to enforce text-vs-file discipline and BMAD phase boundaries through richer templates — including a new `.roomodes` template for Roo Code that applies file-regex restrictions per BMAD phase. These guardrails benefit every install regardless of model, because they prevent premature implementation and out-of-scope writes that affect Claude users too.
2. **On-prem layer (profile=on-prem only):** Layer model-specific guardrails on top of the universal block — `/no_think` planning prefix, no-home-dir-writes rule, no-`str_replace_editor` rule, reasoning-mode/sampling guidance, BMAD persona phase-aware prompt prefixes.

The inference-server tuning (vLLM flags, quantization, context length) is documentation-only at `docs/deployment/vllm-nemotron.md` — the installer does not manage the serving stack.

**Architecture fit:**

| Concern | Resolution |
|---------|-----------|
| User-facing surface | One question added to the install wizard (`Is this an on-prem / air-gapped install using a local LLM?`). Persisted as `"profile": "on-prem"\|"standard"` in `.ma-agents.json`. `--yes` defaults to `standard` (no prompt) for CI/CD. No `--profile=` CLI flag is exposed — on-prem CI/CD is served by committing `.ma-agents.json` with the persisted value to the repo (same pattern repo-layout config already uses) |
| Universal injection extension | Existing marker-based injection in [lib/installer.js](lib/installer.js) is extended with richer content; agent registry in [lib/agents.js](lib/agents.js) gains an optional `extraInstructionTemplates` field per agent for tool-specific files (notably `.roomodes` for Roo Code) |
| Per-tool templates | New files under [lib/templates/](lib/templates/): `instruction-block-universal.template.md`, `instruction-block-onprem.template.md`, `roomodes.template.yaml`, `agents-md.template.md` (OpenCode), `clinerules.template.md` (Cline). The `CLAUDE.md`/`.cline/clinerules.md`/`.roo/rules/` markdown injection composes universal + (optionally) on-prem block within the same `<!-- MA-AGENTS-START -->` markers. Note: `.clinerules/` is a **directory** (not an injection target) — the Cline instruction file is `.cline/clinerules.md` only. The `.roomodes` and `AGENTS.md` files are stamped as separate per-tool artifacts |
| Roo Code BMAD modes | The `.roomodes` template defines four custom modes (`bmad-pm`, `bmad-architect`, `bmad-techlead`, `bmad-dev`) with `groups` declaring `fileRegex` restrictions per BMAD phase. Enforcement happens at Roo Code's tool-call layer (`FileRestrictionError`) — not just in the prompt. This is the highest-leverage application-layer guardrail in the design |
| BMAD persona phase prefix | When profile=on-prem, [lib/bmad-customize/](lib/bmad-customize/) `*.customize.yaml` files gain an additional system-prompt prefix block keyed by phase. Planning personas (PM, Architect, SM, Analyst, Tech Writer, UX, SQA) get reasoning-OFF / text-response guidance; implementation personas (Dev Amelia, Solo Dev Barry) get reasoning-ON / careful-implementation guidance. The customize loader composes the prefix only when profile=on-prem; standard profile customizations are unchanged |
| Profile read site | A small new module [lib/profile.js](lib/profile.js) wraps profile read/write against `.ma-agents.json` with a single-source-of-truth API (`getProfile()`, `setProfile()`, `resolveProfile({ persisted, yesMode })`). All callers in installer/customize go through it |
| Log string formats | Canonical formats (pin these exactly): `Using profile: on-prem (from .ma-agents.json)` / `Using profile: standard (from .ma-agents.json)` / `Using profile: standard (from --yes default)` / `Using profile: <value> (from wizard)`. Tests and docs reference these strings verbatim |
| OpenCode JSON merge | OpenCode's existing JSON-merge injection into `opencode.json::instructions[]` is reused unchanged. The expanded `AGENTS.md` is added to the instructions array; on-prem block is appended only when profile=on-prem |
| Idempotency | Profile-driven content is rewritten only inside marker blocks (`<!-- MA-AGENTS-START -->`/`<!-- MA-AGENTS-END -->`) and inside ma-agents-owned `customModes` slugs in `.roomodes`. User content outside markers is preserved (NFR46) |
| Reference deployment doc | `docs/deployment/vllm-nemotron.md` ships in the repo, not under `lib/templates/`. It is not stamped into target projects. Linked from README's on-prem section |

**Alternatives considered:**
- *CLI flag only (`--profile=on-prem`), no interactive prompt:* Rejected — most users run the wizard, won't pass the flag, and would lose the on-prem guardrails entirely.
- *Both interactive prompt AND `--profile=` CLI flag as override:* Rejected (2026-04-14 correction) — the product-owner decision is that profile is user-facing or team-facing, not per-invocation. Teams with on-prem CI/CD commit `.ma-agents.json` with the persisted value to the repo; this is the same pattern already used for repo-layout config and avoids the operational footgun of a CI job forgetting the flag. The user-feedback model is "ask once, persist forever," matching the existing wizard pattern.
- *Default everyone to on-prem guardrails:* Rejected — `/no_think` and `str_replace_editor` warnings are noise for Claude-on-web users and regress that path. Universal layer goes to everyone; model-specific layer is opt-in.
- *Manage the vLLM serving stack from the installer (e.g., generate `serve-nemotron.sh`):* Rejected — the installer runs on engineer dev machines, not inference servers. Mixing concerns. Reference doc is sufficient.
- *Generate per-tool config purely via prompt instruction (no `.roomodes`):* Rejected — Roo Code's `fileRegex` restriction is application-layer enforcement that catches violations the prompt cannot. NFR47 makes this enforcement contract testable.

**Files affected:**
- `bin/cli.js` (new wizard prompt only; no CLI flag — correction applied 2026-04-14)
- `lib/installer.js` (read profile via `lib/profile.js`; compose universal + on-prem instruction blocks; stamp `.roomodes` and `AGENTS.md` per-tool artifacts)
- `lib/profile.js` (new — profile read/write API against `.ma-agents.json`)
- `lib/agents.js` (per-agent `extraInstructionTemplates` field for `.roomodes` and `AGENTS.md`)
- `lib/templates/instruction-block-universal.template.md` (new)
- `lib/templates/instruction-block-onprem.template.md` (new)
- `lib/templates/roomodes.template.yaml` (new — 4 BMAD modes with `fileRegex`)
- `lib/templates/agents-md.template.md` (new — OpenCode AGENTS.md)
- `lib/templates/clinerules.template.md` (new — extended Cline rules)
- `lib/bmad-customize/*.customize.yaml` (additive — phase-prefix block, applied only when profile=on-prem at customize-loader time)
- `lib/bmad-customize/customize-loader.js` (or equivalent — compose phase prefix when profile=on-prem)
- `docs/deployment/vllm-nemotron.md` (new — reference deployment guide; not stamped into projects)
- `README.md` (new on-prem section linking to the deployment guide and explaining the profile prompt)
- `test/profile.test.js` (new — read/write/resolve precedence)
- `test/onprem-injection.test.js` (new — standard vs on-prem produces correct instruction-block content; idempotency; `.roomodes` slug isolation)

---
