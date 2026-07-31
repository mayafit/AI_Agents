# Software Quality Assurance — Architecture Decisions

> **Shard** of the [Architecture index](../../architecture.md). Content is verbatim from the
> pre-split document; the index carries the front matter, registers and reading order.
>
> Constrains prd/capabilities/quality-assurance.md.

---

## Decisions

### Decision P3-2: Software Quality Assurance (SQA) Agent — Gadi (FR158–FR171, NFR42–NFR43) (2026-04-08)

**Problem:** The platform has no structured mechanism for auditing project quality across multiple dimensions (process compliance, traceability, standards conformance). Quality Engineers need purpose-built workflows to assess whether a project complies with its own planning artifacts and with recognized lifecycle standards such as IEEE/ISO/IEC 12207.

**Decision:** Add a fifth specialized agent persona — Gadi, the SQA Engineer — built on the existing BMAD 6.2.0 skill-based agent pattern established by Epic 15. Gadi uses the `bmm-qa` BMAD agent persona as its host and delivers quality workflows as discrete BMAD extension skills. Two workflows are defined for the initial release:

1. **Project Audit** (`sqa-audit`) — a five-dimension quality audit (code-to-story traceability, stories-to-architecture/PRD alignment, process compliance, sprint health, release state)
2. **IEEE/ISO/IEC 12207 Compliance** (`sqa-ieee12207`) — a 23-process-area compliance assessment against the international software lifecycle standard

**Architecture fit:**

| Concern | Resolution |
|---------|-----------|
| Agent host | Binds to `bmm-qa` — the existing BMAD built-in QA persona. No new BMAD agent slot required; agent count stays at 11. Specialized agent count grows from 4 to 5 |
| Skill structure | Follows P2-9 (BMAD 6.2.0 Agent Architecture Migration) — `lib/bmad-extension/skills/bmad-ma-agent-sqa/` (agent) + `lib/bmad-extension/skills/sqa-audit/` + `lib/bmad-extension/skills/sqa-ieee12207/` (workflows) |
| Read pattern | Workflows are read-only against project artifacts — no new file structures introduced. Inputs: `prd.md`, `architecture.md`, `epics.md`, `sprint-status.yaml`, test files, git history |
| Write pattern | Each workflow produces one markdown report in `{output_folder}` using the `sqa-{workflow}-report-{YYYY-MM-DD}.md` naming convention — consistent with other agent report outputs |
| Gap remediation | After any compliance workflow, Gadi offers to invoke `create-bug-story` for each P1 gap — reusing existing bug story infrastructure (FR171) |
| Registration | Both workflow skills and the agent skill are registered in `module-help.csv` under the `ma-skills` module, consistent with the registration pattern for all other specialized agent skills |
| Test coverage | `test/extension-module-restructure.test.js` tracks the new skills in `expectedSqaSkills` and updates skill and CSV entry counts |

**Alternatives considered:**
- *Add quality workflows to the existing `bmm-qa` built-in agent directly:* Rejected — built-in agent modifications require BMAD upstream PRs, violating the override-via-extension policy (feedback memory).
- *Add audit capabilities to the existing Cyber agent (Yael):* Rejected — Cyber focuses on security threat modeling and hardening. SQA is a distinct discipline covering process compliance and traceability, warranting a dedicated persona.

**IEEE/ISO/IEC 12207 coverage model:**
The workflow embeds all process area definitions and rating criteria inline in `SKILL.md` (air-gapped, NFR43). It does not attempt to formally certify compliance — it produces a compliance posture report based on evidence available in project artifacts. Organization-scope processes (HR, infrastructure management) are flagged as such and not evaluated from artifacts alone.

**Files affected:**
- `lib/bmad-extension/skills/bmad-ma-agent-sqa/` (new — agent skill)
- `lib/bmad-extension/skills/sqa-audit/` (new — Project Audit workflow skill)
- `lib/bmad-extension/skills/sqa-ieee12207/` (new — IEEE 12207 compliance workflow skill)
- `lib/bmad-extension/module-help.csv` (new entries: `bmad-ma-agent-sqa`, `sqa-audit`, `sqa-ieee12207`)
- `test/extension-module-restructure.test.js` (updated skill counts: 58→61, CSV rows: 58→61, new `expectedSqaSkills` array)

---
