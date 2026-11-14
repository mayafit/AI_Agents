# Atlassian bind

{{ workflow.activation_steps_prepend }}

Facts:

{{ workflow.persistent_facts }}

{{ workflow.activation_steps_append }}

## Bind

For each target in `{skill-root}/references/bind-targets.toml`, bind `{target_file}` to `{project-root}/_bmad/custom/<skill>.toml` and write each owned key between its markers.

{{ workflow.on_complete }}
