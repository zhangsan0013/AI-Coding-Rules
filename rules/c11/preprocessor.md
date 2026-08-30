# C11 Preprocessor Rules

Status: active

## Scope

Macros, conditional compilation, include guards, feature switches, and compile-time values.

## Load when

Adding or changing preprocessor directives or macros.

## Rules

### C-PP-ALTERNATIVE-001 [SHOULD]

Code SHOULD prefer `enum`, `static const`, `static inline`, and typed functions over macros when those constructs provide equivalent behavior.

- Applies when: Introducing a compile-time value or reusable operation.
- Rationale: Typed language constructs avoid macro substitution and evaluation hazards.
- Verification (agent): Confirm each new macro could not be an `enum`, `static const`, or `static inline` with the same effect. A function-like macro whose arguments are each used once is a finding.
- Verification (target): None; this is a source-structure property.
- Exceptions: Macros MAY be used for conditional compilation, stringification, token pasting, or required compile-time metaprogramming.

### C-PP-MACRO-001 [MUST]

Function-like macros MUST prefix their names with a module identifier, parenthesize each parameter and the complete expression, and evaluate each argument at most once; statement macros MUST use `do { ... } while (0)`.

- Applies when: Defining function-like or statement macros.
- Rationale: These constraints prevent precedence, dangling-`else`, and side-effect bugs.
- Verification (agent): Confirm each function-like macro parenthesizes every parameter and the whole expression, evaluates each argument at most once, and that a statement macro uses `do { ... } while (0)`. A macro using a parameter twice is a finding when an argument may have a side effect.
- Verification (target): Preprocess the expansion and test with an argument that has a side effect.
- Exceptions: A documented compiler intrinsic MAY require a different form.

### C-PP-CONDITION-001 [MUST]

Conditional compilation on a configuration macro MUST test it with `defined(NAME)`, or MUST guarantee the macro is defined before the test. A configuration branch MUST NOT depend on an undefined macro evaluating to `0`.

Every branch and closing directive SHOULD name its condition in a comment.

- Applies when: Adding `#if`, `#elif`, `#else`, or `#endif`.
- Rationale: In `#if`, an undefined identifier is replaced by `0` without a diagnostic by default, so a misspelled `#if CFG_ENABLE_WATCHDOG` silently takes the disabled branch and the watchdog is simply absent. The comment half is a readability convention, which is why it is a SHOULD.
- Verification (agent): Check each `#if` on a configuration macro for either a `defined()` test or a header that defines it unconditionally. A bare `#if SOME_CONFIG` where the macro may be absent is a finding.
- Verification (target): Build with `-Wundef` and confirm it is an error rather than a warning.
- Exceptions: A macro the build system guarantees to define MAY be tested by value, when that guarantee is recorded.

### C-PP-INCLUDE-001 [MUST]

Public headers MUST use a unique include guard, include only required dependencies, place standard headers before project headers, and wrap declarations in `extern \"C\"` when `__cplusplus` is defined.

- Applies when: Creating or changing headers.
- Rationale: Stable dependency boundaries and C++ linkage compatibility prevent integration failures.
- Verification (agent): Confirm each public header has a unique guard that is not a reserved name, includes what it uses, and wraps declarations for `__cplusplus` where the project requires C++ consumption.
- Verification (target): Compile C11 and C++ include smoke tests.
- Exceptions: Generated headers MAY follow generator conventions if equivalent protection exists.
