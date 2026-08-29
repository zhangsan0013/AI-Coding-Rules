/* RTOS-RTTHREAD-ISR-001 violating example. */

#define RT_WAITING_FOREVER 0xffffffffU

extern int rt_mb_send(void *mailbox, const void *message, unsigned timeout);

void sensor_isr(void *mailbox, const void *message)
{
    (void)rt_mb_send(mailbox, message, RT_WAITING_FOREVER);
}
