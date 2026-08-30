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
- Verification (agent): Confirm each caller-visible declaration documents purpose, parameter direction, return status, ownership, and error behavior. A fallible function with no documented failure result is a finding.
- Verification (target): Build the documentation and treat warnings as errors.
- Exceptions: None for handwritten public API.

### C-API-BUFFER-001 [MUST]

Pointer-based buffers MUST document nullability, pair input/output buffers with a `size_t` capacity or length, and state whether the unit is bytes or elements and which output range is valid.

- Applies when: Declaring APIs that accept or return pointer-based data.
- Rationale: Explicit bounds and nullability prevent overflow and ambiguous ownership.
- Verification (agent): Confirm each pointer parameter states nullability, is paired with a `size_t` capacity or length, names its unit, and that the output valid range is defined. A buffer parameter with no length is a finding.
- Verification (target): Run boundary tests at zero, one, and maximum length.
- Exceptions: None.

### C-API-ERROR-001 [MUST]

Fallible APIs MUST return an explicit status type, and callers MUST handle the result without magic error values, global last-error state, printing, or process termination in library code.

- Applies when: An operation can fail or produce a partial result.
- Rationale: Explicit propagation keeps failure behavior composable on embedded targets.
- Verification (agent): Confirm each fallible function returns an explicit status, and that library code neither prints, sets global last-error state, nor terminates. A magic in-band error value is a finding.
- Verification (target): Run the negative-path tests.
- Exceptions: Platform adapters MAY translate an external error model at the boundary.

### C-API-NULL-001 [MUST]

Public APIs MUST validate non-null pointer preconditions at their boundary and MUST qualify read-only pointed-to data with `const`.

- Applies when: Implementing public functions with pointer parameters.
- Rationale: Boundary checks make contracts enforceable while `const` protects caller data.
- Verification (agent): Confirm each public function validates its non-null preconditions at the boundary and qualifies read-only pointed-to data `const`.
- Verification (target): Run null and boundary tests.
- Exceptions: Internal functions MAY rely on a documented caller-established invariant.

### C-API-VOID-001 [SHOULD]

APIs SHOULD use `void *` or `const void *` only for genuinely generic objects, raw byte regions, or opaque contexts; typed data APIs MUST use the specific pointer type.

- Applies when: Choosing pointer types for public data interfaces.
- Rationale: Generic pointers preserve reuse without discarding compile-time type checking.
- Verification (agent): Confirm each `void *` parameter is genuinely generic, a raw byte region, or an opaque context, rather than a typed object whose type was erased.
- Verification (target): Review the size, alignment, direction, and ownership contract at the boundary.
- Exceptions: Platform or library ABIs MAY require a generic pointer contract.

### C-API-DOCSTYLE-001 [SHOULD]

Public Doxygen tags SHOULD use backslash commands and align descriptions from project column 22, with continuation text and member comments aligned consistently.

- Applies when: Writing public Doxygen documentation.
- Rationale: Stable alignment makes a header scannable. It is presentation, not contract; `C-API-DOC-001` governs whether the contract is stated at all.
- Verification (agent): Review new documentation blocks against the surrounding file.
- Verification (target): Doxygen lint where the project runs one.
- Exceptions: Generated documentation MAY follow its generator's formatting.

### C-API-LICENSE-001 [SHOULD]

Handwritten `.c` and `.h` files SHOULD carry a file-level Doxygen block followed by the project's license and SPDX identifier. Where no license is selected, the template placeholder MUST be retained rather than an invented one.

- Applies when: Creating a handwritten `.c` or `.h` file.
- Rationale: Clear licensing supports reuse, and it is checkable by a scanner rather than by review. The MUST clause is narrow and specific: inventing an owner or a license the project has not chosen misstates a legal fact, which is worse than leaving the placeholder.
- Verification (agent): Confirm a new file carries the header, and that any license named matches the project's recorded choice.
- Verification (target): License scanning in CI.
- Exceptions: Generated files MAY use their generator's header.
