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
`BaseType_t` woken flag where the API takes one.

- Applies when: Calling queues, semaphores, task notifications, stream buffers, or event groups from an ISR.
- Rationale: This is the concrete form `RTOS-COMMON-CONTEXT-001` takes in FreeRTOS. The task-context variant enters scheduler paths that are illegal from an ISR, and omitting the ISR entry point or its required flag changes the API's context contract.
- Verification (agent): Trace every FreeRTOS call reachable from a handler and check the `FromISR` variant and non-null woken flag wherever the API takes one. Pass when every reachable service uses its documented ISR entry point and receives the required flag; artifact: call graph, API table, and path report.
- Verification (target): Using the `PROJECT_RULES.md` `freertos-isr` configuration, invoke each covered queue, semaphore, notification, stream-buffer, and event-group service from its ISR context under production port settings. Pass when every service accepts the call without a context assertion and the documented result is returned for 100% of invocations; artifact: scheduler trace, `FreeRTOSConfig.h` snapshot, and configuration snapshot.
- Exceptions: A non-suffixed service MAY be called only when the selected port/version documents equivalent ISR safety and wake semantics, with owner and review condition recorded.

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

### RTOS-FREERTOS-ISR-002 [MUST]

When a FreeRTOS `FromISR` service reports a woken higher-priority task, the handler MUST pass
its `BaseType_t` flag to `portYIELD_FROM_ISR` before returning.

- Applies when: An ISR calls a FreeRTOS API that reports whether a higher-priority task was woken.
- Rationale: The flag is the port's handoff for scheduling at interrupt exit; discarding it defers the wake-up and can violate the task's latency contract.
- Verification (agent): Trace each `FromISR` call's woken flag through all handler exits. Pass when the exact flag reaches `portYIELD_FROM_ISR` before every return path that can follow the call; artifact: ISR control-flow report and flag-use table.
- Verification (target): Using the `PROJECT_RULES.md` `freertos-isr-yield` configuration, wake a higher-priority task from isolated, burst, and back-to-back interrupts under production port settings. Pass when the task runs at interrupt exit before the next tick for every accepted wake in 100% of trials; artifact: scheduler trace, yield log, and configuration snapshot.
- Exceptions: A port-specific exit wrapper MAY replace `portYIELD_FROM_ISR` only when it documents equivalent flag semantics, version, owner, and review condition.

Correct:

```c
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
    BaseType_t higher_priority_task_woken = 0;

    (void)xQueueSendFromISR(queue, &byte, &higher_priority_task_woken);
    (void)higher_priority_task_woken; /* no ISR-exit yield is issued */
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
- Verification (agent): Compare each handler's encoded priority with the configured kernel-call range and scan every handler above it for FreeRTOS entry points. Pass when no out-of-range handler reaches the kernel and all in-range handlers use valid `FromISR` calls; artifact: priority table and call graph.
- Verification (target): Run at the highest permitted priority and one forbidden priority with `configASSERT` enabled. Pass when the permitted ISR completes and the forbidden call triggers the configured assertion before scheduler state changes; artifact: assert log and priority configuration.
- Exceptions: An ISR outside the range MAY exist only when a call-graph proof shows it reaches no FreeRTOS service; record scope, owner, and review condition.

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
- Verification (agent): For each option-gated API, locate a `#if` guard or `_Static_assert` naming the required option. Pass when an absent option produces a compile-time error and no fallback path is selected; artifact: preprocessor/configuration report.
- Verification (target): Build the supported matrix, including one configuration with the option absent. Pass when supported configurations build and the absent-option build fails at the assertion; artifact: matrix log and config headers.
- Exceptions: A single locked configuration MAY be used only when the build proves that selection for every consumer and records owner, lock source, and review condition.

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
