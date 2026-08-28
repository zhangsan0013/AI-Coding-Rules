/**
 * \file            test_counter.c
 * \brief           Bounded counter contract tests.
 */

/*
 * SPDX-License-Identifier: MIT
 */

#include <assert.h>
#include <stddef.h>
#include <stdint.h>

#include "counter.h"

int main(void)
{
    uint32_t value = 0U;

    assert(counter_read(NULL) == COUNTER_STATUS_INVALID_ARGUMENT);
    assert(counter_add(1U) == COUNTER_STATUS_NOT_INITIALIZED);
    assert(counter_read(&value) == COUNTER_STATUS_NOT_INITIALIZED);
    assert(value == 0U);
    assert(counter_init(0U) == COUNTER_STATUS_OK);
    assert(counter_add(0U) == COUNTER_STATUS_OK);
    assert(counter_read(&value) == COUNTER_STATUS_OK);
    assert(value == 0U);
    assert(counter_init(UINT32_MAX - 1U) == COUNTER_STATUS_OK);
    assert(counter_add(1U) == COUNTER_STATUS_OK);
    assert(counter_read(&value) == COUNTER_STATUS_OK);
    assert(value == UINT32_MAX);
    assert(counter_add(1U) == COUNTER_STATUS_OVERFLOW);
    assert(counter_read(&value) == COUNTER_STATUS_OK);
    assert(value == UINT32_MAX);
    assert(counter_init(UINT32_MAX) == COUNTER_STATUS_OK);
    assert(counter_read(NULL) == COUNTER_STATUS_INVALID_ARGUMENT);
    assert(counter_read(&value) == COUNTER_STATUS_OK);
    assert(value == UINT32_MAX);

    return 0;
}
