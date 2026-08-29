/* RTOS-FREERTOS-ISR-001 compliant example. */

#include <stdint.h>

typedef int BaseType_t;

extern BaseType_t xQueueSendFromISR(void *queue, const void *item, BaseType_t *woken);
extern void portYIELD_FROM_ISR(BaseType_t woken);

void uart_isr(void *queue, uint8_t byte)
{
    BaseType_t higher_priority_task_woken = 0;

    (void)xQueueSendFromISR(queue, &byte, &higher_priority_task_woken);
    portYIELD_FROM_ISR(higher_priority_task_woken);
}
