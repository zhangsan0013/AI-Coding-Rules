# Embedded Concurrency Rules

Status: draft

## Scope

Shared state, atomicity, critical sections, memory visibility, lock ordering, and races
between execution contexts.

## Load when

State is shared by tasks, interrupts, cores, callbacks, or asynchronous hardware.

## Project facts this module depends on

- The execution contexts that can access each object and the preemption or interrupt model.
- The atomic widths, alignment, lock-free guarantees, and memory-ordering adapter supported
  by the target compiler and core.
- The allowed lock and critical-section primitives, their nesting behavior, and their bounds.

Record these in `PROJECT_RULES.md`; `volatile` alone is not a concurrency model.

## Rules

### EMB-CONC-RACE-001 [MUST]

Every shared object with a potentially conflicting access MUST have one documented
synchronization or ownership protocol that covers all readers, writers, and failure paths.

- Applies when: An object can be accessed by more than one task, interrupt, core, callback, or asynchronous engine.
- Rationale: A race is defined by the complete access set; protecting one caller while leaving an indirect writer unprotected does not establish a protocol.
- Verification: Enumerate all readers and writers, including callbacks and error paths, and test interleavings at each publication and consumption boundary.
- Exceptions: Immutable storage MAY be shared without synchronization after its complete initialization is published by the documented startup protocol.

### EMB-CONC-ATOMIC-001 [MUST]

An atomic operation MUST be used only when its width, alignment, lock-free behavior, and
memory order are supported and verified for the exact target configuration.

- Applies when: Updating flags, counters, indices, pointers, or state shared across contexts.
- Rationale: C syntax does not guarantee that every atomic width is lock-free or safe in an interrupt context, and an atomic field does not make a multi-field record atomic.
- Verification: Check compiler and target guarantees, inspect alignment, and test first, last, overflow, and simultaneous-update cases.
- Exceptions: A project lock or critical section MAY protect a non-lock-free object when its context legality and bounded duration are recorded.

### EMB-CONC-CRITICAL-001 [MUST]

A critical section MUST be entered with the project-supported primitive, MUST contain only
the minimum protected work, and MUST restore the saved prior state on every exit path.

- Applies when: Masking interrupts, disabling preemption, or holding a lock to protect shared state.
- Rationale: A constant restore can enable an outer critical section accidentally, while excess protected work increases latency and deadlock risk.
- Verification: Review early returns and nested use, then test the nested and failure paths with the target primitive.
- Exceptions: A longer critical section MAY be used only with a recorded latency bound and an approved rationale.

### EMB-CONC-LOCK-001 [MUST]

Code that can acquire more than one lock MUST acquire them in one documented global order
and MUST release them on every success, failure, timeout, and cancellation path.

- Applies when: Protecting related objects with multiple mutexes, spinlocks, scheduler locks, or interrupt masks.
- Rationale: Inconsistent acquisition order creates deadlock even when each individual lock is correctly implemented.
- Verification: Build the lock-order graph, check indirect calls, and exercise timeout and cleanup paths.
- Exceptions: A lock MAY be acquired out of order only when the project proves the earlier lock cannot coexist with the later acquisition.

### EMB-CONC-PUBLISH-001 [MUST]

A producer MUST publish a complete object before signaling its availability, and a consumer
MUST establish the documented acquire or equivalent visibility edge before reading it.

- Applies when: Passing data through flags, queues, rings, callbacks, shared pointers, or interrupt/task handoffs.
- Rationale: An availability flag without a visibility edge can expose a partially initialized payload or a payload from a different event.
- Verification: Review the publication sequence and test repeated, empty, full, and back-to-back events with the target memory model.
- Exceptions: A platform queue or message primitive MAY provide the edge when its exact semantics and object ownership are documented.

## Module examples

See the larger [compliant](../../examples/EMB-CONC-PUBLISH-001/compliant.c) and
[violating](../../examples/EMB-CONC-PUBLISH-001/violation.c) examples.

Correct:

```c
#include <stdatomic.h>

static atomic_uint pending = 0U;

void publish_event(void)
{
    /* Use only after the target's lock-free and context guarantees are verified. */
    atomic_fetch_add_explicit(&pending, 1U, memory_order_release);
}
```

Incorrect:

```c
#include <stdbool.h>

static volatile bool event_ready = false;
static unsigned event_value;

void publish_event(unsigned value)
{
    event_value = value;
    event_ready = true; /* Volatile does not publish a coherent payload. */
}
```
