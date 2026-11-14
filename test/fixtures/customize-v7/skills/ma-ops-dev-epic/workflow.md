# Epic orchestration

## On Activation

Execute each of these steps in order (`_None._` means skip):

{{ workflow.activation_steps_prepend }}

Treat every entry below as foundational context; `file:` entries are paths or globs under `{project-root}`:

{{ workflow.persistent_facts }}

{{ workflow.activation_steps_append }}

## Waves

Model tiers: {{ workflow.model_tiers }}

Set `{wave_report}` to `{project-root}/_bmad-output/epic-run.md` and append one line per finished story to `{wave_report}`.
Container status comes from `{skill-root}/scripts/container-status.sh`.

## Completion

{{ workflow.on_epic_complete }}
