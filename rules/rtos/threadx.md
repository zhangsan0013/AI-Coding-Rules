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
ISR-legal.

`TX_NO_WAIT` and status handling are separate requirements; this rule covers only the
selected port's service legality table.

- Applies when: Calling queues, semaphores, event flags, pools, timers, or scheduler services from an ISR.
- Rationale: ThreadX service legality depends on the selected port and version; a symbol that accepts an interrupt caller on one port may be illegal on another.
- Verification (agent): Trace every ThreadX call reachable from a handler and match it to the selected port's ISR-legal service table. Pass when no reachable service is absent from that table; artifact: ISR service table, port/version record, and call-graph report.
- Verification (target): Using the `PROJECT_RULES.md` `threadx-isr-legality` configuration, invoke each reachable service on the selected port with production interrupt entry. Pass when every listed service completes without an ISR-context assertion and no unlisted service is called in 100% of trials; artifact: ISR trace, port/version configuration, and assertion log.
- Exceptions: A service MAY be called from an ISR only when the exact version/port documents legality and wake behavior, with owner, scope, evidence, and review condition recorded.

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

    /* The selected port's service table lists tx_queue_send as ISR-legal. */
    (void)tx_queue_send(queue, &message, TX_NO_WAIT);
}
```

Incorrect:

```c
void sensor_isr(void *queue, uint32_t reading)
{
    (void)queue;
    (void)reading;
    tx_queue_delete(queue); /* this service is not listed as ISR-legal */
}
```

### RTOS-THREADX-ISR-002 [MUST]

A ThreadX service called from interrupt context MUST use `TX_NO_WAIT` whenever the service
accepts a wait option.

- Applies when: Calling a ThreadX queue, semaphore, event, timer, or pool service from an ISR that exposes a wait parameter.
- Rationale: An interrupt handler cannot block for a scheduler-owned resource; a nonzero wait option can suspend the current context or enter an unbounded wait path.
- Verification (agent): Inspect every ISR-reachable ThreadX call that takes a wait option. Pass when the argument is exactly `TX_NO_WAIT` or the selected port documents an equivalent non-wait value; artifact: ISR call-site table and wait-option report.
- Verification (target): Using the `PROJECT_RULES.md` `threadx-isr-wait` configuration, force each called resource to be unavailable or full. Pass when every ISR call returns immediately without entering a wait state in 100% of trials; artifact: scheduler trace, wait-option log, and configuration snapshot.
- Exceptions: A port-specific non-wait constant MAY replace `TX_NO_WAIT` only when its value and equivalent semantics are documented with version, owner, and review condition.

Correct:

```c
void sensor_isr(void *queue, uint32_t reading)
{
    uint32_t message = reading;
    (void)tx_queue_send(queue, &message, TX_NO_WAIT);
}
```

Incorrect:

```c
void sensor_isr(void *queue, uint32_t reading)
{
    uint32_t message = reading;
    (void)tx_queue_send(queue, &message, 10U); /* can wait from interrupt context */
}
```

### RTOS-THREADX-ISR-003 [MUST]

An interrupt handler MUST inspect and handle the returned status of every ThreadX service it
calls before returning.

- Applies when: A ThreadX ISR service can report success, full, unavailable, invalid, or another documented error status.
- Rationale: Queue-full and resource-unavailable statuses are normal interrupt-time outcomes; discarding them hides data loss or leaves the owner without a recovery signal.
- Verification (agent): Trace every ThreadX return value reachable from an ISR to a branch, counter, flag, or owner notification. Pass when no service status is discarded and every documented non-success status reaches its configured handling path; artifact: status-result table, control-flow report, and owner locations.
- Verification (target): Using the `PROJECT_RULES.md` `threadx-isr-status` configuration, inject success, full, unavailable, and error statuses at least 100 times per service. Pass when the observed handler action matches the configured status policy for every injection; artifact: ISR status trace, owner log, and configuration snapshot.
- Exceptions: A status MAY be ignored only when the selected API contract proves the result is impossible for the configured state and the proof, owner, and review condition are recorded.

Correct:

```c
void sensor_isr(void *queue, uint32_t reading)
{
    uint32_t message = reading;

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
    (void)tx_queue_send(queue, &message, TX_NO_WAIT); /* status is discarded */
}
```

A larger pair of examples is in
[examples/RTOS-THREADX-ISR-001](../../examples/RTOS-THREADX-ISR-001/).

### RTOS-THREADX-POOL-001 [MUST]

Memory from a ThreadX byte or block pool MUST be returned to the pool it came from, by its
owner, on every success, cancellation, timeout, and error path.

- Applies when: Allocating, passing, splitting, or releasing pool-backed buffers and messages.
- Rationale: `tx_byte_release` and `tx_block_release` take only the pointer and locate the owning pool from the block header. A pointer into the middle of a block, or one already released, corrupts that header and the damage appears in an unrelated allocation later.
- Verification (agent): Track each pool allocation to release on every success, cancellation, timeout, and error path; compare the release pointer with the returned block boundary and record failed-handoff ownership. Pass when each allocation has exactly one matching release; artifact: pool ownership ledger and path report.
- Verification (target): Inject exhaustion, cancellation, failed handoff, and double release. Pass when exhaustion/cancellation are reported, double release is rejected or asserted, and subsequent allocations remain valid; artifact: pool trace and status log.
- Exceptions: A wrapper MAY transfer ownership only when it preserves pool identity, block boundary, release responsibility, owner, and review condition in its interface contract.

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

    /* The contract makes frame_transmit synchronous; ownership remains with this function. */
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
