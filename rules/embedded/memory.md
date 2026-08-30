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
- Verification (agent): Trace each pointer consumer back to the object it points into and confirm that object outlives the last use, including on error and deferred paths. A pointer to an automatic object that escapes its scope, or one retained past a release, is a finding.
- Verification (target): Test the last-use-after-transfer case and confirm the object is still valid at that point.
- Exceptions: A shorter lifetime MAY be used only when the API contract proves that no consumer can retain or dereference the pointer after the lifetime ends.

### EMB-MEM-OWNERSHIP-001 [MUST]

Each dynamically managed or shared object MUST have one documented owner at every point in
its lifetime, and ownership transfer or borrowing MUST be explicit at the interface.

- Applies when: Sharing buffers, handles, messages, pool entries, or dynamically allocated objects between contexts.
- Rationale: An explicit owner makes mutation and release responsibility reviewable and prevents double release, leaks, and concurrent mutation.
- Verification (agent): Name the owner of each shared buffer, handle, or pool entry at every interface it crosses, then check the success, rejection, cancellation, timeout, and reset paths for exactly one release. Two paths that both release, or none that does, are findings.
- Verification (target): Test every terminal ownership transition, including a transfer that the receiver rejects.
- Exceptions: Shared immutable storage MAY have multiple readers when its retention and reclamation rule is documented and verified.

### EMB-MEM-STACK-001 [MUST]

Every execution context MUST have a conservative stack bound covering its deepest reachable
call path, compiler-required frame space, and error paths.

Where interrupts nest onto a stack, the bound MUST include the frame pushed at each nesting
level plus the deepest call inside each handler at that level, because those frames
accumulate on one stack.

- Applies when: Adding local objects, call depth, recursion, callbacks, or a task entry function; adding a handler or enabling another nesting level.
- Rationale: Overflow corrupts whatever the linker placed below the stack, so it surfaces as an unrelated fault long after the write. Nested handlers are the common way a bound that looked sufficient stops being sufficient.
- Verification (agent): Trace the deepest reachable path in the change, including error branches and the nesting levels the project records as enabled, and compare the total against the reserved size and its margin. Report a missing recorded reservation as a gap.
- Verification (target): Measure the worst-case high-water mark with the target compiler and configuration, forcing the deepest nesting path.
- Exceptions: A project that disables interrupt nesting MAY budget a single interrupt frame when that configuration is recorded. Otherwise none for a context that can execute the changed path.

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

Allocation and reclamation MUST be permitted only in documented contexts, MUST have a
finite failure path, and MUST leave ownership and object state unchanged when allocation
fails.

- Applies when: Calling an allocator, pool, object factory, or reclamation routine, including indirectly from callbacks or interrupt-reachable code.
- Rationale: Allocation latency, fragmentation, locks, and failure are context-dependent; treating allocation as infallible converts resource exhaustion into memory corruption.
- Verification (agent): Confirm each allocation site is in a context the project permits, has a failure branch, and leaves ownership and object state unchanged when it fails. An allocation whose result is used without a null check is a finding.
- Verification (target): Inject exhaustion and confirm no partial object is published and nothing is released twice.
- Exceptions: A fixed-size, statically initialized pool MAY be used when its bounded allocation, exhaustion, and reclamation semantics are recorded.

### EMB-MEM-LAYOUT-001 [MUST]

An object that depends on a section, retention, address, size, or alignment property MUST
declare that property through the project-supported mechanism and MUST have a linker or
build-time check that proves it.

- Applies when: Placing objects in RAM, nonvolatile memory, shared memory, DMA memory, bootloader regions, or retained sections.
- Rationale: Incidental layout and compiler packing are not stable contracts and can silently break startup, persistence, or bus access.
- Verification (agent): Confirm each object with a section, address, alignment, or retention requirement declares it through the project mechanism, and that a linker assertion or post-link check proves it. A requirement stated only in a comment is a finding.
- Verification (target): Inspect the linker map and startup copy/zero tables for the target build, and confirm the assertion fires when the property is violated.
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
