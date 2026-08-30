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
- Verification (agent): Check: compare the implementation diff with its stated success, failure, and invariant contract; artifact: contract note linked to tests and changed code; pass: each observable outcome and invariant has one explicit owner and the diff neither widens nor narrows it without a recorded decision.
- Verification (target): Check: run the contract's success and failure tests; artifact: test log with input, result, and state assertions; pass: every stated outcome and invariant is observed, including unchanged state on the documented failure path.
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
- Verification (agent): Check: trace every failure-producing call from detection through boundary translation to its responsible caller; artifact: error-flow table with statuses/events and preserved context; pass: no failure is discarded or downgraded, and each caller-visible result retains the documented cause and actionability.
- Verification (target): Check: inject each documented failure at its source; artifact: negative-path log or event trace; pass: the responsible caller receives the expected failure status, transition, or event with required context and no success result.
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
- Verification (agent): Check: inspect the causal chain and run the regression before and after the fix; artifact: root-cause note plus pre-fix failing and post-fix passing outputs; pass: the regression fails against the baseline, passes with the change, and the changed line interrupts the identified cause rather than only hiding its symptom.
- Verification (target): Check: reproduce the original failure on the affected target/configuration; artifact: reproduction and retest log or trace; pass: the original failure no longer occurs and the documented recovery/result is observed for the triggering input.
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

State-changing operations MUST preserve their documented invariants on both success and failure paths.

- Applies when: Creating, updating, deleting, or otherwise mutating state that another operation can observe.
- Rationale: Stable invariants prevent valid failure states from becoming half-applied updates, unsafe retries, or order-dependent corruption.
- Verification (agent): Trace each state mutation against the invariant it is required to preserve on success and failure. Pass when every mutation has an explicit invariant check or proof for both outcomes; artifact: invariant-to-path table and failure-path review.
- Verification (target): Using the state model, invariant assertions, and test harness recorded in `PROJECT_RULES.md` under `correctness-invariants`, execute every success and documented failure path at least 100 times. Pass when all recorded invariants hold after each result; artifact: `PROJECT_RULES.md` snapshot, state assertions, and test log.
- Exceptions: A hardware or protocol boundary MAY expose a documented transient state only when the invariant owner, allowed duration, evidence, and recovery condition are recorded.

Correct:

```text
Success: record is stored with its identifier and checksum.
Failure: record is rejected and the previous stored record remains valid.
Invariant: every visible record has a valid identifier and checksum.
```

Incorrect:

```text
Success and failure behavior are unspecified; callers infer whether the record is usable.
```

### CORE-CORR-PRECONDITION-001 [MUST]

Invalid preconditions MUST be rejected before an irreversible state-changing side effect.

- Applies when: Validating inputs, permissions, resource state, or protocol phase before a mutation that cannot be rolled back atomically.
- Rationale: Rejecting too late can leave externally visible state changed even though the operation reports failure.
- Verification (agent): Locate every irreversible write and its precondition checks. Pass when every invalid precondition reaches a failure return before the first irreversible write; artifact: precondition-to-side-effect table and control-flow report.
- Verification (target): Using the invalid-input fixtures, side-effect probe, and failure status recorded in `PROJECT_RULES.md` under `correctness-preconditions`, inject every invalid precondition at least 100 times. Pass when no irreversible write occurs before rejection and the documented failure status is returned in 100% of cases; artifact: `PROJECT_RULES.md` snapshot, side-effect trace, and negative-path log.
- Exceptions: An operation MAY perform a reversible staging write before validation only when the rollback boundary and proof are recorded.

Correct:

```c
if (!packet_length_valid(length)) {
    return STATUS_INVALID_LENGTH;
}
commit_packet_length(length); /* first irreversible state change */
return STATUS_OK;
```

Incorrect:

```c
commit_packet_length(length); /* state changes before validation */
if (!packet_length_valid(length)) {
    return STATUS_INVALID_LENGTH;
}
```

### CORE-CORR-PARTIAL-001 [MUST]

A state-changing operation that can partially complete MUST define the resulting intermediate state and its recovery semantics.

- Applies when: A mutation can fail after one or more externally visible writes, transfers, or resource ownership changes.
- Rationale: An undefined intermediate state makes retries and recovery nondeterministic and can expose inconsistent data to other operations.
- Verification (agent): Enumerate each partial-completion point and document the state, retry/recovery action, and ownership result at that point. Pass when every partial path maps to one named intermediate state and one executable recovery outcome; artifact: partial-state transition table and recovery review.
- Verification (target): Using fault injection at every mutation step and the recovery procedure recorded in `PROJECT_RULES.md` under `correctness-partial`, execute at least 100 failures per step. Pass when each failure reaches exactly the documented intermediate or recovered state and no unowned resource remains; artifact: `PROJECT_RULES.md` snapshot, state dump, ownership trace, and recovery log.
- Exceptions: An external transaction MAY leave a device-defined partial result only when the device state, retry prohibition, owner, and recovery procedure are recorded.

Correct:

```text
Step 1 writes the inactive slot.
If Step 2 fails, state is INACTIVE_SLOT_VALID and the recovery action is retry from Step 2.
Ownership remains with the updater until commit succeeds.
```

Incorrect:

```text
Step 1 writes half the record; on failure the state and retry behavior are undefined.
```
