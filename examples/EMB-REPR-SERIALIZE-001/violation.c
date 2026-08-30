/* EMB-REPR-SERIALIZE-001 violating example. */

#include <stddef.h>
#include <stdint.h>
#include <string.h>

/*
 * Copying the structure's bytes sends this CPU's byte order and the padding the compiler
 * inserted between id and length, neither of which the protocol defines. The same source
 * produces different wire bytes on a different target.
 */
struct header {
    uint16_t id;
    uint32_t length;
};

size_t encode_header(uint8_t *out, uint16_t id, uint32_t length)
{
    struct header h = { id, length };

    memcpy(out, &h, sizeof(h));
    return sizeof(h);
}
