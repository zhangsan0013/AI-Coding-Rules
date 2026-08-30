/* EMB-REPR-SERIALIZE-001 compliant example. */

#include <stddef.h>
#include <stdint.h>

/*
 * Each field is written to the wire in the protocol's byte order with explicit shifts.
 * The result is independent of this CPU's endianness and carries no structure padding.
 */
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
