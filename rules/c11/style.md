# C11 Style Rules

Status: active

## Scope

Formatting, control flow, storage duration, types, and comments for C11 source and header files.

## Load when

Editing C source or header files.

## Rules

### C-STYLE-FORMAT-001 [SHOULD]

Code SHOULD be formatted with the repository formatter: four spaces per indent level, no tabs, spaces around binary operators, a space after control-flow keywords, the function body opening brace on its own line, and the return type, name, and parameter list on one line where length permits.

- Applies when: Formatting C11 source or header files.
- Rationale: Consistent layout makes review predictable. This entire rule is mechanically enforced, so it should cost review no attention.
- Verification (agent): None; run the formatter instead of reviewing layout.
- Verification (target): `clang-format --dry-run --Werror` against `templates/.clang-format`.
- Exceptions: Existing surrounding style MAY be preserved when modifying legacy code.

### C-STYLE-TYPES-001 [MUST]

A value with binary-layout meaning — a protocol field, a stored record, or a register value — MUST use a fixed-width type from `<stdint.h>`. Logical state MUST use `bool` from `<stdbool.h>`.

- Applies when: Declaring or testing a value with logical or binary-layout meaning.
- Rationale: `int`, `long`, and `char` have implementation-defined width and signedness. A protocol field declared `int` changes size between a 16-bit and a 32-bit target, so the same source produces a different wire format. `char` is the sharpest case: whether it is signed is implementation-defined, so `char` used for byte data can sign-extend on one toolchain and not another.
- Verification (agent): Check every field of a protocol, register, or persisted structure for a fixed-width type, and every truth-valued object for `bool`.
- Verification (target): Confirm the sizes with `_Static_assert(sizeof(struct x) == N)` for each layout-bearing type.
- Exceptions: A documented ABI or generated code MAY require another representation. `char` remains correct for text handled by the standard string functions.

### C-STYLE-INIT-001 [MUST]

An object MUST NOT be read before it has been assigned a value. An object with static or thread storage duration MUST have an explicit initializer at its declaration rather than relying on implicit zero initialization.

- Applies when: Declaring or first assigning any object.
- Rationale: Reading an indeterminate automatic object is undefined behavior. For static objects the zeroing is guaranteed but invisible, so an explicit initializer states the startup value the code actually depends on.
- Verification (agent): Confirm no object is read on a path where it may not yet be assigned, and that each object with static or thread storage duration carries an explicit initializer.
- Verification (target): Build with `-Wuninitialized -Wmaybe-uninitialized` at the project optimization level, where the analysis is strongest.
- Exceptions: An object the linker or startup code initializes, or one written by DMA or hardware before its first read, MUST document that contract instead of carrying an initializer that the startup path would discard.

### C-STYLE-INIT-002 [SHOULD]

An automatic object SHOULD be initialized at its declaration when the value is known there. When the value is not yet known, the declaration SHOULD be placed where the value becomes available rather than carrying a placeholder initializer.

- Applies when: Declaring an automatic object.
- Rationale: An initializer at the declaration removes the window in which the object is indeterminate. A placeholder such as `= 0` written only to satisfy a checker is worse: it suppresses `-Wuninitialized` and turns a diagnosable fault into a plausible-looking wrong value.
- Verification (agent): Review each automatic declaration for an initializer where the value is known there. A placeholder whose value is never read is a finding: it silences the uninitialized diagnostic without supplying a meaningful value.
- Verification (target): None; this is a source-structure property.
- Exceptions: An object assigned in every branch of a following `if`/`switch`, or one whose address is passed to an out-parameter writer, MAY be declared without an initializer.

### C-STYLE-MEM-001 [SHOULD]

Variable length arrays SHOULD NOT be used; when used, their maximum length MUST be explicit, included in the relevant stack budget, limited to a synchronous short-lived scope, and excluded from ISR, long-lived callback, and high-frequency real-time paths.

- Applies when: A VLA is introduced.
- Rationale: Runtime-sized stack objects can exhaust a task or thread stack unpredictably.
- Verification (agent): Confirm each VLA has an explicit maximum length, that the maximum is included in the stack budget, and that it is not in an ISR, a long-lived callback, or a high-frequency path.
- Verification (target): Measure the stack high-water mark with the maximum length.
- Exceptions: The exception and bound MUST be recorded in `PROJECT_RULES.md` when the limits cannot be inferred locally.

### C-STYLE-ALLOC-001 [SHOULD]

Dynamic allocation SHOULD be limited to initialization, explicit resource create/destroy flows, low-frequency non-real-time code, or an approved fixed-block pool.

- Applies when: Calling a general-purpose allocator or project allocator.
- Rationale: Fragmentation and unbounded latency are unsafe in frequent or timing-critical paths.
- Verification (agent): Confirm each allocation is in initialization, an explicit create/destroy flow, low-frequency code, or an approved pool, and that its failure is handled.
- Verification (target): Test the exhaustion path.
- Exceptions: `PROJECT_RULES.md` MUST define the allocator, lifetime, failure, and timing policy.

### C-STYLE-CLEANUP-001 [MUST]

A function that acquires a resource MUST release it exactly once on every exit path, including early returns and error branches.

- Applies when: Acquiring memory, a lock, a handle, a DMA channel, or any object with a paired release.
- Rationale: The success path is usually correct; the defects are an early return that skips the release and an error branch that reaches it twice. A double release corrupts the allocator or unlocks a lock the caller still holds.
- Verification (agent): Trace every `return`, `break`, and error branch and confirm each acquired resource is released exactly once. A release that appears on the success path only is a finding.
- Verification (target): Test each failure path, including a failure after partial acquisition.
- Exceptions: A resource the project records as held for the process lifetime MAY be acquired without a release.

### C-STYLE-GUARD-001 [SHOULD]

Validation and immediate-error checks SHOULD use early returns rather than wrapping the body in nested conditionals.

- Applies when: Implementing a function that validates arguments or handles an immediate error.
- Rationale: Guard clauses keep the main path at one indent level, which makes the resource and error handling that `C-STYLE-CLEANUP-001` governs reviewable.
- Verification (agent): Review nesting depth against the number of validation checks.
- Verification (target): None; this is a source-structure property.
- Exceptions: A function unwinding several resources in order MAY use a single cleanup label instead.

### C-STYLE-COMMENT-001 [SHOULD]

Comments SHOULD use `/* ... */` syntax and explain intent, invariants, timing, ownership, or safety boundaries rather than restating code.

- Applies when: Adding comments to C code.
- Rationale: Intent-focused comments preserve design knowledge that the code cannot state. The syntax choice is a convention; the content is what carries the value.
- Verification (agent): Review each new comment for intent rather than restatement.
- Verification (target): None.
- Exceptions: Generated code MAY follow its generator's syntax.

### C-STYLE-INCREMENT-001 [MUST]

An increment or decrement MUST NOT be combined with another read or write of the same object in one expression. A standalone counter update SHOULD use the postfix form.

- Applies when: Writing `++` or `--`.
- Rationale: `i = i++` and `a[i] = i++` are unsequenced modifications, which is undefined behavior rather than a style question — the compiler may produce any result and often changes it with the optimization level. The postfix preference is the separate, conventional half of this rule.
- Verification (agent): Check each `++`/`--` expression for a second access to the same object.
- Verification (target): Build with `-Wsequence-point` and the project's optimization level.
- Exceptions: None for the combined-access prohibition.

### C-STYLE-BRACES-001 [SHOULD]

Every `if`, `else`, `for`, `while`, `do`, and `switch` branch SHOULD use braces, including single-statement and empty bodies.

- Applies when: Writing compound control-flow statements.
- Rationale: Braces prevent a later edit from silently falling outside the branch. This is mechanically enforced, so it does not need review attention.
- Verification (agent): None; `templates/.clang-format` sets `InsertBraces: true`.
- Verification (target): `clang-format --dry-run --Werror`.
- Exceptions: None.

### C-STYLE-SWITCH-001 [MUST]

Every `switch` MUST handle values no `case` matches, through a `default` or a build-time check that the enumeration is exhaustive. Intentional fall-through MUST be marked.

- Applies when: Writing or extending a `switch`.
- Rationale: An unhandled value silently falls out of the statement, which on an embedded target usually means a state machine stalls in place with no diagnostic. Unmarked fall-through is indistinguishable from a forgotten `break`.
- Verification (agent): Confirm a `default` exists, or that `-Wswitch-enum` is enabled and every enumerator is named. Check each `case` that ends without `break`, `return`, or `continue` for a fall-through marker.
- Verification (target): Test an out-of-range value and confirm the recorded behavior.
- Exceptions: A `switch` over an enumeration MAY omit `default` when the build fails on a missing enumerator, so that adding one is a compile error rather than a silent fallthrough to `default`.

### C-STYLE-SWITCHFMT-001 [SHOULD]

`case` and `default` labels SHOULD be indented one level inside the `switch`, their statements one further level, with `break` aligned to those statements. A `case` that declares an object SHOULD use its own braces.

- Applies when: Formatting a `switch`.
- Rationale: Separated from `C-STYLE-SWITCH-001` because layout is enforced by the formatter while unhandled-value behavior is not.
- Verification (agent): None; `templates/.clang-format` sets `IndentCaseLabels: true`.
- Verification (target): `clang-format --dry-run --Werror`.
- Exceptions: None.

### C-STYLE-TRAILING-001 [SHOULD]

Multiline structure, union, and array initializers SHOULD retain a trailing comma at every nesting level; short single-line initializers MAY omit it.

- Applies when: Formatting aggregate initializers.
- Rationale: Trailing commas reduce diff noise and formatter churn.
- Verification (agent): None; the formatter and review handle this.
- Verification (target): `clang-format --dry-run --Werror`.
- Exceptions: None.

### C-STYLE-DECLARATION-001 [SHOULD]

A local object SHOULD be declared where it is first needed rather than grouped at the top of the block.

- Applies when: Declaring local variables.
- Rationale: C11 permits a declaration anywhere in a block, which lets `C-STYLE-INIT-002` initialize an object with the value it will actually hold. Hoisting every declaration to the block top forces the opposite: a run of objects that are indeterminate until later statements assign them.
- Verification (agent): Review each declaration for distance from its first use, and for an initializer.
- Verification (target): None.
- Exceptions: A project migrating C89 code MAY keep the existing layout in files it is not otherwise restructuring.

### C-STYLE-POINTER-001 [SHOULD]

A pointer declaration SHOULD place the asterisk next to the declarator (`uint8_t *buffer`) and SHOULD declare one object per declaration.

- Applies when: Declaring pointer objects or pointer return types.
- Rationale: One object per declaration avoids `uint8_t *a, b`, where `b` is not a pointer. The asterisk position is formatter-enforced convention.
- Verification (agent): Check multi-declarator lines for a mixed pointer and non-pointer declaration.
- Verification (target): `clang-format --dry-run --Werror`; `templates/.clang-format` sets `PointerAlignment: Right`.
- Exceptions: External ABI or generated-code formatting MAY be preserved.

### C-STYLE-SIZEOF-001 [MUST]

`sizeof` MUST use parentheses, and MUST use `sizeof(*pointer)` rather than `sizeof(pointer)` when the size of the pointed-to object is intended.

- Applies when: Writing a `sizeof` expression, particularly one passed to a copy, compare, or allocation call.
- Rationale: `sizeof(pointer)` compiles silently and yields the pointer width, so `memcpy(dst, src, sizeof(src))` copies 4 or 8 bytes of a larger object. `sizeof(*pointer)` also stays correct when the pointed-to type changes.
- Verification (agent): Check every `sizeof` whose operand is a pointer object, and every `sizeof` argument to `memcpy`, `memset`, or an allocation call.
- Verification (target): Build with `-Wsizeof-pointer-memaccess`.
- Exceptions: None; taking the pointer's own size MUST be written `sizeof(void *)` or equivalent to show that is the intent.
