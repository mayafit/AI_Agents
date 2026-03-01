# bmad-mil-generate-std.md
# Generate Software Test Description (STD)

This workflow generates a MIL-STD-498 STD document to define the test cases and procedures for software qualification.

## Instructions
1.  **Load Template**: Read the STD template from `{project-root}/_bmad/bmm/templates/mil498/STD.md`.
2.  **Gather Context**:
    - Load the **Architecture** for test environment details.
    - Load **Epics and Stories** to identify test objectives and acceptance criteria.
    - Load the **SRS** to link test cases to requirements (Traceability).
3.  **Map Tests**:
    - **Section 3 (Test preparations)**: Describe hardware/software needed for testing (from Architecture).
    - **Section 4 (Test descriptions)**: Map Story acceptance criteria to specific test cases and procedures.
    - **Section 5 (Requirements traceability)**: Link each test case to one or more SRS requirements.
4.  **Verification**: Ensure all requirements in the SRS have at least one test case.
5.  **Output**: Save the generated document to the `{output_folder}/planning-artifacts/` as `STD.md`.
