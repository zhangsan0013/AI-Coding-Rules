# C11 Arithmetic Rules

Status: provisional

## Scope

Integer promotion, conversion, shifts, and overflow — the C semantics that decide what an
expression computes at a width the operands do not show.

## Load when

Editing C source that performs arithmetic, bit manipulation, or comparison.

## Why this module exists separately

Fixed-width types from `<stdint.h>` control storage, not arithmetic. Every operand narrower
than `int` is converted to `int` before an operator sees it, so `uint8_t` arithmetic is not
8-bit arithmetic and `uint16_t` shifts are not 16-bit shifts. The declared type is the thing
that looks reassuring and is not load-bearing.

## Rules

### C-ARITH-PROMOTE-001 [MUST]

An expression whose operands are narrower than `int` MUST NOT be assumed to compute at the
operand width. Where the width matters, the operands or the result MUST be converted
explicitly.

- Applies when: Performing arithmetic or bit manipulation on `uint8_t`, `uint16_t`, `int8_t`, `int16_t`, a bit-field, or a plain `char`.
- Rationale: The integer promotions convert every such operand to `int`. `uint8_t a = 200, b = 100; uint8_t sum = a + b;` computes 300 in `int` and then truncates to 44 — no diagnostic, and the declared type suggests the wrap was intended. In the other direction, `uint16_t crc = (crc << 8) ^ poly` promotes `crc` to `int`, shifts bits above 16 that the narrow type would have discarded, and folds them back in on assignment.
- Verification (agent): Check: inspect each arithmetic or shift expression whose operand is narrower than `int`; artifact: promotion/narrowing review table; pass: every width-sensitive intermediate has an explicit conversion or a sufficiently wide accumulator, and any intentional narrowing is documented at the conversion site.
- Verification (target): Check: build with `-Wconversion -Wsign-conversion` and exercise boundary operands; artifact: compiler log plus boundary test log; pass: no unintended narrowing diagnostic occurs and each remaining conversion matches the documented result.
- Exceptions: An expression whose intermediate result provably stays inside the operand's range needs no cast.

Correct:

```c
#include <stdint.h>

uint8_t saturating_add_u8(uint8_t a, uint8_t b)
{
    uint16_t sum = (uint16_t)a + (uint16_t)b;   /* stated width, not the promoted one */

    return (sum > 0xFFU) ? 0xFFU : (uint8_t)sum;
}

uint16_t crc16_step(uint16_t crc, uint8_t byte)
{
    /* Mask back to 16 bits: the shift happens in int and would otherwise keep bit 16. */
    return (uint16_t)(((uint16_t)(crc << 8) ^ crc16_table[(crc >> 8) ^ byte]));
}
```

Incorrect:

```c
#include <stdint.h>

uint8_t saturating_add_u8(uint8_t a, uint8_t b)
{
    uint8_t sum = a + b;   /* computed as int, then truncated: 200 + 100 becomes 44 */

    return (sum < a) ? 0xFFU : sum;   /* and the carry test cannot see the lost bit */
}
```

### C-ARITH-SHIFT-001 [MUST]

A shift count MUST be less than the width of the promoted left operand. A variable shift
count MUST be range checked before the shift executes.

- Applies when: Writing `<<` or `>>`, or building a mask with `1 << n`.
- Rationale: A count at or above the promoted operand width is undefined behavior, so `1u << 32` on a 32-bit operand is not a portable zero. The declared storage width does not change the promoted width used by the operator.
- Verification (agent): Check: inspect every variable and constant shift count and record the promoted left-operand width; artifact: shift-count table with bounds and source locations; pass: every count is less than the promoted width and every variable count is checked before the shift.
- Verification (target): Check: build with `-Wshift-count-overflow -Wshift-negative-value -Werror` at the project optimization level and exercise zero, width-minus-one, width, and width-plus-one counts; artifact: compiler log and shift boundary test log; pass: no shift-count diagnostic occurs and out-of-range counts are rejected or handled by the documented guard.
- Exceptions: A target-specific shift primitive MAY accept a wider count only when its API contract defines the masking or rejection behavior and that contract is recorded.

Correct:

```c
#include <stdint.h>

static uint32_t field_mask(unsigned width, unsigned shift)
{
    if ((width == 0U) || (width > 32U) || (shift >= 32U) || ((shift + width) > 32U)) {
        return 0U;
    }

    return (width == 32U) ? UINT32_MAX : (((UINT32_C(1) << width) - UINT32_C(1)) << shift);
}
```

Incorrect:

```c
#include <stdint.h>

#define UART_CR_ENABLE (1 << 31)   /* undefined: shifts into the sign bit of int */

static uint32_t field_mask(unsigned width, unsigned shift)
{
    /* Undefined when width is 32, and when shift is 32 or more. */
    return ((1 << width) - 1) << shift;
}
```

### C-ARITH-SHIFT-SIGN-001 [MUST]

A shift expression MUST NOT rely on implementation-defined sign extension: a right shift
of a potentially negative value MUST be rejected, normalized, or explicitly documented for
the target toolchain.

- Applies when: Right-shifting signed values or using a signed value as the left operand of a bit-pattern shift.
- Rationale: Right-shifting a negative signed value is implementation-defined, and a signed left operand can make a bit-pattern operation depend on the sign representation rather than the intended mask semantics.
- Verification (agent): Check: inspect every shift whose operand has a signed type or can contain a negative value; artifact: shift-signedness table and source locations; pass: each case rejects/normalizes negative values or cites the target-defined semantics before use.
- Verification (target): Check: compile with `-Wshift-negative-value -Werror` and exercise negative, zero, and maximum signed operands; artifact: compiler log and signed-shift boundary test log; pass: no undocumented sign extension is observed and every negative case follows the recorded result or rejection.
- Exceptions: A signed shift MAY be used when the project records the toolchain's defined sign-extension behavior, the affected width, and the review condition.

Correct:

```c
#include <stdint.h>

static uint32_t logical_shift_right(int32_t value, unsigned count)
{
    if (count >= 32U) {
        return 0U;
    }
    return (uint32_t)value >> count; /* normalize to unsigned before shifting */
}
```

Incorrect:

```c
static int32_t logical_shift_right(int32_t value, unsigned count)
{
    return value >> count; /* negative values may sign-extend by implementation choice */
}
```

### C-ARITH-SHIFT-MASK-001 [MUST]

A mask constant intended to set or test a top bit MUST use an unsigned constant with a
width at least as large as the destination field.

- Applies when: Defining register, protocol, or bit-field masks with a shift or hexadecimal constant.
- Rationale: `1 << 31` shifts a signed `int` into its sign bit, while a mask whose type is narrower than the destination can lose the intended bit before assignment.
- Verification (agent): Check: inspect each top-bit mask and record its destination width and constant type; artifact: mask-width table and source locations; pass: every mask uses an unsigned constant whose width covers the destination field.
- Verification (target): Check: compile with `-Wshift-overflow -Wsign-conversion -Werror` and read/write each masked top-bit field; artifact: compiler log and register-mask boundary test log; pass: no signed-shift diagnostic occurs and the observed mask sets only the documented destination bit.
- Exceptions: A generated mask MAY use a signed literal only when the generator's type and width proof is recorded and the generated output is checked.

Correct:

```c
#include <stdint.h>

#define UART_CR_ENABLE (UINT32_C(1) << 31)
```

Incorrect:

```c
#define UART_CR_ENABLE (1 << 31) /* signed int shift reaches the sign bit */
```

### C-ARITH-CONVERT-001 [MUST]

A comparison or assignment between a signed and an unsigned operand MUST NOT rely on the
implicit conversion. The signed value MUST be range-checked first, or both operands MUST be
brought to one signedness explicitly.

- Applies when: Comparing against a `size_t`, a length, a `sizeof` result, or any unsigned value; assigning between signed and unsigned types.
- Rationale: The usual arithmetic conversions convert the signed operand to unsigned, so a negative value becomes a very large one. `int i = -1; if (i < buffer_len)` is true for every `buffer_len`, because `-1` converts to `SIZE_MAX`. This is the standard mechanism behind a bounds check that passes and then indexes out of range.
- Verification (agent): Check: inspect each comparison or assignment crossing signedness and trace the signed operand's range check; artifact: signedness-conversion table; pass: a signed value is rejected before conversion when negative, or both operands are explicitly converted to the intended signedness, with no implicit range change.
- Verification (target): Check: build with `-Wsign-compare -Wsign-conversion -Werror` and run negative, zero, and maximum-value cases; artifact: compiler log and conversion boundary test log; pass: no unintended signedness diagnostic occurs and each boundary comparison/assignment matches the documented result.
- Exceptions: A comparison where the signed operand is a literal or is provably non-negative needs no separate check.

Correct:

```c
#include <stddef.h>
#include <stdbool.h>
#include <stdint.h>

bool read_at(const uint8_t *buffer, size_t length, int index, uint8_t *out)
{
    if ((index < 0) || ((size_t)index >= length)) {   /* negative rejected first */
        return false;
    }

    *out = buffer[(size_t)index];
    return true;
}
```

Incorrect:

```c
bool read_at(const uint8_t *buffer, size_t length, int index, uint8_t *out)
{
    size_t offset = (size_t)index; /* -1 becomes SIZE_MAX without a prior range check */
    if (offset < length) {
        *out = buffer[offset];
        return true;
    }
    return false;
}
```

### C-ARITH-OVERFLOW-001 [MUST]

A signed integer operation that can overflow MUST be prevented from overflowing by checking
its operands beforehand. The result MUST NOT be tested afterwards to detect it.

- Applies when: Adding, subtracting, multiplying, or negating signed values derived from input, a sensor, a counter, or a protocol field.
- Rationale: Signed overflow is undefined behavior, and the optimizer is entitled to assume it cannot happen. That makes the after-the-fact test unreliable in a specific way: `if (a + b < a)` is a test the compiler may delete outright, because it can only be true if overflow occurred, which it assumes it did not. Unsigned overflow is defined as wrapping and MAY be tested afterwards.
- Verification (agent): Check: inspect every signed add, subtract, multiply, and negate fed by non-constant input; artifact: overflow-precondition table; pass: each operation is preceded by a limit check using the correct `<limits.h>` bound, and no post-operation result comparison is used as the overflow detector.
- Verification (target): Check: build with `-fsanitize=signed-integer-overflow` or `-ftrapv` and exercise `MIN`, `MIN+1`, `MAX-1`, and `MAX` boundaries; artifact: sanitizer/trap log and boundary test log; pass: invalid operations are rejected before execution and valid operations complete without an overflow report.
- Exceptions: Unsigned arithmetic MAY rely on defined wrapping when the wrap is intended and commented, as in a tick counter difference.

Correct:

```c
#include <limits.h>
#include <stdbool.h>

bool add_checked(int a, int b, int *out)
{
    if ((b > 0) && (a > (INT_MAX - b))) {
        return false;
    }
    if ((b < 0) && (a < (INT_MIN - b))) {
        return false;
    }

    *out = a + b;
    return true;
}
```

Incorrect:

```c
bool add_checked(int a, int b, int *out)
{
    int sum = a + b;   /* already undefined if it overflows */

    if ((b > 0) && (sum < a)) {   /* the compiler may remove this test entirely */
        return false;
    }

    *out = sum;
    return true;
}
```

## Module examples

See the larger [compliant](../../examples/C-ARITH-PROMOTE-001/compliant.c) and
[violating](../../examples/C-ARITH-PROMOTE-001/violation.c) examples.
