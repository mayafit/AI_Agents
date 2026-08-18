---
type: bug
severity: low
title: storeFromRaw open-codes 'file-system' as the record's backend (bin/cli.js) — a fourth, independent spelling of a default the same function already reads from lib/store-backends.js three lines earlier, with nothing pinning the two in agreement
---

# Bug: `storeFromRaw` open-codes the default backend it just read from the single source

**Status:** OPEN
**Severity:** low (no behavioural difference today; a latent read/write disagreement of the class Epic 31 has already fixed three times)
**Affected Component:** `bin/cli.js` — `storeFromRaw()`, the file-system branch's record construction
**Classification:** CODE FIX (ma-agents-owned) — latent single-source-of-truth violation

## Summary

`lib/store-backends.js` exists so that "the backend a store has when it never states one" is
**named once** and read by every direction — reader, writer, display, and
`generateRepoLayoutSection`. Story 31.3 introduced it precisely because three independent
spellings of that value is how the halves come to disagree.

`storeFromRaw()` honours that on the way IN:

```js
const backend = scalarString(raw.backend) || DEFAULT_STORE_BACKEND;
```

...and then discards it on the way OUT, roughly twenty lines later, in favour of a bare literal:

```js
const entry = { backend: 'file-system', mode, path: resolvedPath };
```

So the record the reader hands to the rest of the system does not carry the backend it
validated; it carries an independently-written string that merely happens to equal it.

## Reproduction Steps

Not reproducible as a user-visible defect today — `DEFAULT_STORE_BACKEND` **is** `'file-system'`,
so the two agree. Confirm by inspection:

1. Open `bin/cli.js`, find `storeFromRaw()`.
2. Observe the `DEFAULT_STORE_BACKEND` read at the top of the function.
3. Observe the `backend: 'file-system'` literal in the file-system branch's returned record.
4. Change `DEFAULT_STORE_BACKEND` in `lib/store-backends.js` to the other enum member and re-run
   the suites: the reader now validates against one value and records the other, and no test
   distinguishes the two.

## Expected Behavior

The record `storeFromRaw` returns names the backend the function actually resolved — i.e. the
local `backend` variable — so a change to the single source propagates to the reader's output
by construction rather than by two edits staying in step.

## Root Cause

The same class Epic 31 has now found four times: **a closed-enum value with more than one
definition, where the copies agree today and nothing tests that they must.** Story 31.2
introduced the record construction; Story 31.3 introduced `lib/store-backends.js` and converted
the validation half of the same function but not the construction half.

Story 31.5's fix round found and fixed the sibling instance on the WRITE side
(`collectFileSystemStoreLocation` hardcoded `DEFAULT_STORE_BACKEND` into the record it returned
instead of recording the answered backend). This one is on the READ side and was explicitly
left out of scope for 31.5.

## Blast Radius

- **Today:** none. The literal and the constant are equal.
- **If `DEFAULT_STORE_BACKEND` ever changes:** the reader silently records a backend the
  installer does not consider default, and every "is this store non-default?" predicate
  downstream (the project-context renderer, the identity display, `storesDiverge`) answers on
  the wrong basis. Silent, not loud — the shape this epic keeps re-finding.
- Fix is a one-token change plus a test.

## Affected Files

- `bin/cli.js` — `storeFromRaw()`, the file-system branch's `entry` construction
- `lib/store-backends.js` — `DEFAULT_STORE_BACKEND`, the single source being bypassed
- `test/project-layout-config-generation.test.js` — where the equivalent behavioural pin for
  `lib/installer.js`'s copy already lives, and the natural model for this one

## Acceptance Criteria

1. `storeFromRaw()`'s returned record names the resolved `backend`, not an independent literal.
2. A test drives the reader for **every** member of `STORE_BACKEND_LIST` and asserts the record's
   backend is the one the single source defines — the loop must be proven non-vacuous (it
   exercised both the default and at least one non-default member), matching the existing pin in
   `test/project-layout-config-generation.test.js`.
3. A repo-wide check (or a test) that `'file-system'` appears as a bare literal in no
   record-construction site outside `lib/store-backends.js`, so a fifth spelling cannot be added
   silently.
4. Tests run directly with `node --test`; failures baselined against `main` first.

## PRD Amendment Needed

**No.** P5-9 and FR257 already fix the backend enum and its default; this is purely an
implementation inconsistency inside the reader.

## Provenance

- Found by Story 31.5's independent review, which named it explicitly as **out of scope for
  31.5** ("a fourth spelling of the default backend, from Story 31.2").
- Filed by the Story 31.5 fix round, which fixed the write-side sibling
  (`collectFileSystemStoreLocation`) and left this one untouched per that scoping.
- A bug REPORT, not a fix. No source was touched for this item.
- Discoverable by sprint workflows via glob: `_bmad-output/implementation-artifacts/bug-*.md`
- To add to a sprint, run `/add-to-sprint`
