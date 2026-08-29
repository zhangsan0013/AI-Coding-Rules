# ThreadX Adapter Rules

Status: draft

## Scope

ThreadX-specific interfaces and configuration, including ISR-callable interfaces,
synchronization objects, queues, memory pools, and scheduler behavior. Runtime-independent
requirements belong in [RTOS common](common.md).

## Load when

Changing code that calls ThreadX interfaces or depends on ThreadX configuration.

## Project facts this module depends on

- The ThreadX version, target port, interrupt entry/exit convention, and services documented
  as legal from interrupt context.
- The configured tick rate, wait and preemption semantics, object memory policy, interrupt
  priority restrictions, and byte/block-pool ownership rules.
- The project's required post-ISR rescheduling and error-status handling pattern.

Record these in `PROJECT_RULES.md`; `TX_NO_WAIT` does not by itself prove that a service is
legal from an interrupt.

## Rules

### RTOS-THREADX-ISR-001 [MUST]

An interrupt path MUST call only ThreadX services documented as safe from an interrupt for
the selected port, MUST use a non-waiting form where required, and MUST preserve the
documented status and rescheduling semantics.

- Applies when: Calling ThreadX queues, semaphores, event flags, pools, timers, or scheduler services from an ISR.
- Rationale: ThreadX ISR legality is service- and port-specific; a zero wait does not remove internal scheduler or ownership requirements.
- Verification: Check the selected ThreadX service table and port documentation, inspect indirect calls, and test success, full, and error results.
- Exceptions: A service MAY be called from an ISR only when the exact version and port document that operation and its wake-up behavior.

### RTOS-THREADX-TIMEOUT-001 [MUST]

ThreadX wait values MUST use the selected tick configuration, MUST distinguish `TX_NO_WAIT`,
finite waits, and indefinite waits, and MUST propagate timeout status.

- Applies when: Waiting on queues, semaphores, event flags, mutexes, byte pools, or block pools.
- Rationale: Wait options control scheduler participation and recovery; treating a timeout as a successful empty result can corrupt state progression.
- Verification: Test immediate, one-tick, maximum, wrap, and timeout paths with the selected tick and timeout configuration.
- Exceptions: `TX_WAIT_FOREVER` MAY be used only under a documented task lifecycle and recovery contract, never as an ISR wait.

### RTOS-THREADX-OBJECT-001 [MUST]

A ThreadX object MUST remain initialized and allocated until no task, ISR, callback, or
pending operation can reference it, and deletion MUST be coordinated with those users.

- Applies when: Creating, deleting, resetting, or reusing queues, semaphores, mutexes, event flags, timers, threads, and pools.
- Rationale: ThreadX object control blocks and backing storage are not protected from concurrent reclamation by a handle alone.
- Verification: Review all lifecycle transitions and test deletion with blocked waiters, queued messages, callbacks, and interrupt events.
- Exceptions: A static object MAY be retained for system lifetime when deletion and reuse are explicitly prohibited.

### RTOS-THREADX-POOL-001 [MUST]

Memory obtained from a ThreadX byte or block pool MUST be returned to the same pool by its
owner on every success, cancellation, timeout, and error path.

- Applies when: Allocating, passing, splitting, or releasing pool-backed buffers and messages.
- Rationale: Pool storage has a finite owner and alignment contract; returning an unknown or already returned block damages future allocations.
- Verification: Track pool ownership and size through every branch and inject exhaustion, cancellation, and double-release attempts.
- Exceptions: A wrapper MAY transfer ownership when it preserves the pool identity, block boundary, and release responsibility in its interface.

### RTOS-THREADX-SCHEDULER-001 [MUST]

ThreadX priority, preemption-threshold, and time-slicing settings MUST be selected from
verified project facts and MUST NOT be changed temporarily without a bounded restoration
protocol.

- Applies when: Creating threads, changing priorities, configuring thresholds, or modifying scheduler control.
- Rationale: Scheduler settings alter which work can run and can create starvation or unbounded blocking when treated as local implementation details.
- Verification: Review the configured priority graph and measure worst-case blocking and restoration paths.
- Exceptions: A documented mode transition MAY change settings when no affected thread can run until the transition is complete.

## Module examples

See the larger [compliant](../../examples/RTOS-THREADX-ISR-001/compliant.c) and
[violating](../../examples/RTOS-THREADX-ISR-001/violation.c) examples.

Correct:

```c
#include <stdint.h>

#define TX_NO_WAIT 0U

extern unsigned project_threadx_queue_send_from_isr(void *queue,
                                                     const void *message,
                                                     unsigned wait_option);

void packet_isr(void *queue, const uint32_t *message)
{
    (void)project_threadx_queue_send_from_isr(queue, message, TX_NO_WAIT);
}
```

Incorrect:

```c
void packet_isr(void *queue, const uint32_t *message)
{
    /* An indefinite wait is not an interrupt-safe contract. */
    (void)tx_queue_send(queue, message, TX_WAIT_FOREVER);
}
```
