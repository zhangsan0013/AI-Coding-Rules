# C11 Preprocessor Rules

Status: active

## Scope

Macros, conditional compilation, include guards, feature switches, and compile-time values.

## Load when

Adding or changing preprocessor directives or macros.

## Rules

### C-PP-ALTERNATIVE-001 (Guidance; formerly [SHOULD])

Prefer `enum`, `static const`, `static inline`, and typed functions over macros when those
constructs provide equivalent behavior. This is guidance because projects may deliberately
choose a macro for a documented build-time or metaprogramming constraint.

- Applies when: Introducing a compile-time value or reusable operation.
- Rationale: Typed language constructs avoid macro substitution and evaluation hazards.
- Exceptions: Macros can be used for conditional compilation, stringification, token pasting, or required compile-time metaprogramming.

### C-PP-MACRO-001 [MUST]

Function-like macro names MUST carry a project or module prefix.

- Applies when: Defining a function-like macro.
- Rationale: A prefix prevents collisions with macros from the standard library, toolchain, and other modules.
- Verification (agent): Check: inspect the function-like macro inventory; artifact: macro-name report; pass: every exported function-like macro carries the recorded project or module prefix.
- Verification (target): Check: preprocess the target's public headers and inspect the exported macro list; artifact: preprocessor output; pass: no unprefixed project function-like macro is exposed.
- Exceptions: A documented compiler intrinsic MAY require a different name.

Correct:

```c
#define MOTOR_MASK(value, mask) ((value) & (mask))
```

Incorrect:

```c
#define MAX(a, b) ((a) > (b) ? (a) : (b))
```

### C-PP-MACRO-002 [MUST]

Each function-like macro parameter and its complete expression MUST be parenthesized.

- Applies when: Defining a function-like macro that expands to an expression.
- Rationale: Parentheses prevent the caller's operators from changing the macro's intended precedence.
- Verification (agent): Check: inspect each function-like macro expansion; artifact: macro-expansion review table; pass: every parameter occurrence and the complete expression are parenthesized.
- Verification (target): Check: compile a precedence fixture that passes arithmetic and comparison expressions as arguments; artifact: compiler log and fixture output; pass: each expansion preserves the documented grouping.
- Exceptions: A documented compiler intrinsic MAY require a different form.

Correct:

```c
#define MOTOR_MASK(value, mask) ((value) & (mask))
```

Incorrect:

```c
#define MOTOR_MASK(value, mask) value & mask
```

### C-PP-MACRO-003 [MUST]

Each function-like macro argument MUST be evaluated at most once.

- Applies when: Defining a function-like macro whose arguments can be expressions with side effects.
- Rationale: Repeating an argument can duplicate a volatile access or a state-changing operation at the call site.
- Verification (agent): Check: count each parameter occurrence in every function-like macro expansion; artifact: parameter-use table; pass: no argument is evaluated more than once by an expansion.
- Verification (target): Check: call each macro with incrementing, volatile, and function-call arguments; artifact: side-effect fixture log; pass: each argument's observable effect occurs no more than once.
- Exceptions: None for function-like macros whose arguments can be expressions with side effects.

Correct:

```c
#define MOTOR_IS_READY(value) ((value) != 0)
```

Incorrect:

```c
#define MOTOR_MAX(a, b) ((a) > (b) ? (a) : (b))
```

### C-PP-MACRO-004 [MUST]

Statement-like macros MUST use `do { ... } while (0)` so each invocation behaves as one statement.

- Applies when: Defining a macro that expands to more than one statement or contains a bare control-flow statement.
- Rationale: The wrapper prevents a caller's `if/else` from binding to only part of the macro expansion.
- Verification (agent): Check: inspect every statement-like macro expansion; artifact: statement-macro review table; pass: each multi-statement expansion is wrapped in `do { ... } while (0)`.
- Verification (target): Check: invoke each statement macro as the body of an `if/else` without braces; artifact: compiled fixture and output log; pass: the macro executes as one syntactic statement and the `else` binds to the caller's `if`.
- Exceptions: A documented compiler intrinsic MAY require a different form.

Correct:

```c
#define MOTOR_SET(reg, mask) do { (reg) |= (mask); } while (0)
```

Incorrect:

```c
#define MOTOR_SET(reg, mask) (reg) |= (mask)
```

### C-PP-CONDITION-001 [MUST]

Configuration conditionals MUST establish that their controlling macro is defined before using
its value. This can be done with `defined(NAME)` or by defining the macro in the build
configuration before preprocessing.

- Applies when: Adding `#if`, `#elif`, `#else`, or `#endif`.
- Rationale: In `#if`, an undefined identifier is replaced by `0` without a diagnostic by default, so a misspelled `#if CFG_ENABLE_WATCHDOG` silently takes the disabled branch and the watchdog is simply absent. Branch comments are separate guidance below.
- Verification (agent): Check: inspect every configuration conditional and its defining header or build manifest; artifact: conditional-definition matrix; pass: each tested configuration macro is guarded by `defined(NAME)` or unconditionally defined before use.
- Verification (target): Check: preprocess all supported configurations with `-Wundef -Werror`; artifact: compiler/preprocessor logs for each configuration; pass: all configurations preprocess without undefined-macro diagnostics and select the documented branch.
- Exceptions: A macro the build system guarantees to define MAY be tested by value, when that guarantee is recorded.

Guidance: Comment each branch and closing directive with its condition when the conditional
spans more than one screenful or contains nested branches.

Correct:

```c
#if defined(MOTOR_USE_DMA) && (MOTOR_USE_DMA != 0)
motor_dma_init();
#endif /* MOTOR_USE_DMA */
```

Incorrect:

```c
#if MOTOR_USE_DAM
motor_dma_init();
#endif
```

### C-PP-INCLUDE-001 [MUST]

Public headers MUST use a unique, non-reserved include guard.

- Applies when: Creating or changing headers.
- Rationale: A collision or reserved guard can silently suppress a header and make declarations disappear after an include-order change or toolchain update.
- Verification (agent): Check: scan each public header's guard against the project header inventory and reserved-name patterns; artifact: guard-collision report; pass: every public header has one unique, non-reserved guard.
- Verification (target): Check: include all public headers in one C11 smoke fixture; artifact: compiler log and preprocessor output; pass: every header contributes its declarations and no guard collision suppresses a declaration.
- Exceptions: Generated headers MAY follow generator conventions if equivalent protection exists.

Correct:

```c
#ifndef MOTOR_CONTROL_H
#define MOTOR_CONTROL_H
#endif /* MOTOR_CONTROL_H */
```

Incorrect:

```c
#ifndef _H_
#define _H_
#endif
```

### C-PP-INCLUDE-002 [MUST]

Public headers MUST include every header that declares a type or macro used by their public
declarations.

- Applies when: Creating or changing a public header declaration.
- Rationale: A self-contained header prevents callers from depending on incidental include order.
- Verification (agent): Check: resolve every type and macro in each public declaration to its defining header; artifact: header dependency matrix; pass: each required defining header is included directly by the public header.
- Verification (target): Check: compile a fixture that includes each public header as the first include; artifact: C11 compiler log; pass: every header compiles without an undeclared type or macro.
- Exceptions: A generated header MAY rely on a generator-provided umbrella include when that dependency is recorded.

Correct:

```c
#include <stdint.h>

void motor_start(uint32_t speed);
```

Incorrect:

```c
void motor_start(uint32_t speed); /* no header declares uint32_t */
```

Guidance: Keep standard headers before project headers and avoid unrelated includes so the
dependency boundary remains easy to inspect.

### C-PP-INCLUDE-003 [MUST]

Public headers that declare C functions MUST wrap those declarations in `extern "C"` when
`__cplusplus` is defined.

- Applies when: Creating or changing a public header consumed by both C and C++ translation units.
- Rationale: C++ name mangling otherwise prevents a C++ caller from linking to the C implementation.
- Verification (agent): Check: inspect each public function declaration and its C++ linkage wrapper; artifact: linkage-wrapper checklist; pass: every mixed-language public function declaration is inside the `__cplusplus` `extern "C"` wrapper.
- Verification (target): Check: compile a C implementation and link a C++ caller against the public header; artifact: C/C++ compiler and linker logs; pass: the C++ caller links without an unresolved mangled symbol.
- Exceptions: A header intended only for C++ MAY omit the wrapper when its language boundary is recorded.

Correct:

```c
#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

void motor_start(uint32_t speed);

#ifdef __cplusplus
}
#endif
```

Incorrect:

```c
#include <stdint.h>

void motor_start(uint32_t speed); /* C++ callers see a mangled declaration */
```
