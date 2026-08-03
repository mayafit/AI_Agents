---
type: handoff
status: parked — awaiting a decision, no work started
created: 2026-08-03
subject: Bug B3 — a `skills/` directory appears at the project root on a Project-scope install
related_bug_story: bug-root-skills-dir-orphaned-artifact-dirs-on-install.md
---

# Handoff — B3: root `skills/` directory on install

Self-contained brief for picking this up in a fresh thread. Nothing has been changed
for B3; the only artifacts are its bug story and this file.

## Why it is parked

The product rule for this batch of install defects was: **"if it is something that comes
from BMAD, I don't want to change it."** That rule cleanly closed the sibling `docs/` bug
(won't-fix) and cleanly *kept* the `design-artifacts` one (because fixing it means
following BMAD's own `default_selected: false` rather than overriding it).

B3 sits exactly on the line, which is why it needs a human call rather than an assumption:

- **Its root cause is upstream BMAD.** Strict reading of the rule → leave it alone.
- **But its fix is entirely in ma-agents' own code.** ma-agents already ships a workaround
  for this class of defect (the bug 27.14 prune). B3 is four gaps in *that* workaround, not
  a change to BMAD. Reading of the rule → finish what we already started.

## The symptom

A clean install into an empty project — GitHub Copilot + Cline, **Project level** scope
(explicitly *not* "Custom path") — produces a `skills/` directory at the project root.

Ruled out with evidence, so do not re-investigate:

| Hypothesis | Ruled out because |
|---|---|
| The "Custom path…" prompt default (`./skills`, `bin/cli.js:1434`) | User chose Project level |
| Plugin materialisation | `installFromResolution` targets `_bmad/<code>` (upstream `official-modules.js:381-382`) |
| A `ma-skills` module writing to root | No such target; `_bmad/ma-skills/` is the config location |
| Any ma-agents copy step | Exhaustive grep of `lib/**/*.js` found no root-`skills/` write |
| This repo's own `skills/` | That is git-tracked source (~150 files), not install output |

## Root cause

bmb declares `{project-root}/skills` as an output folder
(`lib/bmad-cache/bmb/skills/module.yaml:12-15`). Upstream's config-key matcher uses a
**suffix match** — `answerKey.endsWith('_' + configKey)` (`official-modules.js:1818`) — so
bmb's `skills` key is captured while resolving *other* modules' `{output_folder}` answers.
The `directories:` blocks then materialise it via `fs.ensureDir` at
`official-modules.js:738`.

This is bug 27.14's mechanism. ma-agents already has the workaround —
`normalizeModuleOutputFolders` plus `pruneOrphanedArtifactDirs` in `lib/bmad.js` — and it
is incomplete in four specific ways.

> **Version caveat, verified:** `node_modules/bmad-method` on disk locally is a stale
> **6.9.0** with different line numbers. Every upstream citation above is against
> **6.10.0**, which is what `package.json:35` pins. Check the npx cache copy, not
> `node_modules`.

## The four gaps — all in ma-agents' own code

1. **The prune fix is unreleased.** It is commit `9dc2d5f` ("fix(installer): prune orphaned
   artifact dirs left by bug 27.14 work-around", PR #143), merged to `main`, but the latest
   published tag is **v3.17.0** and the CHANGELOG stops at 3.17.1. No installed version has
   the fix.
2. **`updateBmad` never calls `normalizeModuleOutputFolders`.** Only two call sites do
   (`lib/bmad.js:886` and `:995`) — and **every re-run routes through `updateBmad`**, which
   is the most common real-world path. This is the highest-value gap.
3. **The prune is non-retroactive** (`lib/bmad.js:2145`, `:2183`). Projects already
   littered stay littered; nothing cleans an existing `skills/`.
4. **The custom-marketplace `--action update` pass is unguarded** (`lib/bmad.js:1774`) — it
   can re-materialise the directory after a prune.

`skills/` itself is litter, not load-bearing — but note the *parent* is bmb's live output
folder, so a fix must not break bmb.

## The decision needed

**Do we finish the 27.14 workaround, or accept root `skills/` because BMAD causes it?**

Arguments to finish it:
- The workaround already exists and already shipped to `main`; this is completion, not new
  divergence from BMAD.
- Gap 2 means the fix currently misses the most common code path, so the merged work is not
  actually delivering.
- Unlike `docs/`, this one is permanent — no later run cleans it.
- It is the most misleading artifact of the four: a root `skills/` directory implies
  ma-agents owns it, which it does not.

Arguments to leave it:
- Strict application of the "don't change BMAD" rule.
- It is inert litter. Nothing reads it, nothing breaks.
- The real fix belongs upstream, and working around upstream bugs accrues maintenance debt
  (this is the second workaround layer for the same defect).

## If the decision is "finish it"

Suggested order, smallest risk first:

1. Add the `normalizeModuleOutputFolders` call to `updateBmad` (gap 2) — highest value,
   smallest diff, and it makes the already-merged fix effective.
2. Guard the custom-marketplace `--action update` pass (gap 4).
3. Decide retroactivity (gap 3): prune an existing empty `skills/` on the next install, or
   leave existing projects alone. Reuse the existing `dirIsFileless()` safety rail
   (`lib/bmad.js:2213-2225`) so a directory with real content is never removed.
4. Release (gap 1) — cut a version that actually carries the fix.

**Test with the affected files directly, not the chained `npm test`.** The full chain halts
on pre-existing MIL-498 template CRLF drift on Windows and would mask any breakage here —
the same caution Story 30.4's DoD records.

## Sibling bugs, for context

| Bug | Status |
|---|---|
| B1 — custom-marketplace stage leaked + not gitignored | **Fixed**, branch `fix/custom-marketplace-stage-leak-and-gitignore`, commit `9f93488` |
| B2 — `design-artifacts` from the wds module | **ready-for-dev**; FR123 amended so the default set is bmm+tea+bmb+cis |
| B4 — empty `docs/` | **WON'T FIX** — pure upstream bmm, ma-agents does not vendor it |
| **B3 — root `skills/`** | **This file. Parked.** |

Note B2 does **not** also fix `docs/` or `skills/`: bmm is force-included regardless of
selection, and bmb is in the retained default set.
