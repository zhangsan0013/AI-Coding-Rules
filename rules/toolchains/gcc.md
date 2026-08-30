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
- Verification (agent): Build the changed path with the recorded warning flags and scan for new diagnostics or local suppressions. Pass when the diagnostic diff is zero or each suppression has owner, scope, reason, and compensating check; artifact: compiler log and diagnostic diff.
- Verification (target): Build every supported configuration with the recorded flags. Pass when no new warning appears relative to the baseline and the build exits successfully under the warning policy; artifact: matrix logs and flag manifest.
- Exceptions: A suppression MAY be used only for a documented compiler defect or intentional construct with owner, scope, removal condition, and compensating check recorded.

Correct:

```c
/* The build treats -Wall -Wextra -Werror as the recorded diagnostic policy. */
int parse_count(const char *text)
{
    return text == 0 ? 0 : (int)text[0];
}
```

Incorrect:

```c
#pragma GCC diagnostic ignored "-Wconversion" /* no owner or removal condition */
int parse_count(unsigned value) { return value; }
```

### TOOL-GCC-OPT-001 [MUST]

Code MUST not depend on an optimization level, undefined behavior, or implementation detail
that is not selected and verified in the project build contract.

- Applies when: Relying on timing, object layout, volatile access, signed overflow, aliasing, dead-code removal, or generated instruction sequences.
- Rationale: GCC is allowed to transform code according to the language and flags; a debug build that happens to work does not establish a release-build contract.
- Verification (agent): Scan the changed path for undefined behavior, unspecified evaluation order, strict-aliasing violations, and optimization-dependent timing/layout assumptions. Pass when the behavior is defined by the selected language/build contract; artifact: static-analysis report and flag manifest.
- Verification (target): Build and run the same boundary cases at the project optimization level and `-O0`. Pass when externally observable results and error outcomes match for all cases; artifact: paired test logs and compiler flags.
- Exceptions: A target-specific implementation dependency MAY be used only when GCC version, flags, generated behavior, owner, and replacement plan/review condition are recorded.

Correct:

```c
#include <stdint.h>

uint32_t add(uint32_t left, uint32_t right)
{
    return left + right; /* defined unsigned wrap, independent of -O level */
}
```

Incorrect:

```c
int add(int left, int right)
{
    return left + right; /* signed overflow is undefined and optimizer-dependent */
}
```

### TOOL-GCC-ATTR-001 [MUST]

Each target-sensitive GCC attribute or extension MUST be supported by the selected compiler,
target, and language/build configuration.

- Applies when: Using `interrupt`, `section`, `used`, `retain`, `packed`, `aligned`, `noinline`, or other target-sensitive attributes.
- Rationale: An accepted attribute spelling does not prove that the selected target implements its required calling convention, storage, or code-generation semantics.
- Verification (agent): Inventory each target-sensitive attribute and match it to compiler-version, target-triple, language-standard, and build-flag support. Pass when unsupported combinations fail the build or select the recorded fallback; artifact: attribute capability table, compiler output, and build manifest.
- Verification (target): Build each affected translation unit for the exact `PROJECT_RULES.md` compiler/target tuple, plus a negative unsupported combination where available. Pass when supported combinations build and unsupported combinations fail or select the documented fallback in 100% of builds; artifact: compiler logs, target tuple, and configuration snapshot.
- Exceptions: A project wrapper MAY abstract an attribute only when compiler, target, fallback behavior, owner, and review condition are recorded.

Correct:

```c
#include <stdint.h>

__attribute__((aligned(32), section(".dma")))
static uint8_t dma_buffer[128];

/* The selected compiler/target tuple documents aligned and section support. */
```

Incorrect:

```c
/* The selected target does not support interrupt entry with this attribute, and the build
   has no capability check or recorded fallback. */
__attribute__((interrupt)) static void dma_isr(void)
{
}
```

### TOOL-GCC-ATTR-EFFECT-001 [MUST]

The intended storage, alignment, calling-convention, packing, or retention effect of each
target-sensitive GCC attribute MUST be proven in post-build artifacts.

- Applies when: An attribute changes symbol placement, alignment, ABI, access layout, reachability, or generated entry/exit code.
- Rationale: A compiler accepting an attribute does not prove that the linker, object format, or target ABI produced the property the code relies on.
- Verification (agent): For each attribute use, state the intended observable property and the object or map artifact that proves it. Pass when every affected symbol has a post-build proof rather than a source comment or declaration alone; artifact: attribute-effect table and proof-command record.
- Verification (target): Using the `PROJECT_RULES.md` `gcc-attribute-effect` configuration, inspect object metadata, disassembly, and linker map for every affected symbol or section. Pass when each recorded property equals the expected alignment, placement, ABI, packing, or retention value with zero missing symbols; artifact: `readelf`/map/disassembly output and configuration snapshot.
- Exceptions: A source-level assertion MAY supplement but not replace post-build proof; an alternative proof is allowed only when its artifact, owner, tool version, and review condition are recorded.

Correct:

```c
__attribute__((aligned(32), section(".dma")))
static uint8_t dma_buffer[128];

/* Post-build checks prove .dma placement and 32-byte alignment in the map/object file. */
```

Incorrect:

```c
__attribute__((section(".dma")))
static uint8_t dma_buffer[128];

/* The attribute is accepted, but no object or linker output proves placement or alignment. */
```

### TOOL-GCC-ABI-001 [MUST]

All translation units and libraries participating in one link MUST use one recorded
language/ABI/target option tuple, or cross a named adapter that owns every intentional
conversion.

- Applies when: Mixing prebuilt libraries, C/C++ boundaries, changing target flags, or changing compiler versions.
- Rationale: ABI disagreement can produce a successful link with corrupted parameters, layout, or register state at runtime.
- Verification (agent): Inventory every translation unit/library and compare language standard, ABI, target, floating-point mode, packing, and relevant code-generation flags. Pass when all agree or a named adapter owns every conversion; artifact: link manifest and object attribute diff.
- Verification (target): Compare flags across compilation/link and run a cross-object call passing affected structs, enums, pointers, and floating-point values. Pass when values/layout/register state match the reference; artifact: metadata dump, disassembly, and test log.
- Exceptions: A mixed-ABI boundary MAY exist only behind a reviewed adapter proving conversion and ownership of all values, with owner and review condition recorded.

Correct:

```text
All objects: arm-none-eabi-gcc, -mfloat-abi=soft, -mabi=aapcs, -fno-short-enums.
```

Incorrect:

```text
Application: -mfloat-abi=soft; prebuilt library: -mfloat-abi=hard.
```

### TOOL-GCC-LTO-001 [MUST]

When link-time optimization, section garbage collection, or identical-code folding is
enabled, every required entry point, registration object, vector, and retained section MUST
have a verified reachability or retention contract.

- Applies when: Enabling LTO, `--gc-sections`, startup registration, linker scripts, vectors, plugins, or callback tables.
- Rationale: Whole-program optimization can remove or merge code that is reachable only through a linker, hardware, or registration contract.
- Verification (agent): Inventory vector, startup, registration, callback, and retained-section entry points with no ordinary reference, then match each to `KEEP`, `used`, `retain`, or equivalent. Pass when every required symbol has a retention proof; artifact: retention table and linker-script scan.
- Verification (target): Inspect the LTO/GC map for retained symbols and boot/run the image with those options enabled. Pass when every required entry point is present and callable after optimization; artifact: map excerpt, symbol dump, and smoke-test log.
- Exceptions: A symbol MAY rely on explicit linker retention only when the linker script and post-link check prove it, with owner and review condition recorded.

Correct:

```c
__attribute__((used, section(".isr_vectors")))
static void (*const reset_entry)(void) = project_startup;
/* The linker script retains .isr_vectors with KEEP. */
```

Incorrect:

```c
static void register_driver(void)
{
    project_driver_init(); /* no root reference or retention proof under --gc-sections */
}
```

## Module examples

See the larger [compliant](../../examples/TOOL-GCC-LTO-001/compliant.c) and
[violating](../../examples/TOOL-GCC-LTO-001/violation.c) examples.

Correct:

```c
typedef void (*entry_point_t)(void);
extern void project_startup(void);

__attribute__((used, section(".isr_vectors")))
static entry_point_t const reset_entry = project_startup;
/* The linker script contains KEEP(*(.isr_vectors)); the post-link check verifies the symbol. */
```

Incorrect:

```c
/* No root reference or retention attribute keeps this registration function. */
extern void project_driver_init(void);

static void register_driver(void)
{
    project_driver_init();
}
```
