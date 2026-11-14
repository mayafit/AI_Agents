'use strict';
/**
 * The single uv execution site (Story 36.3, FR304, Decision P5-11.6).
 *
 * This module is the ONLY place installer JavaScript starts uv. Every call is
 * `uv` + `run --no-cache` + the caller's argv array, spawned without a shell:
 * `--no-cache` makes uv ignore any cache, so offline the bundled wheelhouse is
 * the only package source, and an argv array keeps paths and answers out of
 * shell parsing. `test/uv-transition-resilience.test.js` fails on any other uv
 * execution site under lib/, scripts/ and bin/, and on a spawn here that drops
 * `--no-cache`.
 *
 * The P5-11.6 environment (UV_PYTHON_INSTALL_DIR, UV_PYTHON_PREFERENCE,
 * UV_PYTHON_DOWNLOADS, UV_FIND_LINKS, UV_OFFLINE, UV_NO_CACHE) is passed by the
 * install flow (Story 39.2) through `options.env`.
 */

const childProcess = require('child_process');

/** The fixed head of every uv argv. */
const UV_RUN_HEAD = Object.freeze(['run', '--no-cache']);

/** The full argv uv receives for `argv` (exported for tests and diagnostics). */
function uvArgv(argv) {
  if (!Array.isArray(argv) || argv.length === 0 || argv.some((a) => typeof a !== 'string')) {
    throw new TypeError('runUv: argv must be a non-empty array of strings');
  }
  return [...UV_RUN_HEAD, ...argv];
}

/**
 * Run `uv` `run --no-cache <argv...>` synchronously.
 *
 * @param {string[]} argv  script and its arguments, e.g. [setupPy, '--project-root', root]
 * @param {object} [options]
 * @param {string} [options.uv='uv']   uv executable (the bundled runtime's binary)
 * @param {string} [options.cwd]
 * @param {object} [options.env]      merged over process.env
 * @param {Array|string} [options.stdio]
 * @param {Function} [options.spawnSync]  injection point for tests
 * @returns {{ status: number|null, stdout: string, stderr: string, error?: Error }}
 */
function runUv(argv, options = {}) {
  uvArgv(argv); // validates
  const spawn = options.spawnSync || childProcess.spawnSync;
  const r = spawn(options.uv || 'uv', ['run', '--no-cache', ...argv], {
    cwd: options.cwd,
    env: { ...process.env, ...(options.env || {}) },
    stdio: options.stdio || ['ignore', 'pipe', 'pipe'],
    encoding: 'utf8',
    shell: false,
    windowsHide: true,
  });
  return { status: r.status, stdout: r.stdout || '', stderr: r.stderr || '', error: r.error };
}

module.exports = { runUv, uvArgv, UV_RUN_HEAD };
