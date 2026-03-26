# Story 15.1: Bump bmad-method to 6.2.1 and Update Cache

Status: ready-for-dev

## Story

As a **Chief Architect**,
I want bmad-method updated from 6.0.4 to 6.2.1 and the cache build script updated to include wds,
So that the bundled BMAD installation uses the current stable version with all official modules.

## Acceptance Criteria

1. `package.json` pins `"bmad-method": "6.2.1"` and `npm install` fetches the correct version
2. `require.resolve('bmad-method/tools/bmad-npx-wrapper.js')` resolves correctly after install
3. `npm run build:bmad-cache` clones 5 modules: bmb, cis, tea, gds, **wds** (reading from 6.2.1's `external-official-modules.yaml`)
4. `lib/bmad-cache/wds/` is populated with the cloned module and pre-installed dependencies
5. `npx ma-agents install` produces a valid `_bmad/` directory structure for 6.2.1
6. `buildBmadArgs()` passes `--action update` when existing `_bmad/` is detected (works with 6.2.1 CLI)
7. All existing BMAD workflows execute correctly against the 6.2.1 core

## Tasks / Subtasks

- [ ] Task 1: Update package.json dependency (AC: #1, #2)
  - [ ] 1.1 Change `"bmad-method": "6.0.4"` to `"bmad-method": "6.2.1"` in `package.json`
  - [ ] 1.2 Run `npm install` and verify `node_modules/bmad-method/` contains 6.2.1
  - [ ] 1.3 Verify `require.resolve('bmad-method/tools/bmad-npx-wrapper.js')` still resolves (path may have changed in 6.2.1)

- [ ] Task 2: Verify build:bmad-cache compatibility (AC: #3, #4)
  - [ ] 2.1 Read `node_modules/bmad-method/tools/cli/external-official-modules.yaml` from 6.2.1 — check if wds module is present
  - [ ] 2.2 Verify the YAML format matches what `scripts/build-bmad-cache.js` expects (line-by-line parser with specific indentation)
  - [ ] 2.3 Run `npm run build:bmad-cache` and verify 5 modules are cloned (bmb, cis, tea, gds, wds)
  - [ ] 2.4 Verify `lib/bmad-cache/wds/` has valid content with `_git_preserved/` directory
  - [ ] 2.5 Verify `lib/bmad-cache/cache-manifest.json` lists all 5 modules with commit SHAs

- [ ] Task 3: Verify bmad.js CLI compatibility (AC: #5, #6)
  - [ ] 3.1 Check if `getBmadCommand()` in `lib/bmad.js` still resolves `bmad-npx-wrapper.js` correctly
  - [ ] 3.2 Verify `buildBmadArgs(ctx)` flags are accepted by 6.2.1 CLI (`--modules`, `--custom-content`, `--action`, `--skip-config`, etc.)
  - [ ] 3.3 Verify `--custom-content` validation still accepts our `module.yaml` (it has `extends-module: bmm` but no `code` field yet — Story 15.2 adds it)
  - [ ] 3.4 Test fresh install: `npx ma-agents install` on a clean project
  - [ ] 3.5 Test update: `npx ma-agents install` on a project with existing 6.0.4 `_bmad/`

- [ ] Task 4: Verify prePopulateBmadCache compatibility (AC: #5)
  - [ ] 4.1 Check that `prePopulateBmadCache()` (bmad.js:390-437) correctly copies wds module alongside existing 4
  - [ ] 4.2 Verify `restoreGitDir()` works for all 5 modules (renames `_git_preserved/` to `.git/`)
  - [ ] 4.3 Verify offline `git fetch` succeeds with `file://` URL for all 5 modules

## Dev Notes

### Critical: Build Script Parser Sensitivity

The `scripts/build-bmad-cache.js` uses a **custom line-by-line YAML parser** (not a proper YAML library) to read `external-official-modules.yaml`. It expects specific indentation patterns. If 6.2.1 changes the YAML format (even whitespace), the parser may break. **Inspect the new file format before running the build.**

Key parser location: `scripts/build-bmad-cache.js` — look for the `parseModuleConfig()` or equivalent function.

### Critical: --custom-content Validation

In 6.0.4, `--custom-content` requires a directory with `module.yaml`. Story 15.2 will add the `code` field. For THIS story, verify that 6.2.1 still accepts the current `module.yaml` format (which has `extends-module: bmm` but no `code` field). If 6.2.1 REQUIRES the `code` field, coordinate with Story 15.2 — both changes may need to land together.

### Architecture Patterns

- **Naming:** kebab-case files, camelCase code, snake_case JSON
- **Module boundaries:** `bmad.js` owns all BMAD interaction (install, update, cache, customizations)
- **Error handling:** Console output with chalk coloring, non-zero exit on failure
- **No TypeScript, no build step** — plain Node.js ES modules

### Files to Touch

| File | Change |
|------|--------|
| `package.json` | Version bump: `"bmad-method": "6.0.4"` → `"6.2.1"` |
| `scripts/build-bmad-cache.js` | May need updates if YAML format changed |
| `lib/bmad.js` | Verify `getBmadCommand()` and `buildBmadArgs()` compatibility |
| `lib/bmad-cache/` | Rebuilt with 5 modules (add wds) |
| `lib/bmad-cache/cache-manifest.json` | Updated with 5-module manifest |

### Testing Approach

1. Unit: Verify `buildBmadArgs()` output matches 6.2.1 CLI expectations
2. Integration: Run `npm run build:bmad-cache` end-to-end
3. Integration: Run `npx ma-agents install` on clean project
4. Integration: Run `npx ma-agents install` on 6.0.4 project (update path)
5. Smoke: Verify a BMAD workflow (e.g., `/bmad-help`) works after installation

### Project Structure Notes

- `lib/bmad-cache/` is gitignored in the source repo but included in the npm package via explicit `files` in `package.json`
- `scripts/build-bmad-cache.js` is a dev-only script (not shipped to users)
- The 5th module (wds = bmad-whiteport-design-studio) is new in 6.2.1's official module list

### References

- [Source: _bmad-output/planning-artifacts/epics.md — Story 15.1]
- [Source: _bmad-output/planning-artifacts/architecture.md — P2-6 rev, P2-9]
- [Source: lib/bmad.js — buildBmadArgs(), getBmadCommand(), prePopulateBmadCache()]
- [Source: scripts/build-bmad-cache.js — build pipeline]
- [Source: package.json — current bmad-method version]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
