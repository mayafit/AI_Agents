# bmad-mil-generate-sss.md
# Generate System/Subsystem Specification (SSS)

This workflow generates a MIL-STD-498 SSS document for high-level system requirements.

## Instructions
1.  **Load Template**: Read the SSS template from `{project-root}/_bmad/bmm/templates/mil498/SSS.md`.
2.  **Gather Context**:
    - Load the **Product Brief** for high-level system identification and goals.
    - Load the **PRD** for primary system requirements.
3.  **Map Requirements**:
    - **Section 3.2 (System capability requirements)**: Map high-level PRD features to system capabilities.
    - **Section 3.3 (System external interface requirements)**: Map top-level interfaces.
    - **Section 3.4 (System internal interface requirements)**: Map interfaces between major subsystems.
4.  **High-Level Focus**: Keep requirements at the system/subsystem level, avoiding low-level software details.
5.  **Output**: Save the generated document to the `{output_folder}/planning-artifacts/` as `SSS.md`.
