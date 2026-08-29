/*
 * EMB-ISR-SHARED-001 violating example.
 *
 * Three defects, each independently sufficient to break the handoff:
 *   1. Volatile is used as synchronization, but no ownership or publication protocol
 *      makes the payload visible before the ready flag.
 *   2. The ready flag is written from both contexts, so the handler's set and the loop's
 *      clear can lose one another.
 *   3. The sample and its timestamp are two separate stores read as a pair, so the loop
 *      can pair a new sample with an old timestamp.
 */

#include <stdbool.h>
#include <stdint.h>

extern uint32_t platform_adc_read_result_from_isr(void);
extern uint32_t platform_ticks_read_from_isr(void);

static volatile uint32_t last_sample = 0U;
static volatile uint32_t last_timestamp = 0U;
static volatile bool sample_ready = false;

void adc_isr(void)
{
    last_sample = platform_adc_read_result_from_isr();
    last_timestamp = platform_ticks_read_from_isr();
    sample_ready = true;   /* no release publication; repeated events overwrite state */
}

bool sample_read(uint32_t *sample, uint32_t *timestamp)
{
    if (!sample_ready) {
        return false;
    }

    *sample = last_sample;
    *timestamp = last_timestamp;   /* may belong to a different sample */
    sample_ready = false;          /* this clear can lose a concurrent ISR event */
    return true;
}
