# FreeRTOS Adapter Rules

Status: provisional

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

These bind [RTOS common](common.md) to specific FreeRTOS APIs and configuration. Context
legality, blocking contracts, object lifecycle, priority-inversion policy, and task stack
bounds are in that module and are not restated here.

### RTOS-FREERTOS-ISR-001 [MUST]

Interrupt-context code MUST call the `...FromISR` variant of a FreeRTOS service, MUST pass a
`BaseType_t` woken flag where the API takes one, and MUST hand that flag to
`portYIELD_FROM_ISR` before returning.

- Applies when: Calling queues, semaphores, task notifications, stream buffers, or event groups from an ISR.
- Rationale: This is the concrete form `RTOS-COMMON-CONTEXT-001` takes in FreeRTOS. The task-context variant enters scheduler paths that are illegal from an ISR, and a woken flag that is passed but never yielded on defers the wake-up to the next tick, which looks like intermittent latency rather than a bug.
- Verification (agent): For each FreeRTOS call reachable from a handler, confirm the `FromISR` suffix, that the woken argument is a real variable rather than `NULL`, and that a `portYIELD_FROM_ISR` on that variable is reached on every return path.
- Verification (target): Test a wake-up of a higher-priority task and confirm it runs at interrupt exit rather than at the following tick.
- Exceptions: A service MAY be called without the suffix when the selected port documents that entry point as ISR-safe with equivalent wake-up semantics.

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
    /* Task-context API, and an indefinite wait with no schedulable context. */
    (void)xQueueSend(queue, &byte, portMAX_DELAY);
}
```

A larger pair of examples is in
[examples/RTOS-FREERTOS-ISR-001](../../examples/RTOS-FREERTOS-ISR-001/).

### RTOS-FREERTOS-PRIORITY-001 [MUST]

An interrupt that calls any `FromISR` service MUST have a priority inside the port's
kernel-call range, and an interrupt above that range MUST NOT reach a FreeRTOS service
through any path including callbacks.

- Applies when: Assigning or changing the priority of an ISR, or adding a FreeRTOS call to an existing handler.
- Rationale: Ports such as the Cortex-M ones mask the kernel only up to `configMAX_SYSCALL_INTERRUPT_PRIORITY`. A handler above it can preempt the kernel's own critical section and corrupt scheduler state, and because numerically lower means higher priority on Cortex-M, the mistake reads as correct.
- Verification (agent): Compare each handler's encoded hardware priority against the configured range recorded in `PROJECT_RULES.md`, then check the call graph of every handler above the range for FreeRTOS entry points.
- Verification (target): Test the highest permitted priority and confirm `configASSERT` fires for a forbidden one.
- Exceptions: None. An ISR outside the range MAY exist only if it reaches no FreeRTOS service at all.

Correct:

```text
configMAX_SYSCALL_INTERRUPT_PRIORITY = 5 (Cortex-M, 3 priority bits, 0 = highest)
UART0_RX  priority 6  calls xQueueSendFromISR      -> inside the kernel-call range
MOTOR_FAULT priority 1  no FreeRTOS calls at all   -> above the range, and does not call in
```

Incorrect:

```text
MOTOR_FAULT priority 1  calls xSemaphoreGiveFromISR -> above the range; preempts the kernel
```

### RTOS-FREERTOS-CONFIG-001 [MUST]

Code that depends on a `FreeRTOSConfig.h` option MUST assert that dependency at compile time
rather than relying on the option happening to be set.

- Applies when: Using an optional API, an allocation mode, a hook function, or a port-specific feature.
- Rationale: A configuration-dependent call compiles into a different scheduling or memory contract without the caller changing. Silent substitution of a static for a dynamic allocation mode, or a missing hook, appears at run time as a failure with no code change to point at.
- Verification (agent): For each option-gated API in the change, confirm a `#if` guard or `_Static_assert` names the required option and that the failure is a build error rather than a fallback.
- Verification (target): Build the supported configuration matrix, including one configuration where the option is absent, and confirm the build fails there.
- Exceptions: A project MAY rely on a single locked configuration when the build proves that selection for every consumer.

Correct:

```c
#include "FreeRTOS.h"

#if (configUSE_TASK_NOTIFICATIONS != 1)
#error "notify_worker requires configUSE_TASK_NOTIFICATIONS == 1"
#endif

void notify_worker(void *task)
{
    (void)xTaskNotifyGive(task);
}
```

Incorrect:

```c
void notify_worker(void *task)
{
    /* Compiles away or fails to link depending on a config the caller never states. */
    (void)xTaskNotifyGive(task);
}
```

