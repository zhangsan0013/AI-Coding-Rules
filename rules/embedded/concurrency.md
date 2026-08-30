# Embedded Concurrency Rules

Status: provisional

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
- Verification (agent): Enumerate every reader and writer of the object, including callbacks, error paths, and indirect calls, then confirm one protocol covers all of them. A protocol applied at some access sites but not others is a finding.
- Verification (target): Test interleavings at each publication and consumption boundary.
- Exceptions: Immutable storage MAY be shared without synchronization after its complete initialization is published by the documented startup protocol.

### EMB-CONC-ATOMIC-001 [MUST]

An atomic operation MUST be used only when its width, alignment, lock-free behavior, and
memory order are supported and verified for the exact target configuration.

- Applies when: Updating flags, counters, indices, pointers, or state shared across contexts.
- Rationale: C syntax does not guarantee that every atomic width is lock-free or safe in an interrupt context, and an atomic field does not make a multi-field record atomic.
- Verification (agent): Confirm each atomic object's width and alignment are ones the target supports lock-free, and that the memory order named at each operation matches the protocol. `atomic_flag` and pointer-width types are the safe assumptions; a 64-bit atomic on a 32-bit core is a finding unless recorded as lock-free.
- Verification (target): Check the compiler and target lock-free guarantees, inspect alignment in the map, and test first, last, overflow, and simultaneous-update cases.
- Exceptions: A project lock or critical section MAY protect a non-lock-free object when its context legality and bounded duration are recorded.

### EMB-CONC-CRITICAL-001 [MUST]

A critical section MUST be entered with the project-supported primitive, MUST contain only
the minimum protected work, and MUST restore the saved prior state on every exit path.

Restoring MUST use the saved token. Code MUST NOT unconditionally enable interrupts or
preemption at the end of a section, because it cannot know whether its caller was already
masked.

- Applies when: Masking interrupts, disabling preemption, or holding a lock to protect shared state.
- Rationale: An unconditional enable silently breaks the atomicity of any caller that had already masked, and the failure appears inside the caller rather than here. Excess protected work raises latency and deadlock risk.
- Verification (agent): Check every exit path, including early returns and error branches, for a restore that passes the saved token rather than a constant. A bare `irq_enable()` or `taskEXIT_CRITICAL()` paired with a state-returning disable is a finding.
- Verification (target): Test the nested case with the target primitive, entering the section from a caller that is already masked.
- Exceptions: A section MAY enable unconditionally when it provably owns the outermost mask and that ownership is recorded.

Correct:

```c
bool log_event(const char *text)
{
    uint32_t state = irq_disable();

    if (!log_append(&trace_log, text)) {
        irq_restore(state);   /* restores the caller's state, not "enabled" */
        return false;
    }

    irq_restore(state);
    return true;
}
```

Incorrect:

```c
bool log_event(const char *text)
{
    irq_disable();

    if (!log_append(&trace_log, text)) {
        irq_enable();   /* the caller may already have been running masked */
        return false;
    }

    irq_enable();
    return true;
}
```

A larger pair of examples is in
[examples/EMB-CONC-CRITICAL-001](../../examples/EMB-CONC-CRITICAL-001/).

### EMB-CONC-LOCK-001 [MUST]

Code that can acquire more than one lock MUST acquire them in one documented global order
and MUST release them on every success, failure, timeout, and cancellation path.

- Applies when: Protecting related objects with multiple mutexes, spinlocks, scheduler locks, or interrupt masks.
- Rationale: Inconsistent acquisition order creates deadlock even when each individual lock is correctly implemented.
- Verification (agent): Build the acquisition-order graph for every path that holds two or more locks, including indirect calls, and confirm one global order. Confirm each lock is released on the timeout, failure, and cancellation paths.
- Verification (target): Exercise the timeout and cleanup paths with the target primitives.
- Exceptions: A lock MAY be acquired out of order only when the project proves the earlier lock cannot coexist with the later acquisition.

### EMB-CONC-PUBLISH-001 [MUST]

A producer MUST publish a complete object before signaling its availability, and a consumer
MUST establish the documented acquire or equivalent visibility edge before reading it.

- Applies when: Passing data through flags, queues, rings, callbacks, shared pointers, or interrupt/task handoffs.
- Rationale: An availability flag without a visibility edge can expose a partially initialized payload or a payload from a different event.
- Verification (agent): Confirm the payload is completely written before the store that makes it visible, and that the reader establishes the acquire edge before reading it. A visibility flag set with an ordinary or merely `volatile` store is a finding.
- Verification (target): Test repeated, empty, full, and back-to-back events under the target memory model.
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
