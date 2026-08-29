# FreeRTOS Adapter Rules

Status: draft

## Scope

FreeRTOS-specific interfaces and configuration, including ISR variants, task notifications,
queues, critical sections, and static or dynamic object creation. Runtime-independent
requirements belong in [RTOS common](common.md).

## Load when

Changing code that calls FreeRTOS interfaces or depends on `FreeRTOSConfig.h`.

## Project facts this module depends on

- The FreeRTOS version, selected port, interrupt priority encoding, and the maximum priority
  permitted to call `FromISR` services.
- The enabled configuration options affecting timeout, allocation, task notifications,
  static objects, assertions, and scheduler behavior.
- The project-approved `FromISR` wake-up and yield pattern for the selected port.

Record these in `PROJECT_RULES.md`; do not infer them from a symbol name alone.

## Rules

### RTOS-FREERTOS-ISR-001 [MUST]

Code executing in an interrupt context MUST use the FreeRTOS service variant documented for
that context, MUST pass and inspect the higher-priority-task-woken result where applicable,
and MUST request the documented interrupt-exit yield when required.

- Applies when: Calling queues, semaphores, task notifications, stream buffers, or other FreeRTOS services from an ISR.
- Rationale: Task-context services can enter scheduler paths that are illegal in an ISR, and ignoring the wake result adds avoidable scheduling latency.
- Verification: Check the exact FreeRTOS version and port documentation, review every result branch, and test a wake-up of a higher-priority task.
- Exceptions: A service MAY be called directly only when the selected port explicitly documents it as ISR-safe and supplies equivalent wake-up semantics.

### RTOS-FREERTOS-PRIORITY-001 [MUST]

An interrupt that calls a FreeRTOS ISR service MUST be configured within the selected
port's documented system-call priority range.

- Applies when: Assigning, changing, or reviewing the priority of an ISR that invokes a `FromISR` API.
- Rationale: FreeRTOS ports commonly restrict kernel access from high-priority interrupts; violating the port rule can corrupt scheduler state.
- Verification: Compare encoded hardware priorities, port configuration, and vector assignments, then test the highest permitted and forbidden cases.
- Exceptions: An ISR outside the kernel-call range MAY exist only when it never reaches a FreeRTOS service, including through callbacks.

### RTOS-FREERTOS-TIMEOUT-001 [MUST]

FreeRTOS timeout values MUST be converted using the selected tick configuration, MUST have
defined overflow and rounding behavior, and MUST be handled as finite waits unless an
approved indefinite-wait contract applies.

- Applies when: Passing tick counts to queues, notifications, semaphores, delays, or event groups.
- Rationale: Tick width, scheduler suspension, conversion rounding, and configuration determine the actual wait and its maximum representable value.
- Verification: Test zero, one-tick, maximum, overflow, and tick-wrap cases with the selected configuration.
- Exceptions: An indefinite wait MAY be used only when the owning task's lifecycle and recovery contract explicitly require it.

### RTOS-FREERTOS-OBJECT-001 [MUST]

A FreeRTOS object MUST remain allocated and initialized until every task, ISR, callback,
and deferred operation that can reference it has stopped using it.

- Applies when: Creating or deleting queues, semaphores, task notifications, timers, stream buffers, and static or dynamic objects.
- Rationale: FreeRTOS handles do not by themselves prevent a concurrent delete or reclaim of the storage they identify.
- Verification: Review the create/delete lifecycle and test teardown with pending messages, blocked tasks, callbacks, and ISR events.
- Exceptions: A statically allocated object MAY be permanent when deletion is prohibited and its owner is documented.

### RTOS-FREERTOS-CONFIG-001 [MUST]

Code that depends on a `FreeRTOSConfig.h` option MUST state that dependency and MUST fail
the build or return a defined result when the option is absent or incompatible.

- Applies when: Using optional APIs, allocation modes, hook functions, assertions, tick settings, or port-specific features.
- Rationale: A configuration-dependent call can compile into a different scheduling or memory contract without changing the caller.
- Verification: Build the supported configuration matrix or compile-time assertions and exercise the unsupported configuration path.
- Exceptions: A project may support one locked configuration only when the build proves that selection for every consumer.

## Module examples

See the larger [compliant](../../examples/RTOS-FREERTOS-ISR-001/compliant.c) and
[violating](../../examples/RTOS-FREERTOS-ISR-001/violation.c) examples.

Correct:

```c
#include <stdint.h>

typedef int BaseType_t;
extern BaseType_t xQueueSendFromISR(void *queue, const void *item, BaseType_t *woken);
extern void portYIELD_FROM_ISR(BaseType_t woken);

void uart_isr(void *queue, uint8_t byte)
{
    BaseType_t higher_priority_task_woken = 0;

    (void)xQueueSendFromISR(queue, &byte, &higher_priority_task_woken);
    portYIELD_FROM_ISR(higher_priority_task_woken);
}
```

Incorrect:

```c
void uart_isr(void *queue, uint8_t byte)
{
    /* The task-context API and an indefinite wait are illegal ISR assumptions. */
    (void)xQueueSend(queue, &byte, portMAX_DELAY);
}
```
