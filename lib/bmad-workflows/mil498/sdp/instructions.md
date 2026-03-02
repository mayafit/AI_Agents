# Generate Software Development Plan (SDP)

> MIL-STD-498 Data Item Description: DI-IPSC-81427

## Objective

Generate a compliant SDP document by extracting project planning, methodology, and management information from existing project artifacts into the MIL-STD-498 SDP template structure.

## Step 1 — Discover Project Artifacts

Search the project for the following artifacts. Communicate in {communication_language}. Inform {user_name} which artifacts were found and which are missing.

| Priority | Artifact | Search Pattern |
|----------|----------|----------------|
| Required | Product Brief | `**/product-brief*.md` |
| Required | PRD | `**/prd.md`, `**/prd-*.md` |
| Recommended | Architecture | `**/architecture.md`, `**/architecture-*.md` |
| Recommended | Project Context | `**/project-context.md` |
| Optional | Sprint Status | `**/sprint-status*.yaml`, `**/sprint-status*.md` |
| Optional | Epics | `**/epics*.md` |

If **required** artifacts are missing, warn the user and ask whether to proceed with available data or stop.

## Step 2 — Load Template

Read the SDP template from:
`{template}`

This defines the required DID sections and content expectations for each paragraph.

## Step 3 — Generate Document

Write the document in {document_output_language}, populating each template section:

### Section 1: Scope
- **1.1 Identification**: Extract project name, version, identifiers from PRD
- **1.2 System overview**: Summarize from Product Brief and PRD
- **1.3 Document overview**: Describe this SDP document's purpose
- **1.4 Relationship to other plans**: Reference any related project plans

### Section 2: Referenced documents
- List all project artifacts and standards used

### Section 3: Overview of required work
- **Requirements and constraints**: From PRD scope and constraints
- **Documentation requirements**: What MIL-STD-498 documents are planned
- **Life cycle position**: Current project phase
- **Acquisition strategy**: From Product Brief
- **Schedule and resource constraints**: From PRD or Sprint Status
- **Other constraints**: Security, methods, standards, interdependencies

### Section 4: Plans for general software development activities
- **4.1 Software development process**: Describe the BMAD-METHOD lifecycle and how it maps to MIL-STD-498 activities
- **4.2 General plans for software development**: High-level approach to requirements analysis, design, implementation, testing
- Map the BMAD workflow (Product Brief → PRD → Architecture → Epics → Stories → Implementation) to MIL-STD-498 activities

### Section 5: Plans for performing detailed software development activities
- **Requirements analysis**: How requirements are gathered and validated (BMAD PRD creation)
- **Software design**: How architecture and detailed design are produced
- **Coding and testing**: Implementation approach, testing strategy
- **Integration**: How components are integrated
- **Qualification testing**: Test planning and execution approach

### Section 6: Schedules and activity network
- Map Epics/Sprint plans to a development schedule if available
- Identify milestones and deliverables

### Section 7: Project organization and resources
- Development team structure from Product Brief
- Tools, environments, and infrastructure from Architecture/Project Context

### Additional sections (as defined in template)
- Populate all remaining template sections based on available project information
- Mark sections "Not applicable" with justification where information is unavailable

## Step 4 — Validate

Before presenting to the user, verify:
- All template sections are populated or marked "Not applicable" with justification
- Development process description accurately reflects the actual methodology
- Schedule information is consistent with available Sprint/Epic data
- Document is written in {document_output_language}

## Step 5 — Review

Present the complete document to {user_name} for review.
Highlight any sections where information was inferred or assumptions were made.
Offer to refine any section based on feedback.

## Step 6 — Save

Write the final document to:
`{output_folder}/planning-artifacts/SDP.md`

Confirm the file was saved and display a summary of:
- Development phases identified
- Key milestones documented
- Any sections marked "Not applicable"
