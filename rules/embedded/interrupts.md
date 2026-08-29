# Interrupt Rules

Status: draft

## Scope

Interrupt context, callable operations, bounded execution, interrupt priorities, deferred
work, and data exchange with non-interrupt code.

## Load when

Changing an interrupt handler or code reachable from interrupt context.

## Project facts this module depends on

- The lock-free atomic widths, required alignment, and whether C11 atomic operations are
  safe to call from interrupt context.
- The compiler and CPU memory-ordering model, and the barrier or atomic adapter used to
  publish ordinary RAM between execution contexts.
- The list of calls the toolchain and libraries document as ISR-safe.
- The synchronization primitives callable from interrupt context, including their
  full, failure, and overflow semantics.
- Whether interrupt nesting is enabled, the priority assigned to each vector, and the
  priority encoding and mask or threshold semantics.
- How the platform signals a task from interrupt context.
- The event coalescing, queue-full, and backpressure policy for each deferred path.
- The worst-case execution time or conservative upper bound and total latency budget for
  each handler and ISR-safe operation, including CPU/clock, compiler, and wait-state
  configuration.
- The reserved interrupt stack, and the worst-case nesting depth against it.

Record these in `PROJECT_RULES.md`. Where they are unknown, mark them `unknown` rather than
assuming a default; the rules below change behaviour depending on them.

## Rules

### EMB-ISR-BOUND-001 [MUST]

An interrupt handler MUST call only operations that the platform or project documents as
safe for the exact interrupt context and configuration. Each operation MUST return
without blocking, sleeping, waiting for a scheduler-owned resource, or yielding control,
and MUST have a finite worst-case execution time. Its result and, where applicable,
failure, full, and overflow behavior MUST be defined.

Unbounded delay or polling, blocking semaphore or mutex takes, blocking queue operations,
and ordinary dynamic allocation, logging, or stdio output MUST NOT be used. A documented
ISR-exit reschedule request MAY be issued as specified by `EMB-ISR-SIGNAL-001`; it requests
rescheduling at interrupt exit and does not wait inside the handler.

A zero timeout passed to a task-context API MUST NOT be treated as proof of ISR safety;
the platform's ISR-specific variant MUST be used when one is provided.

- Applies when: Writing or reviewing an interrupt handler or any directly or indirectly reachable operation, including wrappers, callbacks, function-pointer targets, error paths, and platform or RTOS adapters.
- Rationale: A handler does not own a schedulable context, so a blocking call can deadlock the system or extend interrupt latency without bound. An `ISR-safe` name alone does not prove that an operation is non-blocking, bounded, or able to report a full or failed result.
- Verification: Enumerate the transitive call graph, including indirect calls and error paths. For each operation, check the platform or project documentation for the exact interrupt context and configuration, then verify its non-blocking and non-yielding behavior, finite worst-case duration, and result plus applicable failure, full, and overflow semantics. Exercise every failure and saturation path.
- Exceptions: No undocumented call is exempt. A platform primitive or project wrapper MAY be used only when its exact interrupt-context safety, non-blocking behavior, worst-case bound, and result plus applicable failure, full, and overflow semantics are recorded in `PROJECT_RULES.md`.

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

    /* These adapters are documented as non-blocking, bounded, and ISR-safe. */
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

    printf("%c", byte);                             /* may take a stdio lock; no ISR bound */
    xSemaphoreTake(&rx_mutex, portMAX_DELAY);       /* waits for a task-owned resource */
    xQueueSend(&rx_queue, &byte, portMAX_DELAY);    /* may block with no schedulable context */
}
```

### EMB-ISR-REENTRANCY-001 [MUST]

An interrupt handler MUST NOT call a function that is not re-entrant, including
allocators, formatted output, and any function documented as using static or global
mutable state.

- Applies when: Calling library or project code from interrupt context.
- Rationale: A higher-priority handler that preempts a non-reentrant function mid-update corrupts the state it owns, and the corruption surfaces far from its cause.
- Verification: Check each called function against the toolchain and library re-entrancy documentation and record the verdict in the project's ISR-safe call list.
- Exceptions: A function MAY be called when the project records that it is re-entrant for the configured toolchain and options, or when nesting is disabled and that is recorded.

Correct:

```c
void timer_isr(void)
{
    ringbuf_put_isr(&trace_buffer, next_trace_byte());   /* no shared static state */
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

A handler and every operation reachable from it MUST have a finite, verifiable worst-case
execution time. An interrupt handler MUST NOT contain an unbounded loop, retry, or
hardware poll without a finite timeout.

Any iteration or time limit MUST be fixed by the project configuration or otherwise
recorded in `PROJECT_RULES.md`; it MUST NOT be an arbitrary caller-provided value.

- Applies when: Writing or reviewing any loop, polling sequence, retry, delay, timeout, or call reachable from interrupt context, including indirect callbacks, hardware access, platform or RTOS adapters, and error or timeout paths.
- Rationale: A handler that can spin forever hangs the system with equal- and lower-priority interrupts masked, and a latency claim cannot be checked when a reachable call or retry has no finite upper bound.
- Verification: Review the complete interrupt call graph. For every loop, retry, and hardware poll, prove a finite project-recorded bound and an explicit success, timeout, or failure path. Obtain a conservative worst-case duration for every reachable operation and the total handler budget, then test first-iteration success, last-iteration success, timeout, failure, and repeated-event cases using the target compiler optimization and timing configuration.
- Exceptions: A bounded spin, poll, or operation without a static WCET MAY be used only when platform documentation or conservative target analysis establishes a finite upper bound. The bound, timing configuration, worst-case duration, and consequence of exceeding it MUST be recorded in `PROJECT_RULES.md`; no exception permits an unbounded loop, retry, or poll.

Correct:

```c
#include <stdbool.h>
#include <stdint.h>

/* PROJECT_RULES fixes this bound for the target timing configuration. */
#define ISR_SPI_MAX_ITERATIONS 16U

extern uint32_t platform_spi_status_from_isr(void); /* bounded MMIO read */
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
    while ((SPI0->SR & SPI_SR_TXE) == 0U) {   /* no bound and no timeout */
        ;
    }
}
```

### EMB-ISR-DEFER-001 [SHOULD]

Work that does not require interrupt context SHOULD be moved out of the handler; the
handler SHOULD capture the event, record the minimum state, and signal the owning task or
loop.

- Applies when: A handler does more than capture data, acknowledge the source, and signal.
- Rationale: Every instruction in a handler delays all equal- and lower-priority work, so deferring keeps the latency budget reviewable.
- Verification: Review the handler against the stated minimum work and measure or bound its duration.
- Exceptions: A handler MAY complete work in context when the project records the latency budget and shows the handler meets it.

Correct:

```c
#include <stdbool.h>
#include <stdint.h>

extern uint32_t platform_adc_read_result_from_isr(void);
extern bool platform_adc_publish_from_isr(uint32_t sample);
extern void platform_adc_record_drop_from_isr(void);

void adc_isr(void)
{
    uint32_t sample;

    sample = platform_adc_read_result_from_isr();
    if (!platform_adc_publish_from_isr(sample)) {
        platform_adc_record_drop_from_isr();
    }
    /* The bounded publish primitive wakes the owning loop; filtering stays outside ISR. */
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
callable from interrupt context, and MUST NOT use the task-context variant of that
primitive.

- Applies when: A handler notifies a task, sets an event, or releases a synchronization object.
- Rationale: The task variant may block and may omit the scheduler interaction an interrupt entry requires, and it fails as a missed or deferred wake-up rather than as an error.
- Verification: Check each signalling call against the platform's ISR-safe list and test that the owning context wakes on every event, including events arriving back to back.
- Exceptions: A primitive MAY be used when the platform documents a single entry point that is safe from both contexts.

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

State exchanged between an interrupt context and another execution context MUST use one
documented, platform-supported synchronization model that defines ownership, atomicity,
memory ordering, update consistency, and overflow behavior. `volatile` alone MUST NOT be
used to synchronize ordinary shared RAM.

- Applies when: Declaring or accessing state shared between interrupt and non-interrupt code, including a message, queue, snapshot, counter, or flag.
- Rationale: `volatile` does not make a read-modify-write atomic, establish a happens-before relationship, or make several individually atomic fields form one consistent update. An ownership or synchronization contract is required to prevent lost updates, stale payloads, and mixed snapshots.
- Verification: For each shared object or message, list every reader and writer, select the synchronization model, verify its atomic width and alignment, verify its release/acquire or equivalent barrier semantics, prove multi-field consistency, and test full, empty, overflow, and back-to-back cases.
- Exceptions: `volatile` MAY be retained for MMIO or other hardware state, but it does not satisfy synchronization for ordinary shared RAM. A project MAY use a different platform-supported model when its ownership, ordering, atomicity, bounds, and failure behavior are recorded in `PROJECT_RULES.md`.

Common models include ownership transfer through an SPSC buffer or mailbox, a platform
atomic flag or counter, a bounded critical section, an RTOS ISR primitive, and a
double-buffered snapshot. The model MUST state whether events may be coalesced, dropped,
or overwritten.

Correct:

```c
/*
 * The platform_sync_* functions are the synchronization seam. Each implementation must
 * provide target-supported, ISR-safe atomic accesses and the stated memory ordering;
 * a volatile qualifier is not a substitute for this contract.
 *
 * This is an SPSC ownership-transfer buffer. The producer publishes a filled slot with
 * a release store; the consumer acquire-loads the head before reading that slot. One
 * slot is reserved, and a full buffer drops the sample through a bounded, observable
 * platform operation.
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
    uint32_t head;
    uint32_t tail;
    uint32_t next;

    head = platform_sync_load_relaxed_u32(&sample_head);
    tail = platform_sync_load_acquire_u32(&sample_tail);
    next = (head + 1U) % ISR_SAMPLE_RING_SLOTS;
    if (next == tail) {
        platform_record_sample_drop_from_isr();
        return;
    }

    sample_buffer[head] = platform_adc_read_result_from_isr();
    platform_sync_store_release_u32(&sample_head, next);
}

bool sample_take(uint32_t *value)
{
    uint32_t head;
    uint32_t tail;
    uint32_t next;

    tail = platform_sync_load_relaxed_u32(&sample_tail);
    head = platform_sync_load_acquire_u32(&sample_head);
    if (tail == head) {
        return false;
    }

    *value = sample_buffer[tail];
    next = (tail + 1U) % ISR_SAMPLE_RING_SLOTS;
    platform_sync_store_release_u32(&sample_tail, next);
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
    sample_ready = true;   /* no release publication; repeated events overwrite state */
}

bool sample_read(uint32_t *sample, uint32_t *timestamp)
{
    if (!sample_ready) {
        return false;
    }

    *sample = last_sample;
    *timestamp = last_timestamp;   /* the pair can come from different updates */
    sample_ready = false;          /* this clear can lose a concurrent ISR event */
    return true;
}
```

A larger pair of examples for this rule is in
[examples/EMB-ISR-SHARED-001](../../examples/EMB-ISR-SHARED-001/).

### EMB-ISR-NESTING-001 [MUST]

When nested interrupt contexts or an interrupt context and a critical section can access
the same object or peripheral, the synchronization model MUST prevent concurrent access
by every context that can touch it, including a higher-priority handler, and the project
MUST record the nesting and priority-mask semantics.

- Applies when: Two or more handlers, or a handler and a critical section, touch the same object or peripheral while preemption or nesting can occur.
- Rationale: Priority numbering and mask thresholds differ between targets. A mask that blocks only the current or lower-priority context can let a conflicting higher-priority handler observe a partially updated object.
- Verification: For each shared object or peripheral, list every handler and critical section that touches it, record their logical priorities and the target's numeric encoding, prove that the selected mask, ownership, or atomic model covers every accessor, and force the highest-priority conflicting context during the protected operation.
- Exceptions: A project MAY disable nesting and use a global mask, or use an ownership or lock-free model when the platform cannot mask a higher-priority handler, only when the configuration, latency bound, and safety proof are recorded in `PROJECT_RULES.md`.

The selected mask or priority-ceiling adapter MUST be documented as covering every
conflicting accessor; “mask at the highest priority” is not portable without that
platform-specific proof.

Correct:

```c
/*
 * PROJECT_RULES records that UART_RX and SPI_TX both access trace_log, that nesting is
 * enabled, and that this adapter's ceiling blocks every conflicting accessor. Its
 * returned token restores the caller's previous interrupt state.
 */
extern uint32_t platform_trace_log_mask_from_isr(void);
extern void platform_irq_restore(uint32_t state);
extern void platform_trace_log_append_from_isr(const char *text);

void uart_rx_isr(void)
{
    uint32_t state;

    state = platform_trace_log_mask_from_isr();
    platform_trace_log_append_from_isr("rx");
    platform_irq_restore(state);
}
```

Incorrect:

```c
/* This adapter only blocks the current and lower logical priorities. */
extern uint32_t platform_irq_mask_at_current_priority(void);
extern void platform_irq_restore(uint32_t state);
extern void platform_trace_log_append_from_isr(const char *text);

void uart_rx_isr(void)
{
    uint32_t state;

    state = platform_irq_mask_at_current_priority();
    platform_trace_log_append_from_isr("rx");   /* SPI_TX can still preempt this */
    platform_irq_restore(state);
}
```

### EMB-ISR-MASK-001 [MUST]

Code that masks interrupts MUST restore the previous masking state on every exit path,
and MUST NOT enable interrupts unconditionally at the end of a section it did not prove
it disabled.

- Applies when: Disabling or restoring interrupt state, or entering or leaving a critical section.
- Rationale: An unconditional enable re-enables interrupts inside a caller that had already masked them, which silently breaks the caller's own atomicity assumption.
- Verification: Review every exit path, including early returns, for a restore that uses the saved state rather than a constant, and test the nested call case.
- Exceptions: A section MAY enable unconditionally when it provably owns the outermost mask and that ownership is recorded.

Correct:

```c
bool log_event(const char *text)
{
    uint32_t state = irq_disable();

    if (!log_append(&trace_log, text)) {
        irq_restore(state);   /* restores the caller's state, not "enabled" */
        return false;
    }
    irq_restore(state);
    return true;
}
```

Incorrect:

```c
bool log_event(const char *text)
{
    irq_disable();

    if (!log_append(&trace_log, text)) {
        irq_enable();   /* the caller may already have been running masked */
        return false;
    }
    irq_enable();
    return true;
}
```

A larger pair of examples for this rule is in
[examples/EMB-ISR-MASK-001](../../examples/EMB-ISR-MASK-001/).

### EMB-ISR-CLEAR-001 [MUST]

A handler MUST clear the interrupt source at the point the hardware requires and before
returning, and the project MUST record that point for each vector.

- Applies when: Writing or changing a handler that acknowledges a peripheral or controller interrupt.
- Rationale: Clearing before the hardware latches the event loses it; clearing late or not at all re-enters the handler immediately and starves lower-priority work.
- Verification: For each vector, check the acknowledge sequence against the reference manual and the errata, and test back-to-back events.
- Exceptions: A handler MAY defer the acknowledge when the hardware documents a level-sensitive or shared-source scheme that requires it; the scheme MUST be recorded.

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

An interrupt MUST be enabled only after its handler is installed, the state it touches is
initialized, and any pending flag left by configuration is cleared.

- Applies when: Initializing a peripheral, installing a handler, or re-enabling an interrupt after reconfiguration.
- Rationale: Enabling first lets the handler run against uninitialized state or a stale pending flag, producing a fault whose cause is gone by the time anyone observes it.
- Verification: Review the initialization order against the bring-up sequence in the reference manual and test a cold start with the line already asserted.
- Exceptions: An interrupt MAY be enabled earlier when the hardware documents that no pending flag can be set before configuration completes and that is recorded.

Correct:

```c
static void uart_isr(void);

void uart_rx_start(void)
{
    ringbuf_init(&rx_buffer);
    install_handler(IRQ_UART0, uart_isr);
    (void)UART0->DATA;          /* drop any stale byte from configuration */
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

Every vector the hardware can take MUST have a defined handler, and a handler for an
unexpected or unhandled source MUST record the event and leave the controller in a
defined state rather than spinning or returning silently.

- Applies when: Populating or changing a vector table, or writing a shared default handler.
- Rationale: An unpopulated or silently-returning vector turns a configuration error into infinite re-entry or an invisible failure.
- Verification: Compare the vector table against the enabled interrupt list and the reference manual, then force each unexpected source and confirm the recorded event.
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
    (void)vector;   /* returns without clearing: the handler re-enters immediately */
}
```

### EMB-ISR-ERROR-001 [MUST]

A handler MUST record every error condition it detects in state the owning context can
observe, and MUST NOT discard it because there is no caller to return it to.

- Applies when: A handler detects an overrun, parity or framing error, or any unexpected hardware state.
- Rationale: A handler has no caller to return a status to, so dropping the condition turns a recoverable fault into silent data corruption.
- Verification: Review each error branch and confirm a counter, flag, or status field captures it, then test that the owning context observes it.
- Exceptions: A condition the hardware documents as benign and expected MAY be ignored when that reading is recorded.

Correct:

```c
extern void platform_record_uart_overrun_from_isr(void);

void uart_isr(void)
{
    uint32_t status = UART0->SR;

    if ((status & UART_SR_OVERRUN) != 0U) {
        platform_record_uart_overrun_from_isr();   /* bounded and observable to the owner */
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

Each enabled interrupt SHOULD have its priority, its worst-case handler duration, and the
longest critical section that can delay it recorded in `PROJECT_RULES.md`.

- Applies when: Assigning or changing an interrupt priority, or adding a critical section.
- Rationale: Worst-case interrupt latency cannot be reviewed from the handler alone; it depends on every priority above it and every section that masks it.
- Verification: Review the recorded priority table against the handler durations and critical sections, and measure the worst case where a method exists.
- Exceptions: A project MAY defer the table while the interrupt set is unstable, when the gap and its owner are recorded.

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

### EMB-ISR-STACK-001 [SHOULD]

The stack required by the deepest nested interrupt path SHOULD be budgeted and recorded,
counting the frame pushed at each level and the deepest call in each handler.

- Applies when: Adding a handler, enabling another nesting level, or deepening a handler's call chain.
- Rationale: Nested frames accumulate on one stack, and an overflow corrupts whatever the linker placed below it, presenting as an unrelated fault.
- Verification: Measure or statically bound the deepest nesting path and compare it with the reserved stack recorded in `PROJECT_RULES.md`.
- Exceptions: A project that disables nesting MAY budget a single frame when that configuration is recorded.

Correct:

```text
Reserved interrupt stack: 512 bytes.
Worst case: SPI0_TX (priority 1, 64 B) nested in UART0_RX (priority 3, 96 B) = 160 B.
```

Incorrect:

```text
The stack size was copied from an example project; no nesting depth was measured.
```
