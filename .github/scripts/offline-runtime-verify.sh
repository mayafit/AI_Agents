#!/usr/bin/env bash
# Story 36.6 AC4 (FR282, NFR58; Decision P5-11.6) — the v7 offline runtime,
# inside a `docker run --network none` container.
#
# Reproduces Story 36.2 AC4 (the five v7 scripts activate with
# `uv run --no-cache` from the bundled runtime: render_skill.py,
# resolve_config.py, resolve_customization.py, tickets.py, setup.py) and the
# AC5(a) controls (no wheelhouse -> the activation fails), with no network.
#
# Mounts (prepared by the workflow while the runner still had network):
#   /workspace  the repository, read-only; bundle/ built by `ma-agents bundle build`
#   /rt         the runtime, read-only: bin/uv, python/cpython-3.11.*, wheelhouse/linux-x64/
# Nothing here downloads anything: the container has no network interface but lo.
set -uo pipefail

WS=/workspace
RT_SRC=/rt
RT=/tmp/rt            # writable copy, so the control can remove the wheelhouse
P=/tmp/p              # the scratch project
LOG=/tmp/offline-runtime.log
failures=0

say() { printf '%s\n' "$*"; }
fail() { say "FAIL: $*"; failures=$((failures + 1)); }

# ─── self-check: no network ──────────────────────────────────────────────────
say "== network self-check"
ifaces=$(awk -F: 'NR>2 {gsub(/ /, "", $1); print $1}' /proc/net/dev | sort | tr '\n' ' ')
say "interfaces: $ifaces"
[ "$ifaces" = "lo " ] || fail "interfaces other than lo: $ifaces"
routes=$(awk 'NR>1' /proc/net/route | wc -l)
say "IPv4 routes: $routes"
[ "$routes" -eq 0 ] || fail "IPv4 routes present: $routes"
if getent hosts pypi.org >/dev/null 2>&1; then fail "pypi.org resolves"; else say "getent hosts pypi.org: no answer (expected)"; fi

# ─── runtime and tools ───────────────────────────────────────────────────────
cp -a "$RT_SRC" "$RT"
say "== runtime"
"$RT/bin/uv" --version
ls "$RT/python"
ls "$RT/wheelhouse/linux-x64"
node --version

# Every activation runs in a fresh, empty environment (the P5-11.6 env route).
BASE=(HOME=/root "PATH=$RT/bin:/usr/local/bin:/usr/bin:/bin")
UVENV=("UV_PYTHON_INSTALL_DIR=$RT/python" UV_PYTHON_PREFERENCE=only-managed UV_PYTHON_DOWNLOADS=never
       "UV_FIND_LINKS=$RT/wheelhouse/linux-x64" UV_OFFLINE=1 UV_NO_CACHE=1)

# run <label> <expected-exit: 0|nonzero> <grep pattern> <command...>
run() {
  local label=$1 expect=$2 pattern=$3; shift 3
  local start end rc
  start=$(date +%s%N)
  "$@" >"$LOG" 2>&1
  rc=$?
  end=$(date +%s%N)
  say "-- $label: exit $rc, $(( (end - start) / 1000000 )) ms"
  head -n 3 "$LOG" | cut -c1-300 | sed "s/^/   | /"
  if [ "$expect" = 0 ] && [ "$rc" -ne 0 ]; then fail "$label exited $rc"; sed 's/^/   ! /' "$LOG" | head -n 40; return; fi
  if [ "$expect" = nonzero ] && [ "$rc" -eq 0 ]; then fail "$label exited 0, expected a failure"; return; fi
  if [ -n "$pattern" ] && ! grep -qE -- "$pattern" "$LOG"; then fail "$label output lacks /$pattern/"; sed 's/^/   ! /' "$LOG" | head -n 40; fi
}

activate() { env -i "${BASE[@]}" "${UVENV[@]}" bash -c "cd $P && $*"; }

# ─── project: Skills CLI add from the bundle, then setup.py ──────────────────
say "== project setup (offline)"
mkdir -p "$P" && cd "$P" && git init -q
run "skills add (bundled Skills CLI, local bundle source)" 0 "" \
  env -i "${BASE[@]}" DISABLE_TELEMETRY=1 DO_NOT_TRACK=1 bash -c \
  "cd $P && node $WS/bundle/skills-cli/bin/cli.mjs add $WS/bundle/bmad-method --skill bmad --skill bmod-core-tools --skill bmod-method --skill bmad-build --skill bmad-agent-po -y --agent claude-code --copy </dev/null"
run "setup.py (create)" 0 '"status": "created"' \
  activate "uv run --no-cache .claude/skills/bmad/scripts/setup.py --project-root $P --skill $P/.claude/skills/bmad --root $P/.claude/skills"

# Ticket tree fixture (Story 36.2 AC4 shape): one initiative, epic epic-proof, two stories.
I="$P/_bmad-output/initiative-offline"
mkdir -p "$I/tickets/epic-proof/tickets"
printf -- '---\ntitle: Offline proof\ntype: initiative\n---\n# Offline proof\n' >"$I/initiative-offline.md"
printf '[[epic]]\nid = 1\nslug = "epic-proof"\ntitle = "Offline proof"\ndescription = "The v7 scripts run with no network."\n' >"$I/tickets/tickets.toml"
printf -- '---\ntitle: Offline proof epic\ntype: epic\n---\n# Offline proof epic\n' >"$I/tickets/epic-proof/epic-proof.md"
printf '[[entry]]\nid = 1\ntype = "story"\ntitle = "Render a skill offline"\n\n[[entry]]\nid = 2\ntype = "story"\ntitle = "Read the ticket tree offline"\nafter = [1]\n' \
  >"$I/tickets/epic-proof/tickets/tickets.toml"

# ─── 36.2 AC4: the five scripts ──────────────────────────────────────────────
say "== 36.2 AC4: five scripts, uv run --no-cache, env route"
run "(a) render_skill.py bmad-build" 0 '^# Build' \
  activate "uv run --no-cache _bmad/scripts/render_skill.py --project-root $P --skill $P/.claude/skills/bmad-build"
run "(a) render_skill.py bmad-agent-po" 0 'Sofia' \
  activate "uv run --no-cache _bmad/scripts/render_skill.py --project-root $P --skill $P/.claude/skills/bmad-agent-po"
run "(b) resolve_config.py" 0 '"core.output_folder"' \
  activate "uv run --no-cache _bmad/scripts/resolve_config.py --project-root $P --key core.output_folder"
run "(c) resolve_customization.py" 0 '"workflow"' \
  activate "uv run --no-cache _bmad/scripts/resolve_customization.py --skill $P/.claude/skills/bmad-build --project-root $P --key workflow"
run "(d) tickets.py status" 0 '"total": 2' \
  activate "uv run --no-cache _bmad/method/scripts/tickets.py --project-root $P status $I"
run "(e) setup.py --status" 0 '"mode": "status"' \
  activate "uv run --no-cache .claude/skills/bmad/scripts/setup.py --project-root $P --skill $P/.claude/skills/bmad --root $P/.claude/skills --status"

# ─── 36.2 AC5(a): controls without the wheelhouse ────────────────────────────
say "== 36.2 AC5(a): controls, no wheelhouse"
NOFL=()
for v in "${UVENV[@]}"; do case $v in UV_FIND_LINKS=*) ;; *) NOFL+=("$v") ;; esac; done
run "control: UV_FIND_LINKS unset, render_skill.py" nonzero 'No solution found when resolving script dependencies' \
  env -i "${BASE[@]}" "${NOFL[@]}" bash -c "cd $P && uv run --no-cache _bmad/scripts/render_skill.py --project-root $P --skill $P/.claude/skills/bmad-build"
run "control: UV_FIND_LINKS unset, tickets.py" nonzero 'No solution found when resolving script dependencies' \
  env -i "${BASE[@]}" "${NOFL[@]}" bash -c "cd $P && uv run --no-cache _bmad/method/scripts/tickets.py --project-root $P status $I"
rm -rf "$RT/wheelhouse"
run "control: wheelhouse removed, render_skill.py" nonzero 'find-links|No solution found' \
  activate "uv run --no-cache _bmad/scripts/render_skill.py --project-root $P --skill $P/.claude/skills/bmad-build"
run "control: wheelhouse removed, tickets.py" nonzero 'find-links|No solution found' \
  activate "uv run --no-cache _bmad/method/scripts/tickets.py --project-root $P status $I"

say ""
if [ "$failures" -eq 0 ]; then say "offline runtime: PASS"; exit 0; fi
say "offline runtime: FAIL ($failures)"
exit 1
