/**
 * \file            template.c
 * \brief           Bounded sample module implementation.
 */

/*
 * Copyright (c) <year> <copyright-holder>
 * SPDX-License-Identifier: <project-license>
 */

#include "template.h"

static bool template_initialized = false;

template_status_t template_init(void)
{
    template_initialized = true;
    return TEMPLATE_STATUS_OK;
}

template_status_t template_encode(bool enabled, uint8_t *buffer, size_t capacity, size_t *written)
{
    uint8_t encoded_value = 0U;
    template_status_t status = TEMPLATE_STATUS_OK;

    if (written == NULL || (buffer == NULL && capacity != 0U)) {
        return TEMPLATE_STATUS_INVALID_ARGUMENT;
    }
    if (!template_initialized) {
        return TEMPLATE_STATUS_INVALID_ARGUMENT;
    }

    *written = 0U;
    if (capacity == 0U) {
        return TEMPLATE_STATUS_TOO_SMALL;
    }

    encoded_value = enabled ? 1U : 0U;

    if (capacity < sizeof(encoded_value)) {
        status = TEMPLATE_STATUS_TOO_SMALL;
    } else {
        buffer[0] = encoded_value;
        *written = sizeof(encoded_value);
    }

    return status;
}
