/* C-ARITH-PROMOTE-001 violating example. */

#include <stdint.h>

/*
 * a + b is computed in int and then truncated on assignment, so 200 + 100 stores 44.
 * The carry test compares the truncated result against an operand and cannot see the
 * bit that was lost, so the saturation never triggers.
 */
uint8_t saturating_add_u8(uint8_t a, uint8_t b)
{
    uint8_t sum = a + b;

    return (sum < a) ? (uint8_t)0xFFU : sum;
}
