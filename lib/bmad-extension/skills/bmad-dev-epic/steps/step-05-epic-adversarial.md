# Step 05 — Epic-Level Adversarial Review & Package-Integrity Gate

**Goal:** Before any release action, prove that the assembled epic (all merged stories on the epic branch) aligns with requirements + architecture and did **not** break the `ma-agents` package. Operate on the integrated epic branch, not individual stories.

## 1. Adversarial alignment review — `bmad-review-adversarial-general` [REVIEW_MODEL]

Run a cynical, whole-epic review against the full diff `main...feature/epic-<epic-id>`:
- Does the implementation satisfy the epic's requirements and acceptance criteria?
- Does it conform to the project architecture / `project-context.md` and the always-load standards?
- Cross-story coherence: do the merged stories form a consistent whole, or did parallel development introduce contradictions, dead code, or duplicated abstractions?
- Did anything regress in adjacent, untouched areas?

Produce a findings report graded by severity. **Blocking** findings (requirement/architecture violation, regression, broken contract) must be remediated: spawn an `{exec_model}` fix subagent scoped to the finding, re-run the relevant story/epic tests, and re-review. Loop within reason; if blocking findings cannot be cleared, **HALT** and report to the user — do not proceed to release with known blocking findings.

## 2. Package-integrity gate (the "didn't break ma-agents" check)

Run the real gate on the epic branch — **not** bare `npm test` alone:

1. **Plugin build must pass:** `npm run build:plugin` (assembles `lib/bmad-extension-plugin/`). A failure here is a hard stop.
2. **Bundle-drift guard:** after building, confirm `lib/bmad-extension-plugin/` and the resolved `marketplace.json` are up to date with the source (`lib/bmad-extension/`). If this epic added/renamed skills or bumped `module.yaml`, the rebuilt bundle must be committed. CI enforces this ("Bundle Drift Guard") — catch it here first.
3. **Targeted tests:** run the test subset relevant to what the epic changed.
4. **Known pre-existing failure:** a full `npm test` on Windows exits non-zero due to long-standing MIL-498 template CRLF drift (halts around position 13) and also regenerates `.agents/`. **Do not** classify that specific known failure as an epic regression. Distinguish new failures from the baseline: if in doubt, run the same command on `main` and diff the failure set. Only *new* failures block.

Record the gate outcome (build: pass/fail, drift: clean/committed, tests: new-failures vs baseline) in the Run Ledger.

## 3. Gate decision

- All blocking adversarial findings cleared **and** package-integrity gate clean (no new failures, build green, no uncommitted bundle drift) → proceed.
- Otherwise → **HALT**, report exactly what is blocking, and let the user decide whether to fix-and-retry or stop.

On pass, read fully and follow `./steps/step-06-release.md`.
