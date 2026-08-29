/* EMB-MEM-LIFETIME-001 compliant example. */

#include <stdint.h>

static uint8_t rx_storage[64] = {0U};

uint8_t *rx_buffer_acquire(void)
{
    return rx_storage;
}
