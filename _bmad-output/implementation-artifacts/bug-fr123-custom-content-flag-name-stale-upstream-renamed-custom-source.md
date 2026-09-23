---
type: bug
severity: low
title: FR123 and every downstream restatement name the bmad-method flag --custom-content, which upstream renamed to --custom-source at 6.3.0 — documentation-only staleness, the code already probes for both
---

# Bug: FR123's `--custom-content` flag name is stale — upstream renamed it `--custom-source` at 6.3.0

**Status:** OPEN — needs triage
**Severity:** low
**Affected Component:** PRD **FR123** (capability **F3**, BMAD Integration & Bundling) and its
downstream restatements in `epics.md` and `sprint-status.yaml`
**Classification:** **DOCUMENTATION / REQUIREMENTS TEXT ONLY** — no code fix needed, nothing is broken

## Provenance

Found by the **Story 31.1** FR250 spike (Epic 31, wave 1) while establishing AC2 — how the FR123
flags behave under a user-scoped `--directory` against a live `npm install bmad-method@6.10.0`.
Confirmed by that story's adversarial review.

**Filed rather than fixed because it is capability F3, not F26.** Epic 31 covers F26 only, and the
run's boundaries forbid editing the PRD to resolve an implementation observation. This is a genuine
finding about a different capability area and belongs in its own item so wave-2 planning picks it up.

## Summary

FR123 enumerates the CLI flags ma-agents passes to bmad-method, and names **`--custom-content`**:

> `--tools`, `--modules`, `--directory`, `--user-name`, `--communication-language`,
> `--document-output-language`, `--output-folder`, `--custom-content`

Against the pinned `bmad-method@6.10.0` (`package.json:35`), the flag is **`--custom-source`**
(`tools/installer/commands/install.js:36`). `--custom-content` is the **pre-6.3.0** name; upstream
renamed it at 6.3.0.

**Nothing is broken.** ma-agents already handles the rename defensively — see below. This is purely
requirements text that no longer matches the pinned dependency, and the risk is that a future author
trusts the requirement over the source.

## Why no code fix is needed

`resolveCustomContentFlag()` (`lib/bmad.js:679-711`) probes the *installed* package and picks the
name it actually finds, newer first:

```js
const candidates = [
    { path: 'bmad-method/tools/installer/commands/install.js', flags: ['--custom-source', '--custom-content'] },
    { path: 'bmad-method/tools/cli/commands/install.js',       flags: ['--custom-source', '--custom-content'] },
];
```

It caches the result (`_cachedCustomContentFlag`) because `buildBmadArgs` runs repeatedly in one
install flow, and it carries an explicit rationale comment naming the 6.3.0 rename. Its defensive
default when the package cannot be inspected is `--custom-content`, chosen so the installer **fails
loudly with an unknown-flag error rather than silently dropping the extension** — a deliberate and
correct failure mode.

So the implementation is *more* current than the requirement that describes it. That inversion is the
actual defect here: the code is right, the spec is stale.

## Expected Behavior

FR123 names the flag upstream actually exposes at the pinned version — `--custom-source` — and, given
that ma-agents deliberately supports both names, says so, rather than implying a single fixed flag
string.

## Actual Behavior

FR123 and its restatements name only `--custom-content`, the retired name. Downstream copies inherit
it:

- `prd/capabilities/bmad-integration-and-bundling.md` — FR123's flag list
- `epics.md` — Story 31.1's AC2 flag list (inherited by reference)
- `sprint-status.yaml` — the `31-1-…` entry's scope note

Story 31.1's own deliverable already records the correction with evidence, so the finding is captured
in the implementation trail; it is the **requirement** that still needs amending.

## Root Cause

FR123 was written against a bmad-method version predating 6.3.0 and pins a **flag name** — an
upstream implementation detail with its own release cadence — inside a requirement. When upstream
renamed it, `lib/bmad.js` was updated (correctly, with a probe supporting both) but the requirement
text was not. Nothing links the two, so nothing flagged the drift.

The class matters more than the instance: **FR123 enumerates eight upstream flag names**, every one
of which can be renamed by an upstream release without ma-agents noticing. This is the second time
F26 planning has surfaced version-coupled requirement text (compare P5-9.4's `config.user.yaml`,
which named a file that never existed and would have made its own protection test pass vacuously).

## Blast Radius

- **Zero runtime impact.** The probe handles both names; installs work on 6.10.0 today.
- Documentation only — but load-bearing documentation: a future story restating the FR123 flag list
  (Story 31.12 was about to consume an adjacent part of it) would propagate the retired name.
- The delta-verification pass (`delta-verification-f26.md`) already caught this *class* of drift for
  F26; FR123 sits in F3 and was outside that sweep.

## Affected Files

- `_bmad-output/planning-artifacts/prd/capabilities/bmad-integration-and-bundling.md` — FR123 flag
  list (**the fix site**)
- `_bmad-output/planning-artifacts/epics.md` — Story 31.1 AC2's inherited flag list
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — the `31-1-…` scope note
- `lib/bmad.js:679-711` — `resolveCustomContentFlag()`, cited as evidence **no code change is needed**
- `lib/bmad.js:763-769` — the `buildBmadArgs` call site that consumes the resolved flag
- upstream `bmad-method@6.10.0 tools/installer/commands/install.js:36` — `--custom-source`

## Acceptance Criteria

1. FR123 names `--custom-source` as the current flag, and states that ma-agents intentionally
   supports both names via a runtime probe so it survives version skew in either direction.
2. FR123 gains a note that the flag list is **version-coupled to the pinned bmad-method** and must be
   re-checked whenever the pin moves. The BMAD-version-bump story template (the 27.1 / 28.1 / 30.1 /
   31.1 spike lineage) is the natural home for that check — consider adding it there so it happens by
   default rather than by memory.
3. The downstream restatements in `epics.md` and `sprint-status.yaml` are reconciled **or**
   deliberately left as history with an `[AMENDED]` marker, per this project's existing convention
   that append-only history is not rewritten.
4. **No code change.** `resolveCustomContentFlag()` is correct as written; a test pinning that both
   names resolve is optional and only if one does not already exist.
5. The other seven FR123 flags are spot-checked against 6.10.0 in the same pass — if one name drifted,
   others may have. (Story 31.1 verified `--directory`, `--modules`, `--tools` and `--output-folder`
   as current; `--user-name`, `--communication-language` and `--document-output-language` were not
   individually re-verified.)

## PRD Amendment Needed

**Yes — this bug *is* a PRD amendment.** It is the whole content of the fix: FR123's text is what is
wrong. No architecture decision changes (this is not a P5-9 concern), and no code changes.

Routing note: FR123 was last amended 2026-08-02 for the default module set (bmm+tea+bmb+cis, with
gds/wds opt-in). That amendment is unaffected — this is a separate, narrower correction to the same
requirement, and the two should not be conflated when the amendment is written.

## Notes

- Filed from the Story 31.1 spike (Epic 31, wave 1) — a bug REPORT, not a fix. Neither the PRD nor
  any source was touched, per the run's boundaries.
- Discoverable by sprint workflows via glob: `_bmad-output/implementation-artifacts/bug-*.md`
- To add to a sprint, run `/add-to-sprint`
