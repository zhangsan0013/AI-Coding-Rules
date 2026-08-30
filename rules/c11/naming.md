# C11 Naming Rules

Status: active

## Scope

Names for C11 files, identifiers, public symbols, private symbols, macros, and types.

## Load when

Adding or renaming C identifiers or files.

## Rules

### C-NAME-RESERVED-001 [MUST]

Project-owned identifiers MUST NOT use a name the C standard or the project's libraries reserve.
The leading-underscore prohibition is a separate project policy that is stricter than the C
standard's scope-dependent reservation rules.

- Applies when: Naming any identifier, including a header guard macro.
- Rationale: The C standard reserves some underscore forms in every scope and reserves others
  only at file scope; the project-wide prohibition removes that scope classification from review.
  `_MOTOR_H_` as a header guard and `__motor_count` as an identifier are common collisions with
  toolchain internals that appear after a compiler upgrade.
- Verification (agent): Check: scan every new identifier and header guard against the C implementation-reserved-name patterns; artifact: identifier scan output or reviewed symbol list; pass: no new identifier uses a reserved spelling unless an exception record is linked.
- Verification (target): Check: classify the rule as source-only; artifact: review record; pass: target execution cannot change whether an identifier is reserved, so the agent-side scan is the complete evidence.
- Exceptions: An identifier fixed by an external ABI MAY be used when it is recorded.

Correct:

```c
#define MOTOR_CONTROL_H
static int motor_count;
```

Incorrect:

```c
#define _MOTOR_CONTROL_H_
int __motor_count;
```

### C-NAME-SNAKE-001 (Guidance; formerly [SHOULD])

Use lowercase `snake_case` for functions, variables, files, and non-macro types when creating
new names. This is guidance rather than a pass/fail compatibility constraint.

- Applies when: Naming C identifiers or files.
- Rationale: One spelling convention makes identifiers searchable, but the choice is project style rather than a project-independent correctness boundary.
- Exceptions: External ABI names and generated identifiers can retain their required spelling.

### C-NAME-LEADING-001 [MUST]

Project-owned identifiers MUST NOT begin with `_`.

- Applies when: Naming any project-owned identifier, including a header guard macro.
- Rationale: The project-wide prohibition removes scope-dependent review of implementation-reserved underscore forms and prevents collisions with toolchain internals.
- Verification (agent): Check: scan new identifiers and header guards for a leading underscore; artifact: identifier scan output or reviewed symbol list; pass: no project-owned identifier begins with `_` unless an exception record is linked.
- Verification (target): Check: classify the rule as source-only; artifact: review record; pass: target execution cannot change whether an identifier begins with `_`, so the agent-side scan is the complete evidence.
- Exceptions: An identifier fixed by an external ABI MAY be used when it is recorded.

Correct:

```c
#define MOTOR_CONTROL_H
static int motor_count;
```

Incorrect:

```c
#define _MOTOR_CONTROL_H_
int motor_count;
```

### C-NAME-SCOPE-001 [MUST]

A function or object not used outside its translation unit MUST be declared `static`.

- Applies when: Defining a file-scope function or object that is not referenced outside its translation unit.
- Rationale: Without `static`, every definition has external linkage, so two files that each define `buffer_init` produce either a link error or — with a mismatched signature and no prototype in scope — a silent call to the wrong one.
- Verification (agent): Check: inspect every file-scope definition and classify whether it is used outside its translation unit; artifact: linkage inventory; pass: each translation-unit-only definition is declared `static`.
- Verification (target): Check: build with `-Wmissing-prototypes` and inspect the linker symbol table; artifact: build log and `nm`/map output; pass: no translation-unit-only definition is emitted as an unintended external symbol.
- Exceptions: A file-scope symbol referenced by startup code or a linker script MAY remain externally linked when that dependency is recorded.

Correct:

```c
/* motor.c */
static void motor_reset(void) {}

static int motor_ticks;
```

Incorrect:

```c
/* motor.c */
void reset(void) {} /* file-local helper is missing static */
```

### C-NAME-EXPORT-001 [MUST]

An external symbol MUST carry a project or module prefix.

- Applies when: Declaring or defining a symbol that is intentionally visible outside its translation unit.
- Rationale: A project or module prefix prevents collisions with third-party code and other library components.
- Verification (agent): Check: inspect every exported declaration and definition; artifact: exported-symbol inventory; pass: every intentional external symbol begins with the recorded project or module prefix.
- Verification (target): Check: inspect the linker symbol table after a complete build; artifact: `nm`/map output; pass: every exported project symbol is prefixed and no unprefixed project symbol is emitted.
- Exceptions: Names fixed by an external ABI MAY be recorded as exceptions.

Correct:

```c
void motor_start(void);
void motor_start(void) {}
```

Incorrect:

```c
void start(void) {}
```

### C-NAME-CONST-001 (Guidance; formerly [SHOULD])

Prefer `UPPER_SNAKE_CASE` with a module prefix for macros and enumeration constants, and a
descriptive suffix for public typedefs. These naming conventions are guidance, not a stable
compatibility constraint.

- Applies when: Defining macros, enumerators, or public types.
- Rationale: The case distinction warns a reader that an identifier may not obey function or object semantics. The prefix matters more than the case: an unprefixed `TIMEOUT` macro collides silently with any header that defines the same name.
- Exceptions: External ABI names and generated identifiers can retain their required spelling.

The former `C-NAME-CONST-001` requirement was demoted because its case and suffix choices do
not have a project-independent pass/fail boundary. The collision-prevention part remains
covered by `C-NAME-SCOPE-001`.
