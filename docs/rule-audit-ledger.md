# Rule Actionability Audit Ledger

Status: contract and semantic split complete; domain-owner review pending

Audit date: 2026-08-30

This ledger records the repository-side actionability audit. It is separate from a consuming
project's `PROJECT_RULES.md`: it records whether a canonical rule is structurally and
semantically ready for promotion, while the consuming project records its own target evidence.

## Current inventory

| Measure | Value |
| --- | ---: |
| Canonical modules | 22 |
| Normative rules | 171 |
| `MUST` | 163 |
| `SHOULD` | 8 |
| `MAY` | 0 |
| Paired external example directories | 17 |
| Contract status `contract-pass` | 171 |
| Contract status `needs-rewrite` | 0 |
| `demote` | 0 |
| `delete` | 0 |
| Domain-owner review | 171 pending |
| Target evidence | 171 pending |

`contract-pass` means the current rule has one independently testable boundary, required metadata,
rule-level evidence, and a deterministic verification shape. It does not mean target-specific
review is complete. The current rule status table below is exhaustive and distinguishes the
repository contract result from the two pending review gates. The resolution table records the
former compound contracts and their completed split or narrowing; all current normative IDs are
now `contract-pass`.

## Module roll-up

| Module | Rules | Contract-pass | Needs rewrite | Demote | Delete |
| --- | ---: | ---: | ---: | ---: | ---: |
| `architecture.arm` | 8 | 8 | 0 | 0 | 0 |
| `architecture.riscv` | 10 | 10 | 0 | 0 | 0 |
| `c11.arithmetic` | 6 | 6 | 0 | 0 | 0 |
| `c11.naming` | 4 | 4 | 0 | 0 | 0 |
| `c11.preprocessor` | 8 | 8 | 0 | 0 | 0 |
| `c11.public-interface` | 18 | 18 | 0 | 0 | 0 |
| `c11.style` | 16 | 16 | 0 | 0 | 0 |
| `core.change-policy` | 11 | 11 | 0 | 0 | 0 |
| `core.correctness` | 6 | 6 | 0 | 0 | 0 |
| `embedded.concurrency` | 8 | 8 | 0 | 0 | 0 |
| `embedded.dma-and-cache` | 6 | 6 | 0 | 0 | 0 |
| `embedded.interrupts` | 17 | 17 | 0 | 0 | 0 |
| `embedded.memory` | 7 | 7 | 0 | 0 | 0 |
| `embedded.register-access` | 6 | 6 | 0 | 0 | 0 |
| `embedded.representation` | 4 | 4 | 0 | 0 | 0 |
| `embedded.startup` | 3 | 3 | 0 | 0 | 0 |
| `embedded.timeout-and-errors` | 6 | 6 | 0 | 0 | 0 |
| `rtos.common` | 11 | 11 | 0 | 0 | 0 |
| `rtos.freertos` | 4 | 4 | 0 | 0 | 0 |
| `rtos.rt-thread` | 2 | 2 | 0 | 0 | 0 |
| `rtos.threadx` | 4 | 4 | 0 | 0 | 0 |
| `toolchains.gcc` | 6 | 6 | 0 | 0 | 0 |

## Rule-level resolutions

| Rule ID | Status | Required follow-up |
| --- | --- | --- |
| `ARCH-ARM-BARRIER-001` | contract-pass | Narrowed to barrier effect/domain; `ARCH-ARM-BARRIER-BOUNDARY-001` and `ARCH-ARM-BARRIER-ATOMIC-001` own placement and non-atomicity. |
| `ARCH-ARM-ATOMIC-001` | contract-pass | Narrowed to supported instruction/width/alignment; `ARCH-ARM-ATOMIC-PROGRESS-001` owns retry bounds. |
| `ARCH-RISCV-FENCE-001` | contract-pass | Narrowed to normal-memory handoffs; `ARCH-RISCV-FENCE-IO-001` and `ARCH-RISCV-FENCE-INSTR-001` own I/O and instruction-fetch domains. |
| `ARCH-RISCV-ATOMIC-001` | contract-pass | Narrowed to extension/width/alignment; `ARCH-RISCV-ATOMIC-PROGRESS-001` owns retry bounds. |
| `ARCH-RISCV-CSR-001` | contract-pass | Narrowed to privilege legality; `ARCH-RISCV-CSR-MASK-001` and `ARCH-RISCV-CSR-SIDEFX-001` own masks and side effects. |
| `C-API-DOC-001` | contract-pass | Narrowed to the purpose of an added or changed declaration; `C-API-DOC-FIELDS-001` owns applicable parameter, return, ownership, and error fields. |
| `CORE-CHG-VERIFY-001` | contract-pass | Narrowed to risk-tier check selection; `CORE-CHG-VERIFY-RECORD-001`, `-OUTSTANDING-001`, and `-CLAIM-001` own evidence records, gaps, and claim scope. |
| `CORE-CORR-INVARIANT-001` | contract-pass | Narrowed to invariant preservation; `CORE-CORR-PRECONDITION-001` and `CORE-CORR-PARTIAL-001` own rejection ordering and intermediate-state recovery. |
| `EMB-CONC-PUBLISH-001` | contract-pass | Narrowed to producer completion before publication; `EMB-CONC-PUBLISH-002` owns consumer acquire visibility. |
| `EMB-DMA-CACHE-001` | contract-pass | Narrowed to direction-specific maintenance; `EMB-DMA-CACHE-002` owns ownership-boundary ordering. |
| `EMB-ISR-BOUND-001` | contract-pass | Narrowed to interrupt-callable operations; `EMB-ISR-NOWAIT-001` owns the non-blocking boundary, `EMB-ISR-API-001` owns selection of an ISR-specific entry point, and `EMB-ISR-RESULT-001` owns bounded failure/full/overflow results. |
| `EMB-ISR-NESTING-001` | contract-pass | Narrowed to conflicting-access coverage; `EMB-ISR-NESTING-002` owns priority encoding and mask semantics. |
| `EMB-ISR-SHARED-001` | contract-pass | Narrowed to ISR-safe synchronization; `EMB-ISR-SHARED-002` owns drop/coalesce/overwrite policy. |
| `EMB-MEM-ALLOC-001` | contract-pass | Narrowed to allocator context legality; `EMB-MEM-ALLOC-RESULT-001` and `EMB-MEM-ALLOC-STATE-001` own failure result and state preservation. |
| `EMB-MMIO-ORDER-001` | contract-pass | Bound to a named target memory model, barrier/completion primitive, trace source, and 100-run threshold. |
| `EMB-REPR-FIELD-001` | contract-pass | Narrowed to fixed-width external fields; `EMB-REPR-BITFIELD-001` owns the external bit-field prohibition. |
| `EMB-ERR-BOUNDS-001` | contract-pass | Narrowed to finite loop/retry/wait bounds; `EMB-ERR-RESULT-001` owns explicit result handling. |
| `RTOS-COMMON-CONTEXT-001` | contract-pass | Narrowed to runtime/port service legality; `RTOS-COMMON-ISR-NOWAIT-001` owns the interrupt no-wait boundary. |
| `RTOS-COMMON-BLOCK-001` | contract-pass | Narrowed to timeout/indefinite-wait policy; `RTOS-COMMON-BLOCK-RESULT-001` owns caller result handling. |
| `RTOS-COMMON-OWNERSHIP-001` | contract-pass | Narrowed to owner assignment across object lifetime; `RTOS-COMMON-OWNERSHIP-002` owns shutdown/error-path validity. |
| `RTOS-COMMON-PRIORITY-001` | contract-pass | Narrowed to resource inversion policy; `RTOS-COMMON-PRIORITY-002` owns temporary changes and restoration. |
| `RTOS-COMMON-LIFECYCLE-001` | contract-pass | Narrowed to stop-admission ordering; `RTOS-COMMON-LIFECYCLE-002` owns in-flight completion before reclamation. |
| `RTOS-FREERTOS-ISR-001` | contract-pass | Narrowed to `FromISR` API and woken flag; `RTOS-FREERTOS-ISR-002` owns ISR-yield handoff. |
| `RTOS-THREADX-ISR-001` | contract-pass | Narrowed to ISR service legality; `RTOS-THREADX-ISR-002` owns `TX_NO_WAIT`, and `-ISR-003` owns status handling. |
| `TOOL-GCC-ATTR-001` | contract-pass | Narrowed to compiler/target support; `TOOL-GCC-ATTR-EFFECT-001` owns post-build effect proof. |

## Current rule status

This table is exhaustive: its Rule ID set must equal the rule sections under `rules/`. The
repository contract result is tracked separately from domain-owner review and target evidence;
both review columns remain `pending` until a consuming project supplies configuration-specific
evidence.

| Rule ID | Contract | Domain review | Target evidence |
| --- | --- | --- | --- |
<!-- BEGIN CURRENT_RULE_STATUS -->
| `ARCH-ARM-ABI-001` | contract-pass | pending | pending |
| `ARCH-ARM-ALIGN-001` | contract-pass | pending | pending |
| `ARCH-ARM-ATOMIC-001` | contract-pass | pending | pending |
| `ARCH-ARM-ATOMIC-PROGRESS-001` | contract-pass | pending | pending |
| `ARCH-ARM-BARRIER-001` | contract-pass | pending | pending |
| `ARCH-ARM-BARRIER-ATOMIC-001` | contract-pass | pending | pending |
| `ARCH-ARM-BARRIER-BOUNDARY-001` | contract-pass | pending | pending |
| `ARCH-ARM-EXCEPTION-001` | contract-pass | pending | pending |
| `ARCH-RISCV-ABI-001` | contract-pass | pending | pending |
| `ARCH-RISCV-ATOMIC-001` | contract-pass | pending | pending |
| `ARCH-RISCV-ATOMIC-PROGRESS-001` | contract-pass | pending | pending |
| `ARCH-RISCV-CSR-001` | contract-pass | pending | pending |
| `ARCH-RISCV-CSR-MASK-001` | contract-pass | pending | pending |
| `ARCH-RISCV-CSR-SIDEFX-001` | contract-pass | pending | pending |
| `ARCH-RISCV-FENCE-001` | contract-pass | pending | pending |
| `ARCH-RISCV-FENCE-INSTR-001` | contract-pass | pending | pending |
| `ARCH-RISCV-FENCE-IO-001` | contract-pass | pending | pending |
| `ARCH-RISCV-TRAP-001` | contract-pass | pending | pending |
| `C-API-BUFFER-001` | contract-pass | pending | pending |
| `C-API-BUFFER-002` | contract-pass | pending | pending |
| `C-API-BUFFER-003` | contract-pass | pending | pending |
| `C-API-BUFFER-004` | contract-pass | pending | pending |
| `C-API-DOC-001` | contract-pass | pending | pending |
| `C-API-DOC-FIELDS-001` | contract-pass | pending | pending |
| `C-API-ERROR-001` | contract-pass | pending | pending |
| `C-API-ERROR-002` | contract-pass | pending | pending |
| `C-API-ERROR-003` | contract-pass | pending | pending |
| `C-API-ERROR-004` | contract-pass | pending | pending |
| `C-API-ERROR-005` | contract-pass | pending | pending |
| `C-API-ERROR-006` | contract-pass | pending | pending |
| `C-API-LICENSE-001` | contract-pass | pending | pending |
| `C-API-LICENSE-002` | contract-pass | pending | pending |
| `C-API-NULL-001` | contract-pass | pending | pending |
| `C-API-NULL-002` | contract-pass | pending | pending |
| `C-API-VOID-001` | contract-pass | pending | pending |
| `C-API-VOID-002` | contract-pass | pending | pending |
| `C-ARITH-CONVERT-001` | contract-pass | pending | pending |
| `C-ARITH-OVERFLOW-001` | contract-pass | pending | pending |
| `C-ARITH-PROMOTE-001` | contract-pass | pending | pending |
| `C-ARITH-SHIFT-001` | contract-pass | pending | pending |
| `C-ARITH-SHIFT-MASK-001` | contract-pass | pending | pending |
| `C-ARITH-SHIFT-SIGN-001` | contract-pass | pending | pending |
| `C-NAME-EXPORT-001` | contract-pass | pending | pending |
| `C-NAME-LEADING-001` | contract-pass | pending | pending |
| `C-NAME-RESERVED-001` | contract-pass | pending | pending |
| `C-NAME-SCOPE-001` | contract-pass | pending | pending |
| `C-PP-CONDITION-001` | contract-pass | pending | pending |
| `C-PP-INCLUDE-001` | contract-pass | pending | pending |
| `C-PP-INCLUDE-002` | contract-pass | pending | pending |
| `C-PP-INCLUDE-003` | contract-pass | pending | pending |
| `C-PP-MACRO-001` | contract-pass | pending | pending |
| `C-PP-MACRO-002` | contract-pass | pending | pending |
| `C-PP-MACRO-003` | contract-pass | pending | pending |
| `C-PP-MACRO-004` | contract-pass | pending | pending |
| `C-STYLE-ALLOC-002` | contract-pass | pending | pending |
| `C-STYLE-BRACES-001` | contract-pass | pending | pending |
| `C-STYLE-CLEANUP-001` | contract-pass | pending | pending |
| `C-STYLE-FORMAT-001` | contract-pass | pending | pending |
| `C-STYLE-INCREMENT-001` | contract-pass | pending | pending |
| `C-STYLE-INIT-001` | contract-pass | pending | pending |
| `C-STYLE-INIT-003` | contract-pass | pending | pending |
| `C-STYLE-MEM-001` | contract-pass | pending | pending |
| `C-STYLE-MEM-002` | contract-pass | pending | pending |
| `C-STYLE-MEM-003` | contract-pass | pending | pending |
| `C-STYLE-MEM-004` | contract-pass | pending | pending |
| `C-STYLE-SIZEOF-001` | contract-pass | pending | pending |
| `C-STYLE-SWITCH-001` | contract-pass | pending | pending |
| `C-STYLE-SWITCH-002` | contract-pass | pending | pending |
| `C-STYLE-TYPES-001` | contract-pass | pending | pending |
| `C-STYLE-TYPES-002` | contract-pass | pending | pending |
| `CORE-CHG-COMPAT-001` | contract-pass | pending | pending |
| `CORE-CHG-DEFENSIVE-001` | contract-pass | pending | pending |
| `CORE-CHG-DEFENSIVE-BEHAVIOR-001` | contract-pass | pending | pending |
| `CORE-CHG-EXCEPTION-001` | contract-pass | pending | pending |
| `CORE-CHG-IMPACT-001` | contract-pass | pending | pending |
| `CORE-CHG-RECOVERY-001` | contract-pass | pending | pending |
| `CORE-CHG-SCOPE-001` | contract-pass | pending | pending |
| `CORE-CHG-VERIFY-001` | contract-pass | pending | pending |
| `CORE-CHG-VERIFY-CLAIM-001` | contract-pass | pending | pending |
| `CORE-CHG-VERIFY-OUTSTANDING-001` | contract-pass | pending | pending |
| `CORE-CHG-VERIFY-RECORD-001` | contract-pass | pending | pending |
| `CORE-CORR-CONTRACT-001` | contract-pass | pending | pending |
| `CORE-CORR-ERROR-001` | contract-pass | pending | pending |
| `CORE-CORR-INVARIANT-001` | contract-pass | pending | pending |
| `CORE-CORR-PARTIAL-001` | contract-pass | pending | pending |
| `CORE-CORR-PRECONDITION-001` | contract-pass | pending | pending |
| `CORE-CORR-ROOTCAUSE-001` | contract-pass | pending | pending |
| `EMB-BOOT-BRINGUP-001` | contract-pass | pending | pending |
| `EMB-BOOT-STARTUP-001` | contract-pass | pending | pending |
| `EMB-BOOT-WATCHDOG-001` | contract-pass | pending | pending |
| `EMB-CONC-ATOMIC-001` | contract-pass | pending | pending |
| `EMB-CONC-CRITICAL-001` | contract-pass | pending | pending |
| `EMB-CONC-CRITICAL-SCOPE-001` | contract-pass | pending | pending |
| `EMB-CONC-LOCK-001` | contract-pass | pending | pending |
| `EMB-CONC-LOCK-RELEASE-001` | contract-pass | pending | pending |
| `EMB-CONC-PUBLISH-001` | contract-pass | pending | pending |
| `EMB-CONC-PUBLISH-002` | contract-pass | pending | pending |
| `EMB-CONC-RACE-001` | contract-pass | pending | pending |
| `EMB-DMA-ALIGN-001` | contract-pass | pending | pending |
| `EMB-DMA-CACHE-001` | contract-pass | pending | pending |
| `EMB-DMA-CACHE-002` | contract-pass | pending | pending |
| `EMB-DMA-COMPLETE-001` | contract-pass | pending | pending |
| `EMB-DMA-LIFETIME-001` | contract-pass | pending | pending |
| `EMB-DMA-OWNERSHIP-001` | contract-pass | pending | pending |
| `EMB-ERR-BOUNDS-001` | contract-pass | pending | pending |
| `EMB-ERR-OVERFLOW-001` | contract-pass | pending | pending |
| `EMB-ERR-PROPAGATE-001` | contract-pass | pending | pending |
| `EMB-ERR-RECOVERY-001` | contract-pass | pending | pending |
| `EMB-ERR-RESULT-001` | contract-pass | pending | pending |
| `EMB-ERR-TIMEBASE-001` | contract-pass | pending | pending |
| `EMB-ISR-API-001` | contract-pass | pending | pending |
| `EMB-ISR-BOUND-001` | contract-pass | pending | pending |
| `EMB-ISR-CLEAR-001` | contract-pass | pending | pending |
| `EMB-ISR-DEFER-001` | contract-pass | pending | pending |
| `EMB-ISR-DURATION-001` | contract-pass | pending | pending |
| `EMB-ISR-ERROR-001` | contract-pass | pending | pending |
| `EMB-ISR-INIT-001` | contract-pass | pending | pending |
| `EMB-ISR-NESTING-001` | contract-pass | pending | pending |
| `EMB-ISR-NESTING-002` | contract-pass | pending | pending |
| `EMB-ISR-NOWAIT-001` | contract-pass | pending | pending |
| `EMB-ISR-PRIORITY-001` | contract-pass | pending | pending |
| `EMB-ISR-REENTRANCY-001` | contract-pass | pending | pending |
| `EMB-ISR-RESULT-001` | contract-pass | pending | pending |
| `EMB-ISR-SHARED-001` | contract-pass | pending | pending |
| `EMB-ISR-SHARED-002` | contract-pass | pending | pending |
| `EMB-ISR-SIGNAL-001` | contract-pass | pending | pending |
| `EMB-ISR-VECTOR-001` | contract-pass | pending | pending |
| `EMB-MEM-ALLOC-001` | contract-pass | pending | pending |
| `EMB-MEM-ALLOC-RESULT-001` | contract-pass | pending | pending |
| `EMB-MEM-ALLOC-STATE-001` | contract-pass | pending | pending |
| `EMB-MEM-LAYOUT-001` | contract-pass | pending | pending |
| `EMB-MEM-LIFETIME-001` | contract-pass | pending | pending |
| `EMB-MEM-OWNERSHIP-001` | contract-pass | pending | pending |
| `EMB-MEM-STACK-001` | contract-pass | pending | pending |
| `EMB-MMIO-ORDER-001` | contract-pass | pending | pending |
| `EMB-MMIO-RAM-SYNC-001` | contract-pass | pending | pending |
| `EMB-MMIO-RESERVED-001` | contract-pass | pending | pending |
| `EMB-MMIO-RMW-001` | contract-pass | pending | pending |
| `EMB-MMIO-VOLATILE-001` | contract-pass | pending | pending |
| `EMB-MMIO-WIDTH-001` | contract-pass | pending | pending |
| `EMB-REPR-ALIGN-001` | contract-pass | pending | pending |
| `EMB-REPR-BITFIELD-001` | contract-pass | pending | pending |
| `EMB-REPR-FIELD-001` | contract-pass | pending | pending |
| `EMB-REPR-SERIALIZE-001` | contract-pass | pending | pending |
| `RTOS-COMMON-BLOCK-001` | contract-pass | pending | pending |
| `RTOS-COMMON-BLOCK-RESULT-001` | contract-pass | pending | pending |
| `RTOS-COMMON-CONTEXT-001` | contract-pass | pending | pending |
| `RTOS-COMMON-ISR-NOWAIT-001` | contract-pass | pending | pending |
| `RTOS-COMMON-LIFECYCLE-001` | contract-pass | pending | pending |
| `RTOS-COMMON-LIFECYCLE-002` | contract-pass | pending | pending |
| `RTOS-COMMON-OWNERSHIP-001` | contract-pass | pending | pending |
| `RTOS-COMMON-OWNERSHIP-002` | contract-pass | pending | pending |
| `RTOS-COMMON-PRIORITY-001` | contract-pass | pending | pending |
| `RTOS-COMMON-PRIORITY-002` | contract-pass | pending | pending |
| `RTOS-COMMON-STACK-001` | contract-pass | pending | pending |
| `RTOS-FREERTOS-CONFIG-001` | contract-pass | pending | pending |
| `RTOS-FREERTOS-ISR-001` | contract-pass | pending | pending |
| `RTOS-FREERTOS-ISR-002` | contract-pass | pending | pending |
| `RTOS-FREERTOS-PRIORITY-001` | contract-pass | pending | pending |
| `RTOS-RTTHREAD-IPC-001` | contract-pass | pending | pending |
| `RTOS-RTTHREAD-ISR-001` | contract-pass | pending | pending |
| `RTOS-THREADX-ISR-001` | contract-pass | pending | pending |
| `RTOS-THREADX-ISR-002` | contract-pass | pending | pending |
| `RTOS-THREADX-ISR-003` | contract-pass | pending | pending |
| `RTOS-THREADX-POOL-001` | contract-pass | pending | pending |
| `TOOL-GCC-ABI-001` | contract-pass | pending | pending |
| `TOOL-GCC-ATTR-001` | contract-pass | pending | pending |
| `TOOL-GCC-ATTR-EFFECT-001` | contract-pass | pending | pending |
| `TOOL-GCC-LTO-001` | contract-pass | pending | pending |
| `TOOL-GCC-OPT-001` | contract-pass | pending | pending |
| `TOOL-GCC-WARN-001` | contract-pass | pending | pending |
<!-- END CURRENT_RULE_STATUS -->

## ID migration record

The following IDs were retained for one narrowed requirement and supplemented with fresh IDs;
the old ID is never reassigned to a different meaning:

| Former contract | New or narrowed IDs |
| --- | --- |
| `C-NAME-SCOPE-001` | narrowed to internal linkage; `C-NAME-EXPORT-001` owns export prefixes |
| `C-PP-MACRO-001` | narrowed to macro prefixes; `C-PP-MACRO-002`/`003`/`004` own parentheses, single evaluation, and statement shape |
| `C-PP-INCLUDE-001` | narrowed to guards; `C-PP-INCLUDE-002`/`003` own dependencies and C++ linkage |
| `C-API-BUFFER-001` | narrowed to nullability; `C-API-BUFFER-002`/`003`/`004` own size, unit, and output range |
| `C-API-ERROR-001` | narrowed to explicit status type; `C-API-ERROR-002` through `006` own caller handling and forbidden channels |
| `C-API-NULL-001` | narrowed to boundary validation; `C-API-NULL-002` owns `const` qualification |
| `C-API-VOID-001` | narrowed to generic-pointer domains; `C-API-VOID-002` owns typed-pointer retention |
| `C-API-LICENSE-001` | narrowed to the Doxygen header; `C-API-LICENSE-002` owns license/SPDX choice |
| `C-STYLE-TYPES-001` | narrowed to fixed-width layout fields; `C-STYLE-TYPES-002` owns logical `bool` state |
| `C-STYLE-INIT-001` | narrowed to first-read initialization; `C-STYLE-INIT-003` owns static/thread initialization |
| `C-STYLE-MEM-001` | narrowed to finite VLA bounds; `C-STYLE-MEM-002`/`003`/`004` own stack budget, lifetime, and context |
| `C-STYLE-SWITCH-001` | narrowed to unmatched values; `C-STYLE-SWITCH-002` owns intentional fall-through markers |
| `EMB-CONC-CRITICAL-001` | narrowed to saved-state restoration; `EMB-CONC-CRITICAL-SCOPE-001` owns minimum scope |
| `EMB-CONC-LOCK-001` | narrowed to global order; `EMB-CONC-LOCK-RELEASE-001` owns exit-path release |
| `EMB-MEM-ALLOC-001` | narrowed to allocation context/result; `EMB-MEM-ALLOC-STATE-001` owns failure-state preservation |
| `EMB-MMIO-VOLATILE-001` | narrowed to MMIO access qualifiers; `EMB-MMIO-RAM-SYNC-001` owns ordinary shared-RAM synchronization |
| `EMB-REPR-FIELD-001` | narrowed to fixed-width external fields; `EMB-REPR-BITFIELD-001` owns the external bit-field prohibition |
| `C-ARITH-SHIFT-001` | narrowed to shift-count bounds; `C-ARITH-SHIFT-SIGN-001` owns signed-shift semantics and `C-ARITH-SHIFT-MASK-001` owns top-bit mask width/type |
| `CORE-CHG-DEFENSIVE-001` | narrowed to evidence citation; `CORE-CHG-DEFENSIVE-BEHAVIOR-001` owns observable behavior matching the cited source |
| `EMB-ISR-BOUND-001` | narrowed to interrupt-callable operations; `EMB-ISR-NOWAIT-001` owns the non-blocking boundary and `EMB-ISR-API-001` owns task-vs-ISR entry-point selection |

## Evidence record

The former `needs-rewrite` items have been resolved and remain traceable in the resolution and
migration tables above. For each target/domain review item, the consuming project must record:

```text
Evidence: source and target behavior reviewed
Owner: responsible domain reviewer
Configuration: target, RTOS, compiler, linker, and flags
Expected: exact pass criterion or observable state
Observed: actual result
Artifact: report, log, map, measurement, disassembly, or code location
Outstanding: deferred work and completion condition
```

No module or profile is promoted to `active` by this ledger. Target-dependent rules remain
`provisional` until the consuming project and the responsible domain owner provide the required
configuration-specific evidence.
