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
- Verification (agent): Build a transfer-state table showing the owner and legal accesses at start, active, complete, error, and abort states. Pass when each state has exactly one owner and no CPU access occurs in a DMA-owned state; artifact: state table and source access list.
- Verification (target): Using the `PROJECT_RULES.md` `dma-transfer` configuration, walk every ownership transition, including error, abort, and rejected reuse. Pass when illegal reuse is rejected and the final owner matches the state-machine table for 100% of cases; artifact: DMA trace, status log, and configuration snapshot.
- Exceptions: A documented hardware-owned field MAY be updated by the CPU only when the engine specification, field scope, owner, and review condition are recorded in `PROJECT_RULES.md`.

Correct:

```c
void start_tx(void)
{
    fill_descriptor(&tx_desc);
    dma_start(&tx_desc);       /* ownership transfers to DMA here */
    wait_for_dma_done();
    consume_result(&tx_desc);  /* CPU touches it only after completion */
}
```

Incorrect:

```c
void start_tx(void)
{
    dma_start(&tx_desc);
    tx_desc.length = 0U; /* CPU modifies a descriptor still owned by DMA. */
}
```

### EMB-DMA-LIFETIME-001 [MUST]

Every address submitted to a DMA engine MUST remain valid, reachable, and unchanged in
placement until the engine reports completion or a documented abort has finished.

- Applies when: Submitting stack, heap, static, retained, or mapped buffers and descriptors.
- Rationale: A CPU-side lifetime or pointer update does not stop an in-flight bus master.
- Verification (agent): Trace each submitted address through normal, timeout, reset, and abort paths. Pass when storage remains reachable and its placement is unchanged until completion/abort, with no automatic object escaping its scope; artifact: lifetime trace and ownership table.
- Verification (target): Using the `PROJECT_RULES.md` `dma-lifetime` configuration, test normal completion, timeout, reset, abort, and reuse immediately before and after completion. Pass when the engine never observes an invalid or changed address and every reuse begins after the recorded boundary in 100% of runs; artifact: descriptor capture, transfer log, and configuration snapshot.
- Exceptions: A scatter-gather or double-buffer protocol MAY change storage only at its documented ownership boundary, with buffer identity, owner, boundary event, and reviewer recorded.

Correct:

```c
static uint8_t tx_buffer[128];

bool send_frame(void)
{
    return dma_start(tx_buffer, sizeof(tx_buffer)); /* storage is static until done */
}
```

Incorrect:

```c
bool send_frame(void)
{
    uint8_t buffer[128];
    dma_start(buffer, sizeof(buffer));
    return true; /* the stack object can disappear while DMA is active */
}
```

### EMB-DMA-CACHE-001 [MUST]

On a non-coherent system, the cache-maintenance operation MUST match the transfer direction
for the complete cache-line-rounded buffer or descriptor range.

- Applies when: The CPU and DMA can hold different views of a buffer or descriptor.
- Rationale: Cleaning makes CPU writes visible to a device, while invalidation discards stale CPU lines after a device write; applying the wrong operation can discard newer data or expose stale data.
- Verification (agent): For each transfer direction, record the cache-line-rounded address range and maintenance operation at submission or completion. Pass when every CPU-to-device transfer cleans the complete range before submission and every device-to-CPU transfer invalidates the complete range after completion; artifact: direction table, cache-line calculation, and source locations.
- Verification (target): Using the `PROJECT_RULES.md` `dma-cache` configuration, exercise dirty CPU lines before device reads and stale CPU lines before device-written reads for at least 100 transfers per direction. Pass when the device reads the latest CPU bytes and the CPU reads the latest device bytes in 100% of trials; artifact: cache trace, buffer snapshots, and configuration snapshot.
- Exceptions: Maintenance MAY be omitted only for a verified coherent region or a primitive that explicitly includes it, with region/primitive version, owner, evidence, and review condition recorded.

Correct:

```c
void start_tx(const void *buffer, size_t length)
{
    cache_clean(buffer, length); /* whole cache-line range */
    dma_start(buffer, length);
}
```

Incorrect:

```c
void start_tx(const void *buffer, size_t length)
{
    dma_start(buffer, length); /* dirty CPU cache lines can hide the payload */
}
```

### EMB-DMA-CACHE-002 [MUST]

Each DMA ownership transition MUST execute the project-approved memory barrier or cache
completion operation at the boundary recorded for that transfer direction.

- Applies when: Transferring a buffer or descriptor between CPU ownership and a DMA engine on a non-coherent or weakly ordered system.
- Rationale: Correct cache maintenance does not by itself order the maintenance completion, descriptor writes, and engine ownership update; the device can otherwise start from an incomplete view.
- Verification (agent): For every ownership transition, identify the boundary event and the required barrier or completion primitive in `PROJECT_RULES.md`. Pass when the primitive dominates the ownership handoff and no engine-visible ownership bit changes first; artifact: ownership sequence table, control-flow report, and primitive contract.
- Verification (target): Using the `PROJECT_RULES.md` `dma-cache-boundary` configuration, trace at least 100 submissions and completions per direction with the configured barrier/completion event. Pass when every trace orders cache completion, descriptor visibility, and ownership change exactly as recorded, with zero early handoffs; artifact: bus/cache trace, descriptor snapshots, and configuration snapshot.
- Exceptions: A boundary operation MAY be omitted only when the selected DMA API explicitly includes the required ordering, with API version, direction, ownership event, owner, and review condition recorded.

Correct:

```c
void start_tx(const void *buffer, size_t length)
{
    cache_clean(buffer, length);
    dma_memory_barrier();       /* completion precedes the DMA ownership handoff */
    dma_start(buffer, length);
}
```

Incorrect:

```c
void start_tx(const void *buffer, size_t length)
{
    cache_clean(buffer, length);
    dma_start(buffer, length);  /* ownership changes before the required boundary */
    dma_memory_barrier();
}
```

### EMB-DMA-ALIGN-001 [MUST]

DMA buffers and descriptors MUST satisfy the engine's address, alignment, size, stride, and
boundary constraints without relying on an incidental compiler layout.

- Applies when: Declaring, slicing, packing, or mapping any DMA-visible object.
- Rationale: A misaligned or boundary-crossing transfer can fault, truncate, or corrupt adjacent storage.
- Verification (agent): Check each descriptor and buffer against the engine table for address alignment, size granularity, stride, boundary, and cache-line isolation, and require a build-time assertion where possible. Pass when all declared properties are proved; artifact: static-assert output and linker placement report.
- Verification (target): Using the `PROJECT_RULES.md` `dma-constraints` configuration, inspect the map and test the minimum, maximum, and boundary-crossing transfer sizes. Pass when all legal sizes complete and every illegal alignment/size is rejected before hardware start in 100% of cases; artifact: map excerpt, DMA test log, and configuration snapshot.
- Exceptions: A project-supported bounce-buffer copy MAY adapt an incompatible application buffer only when source/destination constraints, owner, copy boundary, and review condition are recorded.

Correct:

```c
struct __attribute__((aligned(16))) dma_desc {
    uint32_t address;
    uint32_t length;
};

_Static_assert(_Alignof(struct dma_desc) >= 16U, "DMA descriptor alignment");
static struct dma_desc desc;
```

Incorrect:

```c
struct dma_desc {
    uint32_t address;
    uint32_t length;
};

static uint8_t bytes[sizeof(struct dma_desc) + 1U];
static struct dma_desc *desc = (struct dma_desc *)(bytes + 1U); /* odd address */
```

### EMB-DMA-COMPLETE-001 [MUST]

Software MUST distinguish successful completion, hardware error, abort, and timeout before
releasing or reusing a DMA-owned object.

- Applies when: Handling completion interrupts, polling status, cancellation, reset, and recovery.
- Rationale: Reusing a buffer on an ambiguous status can race a still-active transfer or silently lose a hardware error.
- Verification (agent): Map each completion source and branch for success, error, timeout, abort, repeated, and stale events. Pass when every branch yields one of the four documented terminal results and leaves ownership defined; artifact: status-to-state table and control-flow report.
- Verification (target): Using the `PROJECT_RULES.md` `dma-status` configuration, exercise success, error, timeout, abort, repeated completion, and stale-event cases. Pass when reuse occurs only after a terminal result and the final owner matches the expected state in 100% of cases; artifact: event trace, ownership log, and configuration snapshot.
- Exceptions: A platform completion primitive MAY provide the distinction only when its documented status contract, version, owner, and evidence are recorded; otherwise no exception applies.

Correct:

```c
enum dma_result { DMA_OK, DMA_ERROR, DMA_ABORTED, DMA_TIMEOUT };

enum dma_result finish_transfer(void)
{
    enum dma_result result = dma_wait_status();

    if (result != DMA_OK) {
        dma_reclaim_after_failure(result);
    }
    return result; /* reuse is decided only after a distinct result */
}
```

Incorrect:

```c
void finish_transfer(void)
{
    if (dma_done_flag) {
        reuse_buffer();
    } /* an error, timeout, or stale completion is indistinguishable */
}
```

## Module examples

See the larger [compliant](../../examples/EMB-DMA-OWNERSHIP-001/compliant.c) and
[violating](../../examples/EMB-DMA-OWNERSHIP-001/violation.c) examples.
