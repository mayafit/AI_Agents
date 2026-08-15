'use strict';

/**
 * THE single definition of the knowledge-store `backend` enum and of the
 * backend a store has when it never states one.
 *
 * WHY THIS FILE EXISTS (Epic 31, wave 2B review nit 1). `backend` was already
 * single-sourced *inside* `bin/cli.js` — precisely because this epic found the
 * same defect three times over: a read half and a write half disagreeing about a
 * closed enum. But a SECOND, independent definition of "the default backend"
 * survived in `lib/installer.js`, as the bare string literal `'file-system'` in
 * `generateRepoLayoutSection`. The comment there correctly explained WHY it was
 * open-coded (`lib/installer.js` must not `require` `bin/cli.js`, because
 * `bin/cli.js` requires `lib/installer.js` — the dependency runs one way only,
 * and there was no shared module in `lib/` to put the enum in). What it did not
 * do was PIN the two spellings in agreement: every test asserted against
 * `bin/cli.js`'s copy, so `lib/installer.js`'s could have been changed, or the
 * enum widened, with nothing going red.
 *
 * That is the same read/write enum disagreement this epic already fixed once,
 * one layer out. This module is the shared `lib/`-level home the comment said did
 * not exist. It depends on NOTHING — not on `bin/cli.js`, not on
 * `lib/installer.js` — so both may consume it with no cycle:
 *
 *     lib/store-backends.js   (this file, leaf)
 *          ▲            ▲
 *          │            │
 *   lib/installer.js ◄── bin/cli.js
 *
 * `bin/cli.js` builds its `STORE_BACKENDS` Set from `STORE_BACKEND_LIST` and
 * re-exports `DEFAULT_STORE_BACKEND`; `lib/installer.js` re-exports
 * `DEFAULT_STORE_BACKEND`. `test/project-layout-config-generation.test.js` pins
 * that all three spellings are the SAME value and that neither consumer defines
 * its own, so a fourth definition cannot appear unnoticed.
 *
 * ORDER IS SIGNIFICANT. `bin/cli.js` renders the user-facing legal-values message
 * (`legalBackendsForMessage`) by iterating the enum, and Set iteration is
 * insertion-ordered, so this array's order is what the user reads. Frozen so a
 * consumer cannot widen or reorder what every direction accepts.
 */
const STORE_BACKEND_LIST = Object.freeze(['file-system', 'confluence']);

/**
 * The backend a store has when it never states one. "Never stated" has always
 * meant file-system on the read half, the write half, the display half and — via
 * `generateRepoLayoutSection` — the project-context half. Named once, here, for
 * the same reason the enum itself is: three spellings of the same default is how
 * the halves come to disagree.
 */
const DEFAULT_STORE_BACKEND = 'file-system';

// FAIL LOUD AT LOAD, not permissively at use. A default outside the enum would
// make every "is this store non-default?" predicate in the codebase answer yes
// for a perfectly ordinary store, and there is no sensible degraded behaviour to
// fall back to. Throwing here means the very first `require` reports it.
if (!STORE_BACKEND_LIST.includes(DEFAULT_STORE_BACKEND)) {
  throw new Error(
    `lib/store-backends.js is internally inconsistent: DEFAULT_STORE_BACKEND ` +
    `${JSON.stringify(DEFAULT_STORE_BACKEND)} is not a member of STORE_BACKEND_LIST ` +
    `[${STORE_BACKEND_LIST.map((b) => JSON.stringify(b)).join(', ')}].`
  );
}

module.exports = { STORE_BACKEND_LIST, DEFAULT_STORE_BACKEND };
