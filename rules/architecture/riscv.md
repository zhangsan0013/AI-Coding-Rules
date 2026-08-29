# RISC-V Architecture Rules

Status: draft

## Scope

RISC-V-specific ABI, privilege, CSR, atomic, instruction, alignment, and memory-ordering
behavior independent of the selected RTOS and compiler. Exact ISA extensions, privilege
level, core, and ABI facts belong in `PROJECT_RULES.md`.

## Load when

Changing RISC-V-specific ABI behavior, privilege handling, CSRs, atomic operations,
barriers, or instructions.

## Project facts this module depends on

- The exact XLEN, ISA string, optional extensions, privilege levels, endianness, and trap
  delegation used by the target.
- The selected ABI, stack alignment, trap entry/return implementation, and interrupt model.
- The supported atomic widths, memory-ordering instructions, CSR permissions, and compiler
  target flags.

Record these in `PROJECT_RULES.md`; a RISC-V family name does not identify the available
extensions or privilege behavior.

## Rules

### ARCH-RISCV-ABI-001 [MUST]

An exported function, object, or assembly boundary MUST use the verified RISC-V XLEN, ABI,
register convention, stack alignment, and data layout selected for the target.

- Applies when: Writing assembly, exporting symbols, mixing object files, using ABI-sensitive attributes, or changing XLEN or floating-point settings.
- Rationale: An ABI mismatch can corrupt arguments, return values, callee-saved registers, or stack frames without a source-level type error.
- Verification: Inspect compiler flags, object metadata, symbol conventions, and cross-object call tests.
- Exceptions: A different convention MAY be used only behind a reviewed adapter that proves both boundary contracts.

### ARCH-RISCV-TRAP-001 [MUST]

Trap entry, CSR save/restore, privilege transition, and trap return MUST preserve the exact
state required by the selected core, delegation, and interrupt model.

- Applies when: Implementing trap vectors, machine or supervisor handlers, context switches, fault handlers, or naked assembly stubs.
- Rationale: A trap is not an ordinary C call; losing status, cause, stack, or return state can re-enter at the wrong privilege or corrupt interrupted work.
- Verification: Compare the entry and return sequence with the privileged specification and port implementation, and test nested, synchronous, and asynchronous traps that apply.
- Exceptions: A replacement stub MAY be used only when the complete saved-state and privilege proof is recorded.

### ARCH-RISCV-FENCE-001 [MUST]

A RISC-V fence or equivalent ordering operation MUST state the predecessor, successor, and
memory domains it orders and MUST be placed at the ownership boundary that requires it.

- Applies when: Ordering normal memory, device access, DMA descriptors, MMIO, or instruction visibility.
- Rationale: A fence with the wrong predecessor or successor set does not establish the intended visibility, and ordering does not make conflicting access atomic.
- Verification: Document the producer, consumer, memory types, and required ordering, then inspect the generated sequence and test the handoff.
- Exceptions: A project synchronization adapter MAY hide the instruction when its target-specific ordering contract is verified.

### ARCH-RISCV-ATOMIC-001 [MUST]

RISC-V atomic or load-reserved/store-conditional code MUST use an extension and width
supported by the exact target, MUST satisfy alignment requirements, and MUST have a bounded
retry or failure path.

- Applies when: Using the A extension, compiler atomics, LR/SC loops, or atomic memory operations.
- Rationale: The ISA string, XLEN, alignment, contention, and reservation rules determine whether an operation is available and whether it makes progress.
- Verification: Check target ISA and compiler flags, prove the retry bound, and test contention, reservation loss, and unsupported-configuration paths.
- Exceptions: An unbounded retry MAY be used only with a separately proven finite contention bound and recorded latency budget.

### ARCH-RISCV-CSR-001 [MUST]

Code MUST access a CSR only at a privilege level and execution mode that permit the access,
MUST preserve bits not owned by the operation, and MUST account for documented read or
write side effects.

- Applies when: Reading or writing status, interrupt, trap, timer, performance, or vendor-specific CSRs.
- Rationale: CSR permissions and side effects vary by privilege level and implementation; an unmasked write can disable traps or destroy delegated state.
- Verification: Compare masks and access mode with the privileged and platform specifications, then test reset, trap, and unsupported-access behavior.
- Exceptions: A full CSR write MAY be used only for a documented reset or initialization value whose complete bit semantics are verified.

## Module examples

See the larger [compliant](../../examples/ARCH-RISCV-FENCE-001/compliant.c) and
[violating](../../examples/ARCH-RISCV-FENCE-001/violation.c) examples.

Correct:

```c
extern void riscv_fence_rw_rw(void);

void publish_descriptor(unsigned *ready, unsigned *descriptor)
{
    *descriptor = 1U;
    riscv_fence_rw_rw(); /* The adapter documents predecessor/successor domains. */
    *ready = 1U;
}
```

Incorrect:

```c
void publish_descriptor(unsigned *ready, unsigned *descriptor)
{
    *ready = 1U;
    *descriptor = 1U; /* A flag-first store publishes before the payload. */
}
```
