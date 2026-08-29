# DMA and Cache Rules

Status: draft

## Scope

DMA buffer lifetime, ownership, alignment, cache maintenance, coherency, and transfer
completion.

## Load when

Changing DMA transfers or buffers on systems where DMA and CPU memory views can differ.

## Project facts this module depends on

- Which memory regions each DMA engine can address and the required alignment, width, and
  boundary constraints.
- Whether the CPU and DMA are coherent, and the project-approved clean, invalidate, barrier,
  and completion operations when they are not.
- The transfer state machine, descriptor ownership bits, error reporting, and abort behavior.

Record these in `PROJECT_RULES.md` for each engine and direction.

## Rules

### EMB-DMA-OWNERSHIP-001 [MUST]

A DMA buffer or descriptor MUST have one explicit owner at each point in the transfer, and
the CPU MUST NOT modify or consume it while ownership belongs to the DMA engine.

- Applies when: Starting, chaining, completing, aborting, or reusing DMA transfers and descriptors.
- Rationale: Concurrent CPU and DMA mutation produces data corruption that ordinary C race analysis cannot see.
- Verification: Draw the ownership state machine, including error and abort transitions, and test every transition and rejected reuse.
- Exceptions: A documented hardware-owned field MAY be updated by the CPU only when the engine specification defines that access as safe.

### EMB-DMA-LIFETIME-001 [MUST]

Every address submitted to a DMA engine MUST remain valid, reachable, and unchanged in
placement until the engine reports completion or a documented abort has finished.

- Applies when: Submitting stack, heap, static, retained, or mapped buffers and descriptors.
- Rationale: A CPU-side lifetime or pointer update does not stop an in-flight bus master.
- Verification: Check lifetime through normal, timeout, reset, and abort paths, and test reuse immediately before and after completion.
- Exceptions: A scatter-gather or double-buffer protocol MAY change storage only at its documented ownership boundary.

### EMB-DMA-CACHE-001 [MUST]

On a non-coherent system, cache maintenance and memory barriers MUST be performed for the
transfer direction and at the ownership boundaries required by the target.

- Applies when: The CPU and DMA can hold different views of a buffer or descriptor.
- Rationale: Cleaning, invalidating, and ordering have different effects; the wrong operation can discard newer data or expose stale data.
- Verification: Check the cache-line range, direction, alignment, barrier, and completion sequence, then test stale and dirty-cache cases.
- Exceptions: Maintenance MAY be omitted only for a verified coherent region or a project primitive that explicitly includes the required behavior.

### EMB-DMA-ALIGN-001 [MUST]

DMA buffers and descriptors MUST satisfy the engine's address, alignment, size, stride, and
boundary constraints without relying on an incidental compiler layout.

- Applies when: Declaring, slicing, packing, or mapping any DMA-visible object.
- Rationale: A misaligned or boundary-crossing transfer can fault, truncate, or corrupt adjacent storage.
- Verification: Inspect declarations and linker placement, assert the constraints at build time where possible, and test minimum and maximum legal sizes.
- Exceptions: A project-supported copy into a verified bounce buffer MAY adapt an otherwise incompatible application buffer.

### EMB-DMA-COMPLETE-001 [MUST]

Software MUST distinguish successful completion, hardware error, abort, and timeout before
releasing or reusing a DMA-owned object.

- Applies when: Handling completion interrupts, polling status, cancellation, reset, and recovery.
- Rationale: Reusing a buffer on an ambiguous status can race a still-active transfer or silently lose a hardware error.
- Verification: Exercise success, error, timeout, abort, repeated completion, and stale-event cases and verify the final ownership state.
- Exceptions: None; a platform-specific completion primitive MAY provide the distinction when its documented status contract is preserved.

## Module examples

See the larger [compliant](../../examples/EMB-DMA-OWNERSHIP-001/compliant.c) and
[violating](../../examples/EMB-DMA-OWNERSHIP-001/violation.c) examples.

Correct:

```c
#include <stdbool.h>
#include <stdint.h>

extern void dma_prepare_for_device(const void *buffer, uint32_t length);
extern bool dma_start(const void *buffer, uint32_t length);

static uint8_t tx_buffer[128];

bool transmit(void)
{
    dma_prepare_for_device(tx_buffer, sizeof tx_buffer);
    return dma_start(tx_buffer, sizeof tx_buffer); /* Ownership transfers explicitly. */
}
```

Incorrect:

```c
#include <stdint.h>

extern void dma_start(const void *buffer, uint32_t length);

void transmit(void)
{
    uint8_t local_buffer[128] = {0U};

    dma_start(local_buffer, sizeof local_buffer);
} /* The DMA may still use the expired stack buffer. */
```
