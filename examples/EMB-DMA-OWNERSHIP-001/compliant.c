/* EMB-DMA-OWNERSHIP-001 compliant example. */

#include <stdbool.h>
#include <stdint.h>

extern void dma_prepare_for_device(const void *buffer, uint32_t length);
extern bool dma_start(const void *buffer, uint32_t length);

static uint8_t tx_buffer[128] = {0U};

bool transmit(void)
{
    dma_prepare_for_device(tx_buffer, sizeof(tx_buffer));
    return dma_start(tx_buffer, sizeof(tx_buffer));
}
