/**
 * \file            counter.h
 * \brief           Bounded counter public interface.
 */

/*
 * SPDX-License-Identifier: MIT
 */

#if !defined(CONSTRAINT_DEMO_COUNTER_H)
#define CONSTRAINT_DEMO_COUNTER_H

#include <stdint.h>

#if defined(__cplusplus)
extern "C" {
#endif /* defined(__cplusplus) */

/**
 * \brief           Counter operation result.
 */
typedef enum {
    COUNTER_STATUS_OK = 0,             /*!< Operation completed. */
    COUNTER_STATUS_INVALID_ARGUMENT,   /*!< A required argument was invalid. */
    COUNTER_STATUS_NOT_INITIALIZED,    /*!< The counter has not been initialized. */
    COUNTER_STATUS_OVERFLOW,           /*!< The operation would exceed the counter range. */
} counter_status_t;

/**
 * \brief           Initialize the counter.
 * \param[in]       initial_value: Initial counter value.
 * \return          `COUNTER_STATUS_OK` on success.
 */
counter_status_t counter_init(uint32_t initial_value);

/**
 * \brief           Add a value without exceeding the counter range.
 * \param[in]       increment: Value to add.
 * \return          `COUNTER_STATUS_OK` on success, an error status otherwise.
 */
counter_status_t counter_add(uint32_t increment);

/**
 * \brief           Read the current counter value.
 * \param[out]      value: Output location; MUST NOT be `NULL`.
 * \return          `COUNTER_STATUS_OK` on success, an error status otherwise.
 */
counter_status_t counter_read(uint32_t *value);

#if defined(__cplusplus)
}
#endif /* defined(__cplusplus) */

#endif /* !defined(CONSTRAINT_DEMO_COUNTER_H) */
