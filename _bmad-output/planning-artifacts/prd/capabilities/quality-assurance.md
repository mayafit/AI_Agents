# Software Quality Assurance (SQA)

> **Shard** of the [PRD index](../../prd.md). Content is verbatim from the
> pre-split document; the index carries the front matter, registers and reading order.
>
> Capability F18 — the SQA agent (Gadi). Architecture: P3-2.

---

## Functional Requirements

### Software Quality Assurance (SQA)

#### SQA Agent Persona

- FR158: Quality engineers can activate the SQA Agent (Gadi) — a purpose-built persona specializing in structured quality assurance workflows: project auditing, process compliance verification, and standards conformance assessment
- FR159: On activation, Gadi presents a numbered menu of available quality workflows with keyboard shortcuts and trigger phrases. Menu items include: Project Audit, IEEE/ISO/IEC 12207 Compliance, and Dismiss Agent. Chat mode is available for ad-hoc quality questions

#### Project Audit Workflow

- FR160: Gadi's Project Audit workflow begins by asking whether to run a full audit (all five dimensions) or a partial audit (user selects which dimensions by number) — execution only begins after the user confirms scope
- FR161: The Code-to-Stories Traceability dimension reads done and in-progress items from `sprint-status.yaml` and verifies that each story has traceable code evidence; it also surfaces significant code changes with no backing story, flagging each finding with its story ID and traceability status
- FR162: The Stories-to-Architecture/PRD Alignment dimension maps each epic to its corresponding PRD section, verifies that stories do not introduce architectural decisions contradicting `architecture.md`, and identifies PRD requirements with no corresponding epic or story — producing a PRD coverage table (COVERED / MISSING / PARTIAL) and an architecture compliance issue list
- FR163: The Process Compliance dimension evaluates development process adherence: commit message format conventions, feature-branch discipline (changes not committed directly to main), test file presence alongside new implementation files, and code review evidence — producing a process checklist with PASS / FAIL / UNKNOWN per item
- FR164: The Sprint Health dimension reads all sprints from `sprint-status.yaml` and reports: completion percentage per sprint, overdue items, stalled in-progress items, blockers, and backlog grooming health (prioritization, epic linkage, item clarity)
- FR165: The Release State dimension evaluates release readiness by mapping done stories to declared release scope, identifying blocking items preventing release, and reporting deployment environment status as provided by the user
- FR166: After all selected dimensions execute, Gadi produces a written audit report saved to `{output_folder}/sqa-audit-report-{YYYY-MM-DD}.md`. The report includes an executive summary, per-dimension findings tables with PASS / WARNING / FAIL severity, a prioritized action-item list, and a skipped-dimension list with required artifacts for each skip

#### IEEE/ISO/IEC 12207 Compliance Workflow

- FR167: Gadi's IEEE/ISO/IEC 12207 compliance workflow begins by presenting the four process groups and asking whether to evaluate all groups or selected ones — evaluation only begins after the user confirms scope
- FR168: The workflow evaluates 23 process areas across four IEEE/ISO/IEC 12207:2017 process groups: Technical Processes (11 areas: Business Analysis, Stakeholder Requirements, Software Requirements, Architecture, Design, System Analysis, Implementation, Integration, Verification, Validation, Transition), Technical Management Processes (8 areas: Project Planning, Project Assessment, Decision Management, Risk Management, Configuration Management, Information Management, Measurement, Quality Assurance), Agreement Processes (2 areas: Acquisition, Supply), and Organizational Enabling Processes (2 areas: Life Cycle Model Management, Knowledge Management)
- FR169: Each evaluated process area receives a compliance rating: COMPLIANT (evidence satisfies process intent), PARTIAL (some evidence, gaps remain), NON-COMPLIANT (no evidence or clear violation), NOT APPLICABLE (process not relevant to this project type), or ORGANIZATION-SCOPE (verifiable only at organizational level, not from project artifacts). Ratings are derived from available project artifacts: `prd.md`, `architecture.md`, `sprint-status.yaml`, test files, git history, and changelog
- FR170: The workflow produces a compliance matrix report saved to `{output_folder}/sqa-ieee12207-report-{YYYY-MM-DD}.md`. The report includes an executive summary, per-group compliance matrices (clause, process area, compliance rating, key evidence, gaps), a gap analysis separating critical gaps from partial compliance items, a prioritized recommended-action table, and a compliance summary table with counts per group and an overall compliance percentage
- FR171: After any SQA workflow that identifies gaps, Gadi offers to create structured bug or story entries in the project backlog for each P1 (critical) gap — invoking the `create-bug-story` workflow for each accepted item

## Quality Attributes (Non-Functional Requirements)

### Software Quality Assurance (SQA)

- NFR42: SQA audit findings driven by project artifacts (prd.md, architecture.md, epics.md, sprint-status.yaml) must be deterministic — re-running a workflow on unchanged artifacts must not introduce variance from execution alone. Findings that depend on user-provided inputs (git log output, deployment environment status) may differ across runs only when the user provides different data; this is expected behavior, not a defect.
- NFR43: The IEEE/ISO/IEC 12207 compliance workflow must not require internet access — all evaluation logic, process area definitions, and rating criteria are embedded in the skill; no external standard document download or network call is made during execution
