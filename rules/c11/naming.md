# C11 Naming Rules

Status: active

## Scope

Names for C11 files, identifiers, public symbols, private symbols, macros, and types.

## Load when

Adding or renaming C identifiers or files.

## Rules

### C-NAME-RESERVED-001 [MUST]

An identifier MUST NOT begin with an underscore, and MUST NOT use a name the C standard or the project's libraries reserve.

- Applies when: Naming any identifier, including a header guard macro.
- Rationale: Names beginning with an underscore followed by an uppercase letter, and all names beginning with two underscores, are reserved to the implementation in every scope. Using one is undefined behavior, and the usual symptom is a collision with a toolchain internal that appears only after a compiler upgrade. `_MOTOR_H_` as a header guard is the common instance.
- Verification (agent): Check new identifiers for a leading underscore, and header guards in particular.
- Verification (target): None; this is a source property.
- Exceptions: An identifier fixed by an external ABI MAY be used when it is recorded.

### C-NAME-SNAKE-001 [SHOULD]

Functions, variables, files, and non-macro types SHOULD use lowercase `snake_case`.

- Applies when: Naming C identifiers or files.
- Rationale: One spelling convention makes identifiers searchable. Which convention is arbitrary, which is why this is a SHOULD while `C-NAME-RESERVED-001` is not.
- Verification (agent): Review new identifiers against the surrounding file.
- Verification (target): Naming lint where the project runs one.
- Exceptions: External ABI names and generated identifiers MAY retain their required spelling.

### C-NAME-SCOPE-001 [MUST]

A function or object not used outside its translation unit MUST be declared `static`. An external symbol MUST carry a project or module prefix.

- Applies when: Defining exported or private functions, variables, or types.
- Rationale: Without `static`, every definition has external linkage, so two files that each define `buffer_init` produce either a link error or — with a mismatched signature and no prototype in scope — a silent call to the wrong one. The prefix requirement prevents the same collision against third-party code.
- Verification (agent): Check each file-scope definition not declared in a header for `static`, and each exported symbol for the module prefix.
- Verification (target): Build with `-Wmissing-prototypes` and review the linker symbol table for unprefixed external symbols.
- Exceptions: Names fixed by an external ABI MAY be recorded as exceptions.

### C-NAME-CONST-001 [SHOULD]

Macros and enumeration constants SHOULD use `UPPER_SNAKE_CASE` with a module prefix, and `typedef` names SHOULD use a descriptive `_t` suffix.

- Applies when: Defining macros, enumerators, or public types.
- Rationale: The case distinction warns a reader that an identifier may not obey function or object semantics. The prefix matters more than the case: an unprefixed `TIMEOUT` macro collides silently with any header that defines the same name.
- Verification (agent): Review new macros and enumerators for the module prefix.
- Verification (target): Naming lint where the project runs one.
- Exceptions: POSIX reserves `_t` for its own type names; a project targeting a POSIX system MAY use another suffix.
