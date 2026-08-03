# Delta Verification — F26 amendments landed after the readiness review

**Verdict: GAPS FIXED — no open decisions.**

Scope: propagation only. The full readiness review
([implementation-readiness-f26.md](implementation-readiness-f26.md)) passed with 19/19 FRs and
8/8 architecture sub-decisions covered and zero orphans; this pass does not re-litigate any
settled decision. It checks one thing: **eight amendments plus three earlier changes landed
after that review, and a review is a snapshot.**

Run 2026-08-03. Two spot-check gaps had already been found before this pass began, which is why
it was commissioned rather than skipped.

## Propagation status — 11 items

| # | Amendment | Status | Evidence |
|---|---|---|---|
| 1 | **FR248 narrowed** — scope question already ships | **GAPS FIXED (3)** | P5-9.8 said the question "becomes" a wizard question; Story 31.11 said the prompt exists "in partial form"; `sprint-status.yaml` 31-11 said "becomes an INTERACTIVE WIZARD QUESTION". All three now state it exists **in full** at `bin/cli.js:1414-1437` and is retained as-is |
| 2 | **NFR76 rebaselined** — post-31.2 baseline | **CLEAN** (2 fixed pre-pass) | Story 31.11 AC4 and 31.14 AC2 corrected before this pass. No third site found. Remaining matches are `[AMENDED]` notes quoting the superseded wording — correct by design |
| 3 | **FR264 amended** — per-store fields | **GAP FIXED (1)** | Story 31.3 AC1 rewritten pre-pass. Epic 31's "Out of scope" list still implied all 39 references were untouched; now states the *location* is unchanged while the field set grows |
| 4 | **P5-9.2 amended** — architecture side | **CLEAN** | Matches FR264 exactly; the P5-9 register row in `architecture.md` remains accurate |
| 5 | **P5-9.4 corrected** — TOML override files | **GAPS FIXED (2)** | Sub-decision heading still read "`config.user.yaml`"; `sprint-status.yaml` still carried the finding as open. Both now name `_bmad/config.user.toml` and `_bmad/custom/config.user.toml`. In-scope tree is clean — FR105 / NFR33 mention `config.user.yaml` for the pre-existing BMAD module-setup concern and are correctly untouched |
| 6 | **FR123 amended** — default module set | **GAPS FIXED (2)** | A story code-comment citation and the `sprint-status.yaml` 31-12 note both still said "every non-retired module". Both now cite bmm+tea+bmb+cis with gds/wds opt-in. FR123 is capability F3, not F26 — F26 coverage claims undisturbed |
| 7 | **Story 31.2 AC8 scoped** — resolver vs skills | **CLEAN** | AC8 governs the binding resolver used by bind/status; 31.6 AC5 governs BMAD skills. Genuinely non-contradictory, not merely annotated |
| 8 | **OQ-4 unblocked** | **GAP FIXED (1)** | `sprint-status.yaml` condition C-8 still asserted OQ-4 "reaches back into 31.2's sealed schema", making the epic's "no open question blocks the gate stories" false. 31.2's schema now reserves the root-page record with both `title` and `id`, so either resolution populates it without reopening. C-8 marked resolved |
| 9 | **FR266 stays retired** | **CLEAN** | No story has reacquired a mirror / cache / sync / conflict-resolution requirement. Story 31.14's negative traceability check is intact |
| 10 | **FR267** — story files on `sprint_management_path` | **CLEAN** | Story 31.6 AC3 and the index assumptions section agree |
| 11 | **Index arithmetic** | **CLEAN — recomputed** | See below |

## Recomputed totals

Derived mechanically from the shard contents, then compared against `prd.md`:

| Metric | Value |
|---|---|
| FR definition lines | 266 |
| Distinct FR IDs | 265 (FR35 defined twice — pre-existing) |
| Live / retired | 264 live, 1 retired (FR266) |
| FR high-water | FR267 (FR77 and FR78 never defined, so it overstates by two) |
| NFR definitions / distinct | 83 / 83 — no duplicates, no gaps |
| NFR high-water | NFR83 |
| Capability domains / areas | 11 domains covering 26 declared areas |

`prd.md` now states these precisely, including the definitions-vs-distinct-IDs distinction and
the live-vs-retired split, which the previous single "266 FR definitions" figure elided.

## Off-by-one citations corrected

Three documents repeated two wrong line numbers. Verified against source and fixed:

- The global BMAD filter block spans **`bin/cli.js:1440-1452`** — 1451 closes the inner `if`, 1452
  the scope `if` — not 1440-1451, and not "line 1441" (which is only the opening `if`).
- The project-only guard is at **`bin/cli.js:1455`**; **1454** is the `// Step 3.5` comment.

Worth noting the second guard is the larger of the two: `if (installScope === 'project')` means a
global install skips the entire BMAD-METHOD integration block, not merely the agent filter. That
matters for Story 31.12's change set.

## What needed no change

Three categories of surviving matches are correct and were deliberately left alone:

- **`.memlog.md`**, `prd/changelog.md`, `architecture/changelog.md` — append-only history. Rewriting
  history to match the present would destroy the audit trail these exist to provide.
- **`[AMENDED …]` notes** quoting superseded wording — the quote is the point.
- **Bug stories and archived stories** describing old behaviour — that is what a defect report is.

## Process note

This pass was commissioned because two stale ACs were found by a one-minute spot check, implying
more. It found **nine further gaps across five artifacts**. The lesson is structural rather than
about any one document: **eight amendments to requirements and architecture did not fully reach the
stories and sprint-status entries citing them.** Any future amendment batch of comparable size
warrants the same delta pass rather than trusting the last full review.

Direction of drift is worth recording too: in every case the *stories* were downstream of stale
*requirements*, except one — Story 31.11 had independently verified the source and was more
accurate than FR248, which is why FR248 was the artifact corrected.

## Readiness

No open decisions. The F26 planning chain is internally consistent. Stories **31.1** (FR250 spike,
no dependencies) and **31.2** (binding spine, no longer blocked by OQ-4) are both ready-for-dev.
