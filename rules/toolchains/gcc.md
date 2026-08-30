# GCC Toolchain Rules

Status: provisional

## Scope

GCC-specific extensions, attributes, diagnostics, optimization, and link-time behavior
independent of the target architecture. Architecture ABI rules and project-specific linker
or startup facts belong in their respective modules or `PROJECT_RULES.md`.

## Load when

Changing GCC-specific build flags, attributes, diagnostics, extensions, ABI-sensitive code,
or link-time optimization behavior.

## Project facts this module depends on

- The exact GCC version, target triple, language standard, binutils/linker, and reproducible
  build flags used by every translation unit and link step.
- The warning, optimization, sanitizer, section, LTO, and freestanding-library policy.
- The target-specific meaning and constraints of every GCC extension or attribute in use.

Record these in `PROJECT_RULES.md` and the build configuration.

## Rules

### TOOL-GCC-WARN-001 [MUST]

The build MUST select and record its diagnostic policy, and a warning introduced by a
changed path MUST be fixed or explicitly reviewed rather than silently suppressed.

- Applies when: Adding code, changing warning flags, adding pragmas, or introducing a compiler diagnostic exception.
- Rationale: Warnings are part of the evidence boundary; a local suppression can hide undefined behavior or an ABI mismatch from the build.
- Verification (agent): Confirm the change introduces no new diagnostic under the project's recorded flag set, and that no warning is suppressed by a local pragma without a recorded reason.
- Verification (target): Build the full configuration matrix with the recorded flags and compare the diagnostic count.
- Exceptions: A suppression MAY be used only for a documented compiler defect or intentional construct with an owner, scope, removal condition, and compensating check.

### TOOL-GCC-OPT-001 [MUST]

Code MUST not depend on an optimization level, undefined behavior, or implementation detail
that is not selected and verified in the project build contract.

- Applies when: Relying on timing, object layout, volatile access, signed overflow, aliasing, dead-code removal, or generated instruction sequences.
- Rationale: GCC is allowed to transform code according to the language and flags; a debug build that happens to work does not establish a release-build contract.
- Verification (agent): Confirm no behavior depends on an optimization level, on evaluation order the standard leaves unspecified, or on undefined behavior the optimizer may exploit. Strict-aliasing violations through pointer casts and signed overflow are the common cases.
- Verification (target): Build at the project level and at `-O0`, and compare behavior.
- Exceptions: A target-specific implementation dependency MAY be used when its GCC version, flags, generated behavior, and replacement plan are recorded.

### TOOL-GCC-ATTR-001 [MUST]

A GCC attribute or extension affecting calling convention, placement, alignment, packing,
interrupt entry, retention, or code generation MUST be supported by the selected target
and MUST have a verified declaration and build use.

- Applies when: Using `interrupt`, `section`, `used`, `retain`, `packed`, `aligned`, `noinline`, or other target-sensitive attributes.
- Rationale: Attributes can alter ABI, storage, access, or reachability without a corresponding source-level type change.
- Verification (agent): Confirm each attribute affecting convention, placement, alignment, packing, or visibility is one the recorded compiler version supports, and that a build-time check proves the resulting property.
- Verification (target): Inspect the object metadata and linker map for the target build.
- Exceptions: A project wrapper MAY abstract an attribute when it verifies the selected compiler, target, and fallback behavior.

### TOOL-GCC-ABI-001 [MUST]

All translation units and libraries participating in one link MUST agree on the language,
ABI, target, floating-point, structure-layout, and relevant code-generation options.

- Applies when: Mixing prebuilt libraries, C/C++ boundaries, changing target flags, or changing compiler versions.
- Rationale: ABI disagreement can produce a successful link with corrupted parameters, layout, or register state at runtime.
- Verification (agent): Confirm every translation unit and library in the link agrees on language standard, ABI options, floating-point mode, and structure packing. A packed structure visible to only some units is a finding.
- Verification (target): Compare the flags across the build and link, and test a cross-object call that passes an affected type.
- Exceptions: A deliberate mixed-ABI boundary MAY exist only behind a reviewed adapter that proves conversion and ownership of all values.

### TOOL-GCC-LTO-001 [MUST]

When link-time optimization, section garbage collection, or identical-code folding is
enabled, every required entry point, registration object, vector, and retained section MUST
have a verified reachability or retention contract.

- Applies when: Enabling LTO, `--gc-sections`, startup registration, linker scripts, vectors, plugins, or callback tables.
- Rationale: Whole-program optimization can remove or merge code that is reachable only through a linker, hardware, or registration contract.
- Verification (agent): Confirm objects the linker cannot see a reference to — vectors, startup code, sections placed by the linker script — are retained through `KEEP`, `used`, or the recorded equivalent. Reliance on a definition surviving section garbage collection is a finding.
- Verification (target): Inspect the map file for the retained symbols and test the image on the target after LTO and garbage collection.
- Exceptions: A symbol MAY rely on an explicit linker retention mechanism when the linker script and post-link check prove it.

## Module examples

See the larger [compliant](../../examples/TOOL-GCC-LTO-001/compliant.c) and
[violating](../../examples/TOOL-GCC-LTO-001/violation.c) examples.

Correct:

```c
/* The build owns this macro and verifies it for every supported GCC target. */
#if defined(PROJECT_GCC_TARGET)
__attribute__((used, section(".isr_vectors")))
#endif
extern void project_startup(void);

void reset_vector(void)
{
    project_startup();
}
```

Incorrect:

```c
/* The linker may discard this registration object when only a string is visible. */
extern void project_driver_init(void);

static void register_driver(void)
{
    project_driver_init();
}
```
