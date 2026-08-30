# Domain Review Register

Status: implementation complete; domain-owner review pending

Every module below contains normative rules, required metadata, inline examples, and at least
one linked pair of external C examples. They are `provisional`: they load by default, and a
consumer must report them as unreviewed rather than as safety coverage. They become `active`
only when a reviewer with responsibility for the relevant hardware, runtime, architecture, or
toolchain confirms the assumptions and verification methods.

## Review gates

For each module, the domain owner should:

1. Verify the project facts named by the module against the target reference manual, port,
   compiler, linker, and configuration.
2. Review every rule for technical correctness, scope, strength, exception policy, and
   interaction with neighboring modules.
3. Run the verification named by each rule, including the paired examples and the
   `Verification (target):` steps that the local GCC syntax check cannot cover.
4. Record the reviewer, date, target/configuration, findings, and compensating checks in the
   consuming project's `PROJECT_RULES.md` or decision record.
5. Promote the reviewed module from `provisional` to `active`. A profile becomes `active` only
   once every module in its baseline is `active`, because the structure check refuses a profile
   that references a less-reviewed module.

## Module register

| Module | Rules | External example | Review focus |
| --- | ---: | --- | --- |
| `c11.arithmetic` | 4 | `C-ARITH-PROMOTE-001` | integer promotion, shift width and signedness, signed/unsigned compare, signed overflow |
| `embedded.interrupts` | 12 | `EMB-ISR-SHARED-001` | ISR call graph, ISR-safe synchronization, latency budget, nesting, vectors |
| `embedded.memory` | 5 | `EMB-MEM-LIFETIME-001` | lifetime, ownership, allocation, stack including ISR nesting, linker placement |
| `embedded.register-access` | 5 | `EMB-MMIO-VOLATILE-001` | access width, side effects, reserved bits, ordering |
| `embedded.concurrency` | 5 | `EMB-CONC-PUBLISH-001`, `EMB-CONC-CRITICAL-001` | races, atomic guarantees, critical sections and mask restore, lock order |
| `embedded.dma-and-cache` | 5 | `EMB-DMA-OWNERSHIP-001` | ownership, lifetime, coherency, alignment, completion |
| `embedded.representation` | 3 | `EMB-REPR-SERIALIZE-001` | wire byte order, unaligned access, fixed-width fields vs bit-fields |
| `embedded.startup` | 3 | `EMB-BOOT-WATCHDOG-001` | `.data`/`.bss` readiness, progress-gated watchdog, bring-up ordering |
| `embedded.timeout-and-errors` | 5 | `EMB-ERR-BOUNDS-001` | monotonic time, bounds, overflow, propagation, recovery |
| `rtos.common` | 6 | `RTOS-COMMON-BLOCK-001` | context legality, blocking, lifecycle, priority, stack |
| `rtos.freertos` | 3 | `RTOS-FREERTOS-ISR-001` | `FromISR` variant and yield, kernel-call priority range, config gating |
| `rtos.rt-thread` | 2 | `RTOS-RTTHREAD-ISR-001` | BSP ISR-safe list, mailbox/queue copy-vs-transfer ownership |
| `rtos.threadx` | 2 | `RTOS-THREADX-ISR-001` | ISR-legal service table and status handling, byte/block pool ownership |
| `architecture.arm` | 5 | `ARCH-ARM-BARRIER-001` | core/profile, ABI, exceptions, barriers, atomics, alignment |
| `architecture.riscv` | 5 | `ARCH-RISCV-FENCE-001` | ISA/XLEN, ABI, traps, fences, atomics, CSRs |
| `toolchains.gcc` | 5 | `TOOL-GCC-LTO-001` | diagnostics, optimization, attributes, ABI, LTO/link retention |

The vendor RTOS modules carry only what is specific to their API or configuration. Their
context-legality, blocking, lifecycle, and stack requirements live in `rtos.common`, so a
reviewer signing a vendor module reviews the binding, not a second copy of the contract.

## Current release boundary

The repository-controlled preparation is complete, but no domain owner has signed these modules
in this repository. Withholding them from consumers until that happens was the wrong trade: it
gated finished embedded constraints behind a review no install could clear, and shipped a
library whose default install contained no embedded rules at all. They are therefore
`provisional` — delivered, and labeled unreviewed at every point where a consumer sees them:
the resolver output, the installer summary, and the module and profile headers.

`--allow-draft` now means only what it says: a module or profile whose rules are not written
yet. No such entry currently exists in the catalog.
