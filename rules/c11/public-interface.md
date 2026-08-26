# C11 Public Interface Rules

Status: active

## Scope

Public headers, exported symbols, pointer and buffer contracts, ownership, status values, and documentation.

## Load when

Adding or changing a public header, exported symbol, or caller-visible contract.

## Rules

### C-API-DOC-001 [MUST]

Public types, enumerations, macros, variables, and functions MUST have Doxygen documentation that states purpose and, where applicable, parameter direction, return status, ownership, and error behavior.

- Applies when: Adding or changing caller-visible declarations.
- Rationale: The header is the durable contract between modules and callers.
- Verification: Review and Doxygen warnings.
- Exceptions: None for handwritten public API.

### C-API-BUFFER-001 [MUST]

Pointer-based buffers MUST document nullability, pair input/output buffers with a `size_t` capacity or length, and state whether the unit is bytes or elements and which output range is valid.

- Applies when: Declaring APIs that accept or return pointer-based data.
- Rationale: Explicit bounds and nullability prevent overflow and ambiguous ownership.
- Verification: Review and boundary tests.
- Exceptions: None.

### C-API-ERROR-001 [MUST]

Fallible APIs MUST return an explicit status type, and callers MUST handle the result without magic error values, global last-error state, printing, or process termination in library code.

- Applies when: An operation can fail or produce a partial result.
- Rationale: Explicit propagation keeps failure behavior composable on embedded targets.
- Verification: Review, compiler warnings, and negative-path tests.
- Exceptions: Platform adapters MAY translate an external error model at the boundary.

### C-API-NULL-001 [MUST]

Public APIs MUST validate non-null pointer preconditions at their boundary and MUST qualify read-only pointed-to data with `const`.

- Applies when: Implementing public functions with pointer parameters.
- Rationale: Boundary checks make contracts enforceable while `const` protects caller data.
- Verification: Review and null/boundary tests.
- Exceptions: Internal functions MAY rely on a documented caller-established invariant.

### C-API-VOID-001 [SHOULD]

APIs SHOULD use `void *` or `const void *` only for genuinely generic objects, raw byte regions, or opaque contexts; typed data APIs MUST use the specific pointer type.

- Applies when: Choosing pointer types for public data interfaces.
- Rationale: Generic pointers preserve reuse without discarding compile-time type checking.
- Verification: Review of data semantics, size, alignment, direction, and ownership.
- Exceptions: Platform or library ABIs MAY require a generic pointer contract.

### C-API-DOCSTYLE-001 [MUST]

Public Doxygen tags MUST use backslash commands and align descriptions from project column 22, with continuation text and structure-member comments aligned consistently.

- Applies when: Writing public Doxygen documentation.
- Rationale: Stable alignment makes contracts easy to scan and keeps generated documentation consistent.
- Verification: Review or Doxygen lint.
- Exceptions: Generated documentation MAY follow its generator's formatting.

### C-API-LICENSE-001 [MUST]

Handwritten C source and header files MUST contain a file-level Doxygen block followed by the project's license and SPDX identifier; when no license is selected, the template placeholder MUST be retained rather than inventing ownership.

- Applies when: Creating handwritten `.c` or `.h` files.
- Rationale: Clear licensing and ownership are required for safe reuse.
- Verification: Review and license scanning.
- Exceptions: Generated files MAY use their generator's license header.
