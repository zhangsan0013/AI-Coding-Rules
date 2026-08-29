# Register Access Rules

Status: draft

## Scope

Memory-mapped I/O, `volatile`, register side effects, read-modify-write operations, access
width, and hardware ordering requirements.

## Load when

Reading or writing peripheral registers or hardware control blocks.

## Project facts this module depends on

- The register address, access width, alignment, reset value, and side effects for each field.
- Whether a field is read-only, write-only, write-one-to-clear, write-one-to-set, clear-on-read,
  or subject to a posted-write or ordering requirement.
- The project-supported register definitions and barrier or synchronization primitives.

Record these from the target reference manual and errata in `PROJECT_RULES.md`.

## Rules

### EMB-MMIO-VOLATILE-001 [MUST]

Memory-mapped registers MUST be accessed through the project-supported volatile register
definition, and `volatile` MUST NOT be used as the synchronization mechanism for ordinary
shared RAM.

- Applies when: Declaring, reading, writing, or wrapping a memory-mapped register or hardware control block.
- Rationale: Volatile preserves required compiler-visible accesses but does not provide ownership, atomicity, cache maintenance, or inter-context ordering for normal memory.
- Verification: Compare the declaration and every access with the target register interface, and separately verify the synchronization used for shared RAM.
- Exceptions: A project MAY use a generated or vendor register header when its access qualifiers and version are verified against the target.

### EMB-MMIO-WIDTH-001 [MUST]

Each register access MUST use the width, alignment, and byte-order semantics documented for
that register; a cast MUST NOT be used to manufacture an unsupported access width.

- Applies when: Reading or writing registers, packed device descriptions, or bus windows.
- Rationale: An apparently equivalent wider or narrower access can trigger adjacent side effects, bus faults, or partial writes.
- Verification: Review the generated or handwritten type and compiler output where width matters, then test aligned and boundary accesses on the target or supported model.
- Exceptions: A wider or split access MAY be used only when the hardware documentation explicitly defines its semantics and the adapter preserves them.

### EMB-MMIO-RMW-001 [MUST]

Read-modify-write MUST NOT be used on a register or field whose read or write has side
effects, unless the target documentation explicitly defines the operation as safe.

- Applies when: Updating control, status, interrupt, latch, or command registers, especially when multiple contexts can access them.
- Rationale: A read can clear or sample state, and a write can acknowledge or trigger state; an unverified read-modify-write can lose events or write back transient bits.
- Verification: Classify every affected field from the reference manual and test concurrent, repeated, and pending-event cases.
- Exceptions: A documented atomic set/clear alias or an explicitly safe read-modify-write sequence MAY be used with its access protocol recorded.

### EMB-MMIO-RESERVED-001 [MUST]

Writes MUST preserve reserved and implementation-defined bits according to the target
reset and write-mask rules; code MUST NOT invent values for undocumented fields.

- Applies when: Writing full registers, reset values, configuration masks, or generated register structures.
- Rationale: Reserved bits can be checked, latch behavior, or future-compatible state; arbitrary writes can create silicon-dependent behavior.
- Verification: Compare every written mask and reset value with the reference manual and errata, including initialization and recovery paths.
- Exceptions: A full-register write MAY use a documented reset or required constant that explicitly defines reserved-bit values.

### EMB-MMIO-ORDER-001 [MUST]

When hardware requires an order between ordinary memory and register accesses, the code
MUST use the project-approved barrier or completion operation at the documented boundary.

- Applies when: Publishing descriptors, enabling peripherals, acknowledging status, starting transfers, or disabling hardware after memory access.
- Rationale: Compiler ordering, CPU ordering, and peripheral completion are distinct; satisfying only one can expose stale descriptors or reorder control effects.
- Verification: Record the required ordering and verify the generated sequence or target behavior for each producer and consumer boundary.
- Exceptions: A barrier MAY be omitted only when the target documentation and the project memory model prove that the surrounding operation already supplies the requirement.

## Module examples

See the larger [compliant](../../examples/EMB-MMIO-VOLATILE-001/compliant.c) and
[violating](../../examples/EMB-MMIO-VOLATILE-001/violation.c) examples.

Correct:

```c
#include <stdint.h>

typedef struct {
    volatile uint32_t status;
    volatile uint32_t control;
} peripheral_regs_t;

static peripheral_regs_t *const peripheral = (peripheral_regs_t *)0x40000000U;

uint32_t peripheral_status_read(void)
{
    return peripheral->status; /* Width and volatile access are explicit. */
}
```

Incorrect:

```c
#include <stdint.h>

typedef struct {
    uint32_t status;
    uint32_t control;
} peripheral_regs_t;

static peripheral_regs_t *const peripheral = (peripheral_regs_t *)0x40000000U;

void peripheral_status_clear(void)
{
    peripheral->status |= 1U; /* Unqualified RMW can lose a side-effectful status bit. */
}
```
