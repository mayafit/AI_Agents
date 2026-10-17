---
type: bug
severity: medium
title: ma-skills help catalog loaded into the wrong columns, and my-next-issue makes SKILL.md and MANIFEST.yaml invalid YAML
---

# Bug: ma-skills help catalog loaded into the wrong columns, and `my-next-issue` makes SKILL.md and MANIFEST.yaml invalid YAML

**Status:** review
**Severity:** medium
**Affected Component:** `lib/bmad-extension/skills/module-help.csv` (and its plugin copy); `lib/bmad-extension/skills/my-next-issue/SKILL.md`; `lib/installer.js` (`installSkill` frontmatter, `generateSkillsManifest`)

## Summary

Found on 2026-10-17 while verifying the 3.18.1-beta.1 install in `D:\Code\Workshop`.
Three defects, all of the form "BMAD or YAML tooling can't read what we ship":

1. **The help catalog is filled into the wrong columns.** bmad-method 6.10.0 merges
   every module's `module-help.csv` into `_bmad/_config/bmad-help.csv` under one
   header (`MODULE_HELP_CSV_HEADER`, `tools/installer/modules/module-help-schema.js`).
   On a mismatch it warns and loads the file **by position**:
   ```
   ! ma-skills/module-help.csv header does not match canonical schema. Expected: module,skill,display-name,menu-code,... | Found: module,phase,name,code,sequence,workflow-file,command,required,agent,options,description,output-location,outputs, | Data loaded positionally.
   ```
   Our file used the pre-6.10 header, so all 51 ma-skills rows were scrambled.
   For example: `skill` = `anytime`, `description` = empty, `phase` = `false`, and
   `required` = the description text. `bmad-help` therefore described and routed
   every ma-skills entry wrongly.
2. **`my-next-issue` is dropped from bmad-method's skill manifest.** Its
   source frontmatter `description: Return ... (Jira: assignee = currentUser()) ...`
   contains an unquoted `: `, which is a YAML syntax error. bmad-method's manifest
   generator `yaml.parse`s each SKILL.md frontmatter and skips the skill when the
   parse throws. So `my-next-issue` was missing from `_bmad/_config/skill-manifest.csv`
   and its `_bmad/ma-skills/my-next-issue/` copy was never cleaned up. This explains
   the leftover recorded in `bug-bmad-skill-dir-cleanup-ebusy-on-windows`.
3. **The installed SKILL.md and the whole MANIFEST.yaml are invalid YAML.**
   `lib/installer.js` interpolated `skill.json` descriptions and `applies_when`
   conditions into YAML as raw text. The same description broke the installed
   `.claude/skills/my-next-issue/SKILL.md` and the entire
   `.claude/skills/MANIFEST.yaml` (Workshop: `Nested mappings are not allowed in
   compact mappings at line 205`). That is the file `CLAUDE.md` tells the agent
   to read first.

Defect 1 predates the betas (3.18.0 ships it). Defects 2 and 3 arrived with
`my-next-issue` (PR #148).

## Fix

- `module-help.csv` was rewritten in the canonical 13-column schema:
  - `skill` = the skill folder (the old `code`).
  - `display-name` = old `name`.
  - `description`, `phase`, `required`, `output-location` and `outputs` are carried over.
  - `action`, `args`, `preceded-by` and `followed-by` are left empty, since
    these are single-capability skills.
  - The stale `command` (`bmad-mil-generate-*` names, which no longer exist)
    and `agent` columns are dropped.
  - Each row gets a hand-assigned **menu code**, because `bmad-help` renders
    `[menu-code] Display name`. Codes are unique within ma-skills and don't
    collide with bmad-method or the bundled tea/cis/bmb codes: MIL-498 rows use
    the document acronyms (SSS, SSDD, OCD, ...), the persona agents use SRE/DVO/CYB/SQA,
    and the rest use initials.
  - The plugin copy is regenerated with `npm run build:plugin`.
- The `my-next-issue` source frontmatter description is quoted.
- `installSkill` now serialises the frontmatter with the `yaml` library, and
  `generateSkillsManifest` renders `description` and `applies_when` through
  `yamlScalar()`. Plain values stay unquoted, so the other 45 skills are
  byte-identical. Only `my-next-issue` changes.

## Verification

- New `test/module-help-canonical-schema.test.js` (8 tests). It checks:
  - the header equals the **installed** bmad-method's `MODULE_HELP_CSV_HEADER`,
    so a future schema change fails here first;
  - each row has 13 fields;
  - every `skill` ships;
  - required fields are present;
  - menu codes are unique and collision-free against bmad-method and the
    bundled modules;
  - every extension SKILL.md frontmatter parses with a matching name;
  - the plugin copy is identical.

  Against the old CSV it fails 4 tests, and against the old `my-next-issue`
  frontmatter it fails 1.
- New `test/installed-yaml-validity.test.js` (3 tests). It parses the generated
  MANIFEST.yaml and every installed SKILL.md for **all** shipped skills and
  round-trips descriptions and `applies_when`. Without the installer fix it
  fails with the exact Workshop error (line 205).
- `test/extension-module-restructure.test.js` encoded the old schema: it required
  a `name` column and looked entries up by `code`. It now asserts the canonical
  header and looks entries up by `skill`.
- End-to-end `ma-agents install --yes --agent claude-code --bmad-modules
  bmm,tea,bmb,cis` from the branch:
  - the schema warning is gone;
  - all 51 ma-skills catalog rows match the source field for field;
  - `my-next-issue` is in `skill-manifest.csv`;
  - `_bmad/ma-skills/` holds only `config.yaml` and `module-help.csv`.

- I ran all 110 test files individually. Three fail with identical failure
  lines on `origin/main` (`migration-validation`, `project-layout-staleness-guard`,
  `project-layout-confluence-publish-hook`), so they're pre-existing.
- **Also fixed: a red release gate on `main`.** `release-gate-epic-31.test.js`
  AC7.5h pins the count of shipped tracked files. PR #153 added
  `lib/fs-retry-preload.js` without updating the count, so `main` reported 2036
  against a recorded 2035. The record now says 2036 (unscanned remainder
  427 → 428) and explains why. This PR adds no shipped files.

## Notes

- `ma-skills` rows for `bmad-dev-story`, `bmad-sprint-planning` and
  `bmad-sprint-status` duplicate skills bmm also lists. They carry distinct
  codes (MDS, MSP, SSH). Pruning the duplicates is out of scope.
- CODE FIX; NO PRD amendment.
