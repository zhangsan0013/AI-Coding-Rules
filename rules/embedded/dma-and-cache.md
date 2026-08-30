# DMA and Cache Rules

Status: provisional

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
- Verification (agent): Confirm the buffer has one owner at each point in the transfer, and that the CPU neither reads nor writes it between the start and the completion the project defines. An access to a buffer while the engine owns it is a finding.
- Verification (target): Walk the ownership state machine including error and abort transitions, and test every transition and rejected reuse.
- Exceptions: A documented hardware-owned field MAY be updated by the CPU only when the engine specification defines that access as safe.

### EMB-DMA-LIFETIME-001 [MUST]

Every address submitted to a DMA engine MUST remain valid, reachable, and unchanged in
placement until the engine reports completion or a documented abort has finished.

- Applies when: Submitting stack, heap, static, retained, or mapped buffers and descriptors.
- Rationale: A CPU-side lifetime or pointer update does not stop an in-flight bus master.
- Verification (agent): Confirm the buffer outlives the transfer on every path, including timeout, reset, and abort. A DMA buffer with automatic storage duration, or one released before completion is observed, is a finding.
- Verification (target): Check lifetime through the normal, timeout, reset, and abort paths, and test reuse immediately before and after completion.
- Exceptions: A scatter-gather or double-buffer protocol MAY change storage only at its documented ownership boundary.

### EMB-DMA-CACHE-001 [MUST]

On a non-coherent system, cache maintenance and memory barriers MUST be performed for the
transfer direction and at the ownership boundaries required by the target.

- Applies when: The CPU and DMA can hold different views of a buffer or descriptor.
- Rationale: Cleaning, invalidating, and ordering have different effects; the wrong operation can discard newer data or expose stale data.
- Verification (agent): Confirm a clean precedes each CPU-to-device transfer and an invalidate follows each device-to-CPU transfer, over a range covering whole cache lines. A maintenance call on a sub-line range, or a missing invalidate before reading a received buffer, is a finding.
- Verification (target): Check the cache-line range, direction, alignment, barrier, and completion sequence on the target, and test the stale-read and dirty-writeback cases.
- Exceptions: Maintenance MAY be omitted only for a verified coherent region or a project primitive that explicitly includes the required behavior.

### EMB-DMA-ALIGN-001 [MUST]

DMA buffers and descriptors MUST satisfy the engine's address, alignment, size, stride, and
boundary constraints without relying on an incidental compiler layout.

- Applies when: Declaring, slicing, packing, or mapping any DMA-visible object.
- Rationale: A misaligned or boundary-crossing transfer can fault, truncate, or corrupt adjacent storage.
- Verification (agent): Confirm each descriptor and buffer declares the alignment, size granularity, and placement the engine requires, with a build-time assertion where one is possible. A buffer sharing a cache line with an unrelated object is a finding on a system with maintenance by line.
- Verification (target): Inspect declarations and linker placement, and test the minimum and maximum legal transfer sizes.
- Exceptions: A project-supported copy into a verified bounce buffer MAY adapt an otherwise incompatible application buffer.

### EMB-DMA-COMPLETE-001 [MUST]

Software MUST distinguish successful completion, hardware error, abort, and timeout before
releasing or reusing a DMA-owned object.

- Applies when: Handling completion interrupts, polling status, cancellation, reset, and recovery.
- Rationale: Reusing a buffer on an ambiguous status can race a still-active transfer or silently lose a hardware error.
- Verification (agent): Confirm completion is decided by the source the hardware defines, and that error, timeout, abort, and repeated or stale completion events each reach a branch that leaves ownership defined.
- Verification (target): Exercise success, error, timeout, abort, repeated completion, and stale-event cases and confirm the final ownership state.
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
    dma_prepare_for_device(tx_buffer, sizeof(tx_buffer));
    return dma_start(tx_buffer, sizeof(tx_buffer)); /* Ownership transfers explicitly. */
}
```

Incorrect:

```c
#include <stdint.h>

extern void dma_start(const void *buffer, uint32_t length);

void transmit(void)
{
    uint8_t local_buffer[128] = {0U};

    dma_start(local_buffer, sizeof(local_buffer));
} /* The DMA may still use the expired stack buffer. */
```
