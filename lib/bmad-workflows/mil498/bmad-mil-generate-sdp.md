# bmad-mil-generate-sdp.md
# Generate Software Development Plan (SDP)

This workflow generates a MIL-STD-498 SDP document to outline the development approach and project management artifacts.

## Instructions
1.  **Load Template**: Read the SDP template from `{project-root}/_bmad/bmm/templates/mil498/SDP.md`.
2.  **Gather Context**:
    - Load the **Product Brief** for project vision and objectives.
    - Load the **PRD** for scope and constraints.
    - Identify any **Planning Documents** or schedules.
3.  **Map Plan**:
    - **Section 3 (Project organization and resources)**: Define roles and resources based on the Product Brief.
    - **Section 4 (Software development process)**: Describe the BMAD-METHOD lifecycle used.
    - **Section 5 (Software development activities)**: Detail the tasks, schedules, and milestones.
4.  **Consistency**: Ensure the plan reflects the actual development methodology being followed.
5.  **Output**: Save the generated document to the `{output_folder}/planning-artifacts/` as `SDP.md`.
