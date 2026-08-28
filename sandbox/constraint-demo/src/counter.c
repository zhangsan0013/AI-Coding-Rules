/**
 * \file            counter.c
 * \brief           Bounded counter implementation.
 */

/*
 * SPDX-License-Identifier: MIT
 */

#include "counter.h"

#include <stdbool.h>
#include <stddef.h>

static uint32_t counter_value = 0U;
static bool counter_initialized = false;

counter_status_t counter_init(uint32_t initial_value)
{
    counter_value = initial_value;
    counter_initialized = true;
    return COUNTER_STATUS_OK;
}

counter_status_t counter_add(uint32_t increment)
{
    if (!counter_initialized) {
        return COUNTER_STATUS_NOT_INITIALIZED;
    }

    if (UINT32_MAX - counter_value < increment) {
        return COUNTER_STATUS_OVERFLOW;
    }

    counter_value += increment;
    return COUNTER_STATUS_OK;
}

counter_status_t counter_read(uint32_t *value)
{
    if (value == NULL) {
        return COUNTER_STATUS_INVALID_ARGUMENT;
    }

    if (!counter_initialized) {
        return COUNTER_STATUS_NOT_INITIALIZED;
    }

    *value = counter_value;
    return COUNTER_STATUS_OK;
}
