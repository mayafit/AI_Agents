---
type: bug
severity: medium
title: Marker-merge double-stamp over an orphan MA-AGENTS-START (no closing MA-AGENTS-END) can silently drop user content
---

# Bug: Marker-merge double-stamp over an orphan MA-AGENTS-START (no closing MA-AGENTS-END) can silently drop user content

**Status:** backlog
**Severity:** medium
**Affected Component:** `lib/installer.js` marker-block merge logic (`markdownMarkersMerger` / `_extractMarkerBlockInner` / `stampExtraInstructionTemplates`)

## Summary

The marker-block merge logic locates and replaces the ma-agents instruction block
with a **non-greedy** regex:

```
/<!-- MA-AGENTS-START -->([\s\S]*?)<!-- MA-AGENTS-END -->/
```

When a target instruction file contains an **orphan opener** — a
`<!-- MA-AGENTS-START -->` line with **no matching** `<!-- MA-AGENTS-END -->` —
and the installer stamps that file **twice in one flow**, the second stamp's
non-greedy regex matches from the pre-existing orphan opener through the
**freshly-written** `<!-- MA-AGENTS-END -->`. It then replaces that entire span,
silently discarding the orphan body and any trailing user text that sat between
the orphan opener and the newly written block.

This is a **pre-existing defect since Story 21.2** (the marker-wrap contract). It
was **not** introduced by Epic 26; it was surfaced during Epic 26 / Story 26.2
edge-case extension testing (Phase 3e).

## Reproduction Steps

1. Seed a target instruction file with an **orphan opener**: a
   `<!-- MA-AGENTS-START -->` line with **no** matching `<!-- MA-AGENTS-END -->`,
   followed by some user content / text below it.
2. Run the installer marker-stamping over that file **twice in one flow** — as the
   json-merge `opencode` target (`AGENTS.md`) path does: `updateAgentInstructions`
   already stamps its `extraInstructionTemplates` internally for json-merge agents,
   and a test harness like `installAllTargets` then calls
   `stampExtraInstructionTemplates` a second time, double-stamping the same file.
3. Observe the resulting `AGENTS.md`.

## Expected Behavior

All user content outside a well-formed marker block is preserved across installs.
When the existing file is **malformed** (an orphan `<!-- MA-AGENTS-START -->` with
no closing `<!-- MA-AGENTS-END -->`), the installer should not silently delete the
orphan body or trailing user text — it should either refuse + warn, or anchor its
replacement to a balanced START…END pair only.

## Actual Behavior

On the **second** stamp, the non-greedy regex
`/<!-- MA-AGENTS-START -->([\s\S]*?)<!-- MA-AGENTS-END -->/` matches from the
**pre-existing orphan opener** through the **freshly-written**
`<!-- MA-AGENTS-END -->` and replaces that whole span. The orphan body and any
user text between the orphan opener and the new block are **silently dropped** —
with no error and no drift warning.

Note: this does **not** occur under a correct **single** install pass. A single
stamp preserves all content (verified during Epic 26 / Story 26.2; the integration
test in `test/instruction-block-git.test.js` deliberately drives exactly **one**
correct install per agent and documents this caveat inline — see the
"double-stamp note" around the orphan-seed edge-case test, which skips the second
`stampExtraInstructionTemplates` call for json-merge agents precisely to avoid
re-running the merger over the just-written block).

## Root Cause Hypothesis

The replace regex (`new RegExp(\`${markerStart}[\\s\\S]*?${markerEnd}\`)` in
`markdownMarkersMerger`, mirroring the matcher in `_extractMarkerBlockInner`) is
non-greedy and matches **any** `START … END` span. It does not validate that the
START it anchors on is balanced with its own END. With an orphan START already in
the file plus a second stamp (which has by then written a real END), the regex
spans from the orphan START to the new END and overwrites everything in between.

The double-stamp condition is structural for json-merge agents: `opencode`
(`AGENTS.md`) is stamped once inside `updateAgentInstructions` and can be stamped
again by an outer `stampExtraInstructionTemplates` call in flows like
`installAllTargets`.

## Affected Files

- `lib/installer.js` — `_extractMarkerBlockInner` (non-greedy matcher), `markdownMarkersMerger` (non-greedy replace regex), `stampExtraInstructionTemplates` / `updateAgentInstructions` (double-stamp path for json-merge agents)
- `lib/agents.js` — `opencode` agent entry: `injectionStrategy.position: 'json-merge'` + `extraInstructionTemplates` targeting `AGENTS.md` via the `markdown-markers` merger
- `test/instruction-block-git.test.js` — orphan-seed edge-case test; documents the single-pass caveat and skips the redundant second stamp for json-merge agents

## Suggested Fix

Before replacing, detect an unbalanced / orphan marker pair and either:

(a) refuse the replace and emit a warning (do not silently overwrite); or

(b) anchor the replace to a **balanced** `START … END` pair only (e.g. validate
    that the matched START has its own END, or require the START..END count to be
    balanced before substituting);

and/or make json-merge agents (e.g. `opencode` / `AGENTS.md`) stamp **exactly
once** — remove the redundant double-stamp by not re-invoking
`stampExtraInstructionTemplates` for agents whose `updateAgentInstructions`
already stamps their extras internally.

This is a guard for a malformed-input edge case; normal installs over well-formed
files are unaffected and must remain byte-identical (NFR46 / marker idempotency
contract FR176).

## Provenance

- Discovered in **Epic 26, Story 26.2** (PR #100), edge-case extension (Phase 3e).
- Related architecture: marker idempotency contract **FR176**; marker-wrap contract
  introduced in **Story 21.2**.
- Severity rationale: **Low–Medium**. Requires a **pre-existing malformed marker**
  (orphan START without END) **AND** a double-stamp; normal installs over
  well-formed files are unaffected. But it can cause **silent user-content loss**,
  so it warrants a guard.

## Notes

- Created via `create-bug-story` workflow
- This is a bug REPORT, not a fix — `lib/` source is intentionally untouched
- Discoverable by sprint workflows via glob: `_bmad-output/implementation-artifacts/bug-*.md`
- To add to a sprint, run `/add-to-sprint`
