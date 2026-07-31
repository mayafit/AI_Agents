# Methodology & SDLC Workflows

> **Shard** of the [PRD index](../../prd.md). Content is verbatim from the
> pre-split document; the index carries the front matter, registers and reading order.
>
> Capabilities F7 (MIL-STD-498 Document Generation), F8 (SDLC Workflows),
> F9 (Bug Management), F16 (Methodology Onboarding).

---

## Functional Requirements

### MIL-STD-498 Document Generation

- FR13: Systems engineers can generate SSS (System/Subsystem Specification) documents from project artifacts
- FR14: Systems engineers can generate SSDD (System/Subsystem Design Description) documents
- FR15: Systems engineers can generate OCD (Operational Concept Description) documents
- FR16: Project managers can generate SDP (Software Development Plan) documents
- FR17: Product managers can generate SRS (Software Requirements Specification) documents
- FR18: Product managers can generate SDD (Software Design Description) documents
- FR19: Architects can generate IDD (Interface Design Description) documents
- FR20: Architects can generate IRS (Interface Requirements Specification) documents
- FR21: Architects can generate HRS (Hardware Requirements Specification) documents
- FR22: Test engineers can generate STD (Software Test Description) documents
- FR23: Test engineers can generate STR (Software Test Report) documents

### SDLC Workflow Execution

- FR24: Product managers can create PRDs through guided collaborative workflows
- FR25: Product managers can break PRDs into epics and user stories
- FR26: Product managers can run sprint planning from epics — generating or refreshing the unified `sprint-status.yaml` with epic status, backlog, and sprint sections
- FR27: Architects can create architecture documents through guided workflows
- FR28: Architects can create UX design specifications
- FR29: Engineers can check implementation readiness across PRD, architecture, and epics
- FR30: Engineers can run code reviews against established standards
- FR31: Test engineers can generate automated E2E tests from feature specifications
- FR32: Project managers can track sprint status and surface risks — reading from the unified `sprint-status.yaml` file
- FR33: Teams can run retrospectives at epic boundaries

### Bug Management

- FR60: Bugs are structured entities with required fields: problem description, reproduction steps, bug type, version found, environment constraints, severity, and status
- FR61: A BMAD extension workflow (deployed via `extends-module: bmm`) generates a structured bug story from a bug report
- FR62: The `auto-bug-detection` skill instructs coding agents to propose a bug issue to the user when they detect a problem in already-delivered code (story done, code merged, released version)
- FR63: During BMAD code-review workflows, agents suggest generating bug issues when relevant problems are found in delivered features
- FR64: Bugs exist in the backlog as standalone items — never assigned to an epic

### Methodology Onboarding

- FR72: A methodology presentation is bundled with BMAD installation and deployed to `_bmad-output/methodology/`, providing team onboarding content for BMAD-METHOD without separate training materials
