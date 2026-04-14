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
