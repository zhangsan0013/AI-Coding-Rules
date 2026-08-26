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
- Verification: Review.
- Exceptions: Macros MAY be used for conditional compilation, stringification, token pasting, or required compile-time metaprogramming.

### C-PP-MACRO-001 [MUST]

Function-like macros MUST prefix their names with a module identifier, parenthesize each parameter and the complete expression, and evaluate each argument at most once; statement macros MUST use `do { ... } while (0)`.

- Applies when: Defining function-like or statement macros.
- Rationale: These constraints prevent precedence, dangling-`else`, and side-effect bugs.
- Verification: Preprocessor review and focused tests.
- Exceptions: A documented compiler intrinsic MAY require a different form.

### C-PP-CONDITION-001 [MUST]

Conditional compilation MUST use `#if defined(NAME)` or `#if !defined(NAME)`, and every branch and closing directive MUST identify its condition.

- Applies when: Adding `#if`, `#elif`, `#else`, or `#endif` blocks.
- Rationale: Explicit conditions are easier to audit in nested configuration code.
- Verification: Preprocessor review.
- Exceptions: None.

### C-PP-INCLUDE-001 [MUST]

Public headers MUST use a unique include guard, include only required dependencies, place standard headers before project headers, and wrap declarations in `extern \"C\"` when `__cplusplus` is defined.

- Applies when: Creating or changing headers.
- Rationale: Stable dependency boundaries and C++ linkage compatibility prevent integration failures.
- Verification: Compile C11 and C++ include smoke tests.
- Exceptions: Generated headers MAY follow generator conventions if equivalent protection exists.
