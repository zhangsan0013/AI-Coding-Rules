# Rule Routing Index

Load only the rules required by the current task. `PROJECT_RULES.md` and the selected profile
establish the project baseline before this routing is applied. Use the context command's
summary first, then read only the selected rule sections.

Use [catalog.json](catalog.json) as the machine-readable source for stable module IDs,
status, activation signals, dependencies, and profile inheritance. This page remains the
human-readable routing explanation; the catalog does not duplicate normative rule text.

## Context stages

The bounded context interface has four stages:

- `route`: module IDs, paths, and statuses only.
- `summary`: module metadata and rule IDs for navigation; it is not normative text.
- `rules`: the selected rule sections without examples or detailed verification evidence.
- `evidence`: the selected rule sections with examples and verification fields.

Use `npx @zhangsan0013/ai-coding-rules context --stage summary --budget 6000` for the first
pass. Add `--rule <RULE-ID>` or `--module <MODULE-ID>` before requesting `rules` or `evidence`.
The canonical Markdown module remains the only normative source; summaries and catalog data
must not restate requirements.

## Always load

- [Correctness](core/correctness.md)
- [Change policy](core/change-policy.md)

## C source or header changes

- [C11 style](c11/style.md)
- [Naming](c11/naming.md)
- Add [public interfaces](c11/public-interface.md) for exported symbols or public headers.
- Add [preprocessor](c11/preprocessor.md) for macros or conditional compilation.
- Add [arithmetic](c11/arithmetic.md) for integer math, shifts, bit manipulation, or signed/unsigned comparison.

## Embedded concerns

- Memory layout, allocation, stack, or lifetime: [memory](embedded/memory.md)
- Peripheral registers or MMIO: [register access](embedded/register-access.md)
- Interrupt handlers or interrupt-callable code: [interrupts](embedded/interrupts.md)
- Shared state, atomics, or critical sections: [concurrency](embedded/concurrency.md)
- Polling, timeouts, or error propagation: [timeouts and errors](embedded/timeout-and-errors.md)
- DMA, cache, or buffer coherency: [DMA and cache](embedded/dma-and-cache.md)
- Wire protocols, stored records, or shared-memory layout: [representation](embedded/representation.md)
- Reset, early init, watchdog, or pre-`main` code: [startup](embedded/startup.md)

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

## Deriving task signals

The resolver (`ai-coding-rules resolve --signal <name>`) and `catalog.json` both key off
signal names, not prose. This table maps what a change touches to the signal to pass. The
`always` and profile-baseline modules load without a signal; add these for what the task
actually involves.

| The change touches… | Signal | Module |
| --- | --- | --- |
| any `.c` or `.h` file | `c-source` / `c-header` | `c11.style`, `c11.naming` |
| an exported symbol or public header | `public-interface` | `c11.public-interface` |
| a macro or `#if` | `preprocessor` | `c11.preprocessor` |
| integer math, a shift, a mask, or a signed/unsigned compare | `arithmetic` | `c11.arithmetic` |
| allocation, buffers, stack, or object lifetime | `memory` | `embedded.memory` |
| a memory-mapped register | `mmio` | `embedded.register-access` |
| an interrupt handler or ISR-reachable code | `interrupt` | `embedded.interrupts` |
| state shared across contexts, an atomic, or a lock | `concurrency` | `embedded.concurrency` |
| a poll, retry, timeout, or hardware error path | `timeout` | `embedded.timeout-and-errors` |
| a DMA transfer or cache maintenance | `dma` | `embedded.dma-and-cache` |
| a wire protocol, stored record, or shared layout | `representation` | `embedded.representation` |
| reset, early init, watchdog, or pre-`main` code | `startup` | `embedded.startup` |
| any RTOS service | `rtos` | `rtos.common` |
| a FreeRTOS / RT-Thread / ThreadX API | `rtos-freertos` / `rtos-rt-thread` / `rtos-threadx` | the matching adapter |
| Arm / RISC-V specific ABI, exception, or barrier code | `architecture-arm` / `architecture-riscv` | the matching module |
| a GCC attribute, diagnostic, or LTO behavior | `toolchain-gcc` | `toolchains.gcc` |

A change usually matches several rows; pass every signal that applies. When two readings of
the task differ on whether a safety-related signal applies, pass it.

The resolver returns the ordered module IDs. The `context` command uses that same ordered set
to build a bounded route, summary, or selected rule/evidence payload. A `provisional` profile
or module resolves normally but must be reported as unreviewed rather than as safety coverage.
A `draft` one requires explicit `--allow-draft`.
