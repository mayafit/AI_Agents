# Story 21.8: vLLM Reference Deployment Doc and README On-Prem Section

Status: backlog

## Story

As a **DevOps engineer setting up the on-prem inference server**,
I want a single reference doc covering vLLM flags, tool-call-parser, context length, quantization, and per-phase sampling guidance,
So that I can configure Nemotron Super 49B (or similar) to behave correctly with the coding agents ma-agents installs.

## Acceptance Criteria

1. New file `docs/deployment/vllm-nemotron.md` exists covering:
   - Recommended vLLM launch command with all critical flags: `--enable-auto-tool-choice`, `--tool-call-parser qwen3_coder`, `--max-model-len 32768`, `--enforce-eager`, `--trust-remote-code`, `--seed=1`
   - Quantization tradeoffs (BF16 vs FP8 vs NVFP4) including VRAM and instruction-following quality impact — table format
   - Reasoning-mode behavior: `/no_think` system-prompt directive enables reasoning-OFF; default is reasoning-ON
   - Per-phase sampling parameters table (planning: temp 0.0, top_p 1.0; implementation: temp 0.6, top_p 0.95)
   - The `str_replace_editor` hallucination warning and mitigation (cross-reference to the on-prem template content from Story 21.6)
   - A complete sample launch command block ready to copy-paste
   - Cross-reference to `optimizing-local-llm-coding-agents-bmad.md` as the source playbook
2. `README.md` gains a new top-level section "On-Prem / Air-Gapped Deployment" containing:
   - One-paragraph overview of the on-prem use case
   - Explanation of the install-time profile prompt (`Is this an on-prem install?`)
   - Link to `docs/deployment/vllm-nemotron.md`
   - Link to the source playbook `optimizing-local-llm-coding-agents-bmad.md`
3. The deployment doc is NOT stamped into target projects by the installer — it is repo documentation only (FR179). Verified by grep on `lib/installer.js` and `lib/templates/` for any reference to the deployment doc path.
4. The deployment doc explicitly states it is informational only — running ma-agents does not configure or manage the vLLM server.
5. Documentation only: this story adds NO code, NO tests beyond a docs-link sanity check.
6. **Sampling parameters owned by the vLLM reference doc, not the prompt.** The per-phase sampling-parameters table (temperature/top_p values, e.g., planning: temp 0.0, top_p 1.0; implementation: temp 0.6, top_p 0.95) lives in `docs/deployment/vllm-nemotron.md` and nowhere else in the repo. The doc must contain an explicit statement of this ownership with a phrase along the lines of: `"The agent prompt does not control sampling; sampling is set at the vLLM request/serve layer. The table below is for operators configuring the serve or the agent's request parameters, not for end-users."` Verified by (a) presence of the sampling table in the doc, (b) presence of the ownership statement, (c) cross-referenced with Story 21.6 AC #11 which forbids numerical values in the on-prem prompt template. Finding #12 is closed by the combination of 21.6 AC #11 (no numbers in prompt) + 21.8 AC #6 (numbers only in serving doc, with ownership disclaimer).
7. **Tool-call-parser flag provenance and cross-model validation warning.** The doc must cite the provenance of `--tool-call-parser qwen3_coder`: specifically, that this parser was validated to work with Nemotron Super 49B v1.5 per the source conversation `optimizing-local-llm-coding-agents-bmad.md` (dated April 2026). Immediately following the citation, the doc must contain a clearly-marked warning paragraph (formatted as a `NOTE:` or `WARNING:` admonition) with content along the lines of: `"NOTE: This parser flag is validated for Nemotron Super 49B v1.5. Users deploying other Nemotron versions or different local LLMs MUST validate the parser flag against their model's HuggingFace card — copy-paste of this flag to an unvalidated model risks silent tool-call corruption."` Verified by grep: presence of `Nemotron Super 49B v1.5` in the same paragraph as `qwen3_coder`, and presence of the cross-model validation warning paragraph.

## Tasks / Subtasks

- [ ] Task 1: Create `docs/deployment/vllm-nemotron.md` per AC #1
  - [ ] 1.1 Source content from `optimizing-local-llm-coding-agents-bmad.md` Section 6 (Model Deployment Optimization)
  - [ ] 1.2 Include the full sample launch command from Section 6.7
  - [ ] 1.3 Include the sampling table from Section 8 (Quick Reference Cheat Sheet)
- [ ] Task 2: Update `README.md` per AC #2
  - [ ] 2.1 Choose insertion point — after "Installation" / before "Skill Library" reads naturally
  - [ ] 2.2 Add the section with overview, profile-prompt explanation, and links
- [ ] Task 3: Sanity check (AC #3, #4, #5)
  - [ ] 3.1 Grep `lib/` for any reference to the deployment doc path → must return zero matches
  - [ ] 3.2 Doc explicitly disclaims installer responsibility for the inference server
- [ ] Task 4: Optional — link-check
  - [ ] 4.1 If a markdown link checker is in the test suite, verify all internal links in the new doc and README section resolve
- [ ] Task 5: Sampling ownership + prompt/server boundary (AC #6)
  - [ ] 5.1 Include the per-phase sampling table in the vLLM reference doc
  - [ ] 5.2 Add the ownership statement ("agent prompt does not control sampling...") immediately above the table
  - [ ] 5.3 Cross-reference Story 21.6 AC #11 in a short parenthetical ("Numbers deliberately omitted from the on-prem prompt template; see Story 21.6 AC #11.")
- [ ] Task 6: Tool-call-parser provenance + cross-model warning (AC #7)
  - [ ] 6.1 Cite `optimizing-local-llm-coding-agents-bmad.md` (April 2026) as the source validating `--tool-call-parser qwen3_coder` for Nemotron Super 49B v1.5
  - [ ] 6.2 Add the `NOTE:` admonition warning against copy-paste to unvalidated models

## Dev Notes

### Architecture Compliance

- **Decision P3-3** — Inference-server tuning is documentation only. The installer runs on engineer dev machines, not inference servers. Mixing concerns rejected in the architecture decision.
- **FR179** — Doc ships in the repo, not into projects.

### Source Tree Components to Touch

| File | Change |
|------|--------|
| `docs/deployment/vllm-nemotron.md` | CREATE |
| `README.md` | MODIFY — new "On-Prem / Air-Gapped Deployment" section |
| `optimizing-local-llm-coding-agents-bmad.md` | NO CHANGE — referenced as source |

### Dependencies

- None — pure docs story, can ship in parallel with other Epic 21 stories.

### Reference

Entire source playbook `optimizing-local-llm-coding-agents-bmad.md` Section 6 — verbatim usable for most of the content. Adapt formatting to match repo doc conventions.

### Out of Scope

- Any installer changes
- vLLM Docker images, Helm charts, or deployment automation
- Per-model tuning beyond Nemotron Super 49B (other local LLMs may need different parsers — out of scope; doc may include a one-line note)

## Dev Agent Record

### Agent Model Used
_(to be filled by dev agent)_

### Debug Log References
_(to be filled)_

### Completion Notes List
_(to be filled)_

### File List
_(to be filled)_

## Change Log
- 2026-04-14: Story created (Epic 21, Story 21.8)
- 2026-04-14: Added AC #6 making the vLLM reference doc the sole owner of per-phase sampling parameters with an explicit prompt-vs-server ownership statement (Finding #12-b, corrective plan step 3). Paired with Story 21.6 AC #11 to close Finding #12 end-to-end.
- 2026-04-14: Added AC #7 requiring parser-flag provenance citation for `--tool-call-parser qwen3_coder` (Nemotron Super 49B v1.5, per source playbook dated April 2026) and a cross-model validation warning (Finding #13, corrective plan step 3).
