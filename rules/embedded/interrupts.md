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
from its exact interrupt context. Each MUST return without blocking, waiting for a
scheduler-owned resource, or yielding, and MUST have defined failure, full, and overflow
results.

Passing a zero timeout to a task-context API MUST NOT be treated as proof of ISR safety; the
platform's ISR variant MUST be used where one exists. A documented ISR-exit reschedule
request is not a wait and MAY be issued as described in `EMB-ISR-SIGNAL-001`.

- Applies when: Writing or reviewing a handler or anything reachable from it, including wrappers, callbacks, function-pointer targets, error paths, and RTOS adapters.
- Rationale: A handler has no schedulable context to block in, so a blocking call deadlocks or extends interrupt latency without bound. An `ISR-safe` name alone proves nothing about blocking or overflow behavior.
- Verification (agent): Enumerate the transitive call graph including indirect calls and error paths, and check each operation against the project's ISR-safe list. Flag any allocator, stdio, string, or blocking primitive, and any call whose entry is missing from the list.
- Verification (target): Exercise every failure and saturation path on the target with the configured optimization level.
- Exceptions: A primitive or wrapper MAY be used when its interrupt-context safety, non-blocking behavior, and failure semantics are recorded in `PROJECT_RULES.md`.

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

    /* PROJECT_RULES lists both adapters as non-blocking and ISR-safe. */
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
    xSemaphoreTake(&rx_mutex, portMAX_DELAY);       /* waits for a task-owned resource */
    xQueueSend(&rx_queue, &byte, portMAX_DELAY);    /* blocks with no schedulable context */
}
```

### EMB-ISR-REENTRANCY-001 [MUST]

A handler MUST NOT call a function that keeps static or global mutable state unless the
project records it as re-entrant for the configured toolchain, or records that nesting is
disabled and no other context calls it.

- Applies when: Calling library or project code from interrupt context.
- Rationale: A handler that preempts the same function mid-update corrupts the state it owns, and the corruption surfaces far from its cause. `malloc`, `printf`, `strtok`, and `errno`-setting functions are the common cases.
- Verification (agent): Check each called function against the toolchain and library re-entrancy documentation, then record the verdict in the project's ISR-safe call list.
- Verification (target): None beyond `EMB-ISR-BOUND-001`; re-entrancy is a documentation property, not a measurement.
- Exceptions: As stated in the rule: recorded re-entrancy, or recorded single-caller use with nesting disabled.

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
- Verification (agent): Sum the recorded worst-case durations along the longest path and compare against the budget for that priority. Report any reachable operation with no recorded bound as a gap rather than assuming one.
- Verification (target): Measure the handler on the target with the production clock, compiler options, and wait-state configuration, and confirm the measurement is inside the budget with the recorded margin.
- Exceptions: A handler MAY exceed the budget when the affected lower-priority work is recorded as tolerating the delay.

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
- Verification (agent): Compare the handler against capture, acknowledge, and signal. Report filtering, formatting, floating-point work, and slow peripheral access as deferrable.
- Verification (target): None beyond the duration measurement.
- Exceptions: A handler MAY complete work in context when the project records that it meets its latency budget.

Correct:

```c
#include <stdbool.h>
#include <stdint.h>

extern uint32_t platform_adc_read_result_from_isr(void);
extern bool platform_adc_publish_from_isr(uint32_t sample);
extern void platform_adc_record_drop_from_isr(void);

void adc_isr(void)
{
    uint32_t sample = platform_adc_read_result_from_isr();

    if (!platform_adc_publish_from_isr(sample)) {
        platform_adc_record_drop_from_isr();
    }
    /* The publish primitive wakes the owning loop; filtering happens there. */
}
```

Incorrect:

```c
void adc_isr(void)
{
    adc_sample = ADC0->RESULT;
    apply_iir_filter(&filter, adc_sample);   /* float filtering in interrupt context */
    update_display(adc_sample);              /* slow peripheral access in interrupt context */
}
```

### EMB-ISR-SIGNAL-001 [MUST]

A handler MUST signal the owning context with the primitive the platform documents as
callable from interrupt context, and MUST issue the platform's ISR-exit reschedule request
where the API defines one.

- Applies when: A handler notifies a task, sets an event, or releases a synchronization object.
- Rationale: The task-context variant may block and usually omits the scheduler interaction interrupt exit requires. It fails as a missed or late wake-up rather than as an error, which is why review has to catch it.
- Verification (agent): Check each signalling call against the platform's ISR-safe list, and confirm the reschedule-request argument is both passed and acted on where the API defines one.
- Verification (target): Confirm the owning context wakes for every event, including events arriving back to back.
- Exceptions: A primitive MAY be used from both contexts when the platform documents a single entry point that is safe from both.

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
primitives are callable from interrupt context, and MUST define what happens when the
handler cannot deliver: whether the event is dropped, coalesced, or overwritten. `volatile`
alone MUST NOT be used to synchronize ordinary RAM.

`EMB-CONC-RACE-001` and `EMB-CONC-PUBLISH-001` define the protocol and the visibility edge.
This rule adds the two constraints the interrupt boundary imposes on them: the primitives
must be ISR-callable, and because a handler cannot block or retry, full-buffer behavior is
part of the interface rather than an error the handler can defer.

- Applies when: Declaring or accessing a message, queue, snapshot, counter, or flag shared between interrupt and non-interrupt code.
- Rationale: `volatile` makes an access visible but does not make a read-modify-write atomic, establish a happens-before edge, or make several atomic fields one consistent update. A handler that has nowhere to put an event will silently lose it unless the loss is designed.
- Verification (agent): For each shared object, list every reader and writer, name the model, and confirm its primitives appear on the ISR-safe list and its atomic width and alignment are supported. Confirm the full, empty, and overflow behavior is stated at the interface.
- Verification (target): Test full, empty, overflow, and back-to-back events under the target memory model, and confirm the recorded loss policy is what actually happens.
- Exceptions: `volatile` MAY be retained for MMIO, where it is required for a different reason. Another platform-supported model MAY be used when its ownership, ordering, atomicity, and failure behavior are recorded in `PROJECT_RULES.md`.

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

A larger pair of examples is in
[examples/EMB-ISR-SHARED-001](../../examples/EMB-ISR-SHARED-001/).

### EMB-ISR-NESTING-001 [MUST]

When two handlers, or a handler and a critical section, can touch the same object or
peripheral while nesting is enabled, the chosen mask or ownership model MUST cover every
accessor including the highest-priority one, and the project MUST record the priority
encoding and mask semantics it relies on.

- Applies when: Two or more contexts touch the same object or peripheral and at least one is a handler that can be preempted.
- Rationale: Priority numbering and mask thresholds differ between targets, and "mask at the highest priority" is not portable. A mask that covers only the current and lower priorities lets a conflicting higher-priority handler observe a half-updated object.
- Verification (agent): For each shared object, list every handler and critical section that touches it with its logical priority and the target's numeric encoding, then confirm the chosen adapter is documented as covering all of them.
- Verification (target): Force the highest-priority conflicting context to fire during the protected operation.
- Exceptions: A project MAY disable nesting and use a global mask, or use a lock-free model where the platform cannot mask a higher-priority handler, when the configuration and its latency bound are recorded.

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

### EMB-ISR-CLEAR-001 [MUST]

A handler MUST acknowledge its interrupt source at the point the hardware requires and
before returning, and the project MUST record that point for each vector.

- Applies when: Writing or changing a handler that acknowledges a peripheral or controller interrupt.
- Rationale: Acknowledging before the hardware latches the event loses it; acknowledging late or not at all re-enters the handler immediately and starves everything below it.
- Verification (agent): Confirm each handler's acknowledge sequence matches the point recorded for that vector, and that a handler with an early return acknowledges on that path too.
- Verification (target): Check the sequence against the reference manual and errata, then test back-to-back events.
- Exceptions: A handler MAY defer the acknowledge when the hardware documents a level-sensitive or shared-source scheme requiring it and the scheme is recorded.

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
- Verification (agent): Read the initialization sequence and confirm the enable write is last, after handler installation, state initialization, and the pending-flag clear.
- Verification (target): Compare against the bring-up sequence in the reference manual and cold-start with the line already asserted.
- Exceptions: An interrupt MAY be enabled earlier when the hardware documents that no pending flag can be set before configuration completes.

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
- Verification (agent): Compare the vector table against the enabled-interrupt list, and confirm the default handler both records the event and clears the pending state.
- Verification (target): Force each unexpected source and confirm the recorded event appears.
- Exceptions: A vector the project records as permanently disabled MAY rely on the shared default handler alone.

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
- Verification (agent): Check each error branch for a counter, flag, or status field the owner reads. A branch that only returns is a finding.
- Verification (target): Inject each error condition and confirm the owning context observes it.
- Exceptions: A condition the hardware documents as benign MAY be ignored when that reading is recorded.

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
- Verification (agent): Compare the recorded table against the handlers and critical sections in the change, and report a new vector or masking section that the table does not mention.
- Verification (target): Measure the worst case where a method exists.
- Exceptions: A project MAY defer the table while the interrupt set is still unstable, when the gap and its owner are recorded.

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

