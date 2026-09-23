# `resolve_customization.py` silently discards an entire customization layer on a parse error, and exits 0

## Summary

When `_bmad/custom/<skill>.toml` (the team/org layer) or `<skill>.user.toml` (the personal layer) fails to parse, `load_toml()` writes a warning to **stderr**, returns `{}`, and resolution continues with **exit status 0**. The consumer receives a well-formed JSON object that looks like a successful resolution, but every customization in that layer has been dropped.

Because the caller is typically an **LLM agent following a skill's activation step**, not a human watching a terminal, the warning is very likely to be unobserved. The agent sees a valid result and proceeds with skill defaults, believing it has honoured the project's customization.

**The failure is silent, the exit code says success, and the resolved output is indistinguishable from a project that simply never customized the skill.**

## Environment

- `bmad-method` **6.9.0** (as installed in `node_modules`; I have not re-checked the code path against `main`, and it is worth confirming the behaviour is unchanged there before triaging)
- `src/scripts/resolve_customization.py`
- Python 3.11+ (`tomllib`)
- Observed on Windows 11; the logic is platform-independent

## Reproduction

Fully self-contained. Creates a skill with a default, a team layer that is valid apart from one duplicated table, and resolves it.

```bash
mkdir -p proj/_bmad/custom proj/skills/demo-skill
cd proj

cat > skills/demo-skill/customize.toml <<'EOF'
[workflow]
name = "demo"
on_complete = "default-action"
EOF

# Team layer: a real customization, plus a duplicated [workflow] table.
# This is what you get when two writers each append their own section.
cat > _bmad/custom/demo-skill.toml <<'EOF'
[workflow]
description = "team override that parses fine"
on_complete = "publish-to-confluence"

[workflow]
on_complete = "added-by-a-second-writer"
EOF

python <path-to>/resolve_customization.py --skill "$(pwd)/skills/demo-skill"
echo "EXIT=$?"
```

### Actual

```
warning: failed to parse .../_bmad/custom/demo-skill.toml: Cannot declare ('workflow',) twice (at line 5, column 10)
{
  "workflow": {
    "name": "demo",
    "on_complete": "default-action"
  }
}
EXIT=0
```

Both team settings are gone — including `description`, which had nothing to do with the malformed part — and `on_complete` has silently reverted to the skill default.

### The `--key` form is worse

This is the form skill activation steps actually use, and it removes the last visible cue that a layer existed at all:

```bash
python <path-to>/resolve_customization.py \
  --skill "$(pwd)/skills/demo-skill" --key workflow.on_complete 2>/dev/null
```

```
{
  "workflow.on_complete": "default-action"
}
EXIT=0
```

A caller that redirects or ignores stderr — which an agent runtime commonly does — receives a clean, plausible, **wrong** answer with a success status.

The same happens for `<skill>.user.toml`; both non-required layers behave identically.

### Expected

A parse error in a customization layer that **exists** should be loud. The file's presence is an explicit statement of intent; failing to honour it is not a neutral outcome. At minimum the exit status should be non-zero so a caller can detect it.

Note the contrast with a **missing** file, where returning `{}` is correct and should not change — "no override" and "a broken override" are different situations and currently produce identical results.

## Root cause

`src/scripts/resolve_customization.py`:

```python
def load_toml(file_path: Path, required: bool = False) -> dict:
    if not file_path.exists():
        if required:
            ...
            sys.exit(1)
        return {}
    try:
        ...
    except tomllib.TOMLDecodeError as error:
        level = "error" if required else "warning"
        sys.stderr.write(f"{level}: failed to parse {file_path}: {error}\n")
        if required:
            sys.exit(1)
        return {}                      # <-- non-required layer degrades silently
    except OSError as error:
        ...
        return {}                      # <-- same for an unreadable file
```

`required=True` is passed only for the skill's own `customize.toml`. Both project layers are non-required:

```python
defaults = load_toml(defaults_path, required=True)
...
team = load_toml(custom_dir / f"{skill_name}.toml")
user = load_toml(custom_dir / f"{skill_name}.user.toml")
```

So `required` currently conflates two independent questions: **"must this file exist?"** and **"may this file be ignored when it is broken?"** For the project layers the intended answer is *no* to the first and, I would argue, also *no* to the second.

The `OSError` branch has the same property: a permissions problem or an I/O error on an existing override is reported at warning level and resolution proceeds.

## Why this matters

Customization is the sanctioned way to adapt an installed skill without editing skill documents. Integrators are actively encouraged to use it, so the layer often carries behaviour a project genuinely depends on.

Three properties combine badly:

1. **TOML forbids duplicate keys and duplicate table headers.** Any two independent writers appending to the same file produce a parse error rather than a merge conflict. `bmad-customize` writes sparse overrides ("only the fields being changed"), so appending is the natural pattern.
2. **The consumer is usually an agent, not a person.** stderr warnings are frequently discarded, and exit 0 is treated as success.
3. **The result is plausible.** Skill defaults are valid values, so nothing downstream looks wrong. A dropped customization can persist unnoticed for a long time.

Concretely: a project sets `on_complete` in the team layer to run a required post-workflow step. Later, anything else adds a second `[workflow]` section to that file. From then on the step silently never runs, the resolver reports success, and the workflow tells the user it completed normally.

Downstream packages cannot work around this. `_bmad/scripts/` is wiped and recopied from source on every install and update (`tools/installer/core/installer.js`, `_installSharedScripts` — `fs.remove(paths.scriptsDir)` followed by a copy), so any local patch to the resolver is reverted by the next install. **A fix in `bmad-method` is the only durable remedy.**

## Suggested fix

The smallest change that resolves it — separate "may be absent" from "may be malformed":

```python
def load_toml(file_path: Path, required: bool = False,
              strict_parse: bool = True) -> dict:
    if not file_path.exists():
        if required:
            sys.stderr.write(f"error: required customization file not found: {file_path}\n")
            sys.exit(1)
        return {}                      # absent is still fine
    try:
        ...
    except (tomllib.TOMLDecodeError, OSError) as error:
        # The file exists, so it was meant to apply. Refusing to guess.
        sys.stderr.write(f"error: failed to load {file_path}: {error}\n")
        if required or strict_parse:
            sys.exit(1)
        return {}
```

A missing layer stays free; an existing-but-broken layer becomes fatal. That matches the existing fail-loud posture elsewhere in the toolchain and makes the condition detectable by every consumer, agent or human.

If a hard failure is considered too breaking for a patch release, useful alternatives in descending order of value:

1. **Non-zero exit, output still produced** — consumers can detect it without losing the partial result.
2. **Report it in the payload**, e.g. `{"_errors": [{"file": ..., "error": ...}], ...}`, so an agent reading only stdout can see that a layer failed.
3. **A `--strict` flag**, with skill activation steps opting in. Weakest option: it leaves existing callers silently broken by default.

Whichever is chosen, it would help to make the two cases textually distinct in the message — "layer not present" and "layer present but unusable" currently produce the same resolved output.

## Possibly related

If several writers are expected to contribute to one team file, it may be worth documenting an ownership convention (or supporting an include/fragment directory), since TOML gives no way for two appenders to coexist. That is a separate enhancement and not part of this bug; the silent-discard behaviour is a problem regardless of how the file came to be malformed.

---

*Reported from an integration that generates a team-layer override during install. Every claim above was verified against the installed 6.9.0 source and the reproduction was run as shown.*
