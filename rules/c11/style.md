# C11 Style Rules

Status: active

## Scope

Formatting, control flow, storage duration, types, and comments for C11 source and header files.

## Load when

Editing C source or header files.

## Rules

### C-STYLE-FORMAT-001 [SHOULD]

Code SHOULD be formatted with the repository formatter: four spaces per indent level, no tabs, spaces around binary operators, a space after control-flow keywords, and the function body opening brace on its own line. A function return type, name, and parameter list MUST share one line when the line length permits it.

- Applies when: Formatting C11 source or header files.
- Rationale: Consistent layout makes review and maintenance predictable.
- Verification: `clang-format --dry-run --Werror` or review when the formatter is unavailable.
- Exceptions: Existing surrounding style MAY be preserved when modifying legacy code.

### C-STYLE-TYPES-001 [MUST]

Code MUST use C11 `<stdbool.h>` `bool` for logical state and fixed-width integer types for protocol, storage, and register representations.

- Applies when: Declaring or testing values with logical or binary-layout meaning.
- Rationale: The type communicates intent without conflating logic and representation.
- Verification: Review and compiler diagnostics.
- Exceptions: A documented ABI or generated-code constraint may require another representation.

### C-STYLE-INIT-001 [MUST]

Global, static-local, and automatic-local variables MUST have an explicit legal initializer at their declaration and MUST NOT rely on C's implicit zero initialization.

- Applies when: Declaring any object with static or automatic storage duration.
- Rationale: Explicit initial state makes startup behavior and local invariants visible and reviewable.
- Verification: Compiler warnings such as `-Wuninitialized` plus review of declarations.
- Exceptions: None for handwritten code; linker- or startup-managed objects MUST document their initialization contract.

### C-STYLE-MEM-001 [SHOULD]

Variable length arrays SHOULD NOT be used; when used, their maximum length MUST be explicit, included in the relevant stack budget, limited to a synchronous short-lived scope, and excluded from ISR, long-lived callback, and high-frequency real-time paths.

- Applies when: A VLA is introduced.
- Rationale: Runtime-sized stack objects can exhaust a task or thread stack unpredictably.
- Verification: Review of the bound, stack budget, and call context.
- Exceptions: The exception and bound MUST be recorded in `PROJECT_RULES.md` when the limits cannot be inferred locally.

### C-STYLE-ALLOC-001 [SHOULD]

Dynamic allocation SHOULD be limited to initialization, explicit resource create/destroy flows, low-frequency non-real-time code, or an approved fixed-block pool.

- Applies when: Calling a general-purpose allocator or project allocator.
- Rationale: Fragmentation and unbounded latency are unsafe in frequent or timing-critical paths.
- Verification: Review of context, ownership, failure handling, and allocator policy.
- Exceptions: `PROJECT_RULES.md` MUST define the allocator, lifetime, failure, and timing policy.

### C-STYLE-FLOW-001 [MUST]

Functions MUST use clear early returns for validation or immediate errors, and resource-owning paths MUST provide one auditable cleanup path that releases each acquired resource exactly once.

- Applies when: Implementing functions with validation, errors, or acquired resources.
- Rationale: Guard clauses reduce nesting while structured cleanup prevents leaks and double release.
- Verification: Review and tests covering each failure path.
- Exceptions: None.

### C-STYLE-COMMENT-001 [MUST]

Comments MUST use `/* ... */` syntax and explain intent, invariants, timing, ownership, or safety boundaries rather than restating code.

- Applies when: Adding comments to C code.
- Rationale: Intent-focused comments preserve useful design knowledge.
- Verification: Review.
- Exceptions: Generated code MAY follow its generator's syntax.

### C-STYLE-INCREMENT-001 [SHOULD]

Standalone counter increments and decrements SHOULD use postfix operators; prefix operators MAY be used when the expression requires the incremented value. Increment or decrement MUST NOT be combined with another read or write of the same object in one expression.

- Applies when: Writing `++` or `--` operations.
- Rationale: This preserves the project convention while avoiding evaluation-order hazards.
- Verification: Review and compiler warnings.
- Exceptions: None.

### C-STYLE-BRACES-001 [MUST]

Every `if`, `else`, `for`, `while`, `do`, and `switch` branch MUST use braces, including single-statement and empty bodies.

- Applies when: Writing compound control-flow statements.
- Rationale: Braces prevent accidental control-flow changes during maintenance.
- Verification: Review or static analysis.
- Exceptions: None.

### C-STYLE-SWITCH-001 [MUST]

Each `switch` MUST include a documented `default`; `case` and `default` labels MUST be indented one level inside the switch, their statements one additional level, and `break` MUST align with those statements.

- Applies when: Writing `switch` statements.
- Rationale: Consistent labels and an explicit fallback make unhandled values visible.
- Verification: Review and tests for unknown values.
- Exceptions: Intentional fall-through MUST be documented; a case with declarations MUST use its own braces.

### C-STYLE-TRAILING-001 [SHOULD]

Multiline structure, union, and array initializers SHOULD retain a trailing comma at every nesting level; short single-line initializers MAY omit it.

- Applies when: Formatting aggregate initializers.
- Rationale: Trailing commas reduce diff noise and formatter churn.
- Verification: Review or formatter.
- Exceptions: None.

### C-STYLE-DECLARATION-001 [MUST]

Local variables MUST be declared at the beginning of their block, grouped by type, and ordered from project types through wider integer types to character/boolean and floating-point types; declarations after executable statements are forbidden.

- Applies when: Declaring local variables.
- Rationale: Predictable declaration layout helps review stack usage and initialization.
- Verification: Review and compiler diagnostics.
- Exceptions: A nested block MAY be introduced when a narrower lifetime is intentional.

### C-STYLE-POINTER-001 [MUST]

Pointer declarations and definitions MUST place the asterisk next to the declarator (`uint8_t *buffer`), and each declaration MUST declare only one pointer object.

- Applies when: Declaring pointer objects or pointer return types.
- Rationale: The spelling makes pointer-ness belong to the object and avoids multi-declarator ambiguity.
- Verification: Review or formatter.
- Exceptions: External ABI or generated-code formatting MAY be preserved.

### C-STYLE-SIZEOF-001 [MUST]

The `sizeof` operator MUST use parentheses; use `sizeof(*pointer)` for pointed-to objects and `sizeof(type)` for explicit types.

- Applies when: Writing `sizeof` expressions.
- Rationale: Parentheses make the operand unambiguous and `sizeof(*pointer)` stays correct when the pointed-to type changes.
- Verification: Review and compiler diagnostics.
- Exceptions: None.
