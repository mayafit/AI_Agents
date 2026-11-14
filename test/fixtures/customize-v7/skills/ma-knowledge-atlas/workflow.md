# Knowledge Atlas

{{ workflow.activation_steps_prepend }}

Facts:

{{ workflow.persistent_facts }}

{{ workflow.activation_steps_append }}

Write the site to `{{ workflow.atlas_output }}`, then read `{{ rendered("references/sources.md") }}`.

{{ workflow.on_complete }}
