# Story: Rename SQA Persona Gad → Gadi

Status: Review

## Story

As a **product owner of the ma-agents SQA capability**,
I want the SQA & Standards Expert persona's display name changed from **Gad** to **Gadi** everywhere it surfaces to users,
So that the persona presents under its corrected name consistently across the installed agent, BMAD customization, workflow reports, and documentation.

## Context

This is a **post-implementation change**. The SQA agent (Epic 20) and the BMAD v6.3.0 plugin migration (Epic 22) already shipped. Per project change-management discipline, the completed Epic 20 / Epic 22 stories and their `done/*.md` records are **not** edited; this new story carries the rename. The requirement/design specs (PRD, architecture) are updated in place because they describe the desired product state, and this story delivers the corresponding implementation.

**Scope is display-name only.** The following are deliberately **unchanged**: BMAD agent id `bmm-qa`, skill folder and manifest `name` `ma-agent-sqa`, the `_bmad/skills/sqa/` install dir, report-file naming conventions, and the deferred memory path `_bmad/memory/ma-agent-sqa/`. No identifiers, paths, or behavior change.

## Acceptance Criteria

1. **Installer agent registry.** `lib/agents.js` `bmm-qa` entry `name` and `description` read `Gadi` (not `Gad`).
2. **BMAD customization.** `lib/bmad-customize/bmm-qa.customize.yaml` `agent.metadata.name`, the header comment, and the menu activation description read `Gadi`.
3. **Agent skill.** `lib/bmad-extension/skills/ma-agent-sqa/SKILL.md` (frontmatter `description`, `# Agent:` heading, chat menu row) and `bmad-skill-manifest.yaml` `displayName` read `Gadi`.
4. **Workflow skills.** The `**Auditor:**` report-footer lines in `sqa-audit`, `sqa-ieee12207`, and `sqa-requirements-quality` SKILLs, and the "Note to …" instruction in `sqa-ieee12207`, read `Gadi`.
5. **Registration + packaging.** `lib/bmad-extension/skills/module-help.csv` SQA row and `lib/bmad-extension/.claude-plugin/marketplace.json.template` persona list read `Gadi`.
6. **Documentation.** `README.md` agent table, workflow-section header, and persona list read `Gadi`.
7. **Specs updated in parallel.** `prd.md` (forward-looking FR/exec/capability text) and `architecture.md` (Decision P3-2 and follow-up references) read `Gadi`, each with a new dated revision-history entry. Prior dated changelog blocks are left intact.
8. **Tests track the rename.** `test/migration-validation.test.js`, `test/convert-agents-to-skills.test.js`, and `test/extension-module-restructure.test.js` assert/reference `Gadi`. `npm test` passes (modulo the pre-existing, unrelated CRLF suite-health drift).
9. **Generated bundles regenerated, not hand-edited.** `lib/bmad-extension-plugin/**` + `marketplace.json` rebuilt via `npm run build:plugin`; `.agents/` regenerated. No manual edits to generated artifacts (Bundle Drift Guard stays green).
10. **History preserved.** Completed Epic 20 / Epic 22 text in `epics.md`, the Epic 23 backlog stub, and all `done/*.md` files are untouched. The Epic 23 persona name will be reconciled when that epic is detailed/activated.

## Tasks

- [x] Update `lib/agents.js`, `lib/bmad-customize/bmm-qa.customize.yaml`
- [x] Update `ma-agent-sqa` SKILL.md + manifest; `sqa-audit` / `sqa-ieee12207` / `sqa-requirements-quality` SKILLs
- [x] Update `module-help.csv`, `marketplace.json.template`, `README.md`
- [x] Update PRD + architecture spec text and add revision-history entries
- [x] Update test assertions in the three affected test files
- [ ] Regenerate plugin bundle (`npm run build:plugin`) and `.agents/`
- [ ] Run `npm test`; self-run `code-review`; open PR

## Change Log

| Date | Change |
|------|--------|
| 2026-06-30 | Story created and implemented under correct-course change management. Display-name rename Gad → Gadi across spec docs, implementation sources, tests, and regenerated bundles. Completed epics/stories and `done/*` left as history. |
