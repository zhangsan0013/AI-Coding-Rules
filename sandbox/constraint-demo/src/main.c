/**
 * \file            main.c
 * \brief           Bounded counter application.
 */

/*
 * SPDX-License-Identifier: MIT
 */

#include <inttypes.h>
#include <stdio.h>

#include "counter.h"

int main(void)
{
    counter_status_t status = COUNTER_STATUS_OK;
    uint32_t value = 0U;

    status = counter_init(10U);
    if (status != COUNTER_STATUS_OK) {
        return 1;
    }

    status = counter_add(5U);
    if (status != COUNTER_STATUS_OK) {
        return 1;
    }

    status = counter_read(&value);
    if (status != COUNTER_STATUS_OK) {
        return 1;
    }

    (void)printf("counter=%" PRIu32 "\n", value);
    return 0;
}
