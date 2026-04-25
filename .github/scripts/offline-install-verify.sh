#!/usr/bin/env bash
# Story 22.9 — Air-gapped install verifier.
#
# Runs INSIDE a Docker container that has `--network none`. The script
# performs a ma-agents install from a pre-built tarball and asserts the
# post-install invariants from Stories 22.6 and 22.8.
#
# Environment contract (set by the caller):
#   TARBALL           — filename of the ma-agents tarball, relative to /workspace
#                       (e.g. "ma-agents-3.6.2.tgz")
#
# Expected filesystem (mounted by the caller):
#   /workspace        — repo root, mounted read-only (contains the tarball)
#   /scratch          — writable scratch dir (created by this script)
#
# Exit codes:
#   0   — install succeeded and all invariants held
#   >0  — egress-block misconfigured, install failed, or invariant violated
#
# Network policy: `--network none` isolates the kernel network namespace.
# Nothing inside this script may reach the npm registry, GitHub, or any
# other external host. npm is invoked with --offline and --no-audit
# --no-fund to minimise incidental network attempts.

set -euo pipefail

echo "==> offline-install-verify.sh starting"
echo "    TARBALL=${TARBALL:?TARBALL env var required}"

# ---------------------------------------------------------------------------
# Step 1 — Proof that egress really is blocked.
# ---------------------------------------------------------------------------
# `curl --max-time 2` returns non-zero on connection failure; --network none
# should produce "Could not resolve host" / "Network is unreachable". If
# this check SUCCEEDS, the egress block is misconfigured and we must fail
# before running the install (otherwise a silent network call could slip
# through unnoticed).
echo "==> [1/5] Verifying egress block"
if command -v curl >/dev/null 2>&1; then
  if curl --silent --max-time 2 https://registry.npmjs.org/ >/dev/null 2>&1; then
    echo "ERROR: network is reachable — --network none did not take effect" >&2
    exit 10
  fi
  echo "    OK: curl to registry.npmjs.org failed as expected"
else
  # curl not installed in this image variant. Fall back to a Node TCP probe.
  if node -e "
    const net = require('net');
    const s = net.connect({ host: '1.1.1.1', port: 443, timeout: 2000 });
    s.on('connect', () => { console.log('connected'); process.exit(0); });
    s.on('error',   () => process.exit(1));
    s.on('timeout', () => process.exit(1));
  " >/dev/null 2>&1; then
    echo "ERROR: TCP to 1.1.1.1:443 succeeded — --network none did not take effect" >&2
    exit 10
  fi
  echo "    OK: TCP probe failed as expected"
fi

# ---------------------------------------------------------------------------
# Step 2 — Unpack the tarball into a throwaway location.
# ---------------------------------------------------------------------------
echo "==> [2/5] Extracting tarball"
mkdir -p /pkg
tar -xzf "/workspace/${TARBALL}" -C /pkg
# npm pack always extracts to ./package
PKG_DIR="/pkg/package"
test -d "$PKG_DIR" || { echo "ERROR: expected $PKG_DIR after tar extract" >&2; exit 20; }
echo "    OK: extracted to $PKG_DIR"

# ---------------------------------------------------------------------------
# Step 3 — Resolve the unpacked tarball's dependencies (offline).
# ---------------------------------------------------------------------------
# The tarball ships WITHOUT node_modules (standard npm pack behaviour).
# Under `--network none` we cannot run `npm install` to fetch them, so we
# reuse the online host's node_modules (installed by `npm ci` in the
# workflow) by symlinking to the read-only workspace mount. Node's
# module resolver is happy to traverse a symlink into a read-only tree
# because `require()` only performs reads.
#
# Rationale for symlink (vs. `cp -a`): symlinking is O(1) and uses zero
# extra disk. A recursive copy of ~100MB adds 5-15s on GitHub-hosted
# runners for no benefit since we never write into node_modules.
#
# The package's `prepare` lifecycle script (scripts/build-plugin.js) is
# NOT triggered here — `prepare` only runs on `npm install`, which we
# skip. The plugin bundle under `lib/bmad-extension-plugin/` is already
# present in node_modules-path layout if prepare ran on the host (it
# did, as part of `npm ci`), so the staged tarball itself already
# contains the built plugin (build-plugin.js wrote inside the repo root
# before `npm pack`).
echo "==> [3/5] Wiring node_modules (offline, via symlink)"
cd "$PKG_DIR"
if [ ! -e node_modules ]; then
  ln -s /workspace/node_modules node_modules
fi
echo "    OK: node_modules linked ($(ls node_modules | wc -l) top-level entries)"

# ---------------------------------------------------------------------------
# Step 4 — Run the install against a fresh scratch project.
# ---------------------------------------------------------------------------
echo "==> [4/5] Running ma-agents install (offline)"
mkdir -p /scratch
cd /scratch
# git init so the installer's .gitignore logic (Story 22.8) engages.
git init --quiet --initial-branch=main
git config user.email "offline-ci@example.invalid"
git config user.name  "Offline CI"

# Invoke via the unpacked package's CLI. The `--agent claude-code` flag
# (current CLI surface; the story used `--tools claude-code` as a
# placeholder name) scopes the install to a single agent to minimise
# wall-clock time. `--yes --force` are required for non-interactive CI.
node "$PKG_DIR/bin/cli.js" install --yes --force --agent claude-code

# ---------------------------------------------------------------------------
# Step 5 — Post-install invariants (Stories 22.6, 22.8).
# ---------------------------------------------------------------------------
echo "==> [5/5] Asserting post-install invariants"

fail=0
assert() {
  # assert <condition-description> <test-command...>
  local desc="$1"; shift
  if "$@"; then
    echo "    OK:   $desc"
  else
    echo "    FAIL: $desc" >&2
    fail=$((fail + 1))
  fi
}

# Exit code was 0 or this script would have aborted under set -e.

# Story 22.6: install exits cleanly AND the scratch project has a _bmad/
# tree (the staged plugin got invoked by bmad-method).
assert "scratch project has _bmad/"                    test -d /scratch/_bmad

# Story 22.6: no legacy surgery artifact left behind.
# _bmad/_config/custom/agents/ was the pre-22.6 applyCustomizations output.
# Stage-and-invoke must NOT produce it.
assert "no legacy _bmad/_config/custom/agents dir"     test ! -d /scratch/_bmad/_config/custom/agents

# Story 22.2: at least one ma-agent-* skill landed under claude-code's
# skills directory.
assert ".claude/skills/ma-agent-cyber present"         test -d /scratch/.claude/skills/ma-agent-cyber

# Story 22.6: the plugin staging dir was cleaned up after the bmad
# invocation (it is ephemeral by design).
assert "plugin stage dir cleaned up"                   test ! -d /scratch/.ma-agents-plugin-stage

# Story 22.8 (post-F2a): the project-root .gitignore must list the staging
# dir, AND no per-skill-dir .gitignore may be produced by the stage-dir
# policy. Pre-F2a the installer wrote `.gitignore` into each agent's
# skills directory; that placement is now a defect signal.
#
# Strict assertion replaces the lenient `find /scratch -name .gitignore`
# pattern that previously masked the bug. Two checks run independently
# so both must pass:
#   (a) Project-root /scratch/.gitignore contains exactly one active line
#       matching one of the PLUGIN_STAGE_PATTERNS variants.
#   (b) No `.gitignore` exists at any of the known per-agent skill dirs.

# (a) Project-root .gitignore — must exist and contain the entry exactly once.
ROOT_GITIGNORE="/scratch/.gitignore"
if [ ! -f "$ROOT_GITIGNORE" ]; then
  echo "    FAIL: $ROOT_GITIGNORE does not exist (installer must create or update it)" >&2
  fail=$((fail + 1))
else
  # Count active (non-comment, non-blank) lines that match any of the four
  # PLUGIN_STAGE_PATTERNS variants — see lib/installer.js. Anchored so a
  # substring like "node_modules/.ma-agents-plugin-stage" cannot satisfy
  # the assertion. `tr -d '\r'` handles CRLF-checked-out files (the
  # installer preserves the file's existing line-ending style); without
  # the strip, a trailing `\r` would break the `$` anchor on Linux runners.
  ROOT_MATCHES=$(tr -d '\r' < "$ROOT_GITIGNORE" | grep -cE '^/?\.ma-agents-plugin-stage/?$' || true)
  if [ "$ROOT_MATCHES" -eq 1 ]; then
    echo "    OK:   $ROOT_GITIGNORE contains exactly one .ma-agents-plugin-stage entry"
  elif [ "$ROOT_MATCHES" -eq 0 ]; then
    echo "    FAIL: $ROOT_GITIGNORE missing .ma-agents-plugin-stage entry" >&2
    fail=$((fail + 1))
  else
    echo "    FAIL: $ROOT_GITIGNORE has $ROOT_MATCHES .ma-agents-plugin-stage entries — must be exactly 1 (idempotency)" >&2
    fail=$((fail + 1))
  fi
fi

# (b) No per-skill-dir .gitignore — these would only appear if the stage-dir
# policy regressed. Iterate the canonical agent skill paths (matches what
# the F2a regression test in test/gitignore-plugin-stage.test.js asserts at
# the unit level).
PER_SKILL_DIRS=(
  "/scratch/.claude/skills"
  "/scratch/.cline/skills"
  "/scratch/.github/skills"
  "/scratch/.roo/skills"
  "/scratch/.kilocode/skills"
)
stray_found=0
for d in "${PER_SKILL_DIRS[@]}"; do
  stray="$d/.gitignore"
  # `-e` returns false for broken symlinks; `-L` catches them too. A
  # broken-symlink `.gitignore` would still indicate the bug regressed
  # (something tried to write to that path), so we fail on either.
  if [ -e "$stray" ] || [ -L "$stray" ]; then
    echo "    FAIL: per-skill-dir .gitignore must not exist: $stray (stage-dir policy regressed)" >&2
    stray_found=1
    fail=$((fail + 1))
  fi
done
if [ "$stray_found" -eq 0 ]; then
  echo "    OK:   no per-skill-dir .gitignore from the stage-dir policy"
fi

if [ "$fail" -ne 0 ]; then
  echo "" >&2
  echo "$fail invariant(s) violated — offline install gate FAILED" >&2
  exit 30
fi

echo ""
echo "==> offline-install-verify.sh: all invariants held"
