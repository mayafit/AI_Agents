---
type: bug
severity: low
title: showCurrentLayout prints "Mode: undefined / Path: undefined" for a valid confluence-backed store — the display path assumes every store has file-system mode/path fields
---

# Bug: `showCurrentLayout` prints `undefined` for a valid `confluence` store

**Status:** OPEN — **blocks Story 31.5**
**Severity:** low (display-only; no data loss, no wrong write)
**Affected Component:** `bin/cli.js` — `showCurrentLayout()`
**Classification:** CODE FIX (ma-agents-owned)

## Summary

`showCurrentLayout()` renders each concern by printing its `mode` and `path`:

```
  Knowledgebase:
    Mode:    local
    Path:    d:/Code/agents-knowledgebase
```

A `confluence`-backed store has **neither** field — its identity is `backend: confluence` plus a
`space_key` and a `root_page` object. So a store that is entirely valid renders as:

```
    Mode:    undefined
    Path:    undefined
```

The user is shown `undefined` for a correctly-configured store, which reads as corruption. It is
purely cosmetic — nothing is misread and nothing is written wrongly — but it is the command whose
entire job is telling the user what their layout *is*, and `ma-agents config layout` calls it
**before** reconfiguring, so it is also the last thing a user sees before answering the wizard.

## Reproduction Steps (post-31.8; not reachable today)

1. Land Story 31.8 (or hand-write a `project-layout.yaml` with a `confluence` store).
2. Run `ma-agents config layout --show`.
3. **Expected:** the store's backend, space key and root page.
4. **Actual:** `Mode: undefined` / `Path: undefined`.

Reachable today only by hand-editing `project-layout.yaml`, since no wizard writes a `confluence`
store until 31.8. Story **31.5** is where the backend becomes selectable at all, which is why it is
filed against 31.5 rather than 31.8.

## Expected Behavior

The display is backend-aware:

- `file-system` → mode + path (today's output, unchanged)
- `confluence` → backend, space key, and root page (title and/or id)

and it never prints `undefined` for any store the schema considers valid. If a field genuinely is
missing, say so in words (`not configured`) rather than leaking a JavaScript primitive.

## Root Cause

`showCurrentLayout()` predates the backend concept entirely — it was written when a "concern" was
always a filesystem location, so `{mode, path}` was a total description. Story 31.2 sealed a schema in
which `{mode, path}` is only the `file-system` shape, and reserved `space_key` / `root_page` for
`confluence`, but display was out of 31.2's scope (it reserves schema fields; it does not prompt for
them or render them).

Same root shape as the sibling read-path defect
(`bug-read-existing-layout-collapses-two-stores-onto-software-store.md`): a legacy single-shape
assumption surviving into a two-shape world. That one loses data; this one only misreports.

## Blast Radius

- **Display only.** No write path, no resolution path, no data loss.
- Reachable only once a `confluence` store can exist (31.5 makes the backend selectable; 31.8 makes it
  configurable).
- Confidence cost is the real damage: a user who sees `undefined` reasonably concludes their committed
  binding file is broken, and may "fix" it by re-running the wizard — which, until the sibling defect
  above is fixed, would overwrite the store for real. **The two defects compound**, which is why both
  gate 31.5.

## Affected Files

- `bin/cli.js` — `showCurrentLayout()` (the renderer), `handleConfigLayout()` (calls it before
  reconfiguring)
- `bin/cli.js` — `readExistingLayout()`, which supplies the legacy `{mode, path}` shape the renderer
  consumes; a fix likely needs the richer topology, so coordinate with the sibling defect
- `test/config-layout.test.js` — where `showCurrentLayout` coverage lives

## Acceptance Criteria

1. A `confluence` store renders its backend, space key and root page — never `undefined`.
2. A `file-system` store renders exactly as it does today (no regression; pinned by the existing
   `config-layout` assertions).
3. No store shape the sealed schema accepts can make the renderer emit the literal `undefined`. A test
   asserts the rendered output contains no `undefined` across every valid store shape, including a
   `confluence` store with a `root_page` carrying only a `title`, and one carrying only an `id`.
4. A genuinely absent optional field renders as human words, not a primitive.
5. Two-store output is legible when the stores differ — the user can tell which store is which
   backend at a glance. This is the FR257 case (`confluence` + `file-system` side by side).
6. Tests run directly with `node --test`; failures baselined against `main` first.

## PRD Amendment Needed

**No.** No FR specifies the layout display format. FR253 covers what `ma-agents status` reports about
install scope, which is a different command. This is an implementation gap against the schema
Story 31.2 sealed.

## Provenance

- Found by Story 31.2's independent review (Epic 31, wave 1).
- Not a 31.2 regression — `showCurrentLayout` was never backend-aware, and 31.2's scope explicitly
  excluded prompting for or rendering the reserved Confluence fields.
- Filed as a **precondition on Story 31.5**, alongside
  `bug-read-existing-layout-collapses-two-stores-onto-software-store.md` and
  `bug-serialize-sprint-management-passes-store-modes-enum.md`.
- A bug REPORT, not a fix. No source was touched.
- Discoverable by sprint workflows via glob: `_bmad-output/implementation-artifacts/bug-*.md`
- To add to a sprint, run `/add-to-sprint`
