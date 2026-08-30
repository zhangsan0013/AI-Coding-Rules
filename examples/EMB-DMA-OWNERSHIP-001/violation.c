/* EMB-DMA-OWNERSHIP-001 violating example. */

#include <stdint.h>

extern void dma_start(const void *buffer, uint32_t length);

void transmit(void)
{
    uint8_t local_buffer[128] = {0U};

    dma_start(local_buffer, sizeof(local_buffer));
}
