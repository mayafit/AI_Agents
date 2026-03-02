# Generate System/Subsystem Design Description (SSDD)

> MIL-STD-498 Data Item Description: DI-IPSC-81432

## Objective

Generate a compliant SSDD document by extracting and organizing system architectural design decisions from existing project artifacts into the MIL-STD-498 SSDD template structure. The SSDD describes the system-level design — how the system is organized into components (HWCIs, CSCIs, and manual operations) and how they interact.

## Step 1 — Discover Project Artifacts

Search the project for the following artifacts. Communicate in {communication_language}. Inform {user_name} which artifacts were found and which are missing.

| Priority | Artifact | Search Pattern |
|----------|----------|----------------|
| Required | PRD | `**/prd.md`, `**/prd-*.md` |
| Required | Architecture | `**/architecture.md`, `**/architecture-*.md` |
| Recommended | Product Brief | `**/product-brief*.md` |
| Recommended | SSS | `**/SSS.md` |
| Optional | UX Designs | `**/ux-design*.md`, `**/ux-*.md` |
| Optional | Epics | `**/epics*.md`, `**/epic-*.md` |
| Optional | Any client documentation | Ask {user_name} if there are additional documents to consider |

If **required** artifacts are missing, warn the user and ask whether to proceed with available data or stop.

## Step 2 — Load Template

Read the SSDD template from:
`{template}`

This defines the required DID sections and content expectations for each paragraph.

## Step 3 — Generate Document

Write the document in {document_output_language}, populating each template section:

### Section 1: Scope
- **1.1 Identification**: Extract system name, version, and project-unique identifiers from PRD/Product Brief
- **1.2 System overview**: Summarize system purpose, history, stakeholders, and operating sites from Product Brief and PRD
- **1.3 Document overview**: Describe this SSDD document's purpose, contents, and any security/privacy considerations

### Section 2: Referenced documents
- List all project artifacts, standards, and external references used as inputs

### Section 3: System-wide design decisions

Document design decisions that apply across the entire system. For each decision, reference the requirement(s) it satisfies:

- **a. Input/output design**: System inputs, outputs, and user/external interfaces. Describe what the system accepts and produces from the Architecture document
- **b. Behavioral design**: System behavior in response to inputs and conditions — actions, response times, performance characteristics, algorithms, handling of invalid inputs. Extract from PRD and Architecture
- **c. Database/data design**: How databases and data files appear to users. Data models and storage approaches from Architecture
- **d. Safety, security, privacy**: Selected approaches to meeting these requirements from PRD
- **e. Hardware design choices**: Physical characteristics if applicable (for hardware-software systems)
- **f. Other system-wide decisions**: Flexibility, availability, maintainability approaches. Technology stack selections and their rationale from Architecture

### Section 4: System architectural design

- **4.1 System components**:
  - Identify all system components (CSCIs, HWCIs, manual operations) from the Architecture document
  - Assign project-unique identifiers to each component
  - Show static relationships using component/block diagrams
  - State each component's purpose and the system requirements allocated to it
  - Identify each component's development status (new, reuse, reengineer)
  - For computer systems: describe hardware resources (processors, memory, I/O, storage, networking) with specifications

- **4.2 Concept of execution**:
  - Describe dynamic relationships between components from Architecture
  - Include: execution flow, data flow, state transitions, timing/sequencing, priorities, interrupt handling, concurrency, dynamic allocation
  - Use sequence diagrams or flow diagrams where helpful

- **4.3 Interface design**:
  - **4.3.1 Interface identification and diagrams**: List all interfaces with unique identifiers, identify fixed vs. developing interfaces, provide interface diagrams
  - **4.3.x (per interface)**: For each interface, document:
    - Interfacing entities and their characteristics
    - Data elements: names, types, sizes, formats, units, ranges, accuracy, constraints
    - Data assemblies: records, messages, files, displays with structure and relationships
    - Communication methods: links, message formats, flow control, data rates, routing
    - Protocols: layers, packeting, error control, synchronization
    - Physical compatibility considerations

### Section 5: Requirements traceability
- **5.a**: Map each system component to the system requirements it satisfies
- **5.b**: Map each system requirement to the components that address it

### Section 6: Notes
- Glossary of terms, acronyms, and abbreviations
- Background information to aid understanding

## Step 4 — Validate

Before presenting to the user, verify:
- All template sections are populated or marked "Not applicable" with justification
- Every component has a unique identifier
- System-wide design decisions reference their driving requirements
- Interface descriptions are complete and consistent from both sides
- Requirements traceability covers all system requirements
- Document is written in {document_output_language}

## Step 5 — Review

Present the complete document to {user_name} for review.
Highlight any sections where information was inferred or assumptions were made.
Specifically ask about:
- Are all system components identified?
- Are the interface descriptions accurate?
- Are there additional design decisions not captured in the Architecture?

Offer to refine any section based on feedback.

## Step 6 — Save

Write the final document to:
`{output_folder}/planning-artifacts/SSDD.md`

Confirm the file was saved and display a summary of:
- Number of system components identified
- Number of interfaces documented
- Number of system-wide design decisions captured
- Any sections marked "Not applicable"
