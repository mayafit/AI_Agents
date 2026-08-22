'use strict';

/**
 * Story 31.13 — the per-machine bound-project record.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * OQ-1 IS SETTLED HERE, AS A STORY-LEVEL DECISION — NOT AS A REQUIREMENT.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * No FR and no part of Decision P5-9 says where this record lives. Story 31.13
 * AC8 constrains it and does not locate it: the record must be PER-MACHINE, must
 * live OUTSIDE any project, must never be written into a project's committed
 * artifacts, and losing it must degrade `ma-agents status` output ONLY — never
 * resolution, which depends on the project root alone (NFR83).
 *
 * DECISION: `~/.ma-agents/bound-projects.json`, i.e.
 * `path.join(os.homedir(), '.ma-agents', 'bound-projects.json')`.
 *
 * This is recorded the way Story 31.8 settled OQ-4: a decision this story makes
 * and owns, stated in the story record and in code, pinned by tests. It is NOT
 * presented as something the PRD required, because the PRD does not.
 *
 * RATIONALE, against the four AC8 properties and the codebase's own precedent:
 *
 *   1. PER-MACHINE. `os.homedir()` is the only per-machine root this codebase
 *      already uses for state that is neither a project nor a package: the BMAD
 *      external-module cache lives at `~/.bmad/cache/external-modules`
 *      (lib/bmad.js). A `~/.ma-agents/` dot-directory is that same convention
 *      under this tool's own name. `os.homedir()` reads USERPROFILE on win32 and
 *      HOME elsewhere, so a test that redirects both gets a genuinely sandboxed
 *      registry — which is how this module's suite avoids touching a developer's
 *      real home.
 *
 *   2. OUTSIDE ANY PROJECT. A home-directory path is not reachable from any
 *      project root, so no `.gitignore` rule, no `git add -A`, and no
 *      `_bmad-output/` policy can ever sweep it into a commit. This is why the
 *      record is NOT put in the obvious-looking alternatives:
 *        - the project's own `_bmad-output/` — committed by design (the
 *          `ensureBmadOutputTracked` policy), so AC8's "not written into any
 *          project's committed artifacts" would be violated outright;
 *        - the project-root `.ma-agents.json` — a PROJECT file, per-project by
 *          construction, and a per-machine list of OTHER projects has no business
 *          in it;
 *        - a global skills directory (`~/AppData/Roaming/Claude/skills`, …) —
 *          these are PER AGENT. There are ten of them. A registry stored there
 *          would exist in as many copies as the user has agents installed, and
 *          those copies would disagree the moment one agent is uninstalled. The
 *          bound-project list is a fact about the MACHINE, not about any one
 *          agent's skills directory.
 *
 *   3. NOT COMMITTED. Follows from (2) and is asserted independently: a bind run
 *      writes nothing named like this registry anywhere under the project root.
 *
 *   4. LOSING IT DEGRADES `status` ONLY. Enforced STRUCTURALLY, not by promise:
 *      this module has no dependency on the resolver and the resolver has no
 *      dependency on this module. `resolveProjectTopology` (bin/cli.js) reads
 *      `_bmad-output/project-layout.yaml` at the project root and nothing else,
 *      exactly as P5-9.1 and NFR83 require. The only consumer of this file is the
 *      display half of `ma-agents status`. Delete `~/.ma-agents/` and every bind,
 *      every generation and every skill preflight behaves identically; `status`
 *      simply has no list to print.
 *
 * FAILURE POLICY. Every function here is TOTAL — it returns a discriminated
 * result and never throws — for the same reason `resolveProjectTopology` is: an
 * unreadable or unwritable per-machine registry is a display concern and must
 * never be able to fail a bind that has already written the project's committed
 * binding. `absent` and `unreadable` are kept DISTINCT (the Story 31.3 rule that
 * `absent` and `malformed` are not interchangeable): "no projects have been
 * bound on this machine" and "there is a registry here this build cannot read"
 * are different facts and `status` says which one it found.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');

const REGISTRY_DIR_NAME = '.ma-agents';
const REGISTRY_FILE_NAME = 'bound-projects.json';

/** Bumped only on a shape change. A registry from the future is `unreadable`. */
const REGISTRY_VERSION = 1;

const REGISTRY_ABSENT = 'absent';
const REGISTRY_UNREADABLE = 'unreadable';

/**
 * The registry directory. Computed on every call rather than cached at module
 * load, because `os.homedir()` is read from the environment and the suites
 * redirect HOME/USERPROFILE per test. A module-level constant would freeze the
 * developer's real home into the first `require`.
 */
function boundProjectsDir() {
  return path.join(os.homedir(), REGISTRY_DIR_NAME);
}

/** The registry file itself. */
function boundProjectsPath() {
  return path.join(boundProjectsDir(), REGISTRY_FILE_NAME);
}

/**
 * Canonical form of a project root, used as the identity of a record.
 *
 * `path.resolve` only — deliberately NOT `fs.realpathSync`. A bound project that
 * has since been DELETED or MOVED is precisely the case AC7 exists to make
 * visible, and `realpathSync` throws on a path that no longer exists, which would
 * erase the record it is supposed to surface.
 */
function normalizeProjectRoot(projectRoot) {
  return path.resolve(projectRoot);
}

/**
 * Two roots are the same project when their canonical forms match. Case-folded on
 * win32 and on darwin, where the filesystem is case-insensitive by default, so
 * `D:\Code\Proj` and `d:\code\proj` do not become two records for one project.
 */
function projectRootKey(projectRoot) {
  const resolved = normalizeProjectRoot(projectRoot);
  return process.platform === 'win32' || process.platform === 'darwin'
    ? resolved.toLowerCase()
    : resolved;
}

/**
 * Read the per-machine registry.
 *
 * @returns {{ok: true, version: number, projects: Array<{root: string, boundAt: string}>, path: string}
 *          |{ok: false, reason: 'absent'|'unreadable', message: string, path: string}}
 */
function readBoundProjects() {
  const file = boundProjectsPath();
  let raw;
  try {
    if (!fs.existsSync(file)) {
      return {
        ok: false,
        reason: REGISTRY_ABSENT,
        message: `no bound-project record at ${file}`,
        path: file,
      };
    }
    raw = fs.readFileSync(file, 'utf-8');
  } catch (e) {
    return {
      ok: false,
      reason: REGISTRY_UNREADABLE,
      message: `${file} could not be read: ${e.message}`,
      path: file,
    };
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    return {
      ok: false,
      reason: REGISTRY_UNREADABLE,
      message: `${file} is not valid JSON: ${e.message}`,
      path: file,
    };
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return {
      ok: false,
      reason: REGISTRY_UNREADABLE,
      message: `${file} does not hold a registry object`,
      path: file,
    };
  }
  if (parsed.version !== REGISTRY_VERSION) {
    return {
      ok: false,
      reason: REGISTRY_UNREADABLE,
      message:
        `${file} declares version ${JSON.stringify(parsed.version)}; this build writes ` +
        `version ${REGISTRY_VERSION}`,
      path: file,
    };
  }
  if (!Array.isArray(parsed.projects)) {
    return {
      ok: false,
      reason: REGISTRY_UNREADABLE,
      message: `${file} has no \`projects\` array`,
      path: file,
    };
  }

  // Entries that are not the shape this build writes are DROPPED rather than
  // making the whole registry unreadable — one damaged line must not hide every
  // other bound project from `status`.
  const projects = parsed.projects
    .filter((p) => p && typeof p === 'object' && typeof p.root === 'string' && p.root !== '')
    .map((p) => ({
      root: p.root,
      boundAt: typeof p.boundAt === 'string' ? p.boundAt : '',
    }));

  return { ok: true, version: REGISTRY_VERSION, projects, path: file };
}

/**
 * Record that `projectRoot` has been bound on this machine.
 *
 * Idempotent on the project identity: re-binding an already-recorded project
 * REFRESHES its `boundAt` and never appends a second entry. The list is written
 * sorted by key so the file's bytes depend on the SET of bound projects, not on
 * the order they happened to be bound in (the same determinism rule NFR81 puts
 * on `project-layout.yaml`).
 *
 * TOTAL: never throws. A failure returns `{ok:false}` and the caller reports it
 * as a degraded `status`, never as a failed bind.
 *
 * @returns {{ok: true, path: string, projects: Array}|{ok: false, message: string, path: string}}
 */
function recordBoundProject(projectRoot, now = new Date()) {
  const file = boundProjectsPath();
  const root = normalizeProjectRoot(projectRoot);
  const key = projectRootKey(root);

  const existing = readBoundProjects();
  // An `unreadable` registry is REPLACED rather than merged into: there is
  // nothing here this build can preserve, and refusing to record would mean a
  // single damaged byte permanently blinds `status` on this machine. This is
  // safe in a way the analogous move on `project-layout.yaml` would NOT be —
  // that file is authoritative and irreplaceable, this one is a rebuildable
  // display cache whose loss AC8 explicitly says costs nothing but output.
  const kept = existing.ok
    ? existing.projects.filter((p) => projectRootKey(p.root) !== key)
    : [];

  const projects = [...kept, { root, boundAt: now.toISOString() }].sort((a, b) =>
    projectRootKey(a.root) < projectRootKey(b.root) ? -1 : projectRootKey(a.root) > projectRootKey(b.root) ? 1 : 0
  );

  try {
    fs.mkdirSync(boundProjectsDir(), { recursive: true });
    fs.writeFileSync(
      file,
      JSON.stringify({ version: REGISTRY_VERSION, projects }, null, 2) + '\n',
      'utf-8'
    );
  } catch (e) {
    return { ok: false, message: `could not write ${file}: ${e.message}`, path: file };
  }

  return { ok: true, path: file, projects };
}

module.exports = {
  boundProjectsDir,
  boundProjectsPath,
  readBoundProjects,
  recordBoundProject,
  normalizeProjectRoot,
  projectRootKey,
  REGISTRY_VERSION,
  REGISTRY_DIR_NAME,
  REGISTRY_FILE_NAME,
  REGISTRY_ABSENT,
  REGISTRY_UNREADABLE,
};
