# Story 32.6 — Retired Skill-Name Sweep (and Paige's retirement)

Status: backlog
Blocked on: 32-3
Wave: 2 (parallel with 32.4, 32.5)

**FR:** FR276 ("every ma-agents-owned enumeration, 'next steps' text, `module-help.csv` row, `MANIFEST.yaml` entry and training reference to a retired name … is removed or repointed"), FR271. **NFR:** NFR49 (user content preserved). **Decision inputs:** P5-10.5 (retired upstream workflows are replaced by their successors in every ma-agents enumeration), Sprint Change Proposal §4.4 ("rewrite … `my-next-issue` 'next steps' against the 6.12 catalog").

## Story

As an **ma-agents user on a no-shims 6.12.4 install**,
I want no ma-agents skill, doc, persona map or training slide to send me to a skill that no longer exists,
so that every "next step" I am told to run actually resolves.

## Context

The retired set for this sweep is: `bmad-create-story`, `bmad-dev-story`, `bmad-shard-doc`, `bmad-index-docs`, `bmad-agent-tech-writer` (Paige; `bmm-tech-writer` in ma-agents' persona vocabulary), `bmad-check-implementation-readiness`, and the research trio `bmad-domain-research`, `bmad-market-research`, `bmad-technical-research` (→ `bmad-deep-recon`). Because ma-agents installs without `--shims`, the remaining `v6-shims/` names (e.g. `bmad-sprint-status`, `bmad-quick-dev`, `bmad-checkpoint-preview`, `bmad-review-edge-case-hunter`, `bmad-review-adversarial-general`) are equally unresolvable and are in scope for the test. `bmad-generate-project-context` is **not** retired — it still exists upstream at 6.12.4 and must not be swept. A `git grep` at the worktree base finds hits outside history in: `lib/bmad-extension/skills/my-next-issue/SKILL.md:24`, `:129`, `:189-190` and `skills/my-next-issue/SKILL.md:13`, `:118`, `:178-179` (the "Next steps" list sends users to `/bmad-dev-story` and `/bmad-create-story`); `lib/bmad.js:1422` (`PERSONA_SKILL_MAP` `'bmm-tech-writer': 'bmad-agent-tech-writer'`, the on-prem phase-prefix router); `lib/skill-authoring.js:411` (`BUILTIN_AGENTS` includes `'bmm-tech-writer'`); `lib/bmad-customize/bmm-tech-writer.customize.yaml`; `README.md:504` and `:735` (`bmad-sprint-status` rows); and the binary training deck `lib/methodology/BMAD_AI_Development_Training.pptx`. `bmad-dev-epic`'s hits are owned by 32.5 and the three shadow skills' by 32.4. `README.md`, `QUICK_START.md`, `SKILLS_STRUCTURE.md`, `DEVELOPMENT.md` and `docs/**` have **zero** hits for the retired set today (verified) — the sweep confirms rather than edits them. Note: the `bmm-tech-writer` registration is in `lib/bmad.js` and `lib/skill-authoring.js`, not `lib/agents.js` (zero hits there).

## Acceptance Criteria

1. **Repo-wide zero-hit test.** New `test/retired-skill-names.test.js` runs `git ls-files` (outside authority: the tracked tree) and asserts zero occurrences of each retired name and each `v6-shims/` leaf name in every tracked text file, **excluding only**: `_bmad-output/**` (history), `CHANGELOG.md`, `AiAudit.md` (session log), `lib/bmad-cache/**` (vendored upstream), and an explicit allowlist array of `{file, name, reason}` entries for intentional historical mentions (e.g. a migration table that maps an old name to a new one). The shim leaf set is read from `node_modules/bmad-method/src/bmm-skills/v6-shims/` (and `src/core-skills/**/v6-shims` if present) at test time, not hard-coded. Each allowlist entry must still match (a stale allowlist entry fails the test). Failure output is file:line:name.
2. **Positive control.** The test asserts the shim set it read is non-empty and contains `bmad-dev-story`, and that `bmad-generate-project-context` is **not** in the retired set (guards against over-sweeping a live skill).
3. **`my-next-issue` repointed.** Both copies' "Next steps" and the `:24` / `:13` prose name the 6.12 successors confirmed in `32-1-gate-findings.md` AC9 (expected: `/bmad-build {{top.id}}` for "implement it", and no separate "prepare the story file first" line unless 32.1 names a 6.12 skill for it). `test/installed-yaml-validity.test.js` (which covers this skill's description YAML) still passes. The Jira routing block and identity clause in both copies are byte-unchanged (`test/jira-identity-clause.test.js` passes).
4. **Paige retired — decided, not orphaned.** `lib/bmad-customize/bmm-tech-writer.customize.yaml` is deleted; `PERSONA_SKILL_MAP` drops `'bmm-tech-writer'` (`lib/bmad.js:1422`); `BUILTIN_AGENTS` drops it (`lib/skill-authoring.js:411`). Test lists that mirror those constants are updated to derive from them or from the directory listing of `lib/bmad-customize/` rather than restating them: `test/skill-customize-agent.test.js:62`, `test/bmad-extension.test.js:83`, `test/integration-verification.test.js:426`, `test/migration-validation.test.js:459`. A test asserts every key of `PERSONA_SKILL_MAP` has a `lib/bmad-customize/<key>.customize.yaml` and every value is a skill dir present in a real 6.12.4 install (or explicitly marked INERT, as `bmm-sm` / `bmm-qa` already are in the comment at `lib/bmad.js:1424`, entries `:1437-1438`).
5. **Existing installs keep user content.** On an on-prem project previously installed with Paige's phase-prefix block, a re-install neither errors nor deletes user files; the orphan `bmad-agent-tech-writer` skill dir is left to upstream's `removals.txt` handling as recorded in 32.1 AC6 (ma-agents adds no deletion of its own). Asserted on a fixture tree.
6. **Docs.** `README.md:504` and `:735` (`bmad-sprint-status` rows) are removed or repointed to `bmad-sprint-planning`; any README table enumerating BMAD Phase-4 skills lists the 6.12 chain (`bmad-sprint-planning` → `bmad-build` → `bmad-code-review`). `README.md:45`'s stale bundle statement (`{tea, bmb, cis, gds, wds}`) is corrected to the 32.3 bundle. QUICK_START / SKILLS_STRUCTURE / DEVELOPMENT / `docs/**` pass AC1 with no edit, or are edited until they do.
7. **Training deck.** Every slide XML in `lib/methodology/BMAD_AI_Development_Training.pptx` (unzipped `ppt/slides/*.xml` and `ppt/notesSlides/*.xml`) is free of retired names; AC1's test unzips the deck and scans the XML text, so the binary is not a blind spot. `lib/methodology/version.json` is bumped per its convention. Any copy under `_bmad-output/methodology/` is history and excluded.
8. **Self-install artifacts regenerated.** The tracked `.agents/skills/` tree (which today carries 6.10 copies of `bmad-create-story`, `bmad-shard-doc`, `bmad-index-docs`, the research trio, `bmad-agent-tech-writer`, `bmad-check-implementation-readiness`, …) is regenerated by a real install at 6.12.4 into the repo (or the stale upstream copies are removed), so AC1 passes **without** excluding `.agents/`. `_bmad/` is not tracked; `_bmad/_config/` output is checked on a scratch install only (no retired name in `_bmad/_config/skill-manifest.csv` / `manifest.yaml` of a no-shims install).
9. **Mutation-checked.** (m1) re-insert `/bmad-dev-story` in `skills/my-next-issue/SKILL.md` → AC1 red with file:line; (m2) add a stale allowlist entry → AC1 red; (m3) restore `bmm-tech-writer.customize.yaml` → AC4 red; (m4) plant `bmad-index-docs` in a slide note → AC7 red.

## Tasks / Subtasks

- [ ] T1 Write `test/retired-skill-names.test.js` with shim-set read from upstream, allowlist, pptx scan; add to the chain (AC1, AC2, AC7)
- [ ] T2 Repoint both `my-next-issue` copies (AC3)
- [ ] T3 Retire Paige: customize file, `PERSONA_SKILL_MAP`, `BUILTIN_AGENTS`, derived test lists (AC4, AC5)
- [ ] T4 README rows and stale bundle line (AC6)
- [ ] T5 Edit the training deck (`anthropic-skills:pptx` or `python-pptx` via `uv run`); bump `version.json` (AC7)
- [ ] T6 Regenerate `.agents/skills/` at 6.12.4; scratch-install `_bmad/_config` check (AC8)
- [ ] T7 Mutants m1–m4 (AC9); `npm run build:plugin`

## Dev Notes

- Run AC1's test last, after 32.4 and 32.5 have landed on the epic branch — before that it legitimately fails on their files. Until then run it with the two skill dirs filtered locally to see only this story's surface.
- The sweep regex must be word-bounded: `bmad-review` is a live 6.12 skill and a prefix of `bmad-review-edge-case-hunter`; `bmad-create-prd` (shim) vs `bmad-create-epics-and-stories` (live). Match whole skill names (`(?<![a-z0-9-])name(?![a-z0-9-])`).
- `bmm-sm` / `bmm-qa` are already documented INERT in `PERSONA_SKILL_MAP` (`lib/bmad.js:1424-1438`); do not "fix" them here — they are not in the retired set.
- `.agents/skills/` regeneration rewrites ~600 tracked files; commit it separately (`chore:`) so the review diff of the real changes stays readable. `npm test` also mutates `.agents/`, `AGENTS.md`, `project-context.md` (known) — restore before committing.
- PPTX: edit text runs, not slide images; keep layout. Note in the Verification record any slide that only showed a retired name inside a screenshot (cannot be fixed by text edit — list it).

## Out of scope

- `bmad-dev-epic` content (32.5) and the three deleted shadow skills (32.4).
- Writing a replacement tech-writer persona (upstream plans an optional agent; not ours).
- The docs/training rewrite around six packages (Epic 35.5) — this story only removes dead names.
- Rebasing `docs/align-doc-set` (Epic 35.5).

## Verification record

Suite: … ; zero-hit test: files scanned …, allowlist entries … ; mutants: m1 … m4 ; screenshot-only slide mentions: … ; unverified: …
