/*
 * EMB-ISR-SHARED-001 compliant example.
 *
 * The platform_sync_* functions are the synchronization seam. They must provide
 * target-supported, ISR-safe atomic accesses and the stated memory ordering; volatile is
 * not a substitute for that contract.
 *
 * The handler owns the head index and the loop owns the tail index. A release store
 * publishes a filled slot, and the consumer acquire-loads the head before reading it.
 * The consumer release-stores the tail only after it has finished reading the slot, so
 * the handler does not overwrite data still owned by the consumer.
 */

#include <stdbool.h>
#include <stdint.h>

#define ISR_SAMPLE_RING_SLOTS 8U

extern uint32_t platform_sync_load_relaxed_u32(const uint32_t *object);
extern uint32_t platform_sync_load_acquire_u32(const uint32_t *object);
extern void platform_sync_store_release_u32(uint32_t *object, uint32_t value);
extern uint32_t platform_adc_read_result_from_isr(void);
extern void platform_record_sample_drop_from_isr(void);

static uint32_t sample_head = 0U;
static uint32_t sample_tail = 0U;
static uint32_t sample_buffer[ISR_SAMPLE_RING_SLOTS] = {0U};

void adc_isr(void)
{
    uint32_t head;
    uint32_t tail;
    uint32_t next;

    head = platform_sync_load_relaxed_u32(&sample_head);
    tail = platform_sync_load_acquire_u32(&sample_tail);
    next = (head + 1U) % ISR_SAMPLE_RING_SLOTS;
    if (next == tail) {
        platform_record_sample_drop_from_isr();
        return;
    }

    sample_buffer[head] = platform_adc_read_result_from_isr();
    platform_sync_store_release_u32(&sample_head, next);
}

bool sample_take(uint32_t *value)
{
    uint32_t head;
    uint32_t tail;
    uint32_t next;

    tail = platform_sync_load_relaxed_u32(&sample_tail);
    head = platform_sync_load_acquire_u32(&sample_head);
    if (tail == head) {
        return false;
    }

    *value = sample_buffer[tail];
    next = (tail + 1U) % ISR_SAMPLE_RING_SLOTS;
    platform_sync_store_release_u32(&sample_tail, next);
    return true;
}
