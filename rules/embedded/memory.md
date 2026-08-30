# Embedded Memory Rules

Status: provisional

## Scope

Object lifetime, ownership, stack use, allocation, memory sections, alignment, and startup
initialization assumptions.

## Load when

Changing allocation, buffers, persistent state, stack usage, or memory placement.

## Project facts this module depends on

- The linker regions, startup initialization, retention, and reset behavior for each section.
- The alignment and access requirements of the target core, bus, DMA engines, and ABI.
- The allocation policy, allowed allocation contexts, failure behavior, and reclamation owner.
- The reserved stack sizes, interrupt nesting model, and method used to measure high-water use.

Record these in `PROJECT_RULES.md`; do not infer them from a declaration or linker script
that has not been verified for the target.

## Rules

### EMB-MEM-LIFETIME-001 [MUST]

Every object accessed through a pointer MUST remain alive with valid storage for the entire
period in which that pointer can be dereferenced. A returned, queued, deferred, or
asynchronous pointer MUST carry an explicit lifetime contract.

- Applies when: Returning, storing, queueing, or passing pointers across a call, task, interrupt, DMA, or asynchronous callback boundary.
- Rationale: A pointer value does not extend the lifetime of the object it identifies, so a valid-looking address can become a use-after-scope or use-after-release defect.
- Verification (agent): Trace each pointer consumer back to its storage object on success, error, and deferred paths. Pass when the lifetime interval covers every possible dereference and the API contract names the last-use event; artifact: pointer/lifetime table and call-path report.
- Verification (target): Using the `PROJECT_RULES.md` `memory-lifetime` configuration, exercise the last-use-after-transfer and cancellation cases. Pass when the consumer observes valid storage through the documented last-use event and no access occurs after release in 100% of runs; artifact: allocator trace, assertion log, and configuration snapshot.
- Exceptions: A shorter lifetime MAY be used only when the API contract proves no consumer can retain or dereference the pointer after the end, with owner, last-use event, and review condition recorded.

Correct:

```c
static uint8_t rx_storage[64];

const uint8_t *queue_frame(void)
{
    return rx_storage; /* the documented static storage outlives the queued use */
}
```

Incorrect:

```c
const uint8_t *queue_frame(void)
{
    uint8_t frame[64];
    return frame; /* queued consumers dereference storage after this return */
}
```

### EMB-MEM-OWNERSHIP-001 [MUST]

Each dynamically managed or shared object MUST have one documented owner at every point in
its lifetime, and ownership transfer or borrowing MUST be explicit at the interface.

- Applies when: Sharing buffers, handles, messages, pool entries, or dynamically allocated objects between contexts.
- Rationale: An explicit owner makes mutation and release responsibility reviewable and prevents double release, leaks, and concurrent mutation.
- Verification (agent): Name the owner of each shared buffer, handle, or pool entry at every interface, then build success, rejection, cancellation, timeout, and reset paths. Pass when each terminal path has exactly one release and no concurrent owner; artifact: ownership ledger and path report.
- Verification (target): Using the `PROJECT_RULES.md` `memory-ownership` configuration, test every terminal transition, including receiver rejection. Pass when the ownership counter returns to zero exactly once for each object and no use follows release in 100% of cases; artifact: allocator/owner trace and configuration snapshot.
- Exceptions: Shared immutable storage MAY have multiple readers only when retention, reclamation owner, reader set, and review condition are documented and verified.

Correct:

```c
bool enqueue_frame(void *queue, frame_t *frame)
{
    if (!queue_try_put(queue, frame)) {
        frame_release(frame); /* producer retains ownership on rejection */
        return false;
    }
    return true; /* receiver owns the frame after acceptance */
}
```

Incorrect:

```c
void enqueue_frame(void *queue, frame_t *frame)
{
    queue_put(queue, frame);
    frame_release(frame); /* both producer and receiver now may release it */
}
```

### EMB-MEM-STACK-001 [MUST]

Every execution context MUST have a conservative stack bound covering its deepest reachable
call path, compiler-required frame space, and error paths.

Where interrupts nest onto a stack, the bound MUST include the frame pushed at each nesting
level plus the deepest call inside each handler at that level, because those frames
accumulate on one stack.

- Applies when: Adding local objects, call depth, recursion, callbacks, or a task entry function; adding a handler or enabling another nesting level.
- Rationale: Overflow corrupts whatever the linker placed below the stack, so it surfaces as an unrelated fault long after the write. Nested handlers are the common way a bound that looked sufficient stops being sufficient.
- Verification (agent): Trace the deepest reachable path, error branches, compiler frames, and recorded interrupt nesting levels, then sum them against the reserved size. Pass when the computed use is below the reservation by the recorded margin; artifact: stack budget table and call-path report.
- Verification (target): Using the `PROJECT_RULES.md` `stack-budget` configuration with the target compiler and optimization settings, measure high-water use while forcing the deepest nesting path. Pass when the observed high-water plus safety margin is no greater than the reserved stack for every context; artifact: stack watermark log, map, and configuration snapshot.
- Exceptions: A project that disables interrupt nesting MAY budget one interrupt frame only when the configuration, frame size, owner, and review condition are recorded; otherwise no exception applies.

Correct:

```text
Reserved interrupt stack: 512 bytes.
Worst case: SPI0_TX (priority 1, 64 B) nested in UART0_RX (priority 3, 96 B) = 160 B.
```

Incorrect:

```text
The stack size was copied from an example project; no nesting depth was measured.
```

### EMB-MEM-ALLOC-001 [MUST]

Allocation and reclamation MUST be called only from contexts documented as legal for the
selected allocator and runtime.

- Applies when: Calling an allocator, pool, object factory, or reclamation routine, including indirectly from callbacks or interrupt-reachable code.
- Rationale: Allocation latency, fragmentation, locks, and reclamation semantics are context-dependent; an operation that is legal in a task can deadlock from an interrupt.
- Verification (agent): For each allocation and reclamation site, record every reachable execution context and compare it with the selected allocator contract. Pass when every reachable call is legal for its exact context, including callbacks and interrupt paths; artifact: allocation-context table, call graph, and allocator contract.
- Verification (target): Using the `PROJECT_RULES.md` `allocator-context` configuration, invoke each allocation and reclamation path from every reachable context under production settings. Pass when no illegal-context call executes and every legal-context call returns without violating the allocator's documented context constraints in 100% of trials; artifact: context trace, allocator assertion log, and configuration snapshot.
- Exceptions: A fixed-size, statically initialized pool MAY be used only when capacity, bounded allocation time, exhaustion result, reclamation owner, and review condition are recorded.

Correct:

```c
void worker_task(void *argument)
{
    message_t *message = pool_alloc(); /* PROJECT_RULES allows this allocator in tasks. */

    if (message != 0) {
        message_release(message);
    }
    (void)argument;
}
```

Incorrect:

```c
void timer_isr(void)
{
    (void)pool_alloc(); /* allocator is not documented as legal from interrupt context */
}
```

### EMB-MEM-ALLOC-RESULT-001 [MUST]

Every allocation MUST expose an explicit success or failure result that the caller checks
before using, publishing, or transferring the allocated object.

- Applies when: Calling a heap, pool, object factory, or wrapper that can exhaust or reject an allocation.
- Rationale: An implicit or ignored exhaustion result turns a recoverable resource condition into a null dereference, invalid publication, or ownership ambiguity.
- Verification (agent): Trace each allocation return value to its first dereference, publication, transfer, or release. Pass when the caller checks the documented result before every such use and maps failure to a defined branch; artifact: allocation-result table and control-flow report.
- Verification (target): Using the `PROJECT_RULES.md` `allocator-result` configuration, force success, exhaustion, invalid-size, and rejected-context results at every allocation site. Pass when each result reaches the documented branch and no failed handle is dereferenced, published, or released in 100% of injections; artifact: allocator status trace, assertion log, and configuration snapshot.
- Exceptions: A wrapper MAY encode success in a non-null handle only when the allocator contract, nullability, failure set, owner, and review condition are recorded.

Correct:

```c
message_t *make_message(void)
{
    message_t *message = pool_alloc();

    if (message == 0) {
        return 0; /* explicit failure result is handled before use */
    }
    message_init(message);
    return message;
}
```

Incorrect:

```c
message_t *make_message(void)
{
    message_t *message = pool_alloc();

    message->length = 0U; /* failed allocation is dereferenced without a check */
    return message;
}
```

### EMB-MEM-ALLOC-STATE-001 [MUST]

When allocation fails, the caller MUST leave ownership and externally visible object state
unchanged and MUST NOT dereference, publish, or release the failed result.

- Applies when: Handling a null, exhausted, or error return from a heap, pool, object factory, or reclamation-related allocation path.
- Rationale: A failed allocation has no object to initialize or transfer. Dereferencing, publishing, or releasing that result turns a recoverable resource condition into a fault, a stale-handle publication, or a double release.
- Verification (agent): For each failure branch, compare pre-call ownership and externally visible state with the post-call state and inspect all uses of the returned handle. Pass when the failure branch has no dereference, publication, or release and all retained state is unchanged except documented diagnostics; artifact: failure-path table and control-flow report.
- Verification (target): Using the `PROJECT_RULES.md` `allocator-failure` configuration, force exhaustion at every allocation site and inspect handles, ownership counters, and published queues. Pass when 100% of injected failures return the documented error, publish no invalid handle, perform no release, and preserve pre-call state; artifact: allocator trace, ownership counters, and configuration snapshot.
- Exceptions: A diagnostic counter or event MAY change on failure only when it is explicitly outside the allocated object's ownership/state contract and its update is itself documented and bounded.

Correct:

```c
#include <stdbool.h>

typedef struct message message_t;
extern message_t *pool_alloc(void);
extern void message_init(message_t *message);

bool make_message(message_t **out)
{
    if (out == 0) {
        return false;
    }

    message_t *message = pool_alloc();
    if (message == 0) {
        return false; /* caller state and ownership stay unchanged */
    }

    message_init(message);
    *out = message;  /* publish only after successful initialization */
    return true;
}
```

Incorrect:

```c
#include <stdbool.h>

typedef struct message message_t;
extern message_t *pool_alloc(void);
extern void message_init(message_t *message);

bool make_message(message_t **out)
{
    message_t *message = pool_alloc();

    message_init(message); /* dereferences a failed allocation */
    *out = message;        /* publishes an invalid handle on failure */
    return true;
}
```

### EMB-MEM-LAYOUT-001 [MUST]

An object that depends on a section, retention, address, size, or alignment property MUST
declare that property through the project-supported mechanism and MUST have a linker or
build-time check that proves it.

- Applies when: Placing objects in RAM, nonvolatile memory, shared memory, DMA memory, bootloader regions, or retained sections.
- Rationale: Incidental layout and compiler packing are not stable contracts and can silently break startup, persistence, or bus access.
- Verification (agent): For each layout-dependent object, match the declared section/address/alignment/retention property to a linker assertion or post-link check. Pass when the proof is machine-readable and a comment is not the sole evidence; artifact: linker script assertion and post-link report.
- Verification (target): Using the `PROJECT_RULES.md` `memory-layout` configuration, inspect the target map and startup copy/zero tables, then run a negative build with the property intentionally violated. Pass when the assertion fails for the negative case and the valid image places the object as recorded; artifact: map, startup table, build log, and configuration snapshot.
- Exceptions: No exception applies to a hardware/image-required property; an attribute MAY be omitted only when the checked linker contract proves it, with contract owner, scope, and review condition recorded.

Correct:

```c
__attribute__((section(".dma"), aligned(32)))
static struct dma_header descriptor;
/* The linker script asserts the section, address, and alignment contract. */
```

Incorrect:

```c
static struct dma_header descriptor; /* placement and alignment have no build proof */
```

## Module examples

See the larger [compliant](../../examples/EMB-MEM-LIFETIME-001/compliant.c) and
[violating](../../examples/EMB-MEM-LIFETIME-001/violation.c) examples.

Correct:

```c
struct dma_header {
    uint32_t magic;
    uint8_t payload[60];
};

__attribute__((section(".dma"), aligned(32)))
static struct dma_header descriptor;
```

Incorrect:

```c
static struct dma_header descriptor; /* placement and alignment are incidental */
```
