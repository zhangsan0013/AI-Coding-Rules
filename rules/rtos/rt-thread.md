# RT-Thread Adapter Rules

Status: provisional

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

These bind [RTOS common](common.md) to specific RT-Thread APIs and BSP behavior. Context
legality, blocking contracts, object lifecycle, priority-inversion policy, and thread stack
bounds are in that module and are not restated here.

### RTOS-RTTHREAD-ISR-001 [MUST]

An RT-Thread service reachable from interrupt context MUST appear on the ISR-safe list
recorded for the selected version and BSP, and MUST be called in a non-waiting form.

RT-Thread does not mark ISR-callable services with a distinguishing suffix, so the recorded
list is the only contract. A familiar function name is not evidence.

- Applies when: Calling IPC, synchronization, scheduler, memory, or device services from an ISR or an interrupt callback.
- Rationale: This is the concrete form `RTOS-COMMON-CONTEXT-001` takes in RT-Thread. Because the API surface looks identical from both contexts, the usual failure is calling a waiting service from a handler, where `RT_WAITING_FOREVER` deadlocks with no schedulable context to wait in.
- Verification (agent): Trace each RT-Thread call reachable from a handler, match it to the version/BSP ISR-safe list, and check `RT_WAITING_NO` or an explicitly non-waiting contract. Pass when every call is listed and every result path is handled; artifact: ISR call table and source report.
- Verification (target): Exercise full, empty, and wake-up results on the selected BSP. Pass when the handler never waits and each result matches the recorded status policy; artifact: BSP configuration and ISR trace.
- Exceptions: A service MAY be used only when the exact version/BSP documents ISR legality and result semantics, with owner, scope, evidence, and review condition recorded.

Correct:

```c
#include <stdint.h>

extern int project_rtthread_mailbox_send_from_isr(void *mailbox, uint32_t value);

void sensor_isr(void *mailbox, uint32_t value)
{
    /* PROJECT_RULES records this wrapper and its non-blocking result for this BSP. */
    (void)project_rtthread_mailbox_send_from_isr(mailbox, value);
}
```

Incorrect:

```c
void sensor_isr(void *mailbox, const void *message)
{
    /* A waiting send has no ISR contract, and the name does not reveal that. */
    (void)rt_mb_send(mailbox, message, RT_WAITING_FOREVER);
}
```

A larger pair of examples is in
[examples/RTOS-RTTHREAD-ISR-001](../../examples/RTOS-RTTHREAD-ISR-001/).

### RTOS-RTTHREAD-IPC-001 [MUST]

An RT-Thread IPC operation MUST state whether it copies a value or transfers a pointer, and
the producer MUST retain or release the storage according to that contract.

- Applies when: Using mailboxes, message queues, memory pools, signals, or a wrapper over them.
- Rationale: RT-Thread mailboxes carry a pointer-sized value while message queues copy the payload, and both take a `void *`. Passing a stack buffer to a mailbox leaves the receiver a dangling pointer; treating a copied message as owned storage double-releases it. The type system catches neither.
- Verification (agent): For each IPC send, record copy/transfer semantics, storage duration, and release owner on accepted and rejected paths. Pass when no pointer outlives storage and each block is released exactly once; artifact: IPC ownership table and path report.
- Verification (target): Exercise full, empty, rejected, and shutdown paths. Pass when accepted messages are readable by the receiver and rejected messages are reclaimed once with no leak/double release; artifact: pool trace and IPC result log.
- Exceptions: A wrapper MAY change ownership only when its interface, owner, boundary, evidence, and review condition document the new model and both sides are tested.

Correct:

```c
#include <stdint.h>

extern void *sample_pool_alloc(void);
extern void sample_pool_free(void *block);
extern int rt_mb_send(void *mailbox, uint32_t value, int32_t timeout);

int publish_sample(void *mailbox, uint32_t reading)
{
    uint32_t *block = sample_pool_alloc();   /* pool storage outlives this frame */

    if (block == 0) {
        return -1;
    }

    *block = reading;
    if (rt_mb_send(mailbox, (uint32_t)(uintptr_t)block, 0) != 0) {
        sample_pool_free(block);   /* rejected: the producer still owns it */
        return -1;
    }

    return 0;   /* accepted: the receiver owns it now */
}
```

Incorrect:

```c
int publish_sample(void *mailbox, uint32_t reading)
{
    uint32_t local = reading;

    /* A mailbox transfers the pointer; this one dangles as soon as we return. */
    return rt_mb_send(mailbox, (uint32_t)(uintptr_t)&local, 0);
}
```
