# Sprint Change Proposal — SQA Persona Rename: Gad → Gadi

**Date:** 2026-06-30
**Prepared by:** Correct-Course workflow (user: 995472)
**Mode:** Batch
**Change scope classification:** Minor — Direct Adjustment

---

## Section 1 — Issue Summary

The SQA & Standards Expert persona ships under the display name **"Gad"**. The decision is to rename it to **"Gadi"** and propagate the change consistently across the BMAD chain.

This is a **post-implementation change**: the SQA agent (Epic 20) and the v6.3.0 plugin migration (Epic 22) have already shipped. The change is therefore handled per change-management discipline — the specification documents are updated in place and the implementation is delivered through a **new story**, rather than by editing the completed epics/stories that originally delivered the persona.

**Nature of change:** pure **display-name / persona-name** change. No identifiers, paths, folders, or behavior change. Specifically unchanged: agent id `bmm-qa`, skill folder + manifest `name` `ma-agent-sqa`, install dir `_bmad/skills/sqa/`, report-file naming, and memory path `_bmad/memory/ma-agent-sqa/`. This keeps the change low-risk and mechanical.

## Section 2 — Impact Analysis

**Epic impact:** None structural. No epics added, removed, resequenced, or rescoped.

**Artifact handling classes:**

### A. Specification documents — updated in place ("what" + "how")
- **PRD** (`prd.md`): Executive Summary specialized-agents bullet, Capability Area 18, FR158/FR159/FR160/FR166/FR167/FR171, FR178 persona list, FR194. New `editHistory` entry dated 2026-06-30; `lastEdited` bumped.
- **Architecture** (`architecture.md`): Decision P3-2 (title + body + gap-remediation row), module-folder structure diagram, deferred Memory-agent follow-up references. New `phase5EditHistory` entry dated 2026-06-30.
- Dated changelog/`changes:` blocks in both documents are **left intact** as historical record.

### B. Implementation — delivered via new story `rename-sqa-persona-gad-to-gadi`
- `lib/agents.js` (`bmm-qa` name + description)
- `lib/bmad-customize/bmm-qa.customize.yaml` (name, header, menu description)
- `lib/bmad-extension/skills/ma-agent-sqa/` SKILL.md + `bmad-skill-manifest.yaml` (`displayName`)
- `lib/bmad-extension/skills/{sqa-audit,sqa-ieee12207,sqa-requirements-quality}/SKILL.md` (auditor footers; IEEE note)
- `lib/bmad-extension/skills/module-help.csv`
- `lib/bmad-extension/.claude-plugin/marketplace.json.template`
- `README.md` (agent table, workflow header, persona list)
- Tests: `test/migration-validation.test.js`, `test/convert-agents-to-skills.test.js`, `test/extension-module-restructure.test.js`

### C. Generated bundles — regenerated, not hand-edited
- `lib/bmad-extension-plugin/**` + `marketplace.json` via `npm run build:plugin`
- `.agents/skills/**` regenerated
- (Bundle Drift Guard must stay green.)

### D. Left untouched — historical record
- Completed **Epic 20** and **Epic 22** text in `epics.md`
- **Epic 23** backlog stub in `epics.md` + the mirroring `sprint-status.yaml` comment — persona name reconciled when Epic 23 is detailed/activated
- All `_bmad-output/implementation-artifacts/done/*.md` story files
- Dated revision-history `changes:` blocks in PRD/architecture

> **Deliberate, documented inconsistency:** `epics.md` retains "Gad" for the historical Epic 20/22 records and the Epic 23 stub. This is intentional — epics/stories are the record of implementation work as executed; they are not retroactively rewritten.

## Section 3 — Recommended Path Forward

**Option 1 — Direct Adjustment** (Effort: Low–Medium, Risk: Low). Update the specs in place and deliver the implementation via a new story. Options 2 (rollback) and 3 (MVP review) are not applicable — nothing is reverted and scope is unchanged.

## Section 4 — Detailed Change (representative)

```
lib/agents.js
  name:        'SQA & Standards Expert (Gad)'  → '...(Gadi)'
  description: '...Standards Expert (Gad)'      → '...(Gadi)'

lib/bmad-extension/skills/ma-agent-sqa/bmad-skill-manifest.yaml
  displayName: Gad → Gadi

lib/bmad-customize/bmm-qa.customize.yaml
  agent.metadata.name: "Gad" → "Gadi"

test/convert-agents-to-skills.test.js
  displayName: 'Gad' → 'Gadi'
```
All other edits are the same `Gad → Gadi` token swap in the listed locations.

## Section 5 — Implementation Handoff

**Scope: Minor (Direct Adjustment).** No backlog reorganization; no `sprint-status` epic/story restructuring beyond registering the one new standalone story (`rename-sqa-persona-gad-to-gadi`, status `review`).

Delivered by the Developer agent inside an isolated worktree (`chore/rename-sqa-gad-to-gadi`):
1. Spec edits (PRD + architecture) + new revision-history entries
2. New story file + `sprint-status.yaml` registration
3. Implementation edits + test updates
4. Regenerate bundles (`npm run build:plugin`, `.agents/`)
5. `npm test` (distinguishing the pre-existing CRLF suite-health drift from any rename-caused failure)
6. Self-run `code-review`; open PR to `main`; **no auto-merge**

**Success criteria:** all user-facing surfaces present "Gadi"; no id/path/behavior change; bundles consistent (drift guard green); tests green modulo the documented pre-existing drift.

---

### Checklist status
- §1 Trigger & Context — Done
- §2 Epic Impact — Done (no structural impact)
- §3 Artifact Analysis — Done (no UX artifact = N/A)
- §4 Path Forward — Done (Option 1 / Direct Adjustment)
- §5 Proposal Components — Done
- §6 Final Review & Handoff — Approved by user (full chain in one PR; standalone story)
