# Story: Custom marketplace source — support the BMAD registry-index format

**Status:** in-progress
**Type:** enhancement (follow-on to Epic 30 / F25; Epic 30 is merged and stays as history — this is a NEW standalone story per correct-course discipline)
**Created:** 2026-07-12

## Context / why

Epic 30 shipped opt-in custom marketplace sources supporting two shapes: **discovery** (`.claude-plugin/marketplace.json` at the source root) and **direct** (no marketplace.json → treat the whole repo as one module). A field install pointed `--bmad-custom-source` at BMAD's real plugin registry `https://github.com/bmad-code-org/bmad-plugins-marketplace` and failed: that repo has **no `.claude-plugin/marketplace.json`** — it uses a third, higher-level **registry-index** schema (`registry/official.yaml`, `registry/community-index.yaml`, `registry/community/*.yaml`, `registry/registry-schema.yaml`, `categories.yaml`). Our code fell to direct-mode, offered an unselectable choice, and the FR238 guard correctly aborted at staging (nothing broke). Users expect the official registry to work.

## Registry-index format (ground truth, verified against the live repo 2026-07-12)

- `registry/official.yaml` → top-level `modules:` (a YAML list). Entries are `type: bmad-org`, `built_in: true`, `trust_tier: bmad-certified`.
- `registry/community-index.yaml` → `modules:` list (auto-generated from `registry/community/*.yaml`). Entries are `type: community`, carry `version`, `approved_tag`, **`approved_sha`**, `trust_tier: unverified`.
- Each entry conforms to `registry/registry-schema.yaml`. Relevant fields:
  - `name` (req), `display_name` (req), `code` (opt), `description` (req), **`repository`** (req — full GitHub URL, the pointer), **`module_definition`** (opt — path to `module.yaml` within that repo, e.g. `src/skills/foo/module.yaml`), `npm_package` (opt), `author`/`license` (req), `default_selected` (opt), `type` (req: bmad-org|community|experimental), `category`/`subcategory` (req), `keywords` (opt), and (community) `version`/`approved_tag`/`approved_sha`/`trust_tier`.

Installing a registry entry is **two-level**: clone `repository` (pin community entries to `approved_sha`/`approved_tag`) → resolve the module at `module_definition` (fallback: repo root / PluginResolver) → stage + install that module.

## Acceptance criteria

1. **Enumerate — new `registry` mode.** `enumerateCustomSource()` gains a third mode. Detection order: (a) `.claude-plugin/marketplace.json` present → `discovery` (unchanged); (b) else a `registry/` dir with `official.yaml` and/or `community-index.yaml` (or a top-level `categories.yaml` + `registry-schema.yaml`) → **`registry`**; (c) else `direct` (unchanged). Parse the official + community index YAMLs (js-yaml) into the SAME plugin-choice object shape 6a/6b already consume (`code`, `name`/`display_name`, `description`, `type`, `trustTier`, plus new: `repository`, `moduleDefinition`, `approvedSha`, `approvedTag`, `version`). Merge official + community; de-dupe by `name`. Do NOT auto-select anything.
2. **Multiselect UX.** The wizard shows registry entries with `display_name` + trust tier (bmad-certified vs unverified) + category. The per-entry **NFR71 warning** must make the unverified/community trust tier explicit. Nothing is default-selected.
3. **Stage + install (two-level).** For each selected registry entry: clone `repository` (community → pin `approved_sha`, else `approved_tag`, else default branch; bmad-org → default branch or `approved_tag` if present) using bmad-method's existing clone path / ambient git creds (GIT_TERMINAL_PROMPT=0, no token handling — FR241); locate the module at `module_definition` within the clone (fallback to PluginResolver at the repo root if `module_definition` absent); stage it via the SAME staging primitive 30.6b uses; enforce the FR238 non-empty + unique-skill-leaf guard. Reuse `lib/bmad.js` staging/install; NO hand-rolled git or child-process beyond what 30.6b established.
4. **Fail clean.** An unreachable registry, a malformed index, an entry whose `repository` is unreachable, or a clone/resolve that yields zero modules → a clear human-readable abort (never a raw stack), and never a partial install (FR238). Offline: registry entries require network → fail with a clear "custom registry sources require network access; unavailable offline" message, not a hang.
5. **Persistence (compose with 30.7).** A registry-mode selection persists like discovery/direct in `.ma-agents.json` (`customMarketplace`), recording the registry source URL + selected entry `name`s + each entry's `approved_sha` (the real SHA pin the registry provides). Re-enumerate/reconcile on update as 30.7 does.
6. **Regression.** Discovery mode (`.claude-plugin/marketplace.json`) and direct mode are UNCHANGED — existing 30.6a/6b/7 tests stay green. The Epic-30 closed allowlist must remain disjoint (registry entries are opt-in; the allowlist never applies here — FR243 invariant holds).
7. **Also fix the original UX defect:** when `direct` mode resolves to zero installable modules, the abort message should name the likely cause ("no `.claude-plugin/marketplace.json` and no `module.yaml`/skills at the root; if this is a registry index, it is now supported — re-run and it will be detected as `registry`").

## Tests (local fixtures only — NO network, use local bare-repo/dir fixtures + hard timeouts + mocked stdin)

- `enumerateCustomSource` returns `registry` mode for a fixture repo with `registry/official.yaml` + `community-index.yaml`; parses N entries with `repository`/`moduleDefinition`/`approvedSha`.
- Detection precedence: a fixture with BOTH `.claude-plugin/marketplace.json` and `registry/` → `discovery` wins.
- Two-level stage: a local fixture where the registry entry's `repository` is a LOCAL bare git repo containing a `module.yaml` at `module_definition` → stages the module; FR238 non-empty/unique-leaf holds.
- Fail-clean: malformed index YAML; entry with unreachable `repository`; zero-module resolve → clear `CustomMarketplaceError`, no staging.
- Persistence round-trip records `approvedSha`.
- Regression: existing custom-marketplace-* suites still green.

## Out of scope
- Category/subcategory filtering UI (metadata may be surfaced but no filter UX required).
- npm_package-based install (registry entries prefer git `repository`; npm path is a future enhancement).
- Multi-registry / multi-source (v1 = one source; schema stays extensible per P5-8).

## DoD
All ACs met; new + existing custom-marketplace tests green (run per-file directly — bare `npm test` halts at CRLF pos-13); `npm run build:plugin` drift-clean; self-review (code-review + edge-case-hunter) clean; conventional commits; PR to main (never merged by the agent).
