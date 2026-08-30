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
- Verification (agent): Enumerate every reader and writer of the object, including callbacks, error paths, and indirect calls, then produce an access/protocol matrix. Pass when every access is covered by the same protocol; artifact: the matrix and referenced ownership or lock definition.
- Verification (target): Force the recorded producer/consumer interleavings at each publication boundary. Pass when the protected invariant holds for 100% of iterations and no access occurs outside the protocol; artifact: schedule trace and assertion log.
- Exceptions: Immutable storage MAY be shared without synchronization only after its complete initialization is published by the documented startup protocol, with owner, section, publication point, and review condition recorded in `PROJECT_RULES.md`.

Correct:

```c
/* The mutex is the one protocol for every reader and writer. */
void counter_add(unsigned delta)
{
    lock(&counter_lock);
    counter += delta;
    unlock(&counter_lock);
}
```

Incorrect:

```c
void counter_add(unsigned delta)
{
    counter += delta; /* Another task or ISR can update counter concurrently. */
}
```

### EMB-CONC-ATOMIC-001 [MUST]

An atomic operation MUST be used only when its width, alignment, lock-free behavior, and
memory order are supported and verified for the exact target configuration.

- Applies when: Updating flags, counters, indices, pointers, or state shared across contexts.
- Rationale: C syntax does not guarantee that every atomic width is lock-free or safe in an interrupt context, and an atomic field does not make a multi-field record atomic.
- Verification (agent): For each atomic object, record width, alignment, memory order, and the compiler lock-free result, then compare them with the target contract. Pass when every operation has a supported width/alignment and a protocol-matching order; artifact: compiler query output and the atomic access table.
- Verification (target): Inspect the map for required alignment and run first, last, overflow, and simultaneous-update cases. Pass when the target reports the recorded lock-free guarantee and the final value equals the mathematically expected update count; artifact: map excerpt, test log, and configuration.
- Exceptions: A project lock or critical section MAY protect a non-lock-free object only when owner, legal contexts, maximum hold time, and a review/removal condition are recorded in `PROJECT_RULES.md`.

Correct:

```c
#include <stdint.h>
#include <stdatomic.h>

/* PROJECT_RULES records this aligned uint32_t counter as lock-free on the target. */
_Atomic uint32_t sequence = 0U;

void next_sequence(void)
{
    (void)atomic_fetch_add_explicit(&sequence, 1U, memory_order_relaxed);
}
```

Incorrect:

```c
uint64_t sequence;

void next_sequence(void)
{
    sequence++; /* A 32-bit target may tear or implement this with an unbounded lock. */
}
```

### EMB-CONC-CRITICAL-001 [MUST]

A critical section MUST be entered and exited with the project-supported primitive using the saved
prior state on every exit path.

Restoring MUST use the saved token. Code MUST NOT unconditionally enable interrupts or
preemption at the end of a section, because it cannot know whether its caller was already
masked.

- Applies when: Masking interrupts or disabling preemption with a primitive that returns the prior state.
- Rationale: An unconditional enable silently breaks the atomicity of any caller that had already masked, and the failure appears inside the caller rather than here.
- Verification (agent): Check every exit path, including early returns and error branches, for a restore that passes the saved token rather than a constant. Pass when a control-flow report finds no exit without the token restore; artifact: path report and source locations.
- Verification (target): Enter the section from a caller that is already masked or preemption-disabled, then exercise success and error exits. Pass when the pre-entry mask or preemption state is observed unchanged after each exit; artifact: nested-state trace and state assertions.
- Exceptions: A section MAY enable unconditionally only when it owns the outermost mask and `PROJECT_RULES.md` records that owner, call boundary, proof of exclusivity, and removal/review condition.

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

### EMB-CONC-CRITICAL-SCOPE-001 [MUST]

A critical section MUST contain only operations required to establish or preserve the protected
invariant. Computation, allocation, I/O, and callbacks MUST execute outside it unless the
project contract proves they are part of the protected operation and records a bound.

- Applies when: Adding or changing code inside an interrupt mask, preemption-disabled region, mutex, spinlock, or scheduler lock.
- Rationale: Unrelated work inside a critical section extends blocking and interrupt latency, and callbacks or allocation can re-enter the same resource or wait without a safe progress bound.
- Verification (agent): Classify every operation in the protected body as protected-state access, required synchronization, or unrelated work. Pass when every operation is in the first two categories or has a recorded contract exception with a finite bound; artifact: operation classification table and source locations.
- Verification (target): Measure the protected interval along the longest success and error paths. Pass when the maximum duration is no greater than the recorded bound and each retained exception follows its documented target sequence; artifact: timing capture and exception trace.
- Exceptions: A non-state operation MAY remain only when the target contract requires it to be atomic with the protected access and records the owner, finite duration bound, failure behavior, and review condition.

Correct:

```c
uint32_t next = calculate_next(input);

lock(&counter_lock);
counter = next;
unlock(&counter_lock);
```

Incorrect:

```c
lock(&counter_lock);
counter = calculate_next(input); /* unrelated computation extends the lock hold */
flash_write(&record);            /* I/O does not belong in the critical section */
unlock(&counter_lock);
```

### EMB-CONC-LOCK-001 [MUST]

Code that can acquire more than one lock MUST acquire them in one documented global order.

- Applies when: Protecting related objects with multiple mutexes, spinlocks, scheduler locks, or interrupt masks.
- Rationale: Inconsistent acquisition order creates deadlock even when each individual lock is correctly implemented.
- Verification (agent): Build the acquisition-order graph for every path that holds two or more locks, including indirect calls. Pass when the graph has no cycle and every multi-lock path follows the documented global order; artifact: acquisition graph and source path report.
- Verification (target): Exercise contended multi-lock acquisitions with the recorded order and a deadlock watchdog. Pass when each test completes within the recorded timeout without an acquisition-order deadlock; artifact: scheduler trace and acquisition-order log.
- Exceptions: A lock MAY be acquired out of order only when the project records the proof that the earlier lock cannot coexist, the affected call sites, an owner, and a review condition.

Correct:

```c
void move_item(void)
{
    lock(&queue_lock); /* documented order: queue before item */
    lock(&item_lock);
    update_item();
    unlock(&item_lock);
    unlock(&queue_lock);
}
```

Incorrect:

```c
void move_item(void)
{
    lock(&item_lock);
    lock(&queue_lock); /* another path takes queue_lock first: deadlock cycle */
}
```

### EMB-CONC-LOCK-RELEASE-001 [MUST]

Code that acquires a lock MUST release it on every success, failure, timeout, and cancellation
path before returning or transferring control.

- Applies when: Acquiring mutexes, spinlocks, scheduler locks, or other ownership-bearing locks.
- Rationale: A missing release leaves the resource permanently owned, turning one exceptional path into a system-wide stall or priority inversion.
- Verification (agent): Trace every lock acquisition through all returns, error branches, timeouts, cancellations, and ownership-transfer edges. Pass when each path either releases the lock exactly once or records an explicit ownership transfer; artifact: lock lifecycle table and control-flow report.
- Verification (target): Exercise success, failure, timeout, cancellation, and repeated-entry paths. Pass when the post-test owner count is zero unless a documented transfer is active, and no waiter remains blocked after the transfer completes; artifact: scheduler trace and lock-state log.
- Exceptions: A lock MAY remain held only when ownership is explicitly transferred to a named context with a release obligation, owner, completion condition, and review condition recorded.

Correct:

```c
bool update_counter(unsigned value)
{
    if (!lock_try_acquire(&counter_lock)) {
        return false;
    }

    counter = value;
    unlock(&counter_lock);
    return true;
}
```

Incorrect:

```c
bool update_counter(unsigned value)
{
    lock(&counter_lock);

    if (!validate(value)) {
        return false; /* lock remains owned on this failure path */
    }

    counter = value;
    unlock(&counter_lock);
    return true;
}
```

### EMB-CONC-PUBLISH-001 [MUST]

A producer MUST complete every write to a published object before signaling its availability
with the documented release or equivalent publication operation.

- Applies when: Passing data through flags, queues, rings, callbacks, shared pointers, or interrupt/task handoffs.
- Rationale: Signaling before the payload is complete lets a consumer observe a partially initialized object or a payload from a different event.
- Verification (agent): Trace every write to the published object and the publication operation on every success and error path. Pass when the publication operation follows the complete write set on every path; artifact: publication sequence table and primitive contract.
- Verification (target): Using the `PROJECT_RULES.md` `publication` configuration, inject preemption at each payload write and publication boundary for at least 100 accepted events. Pass when no accepted event is signaled before its complete payload is visible in 100% of trials; artifact: schedule trace, payload snapshots, and configuration snapshot.
- Exceptions: A platform queue or message primitive MAY provide the edge only when its exact ordering, full behavior, and object ownership are recorded with owner and version in `PROJECT_RULES.md`.

Correct:

```c
payload->value = value;
atomic_store_explicit(&ready, true, memory_order_release); /* publication follows payload */
```

Incorrect:

```c
atomic_store_explicit(&ready, true, memory_order_release);
payload->value = value; /* consumer can observe ready before the payload */
```

## Module examples

See the larger [compliant](../../examples/EMB-CONC-PUBLISH-001/compliant.c) and
[violating](../../examples/EMB-CONC-PUBLISH-001/violation.c) examples.

Correct:

```c
#include <stdbool.h>
#include <stdatomic.h>

struct event { unsigned value; };
static struct event published;
static atomic_bool ready = false;

void publish_event(unsigned value)
{
    published.value = value;
    atomic_store_explicit(&ready, true, memory_order_release);
}

bool take_event(unsigned *value)
{
    if (!atomic_load_explicit(&ready, memory_order_acquire)) {
        return false;
    }
    *value = published.value;
    return true;
}
```

Incorrect:

```c
#include <stdbool.h>

static volatile bool event_ready = false;
static unsigned event_value;

void publish_event(unsigned value)
{
    event_ready = true; /* The consumer can observe ready before this payload write. */
    event_value = value;
}
```

### EMB-CONC-PUBLISH-002 [MUST]

A consumer MUST perform the documented acquire or equivalent visibility operation before
reading any field of a published object.

- Applies when: Reading data published through a flag, queue, ring, callback, shared pointer, or interrupt/task handoff.
- Rationale: A producer-side release does not make a consumer's ordinary load acquire the payload; without the consumer edge, the reader can observe stale or partially ordered data.
- Verification (agent): For every consumer, trace the publication token or state load to the first payload read. Pass when an acquire or equivalent visibility operation dominates every payload read on every success path; artifact: consumer access graph and primitive contract.
- Verification (target): Using the `PROJECT_RULES.md` `publication` configuration, delay and reorder consumer execution around the publication boundary for at least 100 events. Pass when every accepted payload read matches the producer snapshot and no read precedes the acquire edge in 100% of trials; artifact: consumer trace, payload comparison log, and configuration snapshot.
- Exceptions: A consumer MAY use an equivalent platform primitive only when its acquire semantics, version, owner, and review condition are recorded in `PROJECT_RULES.md`.

Correct:

```c
#include <stdbool.h>
#include <stdatomic.h>

struct event { unsigned value; };
extern struct event published;
extern atomic_bool ready;

bool take_event(unsigned *value)
{
    if (!atomic_load_explicit(&ready, memory_order_acquire)) {
        return false;
    }
    *value = published.value; /* payload read follows the acquire edge */
    return true;
}
```

Incorrect:

```c
#include <stdbool.h>

extern volatile bool event_ready;
extern unsigned event_value;

bool take_event(unsigned *value)
{
    if (!event_ready) {
        return false;
    }
    *value = event_value; /* volatile does not establish acquire visibility */
    return true;
}
```
