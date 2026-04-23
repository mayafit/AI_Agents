# Story 22.9: CI Offline Install Gate

Status: backlog

## Story

As a **release manager**,
I want every release candidate verified by an install run with all outbound network egress blocked,
So that the air-gapped guarantee (NFR54) cannot regress without CI catching it.

## Acceptance Criteria

1. **Given** a new CI workflow file (e.g., `.github/workflows/offline-install.yml`), **When** a PR is opened or a tag is pushed, **Then** the workflow runs automatically.

2. **Given** the workflow runs, **When** I read its job definition, **Then** it performs:
   - Checkout of the repo
   - `npm install` (online, in the build container)
   - `npm pack` to produce the ma-agents tarball
   - Spin up a fresh container/VM/step with all outbound network egress blocked (mechanism varies by runner — see Task 2)
   - Inside the offline environment: extract the tarball into a scratch dir, run `npx ma-agents install --yes --force --tools claude-code --directory <scratch>`
   - Assert: install exits 0, plugin staging happened, the scratch project's `_bmad/` tree contains ma-agents skills, and no outbound connection was attempted

3. **Given** the install attempts any outbound connection during the offline step, **When** the firewall rule denies it, **Then** the workflow fails with a clear error identifying the egress attempt (or the install hangs/fails, which the workflow detects via timeout).

4. **Given** the workflow runs to completion, **When** I view the timing, **Then** total wall-clock time is under 5 minutes.

5. **Given** `CONTRIBUTING.md` (or equivalent contributor docs), **When** I read it, **Then** it includes a "Reproducing the offline install locally" section with the exact commands needed (firewall command, `npm pack`, run command).

6. **Given** the repo's branch protection rules for `main`, **When** the rules are inspected, **Then** the offline-install job is listed as a required check for merge.

7. **Given** the workflow asserts the bundle is offline-complete, **When** the assertion passes, **Then** the workflow also produces an artifact summary listing: tarball size, included files (high-level: bundled plugin yes/no, bundled cache yes/no), and install duration. (Helps spot regressions like "the tarball doubled in size" in PR review.)

## Tasks / Subtasks

### Task 1: Choose the offline mechanism for the runner (AC: 2, 3)

- [ ] 1.1 Decide between two main options:
  - **Option A (recommended for GitHub Actions):** Use a Docker step with `--network none`. Simple, portable, runs on stock GitHub-hosted runners.
  - **Option B (for self-hosted runners):** Use iptables to block all outbound traffic in a separate step. More portable across container/non-container runners.
- [ ] 1.2 Document the chosen mechanism in the story's Dev Notes
- [ ] 1.3 Verify the mechanism actually blocks outbound — a quick proof-of-concept with `curl` should fail before relying on it for the install assertion

### Task 2: Author the workflow file (AC: 1, 2, 4)

- [ ] 2.1 Create `.github/workflows/offline-install.yml` (or rename if a different filename matches repo conventions) with structure:
  ```yaml
  name: Offline Install Gate
  on:
    pull_request:
    push:
      tags: ['v*']
  jobs:
    offline-install:
      runs-on: ubuntu-latest
      timeout-minutes: 10
      steps:
        - uses: actions/checkout@v4
        - uses: actions/setup-node@v4
          with:
            node-version: '20'
        - run: npm install
        - run: npm pack
        - name: Run install with no network
          run: |
            docker run --rm --network none \
              -v $PWD:/workspace -w /workspace \
              node:20 bash -c '
                mkdir -p /tmp/scratch && cd /tmp/scratch &&
                tar -xzf /workspace/ma-agents-*.tgz &&
                cd package && npm install --no-audit --no-fund &&
                node bin/cli.js install --yes --force --tools claude-code --directory /tmp/scratch &&
                test -d /tmp/scratch/_bmad
              '
  ```
  (Adjust to match the actual install entry point and any required setup)
- [ ] 2.2 Tune the install command to match how `npx ma-agents` is invoked from the unpacked tarball

### Task 3: Add explicit egress-attempt detection (AC: 3)

- [ ] 3.1 Beyond `--network none` (which blocks egress at the kernel level), add a sanity check before the install:
  ```sh
  if curl -s --max-time 2 https://example.com > /dev/null; then
    echo "ERROR: network is reachable — egress block did not take effect" >&2
    exit 1
  fi
  ```
  This catches misconfigurations where the network block is missing.

### Task 4: Add output assertions (AC: 2, 7)

- [ ] 4.1 After the install, assert:
  - Exit code 0 (already enforced by `bash -c` exiting on first failure)
  - `/tmp/scratch/_bmad/` exists
  - At least one ma-agents skill is installed (e.g., `test -d /tmp/scratch/.claude/skills/ma-agent-cyber`)
  - `/tmp/scratch/.ma-agents-plugin-stage/` does NOT exist (cleanup succeeded — Story 22.6 contract)
- [ ] 4.2 Emit an artifact summary (tarball size, install duration) — use GitHub Actions step output or a job summary

### Task 5: Update CONTRIBUTING.md (AC: 5)

- [ ] 5.1 Add a section "Reproducing the offline install locally":
  ```
  To verify a change preserves the air-gapped guarantee, run locally:

  npm install
  npm pack
  docker run --rm --network none -v $PWD:/workspace -w /workspace \
    node:20 bash -c 'mkdir /tmp/s && cd /tmp/s && tar xzf /workspace/ma-agents-*.tgz && cd package && npm install --no-audit && node bin/cli.js install --yes --force --tools claude-code --directory /tmp/s && test -d /tmp/s/_bmad'

  Should exit 0. Any outbound connection attempt is a regression.
  ```
- [ ] 5.2 Cross-reference the CI workflow file path

### Task 6: Configure branch protection (AC: 6)

- [ ] 6.1 In GitHub repo settings → Branches → main branch protection rule, add the `offline-install` job to required status checks
- [ ] 6.2 Document the change in `CHANGELOG.md` so contributors know the new gate exists

### Task 7: Initial run and stabilization (AC: 4)

- [ ] 7.1 Open a draft PR with the workflow file, observe the run, fix any environment issues
- [ ] 7.2 Verify wall-clock time is under 5 minutes; if over, identify the slow step (likely `npm install` of bmad-method's transitive dependencies) and consider caching strategies that preserve the offline guarantee

## Dev Notes

### Why this story is critical

The whole point of Epic 22's plugin migration is to preserve the air-gapped guarantee while replacing the install mechanism. Without an automated gate, a future PR could subtly add a network call (a telemetry hit, a "check for updates" probe) that nobody notices until a customer's air-gapped install hangs.

### Why `--network none` is preferred over iptables

GitHub-hosted runners support Docker with `--network none` natively. iptables works but requires the workflow to run as root and is less portable across runner types.

### npm install inside the offline container

`npm install --no-audit --no-fund` skips registry calls that npm makes by default. Without these flags, npm tries to phone home for advisory data and crashes the test. If we vendored all dependencies (true bundling), we wouldn't need to run npm install at all in the offline step. That's a future optimization (see Story 22.4 caveats).

### Coordination with Story 22.10

Story 22.10 adds multi-tool smoke verification across `--tools claude-code, copilot, cline`. Two viable arrangements:
1. **Combined matrix** — one job that crosses (offline × tool). Stronger gate, longer runtime.
2. **Separate jobs** — Story 22.9 covers the egress dimension with `claude-code`; Story 22.10 covers tool dimension with online runs. Faster, but a regression that only manifests offline-on-copilot escapes both.

Recommend (1) if the wall-clock cost is acceptable.

### Reference Files

- `.github/workflows/offline-install.yml` — created by this story
- `CONTRIBUTING.md` — updated by this story
- Architecture: Decision P4-1, "Offline verification gate" subsection

### PRD Traceability

- **NFR50:** Bundled plugin install must complete with all outbound network egress blocked
- **NFR54:** 6.3.0 migration must preserve air-gapped self-containment guarantee end-to-end

## Change Log

| Date | Version | Author | Description |
|------|---------|--------|-------------|
| 2026-04-13 | 1.0.0 | (pending) | Story drafted as part of Epic 22 |
