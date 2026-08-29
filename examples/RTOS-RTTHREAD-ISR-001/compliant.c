/* RTOS-RTTHREAD-ISR-001 compliant example. */

#include <stdint.h>

extern int project_rtthread_mailbox_send_from_isr(void *mailbox, uint32_t value);

void sensor_isr(void *mailbox, uint32_t value)
{
    (void)project_rtthread_mailbox_send_from_isr(mailbox, value);
}
