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
- Verification (agent): Inventory each boundary field and match its encode/decode operations to the documented byte order; reject struct casts and struct-to-buffer copies. Pass when every field has an explicit byte operation or a verified generator owns it; artifact: field layout table and source scan.
- Verification (target): Using the `PROJECT_RULES.md` `wire-serialization` configuration, run round-trips against reference vectors and, where available, an opposite-endian target. Pass when every vector produces identical bytes and decoding returns the original field values in 100% of cases; artifact: vector log, serialized byte dump, and configuration snapshot.
- Exceptions: A structure MAY be copied whole only when both ends are the same image and `_Static_assert` proves layout, or a generated serializer owns it; record image pair, generator version, owner, and review condition.

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
- Verification (agent): Find each byte-buffer-to-wide-pointer cast and prove buffer alignment plus offset divisibility from the type's `_Alignof`; otherwise flag it. Pass when every cast has a static proof or an explicit target support record; artifact: alignment proof and source scan.
- Verification (target): Using the `PROJECT_RULES.md` `buffer-alignment` configuration with alignment fault checking enabled, exercise aligned, odd-offset, and boundary inputs. Pass when aligned inputs decode correctly and unsupported offsets are rejected or never issued in 100% of cases; artifact: fault log, test trace, and configuration snapshot.
- Exceptions: A cast MAY be used only when buffer alignment and offset divisibility are recorded with target/core, owner, evidence, and review condition.

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

A field that crosses a boundary MUST use a fixed-width integer or explicitly sized byte type.

- Applies when: Declaring a protocol field, a register overlay, or any layout an external party defines.
- Rationale: `int`, `long`, and `enum` have implementation-defined width, so a field declared with one changes size between targets and no longer matches the external contract.
- Verification (agent): Inventory each boundary field's width and signedness against the external contract. Pass when every externally observed integer field uses the documented fixed-width type and no implementation-defined-width field remains; artifact: field-type table and source report.
- Verification (target): Using the `PROJECT_RULES.md` `external-layout` configuration, compile `_Static_assert` checks for each external field size and offset. Pass when the target build succeeds with every documented size and offset and the negative layout fixture fails; artifact: compiler output, layout report, and configuration snapshot.
- Exceptions: A project-defined wrapper type MAY stand for a fixed-width field only when its width, signedness, and target mapping are machine-checked and recorded with owner and review condition.

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
struct header {
    int id;       /* width varies by implementation */
    long length;  /* width varies by ABI */
};
```

### EMB-REPR-BITFIELD-001 [MUST]

A C bit-field MUST NOT describe a bit layout defined by an external interface.

- Applies when: Declaring or accessing protocol fields, register overlays, or shared-memory bits whose positions are defined outside one C implementation.
- Rationale: C leaves bit-field allocation order, straddling, and base-type details implementation-defined, so the same declaration can assign different bits on different targets. Mask and shift operations against a fixed-width value expose the intended layout directly.
- Verification (agent): Inventory each externally defined bit and inspect declarations for C bit-fields. Pass when every external bit is extracted or assigned with a documented mask and shift, with no external-layout bit-field remaining; artifact: bit-layout table and source report.
- Verification (target): Using the `PROJECT_RULES.md` `external-bit-layout` configuration, compile and run vectors that set each documented bit independently. Pass when each vector changes only its documented bit and the negative bit-field fixture is rejected by review or static analysis; artifact: bit-vector log, analysis output, and configuration snapshot.
- Exceptions: A bit-field MAY be used for state internal to one image only when its layout is not observed externally and the scope, owner, and review condition are recorded.

Correct:

```c
#include <stdint.h>

#define STATUS_READY_Pos 0U
#define STATUS_READY_Msk (1U << STATUS_READY_Pos)
#define STATUS_ERROR_Pos 1U
#define STATUS_ERROR_Msk (1U << STATUS_ERROR_Pos)

static uint32_t status_ready(uint32_t status)
{
    return (status & STATUS_READY_Msk) >> STATUS_READY_Pos;
}
```

Incorrect:

```c
struct status_bits {
    unsigned ready : 1;   /* bit position and allocation order are not portable */
    unsigned error : 1;
};

static unsigned status_ready(struct status_bits status)
{
    return status.ready;
}
```

## Module examples

See the larger [compliant](../../examples/EMB-REPR-SERIALIZE-001/compliant.c) and
[violating](../../examples/EMB-REPR-SERIALIZE-001/violation.c) examples.
