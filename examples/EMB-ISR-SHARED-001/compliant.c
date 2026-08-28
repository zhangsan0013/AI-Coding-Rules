/*
 * EMB-ISR-SHARED-001 compliant example.
 *
 * The handler owns the head index and the loop owns the tail index. Each is volatile and
 * is the core's atomic width, so publishing a slot is a single indivisible store and no
 * critical section is needed for the handoff.
 *
 * The drop counter is a read-modify-write, but it has one writer and one reader and the
 * read is indivisible at this width, so a reader sees either the old or the new value and
 * never a mixture.
 */

#include <stdbool.h>
#include <stdint.h>

#define SAMPLE_SLOTS 8u

static volatile uint32_t sample_head;      /* written by the handler only */
static volatile uint32_t sample_tail;      /* written by the loop only */
static volatile uint32_t sample_dropped;   /* written by the handler only */
static uint32_t samples[SAMPLE_SLOTS];

void adc_isr(void)
{
    uint32_t head = sample_head;
    uint32_t next = (head + 1u) % SAMPLE_SLOTS;

    if (next == sample_tail) {
        sample_dropped++;   /* EMB-ISR-ERROR-001: record the drop, never swallow it */
        return;
    }

    samples[head] = ADC0->RESULT;
    sample_head = next;     /* one indivisible store publishes the slot */
}

bool sample_take(uint32_t *value)
{
    uint32_t tail = sample_tail;

    if (tail == sample_head) {
        return false;
    }

    *value = samples[tail];
    sample_tail = (tail + 1u) % SAMPLE_SLOTS;
    return true;
}
