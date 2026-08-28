/*
 * EMB-ISR-SHARED-001 violating example.
 *
 * Three defects, each independently sufficient to break the handoff:
 *   1. Neither flag nor counter is volatile, so the loop may hoist or cache the read.
 *   2. The ready flag is written from both contexts, so the handler's set and the loop's
 *      clear can lose one another.
 *   3. The sample and its timestamp are two separate stores read as a pair, so the loop
 *      can pair a new sample with an old timestamp.
 */

#include <stdbool.h>
#include <stdint.h>

static uint32_t last_sample;
static uint32_t last_timestamp;
static bool sample_ready;
static uint32_t sample_count;

void adc_isr(void)
{
    last_sample = ADC0->RESULT;
    last_timestamp = system_ticks;   /* the loop can read between these two stores */
    sample_ready = true;
    sample_count = sample_count + 1u;
}

bool sample_read(uint32_t *sample, uint32_t *timestamp)
{
    if (!sample_ready) {
        return false;
    }

    *sample = last_sample;
    *timestamp = last_timestamp;   /* may belong to a different sample */
    sample_ready = false;          /* both contexts write this flag */
    return true;
}
