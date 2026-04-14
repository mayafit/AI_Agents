/**
 * lib/warning-filter.js
 *
 * Suppresses the Node.js `ExperimentalWarning` that fires when a CommonJS
 * module loads an ES Module via `require()`.
 *
 * Why this exists
 * ---------------
 * The ma-agents CLI (`bin/cli.js`) is CommonJS. It transitively loads
 * code paths from `bmad-method`, which itself interacts with
 * `@clack/prompts` / `@clack/core` (both `"type": "module"`).
 * On Node runtimes where `require()` of ESM is permitted but still
 * emits `ExperimentalWarning` (notably Node 20.17+ through early 22.x),
 * every installer run prints a noisy warning before the banner.
 *
 * The warning is cosmetic — the installer completes successfully — but
 * it frightens first-time users and pollutes CI logs.
 *
 * Why a `process.on('warning', ...)` listener alone is NOT enough
 * ----------------------------------------------------------------
 * In Node.js 20+, `ExperimentalWarning` is printed through an internal
 * path that does not honor user-land `'warning'` listeners for
 * suppression purposes — the listener is invoked, but Node ALSO prints
 * the default formatted message to stderr. The only reliable way to
 * silence it is a CLI flag at process start:
 *   NODE_OPTIONS="--no-warnings=ExperimentalWarning"  (Node 16+)
 *
 * Strategy
 * --------
 * On first entry, we check whether the current process was started with
 * the suppression flag. If not, we re-exec ourselves in a child
 * process with `NODE_OPTIONS` augmented to include the flag, inherit
 * its stdio, and exit with the child's status. A sentinel env var
 * `MA_AGENTS_WARNINGS_FILTERED=1` prevents infinite re-spawn loops.
 *
 * We additionally attach a `process.on('warning')` listener that
 * silently swallows the specific CJS-require-ESM ExperimentalWarning
 * (if it somehow reaches user-land despite the flag) while re-emitting
 * every other warning. This is belt-and-braces for Node versions where
 * listener semantics differ.
 *
 * For the bmad-method child process spawn (separate Node invocation),
 * `lib/bmad.js` extends `NODE_OPTIONS` with the same flag via
 * `withExperimentalWarningSuppressed()` so the child is equally quiet.
 *
 * This module MUST stay CommonJS and MUST NOT import any ESM package.
 *
 * @module lib/warning-filter
 */

'use strict';

const SENTINEL_ENV = 'MA_AGENTS_WARNINGS_FILTERED';
const SUPPRESS_FLAG = '--no-warnings=ExperimentalWarning';

/**
 * Default Node.js warning formatter (mirrors the built-in output
 * used when no `warning` listener is registered). Kept in sync with
 * Node's internal `process/warning.js` formatting circa Node 20–22.
 *
 * @param {Error} warning
 * @returns {string}
 */
function formatWarning(warning) {
    const name = warning && warning.name ? warning.name : 'Warning';
    const code = warning && warning.code ? ` [${warning.code}]` : '';
    const message = warning && warning.message ? warning.message : String(warning);
    const detail = warning && warning.detail ? `\n${warning.detail}` : '';
    const stack = warning && warning.stack ? warning.stack.split('\n').slice(1).join('\n') : '';
    const header = `(node:${process.pid}) ${name}${code}: ${message}`;
    const body = stack ? `${header}\n${stack}` : header;
    return detail ? `${body}${detail}\n` : `${body}\n`;
}

/**
 * Classify a warning as the specific "CommonJS require() loading an ES Module"
 * ExperimentalWarning we want to suppress.
 *
 * Matches two Node phrasings observed in v20.17+ / v22.x:
 *   1. "CommonJS module <X> is loading ES Module <Y> using require()"
 *   2. "Support for loading ES Module in require() is an experimental feature"
 *
 * Only matches when `warning.name === 'ExperimentalWarning'` — never
 * silences a DeprecationWarning, custom warning, or anything else.
 *
 * @param {Error|{name?: string, message?: string}} warning
 * @returns {boolean}
 */
function isRequireEsmWarning(warning) {
    if (!warning || warning.name !== 'ExperimentalWarning') {
        return false;
    }
    const msg = String(warning.message || '');
    if (/CommonJS module\b.*\bloading ES Module\b.*\brequire\(\)/i.test(msg)) {
        return true;
    }
    if (/Support for loading ES Module in require\(\)/i.test(msg)) {
        return true;
    }
    return false;
}

/**
 * Build the NODE_OPTIONS value that should be passed to a child Node
 * process (such as bmad-method) to silence the ExperimentalWarning.
 * Preserves any existing NODE_OPTIONS the caller already set.
 *
 * @param {string|undefined} currentNodeOptions - value of NODE_OPTIONS in the parent env
 * @returns {string} new NODE_OPTIONS value (may equal input if flag already present)
 */
function withExperimentalWarningSuppressed(currentNodeOptions) {
    const current = (currentNodeOptions || '').trim();
    if (!current) {
        return SUPPRESS_FLAG;
    }
    // If any form of --no-warnings is already present, keep as-is.
    if (/(^|\s)--no-warnings(\s|=|$)/.test(current)) {
        return current;
    }
    return `${current} ${SUPPRESS_FLAG}`;
}

/**
 * Returns true if the current Node process was started with a command-line
 * option that already suppresses the target warning. Inspects
 * `process.execArgv` (flags passed directly to node) and the environment's
 * `NODE_OPTIONS` (flags Node consumed from env at startup).
 *
 * @returns {boolean}
 */
function isWarningAlreadySuppressed() {
    const execArgv = process.execArgv || [];
    for (const a of execArgv) {
        if (a === '--no-warnings' || a.startsWith('--no-warnings=')) return true;
        if (a.startsWith('--disable-warning=')) return true;
    }
    const opts = (process.env.NODE_OPTIONS || '').trim();
    if (/(^|\s)--no-warnings(\s|=|$)/.test(opts)) return true;
    if (/(^|\s)--disable-warning=/.test(opts)) return true;
    return false;
}

/**
 * Attach the user-land warning listener (belt-and-braces). Idempotent —
 * tags its listener with `__maAgentsFilter` so repeated calls only
 * register one.
 *
 * @returns {boolean} true if newly attached, false if already attached.
 */
function attachListener() {
    const existing = process.listeners('warning').find(fn => fn.__maAgentsFilter === true);
    if (existing) return false;

    function filter(warning) {
        if (isRequireEsmWarning(warning)) {
            return; // swallow — cosmetic warning we fix
        }
        try {
            process.stderr.write(formatWarning(warning));
        } catch {
            // never throw from a warning listener
        }
    }
    filter.__maAgentsFilter = true;
    process.on('warning', filter);
    return true;
}

/**
 * Install the warning filter. On first call from a non-suppressed
 * process, re-execs the current script with
 * `NODE_OPTIONS="--no-warnings=ExperimentalWarning"` and a sentinel env
 * var to prevent re-spawn loops, then exits with the child's status.
 *
 * On subsequent calls — or when the process is already suppressed —
 * it simply attaches the user-land listener and returns.
 *
 * Safe to call multiple times (idempotent).
 *
 * @param {Object} [opts]
 * @param {boolean} [opts.reexec=true] - set to false to skip re-exec
 *   (used by tests that want to verify listener behaviour only).
 * @returns {boolean} true if the filter was newly installed, false if
 *   a previous install was already active.
 */
function installExperimentalWarningFilter(opts = {}) {
    const reexec = opts.reexec !== false;

    // If already re-execed, or already suppressed via flags, just attach
    // the listener and move on.
    if (process.env[SENTINEL_ENV] === '1' || isWarningAlreadySuppressed()) {
        return attachListener();
    }

    if (!reexec) {
        return attachListener();
    }

    // Re-exec self with the suppression flag in NODE_OPTIONS.
    // We use spawnSync to wait for the child synchronously and then
    // propagate its exit code.
    const { spawnSync } = require('child_process');
    const newEnv = {
        ...process.env,
        [SENTINEL_ENV]: '1',
        NODE_OPTIONS: withExperimentalWarningSuppressed(process.env.NODE_OPTIONS),
    };
    const args = [...(process.execArgv || []), ...(process.argv.slice(1) || [])];
    const child = spawnSync(process.execPath, args, {
        stdio: 'inherit',
        env: newEnv,
    });
    // If spawn failed (e.g., EACCES), fall back to listener-only mode.
    if (child.error) {
        return attachListener();
    }
    // Propagate signal or exit code. Node's process.exit is the last
    // thing we do on this path.
    if (child.signal) {
        process.kill(process.pid, child.signal);
        // In case the signal was ignored:
        process.exit(1);
    }
    process.exit(typeof child.status === 'number' ? child.status : 0);
}

module.exports = {
    installExperimentalWarningFilter,
    isRequireEsmWarning,
    withExperimentalWarningSuppressed,
    isWarningAlreadySuppressed,
    // exposed for tests only
    _formatWarning: formatWarning,
    _attachListener: attachListener,
    _SENTINEL_ENV: SENTINEL_ENV,
    _SUPPRESS_FLAG: SUPPRESS_FLAG,
};
