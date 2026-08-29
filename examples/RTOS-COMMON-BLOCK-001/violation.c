/* RTOS-COMMON-BLOCK-001 violating example. */

#define RTOS_WAIT_FOREVER 0xffffffffU

extern int rtos_queue_receive(void *queue, void *item, unsigned timeout_ticks);

void interrupt_callback(void *queue)
{
    (void)rtos_queue_receive(queue, 0, RTOS_WAIT_FOREVER);
}
