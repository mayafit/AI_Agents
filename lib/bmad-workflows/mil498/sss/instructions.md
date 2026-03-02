# Generate System/Subsystem Specification (SSS)

> MIL-STD-498 Data Item Description: DI-IPSC-81431

## Objective

Generate a compliant SSS document by extracting and organizing system-level requirements from existing project artifacts into the MIL-STD-498 SSS template structure. The SSS specifies requirements at the system or subsystem level, not at the software (CSCI) level.

## Step 1 — Discover Project Artifacts

Search the project for the following artifacts. Communicate in {communication_language}. Inform {user_name} which artifacts were found and which are missing.

| Priority | Artifact | Search Pattern |
|----------|----------|----------------|
| Required | Product Brief | `**/product-brief*.md` |
| Required | PRD | `**/prd.md`, `**/prd-*.md` |
| Recommended | Architecture | `**/architecture.md`, `**/architecture-*.md` |
| Optional | OCD | `**/OCD.md` |
| Optional | UX Designs | `**/ux-design*.md` |

If **required** artifacts are missing, warn the user and ask whether to proceed with available data or stop.

## Step 2 — Load Template

Read the SSS template from:
`{template}`

This defines the required DID sections and content expectations for each paragraph.

## Step 3 — Generate Document

Write the document in {document_output_language}, populating each template section. Keep requirements at the **system/subsystem level** — avoid low-level software implementation details.

### Section 1: Scope
- **1.1 Identification**: Extract system name, version, identifiers from PRD/Product Brief
- **1.2 System overview**: Summarize system purpose, nature, and stakeholders
- **1.3 Document overview**: Describe this SSS document's purpose and contents

### Section 2: Referenced documents
- List all project artifacts and external standards used

### Section 3: Requirements

- **3.1 Required states and modes**: Identify system-level operational states from Architecture/PRD (e.g., operational, maintenance, degraded, emergency). If none, state so explicitly
- **3.2 System capability requirements**: Map high-level PRD features and Product Brief goals to system capabilities. Each capability requirement (3.2.1, 3.2.2, etc.) must have:
  - A unique identifier (SSS-CAP-001 format)
  - Clear, testable statement
  - Performance parameters where applicable
  - Behavior under error conditions
- **3.3 System external interface requirements**: Map top-level external interfaces from Architecture — other systems, hardware, users, networks
- **3.4 System internal interface requirements**: Map interfaces between major subsystems or components
- **3.5 System internal data requirements**: System-level data stores, data flows between subsystems
- **3.6 Adaptation requirements**: Installation and site-specific configuration needs
- **3.7 Safety requirements**: System-level safety requirements
- **3.8 Security and privacy requirements**: System-level security requirements from PRD
- **3.9 System environment requirements**: Physical, regulatory, and operational environment constraints
- **3.10 Computer resource requirements**: System-level hardware and infrastructure requirements
- **3.11 System quality factors**: Reliability, availability, maintainability, portability requirements
- **3.12 Design and implementation constraints**: Technology and methodology constraints
- **3.13-3.18**: Additional requirement categories as defined in the template

### Section 4: Qualification provisions
- For each requirement in Section 3, specify the qualification method: Demonstration, Test, Analysis, or Inspection

### Section 5: Requirements traceability
- **5.a**: For subsystem specs, map each requirement to parent system requirements
- **5.b**: Map parent requirements to subsystem requirements that address them

### Section 6: Notes
- Glossary of terms, acronyms, and abbreviations

## Step 4 — Validate

Before presenting to the user, verify:
- All template sections are populated or marked "Not applicable" with justification
- Requirements are at the system level (not CSCI/software level)
- Every requirement has a unique identifier and is testable
- Qualification methods are specified for all requirements
- Document is written in {document_output_language}

## Step 5 — Review

Present the complete document to {user_name} for review.
Highlight any sections where information was inferred or assumptions were made.
Offer to refine any section based on feedback.

## Step 6 — Save

Write the final document to:
`{output_folder}/planning-artifacts/SSS.md`

Confirm the file was saved and display a summary of:
- Total system requirements identified
- Number of capabilities documented
- Qualification methods assigned
- Any sections marked "Not applicable"
