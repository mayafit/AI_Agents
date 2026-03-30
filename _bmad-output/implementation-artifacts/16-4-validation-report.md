# Story 16.4 Validation Report: Cross-Repo Path Resolution

Generated: 2026-03-28

## Audit Summary

**Result: PASS** - All BMAD workflows are 100% config-driven. No hardcoded `_bmad-output/` paths found.

## Gap Analysis Table

| Workflow | Phase | Path Source | Hardcoded? | Config Key Used | Change Needed |
|----------|-------|-----------|-----------|----------------|---------------|
| bmad-product-brief | 1-Analysis | config.yaml | No | planning_artifacts | None |
| bmad-domain-research | 1-Analysis | config.yaml | No | planning_artifacts | None |
| bmad-market-research | 1-Analysis | config.yaml | No | planning_artifacts | None |
| bmad-technical-research | 1-Analysis | config.yaml | No | planning_artifacts | None |
| bmad-create-prd | 2-Planning | config.yaml | No | planning_artifacts | None |
| bmad-create-ux-design | 2-Planning | config.yaml | No | planning_artifacts | None |
| bmad-validate-prd | 2-Planning | config.yaml | No | planning_artifacts | None |
| bmad-edit-prd | 2-Planning | config.yaml | No | planning_artifacts | None |
| bmad-create-architecture | 3-Solutioning | config.yaml | No | planning_artifacts | None |
| bmad-create-epics-and-stories | 3-Solutioning | config.yaml | No | planning_artifacts | None |
| bmad-check-implementation-readiness | 3-Solutioning | config.yaml | No | planning_artifacts | None |
| bmad-generate-project-context | 3-Solutioning | config.yaml | No | planning_artifacts | None |
| bmad-sprint-planning | 4-Implementation | config.yaml | No | implementation_artifacts, planning_artifacts | None |
| bmad-sprint-status | 4-Implementation | config.yaml | No | implementation_artifacts | None |
| bmad-create-story | 4-Implementation | config.yaml | No | implementation_artifacts, planning_artifacts | None |
| bmad-dev-story | 4-Implementation | config.yaml | No | implementation_artifacts | None |
| bmad-retrospective | 4-Implementation | config.yaml | No | implementation_artifacts | None |
| bmad-code-review | 4-Implementation | config.yaml | No | planning_artifacts, implementation_artifacts | None |
| bmad-correct-course | 4-Implementation | config.yaml | No | implementation_artifacts | None |
| bmad-quick-dev | 4-Implementation | config.yaml | No | implementation_artifacts, planning_artifacts | None |
| bmad-qa-generate-e2e-tests | 4-Implementation | config.yaml | No | implementation_artifacts | None |

## Config Resolution Chain

All workflows follow this identical pattern:
1. Load config from `{project-root}/_bmad/bmm/config.yaml`
2. Resolve `planning_artifacts` and `implementation_artifacts` from config values
3. Use `{planning_artifacts}/...` and `{implementation_artifacts}/...` for all path references

**Multi-repo resolution:**
- `planning_artifacts` = `{knowledgebase_path}/_bmad-output/planning-artifacts`
- `implementation_artifacts` = `{sprint_management_path}/_bmad-output/implementation-artifacts`

**Single-repo resolution (backward compatible):**
- `planning_artifacts` = `_bmad-output/planning-artifacts`
- `implementation_artifacts` = `_bmad-output/implementation-artifacts`

## Source-of-Truth Precedence

| File | Role | Authority |
|------|------|-----------|
| `_bmad/bmm/config.yaml` | Runtime source of truth | PRIMARY |
| `_bmad-output/project-layout.yaml` | Agent discovery file | INFORMATIONAL |
| `_bmad-output/project-context.md` | Agent constitutional doc | INSTRUCTIONAL |

If these disagree, `_bmad/bmm/config.yaml` wins.

## Backward Compatibility (NFR34)

Single-repo mode writes:
- `knowledgebase_path: "."` and `sprint_management_path: "."`
- `planning_artifacts: "_bmad-output/planning-artifacts"`
- `implementation_artifacts: "_bmad-output/implementation-artifacts"`

These values are identical to the pre-Epic-16 default behavior. No workflow changes needed.

## Path Accessibility

Story 16.1 validates external paths at wizard time:
- `fs.existsSync()` checks for local paths
- `fs.statSync().isDirectory()` confirms it's a directory
- Git clone validates remote paths
- Non-existent paths generate warnings

## Conclusion

**No backlog items needed.** All 21 BMAD workflows already support config-driven path resolution through the `planning_artifacts` and `implementation_artifacts` config keys. Story 16.2's config write (updated during 16.4 validation) now also writes these derived fields, completing the end-to-end resolution chain.
