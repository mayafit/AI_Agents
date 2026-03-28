# Edge Case Hunter Review: Epic 17 — Sprint Entity Model

**Scope:** Story 17.1
**Date:** 2026-03-28
**Method:** Exhaustive path enumeration across all branching paths and boundary conditions

## Findings

```json
[
  {
    "location": "17-1:AC#1/Task2.3",
    "trigger_condition": "User enters start date after end date (e.g., start=2026-04-14, end=2026-04-01).",
    "guard_snippet": "Add check: if start > end, reject with error and re-prompt step 3. Also validate ISO format via regex ^\\d{4}-\\d{2}-\\d{2}$.",
    "potential_consequence": "Sprint created with inverted date range, confusing all downstream story scheduling."
  },
  {
    "location": "17-1:AC#1/Task2.3",
    "trigger_condition": "User enters invalid ISO date like 2026-02-30 or non-date string.",
    "guard_snippet": "Add date validation: parse YYYY-MM-DD and verify it resolves to a real calendar date. Re-prompt on failure.",
    "potential_consequence": "Sprint YAML contains impossible dates, breaking any future date-range logic."
  },
  {
    "location": "17-1:AC#1/Task2.3",
    "trigger_condition": "User skips both start and end dates (presses Enter on both).",
    "guard_snippet": "Spec must define behavior for empty dates: write empty string, omit field, or require at least one. AC#1 schema shows quoted dates with no optional marker.",
    "potential_consequence": "Schema inconsistency: AC#1 shows start/end as required but workflow allows skip."
  },
  {
    "location": "17-1:AC#1/Task2.1",
    "trigger_condition": "User enters non-numeric sprint ID like 'sprint-abc' or 'three'.",
    "guard_snippet": "Add validation: sprint number input must match ^[1-9]\\d*$. Reject non-positive-integer and non-numeric inputs with re-prompt.",
    "potential_consequence": "Malformed sprint ID 'sprint-abc' breaks downstream glob and cross-reference assumptions."
  },
  {
    "location": "17-1:AC#1/Task2.1",
    "trigger_condition": "User enters zero or negative number for sprint ID.",
    "guard_snippet": "Add check: sprint number must be a positive integer > 0. Reject zero and negative values.",
    "potential_consequence": "Sprint file named sprint-0.yaml or sprint--1.yaml, violating naming convention."
  },
  {
    "location": "17-1:AC#1/Task2.1",
    "trigger_condition": "User enters sprint number with leading zeros like '03'.",
    "guard_snippet": "Normalize input: strip leading zeros before constructing ID. Validate 03 -> 3 to prevent duplicate sprint-03.yaml vs sprint-3.yaml.",
    "potential_consequence": "Duplicate sprints created: sprint-03.yaml and sprint-3.yaml both exist for same sprint."
  },
  {
    "location": "17-1:AC#2",
    "trigger_condition": "Items are added to sprint but no validation enforces capacity at write time.",
    "guard_snippet": "AC#2 says count never exceeds capacity, but add-sprint only creates empty items. Story must specify which operation enforces capacity check or cross-reference Story 17.4 explicitly as the enforcement point.",
    "potential_consequence": "Capacity constraint exists in spec but no story owns its runtime enforcement."
  },
  {
    "location": "17-1:AC#3/Task3.1",
    "trigger_condition": "New sprint is created with status planning; activation path is undefined.",
    "guard_snippet": "Task 3.4 says activation is 'a separate action (via modify-sprint or a future activate-sprint step)' but modify-sprint is deferred to 17.4/17.5. Add note that single-active validation in Task 3 is dead code until a later story enables activation.",
    "potential_consequence": "Single-active-sprint validation is specified but unreachable in this story's scope."
  },
  {
    "location": "17-1:AC#3/Task3.3",
    "trigger_condition": "YAML parse error in one sprint file during glob scan for active sprints.",
    "guard_snippet": "Add error handling: if a sprint YAML file is malformed or unparseable, log a warning and skip it rather than aborting the entire validation scan.",
    "potential_consequence": "One corrupt sprint file blocks creation of all new sprints."
  },
  {
    "location": "17-1:AC#3/Task3.2",
    "trigger_condition": "Sprints directory contains non-sprint YAML files matching sprint-*.yaml glob.",
    "guard_snippet": "Add schema validation: after glob match, verify file contains required 'id' and 'status' fields before treating it as a sprint entity.",
    "potential_consequence": "Non-sprint file with status field triggers false active-sprint conflict."
  },
  {
    "location": "17-1:AC#3",
    "trigger_condition": "Two sprints set to active simultaneously via concurrent workflow executions.",
    "guard_snippet": "Add advisory note: glob-then-write is not atomic. Document that concurrent sprint activation is unsupported, or add a file-lock/check-after-write pattern.",
    "potential_consequence": "Race condition: two sprints both pass the active check and both get activated."
  },
  {
    "location": "17-1:AC#3",
    "trigger_condition": "Sprint transitions directly from closed to active, bypassing planning state.",
    "guard_snippet": "Define valid transitions explicitly: planning->active, active->closed. Reject closed->active and closed->planning transitions. Task 5.3 mentions documenting transitions but no enforcement spec exists.",
    "potential_consequence": "Closed sprint reactivated, violating the linear lifecycle assumption downstream."
  },
  {
    "location": "17-1:AC#1/Task2.5",
    "trigger_condition": "Sprints directory does not exist when workflow runs (Task 1 not yet executed).",
    "guard_snippet": "Add mkdir -p equivalent in step 5: ensure _bmad-output/implementation-artifacts/sprints/ exists before writing. Do not assume Task 1 has run.",
    "potential_consequence": "Workflow fails with file-not-found error if directory was deleted or never created."
  },
  {
    "location": "17-1:AC#1/Task2.5",
    "trigger_condition": "YAML special characters in sprint name (e.g., colons, quotes, hash symbols).",
    "guard_snippet": "Ensure sprint name is always quoted in YAML output. Add sanitization or escaping for characters that would break YAML parsing: :, #, ', \", {, }, [, ].",
    "potential_consequence": "Generated YAML is unparseable, breaking all downstream sprint readers."
  },
  {
    "location": "17-1:Task2.4/Step4",
    "trigger_condition": "User edits sprint number at step 4, changing it to a number that already exists.",
    "guard_snippet": "After editing sprint number in step 4, re-check overwrite protection against new path sprints/sprint-{new_number}.yaml before proceeding to step 5.",
    "potential_consequence": "Existing sprint silently overwritten because overwrite check only runs with original number."
  },
  {
    "location": "17-1:AC#1/Schema",
    "trigger_condition": "Schema in AC#1 omits created_date and last_modified but Task 2.5 includes them.",
    "guard_snippet": "Reconcile: AC#1 schema shows 7 fields (id, name, status, capacity, start, end, items). Task 2.5 schema adds created_date and last_modified. Clarify which is authoritative to prevent verification task 6.2 from failing.",
    "potential_consequence": "Verification step 6.2 rejects implementation for schema mismatch with AC#1."
  },
  {
    "location": "17-1:Task5/Guardrails",
    "trigger_condition": "Guardrails doc title says 'Epic 11 & Epic 12' but now covers Epic 17 rules.",
    "guard_snippet": "Task 5 should rename or add a section header clarifying the document now covers Epic 17 sprint conventions. Otherwise future readers may ignore it as obsolete.",
    "potential_consequence": "Developers skip reading the guardrails doc assuming it only applies to Epics 11-12."
  },
  {
    "location": "17-1:Task2.6/Task2.5",
    "trigger_condition": "Overwrite protection in Task 2.6 only checks new path; old sprint-plan-{n}.yaml may still exist at legacy location.",
    "guard_snippet": "Add advisory check: if _bmad-output/implementation-artifacts/sprint-plan-{number}.yaml exists at the old path, warn user about potential duplication between old and new format.",
    "potential_consequence": "Same sprint exists in both old and new paths, causing confusion for partially-migrated workflows."
  },
  {
    "location": "17-1:AC#1/Task2.1",
    "trigger_condition": "User enters very large sprint number like 999999999.",
    "guard_snippet": "Add reasonable upper-bound validation (e.g., sprint number <= 9999) to prevent unreasonably long filenames.",
    "potential_consequence": "Absurd sprint IDs pollute the namespace and could hit filesystem path length limits."
  },
  {
    "location": "17-1:Task3.2",
    "trigger_condition": "Sprints directory is empty or does not exist during glob for active sprint check.",
    "guard_snippet": "Handle empty glob result gracefully: if no sprint files found, skip active-sprint validation and proceed.",
    "potential_consequence": "Glob returns error or unexpected value on empty directory, blocking sprint creation."
  },
  {
    "location": "17-1:AC#1/Step4",
    "trigger_condition": "User provides unrecognized input at confirmation prompt (not y, n, or e).",
    "guard_snippet": "Add fallback: if input is not 'y', 'n', or 'e', display error and re-prompt step 4 confirmation.",
    "potential_consequence": "Ambiguous input like 'yes' or 'Y' falls through without matching any check branch."
  }
]
```

**Total findings: 21**
