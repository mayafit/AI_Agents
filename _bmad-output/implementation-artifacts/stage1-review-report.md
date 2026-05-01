# Stage 1 Review Report — PRD Edit (v6.6.0)
Date: 2026-05-01

## Summary
PASS WITH NOTES

The F21 section is functionally sound and most requirements are well-formed. Two WARNING-level findings require minor corrections before implementation begins; no CRITICAL issues were found.

---

## Findings

### Finding 1 — WARNING: F21 capability area missing from the Capability Areas enumerated list

**Location:** `### Capability Areas` section (line ~98), compared to `### BMAD v6.6.0 Integration` functional section (line ~494).

**Detail:** Every previous capability area (F1–F20) appears as a numbered item in the `### Capability Areas` list in the System Overview (e.g., "20. BMAD 6.3.0 Plugin Migration", "19. Local-LLM / On-Prem Agent Tuning"). F21 has a section heading in the Functional Requirements and an NFR section heading referencing `(F21 — BMAD v6.6.0 Integration)`, but no corresponding numbered entry exists in the Capability Areas list. This breaks the F-number registry that acts as the product's capability index.

**Impact:** Inconsistency makes it ambiguous whether F21 is a formally recognized capability area or an ad-hoc edit. Future stories, epics, and reviews that reference capability area numbers will have a gap at position 21.

**Required correction:** Add the following entry to the Capability Areas numbered list after item 20:

```
21. **BMAD v6.6.0 Integration** — Guard against `--tools none` invocation on fresh installs with no IDE tools selected; bump bmad-method pin to v6.6.0; transparent `project_name` config migration; optional `--set`/`--list-options` CI pass-through flags. — **In Development**
```

---

### Finding 2 — WARNING: FR197 contains implementation leakage (internal function reference and config key path)

**Location:** FR197, line ~497.

**Text:**
> FR197: The bundled bmad-method version pin (FR74) is upgraded from v6.5.0 to v6.6.0. The `project_name` config field migration from `[modules.bmm]` to `[core]` is handled transparently by bmad-method on the next install/update run — no user action required

**Detail:** Two implementation details leak into a requirement that should describe product behavior:
1. The internal config key path `[modules.bmm]` → `[core]` is bmad-method's internal TOML schema, not observable user/product behavior. A PRD requirement should describe what the user experiences, not what happens inside the upstream tool's config format.
2. The phrase "on the next install/update run" is an implementation timing detail — it constrains *how* the migration happens rather than *what* the user observes.

**Impact:** If bmad-method changes its migration timing or config key naming, this FR becomes technically inaccurate without any observable user behavior having changed. It also risks the story's acceptance criteria being written against internal config keys rather than user-observable outcomes.

**Corrected text:**
> FR197: The bundled bmad-method version pin (FR74) is upgraded from v6.5.0 to v6.6.0. Any `project_name` configuration present in an existing project is migrated automatically by bmad-method at the next install or update — the user is not prompted and no manual config file editing is required.

---

### Finding 3 — INFO: FR198 ambiguity on "may optionally expose" — acceptance criteria will be hard to write

**Location:** FR198, line ~498.

**Text:**
> FR198: The installer CLI may optionally expose `--set <module>.<key>=<value>` and `--list-options [module]` flags (new in bmad-method v6.6.0) for non-interactive configuration in CI/Docker environments. These are thin pass-through flags delegated to bmad-method

**Detail:** The word "may optionally" makes the requirement non-committal — it reads as aspirational rather than normative. A PRD requirement should state what the product does or will do, not what it might consider doing. If the flags are in scope they should be stated as "must"; if they are out of scope they should not be in the PRD.

Additionally, "thin pass-through flags delegated to bmad-method" is borderline implementation leakage — it describes the mechanism (pass-through delegation) rather than the behavior (flags exist, they work, CI environments can use them non-interactively).

**Recommendation (not blocking):** Either commit to the flags ("FR198: The installer CLI exposes `--set` and `--list-options` flags for non-interactive configuration in CI/Docker environments") or mark the requirement as deferred with a FUTURE label. As-is, no story acceptance criteria can conclusively PASS or FAIL this requirement.

---

### Finding 4 — INFO: NFR55 header uses a non-standard formatting pattern

**Location:** Line ~843.

**Text:**
> `#### NFR55 (F21 — BMAD v6.6.0 Integration)`

**Detail:** All other NFR subsections use `### <Section Name>` headers (e.g., `### BMAD 6.3.0 Migration`, `### BMAD v6.6.0 Integration`). The NFR55 sub-section is the only one using a `####` (H4) header with the NFR ID embedded in the heading itself. This is inconsistent with every other NFR grouping in the file.

**Recommendation:** Change the header to `### BMAD v6.6.0 Integration` (matching the `### BMAD v6.6.0 Integration` pattern already used in the Functional Requirements section), and rely on the bullet-level `NFR55:` label (which is the correct pattern used throughout the file) to identify the requirement.

---

### Finding 5 — INFO: NFR55 traceability to FR196 is implicit, not explicit

**Location:** NFR55, line ~845.

**Text:**
> NFR55: Automated tests must assert: (a) `buildBmadArgs()` never produces a command string containing `--tools none`; (b) the install flow silently skips BMAD invocation when the derived `bmadTools` array is empty; (c) existing installs with non-empty tools lists are unaffected

**Detail:** The task brief states NFR55 should "correctly reference FR196." NFR55 does not explicitly cite FR196 anywhere in its text. The traceability is implied (it tests the behavior described in FR196) but not declared. Comparable NFRs in this PRD do link back to their FR (e.g., NFR52 references FR192 by number in its text).

**Recommendation:** Append ` — satisfies FR196.` to the end of NFR55, or add a parenthetical `(FR196)` after the opening word to make the forward trace explicit.

---

### Finding 6 — INFO: NFR55(a) contains function-name implementation leakage

**Location:** NFR55(a), line ~845.

**Detail:** `buildBmadArgs()` is an internal function name. NFR55 is correctly classified as a Non-Functional Requirement (test contract), but naming a specific internal function couples the NFR to the current implementation. If the function is renamed during refactoring, the NFR technically fails without any observable behavior having regressed.

**Recommendation:** Rephrase (a) to: "(a) the installer's argument construction logic never produces a bmad-method invocation containing `--tools none`" — this expresses the verifiable contract without locking to a specific function name.

---

## Verdict

**PASS WITH NOTES — fix Finding 1 and Finding 2 before story creation; Findings 3–6 are non-blocking improvements.**

- **Finding 1** (WARNING): Add F21 entry to the Capability Areas list. Required for numbering consistency and product index completeness.
- **Finding 2** (WARNING): Rewrite FR197 to remove internal config key path leakage. Required to keep the requirement verifiable against user behavior, not upstream implementation details.
- **Findings 3–6** (INFO): Non-blocking. Addressing them improves requirement quality and reduces story-writing friction, but does not block proceeding with implementation planning.
