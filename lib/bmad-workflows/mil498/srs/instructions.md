# Generate Software Requirements Specification (SRS)

> MIL-STD-498 Data Item Description: DI-IPSC-81433

## Objective

Generate a compliant SRS document by extracting and organizing software requirements from existing project artifacts into the MIL-STD-498 SRS template structure.

## Step 1 — Discover Project Artifacts

Search the project for the following artifacts. Communicate in {communication_language}. Inform {user_name} which artifacts were found and which are missing.

| Priority | Artifact | Search Pattern |
|----------|----------|----------------|
| Required | PRD | `**/prd.md`, `**/prd-*.md` |
| Required | Architecture | `**/architecture.md`, `**/architecture-*.md` |
| Recommended | UX Designs | `**/ux-design*.md`, `**/ux-*.md` |
| Recommended | Epics | `**/epics*.md`, `**/epic-*.md` |
| Optional | Product Brief | `**/product-brief*.md` |
| Optional | Existing SRS | `**/SRS.md` |

If **required** artifacts are missing, warn the user and ask whether to proceed with available data or stop.

If an existing SRS is found, ask the user whether to update it or generate from scratch.

## Step 2 — Load Template

Read the SRS template from:
`{template}`

This defines the required DID sections and content expectations for each paragraph.

## Step 3 — Generate Document

Write the document in {document_output_language}, populating each template section:

### Section 1: Scope
- **1.1 Identification**: Extract software name, version, CSCI identifiers from the PRD and Architecture
- **1.2 System overview**: Summarize purpose, nature, development history from PRD
- **1.3 Document overview**: Describe this SRS document's purpose and contents

### Section 2: Referenced documents
- List all project artifacts used as input sources, with their titles and versions

### Section 3: Requirements

- **3.1 Required states and modes**: Identify operational modes from Architecture (e.g., normal, degraded, maintenance, training). If none, state "The CSCI does not have distinct operational states or modes"
- **3.2 CSCI capability requirements**: Map each Epic/feature from the PRD to a numbered capability requirement (3.2.1, 3.2.2, etc.). Each requirement must have:
  - A unique project identifier (e.g., SRS-CAP-001)
  - Clear, testable acceptance criteria
  - Parameters: response times, throughput, accuracy, capacity as applicable
  - Error handling and boundary conditions
- **3.3 CSCI external interface requirements**: Map external interfaces from the Architecture document. Include user interfaces, hardware interfaces, software interfaces, and communication interfaces
- **3.4 CSCI internal interface requirements**: Document internal component interfaces from Architecture
- **3.5 CSCI internal data requirements**: Identify persistent data stores, databases, and data models
- **3.6 Adaptation requirements**: Document any site-specific or installation-specific requirements
- **3.7 Safety requirements**: Extract from PRD/Architecture if applicable
- **3.8 Security and privacy requirements**: Extract from PRD/Architecture
- **3.9 CSCI environment requirements**: Document runtime environment constraints
- **3.10 Computer resource requirements**: Extract hardware/software constraints from Architecture
- **3.11 Software quality factors**: Document quality attributes (reliability, maintainability, portability, etc.)
- **3.12 Design and implementation constraints**: Technology stack constraints from Architecture
- **3.13 Personnel-related requirements**: Any user skill or training requirements
- **3.14 Training-related requirements**: If applicable
- **3.15 Logistics-related requirements**: If applicable
- **3.16 Other requirements**: Any requirements not covered above
- **3.17 Packaging requirements**: Deployment and distribution requirements
- **3.18 Precedence and criticality of requirements**: Rank requirements by priority

### Section 4: Qualification provisions
- For each requirement in Section 3, specify the qualification method: Demonstration, Test, Analysis, or Inspection

### Section 5: Requirements traceability
- **5.a**: Map each SRS requirement to its parent system requirement
- **5.b**: Map each system requirement to the SRS requirements that address it

### Section 6: Notes
- Glossary of terms, acronyms, and abbreviations used in this document

## Step 4 — Validate

Before presenting to the user, verify:
- All template sections are populated or marked "Not applicable" with justification
- Every requirement has a unique identifier (SRS-xxx-nnn format)
- Every requirement is testable and traceable
- Cross-references between sections are consistent
- Document is written in {document_output_language}

## Step 5 — Review

Present the complete document to {user_name} for review.
Highlight any sections where information was inferred or assumptions were made.
Offer to refine any section based on feedback.

## Step 6 — Save

Write the final document to:
`{output_folder}/planning-artifacts/SRS.md`

Confirm the file was saved and display a summary of:
- Total number of requirements identified
- Number of capabilities documented
- Any sections marked "Not applicable"
