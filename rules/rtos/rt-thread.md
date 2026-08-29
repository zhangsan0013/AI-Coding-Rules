# RT-Thread Adapter Rules

Status: draft

## Scope

RT-Thread-specific interfaces and configuration, including thread lifecycle, interrupt
variants, synchronization objects, IPC, memory management, and scheduler behavior. Runtime-
independent requirements belong in [RTOS common](common.md).

## Load when

Changing code that calls RT-Thread interfaces or depends on RT-Thread configuration.

## Project facts this module depends on

- The RT-Thread version, selected BSP, interrupt entry/exit convention, scheduler behavior,
  and services documented as callable from interrupt context.
- The configured tick width, IPC timeout semantics, object initialization mode, heap or
  memory-pool policy, and interrupt priority rules.
- The project-approved wake-up and scheduler-lock pattern for the selected port.

Record these in `PROJECT_RULES.md`; a familiar RT-Thread function name is not by itself an
ISR-safety or blocking guarantee.

## Rules

### RTOS-RTTHREAD-ISR-001 [MUST]

Code executing in an interrupt context MUST use only RT-Thread services documented as safe
for that exact BSP and context, and MUST NOT call a service that can wait, allocate from an
unbounded heap, or yield inside the handler.

- Applies when: Calling RT-Thread IPC, synchronization, scheduler, memory, or device services from an ISR or interrupt callback.
- Rationale: RT-Thread service legality and wake-up behavior depend on the BSP and configuration; a task-context call can corrupt scheduler state or deadlock.
- Verification: Build the selected-port ISR-safe call list, inspect indirect calls, and test full, empty, and wake-up results.
- Exceptions: A service MAY be used when the exact RT-Thread version and BSP document its ISR behavior and result semantics.

### RTOS-RTTHREAD-TIMEOUT-001 [MUST]

RT-Thread wait values MUST use the selected tick configuration, MUST distinguish immediate,
finite, and indefinite waits, and MUST propagate timeout results to the caller.

- Applies when: Passing timeout values to semaphores, mutexes, mailboxes, message queues, events, or delays.
- Rationale: Tick conversion and `RT_WAITING_FOREVER` change both scheduling and recovery behavior, and timeout codes can otherwise be mistaken for success.
- Verification: Test immediate, one-tick, maximum, wrap, and timeout cases under the selected tick configuration.
- Exceptions: An indefinite wait MAY be used only under the explicit lifecycle and recovery contract of the owning thread.

### RTOS-RTTHREAD-IPC-001 [MUST]

An RT-Thread IPC operation MUST define whether it copies a value or transfers a pointer,
and the producer MUST retain or release storage according to that contract after a send.

- Applies when: Using mailboxes, message queues, memory pools, signals, or custom IPC wrappers.
- Rationale: Treating a copied message as a pointer, or a transferred pointer as copied data, creates stale references, leaks, or double release.
- Verification: Inspect the API size and ownership contract and test full, empty, rejected, and shutdown paths.
- Exceptions: A wrapper MAY alter the ownership model only when its interface documents the new model and tests both sides.

### RTOS-RTTHREAD-OBJECT-001 [MUST]

An RT-Thread object MUST be fully initialized before publication and MUST not be detached,
freed, or reused until all waiters, callbacks, and interrupt paths have left it.

- Applies when: Creating, registering, detaching, or reusing threads, IPC objects, timers, device objects, and memory pools.
- Rationale: Object registration and handle reuse can race pending scheduler or callback activity.
- Verification: Test publication during startup, concurrent teardown, pending wake-ups, and repeated initialization failure.
- Exceptions: A permanent statically owned object MAY omit teardown when the project prohibits reuse or deletion.

### RTOS-RTTHREAD-SCHEDULER-001 [MUST]

Scheduler locks and interrupt masks MUST be held only for the minimum bounded work and MUST
be restored using the saved state on every exit path.

- Applies when: Disabling interrupts, locking the scheduler, or entering a port-specific critical section.
- Rationale: A stale mask or scheduler lock can stop all progress, while excessive scope increases interrupt latency.
- Verification: Review nested use and early returns, then test the failure and restoration paths on the selected BSP.
- Exceptions: A longer interval MAY be used only with a recorded latency bound and a port-approved reason.

## Module examples

See the larger [compliant](../../examples/RTOS-RTTHREAD-ISR-001/compliant.c) and
[violating](../../examples/RTOS-RTTHREAD-ISR-001/violation.c) examples.

Correct:

```c
#include <stdint.h>

extern int project_rtthread_mailbox_send_from_isr(void *mailbox, uint32_t value);

void sensor_isr(void *mailbox, uint32_t value)
{
    /* The selected BSP documents this wrapper and its non-blocking result. */
    (void)project_rtthread_mailbox_send_from_isr(mailbox, value);
}
```

Incorrect:

```c
void sensor_isr(void *mailbox, const void *message)
{
    /* A task-context, potentially blocking send has no ISR contract here. */
    (void)rt_mb_send(mailbox, message, RT_WAITING_FOREVER);
}
```
