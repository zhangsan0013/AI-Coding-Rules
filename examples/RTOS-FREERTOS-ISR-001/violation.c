/* RTOS-FREERTOS-ISR-001 violating example. */

#include <stdint.h>

#define portMAX_DELAY 0xffffffffU

extern int xQueueSend(void *queue, const void *item, unsigned timeout);

void uart_isr(void *queue, uint8_t byte)
{
    (void)xQueueSend(queue, &byte, portMAX_DELAY);
}
