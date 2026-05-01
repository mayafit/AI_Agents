# Stage 2 Review Report — Architecture Update (v6.6.0)
Date: 2026-05-01

## Summary
PASS WITH NOTES

---

## Findings

### 1. Architectural Specificity — PASS

Decision P5-2 captures the WHY clearly. The context paragraph identifies the precise breaking change in v6.6.0 (`--tools none` rejected for fresh `--yes` installs), names the exact code location that produces the problem (`buildBmadArgs()`, line 609 of `lib/bmad.js`, driven by empty `bmadTools` in `bin/cli.js` line 1059), and articulates the architectural invariant being enforced: "BMAD is installed iff at least one IDE agent is configured." This is design-level reasoning, not just a description of the fix.

### 2. Options Documented — PASS

Three options are explicitly documented with rejection rationale:

- **Pass a default tool** — rejected (least-surprise principle violation)
- **Error out** — rejected (valid zero-IDE-tools configuration exists)
- **Skip silently** — chosen, with rationale tied to consistency with other optional install steps

This is adequate options coverage for a single-decision point of this scope.

### 3. FR Traceability — PASS WITH NOTE

The FR coverage line (`FR196 (buildBmadArgs guard), FR197 (version pin), FR198 (--set/--list-options), NFR55 (automated test coverage)`) correctly maps each identifier to its concern.

Cross-checked against PRD:
- FR196 (prd.md line 496): matches — skip BMAD invocation when no IDE tools selected
- FR197 (prd.md line 497): matches — version pin bumped to v6.6.0
- FR198 (prd.md line 498): matches — optional --set/--list-options pass-through
- NFR55 (prd.md line 843-845): matches — automated test assertions for buildBmadArgs behavior

**Note — FR range overlap with P5-1:** P5-1 claims FR196–FR210. P5-2 claims FR196–FR198. This is a range overlap that is not explained in the document. FR196 and FR197 appear to be re-used identifiers that were originally scoped under P5-1's range but are now being fulfilled by P5-2 (a later integration decision). The PRD shows FR196/FR197/FR198 and NFR55 defined under feature F21 (BMAD v6.6.0 Integration), which belongs to P5-2, not P5-1. However, P5-1's header still claims FR196–FR210, which creates an ambiguous attribution. Neither decision resolves this overlap in text.

**Recommendation:** Add a note in either P5-1 or P5-2 clarifying that FR196–FR198 and NFR55 were originally listed under the P5-1 range header but are assigned to the P5-2 implementation decision. Alternatively, correct P5-1's range header to FR199–FR210.

### 4. Consistency — PASS WITH NOTE

**P5-2 vs P5-1:** P5-2 correctly states the install flow is unchanged, that the PluginResolver and plugin staging architecture introduced in P4-1 and carried through P5-1 remain intact. The `--custom-source` bug fixes are noted as upstream improvements consumed automatically, not as architectural changes.

**P5-2 vs P4-1:** The pre-install local plugin staging architecture from P4-1 is not contradicted. P5-2 notes `--custom-source` URL parsing fixes that improve PluginResolver reliability, and explicitly states no architectural change is needed. This is consistent.

**Note — Technology stack reference:** The Architecture Completeness Checklist (line 2100) still reads "Technology stack fully specified (Node.js, bmad-method v6.3.0)." Both P5-1 and P5-2 bump the version (v6.3.0 → v6.5.0 → v6.6.0), but the checklist at the bottom of the Phase 4 section was not updated to reflect v6.6.0. This is a stale cross-reference, not an architectural contradiction, but it could mislead a reader scanning the document.

### 5. Completeness — PASS WITH NOTE

All three v6.6.0 impact categories are addressed:

- **Breaking change (`--tools none` rejection):** Covered by primary decision (buildBmadArgs guard).
- **Auto-migration (`project_name` config field `[modules.bmm]` → `[core]`):** Covered in secondary changes — correctly noted as transparent, no code change needed.
- **Bug fixes (`--custom-source` URL parsing, PluginResolver nested `module.yaml`):** Covered in secondary changes — correctly noted as automatically consumed upstream fixes.
- **New flags (`--set`/`--list-options`):** Documented in FR198 and deferred to a future story with rationale.

**Note — NFR55 test scope not elaborated in decision:** The decision states NFR55 (automated test coverage) is covered but does not describe the test strategy at even a sketch level. P5-1 does not do so either, but the PRD specifies three concrete assertions for NFR55 (a: buildBmadArgs never produces `--tools none`; b: install flow skips BMAD when bmadTools empty; c: non-empty tools lists unaffected). Given that this is an architecture decision document, omitting the test approach is acceptable, but a one-line pointer to the NFR55 PRD entry would strengthen traceability and avoid implementation ambiguity.

### 6. No Implementation Leakage — PASS WITH NOTE

The decision correctly names source files and line numbers for context (describing *where* the problem manifests) without specifying implementation code, pseudocode, or call-sequence diagrams. References to `lib/bmad.js` line 609 and `bin/cli.js` line 1059 are used as architectural locators to identify the design touch-point, not as implementation prescriptions.

**Note — Formatting inconsistency with P5-1:** P5-1 uses a structured layout with labeled sub-sections (`**Context.**`, `**Decision.**`, `**Evidence base.**`, `**New flow / component changes.**`, `**Code paths affected.**`, `**Alternatives considered.**`, `**Rationale.**`, `**Affects:**`, `**Out of scope:**`). P5-2 uses a flatter, less structured format. The information is present but harder to parse at a glance. For consistency and long-term maintainability of the document, P5-2 should adopt the same section structure as P5-1.

---

## Verdict

**Proceed**, with the following non-blocking issues to be addressed before the next architecture review cycle:

1. **(Medium) FR range overlap:** Correct P5-1's FR range header or add an explicit note clarifying that FR196–FR198 and NFR55 are assigned to P5-2. Current state creates reader ambiguity.

2. **(Low) Stale checklist:** Update the Architecture Completeness Checklist technology stack entry from "bmad-method v6.3.0" to "bmad-method v6.6.0."

3. **(Low) P5-2 structural consistency:** Adopt P5-1's labeled sub-section structure (`**Affects:**`, `**Out of scope:**`, etc.) so P5-2 is navigable by the same document conventions.

None of these issues affect the correctness of the architectural decision itself. The core decision (buildBmadArgs guard), its rationale, alternatives, and FR/NFR traceability are sound and implementation-ready.
