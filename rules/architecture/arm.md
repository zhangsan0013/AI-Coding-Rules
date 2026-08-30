# Arm Architecture Rules

Status: provisional

## Scope

Arm-specific ABI, exception, atomic, instruction, alignment, and memory-ordering behavior
independent of the selected RTOS and compiler. Exact core and architecture facts belong in
`PROJECT_RULES.md`.

## Load when

Changing Arm-specific ABI behavior, exception handling, atomic operations, barriers, or
instructions.

## Project facts this module depends on

- The exact Arm profile, core, instruction-set state, endianness, privilege model, and
  optional extensions in use.
- The selected ABI, floating-point calling convention, exception frame, vector table, and
  startup/return implementation.
- The supported atomic widths, alignment rules, barrier domains, memory map, and compiler
  target flags.

Record these in `PROJECT_RULES.md`; an Arm family name is not enough to establish the rules
for a particular core or port.

## Rules

### ARCH-ARM-ABI-001 [MUST]

Each exported function, object, or assembly boundary MUST conform to the one verified target
boundary contract: ABI, calling convention, data layout, floating-point mode, and
instruction-set state.

- Applies when: Writing assembly, using ABI or calling-convention attributes, exporting symbols, mixing object files, or changing floating-point settings.
- Rationale: An ABI mismatch can corrupt registers or stack state while each translation unit still appears type-correct.
- Verification (agent): Inventory every assembly/export boundary and compare calling convention, data layout, floating-point mode, and instruction-set state with the selected ABI. Pass when all linked objects agree or a named adapter owns conversion; artifact: object-flag table and symbol boundary report.
- Verification (target): Inspect compiler flags/object attributes and run a cross-object call that exercises integer, pointer, and floating-point arguments. Pass when values and callee-saved registers match the reference result; artifact: disassembly, metadata dump, and test log.
- Exceptions: A boundary MAY use another convention only through a reviewed adapter with both contracts, owner, conversion evidence, and review/removal condition recorded.

Correct:

```c
/* PROJECT_RULES.md records AAPCS, soft-float, and Thumb-2 for both objects. */
#include <stdint.h>

extern uint32_t arm_add(uint32_t left, uint32_t right);

uint32_t sum(uint32_t left, uint32_t right)
{
    return arm_add(left, right);
}
```

Incorrect:

```c
/* The definition uses the recorded base AAPCS, but this declaration requests VFP PCS. */
#include <stdint.h>

extern float arm_mix(float left, float right)
    __attribute__((pcs("aapcs-vfp")));
```

### ARCH-ARM-EXCEPTION-001 [MUST]

Exception entry, stacked-frame access, and exception return MUST follow the exact core and
port-defined mode, stack, alignment, and saved-state protocol.

- Applies when: Implementing vectors, handlers, context switches, fault handlers, naked functions, or manually restoring exception state.
- Rationale: Exception entry is not an ordinary C call; an incorrect frame or return token can prevent recovery or return to the wrong privilege/context.
- Verification (agent): Compare each handler/stub with the port's stack, alignment, saved-state, and return-token protocol. Pass when every saved field is restored and no ordinary C return bypasses the exception return; artifact: frame layout and assembly review.
- Verification (target): Test nested, fault, basic-frame, and extended-frame cases against the core manual. Pass when execution resumes at the interrupted PC with unchanged required state and privilege; artifact: register/frame trace and core configuration.
- Exceptions: A hand-written sequence MAY replace the port stub only when complete saved-state/return proof, owner, and review condition are recorded.

Correct:

```c
__attribute__((naked)) void systick_entry(void)
{
    __asm volatile("tst lr, #4\n"
                   "ite eq\n"
                   "mrseq r0, msp\n"
                   "mrsne r0, psp\n"
                   "b systick_decode_frame\n");
}
```

Incorrect:

```c
void systick_entry(void)
{
    return; /* ordinary C return does not restore the exception frame */
}
```

### ARCH-ARM-BARRIER-001 [MUST]

Each Arm barrier MUST match the ordering or completion effect and shareability domain recorded for the access it protects.

- Applies when: Ordering normal memory, Device memory, interrupt state, DMA descriptors, or instruction updates with DMB, DSB, or ISB.
- Rationale: DMB, DSB, and ISB provide different effects and domains; a mnemonic alone does not establish the required visibility or completion.
- Verification (agent): For each barrier, record the protected access, required ordering or completion effect, and selected DMB/DSB/ISB domain. Pass when the selected instruction and domain cover the recorded effect for every use; artifact: barrier-effect table and disassembly.
- Verification (target): Using the exact core, shareability domain, memory attributes, and trace source recorded in `PROJECT_RULES.md` under `arm-barrier`, exercise each barrier boundary at least 100 times. Pass when the trace shows the recorded ordering or completion effect in 100% of runs; artifact: `PROJECT_RULES.md` snapshot, trace capture, and disassembly.
- Exceptions: A synchronization adapter MAY hide the instruction only when its equivalent target effect and domain, owner, evidence, and review condition are recorded.

Correct:

```c
/* PROJECT_RULES.md: descriptor is Outer Shareable; DMA0->START is Device memory. */
descriptor->length = length;
__asm volatile("dmb oshst" ::: "memory"); /* orders stores in the recorded domain */
DMA0->START = DMA_GO;
```

Incorrect:

```c
/* The operation requires completion, but DMB only orders memory accesses. */
DMA0->START = DMA_GO;
__asm volatile("dmb oshst" ::: "memory");
wait_for_dma_idle();
```

### ARCH-ARM-BARRIER-BOUNDARY-001 [MUST]

An Arm barrier MUST execute at the ownership boundary where the producer hands access to a consumer.

- Applies when: Publishing a normal-memory payload, handing a DMA descriptor to a device, or transferring ownership between execution contexts.
- Rationale: A correctly selected barrier in the wrong location cannot order the accesses that form the handoff.
- Verification (agent): Trace the producer's final write, the barrier, and the consumer's first access for each handoff. Pass when the barrier is on the producer-to-consumer boundary and no protected access occurs outside that recorded sequence; artifact: ownership-boundary table and control-flow report.
- Verification (target): Using the exact producer, consumer, memory attributes, and trace source recorded in `PROJECT_RULES.md` under `arm-barrier-boundary`, exercise 100 producer/consumer handoffs including reset and timeout paths. Pass when every trace places the barrier between the final producer write and first consumer access; artifact: `PROJECT_RULES.md` snapshot, event trace, and disassembly.
- Exceptions: A wrapper MAY place the barrier in a called helper only when the call boundary, ordering proof, owner, evidence, and review condition are recorded.

Correct:

```c
descriptor->length = length;
__asm volatile("dmb oshst" ::: "memory");
DMA0->START = DMA_GO; /* ownership transfers after the barrier */
```

Incorrect:

```c
__asm volatile("dmb oshst" ::: "memory");
descriptor->length = length; /* final producer write is after the barrier */
DMA0->START = DMA_GO;
```

### ARCH-ARM-BARRIER-ATOMIC-001 [MUST]

An Arm barrier MUST NOT be used as the atomicity mechanism for conflicting accesses.

- Applies when: Multiple contexts can update the same object and code adds DMB, DSB, or ISB around the update.
- Rationale: Ordering instructions do not make a read-modify-write sequence indivisible; a concurrent update can still be lost.
- Verification (agent): Inspect every shared read-modify-write sequence that uses a barrier and identify its atomic or lock primitive. Pass when each conflicting update uses an exclusive/atomic operation or lock independent of the barrier; artifact: shared-update inventory and instruction report.
- Verification (target): Using the exact core, shared-object access pattern, and contention harness recorded in `PROJECT_RULES.md` under `arm-barrier-atomic`, run at least 1,000 conflicting updates. Pass when the final value equals the number of accepted updates in 100% of runs and no barrier-only update loses an event; artifact: `PROJECT_RULES.md` snapshot, contention trace, and counter log.
- Exceptions: A barrier-only update MAY be used for a single-owner object only when the ownership proof, scope, owner, evidence, and review condition are recorded.

Correct:

```c
/* DMB orders publication; the exclusive sequence supplies atomicity. */
for (unsigned tries = 0U; tries < 8U; ++tries) {
    uint32_t old = __LDREXW(&counter);
    if (__STREXW(old + 1U, &counter) == 0U) {
        __DMB();
        break;
    }
    __CLREX();
}
```

Incorrect:

```c
uint32_t old = counter;
__DMB();
counter = old + 1U; /* the barrier does not protect this read-modify-write */
```

### ARCH-ARM-ATOMIC-001 [MUST]

An Arm atomic or exclusive-access operation MUST use an instruction and width supported by the exact core and MUST satisfy its alignment requirements.

- Applies when: Using exclusive load/store, compare-and-swap, atomic read-modify-write, or compiler atomic builtins.
- Rationale: Optional extensions, supported widths, and alignment rules determine whether the target can execute an atomic operation without fault or emulation.
- Verification (agent): Match every atomic/exclusive instruction and width to the exact core and inspect the referenced object alignment. Pass when every operation is supported by the recorded core and every operand meets its required alignment; artifact: atomic instruction/width table and alignment report.
- Verification (target): Using the exact core, compiler flags, atomic widths, and alignment-fault setting recorded in `PROJECT_RULES.md` under `arm-atomic-support`, exercise each supported width at aligned and boundary addresses. Pass when 100% of supported cases execute without an alignment fault and unsupported-width fixtures are rejected or use the documented fallback; artifact: `PROJECT_RULES.md` snapshot, fault log, and disassembly.
- Exceptions: A compiler or library fallback MAY implement an unsupported instruction only when its target support, timing, owner, evidence, and review condition are recorded.

Correct:

```c
#include <stdint.h>

_Alignas(4) static uint32_t lock_word;
_Static_assert(sizeof(lock_word) == 4U, "target atomic width must be 32 bits");

uint32_t read_lock(void)
{
    return __atomic_load_n(&lock_word, __ATOMIC_RELAXED);
}
```

Incorrect:

```c
#include <stdint.h>

uint32_t read_unaligned(const unsigned char *bytes)
{
    /* The selected Arm target supports aligned 32-bit atomics only. */
    return __atomic_load_n((const uint32_t *)(bytes + 1U), __ATOMIC_RELAXED);
}
```

### ARCH-ARM-ATOMIC-PROGRESS-001 [MUST]

Each Arm exclusive or atomic sequence MUST have a bounded retry count or return an explicit failure result.

- Applies when: Implementing an exclusive load/store loop, compare-and-swap loop, or an atomic operation whose target may report retry failure.
- Rationale: Interrupts, preemption, and contention can repeatedly clear an exclusive monitor; unbounded retry can violate a latency or watchdog budget.
- Verification (agent): Inspect every retry loop and enumerate all exits. Pass when each loop has a finite configured bound or an explicit failure return reachable after a finite number of attempts; artifact: retry control-flow report and latency budget table.
- Verification (target): Using the exact contention harness, interrupt load, retry bound, and failure status recorded in `PROJECT_RULES.md` under `arm-atomic-progress`, run at least 1,000 contended attempts. Pass when every attempt succeeds within the configured bound or returns the documented failure, with no attempt exceeding the bound; artifact: `PROJECT_RULES.md` snapshot, retry trace, and status log.
- Exceptions: An unbounded retry MAY be used only when the project records a finite contention proof, worst-case latency budget, owner, and review condition.

Correct:

```c
#include <stdbool.h>

bool try_lock(void)
{
    for (unsigned attempt = 0U; attempt < 8U; ++attempt) {
        if (__LDREXW(&lock_word) == 0U && __STREXW(1U, &lock_word) == 0U) {
            return true;
        }
        __CLREX();
    }
    return false; /* bounded failure is visible to the caller */
}
```

Incorrect:

```c
while (__STREXW(1U, &lock_word) != 0U) {
    ; /* no retry bound or failure result */
}
```

### ARCH-ARM-ALIGN-001 [MUST]

Code MUST NOT perform an unaligned or packed access unless the exact core, bus, instruction,
and fault configuration document the access as valid for that object.

- Applies when: Casting byte buffers, mapping wire formats, using packed structures, or issuing multi-byte loads and stores.
- Rationale: Alignment behavior varies by instruction and core and can change from a slower access to a fault or a split peripheral transaction.
- Verification (agent): Inventory unaligned/packed accesses and match each to the exact core, bus, instruction, and fault configuration. Pass when every access is documented valid or replaced by byte-wise decoding; artifact: alignment access table and source scan.
- Verification (target): Enable alignment fault checking and test aligned, odd-offset, and packed accesses. Pass when valid cases complete and unsupported cases fault/reject as documented, without silent corruption; artifact: fault log and disassembly.
- Exceptions: A byte-wise adapter MAY decode an unaligned representation only when endianness, bounds, owner, and review condition are recorded.

Correct:

```c
uint32_t read_aligned(const uint32_t *value)
{
    return *value; /* caller and target contract guarantee alignment */
}
```

Incorrect:

```c
uint32_t read_aligned(const unsigned char *bytes)
{
    return *(const uint32_t *)(bytes + 1U); /* odd offset is not proven aligned */
}
```

## Module examples

See the larger [compliant](../../examples/ARCH-ARM-BARRIER-001/compliant.c) and
[violating](../../examples/ARCH-ARM-BARRIER-001/violation.c) examples.

Correct:

```c
#include <stdint.h>

uint32_t read_word(const uint8_t *buffer)
{
    return ((uint32_t)buffer[0] << 24) | ((uint32_t)buffer[1] << 16)
         | ((uint32_t)buffer[2] << 8) | (uint32_t)buffer[3];
}
```

Incorrect:

```c
uint32_t read_word(const uint8_t *buffer)
{
    return *(const uint32_t *)(buffer + 1U); /* unaligned access may fault */
}
```
