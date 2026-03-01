# bmad-mil-generate-ocd.md
# Generate Operational Concept Description (OCD)

This workflow generates a MIL-STD-498 OCD document to describe the system from a user's perspective.

## Instructions
1.  **Load Template**: Read the OCD template from `{project-root}/_bmad/bmm/templates/mil498/OCD.md`.
2.  **Gather Context**:
    - Load the **PRD** for user needs and business goals.
    - Load the **Architecture** for system context.
    - Load **UX Designs** for user workflows and interactions.
3.  **Map Concept**:
    - **Section 3 (Current system or situation)**: Describe the problem being solved (from PRD).
    - **Section 4 (Nature of proposed changes)**: Overview of the solution.
    - **Section 5 (Operational concept)**: Describe user roles, operational scenarios, and key workflows (from UX/Stories).
4.  **Clarity**: Ensure the document is written in a way that is easily understood by system users and stakeholders.
5.  **Output**: Save the generated document to the `{output_folder}/planning-artifacts/` as `OCD.md`.
