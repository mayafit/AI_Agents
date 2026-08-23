---
type: bug
severity: medium
title: Story 31.4's OQ-3 guard scope is computed from top-level SKILL.md only, so skills that write planning artifacts from nested prompts/ files escape both the preflight and its completeness check
---

# The completeness check cannot see the files that do the writing

**Status:** OPEN — filed 2026-08-23, found while investigating where Story 31.10's publish
protocol could legally live.
**Severity:** medium (a scope hole in a merged guard, not a live data-loss path)
**Affected:** `test/project-layout-staleness-guard.test.js` (`skillEntryDocs`, and the OQ-3
completeness test built on it); `lib/bmad-extension/skills/mil498-*`; `lib/bmad-extension/skills/sqa-*`
**Classification:** coverage gap in Story 31.4's answer to OQ-3.

## The defect

Story 31.4 answered OQ-3 — *which skills carry the staleness guard* — with the criterion
*"resolves a field `generateBmmConfig` derives from the binding"*, and enforced it with a
**completeness test**: any skill entry document that resolves a binding-derived field but carries no
preflight is an offender.

That test's universe is `skillEntryDocs()`, and it scans **only the top level of each skill
directory, and only files named exactly `SKILL.md` or `workflow.md`**:

```js
for (const name of ['SKILL.md', 'workflow.md']) {
  const p = path.join(abs, dir.name, name);
  if (fs.existsSync(p)) out.push(...);
}
```

It never descends into `prompts/`, `steps/`, or any nested markdown.

**Verified consequence.** At least five MIL-498 skills write planning artifacts, and the write
instruction lives in a nested prompt file, not the entry document:

- `lib/bmad-extension/skills/mil498-ocd/prompts/06-save.md`
- `lib/bmad-extension/skills/mil498-sdd/prompts/06-save.md`
- `lib/bmad-extension/skills/mil498-sdp/prompts/06-save.md`
- `lib/bmad-extension/skills/mil498-srs/prompts/06-save.md`
- `lib/bmad-extension/skills/mil498-ssdd/prompts/07-save.md`

Their `SKILL.md` files carry **zero** preflight blocks (checked: `mil498-ocd` → 0,
`mil498-srs` → 0), and the completeness test does not flag them, because it never reads the file
where `planning-artifacts` appears.

So the guarantee OQ-3's answer rests on — *"a completeness test fails if any skill resolving a
binding-derived field lacks the guard"* — holds only for skills whose entry document names the
field. A skill that names it one directory down is invisible to the check.

## Why this is not the same as the sqa-* exclusion

Story 31.6 deliberately excluded `sqa-audit`, `sqa-ieee12207` and `sqa-requirements-quality` on the
grounds that they consume `{output_folder}` only, and that exclusion is **earned** by a test that
fails if any of them starts resolving a binding-derived field. That reasoning is sound and was
independently verified.

This is different: it is not a decision to exclude, it is a scan that cannot see. The `mil498-*`
skills were never assessed, because the criterion was applied to a file set that excludes where
they write.

## Blast radius

- **Bounded today.** These skills resolve `{output_folder}`, which is not binding-derived —
  Story 31.4 established that a binding change cannot make `{output_folder}` stale, and that
  argument still holds. So there is no known live staleness hole.
- **The guarantee is weaker than stated.** OQ-3's answer ("27 entry documents / 15 skills") is a
  correct count *of the scanned universe*, not of the skills that resolve binding-derived fields.
  If any nested prompt file ever names `planning_artifacts`, `system_requirements_path` or a
  sibling, no test will notice.
- **It interacts with Story 31.10.** Story 31.10's vocabulary invariant *does* scan recursively, so
  the two guards disagree about what counts as a skill document — one sees `prompts/**`, the other
  does not. That asymmetry is itself worth resolving.

## Suggested resolution

Make `skillEntryDocs()` recursive, or add a second completeness pass over nested markdown, then
re-derive OQ-3's answer over the widened set and reconcile it with the 41-copy preflight count. If
the widened set adds skills, each addition is a deliberate decision — do **not** bulk-add the
preflight to satisfy a count.

Note the two counts that must move together if any skill gains the block: the preflight's
**41 copies / one sha256**, pinned in `test/project-layout-confluence-page-tree.test.js` and
`test/project-layout-artifact-routing.test.js`, and the `GUARDED` literal in
`test/project-layout-staleness-guard.test.js`.

## Acceptance criteria for whichever story adopts this

1. The completeness check's universe includes every markdown file a skill ships, not only its entry
   document — or the narrower scope is stated and justified as a decision rather than left implicit.
2. OQ-3's answer is re-derived over that universe and any change to the guarded set is recorded
   per-skill with a reason.
3. A test proves the check would fail if a nested file resolved a binding-derived field — mutate one
   and show it red.
4. The two guards' definitions of "a skill document" are reconciled, or the difference is documented.

## Provenance

- Found while establishing where Story 31.10's publish protocol could legally live; the investigation
  had to enumerate which skills write planning artifacts and discovered the producers carry neither
  block.
- Independently verified: `skillEntryDocs()`'s two-filename scan, the five `*-save.md` writers, and
  the zero preflight count in their entry documents.
- **Not caused by Story 31.10**, which touches none of these files.
- Discoverable via glob: `_bmad-output/implementation-artifacts/bug-*.md`
- To add to a sprint, run `/add-to-sprint`
