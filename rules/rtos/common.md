# RTOS Common Rules

Status: provisional

## Scope

Scheduling, task lifecycle, blocking, priority inversion, resource ownership, and task
stack use independent of a specific RTOS, architecture, or compiler.

## Load when

Changing tasks, synchronization primitives, scheduling behavior, or cross-context data flow.

## Project facts this module depends on

- The scheduler, tick, interrupt, and task contexts in which each service is callable.
- The blocking, cancellation, priority, ownership, and deletion semantics of each primitive.
- The priority range, inversion policy, task stack allocation, and stack measurement method.

Vendor-specific API facts belong in the selected adapter module; exact project configuration
belongs in `PROJECT_RULES.md`.

## Adapter boundary

This module defines runtime-independent behavior. Vendor modules such as FreeRTOS,
RT-Thread, and ThreadX add only API-specific or configuration-specific rules.

## Rules

### RTOS-COMMON-CONTEXT-001 [MUST]

An RTOS service MUST be called only from a context in which the selected runtime and port
document it as legal.

- Applies when: Calling task, queue, semaphore, event, timer, memory-pool, or scheduler services from tasks, interrupts, callbacks, or startup code.
- Rationale: Context legality is a property of the runtime port, not of a function's return type or a timeout argument.
- Verification (agent): Build a context/service legality table from the selected runtime and port, then match every reachable call, including wrappers. Pass when every call is listed as legal for its exact context; artifact: call-context matrix, port service table, and call graph.
- Verification (target): Using the `PROJECT_RULES.md` `rtos-context` configuration, invoke each service from every context that reaches it on the selected port. Pass when each legal call completes without a context assertion in 100% of calls; artifact: port configuration, context trace, and configuration snapshot.
- Exceptions: A service MAY be used from an unusual context only when exact runtime/port documentation, result semantics, owner, and review condition are recorded.

Correct:

```c
void timer_callback(void)
{
    rtos_event_set_from_isr(&event); /* the selected port lists this ISR entry point */
}
```

Incorrect:

```c
void timer_callback(void)
{
    rtos_mutex_lock(&mutex, 0U); /* a scheduler-owned mutex is not ISR-legal */
}
```

### RTOS-COMMON-ISR-NOWAIT-001 [MUST]

An interrupt path MUST NOT wait for a scheduler-owned resource, even when the selected API
accepts a zero-timeout argument.

- Applies when: Calling an RTOS service directly or indirectly from an interrupt handler or an interrupt callback.
- Rationale: A zero timeout can select a non-blocking branch in one port while the service still touches scheduler-owned state that is illegal from interrupt context.
- Verification (agent): Trace every interrupt-reachable RTOS call and classify whether it can wait for a scheduler-owned resource. Pass when no interrupt path enters a scheduler-owned wait or block operation; artifact: interrupt call graph and wait-capability table.
- Verification (target): Using the `PROJECT_RULES.md` `rtos-isr-wait` configuration, force resource unavailable, full, and contended states at each interrupt call. Pass when the handler returns without entering a scheduler wait in 100% of trials; artifact: scheduler trace, wait-state assertions, and configuration snapshot.
- Exceptions: A platform ISR primitive MAY touch scheduler state only when the selected port explicitly documents the operation as an interrupt-exit notification rather than a wait, with owner and review condition recorded.

Correct:

```c
void timer_callback(void)
{
    rtos_event_set_from_isr(&event); /* notification does not wait */
}
```

Incorrect:

```c
void timer_callback(void)
{
    rtos_mutex_lock(&mutex, 0U); /* zero timeout does not make a scheduler mutex ISR-safe */
}
```

### RTOS-COMMON-BLOCK-001 [MUST]

A blocking operation MUST have an explicit finite timeout or an explicitly approved
indefinite-wait contract.

- Applies when: Waiting for messages, locks, notifications, timers, I/O, or resource availability.
- Rationale: An indefinite wait can consume a task required for recovery and can conceal a deadlock or lost wake-up.
- Verification (agent): Inventory each blocking call and record its finite timeout or approved indefinite contract. Pass when every wait has one documented timeout policy and no unapproved indefinite wait remains; artifact: blocking-call table and timeout contract.
- Verification (target): Using the `PROJECT_RULES.md` `rtos-blocking` configuration, exercise wake-up, timeout, cancellation, and resource-unavailable paths. Pass when each wait returns within the configured timeout or matches the approved indefinite contract in 100% of cases; artifact: scheduler trace, timing log, and configuration snapshot.
- Exceptions: An indefinite wait MAY be used only when task lifecycle, recovery path, owner, and review condition explicitly require and record it.

Correct:

```c
if (!rtos_queue_receive(queue, &item, 10U)) {
    return RESULT_TIMEOUT; /* the caller handles the finite wait result */
}
return RESULT_OK;
```

Incorrect:

```c
(void)rtos_queue_receive(queue, &item, RTOS_WAIT_FOREVER); /* indefinite wait is not approved */
```

### RTOS-COMMON-BLOCK-RESULT-001 [MUST]

The caller of a blocking operation MUST handle its timeout, cancellation, and resource
unavailable results explicitly before continuing or returning.

- Applies when: A queue, lock, notification, timer, I/O, or resource wait can return without the requested resource.
- Rationale: A caller that treats timeout or cancellation as success can use uninitialized data, proceed without a lock, or hide a recovery condition.
- Verification (agent): Trace every blocking call's result to the next state transition on success, timeout, cancellation, and unavailable paths. Pass when each documented non-success result reaches an explicit branch and no fallible return is discarded; artifact: wait-result mapping and control-flow report.
- Verification (target): Using the `PROJECT_RULES.md` `rtos-blocking-results` configuration, inject wake-up, timeout, cancellation, and unavailable outcomes. Pass when each outcome reaches its documented caller branch and no operation continues as if the resource were acquired in 100% of trials; artifact: scheduler trace, result log, and configuration snapshot.
- Exceptions: A wrapper MAY collapse two results only when the caller's safety decision is identical for both and the equivalence, owner, and review condition are recorded.

Correct:

```c
enum result receive_item(void)
{
    if (!rtos_queue_receive(queue, &item, 10U)) {
        return RESULT_TIMEOUT; /* timeout is handled explicitly */
    }
    return process_item(item);
}
```

Incorrect:

```c
enum result receive_item(void)
{
    (void)rtos_queue_receive(queue, &item, 10U);
    return process_item(item); /* item may be uninitialized after timeout */
}
```

### RTOS-COMMON-OWNERSHIP-001 [MUST]

Every runtime object and resource MUST have one documented owner at each point in its
lifetime, with creation, use, release, and deletion responsibility explicit.

- Applies when: Creating or deleting tasks, queues, locks, timers, pools, or handles, and when passing them between contexts.
- Rationale: An explicit owner makes mutation and release responsibility reviewable and prevents double release or use by two contexts at once.
- Verification (agent): For each runtime object, identify the owner after creation, every transfer, each use, and the release/deletion operation. Pass when every state has exactly one owner or a documented shared-read contract; artifact: object ownership ledger and call graph.
- Verification (target): Using the `PROJECT_RULES.md` `rtos-ownership` configuration, exercise creation, transfer, use, release, and deletion paths. Pass when the observed owner changes match the ledger and no object has two releasing owners in 100% of trials; artifact: scheduler/object trace and configuration snapshot.
- Exceptions: A statically owned object MAY live for system lifetime only when deletion is prohibited, owner is named, and the contract has a review condition.

Correct:

```c
bool create_queue(void)
{
    if (!rtos_queue_create(&queue)) {
        return false;
    }
    queue_owner = CURRENT_TASK; /* owner is assigned at creation */
    return true;
}

bool transfer_queue(task_id_t next_owner)
{
    if (queue_owner != CURRENT_TASK) {
        return false;
    }
    queue_owner = next_owner;
    return true;
}

bool destroy_queue(void)
{
    if (queue_owner != CURRENT_TASK) {
        return false;
    }
    rtos_queue_delete(&queue); /* the current owner performs deletion */
    return true;
}
```

Incorrect:

```c
void destroy_queue(void)
{
    rtos_queue_delete(&queue); /* ownership was never assigned to this caller */
}
```

### RTOS-COMMON-OWNERSHIP-002 [MUST]

Every runtime object deletion or release MUST prove that shutdown and error paths have
invalidated or completed all outstanding users before the handle becomes unavailable.

- Applies when: Stopping tasks, deleting queues, releasing locks or pools, resetting subsystems, or abandoning a runtime handle after an error.
- Rationale: A valid-looking handle held by a blocked task, callback, or failure path becomes a use-after-delete when reclamation does not account for outstanding users.
- Verification (agent): Build the shutdown and error-path graph for each handle and identify blocked, queued, callback, and retrying users. Pass when every path either completes/cancels those users before reclamation or records a defined no-use terminal state; artifact: shutdown/error ownership graph and handle-use report.
- Verification (target): Using the `PROJECT_RULES.md` `rtos-ownership-shutdown` configuration, stop with pending work, blocked users, callbacks, and injected errors. Pass when no user reaches the reclaimed handle and every pending user receives the documented completion or cancellation in 100% of shutdowns; artifact: scheduler/object trace, cancellation log, and configuration snapshot.
- Exceptions: A system-wide reset MAY bypass per-object quiescence only when the reset boundary proves no user code can run afterward, with reset owner, terminal state, and review condition recorded.

Correct:

```c
void destroy_queue(void)
{
    stop_producers();
    cancel_pending_consumers();
    wait_for_consumers_to_quiesce();
    rtos_queue_delete(&queue); /* no outstanding user remains */
}
```

Incorrect:

```c
void destroy_queue(void)
{
    rtos_queue_delete(&queue); /* a blocked consumer still owns the handle */
    cancel_pending_consumers();
}
```

### RTOS-COMMON-PRIORITY-001 [MUST]

Resource-sharing code MUST use the project's documented priority-inversion policy for each
shared resource.

- Applies when: Assigning task priorities, taking mutexes, configuring ceilings or inheritance, or changing scheduling thresholds.
- Rationale: An unselected or inconsistent inversion policy can starve higher-priority work or allow an unbounded priority inversion.
- Verification (agent): Match each shared resource and mutex configuration to the selected inheritance, ceiling, or non-sharing policy. Pass when every resource has one documented policy and no call site relies on an undocumented priority behavior; artifact: resource policy table and configuration report.
- Verification (target): Using the `PROJECT_RULES.md` `rtos-priority` configuration, measure blocking under worst-case contention for every shared resource. Pass when the observed policy matches the configured inheritance/ceiling behavior and maximum blocking remains within its recorded bound in 100% of runs; artifact: scheduler/timing trace and configuration snapshot.
- Exceptions: A temporary change MAY be used only when runtime semantics, owner, maximum duration, restore paths, and review condition are recorded.

Correct:

```c
int guarded_update(void)
{
    return mutex_protected_update(&resource_mutex); /* policy: priority inheritance */
}
```

Incorrect:

```c
void guarded_update(void)
{
    task_priority_set(PRIORITY_CEILING); /* ad hoc change ignores the resource policy */
    update_shared_resource();
}
```

### RTOS-COMMON-PRIORITY-002 [MUST]

Any temporary task-priority change MUST have a named owner, finite duration bound, saved
prior value, and restoration on every success, error, timeout, and cancellation path.

- Applies when: Raising or lowering a task priority around a resource operation or critical section.
- Rationale: A priority change that survives an error path can permanently distort scheduling, while an unbounded change can starve unrelated work.
- Verification (agent): Trace each temporary priority write through all exits and record the owner and maximum duration. Pass when every path restores the saved value and the duration is bounded by the project contract; artifact: priority-change path report and ownership/bound table.
- Verification (target): Using the `PROJECT_RULES.md` `rtos-priority-change` configuration, inject success, error, timeout, cancellation, and preemption at each changed-priority interval. Pass when the task priority returns to its pre-entry value and the interval stays within the bound in 100% of trials; artifact: scheduler trace, priority log, and configuration snapshot.
- Exceptions: A priority change MAY persist only when it is an explicit ownership transfer to a named scheduler protocol with terminal restoration responsibility and review condition recorded.

Correct:

```c
int guarded_update(void)
{
    int saved = task_priority_get();
    task_priority_set(PRIORITY_CEILING);
    int result = update_shared_resource();
    task_priority_set(saved); /* restore on the normal path */
    return result;
}
```

Incorrect:

```c
int guarded_update(void)
{
    task_priority_set(PRIORITY_CEILING);
    if (!update_shared_resource()) {
        return -1; /* priority is not restored on this error path */
    }
    task_priority_set(PRIORITY_NORMAL);
    return 0;
}
```

### RTOS-COMMON-STACK-001 [MUST]

Each task and runtime callback MUST have a recorded stack bound that includes its deepest
reachable call path, library use, error paths, and configured runtime overhead.

- Applies when: Creating tasks, adding callbacks, changing logging or library calls, or changing stack configuration.
- Rationale: A task stack can overflow independently of the CPU stack and may corrupt runtime control blocks before detection.
- Verification (agent): Trace the deepest reachable path of each task/callback, including library frames and errors, then compare with configured size and margin. Pass when computed use is below reservation by the recorded margin; artifact: stack budget table and call graph.
- Verification (target): Using the `PROJECT_RULES.md` `rtos-stack` configuration with the target build, measure high-water mark while forcing deepest paths. Pass when high-water plus margin does not exceed the configured stack for every task and callback; artifact: watermark log, map, and configuration snapshot.
- Exceptions: No exception applies to a changed path; if normal measurement cannot observe it, an approved alternate method with owner, configuration, and review condition is required.

Correct:

```text
worker task stack: 2048 bytes; measured high-water: 1320 bytes; margin: 728 bytes.
```

Incorrect:

```text
worker task stack: 512 bytes copied from a sample project; no high-water result.
```

### RTOS-COMMON-LIFECYCLE-001 [MUST]

A task or callback MUST stop accepting new work before any of its resources are deleted or
made unavailable.

- Applies when: Stopping tasks, unloading drivers, deleting queues, resetting subsystems, or reclaiming shared memory.
- Rationale: Reclamation while admission remains open lets a new request acquire a stale queue, callback, or subsystem handle during teardown.
- Verification (agent): Inspect teardown control flow and identify the admission gate and every resource reclamation edge. Pass when the gate that rejects new work dominates every delete, reset, or free operation; artifact: teardown state graph and admission/reclamation path report.
- Verification (target): Using the `PROJECT_RULES.md` `rtos-teardown` configuration, race new submissions with stop requests and resource deletion. Pass when every submission after the stop boundary is rejected and no resource is reclaimed while admission is open in 100% of trials; artifact: shutdown trace, admission log, and configuration snapshot.
- Exceptions: A system-wide reset MAY terminate the protocol only when the reset boundary proves no user code can run afterward, with reset owner and evidence recorded.

Correct:

```c
task_stop_accepting_work(&worker);
task_join(&worker);
rtos_queue_delete(&worker_queue); /* no in-flight user remains */
```

Incorrect:

```c
rtos_queue_delete(&worker_queue); /* callbacks can still submit or access it */
task_stop_accepting_work(&worker);
```

## Module examples

See the larger [compliant](../../examples/RTOS-COMMON-BLOCK-001/compliant.c) and
[violating](../../examples/RTOS-COMMON-BLOCK-001/violation.c) examples.

Correct:

```c
void stop_worker(void)
{
    task_stop_accepting_work(&worker);
    task_join(&worker);
    rtos_queue_delete(&worker_queue);
}
```

Incorrect:

```c
void stop_worker(void)
{
    rtos_queue_delete(&worker_queue); /* pending callbacks still use the queue */
    task_stop(&worker);
}
```

### RTOS-COMMON-LIFECYCLE-002 [MUST]

All in-flight users of a task, callback, or resource MUST observe completion or cancellation
before the resource is reclaimed.

- Applies when: Joining or stopping tasks, cancelling callbacks, deleting queues, resetting subsystems, or freeing shared memory.
- Rationale: Closing admission does not stop work already queued or blocked; reclaiming first leaves those users with stale handles or freed state.
- Verification (agent): Trace every in-flight user from admission through completion, cancellation, or failure and compare it with the reclamation edge. Pass when no user path reaches reclamation before a terminal completion or cancellation state; artifact: in-flight user graph and teardown path report.
- Verification (target): Using the `PROJECT_RULES.md` `rtos-inflight` configuration, exercise queued work, blocked waiters, pending callbacks, timeout, cancellation, and repeated stop requests. Pass when every user reaches completion/cancellation before free and no callback accesses reclaimed state in 100% of shutdowns; artifact: scheduler trace, reclamation log, and configuration snapshot.
- Exceptions: A system-wide reset MAY terminate users without individual completion only when the reset boundary proves no user code can run afterward, with reset owner, terminal state, and review condition recorded.

Correct:

```c
void stop_worker(void)
{
    task_stop_accepting_work(&worker);
    task_cancel_pending(&worker);
    task_join(&worker);          /* all in-flight users are terminal */
    rtos_queue_delete(&worker_queue);
}
```

Incorrect:

```c
void stop_worker(void)
{
    task_stop_accepting_work(&worker);
    rtos_queue_delete(&worker_queue); /* a blocked worker still can access it */
    task_join(&worker);
}
```
