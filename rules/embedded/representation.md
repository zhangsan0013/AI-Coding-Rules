# Data Representation Rules

Status: provisional

## Scope

The layout of data that crosses a boundary: wire protocols, stored records, and shared-memory
structures. Endianness, padding, alignment, and field width — everything that decides whether
two agents agree on the bytes.

## Load when

Defining or parsing a protocol message, a persisted record, or a structure shared with another
processor, image, or tool.

## Project facts this module depends on

- The byte order of each external interface, which need not match the CPU's.
- The alignment and packing the ABI applies to each structure the code overlays on bytes.
- The exact width and signedness of each field as the other end defines it.

Record these in `PROJECT_RULES.md`; the layout the compiler happens to choose is not the
contract.

## Rules

### EMB-REPR-SERIALIZE-001 [MUST]

Data that crosses a boundary MUST be serialized field by field with explicit byte order, not
by copying a structure's bytes or casting a byte buffer to a structure pointer.

- Applies when: Encoding or decoding a network packet, a bus frame, a file record, or a message shared with another processor.
- Rationale: A `struct` overlaid on bytes bakes in three of the current compiler's choices — padding between members, member alignment, and CPU byte order — none of which is part of the protocol. The same source produces different bytes on a different target, and `memcpy` of the struct sends the padding too. Field-by-field serialization with explicit shifts is the only form that is portable and reviewable against the spec.
- Verification (agent): Confirm each field is read or written with explicit byte operations against the documented order. A cast of a `uint8_t *` buffer to a message-struct pointer, or a `memcpy` between a struct and a wire buffer, is a finding.
- Verification (target): Test round-trips against a reference vector, and on a target of the opposite byte order where one exists.
- Exceptions: A structure MAY be copied whole when both ends are the same image and the layout is asserted with `_Static_assert`, or when a generated serializer owns the layout.

Correct:

```c
#include <stddef.h>
#include <stdint.h>

/* Wire order is big-endian, independent of this CPU. */
size_t encode_header(uint8_t *out, uint16_t id, uint32_t length)
{
    out[0] = (uint8_t)(id >> 8);
    out[1] = (uint8_t)(id & 0xFFU);
    out[2] = (uint8_t)(length >> 24);
    out[3] = (uint8_t)(length >> 16);
    out[4] = (uint8_t)(length >> 8);
    out[5] = (uint8_t)(length & 0xFFU);
    return 6U;
}
```

Incorrect:

```c
#include <stdint.h>

struct header {
    uint16_t id;
    uint32_t length;
};

size_t encode_header(uint8_t *out, uint16_t id, uint32_t length)
{
    struct header h = { id, length };

    /* Sends host byte order plus two padding bytes the protocol never defined. */
    __builtin_memcpy(out, &h, sizeof(h));
    return sizeof(h);
}
```

### EMB-REPR-ALIGN-001 [MUST]

Code MUST NOT read a multi-byte value through a pointer cast from a byte buffer unless the
target permits the resulting unaligned access. A field extracted from a buffer MUST be
assembled from its bytes instead.

- Applies when: Parsing a received buffer, indexing into a packet, or overlaying a type on data at a runtime offset.
- Rationale: `*(uint32_t *)(buf + 1)` is an unaligned read. On a core that faults on it, this is a hard fault at a byte-dependent offset; on one that permits it, the code is silently non-portable to one that does not. The byte-assembly form is both safe and byte-order-explicit, so it also satisfies `EMB-REPR-SERIALIZE-001`.
- Verification (agent): Find each cast of a `uint8_t *` (or `void *` over bytes) to a wider pointer type, and confirm the offset is provably aligned for the target or that unaligned access is recorded as supported. A cast at a runtime or odd offset is a finding.
- Verification (target): Build with alignment checking enabled and test the odd-offset case on the target.
- Exceptions: A cast MAY be used when the buffer's alignment is guaranteed and the offset is a multiple of the type's alignment, both recorded.

Correct:

```c
#include <stdint.h>

uint32_t read_be32(const uint8_t *p)
{
    return ((uint32_t)p[0] << 24) | ((uint32_t)p[1] << 16)
         | ((uint32_t)p[2] << 8)  | (uint32_t)p[3];
}
```

Incorrect:

```c
#include <stdint.h>

uint32_t read_be32(const uint8_t *p)
{
    /* Unaligned when p is not 4-byte aligned; faults on cores that require it. */
    return *(const uint32_t *)p;
}
```

### EMB-REPR-FIELD-001 [MUST]

A field that crosses a boundary MUST be represented with a fixed-width type, and a C
bit-field MUST NOT be used to describe an externally defined bit layout.

- Applies when: Declaring a protocol field, a register overlay, or any layout an external party defines.
- Rationale: `int`, `long`, and `enum` have implementation-defined width, so a field declared with one changes size between targets. Bit-fields are worse for external layout: the standard leaves allocation order, straddling, and the base type's signedness implementation-defined, so a bit-field struct describing a hardware register is not portable and often not even correct on the intended target. Extract bits with shifts and masks against a fixed-width value.
- Verification (agent): Confirm each boundary-crossing field uses an exact-width type, and that no `struct` with bit-fields overlays a register or wire format. A bit-field used for a hardware bit layout is a finding.
- Verification (target): Assert the size and, where the layout is a struct, offsets with `_Static_assert` for the target build.
- Exceptions: A bit-field MAY be used for state internal to one image whose layout no external party observes.

Correct:

```c
#include <stdint.h>

#define STATUS_READY_Pos   0U
#define STATUS_READY_Msk   (1U << STATUS_READY_Pos)
#define STATUS_ERR_Pos     1U
#define STATUS_ERR_Msk     (1U << STATUS_ERR_Pos)

static uint8_t status_ready(uint32_t status)
{
    return (uint8_t)((status & STATUS_READY_Msk) >> STATUS_READY_Pos);
}
```

Incorrect:

```c
struct status_bits {
    unsigned ready : 1;   /* bit position and base-type signedness are not portable */
    unsigned error : 1;
};

static int status_ready(struct status_bits s)
{
    return s.ready;
}
```

## Module examples

See the larger [compliant](../../examples/EMB-REPR-SERIALIZE-001/compliant.c) and
[violating](../../examples/EMB-REPR-SERIALIZE-001/violation.c) examples.
