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
- Verification (agent): Inventory each timeout comparison and its counter type, then check the recorded half-range against the maximum wait. Pass when every comparison uses the wrap-safe unsigned difference and no settable clock controls a wait; artifact: timeout table and source report.
- Verification (target): Using the `PROJECT_RULES.md` `timeout-timebase` configuration with the production tick source, test deadlines before, at, and after counter wrap. Pass when expiry is reported once at the documented elapsed interval and never early or late beyond one tick in 100% of cases; artifact: timestamp trace, counter configuration, and configuration snapshot.
- Exceptions: A wider time source MAY be used only when monotonicity, wrap interval, owner, and verification evidence are recorded with a review condition.

Correct:

```c
bool expired(uint32_t start, uint32_t timeout, uint32_t now)
{
    return (now - start) >= timeout; /* valid for the recorded counter half-range */
}
```

Incorrect:

```c
bool expired(uint32_t deadline, uint32_t now)
{
    return now >= deadline; /* fails when the monotonic counter wraps */
}
```

### EMB-ERR-BOUNDS-001 [MUST]

Every polling loop, retry sequence, and wait MUST have a finite, project-recorded bound.

- Applies when: Waiting for hardware, retrying transactions, delaying between attempts, or calling a helper that can wait indirectly.
- Rationale: A loop without a proven bound can consume a task, interrupt, or watchdog budget indefinitely.
- Verification (agent): Inventory every loop, retry, and wait, including helper calls, and record its fixed iteration, deadline, or attempt bound. Pass when every reachable path has a finite bound that is checked against the project budget; artifact: wait-bound table and control-flow report.
- Verification (target): Using the `PROJECT_RULES.md` `wait-bounds` configuration, exercise first-iteration success, last-iteration success, timeout, hardware failure, and cancellation. Pass when attempts or elapsed time never exceed the configured bound in 100% of runs; artifact: iteration counter log, timing trace, and configuration snapshot.
- Exceptions: No exception applies to interrupt- or watchdog-reachable operations; a task-context indefinite wait requires an approved service-level contract with owner, recovery path, and review condition.

Correct:

```c
for (uint32_t attempt = 0U; attempt < 3U; attempt++) {
    if (try_transfer()) {
        return true;
    }
}
return false; /* success and bounded failure are both explicit */
```

Incorrect:

```c
while (!try_transfer()) {
    ; /* no attempt, deadline, or failure bound */
}
```

### EMB-ERR-RESULT-001 [MUST]

Every bounded polling loop, retry sequence, and wait MUST return an explicit success,
timeout, or failure result to its caller.

- Applies when: A bounded operation can complete, expire, be cancelled, or fail due to hardware or resource state.
- Rationale: A finite wait still leaves the caller unable to distinguish completion from timeout or hardware failure if its result is implicit or discarded.
- Verification (agent): Enumerate the terminal outcomes of each bounded operation and trace them across the caller boundary. Pass when success, timeout, cancellation, and documented failure each map to an explicit result and no fallible return is discarded; artifact: wait-result mapping and call-site report.
- Verification (target): Using the `PROJECT_RULES.md` `wait-results` configuration, inject first-iteration success, final-iteration success, timeout, cancellation, and hardware failure. Pass when the caller observes the matching explicit result and takes the documented branch in 100% of cases; artifact: result trace, caller assertions, and configuration snapshot.
- Exceptions: A wrapper MAY collapse two outcomes only when the documented contract proves them equivalent for the caller's safety decision and records the owner and review condition.

Correct:

```c
enum transfer_result { TRANSFER_OK, TRANSFER_TIMEOUT };

enum transfer_result wait_for_transfer(void)
{
    for (uint32_t attempt = 0U; attempt < 3U; attempt++) {
        if (try_transfer()) {
            return TRANSFER_OK;
        }
    }
    return TRANSFER_TIMEOUT; /* timeout is explicit to the caller */
}
```

Incorrect:

```c
bool wait_for_transfer(void)
{
    for (uint32_t attempt = 0U; attempt < 3U; attempt++) {
        if (try_transfer()) {
            break;
        }
    }
    return true; /* timeout and hardware failure are reported as success */
}
```

### EMB-ERR-OVERFLOW-001 [MUST]

Timeout conversions and deadline calculations MUST define their units, maximum input, and
overflow behavior before the value is used to control a wait.

- Applies when: Converting user or protocol durations, multiplying ticks, adding deadlines, or narrowing time values.
- Rationale: Arithmetic overflow can create a deadline in the past or a retry count that bypasses the intended bound.
- Verification (agent): Check each conversion's source/destination units, maximum input, intermediate width, and overflow branch. Pass when the maximum accepted input cannot wrap and overflow produces the documented result; artifact: conversion table and static-analysis output.
- Verification (target): Using the `PROJECT_RULES.md` `timeout-overflow` configuration, test zero, minimum, maximum, and overflowing inputs. Pass when overflow is rejected or saturates visibly and the resulting wait remains within the safety budget for 100% of inputs; artifact: boundary test log and configuration snapshot.
- Exceptions: Saturation MAY be used only when the saturated value, safety budget, owner, and review condition are recorded.

Correct:

```c
bool timeout_to_ticks(uint32_t ms, uint32_t *ticks)
{
    if (ms > (UINT32_MAX / TICKS_PER_SECOND)) {
        return false; /* overflow is visible instead of wrapping */
    }
    *ticks = ms * TICKS_PER_SECOND;
    return true;
}
```

Incorrect:

```c
uint32_t timeout_to_ticks(uint32_t ms)
{
    return ms * TICKS_PER_SECOND; /* caller can overflow the result silently */
}
```

### EMB-ERR-PROPAGATE-001 [MUST]

An operation MUST preserve or explicitly translate every failure, timeout, cancellation,
and partial-completion result across each caller boundary.

- Applies when: Wrapping drivers, translating status codes, retrying, logging, or returning from recovery paths.
- Rationale: Converting a failed hardware operation into success hides the state the caller must handle and can cause unsafe follow-on work.
- Verification (agent): Build a result mapping for every caller boundary, including partial progress, and search for discarded fallible returns. Pass when each low-level terminal result remains distinct or has an explicit safe translation; artifact: result mapping and call-site report.
- Verification (target): Using the `PROJECT_RULES.md` `error-propagation` configuration, execute every branch, including failure after partial progress. Pass when the caller receives the documented non-success result and does not start unsafe follow-on work in 100% of branches; artifact: status trace, caller assertion log, and configuration snapshot.
- Exceptions: A failure MAY be intentionally collapsed only when the interface records the lost distinction, proves the resulting state safe, and names owner and review condition.

Correct:

```c
enum result { RESULT_OK, RESULT_TIMEOUT, RESULT_CANCELLED, RESULT_PARTIAL };

enum result read_frame(void)
{
    return driver_read_frame(); /* caller receives the exact terminal result */
}
```

Incorrect:

```c
bool read_frame(void)
{
    (void)driver_read_frame(); /* timeout or partial completion is discarded */
    return true;
}
```

### EMB-ERR-RECOVERY-001 [MUST]

Recovery after a timeout or hardware error MUST restore a known state or return an explicit
unrecoverable result before the resource is reused.

- Applies when: Resetting peripherals, aborting transfers, retrying commands, or releasing resources after an error.
- Rationale: Retrying from an unknown state can duplicate side effects, retain stale ownership, or turn one fault into cascading corruption.
- Verification (agent): For every timeout/error path, identify the known-state proof or explicit unrecoverable result before reuse. Pass when no retry/release occurs from an unknown state; artifact: recovery state table and control-flow report.
- Verification (target): Using the `PROJECT_RULES.md` `error-recovery` configuration, exercise recovery success, recovery failure, repeated recovery, and reset during each operation phase. Pass when reuse follows only the known-state transition and fail-stop is distinguishable from success in 100% of cases; artifact: recovery trace, status log, and configuration snapshot.
- Exceptions: A documented fail-stop path MAY leave the resource unavailable only when the caller can distinguish it from success and the owner, terminal state, and review condition are recorded.

Correct:

```c
if (!peripheral_reset_and_confirm_idle()) {
    return UNRECOVERABLE; /* no reuse while the state is unknown */
}
return RECOVERED;
```

Incorrect:

```c
peripheral_start_next_transfer(); /* previous transfer state was never recovered */
```

## Module examples

See the larger [compliant](../../examples/EMB-ERR-BOUNDS-001/compliant.c) and
[violating](../../examples/EMB-ERR-BOUNDS-001/violation.c) examples.

Correct:

```c
enum recovery_result { RECOVERED, UNRECOVERABLE };

enum recovery_result recover_after_timeout(void)
{
    if (!peripheral_reset_and_confirm_idle()) {
        return UNRECOVERABLE;
    }
    return RECOVERED; /* reuse is allowed only after a known idle state */
}
```

Incorrect:

```c
void recover_after_timeout(void)
{
    peripheral_start_next_transfer(); /* previous transfer state is unknown */
}
```
