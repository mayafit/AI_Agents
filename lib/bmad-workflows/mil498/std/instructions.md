# Generate Software Test Description (STD)

> MIL-STD-498 Data Item Description: DI-IPSC-81439

## Objective

Generate a compliant STD document by mapping test cases and procedures from project artifacts to the MIL-STD-498 STD template structure. The STD defines the test preparations, test cases, and test procedures for software qualification testing.

## Step 1 — Discover Project Artifacts

Search the project for the following artifacts. Communicate in {communication_language}. Inform {user_name} which artifacts were found and which are missing.

| Priority | Artifact | Search Pattern |
|----------|----------|----------------|
| Required | Epics & Stories | `**/epics*.md`, `**/epic-*.md`, `**/stories/*.md` |
| Required | Architecture | `**/architecture.md`, `**/architecture-*.md` |
| Recommended | SRS | `**/SRS.md` |
| Recommended | PRD | `**/prd.md`, `**/prd-*.md` |
| Optional | Existing test files | `**/test/**`, `**/tests/**`, `**/__tests__/**`, `**/*.test.*`, `**/*.spec.*` |

If **required** artifacts are missing, warn the user and ask whether to proceed with available data or stop.

## Step 2 — Load Template

Read the STD template from:
`{template}`

This defines the required DID sections and content expectations for each paragraph.

## Step 3 — Generate Document

Write the document in {document_output_language}, populating each template section:

### Section 1: Scope
- **1.1 Identification**: Extract system and software identifiers from PRD/Architecture
- **1.2 System overview**: Summarize the system and the CSCI(s) being tested
- **1.3 Document overview**: Describe this STD document's purpose and contents

### Section 2: Referenced documents
- List all project artifacts, test standards, and other references used

### Section 3: Test preparations

For each test identified, provide (organized as 3.x subsections):

- **3.x.1 Hardware preparation**: Test environment hardware requirements from Architecture — servers, devices, network configuration. Include setup procedures
- **3.x.2 Software preparation**: Test environment software requirements — OS, databases, dependencies, test frameworks. Include installation and configuration steps
- **3.x.3 Other pre-test preparations**: Test data setup, user accounts, external service mocks, environment variables. Include any prerequisites that must be satisfied

### Section 4: Test descriptions

For each test case (organized as 4.x subsections), derive from Story acceptance criteria and SRS requirements:

- **4.x.1 Test identifier**: Unique identifier (STD-TEST-001 format)
- **4.x.2 Test objective**: What requirement(s) this test verifies. Reference SRS requirement IDs if available
- **4.x.3 Input data**: Specific test inputs, preconditions, and initial state
- **4.x.4 Expected results**: Precise expected outputs, state changes, and behaviors
- **4.x.5 Criteria for evaluating results**: Pass/fail criteria
- **4.x.6 Test procedure**: Step-by-step procedure to execute the test
- **4.x.7 Assumptions and constraints**: Any assumptions about the test environment

Group test cases by capability/feature (mapping to Epics) for clarity.

### Section 5: Requirements traceability
- Map each test case to the SRS requirement(s) it verifies
- Ensure every SRS requirement has at least one associated test case
- Identify any requirements that cannot be tested and explain why

### Section 6: Notes
- Glossary of test terminology and abbreviations
- References to test automation frameworks or tools used

## Step 4 — Validate

Before presenting to the user, verify:
- All template sections are populated or marked "Not applicable" with justification
- Every test case has a unique identifier and clear pass/fail criteria
- Requirements traceability is complete (all requirements covered)
- Test procedures are detailed enough to be repeatable
- Document is written in {document_output_language}

## Step 5 — Review

Present the complete document to {user_name} for review.
Highlight any requirements without test coverage.
Offer to refine any section based on feedback.

## Step 6 — Save

Write the final document to:
`{output_folder}/planning-artifacts/STD.md`

Confirm the file was saved and display a summary of:
- Total number of test cases defined
- Requirements coverage percentage
- Any untestable requirements identified
- Any sections marked "Not applicable"
