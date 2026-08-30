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
- Verification (agent): For each arithmetic or shift expression on a narrow type, decide whether the intermediate result can leave the operand's range. Where it can, require an explicit cast to the intended width, or an accumulator declared at least as wide as the intermediate. An expression relying on the assignment back to a narrow type for truncation is a finding unless the truncation is commented as intended.
- Verification (target): Build with `-Wconversion` and confirm each remaining narrowing is deliberate.
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

A shift operand MUST be unsigned, and the shift count MUST be less than the width of the
promoted operand. A bit mask constant intended to reach the top bit MUST carry an unsigned
suffix.

- Applies when: Writing `<<` or `>>`, or building a mask with `1 << n`.
- Rationale: `1 << 31` shifts into the sign bit of a signed `int`, which is undefined behavior; the constant must be `1u << 31`. Register masks are where this appears most, and it usually works until the optimization level changes. Right-shifting a negative value is implementation-defined, so a sign-extending shift is not portable. A count at or above the operand width is undefined regardless of sign, which is why `1u << 32` on a 32-bit `int` is not zero but anything.
- Verification (agent): Check each shift for an unsigned left operand and a count below the promoted width. `1 <<` reaching bit 31 or above is a finding; so is a right shift of a signed value, and a variable count with no bound on it.
- Verification (target): Build with `-Wshift-count-overflow -Wshift-negative-value`, and at the project optimization level, where the compiler may exploit the undefined case.
- Exceptions: An arithmetic right shift MAY be used where the project records that the toolchain defines it as sign-extending.

Correct:

```c
#include <stdint.h>

#define UART_CR_ENABLE (1UL << 31)   /* unsigned: no shift into a sign bit */

static uint32_t field_mask(unsigned width, unsigned shift)
{
    /* Both counts are bounded before use. */
    if ((width == 0U) || (width > 32U) || (shift >= 32U) || ((shift + width) > 32U)) {
        return 0U;
    }

    return (width == 32U) ? 0xFFFFFFFFUL : (((1UL << width) - 1UL) << shift);
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

### C-ARITH-CONVERT-001 [MUST]

A comparison or assignment between a signed and an unsigned operand MUST NOT rely on the
implicit conversion. The signed value MUST be range-checked first, or both operands MUST be
brought to one signedness explicitly.

- Applies when: Comparing against a `size_t`, a length, a `sizeof` result, or any unsigned value; assigning between signed and unsigned types.
- Rationale: The usual arithmetic conversions convert the signed operand to unsigned, so a negative value becomes a very large one. `int i = -1; if (i < buffer_len)` is true for every `buffer_len`, because `-1` converts to `SIZE_MAX`. This is the standard mechanism behind a bounds check that passes and then indexes out of range.
- Verification (agent): Find each comparison mixing signedness and confirm the signed side cannot be negative at that point, or that the check rejects negatives first. A loop counter declared `int` compared against a `size_t` length is a finding.
- Verification (target): Build with `-Wsign-compare -Wsign-conversion`.
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
    if (index >= length) {   /* index converts to unsigned: -1 becomes SIZE_MAX... */
        return false;        /* ...so this rejects it, but -1 < length would not */
    }

    *out = buffer[index];    /* and any other negative index reads out of range */
    return true;
}
```

### C-ARITH-OVERFLOW-001 [MUST]

A signed integer operation that can overflow MUST be prevented from overflowing by checking
its operands beforehand. The result MUST NOT be tested afterwards to detect it.

- Applies when: Adding, subtracting, multiplying, or negating signed values derived from input, a sensor, a counter, or a protocol field.
- Rationale: Signed overflow is undefined behavior, and the optimizer is entitled to assume it cannot happen. That makes the after-the-fact test unreliable in a specific way: `if (a + b < a)` is a test the compiler may delete outright, because it can only be true if overflow occurred, which it assumes it did not. Unsigned overflow is defined as wrapping and MAY be tested afterwards.
- Verification (agent): For each signed operation on values not provably bounded, confirm the check precedes the operation and is expressed against the type's limits from `<limits.h>`. A post-hoc comparison of the result against an operand is a finding.
- Verification (target): Build with `-fsanitize=signed-integer-overflow` where the target supports it, or `-ftrapv` for a debug build, and exercise the boundary inputs.
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
