# BMAD Integration & Offline Bundling

> **Shard** of the [PRD index](../../prd.md). Content is verbatim from the
> pre-split document; the index carries the front matter, registers and reading order.
>
> Capabilities F3 (BMAD-METHOD Integration, incl. Bundled Installation) and
> F4 (BMAD Extension Architecture). Architecture: P2-3, P2-6.

---

## Functional Requirements

### BMAD-METHOD Integration

- FR8: Engineers can install the BMAD-METHOD framework alongside skills in a single workflow
- FR9: Engineers can update an existing BMAD installation to a newer version
- FR10: Engineers can apply organization-specific customizations to BMAD that persist across updates
- FR11: Engineers can register MIL-STD-498 workflows into an existing BMAD installation
- FR12: Engineers can trigger BMAD recompile after customization changes

### Bundled Installation

- FR74: The ma-agents npm package bundles bmad-method v6.3.0 as a direct dependency — no `npx` download at install time
- FR75: The ma-agents npm package bundles pre-cloned BMAD external modules (bmb, cis, tea, gds, wds) under `lib/bmad-cache/` — no git clone at install time
- FR76: Before invoking bmad-method install, the installer pre-populates `~/.bmad/cache/external-modules/` from the bundled cache so bmad-method finds modules locally
- FR123: The ma-agents installer collects all BMAD-relevant configuration during its own interactive wizard — selected platforms/agents, user name, project path, module selections — and passes them to bmad-method as explicit CLI flags (`--tools`, `--modules`, `--directory`, `--user-name`, `--communication-language`, `--document-output-language`, `--output-folder`, `--custom-content`), replacing the current silent install approach. For the `--modules` value, the default install set is **every non-retired module** from the bundled cache manifest (`lib/bmad-cache/cache-manifest.json`); the optional-value `--bmad-modules` CLI flag overrides this — bare (no value) opens a multiselect prompt; with a CSV (e.g. `--bmad-modules tea,bmb`) it installs exactly those. `bmm` is force-included in every path because the BMad core agents live there. Experimental-channel modules (currently `automator`, `type: experimental`) are filtered out of the bundle unconditionally; all stable `type: bmad-org` modules — including `wds` — are included (as of the v6.8.0 integration, Epic 27; `wds` had been retired upstream at 6.3.0 and returned as an active module at 6.8.0).
- FR124: bmad-method performs its full configuration using the explicit parameters passed by ma-agents — the `--yes` flag suppresses prompts for parameters already supplied via flags, but does not skip configuration steps
- FR125: When bmad-method introduces new CLI parameters that ma-agents has not mapped, the `--yes` flag causes bmad-method to apply its own sensible defaults for those parameters — ensuring no configuration is missed even as bmad-method evolves
- FR126: The user experiences a single unified installation wizard — bmad-method runs non-interactively with full explicit parameters, with no separate BMAD interactive prompt appearing during the ma-agents installation flow
- FR127: In non-interactive mode (`--yes --force`), ma-agents uses its own defaults for all parameters and passes them to bmad-method via the same explicit flag mechanism — identical code path as interactive mode with pre-determined answers, ensuring CI/CD installations produce identical BMAD configuration as interactive ones

### BMAD Extension Architecture

- FR104: The BMAD extension module is restructured with a proper BMAD 6.2.0 `module.yaml` containing `code` (module identifier), `description`, and `module_version` fields — replacing the legacy `extends-module: bmm` pattern in the current `lib/bmad-extension/module.yaml`
- FR105: A module setup skill is created that writes module configuration to `config.yaml` (shared, git-committed), `config.user.yaml` (personal, gitignored), and `module-help.csv` (capability registry) — following the BMAD 6.2.0 anti-zombie pattern where re-running setup removes all existing entries for the module's code before writing new values
- FR106: The dual-layer agent definition pattern — base config in `lib/bmad-customizations/bmm-{agent}.customize.yaml` + extended config in `lib/bmad-extension/agents/bmm-{agent}.customize.yaml` — is consolidated into a single authoritative agent skill folder per agent under the module's `agents/` directory

## Quality Attributes (Non-Functional Requirements)

### BMAD Extension Compatibility

- NFR16: The BMAD extension module must survive `npx bmad-method install --action update` without losing functionality — extensions maintain independent identity and persist across BMAD updates
- NFR17: All BMAD-facing changes must use official BMAD Builder extension APIs only — `module.yaml` (module identity), `module-help.csv` (capability registration), setup skill (config management), Agent Builder (agent creation), Workflow Builder (workflow creation), skill folder standard (SKILL.md + prompts/ + resources/ + scripts/) — zero bmad-method core modifications
- NFR18: OpenCode JSON instruction injection must not corrupt existing `opencode.json` configuration — JSON config merging must be additive-only
- NFR19: Bug and sprint extension workflows must function identically whether invoked via BMAD agent menu or direct slash command. All sprint workflows must read/write the unified `sprint-status.yaml` file — no workflow may create or depend on separate `backlog.yaml` or per-sprint YAML files

### Bundled Installation

- NFR20: The bundled BMAD cache must be version-pinned (v6.3.0 current) — upgrading the bundled version is a deliberate, tested release operation, not an automatic fetch
- NFR21: The bundled installation produces deterministic `_bmad/` output from the included cache. The resulting directory structure is reproducible given the same ma-agents package version.
