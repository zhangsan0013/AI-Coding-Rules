# Timeout and Error Rules

Status: provisional

## Scope

Bounded polling, timeout calculation, hardware failure reporting, recovery, and error
propagation.

## Load when

Adding waits, polling loops, retries, timeouts, or hardware error paths.

## Project facts this module depends on

- The monotonic time source, tick frequency, width, wrap period, and conversion policy.
- The maximum operation duration, retry count, hardware recovery sequence, and caller-visible
  error representation for each operation.
- Which wait and delay primitives are legal in each execution context.

Record these in `PROJECT_RULES.md`; do not use a wall clock or an unbounded delay as an
implicit timeout contract.

## Rules

### EMB-ERR-TIMEBASE-001 [MUST]

Timeout decisions MUST use a documented monotonic time source and a wrap-safe comparison
whose valid interval is greater than the maximum permitted wait.

- Applies when: Computing deadlines, comparing elapsed time, or converting a timeout across ticks, cycles, or milliseconds.
- Rationale: Wall-clock adjustments and naive unsigned comparisons can turn an expired operation into an indefinite wait or an early timeout.
- Verification (agent): Confirm elapsed-time comparisons are written as `(now - start) >= timeout` on an unsigned monotonic counter rather than `now >= deadline`, and that the counter's range exceeds the longest permitted wait. A wall-clock or settable time source used for a timeout is a finding.
- Verification (target): Record the time width and half-range assumption, then test before-wrap, at-wrap, and after-wrap deadlines.
- Exceptions: A wider project time source MAY be used when its monotonicity and wrap behavior are verified.

### EMB-ERR-BOUNDS-001 [MUST]

Every polling loop, retry sequence, and wait MUST have a finite, project-recorded bound
and MUST expose an explicit success, timeout, or failure result.

- Applies when: Waiting for hardware, retrying transactions, delaying between attempts, or calling a helper that can wait indirectly.
- Rationale: A loop without a proven bound can consume a task, interrupt, or watchdog budget indefinitely.
- Verification (agent): Confirm every loop, retry, and wait has a bound fixed by configuration rather than by an arbitrary caller value, and an explicit success, timeout, and failure result. A `while (!flag)` or a wait with no deadline is a finding.
- Verification (target): Prove the iteration, deadline, or attempt bound on the target and test first-iteration success, last-iteration success, timeout, and hardware failure.
- Exceptions: None for an operation reachable from an interrupt or watchdog-sensitive context; a task-context exception requires an approved service-level contract.

### EMB-ERR-OVERFLOW-001 [MUST]

Timeout conversions and deadline calculations MUST define their units, maximum input, and
overflow behavior before the value is used to control a wait.

- Applies when: Converting user or protocol durations, multiplying ticks, adding deadlines, or narrowing time values.
- Rationale: Arithmetic overflow can create a deadline in the past or a retry count that bypasses the intended bound.
- Verification (agent): Check each timeout conversion for its unit, maximum input, and overflow behavior. A multiplication of a caller-supplied duration by a tick rate into a narrower type is a finding unless the maximum input is bounded first.
- Verification (target): Test zero, minimum, maximum, and overflowing inputs and confirm rejection or saturation is visible to the caller.
- Exceptions: Saturation MAY be used when the saturated value is documented and still satisfies the operation's safety budget.

### EMB-ERR-PROPAGATE-001 [MUST]

An operation MUST preserve or explicitly translate every failure, timeout, cancellation,
and partial-completion result across each caller boundary.

- Applies when: Wrapping drivers, translating status codes, retrying, logging, or returning from recovery paths.
- Rationale: Converting a failed hardware operation into success hides the state the caller must handle and can cause unsafe follow-on work.
- Verification (agent): Map each low-level result to the value the caller receives, and confirm no failure, timeout, cancellation, or partial completion becomes success. A discarded return value or an `(void)` cast on a fallible call is a finding.
- Verification (target): Test every branch, including a failure after partial progress.
- Exceptions: A failure MAY be intentionally collapsed only when the interface contract records the loss and the resulting state is safe.

### EMB-ERR-RECOVERY-001 [MUST]

Recovery after a timeout or hardware error MUST restore a known state or return an explicit
unrecoverable result before the resource is reused.

- Applies when: Resetting peripherals, aborting transfers, retrying commands, or releasing resources after an error.
- Rationale: Retrying from an unknown state can duplicate side effects, retain stale ownership, or turn one fault into cascading corruption.
- Verification (agent): Confirm each recovery path either restores a state the project records as known, or returns an explicit unrecoverable result, before the resource is reused. A retry that reuses the resource without a reset is a finding.
- Verification (target): Test recovery success, recovery failure, repeated recovery, and a reset during each operation phase.
- Exceptions: A documented fail-stop path MAY leave the resource unavailable when the caller can distinguish it from success.

## Module examples

See the larger [compliant](../../examples/EMB-ERR-BOUNDS-001/compliant.c) and
[violating](../../examples/EMB-ERR-BOUNDS-001/violation.c) examples.

Correct:

```c
#include <stdbool.h>
#include <stdint.h>

extern uint32_t platform_ticks_now(void);
extern bool device_ready(void);

/*
 * Elapsed-time form required by EMB-ERR-TIMEBASE-001: the unsigned difference
 * (now - start) wraps correctly, so the comparison stays valid across a counter
 * wrap as long as the recorded timeout is below the counter's range.
 */
bool wait_ready(uint32_t start, uint32_t timeout_ticks)
{
    while ((platform_ticks_now() - start) < timeout_ticks) {
        if (device_ready()) {
            return true;
        }
    }
    return false;
}
```

Incorrect:

```c
extern int device_ready(void);

void wait_ready(void)
{
    while (!device_ready()) {
        /* No deadline, retry bound, or failure result exists. */
    }
}
```
