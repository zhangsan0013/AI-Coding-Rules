/**
 * \file            template.h
 * \brief           Bounded sample module interface.
 */

/*
 * Copyright (c) <year> <copyright-holder>
 * SPDX-License-Identifier: <project-license>
 */

#ifndef TEMPLATE_H
#define TEMPLATE_H

#include <stdbool.h>
#include <stddef.h>
#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif /* __cplusplus */

/**
 * \brief           Operation result.
 */
typedef enum {
    TEMPLATE_STATUS_OK = 0,             /*!< Operation completed. */
    TEMPLATE_STATUS_INVALID_ARGUMENT,   /*!< A required argument was invalid. */
    TEMPLATE_STATUS_NO_MEMORY,          /*!< The configured allocator could not provide memory. */
    TEMPLATE_STATUS_TOO_SMALL,          /*!< The output buffer is too small. */
} template_status_t;

/**
 * \brief           Initialize the template module.
 * \return          `TEMPLATE_STATUS_OK` on success, an error status otherwise.
 */
template_status_t template_init(void);

/**
 * \brief           Encode a logical state into a caller-provided buffer.
 * \param[in]       enabled: Logical state to encode.
 * \param[out]      buffer: Output buffer; MUST NOT be `NULL` when `capacity` is non-zero.
 * \param[in]       capacity: Buffer capacity in bytes.
 * \param[out]      written: Number of bytes written; MUST NOT be `NULL`.
 * \return          `TEMPLATE_STATUS_OK` on success, an error status otherwise.
 */
template_status_t template_encode(bool enabled, uint8_t *buffer, size_t capacity, size_t *written);

#ifdef __cplusplus
}
#endif /* __cplusplus */

#endif /* TEMPLATE_H */
