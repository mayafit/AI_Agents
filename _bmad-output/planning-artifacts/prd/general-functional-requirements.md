# General Functional Requirements (system-wide)

> **Shard** of the [PRD index](../prd.md). Content is verbatim from the
> pre-split document; the index carries the front matter, registers and reading order.
>
> Functional requirements that belong to no single capability. Both sections
> below are FR sections the PRD never declared as capability areas.

---

### Skill Authoring & Governance

- FR39: The Chief Architect can author new skills using the skill format (skill.json + SKILL.md + agent templates)
- FR40: The Chief Architect can designate skills as mandatory (`always_load: true`) for organizational enforcement
- FR41: The Chief Architect can customize BMAD agent personas to fit organizational processes
- FR43: The system generates MANIFEST.yaml from installed skills for agent consumption

### Audit & Traceability

- FR48: The system maintains an audit trail of AI agent activities via the ai-audit-trail skill
- FR49: Document generation workflows maintain traceability across inter-role handoffs (SSS → SRS → SDD → STD)
- FR50: Engineers can validate PRDs and other documents against established standards
