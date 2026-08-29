/* RTOS-COMMON-BLOCK-001 compliant example. */

#include <stdbool.h>
#include <stdint.h>

extern bool rtos_queue_receive(void *queue, void *item, uint32_t timeout_ticks);

bool worker_step(void *queue, uint32_t timeout_ticks)
{
    if (timeout_ticks == 0U) {
        return false;
    }
    return rtos_queue_receive(queue, 0, timeout_ticks);
}
