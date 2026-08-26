# Rule Routing Index

Load only the modules required by the current task. `PROJECT_RULES.md` and the selected
profile establish the project baseline before this routing is applied.

## Always load

- [Correctness](core/correctness.md)
- [Change policy](core/change-policy.md)

## C source or header changes

- [C11 style](c11/style.md)
- [Naming](c11/naming.md)
- Add [public interfaces](c11/public-interface.md) for exported symbols or public headers.
- Add [preprocessor](c11/preprocessor.md) for macros or conditional compilation.

## Embedded concerns

- Memory layout, allocation, stack, or lifetime: [memory](embedded/memory.md)
- Peripheral registers or MMIO: [register access](embedded/register-access.md)
- Interrupt handlers or interrupt-callable code: [interrupts](embedded/interrupts.md)
- Shared state, atomics, or critical sections: [concurrency](embedded/concurrency.md)
- Polling, timeouts, or error propagation: [timeouts and errors](embedded/timeout-and-errors.md)
- DMA, cache, or buffer coherency: [DMA and cache](embedded/dma-and-cache.md)

## Runtime and toolchain concerns

- Tasks, queues, synchronization, or scheduling: [RTOS common](rtos/common.md)
- FreeRTOS-specific code: [FreeRTOS](rtos/freertos.md)
- GCC Arm attributes, ABI, linker, or startup behavior: [GCC Arm](toolchains/gcc-arm.md)

If applicability is uncertain and the omitted module could affect safety or correctness,
load that module and state the uncertainty.
