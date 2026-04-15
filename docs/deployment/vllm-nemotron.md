# vLLM Deployment Reference: Nemotron Super 49B

This document covers the recommended vLLM server configuration for running **Nvidia Nemotron Super 49B v1** (or similar Nemotron-class reasoning models) as the local LLM backend for `ma-agents` on-prem installations.

> **Scope:** This document is reference documentation for the human operator who runs the vLLM inference server. It is not stamped into target projects by the `ma-agents` installer (FR179). Agent-side guardrails are delivered by the on-prem instruction block (`lib/templates/instruction-block-onprem.template.md`) installed into each project's agent files.

---

## Recommended vLLM Flags

All five flags below are recommended for Nemotron Super 49B. Omitting any of them will degrade either correctness or stability.

### `--enable-auto-tool-choice`

Enables automatic tool/function call parsing for supported models. Without this flag, vLLM treats model output as plain text and never extracts structured tool calls, causing the agent runtime to receive raw JSON embedded in prose rather than a parsed tool invocation. Required for any coding agent workflow that relies on file-editing or shell-execution tools.

### `--tool-call-parser qwen3_coder`

Selects the Qwen3-Coder-compatible parser that correctly extracts structured tool calls from Nemotron's output format. Nemotron Super 49B uses the same tool-call serialization convention as the Qwen3-Coder family. Using the wrong parser (e.g., `hermes`) causes malformed or silently dropped tool calls.

### `--max-model-len 32768`

Caps the context window at 32K tokens. This balances the KV-cache VRAM budget against coding task context requirements — sufficient for full repository context plus long multi-turn chats. Without an explicit cap, vLLM allocates KV-cache for the model's maximum trained length (often 128K+), exhausting VRAM before the first request completes on single-GPU configurations.

### `--enforce-eager`

Disables CUDA graph capture. This eliminates the first-request latency spike (CUDA graph warm-up can take 30–90 seconds on large models) and resolves some multi-turn inference stability issues observed with Nemotron-class models. The trade-off is slightly lower sustained throughput on back-to-back short requests. For interactive coding agent use where latency-per-request matters more than throughput, `--enforce-eager` is the correct default.

### `--trust-remote-code`

Required by the Nemotron Super 49B model class to load custom model code from the HuggingFace snapshot. Nemotron ships custom attention and RoPE scaling implementations that are not yet merged into the vLLM mainline. **Only set this flag when the model source is trusted** — for Nvidia's official HuggingFace repository (`nvidia/Nemotron-Super-49B-v1`) this is safe; for third-party forks, verify the model code before enabling.

---

## Sample `vllm serve` Command

Copy-paste-runnable launch command composing all recommended flags:

```bash
vllm serve nvidia/Nemotron-Super-49B-v1 \
  --enable-auto-tool-choice \
  --tool-call-parser qwen3_coder \
  --max-model-len 32768 \
  --enforce-eager \
  --trust-remote-code \
  --dtype bfloat16
  # Per-request sampling parameters are set client-side (see sampling table below):
  # Planning phase:       temperature=0.0, top_p=1.0
  # Implementation phase: temperature=0.6, top_p=0.95
```

> **Note on `--dtype`:** Use `bfloat16` for full-precision inference (requires 2× H100 80GB). For single-GPU deployments, substitute with `--quantization fp8` or `--quantization nvfp4` — see the quantization table below. Remove `--dtype bfloat16` when using a quantization flag, as they are mutually exclusive.

---

## Quantization Tradeoffs

| Quantization | Approx. VRAM (49B, single H100 80GB) | Instruction-Following Quality |
|---|---|---|
| BF16 | ~98 GB (requires 2× H100) | Best — full precision weights |
| FP8 | ~49 GB (fits 1× H100 80GB) | Near-BF16 — minor degradation on complex reasoning |
| NVFP4 | ~25 GB (fits 1× A100 40GB) | Acceptable — recommended starting point for constrained hardware; test instruction-following quality for your use-case |

> **Assumptions:** VRAM figures assume no KV-cache at model load time with `--max-model-len 32768`. Actual VRAM usage is higher at inference as KV-cache fills. Tensor-parallel configurations (e.g., `--tensor-parallel-size 2`) can distribute the model across multiple GPUs, enabling BF16 on 2× H100 80GB.

**Recommended starting point for constrained hardware:** NVFP4 on a single A100 40GB. Validate instruction-following quality for your specific task mix before using in production — planning-phase prompts (deterministic, `/no_think`) are typically less sensitive to quantization than implementation-phase prompts (reasoning ON).

---

## Reasoning Mode and `/no_think`

Nemotron Super 49B is a reasoning model. **Thinking mode is ON by default** — the model prefixes its response with an extended internal monologue (`<think>...</think>`) before producing its answer. For coding tasks, this improves output quality at the cost of higher token consumption and latency.

### Disabling Reasoning for Planning Personas

Planning-phase agents (PM, Architect, Scrum Master, Analyst, Tech Writer, UX, QA) produce structured documents where extended reasoning adds latency without improving output quality — and where deterministic output (`temperature=0.0`) is preferred. To disable reasoning for these personas, prepend `/no_think` to the system prompt.

The `ma-agents` on-prem installer delivers `/no_think` in two places:

1. **Per-agent system prompt prefix** — the BMAD persona phase-aware prefix (Story 21.7) prepends `/no_think` to the system prompt of all planning-phase personas at install time.
2. **Per-tool instruction blocks** — `lib/templates/instruction-block-onprem.template.md` also injects `/no_think` into the per-tool instruction blocks stamped into `CLAUDE.md`, `.roo/rules/`, `.clinerules`, and `AGENTS.md` for planning-mode agents.

### Retaining Reasoning for Implementation Personas

Reasoning mode is intentionally **left ON** for implementation personas (`bmm-dev`, `bmm-quick-flow-solo-dev`). The extended chain-of-thought improves code generation quality, catches edge cases, and produces more careful reasoning about algorithmic choices. The higher token cost is accepted for implementation tasks.

---

## Per-Phase Sampling Parameters

Sampling parameters are set client-side on each request (not in the `vllm serve` command). Configure your agent client or OpenAI-compatible API call accordingly.

| Phase | Temperature | top_p | Notes |
|---|---|---|---|
| Planning (PM, Architect, SM, Analyst, Tech Writer, UX, QA) | 0.0 | 1.0 | Deterministic — avoids hallucinated artifacts; use with `/no_think` |
| Implementation (Dev, Quick-Flow-Solo-Dev) | 0.6 | 0.95 | Allows creative solutions; reasoning ON |

> **Why `temperature=0.0` for planning?** Planning artifacts (PRDs, architecture docs, stories) must be reproducible across re-runs. Non-deterministic output at planning phase leads to artifact drift between sessions, which breaks BMAD-METHOD's assumption that prior context documents are stable. Setting `temperature=0.0` makes the model greedy and fully deterministic given the same prompt.

> **Why `temperature=0.6` for implementation?** Implementation tasks benefit from creative exploration — slightly non-zero temperature allows the model to consider multiple candidate approaches rather than always taking the locally-greedy token path. Combined with reasoning ON, this produces higher-quality code than either `temperature=0.0` or pure sampling alone.

---

## `str_replace_editor` Hallucination Warning

### Failure Mode

Local LLMs — including Nemotron-class models — may hallucinate invocations of `str_replace_editor`. This tool exists only in Claude Code (Anthropic's hosted Claude environment) and is not available in any locally-hosted LLM agent runtime. When a local model generates a `str_replace_editor` tool call:

- The agent runtime fails silently or returns a tool-not-found error.
- No actual file is edited.
- The model may then proceed as if the edit succeeded, producing divergent state between the model's internal belief and the actual file system.
- Downstream tool calls (e.g., `read_file`, `bash`) may then operate on stale content, compounding the error.

This failure mode is insidious because it is often silent — the model does not retry, and the user may not notice until the generated code is tested.

### Mitigations Delivered by `ma-agents`

`ma-agents` addresses this at two layers:

**Layer 1 — Instruction-block prohibition (Story 21.6)**

The on-prem instruction block (`lib/templates/instruction-block-onprem.template.md`) explicitly forbids invoking `str_replace_editor` in the per-tool rules injected into every agent's instruction file (`CLAUDE.md`, `.roo/rules/`, `.clinerules`, `AGENTS.md`). This rule is present in every on-prem agent installation and is re-stamped on each `ma-agents` update.

**Layer 2 — Application-layer path restriction (Stories 21.3, 21.4)**

- **Roo Code:** `.roomodes` `fileRegex` patterns (Story 21.3) constrain planning personas to documentation-only paths (e.g., `_bmad-output/**`, `docs/**`). Even if a planning persona hallucinates a `str_replace_editor` call targeting a source file, the Roo Code application layer will block the tool call before it reaches the filesystem.
- **OpenCode / AGENTS.md:** Story 21.4 similarly scopes planning personas in `AGENTS.md` to documentation paths, reducing the surface where a misrouted tool call could corrupt code files.

> **Operator action required:** Neither mitigation eliminates the underlying model behavior. Monitor agent session logs for `str_replace_editor` in model outputs — occurrences indicate the model is operating outside its instruction-following envelope and may require prompt tuning or a different quantization level.
