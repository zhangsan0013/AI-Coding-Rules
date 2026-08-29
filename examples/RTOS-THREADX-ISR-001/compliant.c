/* RTOS-THREADX-ISR-001 compliant example. */

#include <stdint.h>

#define TX_NO_WAIT 0U

extern unsigned project_threadx_queue_send_from_isr(void *queue,
                                                     const void *message,
                                                     unsigned wait_option);

void packet_isr(void *queue, const uint32_t *message)
{
    (void)project_threadx_queue_send_from_isr(queue, message, TX_NO_WAIT);
}
