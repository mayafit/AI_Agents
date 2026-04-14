# Test Fixtures — Epic 21 End-to-End Installer Harness

This directory holds the fixtures used by the Epic 21 Story 21.9 end-to-end installer test. They give the harness a stable, byte-for-byte reference point for what `npx ma-agents install` produces for each profile.

## Layout

- `empty-project/` — canonical seed project (README + minimal package.json). Copied to a scratch tmpdir by the harness before each install run. **Do not edit casually.** Changes here affect generated output and must be paired with baseline regeneration.
- `standard-profile-baseline/` — expected byte-for-byte output of `npx ma-agents install --yes` (standard profile) run against `empty-project/`. Populated by Story 21.9 via the regeneration procedure below.
- `onprem-profile-baseline/` — same, but with `"profile": "on-prem"` persisted in `.ma-agents.json` before install. Populated by Story 21.9.

## When to regenerate

Regenerate the baselines **only** when the installer or a template has intentionally changed. Examples:
- Story 21.2 landing changes the universal instruction block content → regenerate both baselines.
- Story 21.6 landing adds on-prem content → regenerate `onprem-profile-baseline/`.
- Story 21.3 landing adds `.roomodes` → both baselines.
- Story 21.11 landing does NOT require baseline changes (uninstall is a separate test).

**A regression is when the baselines diverge from installer output unintentionally.** Never regenerate to "make the test pass" — diagnose the diff first.

## Regeneration procedure

From a clean repo checkout:

```bash
# 1. Copy the seed to a scratch tmpdir
rm -rf /tmp/ma-agents-fixture-regen
mkdir -p /tmp/ma-agents-fixture-regen
cp -R test/fixtures/empty-project/* /tmp/ma-agents-fixture-regen/

# 2. Standard profile install
cd /tmp/ma-agents-fixture-regen
node <repo>/bin/cli.js install --yes
# (no --profile flag exists per P3-3 Alternatives Considered; standard is the --yes default)

# 3. Copy generated output back to the repo
rm -rf <repo>/test/fixtures/standard-profile-baseline/*
cp -R /tmp/ma-agents-fixture-regen/* <repo>/test/fixtures/standard-profile-baseline/

# 4. Clean + reseed for on-prem
rm -rf /tmp/ma-agents-fixture-regen
mkdir -p /tmp/ma-agents-fixture-regen
cp -R <repo>/test/fixtures/empty-project/* /tmp/ma-agents-fixture-regen/
# Pre-seed .ma-agents.json with profile=on-prem so --yes honors it (no CLI flag)
echo '{"manifestVersion":"1.2.0","profile":"on-prem","skills":{}}' > /tmp/ma-agents-fixture-regen/.ma-agents.json

# 5. On-prem install
cd /tmp/ma-agents-fixture-regen
node <repo>/bin/cli.js install --yes

# 6. Copy back
rm -rf <repo>/test/fixtures/onprem-profile-baseline/*
cp -R /tmp/ma-agents-fixture-regen/* <repo>/test/fixtures/onprem-profile-baseline/

# 7. Review the diff
cd <repo>
git diff --stat test/fixtures/
git add test/fixtures/
# Commit only after human review — never blindly regenerate
```

## What's excluded from baselines

The harness must ignore these when diffing (they're volatile or environment-specific):
- Timestamps in log files (if any are written — none expected today)
- The `backup-<ISO-timestamp>` files produced by Story 21.2 AC #8 upgrade-safety and Story 21.10/21.11 backup steps (not generated on clean install, but listed here for completeness)
- The `roomodesOverwriteLog` field's `date` values in `.ma-agents.json` (Story 21.3 AC #10 — the field is deterministic in shape but `date` will differ across runs; normalize to a fixed placeholder before diff)
- The `profileHistory` field's `date` values (Story 21.10 AC #11 — same treatment)

The harness implementation (Story 21.9 Task 5.2) is responsible for this normalization. This scaffolding PR does not implement it.

## Relationship to Story 21.9

See `_bmad-output/implementation-artifacts/21-9-tests-validation.md` ACs #5 and #6 (added 2026-04-14 in corrective-plan step 3). This scaffolding closes the "nothing concrete to build against" gap flagged in adversarial-review Finding #18.
