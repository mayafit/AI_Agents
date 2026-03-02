# Generate Software Design Description (SDD)

> MIL-STD-498 Data Item Description: DI-IPSC-81435

## Objective

Generate a compliant SDD document by mapping the system's software design and architecture to the MIL-STD-498 Software Design Description template structure. This document describes the design of a CSCI (Computer Software Configuration Item).

**Note**: This workflow uses the SSDD template structure adapted for CSCI-level design, as both SDD and SSDD follow the same DID pattern but at different abstraction levels.

## Step 1 — Discover Project Artifacts

Search the project for the following artifacts. Communicate in {communication_language}. Inform {user_name} which artifacts were found and which are missing.

| Priority | Artifact | Search Pattern |
|----------|----------|----------------|
| Required | Architecture | `**/architecture.md`, `**/architecture-*.md` |
| Required | PRD | `**/prd.md`, `**/prd-*.md` |
| Recommended | Epics & Stories | `**/epics*.md`, `**/epic-*.md`, `**/stories/*.md` |
| Recommended | SRS | `**/SRS.md` |
| Optional | UX Designs | `**/ux-design*.md`, `**/ux-*.md` |
| Optional | Product Brief | `**/product-brief*.md` |

If **required** artifacts are missing, warn the user and ask whether to proceed with available data or stop.

## Step 2 — Load Template

Read the design document template from:
`{template}`

This defines the required DID sections. Adapt the system-level language to CSCI-level software design.

## Step 3 — Generate Document

Write the document in {document_output_language}, populating each template section:

### Section 1: Scope
- **1.1 Identification**: Identify the CSCI by name, version, and project-unique identifier
- **1.2 System overview**: Summarize the system and this CSCI's role within it
- **1.3 Document overview**: Describe this SDD document's purpose and contents

### Section 2: Referenced documents
- List all project artifacts and external references used

### Section 3: CSCI-wide design decisions

Describe design decisions that apply across the entire CSCI:
- **Architectural patterns**: Extract from Architecture document (e.g., MVC, microservices, event-driven)
- **Technology stack**: Languages, frameworks, libraries, and their versions
- **Behavioral design**: How the CSCI behaves from the user's perspective
- **Database/data design**: How data stores appear to users and external systems
- **Safety, security, privacy**: Approaches to meeting these requirements
- **Other decisions**: Flexibility, availability, maintainability approaches

Each decision should reference the requirement(s) it satisfies.

### Section 4: CSCI architectural design

- **4.1 CSCI components**: Identify all software components (modules, packages, services). Assign project-unique identifiers. Show static relationships (component diagrams). State each component's purpose and allocated requirements
- **4.2 Concept of execution**: Describe dynamic behavior — data flow, control flow, state transitions, timing, concurrency, error handling. Use diagrams where helpful
- **4.3 Interface design**: Document interfaces between components and with external entities. For each interface provide:
  - Data elements with types, sizes, formats, units, ranges
  - Communication methods and protocols
  - Error handling and recovery

### Section 5: CSCI detailed design

For each component identified in Section 4.1, describe:
- Internal structure and sub-components
- Algorithms and processing logic (map from Stories/Epics)
- Internal data structures and data flows
- Constraints and limitations

### Section 6: Requirements traceability
- **6.a**: Map each CSCI component to the requirements it addresses (from SRS or PRD)
- **6.b**: Map each requirement to the components that implement it

### Section 7: Notes
- Glossary of design terms, acronyms, and abbreviations

## Step 4 — Validate

Before presenting to the user, verify:
- All template sections are populated or marked "Not applicable" with justification
- Components have unique identifiers
- Design decisions reference their driving requirements
- Interfaces are described consistently from both sides
- Document is written in {document_output_language}

## Step 5 — Review

Present the complete document to {user_name} for review.
Highlight any design decisions where assumptions were made.
Offer to refine any section based on feedback.

## Step 6 — Save

Write the final document to:
`{output_folder}/planning-artifacts/SDD.md`

Confirm the file was saved and display a summary of:
- Number of components identified
- Number of interfaces documented
- Any sections marked "Not applicable"
