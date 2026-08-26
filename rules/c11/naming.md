# C11 Naming Rules

Status: active

## Scope

Names for C11 files, identifiers, public symbols, private symbols, macros, and types.

## Load when

Adding or renaming C identifiers or files.

## Rules

### C-NAME-SNAKE-001 [MUST]

Functions, variables, files, and non-macro types MUST use lowercase `snake_case`; reserved leading underscores MUST NOT be used.

- Applies when: Naming C identifiers or files.
- Rationale: One predictable spelling convention improves searchability and avoids reserved namespaces.
- Verification: Review and naming lint.
- Exceptions: External ABI names and generated identifiers MAY retain their required spelling.

### C-NAME-SCOPE-001 [MUST]

External symbols MUST carry a project or module prefix, and file-private symbols MUST have internal linkage with `static`.

- Applies when: Defining exported or private functions, variables, or types.
- Rationale: Prefixes prevent link collisions and `static` makes ownership enforceable by the compiler.
- Verification: Linker symbol review and compiler diagnostics.
- Exceptions: Names fixed by an external ABI MAY be documented as exceptions.

### C-NAME-CONST-001 [MUST]

Macros and enumeration constants MUST use `UPPER_SNAKE_CASE` with a module prefix, while `typedef` names MUST use a descriptive `_t` suffix.

- Applies when: Defining macros, enumerators, or public types.
- Rationale: Visual distinction prevents accidental misuse and makes public vocabulary consistent.
- Verification: Review or naming lint.
- Exceptions: None for new code.
