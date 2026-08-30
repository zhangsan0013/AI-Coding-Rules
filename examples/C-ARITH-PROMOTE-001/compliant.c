/* C-ARITH-PROMOTE-001 compliant example. */

#include <stdint.h>

/*
 * The intermediate sum is computed at a stated width wide enough to hold it, then
 * saturated, so the promotion to int cannot silently truncate the result.
 */
uint8_t saturating_add_u8(uint8_t a, uint8_t b)
{
    uint16_t sum = (uint16_t)a + (uint16_t)b;

    return (sum > 0xFFU) ? (uint8_t)0xFFU : (uint8_t)sum;
}
