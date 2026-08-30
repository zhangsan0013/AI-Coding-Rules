# Interrupt Rules

Status: provisional

## Scope

Interrupt context: which operations a handler may call, how long it may run, how it hands
data to another context, and how its vector and source are configured.

## Load when

Changing an interrupt handler or code reachable from interrupt context.

## Related modules

Load these alongside this module. This module does not restate their rules.

- [Concurrency](concurrency.md) — the synchronization, critical-section, and publication
  protocols a handler shares with every other context.
- [Timeout and errors](timeout-and-errors.md) — the bound required of any loop, poll, or
  retry, including one inside a handler.
- [Memory](memory.md) — the stack budget the deepest nested interrupt path has to fit.

## Project facts this module depends on

- The operations the toolchain, libraries, and RTOS document as callable from interrupt
  context, with their failure, full, and overflow semantics.
- Whether nesting is enabled, the priority of each vector, and the priority encoding and
  mask or threshold semantics.
- How the platform signals a task from interrupt context.
- The worst-case duration and latency budget for each handler.
- The atomic widths and memory-ordering adapter that are safe from interrupt context.

Record these in `PROJECT_RULES.md`. Where a fact is unknown, mark it `unknown` rather than
assuming a default; several rules below change behavior depending on it.

## Rules

### EMB-ISR-BOUND-001 [MUST]

An interrupt handler MUST call only operations the platform or project documents as callable
from its exact interrupt context.

- Applies when: Writing or reviewing a handler or anything reachable from it, including wrappers, callbacks, function-pointer targets, error paths, and RTOS adapters.
- Rationale: Context legality is a property of the exact interrupt entry and runtime port. An `ISR-safe` name alone is not evidence that a call is legal in this exact context.
- Verification (agent): Enumerate the transitive call graph including indirect calls and error paths, then match every operation to the ISR-safe list for the exact context. Pass when every reachable call is documented as callable from that context; artifact: call graph, ISR-safe table, and source locations.
- Verification (target): Using the `PROJECT_RULES.md` `isr-call-context` configuration with production optimization, exercise every reachable call under interrupt entry, nested interrupt, and error paths. Pass when every trace contains only operations listed as legal for the entered context in 100% of runs; artifact: trace log and configuration snapshot.
- Exceptions: A primitive or wrapper MAY be used only when its exact context, failure semantics, owner, and review condition are recorded in `PROJECT_RULES.md`.

Correct:

```c
#include <stdbool.h>
#include <stdint.h>

extern uint8_t platform_uart_read_data_from_isr(void);
extern bool platform_rx_try_put_from_isr(uint8_t byte);
extern void platform_record_rx_drop_from_isr(void);

void uart_isr(void)
{
    uint8_t byte = platform_uart_read_data_from_isr();

    /* PROJECT_RULES lists both adapters as legal for this exact ISR context. */
    if (!platform_rx_try_put_from_isr(byte)) {
        platform_record_rx_drop_from_isr();
    }
}
```

Incorrect:

```c
void uart_isr(void)
{
    uint8_t byte = platform_uart_read_data(); /* task-context entry is not documented for ISR use */
    (void)platform_rx_try_put(byte);
}
```

### EMB-ISR-NOWAIT-001 [MUST]

Every operation reachable from an interrupt handler MUST return without blocking or waiting
for a scheduler-owned resource.

- Applies when: Writing or reviewing a handler or anything reachable from it, including wrappers, callbacks, function-pointer targets, error paths, and RTOS adapters.
- Rationale: An interrupt has no schedulable context to block in, so a blocking call can deadlock or extend interrupt latency without bound even when its timeout is zero.
- Verification (agent): Enumerate the transitive call graph and classify each reachable operation by whether it can wait for a scheduler-owned resource. Pass when no reachable path enters a wait, block, or scheduler-owned lock operation; artifact: wait-capability table, call graph, and source locations.
- Verification (target): Using the `PROJECT_RULES.md` `isr-no-wait` configuration, force resources unavailable, full, and contended at each interrupt call. Pass when every handler path returns without waiting, yielding, or acquiring a scheduler-owned resource in 100% of runs; artifact: scheduler trace and configuration snapshot.
- Exceptions: A documented ISR-exit notification MAY touch scheduler state only when the platform explicitly defines it as a non-waiting interrupt operation, with owner and review condition recorded in `PROJECT_RULES.md`.

Correct:

```c
void uart_isr(void)
{
    uint8_t byte = platform_uart_read_data_from_isr();

    if (!platform_rx_try_put_from_isr(byte)) {
        platform_record_rx_drop_from_isr();
    }
}
```

Incorrect:

```c
void uart_isr(void)
{
    uint8_t byte = UART0->DATA;

    printf("%c", byte);                             /* may take a stdio lock */
    xSemaphoreTake(&rx_mutex, 0U);                   /* zero timeout does not make the wait ISR-safe */
}
```

### EMB-ISR-API-001 [MUST]

Where a platform provides an interrupt-specific entry point for an operation, interrupt
code MUST use that entry point instead of the task-context variant.

- Applies when: A platform, library, or RTOS exposes paired task-context and interrupt-context APIs.
- Rationale: A zero timeout can avoid one wait branch while the task-context implementation still touches scheduler or locking state that is illegal from an interrupt.
- Verification (agent): Inventory every paired API reachable from each handler and compare the selected symbol with the platform/port ISR API table. Pass when every available interrupt-specific operation uses its documented interrupt entry point; artifact: API-variant matrix, call graph, and source locations.
- Verification (target): Using the `PROJECT_RULES.md` `isr-api-variants` configuration, force each paired call through the production build and trigger success, full, and unavailable outcomes. Pass when the trace identifies only the documented interrupt entry point and no task-context implementation is entered in 100% of trials; artifact: symbol map, trace log, and configuration snapshot.
- Exceptions: A task-context entry point MAY be used only when the platform documents that no interrupt-specific variant exists and the exact context, non-blocking proof, owner, and review condition are recorded in `PROJECT_RULES.md`.

Correct:

```c
void dma_done_isr(void)
{
    BaseType_t woke = pdFALSE;

    vTaskNotifyGiveFromISR(dma_task_handle, &woke);
    portYIELD_FROM_ISR(woke);
}
```

Incorrect:

```c
void dma_done_isr(void)
{
    xTaskNotifyGive(dma_task_handle); /* task-context variant is used from an ISR */
}
```

### EMB-ISR-RESULT-001 [MUST]

Each operation reachable from an interrupt handler MUST expose and handle its documented
failure, full, or overflow result before the handler returns.

- Applies when: An interrupt operation can reject data, encounter a full queue, overflow a counter, or report a hardware/service failure.
- Rationale: An interrupt has no caller to propagate an ignored result; silently discarding a full or failure status converts a bounded resource condition into data loss without an observable owner decision.
- Verification (agent): Map every fallible ISR call to its result set and inspect all handler exits. Pass when each failure, full, and overflow result reaches a documented counter, flag, drop/coalesce action, or owner notification before return; artifact: ISR result table, path report, and owner read locations.
- Verification (target): Using the `PROJECT_RULES.md` `isr-result` configuration, inject each documented failure, full, and overflow condition at least 100 times. Pass when the observed owner record and drop/coalesce behavior match the configured result policy for every injection; artifact: injected-result trace, owner log, and configuration snapshot.
- Exceptions: A result MAY be intentionally ignored only when the platform documents it as impossible for the configured state and the proof, owner, and review condition are recorded in `PROJECT_RULES.md`.

Correct:

```c
void uart_isr(void)
{
    uint8_t byte = platform_uart_read_data_from_isr();

    if (!platform_rx_try_put_from_isr(byte)) {
        platform_record_rx_drop_from_isr(); /* full result is observable */
    }
}
```

Incorrect:

```c
void uart_isr(void)
{
    uint8_t byte = platform_uart_read_data_from_isr();

    (void)platform_rx_try_put_from_isr(byte); /* full result is discarded */
}
```

### EMB-ISR-REENTRANCY-001 [MUST]

A handler MUST NOT call a function that keeps static or global mutable state unless the
project records it as re-entrant for the configured toolchain, or records that nesting is
disabled and no other context calls it.

- Applies when: Calling library or project code from interrupt context.
- Rationale: A handler that preempts the same function mid-update corrupts the state it owns, and the corruption surfaces far from its cause. `malloc`, `printf`, `strtok`, and `errno`-setting functions are the common cases.
- Verification (agent): Check each called function against toolchain/library re-entrancy documentation and record the verdict, state ownership, and nesting assumption in the ISR-safe call list. Pass when every mutable static/global state has a re-entrant proof or an exclusive caller; artifact: call list and documentation citations.
- Verification (target): Using the `PROJECT_RULES.md` `isr-reentrancy` configuration, validate the recorded re-entrancy/ownership contract as part of `EMB-ISR-BOUND-001`. Pass when the production call graph contains no undocumented mutable-state callee in 100% of reachable paths; artifact: reviewed call list and configuration snapshot.
- Exceptions: Recorded re-entrancy or single-caller use with nesting disabled MAY be used only with owner, function scope, evidence, and re-enable/review condition recorded.

Correct:

```c
void timer_isr(void)
{
    ringbuf_put_isr(&trace_buffer, next_trace_byte());   /* owns no shared static state */
}
```

Incorrect:

```c
void timer_isr(void)
{
    char *line = malloc(32);              /* allocator state is not re-entrant */
    snprintf(line, 32, "t=%lu", tick);    /* formatted output is not re-entrant here */
    strtok(line, "=");                    /* strtok keeps static state between calls */
}
```

### EMB-ISR-DURATION-001 [MUST]

A handler MUST have a worst-case duration that fits the latency budget recorded for its
priority. That duration is the sum of the bounded operations on its longest path, so a
handler MUST NOT contain an operation whose upper bound is unknown.

`EMB-ERR-BOUNDS-001` requires each individual loop, poll, and retry to carry a finite bound.
This rule is about their composition: bounds that are individually finite can still add up
past the budget.

- Applies when: Adding work to a handler, or changing a bound, clock, or wait-state setting that affects one.
- Rationale: A handler runs with equal- and lower-priority interrupts masked. A latency claim cannot be reviewed from one loop at a time, because the total is what starves the rest of the system.
- Verification (agent): Sum recorded worst-case durations along the longest reachable path and compare with the priority budget. Pass when every operation has a finite bound and the total is at or below budget minus the recorded margin; artifact: path-duration table and margin calculation.
- Verification (target): Using the `PROJECT_RULES.md` `isr-latency` configuration with the production clock, compiler, and wait states, measure entry-to-exit duration. Pass when the maximum of the recorded sample set is no greater than the budget and the margin remains non-negative for every enabled vector; artifact: timing capture, map, and configuration snapshot.
- Exceptions: A handler MAY exceed the nominal budget only when affected lower-priority work, tolerated maximum delay, owner, and review condition are recorded.

Correct:

```c
#include <stdbool.h>
#include <stdint.h>

/* PROJECT_RULES: SPI0_TX budget 3 us; this poll is bounded at 16 iterations = 1.2 us. */
#define ISR_SPI_MAX_ITERATIONS 16U

extern uint32_t platform_spi_status_from_isr(void);
extern void platform_spi_record_timeout_from_isr(void);

bool spi_wait_tx_empty_from_isr(void)
{
    for (uint32_t i = 0U; i < ISR_SPI_MAX_ITERATIONS; i++) {
        if ((platform_spi_status_from_isr() & SPI_SR_TXE) != 0U) {
            return true;
        }
    }

    platform_spi_record_timeout_from_isr();
    return false;
}
```

Incorrect:

```c
void spi_isr(void)
{
    while ((SPI0->SR & SPI_SR_TXE) == 0U) {   /* no bound, so no budget can be checked */
        ;
    }
}
```

### EMB-ISR-DEFER-001 [SHOULD]

A handler SHOULD capture the event, record the minimum state, acknowledge the source, and
signal the owning context. Work that does not need interrupt context SHOULD run outside it.

- Applies when: A handler does more than capture, acknowledge, and signal.
- Rationale: Every instruction in a handler delays all equal- and lower-priority work, so a short handler keeps the latency budget in `EMB-ISR-DURATION-001` reviewable as the system grows.
- Verification (agent): Classify each handler operation as capture, acknowledge, signal, or deferrable work. Pass when all non-required work is moved out of the handler or has a documented budget justification; artifact: handler operation table and call graph.
- Verification (target): Using the `PROJECT_RULES.md` `isr-deferral` configuration, reuse the duration measurement from `EMB-ISR-DURATION-001`. Pass when the handler's measured duration and latency remain within the recorded budget after deferral for every enabled vector; artifact: timing capture, deferred-work trace, and configuration snapshot.
- Exceptions: A handler MAY complete work in context only when owner, work item, measured duration, latency budget, and review condition are recorded.

Correct:

```c
void adc_isr(void)
{
    uint32_t sample = ADC0->RESULT;
    (void)sample_queue_try_put_from_isr(sample); /* filtering is deferred */
}
```

Incorrect:

```c
void adc_isr(void)
{
    uint32_t sample = ADC0->RESULT;
    apply_filter_and_update_display(sample); /* deferrable work extends the handler */
}
```

### EMB-ISR-SIGNAL-001 [MUST]

A handler MUST signal the owning context with the primitive the platform documents as
callable from interrupt context, and MUST issue the platform's ISR-exit reschedule request
where the API defines one.

- Applies when: A handler notifies a task, sets an event, or releases a synchronization object.
- Rationale: The task-context variant may block and usually omits the scheduler interaction interrupt exit requires. It fails as a missed or late wake-up rather than as an error, which is why review has to catch it.
- Verification (agent): Match each signalling call to the ISR-safe list and inspect all returns for the required reschedule argument and action. Pass when every API-defined wake flag reaches the ISR-exit yield path; artifact: call-site/control-flow report.
- Verification (target): Using the `PROJECT_RULES.md` `isr-signal` configuration, deliver isolated, back-to-back, and burst events to a higher-priority waiter. Pass when the owner wakes once per accepted event and, where required, runs before the next tick in 100% of accepted events; artifact: scheduler trace, event sequence log, and configuration snapshot.
- Exceptions: A primitive MAY be used from both contexts only when the exact entry point, wake semantics, owner, and review condition are documented.

Correct:

```c
void dma_done_isr(void)
{
    BaseType_t woke = pdFALSE;

    vTaskNotifyGiveFromISR(dma_task_handle, &woke);
    portYIELD_FROM_ISR(woke);
}
```

Incorrect:

```c
void dma_done_isr(void)
{
    xTaskNotifyGive(dma_task_handle);   /* task-context variant, omits the ISR yield */
}
```

### EMB-ISR-SHARED-001 [MUST]

State shared between a handler and another context MUST use a synchronization model whose
primitives are callable from interrupt context. `volatile` alone MUST NOT be used to
synchronize ordinary RAM.

`EMB-CONC-RACE-001` and `EMB-CONC-PUBLISH-001` define the protocol and the visibility edge.
This rule adds the constraint the interrupt boundary imposes on them: the primitives must be
ISR-callable.

- Applies when: Declaring or accessing a message, queue, snapshot, counter, or flag shared between interrupt and non-interrupt code.
- Rationale: `volatile` makes an access visible but does not make a read-modify-write atomic, establish a happens-before edge, or make several atomic fields one consistent update.
- Verification (agent): For each shared object, list all readers/writers, synchronization model, and the ISR-safe primitive used at every access. Pass when every cross-context access is covered by one documented ISR-callable atomic, lock-free, critical-section, queue, or snapshot protocol and no `volatile`-only handoff remains; artifact: shared-state matrix, primitive table, and source scan.
- Verification (target): Using the `PROJECT_RULES.md` `isr-shared-state` configuration, exercise concurrent handler and consumer access under the target memory model for at least 100 handoffs. Pass when no torn or out-of-protocol snapshot is observed in 100% of runs; artifact: event sequence trace, synchronization assertions, and configuration snapshot.
- Exceptions: `volatile` MAY be retained for MMIO only when the field is documented as MMIO. Another model MAY be used only with owner, ordering, atomicity, failure policy, and review condition recorded in `PROJECT_RULES.md`.

Usual models: ownership transfer through an SPSC buffer or mailbox, an ISR-safe atomic flag
or counter, a bounded critical section, an RTOS ISR primitive, or a double-buffered snapshot.

Correct:

```c
/*
 * SPSC ownership transfer. The producer publishes a filled slot with a release store; the
 * consumer acquire-loads the index before reading it. One slot stays reserved so full and
 * empty are distinguishable, and a full buffer drops the sample observably.
 *
 * The platform_sync_* functions are the synchronization seam: each must provide an
 * ISR-safe atomic access with the stated ordering. A volatile qualifier is not a
 * substitute for that contract.
 */

#include <stdbool.h>
#include <stdint.h>

#define ISR_SAMPLE_RING_SLOTS 8U

extern uint32_t platform_sync_load_relaxed_u32(const uint32_t *object);
extern uint32_t platform_sync_load_acquire_u32(const uint32_t *object);
extern void platform_sync_store_release_u32(uint32_t *object, uint32_t value);
extern uint32_t platform_adc_read_result_from_isr(void);
extern void platform_record_sample_drop_from_isr(void);

static uint32_t sample_head = 0U;
static uint32_t sample_tail = 0U;
static uint32_t sample_buffer[ISR_SAMPLE_RING_SLOTS] = {0U};

void adc_isr(void)
{
    uint32_t head = platform_sync_load_relaxed_u32(&sample_head);
    uint32_t tail = platform_sync_load_acquire_u32(&sample_tail);
    uint32_t next = (head + 1U) % ISR_SAMPLE_RING_SLOTS;

    if (next == tail) {
        platform_record_sample_drop_from_isr();   /* recorded policy: drop the newest */
        return;
    }

    sample_buffer[head] = platform_adc_read_result_from_isr();
    platform_sync_store_release_u32(&sample_head, next);
}

bool sample_take(uint32_t *value)
{
    uint32_t tail = platform_sync_load_relaxed_u32(&sample_tail);
    uint32_t head = platform_sync_load_acquire_u32(&sample_head);

    if (tail == head) {
        return false;
    }

    *value = sample_buffer[tail];
    platform_sync_store_release_u32(&sample_tail, (tail + 1U) % ISR_SAMPLE_RING_SLOTS);
    return true;
}
```

Incorrect:

```c
/* Volatile accesses are visible, but there is no publication or snapshot protocol. */
static volatile uint32_t last_sample = 0U;
static volatile uint32_t last_timestamp = 0U;
static volatile bool sample_ready = false;

extern uint32_t platform_adc_read_result_from_isr(void);
extern uint32_t platform_ticks_read_from_isr(void);

void adc_isr(void)
{
    last_sample = platform_adc_read_result_from_isr();
    last_timestamp = platform_ticks_read_from_isr();
    sample_ready = true;   /* no release edge, and repeated events overwrite silently */
}

bool sample_read(uint32_t *sample, uint32_t *timestamp)
{
    if (!sample_ready) {
        return false;
    }

    *sample = last_sample;
    *timestamp = last_timestamp;   /* the pair can come from different events */
    sample_ready = false;          /* this clear can lose a concurrent ISR event */
    return true;
}
```

### EMB-ISR-SHARED-002 [MUST]

An interrupt-to-context handoff MUST define and implement one observable policy for a full,
empty, overflow, or otherwise undeliverable event: drop, coalesce, or overwrite.

- Applies when: A handler can produce an event faster than the receiving queue, ring, mailbox, or snapshot can accept it.
- Rationale: A handler cannot block or retry indefinitely, so an unrecorded full condition silently loses or corrupts data and leaves the owner unable to distinguish loss from inactivity.
- Verification (agent): Identify the capacity boundary and the configured loss policy for each handoff. Pass when every rejected or superseded event follows exactly one documented drop, coalescing, or overwrite branch and records any required loss indicator; artifact: capacity/state table, result-path report, and owner contract.
- Verification (target): Using the `PROJECT_RULES.md` `isr-event-policy` configuration, inject empty, full, overflow, and back-to-back traffic for at least 100 events per boundary. Pass when the observed accepted, dropped, coalesced, and overwritten counts equal the configured policy and all required loss indicators are present; artifact: event trace, counter log, and configuration snapshot.
- Exceptions: A lossless policy MAY be claimed only when the target capacity and producer-rate bound prove no overflow for the configured operating envelope, with owner, calculation, and review condition recorded.

Correct:

```c
if (!sample_queue_try_put_from_isr(sample)) {
    platform_record_sample_drop_from_isr(); /* policy: drop newest */
}
```

Incorrect:

```c
(void)sample_queue_try_put_from_isr(sample); /* full result and loss policy disappear */
```

A larger pair of examples is in
[examples/EMB-ISR-SHARED-001](../../examples/EMB-ISR-SHARED-001/).

### EMB-ISR-NESTING-001 [MUST]

When two handlers, or a handler and a critical section, can touch the same object or
peripheral while nesting is enabled, the chosen mask or ownership model MUST cover every
conflicting accessor, including the highest-priority one.

- Applies when: Two or more contexts touch the same object or peripheral and at least one is a handler that can be preempted.
- Rationale: A mask that covers only the current and lower priorities lets a conflicting higher-priority handler observe a half-updated object or peripheral command.
- Verification (agent): For each shared object or peripheral, list every handler and critical section and compare the selected mask or ownership adapter with all accessors. Pass when the selected model covers every conflicting accessor; artifact: accessor/mask matrix and adapter contract.
- Verification (target): Using the `PROJECT_RULES.md` `isr-nesting` configuration, trigger each conflicting context during the protected operation. Pass when no partial update or peripheral command is observed and the saved mask state is restored in 100% of trials; artifact: nested-interrupt trace, state assertions, and configuration snapshot.
- Exceptions: Disabling nesting, using a global mask, or using a lock-free model MAY be used only when configuration, covered accessors, latency bound, owner, and review condition are recorded.

Correct:

```c
/*
 * PROJECT_RULES records that UART_RX and SPI_TX both touch trace_log, that nesting is
 * enabled, and that this adapter's ceiling covers both. The token restores the caller's
 * previous state, as EMB-CONC-CRITICAL-001 requires.
 */
extern uint32_t platform_trace_log_mask_from_isr(void);
extern void platform_irq_restore(uint32_t state);
extern void platform_trace_log_append_from_isr(const char *text);

void uart_rx_isr(void)
{
    uint32_t state = platform_trace_log_mask_from_isr();

    platform_trace_log_append_from_isr("rx");
    platform_irq_restore(state);
}
```

Incorrect:

```c
/* This adapter masks only the current and lower logical priorities. */
extern uint32_t platform_irq_mask_at_current_priority(void);
extern void platform_irq_restore(uint32_t state);
extern void platform_trace_log_append_from_isr(const char *text);

void uart_rx_isr(void)
{
    uint32_t state = platform_irq_mask_at_current_priority();

    platform_trace_log_append_from_isr("rx");   /* SPI_TX can still preempt this */
    platform_irq_restore(state);
}
```

### EMB-ISR-NESTING-002 [MUST]

The project MUST record the target's interrupt-priority encoding and mask or threshold
semantics used to establish the nesting coverage of each protected object or peripheral.

- Applies when: Configuring interrupt priorities, mask thresholds, priority ceilings, or ownership adapters for nested handlers.
- Rationale: Targets differ in whether a lower number means higher priority and in whether a mask value is a ceiling, threshold, or bit mask; an unrecorded interpretation cannot prove coverage.
- Verification (agent): Compare the configured logical priorities and encoded values with the target port definition and the mask primitive's documented semantics. Pass when every nesting proof cites the encoding, threshold direction, and covered priority set; artifact: priority-encoding table, port definition, and nesting proof.
- Verification (target): Using the `PROJECT_RULES.md` `isr-priority-encoding` configuration, program the lowest and highest covered priorities plus the first uncovered priority. Pass when the covered cases are blocked during the protected interval and the first uncovered case is observed only where the ownership model permits it, with zero encoding mismatches in 100% of trials; artifact: interrupt-controller trace, register dump, and configuration snapshot.
- Exceptions: A generated priority adapter MAY hide the encoding only when its version, generated table, mask semantics, owner, and review condition are recorded.

Correct:

```text
Target: Cortex-M, 3 priority bits, 0 = highest logical priority.
Mask: BASEPRI=5 blocks encoded priorities 5..7; UART_RX=6 and SPI_TX=7 are covered.
```

Incorrect:

```text
UART_RX priority 6 is "high enough"; no target encoding or BASEPRI threshold is recorded.
```

### EMB-ISR-CLEAR-001 [MUST]

A handler MUST acknowledge its interrupt source at the point the hardware requires and
before returning, and the project MUST record that point for each vector.

- Applies when: Writing or changing a handler that acknowledges a peripheral or controller interrupt.
- Rationale: Acknowledging before the hardware latches the event loses it; acknowledging late or not at all re-enters the handler immediately and starves everything below it.
- Verification (agent): Match each handler's acknowledge sequence and every early-return path to the vector's recorded hardware point. Pass when all exits acknowledge exactly once or follow the documented shared-source protocol; artifact: handler path report and vector table.
- Verification (target): Using the `PROJECT_RULES.md` `isr-acknowledge` configuration, test back-to-back and pending events against the reference manual/errata sequence. Pass when each event is serviced once and no immediate re-entry or lost event occurs in 100% of trials; artifact: interrupt trace, register log, and configuration snapshot.
- Exceptions: A handler MAY defer acknowledge only when the hardware's level-sensitive/shared-source requirement, owner, sequence, and review condition are recorded.

Correct:

```c
void uart_isr(void)
{
    uint8_t byte = UART0->DATA;   /* the manual defines this read as the acknowledge */

    ringbuf_put_isr(&rx_buffer, byte);
}
```

Incorrect:

```c
void gpio_isr(void)
{
    handle_button();
    /* the pending flag is never cleared, so the handler re-enters immediately */
}
```

### EMB-ISR-INIT-001 [MUST]

An interrupt MUST be enabled only after its handler is installed, the state that handler
touches is initialized, and any pending flag left by configuration is cleared.

- Applies when: Initializing a peripheral, installing a handler, or re-enabling an interrupt after reconfiguration.
- Rationale: Enabling first lets the handler run against uninitialized state or a stale pending flag, producing a fault whose cause is gone before anyone can observe it.
- Verification (agent): Inspect the initialization control-flow and prove handler installation, state initialization, and pending clear dominate every enable write. Pass when enable is last on every path; artifact: initialization path report and register-write order.
- Verification (target): Using the `PROJECT_RULES.md` `isr-enable-order` configuration, cold-start with the source already asserted and compare the sequence with the manual/errata. Pass when no handler runs before initialization and the first asserted event is handled once in 100% of boots; artifact: boot/interrupt trace and configuration snapshot.
- Exceptions: An interrupt MAY be enabled earlier only when the hardware clause proves no pending flag can arise, with vector, owner, citation, and review condition recorded.

Correct:

```c
static void uart_isr(void);

void uart_rx_start(void)
{
    ringbuf_init(&rx_buffer);
    install_handler(IRQ_UART0, uart_isr);
    (void)UART0->DATA;          /* drop any byte latched during configuration */
    UART0->IER = UART_IER_RX;   /* enable last */
}
```

Incorrect:

```c
static void uart_isr(void);

void uart_rx_start(void)
{
    UART0->IER = UART_IER_RX;   /* enabled before the buffer or handler exists */
    ringbuf_init(&rx_buffer);
    install_handler(IRQ_UART0, uart_isr);
}
```

### EMB-ISR-VECTOR-001 [MUST]

Every vector the hardware can take MUST resolve to a defined handler, and the handler for an
unexpected source MUST record the event and leave the controller in a defined state rather
than spinning or returning silently.

- Applies when: Populating or changing a vector table, or writing the shared default handler.
- Rationale: A vector that returns without acknowledging re-enters forever, and one that spins hangs the system. Either turns a configuration mistake into a symptom that looks nothing like its cause.
- Verification (agent): Compare every hardware-takeable vector with the table and inspect the default path for event recording plus defined pending-state handling. Pass when no vector is unresolved and no default path spins/returns silently; artifact: vector inventory and handler report.
- Verification (target): Using the `PROJECT_RULES.md` `isr-vector-default` configuration, force each unexpected source. Pass when one record appears for the source and the controller leaves the documented idle/disabled state without repeated entry in 100% of injections; artifact: fault log, controller trace, and configuration snapshot.
- Exceptions: A permanently disabled vector MAY rely on the shared default handler only when disable state, owner, and review condition are recorded.

Correct:

```c
extern void platform_fault_record_unexpected_irq_from_isr(uint32_t vector);
extern void platform_irq_clear_pending(uint32_t vector);

void unexpected_irq_handler(uint32_t vector)
{
    platform_fault_record_unexpected_irq_from_isr(vector);
    platform_irq_clear_pending(vector);
}
```

Incorrect:

```c
void unexpected_irq_handler(uint32_t vector)
{
    (void)vector;   /* returns without clearing, so the handler re-enters immediately */
}
```

### EMB-ISR-ERROR-001 [MUST]

A handler MUST record every error it detects in state the owning context can observe, and
MUST NOT discard it because there is no caller to return it to.

- Applies when: A handler detects an overrun, a parity or framing error, or any unexpected hardware state.
- Rationale: A handler has no caller, so an early `return` on an error path is not propagation — it is silent data corruption in whatever stream the peripheral feeds.
- Verification (agent): Map each handler error branch to a counter, flag, or status field read by the owner. Pass when no detected error terminates only with a bare return; artifact: error-path table and owner read locations.
- Verification (target): Using the `PROJECT_RULES.md` `isr-error-reporting` configuration, inject each documented error condition. Pass when the owner observes exactly one corresponding error record and recovery follows the documented path in 100% of injections; artifact: injected-error trace, owner log, and configuration snapshot.
- Exceptions: A hardware-documented benign condition MAY be ignored only with citation, scope, owner, and review condition recorded.

Correct:

```c
extern void platform_record_uart_overrun_from_isr(void);

void uart_isr(void)
{
    uint32_t status = UART0->SR;

    if ((status & UART_SR_OVERRUN) != 0U) {
        platform_record_uart_overrun_from_isr();   /* bounded, and visible to the owner */
    }
}
```

Incorrect:

```c
void uart_isr(void)
{
    uint32_t status = UART0->SR;

    if ((status & UART_SR_OVERRUN) != 0U) {
        return;   /* the overrun is dropped and the stream is silently corrupt */
    }
}
```

### EMB-ISR-PRIORITY-001 [SHOULD]

Each enabled interrupt SHOULD have its priority, worst-case handler duration, and the
longest critical section that can delay it recorded in `PROJECT_RULES.md`.

- Applies when: Assigning or changing an interrupt priority, or adding a critical section that masks one.
- Rationale: Worst-case latency cannot be reviewed from a handler alone. It depends on every priority above it and every section that masks it, so the table is the only place the interaction is visible.
- Verification (agent): Compare the priority/duration/masking table with every changed vector and critical section. Pass when no new accessor or masking interval is omitted; artifact: table diff and source report.
- Verification (target): Using the `PROJECT_RULES.md` `isr-priority-budget` configuration, measure worst-case latency for every enabled interrupt and masking section. Pass when every measured value is below its recorded budget and no enabled item remains unmeasured; artifact: timing capture, priority table, and configuration snapshot.
- Exceptions: The table MAY be deferred only while the interrupt set is unstable and the gap has an owner, completion condition, and review date recorded.

Correct:

```text
Vector      Priority  Worst case  Longest masking section
UART0_RX    2         4 us        spi_flash_erase: 800 us
SPI0_TX     1         2 us        spi_flash_erase: 800 us
```

Incorrect:

```text
Priorities were assigned as the code was written; no durations or sections were recorded.
```
