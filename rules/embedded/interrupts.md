# Interrupt Rules

Status: draft

## Scope

Interrupt context, callable operations, bounded execution, interrupt priorities, deferred
work, and data exchange with non-interrupt code.

## Load when

Changing an interrupt handler or code reachable from interrupt context.

## Project facts this module depends on

- The atomic access width of the core, and the alignment it requires.
- The list of calls the toolchain and libraries document as ISR-safe.
- Whether interrupt nesting is enabled, and the priority assigned to each vector.
- How the platform signals a task from interrupt context.
- The reserved interrupt stack, and the worst-case nesting depth against it.

Record these in `PROJECT_RULES.md`. Where they are unknown, mark them `unknown` rather than
assuming a default; the rules below change behaviour depending on them.

## Rules

### EMB-ISR-BOUND-001 [MUST]

An interrupt handler MUST NOT call any operation that can block, wait, or sleep, including
delay loops, blocking semaphore or mutex takes, blocking queue receives, dynamic
allocation, logging, and stdio output.

- Applies when: Writing or reviewing an interrupt handler, or any function it calls.
- Rationale: A handler does not own a schedulable context, so a blocking call either deadlocks the system or extends interrupt latency without bound.
- Verification: Enumerate every call reachable from the handler, including calls through function pointers, and check it against the project's ISR-safe call list.
- Exceptions: A call MAY be used when the platform documents it as ISR-safe for the specific configuration and the call and its bound are recorded in `PROJECT_RULES.md`.

Correct:

```c
void uart_isr(void)
{
    uint8_t byte = UART0->DATA;
    ringbuf_put_isr(&rx_buffer, byte);   /* documented ISR-safe, non-blocking, bounded */
}
```

Incorrect:

```c
void uart_isr(void)
{
    uint8_t byte = UART0->DATA;
    printf("%c", byte);                             /* stdio may block on a shared lock */
    xQueueSend(&rx_queue, &byte, portMAX_DELAY);    /* blocks with no schedulable context */
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

A handler MUST NOT contain an unbounded loop, a wait for a hardware flag without a
bounded timeout, or a call whose worst-case duration is unknown.

- Applies when: Writing any loop or polling sequence reachable from interrupt context.
- Rationale: A handler that can spin forever hangs the system with equal- and lower-priority interrupts masked, and no latency claim can be checked without a bound.
- Verification: Review each loop for a constant or recorded bound and test the timeout path.
- Exceptions: A bounded spin MAY be used when the bound, the worst-case duration, and the consequence of exceeding it are recorded.

Correct:

```c
bool spi_wait_tx_empty(uint32_t max_iterations)
{
    for (uint32_t i = 0U; i < max_iterations; i++) {
        if ((SPI0->SR & SPI_SR_TXE) != 0U) {
            return true;
        }
    }
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
static volatile bool adc_sample_ready;

void adc_isr(void)
{
    adc_sample = ADC0->RESULT;
    adc_sample_ready = true;   /* the main loop scales, filters, and publishes */
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

Every object written by an interrupt handler and read outside it, or written outside it
and read by a handler, MUST be `volatile`-qualified, MUST be of a type the target reads
and writes in a single indivisible access, and MUST be protected by a critical section
when any access to it is not indivisible.

- Applies when: Declaring or accessing state shared between interrupt and non-interrupt code.
- Rationale: Without `volatile` the compiler may cache or reorder the access; without atomicity or protection, a read-modify-write loses the interrupt's update and the loss appears far from its cause.
- Verification: For each shared object, review the qualifier, check the access width against the atomic width recorded in `PROJECT_RULES.md`, and check every non-indivisible access for protection.
- Exceptions: An object accessed only inside a critical section MAY rely on the section instead of `volatile`, when that choice and the section's bound are recorded.

Correct:

```c
/* Single indivisible store: safe without protection. */
static volatile bool adc_sample_ready;

void adc_isr(void)
{
    adc_sample = ADC0->RESULT;
    adc_sample_ready = true;
}

/* Increment is a read-modify-write, so the reader masks the interrupt. */
static volatile uint32_t error_count;

uint32_t error_count_read(void)
{
    uint32_t value;
    uint32_t state = irq_disable();

    value = error_count;
    irq_restore(state);
    return value;
}
```

Incorrect:

```c
static uint32_t error_count;   /* no volatile: the compiler may hoist the read */

void spi_isr(void)
{
    error_count = error_count + 1U;   /* read-modify-write, unprotected */
}

uint32_t error_count_read(void)
{
    return error_count;   /* the handler can interleave this read */
}
```

A larger pair of examples for this rule is in
[examples/EMB-ISR-SHARED-001](../../examples/EMB-ISR-SHARED-001/).

### EMB-ISR-NESTING-001 [MUST]

Where nesting is enabled, an object or peripheral shared by handlers of different
priorities MUST be protected against the highest-priority handler that touches it, and
the project MUST record whether nesting is enabled.

- Applies when: Two or more handlers, or a handler and a critical section, touch the same object or peripheral.
- Rationale: Masking at the accessor's own priority blocks only equal and lower priorities, so a higher-priority sharer still preempts the section and observes it half updated.
- Verification: For each shared object, list every handler that touches it with its priority, confirm the mask covers the highest, and test with the higher-priority interrupt forced.
- Exceptions: A project MAY disable nesting and rely on a global mask when that configuration and its latency cost are recorded.

Correct:

```c
/* SPI0_TX at priority 1 can preempt this priority 3 handler; mask at priority 1. */
void uart_rx_isr(void)
{
    uint32_t state = irq_mask_at(1);   /* blocks every handler that touches the log */

    log_append(&trace_log, "rx");
    irq_restore(state);
}
```

Incorrect:

```c
/* SPI0_TX at priority 1 can preempt this priority 3 handler. */
void uart_rx_isr(void)
{
    uint32_t state = irq_mask_at(3);   /* blocks only priorities 3 and lower */

    log_append(&trace_log, "rx");      /* not re-entrant against SPI0_TX */
    irq_restore(state);
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
void unexpected_irq_handler(uint32_t vector)
{
    fault_record.irq = vector;
    fault_record.unexpected_irq_count++;
    irq_clear_pending(vector);
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
void uart_isr(void)
{
    uint32_t status = UART0->SR;

    if ((status & UART_SR_OVERRUN) != 0U) {
        uart_stats.overrun_count++;   /* the owning task reports and clears this */
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
