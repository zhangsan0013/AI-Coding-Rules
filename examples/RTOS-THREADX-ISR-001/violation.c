/* RTOS-THREADX-ISR-001 violating example. */

#define TX_WAIT_FOREVER 0xffffffffU

extern unsigned tx_queue_send(void *queue, const void *message, unsigned wait_option);

void packet_isr(void *queue, const void *message)
{
    (void)tx_queue_send(queue, message, TX_WAIT_FOREVER);
}
