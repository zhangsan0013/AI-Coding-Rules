# Domain Review Register

Status: implementation complete; domain-owner review pending

Every module below contains normative rules, required metadata, and rule-level inline examples.
External C examples are tiered evidence: the 17 checked directories cover rules that need
compiler/executable proof and representative high-risk scenarios, not every rule. The modules
are `provisional`: they load by default, and a consumer must report them as unreviewed rather
than as safety coverage. They become `active` only when a reviewer with responsibility for the
relevant hardware, runtime, architecture, or toolchain confirms the assumptions and verification
methods.

## Review gates

For each module, the domain owner should:

1. Verify the project facts named by the module against the target reference manual, port,
   compiler, linker, and configuration.
2. Review every rule for technical correctness, scope, strength, exception policy, and
   interaction with neighboring modules.
3. Run the verification named by each rule, including the representative paired examples and
   the `Verification (target):` steps that the local GCC syntax check cannot cover.
4. Record the reviewer, date, target/configuration, evidence, expected and observed result,
   artifacts, outstanding work, findings, and compensating checks in the consuming project's
   `PROJECT_RULES.md` or decision record. The actionability status for each rule is tracked in
   the [rule audit ledger](rule-audit-ledger.md).
5. Promote the reviewed module from `provisional` to `active`. A profile becomes `active` only
   once every module in its baseline is `active`, because the structure check refuses a profile
   that references a less-reviewed module.

## Module register

| Module | Rules | External example | Review focus |
| --- | ---: | --- | --- |
| `c11.arithmetic` | 6 | `C-ARITH-PROMOTE-001`, `C-ARITH-SHIFT-001` | integer promotion, shift count/signedness/masks, signed/unsigned compare, signed overflow |
| `c11.naming` | 4 | — | reserved names, leading underscore, internal linkage, export prefixes |
| `c11.preprocessor` | 8 | — | macro safety, conditional completeness, include guards/dependencies, C++ linkage |
| `c11.public-interface` | 18 | `C-API-DOC-001`, `C-API-DOC-FIELDS-001` | declaration purpose/fields, buffer and status contracts, nullability, ownership, license metadata |
| `c11.style` | 16 | — | formatter-backed style, types/init, VLA and resource lifetime, switch and `sizeof` usage |
| `core.change-policy` | 11 | `CORE-CHG-VERIFY-001`, `CORE-CHG-DEFENSIVE-001` | change scope, defensive evidence/behavior, compatibility, impact, verification records, exceptions/recovery |
| `core.correctness` | 6 | — | contracts, errors, root cause, invariants, preconditions, partial states |
| `embedded.interrupts` | 17 | `EMB-ISR-BOUND-001`, `EMB-ISR-NOWAIT-001`, `EMB-ISR-API-001` | ISR call legality, non-blocking/API variants, bounded results, synchronization, latency budget, nesting, vectors |
| `embedded.memory` | 7 | `EMB-MEM-LIFETIME-001`, `EMB-MEM-ALLOC-RESULT-001` | lifetime, ownership, allocator context/result/state, stack including ISR nesting, linker placement |
| `embedded.register-access` | 6 | `EMB-MMIO-VOLATILE-001`, `EMB-MMIO-RAM-SYNC-001` | MMIO qualifiers, ordinary RAM synchronization, access width, side effects, reserved bits, ordering |
| `embedded.concurrency` | 8 | `EMB-CONC-PUBLISH-001`, `EMB-CONC-PUBLISH-002`, `EMB-CONC-CRITICAL-001` | races, atomic guarantees, publication/acquire visibility, critical sections and mask restore/scope, lock order/release |
| `embedded.dma-and-cache` | 6 | `EMB-DMA-OWNERSHIP-001`, `EMB-DMA-CACHE-002` | ownership, lifetime, direction-specific coherency, boundary ordering, alignment, completion |
| `embedded.representation` | 4 | `EMB-REPR-SERIALIZE-001`, `EMB-REPR-BITFIELD-001` | wire byte order, unaligned access, fixed-width fields, external bit-field prohibition |
| `embedded.startup` | 3 | `EMB-BOOT-WATCHDOG-001` | `.data`/`.bss` readiness, progress-gated watchdog, bring-up ordering |
| `embedded.timeout-and-errors` | 6 | `EMB-ERR-BOUNDS-001` | monotonic time, bounds/results, overflow, propagation, recovery |
| `rtos.common` | 11 | `RTOS-COMMON-BLOCK-001`, `RTOS-COMMON-ISR-NOWAIT-001` | context legality/no-wait, blocking/result handling, ownership, lifecycle, priority, stack |
| `rtos.freertos` | 4 | `RTOS-FREERTOS-ISR-001`, `RTOS-FREERTOS-ISR-002` | `FromISR` variant/flag and yield, kernel-call priority range, config gating |
| `rtos.rt-thread` | 2 | `RTOS-RTTHREAD-ISR-001` | BSP ISR-safe list, mailbox/queue copy-vs-transfer ownership |
| `rtos.threadx` | 4 | `RTOS-THREADX-ISR-001`, `RTOS-THREADX-ISR-002`, `RTOS-THREADX-ISR-003` | ISR legality, `TX_NO_WAIT`, status handling, byte/block pool ownership |
| `architecture.arm` | 8 | `ARCH-ARM-BARRIER-001`, `ARCH-ARM-BARRIER-BOUNDARY-001` | core/profile, ABI, exceptions, barrier effect/boundary/atomicity, atomics/progress, alignment |
| `architecture.riscv` | 10 | `ARCH-RISCV-FENCE-001`, `ARCH-RISCV-FENCE-IO-001`, `ARCH-RISCV-FENCE-INSTR-001` | ISA/XLEN, ABI, traps, normal/I/O/instruction fences, atomics/progress, CSR privilege/masks/side effects |
| `toolchains.gcc` | 6 | `TOOL-GCC-LTO-001`, `TOOL-GCC-ATTR-EFFECT-001` | diagnostics, optimization, attribute support/effect, ABI, LTO/link retention |

The vendor RTOS modules carry only what is specific to their API or configuration. Their
context-legality, blocking, lifecycle, and stack requirements live in `rtos.common`, so a
reviewer signing a vendor module reviews the binding, not a second copy of the contract.

## Actionability audit boundary

The repository's automated contract gate currently reports 171 normative rules: 163 `MUST`,
8 `SHOULD`, and no `MAY`. A `contract-pass` in the [rule audit ledger](rule-audit-ledger.md) means the
rule has one independently testable boundary plus the required structure, examples, and
verification fields; it does not mean the target-specific domain review is complete. All
modules remain provisional and must not be treated as signed-off safety coverage.

## Current release boundary

The repository-controlled preparation is complete, but no domain owner has signed these modules
in this repository. Withholding them from consumers until that happens was the wrong trade: it
gated finished embedded constraints behind a review no install could clear, and shipped a
library whose default install contained no embedded rules at all. They are therefore
`provisional` — delivered, and labeled unreviewed at every point where a consumer sees them:
the resolver output, the installer summary, and the module and profile headers.

`--allow-draft` now means only what it says: a module or profile whose rules are not written
yet. No such entry currently exists in the catalog.
