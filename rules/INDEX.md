# Rule Routing Index

Load only the modules required by the current task. `PROJECT_RULES.md` and the selected
profile establish the project baseline before this routing is applied.

Use [catalog.json](catalog.json) as the machine-readable source for stable module IDs,
status, activation signals, dependencies, and profile inheritance. This page remains the
human-readable routing explanation; the catalog does not duplicate normative rule text.

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

## Runtime concerns

- Tasks, queues, synchronization, or scheduling: [RTOS common](rtos/common.md)
- FreeRTOS-specific code: [FreeRTOS adapter](rtos/freertos.md)
- RT-Thread-specific code: [RT-Thread adapter](rtos/rt-thread.md)
- ThreadX-specific code: [ThreadX adapter](rtos/threadx.md)

Vendor-specific RTOS modules extend [RTOS common](rtos/common.md). They must not repeat
runtime-independent scheduling, blocking, or ownership rules.

## Architecture concerns

- Arm-specific ABI, exception, atomic, or instruction behavior: [Arm](architecture/arm.md)
- RISC-V-specific ABI, privilege, atomic, or instruction behavior: [RISC-V](architecture/riscv.md)

Architecture modules are independent of the selected RTOS and compiler. Exact core,
ISA-extension, ABI, and memory-system facts belong in `PROJECT_RULES.md`.

## Toolchain concerns

- GCC-specific extensions, diagnostics, attributes, or optimization behavior: [GCC](toolchains/gcc.md)

Toolchain modules are independent of architecture. Add a target-specific toolchain module
only when it contains rules that cannot be expressed by the generic compiler and
architecture modules.

If applicability is uncertain and the omitted module could affect safety or correctness,
load that module and state the uncertainty.

The resolver accepts explicit task signals and returns the ordered module IDs. A draft
profile or module requires explicit `--allow-draft` and must be reported as draft rather
than treated as safety coverage.
