# bmad-mil-generate-srs.md
# Generate Software Requirements Specification (SRS)

This workflow generates a MIL-STD-498 SRS document by extracting requirements from BMAD-METHOD records.

## Instructions
1.  **Load Template**: Read the SRS template from `{project-root}/_bmad/bmm/templates/mil498/SRS.md`.
2.  **Gather Context**:
    - Load the **PRD** to identify functional and non-functional requirements.
    - Load the **Architecture** document to understand system boundaries and external interfaces.
    - Load **UX Designs** to define user interface requirements.
    - Load **Epics** to group related requirements into capabilities (Section 3.2).
3.  **Map Requirements**:
    - **Section 3.1 (States and Modes)**: Identify any operational modes from the PRD/Architecture.
    - **Section 3.2 (CSCI Capability Requirements)**: Map Epics and leur related requirements to this section.
    - **Section 3.3 (External Interface Requirements)**: Map Architecture interface definitions here.
    - **Section 3.10 (Computer Resource Requirements)**: Extract hardware/software constraints from the Architecture document.
4.  **Traceability**: Ensure each requirement has a unique CID and is traced to the original PRD entry.
5.  **Output**: Save the generated document to the `{output_folder}/planning-artifacts/` as `SRS.md`.
