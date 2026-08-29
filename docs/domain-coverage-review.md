# Phase 4 Domain Review Register

Status: implementation ready; domain-owner review pending

All cataloged draft modules now contain normative rules, required metadata, inline examples,
and at least one linked pair of external C examples. They remain `draft` until a reviewer
with responsibility for the relevant hardware, runtime, architecture, or toolchain confirms
the assumptions and verification methods.

## Review gates

For each module, the domain owner should:

1. Verify the project facts named by the module against the target reference manual, port,
   compiler, linker, and configuration.
2. Review every rule for technical correctness, scope, strength, exception policy, and
   interaction with neighboring modules.
3. Run the verification named by each rule, including the paired examples and target-specific
   tests where the local GCC syntax check is insufficient.
4. Record the reviewer, date, target/configuration, findings, and compensating checks in the
   consuming project's `PROJECT_RULES.md` or decision record.
5. Promote only the reviewed module and its dependent profiles from `draft` to `active`,
   then run the complete repository validation.

## Module register

| Module | Draft rules | External example | Review focus |
| --- | ---: | --- | --- |
| `embedded.interrupts` | 14 | `EMB-ISR-SHARED-001`, `EMB-ISR-MASK-001` | ISR call graph, synchronization, timing, nesting, priority, stack |
| `embedded.memory` | 5 | `EMB-MEM-LIFETIME-001` | lifetime, ownership, allocation, stack, linker placement |
| `embedded.register-access` | 5 | `EMB-MMIO-VOLATILE-001` | access width, side effects, reserved bits, ordering |
| `embedded.concurrency` | 5 | `EMB-CONC-PUBLISH-001` | races, atomic guarantees, critical sections, lock order |
| `embedded.dma-and-cache` | 5 | `EMB-DMA-OWNERSHIP-001` | ownership, lifetime, coherency, alignment, completion |
| `embedded.timeout-and-errors` | 5 | `EMB-ERR-BOUNDS-001` | monotonic time, bounds, overflow, propagation, recovery |
| `rtos.common` | 6 | `RTOS-COMMON-BLOCK-001` | context legality, blocking, lifecycle, priority, stack |
| `rtos.freertos` | 5 | `RTOS-FREERTOS-ISR-001` | `FromISR` APIs, interrupt priorities, ticks, configuration |
| `rtos.rt-thread` | 5 | `RTOS-RTTHREAD-ISR-001` | BSP ISR contract, IPC, ticks, object lifecycle |
| `rtos.threadx` | 5 | `RTOS-THREADX-ISR-001` | ISR services, waits, pools, object lifecycle, scheduling |
| `architecture.arm` | 5 | `ARCH-ARM-BARRIER-001` | core/profile, ABI, exceptions, barriers, atomics, alignment |
| `architecture.riscv` | 5 | `ARCH-RISCV-FENCE-001` | ISA/XLEN, ABI, traps, fences, atomics, CSRs |
| `toolchains.gcc` | 5 | `TOOL-GCC-LTO-001` | diagnostics, optimization, attributes, ABI, LTO/link retention |

## Current release boundary

The repository-controlled preparation is complete, but no domain owner has signed these
modules in this repository. Therefore the catalog and profiles intentionally continue to
gate them as draft, and normal resolution still requires `--allow-draft` for any of these
modules.
