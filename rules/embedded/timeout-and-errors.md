# Timeout and Error Rules

Status: draft

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
- Verification: Record the time width and half-range assumption, then test before-wrap, at-wrap, and after-wrap deadlines.
- Exceptions: A wider project time source MAY be used when its monotonicity and wrap behavior are verified.

### EMB-ERR-BOUNDS-001 [MUST]

Every polling loop, retry sequence, and wait MUST have a finite, project-recorded bound
and MUST expose an explicit success, timeout, or failure result.

- Applies when: Waiting for hardware, retrying transactions, delaying between attempts, or calling a helper that can wait indirectly.
- Rationale: A loop without a proven bound can consume a task, interrupt, or watchdog budget indefinitely.
- Verification: Prove the iteration, deadline, or attempt bound and test first-iteration success, last-iteration success, timeout, and hardware failure.
- Exceptions: None for an operation reachable from an interrupt or watchdog-sensitive context; a task-context exception requires an approved service-level contract.

### EMB-ERR-OVERFLOW-001 [MUST]

Timeout conversions and deadline calculations MUST define their units, maximum input, and
overflow behavior before the value is used to control a wait.

- Applies when: Converting user or protocol durations, multiplying ticks, adding deadlines, or narrowing time values.
- Rationale: Arithmetic overflow can create a deadline in the past or a retry count that bypasses the intended bound.
- Verification: Test zero, minimum, maximum, and overflowing inputs and verify rejection or saturation is visible to the caller.
- Exceptions: Saturation MAY be used when the saturated value is documented and still satisfies the operation's safety budget.

### EMB-ERR-PROPAGATE-001 [MUST]

An operation MUST preserve or explicitly translate every failure, timeout, cancellation,
and partial-completion result across each caller boundary.

- Applies when: Wrapping drivers, translating status codes, retrying, logging, or returning from recovery paths.
- Rationale: Converting a failed hardware operation into success hides the state the caller must handle and can cause unsafe follow-on work.
- Verification: Map each low-level result to the public result and test every branch, including a failure after partial progress.
- Exceptions: A failure MAY be intentionally collapsed only when the interface contract records the loss and the resulting state is safe.

### EMB-ERR-RECOVERY-001 [MUST]

Recovery after a timeout or hardware error MUST restore a known state or return an explicit
unrecoverable result before the resource is reused.

- Applies when: Resetting peripherals, aborting transfers, retrying commands, or releasing resources after an error.
- Rationale: Retrying from an unknown state can duplicate side effects, retain stale ownership, or turn one fault into cascading corruption.
- Verification: Test recovery success, recovery failure, repeated recovery, and reset during each operation phase.
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

static bool deadline_reached(uint32_t now, uint32_t deadline)
{
    return (int32_t)(now - deadline) >= 0; /* Valid under the recorded half-range bound. */
}

bool wait_ready(uint32_t deadline)
{
    while (!deadline_reached(platform_ticks_now(), deadline)) {
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
