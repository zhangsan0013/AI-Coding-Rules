# RTOS Common Rules

Status: provisional

## Scope

Scheduling, task lifecycle, blocking, priority inversion, resource ownership, and task
stack use independent of a specific RTOS, architecture, or compiler.

## Load when

Changing tasks, synchronization primitives, scheduling behavior, or cross-context data flow.

## Project facts this module depends on

- The scheduler, tick, interrupt, and task contexts in which each service is callable.
- The blocking, cancellation, priority, ownership, and deletion semantics of each primitive.
- The priority range, inversion policy, task stack allocation, and stack measurement method.

Vendor-specific API facts belong in the selected adapter module; exact project configuration
belongs in `PROJECT_RULES.md`.

## Adapter boundary

This module defines runtime-independent behavior. Vendor modules such as FreeRTOS,
RT-Thread, and ThreadX add only API-specific or configuration-specific rules.

## Rules

### RTOS-COMMON-CONTEXT-001 [MUST]

An RTOS service MUST be called only from a context in which the selected runtime and port
document it as legal, and an interrupt path MUST not wait for a scheduler-owned resource.

- Applies when: Calling task, queue, semaphore, event, timer, memory-pool, or scheduler services from tasks, interrupts, callbacks, or startup code.
- Rationale: Context legality is a property of the runtime port, not of a function's return type or a zero timeout argument.
- Verification (agent): Build the call-context table from the runtime documentation, then check each service call against the contexts that can reach it. A call absent from the table is a finding rather than an assumption, and a zero timeout is not evidence of legality.
- Verification (target): Test each service from the contexts that call it on the selected port.
- Exceptions: A service MAY be used from an unusual context only when the exact runtime version and port document that use and its result semantics.

### RTOS-COMMON-BLOCK-001 [MUST]

A blocking operation MUST have an explicit finite timeout or an explicitly approved
indefinite-wait contract, and its caller MUST handle timeout and cancellation results.

- Applies when: Waiting for messages, locks, notifications, timers, I/O, or resource availability.
- Rationale: An indefinite wait can consume a task required for recovery and can conceal a deadlock or lost wake-up.
- Verification (agent): Confirm each blocking call passes a finite timeout or an indefinite wait the project has approved for that task, and that the caller branches on the timeout and cancellation results. A discarded wait result is a finding.
- Verification (target): Test the wake-up, timeout, cancellation, and resource-unavailable paths.
- Exceptions: An indefinite wait MAY be used only when the task lifecycle and recovery contract explicitly require it and the owner is recorded.

### RTOS-COMMON-OWNERSHIP-001 [MUST]

Every runtime object and resource MUST have a documented creation, owner, use, release, and
deletion protocol that remains valid across task shutdown and error paths.

- Applies when: Creating or deleting tasks, queues, locks, timers, pools, or handles, and when passing them between contexts.
- Rationale: Deleting or releasing an object while another context can use it creates a use-after-delete race that the RTOS cannot repair.
- Verification (agent): Confirm each runtime object has a recorded creation, use, and deletion protocol, and that no path deletes an object another context can still reach. A delete without a preceding quiescence step is a finding.
- Verification (target): Test shutdown concurrent with pending work.
- Exceptions: A statically owned object MAY live for the whole system lifetime when deletion is prohibited by the project contract.

### RTOS-COMMON-PRIORITY-001 [MUST]

Resource-sharing code MUST use the project's documented priority-inversion policy, and a
priority change MUST have an explicit owner, bound, and restoration path.

- Applies when: Assigning task priorities, taking mutexes, configuring ceilings or inheritance, or changing scheduling thresholds.
- Rationale: An ad hoc priority change can mask inversion while starving higher-priority work or leaving a task at the wrong priority after an error.
- Verification (agent): Confirm shared resources use the project's inversion policy, and that any temporary priority change restores the saved value on every exit path including error branches.
- Verification (target): Measure the worst-case blocking interval under the configured policy.
- Exceptions: A temporary change MAY be used when the runtime documents its semantics and every exit path restores the saved priority.

### RTOS-COMMON-STACK-001 [MUST]

Each task and runtime callback MUST have a recorded stack bound that includes its deepest
reachable call path, library use, error paths, and configured runtime overhead.

- Applies when: Creating tasks, adding callbacks, changing logging or library calls, or changing stack configuration.
- Rationale: A task stack can overflow independently of the CPU stack and may corrupt runtime control blocks before detection.
- Verification (agent): Trace the deepest reachable path of each task and callback, including library calls and error branches, and compare against the configured size and margin. A task created with a size copied from an example is a finding.
- Verification (target): Measure the high-water mark with the target build while exercising the deepest paths.
- Exceptions: None for a changed path; an approved alternate stack measurement is required when the normal method cannot observe the context.

### RTOS-COMMON-LIFECYCLE-001 [MUST]

A task or callback MUST stop accepting new work before its resources are deleted, and all
in-flight users MUST observe completion or cancellation before reclamation.

- Applies when: Stopping tasks, unloading drivers, deleting queues, resetting subsystems, or reclaiming shared memory.
- Rationale: Teardown is a concurrent protocol; freeing the object first leaves pending wake-ups and callbacks with stale handles.
- Verification (agent): Confirm teardown stops accepting work before reclaiming anything, and that in-flight users observe completion or cancellation first. Reclamation ordered before quiescence is a finding.
- Verification (target): Test shutdown with queued work, blocked waiters, pending callbacks, a timeout, and repeated stop requests.
- Exceptions: A system-wide reset MAY terminate the protocol only when the reset boundary guarantees that no user code can run afterward.

## Module examples

See the larger [compliant](../../examples/RTOS-COMMON-BLOCK-001/compliant.c) and
[violating](../../examples/RTOS-COMMON-BLOCK-001/violation.c) examples.

Correct:

```c
#include <stdbool.h>
#include <stdint.h>

extern bool rtos_queue_receive(void *queue, void *item, uint32_t timeout_ticks);

bool worker_step(void *queue, uint32_t timeout_ticks)
{
    if (timeout_ticks == 0U) {
        return false;
    }
    return rtos_queue_receive(queue, 0, timeout_ticks); /* Caller handles timeout. */
}
```

Incorrect:

```c
void interrupt_callback(void *queue)
{
    /* An ISR cannot wait for a task-owned queue indefinitely. */
    rtos_queue_receive(queue, 0, RTOS_WAIT_FOREVER);
}
```
