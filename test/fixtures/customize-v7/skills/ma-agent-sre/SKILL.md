---
name: ma-agent-sre
description: Story 36.4 fixture agent (ma-agent-sre shape). Use when testing the customize.toml contract validator.
---

Run the following command exactly once without changing the current working directory.

Replace `{project-root}` with the nearest folder containing `_bmad/`, from the working directory upward.
Replace `{skill-root}` with the absolute path to this skill's directory.

Render with `{project-root}/_bmad/scripts/render_skill.py --project-root "{project-root}" --skill "{skill-root}"` through the project's Python runner and follow the printed workflow.
