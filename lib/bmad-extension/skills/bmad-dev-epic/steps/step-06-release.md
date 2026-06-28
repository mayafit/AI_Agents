# Step 06 — Gated Beta Publish & Epic PR

**Goal:** Ship a testable beta package and open the epic PR — both behind explicit human gates. These are the only two outward, hard-to-undo actions in the run.

## Self-review before anything (mandatory)

Per repo policy, run the `code-review` skill on the full epic diff (`main...feature/epic-<epic-id>`) and address its findings before opening the PR. This is in addition to the per-story reviews — it catches integration-level issues.

## GATE A — npm beta publish

Only if `{workflow.defaults.gate_before_publish}` (default ON). **HALT and ask the user to confirm** before running any publish command. Publishing is effectively irreversible (a version can be deprecated but not truly unpublished after 72h) and requires credentials/2FA.

On confirmation:

1. **Bump version** on the epic branch using the configured bump `{workflow.defaults.version_bump}`:
   ```bash
   npm version {workflow.defaults.version_bump} --preid=beta --no-git-tag-version
   ```
   (default bump `prerelease` → e.g. `3.14.0` → `3.14.1-beta.0`). Commit the bump.
2. **Rebuild the bundle** so `marketplace.json` carries the new version, and commit any drift: `npm run build:plugin`.
3. **Pack** — when `{workflow.defaults.pack_ignore_scripts}` is true (the default), pass `--ignore-scripts` to avoid the known Windows `prepare` tarball leak (a temp build dir leaking into the tarball):
   ```bash
   npm pack --ignore-scripts          # omit --ignore-scripts only if pack_ignore_scripts = false
   ```
   Inspect the tarball contents (`tar -tzf <tgz>`) — confirm no stray temp/build directory is included.
4. **Publish** to the channel `{workflow.defaults.npm_dist_tag}` (default `beta`; requires npm auth + OTP/2FA; the user supplies the OTP at the gate — never hardcode it). Match the `--ignore-scripts` choice from the pack step:
   ```bash
   npm publish --tag {workflow.defaults.npm_dist_tag} --ignore-scripts
   ```
   If 2FA prompts, surface it to the user. Confirm the publish with `npm view <pkg> dist-tags`.
5. Tell the user the exact install line to test, e.g. `npm i ma-agents@beta` (or the resolved `@<version>`).

If the user declines GATE A: skip publish, continue to GATE B (the PR can still be opened without a published beta).

## GATE B — Epic Pull Request

Only if `{workflow.defaults.gate_before_pr}` (default ON). **HALT and ask the user to confirm** before opening the PR.

On confirmation, push the epic branch and open ONE PR (`feature/epic-<epic-id>` → `main`):

```bash
git -C <epic-worktree> push -u origin feature/epic-<epic-id>   # <epic-worktree> = path from the Run Ledger
gh pr create --base main --head feature/epic-<epic-id> --title "feat(epic-<id>): <epic title>" --body-file <generated-body>
```

The PR body (generated from the Run Ledger) must include:
- Epic summary and link to the planning artifacts.
- Per-story table: status (merged / **blocked** / skipped), e2e status, fix rounds, any unresolved non-blocking findings.
- Adversarial review summary + package-integrity gate outcome.
- The published beta version + install line (if GATE A ran).
- An explicit **"Blocked / follow-up"** section if any story did not converge — never hide this.

Credential note: if the default git/`gh` token is rejected, a working PAT may live in the location recorded in memory ("GitHub push credentials location"); use it masked. Never echo tokens.

Do **not** merge the PR — the user approves and merges the epic PR themselves.

Then read fully and follow `./steps/step-07-report.md`.
