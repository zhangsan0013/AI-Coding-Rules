# C11 Public Interface Rules

Status: active

## Scope

Public headers, exported symbols, pointer and buffer contracts, ownership, status values, and documentation.

## Load when

Adding or changing a public header, exported symbol, or caller-visible contract.

## Rules

### C-API-DOC-001 [MUST]

Every added or changed public type, enumeration, macro, variable, and function MUST have a
Doxygen documentation block that states its purpose.

- Applies when: Adding or changing caller-visible declarations.
- Rationale: A documented declaration gives callers a stable explanation of what the symbol represents before they depend on its contract details.
- Verification (agent): Parse every changed public declaration and match it to a non-empty Doxygen block with purpose text. Pass when no changed public declaration is undocumented and every block identifies the declaration it describes; artifact: public-declaration coverage report.
- Verification (target): Using the project Doxyfile and warning policy recorded in `PROJECT_RULES.md` under `public-api-doc`, generate the declaration index for the changed headers. Pass when the CI wrapper exits zero with no undocumented changed public declaration or malformed documentation block; artifact: `PROJECT_RULES.md` snapshot, Doxygen log, and generated declaration index.
- Exceptions: Generated declarations MAY use their generator's documentation contract when the generator and output ownership are recorded.

Correct:

```c
/** @brief Starts the motor subsystem. */
motor_status_t motor_start(void);
```

Incorrect:

```c
motor_status_t motor_start(void); /* public declaration has no Doxygen block */
```

### C-API-DOC-FIELDS-001 [MUST]

Each applicable public parameter, return value, ownership condition, and error behavior MUST be stated in the declaration's Doxygen contract.

- Applies when: Adding or changing a public function or data declaration whose contract has parameters, a return status, ownership, or failure behavior.
- Rationale: Field-level contract details determine how callers allocate, use, release, and recover from the API; a purpose-only description cannot make those decisions safe.
- Verification (agent): Classify the applicable contract fields for every changed public declaration and compare them with its Doxygen tags or equivalent text. Pass when each applicable direction, return status, ownership, and error field has an explicit statement; artifact: declaration-contract field matrix.
- Verification (target): Using `WARN_NO_PARAMDOC=YES`, `WARN_IF_UNDOC_ENUM_VAL=YES`, and the CI wrapper recorded in `PROJECT_RULES.md` under `public-api-doc-fields` (including its parser for parameter, return, ownership, and error fields), generate documentation for the changed declarations. Pass when the wrapper reports no missing applicable field or malformed field documentation; artifact: `PROJECT_RULES.md` snapshot, Doxygen log, parser report, and declaration index.
- Exceptions: A field MAY be omitted only when the declaration has no such applicable behavior; the applicability decision and owner MUST be recorded in the project contract.

Correct:

```c
/**
 * @brief Copies one record into the caller-provided buffer.
 * @param[out] out Non-null destination owned by the caller and valid for one record.
 * @return MOTOR_STATUS_OK or MOTOR_STATUS_INVALID_ARGUMENT.
 * @note No bytes are written when the status is not MOTOR_STATUS_OK.
 */
motor_status_t motor_read(motor_record_t *out);
```

Incorrect:

```c
/** @brief Reads a record. */
motor_status_t motor_read(motor_record_t *out); /* direction, ownership, and errors are unstated */
```

### C-API-BUFFER-001 [MUST]

Pointer-based buffer parameters MUST document whether `NULL` is permitted.

- Applies when: Declaring APIs that accept or return pointer-based data.
- Rationale: An explicit nullability contract lets callers distinguish an empty buffer from an invalid pointer before dereference.
- Verification (agent): Check: inspect each pointer-based buffer declaration and its Doxygen contract; artifact: nullability table; pass: every buffer parameter explicitly states whether `NULL` is permitted and under which condition.
- Verification (target): Check: call the API with each required pointer set to `NULL` and with the documented empty-buffer case; artifact: null-boundary test log; pass: the observed status matches the documented nullability contract and no invalid dereference occurs.
- Exceptions: None.

Correct:

```c
/**
 * @param[out] out Null is allowed only when `capacity` is zero.
 */
motor_status_t motor_list(motor_item_t *out, size_t capacity, size_t *written);
```

Incorrect:

```c
/* Nullability is not stated. */
motor_status_t motor_list(motor_item_t *out, size_t capacity, size_t *written);
```

### C-API-BUFFER-002 [MUST]

Pointer-based buffer APIs MUST pair each input or output buffer with a `size_t` length or
capacity parameter.

- Applies when: Declaring an API that accepts or returns a pointer-based buffer.
- Rationale: A size tied to the pointer gives the implementation an explicit bound instead of relying on a sentinel or an out-of-band convention.
- Verification (agent): Check: inspect every pointer-based buffer declaration; artifact: buffer-size table; pass: each buffer has an associated `size_t` length or capacity with a documented relationship to that pointer.
- Verification (target): Check: call the API with zero, one, maximum, and maximum-plus-one units; artifact: boundary test log; pass: each size boundary returns the documented status and no access exceeds the supplied size.
- Exceptions: A fixed-size array type or an opaque handle MAY encode its size in the type when that contract is documented.

Correct:

```c
motor_status_t motor_list(motor_item_t *out, size_t capacity, size_t *written);
```

Incorrect:

```c
motor_status_t motor_list(motor_item_t *out, unsigned count);
```

### C-API-BUFFER-003 [MUST]

Pointer-based buffer contracts MUST state whether each size is measured in bytes or elements.

- Applies when: Documenting an API that accepts or returns a pointer-based buffer.
- Rationale: A byte-versus-element ambiguity can turn a numerically correct capacity into an overflow or truncated transfer.
- Verification (agent): Check: inspect the Doxygen contract for every pointer-based buffer; artifact: buffer-unit table; pass: the byte-versus-element unit is explicit for every buffer size.
- Verification (target): Check: exercise zero, partial, full, and over-capacity calls using both byte and element-sized fixtures; artifact: buffer-unit test log; pass: the implementation interprets each supplied size using the documented unit.
- Exceptions: A fixed-size opaque object MAY use a type-level size when the public type contract states it.

Correct:

```c
/**
 * @param[in] capacity Number of `motor_item_t` elements available in `out`.
 * @param[out] written Number of elements written to `out`.
 */
motor_status_t motor_list(motor_item_t *out, size_t capacity, size_t *written);
```

Incorrect:

```c
/** @param[in] count Buffer size. */
motor_status_t motor_list(void *out, unsigned count);
```

### C-API-BUFFER-004 [MUST]

Pointer-based output buffer contracts MUST state which output range is valid after the call.

- Applies when: Documenting an API that writes through a pointer-based output buffer.
- Rationale: A valid-range contract tells callers which bytes or elements are initialized and prevents stale data beyond the produced result from being consumed.
- Verification (agent): Check: inspect the Doxygen contract for every output buffer; artifact: output-range table; pass: each output buffer documents the valid range or an explicit zero-length result.
- Verification (target): Check: exercise zero, partial, full, and over-capacity calls; artifact: output-length and memory-check log; pass: the implementation writes only the documented output range and reports the documented length.
- Exceptions: A fixed-size output object MAY define its valid range in the public type contract.

Correct:

```c
/** @param[out] written Receives a value in the range [0, capacity]. */
motor_status_t motor_list(motor_item_t *out, size_t capacity, size_t *written);
```

Incorrect:

```c
/** @param[out] out Output buffer. */
motor_status_t motor_list(motor_item_t *out, size_t capacity, size_t *written);
```

### C-API-ERROR-001 [MUST]

Fallible APIs MUST return an explicit status type.

- Applies when: An operation can fail or produce a partial result.
- Rationale: An explicit status type makes failure propagation composable and prevents callers from guessing the meaning of an arbitrary return value.
- Verification (agent): Check: inspect every fallible declaration; artifact: fallible-API inventory; pass: each fallible API returns the project's declared status type.
- Verification (target): Check: inject a documented failure at each API boundary; artifact: API negative-path log; pass: the caller receives the declared status type and the failure is distinguishable from success.
- Exceptions: Platform adapters MAY translate an external error model at the boundary.

Correct:

```c
motor_status_t motor_start(void)
{
    if (!motor_hw_ready()) {
        return MOTOR_STATUS_NOT_READY;
    }
    return MOTOR_STATUS_OK;
}
```

Incorrect:

```c
void motor_start(void)
{
    (void)motor_hw_ready(); /* failure cannot reach the caller */
}
```

### C-API-ERROR-002 [MUST]

Callers of fallible APIs MUST inspect and handle the returned status.

- Applies when: Calling an API whose contract declares a failure status.
- Rationale: Ignoring a failure lets later code operate on an uninitialized, stale, or partially updated result.
- Verification (agent): Check: trace every call to a fallible API; artifact: status-use inventory; pass: each call tests or propagates the returned status before using dependent results.
- Verification (target): Check: inject a failure at each call site; artifact: caller state trace; pass: the caller takes the documented failure path and does not report apparent success.
- Exceptions: A wrapper MAY propagate a status directly when its own return contract is the same status.

Correct:

```c
if (motor_start() != MOTOR_STATUS_OK) {
    schedule_retry();
}
```

Incorrect:

```c
motor_start(); /* failure is ignored */
```

### C-API-ERROR-003 [MUST]

Library code MUST NOT encode an operation failure as an undocumented magic return value.

- Applies when: Returning from a fallible library operation.
- Rationale: An undocumented numeric sentinel can collide with valid data and forces every caller to reverse-engineer the error contract.
- Verification (agent): Check: inspect return statements in fallible APIs; artifact: return-contract table; pass: every failure return uses the declared status enumerator or documented status object.
- Verification (target): Check: inject each failure condition; artifact: negative-path output log; pass: the observed failure is the documented status, not an undocumented numeric sentinel.
- Exceptions: A platform adapter MAY translate an external numeric error at the adapter boundary when the mapping is documented.

Correct:

```c
return MOTOR_STATUS_NOT_READY;
```

Incorrect:

```c
return -1; /* undocumented magic failure value */
```

### C-API-ERROR-004 [MUST]

Library code MUST NOT use mutable global last-error state as the caller-visible failure
channel.

- Applies when: Reporting failure from a library operation.
- Rationale: Global error state is overwritten by unrelated calls and is difficult to preserve across interrupt, task, and nested-call boundaries.
- Verification (agent): Check: scan fallible library code for writes to global error variables; artifact: error-channel scan; pass: each caller-visible failure is returned or written through its documented output, with no mutable global last-error write.
- Verification (target): Check: interleave two failing calls from separate execution contexts; artifact: error-channel concurrency log; pass: each caller receives its own failure without reading shared last-error state.
- Exceptions: A platform adapter MAY mirror an external error model at the boundary when the library contract still returns an explicit status.

Correct:

```c
return MOTOR_STATUS_NOT_READY;
```

Incorrect:

```c
motor_last_error = MOTOR_STATUS_NOT_READY; /* shared implicit channel */
return MOTOR_STATUS_OK;
```

### C-API-ERROR-005 [MUST]

Library code MUST NOT print diagnostics while handling an operation failure.

- Applies when: Handling a failure inside reusable library code.
- Rationale: Printing imposes application-level policy on callers, can block, and may be unavailable on embedded targets.
- Verification (agent): Check: scan failure paths for output calls; artifact: forbidden-output scan; pass: failure paths return or propagate a status without printing.
- Verification (target): Check: inject each documented failure in a library build without a console; artifact: fault-injection log; pass: the library returns the documented failure without emitting output.
- Exceptions: A board-support or command-line adapter MAY log at an explicitly documented application boundary, not inside reusable library code.

Correct:

```c
return MOTOR_STATUS_NOT_READY;
```

Incorrect:

```c
printf("motor is not ready\\n");
```

### C-API-ERROR-006 [MUST]

Library code MUST NOT terminate the process while handling an operation failure.

- Applies when: Handling a failure inside reusable library code.
- Rationale: Process termination imposes application-level recovery policy on callers and is unavailable on many embedded targets.
- Verification (agent): Check: scan failure paths for process-termination calls; artifact: termination-call scan; pass: failure paths return or propagate a status without terminating the process.
- Verification (target): Check: inject each documented failure in a library build with a process supervisor; artifact: fault-injection and exit-status log; pass: the library reports the documented failure and the process remains under caller control.
- Exceptions: A command-line or application adapter MAY terminate at an explicitly documented application boundary, not inside reusable library code.

Correct:

```c
return MOTOR_STATUS_NOT_READY;
```

Incorrect:

```c
abort();
```

### C-API-NULL-001 [MUST]

Public APIs MUST validate required non-null pointer preconditions at their boundary before
dereferencing them.

- Applies when: Implementing public functions with pointer parameters.
- Rationale: Boundary checks make pointer contracts enforceable before an invalid caller value reaches a dereference.
- Verification (agent): Check: inspect each public implementation's pointer preconditions and dereference order; artifact: boundary-precondition checklist; pass: every required non-null pointer is rejected before its first dereference.
- Verification (target): Check: call each public API with every required pointer set to null and with valid boundary values; artifact: null-boundary test log; pass: null inputs return the documented invalid-argument status without a memory fault, and valid inputs complete normally.
- Exceptions: Internal functions MAY rely on a documented caller-established invariant.

Correct:

```c
motor_status_t motor_sum(const uint16_t *input, size_t count, uint32_t *out)
{
    if ((input == NULL) || (out == NULL)) {
        return MOTOR_STATUS_INVALID_ARGUMENT;
    }
    *out = (count == 0U) ? 0U : input[0];
    return MOTOR_STATUS_OK;
}
```

Incorrect:

```c
motor_status_t motor_sum(const uint16_t *input, size_t count, uint32_t *out)
{
    *out = input[0]; /* dereferences both pointers before validation */
    return MOTOR_STATUS_OK;
}
```

### C-API-NULL-002 [MUST]

Public API parameters that are only read through a pointer MUST be qualified with `const`.

- Applies when: Declaring or defining a public function with a pointer parameter that it does not modify.
- Rationale: `const` makes the read-only contract visible to the compiler and prevents accidental writes through the interface.
- Verification (agent): Check: compare each public pointer parameter's documented direction with its declaration; artifact: qualifier checklist; pass: every input-only pointed-to object uses `const` at the pointed-to type.
- Verification (target): Check: compile a caller that passes read-only storage and a fixture that attempts a write through the API; artifact: compiler diagnostics and const-boundary test log; pass: read-only storage is accepted and an unintended write is rejected or absent.
- Exceptions: An external ABI MAY omit `const` when the exact signature is fixed and the implementation proves it performs no write.

Correct:

```c
motor_status_t motor_sum(const uint16_t *input, size_t count, uint32_t *out);
```

Incorrect:

```c
motor_status_t motor_sum(uint16_t *input, size_t count, uint32_t *out);
```

### C-API-VOID-001 [SHOULD]

APIs SHOULD use `void *` or `const void *` only for genuinely generic objects, raw byte
regions, or opaque contexts.

- Applies when: Choosing pointer types for public data interfaces.
- Rationale: Generic pointers preserve reuse without discarding compile-time type checking when the object domain is intentionally generic.
- Verification (agent): Check: classify each `void *` parameter as a generic object, raw byte region, or opaque context; artifact: generic-pointer classification table; pass: every `void *` has one of those documented domains.
- Verification (target): Check: exercise each generic boundary with valid and invalid size, alignment, direction, and ownership cases; artifact: ABI/boundary test log; pass: the boundary rejects incompatible objects and preserves the documented size, alignment, direction, and ownership behavior.
- Exceptions: Platform or library ABIs MAY require a generic pointer contract.

### C-API-VOID-002 [SHOULD]

Typed data APIs SHOULD retain their specific pointer type instead of erasing it to `void *`.

- Applies when: Choosing pointer types for a public API that operates on a known data type.
- Rationale: Retaining the type lets the compiler catch incompatible callers before runtime.
- Verification (agent): Check: compare each typed data API's parameter type with its implementation contract; artifact: pointer-type review table; pass: a known data type is exposed with its specific pointer type unless a generic contract is recorded.
- Verification (target): Check: compile a caller that passes an incompatible pointer type; artifact: compiler diagnostics; pass: the typed interface rejects the incompatible pointer at compile time.
- Exceptions: A platform or library ABI MAY require `void *` when the generic contract is explicit.

Correct:

```c
motor_status_t motor_read(const motor_record_t *record);
```

Incorrect:

```c
motor_status_t motor_read(const void *record); /* known type is erased */
```

### C-API-DOCSTYLE-001 (Guidance; formerly [SHOULD])

Prefer backslash commands for public Doxygen tags and align descriptions from project column
22, with continuation text and member comments aligned consistently. This is presentation
guidance; `C-API-DOC-001` governs whether the contract is stated at all.

- Applies when: Writing public Doxygen documentation.
- Rationale: Stable alignment makes a header scannable, but the exact spelling and column are presentation choices.
- Exceptions: Generated documentation MAY follow its generator's formatting.

### C-API-LICENSE-001 [SHOULD]

Handwritten `.c` and `.h` files SHOULD carry a file-level Doxygen block.

- Applies when: Creating a handwritten `.c` or `.h` file.
- Rationale: A file-level ownership and purpose block gives maintainers a stable entry point without inventing legal facts.
- Verification (agent): Check: scan every new handwritten `.c` and `.h` file for the project file header template; artifact: documentation-header report; pass: each file has the required Doxygen block.
- Verification (target): Check: generate the project's source documentation; artifact: documentation-generation log; pass: every changed handwritten C file appears in the generated source index.
- Exceptions: Generated files MAY use their generator's header.

### C-API-LICENSE-002 [SHOULD]

Handwritten `.c` and `.h` files SHOULD carry the project's selected license and SPDX identifier,
or retain the unchanged template placeholder when no license is selected.

- Applies when: Creating or changing a handwritten `.c` or `.h` file.
- Rationale: Clear licensing supports reuse, while retaining the placeholder avoids inventing an owner or license the project has not chosen.
- Verification (agent): Check: scan each new handwritten C file against the recorded project license/header template; artifact: license-scan report; pass: the file has the selected license and SPDX identifier, or the unchanged project placeholder.
- Verification (target): Check: run the repository license scanner; artifact: scanner report; pass: all changed handwritten C files pass with no unknown or conflicting SPDX identifier.
- Exceptions: Generated files MAY use their generator's header.
