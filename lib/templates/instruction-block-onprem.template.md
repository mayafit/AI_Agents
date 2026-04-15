## On-Prem / Local-LLM Guardrails

These rules apply ONLY when this project is installed with `profile: on-prem`.
They are appended to the universal block by the composer in `lib/installer.js`.
Local LLMs (Nemotron, Qwen, DeepSeek, Llama-3, etc. served via vLLM, Ollama, or
TGI) fail in patterns cloud LLMs rarely exhibit — the rules below pin those
failure modes down explicitly. Keep these rules verbatim in every response
context where tool use is possible.

### Reasoning mode: `/no_think` on planning-phase prompts

Local reasoning-capable models (Nemotron-variants and similar) default to
chain-of-thought reasoning that bloats planning-phase prompts with internal
deliberation the operator does not need to read. Prepend the literal token
`/no_think` as the first line of any planning-phase system prompt or user turn
you compose. The token is consumed by the serving layer and suppresses the
model's reasoning trace on that turn.

- Planning-phase turns (PM, Architect, Tech Lead): begin the turn with
  `/no_think` on its own line. Reasoning-mode OFF.
- Implementation-phase turns (Dev): omit `/no_think`. Reasoning-mode ON is
  desirable for stepwise code synthesis and debugging.
- Review / QA turns: omit `/no_think` when the review benefits from explicit
  reasoning (root-cause analysis). Include `/no_think` for mechanical checks
  (lint, style, formatting).

If the downstream serving layer does not recognize `/no_think`, it is a no-op
text token — safe to include unconditionally on planning turns.

### No writes to `~/.claude/` or any user home directory

Local LLMs frequently hallucinate paths under `~/.claude/`, `~/.cache/`,
`~/Library/`, or `%APPDATA%` — imitating patterns learned from Claude Code and
Cursor training data. These paths are OUTSIDE the project and cross-contaminate
other projects on the same machine.

- NEVER create, write, or modify files under `~/.claude/`, `~/.cache/`,
  `~/Library/`, `~/AppData/`, `%APPDATA%`, or any path that resolves outside
  the current project directory.
- All project artifacts — code, configuration, logs, scratch notes, and agent
  state — MUST land under the current working directory (the project root) or
  an explicitly-named subdirectory thereof.
- When a tool call appears to target a home-directory path, refuse the write
  and respond in text explaining the violation. Ask the user for an explicit
  in-project path before proceeding.

### No `str_replace_editor` or Claude Code-specific tools

Local LLMs hallucinate Anthropic-proprietary tools — most commonly
`str_replace_editor`, `text_editor_20241022`, and `computer_use_preview` — that
do NOT exist outside the Anthropic API. Calling them against a local-LLM
serving layer produces a tool-not-found error or, worse, a silent no-op.

- Do NOT emit tool calls named `str_replace_editor`, `text_editor_*`,
  `computer_use_*`, or any other tool whose name includes `str_replace_editor`
  or matches Anthropic-specific tool schemas.
- Use only tools enumerated in the active tool manifest (`MANIFEST.yaml`) or
  the IDE's native tool surface (Roo Code, Cline, OpenCode native tools).
- When you want to edit a file, use the native file-write tool of the active
  agent — not `str_replace_editor`. If unsure what tool is available, list
  available tools or ask the user before emitting a tool call.

### Per-phase reasoning and sampling guidance

Local LLMs require tighter sampling control than cloud LLMs. Use these defaults
unless the serving layer overrides them.

- **Planning phase (PM, Architect, Tech Lead):**
  - Reasoning: OFF (`/no_think` prepended).
  - Temperature: low (0.0 – 0.3). Planning artifacts should be deterministic
    and reproducible.
  - Top-p: 0.9 or unset. Top-k: unset.
  - Max tokens: generous (8k+) — planning documents are long.
- **Implementation phase (Dev):**
  - Reasoning: ON (omit `/no_think`).
  - Temperature: moderate (0.3 – 0.6). Code synthesis benefits from controlled
    exploration but not creative rewriting.
  - Top-p: 0.95 or unset. Top-k: unset.
  - Max tokens: generous (8k+) — full-file rewrites are common.
- **Review / QA phase:**
  - Reasoning: ON for root-cause analysis; OFF for mechanical checks.
  - Temperature: low (0.0 – 0.2). Reviews should be deterministic.

If the serving layer applies its own sampler defaults, the per-phase guidance
above is advisory — but the phase boundary and `/no_think` placement are
load-bearing and MUST be honored on every turn.
