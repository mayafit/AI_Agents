#!/usr/bin/env bash
# Story 22.10 — Multi-tool smoke verifier.
#
# Runs on the CI host (no container isolation — Story 22.9 already covers
# the offline/air-gap dimension). For ONE `--agent <tool>` target, this
# script performs a fresh ma-agents install into a per-tool scratch dir
# and asserts the expected skills-directory invariants:
#
#   1. ma-agents CLI exited with code 0
#   2. The tool's expected skills directory exists
#   3. That directory contains >= 1 skill sub-directory (i.e. install
#      did not silently produce an empty tree)
#   4. The MANIFEST.yaml (if the tool's template emits one) lists at
#      least one canonical ma-agents skill ID
#   5. At least one ma-agents persona skill (ma-agent-cyber) is present —
#      this is the regression signal the story's whole purpose is to catch:
#      a routing bug in the plugin flow that drops persona skills for a
#      specific tool target.
#
# Environment contract (set by the caller):
#   TOOL              — tool id recognised by --agent (claude-code,
#                       copilot, cline, roo-code, kilocode)
#   SKILLS_DIR        — expected skills path relative to the scratch root
#                       (e.g. ".claude/skills")
#   TARBALL_PATH      — absolute path to the ma-agents .tgz tarball
#   SCRATCH_ROOT      — absolute path to the writable scratch dir this
#                       script may populate (a pristine empty dir)
#   GITHUB_STEP_SUMMARY — optional. If set, the script appends a one-line
#                       pass/fail row to this file.
#
# Exit codes:
#   0   — install succeeded and all invariants held
#   10  — missing required environment variable
#   20  — tarball extraction failed
#   30  — install CLI exited non-zero
#   40  — one or more post-install invariants violated

set -euo pipefail

# ---------------------------------------------------------------------------
# Logging helper — keeps output consistent with Story 22.9's verifier so
# both workflows produce a recognisable step-by-step trace.
# ---------------------------------------------------------------------------
log() { printf '==> %s\n' "$*"; }
err() { printf 'ERROR: %s\n' "$*" >&2; }

# ---------------------------------------------------------------------------
# Canonical ma-agents persona skill IDs. Single source of truth used by both
# the MANIFEST grep (Invariant C) and the persona filesystem check
# (Invariant D). When adding/removing a persona, update ONLY this list.
# ---------------------------------------------------------------------------
PERSONAS="ma-agent-cyber ma-agent-devops ma-agent-sre ma-agent-sqa ma-agent-ml"

# Always-on skills shipped from ma-agents/skills/ that land in every tool's
# skills dir even when the plugin-routed personas do not. Used by
# Invariant C as the lenient fallback shortlist.
ALWAYS_ON_SKILLS="code-review commit-message git-workflow-skill skill-creator"

# ---------------------------------------------------------------------------
# Environment validation. Fail fast if the caller forgot to set a variable;
# partial runs waste CI minutes and produce confusing logs.
# ---------------------------------------------------------------------------
: "${TOOL:?TOOL env var required (e.g. claude-code)}"
: "${SKILLS_DIR:?SKILLS_DIR env var required (e.g. .claude/skills)}"
: "${TARBALL_PATH:?TARBALL_PATH env var required (absolute path to .tgz)}"
: "${SCRATCH_ROOT:?SCRATCH_ROOT env var required (absolute path to scratch dir)}"

log "multi-tool-smoke-verify.sh starting"
log "  TOOL=$TOOL"
log "  SKILLS_DIR=$SKILLS_DIR"
log "  TARBALL_PATH=$TARBALL_PATH"
log "  SCRATCH_ROOT=$SCRATCH_ROOT"

if [ ! -f "$TARBALL_PATH" ]; then
  err "tarball not found at $TARBALL_PATH"
  exit 10
fi

# Ensure scratch is pristine. Caller should have created it empty, but a
# belt-and-braces wipe guarantees no contamination from a rerun.
if [ -d "$SCRATCH_ROOT" ]; then
  # Defensive: never rm something unexpected like /, /home, etc. The
  # RUNNER_TEMP placeholder expands to /dev/null when the env var is
  # unset — /dev/null/* cannot match any real path, so the case arm is
  # effectively unreachable in that mode (forces the local-dev caller
  # to use /tmp or /var/tmp, which are the other whitelisted prefixes).
  RUNNER_TEMP_SAFE="${RUNNER_TEMP:-/dev/null}"
  case "$SCRATCH_ROOT" in
    /tmp/*|/home/*|/var/tmp/*|"${RUNNER_TEMP_SAFE}"/*)
      rm -rf "$SCRATCH_ROOT"
      ;;
    *)
      err "refusing to wipe SCRATCH_ROOT outside /tmp,/home,/var/tmp,\$RUNNER_TEMP: $SCRATCH_ROOT"
      exit 10
      ;;
  esac
fi
mkdir -p "$SCRATCH_ROOT"

# ---------------------------------------------------------------------------
# Step 1 — Extract the tarball into /pkg/package (npm pack layout).
# ---------------------------------------------------------------------------
log "[1/5] Extracting tarball for $TOOL"
PKG_PARENT="$SCRATCH_ROOT/.pkg"
mkdir -p "$PKG_PARENT"
if ! tar -xzf "$TARBALL_PATH" -C "$PKG_PARENT"; then
  err "tar extract failed"
  exit 20
fi
PKG_DIR="$PKG_PARENT/package"
if [ ! -d "$PKG_DIR" ]; then
  err "expected $PKG_DIR after extract (npm pack layout)"
  exit 20
fi
log "  OK: extracted to $PKG_DIR"

# ---------------------------------------------------------------------------
# Step 2 — Wire node_modules into the unpacked tarball.
# The tarball ships WITHOUT node_modules (standard npm pack behaviour). We
# reuse the CI runner's already-installed node_modules by symlinking, which
# is O(1) and does not require network access (mirrors Story 22.9's
# approach). The caller must have run `npm install` before invoking this
# script so that $GITHUB_WORKSPACE/node_modules exists.
# ---------------------------------------------------------------------------
log "[2/5] Wiring node_modules"
if [ -z "${GITHUB_WORKSPACE:-}" ] || [ ! -d "$GITHUB_WORKSPACE/node_modules" ]; then
  err "GITHUB_WORKSPACE/node_modules not found — caller must run 'npm install' first"
  exit 10
fi
if [ ! -e "$PKG_DIR/node_modules" ]; then
  ln -s "$GITHUB_WORKSPACE/node_modules" "$PKG_DIR/node_modules"
fi
log "  OK: node_modules linked"

# ---------------------------------------------------------------------------
# Step 3 — Run the install against a per-tool scratch project. Each matrix
# cell has its own SCRATCH_ROOT so concurrent tool jobs on the same runner
# never collide.
# ---------------------------------------------------------------------------
PROJECT_DIR="$SCRATCH_ROOT/project"
mkdir -p "$PROJECT_DIR"
cd "$PROJECT_DIR"

# git init so installer logic that writes .gitignore (Story 22.8) engages.
git init --quiet --initial-branch=main
git config user.email "multi-tool-ci@example.invalid"
git config user.name  "Multi-Tool CI"

log "[3/5] Running ma-agents install --agent $TOOL"
# --agent is the actual CLI flag (verified against bin/cli.js). The story
# spec used `--tools` as an aspirational placeholder. Match Story 22.9's
# invocation convention for consistency.
#
# Bug B1 fix: --agent now hard-scopes the install to a single tool target.
# Invariant E (below) asserts that other tools' skill directories are absent.
set +e
node "$PKG_DIR/bin/cli.js" install --yes --force --agent "$TOOL"
install_exit=$?
set -e

if [ "$install_exit" -ne 0 ]; then
  err "install exited with code $install_exit"
  exit 30
fi
log "  OK: install exited 0"

# ---------------------------------------------------------------------------
# Step 4 — Assert invariants. We collect all failures then exit non-zero
# at the end, so the log shows every broken invariant in one pass (not
# just the first one). This matches Story 22.9's verifier style.
# ---------------------------------------------------------------------------
log "[4/5] Asserting post-install invariants"

fail=0
FULL_SKILLS_DIR="$PROJECT_DIR/$SKILLS_DIR"

# Invariant A: skills directory was created.
if [ -d "$FULL_SKILLS_DIR" ]; then
  log "  OK:   skills dir exists at $SKILLS_DIR"
else
  err "  FAIL: skills dir missing at $SKILLS_DIR"
  fail=$((fail + 1))
fi

# Invariant B: skills directory is non-empty (>= 1 skill subdir). A silent
# regression that produces an empty tree must fail here, not slip through.
skill_count=0
if [ -d "$FULL_SKILLS_DIR" ]; then
  # Count only sub-directories (each skill is a dir). MANIFEST.yaml is a
  # file so it does not count.
  skill_count=$(find "$FULL_SKILLS_DIR" -mindepth 1 -maxdepth 1 -type d 2>/dev/null | wc -l)
  if [ "$skill_count" -gt 0 ]; then
    log "  OK:   skills dir has $skill_count skill subdir(s)"
  else
    err "  FAIL: skills dir exists but is empty — install produced no skills"
    fail=$((fail + 1))
  fi
fi

# Invariant C: if the tool emits a MANIFEST.yaml, it must list at least
# one canonical ma-agents skill id. Conditional because some templates may
# not emit a MANIFEST (AC intentionally tolerates this).
MANIFEST_FILE="$FULL_SKILLS_DIR/MANIFEST.yaml"
if [ -f "$MANIFEST_FILE" ]; then
  # Build an alternation regex from PERSONAS + ALWAYS_ON_SKILLS. The grep
  # matches any `id: <skill>` line (with optional leading `-` and optional
  # surrounding quotes) where <skill> is a canonical ma-agents ID. Covers
  # both plugin-routed personas AND the always-on skills from the
  # ma-agents skills/ directory, so a tool that only gets the non-plugin
  # path still passes this invariant.
  alt=""
  for sk in $PERSONAS $ALWAYS_ON_SKILLS; do
    alt="${alt:+$alt|}$sk"
  done
  # Pattern allows: `id: foo`, `- id: foo`, `id: "foo"`, `id: 'foo'`, etc.
  if grep -qE "^[[:space:]]*-?[[:space:]]*id:[[:space:]]*[\"']?($alt)[\"']?[[:space:]]*$" "$MANIFEST_FILE"; then
    log "  OK:   MANIFEST.yaml lists at least one canonical ma-agents skill id"
  else
    err "  FAIL: MANIFEST.yaml does not list any ma-agents skill id"
    fail=$((fail + 1))
  fi
else
  log "  SKIP: no MANIFEST.yaml at $MANIFEST_FILE (tool template does not emit one)"
fi

# Invariant D: at least one ma-agent-* persona skill is present. This is
# the PRIMARY regression signal the story was written to catch — a plugin
# routing bug that drops ma-agent persona agents for a specific tool
# target. We check all five persona IDs; only one needs to land.
#
# F2b — strict parity. The copilot warning-downgrade that 22.10 shipped
# while the routing bug was being diagnosed has been removed: the gap
# was traced to `lib/agents.js` declaring copilot's `skillsDir` as
# `.github/copilot/skills` while bmad-method 6.3.0 writes `github-copilot`
# plugin skills (including the ma-agent-* personas) to `.github/skills`.
# Copilot's matrix entry now points at `.github/skills` and the persona
# check is a hard failure for ALL tools — no per-tool special-case.
#
# Documented escape hatch — F2b edge-case-hunter finding 2:
#   SKIP_PERSONA_CHECK=1 downgrades Invariant D to a workflow warning
#   for the duration of the run. Use this ONLY when adding a new tool
#   whose underlying platform legitimately cannot host `type: agent`
#   skills (e.g., a tool that only supports flat skill catalogs). In
#   normal operation this env var must be unset; CI workflows must NOT
#   set it without an accompanying engineering note.
persona_found=""
for persona in $PERSONAS; do
  if [ -f "$FULL_SKILLS_DIR/$persona/SKILL.md" ]; then
    persona_found="$persona"
    break
  fi
done
if [ -n "$persona_found" ]; then
  log "  OK:   persona skill present: $persona_found/SKILL.md"
elif [ "${SKIP_PERSONA_CHECK:-}" = "1" ]; then
  printf '::warning title=%s persona check skipped::SKIP_PERSONA_CHECK=1 — Invariant D downgraded to warning for tool=%s\n' \
    "$TOOL" "$TOOL"
  log "  WARN: persona check skipped (SKIP_PERSONA_CHECK=1) for $TOOL"
else
  err "  FAIL: no ma-agent-* persona skill found under $SKILLS_DIR"
  err "        (checked ma-agent-cyber/devops/sre/sqa/ml — plugin routing regression?)"
  err "        (override with SKIP_PERSONA_CHECK=1 ONLY for tools that cannot host type:agent skills)"
  fail=$((fail + 1))
fi

# Invariant E: Bug B1 regression guard — other flagship tools' skill
# directories must NOT be created when --agent scopes the install to a
# single tool. An --agent install must be a hard scope, not an over-install.
#
# Flagship tool → skills dir mapping (must stay in sync with lib/agents.js):
#   claude-code  → .claude/skills
#   copilot      → .agents/skills   (bmad-method 6.5.0 shared path)
#   cline        → .cline/skills
#   roo-code     → .agents/skills   (bmad-method 6.5.0 shared path)
#   kilocode     → .agents/skills   (bmad-method 6.5.0 shared path)
#
# Note: copilot, roo-code, and kilocode share .agents/skills/ as of
# bmad-method 6.5.0. When the current tool uses .agents/skills/, other
# tools that also use that shared path are skipped (their presence in
# .agents/skills/ is expected, not a scoping regression).
declare -A FLAGSHIP_DIRS
FLAGSHIP_DIRS["claude-code"]=".claude/skills"
FLAGSHIP_DIRS["copilot"]=".agents/skills"
FLAGSHIP_DIRS["cline"]=".cline/skills"
FLAGSHIP_DIRS["roo-code"]=".agents/skills"
FLAGSHIP_DIRS["kilocode"]=".agents/skills"
current_dir="${FLAGSHIP_DIRS[$TOOL]:-$SKILLS_DIR}"
for other_tool in claude-code copilot cline roo-code kilocode; do
  if [ "$other_tool" = "$TOOL" ]; then
    continue  # skip the target tool itself
  fi
  other_dir="${FLAGSHIP_DIRS[$other_tool]}"
  # Skip check when other tool shares the same directory as the current tool
  # (e.g. copilot/roo-code/kilocode all use .agents/skills/ in bmad-method 6.5.0).
  if [ "$other_dir" = "$current_dir" ]; then
    log "  OK:   $other_dir shared with $other_tool (expected — same platform dir)"
    continue
  fi
  if [ -d "$PROJECT_DIR/$other_dir" ]; then
    err "  FAIL: --agent $TOOL install created $other_dir (belongs to $other_tool) — scoping regression"
    fail=$((fail + 1))
  else
    log "  OK:   $other_dir absent (correct — not the target tool)"
  fi
done

# ---------------------------------------------------------------------------
# Step 5 — Report to $GITHUB_STEP_SUMMARY (if present) for a glanceable
# pass/fail row per tool in the workflow run page. AC 7 explicitly calls
# for this: "each matrix entry produces a concise pass/fail line plus the
# count of skills installed at the target".
# ---------------------------------------------------------------------------
log "[5/5] Writing summary row"
verdict="PASS"
if [ "$fail" -ne 0 ]; then
  verdict="FAIL ($fail invariant(s) violated)"
fi
if [ -n "${GITHUB_STEP_SUMMARY:-}" ]; then
  printf '| \`%s\` | \`%s\` | %s | %s |\n' \
    "$TOOL" "$SKILLS_DIR" "$skill_count" "$verdict" \
    >> "$GITHUB_STEP_SUMMARY"
fi

# Emit a GitHub workflow notice so the matrix summary shows a one-liner
# per tool at the top of the PR/run page (AC 7).
printf '::notice title=%s::%s — %s skills installed at %s\n' \
  "$TOOL" "$verdict" "$skill_count" "$SKILLS_DIR"

if [ "$fail" -ne 0 ]; then
  err ""
  err "$fail invariant(s) violated for tool=$TOOL — multi-tool smoke FAILED"
  exit 40
fi

log "multi-tool-smoke-verify.sh: all invariants held for $TOOL"
