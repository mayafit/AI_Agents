# Generate Operational Concept Description (OCD)

> MIL-STD-498 Data Item Description: DI-IPSC-81430

## Objective

Generate a compliant OCD document by describing the system from the user's and stakeholder's perspective, extracting operational concepts from existing project artifacts into the MIL-STD-498 OCD template structure.

## Step 1 — Discover Project Artifacts

Search the project for the following artifacts. Communicate in {communication_language}. Inform {user_name} which artifacts were found and which are missing.

| Priority | Artifact | Search Pattern |
|----------|----------|----------------|
| Required | PRD | `**/prd.md`, `**/prd-*.md` |
| Recommended | Architecture | `**/architecture.md`, `**/architecture-*.md` |
| Recommended | UX Designs | `**/ux-design*.md`, `**/ux-*.md` |
| Optional | Product Brief | `**/product-brief*.md` |
| Optional | Epics & Stories | `**/epics*.md`, `**/stories/*.md` |

If the **PRD** is missing, warn the user and ask whether to proceed with available data or stop.

## Step 2 — Load Template

Read the OCD template from:
`{template}`

This defines the required DID sections and content expectations for each paragraph.

## Step 3 — Generate Document

Write the document in {document_output_language}, populating each template section. The OCD should be written in language accessible to users and stakeholders, minimizing technical jargon.

### Section 1: Scope
- **1.1 Identification**: Extract system name, version, identifiers from PRD
- **1.2 System overview**: Summarize the system purpose from the user's perspective
- **1.3 Document overview**: Describe this OCD document's purpose and contents

### Section 2: Referenced documents
- List all project artifacts used as input sources

### Section 3: Current system or situation
- **3.1 Background, objectives, and scope**: Describe the problem domain and business objectives from the PRD
- **3.2 Operational policies and constraints**: Current business rules and constraints
- **3.3 Description of current system or situation**: How things work today — existing workflows, pain points, limitations. Include:
  - Operational environment
  - Major components and interconnections
  - Interfaces to external systems
  - User roles and their current interactions
- **3.4 Users or involved personnel**: Identify all user types and stakeholders from PRD/UX
- **3.5 Support concept**: Current support and maintenance approach (if applicable)

### Section 4: Justification for and nature of changes
- **4.1 Justification for changes**: Why the new system is needed — business drivers from PRD
- **4.2 Description of needed changes**: What must change to meet objectives
- **4.3 Priorities among the changes**: Rank changes by business importance

### Section 5: Concept for the proposed system
- **5.1 Background, objectives, and scope**: Vision for the new system from Product Brief/PRD
- **5.2 Operational policies and constraints**: New policies and constraints
- **5.3 Description of the proposed system**: How the new system will work. For each operational scenario:
  - User roles involved
  - Step-by-step workflow
  - System behavior and responses
  - Extract scenarios from UX Designs and Stories
- **5.4 Users or involved personnel**: How user roles change with the new system
- **5.5 Support concept**: Planned support and maintenance approach

### Section 6: Operational scenarios
- Document key end-to-end scenarios from UX Designs and Epics
- Each scenario should describe: trigger, actors, sequence of actions, expected outcomes
- Include both normal operation and exception/error scenarios

### Section 7: Notes
- Glossary, acronyms, and background information

## Step 4 — Validate

Before presenting to the user, verify:
- All template sections are populated or marked "Not applicable" with justification
- Document is written from the user/stakeholder perspective, not the developer perspective
- Operational scenarios are complete and realistic
- Document is written in {document_output_language}

## Step 5 — Review

Present the complete document to {user_name} for review.
Highlight any sections where information was inferred or assumptions were made.
Offer to refine any section based on feedback.

## Step 6 — Save

Write the final document to:
`{output_folder}/planning-artifacts/OCD.md`

Confirm the file was saved and display a summary of:
- Number of user roles identified
- Number of operational scenarios documented
- Any sections marked "Not applicable"
