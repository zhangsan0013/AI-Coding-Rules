# Correctness Rules

Status: active

## Scope

Universal requirements for observable behavior, error visibility, invariants, and root-cause
fixes. This module is independent of language, hardware, and runtime.

## Load when

Always.

## Rules

### CORE-CORR-CONTRACT-001 [MUST]

Changes that modify behavior, fix a defect, or may alter behavior MUST define observable
success conditions, failure semantics, and the invariants that must remain true before
implementation begins. When the contract cannot be established from requirements,
callers, or tests, the assumption MUST be recorded and the implementation scope MUST stay
limited until it is clarified.

- Applies when: Changing behavior, fixing a defect, or refactoring code that may affect behavior.
- Rationale: An explicit contract prevents an agent or maintainer from inventing behavior when the requirement is incomplete.
- Verification (agent): Confirm the change states the contract it implements and does not silently widen or narrow it. A behavior change with no corresponding contract change is a finding.
- Verification (target): Run the tests that cover the contract.
- Exceptions: Emergency containment MAY proceed with a documented temporary assumption and follow-up owner.

Correct:

```text
Success: accepts a complete record and persists it.
Failure: rejects an incomplete record without changing stored state.
Invariant: stored records always contain an identifier.
```

Incorrect:

```text
Implement a default result because the caller probably expects one.
```

### CORE-CORR-ERROR-001 [MUST]

Code MUST NOT swallow, disguise, or silently downgrade failures. A failure MUST remain
observable to the responsible caller through a return status, state transition, event, or
equivalent mechanism, and relevant error context MUST be preserved across boundaries.

- Applies when: Handling errors, failed operations, retries, fallbacks, or boundary translation.
- Rationale: Hidden failures turn recoverable faults into corrupted state and make diagnosis unreliable.
- Verification (agent): Confirm each error is detected where it occurs, represented explicitly, and reaches a caller that can act on it.
- Verification (target): Test each error path.
- Exceptions: A boundary adapter MAY translate an error model only when it preserves failure meaning and documents the mapping.

Correct:

```text
result = load_record()
if result.failed:
    return result.error
```

Incorrect:

```text
load_record()  // error ignored
return success
```

### CORE-CORR-ROOTCAUSE-001 [MUST]

Defect fixes MUST identify the causal mechanism and add regression verification that fails
before the fix and passes after it. When an automated regression cannot be created, the
reason and equivalent independently reviewable evidence MUST be recorded.

- Applies when: Fixing a reported defect, failure, regression, or data-integrity issue.
- Rationale: Symptom-only fixes allow the underlying defect to recur under a different input or execution path.
- Verification (agent): Confirm the change addresses the cause rather than suppressing the symptom. A guard added around a failure whose origin is not identified is a finding.
- Verification (target): Reproduce the original failure and confirm it no longer occurs.
- Exceptions: A short-lived emergency mitigation MAY precede the permanent fix, but it MUST identify the owner and follow-up deadline.

Correct:

```text
Root cause: retry reused an expired handle.
Regression: the pre-fix test reproduces the expired-handle retry and now passes.
```

Incorrect:

```text
Added a guard after the crash; no test reproduces the original failure.
```

### CORE-CORR-INVARIANT-001 [MUST]

State-changing operations MUST preserve documented invariants on both success and failure
paths. Invalid preconditions MUST be rejected before irreversible side effects, and any
partial completion MUST define its intermediate state and recovery semantics.

- Applies when: Creating, updating, deleting, or otherwise mutating state that another operation can observe.
- Rationale: Valid failure states prevent half-applied updates, unsafe retries, and order-dependent corruption.
- Verification (agent): Confirm each invariant the change relies on is stated and checked where it is established, not only where it is assumed.
- Verification (target): Test the invariant violation case.
- Exceptions: Hardware or external protocols MAY impose partial completion when the boundary documents the state and recovery contract.

Correct:

```text
if invalid(input):
    return invalid_input  // state unchanged
apply_update(input)
```

Incorrect:

```text
write_first_half()
if invalid(second_half):
    return failure  // intermediate state is undefined
```
