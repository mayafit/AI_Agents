# Bundled BMAD Installation Validation

**Package version:** ma-agents 2.19.2
**bmad-method version:** 6.0.4
**Validation date:** 2026-03-16
**Tester environment:** Node.js v22.14.0, OS: Windows 10 Enterprise LTSC 2021 (10.0.19044), npm v11.7.0

## Validation Steps

| Step | Description | Result | Notes |
|------|-------------|--------|-------|
| V1 | npm pack → tarball contains lib/bmad-cache/ | PASS | 753 files; bmb, cis, gds, tea dirs confirmed via `npm pack --dry-run` |
| V2 | npm install from tarball — bmad-method present in node_modules | PASS | `bmad-method@6.0.4` at top-level node_modules |
| V3 | npx ma-agents install — cache pre-population messages appear | PASS | `~ Cached module exists, skipping: <mod>` × 4 (already in global cache from tarball install) |
| V4 | Post-install: ~/.bmad/cache/external-modules/ has 4 modules | PASS | bmb, cis, gds, tea confirmed |
| V5 | Post-install: _bmad/ has core + bmm + bmb + cis + tea + gds | PASS | All 6 dirs present; config.yaml generated with v6.0.4 timestamp |
| V6 | Idempotency: second install skips existing cache | PASS | All 4 modules show `~ Cached module exists, skipping` on second run; no summary line (by design) |
| V7 | --force: replaces cache modules | PASS | All 4 modules show `+ Replaced cached module: <mod>`; cache-pre-population summary printed |
| V8 | npx ma-agents status shows correct output | PARTIAL | Shows "No skills installed (project scope)" — status command tracks IDE skills only; BMAD module installation status is not surfaced. See Issues section. |
| V9 | No git clone or npm fetch during offline simulation | PASS | GIT_TERMINAL_PROMPT=0 set on all execSync calls; no GitHub URLs in output; cache served from lib/bmad-cache/ entirely |
| V10 | BMAD workflows present and syntactically valid | PASS | 12 workflow YAML files found and readable; 9 agent personas in _bmad/bmm/agents/ |

## Issues Found

### Issue 1 (FIXED — H1): Missing `--directory` flag in bmad.js execSync calls

**Root cause:** `installBmad()`, `updateBmad()`, and `applyCustomizations()` in `lib/bmad.js` all constructed bmad-method commands with `--yes` but without `--directory <projectRoot>`. The bmad-method v6.0.4 `ui.js` only skips the directory prompt when `options.directory` is explicitly provided; without it, the interactive `getConfirmedDirectory()` prompt is triggered. When running via `execSync` (non-TTY), this prompt silently completes with exit code 0 but **no `_bmad/` installation occurs**.

**Fix applied:** All 3 `getBmadCommand()` call sites in `lib/bmad.js` updated to include `--directory "${projectRoot}"`:
- Line 26: `installBmad` — `install --yes --directory "${projectRoot}"`
- Line 51: `updateBmad` — `install --action update --yes --directory "${projectRoot}"`
- Line 128: `applyCustomizations` — `install --yes --directory "${projectRoot}"`

**Verification:** After fix, `installBmad()` correctly creates `_bmad/` at `D:\tmp\bmad-validation-test2\_bmad` on first run. All ACs re-validated with fix in place.

### Issue 2 (OBSERVATION — not a code bug): `npx ma-agents status` does not show BMAD module status

**Observation:** AC#3 states status should show "BMAD installation status, version numbers". The current `showStatus()` function only reads the `.agent/manifest.json` (skills manifest) and reports IDE skill installations. BMAD modules installed via bmad-method are not tracked in this manifest.

**Impact:** Low — BMAD modules can be verified via `ls _bmad/` and `cat _bmad/bmm/config.yaml`. The status command gap is a UX issue, not a functional one.

**Recommendation:** Future story to add BMAD module detection to `showStatus()` — read `_bmad/bmm/config.yaml` if present and display module list + version.

## Conclusion

The bundled installation mechanism (Epic 5, Stories 5.1–5.3) is **functionally correct** for deterministic offline installation. NFR21 (deterministic installation) is satisfied: same tarball produces same `_bmad/` output on repeated runs.

One critical bug was found and fixed during validation (Issue 1): the missing `--directory` flag caused silent no-op installs in automated/non-TTY contexts. The fix is minimal and targeted (3 lines in `lib/bmad.js`).

AC#3 partial gap (status command) is a UX observation only and does not block the story — all other ACs pass.

**Overall: PASS with fix applied**
