# C11 Style Rules

Status: active

## Scope

Formatting, control flow, storage duration, types, and comments for C11 source and header files.

## Load when

Editing C source or header files.

## Rules

### C-STYLE-FORMAT-001 [SHOULD]

Code SHOULD pass the repository formatter without manual formatting exceptions. The formatter
configuration is the complete boundary for indentation, tabs, spacing, braces, and line breaks.

- Applies when: Formatting C11 source or header files.
- Rationale: Consistent layout makes review predictable. This entire rule is mechanically enforced, so it should cost review no attention.
- Verification (agent): Check: run `clang-format --dry-run --Werror` with `templates/.clang-format`; artifact: formatter diagnostic output; pass: every changed C file produces no formatting diff or diagnostic.
- Verification (target): Check: repeat the formatter check in the target project's build image; artifact: CI formatter log; pass: the target build uses the same formatting configuration and reports zero diagnostics.
- Exceptions: Existing surrounding style MAY be preserved when modifying legacy code.

### C-STYLE-TYPES-001 [MUST]

A value with binary-layout meaning — a protocol field, a stored record, or a register value — MUST use a fixed-width type from `<stdint.h>`.

- Applies when: Declaring or testing a value with binary-layout meaning.
- Rationale: `int`, `long`, and `char` have implementation-defined width and signedness. A protocol field declared `int` changes size between a 16-bit and a 32-bit target, so the same source produces a different wire format. `char` used for byte data can also sign-extend on one toolchain and not another.
- Verification (agent): Check: inspect every field in a protocol, register, or persisted structure; artifact: representation-type checklist; pass: each layout-bearing integer field uses an explicitly sized type from `<stdint.h>`.
- Verification (target): Check: compile layout fixtures containing `_Static_assert(sizeof(...))` for each layout-bearing type; artifact: compiler log and size assertions; pass: all assertions equal the documented wire, storage, or register size.
- Exceptions: A documented ABI or generated code MAY require another representation. `char` remains correct for text handled by the standard string functions.

Correct:

```c
#include <stdbool.h>
#include <stdint.h>

typedef struct {
    uint16_t voltage_mv;
    bool enabled;
} motor_status_t;
```

Incorrect:

```c
typedef struct {
    int voltage_mv; /* width is implementation-defined */
} motor_status_t;
```

### C-STYLE-TYPES-002 [MUST]

Logical state MUST use `bool` from `<stdbool.h>`.

- Applies when: Declaring or storing a value whose meaning is true or false.
- Rationale: `bool` documents the logical domain and prevents integer values from being mistaken for a wider state or protocol field.
- Verification (agent): Check: inspect truth-valued fields, variables, and parameters; artifact: logical-type checklist; pass: each logical state uses `bool` and includes `<stdbool.h>` where required.
- Verification (target): Check: compile logical-state fixtures with warnings enabled; artifact: compiler log and layout assertions; pass: logical states have the documented boolean representation and no implicit integer-domain substitute is used.
- Exceptions: An external ABI or packed wire representation MAY use an explicitly sized integer at the boundary, but the internal logical state MUST be converted to `bool`.

Correct:

```c
#include <stdbool.h>

bool motor_enabled;
```

Incorrect:

```c
int motor_enabled; /* logical state stored as an unbounded integer */
```

### C-STYLE-INIT-001 [MUST]

An object MUST NOT be read before it has been assigned a value.

- Applies when: Declaring or first assigning any object.
- Rationale: Reading an indeterminate automatic object is undefined behavior and can change with optimization level or call path.
- Verification (agent): Check: perform path analysis for first reads; artifact: initialization-path report; pass: no path reads an object before an assignment or a documented writer.
- Verification (target): Check: build with `-Wuninitialized -Wmaybe-uninitialized` at the project optimization level and exercise first-read paths; artifact: compiler log plus initialization test log; pass: no uninitialized diagnostic occurs and every first read observes the documented value.
- Exceptions: An object written by DMA or hardware before its first read MAY rely on that writer when the contract is documented.

Correct:

```c
static uint32_t motor_ticks = 0U;

uint32_t motor_next(uint32_t input)
{
    uint32_t result = input + 1U;
    return result;
}
```

Incorrect:

```c
static uint32_t motor_ticks = 0U;

uint32_t motor_next(bool use_input, uint32_t input)
{
    uint32_t result;
    if (use_input) {
        result = input;
    }
    return result; /* read on the false path before assignment */
}
```

### C-STYLE-INIT-003 [MUST]

An object with static or thread storage duration MUST have an explicit initializer at its
declaration unless a documented startup writer owns its initial value.

- Applies when: Defining an object with static or thread storage duration.
- Rationale: Implicit zero initialization is guaranteed but invisible; an explicit initializer records the startup value that the code depends on.
- Verification (agent): Check: inspect every static and thread-duration definition and its startup/DMA contract; artifact: storage-duration initialization inventory; pass: each object has an explicit initializer or a linked, documented writer that runs before first use.
- Verification (target): Check: exercise startup and first-use paths at the target; artifact: startup trace and initialization test log; pass: each object observes the documented initial value before any consumer reads it.
- Exceptions: Linker-placed or hardware-owned storage MAY omit a C initializer when its startup writer and ordering are recorded.

Correct:

```c
static uint32_t motor_ticks = 0U;
```

Incorrect:

```c
static uint32_t motor_ticks; /* implicit startup value is not stated */
```

### C-STYLE-INIT-002 (Guidance; formerly [SHOULD])

Initialize an automatic object at its declaration when its value is already known, and declare
it near the first assignment when the value is not yet known. This is guidance because the
useful boundary depends on control-flow clarity and the surrounding API.

- Applies when: Declaring an automatic object.
- Rationale: An initializer at the declaration removes the window in which the object is indeterminate. A placeholder such as `= 0` written only to satisfy a checker is worse: it suppresses `-Wuninitialized` and turns a diagnosable fault into a plausible-looking wrong value.
- Exceptions: An object assigned in every branch of a following `if`/`switch`, or one whose address is passed to an out-parameter writer, can be declared without an initializer.

### C-STYLE-MEM-001 [MUST]

Every variable length array MUST have a finite, documented maximum length.

- Applies when: Introducing a VLA.
- Rationale: A runtime-sized stack object without a finite bound can exhaust a task or thread stack unpredictably.
- Verification (agent): Check: inventory each VLA and trace its bound; artifact: VLA-bound table; pass: every VLA has a finite maximum recorded next to the declaration or in the project contract.
- Verification (target): Check: execute the VLA path at its documented maximum and one value above it; artifact: boundary test log; pass: the maximum value is accepted within the contract and the larger value is rejected before the VLA is created.
- Exceptions: A bound supplied by a generated interface MAY be referenced when the generated contract is linked.

Guidance: Prefer a fixed-size array or caller-provided storage when the maximum is known at
design time.

Correct:

```c
void motor_parse(size_t count)
{
    if ((count == 0U) || (count > MOTOR_PARSE_MAX)) {
        return;
    }
    uint8_t bytes[count]; /* MOTOR_PARSE_MAX is the documented finite bound */
    motor_decode(bytes, count);
}
```

Incorrect:

```c
void motor_isr(size_t count)
{
    uint8_t bytes[count]; /* no finite maximum is established */
    motor_decode(bytes, count);
}
```

### C-STYLE-MEM-002 [MUST]

Every variable length array MUST be included in the relevant stack budget.

- Applies when: Introducing a VLA in a function, task, or thread.
- Rationale: The VLA's maximum contribution must be accounted for before the stack can be shown to have sufficient margin.
- Verification (agent): Check: compare each VLA's maximum size and element size with the owning stack budget; artifact: stack-budget table; pass: the budget includes the VLA and retains the project's required margin.
- Verification (target): Check: run the owning execution context at the VLA maximum and measure high-water usage; artifact: stack high-water report; pass: measured usage remains below the configured budget with the required margin.
- Exceptions: A VLA in a function whose stack is supplied and bounded by a documented caller contract MAY reference that caller budget.

Correct:

```c
/* Stack budget entry: motor_parse reserves at most 64 bytes for bytes. */
void motor_parse(size_t count)
{
    if ((count == 0U) || (count > MOTOR_PARSE_MAX)) {
        return;
    }
    uint8_t bytes[count];
    motor_decode(bytes, count);
}
```

Incorrect:

```c
void motor_parse(size_t count)
{
    uint8_t bytes[count]; /* no stack-budget entry */
    motor_decode(bytes, count);
}
```

### C-STYLE-MEM-003 [MUST]

Every variable length array MUST be limited to a synchronous, short-lived scope.

- Applies when: Placing a VLA in a function, callback, task, or thread.
- Rationale: A VLA held across a long-lived activation extends unpredictable stack use beyond the short operation that needs the buffer.
- Verification (agent): Check: trace the VLA's lifetime and call context; artifact: VLA-lifetime table; pass: the VLA is created and released within one synchronous operation and is not retained by a callback or task activation.
- Verification (target): Check: exercise the VLA path while the owning context remains active; artifact: lifetime trace and stack report; pass: the VLA does not remain live between callbacks, waits, or event-loop iterations.
- Exceptions: A synchronous wrapper MAY call a bounded helper that owns the VLA, but the wrapper must not retain its address.

Correct:

```c
void motor_parse(size_t count)
{
    if ((count == 0U) || (count > MOTOR_PARSE_MAX)) {
        return;
    }
    uint8_t bytes[count];
    motor_decode(bytes, count);
}
```

Incorrect:

```c
void motor_callback(size_t count)
{
    uint8_t bytes[count]; /* callback activation retains unbounded stack use */
    motor_queue_for_later(bytes, count);
}
```

### C-STYLE-MEM-004 [MUST]

Variable length arrays MUST NOT be used in interrupt service routines, long-lived callbacks,
or high-frequency real-time paths.

- Applies when: Introducing a VLA in an ISR, callback, periodic task, or other real-time path.
- Rationale: Runtime stack growth and allocation-like work in these contexts create latency and overflow risk that a fixed buffer avoids.
- Verification (agent): Check: trace every VLA call path to ISR, callback, and high-frequency entry points; artifact: VLA-context call graph; pass: no VLA is reachable from a prohibited context.
- Verification (target): Check: run the ISR, callback, and real-time workload at its required frequency; artifact: latency and stack trace; pass: no prohibited path creates a VLA and the workload meets its deadline.
- Exceptions: None for ISR or high-frequency real-time paths. A project-specific callback exception requires a recorded stack and latency budget.

Correct:

```c
void motor_parse(size_t count)
{
    if ((count == 0U) || (count > MOTOR_PARSE_MAX)) {
        return;
    }
    uint8_t bytes[count];
    motor_decode(bytes, count);
}
```

Incorrect:

```c
void motor_isr(size_t count)
{
    uint8_t bytes[count]; /* VLA in an interrupt path */
    motor_decode(bytes, count);
}
```

### C-STYLE-ALLOC-001 (Guidance; formerly [SHOULD])

Prefer dynamic allocation only during initialization, explicit resource create/destroy flows,
low-frequency non-real-time code, or through an approved fixed-block pool. This is guidance
because the acceptable timing and frequency boundary belongs to the consuming project.

- Applies when: Calling a general-purpose allocator or project allocator.
- Rationale: Fragmentation and unbounded latency are unsafe in frequent or timing-critical paths.
- Exceptions: `PROJECT_RULES.md` should define the allocator, lifetime, failure, and timing policy.

### C-STYLE-ALLOC-002 [MUST]

Every dynamic allocation MUST handle failure before dereferencing, publishing, or otherwise
using the returned object.

- Applies when: Calling a general-purpose allocator or project allocator.
- Rationale: Allocation failure is an ordinary runtime result on constrained targets; using a
  null or invalid result turns recoverable exhaustion into memory corruption.
- Verification (agent): Check: trace each allocation result to its first use; artifact: allocation-result flow table; pass: every path checks the allocator result before dereference, publication, or ownership transfer and returns the documented failure.
- Verification (target): Check: force allocation failure at each call site; artifact: fault-injection log and state trace; pass: the caller observes the documented failure, no invalid access occurs, and partial resources are released.
- Exceptions: A project-provided allocator with a documented non-returning failure contract may
  be exempt when that contract is linked in `PROJECT_RULES.md`.

Correct:

```c
motor_buffer_t *buffer = motor_alloc(sizeof(*buffer));
if (buffer == NULL) {
    return MOTOR_STATUS_NO_MEMORY;
}
motor_publish(buffer);
```

Incorrect:

```c
motor_buffer_t *buffer = motor_alloc(sizeof(*buffer));
motor_publish(buffer); /* allocation failure is used as a valid object */
```

### C-STYLE-CLEANUP-001 [MUST]

A function that acquires a resource MUST release it exactly once on every exit path, including early returns and error branches.

- Applies when: Acquiring memory, a lock, a handle, a DMA channel, or any object with a paired release.
- Rationale: The success path is usually correct; the defects are an early return that skips the release and an error branch that reaches it twice. A double release corrupts the allocator or unlocks a lock the caller still holds.
- Verification (agent): Check: trace every acquisition, `return`, `break`, and error branch; artifact: resource-lifetime table; pass: each acquired resource has exactly one matching release on every exit path, or a documented process-lifetime exception.
- Verification (target): Check: inject failures after each partial acquisition and on normal completion; artifact: resource-count trace and failure-path test log; pass: the resource count returns to its pre-call value exactly once on every path.
- Exceptions: A resource the project records as held for the process lifetime MAY be acquired without a release.

Correct:

```c
bool motor_open(void)
{
    motor_handle_t *handle = motor_acquire();
    if (handle == NULL) {
        return false;
    }
    if (!motor_configure(handle)) {
        motor_release(handle);
        return false;
    }
    motor_release(handle);
    return true;
}
```

Incorrect:

```c
bool motor_open(void)
{
    motor_handle_t *handle = motor_acquire();
    if (handle == NULL) {
        return false;
    }
    if (!motor_configure(handle)) {
        return false; /* leaked handle */
    }
    motor_release(handle);
    motor_release(handle); /* double release on success */
    return true;
}
```

### C-STYLE-GUARD-001 (Guidance; formerly [SHOULD])

Prefer early returns for validation and immediate-error checks rather than wrapping the main
body in nested conditionals. This is guidance; cleanup ordering may justify a single label.

- Applies when: Implementing a function that validates arguments or handles an immediate error.
- Rationale: Guard clauses keep the main path at one indent level, which makes the resource and error handling that `C-STYLE-CLEANUP-001` governs reviewable.
- Exceptions: A function unwinding several resources in order can use a single cleanup label instead.

### C-STYLE-COMMENT-001 (Guidance; formerly [SHOULD])

Prefer `/* ... */` comments that explain intent, invariants, timing, ownership, or safety
boundaries rather than restating code. This is guidance because generated code and local
documentation conventions may require another syntax.

- Applies when: Adding comments to C code.
- Rationale: Intent-focused comments preserve design knowledge that the code cannot state. The syntax choice is a convention; the content is what carries the value.
- Exceptions: Generated code can follow its generator's syntax.

### C-STYLE-INCREMENT-001 [MUST]

An increment or decrement MUST NOT be combined with another read or write of the same object in
one expression.

- Applies when: Writing `++` or `--`.
- Rationale: `i = i++` and `a[i] = i++` are unsequenced modifications, which is undefined behavior rather than a style question — the compiler may produce any result and often changes it with the optimization level. The postfix preference is the separate, conventional half of this rule.
- Verification (agent): Check: inspect every expression containing `++` or `--` for another read or write of the same object; artifact: sequence-access scan; pass: no expression has a combined access to the modified object.
- Verification (target): Check: compile with `-Wsequence-point` at the project optimization level and run sequence-sensitive tests; artifact: compiler log and test log; pass: the build has no sequence-point diagnostic and each counter update produces the documented result.
- Exceptions: None for the combined-access prohibition.

Guidance: Use the postfix form for a standalone counter update when it matches the surrounding
code.

Correct:

```c
index++;
value = buffer[index];
```

Incorrect:

```c
buffer[index] = index++; /* reads and modifies index unsequenced */
```

### C-STYLE-BRACES-001 [SHOULD]

Every `if`, `else`, `for`, `while`, `do`, and `switch` branch SHOULD use braces, including single-statement and empty bodies.

- Applies when: Writing compound control-flow statements.
- Rationale: Braces prevent a later edit from silently falling outside the branch. This is mechanically enforced, so it does not need review attention.
- Verification (agent): Check: run `clang-format --dry-run --Werror` with `InsertBraces: true`; artifact: formatter output; pass: every changed control-flow statement has braces and the formatter reports no diff.
- Verification (target): Check: run the same formatter check in target CI; artifact: CI formatter log; pass: zero formatting diagnostics are emitted.
- Exceptions: None.

### C-STYLE-SWITCH-001 [MUST]

Every `switch` MUST handle values that no `case` matches, through a `default` or a build-time
check that the enumeration is exhaustive.

- Applies when: Writing or extending a `switch`.
- Rationale: An unhandled value silently falls out of the statement, which on an embedded target usually means a state machine stalls in place with no diagnostic.
- Verification (agent): Check: inspect every `switch` for a `default` or an exhaustive compiler check; artifact: switch-coverage report; pass: every unmatched value reaches a documented `default` or an exhaustive compile-time failure.
- Verification (target): Check: dispatch an out-of-range value and each supported enumeration value; artifact: state-transition test log and compiler log; pass: the unmatched value reaches the documented default/error state, or the exhaustive build check rejects a missing enumerator.
- Exceptions: A `switch` over an enumeration MAY omit `default` when the build fails on a missing enumerator, so that adding one is a compile error rather than a silent fallthrough to `default`.

Correct:

```c
switch (state) {
case MOTOR_IDLE:
    return;
case MOTOR_RUNNING:
    return;
default:
    return MOTOR_STATUS_INVALID_STATE;
}
```

Incorrect:

```c
switch (state) {
case MOTOR_IDLE:
    start_motor();
    break;
case MOTOR_RUNNING:
    run_motor();
    break;
}
```

### C-STYLE-SWITCH-002 [MUST]

Intentional `switch` fall-through MUST be marked with the project's recognized annotation or
comment.

- Applies when: Writing adjacent `case` labels that intentionally share execution.
- Rationale: An explicit marker distinguishes a deliberate fall-through from a missing `break` and lets compiler diagnostics enforce the distinction.
- Verification (agent): Check: inspect each case that reaches the next case without an exit; artifact: fall-through report; pass: every intentional fall-through has the configured annotation or comment.
- Verification (target): Check: compile with the project's implicit-fallthrough diagnostic enabled and exercise marked cases; artifact: compiler log and state-transition test log; pass: no unmarked fall-through diagnostic occurs and each marked transition executes once.
- Exceptions: A compiler-specific fall-through attribute MAY be used when the project toolchain recognizes it.

Correct:

```c
switch (state) {
case MOTOR_IDLE:
    start_motor();
    /* fall through */
case MOTOR_RUNNING:
    run_motor();
    break;
}
```

Incorrect:

```c
switch (state) {
case MOTOR_IDLE:
    start_motor();
case MOTOR_RUNNING: /* no fall-through marker */
    run_motor();
    break;
}
```

### C-STYLE-SWITCHFMT-001 (Guidance; formerly [SHOULD])

Prefer one-level indentation for `case` and `default` labels, one further level for their
statements, and braces around a `case` that declares an object. The formatter configuration is
the enforceable boundary; this layout preference is guidance.

- Applies when: Formatting a `switch`.
- Rationale: Consistent case layout makes the control-flow boundary easy to scan, while the exact indentation is a presentation choice.
- Exceptions: Generated code and an established local formatter configuration can retain their required layout.

### C-STYLE-TRAILING-001 (Guidance; formerly [SHOULD])

Prefer trailing commas in multiline structure, union, and array initializers to reduce diff
noise. Short single-line initializers may omit them. This is guidance because it has no
behavioral boundary.

- Applies when: Formatting aggregate initializers.
- Rationale: Trailing commas reduce diff noise and formatter churn.
- Exceptions: None.

### C-STYLE-DECLARATION-001 (Guidance; formerly [SHOULD])

Prefer declaring a local object near its first use rather than grouping declarations at the top
of a block. This is guidance because a declaration's useful location depends on control flow.

- Applies when: Declaring local variables.
- Rationale: C11 permits a declaration anywhere in a block, which lets `C-STYLE-INIT-002` initialize an object with the value it will actually hold. Hoisting every declaration to the block top forces the opposite: a run of objects that are indeterminate until later statements assign them.
- Exceptions: A project migrating C89 code can keep the existing layout in files it is not otherwise restructuring.

### C-STYLE-POINTER-001 (Guidance; formerly [SHOULD])

Prefer placing the asterisk next to the declarator (`uint8_t *buffer`) and declaring one object
per declaration. This is guidance; type safety is enforced by the interface and compiler.

- Applies when: Declaring pointer objects or pointer return types.
- Rationale: One object per declaration avoids `uint8_t *a, b`, where `b` is not a pointer. The asterisk position is formatter-enforced convention.
- Exceptions: External ABI or generated-code formatting can be preserved.

### C-STYLE-SIZEOF-001 [MUST]

When the size of a pointed-to object is intended, `sizeof` MUST use `sizeof(*pointer)` rather than
`sizeof(pointer)`.

- Applies when: Writing a `sizeof` expression, particularly one passed to a copy, compare, or allocation call.
- Rationale: `sizeof(pointer)` compiles silently and yields the pointer width, so `memcpy(dst, src, sizeof(src))` copies 4 or 8 bytes of a larger object. `sizeof(*pointer)` also stays correct when the pointed-to type changes.
- Verification (agent): Check: inspect every `sizeof` expression used for a pointed-to object, especially in copy, clear, or allocation calls; artifact: `sizeof` operand report; pass: each such expression uses `sizeof(*pointer)` and no pointer-width substitute.
- Verification (target): Check: build with `-Wsizeof-pointer-memaccess` and run size-sensitive tests; artifact: compiler log and test log; pass: no pointer-size diagnostic occurs and each operation handles the documented object size.
- Exceptions: Taking the pointer's own size MAY use `sizeof(void *)` or an equivalent explicit pointer type when that is the intent.

Correct:

```c
void motor_copy(uint8_t *dst, const uint8_t *src)
{
    memcpy(dst, src, sizeof(*dst));
}
```

Incorrect:

```c
void motor_copy(uint8_t *dst, const uint8_t *src)
{
    memcpy(dst, src, sizeof(src)); /* copies pointer width, not the object */
}
```

Guidance: Use parentheses around a `sizeof` type name for readability. The C grammar already
requires them for a type-name operand.
