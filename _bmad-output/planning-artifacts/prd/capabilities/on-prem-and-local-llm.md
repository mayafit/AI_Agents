# On-Prem & Local-LLM Agent Tuning

> **Shard** of the [PRD index](../../prd.md). Content is verbatim from the
> pre-split document; the index carries the front matter, registers and reading order.
>
> Capability F19 — air-gapped enterprise networks running local non-Claude
> LLMs. Architecture: P3-3.
> 
> FR204–FR206 have been moved out of this capability to the Skills Platform:
> their own subsection title says "all profiles" and P5-4 governs them.

---

## Functional Requirements

### Local-LLM / On-Prem Agent Tuning

#### Install Profile

- FR172: During `npx ma-agents install` (interactive wizard and direct install), the installer prompts the user to choose between two profiles: **standard** (Claude on web, Anthropic API, or other frontier hosted models) and **on-prem** (air-gapped network running a local LLM such as Nemotron Super 49B). The chosen profile is persisted as `"profile"` in `.ma-agents.json` so subsequent installs do not re-prompt
- FR173: `--yes` (non-interactive / CI/CD mode) defaults the profile to `standard` when no value is persisted, and does not prompt. For on-prem CI/CD, teams run the installer once interactively to persist `"profile": "on-prem"` in `.ma-agents.json` and commit that file; subsequent CI runs honor the persisted value. No CLI flag is exposed for profile — the choice is user-facing (interactive prompt) or team-facing (committed `.ma-agents.json`), not a per-invocation flag

#### Universal Per-Tool Guardrail Templates (all profiles)

- FR174: For every supported IDE/agent target, the installer ships expanded per-tool configuration that enforces "respond in text vs. create files" discipline and BMAD phase boundaries — applied regardless of profile. Specifically: an expanded `<!-- MA-AGENTS-START -->` injection block in `CLAUDE.md`, `.cline/clinerules.md`, and `.roo/rules/00-ma-agents.md`; an expanded `AGENTS.md` template for OpenCode covering the same rules; and a new `.roomodes` file for Roo Code defining four BMAD modes (`bmad-pm`, `bmad-architect`, `bmad-techlead`, `bmad-dev`) each with appropriate `fileRegex` restrictions enforcing phase boundaries at the application layer
- FR175: The `.roomodes` template restricts file edit access by BMAD phase — `bmad-pm` and `bmad-architect` may only edit `.md` (and diagram extensions); `bmad-techlead` may only edit `.md`, `.json`, `.yaml`; only `bmad-dev` has full edit + command access. These restrictions are enforced by Roo Code's `FileRestrictionError`, not solely by prompt instructions
- FR176: Per-tool template stamping is additive — when an existing `AGENTS.md`, `.cline/clinerules.md`, `.roo/rules/00-ma-agents.md`, `.roomodes`, or `CLAUDE.md` is present, the installer merges via the existing marker pattern (`<!-- MA-AGENTS-START -->` / `<!-- MA-AGENTS-END -->`) without overwriting user content outside the markers. For `.roomodes` (YAML), additive merge preserves any user-defined `customModes` entries that do not conflict with ma-agents BMAD modes by slug. Note: `.clinerules` is treated as a directory — the installer does not write instruction content to it; instruction injection for Cline uses `.cline/clinerules.md` exclusively

#### On-Prem Profile Layered Guardrails

- FR177: When the active profile is `on-prem`, the installer layers additional local-LLM guardrails into the same per-tool instruction blocks: explicit "never create files in `~/.claude/` or any user home directory" rule; explicit "do NOT reference or use `str_replace_editor` or other Claude Code tools that may not exist" rule; a `/no_think` reasoning-OFF directive prefix for planning-phase prompts; and reasoning-mode / temperature guidance per BMAD phase
- FR178: When profile is `on-prem`, BMAD agent persona customizations under `lib/bmad-customize/` gain a phase-aware system-prompt prefix — planning-phase agents (PM John, Architect Winston, SM Bob, Analyst Mary, Tech Writer Paige, UX Sally, SQA Gadi) receive a reasoning-OFF / text-response directive; the implementation agent (Dev Amelia) receives a reasoning-ON / careful-implementation directive. These prefixes are not applied when profile is `standard`. (Note: the former quick-flow Dev persona `bmm-quick-flow-solo-dev` (Barry) was consolidated into Amelia in BMAD v6.3.0 per Story 22.3.)

#### Reference Deployment Documentation

- FR179: A reference deployment document for on-prem inference servers ships under `docs/deployment/vllm-nemotron.md` covering recommended vLLM flags (`--enable-auto-tool-choice`, `--tool-call-parser qwen3_coder`, `--max-model-len 32768`, `--enforce-eager`), quantization choices (BF16/FP8/NVFP4), reasoning-mode behavior, and per-phase sampling parameters. This is documentation only — the ma-agents installer does not manage the inference server
- FR180: The installer CLI exposes a `npx ma-agents reconfigure` subcommand that re-runs the profile-selection prompt with the currently-persisted value as the default, and — if the user changes the value — re-stamps all profile-dependent artifacts (instruction-block injection files, `.roomodes`, BMAD persona customize output). Each overwritten marker-block region is backed up to `<target>.backup-<ISO-timestamp>`. A history entry is appended to `.ma-agents.json::profileHistory` (new append-only field, capped at 20 entries). `--yes` is explicitly rejected for this subcommand to prevent accidental CI-triggered profile changes.
- FR181: The installer CLI exposes a `npx ma-agents uninstall --profile-artifacts` subcommand that removes all ma-agents-owned profile-dependent content from a project: marker-block content (and markers) in the 4 instruction-injection files (`CLAUDE.md`, `.cline/clinerules.md`, `.roo/rules/00-ma-agents.md`, `AGENTS.md`); the 4 ma-agents-owned `customModes` slugs in `.roomodes` (`bmad-pm`, `bmad-architect`, `bmad-techlead`, `bmad-dev`); and the `profile` field in `.ma-agents.json`. Note: `.clinerules` is a directory (not an instruction-injection file) — it is not in the uninstall scope; the `.clinerules/workflows/` subdirectory contains auto-generated wrappers that are regenerated on each install. User content outside markers and user-defined `.roomodes` slugs are preserved untouched. Audit-trail fields (`profileHistory`, `roomodesOverwriteLog`) are preserved; a new `{ from, to: null, source: "uninstall" }` entry is appended to `profileHistory`. Each removed file or region is backed up to `<target>.backup-<ISO-timestamp>`. `--yes` is supported for CI use (decommissioning scripts) — the opposite of `reconfigure`'s `--yes` rejection, because uninstall is removal (no hidden content swap) whereas reconfigure is content replacement.

## Quality Attributes (Non-Functional Requirements)

### Local-LLM / On-Prem Agent Tuning

- NFR44: On-prem profile guardrails must not regress standard profile behavior — when the persisted or supplied profile is `standard`, no `/no_think` directives, `str_replace_editor` warnings, or other local-LLM-specific instructions are present in any generated instruction file. Verified by diffing standard-profile install output against the pre-Epic-20 baseline
- NFR45: The profile prompt must be non-blocking in CI/CD — `--yes` defaults the profile to `standard` without prompting; in interactive mode the prompt appears once and the answer is persisted in `.ma-agents.json`; subsequent runs honor the persisted value without re-prompting. On-prem CI/CD is served by committing `.ma-agents.json` with `"profile": "on-prem"` to the repo — no per-invocation flag is provided
- NFR46: Per-tool template stamping must be idempotent — re-running `npx ma-agents install` with the same profile against the same project produces byte-identical instruction-file content within the marker blocks (only the marker block is rewritten; user content outside is untouched)
- NFR47: BMAD planning-mode file restrictions in the generated `.roomodes` must enforce phase boundaries at the application layer, not solely via prompt — verified by attempting a `.ts`/`.py` edit while in `bmad-architect` mode and confirming Roo Code rejects with `FileRestrictionError`
- NFR48: Profile changes via `ma-agents reconfigure` must leave an auditable forensic trail — `.ma-agents.json::profileHistory` is append-only (capped at 20 entries to prevent unbounded growth), and each entry records `date`, `from` (previous profile), `to` (new profile), and `source` (always `reconfigure` for entries produced by this subcommand; future sources — e.g., a direct `install --profile-override` if ever added — would use a distinct source identifier)
- NFR49: Uninstall must preserve user content and audit trails — after `ma-agents uninstall --profile-artifacts`, (a) every file that contained user content outside ma-agents markers must still contain that content byte-for-byte; (b) `.roomodes` must retain all user-defined `customModes` entries untouched; (c) `.ma-agents.json::profileHistory` and `.ma-agents.json::roomodesOverwriteLog` must be preserved in full; (d) no file created by the user (outside marker blocks and outside ma-agents-owned `.roomodes` slugs) may be deleted. Verified by per-file diff test in `test/uninstall.test.js` against a pre-uninstall snapshot.
