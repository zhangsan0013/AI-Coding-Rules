/* EMB-MEM-LIFETIME-001 violating example. */

#include <stdint.h>

uint8_t *rx_buffer_acquire(void)
{
    uint8_t local_storage[64] = {0U};

    return local_storage;
}
