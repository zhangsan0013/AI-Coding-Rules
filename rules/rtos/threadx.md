# ThreadX Adapter Rules

Status: provisional

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

These bind [RTOS common](common.md) to specific ThreadX APIs and port behavior. Context
legality, blocking contracts, object lifecycle, priority-inversion policy, and thread stack
bounds are in that module and are not restated here.

### RTOS-THREADX-ISR-001 [MUST]

A ThreadX service called from interrupt context MUST be one the selected port documents as
ISR-legal, MUST use `TX_NO_WAIT`, and its returned status MUST be inspected.

`TX_NO_WAIT` makes a call non-blocking; it does not make it legal. The two are separate
properties, and only the port's service table settles the second.

- Applies when: Calling queues, semaphores, event flags, pools, timers, or scheduler services from an ISR.
- Rationale: This is the concrete form `RTOS-COMMON-CONTEXT-001` takes in ThreadX. Because most services accept a wait option from either context, `TX_NO_WAIT` reads as sufficient evidence of ISR safety when it is only half of it. Discarding the status then hides `TX_QUEUE_FULL`, which is the normal result under load rather than an exceptional one.
- Verification (agent): For each ThreadX call reachable from a handler, confirm the service appears in the port's ISR-legal table, that the wait option is `TX_NO_WAIT`, and that the returned status reaches a branch. A discarded status or an unlisted service is a finding.
- Verification (target): Test the success, full, and error results, including a queue that is full when the interrupt fires.
- Exceptions: A service MAY be called from an ISR when the exact version and port document that operation and its wake-up behavior.

Correct:

```c
#include <stdint.h>

#define TX_SUCCESS 0x00U
#define TX_NO_WAIT 0x00000000U

extern unsigned int tx_queue_send(void *queue, void *source, unsigned long wait);
extern void platform_record_queue_full_from_isr(void);

void sensor_isr(void *queue, uint32_t reading)
{
    uint32_t message = reading;

    /* The port's service table lists tx_queue_send as ISR-legal with TX_NO_WAIT. */
    if (tx_queue_send(queue, &message, TX_NO_WAIT) != TX_SUCCESS) {
        platform_record_queue_full_from_isr();
    }
}
```

Incorrect:

```c
void sensor_isr(void *queue, uint32_t reading)
{
    uint32_t message = reading;

    /* TX_NO_WAIT is present, but the status is dropped: a full queue loses the sample. */
    (void)tx_queue_send(queue, &message, TX_NO_WAIT);
}
```

A larger pair of examples is in
[examples/RTOS-THREADX-ISR-001](../../examples/RTOS-THREADX-ISR-001/).

### RTOS-THREADX-POOL-001 [MUST]

Memory from a ThreadX byte or block pool MUST be returned to the pool it came from, by its
owner, on every success, cancellation, timeout, and error path.

- Applies when: Allocating, passing, splitting, or releasing pool-backed buffers and messages.
- Rationale: `tx_byte_release` and `tx_block_release` take only the pointer and locate the owning pool from the block header. A pointer into the middle of a block, or one already released, corrupts that header and the damage appears in an unrelated allocation later.
- Verification (agent): Track each allocated pointer to a release on every branch, including early returns and error paths. Confirm the released pointer is the one allocation returned, not an offset into it, and that ownership after a failed handoff is stated.
- Verification (target): Inject exhaustion, cancellation, and a double release, and confirm subsequent allocations still behave.
- Exceptions: A wrapper MAY transfer ownership when its interface preserves the pool identity, the block boundary, and the release responsibility.

Correct:

```c
#define TX_SUCCESS 0x00U

extern unsigned int tx_byte_allocate(void *pool, void **memory, unsigned long size, unsigned long wait);
extern unsigned int tx_byte_release(void *memory);
extern unsigned int frame_transmit(void *frame, unsigned long size);

unsigned int send_frame(void *pool, unsigned long size)
{
    void *frame = 0;
    unsigned int status = tx_byte_allocate(pool, &frame, size, 100U);

    if (status != TX_SUCCESS) {
        return status;
    }

    status = frame_transmit(frame, size);
    (void)tx_byte_release(frame);   /* released on both the success and failure paths */
    return status;
}
```

Incorrect:

```c
unsigned int send_frame(void *pool, unsigned long size)
{
    void *frame = 0;

    if (tx_byte_allocate(pool, &frame, size, 100U) != TX_SUCCESS) {
        return 1U;
    }

    if (frame_transmit(frame, size) != TX_SUCCESS) {
        return 1U;   /* leaks the block, and the pool never recovers it */
    }

    (void)tx_byte_release((char *)frame + 4);   /* not the pointer allocation returned */
    return 0U;
}
```

