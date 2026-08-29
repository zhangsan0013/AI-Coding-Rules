# Arm Architecture Rules

Status: draft

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

An exported function, object, or assembly boundary MUST use the one verified ABI, calling
convention, data layout, and instruction-set state selected for the target.

- Applies when: Writing assembly, using ABI or calling-convention attributes, exporting symbols, mixing object files, or changing floating-point settings.
- Rationale: An ABI mismatch can corrupt registers or stack state while each translation unit still appears type-correct.
- Verification: Inspect compiler flags, symbol attributes, object metadata, and a cross-language or cross-object call test.
- Exceptions: A boundary MAY use another convention only through a reviewed adapter that documents and verifies both sides.

### ARCH-ARM-EXCEPTION-001 [MUST]

Exception entry, stacked-frame access, and exception return MUST follow the exact core and
port-defined mode, stack, alignment, and saved-state protocol.

- Applies when: Implementing vectors, handlers, context switches, fault handlers, naked functions, or manually restoring exception state.
- Rationale: Exception entry is not an ordinary C call; an incorrect frame or return token can prevent recovery or return to the wrong privilege/context.
- Verification: Compare the handler and assembly stub with the core reference manual and port, and test nested, fault, and extended-frame cases that apply.
- Exceptions: A hand-written sequence MAY replace the port stub only when the complete saved-state and return proof is recorded.

### ARCH-ARM-BARRIER-001 [MUST]

An Arm barrier MUST be selected for the required ordering or completion domain and placed at
the ownership boundary it protects; a barrier MUST NOT be used as a substitute for an
unsupported atomic operation.

- Applies when: Ordering normal memory, device memory, interrupt state, DMA descriptors, or instruction updates.
- Rationale: DMB, DSB, and ISB have different effects and domains, while ordering alone does not make a conflicting access atomic.
- Verification: State the producer, consumer, memory type, domain, and required effect, then inspect the target sequence and test the handoff.
- Exceptions: A project synchronization adapter MAY hide the instruction when it documents the equivalent target-specific barrier.

### ARCH-ARM-ATOMIC-001 [MUST]

An Arm atomic or exclusive-access sequence MUST use an instruction and width supported by
the exact core, MUST satisfy alignment requirements, and MUST have a bounded retry or
failure path.

- Applies when: Using exclusive load/store, compare-and-swap, atomic read-modify-write, or compiler atomic builtins.
- Rationale: Optional extensions, alignment, interrupts, and contention affect both availability and progress of an atomic sequence.
- Verification: Check target flags and core support, prove the retry bound, and test contention, spurious failure, and exhaustion paths.
- Exceptions: An unbounded retry MAY be used only in a context with a separately proven finite contention bound and recorded budget.

### ARCH-ARM-ALIGN-001 [MUST]

Code MUST NOT perform an unaligned or packed access unless the exact core, bus, instruction,
and fault configuration document the access as valid for that object.

- Applies when: Casting byte buffers, mapping wire formats, using packed structures, or issuing multi-byte loads and stores.
- Rationale: Alignment behavior varies by instruction and core and can change from a slower access to a fault or a split peripheral transaction.
- Verification: Inspect object alignment and generated access width, and test the minimum alignment and fault behavior on the target.
- Exceptions: A byte-wise adapter MAY decode an unaligned representation when it preserves the specified endianness and bounds.

## Module examples

See the larger [compliant](../../examples/ARCH-ARM-BARRIER-001/compliant.c) and
[violating](../../examples/ARCH-ARM-BARRIER-001/violation.c) examples.

Correct:

```c
extern void arm_dmb_for_shared_memory(void);

void publish_descriptor(unsigned *ready, unsigned *descriptor)
{
    *descriptor = 1U;
    arm_dmb_for_shared_memory(); /* The project adapter documents the target domain. */
    *ready = 1U;
}
```

Incorrect:

```c
void publish_descriptor(unsigned *ready, unsigned *descriptor)
{
    *ready = 1U;
    /* A barrier after publication cannot repair the already visible stale descriptor. */
    *descriptor = 1U;
}
```
