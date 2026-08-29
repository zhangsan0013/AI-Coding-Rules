# Embedded Memory Rules

Status: draft

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
- Verification: Trace each pointer consumer to the object's creation and release, including error and deferred paths, and test the last-use-after-transfer case.
- Exceptions: A shorter lifetime MAY be used only when the API contract proves that no consumer can retain or dereference the pointer after the lifetime ends.

### EMB-MEM-OWNERSHIP-001 [MUST]

Each dynamically managed or shared object MUST have one documented owner at every point in
its lifetime, and ownership transfer or borrowing MUST be explicit at the interface.

- Applies when: Sharing buffers, handles, messages, pool entries, or dynamically allocated objects between contexts.
- Rationale: An explicit owner makes mutation and release responsibility reviewable and prevents double release, leaks, and concurrent mutation.
- Verification: Draw the ownership transitions for success, rejection, cancellation, timeout, and reset paths, then test every terminal transition.
- Exceptions: Shared immutable storage MAY have multiple readers when its retention and reclamation rule is documented and verified.

### EMB-MEM-STACK-001 [MUST]

Every execution context MUST have a conservative stack bound that includes its deepest
reachable call path, compiler-required frame space, interrupt nesting, and error paths.

- Applies when: Adding local objects, call depth, recursion, callbacks, interrupt handlers, or task entry functions.
- Rationale: Stack overflow corrupts unrelated state and is often detected only after the original cause has disappeared.
- Verification: Calculate or measure the worst-case high-water mark with the target compiler and configuration, and compare it with the reserved stack including a recorded margin.
- Exceptions: None for a context that can execute the changed path; an exception requires an approved alternate stack and an equivalent bound.

### EMB-MEM-ALLOC-001 [MUST]

Allocation and reclamation MUST be permitted only in documented contexts, MUST have a
finite failure path, and MUST leave ownership and object state unchanged when allocation
fails.

- Applies when: Calling an allocator, pool, object factory, or reclamation routine, including indirectly from callbacks or interrupt-reachable code.
- Rationale: Allocation latency, fragmentation, locks, and failure are context-dependent; treating allocation as infallible converts resource exhaustion into memory corruption.
- Verification: Check the allocator policy and call context, inject exhaustion, and verify no partial object is published or released twice.
- Exceptions: A fixed-size, statically initialized pool MAY be used when its bounded allocation, exhaustion, and reclamation semantics are recorded.

### EMB-MEM-LAYOUT-001 [MUST]

An object that depends on a section, retention, address, size, or alignment property MUST
declare that property through the project-supported mechanism and MUST have a linker or
build-time check that proves it.

- Applies when: Placing objects in RAM, nonvolatile memory, shared memory, DMA memory, bootloader regions, or retained sections.
- Rationale: Incidental layout and compiler packing are not stable contracts and can silently break startup, persistence, or bus access.
- Verification: Inspect the declaration, linker map, startup copy/zero tables, and assertion or post-link check for the target build.
- Exceptions: None for a property required by hardware or another image; a project MAY omit an attribute only when the checked linker contract already proves the property.

## Module examples

See the larger [compliant](../../examples/EMB-MEM-LIFETIME-001/compliant.c) and
[violating](../../examples/EMB-MEM-LIFETIME-001/violation.c) examples.

Correct:

```c
#include <stdint.h>

static uint8_t rx_storage[64] = {0U};

uint8_t *rx_buffer_acquire(void)
{
    return rx_storage; /* The static owner outlives every documented consumer. */
}
```

Incorrect:

```c
#include <stdint.h>

uint8_t *rx_buffer_acquire(void)
{
    uint8_t local_storage[64] = {0U};

    return local_storage; /* The returned pointer outlives the local object. */
}
```
