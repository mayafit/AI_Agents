# bmad-mil-generate-sdd.md
# Generate Software Design Description (SDD)

This workflow generates a MIL-STD-498 SDD document (using the SSDD template) based on the system design and implementation details.

## Instructions
1.  **Load Template**: Read the SSDD template from `{project-root}/_bmad/bmm/templates/mil498/SSDD.md`.
2.  **Gather Context**:
    - Load the **Architecture** document for high-level design and component structure.
    - Load **UX Designs** for detailed user interface design.
    - Load **Epics and Stories** to understand detailed behavior and logic.
    - Load the **PRD** for design constraints.
3.  **Map Design**:
    - **Section 3 (CSCI-wide design decisions)**: Describe the architectural patterns and technology stack.
    - **Section 4 (CSCI architectural design)**: Define components, their interfaces, and data flow.
    - **Section 5 (CSCI detailed design)**: Map Stories to detailed logic and internal data structures.
4.  **Consistency**: Ensure the design matches the requirements specified in the SRS.
5.  **Output**: Save the generated document to the `{output_folder}/planning-artifacts/` as `SDD.md`.
